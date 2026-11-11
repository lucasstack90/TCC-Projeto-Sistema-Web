@extends('layouts.app')

@section('title', 'Entrar | PAWSAFE')
@section('body_class', 'login-page')

@push('css')
  <link rel="stylesheet" href="{{ asset('css/login.css') }}">
@endpush

@section('content')
@verbatim
  <main class="login-layout">
    <section class="login-card" aria-labelledby="loginTitle">
      <div class="login-panel">
        <a class="login-brand" href="./" aria-label="PAWSAFE - página inicial">
          <span class="brand-mark"><i class="bi bi-heart-pulse-fill"></i></span>
          <span><strong>PAWSAFE</strong><small>Gestão e proteção animal</small></span>
        </a>

        <div class="login-heading">
          <span class="welcome-tag"><i class="bi bi-shield-check"></i> Acesso seguro</span>
          <h1 id="loginTitle">Bem-vindo de volta!</h1>
          <p>Entre na sua conta para continuar cuidando de quem mais precisa.</p>
        </div>

        <form id="loginForm" method="POST" action="login" novalidate>
@endverbatim
          @csrf
@verbatim
          <div class="mb-3">
            <label for="email" class="form-label">E-mail (Gmail)</label>
            <div class="input-wrap">
              <i class="bi bi-envelope" aria-hidden="true"></i>
@endverbatim
              <input class="form-control" id="email" name="email" type="email" value="{{ old('email') }}" placeholder="seunome@gmail.com" autocomplete="username" required>
@verbatim
            </div>
            <div class="invalid-feedback" id="emailError">Informe um endereço de e-mail válido.</div>
          </div>

          <div class="mb-2">
            <label for="password" class="form-label">Senha</label>
            <div class="input-wrap password-wrap">
              <i class="bi bi-lock" aria-hidden="true"></i>
              <input class="form-control" id="password" name="password" type="password" placeholder="Mínimo de 6 caracteres" autocomplete="current-password" required minlength="6">
              <button class="password-toggle" id="togglePassword" type="button" aria-label="Mostrar senha" aria-pressed="false"><i class="bi bi-eye"></i></button>
            </div>
            <div class="invalid-feedback" id="passwordError">A senha deve ter pelo menos 6 caracteres.</div>
          </div>

          <div class="login-options">
            <label class="remember-option"><input type="checkbox" id="rememberMe" name="remember" value="1"><span class="custom-check"><i class="bi bi-check"></i></span>Manter conectado</label>
            <a href="#ajuda" id="helpLink">Precisa de ajuda?</a>
          </div>

@endverbatim
          @if ($errors->any())
            <div class="alert alert-danger login-alert" id="loginMessage" role="alert">{{ $errors->first() }}</div>
          @else
            <div class="alert login-alert d-none" id="loginMessage" role="alert"></div>
          @endif
@verbatim
          <button class="btn-login" type="submit"><span>Entrar no sistema</span><i class="bi bi-arrow-right"></i></button>
          <p class="login-note"><i class="bi bi-shield-lock"></i> Seus dados devem ser mantidos em segurança.</p>
        </form>

        <div class="login-footer"><span>© <span id="year"></span> PAWSAFE</span><span>Feito para proteger vidas</span></div>
      </div>

      <aside class="visual-panel" aria-label="Ilustração abstrata inspirada em cuidado e proteção animal">
        <div class="visual-orb orb-one"></div><div class="visual-orb orb-two"></div>
        <div class="wave wave-back"></div><div class="wave wave-middle"></div><div class="wave wave-front"></div>
        <div class="visual-content">
          <span class="visual-icon"><i class="bi bi-heart-pulse-fill"></i></span>
          <p class="visual-kicker">Cuidado que transforma</p>
          <h2>Cada vida merece<br>uma nova chance.</h2>
          <p class="visual-description">Organize resgates, acompanhe tratamentos e ajude mais animais a encontrarem um lar seguro.</p>
          <div class="visual-pill"><span></span> Juntos pela proteção animal</div>
        </div>
        <div class="visual-bottom-mark"><i class="bi bi-paw-fill"></i><span>PAWSAFE <small>Proteção • Cuidado • Adoção</small></span></div>
      </aside>
    </section>
    <p class="outside-caption">Plataforma de gestão para organizações de proteção animal</p>
  </main>
@endverbatim
@endsection

@push('scripts')
<script src="{{ asset('js/tema.js') }}"></script>
<script src="{{ asset('js/login.js') }}"></script>
@endpush
