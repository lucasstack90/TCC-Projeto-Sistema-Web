/* PAWSAFE — módulo de Resgates
   Registro das ocorrências (endereço, descrição da situação, data do ocorrido e responsável),
   acompanhamento até a conclusão e resumo das ações da equipe em um período.
   Depende de: Bootstrap 5, js/dados.js (PawData), js/utils.js (PawUtils) e js/sidebar.js. */

const $ = (id) => document.getElementById(id);
const { today, formatDate, escapeHtml, plural } = PawUtils;
const rescueCode = (id) => PawUtils.code('RES', id);
const animalCode = (id) => PawUtils.code('PAW', id);

// ================= Estado =================
let rescues = PawData.loadRescues();
const animals = PawData.loadAnimals(); // só leitura aqui; o cadastro do animal é feito no módulo de Animais

let openRescueId = null;

const rescueModal = new bootstrap.Modal($('rescueModal'));
const detailModal = new bootstrap.Modal($('detailModal'));
const toast = new bootstrap.Toast($('toast'), { delay: 2800 });

const findRescue = (id) => rescues.find(r => r.id === id);
const findAnimal = (id) => animals.find(a => a.id === id);
const isOpen = (rescue) => PawData.OPEN_RESCUE_STAGES.includes(rescue.stage);
const normalize = (text) => String(text ?? '').toLocaleLowerCase('pt-BR');
const fullAddress = (r) => `${r.street}${r.number ? `, ${r.number}` : ''} — ${r.district}, ${r.city}`;

function notify(message) {
  $('toastText').textContent = message;
  toast.show();
}

function save() {
  if (PawData.saveRescues(rescues)) return true;
  notify('Não foi possível salvar o resgate.');
  return false;
}

// ================= Período =================
const toIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function applyPreset(preset) {
  const now = new Date();
  const daysAgo = (n) => toIso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n + 1));
  const ranges = {
    month: [toIso(new Date(now.getFullYear(), now.getMonth(), 1)), today()],
    30: [daysAgo(30), today()],
    90: [daysAgo(90), today()],
    year: [toIso(new Date(now.getFullYear(), 0, 1)), today()],
    all: ['', '']
  };
  if (!ranges[preset]) return; // "personalizado": mantém as datas digitadas
  [$('periodFrom').value, $('periodTo').value] = ranges[preset];
}

const inPeriod = (r) => (!$('periodFrom').value || r.date >= $('periodFrom').value)
  && (!$('periodTo').value || r.date <= $('periodTo').value);

function periodLabel() {
  const from = $('periodFrom').value, to = $('periodTo').value;
  if (!from && !to) return 'Todo o período';
  if (!from) return `Até ${formatDate(to)}`;
  if (!to) return `A partir de ${formatDate(from)}`;
  return `${formatDate(from)} a ${formatDate(to)}`;
}

function renderPeriod() {
  const list = rescues.filter(inPeriod);
  const sheltered = list.reduce((sum, r) => sum + r.animalIds.length, 0);
  const stats = [
    ['Ocorrências', list.length, 'bi-flag', 'icon-terra'],
    ['Concluídos', list.filter(r => r.stage === 'Concluído').length, 'bi-check2-circle', 'icon-green'],
    ['Em aberto', list.filter(isOpen).length, 'bi-hourglass-split', 'icon-blue'],
    ['Animais acolhidos', sheltered, 'bi-paw', 'icon-lilac']
  ];
  $('periodStats').innerHTML = stats.map(([label, value, icon, color]) => `
    <div class="period-stat">
      <span class="period-icon ${color}"><i class="bi ${icon}"></i></span>
      <div><strong>${value}</strong><small>${label}</small></div>
    </div>`).join('');

  // Quantos resgates cada responsável atendeu no período
  const byPerson = {};
  list.forEach(r => { byPerson[r.responsible] = (byPerson[r.responsible] || 0) + 1; });
  const team = Object.entries(byPerson).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'));
  $('periodTeam').innerHTML = team.length
    ? `<span class="team-label"><i class="bi bi-people me-1"></i>Responsáveis:</span>${team
      .map(([name, count]) => `<span class="team-chip">${escapeHtml(name)} <strong>${count}</strong></span>`).join('')}`
    : '';

  $('printPeriod').textContent = `Período: ${periodLabel()} · emitido em ${formatDate(today())}`;
}

