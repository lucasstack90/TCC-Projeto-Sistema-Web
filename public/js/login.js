/* PAWSAFE — tela de login.
   Autentica de verdade no back-end PHP (POST /api/auth/login). Em caso de
   sucesso, a sessão fica no cookie e o painel é aberto. */
(() => {
  const form = document.getElementById('loginForm');
  const email = document.getElementById('email');
  const password = document.getElementById('password');
  const message = document.getElementById('loginMessage');
  const toggle = document.getElementById('togglePassword');
  const submitBtn = form.querySelector('button[type="submit"]');

  document.getElementById('year').textContent = new Date().getFullYear();

  const showMessage = (type, text) => {
    message.className = `alert alert-${type} login-alert`;
    message.textContent = text;
  };

  const setInvalid = (field, invalid) => {
    field.classList.toggle('is-invalid', invalid);
    document.getElementById(`${field.id}Error`).classList.toggle('d-block', invalid);
  };

  toggle.addEventListener('click', () => {
    const show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    toggle.innerHTML = `<i class="bi bi-eye${show ? '-slash' : ''}"></i>`;
    toggle.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
    toggle.setAttribute('aria-pressed', String(show));
    password.focus();
  });

  document.getElementById('helpLink').addEventListener('click', (event) => {
    event.preventDefault();
    showMessage('info', 'Para recuperar o acesso, entre em contato com o administrador do PAWSAFE.');
  });

  [email, password].forEach(field => field.addEventListener('input', () => {
    setInvalid(field, false);
    message.classList.add('d-none');
  }));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const emailInvalid = !email.value.trim() || !email.validity.valid;
    const passwordInvalid = password.value.trim().length < password.minLength;
    setInvalid(email, emailInvalid);
    setInvalid(password, passwordInvalid);

    if (emailInvalid || passwordInvalid) {
      showMessage('warning', 'Confira o e-mail e a senha antes de continuar.');
      return;
    }

    submitBtn.disabled = true;
    showMessage('info', 'Entrando...');

    try {
      const dados = await Api.post('/auth/login', {
        email: email.value.trim(),
        senha: password.value,
      });
      // Guarda usuário, perfil e permissões da sessão (js/auth.js) e o token CSRF.
      PawAuth.salvar(dados);

      showMessage('success', `Olá, ${dados.usuario.nome}! Abrindo o painel...`);
      setTimeout(() => { window.location.href = PawAuth.paginaInicial(); }, 500);
    } catch (err) {
      submitBtn.disabled = false;
      if (err.campos) {
        if (err.campos.email) setInvalid(email, true);
        if (err.campos.senha) setInvalid(password, true);
      }
      // Erro de rede (back-end desligado) tem mensagem genérica do fetch.
      const semServidor = err.status === undefined;
      showMessage(
        'danger',
        semServidor
          ? 'Não foi possível falar com o servidor. Verifique se o Apache e o MySQL do XAMPP estão ligados.'
          : (err.message || 'Não foi possível entrar.')
      );
    }
  });
})();
