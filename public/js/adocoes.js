/* PAWSAFE — módulo de Adoções
   Cadastro de adotantes (CPF, telefone, e-mail, endereço, residência, família e documentos)
   e acompanhamento do processo: Novo → Em análise → Aprovada → Concluída (ou Recusada/Cancelada).

   Adotantes e documentos ficam no SERVIDOR (API /api/adotantes): qualquer pessoa da
   equipe, em qualquer computador, abre os documentos depois de salvos. Os processos
   de adoção ainda ficam no navegador (PawData) e apontam para o id do adotante.

   Depende de: Bootstrap 5, js/dados.js (PawData), js/utils.js (PawUtils), js/api.js e js/sidebar.js. */

const $ = (id) => document.getElementById(id);
const { today, formatDate, escapeHtml, plural, compressImage } = PawUtils;
const adoptionCode = (id) => PawUtils.code('ADO', id);
const animalCode = (id) => PawUtils.code('PAW', id);

// ================= Estado =================
let animals = PawData.loadAnimals();
let adopters = PawData.loadAdopters();
let adoptions = PawData.loadAdoptions();

let currentView = 'processes';  // 'processes' | 'adopters'
let stageFilter = 'Todas';
let openProcessId = null;       // processo aberto na ficha
// Documentos do adotante aberto no formulário:
//   docsSalvos   já estão no servidor ({ id, name, type, url, uploadedBy, uploadedAt })
//   docsNovos    escolhidos agora, enviados ao salvar ({ name, type, size, data })
//   docsRemover  ids dos salvos que serão removidos ao salvar
let docsSalvos = [];
let docsNovos = [];
let docsRemover = [];

const MAX_DOCS = 5;                    // por adotante (o servidor confere o mesmo limite)
const MAX_DOC_BYTES = 5 * 1024 * 1024; // 5 MB por arquivo
const ADOPTABLE_STATUS = ['Disponível', 'Em Lar Temporário'];

const adopterModal = new bootstrap.Modal($('adopterModal'));
const adoptionModal = new bootstrap.Modal($('adoptionModal'));
const processModal = new bootstrap.Modal($('processModal'));
const toast = new bootstrap.Toast($('toast'), { delay: 2800 });

const findAnimal = (id) => animals.find(a => a.id === id);
const findAdopter = (id) => adopters.find(p => p.id === id);
const findAdoption = (id) => adoptions.find(o => o.id === id);
const isActive = (adoption) => PawData.ACTIVE_STAGES.includes(adoption.stage);
const normalize = (text) => String(text ?? '').toLocaleLowerCase('pt-BR');

function notify(message) {
  $('toastText').textContent = message;
  toast.show();
}

// A ficha do animal já está no servidor: a adoção concluída muda o status lá e
// entra no histórico clínico. (As adoções ainda ficam no navegador.)
async function registrarAdocaoNoServidor(animal, adopter, processo) {
  if (typeof Api === 'undefined') return;
  try {
    await Api.patch(`/animais/${animal.id}/status`, { status: 'Adotado' });
    await Api.post(`/animais/${animal.id}/historico`, {
      type: 'Adoção', date: today(), description: `Adotado por ${adopter.name}`.slice(0, 255),
      vet: 'Equipe PAWSAFE', notes: `Processo ${adoptionCode(processo.id)}`
    });
  } catch (erro) {
    notify(`A adoção foi concluída, mas a ficha do animal não foi atualizada no servidor: ${erro.message}`);
  }
}

// ================= Servidor (adotantes e documentos) =================
const erroDaApi = (erro) => (erro.status === undefined
  ? 'Sem conexão com o servidor. Verifique se o Apache e o MySQL do XAMPP estão ligados.'
  : erro.campos ? `${erro.message} ${Object.values(erro.campos).join(' ')}` : erro.message);

async function carregarAdotantes() {
  let lista;
  try {
    lista = (await Api.get('/adotantes')).map(PawData.normalizeServerAdopter);
  } catch (erro) {
    if (erro.status !== 401) notify(`Adotantes: ${erroDaApi(erro)} Mostrando a última cópia deste computador.`);
    return;
  }
  lista = await migrarAdotantesLocais(lista);
  adopters = lista;
  PawData.saveAdopters(adopters);
  render();
}