// ================= Lista =================
const PRIORITY_ORDER = { 'Crítica': 0, 'Alta': 1, 'Média': 2, 'Baixa': 3 };

function getFilteredRescues() {
  const term = normalize($('search').value.trim());
  const stage = $('stageFilter').value;
  const priority = $('priorityFilter').value;

  return rescues
    .filter(inPeriod)
    .filter(r => stage === 'Todas' || r.stage === stage)
    .filter(r => priority === 'Todas' || r.priority === priority)
    .filter(r => !term || normalize([r.street, r.district, r.description, r.responsible, r.reference, rescueCode(r.id)].join(' ')).includes(term))
    // Em aberto primeiro (mais urgentes no topo); depois os mais recentes.
    .sort((a, b) => (isOpen(b) - isOpen(a))
      || (isOpen(a) ? PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] : 0)
      || b.date.localeCompare(a.date));
}

function rescueCardHtml(r) {
  const count = r.animalIds.length;
  return `
    <article class="rescue-card ${PawData.priorityClass(r.priority)}">
      <div class="rescue-main">
        <div class="rescue-meta">
          <strong>${rescueCode(r.id)}</strong>
          <span><i class="bi bi-calendar3 me-1"></i>${formatDate(r.date)}</span>
          <span class="status-badge ${PawData.priorityClass(r.priority)}">${r.priority}</span>
        </div>
        <p class="rescue-description">${escapeHtml(r.description)}</p>
        <div class="rescue-details">
          <span><i class="bi bi-geo-alt"></i>${escapeHtml(r.district)} · ${escapeHtml(r.street)}</span>
          <span><i class="bi bi-person"></i>${escapeHtml(r.responsible)}</span>
          <span><i class="bi bi-paw"></i>${escapeHtml(r.species)} × ${r.quantity}${count ? ` · ${plural(count, 'acolhido', 'acolhidos')}` : ''}</span>
        </div>
      </div>
      <div class="rescue-side">
        <span class="status-badge ${PawData.rescueClass(r.stage)}">${r.stage}</span>
        <button type="button" class="btn btn-outline-green" data-rescue="${r.id}">Abrir</button>
      </div>
    </article>`;
}

function render() {
  const list = getFilteredRescues();
  const open = rescues.filter(isOpen).length;

  $('openText').textContent = `${plural(open, 'ocorrência em aberto', 'ocorrências em aberto')}`;
  $('totalText').textContent = `${plural(rescues.length, 'resgate registrado', 'resgates registrados')}`;
  $('rescueList').innerHTML = list.map(rescueCardHtml).join('');
  $('rescueList').classList.toggle('d-none', !list.length);
  $('empty').classList.toggle('d-none', list.length > 0);
  $('resultsText').textContent = `Exibindo ${list.length} de ${plural(rescues.filter(inPeriod).length, 'ocorrência', 'ocorrências')} do período`;
  renderPeriod();

  // Atualiza o número de pendências no menu lateral
  const badge = document.querySelector('[data-count="resgates"]');
  if (badge) {
    badge.textContent = open;
    badge.classList.toggle('d-none', !open);
  }
}

function clearFilters() {
  $('search').value = '';
  $('stageFilter').value = 'Todas';
  $('priorityFilter').value = 'Todas';
  render();
}

