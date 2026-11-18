/* PAWSAFE — módulo de Voluntários e Gestão de Equipe
   Equipe (ativos e inativos) e interessados que chegaram pelo formulário público
   (Pages/voluntario-cadastro.html). Dados do artigo: nome completo, e-mail, telefone,
   habilidades, experiências prévias e disponibilidade de horários.
   Depende de: Bootstrap 5, js/dados.js (PawData), js/utils.js (PawUtils) e js/sidebar.js. */

const $ = (id) => document.getElementById(id);
const { today, formatDate, escapeHtml, plural, checkboxes, checkedValues, maskPhone } = PawUtils;

// ================= Estado =================
let volunteers = PawData.loadVolunteers();
let view = 'team'; // 'team' (ativos e inativos) | 'pending' (interessados)

const modal = new bootstrap.Modal($('volunteerModal'));
const toast = new bootstrap.Toast($('toast'), { delay: 2800 });
const form = $('volunteerForm');

const findVolunteer = (id) => volunteers.find(v => v.id === id);
const normalize = (text) => String(text ?? '').toLocaleLowerCase('pt-BR');
const initials = (name) => name.replace(/^(Dra?\.)\s*/, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const daysWaiting = (date) => Math.max(0, Math.round((new Date(`${today()}T12:00:00`) - new Date(`${date}T12:00:00`)) / 86400000));

function notify(message) {
  $('toastText').textContent = message;
  toast.show();
}

function save() {
  if (PawData.saveVolunteers(volunteers)) return true;
  notify('Não foi possível salvar.');
  return false;
}

// ================= Lista =================
function getFiltered() {
  const term = normalize($('search').value.trim());
  const skill = $('skillFilter').value;
  const day = $('dayFilter').value;

  return volunteers
    .filter(v => (view === 'pending' ? v.status === 'Interessado' : v.status !== 'Interessado'))
    .filter(v => !term || normalize([v.name, v.email, v.phone].join(' ')).includes(term))
    .filter(v => !skill || v.skills.includes(skill))
    .filter(v => !day || v.days.includes(day))
    .sort((a, b) => view === 'pending'
      ? a.createdAt.localeCompare(b.createdAt)                                   // quem espera há mais tempo primeiro
      : (a.status === 'Inativo') - (b.status === 'Inativo') || a.name.localeCompare(b.name, 'pt-BR'));
}

function cardHtml(v) {
  const waiting = daysWaiting(v.createdAt);
  return `
    <article class="volunteer-card${v.status === 'Inativo' ? ' is-inactive' : ''}">
      <div class="volunteer-head">
        <span class="volunteer-avatar">${escapeHtml(initials(v.name))}</span>
        <div class="volunteer-name"><strong>${escapeHtml(v.name)}</strong><small>${escapeHtml(v.role)}</small></div>
        <span class="status-badge ${PawData.volunteerClass(v.status)}">${v.status}</span>
      </div>
      <div class="volunteer-contact">
        <span><i class="bi bi-telephone"></i>${escapeHtml(v.phone)}</span>
        <span><i class="bi bi-envelope"></i>${escapeHtml(v.email)}</span>
      </div>
      <div class="skill-tags">${v.skills.map(s => `<span class="skill-tag">${escapeHtml(s)}</span>`).join('')}</div>
      <p class="volunteer-availability"><i class="bi bi-calendar-week"></i>${v.days.join(', ')} · ${v.shifts.join(', ')}</p>
      <div class="volunteer-foot">
        ${v.status === 'Interessado'
          ? `<small class="${waiting > 7 ? 'waiting-late' : ''}">Inscrito ${waiting ? `há ${plural(waiting, 'dia', 'dias')}` : 'hoje'}</small>
             <div><button type="button" class="btn btn-outline-green" data-open="${v.id}">Ficha</button>
             <button type="button" class="btn btn-green" data-approve="${v.id}"><i class="bi bi-check2 me-1"></i>Aprovar</button></div>`
          : `<small>Desde ${formatDate(v.createdAt)}</small>
             <button type="button" class="btn btn-outline-green" data-open="${v.id}">Ficha</button>`}
      </div>
    </article>`;
}

function render() {
  const list = getFiltered();
  const active = volunteers.filter(v => v.status === 'Ativo').length;
  const pending = volunteers.filter(v => v.status === 'Interessado').length;

  $('activeText').textContent = plural(active, 'voluntário ativo', 'voluntários ativos');
  $('pendingText').textContent = `${plural(pending, 'interessado', 'interessados')} aguardando contato`;
  $('pendingCount').textContent = pending || '';

  $('volunteerList').innerHTML = list.map(cardHtml).join('');
  $('volunteerList').classList.toggle('d-none', !list.length);
  $('empty').classList.toggle('d-none', list.length > 0);
  const filtering = $('search').value || $('skillFilter').value || $('dayFilter').value;
  $('emptyTitle').textContent = view === 'pending' && !filtering ? 'Nenhum interessado aguardando' : 'Ninguém encontrado';
  $('emptyText').textContent = view === 'pending' && !filtering
    ? 'Divulgue o link do formulário para receber novas inscrições.' : 'Altere a busca ou os filtros.';
  $('resultsText').textContent = `Exibindo ${plural(list.length, 'pessoa', 'pessoas')}`;

  // Contador de interessados no menu lateral
  const badge = document.querySelector('[data-count="voluntarios"]');
  if (badge) { badge.textContent = pending; badge.classList.toggle('d-none', !pending); }
}

function setView(next) {
  view = next;
  document.querySelectorAll('[data-view]').forEach(tab => tab.classList.toggle('active', tab.dataset.view === next));
  render();
}

// ================= Situação =================
// Interessado → Ativo (aprovado) ou Inativo (arquivado); Ativo ↔ Inativo.
const STATUS_ACTIONS = {
  'Interessado': [
    { to: 'Ativo', label: 'Aprovar e incluir na equipe', icon: 'bi-check2-circle', style: 'btn-green' },
    { to: 'Inativo', label: 'Arquivar inscrição', icon: 'bi-archive', style: 'btn-outline-green' }
  ],
  'Ativo': [{ to: 'Inativo', label: 'Inativar', icon: 'bi-pause-circle', style: 'btn-outline-green' }],
  'Inativo': [{ to: 'Ativo', label: 'Reativar', icon: 'bi-play-circle', style: 'btn-green' }]
};

function changeStatus(id, to) {
  const v = findVolunteer(id);
  if (!v) return;
  v.status = to;
  if (!save()) return;
  render();
  if (Number($('volunteerId').value) === id) renderStatus(v);
  notify(to === 'Ativo' ? `${v.name.split(' ')[0]} agora faz parte da equipe.` : `${v.name} foi inativado(a).`);
}

function renderStatus(v) {
  $('volunteerStatus').textContent = v.status;
  $('volunteerStatus').className = `status-badge ${PawData.volunteerClass(v.status)}`;
  $('statusBar').innerHTML = STATUS_ACTIONS[v.status].map(a => `
    <button type="button" class="btn ${a.style}" data-status="${a.to}"><i class="bi ${a.icon} me-1"></i>${a.label}</button>`).join('');
}

// ================= Cadastro / ficha =================
function openForm(v = null) {
  form.reset();
  $('volunteerId').value = v?.id ?? '';
  $('formError').classList.add('d-none');

  $('vName').value = v?.name ?? '';
  $('vRole').value = v?.role ?? 'Voluntário';
  $('vEmail').value = v?.email ?? '';
  $('vPhone').value = v?.phone ?? '';
  $('vExperience').value = v?.experience ?? '';
  $('vNotes').value = v?.notes ?? '';
  $('vSkills').innerHTML = checkboxes('skill', PawData.SKILLS, v?.skills);
  $('vDays').innerHTML = checkboxes('day', PawData.DAYS, v?.days);
  $('vShifts').innerHTML = checkboxes('shift', PawData.SHIFTS, v?.shifts);

  // Quem veio pelo formulário já deu o consentimento lá
  $('consentRow').classList.toggle('d-none', Boolean(v?.consent));

  $('volunteerTitle').textContent = v ? v.name : 'Cadastrar voluntário';
  $('volunteerSubtitle').textContent = v
    ? `${v.source === 'Formulário' ? 'Inscrito pelo formulário' : 'Cadastrado pela equipe'} em ${formatDate(v.createdAt)}`
    : 'Dados de contato, habilidades e disponibilidade.';
  $('volunteerStatus').classList.toggle('d-none', !v);
  $('statusBar').classList.toggle('d-none', !v);
  if (v) renderStatus(v);
  $('deleteVolunteer').classList.toggle('d-none', !v);
  $('saveVolunteerButton').innerHTML = `<i class="bi bi-check2 me-2"></i>${v ? 'Salvar alterações' : 'Cadastrar voluntário'}`;
  modal.show();
}

function showError(message) {
  $('formError').textContent = message;
  $('formError').classList.remove('d-none');
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const existing = findVolunteer(Number($('volunteerId').value));
  const data = {
    name: $('vName').value.trim(),
    role: $('vRole').value,
    email: $('vEmail').value.trim().toLowerCase(),
    phone: $('vPhone').value.trim(),
    skills: checkedValues(form, 'skill'),
    experience: $('vExperience').value.trim(),
    days: checkedValues(form, 'day'),
    shifts: checkedValues(form, 'shift'),
    notes: $('vNotes').value.trim()
  };

  if (!form.reportValidity()) return;
  if (data.phone.replace(/\D/g, '').length < 10) return showError('Informe o telefone com DDD.');
  if (!data.skills.length) return showError('Marque ao menos uma habilidade.');
  if (!data.days.length || !data.shifts.length) return showError('Marque ao menos um dia e um turno disponíveis.');
  if (volunteers.some(v => v.email === data.email && v.id !== existing?.id)) return showError('Já existe alguém cadastrado com este e-mail.');
  if (!existing && !$('vConsent').checked) return showError('Confirme o consentimento do voluntário (LGPD).');

  let renamedRescues = 0;
  if (existing) {
    // Os resgates guardam o nome do responsável; ao renomear, eles acompanham.
    if (existing.name !== data.name) {
      const rescues = PawData.loadRescues();
      rescues.filter(r => r.responsible === existing.name).forEach(r => { r.responsible = data.name; renamedRescues++; });
      if (renamedRescues) PawData.saveRescues(rescues);
    }
    Object.assign(existing, data);
  } else {
    volunteers.push({
      id: PawUtils.nextId(volunteers), ...data,
      status: 'Ativo', source: 'Cadastro interno', consent: true, createdAt: today()
    });
  }

  if (!save()) return;
  modal.hide();
  render();
  notify(existing
    ? `Cadastro atualizado${renamedRescues ? ` (nome trocado em ${plural(renamedRescues, 'resgate', 'resgates')})` : ''}.`
    : `${data.name} incluído(a) na equipe.`);
});

