/* PAWSAFE — módulo de Animais
   Os dados vêm do servidor (API /api/animais, PHP + MySQL). Depois de cada
   carregamento ou alteração, a lista também é guardada em js/dados.js
   (PawData), porque Dashboard, Adoções, Resgates, Estoque e Relatório ainda
   leem os animais de lá.

   Permissões (app/Core/Permissoes.php):
     animais.cadastrar  cadastrar, editar e excluir animais (administrador, equipe)
     animais.registros  vacinas, histórico e pesagens: registrar, corrigir, remover
                        (administrador, equipe, veterinário)
   Esconder botões é só conforto: o servidor recusa (403) o que o perfil não pode.

   Depende de: Bootstrap 5, js/dados.js, js/utils.js, js/api.js, js/auth.js,
   js/sidebar.js e js/veterinarios.js. */

const $ = (id) => document.getElementById(id);

// ================= Perfil =================
const podePerfil = (permissao) => typeof PawAuth === 'undefined' || PawAuth.pode(permissao);
const PODE_CADASTRAR = podePerfil('animais.cadastrar');
const PODE_REGISTRAR = podePerfil('animais.registros');
// Veterinário registra pela própria conta: não escolhe o responsável (o servidor também garante).
const USUARIO = typeof PawAuth !== 'undefined' ? PawAuth.usuario() : null;
const EH_VETERINARIO = USUARIO?.perfil === 'veterinario';

// ================= Estado =================
let animals = PawData.loadAnimals(); // cópia local até a resposta do servidor
let selectedId = null;               // animal aberto na ficha
let record = null;                   // { type: 'vaccine' | 'history' | 'weight', item: registro em edição ou null }
let viewMode = 'grid';               // 'grid' | 'list'
let selectedPhoto = null;            // null = manter a foto atual | '' = remover | dataURL = nova foto
let rescues = PawData.loadRescues();
let fromRescueId = null;             // resgate de origem quando o cadastro vem do módulo de Resgates

const animalModal = new bootstrap.Modal($('animalModal'));
const detailModal = new bootstrap.Modal($('detailModal'));
const recordModal = new bootstrap.Modal($('recordModal'));
const toast = new bootstrap.Toast($('toast'), { delay: 2800 });

// ================= Utilitários =================
const { today, formatDate, escapeHtml, plural, compressImage } = PawUtils;
const animalCode = (id) => PawUtils.code('PAW', id);
const photoHtml = PawUtils.animalPhoto;
const findAnimal = (id) => animals.find(a => a.id === id);
const statusClass = PawData.statusClass;

function notify(message) {
  $('toastText').textContent = message;
  toast.show();
}

// Mensagem de erro da API (validação, permissão ou servidor desligado).
function erroDaApi(erro) {
  if (erro.status === undefined) return 'Sem conexão com o servidor. Verifique se o Apache e o MySQL do XAMPP estão ligados.';
  if (erro.campos) return `${erro.message} ${Object.values(erro.campos).join(' ')}`;
  return erro.message || 'Não foi possível concluir.';
}

// Desabilita o botão enquanto a requisição está em andamento.
async function comBotao(botao, acao) {
  if (botao) botao.disabled = true;
  try {
    return await acao();
  } catch (erro) {
    if (erro.status === 401) { window.location.replace('Pg_Login.html'); return null; } // sessão expirou
    notify(erroDaApi(erro));
    return null;
  } finally {
    if (botao) botao.disabled = false;
  }
}

// Coloca o animal que voltou do servidor no lugar certo da lista e atualiza a cópia local.
function guardar(animal) {
  const pronto = PawData.normalizeServerAnimal(animal);
  const i = animals.findIndex(a => a.id === pronto.id);
  if (i === -1) animals.unshift(pronto); else animals[i] = pronto;
  PawData.saveAnimals(animals);
  return pronto;
}

async function carregar() {
  try {
    const lista = await Api.get('/animais');
    animals = lista.map(PawData.normalizeServerAnimal);
    PawData.saveAnimals(animals);
    $('offlineNote')?.classList.add('d-none');
  } catch (erro) {
    if (erro.status === 401) return;
    // Servidor fora do ar: mostra a última cópia, só para consulta.
    $('offlineNote')?.classList.remove('d-none');
  }
  render();
}