// ================= Registro / edição =================
const FIELDS = {
  rsDate: 'date', rsPriority: 'priority', rsResponsible: 'responsible', rsDescription: 'description',
  rsSpecies: 'species', rsQuantity: 'quantity', rsReporter: 'reporter',
  rsStreet: 'street', rsNumber: 'number', rsDistrict: 'district', rsCity: 'city', rsReference: 'reference'
};

function openForm(rescue = null) {
  $('rescueForm').reset();
  $('rescueId').value = rescue?.id ?? '';
  $('rsDate').max = today();

  // Sugestões com os responsáveis já usados (até existir o módulo de Voluntários)
  $('responsibleList').innerHTML = [...new Set(rescues.map(r => r.responsible))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .map(name => `<option value="${escapeHtml(name)}">`).join('');

  if (rescue) {
    Object.entries(FIELDS).forEach(([field, key]) => { $(field).value = rescue[key] ?? ''; });
  } else {
    $('rsDate').value = today();
    $('rsPriority').value = 'Média';
    $('rsCity').value = 'Guarapuava - PR';
  }

  $('rescueFormTitle').textContent = rescue ? `Editar ${rescueCode(rescue.id)}` : 'Registrar resgate';
  $('saveRescueButton').innerHTML = `<i class="bi bi-check2 me-2"></i>${rescue ? 'Salvar alterações' : 'Registrar resgate'}`;
  rescueModal.show();
}

$('rescueForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const existing = findRescue(Number($('rescueId').value));
  const data = {};
  Object.entries(FIELDS).forEach(([field, key]) => { data[key] = $(field).value.trim(); });
  data.quantity = Number(data.quantity);

  const backup = JSON.stringify(rescues);
  let rescue = existing;
  if (existing) {
    Object.assign(existing, data);
    existing.log.unshift({ date: today(), stage: existing.stage, text: 'Dados da ocorrência atualizados.' });
  } else {
    rescue = {
      id: PawUtils.nextId(rescues), ...data,
      stage: 'Pendente', closedAt: '', animalIds: [],
      log: [{ date: today(), stage: 'Pendente', text: 'Ocorrência registrada.' }]
    };
    rescues.push(rescue);
  }

  if (!save()) { rescues = JSON.parse(backup); return; }
  rescueModal.hide();
  // Um resgate novo fora do período escolhido ficaria escondido; volta para "Todo o período".
  if (!inPeriod(rescue)) { $('periodPreset').value = 'all'; applyPreset('all'); }
  render();
  notify(existing ? 'Resgate atualizado.' : `Resgate ${rescueCode(rescue.id)} registrado.`);
});

// ================= Ficha do resgate =================
const NOTE_ONLY = { to: null, label: 'Adicionar observação', icon: 'bi-chat-left-text', style: 'btn-outline-green', needsNote: true };
const REOPEN = { to: 'Em atendimento', label: 'Reabrir', icon: 'bi-arrow-counterclockwise', style: 'btn-outline-green', needsNote: true };

const ACTIONS = {
  'Pendente': [
    { to: 'Em atendimento', label: 'Iniciar atendimento', icon: 'bi-truck', style: 'btn-green' },
    { to: 'Concluído', label: 'Concluir', icon: 'bi-check2-circle', style: 'btn-outline-green' },
    { to: 'Sem sucesso', label: 'Sem sucesso', icon: 'bi-x-circle', style: 'btn-outline-danger', needsNote: true },
    NOTE_ONLY
  ],
  'Em atendimento': [
    { to: 'Concluído', label: 'Concluir', icon: 'bi-check2-circle', style: 'btn-green' },
    { to: 'Sem sucesso', label: 'Sem sucesso', icon: 'bi-x-circle', style: 'btn-outline-danger', needsNote: true },
    NOTE_ONLY
  ],
  'Concluído': [REOPEN],
  'Sem sucesso': [REOPEN]
};

const DEFAULT_LOG = {
  'Em atendimento': 'Equipe iniciou o atendimento.',
  'Concluído': 'Resgate concluído.'
};