$('deleteVolunteer').addEventListener('click', () => {
  const v = findVolunteer(Number($('volunteerId').value));
  if (!v) return;
  const rescuesHandled = PawData.loadRescues().filter(r => r.responsible === v.name).length;
  if (rescuesHandled) {
    notify(`${v.name} é responsável por ${plural(rescuesHandled, 'resgate', 'resgates')}. Use “Inativar” para manter o histórico.`);
    return;
  }
  const question = v.status === 'Interessado' ? `Descartar a inscrição de ${v.name}?` : `Excluir ${v.name} da equipe?`;
  if (!window.confirm(`${question} Esta ação não pode ser desfeita.`)) return;
  volunteers = volunteers.filter(item => item.id !== v.id);
  save();
  modal.hide();
  render();
  notify('Cadastro excluído.');
});

$('vPhone').addEventListener('input', (e) => { e.target.value = maskPhone(e.target.value); });
form.addEventListener('input', () => $('formError').classList.add('d-none'));

// Link para divulgar (Instagram, WhatsApp...). No protótipo só funciona no mesmo computador.
$('copyLink').addEventListener('click', async () => {
  const url = new URL('voluntario-cadastro.html', window.location.href).href;
  try {
    await navigator.clipboard.writeText(url);
    notify('Link do formulário copiado.');
  } catch {
    window.prompt('Copie o link do formulário:', url);
  }
});

// ================= Eventos =================
document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-view], [data-open], [data-approve], [data-status]');
  if (!target) return;
  const d = target.dataset;
  if (d.view) setView(d.view);
  else if (d.open) openForm(findVolunteer(Number(d.open)));
  else if (d.approve) changeStatus(Number(d.approve), 'Ativo');
  else if (d.status) changeStatus(Number($('volunteerId').value), d.status);
});

$('search').addEventListener('input', render);
$('skillFilter').addEventListener('change', render);
$('dayFilter').addEventListener('change', render);
$('clearFilters').addEventListener('click', () => {
  $('search').value = '';
  $('skillFilter').value = '';
  $('dayFilter').value = '';
  render();
});
$('addVolunteer').addEventListener('click', () => openForm());

// Opções vindas de dados.js
$('skillFilter').innerHTML += PawData.SKILLS.map(s => `<option>${s}</option>`).join('');
$('dayFilter').innerHTML += PawData.DAYS.map(d => `<option>${d}</option>`).join('');
$('vRole').innerHTML = PawData.ROLES.map(r => `<option>${r}</option>`).join('');

render();