// Antes, adotantes e documentos ficavam só no navegador. Na primeira vez que esta
// tela abre com o servidor ligado, o que existir só aqui é enviado para lá, e os
// processos passam a apontar para o id do servidor (nada se perde).
async function migrarAdotantesLocais(servidor) {
  const digitos = (cpf) => String(cpf || '').replace(/\D/g, '');
  const novosIds = new Map();
  let mudou = false;
  for (const local of PawData.loadAdopters()) {
    let remoto = servidor.find(s => digitos(s.cpf) === digitos(local.cpf));
    try {
      if (!remoto) {
        const { id, documents, createdAt, ...dados } = local;
        remoto = PawData.normalizeServerAdopter(await Api.post('/adotantes', { ...dados, consent: true }));
        servidor.push(remoto);
        mudou = true;
      }
      const antigos = (local.documents || []).filter(d => d.data && !d.id);
      if (antigos.length && !remoto.documents.length) {
        for (const doc of antigos.slice(0, MAX_DOCS)) {
          Object.assign(remoto, PawData.normalizeServerAdopter(await Api.post(`/adotantes/${remoto.id}/documentos`, { name: doc.name, file: doc.data })));
        }
        mudou = true;
      }
    } catch (erro) {
      notify(`Não foi possível enviar ao servidor o adotante ${local.name}: ${erroDaApi(erro)}`);
      continue;
    }
    if (remoto.id !== local.id) novosIds.set(local.id, remoto.id);
  }
  if (novosIds.size) {
    adoptions.forEach(o => { if (novosIds.has(o.adopterId)) o.adopterId = novosIds.get(o.adopterId); });
    PawData.saveAdoptions(adoptions);
  }
  if (mudou) notify('Adotantes e documentos que estavam só neste computador foram enviados ao servidor.');
  return servidor;
}

function saveAll() {
  const ok = PawData.saveAnimals(animals) && PawData.saveAdopters(adopters) && PawData.saveAdoptions(adoptions);
  if (!ok) notify('Não foi possível salvar. Os documentos podem estar grandes demais.');
  return ok;
}

// ================= CPF, telefone e idade =================
function isValidCpf(value) {
  const d = value.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false; // 111.111.111-11 etc. não vale
  for (const length of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(d[i]) * (length + 1 - i);
    if ((sum * 10) % 11 % 10 !== Number(d[length])) return false;
  }
  return true;
}

const maskCpf = (value) => value.replace(/\D/g, '').slice(0, 11)
  .replace(/(\d{3})(\d)/, '$1.$2')
  .replace(/(\d{3})(\d)/, '$1.$2')
  .replace(/(\d{3})(\d{1,2})$/, '$1-$2');

const { maskPhone } = PawUtils;

// LGPD: nas listas mostra só o miolo do CPF.
const hideCpf = (cpf) => `***.${cpf.slice(4, 7)}.${cpf.slice(8, 11)}-**`;

function ageOf(birth) {
  const b = new Date(`${birth}T12:00:00`), now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
  return age;
}

// ================= Resumo e filtros =================
function renderHeader() {
  const active = adoptions.filter(isActive).length;
  $('activeText').textContent = `${plural(active, 'processo em andamento', 'processos em andamento')}`;
  $('adopterText').textContent = `${plural(adopters.length, 'adotante cadastrado', 'adotantes cadastrados')}`;

  const chips = [['Todas', adoptions.length], ...PawData.ADOPTION_STAGES.map(s => [s, adoptions.filter(o => o.stage === s).length])];
  $('stageSummary').innerHTML = chips.map(([stage, count]) => `
    <button type="button" class="stage-chip${stage === stageFilter ? ' active' : ''}" data-stage="${stage}" aria-pressed="${stage === stageFilter}">
      ${stage === 'Todas' ? '' : `<i class="${PawData.stageClass(stage)}"></i>`}${stage} <strong>${count}</strong>
    </button>`).join('');
}

function setView(view) {
  currentView = view;
  document.querySelectorAll('[data-view]').forEach(tab => tab.classList.toggle('active', tab.dataset.view === view));
  $('processesView').classList.toggle('d-none', view !== 'processes');
  $('adoptersView').classList.toggle('d-none', view !== 'adopters');
  $('stageSummary').classList.toggle('d-none', view !== 'processes');
}