function openDetail(id) {
  openRescueId = id;
  $('stageNote').value = '';
  $('stageNote').classList.remove('is-invalid');
  renderDetail();
  detailModal.show();
}

function renderDetail() {
  const r = findRescue(openRescueId);
  if (!r) return;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${r.street} ${r.number}, ${r.district}, ${r.city}`)}`;

  $('detailCode').textContent = rescueCode(r.id);
  $('detailStage').textContent = r.stage;
  $('detailStage').className = `status-badge ${PawData.rescueClass(r.stage)}`;
  $('detailPriority').textContent = `Prioridade ${r.priority.toLowerCase()}`;
  $('detailPriority').className = `status-badge ${PawData.priorityClass(r.priority)}`;
  $('detailSubtitle').textContent = `Ocorrido em ${formatDate(r.date)}${r.closedAt ? ` · encerrado em ${formatDate(r.closedAt)}` : ''}`;

  $('detailInfo').innerHTML = `
    <div class="info-tile info-wide">
      <small>Descrição da situação</small>
      <p class="m-0">${escapeHtml(r.description)}</p>
    </div>
    <div class="info-tile info-wide">
      <small>Endereço</small>
      <strong>${escapeHtml(fullAddress(r))}</strong>
      ${r.reference ? `<p class="m-0 mt-1">${escapeHtml(r.reference)}</p>` : ''}
      <a class="map-link" href="${mapsUrl}" target="_blank" rel="noopener"><i class="bi bi-map me-1"></i>Abrir no mapa</a>
    </div>
    <div class="info-tile"><small>Responsável</small><strong>${escapeHtml(r.responsible)}</strong></div>
    <div class="info-tile"><small>Animais no local</small><strong>${escapeHtml(r.species)} × ${r.quantity}</strong></div>
    <div class="info-tile"><small>Quem informou</small><strong>${escapeHtml(r.reporter || 'Não informado')}</strong></div>`;

  // Animais cadastrados a partir deste resgate
  $('detailAnimals').innerHTML = r.animalIds.length
    ? r.animalIds.map(id => {
      const a = findAnimal(id);
      if (!a) return `<div class="rescued-animal removed"><div class="rescued-photo placeholder"><i class="bi bi-paw"></i></div><div><strong>Animal removido</strong><small>${animalCode(id)}</small></div></div>`;
      return `
        <a class="rescued-animal" href="animais.html?animal=${a.id}">
          ${PawUtils.animalPhoto(a, 'rescued-photo', 'rescued-photo placeholder')}
          <div><strong>${escapeHtml(a.name)}</strong><small>${animalCode(a.id)} · ${escapeHtml(a.species)}</small></div>
          <span class="status-badge ${PawData.statusClass(a.status)}">${a.status}</span>
        </a>`;
    }).join('')
    : `<p class="text-secondary small m-0">${r.stage === 'Sem sucesso' ? 'Nenhum animal foi acolhido nesta ocorrência.' : 'Nenhum animal cadastrado ainda. Use “Cadastrar animal resgatado” quando o animal chegar à organização.'}</p>`;
  $('registerAnimal').classList.toggle('d-none', r.stage === 'Sem sucesso');

  $('stageActions').innerHTML = (ACTIONS[r.stage] ?? []).map((action, index) => `
    <button type="button" class="btn ${action.style}" data-stage-action="${index}"><i class="bi ${action.icon} me-1"></i>${action.label}</button>`).join('');
  $('stageNote').placeholder = isOpen(r) ? 'Obrigatória para “sem sucesso” e para adicionar observação' : 'Obrigatória para reabrir';

  // Só exclui ocorrência sem animal ligado (o vínculo faz parte do histórico do animal)
  $('deleteRescue').classList.toggle('d-none', r.animalIds.length > 0);

  $('detailLog').innerHTML = r.log.map(entry => `
    <div class="timeline-item">
      <span class="status-badge ${PawData.rescueClass(entry.stage)}">${entry.stage}</span>
      <small class="float-end">${formatDate(entry.date)}</small>
      <p>${escapeHtml(entry.text)}</p>
    </div>`).join('');
}

