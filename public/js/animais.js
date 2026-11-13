/* PAWSAFE — módulo de Animais
   Depende de: Bootstrap 5 (modais e toast), js/dados.js (PawData), js/utils.js (PawUtils) e js/sidebar.js. */

const $ = (id) => document.getElementById(id);

// ================= Estado =================
let animals = PawData.loadAnimals();
let selectedId = null;     // animal aberto na ficha
let recordType = null;     // 'vaccine' | 'history' | 'weight'
let viewMode = 'grid';     // 'grid' | 'list'
let selectedPhoto = null;  // null = manter a foto atual | '' = remover | dataURL = nova foto
let rescues = PawData.loadRescues();
let fromRescueId = null;   // resgate de origem quando o cadastro vem do módulo de Resgates

const animalModal = new bootstrap.Modal($('animalModal'));
const detailModal = new bootstrap.Modal($('detailModal'));
const recordModal = new bootstrap.Modal($('recordModal'));
const toast = new bootstrap.Toast($('toast'), { delay: 2500 });

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

function save() {
  if (PawData.saveAnimals(animals)) return true;
  notify('Não foi possível salvar. A imagem pode ser muito grande; escolha uma menor.');
  return false;
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
            <p class="animal-meta">${escapeHtml(a.breed)} · ${escapeHtml(a.age || 'Idade não informada')} · ${escapeHtml(a.sex)}</p>
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
      <div><strong>${escapeHtml(a.name)}</strong><small>${escapeHtml(a.breed)} · ${escapeHtml(a.age || 'Idade não informada')}</small></div>
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

$('animalForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const existing = findAnimal(Number($('animalId').value));
  const weight = $('weight').value ? Number($('weight').value) : null;
  const backup = JSON.stringify(animals);

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
    weight,
    vaccinated: $('vaccinated').checked,
    neutered: $('neutered').checked,
    chip: $('chip').checked,
    notes: $('notes').value.trim()
  };
  if (selectedPhoto !== null) data.photo = selectedPhoto;

  if (existing) {
    if (weight && weight !== existing.weight) {
      existing.weights.unshift({ weight, date: today(), note: 'Peso atualizado na ficha' });
    }
    Object.assign(existing, data);
  } else {
    const animal = {
      id: PawUtils.nextId(animals),
      photo: '',
      ...data,
      vaccines: [],
      history: [{ type: 'Cadastro', date: today(), description: 'Animal cadastrado no sistema', vet: 'Equipe PAWSAFE', notes: '' }],
      weights: weight ? [{ weight, date: data.arrival, note: 'Peso inicial' }] : []
    };
    animals.unshift(animal);

    const rescue = rescues.find(r => r.id === fromRescueId);
    if (rescue) {
      // Liga o animal ao resgate nos dois sentidos: histórico do animal e acompanhamento do resgate
      animal.history.push({
        type: 'Resgate', date: rescue.date, description: `Resgate ${PawUtils.code('RES', rescue.id)} — ${rescue.district}`,
        vet: rescue.responsible, notes: rescue.description
      });
      rescue.animalIds.push(animal.id);
      rescue.log.unshift({ date: today(), stage: rescue.stage, text: `Animal ${animal.name} (${animalCode(animal.id)}) cadastrado.` });
    }
  }

  if (!save()) {
    animals = JSON.parse(backup); // desfaz a alteração que não pôde ser salva
    return;
  }
  if (!existing && fromRescueId) {
    PawData.saveRescues(rescues);
    // Volta para a ficha do resgate, que já mostra o animal cadastrado
    window.location.href = `resgates.html?resgate=${fromRescueId}`;
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

function deleteAnimal(id) {
  const animal = findAnimal(id);
  if (!animal || !window.confirm(`Excluir ${animal.name} (${animalCode(id)})? Esta ação não pode ser desfeita.`)) return;
  animals = animals.filter(a => a.id !== id);
  save();
  detailModal.hide();
  render();
  notify('Animal excluído.');
}

// ================= Ficha do animal =================
function openDetail(id, tab = 'profile') {
  const a = findAnimal(id);
  if (!a) return;
  selectedId = id;

  $('detailName').textContent = a.name;
  $('detailMeta').textContent = `${animalCode(a.id)} · ${a.species} · ${a.breed} · ${a.age || 'Idade não informada'} · ${a.sex}`;
  $('detailStatus').textContent = a.status;
  $('detailStatus').className = `status-badge ${statusClass(a.status)}`;
  // Sem foto: usa só o degradê (antes aparecia a foto de outro cão/gato).
  $('detailHero').style.backgroundImage = a.photo
    ? `linear-gradient(180deg, #1d3a3040, #142a21d9), url("${a.photo}")`
    : 'linear-gradient(135deg, #397665, #19372e)';
  $('vaccineCount').textContent = `(${a.vaccines.length})`;
  $('historyCount').textContent = `(${a.history.length})`;

  renderProfile(a);
  renderVaccines(a);
  renderHistory(a);
  renderWeights(a);
  setTab(tab);
  detailModal.show();
}

function setTab(tab) {
  document.querySelectorAll('.tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  ['profile', 'vaccines', 'history', 'weight'].forEach(key => $(`panel-${key}`).classList.toggle('d-none', key !== tab));
}

const infoTile = (label, value) => `<div class="info-tile"><small>${label}</small><strong>${value}</strong></div>`;

function renderProfile(a) {
  const origin = rescues.find(r => r.animalIds.includes(a.id));
  $('panel-profile').innerHTML = `
    ${origin ? `<div class="alert-soft"><i class="bi bi-house-heart me-2"></i>Chegou pelo resgate
      <a class="fw-bold" href="resgates.html?resgate=${origin.id}">${PawUtils.code('RES', origin.id)}</a>
      em ${formatDate(origin.date)} (${escapeHtml(origin.district)}).</div>` : ''}
    <div class="profile-grid">
      ${infoTile('Espécie / raça', `${escapeHtml(a.species)} · ${escapeHtml(a.breed)}`)}
      ${infoTile('Sexo / porte', `${escapeHtml(a.sex)} · ${escapeHtml(a.size)}`)}
      ${infoTile('Data de chegada', formatDate(a.arrival))}
      ${infoTile('Peso atual', a.weight ? `${a.weight} kg` : 'Não informado')}
      ${infoTile('Vacinação', a.vaccinated ? 'Registrada' : 'Verificar vacinas')}
      ${infoTile('Microchip', a.chip ? 'Registrado' : 'Não registrado')}
    </div>
    <div class="panel-toolbar mt-4"><h3>Observações de saúde</h3></div>
    <div class="info-tile"><p class="m-0">${escapeHtml(a.notes || 'Nenhuma observação registrada.')}</p></div>
    <div class="panel-toolbar mt-4"><h3>Ações</h3></div>
    <div class="d-flex flex-wrap gap-2">
      <button type="button" class="btn btn-green" data-edit="${a.id}"><i class="bi bi-pencil me-1"></i>Editar ficha</button>
      <button type="button" class="btn btn-outline-green" data-add-record="vaccine"><i class="bi bi-eyedropper me-1"></i>Registrar vacina</button>
      <button type="button" class="btn btn-outline-green" data-add-record="history"><i class="bi bi-journal-plus me-1"></i>Adicionar histórico</button>
      <button type="button" class="btn btn-outline-green" data-add-record="weight"><i class="bi bi-speedometer2 me-1"></i>Registrar peso</button>
      <button type="button" class="btn btn-outline-danger ms-auto" data-delete="${a.id}"><i class="bi bi-trash me-1"></i>Excluir</button>
    </div>`;
}

function renderVaccines(a) {
  const overdue = a.vaccines.filter(v => v.next && v.next < today()).length;
  const items = a.vaccines.map(v => {
    const late = v.next && v.next < today();
    return `
      <div class="record-item">
        <div>
          <strong>${escapeHtml(v.name)}</strong>
          <p><i class="bi bi-calendar3 me-1"></i>${formatDate(v.date)} · ${escapeHtml(v.vet || 'Veterinário não informado')}</p>
          <p>Lote: ${escapeHtml(v.lot || '—')}</p>
        </div>
        <div class="text-end"><small>Próxima dose</small><p><span class="status-badge ${late ? 'status-tratamento' : 'status-disponivel'}">${formatDate(v.next)}</span></p></div>
      </div>`;
  }).join('');

  $('panel-vaccines').innerHTML = `
    <div class="alert-soft ${overdue ? 'warning' : ''}">
      <i class="bi bi-${overdue ? 'exclamation-circle' : 'shield-check'} me-2"></i>
      ${overdue ? `${overdue} vacina(s) com próxima dose vencida.` : 'Acompanhe as doses aplicadas e as próximas datas recomendadas.'}
    </div>
    <div class="panel-toolbar"><h3>Vacinas registradas</h3><button type="button" class="btn btn-green" data-add-record="vaccine"><i class="bi bi-plus-lg me-1"></i>Nova vacina</button></div>
    <div class="record-list">${items || '<p class="text-secondary small">Nenhuma vacina registrada.</p>'}</div>`;
}

function renderHistory(a) {
  const items = [...a.history]
    .sort((x, y) => y.date.localeCompare(x.date))
    .map(h => `
      <div class="timeline-item">
        <span class="health-tag blue">${escapeHtml(h.type)}</span>
        <small class="float-end">${formatDate(h.date)}</small>
        <p><strong>${escapeHtml(h.description)}</strong></p>
        <small>${escapeHtml(h.vet || 'Responsável não informado')}${h.notes ? ` · ${escapeHtml(h.notes)}` : ''}</small>
      </div>`).join('');

  $('panel-history').innerHTML = `
    <div class="panel-toolbar"><h3>Histórico médico e de cuidados</h3><button type="button" class="btn btn-green" data-add-record="history"><i class="bi bi-plus-lg me-1"></i>Novo evento</button></div>
    ${items ? `<div class="timeline">${items}</div>` : '<p class="text-secondary small">Histórico vazio. Registre consultas, tratamentos, exames e outros eventos.</p>'}`;
}

function renderWeights(a) {
  const list = [...a.weights].sort((x, y) => y.date.localeCompare(x.date));
  const current = list[0]?.weight ?? a.weight;
  const initial = list.at(-1)?.weight ?? current;
  const delta = current != null && initial != null ? current - initial : null;
  const kg = (v) => (v != null ? `${v} kg` : '—');

  $('panel-weight').innerHTML = `
    <div class="weight-summary">
      <div class="weight-card"><small>Peso atual</small><strong>${kg(current)}</strong><span>${list[0] ? formatDate(list[0].date) : 'Sem registro'}</span></div>
      <div class="weight-card"><small>Peso inicial</small><strong>${kg(initial)}</strong><span>Primeiro registro</span></div>
      <div class="weight-card"><small>Variação</small><strong>${delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)} kg`}</strong><span>Desde o primeiro registro</span></div>
    </div>
    <div class="panel-toolbar"><h3>Registros de pesagem</h3><button type="button" class="btn btn-green" data-add-record="weight"><i class="bi bi-plus-lg me-1"></i>Nova pesagem</button></div>
    <div class="record-list">
      ${list.map(w => `<div class="record-item"><div><strong>${w.weight} kg</strong><p>${escapeHtml(w.note || 'Pesagem registrada')}</p></div><small>${formatDate(w.date)}</small></div>`).join('')
        || '<p class="small text-secondary">Nenhuma pesagem registrada.</p>'}
    </div>`;
}

// ================= Registros (vacina, histórico, peso) =================
const dateField = () => `<div class="mb-3"><label class="form-label" for="rDate">Data *</label><input id="rDate" type="date" class="form-control" required max="${today()}" value="${today()}"></div>`;

const RECORDS = {
  vaccine: {
    title: 'Registrar vacina',
    tab: 'vaccines',
    fields: () => `
      <div class="mb-3"><label class="form-label" for="rName">Vacina *</label><input id="rName" class="form-control" required placeholder="Ex.: V10, Antirrábica"></div>
      ${dateField()}
      <div class="mb-3"><label class="form-label" for="rNext">Próxima dose</label><input id="rNext" type="date" class="form-control"></div>
      <div class="mb-3"><label class="form-label" for="rLot">Lote</label><input id="rLot" class="form-control" placeholder="Ex.: V10-2026-001"></div>
      <div><label class="form-label" for="rVet">Veterinário</label><input id="rVet" class="form-control"></div>`,
    apply: (a) => {
      a.vaccines.unshift({ name: $('rName').value.trim(), date: $('rDate').value, next: $('rNext').value, lot: $('rLot').value.trim(), vet: $('rVet').value.trim() });
      a.vaccinated = true;
      return 'Vacina registrada.';
    }
  },
  history: {
    title: 'Novo evento médico',
    tab: 'history',
    fields: () => `
      <div class="mb-3"><label class="form-label" for="rType">Tipo de evento *</label><select id="rType" class="form-select" required>
        ${['Consulta', 'Cirurgia', 'Tratamento', 'Exame', 'Banho e Tosa', 'Resgate', 'Adoção', 'Outro'].map(t => `<option>${t}</option>`).join('')}
      </select></div>
      <div class="mb-3"><label class="form-label" for="rDesc">Descrição *</label><input id="rDesc" class="form-control" required placeholder="Ex.: Avaliação geral, retorno..."></div>
      ${dateField()}
      <div class="mb-3"><label class="form-label" for="rVet">Veterinário / responsável</label><input id="rVet" class="form-control"></div>
      <div><label class="form-label" for="rNotes">Notas clínicas</label><textarea id="rNotes" class="form-control" rows="3"></textarea></div>`,
    apply: (a) => {
      a.history.unshift({ type: $('rType').value, date: $('rDate').value, description: $('rDesc').value.trim(), vet: $('rVet').value.trim(), notes: $('rNotes').value.trim() });
      return 'Evento adicionado ao histórico.';
    }
  },
  weight: {
    title: 'Registrar pesagem',
    tab: 'weight',
    fields: () => `
      <div class="mb-3"><label class="form-label" for="rWeight">Peso (kg) *</label><input id="rWeight" type="number" min="0.01" step="0.01" class="form-control" required placeholder="Ex.: 12.5"></div>
      ${dateField()}
      <div><label class="form-label" for="rNotes">Observação</label><input id="rNotes" class="form-control" placeholder="Ex.: retorno, rotina..."></div>`,
    apply: (a) => {
      const weight = Number($('rWeight').value);
      a.weights.unshift({ weight, date: $('rDate').value, note: $('rNotes').value.trim() || 'Pesagem registrada' });
      a.weight = weight;
      return 'Pesagem registrada.';
    }
  }
};

function openRecord(type) {
  recordType = type;
  $('recordTitle').textContent = RECORDS[type].title;
  $('recordFields').innerHTML = RECORDS[type].fields();
  afterDetailCloses(() => recordModal.show());
}

$('recordForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const animal = findAnimal(selectedId);
  if (!animal) return;
  const message = RECORDS[recordType].apply(animal);
  if (!save()) return;
  render();
  notify(message);
  recordModal.hide(); // ao fechar, a ficha reabre na aba do registro (listener abaixo)
});

// Ao fechar o registro (salvando ou cancelando), volta para a ficha do animal.
$('recordModal').addEventListener('hidden.bs.modal', () => openDetail(selectedId, RECORDS[recordType].tab));

// ================= Eventos =================
document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-detail], [data-edit], [data-delete], [data-add-record], [data-tab]');
  if (!target) return;
  const { detail, edit, delete: remove, addRecord, tab } = target.dataset;

  if (detail) openDetail(Number(detail));
  else if (edit) afterDetailCloses(() => openForm(findAnimal(Number(edit))));
  else if (remove) deleteAnimal(Number(remove));
  else if (addRecord) openRecord(addRecord);
  else if (tab) setTab(tab);
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

// Links vindos de outras páginas:
//   animais.html?animal=3   → abre a ficha do animal
//   animais.html?resgate=4  → abre o cadastro já preenchido com o resgate
const params = new URLSearchParams(window.location.search);
const linkedAnimal = findAnimal(Number(params.get('animal')));
const linkedRescue = rescues.find(r => r.id === Number(params.get('resgate')));
if (linkedAnimal) openDetail(linkedAnimal.id);
else if (linkedRescue && linkedRescue.stage !== 'Sem sucesso') openForm(null, linkedRescue);
if (params.toString()) history.replaceState(null, '', window.location.pathname); // recarregar não reabre
