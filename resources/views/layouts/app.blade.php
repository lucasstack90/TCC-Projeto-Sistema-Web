<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#244438">
  <meta name="csrf-token" content="{{ csrf_token() }}">
  {{-- Links relativos do JS (ex.: "resgates?resgate=4") partem da raiz do sistema,
       mesmo quando o Laravel roda numa subpasta do XAMPP (localhost/pawsafe/public). --}}
  <base href="{{ url('/') }}/">
  <script>
    /* Aplica o tema salvo antes de desenhar a página (evita piscar o tema claro). */
    try {
      const t = localStorage.getItem('tema');
      const escuro = t ? t === 'escuro' : matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', escuro);
      document.documentElement.setAttribute('data-bs-theme', escuro ? 'dark' : 'light');
    } catch (e) {}
  </script>
  <title>@yield('title', 'PAWSAFE')</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="{{ asset('css/tema.css') }}">
  <link rel="stylesheet" href="{{ asset('css/base.css') }}">
@stack('css')
</head>
<body class="@yield('body_class')">
@yield('content')

{{-- Dados que o servidor entrega para o JavaScript (só para usuário logado).
     Montados em App\Providers\AppServiceProvider. --}}
<script>window.PAWSAFE = @json($pawsafe ?? null);</script>
@stack('scripts')
</body>
</html>