// ================= Listagem =================
function getFilteredAnimals() {
  const term = $('search').value.trim().toLocaleLowerCase('pt-BR');
  const status = $('statusFilter').value;
  const species = $('speciesFilter').value;

  return animals.filter(a => {
    const text = [a.name, a.breed, a.color, a.species, animalCode(a.id)].join(' ').toLocaleLowerCase('pt-BR');
    return (!term || text.includes(term))
      && (status === 'Todos' || a.status === status)
      && (species === 'Todas' || a.species === species);
  });
}

function healthTags(a) {
  return [
    a.vaccinated
      ? '<span class="health-tag"><i class="bi bi-check2 me-1"></i>Vacinado</span>'
      : '<span class="health-tag blue">Vacinas pendentes</span>',
    a.neutered ? '<span class="health-tag blue">Castrado</span>' : '',
    a.chip ? '<span class="health-tag purple">Microchip</span>' : ''
  ].join('');
}

function cardHtml(a) {
  return `
    <article class="animal-card">
      <div class="animal-image-wrap" data-detail="${a.id}" role="button" tabindex="0" aria-label="Abrir ficha de ${escapeHtml(a.name)}">
        ${photoHtml(a, 'animal-image', 'image-fallback')}
        <span class="status-badge card-status ${statusClass(a.status)}">${escapeHtml(a.status)}</span>
      </div>
      <div class="card-content">
        <div class="card-title-row">
          <div>
            <h3>${escapeHtml(a.name)}</h3>
            <p class="animal-meta">${escapeHtml(a.breed || 'Raça não informada')} · ${escapeHtml(a.age || 'Idade não informada')} · ${escapeHtml(a.sex || '—')}</p>
          </div>
        </div>
        <div class="health-tags">${healthTags(a)}</div>
        <div class="card-bottom">
          <span class="card-id">${animalCode(a.id)}</span>
          <button type="button" class="card-details" data-detail="${a.id}">Ver ficha <i class="bi bi-arrow-up-right"></i></button>
        </div>
      </div>
    </article>`;
}

function rowHtml(a) {
  return `
    <article class="animal-list-row">
      ${photoHtml(a, 'list-photo', 'list-placeholder')}
      <div><strong>${escapeHtml(a.name)}</strong><small>${escapeHtml(a.breed || 'Raça não informada')} · ${escapeHtml(a.age || 'Idade não informada')}</small></div>
      <div class="list-species"><small>Espécie</small><strong>${escapeHtml(a.species)}</strong></div>
      <div class="list-status"><span class="status-badge ${statusClass(a.status)}">${escapeHtml(a.status)}</span></div>
      <button type="button" class="btn btn-outline-green" data-detail="${a.id}">Abrir ficha</button>
    </article>`;
}

function render() {
  const list = getFilteredAnimals();
  const hasResults = list.length > 0;
  const available = animals.filter(a => a.status === 'Disponível').length;

  $('animalGrid').innerHTML = viewMode === 'grid' ? list.map(cardHtml).join('') : '';
  $('animalList').innerHTML = viewMode === 'list' ? list.map(rowHtml).join('') : '';
  $('animalGrid').classList.toggle('d-none', viewMode !== 'grid' || !hasResults);
  $('animalList').classList.toggle('d-none', viewMode !== 'list' || !hasResults);
  $('empty').classList.toggle('d-none', hasResults);

  $('resultsText').textContent = `Exibindo ${list.length} de ${plural(animals.length, 'animal', 'animais')}`;
  $('countText').textContent = `${plural(animals.length, 'animal cadastrado', 'animais cadastrados')}`;
  $('availableText').textContent = `${plural(available, 'disponível', 'disponíveis')} para adoção`;
  const navCount = document.querySelector('[data-count="animais"]');
  if (navCount) navCount.textContent = animals.length;
}

function clearFilters() {
  $('search').value = '';
  $('statusFilter').value = 'Todos';
  $('speciesFilter').value = 'Todas';
  render();
}

function setViewMode(mode) {
  viewMode = mode;
  $('gridMode').classList.toggle('active', mode === 'grid');
  $('listMode').classList.toggle('active', mode === 'list');
  render();
}

