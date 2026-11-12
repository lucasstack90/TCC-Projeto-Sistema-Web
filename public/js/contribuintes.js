/* PAWSAFE — cadastro de contribuintes do financeiro (doadores frequentes e fornecedores)
   Pessoa física (CPF) ou jurídica (CNPJ). Os dados ficam no MySQL (API /api/contribuintes,
   app/Http/Controllers/Api/ContribuinteController.php); só o perfil funcionário acessa.
   CPF/CNPJ conferidos aqui (dígitos verificadores) e de novo no servidor.

   PawContributors.load()                   busca a lista no servidor
   PawContributors.options('donor', id)     <option> para o <select> da doação ('supplier' = despesa)
   PawContributors.openForm(c, { onDone })  abre o formulário; onDone(salvo | null) ao fechar
   Depende de: Bootstrap 5, js/dados.js, js/utils.js e js/api.js. */

const PawContributors = (() => {
  const { escapeHtml, maskPhone, maskCpf, maskCnpj, maskCep, isValidCpf, isValidCnpj } = PawUtils;
  const el = (id) => document.getElementById(id);
  const PF = 'Pessoa física';
  const PJ = 'Pessoa jurídica';

  let list = [];
  let loaded = false;
  let modal = null;
  let onDone = null;   // chamado quando o formulário fecha
  let lastSaved = null;

  const find = (id) => list.find(c => c.id === Number(id)) || null;
  const label = (c) => (c ? `${c.name}${c.tradeName ? ` (${c.tradeName})` : ''}` : '');
  const sortList = () => list.sort((a, b) => (b.active - a.active) || a.name.localeCompare(b.name, 'pt-BR'));
  const changed = () => document.dispatchEvent(new CustomEvent('pawsafe:contribuintes', { detail: list }));

  async function load() {
    list = await PawApi.get('api/contribuintes');
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

  // ---------- Formulário ----------
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

  function wire() {
    if (modal) return;
    modal = new bootstrap.Modal(el('contributorModal'));
    el('cUf').innerHTML = '<option value=""></option>' + PawData.UFS.map(uf => `<option>${uf}</option>`).join('');
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

  function openForm(c = null, opts = {}) {
    wire();
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
    const digits = PawUtils.digits(doc.value);
    const repeated = list.find(c => c.id !== id && PawUtils.digits(c.document) === digits);
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
      const saved = id ? await PawApi.put(`api/contribuintes/${id}`, data) : await PawApi.post('api/contribuintes', data);
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
      await PawApi.del(`api/contribuintes/${c.id}`);
      list = list.filter(x => x.id !== c.id);
      lastSaved = { ...c, removed: true };
      changed();
      modal.hide();
    } catch (error) {
      showError(error.message);
    }
  }

  return { PF, PJ, load, list: () => list, isLoaded: () => loaded, find, label, options, openForm };
})();
