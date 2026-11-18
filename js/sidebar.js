/* PAWSAFE — navegação lateral compartilhada por todas as páginas internas.
   Uso: <div id="sidebarMount"></div> + botão mobile com id="menuToggle". */
(() => {
  const mount = document.getElementById('sidebarMount');
  if (!mount) return;

  const inPages = /\/Pages\//i.test(window.location.pathname);
  const base = inPages ? '' : 'Pages/';
  const home = inPages ? '../index.html' : 'index.html';
  const currentPage = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase().replace('.html', '');
  const activeModule = currentPage === 'index' ? 'dashboard' : currentPage;

  // Contadores do menu (js/dados.js precisa ser carregado antes deste arquivo).
  const hasData = typeof PawData !== 'undefined';
  const animalCount = hasData ? PawData.loadAnimals().length : '';
  const openRescues = hasData ? PawData.loadRescues().filter(r => PawData.OPEN_RESCUE_STAGES.includes(r.stage)).length : 0;
  // Itens em falta ou abaixo do estoque mínimo
  const stockToRestock = hasData && PawData.stockAlerts
    ? PawData.stockAlerts(PawData.loadStockItems(), PawData.loadStockMoves()).restock.length : 0;
  const pendingVolunteers = hasData ? PawData.loadVolunteers().filter(v => v.status === 'Interessado').length : 0;

  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: 'bi-grid-1x2-fill', href: home },
    { id: 'animais', label: 'Animais', icon: 'bi-paw', href: `${base}animais.html`, count: animalCount },
    { id: 'adocoes', label: 'Adoções', icon: 'bi-heart', href: `${base}adocoes.html` },
    { id: 'resgates', label: 'Resgates', icon: 'bi-house-heart', href: `${base}resgates.html`, count: openRescues, alert: true },
    { id: 'voluntarios', label: 'Voluntários & Equipe', icon: 'bi-people', href: `${base}voluntarios.html`, count: pendingVolunteers, alert: true },
    { id: 'doacoes', label: 'Doações / Financeiro', icon: 'bi-cash-coin', href: `${base}doacoes.html` },
    { id: 'estoque', label: 'Estoque', icon: 'bi-box-seam', href: `${base}estoque.html`, count: stockToRestock, alert: true },
    { id: 'relatorios', label: 'Relatório técnico', icon: 'bi-file-earmark-bar-graph', href: `${base}relatorios.html` }
  ];

  const navLinks = items.map(item => {
    const active = item.id === activeModule;
    // "alert": contador de pendências, em destaque e escondido quando é zero
    const hidden = item.alert && !item.count ? ' d-none' : '';
    const count = item.count !== undefined
      ? `<span class="sidebar-count${item.alert ? ' is-alert' : ''}${hidden}" data-count="${item.id}">${item.count}</span>` : '';
    return `<a class="nav-link${active ? ' active' : ''}" href="${item.href}" title="${item.label}"${active ? ' aria-current="page"' : ''}>
      <i class="bi ${item.icon}"></i><span>${item.label}</span>${count}</a>`;
  }).join('');

  mount.innerHTML = `
    <aside class="sidebar" id="sidebar" aria-label="Menu principal">
      <a class="brand" href="${home}" aria-label="PAWSAFE página inicial">
        <span class="brand-mark"><svg class="paw-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="currentColor"><ellipse cx="9.1" cy="6.6" rx="2" ry="2.6" transform="rotate(-10 9.1 6.6)"/><ellipse cx="14.9" cy="6.6" rx="2" ry="2.6" transform="rotate(10 14.9 6.6)"/><ellipse cx="4.9" cy="11.2" rx="1.8" ry="2.3" transform="rotate(-30 4.9 11.2)"/><ellipse cx="19.1" cy="11.2" rx="1.8" ry="2.3" transform="rotate(30 19.1 11.2)"/><path d="M12 12.4c-2.8 0-5.6 3.1-5.6 5.7 0 1.6 1.2 2.6 2.6 2.6 1.3 0 2-.7 3-.7s1.7.7 3 .7c1.4 0 2.6-1 2.6-2.6 0-2.6-2.8-5.7-5.6-5.7z"/></g></svg></span>
        <span class="brand-copy"><strong>PAWSAFE</strong><small>Gestão e proteção animal</small></span>
      </a>
      <div class="sidebar-label">Menu</div>
      <nav class="nav flex-column sidebar-nav">${navLinks}</nav>
      <div class="sidebar-bottom">
        <div class="sidebar-label">Geral</div>
        <button class="theme-toggle" type="button" data-theme-toggle aria-label="Alternar tema claro/escuro" aria-pressed="false"><i class="bi bi-moon-stars icon-lua" aria-hidden="true"></i><i class="bi bi-sun icon-sol" aria-hidden="true"></i><span class="theme-label">Tema escuro</span></button>
        <button class="nav-link logout-link" type="button" id="logoutButton"><i class="bi bi-box-arrow-left"></i><span>Sair</span></button>
      </div>
      <div class="sidebar-promo">
        <span class="promo-icon"><i class="bi bi-people-fill"></i></span>
        <strong>Seja voluntário</strong>
        <p>Compartilhe o formulário público de inscrição.</p>
        <a class="volunteer-link" href="${base}voluntario-cadastro.html" target="_blank" rel="noopener" title="Formulário público de inscrição">Abrir formulário <i class="bi bi-arrow-up-right"></i></a>
      </div>
    </aside>
    <div class="sidebar-backdrop" id="sidebarBackdrop"></div>`;

  // ---------- Cabeçalho do app: busca de módulos, avisos e usuário ----------
  const main = document.querySelector('.main-content');
  const avisos = [
    { n: openRescues, id: 'resgates', icon: 'bi-house-heart', texto: (n) => PawPlural(n, 'resgate em aberto', 'resgates em aberto'), dica: 'Pendentes ou em atendimento' },
    { n: pendingVolunteers, id: 'voluntarios', icon: 'bi-person-plus', texto: (n) => PawPlural(n, 'voluntário aguardando', 'voluntários aguardando'), dica: 'Inscrições para aprovar' },
    { n: stockToRestock, id: 'estoque', icon: 'bi-box-seam', texto: (n) => PawPlural(n, 'item para repor', 'itens para repor'), dica: 'Abaixo do mínimo ou em falta' }
  ].filter(a => a.n && items.some(item => item.id === a.id));

  if (main) {
    const header = document.createElement('header');
    header.className = 'app-header';
    header.innerHTML = `
      <div class="app-search" role="search">
        <i class="bi bi-search" aria-hidden="true"></i>
        <input type="search" id="appSearch" placeholder="Buscar módulo" autocomplete="off" aria-label="Buscar módulo" aria-controls="appSearchResults" aria-expanded="false">
        <kbd>Ctrl K</kbd>
        <ul class="app-search-results" id="appSearchResults" role="listbox"></ul>
      </div>
      <div class="app-header-actions">
        <div class="notify-wrap">
          <button class="icon-circle" type="button" id="notifyButton" aria-label="Avisos (${avisos.length})" aria-expanded="false" aria-controls="notifyPanel">
            <i class="bi bi-bell"></i>${avisos.length ? '<span class="dot"></span>' : ''}
          </button>
          <div class="notify-panel" id="notifyPanel">
            <h3>Avisos</h3>
            ${avisos.length ? avisos.map(a => `<a href="${items.find(i => i.id === a.id).href}"><i class="bi ${a.icon}"></i><span><strong>${a.texto(a.n)}</strong><small>${a.dica}</small></span></a>`).join('')
              : '<p class="is-empty mb-0">Nada pendente por aqui.</p>'}
          </div>
        </div>
        <div class="app-user">
          <!-- Usuário de demonstração do protótipo (o login ainda é simulado). -->
          <div class="avatar" id="profileAvatar" aria-hidden="true">RO</div>
          <div class="app-user-text"><strong id="profileName">Renata Oliveira</strong><small id="profileRole">Administradora</small></div>
        </div>
      </div>`;
    main.prepend(header);
    // O botão do menu no celular (de cada página) passa para o cabeçalho.
    const menuBtn = document.getElementById('menuToggle');
    if (menuBtn) header.prepend(menuBtn);
    ligarBusca();
    ligarAvisos();
  }

  function PawPlural(n, um, varios) { return `${n} ${n === 1 ? um : varios}`; }

  function ligarBusca() {
    const input = document.getElementById('appSearch');
    const box = input.closest('.app-search');
    const lista = document.getElementById('appSearchResults');
    const semAcento = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    let ativo = 0;
    let achados = [];

    const abrir = (aberto) => { box.classList.toggle('is-open', aberto); input.setAttribute('aria-expanded', String(aberto)); };
    const desenhar = () => {
      const termo = semAcento(input.value.trim());
      achados = items.filter(i => semAcento(i.label).includes(termo));
      ativo = Math.min(ativo, Math.max(achados.length - 1, 0));
      lista.innerHTML = achados.length
        ? achados.map((i, n) => `<li role="option" aria-selected="${n === ativo}"><a href="${i.href}" class="${n === ativo ? 'is-active' : ''}"><i class="bi ${i.icon}"></i>${i.label}${i.id === activeModule ? '<small>aberto</small>' : ''}</a></li>`).join('')
        : '<li class="is-empty">Nenhum módulo encontrado.</li>';
      abrir(true);
    };

    input.addEventListener('focus', desenhar);
    input.addEventListener('input', () => { ativo = 0; desenhar(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!achados.length) return;
        ativo = (ativo + (e.key === 'ArrowDown' ? 1 : -1) + achados.length) % achados.length;
        desenhar();
      } else if (e.key === 'Enter' && achados[ativo]) {
        window.location.href = achados[ativo].href;
      } else if (e.key === 'Escape') {
        input.blur(); abrir(false);
      }
    });
    document.addEventListener('click', (e) => { if (!box.contains(e.target)) abrir(false); });
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.focus(); input.select(); }
    });
  }

  function ligarAvisos() {
    const wrap = document.querySelector('.notify-wrap');
    const btn = document.getElementById('notifyButton');
    const abrir = (aberto) => { wrap.classList.toggle('is-open', aberto); btn.setAttribute('aria-expanded', String(aberto)); };
    btn.addEventListener('click', (e) => { e.stopPropagation(); abrir(!wrap.classList.contains('is-open')); });
    document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) abrir(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') abrir(false); });
  }

  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  const toggle = document.getElementById('menuToggle');

  const setMenu = (open) => {
    sidebar.classList.toggle('is-open', open);
    backdrop.classList.toggle('is-visible', open);
    toggle?.setAttribute('aria-expanded', String(open));
  };

  toggle?.addEventListener('click', () => setMenu(!sidebar.classList.contains('is-open')));
  backdrop.addEventListener('click', () => setMenu(false));
  sidebar.querySelectorAll('a.nav-link').forEach(link => link.addEventListener('click', () => {
    if (window.innerWidth <= 900) setMenu(false);
  }));
  window.addEventListener('resize', () => { if (window.innerWidth > 900) setMenu(false); });

  // Sair volta para a tela de login (o login do protótipo é simulado).
  document.getElementById('logoutButton').addEventListener('click', () => {
    if (window.confirm('Deseja sair do PAWSAFE?')) window.location.href = `${base}Pg_Login.html`;
  });
})();