// ================= Cadastro / edição =================
const TEXT_FIELDS = ['name', 'species', 'breed', 'color', 'age', 'arrival', 'sex', 'size', 'status', 'weight', 'notes'];
const CHECK_FIELDS = ['vaccinated', 'neutered', 'chip'];

function setPhotoPreview(src) {
  $('photoPreviewWrap').classList.toggle('d-none', !src);
  if (src) $('photoPreview').src = src;
  else $('photoPreview').removeAttribute('src');
}

function openForm(animal = null, rescue = null) {
  // O formulário também abre por link (animais.html?resgate=4): confere o perfil aqui.
  if (!PODE_CADASTRAR) {
    notify('Seu perfil não cadastra nem edita animais. Peça à equipe.');
    return;
  }
  $('animalForm').reset();
  $('animalId').value = animal ? animal.id : '';
  fromRescueId = rescue ? rescue.id : null;
  if (animal) {
    TEXT_FIELDS.forEach(f => { $(f).value = animal[f] ?? ''; });
    CHECK_FIELDS.forEach(f => { $(f).checked = Boolean(animal[f]); });
  } else if (rescue) {
    // Já preenchido com os dados da ocorrência
    $('status').value = 'Resgatado';
    $('arrival').value = rescue.date;
    if (PawData.SPECIES.includes(rescue.species)) $('species').value = rescue.species;
    $('notes').value = `Resgatado em ${rescue.district}: ${rescue.description}`;
  } else {
    $('arrival').value = today();
  }
  $('arrival').max = today();
  selectedPhoto = null;
  setPhotoPreview(animal?.photo || null);

  const label = animal ? 'Salvar alterações' : 'Cadastrar animal';
  $('formTitle').textContent = animal ? 'Editar animal'
    : rescue ? `Cadastrar animal do resgate ${PawUtils.code('RES', rescue.id)}` : 'Cadastrar animal';
  $('saveAnimalButton').innerHTML = `<i class="bi bi-check2 me-2"></i>${label}`;
  animalModal.show();
}

$('photoFile').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    selectedPhoto = await compressImage(file);
    setPhotoPreview(selectedPhoto);
  } catch (error) {
    selectedPhoto = null;
    event.target.value = '';
    setPhotoPreview(null);
    notify(error.message);
  }
});

$('removePhoto').addEventListener('click', () => {
  selectedPhoto = '';
  $('photoFile').value = '';
  setPhotoPreview(null);
});

$('animalForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!PODE_CADASTRAR) return;
  const existing = findAnimal(Number($('animalId').value));

  const data = {
    name: $('name').value.trim(),
    species: $('species').value,
    breed: $('breed').value.trim(),
    color: $('color').value.trim(),
    age: $('age').value.trim(),
    arrival: $('arrival').value,
    sex: $('sex').value,
    size: $('size').value,
    status: $('status').value,
    weight: $('weight').value ? Number($('weight').value) : null,
    vaccinated: $('vaccinated').checked,
    neutered: $('neutered').checked,
    chip: $('chip').checked,
    notes: $('notes').value.trim()
  };
  if (selectedPhoto !== null) data.photo = selectedPhoto;

  const rescue = !existing ? rescues.find(r => r.id === fromRescueId) : null;
  if (rescue) {
    // O servidor registra a origem no histórico do animal.
    data.rescue = {
      code: PawUtils.code('RES', rescue.id), date: rescue.date, district: rescue.district,
      responsible: rescue.responsible, description: rescue.description
    };
  }

  const salvo = await comBotao($('saveAnimalButton'), () => (existing
    ? Api.put(`/animais/${existing.id}`, data)
    : Api.post('/animais', data)));
  if (!salvo) return;
  const animal = guardar(salvo);

  if (rescue) {
    // O resgate ainda fica no navegador até o módulo de Resgates ir para o servidor.
    rescue.animalIds.push(animal.id);
    rescue.log.unshift({ date: today(), stage: rescue.stage, text: `Animal ${animal.name} (${animalCode(animal.id)}) cadastrado.` });
    PawData.saveRescues(rescues);
    window.location.href = `resgates.html?resgate=${rescue.id}`; // volta para a ficha do resgate
    return;
  }
  animalModal.hide();
  render();
  notify(existing ? 'Cadastro atualizado.' : 'Animal cadastrado com sucesso.');
});

