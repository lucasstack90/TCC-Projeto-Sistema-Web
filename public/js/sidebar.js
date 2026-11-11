/* PAWSAFE — navegação lateral compartilhada por todas as páginas internas.
   Uso: <div id="sidebarMount"></div> + botão mobile com id="menuToggle".
   O usuário logado, o perfil e o endereço base vêm do Laravel em window.PAWSAFE. */
(() => {
  const mount = document.getElementById('sidebarMount');
  if (!mount) return;

  const boot = window.PAWSAFE || {};
  const root = (boot.baseUrl || window.location.origin).replace(/\/$/, '');
  const base = `${root}/`;
  const home = base;
  // Página atual = caminho depois da raiz do sistema ("" = dashboard).
  const currentPage = window.location.href.split(/[?#]/)[0].slice(base.length).split('/')[0].toLowerCase();
  const activeModule = currentPage === '' ? 'dashboard' : currentPage;

  const user = boot.user || { name: 'Usuário', perfil: 'voluntario', perfilLabel: 'Voluntário(a)' };
  const isStaff = user.perfil === 'funcionario';
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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
    { id: 'animais', label: 'Animais', icon: 'bi-paw', href: `${base}animais`, count: animalCount },
    { id: 'adocoes', label: 'Adoções', icon: 'bi-heart', href: `${base}adocoes` },
    { id: 'resgates', label: 'Resgates', icon: 'bi-house-heart', href: `${base}resgates`, count: openRescues, alert: true },
    { id: 'voluntarios', label: 'Voluntários & Equipe', icon: 'bi-people', href: `${base}voluntarios`, count: pendingVolunteers, alert: true, staff: true },
    { id: 'doacoes', label: 'Doações / Financeiro', icon: 'bi-cash-coin', href: `${base}doacoes`, staff: true },
    { id: 'estoque', label: 'Estoque', icon: 'bi-box-seam', href: `${base}estoque`, count: stockToRestock, alert: true },
    { id: 'relatorios', label: 'Relatório técnico', icon: 'bi-file-earmark-bar-graph', href: `${base}relatorios`, staff: true }
  ].filter(item => isStaff || !item.staff); // voluntários têm acesso limitado (rotas protegidas no Laravel)

  const navLinks = items.map(item => {
    const active = item.id === activeModule;
    // "alert": contador de pendências, em destaque e escondido quando é zero
    const hidden = item.alert && !item.count ? ' d-none' : '';
    const count = item.count !== undefined
      ? `<span class="sidebar-count${item.alert ? ' is-alert' : ''}${hidden}" data-count="${item.id}">${item.count}</span>` : '';
    return `<a class="nav-link${active ? ' active' : ''}" href="${item.href}"${active ? ' aria-current="page"' : ''}>
      <i class="bi ${item.icon}"></i><span>${item.label}</span>${count}</a>`;
  }).join('');

  mount.innerHTML = `
    <aside class="sidebar" id="sidebar" aria-label="Menu principal">
      <a class="brand" href="${home}" aria-label="PAWSAFE página inicial">
        <span class="brand-mark"><i class="bi bi-heart-pulse-fill"></i></span>
        <span class="brand-copy"><strong>PAWSAFE</strong><small>Gestão e proteção animal</small></span>
      </a>
      <div class="sidebar-label">MENU PRINCIPAL</div>
      <nav class="nav flex-column sidebar-nav">${navLinks}</nav>
      <div class="sidebar-bottom">
        <a class="nav-link volunteer-link" href="${base}voluntario-cadastro" target="_blank" rel="noopener" title="Formulário público de inscrição"><i class="bi bi-box-arrow-up-right"></i><span>Link de voluntariado</span></a>
        <button class="theme-toggle" type="button" data-theme-toggle aria-label="Alternar tema claro/escuro" aria-pressed="false"><i class="bi bi-moon-stars icon-lua" aria-hidden="true"></i><i class="bi bi-sun icon-sol" aria-hidden="true"></i><span class="theme-label">Tema escuro</span></button>
        <button class="nav-link logout-link" type="button" id="logoutButton"><i class="bi bi-box-arrow-left"></i><span>Sair</span></button>
        <div class="profile-mini">
          <div class="avatar"><i class="bi bi-person-fill"></i></div>
          <div class="profile-text"><strong>${escape(user.name)}</strong><small>${escape(user.perfilLabel)}</small></div>
        </div>
      </div>
    </aside>
    <div class="sidebar-backdrop" id="sidebarBackdrop"></div>`;

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

  // Sair: POST /logout com o token CSRF (o Laravel encerra a sessão).
  document.getElementById('logoutButton').addEventListener('click', () => {
    if (!window.confirm('Deseja sair do PAWSAFE?')) return;
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = `${base}logout`;
    const token = document.createElement('input');
    token.type = 'hidden';
    token.name = '_token';
    token.value = document.querySelector('meta[name="csrf-token"]')?.content || boot.csrf || '';
    form.appendChild(token);
    document.body.appendChild(form);
    form.submit();
  });
})();
