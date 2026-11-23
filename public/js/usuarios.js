/* PAWSAFE — gestão dos usuários do sistema (só o perfil administrador).
   Cada usuário tem um perfil: administrador, financeiro, equipe, veterinário ou voluntário. O que cada
   perfil pode fazer está em app/Core/Permissoes.php (servidor).
   Dados pela API /api/usuarios. Depende de: Bootstrap 5, js/utils.js, js/api.js, js/auth.js.

   PawUsers.open()   abre a lista de usuários com o formulário */

const PawUsers = (() => {
  const { escapeHtml } = PawUtils;
  const el = (id) => document.getElementById(id);

  let modal = null;
  let usuarios = [];
  let perfis = [];
  let editingId = null;

  const meuId = () => PawAuth.usuario()?.id;
  const find = (id) => usuarios.find(u => u.id === Number(id)) || null;
  const BADGE = { administrador: 'status-disponivel', financeiro: 'status-resgatado', equipe: 'volunteer-ativo', veterinario: 'status-temporario', voluntario: 'status-tratamento' };
  // Resumo de cada perfil (a regra completa está em app/Core/Permissoes.php).
  const DESCRICAO = {
    administrador: 'Coordenação: acesso total, inclusive Cadastros (usuários, veterinários, contribuintes), caixa e configuração do relatório.',
    financeiro: 'Responsável pelo caixa: doações em dinheiro, despesas, saldo, orçamento e a execução financeira do relatório.',
    equipe: 'Operação do dia a dia: animais, adoções, resgates, estoque, doações materiais, aprova voluntários e preenche o relatório.',
    veterinario: 'Parte clínica: vacinas, histórico e pesagens, resgates, estoque e consulta ao relatório.',
    voluntario: 'Apoio no abrigo: consulta animais, registra resgates e o consumo no estoque. Não vê dados pessoais nem finanças.'
  };

  function build() {
    if (modal) return;
    document.body.insertAdjacentHTML('beforeend', `
<div class="modal fade" id="userModal" tabindex="-1" aria-labelledby="userModalTitle" aria-hidden="true"><div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable"><div class="modal-content">
  <div class="modal-header"><div><h2 id="userModalTitle">Usuários</h2><p id="userModalHint">Quem acessa o PAWSAFE e com qual perfil.</p></div><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button></div>

  <div id="userListView">
    <div class="modal-body">
      <div class="registry-toolbar">
        <div class="search"><i class="bi bi-search"></i><input id="userSearch" type="search" class="form-control" placeholder="Buscar por nome, e-mail ou perfil..." aria-label="Buscar usuários"></div>
        <button type="button" class="btn btn-green" id="userNew"><i class="bi bi-person-plus me-1"></i>Novo usuário</button>
      </div>
      <div id="userList" class="registry-list"></div>
    </div>
  </div>

  <form id="userForm" class="d-none" novalidate>
    <div class="modal-body">
      <div class="row g-3">
        <div class="col-md-6"><label class="form-label" for="uNome">Nome *</label><input id="uNome" class="form-control" required minlength="3" maxlength="120"></div>
        <div class="col-md-6"><label class="form-label" for="uEmail">E-mail (login) *</label><input id="uEmail" type="email" class="form-control" required maxlength="150" autocomplete="off"></div>
        <div class="col-md-6"><label class="form-label" for="uPerfil">Perfil *</label><select id="uPerfil" class="form-select" required></select></div>
        <div class="col-md-6"><label class="form-label" for="uSenha" id="uSenhaLabel">Senha *</label><input id="uSenha" type="password" class="form-control" minlength="8" maxlength="72" autocomplete="new-password"><small class="text-secondary" id="uSenhaAjuda">Mínimo de 8 caracteres.</small></div>
        <div class="col-12"><div class="alert-soft" id="uPerfilDescricao"></div></div>
        <div class="col-12 d-none" id="uAtivoWrap">
          <div class="form-check form-switch"><input class="form-check-input" type="checkbox" role="switch" id="uAtivo"><label class="form-check-label" for="uAtivo">Conta ativa (pode entrar no sistema)</label></div>
          <small class="text-secondary d-none" id="uHistorico"></small>
        </div>
      </div>
      <div id="uErro" class="alert-soft warning d-none mt-3 mb-0" role="alert"></div>
    </div>
    <div class="modal-footer">
      <button type="button" id="uExcluir" class="btn btn-outline-danger me-auto d-none"><i class="bi bi-trash me-1"></i>Excluir</button>
      <button type="button" id="uVoltar" class="btn btn-outline-green">Voltar à lista</button>
      <button type="submit" id="uSalvar" class="btn btn-green"><i class="bi bi-check2 me-2"></i>Salvar</button>
    </div>
  </form>
</div></div></div>`);

    modal = new bootstrap.Modal(el('userModal'));
    el('userSearch').addEventListener('input', renderList);
    el('userNew').addEventListener('click', () => showForm(null));
    el('uVoltar').addEventListener('click', showList);
    el('uPerfil').addEventListener('change', descreverPerfil);
    el('userList').addEventListener('click', (e) => {
      const b = e.target.closest('[data-user-edit]');
      if (b) showForm(find(b.dataset.userEdit));
    });
    el('userForm').addEventListener('submit', save);
    el('uExcluir').addEventListener('click', remove);
    el('userModal').addEventListener('hidden.bs.modal', showList);
  }

  async function carregar() {
    const resposta = await Api.get('/usuarios');
    usuarios = resposta.usuarios;
    perfis = resposta.perfis;
  }

  function renderList() {
    const termo = el('userSearch').value.trim().toLocaleLowerCase('pt-BR');
    const lista = usuarios.filter(u => !termo
      || [u.nome, u.email, u.perfilRotulo].join(' ').toLocaleLowerCase('pt-BR').includes(termo));
    el('userList').innerHTML = lista.length ? lista.map(u => `
      <article class="registry-item${u.ativo ? '' : ' is-inactive'}">
        <div class="registry-main">
          <strong>${escapeHtml(u.nome)}${u.id === meuId() ? ' <span class="registry-doc">(você)</span>' : ''}</strong>
          <small>${escapeHtml(u.email)}</small>
        </div>
        <div class="registry-side">
          <span class="status-badge ${BADGE[u.perfil] || ''}">${escapeHtml(u.perfilRotulo)}${u.ativo ? '' : ' · inativo'}</span>
          <button type="button" class="btn btn-sm btn-outline-green" data-user-edit="${u.id}"><i class="bi bi-pencil me-1"></i>Editar</button>
        </div>
      </article>`).join('')
      : `<div class="registry-empty"><i class="bi bi-person-lock"></i><p>${termo ? 'Nenhum usuário encontrado.' : 'Nenhum usuário cadastrado.'}</p></div>`;
  }

  function showList() {
    if (!modal) return;
    editingId = null;
    el('userForm').classList.add('d-none');
    el('userListView').classList.remove('d-none');
    el('userModalTitle').textContent = 'Usuários';
    el('userModalHint').textContent = 'Quem acessa o PAWSAFE e com qual perfil.';
    renderList();
  }

  function descreverPerfil() {
    el('uPerfilDescricao').textContent = DESCRICAO[el('uPerfil').value] || '';
  }

  function showForm(u) {
    editingId = u?.id ?? null;
    const souEu = u && u.id === meuId();
    el('userListView').classList.add('d-none');
    el('userForm').classList.remove('d-none');
    el('userModalTitle').textContent = u ? 'Editar usuário' : 'Novo usuário';
    el('userModalHint').textContent = u ? u.email : 'A pessoa entra com o e-mail e a senha definidos aqui.';
    el('uPerfil').innerHTML = perfis.map(p => `<option value="${p.valor}">${escapeHtml(p.rotulo)}</option>`).join('');
    el('uNome').value = u?.nome ?? '';
    el('uEmail').value = u?.email ?? '';
    el('uPerfil').value = u?.perfil ?? 'voluntario';
    el('uSenha').value = '';
    el('uSenha').required = !u;
    el('uSenhaLabel').textContent = u ? 'Nova senha' : 'Senha *';
    el('uSenhaAjuda').textContent = u ? 'Deixe em branco para manter a senha atual.' : 'Mínimo de 8 caracteres.';
    el('uAtivo').checked = u ? u.ativo : true;
    el('uAtivoWrap').classList.toggle('d-none', !u);
    // A própria conta não muda de perfil, não se desativa e não se exclui (o servidor também barra).
    el('uPerfil').disabled = Boolean(souEu);
    el('uAtivo').disabled = Boolean(souEu);
    // Quem já registrou algo fica como autor no histórico: só desativa (o servidor também barra).
    const registros = Number(u?.registros || 0);
    el('uExcluir').classList.toggle('d-none', !u || souEu || registros > 0);
    el('uHistorico').classList.toggle('d-none', !u || souEu || registros === 0);
    el('uHistorico').textContent = registros > 0
      ? `Esta conta tem ${registros} registro(s) no sistema e não pode ser excluída, para o histórico não perder quem fez cada registro. Para bloquear o acesso, desmarque "Conta ativa".`
      : '';
    el('uErro').classList.add('d-none');
    descreverPerfil();
    setTimeout(() => el('uNome').focus(), 50);
  }

  function showError(error) {
    const campos = error.campos ? Object.values(error.campos).join(' ') : '';
    el('uErro').textContent = campos ? `${error.message} ${campos}` : error.message;
    el('uErro').classList.remove('d-none');
  }

  async function save(event) {
    event.preventDefault();
    const form = el('userForm');
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const dados = {
      nome: el('uNome').value.trim(), email: el('uEmail').value.trim(), perfil: el('uPerfil').value,
      ativo: editingId ? el('uAtivo').checked : true
    };
    if (el('uSenha').value) dados.senha = el('uSenha').value;

    el('uSalvar').disabled = true;
    try {
      const salvo = editingId ? await Api.put(`/usuarios/${editingId}`, dados) : await Api.post('/usuarios', dados);
      const i = usuarios.findIndex(u => u.id === salvo.id);
      if (i >= 0) usuarios[i] = salvo; else usuarios.push(salvo);
      usuarios.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      showList();
    } catch (error) {
      showError(error);
    } finally {
      el('uSalvar').disabled = false;
    }
  }

  async function remove() {
    const u = find(editingId);
    if (!u || !window.confirm(`Excluir o acesso de ${u.nome}?\n\nSe a pessoa só vai ficar um tempo afastada, prefira desmarcar "Conta ativa".`)) return;
    try {
      await Api.del(`/usuarios/${u.id}`);
      usuarios = usuarios.filter(x => x.id !== u.id);
      showList();
    } catch (error) {
      showError(error);
    }
  }

  async function open() {
    build();
    showList();
    modal.show();
    try {
      await carregar();
      renderList();
    } catch (error) {
      el('userList').innerHTML = `<div class="alert-soft warning" role="alert">${escapeHtml(error.message)}</div>`;
    }
  }

  return { open };
})();