// ================= Lista de processos =================
function processHtml(o) {
  const animal = findAnimal(o.animalId);
  const adopter = findAdopter(o.adopterId);
  const done = PawData.CHECKLIST.filter(item => o.checklist[item.key]).length;
  const percent = Math.round((done / PawData.CHECKLIST.length) * 100);

  return `
    <article class="process-card">
      <div class="process-animal">
        ${PawUtils.animalPhoto(animal, 'process-photo', 'process-photo placeholder')}
        <div><strong>${escapeHtml(animal?.name ?? 'Animal removido')}</strong><small>${animalCode(o.animalId)} · ${adoptionCode(o.id)}</small></div>
      </div>
      <div class="process-field"><small>Adotante</small><strong>${escapeHtml(adopter?.name ?? 'Adotante removido')}</strong></div>
      <div class="process-field"><small>${isActive(o) ? 'Aberto em' : 'Encerrado em'}</small><strong>${formatDate(isActive(o) ? o.openedAt : o.closedAt)}</strong></div>
      <div class="process-field">
        <small>Verificação ${done}/${PawData.CHECKLIST.length}</small>
        <div class="mini-progress" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"><span style="width:${percent}%"></span></div>
      </div>
      <span class="status-badge ${PawData.stageClass(o.stage)}">${o.stage}</span>
      <button type="button" class="btn btn-outline-green" data-process="${o.id}">Abrir</button>
    </article>`;
}

function renderProcesses() {
  const term = normalize($('processSearch').value.trim());
  const list = adoptions
    .filter(o => stageFilter === 'Todas' || o.stage === stageFilter)
    .filter(o => {
      if (!term) return true;
      const text = [findAnimal(o.animalId)?.name, findAdopter(o.adopterId)?.name, adoptionCode(o.id), animalCode(o.animalId)].join(' ');
      return normalize(text).includes(term);
    })
    // Em andamento primeiro; depois do mais recente para o mais antigo.
    .sort((a, b) => (isActive(b) - isActive(a)) || b.openedAt.localeCompare(a.openedAt));

  $('processList').innerHTML = list.map(processHtml).join('');
  $('processEmpty').classList.toggle('d-none', list.length > 0);
}

// ================= Lista de adotantes =================
function renderAdopters() {
  const term = normalize($('adopterSearch').value.trim());
  const list = adopters
    .filter(p => !term || normalize([p.name, p.email, p.phone, p.district].join(' ')).includes(term))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  $('adopterRows').innerHTML = list.map(p => {
    const mine = adoptions.filter(o => o.adopterId === p.id);
    const active = mine.filter(isActive).length;
    return `
      <tr>
        <td><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.email)}</small></td>
        <td>${hideCpf(p.cpf)}</td>
        <td>${escapeHtml(p.phone)}</td>
        <td>${escapeHtml(p.district)}</td>
        <td>${mine.length}${active ? ` <span class="status-badge stage-analise">${active} em andamento</span>` : ''}</td>
        <td class="text-end text-nowrap">
          <button type="button" class="btn btn-outline-green btn-sm" data-adopter="${p.id}">Ficha</button>
          <button type="button" class="btn btn-green btn-sm" data-new-process="${p.id}">Novo processo</button>
        </td>
      </tr>`;
  }).join('');

  $('adoptersView').querySelector('.table-card').classList.toggle('d-none', list.length === 0);
  $('adopterEmpty').classList.toggle('d-none', list.length > 0);
}

function render() {
  renderHeader();
  renderProcesses();
  renderAdopters();
}

// ================= Cadastro de adotante =================
// Campo do formulário → propriedade salva.
const ADOPTER_FIELDS = {
  adName: 'name', adBirth: 'birth', adCpf: 'cpf', adPhone: 'phone', adEmail: 'email',
  adStreet: 'street', adNumber: 'number', adDistrict: 'district', adCity: 'city',
  adHousing: 'housingType', adOwnership: 'ownership', adResidents: 'residents', adHoursAlone: 'hoursAlone',
  adOtherPets: 'otherPets', adExperience: 'experience', adMotivation: 'motivation'
};
const ADOPTER_CHECKS = { adYard: 'hasYard', adScreens: 'hasScreens', adChildren: 'hasChildren', adConsent: 'consent' };

function openAdopterForm(adopter = null) {
  const form = $('adopterForm');
  form.reset();
  form.querySelectorAll('input, select, textarea').forEach(el => el.setCustomValidity(''));
  $('adopterId').value = adopter?.id ?? '';

  if (adopter) {
    Object.entries(ADOPTER_FIELDS).forEach(([field, key]) => { $(field).value = adopter[key] ?? ''; });
    Object.entries(ADOPTER_CHECKS).forEach(([field, key]) => { $(field).checked = Boolean(adopter[key]); });
  } else {
    $('adCity').value = 'Guarapuava - PR';
  }

  docsSalvos = [...(adopter?.documents ?? [])].filter(d => d.id);
  docsNovos = [];
  docsRemover = [];
  renderDocs();

  $('adopterTitle').textContent = adopter ? 'Ficha do adotante' : 'Cadastrar adotante';
  $('saveAdopterButton').innerHTML = `<i class="bi bi-check2 me-2"></i>${adopter ? 'Salvar alterações' : 'Cadastrar adotante'}`;
  $('deleteAdopter').classList.toggle('d-none', !adopter);
  adopterModal.show();
}

