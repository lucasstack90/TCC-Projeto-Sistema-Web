/* PAWSAFE — tema claro/escuro.
   - A classe "dark" no <html> é aplicada já no <head> (script inline), para não piscar.
   - Este arquivo cuida do botão, salva a escolha no localStorage e
     atualiza os gráficos (Chart.js) quando o tema muda.
   Carregar antes dos scripts das páginas (dashboard.js, doacoes.js, relatorios.js). */
(() => {
  const CHAVE = 'tema';
  const raiz = document.documentElement;
  const meta = document.querySelector('meta[name="theme-color"]');

  // Converte qualquer cor CSS (hsl com "/", var resolvida etc.) para #hex ou rgba(),
  // formato que o Chart.js entende.
  const ctx = document.createElement('canvas').getContext('2d');
  const normalizar = (valor) => {
    if (!valor) return valor;
    ctx.fillStyle = '#000';
    ctx.fillStyle = valor;
    return ctx.fillStyle;
  };
  const cor = (token) => normalizar(getComputedStyle(raiz).getPropertyValue(token).trim());

  const escuro = () => raiz.classList.contains('dark');

  const salvar = (valor) => { try { localStorage.setItem(CHAVE, valor); } catch (e) { /* sem storage: só não lembra */ } };
  const lerSalvo = () => { try { return localStorage.getItem(CHAVE); } catch (e) { return null; } };

  function atualizarBotoes() {
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
      btn.setAttribute('aria-pressed', String(escuro()));
      const rotulo = btn.querySelector('.theme-label');
      if (rotulo) rotulo.textContent = escuro() ? 'Tema claro' : 'Tema escuro';
    });
  }

  // Reaplica nos gráficos já desenhados as cores que vêm dos tokens.
  function atualizarGraficos() {
    if (typeof Chart === 'undefined') return;
    const texto = cor('--chart-text');
    Chart.defaults.color = texto;
    Object.values(Chart.instances || {}).forEach(grafico => {
      const op = grafico.options;
      Object.values(op.scales || {}).forEach(eixo => {
        if (eixo.grid && eixo.grid.display !== false) eixo.grid.color = cor('--chart-grid');
        if (eixo.ticks) eixo.ticks.color = texto;
      });
      if (op.plugins?.legend?.labels) op.plugins.legend.labels.color = texto;
      if (op.plugins?.tooltip) op.plugins.tooltip.backgroundColor = cor('--chart-tooltip');
      grafico.data.datasets.forEach(ds => {
        // ds.tokens: { backgroundColor: '--chart-1' } ou { backgroundColor: ['--chart-1', ...] }
        Object.entries(ds.tokens || {}).forEach(([prop, t]) => {
          ds[prop] = Array.isArray(t) ? t.map(cor) : cor(t);
        });
      });
      grafico.update('none');
    });
  }

  function aplicar(modoEscuro, guardar = true) {
    raiz.classList.toggle('dark', modoEscuro);
    raiz.setAttribute('data-bs-theme', modoEscuro ? 'dark' : 'light');
    if (meta) meta.setAttribute('content', modoEscuro ? '#0f1512' : '#244438');
    if (guardar) salvar(modoEscuro ? 'escuro' : 'claro');
    atualizarBotoes();
    atualizarGraficos();
  }

  // Clique em qualquer botão com data-theme-toggle (o da barra lateral é criado pelo sidebar.js).
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-theme-toggle]')) aplicar(!escuro());
  });

  // Sem preferência salva, acompanha o sistema operacional.
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener?.('change', (e) => { if (!lerSalvo()) aplicar(e.matches, false); });

  // Páginas sem barra lateral (login, cadastro público) ganham um botão flutuante.
  document.addEventListener('DOMContentLoaded', () => {
    if (!document.querySelector('[data-theme-toggle]')) {
      document.body.insertAdjacentHTML('beforeend',
        `<button class="theme-toggle is-floating" type="button" data-theme-toggle aria-label="Alternar tema claro/escuro">
          <i class="bi bi-moon-stars icon-lua" aria-hidden="true"></i><i class="bi bi-sun icon-sol" aria-hidden="true"></i>
          <span class="theme-label"></span></button>`);
    }
    aplicar(escuro(), false);
  });

  window.PawTema = { cor, escuro, aplicar };
})();
