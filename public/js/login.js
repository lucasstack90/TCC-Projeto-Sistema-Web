/* PAWSAFE — tela de login.
   O JavaScript só confere o preenchimento; quem autentica é o Laravel
   (App\Http\Controllers\AuthController), que compara a senha com o hash do banco. */
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
    const emailInvalid = !email.value.trim() || !email.validity.valid;
    const passwordInvalid = password.value.trim().length < password.minLength;
    setInvalid(email, emailInvalid);
    setInvalid(password, passwordInvalid);

    if (emailInvalid || passwordInvalid) {
      event.preventDefault();
      showMessage('warning', 'Confira o e-mail e a senha antes de continuar.');
      return;
    }

    // Dados preenchidos: o formulário segue para o servidor (POST /login).
    form.querySelector('button[type="submit"]').disabled = true;
    showMessage('info', 'Verificando acesso...');
  });
})();