// Troca de modal só depois que o anterior fecha (evita fundo escuro preso na tela).
function afterDetailCloses(callback) {
  $('detailModal').addEventListener('hidden.bs.modal', callback, { once: true });
  detailModal.hide();
}

async function deleteAnimal(id, botao) {
  const animal = findAnimal(id);
  if (!PODE_CADASTRAR || !animal) return;
  if (!window.confirm(`Excluir ${animal.name} (${animalCode(id)})?\nEle sai da lista, mas a ficha clínica fica guardada.`)) return;
  const ok = await comBotao(botao, () => Api.del(`/animais/${id}`));
  if (!ok) return;
  animals = animals.filter(a => a.id !== id);
  PawData.saveAnimals(animals);
  detailModal.hide();
  render();
  notify('Animal excluído.');
}

// ================= Ficha do animal =================
// Uma tela só: ações no topo e, logo abaixo, vacinas, pesagens e histórico —
// sem abas, para o veterinário ver tudo assim que abre a ficha.
const infoTile = (label, value) => `<div class="info-tile"><small>${label}</small><strong>${value}</strong></div>`;
const recentesPrimeiro = (lista) => [...lista].sort((x, y) => (y.date || '').localeCompare(x.date || '') || (y.id || 0) - (x.id || 0));

function openDetail(id) {
  const a = findAnimal(id);
  if (!a) return;
  selectedId = id;

  $('detailName').textContent = a.name;
  $('detailMeta').textContent = `${animalCode(a.id)} · ${a.species} · ${a.breed || 'Raça não informada'} · ${a.age || 'Idade não informada'} · ${a.sex || '—'}`;
  $('detailStatus').textContent = a.status;
  $('detailStatus').className = `status-badge ${statusClass(a.status)}`;
  // Sem foto: usa só o degradê.
  $('detailHero').style.backgroundImage = a.photo
    ? `linear-gradient(180deg, #1d3a3040, #142a21d9), url("${a.photo}")`
    : 'linear-gradient(135deg, #397665, #19372e)';

  renderActions(a);
  renderSummary(a);
  renderVaccines(a);
  renderWeights(a);
  renderHistory(a);
  if (!$('detailModal').classList.contains('show')) detailModal.show();
}

function renderActions(a) {
  const botoes = [];
  if (PODE_REGISTRAR) {
    botoes.push(
      '<button type="button" class="btn btn-green" data-add-record="vaccine"><i class="bi bi-eyedropper me-1"></i>Registrar vacina</button>',
      '<button type="button" class="btn btn-green" data-add-record="history"><i class="bi bi-journal-plus me-1"></i>Adicionar histórico</button>',
      '<button type="button" class="btn btn-green" data-add-record="weight"><i class="bi bi-speedometer2 me-1"></i>Registrar peso</button>'
    );
  }
  if (PODE_CADASTRAR) {
    botoes.push(
      `<button type="button" class="btn btn-outline-green" data-edit="${a.id}"><i class="bi bi-pencil me-1"></i>Editar ficha</button>`,
      `<button type="button" class="btn btn-outline-danger" data-delete="${a.id}"><i class="bi bi-trash me-1"></i>Excluir</button>`
    );
  }
  $('detailActions').innerHTML = botoes.join('');
  $('detailActions').classList.toggle('d-none', botoes.length === 0);
}