const ehPdf = (doc) => doc.type === 'application/pdf';
const docsVisiveis = () => docsSalvos.filter(d => !docsRemover.includes(d.id));
const tamanho = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

function miniatura(doc, src) {
  return ehPdf(doc)
    ? '<div class="doc-thumb doc-thumb-pdf"><i class="bi bi-file-earmark-pdf"></i><span>PDF</span></div>'
    : `<img class="doc-thumb" src="${escapeHtml(src)}" alt="" loading="lazy">`;
}

function renderDocs() {
  const salvos = docsVisiveis().map(doc => `
    <figure class="doc-item">
      <a href="${escapeHtml(doc.url)}" target="_blank" rel="noopener" title="Abrir ${escapeHtml(doc.name)}">${miniatura(doc, doc.url)}</a>
      <figcaption>
        <strong title="${escapeHtml(doc.name)}">${escapeHtml(doc.name)}</strong>
        <small>${doc.uploadedBy ? `Enviado por ${escapeHtml(doc.uploadedBy)}` : 'Enviado'} em ${formatDate(String(doc.uploadedAt).slice(0, 10))}</small>
      </figcaption>
      <div class="doc-actions">
        <a class="btn btn-outline-green btn-sm" href="${escapeHtml(doc.url)}" target="_blank" rel="noopener"><i class="bi bi-box-arrow-up-right me-1"></i>Abrir</a>
        <button type="button" class="btn btn-outline-danger btn-sm" data-doc-remove="${doc.id}" aria-label="Remover ${escapeHtml(doc.name)}"><i class="bi bi-trash"></i></button>
      </div>
    </figure>`);
  const novos = docsNovos.map((doc, index) => `
    <figure class="doc-item is-pending">
      ${miniatura(doc, doc.data)}
      <figcaption>
        <strong title="${escapeHtml(doc.name)}">${escapeHtml(doc.name)}</strong>
        <small><i class="bi bi-cloud-upload me-1"></i>Será enviado ao salvar · ${tamanho(doc.size)}</small>
      </figcaption>
      <div class="doc-actions">
        <button type="button" class="btn btn-outline-danger btn-sm" data-doc-cancel="${index}" aria-label="Tirar ${escapeHtml(doc.name)}"><i class="bi bi-x-lg"></i></button>
      </div>
    </figure>`);
  $('docPreview').innerHTML = [...salvos, ...novos].join('');
  const total = docsVisiveis().length + docsNovos.length;
  $('adDocs').disabled = total >= MAX_DOCS;
  $('docCount').textContent = `${total} de ${MAX_DOCS}`;
  $('docRemovedNote').classList.toggle('d-none', docsRemover.length === 0);
  $('docRemovedNote').textContent = `${plural(docsRemover.length, 'documento será removido', 'documentos serão removidos')} ao salvar.`;
}

const lerArquivo = (file) => new Promise((resolve, reject) => {
  const leitor = new FileReader();
  leitor.onload = () => resolve(leitor.result);
  leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
  leitor.readAsDataURL(file);
});

$('adDocs').addEventListener('change', async (event) => {
  const vagas = MAX_DOCS - docsVisiveis().length - docsNovos.length;
  const files = [...event.target.files].slice(0, vagas);
  for (const file of files) {
    try {
      if (file.type === 'application/pdf') {
        if (file.size > MAX_DOC_BYTES) throw new Error('o PDF passou de 5 MB.');
        docsNovos.push({ name: file.name, type: file.type, size: file.size, data: await lerArquivo(file) });
      } else {
        // Foto do documento: reduzida para ficar legível e leve.
        const data = await compressImage(file, 1600, 0.82);
        docsNovos.push({ name: file.name, type: 'image/jpeg', size: Math.round(data.length * 0.75), data });
      }
    } catch (error) {
      notify(`${file.name}: ${error.message}`);
    }
  }
  if (event.target.files.length > files.length) notify(`Limite de ${MAX_DOCS} documentos por adotante.`);
  event.target.value = '';
  renderDocs();
});

