/* PAWSAFE — tela de login (protótipo).
   Não há autenticação real: o login de verdade será feito pelo Laravel (back-end). */
(() => {
  const form = document.getElementById('loginForm');
  const email = document.getElementById('email');
  const password = document.getElementById('password');
  const message = document.getElementById('loginMessage');
  const toggle = document.getElementById('togglePassword');

  document.getElementById('year').textContent = new Date().getFullYear();

  const showMessage = (type, text) => {
    message.className = `alert alert-${type} login-alert`;
    message.textContent = text;
  };

  // A mensagem de erro fica fora da .input-wrap, então o Bootstrap não a exibe sozinho.
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

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const emailInvalid = !email.value.trim() || !email.validity.valid;
    const passwordInvalid = password.value.trim().length < password.minLength;
    setInvalid(email, emailInvalid);
    setInvalid(password, passwordInvalid);

    if (emailInvalid || passwordInvalid) {
      showMessage('warning', 'Confira o e-mail e a senha antes de continuar.');
      return;
    }

    // Simulação: qualquer e-mail/senha válidos entram no painel.
    showMessage('success', 'Acesso liberado (simulação). Abrindo o painel...');
    setTimeout(() => { window.location.href = '../index.html'; }, 800);
  });
})();
