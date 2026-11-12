/* PAWSAFE — cadastro de veterinários (módulo de Animais)
   Usado em: Animais (vacinas, histórico e tela de cadastro) e Relatório técnico (assinatura).
   A lista vem do servidor (window.PAWSAFE.veterinarios → PawData.loadVets()) e as gravações
   usam a API /api/veterinarios (app/Http/Controllers/Api/VeterinarioController.php).

   PawVets.open()                  abre a tela de cadastro (lista + formulário, num único modal)
   PawVets.options(idSelecionado)  <option> dos veterinários ativos, para os <select> das fichas
   PawVets.create(dados)           cadastro rápido (usado dentro do registro de vacina/evento)
   Depende de: Bootstrap 5, js/dados.js, js/utils.js e js/api.js. */

const PawVets = (() => {
  const { escapeHtml, maskPhone } = PawUtils;
  const isStaff = window.PAWSAFE?.user?.perfil === 'funcionario';
  const el = (id) => document.getElementById(id);

  let modal = null;
  let editingId = null;

  const find = (id) => PawData.loadVets().find(v => v.id === Number(id)) || null;

  // ---------- <select> das fichas ----------
  // Só os ativos; o veterinário já gravado aparece mesmo se tiver sido inativado depois.
  function options(selectedId = null) {
    return PawData.loadVets()
      .filter(v => v.active || v.id === Number(selectedId))
      .map(v => `<option value="${v.id}"${v.id === Number(selectedId) ? ' selected' : ''}>${escapeHtml(PawData.vetLabel(v))}${v.active ? '' : ' (inativo)'}</option>`)
      .join('');
  }

  // Grava e atualiza a lista compartilhada (PawData avisa as telas com o evento "pawsafe:veterinarios").
  function storeVet(saved) {
    const list = PawData.loadVets();
    const index = list.findIndex(v => v.id === saved.id);
    if (index >= 0) list[index] = saved; else list.push(saved);
    list.sort((a, b) => (b.active - a.active) || a.name.localeCompare(b.name, 'pt-BR'));
    PawData.setVets(list);
    return saved;
  }

  async function create(data) {
    return storeVet(await PawApi.post('api/veterinarios', data));
  }

  // ---------- Tela de cadastro (modal criado pelo próprio script) ----------
  const ufOptions = (selected = 'PR') => PawData.UFS.map(uf => `<option${uf === selected ? ' selected' : ''}>${uf}</option>`).join('');
  const bondOptions = (selected) => PawData.VET_BONDS.map(b => `<option${b === selected ? ' selected' : ''}>${escapeHtml(b)}</option>`).join('');

  function build() {
    if (modal) return;
    document.body.insertAdjacentHTML('beforeend', `
<div class="modal fade" id="vetModal" tabindex="-1" aria-labelledby="vetModalTitle" aria-hidden="true"><div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable"><div class="modal-content">
  <div class="modal-header"><div><h2 id="vetModalTitle">Veterinários</h2><p id="vetModalHint">Profissionais que aplicam vacinas, fazem procedimentos e assinam o relatório técnico.</p></div><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button></div>

  <div id="vetListView">
    <div class="modal-body">
      <div class="registry-toolbar">
        <div class="search"><i class="bi bi-search"></i><input id="vetSearch" type="search" class="form-control" placeholder="Buscar por nome, CRMV ou clínica..." aria-label="Buscar veterinários"></div>
        <button type="button" class="btn btn-green" id="vetNew"><i class="bi bi-plus-lg me-1"></i>Novo veterinário</button>
      </div>
      <div id="vetList" class="registry-list"></div>
    </div>
  </div>

  <form id="vetForm" class="d-none" novalidate>
    <div class="modal-body">
      <div class="section-title">IDENTIFICAÇÃO PROFISSIONAL</div>
      <div class="row g-3">
        <div class="col-md-6"><label class="form-label" for="vtName">Nome *</label><input id="vtName" class="form-control" required minlength="3" maxlength="120" placeholder="Ex.: Dra. Marina Lopes"></div>
        <div class="col-6 col-md-3"><label class="form-label" for="vtCrmv">CRMV *</label><input id="vtCrmv" class="form-control" required inputmode="numeric" maxlength="10" placeholder="Só números"></div>
        <div class="col-6 col-md-3"><label class="form-label" for="vtUf">UF do CRMV *</label><select id="vtUf" class="form-select" required>${ufOptions()}</select></div>
        <div class="col-md-6"><label class="form-label" for="vtBond">Vínculo com a organização *</label><select id="vtBond" class="form-select" required>${bondOptions('Clínica parceira')}</select></div>
        <div class="col-md-6"><label class="form-label" for="vtSpecialty">Especialidade</label><input id="vtSpecialty" class="form-control" maxlength="80" placeholder="Ex.: clínica geral, felinos, cirurgia"></div>
        <div class="col-12"><label class="form-label" for="vtClinic">Clínica / hospital</label><input id="vtClinic" class="form-control" maxlength="120" placeholder="Onde atende os animais da organização"></div>
      </div>
      <div class="section-title mt-4">CONTATO</div>
      <div class="row g-3">
        <div class="col-md-6"><label class="form-label" for="vtPhone">Telefone</label><input id="vtPhone" class="form-control" inputmode="tel" maxlength="15" placeholder="(42) 99999-9999"></div>
        <div class="col-md-6"><label class="form-label" for="vtEmail">E-mail</label><input id="vtEmail" type="email" class="form-control" maxlength="150"></div>
        <div class="col-12"><label class="form-label" for="vtNotes">Observações</label><textarea id="vtNotes" class="form-control" rows="2" maxlength="1000" placeholder="Dias de atendimento, valores combinados..."></textarea></div>
        <div class="col-12" id="vtActiveWrap">
          <div class="form-check form-switch"><input class="form-check-input" type="checkbox" role="switch" id="vtActive"><label class="form-check-label" for="vtActive">Cadastro ativo (aparece para seleção nas vacinas, no histórico e no relatório)</label></div>
        </div>
      </div>
      <div id="vtError" class="alert-soft warning d-none mt-3 mb-0" role="alert"></div>
    </div>
    <div class="modal-footer">
      <button type="button" id="vtDelete" class="btn btn-outline-danger me-auto d-none"><i class="bi bi-trash me-1"></i>Excluir</button>
      <button type="button" id="vtBack" class="btn btn-outline-green">Voltar à lista</button>
      <button type="submit" id="vtSave" class="btn btn-green"><i class="bi bi-check2 me-2"></i>Salvar</button>
    </div>
  </form>
</div></div></div>`);

    modal = new bootstrap.Modal(el('vetModal'));
    el('vetSearch').addEventListener('input', renderList);
    el('vetNew').addEventListener('click', () => showForm(null));
    el('vtBack').addEventListener('click', showList);
    el('vtPhone').addEventListener('input', (e) => { e.target.value = maskPhone(e.target.value); });
    el('vtCrmv').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, ''); });
    el('vetList').addEventListener('click', (e) => {
      const button = e.target.closest('[data-vet-edit]');
      if (button) showForm(find(button.dataset.vetEdit));
    });
    el('vetForm').addEventListener('submit', save);
    el('vtDelete').addEventListener('click', remove);
    el('vetModal').addEventListener('hidden.bs.modal', showList);
  }

  function renderList() {
    const term = el('vetSearch').value.trim().toLocaleLowerCase('pt-BR');
    const list = PawData.loadVets().filter(v =>
      !term || [v.name, v.registry, v.crmv, v.clinic, v.specialty].join(' ').toLocaleLowerCase('pt-BR').includes(term));

    el('vetList').innerHTML = list.length ? list.map(v => `
      <article class="registry-item${v.active ? '' : ' is-inactive'}">
        <div class="registry-main">
          <strong>${escapeHtml(v.name)} <span class="registry-doc">${escapeHtml(v.registry)}</span></strong>
          <small>${[v.bond, v.specialty, v.clinic].filter(Boolean).map(escapeHtml).join(' · ')}</small>
          <small>${[v.phone, v.email].filter(Boolean).map(escapeHtml).join(' · ') || 'Sem contato informado'}</small>
        </div>
        <div class="registry-side">
          <span class="status-badge ${v.active ? 'volunteer-ativo' : 'volunteer-inativo'}">${v.active ? 'Ativo' : 'Inativo'}</span>
          <small>${v.uses ? `${v.uses} registro${v.uses === 1 ? '' : 's'} na ficha dos animais` : 'Nenhum registro ainda'}</small>
          <button type="button" class="btn btn-sm btn-outline-green" data-vet-edit="${v.id}"><i class="bi bi-pencil me-1"></i>Editar</button>
        </div>
      </article>`).join('')
      : `<div class="registry-empty"><i class="bi bi-person-badge"></i><p>${term ? 'Nenhum veterinário encontrado.' : 'Nenhum veterinário cadastrado ainda.'}</p></div>`;
  }

  function showList() {
    if (!modal) return;
    editingId = null;
    el('vetForm').classList.add('d-none');
    el('vetListView').classList.remove('d-none');
    el('vetModalTitle').textContent = 'Veterinários';
    el('vetModalHint').textContent = 'Profissionais que aplicam vacinas, fazem procedimentos e assinam o relatório técnico.';
    renderList();
  }

  function showForm(vet) {
    editingId = vet?.id ?? null;
    el('vetListView').classList.add('d-none');
    el('vetForm').classList.remove('d-none');
    el('vetModalTitle').textContent = vet ? 'Editar veterinário' : 'Novo veterinário';
    el('vetModalHint').textContent = vet ? `Cadastrado como ${vet.registry}.` : 'Cadastre uma vez e selecione nas vacinas e nos atendimentos.';
    el('vtName').value = vet?.name ?? '';
    el('vtCrmv').value = vet?.crmv ?? '';
    el('vtUf').value = vet?.crmvUf ?? 'PR';
    el('vtBond').value = vet?.bond ?? 'Clínica parceira';
    el('vtSpecialty').value = vet?.specialty ?? '';
    el('vtClinic').value = vet?.clinic ?? '';
    el('vtPhone').value = vet?.phone ?? '';
    el('vtEmail').value = vet?.email ?? '';
    el('vtNotes').value = vet?.notes ?? '';
    el('vtActive').checked = vet ? vet.active : true;
    el('vtActiveWrap').classList.toggle('d-none', !vet);
    // Excluir só quem nunca foi usado; quem já atendeu fica no histórico e é inativado.
    el('vtDelete').classList.toggle('d-none', !vet || !isStaff || vet.uses > 0);
    el('vtError').classList.add('d-none');
    setTimeout(() => el('vtName').focus(), 50);
  }

  function showError(message) {
    el('vtError').textContent = message;
    el('vtError').classList.remove('d-none');
  }

  async function save(event) {
    event.preventDefault();
    const form = el('vetForm');
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const data = {
      name: el('vtName').value.trim(), crmv: el('vtCrmv').value.trim(), crmvUf: el('vtUf').value,
      bond: el('vtBond').value, specialty: el('vtSpecialty').value.trim(), clinic: el('vtClinic').value.trim(),
      phone: el('vtPhone').value.trim(), email: el('vtEmail').value.trim(), notes: el('vtNotes').value.trim(),
      active: editingId ? el('vtActive').checked : true
    };

    const button = el('vtSave');
    button.disabled = true;
    try {
      const saved = editingId ? await PawApi.put(`api/veterinarios/${editingId}`, data) : await PawApi.post('api/veterinarios', data);
      storeVet(saved);
      showList();
    } catch (error) {
      showError(error.message);
    } finally {
      button.disabled = false;
    }
  }

  async function remove() {
    const vet = find(editingId);
    if (!vet || !window.confirm(`Excluir o cadastro de ${vet.name}?`)) return;
    try {
      await PawApi.del(`api/veterinarios/${vet.id}`);
      PawData.setVets(PawData.loadVets().filter(v => v.id !== vet.id));
      showList();
    } catch (error) {
      showError(error.message);
    }
  }

  function open() {
    build();
    showList();
    modal.show();
  }

  return { open, options, find, create };
})();