// Máscaras enquanto digita
$('adCpf').addEventListener('input', (e) => { e.target.value = maskCpf(e.target.value); e.target.setCustomValidity(''); });
$('adPhone').addEventListener('input', (e) => { e.target.value = maskPhone(e.target.value); });
$('adBirth').addEventListener('input', (e) => e.target.setCustomValidity(''));

$('adopterForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  const id = Number($('adopterId').value);
  const cpf = $('adCpf').value;

  // Regras que o HTML sozinho não verifica
  const cpfTaken = adopters.some(p => p.cpf === cpf && p.id !== id);
  $('adCpf').setCustomValidity(!isValidCpf(cpf) ? 'CPF inválido.' : cpfTaken ? 'Já existe um adotante com este CPF.' : '');
  $('adBirth').setCustomValidity($('adBirth').value && ageOf($('adBirth').value) < 18 ? 'O adotante precisa ter 18 anos ou mais.' : '');
  if (!form.reportValidity()) return;

  const data = {};
  Object.entries(ADOPTER_FIELDS).forEach(([field, key]) => { data[key] = $(field).value.trim(); });
  Object.entries(ADOPTER_CHECKS).forEach(([field, key]) => { data[key] = $(field).checked; });
  data.residents = Number(data.residents);
  data.hoursAlone = data.hoursAlone === '' ? null : Number(data.hoursAlone);

  const existing = findAdopter(id);
  const botao = $('saveAdopterButton');
  botao.disabled = true;
  let salvo;
  try {
    // 1) os dados do adotante
    salvo = await (existing ? Api.put(`/adotantes/${id}`, data) : Api.post('/adotantes', data));
  } catch (erro) {
    botao.disabled = false;
    notify(erroDaApi(erro));
    return;
  }
  // 2) os documentos: remove os marcados e envia os novos
  const falhas = [];
  for (const docId of docsRemover) {
    try { salvo = await Api.del(`/adotantes/${salvo.id}/documentos/${docId}`); } catch (erro) { falhas.push(`remover documento: ${erroDaApi(erro)}`); }
  }
  for (const doc of docsNovos) {
    try { salvo = await Api.post(`/adotantes/${salvo.id}/documentos`, { name: doc.name, file: doc.data }); } catch (erro) { falhas.push(`${doc.name}: ${erroDaApi(erro)}`); }
  }
  botao.disabled = false;

  const adotante = PawData.normalizeServerAdopter(salvo);
  const i = adopters.findIndex(p => p.id === adotante.id);
  if (i === -1) adopters.push(adotante); else adopters[i] = adotante;
  PawData.saveAdopters(adopters);
  render();

  if (falhas.length) {
    // Dados salvos, mas algum documento não foi: a ficha continua aberta para tentar de novo.
    $('adopterId').value = adotante.id;
    docsSalvos = adotante.documents;
    docsNovos = docsNovos.filter(d => falhas.some(f => f.startsWith(`${d.name}:`)));
    docsRemover = [];
    renderDocs();
    notify(`Cadastro salvo, mas houve problema com documento(s): ${falhas.join(' · ')}`);
    return;
  }
  adopterModal.hide();
  const enviados = docsNovos.length;
  notify((existing ? 'Cadastro do adotante atualizado.' : 'Adotante cadastrado.')
    + (enviados ? ` ${plural(enviados, 'documento enviado', 'documentos enviados')} — a equipe já pode abrir.` : ''));
});

$('deleteAdopter').addEventListener('click', async () => {
  const adopter = findAdopter(Number($('adopterId').value));
  if (!adopter) return;
  if (adoptions.some(o => o.adopterId === adopter.id)) {
    notify('Este adotante tem processos registrados e fica no histórico. Não é possível excluir.');
    return;
  }
  if (!window.confirm(`Excluir o cadastro de ${adopter.name}?`)) return;
  try {
    await Api.del(`/adotantes/${adopter.id}`);
  } catch (erro) {
    notify(erroDaApi(erro));
    return;
  }
  adopters = adopters.filter(p => p.id !== adopter.id);
  PawData.saveAdopters(adopters);
  adopterModal.hide();
  render();
  notify('Adotante excluído.');
});