function renderSummary(a) {
  const origin = rescues.find(r => r.animalIds.includes(a.id));
  $('panel-summary').innerHTML = `
    ${origin ? `<div class="alert-soft mb-2"><i class="bi bi-house-heart me-2"></i>Chegou pelo resgate
      <a class="fw-bold" href="resgates.html?resgate=${origin.id}">${PawUtils.code('RES', origin.id)}</a>
      em ${formatDate(origin.date)} (${escapeHtml(origin.district)}).</div>` : ''}
    <div class="profile-grid">
      ${infoTile('Peso atual', a.weight ? `${a.weight} kg` : 'Não informado')}
      ${infoTile('Vacinação', a.vaccinated ? 'Registrada' : 'Verificar vacinas')}
      ${infoTile('Castrado', a.neutered ? 'Sim' : 'Não')}
      ${infoTile('Sexo / porte', `${escapeHtml(a.sex || '—')} · ${escapeHtml(a.size || '—')}`)}
      ${infoTile('Data de chegada', formatDate(a.arrival))}
      ${infoTile('Microchip', a.chip ? 'Registrado' : 'Não registrado')}
    </div>
    ${a.notes ? `<div class="info-tile mt-2"><small>Observações de saúde</small><p class="m-0">${escapeHtml(a.notes)}</p></div>` : ''}`;
}

// Quem registrou / corrigiu (auditoria vinda do servidor).
function auditoria(r) {
  const partes = [];
  if (r.registeredBy) partes.push(`Registrado por ${escapeHtml(r.registeredBy)}`);
  if (r.updatedBy) partes.push(`corrigido por ${escapeHtml(r.updatedBy)} em ${formatDate(String(r.updatedAt).slice(0, 10))}`);
  return partes.length ? `<p class="record-audit">${partes.join(' · ')}</p>` : '';
}

// Botões de corrigir e remover de cada registro (só para quem registra).
function botoesDoRegistro(tipo, r) {
  if (!PODE_REGISTRAR || !r.id) return '';
  return `<div class="record-tools">
    <button type="button" class="btn-icon" data-fix-record="${tipo}" data-record-id="${r.id}" aria-label="Corrigir registro" title="Corrigir"><i class="bi bi-pencil"></i></button>
    <button type="button" class="btn-icon danger" data-remove-record="${tipo}" data-record-id="${r.id}" aria-label="Remover registro" title="Remover"><i class="bi bi-trash"></i></button>
  </div>`;
}

const secao = (id, icone, titulo, contagem) =>
  `<div class="panel-toolbar clinical-heading" id="${id}"><h3><i class="bi bi-${icone} me-2"></i>${titulo} <span class="text-secondary fw-normal">(${contagem})</span></h3></div>`;

function renderVaccines(a) {
  const lista = recentesPrimeiro(a.vaccines);
  const overdue = lista.filter(v => v.next && v.next < today()).length;
  const items = lista.map(v => {
    const late = v.next && v.next < today();
    return `
      <div class="record-item">
        <div>
          <strong>${escapeHtml(v.name)}</strong>
          <p><i class="bi bi-calendar3 me-1"></i>${formatDate(v.date)} · ${escapeHtml(v.vet || 'Veterinário não informado')}${v.lot ? ` · Lote ${escapeHtml(v.lot)}` : ''}</p>
          ${auditoria(v)}
        </div>
        <div class="record-side">
          ${v.next ? `<small>Próxima dose</small><span class="status-badge ${late ? 'status-tratamento' : 'status-disponivel'}">${formatDate(v.next)}</span>` : ''}
          ${botoesDoRegistro('vaccine', v)}
        </div>
      </div>`;
  }).join('');

  $('panel-vaccines').innerHTML = `
    ${secao('secVacinas', 'eyedropper', 'Vacinas', lista.length)}
    ${overdue ? `<div class="alert-soft warning mb-2"><i class="bi bi-exclamation-circle me-2"></i>${overdue} vacina(s) com próxima dose vencida.</div>` : ''}
    <div class="record-list">${items || '<p class="text-secondary small m-0">Nenhuma vacina registrada.</p>'}</div>`;
}