function runAction(index) {
  const r = findRescue(openRescueId);
  const action = ACTIONS[r.stage][index];
  const note = $('stageNote').value.trim();

  if (action.needsNote && !note) {
    $('stageNote').classList.add('is-invalid');
    $('stageNote').focus();
    notify('Escreva a observação antes de continuar.');
    return;
  }
  if (action.to === 'Concluído' && !r.animalIds.length
    && !window.confirm('Nenhum animal foi cadastrado a partir deste resgate.\nConcluir mesmo assim? (ex.: animal encaminhado direto ao veterinário ou a outra ONG)')) return;

  if (action.to) {
    r.stage = action.to;
    r.closedAt = isOpen(r) ? '' : today();
  }
  r.log.unshift({ date: today(), stage: r.stage, text: note || DEFAULT_LOG[action.to] });

  if (!save()) return;
  $('stageNote').value = '';
  render();
  renderDetail();
  notify(action.to ? `Resgate movido para “${action.to}”.` : 'Observação adicionada.');
}

// Troca de modal só depois que o anterior fecha (evita fundo escuro preso na tela).
function afterDetailCloses(callback) {
  $('detailModal').addEventListener('hidden.bs.modal', callback, { once: true });
  detailModal.hide();
}

$('editRescue').addEventListener('click', () => afterDetailCloses(() => openForm(findRescue(openRescueId))));

$('deleteRescue').addEventListener('click', () => {
  const r = findRescue(openRescueId);
  if (!r || r.animalIds.length || !window.confirm(`Excluir a ocorrência ${rescueCode(r.id)}? Esta ação não pode ser desfeita.`)) return;
  rescues = rescues.filter(item => item.id !== r.id);
  save();
  detailModal.hide();
  render();
  notify('Ocorrência excluída.');
});

// O cadastro do animal usa o formulário do módulo de Animais, já preenchido com os dados do resgate.
$('registerAnimal').addEventListener('click', () => {
  window.location.href = `animais.html?resgate=${openRescueId}`;
});

$('stageNote').addEventListener('input', () => $('stageNote').classList.remove('is-invalid'));

// ================= Eventos =================
document.addEventListener('click', (event) => {
  const rescueButton = event.target.closest('[data-rescue]');
  if (rescueButton) openDetail(Number(rescueButton.dataset.rescue));
  const actionButton = event.target.closest('[data-stage-action]');
  if (actionButton) runAction(Number(actionButton.dataset.stageAction));
});

$('periodPreset').addEventListener('change', (e) => { applyPreset(e.target.value); render(); });
['periodFrom', 'periodTo'].forEach(id => $(id).addEventListener('change', () => {
  $('periodPreset').value = 'custom';
  render();
}));
$('search').addEventListener('input', render);
$('stageFilter').addEventListener('change', render);
$('priorityFilter').addEventListener('change', render);
$('clearFilters').addEventListener('click', clearFilters);
$('addRescue').addEventListener('click', () => openForm());
$('printReport').addEventListener('click', () => window.print());

// Opções dos filtros e do formulário vêm de dados.js
$('stageFilter').innerHTML += PawData.RESCUE_STAGES.map(s => `<option>${s}</option>`).join('');
$('priorityFilter').innerHTML += PawData.PRIORITIES.map(p => `<option>${p}</option>`).join('');
$('rsPriority').innerHTML = PawData.PRIORITIES.map(p => `<option>${p}</option>`).join('');

applyPreset($('periodPreset').value);
render();

// Link direto (dashboard ou volta do cadastro de animal): resgates.html?resgate=4
const linkedId = Number(new URLSearchParams(window.location.search).get('resgate'));
if (findRescue(linkedId)) openDetail(linkedId);