// ================= Novo processo =================
function openAdoptionForm(adopterId = null) {
  const adoptable = animals.filter(a => ADOPTABLE_STATUS.includes(a.status));
  if (!adopters.length) { notify('Cadastre um adotante antes de abrir um processo.'); return; }
  if (!adoptable.length) { notify('Nenhum animal Disponível ou Em Lar Temporário no momento.'); return; }

  $('adoptionForm').reset();
  $('newAdopter').innerHTML = '<option value="">Selecione</option>' + [...adopters]
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    .map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  $('newAnimal').innerHTML = '<option value="">Selecione</option>' + adoptable
    .map(a => `<option value="${a.id}">${escapeHtml(a.name)} — ${a.species}, ${animalCode(a.id)} (${a.status})</option>`).join('');
  if (adopterId) $('newAdopter').value = adopterId;
  $('newDate').value = today();
  $('newDate').max = today();
  $('animalWarning').classList.add('d-none');
  adoptionModal.show();
}

// Avisa quando o animal já tem outro interessado
$('newAnimal').addEventListener('change', () => {
  const others = adoptions.filter(o => o.animalId === Number($('newAnimal').value) && isActive(o));
  $('animalWarning').classList.toggle('d-none', !others.length);
  $('animalWarning').textContent = others.length
    ? `Atenção: este animal já tem ${plural(others.length, 'processo', 'processos')} em andamento. Quando um for concluído, os outros serão cancelados.`
    : '';
});

$('adoptionForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const adopterId = Number($('newAdopter').value);
  const animalId = Number($('newAnimal').value);

  if (adoptions.some(o => o.adopterId === adopterId && o.animalId === animalId && isActive(o))) {
    notify('Já existe um processo em andamento para este adotante e este animal.');
    return;
  }

  const adoption = {
    id: PawUtils.nextId(adoptions),
    animalId, adopterId,
    stage: 'Novo',
    openedAt: $('newDate').value,
    closedAt: '',
    checklist: Object.fromEntries(PawData.CHECKLIST.map(item => [item.key, false])),
    log: [{ date: today(), stage: 'Novo', text: $('newNotes').value.trim() || 'Processo aberto.' }]
  };
  adoptions.push(adoption);
  if (!saveAll()) { adoptions.pop(); return; }

  adoptionModal.hide();
  render();
  notify(`Processo ${adoptionCode(adoption.id)} aberto.`);
});

// ================= Ficha do processo =================
// Ações possíveis em cada etapa. "requires" = itens da verificação que precisam estar marcados.
const ACTIONS = {
  'Novo': [
    { to: 'Em análise', label: 'Iniciar análise', icon: 'bi-search', style: 'btn-green' },
    { to: 'Recusada', label: 'Recusar', icon: 'bi-x-circle', style: 'btn-outline-danger', needsNote: true },
    { to: 'Cancelada', label: 'Cancelar', icon: 'bi-slash-circle', style: 'btn-outline-green', needsNote: true }
  ],
  'Em análise': [
    { to: 'Aprovada', label: 'Aprovar adoção', icon: 'bi-check2-circle', style: 'btn-green', requires: ['interview', 'visit', 'documents'] },
    { to: 'Recusada', label: 'Recusar', icon: 'bi-x-circle', style: 'btn-outline-danger', needsNote: true },
    { to: 'Cancelada', label: 'Cancelar', icon: 'bi-slash-circle', style: 'btn-outline-green', needsNote: true }
  ],
  'Aprovada': [
    { to: 'Concluída', label: 'Concluir adoção', icon: 'bi-house-heart', style: 'btn-green', requires: ['term'] },
    { to: 'Cancelada', label: 'Cancelar', icon: 'bi-slash-circle', style: 'btn-outline-green', needsNote: true }
  ]
};

const DEFAULT_LOG = {
  'Em análise': 'Análise iniciada.',
  'Aprovada': 'Adoção aprovada pela equipe.',
  'Concluída': 'Animal entregue ao adotante.'
};

const STEPS = ['Novo', 'Em análise', 'Aprovada', 'Concluída'];
const checklistLabel = (key) => PawData.CHECKLIST.find(item => item.key === key).label;

function openProcess(id) {
  openProcessId = id;
  $('stageNote').value = '';
  renderProcess();
  processModal.show();
}

