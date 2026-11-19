/* PAWSAFE — cadastro de contribuintes do financeiro (doadores frequentes e fornecedores).
   Pessoa física (CPF) ou jurídica (CNPJ). Os dados ficam no MySQL pela API
   /api/contribuintes (back-end PHP MVC). CPF/CNPJ conferidos aqui (dígitos
   verificadores) e de novo no servidor.

   PawContributors.load()                   busca a lista no servidor
   PawContributors.options('donor', id)     <option> p/ o <select> da doação ('supplier' = despesa)
   PawContributors.openForm(c, { onDone })  abre o formulário; onDone(salvo | null) ao fechar
   PawContributors.open()                   abre a lista de cadastros (tela de gestão)
   Depende de: Bootstrap 5, js/dados.js, js/utils.js e js/api.js. */

const PawContributors = (() => {
  const { escapeHtml, maskPhone, maskCpf, maskCnpj, maskCep, isValidCpf, isValidCnpj, digits } = PawUtils;
  const el = (id) => document.getElementById(id);
  const PF = 'Pessoa física';
  const PJ = 'Pessoa jurídica';

  let list = [];
  let loaded = false;
  let modal = null;         // formulário
  let listModal = null;     // tela de gestão (lista)
  let onDone = null;
  let lastSaved = null;

  const find = (id) => list.find(c => c.id === Number(id)) || null;
  const label = (c) => (c ? `${c.name}${c.tradeName ? ` (${c.tradeName})` : ''}` : '');
  const sortList = () => list.sort((a, b) => (b.active - a.active) || a.name.localeCompare(b.name, 'pt-BR'));
  const changed = () => document.dispatchEvent(new CustomEvent('pawsafe:contribuintes', { detail: list }));

  async function load() {
    list = await Api.get('/contribuintes');
    loaded = true;
    sortList();
    changed();
    return list;
  }

  // <option> dos cadastros ativos com o papel pedido; o já gravado aparece mesmo se inativo.
  function options(role, selectedId = null) {
    const field = role === 'supplier' ? 'supplier' : 'donor';
    return list
      .filter(c => (c.active && c[field]) || c.id === Number(selectedId))
      .map(c => `<option value="${c.id}"${c.id === Number(selectedId) ? ' selected' : ''}>${escapeHtml(label(c))} — ${escapeHtml(c.documentMasked)}${c.active ? '' : ' (inativo)'}</option>`)
      .join('');
  }

  // ---------- Modal do formulário (construído pelo script) ----------
  function buildForm() {
    if (modal) return;
    const ufOpts = '<option value=""></option>' + PawData.UFS.map(uf => `<option>${uf}</option>`).join('');
    document.body.insertAdjacentHTML('beforeend', `
<div class="modal fade" id="contributorModal" tabindex="-1" aria-labelledby="contributorTitle" aria-hidden="true"><div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable"><div class="modal-content">
  <div class="modal-header"><h2 id="contributorTitle">Novo contribuinte</h2><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button></div>
  <form id="contributorForm" novalidate>
    <div class="modal-body">
      <input type="hidden" id="contributorId">
      <div class="btn-group mb-3" role="group" aria-label="Tipo de contribuinte">
        <input type="radio" class="btn-check" name="cType" id="cTypePF" value="${PF}" checked>
        <label class="btn btn-outline-green" for="cTypePF">Pessoa física</label>
        <input type="radio" class="btn-check" name="cType" id="cTypePJ" value="${PJ}">
        <label class="btn btn-outline-green" for="cTypePJ">Pessoa jurídica</label>
      </div>
      <div class="row g-3">
        <div class="col-md-8"><label class="form-label" id="cNameLabel" for="cName">Nome completo *</label><input id="cName" class="form-control" required maxlength="120"></div>
        <div class="col-md-4"><label class="form-label" id="cDocumentLabel" for="cDocument">CPF *</label><input id="cDocument" class="form-control" required inputmode="numeric" maxlength="18"></div>
        <div class="col-md-6 pj-field d-none"><label class="form-label" for="cTradeName">Nome fantasia</label><input id="cTradeName" class="form-control" maxlength="120"></div>
        <div class="col-md-6 pj-field d-none"><label class="form-label" for="cContact">Pessoa de contato</label><input id="cContact" class="form-control" maxlength="120"></div>
        <div class="col-md-6"><label class="form-label" for="cPhone">Telefone</label><input id="cPhone" class="form-control" inputmode="tel" maxlength="15" placeholder="(42) 99999-9999"></div>
        <div class="col-md-6"><label class="form-label" for="cEmail">E-mail</label><input id="cEmail" type="email" class="form-control" maxlength="150"></div>
      </div>
      <div class="section-title mt-4">ENDEREÇO</div>
      <div class="row g-3">
        <div class="col-6 col-md-3"><label class="form-label" for="cCep">CEP</label><input id="cCep" class="form-control" inputmode="numeric" maxlength="9"></div>
        <div class="col-12 col-md-7"><label class="form-label" for="cStreet">Logradouro</label><input id="cStreet" class="form-control" maxlength="150"></div>
        <div class="col-6 col-md-2"><label class="form-label" for="cNumber">Número</label><input id="cNumber" class="form-control" maxlength="20"></div>
        <div class="col-md-5"><label class="form-label" for="cComplement">Complemento</label><input id="cComplement" class="form-control" maxlength="80"></div>
        <div class="col-md-4"><label class="form-label" for="cDistrict">Bairro</label><input id="cDistrict" class="form-control" maxlength="80"></div>
        <div class="col-8 col-md-2"><label class="form-label" for="cCity">Cidade</label><input id="cCity" class="form-control" maxlength="80"></div>
        <div class="col-4 col-md-1"><label class="form-label" for="cUf">UF</label><select id="cUf" class="form-select">${ufOpts}</select></div>
      </div>
      <div class="section-title mt-4">PAPEL E OBSERVAÇÕES</div>
      <div class="choice-options mb-2">
        <label><input type="checkbox" id="cDonor"><span>Doador</span></label>
        <label><input type="checkbox" id="cSupplier"><span>Fornecedor</span></label>
      </div>
      <div class="mb-2"><label class="form-label" for="cNotes">Observações</label><textarea id="cNotes" class="form-control" rows="2" maxlength="1000"></textarea></div>
      <div id="cConsentRow" class="form-check mb-2">
        <input class="form-check-input" type="checkbox" id="cConsent">
        <label class="form-check-label" for="cConsent">A pessoa autoriza o uso dos dados para a prestação de contas (LGPD). *</label>
      </div>
      <div id="cActiveWrap" class="form-check form-switch d-none">
        <input class="form-check-input" type="checkbox" role="switch" id="cActive">
        <label class="form-check-label" for="cActive">Cadastro ativo (aparece para seleção em doações e despesas)</label>
      </div>
      <div id="cError" class="alert-soft warning d-none mt-3 mb-0" role="alert"></div>
    </div>
    <div class="modal-footer">
      <button type="button" id="deleteContributor" class="btn btn-outline-danger me-auto d-none"><i class="bi bi-trash me-1"></i>Excluir</button>
      <button type="button" class="btn btn-outline-green" data-bs-dismiss="modal">Cancelar</button>
      <button type="submit" id="saveContributorButton" class="btn btn-green"><i class="bi bi-check2 me-2"></i>Cadastrar contribuinte</button>
    </div>
  </form>
</div></div></div>`);

    modal = new bootstrap.Modal(el('contributorModal'));
    document.querySelectorAll('input[name="cType"]').forEach(r => r.addEventListener('change', applyType));
    el('cDocument').addEventListener('input', (e) => {
      e.target.value = (type() === PJ ? maskCnpj : maskCpf)(e.target.value);
      e.target.setCustomValidity('');
    });
    el('cPhone').addEventListener('input', (e) => { e.target.value = maskPhone(e.target.value); });
    el('cCep').addEventListener('input', (e) => { e.target.value = maskCep(e.target.value); });
    el('contributorForm').addEventListener('submit', save);
    el('deleteContributor').addEventListener('click', remove);
    el('contributorModal').addEventListener('hidden.bs.modal', () => {
      const done = onDone;
      onDone = null;
      if (done) done(lastSaved);
    });
  }

  const type = () => document.querySelector('input[name="cType"]:checked').value;

  function applyType() {
    const pj = type() === PJ;
    document.querySelectorAll('#contributorForm .pj-field').forEach(f => f.classList.toggle('d-none', !pj));
    el('cNameLabel').textContent = pj ? 'Razão social *' : 'Nome completo *';
    el('cDocumentLabel').textContent = pj ? 'CNPJ *' : 'CPF *';
    el('cDocument').placeholder = pj ? '00.000.000/0000-00' : '000.000.000-00';
    el('cDocument').value = (pj ? maskCnpj : maskCpf)(el('cDocument').value);
    el('cDocument').setCustomValidity('');
    // Consentimento LGPD: obrigatório para pessoa física (dado pessoal); CNPJ é dado da empresa.
    el('cConsentRow').classList.toggle('d-none', pj);
    el('cConsent').required = !pj;
  }

  function openForm(c = null, opts = {}) {
    buildForm();
    onDone = opts.onDone || null;
    lastSaved = null;
    const form = el('contributorForm');
    form.reset();
    el('contributorId').value = c?.id ?? '';
    const t = c?.type ?? opts.type ?? PF;
    document.querySelector(`input[name="cType"][value="${t}"]`).checked = true;
    el('cName').value = c?.name ?? '';
    el('cDocument').value = c?.document ?? '';
    el('cTradeName').value = c?.tradeName ?? '';
    el('cContact').value = c?.contact ?? '';
    el('cPhone').value = c?.phone ?? '';
    el('cEmail').value = c?.email ?? '';
    el('cCep').value = c?.cep ?? '';
    el('cStreet').value = c?.street ?? '';
    el('cNumber').value = c?.number ?? '';
    el('cComplement').value = c?.complement ?? '';
    el('cDistrict').value = c?.district ?? '';
    el('cCity').value = c ? c.city : 'Guarapuava';
    el('cUf').value = c ? c.uf : 'PR';
    el('cDonor').checked = c ? c.donor : opts.role !== 'supplier';
    el('cSupplier').checked = c ? c.supplier : opts.role === 'supplier';
    el('cNotes').value = c?.notes ?? '';
    // Consentimento já registrado não se desmarca na edição.
    el('cConsent').checked = Boolean(c?.consent);
    el('cConsent').disabled = Boolean(c?.consent);
    el('cActive').checked = c ? c.active : true;
    el('cActiveWrap').classList.toggle('d-none', !c);
    el('cError').classList.add('d-none');
    el('deleteContributor').classList.toggle('d-none', !c);
    el('contributorTitle').textContent = c ? 'Editar contribuinte' : 'Novo contribuinte';
    el('saveContributorButton').innerHTML = `<i class="bi bi-check2 me-2"></i>${c ? 'Salvar alterações' : 'Cadastrar contribuinte'}`;
    applyType();
    modal.show();
  }

  function showError(message) {
    el('cError').textContent = message;
    el('cError').classList.remove('d-none');
  }

  async function save(event) {
    event.preventDefault();
    const id = Number(el('contributorId').value) || null;
    const pj = type() === PJ;
    const doc = el('cDocument');
    const valid = pj ? isValidCnpj(doc.value) : isValidCpf(doc.value);
    const ds = digits(doc.value);
    const repeated = list.find(c => c.id !== id && digits(c.document) === ds);
    doc.setCustomValidity(!valid ? `${pj ? 'CNPJ' : 'CPF'} inválido. Confira os números.`
      : repeated ? `Já cadastrado: ${repeated.name}.` : '');
    if (!el('cDonor').checked && !el('cSupplier').checked) {
      el('cDonor').setCustomValidity('Marque doador, fornecedor ou os dois.');
    } else el('cDonor').setCustomValidity('');
    const form = el('contributorForm');
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const data = {
      type: type(), name: el('cName').value.trim(), document: doc.value,
      tradeName: pj ? el('cTradeName').value.trim() : '', contact: pj ? el('cContact').value.trim() : '',
      phone: el('cPhone').value.trim(), email: el('cEmail').value.trim(),
      cep: el('cCep').value.trim(), street: el('cStreet').value.trim(), number: el('cNumber').value.trim(),
      complement: el('cComplement').value.trim(), district: el('cDistrict').value.trim(),
      city: el('cCity').value.trim(), uf: el('cUf').value,
      donor: el('cDonor').checked, supplier: el('cSupplier').checked, notes: el('cNotes').value.trim(),
      consent: pj ? null : el('cConsent').checked, active: id ? el('cActive').checked : true
    };

    const button = el('saveContributorButton');
    button.disabled = true;
    try {
      const saved = id ? await Api.put(`/contribuintes/${id}`, data) : await Api.post('/contribuintes', data);
      const index = list.findIndex(c => c.id === saved.id);
      if (index >= 0) list[index] = saved; else list.push(saved);
      sortList();
      lastSaved = saved;
      changed();
      modal.hide();
    } catch (error) {
      showError(error.message);
    } finally {
      button.disabled = false;
    }
  }

  async function remove() {
    const c = find(el('contributorId').value);
    if (!c) return;
    const ok = window.confirm(`Excluir ${c.name}?\n\nOs dados pessoais serão apagados (LGPD). As doações e despesas já registradas continuam no financeiro, sem o nome.\nSe a ideia é só parar de usar o cadastro, desmarque "Cadastro ativo".`);
    if (!ok) return;
    try {
      await Api.del(`/contribuintes/${c.id}`);
      list = list.filter(x => x.id !== c.id);
      lastSaved = { ...c, removed: true };
      changed();
      modal.hide();
    } catch (error) {
      showError(error.message);
    }
  }

  // ---------- Tela de gestão (lista) ----------
  function buildList() {
    if (listModal) return;
    document.body.insertAdjacentHTML('beforeend', `
<div class="modal fade" id="contributorsModal" tabindex="-1" aria-labelledby="contributorsTitle" aria-hidden="true"><div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable"><div class="modal-content">
  <div class="modal-header"><div><h2 id="contributorsTitle">Contribuintes</h2><p>Doadores frequentes e fornecedores. Cadastre uma vez e selecione ao registrar doações e despesas.</p></div><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button></div>
  <div class="modal-body">
    <div class="registry-toolbar">
      <div class="search"><i class="bi bi-search"></i><input id="contribSearch" type="search" class="form-control" placeholder="Buscar por nome, documento ou cidade..." aria-label="Buscar contribuintes"></div>
      <button type="button" class="btn btn-green" id="contribNew"><i class="bi bi-plus-lg me-1"></i>Novo contribuinte</button>
    </div>
    <div id="contribList" class="registry-list"></div>
  </div>
</div></div></div>`);
    listModal = new bootstrap.Modal(el('contributorsModal'));
    el('contribSearch').addEventListener('input', renderList);
    el('contribNew').addEventListener('click', () => openForm(null, { onDone: () => { renderList(); } }));
    el('contribList').addEventListener('click', (e) => {
      const b = e.target.closest('[data-contrib-edit]');
      if (b) openForm(find(b.dataset.contribEdit), { onDone: () => renderList() });
    });
    document.addEventListener('pawsafe:contribuintes', renderList);
  }

  function renderList() {
    if (!el('contribList')) return;
    const term = el('contribSearch').value.trim().toLocaleLowerCase('pt-BR');
    const items = list.filter(c => !term
      || [c.name, c.tradeName, c.documentMasked, c.city].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR').includes(term));
    const papel = (c) => [c.donor ? 'Doador' : null, c.supplier ? 'Fornecedor' : null].filter(Boolean).join(' · ');
    el('contribList').innerHTML = items.length ? items.map(c => `
      <article class="registry-item${c.active ? '' : ' is-inactive'}">
        <div class="registry-main">
          <strong>${escapeHtml(label(c))} <span class="registry-doc">${escapeHtml(c.documentMasked)}</span></strong>
          <small>${escapeHtml(c.type)} · ${escapeHtml(papel(c) || 'Sem papel')}</small>
          <small>${[c.phone, c.email, c.city].filter(Boolean).map(escapeHtml).join(' · ') || 'Sem contato informado'}</small>
        </div>
        <div class="registry-side">
          <span class="status-badge ${c.active ? 'volunteer-ativo' : 'volunteer-inativo'}">${c.active ? 'Ativo' : 'Inativo'}</span>
          <button type="button" class="btn btn-sm btn-outline-green" data-contrib-edit="${c.id}"><i class="bi bi-pencil me-1"></i>Editar</button>
        </div>
      </article>`).join('')
      : `<div class="registry-empty"><i class="bi bi-people"></i><p>${term ? 'Nenhum contribuinte encontrado.' : 'Nenhum contribuinte cadastrado ainda.'}</p></div>`;
  }

  async function open() {
    buildList();
    renderList();
    listModal.show();
    if (!loaded) { try { await load(); } catch (e) { /* ignora */ } }
    renderList();
  }

  return { PF, PJ, load, open, list: () => list, isLoaded: () => loaded, find, label, options, openForm };
})();
