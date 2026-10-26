# PAWSAFE — Front-end (protótipo)

Sistema web para gestão de ONGs e grupos de proteção animal — TCC do Técnico em Desenvolvimento de Sistemas (C. E. Ana Vanda Bassara).
Front-end em HTML, CSS, JavaScript, Bootstrap 5 e Chart.js. O back-end previsto é PHP/Laravel com MySQL.

## Estrutura

```text
PAWSAFE/
├── CSS/
│   ├── base.css        # cores, fontes, botões, formulários, status e ícone de pata (todas as páginas)
│   ├── sidebar.css     # menu lateral (único lugar com estilos do menu)
│   ├── dashboard.css   # index.html
│   ├── animais.css     # Pages/animais.html
│   └── login.css       # Pages/Pg_Login.html
├── Img/
├── js/
│   ├── dados.js        # fonte única de dados (localStorage) — carregar antes dos outros
│   ├── sidebar.js      # menu lateral, contador de animais e botão Sair
│   ├── dashboard.js
│   ├── animais.js
│   └── login.js
├── Pages/
│   ├── Pg_Login.html
│   └── animais.html
└── index.html          # dashboard
```

## Executar

Abra a pasta no VS Code e rode `Pages/Pg_Login.html` (ou `index.html`) com o Live Server. É preciso internet para Bootstrap, Chart.js, fontes e fotos de exemplo.

## Como os dados funcionam no protótipo

- Os animais ficam no `localStorage` do navegador (`js/dados.js`). Dashboard, menu e módulo de Animais leem a mesma fonte.
- Para voltar aos dados de exemplo: no console do navegador, rode `PawData.resetAnimals()` e recarregue a página.
- Os indicadores de resgates, voluntários, doações e o gráfico de adoções por mês são ilustrativos até esses módulos existirem.

## Nova página do sistema

Para manter o padrão nas páginas de `Pages/`:

1. No `<head>`, nesta ordem: Bootstrap, Bootstrap Icons, fontes, `../CSS/base.css`, `../CSS/sidebar.css` e o CSS da página.
2. No `<body>`: `<div id="sidebarMount"></div>` e `<main class="main-content">` com o cabeçalho `<header class="topbar">` (botão `class="mobile-menu" id="menuToggle"` + `<div class="topbar-title">`).
3. Antes do JS da página: `<script src="../js/dados.js"></script>` e `<script src="../js/sidebar.js"></script>`.

Páginas do menu ainda não criadas: `adocoes.html`, `resgates.html`, `voluntarios.html`, `doacoes.html`, `estoque.html`, `relatorios.html`.

## Padrão do CSS

- Cores, fontes e espaçamentos são variáveis no topo do `base.css` (`--green-700`, `--border`, `--font-title`...). Mude ali para alterar o sistema inteiro.
- As cores de status (`status-disponivel`, `status-adotado`...) são as mesmas no dashboard e em Animais. O nome da classe vem de `PawData.statusClass()` em `js/dados.js`.
- Cada página tem um CSS só com o que é dela; nada de repetir menu, botões ou formulários.