function renderProcess() {
  const o = findAdoption(openProcessId);
  if (!o) return;
  const animal = findAnimal(o.animalId);
  const adopter = findAdopter(o.adopterId);
  const active = isActive(o);

  $('processCode').textContent = adoptionCode(o.id);
  $('processStage').textContent = o.stage;
  $('processStage').className = `status-badge ${PawData.stageClass(o.stage)}`;
  $('processOpened').textContent = `Aberto em ${formatDate(o.openedAt)}${o.closedAt ? ` · encerrado em ${formatDate(o.closedAt)}` : ''}`;

  // Animal e adotante lado a lado
  $('processSummary').innerHTML = `
    <div class="summary-card">
      ${PawUtils.animalPhoto(animal, 'summary-photo', 'summary-photo placeholder')}
      <div>
        <small>Animal</small>
        <strong>${escapeHtml(animal?.name ?? 'Animal removido')}</strong>
        <p>${animal ? `${escapeHtml(animal.species)} · ${escapeHtml(animal.breed)} · ${escapeHtml(animal.age || 'idade não informada')}` : ''}</p>
        ${animal ? `<span class="status-badge ${PawData.statusClass(animal.status)}">${animal.status}</span>` : ''}
      </div>
    </div>
    <div class="summary-card">
      <div class="summary-avatar"><i class="bi bi-person"></i></div>
      <div>
        <small>Adotante</small>
        <strong>${escapeHtml(adopter?.name ?? 'Adotante removido')}</strong>
        ${adopter ? `
          <p>${escapeHtml(adopter.phone)} · ${escapeHtml(adopter.email)}</p>
          <p>${escapeHtml(adopter.housingType)} (${escapeHtml(adopter.ownership)}) · ${plural(adopter.residents, 'morador', 'moradores')}${adopter.hasYard ? ' · quintal' : ''}${adopter.hasChildren ? ' · crianças' : ''}</p>
          <button type="button" class="link-button" data-adopter-from-process="${adopter.id}">Ver ficha completa <i class="bi bi-arrow-right"></i></button>` : ''}
      </div>
    </div>`;

  // Etapas
  const current = STEPS.indexOf(o.stage);
  $('processStepper').innerHTML = STEPS.map((step, i) => {
    const state = current === -1 ? '' : i < current || o.stage === 'Concluída' ? 'done' : i === current ? 'current' : '';
    return `<li class="step ${state}"><span>${i + 1}</span>${step}</li>`;
  }).join('');
  $('processStepper').classList.toggle('d-none', current === -1);

  const closedNote = !active && o.stage !== 'Concluída' ? o.log.find(entry => entry.stage === o.stage) : null;
  $('processClosed').className = `alert-soft ${closedNote ? 'warning' : 'd-none'}`;
  $('processClosed').textContent = closedNote ? `Processo ${o.stage.toLowerCase()} em ${formatDate(o.closedAt)}: ${closedNote.text}` : '';

  // Verificação (só pode mudar enquanto o processo está em andamento)
  $('processChecklist').innerHTML = PawData.CHECKLIST.map(item => `
    <label class="check-item${o.checklist[item.key] ? ' checked' : ''}">
      <input type="checkbox" data-check="${item.key}" ${o.checklist[item.key] ? 'checked' : ''} ${active ? '' : 'disabled'}>
      <span>${item.label}</span>
    </label>`).join('');

  // Ações da etapa atual
  $('processActionArea').classList.toggle('d-none', !active);
  const actions = ACTIONS[o.stage] ?? [];
  const animalTaken = animal && animal.status === 'Adotado';
  let hint = '';

  $('processActions').innerHTML = actions.map(action => {
    const missing = (action.requires ?? []).filter(key => !o.checklist[key]);
    const blocked = missing.length > 0 || (action.to === 'Concluída' && (!animal || animalTaken));
    if (missing.length && !hint) hint = `Para “${action.label.toLowerCase()}”, marque: ${missing.map(checklistLabel).join(', ')}.`;
    if (action.to === 'Concluída' && animalTaken) hint = 'Este animal já consta como Adotado em outro registro.';
    return `<button type="button" class="btn ${action.style}" data-action="${action.to}" ${blocked ? 'disabled' : ''}>
      <i class="bi ${action.icon} me-1"></i>${action.label}</button>`;
  }).join('');
  $('processHint').textContent = hint;

  // Histórico (mais recente primeiro)
  $('processLog').innerHTML = o.log.map(entry => `
    <div class="timeline-item">
      <span class="status-badge ${PawData.stageClass(entry.stage)}">${entry.stage}</span>
      <small class="float-end">${formatDate(entry.date)}</small>
      <p>${escapeHtml(entry.text)}</p>
    </div>`).join('');
}