function renderWeights(a) {
  const list = recentesPrimeiro(a.weights);
  const current = list[0]?.weight ?? a.weight;
  const initial = list.at(-1)?.weight ?? current;
  const delta = current != null && initial != null ? current - initial : null;
  const kg = (v) => (v != null ? `${v} kg` : '—');

  $('panel-weight').innerHTML = `
    ${secao('secPeso', 'speedometer2', 'Peso', list.length)}
    <div class="weight-summary">
      <div class="weight-card"><small>Atual</small><strong>${kg(current)}</strong><span>${list[0] ? formatDate(list[0].date) : 'Sem registro'}</span></div>
      <div class="weight-card"><small>Inicial</small><strong>${kg(initial)}</strong><span>1º registro</span></div>
      <div class="weight-card"><small>Variação</small><strong>${delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)} kg`}</strong><span>no período</span></div>
    </div>
    <div class="record-list">
      ${list.map(w => `
        <div class="record-item">
          <div><strong>${w.weight} kg</strong><p>${formatDate(w.date)} · ${escapeHtml(w.note || 'Pesagem registrada')}</p>${auditoria(w)}</div>
          <div class="record-side">${botoesDoRegistro('weight', w)}</div>
        </div>`).join('') || '<p class="small text-secondary m-0">Nenhuma pesagem registrada.</p>'}
    </div>`;
}

// Registros que o próprio sistema cria (cadastro do animal) não são corrigidos à mão.
const ehAutomatico = (h) => h.type === 'Cadastro';

function renderHistory(a) {
  const items = recentesPrimeiro(a.history).map(h => `
      <div class="timeline-item">
        <div class="d-flex justify-content-between gap-2">
          <div>
            <span class="health-tag blue">${escapeHtml(h.type)}</span>
            <small class="ms-2 text-secondary">${formatDate(h.date)}</small>
            <p class="mb-1"><strong>${escapeHtml(h.description)}</strong></p>
            <small>${escapeHtml(h.vet || 'Responsável não informado')}${h.notes ? ` · ${escapeHtml(h.notes)}` : ''}</small>
            ${auditoria(h)}
          </div>
          ${ehAutomatico(h) ? '' : botoesDoRegistro('history', h)}
        </div>
      </div>`).join('');

  $('panel-history').innerHTML = `
    ${secao('secHistorico', 'journal-text', 'Histórico médico e de cuidados', a.history.length)}
    ${items ? `<div class="timeline">${items}</div>` : '<p class="text-secondary small m-0">Histórico vazio. Registre consultas, tratamentos, exames e outros eventos.</p>'}`;
}

// ================= Registros (vacina, histórico, peso) =================
const API_TIPO = { vaccine: 'vacinas', history: 'historico', weight: 'pesagens' };
const COLECAO = { vaccine: 'vaccines', history: 'history', weight: 'weights' };
const TIPOS_DE_EVENTO = ['Consulta', 'Cirurgia', 'Castração', 'Tratamento', 'Exame', 'Banho e Tosa', 'Resgate', 'Adoção', 'Outro'];

const dateField = (valor) => `<div class="mb-3"><label class="form-label" for="rDate">Data *</label><input id="rDate" type="date" class="form-control" required max="${today()}" value="${escapeHtml(valor || today())}"></div>`;

// Campo de veterinário: um <select> dos cadastrados (API) que preenche o nome,
// com o campo de texto como alternativa (quem não está cadastrado).
// Perfil veterinário: no lugar da escolha, mostra que o responsável é a própria conta.
const vetField = (label, item) => (EH_VETERINARIO ? `
  <div class="mb-3">
    <span class="form-label d-block">Responsável</span>
    <div class="responsavel-fixo">
      <i class="bi bi-person-check"></i>
      <div><strong>${escapeHtml(item ? (item.vet || 'Não informado') : USUARIO.nome)}</strong>
      <small>${item ? 'O responsável original do registro é mantido na correção.' : 'Registrado automaticamente pela sua conta.'}</small></div>
    </div>
  </div>` : `
  <div class="mb-3">
    <label class="form-label" for="rVetSelect">${label}</label>
    <select id="rVetSelect" class="form-select mb-2"><option value="">— selecionar veterinário cadastrado —</option></select>
    <input id="rVet" class="form-control" maxlength="120" placeholder="ou digite o nome do responsável" value="${escapeHtml(item?.vet || '')}">
  </div>`);

// Nome e cadastro do veterinário escolhidos (o veterinário logado não envia: o servidor usa a conta dele).
const vetPayload = () => (EH_VETERINARIO ? {} : { vet: $('rVet').value.trim(), vetId: Number($('rVetSelect')?.value) || null });

// Preenche o <select> de veterinário (administrador e equipe).
function populateVetField(item) {
  if (EH_VETERINARIO) return;
  const sel = $('rVetSelect');
  if (!sel || typeof PawVets === 'undefined') return;
  const fill = () => {
    const atual = sel.value || (item?.vetId ? String(item.vetId) : '');
    sel.innerHTML = '<option value="">— selecionar veterinário cadastrado —</option>' + PawVets.options(atual);
    sel.onchange = () => {
      const v = PawVets.find(sel.value);
      if (v) $('rVet').value = v.name;
    };
  };
  fill();
  PawVets.carregar().then(fill); // busca no servidor e repopula
}

const RECORDS = {
  vaccine: {
    title: (item) => (item ? 'Corrigir vacina' : 'Registrar vacina'),
    fields: (item) => `
      <div class="mb-3"><label class="form-label" for="rName">Vacina *</label><input id="rName" class="form-control" required maxlength="80" placeholder="Ex.: V10, Antirrábica" value="${escapeHtml(item?.name || '')}"></div>
      ${dateField(item?.date)}
      <div class="mb-3"><label class="form-label" for="rNext">Próxima dose</label><input id="rNext" type="date" class="form-control" value="${escapeHtml(item?.next || '')}"></div>
      <div class="mb-3"><label class="form-label" for="rLot">Lote</label><input id="rLot" class="form-control" maxlength="60" placeholder="Ex.: V10-2026-001" value="${escapeHtml(item?.lot || '')}"></div>
      ${vetField('Veterinário', item)}`,
    payload: () => ({
      name: $('rName').value.trim(), date: $('rDate').value, next: $('rNext').value, lot: $('rLot').value.trim(),
      ...vetPayload()
    }),
    message: (item) => (item ? 'Vacina corrigida.' : 'Vacina registrada.')
  },
  history: {
    title: (item) => (item ? 'Corrigir evento' : 'Novo evento médico'),
    fields: (item) => `
      <div class="mb-3"><label class="form-label" for="rType">Tipo de evento *</label><select id="rType" class="form-select" required>
        ${TIPOS_DE_EVENTO.map(t => `<option${item?.type === t ? ' selected' : ''}>${t}</option>`).join('')}
      </select><small class="text-secondary d-none" id="rTypeHint">Ao salvar, o animal fica marcado como castrado na ficha.</small></div>
      <div class="mb-3"><label class="form-label" for="rDesc">Descrição *</label><input id="rDesc" class="form-control" required maxlength="255" placeholder="Ex.: Avaliação geral, retorno..." value="${escapeHtml(item?.description || '')}"></div>
      ${dateField(item?.date)}
      ${vetField('Veterinário / responsável', item)}
      <div><label class="form-label" for="rNotes">Notas clínicas</label><textarea id="rNotes" class="form-control" rows="3" maxlength="2000">${escapeHtml(item?.notes || '')}</textarea></div>`,
    payload: () => ({
      type: $('rType').value, date: $('rDate').value, description: $('rDesc').value.trim(),
      ...vetPayload(), notes: $('rNotes').value.trim()
    }),
    message: (item) => (item ? 'Evento corrigido.' : 'Evento adicionado ao histórico.')
  },
  weight: {
    title: (item) => (item ? 'Corrigir pesagem' : 'Registrar pesagem'),
    fields: (item) => `
      <div class="mb-3"><label class="form-label" for="rWeight">Peso (kg) *</label><input id="rWeight" type="number" min="0.01" max="200" step="0.01" class="form-control" required placeholder="Ex.: 12.5" value="${item?.weight ?? ''}"></div>
      ${dateField(item?.date)}
      <div><label class="form-label" for="rNotes">Observação</label><input id="rNotes" class="form-control" maxlength="120" placeholder="Ex.: retorno, rotina..." value="${escapeHtml(item?.note || '')}"></div>`,
    payload: () => ({ weight: Number($('rWeight').value), date: $('rDate').value, note: $('rNotes').value.trim() }),
    message: (item) => (item ? 'Pesagem corrigida.' : 'Pesagem registrada.')
  }
};

function openRecord(type, item = null) {
  if (!PODE_REGISTRAR) return;
  record = { type, item };
  const def = RECORDS[type];
  $('recordTitle').textContent = def.title(item);
  $('recordHint').textContent = item
    ? 'A correção fica registrada com o seu nome e a data.'
    : 'Este registro será adicionado à ficha do animal.';
  $('recordFields').innerHTML = def.fields(item);
  if (type === 'vaccine' || type === 'history') populateVetField(item);
  if (type === 'history') {
    const dica = () => $('rTypeHint').classList.toggle('d-none', $('rType').value !== 'Castração');
    $('rType').addEventListener('change', dica);
    dica();
  }
  afterDetailCloses(() => recordModal.show());
}

$('recordForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const animal = findAnimal(selectedId);
  if (!animal || !record) return;
  const { type, item } = record;
  const rota = `/animais/${animal.id}/${API_TIPO[type]}${item ? `/${item.id}` : ''}`;
  const corpo = RECORDS[type].payload();
  const salvo = await comBotao($('saveRecordButton'), () => (item ? Api.put(rota, corpo) : Api.post(rota, corpo)));
  if (!salvo) return;
  guardar(salvo);
  render();
  notify(RECORDS[type].message(item));
  recordModal.hide(); // ao fechar, a ficha reabre (listener abaixo)
});

async function removeRecord(type, id, botao) {
  const animal = findAnimal(selectedId);
  const item = animal?.[COLECAO[type]].find(r => r.id === id);
  if (!item) return;
  const nome = type === 'vaccine' ? `a vacina ${item.name}` : type === 'weight' ? `a pesagem de ${item.weight} kg` : `o evento "${item.description}"`;
  if (!window.confirm(`Remover ${nome} (${formatDate(item.date)}) da ficha?\nO registro fica guardado no sistema com o seu nome.`)) return;
  const salvo = await comBotao(botao, () => Api.del(`/animais/${animal.id}/${API_TIPO[type]}/${id}`));
  if (!salvo) return;
  openDetail(guardar(salvo).id);
  render();
  notify('Registro removido da ficha.');
}

// Ao fechar o registro (salvando ou cancelando), volta para a ficha do animal.
$('recordModal').addEventListener('hidden.bs.modal', () => openDetail(selectedId));

// ================= Eventos =================
document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-detail], [data-edit], [data-delete], [data-add-record], [data-fix-record], [data-remove-record]');
  if (!target) return;
  const d = target.dataset;

  if (d.detail) openDetail(Number(d.detail));
  else if (d.edit) afterDetailCloses(() => openForm(findAnimal(Number(d.edit))));
  else if (d.delete) deleteAnimal(Number(d.delete), target);
  else if (d.addRecord) openRecord(d.addRecord);
  else if (d.fixRecord) openRecord(d.fixRecord, findAnimal(selectedId)?.[COLECAO[d.fixRecord]].find(r => r.id === Number(d.recordId)));
  else if (d.removeRecord) removeRecord(d.removeRecord, Number(d.recordId), target);
});

document.addEventListener('keydown', (event) => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-detail][role="button"]')) {
    event.preventDefault();
    openDetail(Number(event.target.dataset.detail));
  }
});

$('search').addEventListener('input', render);
$('statusFilter').addEventListener('change', render);
$('speciesFilter').addEventListener('change', render);
$('clearFilters').addEventListener('click', clearFilters);
$('emptyClear').addEventListener('click', clearFilters);
$('gridMode').addEventListener('click', () => setViewMode('grid'));
$('listMode').addEventListener('click', () => setViewMode('list'));
$('addAnimal').addEventListener('click', () => openForm());

render();

// Links vindos de outras páginas (tratados depois de carregar do servidor):
//   animais.html?animal=3   → abre a ficha do animal
//   animais.html?resgate=4  → abre o cadastro já preenchido com o resgate (só quem cadastra)
const params = new URLSearchParams(window.location.search);
if (params.toString()) history.replaceState(null, '', window.location.pathname); // recarregar não reabre

carregar().then(() => {
  const linkedAnimal = findAnimal(Number(params.get('animal')));
  const linkedRescue = rescues.find(r => r.id === Number(params.get('resgate')));
  if (linkedAnimal) openDetail(linkedAnimal.id);
  else if (linkedRescue && linkedRescue.stage !== 'Sem sucesso') openForm(null, linkedRescue);
});