function changeStage(to) {
  const o = findAdoption(openProcessId);
  const action = (ACTIONS[o.stage] ?? []).find(a => a.to === to);
  if (!action) return;

  const note = $('stageNote').value.trim();
  if (action.needsNote && !note) {
    $('stageNote').classList.add('is-invalid');
    $('stageNote').focus();
    notify(`Escreva o motivo antes de ${action.label.toLowerCase()}.`);
    return;
  }

  const animal = findAnimal(o.animalId);
  const adopter = findAdopter(o.adopterId);
  if (to === 'Concluída' && !window.confirm(`Concluir a adoção de ${animal.name} por ${adopter.name}?\nO animal passará para o status "Adotado".`)) return;

  const backup = JSON.stringify({ animals, adoptions });
  o.stage = to;
  if (!isActive(o)) o.closedAt = today();
  o.log.unshift({ date: today(), stage: to, text: note || DEFAULT_LOG[to] });

  if (to === 'Concluída') {
    // O animal sai da lista de adoção e ganha o registro no histórico dele.
    animal.status = 'Adotado';
    animal.history.unshift({
      type: 'Adoção', date: today(), description: `Adotado por ${adopter.name}`,
      vet: 'Equipe PAWSAFE', notes: `Processo ${adoptionCode(o.id)}`
    });
    // Outros interessados no mesmo animal são encerrados automaticamente.
    adoptions
      .filter(other => other.id !== o.id && other.animalId === o.animalId && isActive(other))
      .forEach(other => {
        other.stage = 'Cancelada';
        other.closedAt = today();
        other.log.unshift({ date: today(), stage: 'Cancelada', text: `Animal adotado no processo ${adoptionCode(o.id)}.` });
      });
  }

  if (!saveAll()) {
    ({ animals, adoptions } = JSON.parse(backup));
    return;
  }
  if (to === 'Concluída') registrarAdocaoNoServidor(animal, adopter, o);
  $('stageNote').value = '';
  render();
  renderProcess();
  notify(to === 'Concluída' ? `Adoção concluída! ${animal.name} agora está com ${adopter.name}.` : `Processo movido para "${to}".`);
}

// Marcar/desmarcar item da verificação também fica registrado no histórico.
$('processChecklist').addEventListener('change', (event) => {
  const key = event.target.dataset.check;
  const o = findAdoption(openProcessId);
  if (!key || !o) return;
  o.checklist[key] = event.target.checked;
  o.log.unshift({ date: today(), stage: o.stage, text: `${event.target.checked ? 'Concluído' : 'Desmarcado'}: ${checklistLabel(key)}.` });
  saveAll();
  render();
  renderProcess();
});

$('stageNote').addEventListener('input', () => $('stageNote').classList.remove('is-invalid'));

// ================= Eventos =================
document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-stage], [data-view], [data-process], [data-adopter], [data-new-process], [data-doc-remove], [data-doc-cancel], [data-action], [data-adopter-from-process]');
  if (!target) return;
  const d = target.dataset;

  if (d.stage) { stageFilter = d.stage; renderHeader(); renderProcesses(); }
  else if (d.view) setView(d.view);
  else if (d.process) openProcess(Number(d.process));
  else if (d.adopter) openAdopterForm(findAdopter(Number(d.adopter)));
  else if (d.newProcess) openAdoptionForm(Number(d.newProcess));
  else if (d.docRemove) {
    const doc = docsSalvos.find(x => x.id === Number(d.docRemove));
    if (doc && window.confirm(`Remover o documento "${doc.name}"?\nEle sai da ficha ao salvar, mas fica guardado no sistema com o seu nome.`)) {
      docsRemover.push(doc.id);
      renderDocs();
    }
  }
  else if (d.docCancel !== undefined) { docsNovos.splice(Number(d.docCancel), 1); renderDocs(); }
  else if (d.action) changeStage(d.action);
  else if (d.adopterFromProcess) {
    const adopter = findAdopter(Number(d.adopterFromProcess));
    $('processModal').addEventListener('hidden.bs.modal', () => openAdopterForm(adopter), { once: true });
    processModal.hide();
  }
});

$('processSearch').addEventListener('input', renderProcesses);
$('adopterSearch').addEventListener('input', renderAdopters);
$('addAdopter').addEventListener('click', () => openAdopterForm());
$('addAdoption').addEventListener('click', () => openAdoptionForm());

render();

// Link direto para um processo (usado pelo dashboard): adocoes.html?processo=2
const linkedId = Number(new URLSearchParams(window.location.search).get('processo'));
if (findAdoption(linkedId)) openProcess(linkedId);

carregarAdotantes(); // atualiza com o servidor (e envia o que estava só neste computador)
