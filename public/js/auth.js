/* PAWSAFE — sessão e permissões na interface.

   O servidor é quem decide o que cada perfil pode fazer (app/Core/Permissoes.php)
   e devolve a lista de permissões no login. Este arquivo guarda essa lista
   enquanto a aba estiver aberta (sessionStorage) e:
     - bloqueia páginas internas para quem não está logado ou não tem acesso;
     - marca o <html> com classes "perfil-x", "pagina-x" e "sem-<permissão>",
       usadas pelo CSS para esconder botões (ex.: html.sem-animais-cadastrar);
     - esconde elementos com data-requer="permissão" quando ela falta, e mostra
       avisos com data-sem="permissão" justamente quando ela falta.

   Atenção: esconder na tela é só conforto. A proteção de verdade está no
   servidor, que recusa (403) qualquer ação fora do perfil.

   PawAuth.usuario()      { id, nome, email, perfil, perfilRotulo } ou null
   PawAuth.pode('x')      true/false
   PawAuth.salvar(dados)  chamado pelo login com a resposta do servidor
   PawAuth.sair()         encerra a sessão no servidor e volta ao login
   Carregar depois de js/api.js e antes de js/sidebar.js. */

const PawAuth = (() => {
  const CHAVE = 'pawsafe_sessao';

  // Páginas internas: id -> arquivo (o dashboard é o index.html da raiz de public/).
  const PAGINAS = ['dashboard', 'animais', 'adocoes', 'resgates', 'voluntarios', 'doacoes', 'estoque', 'relatorios', 'cadastros'];

  const emPages = /\/Pages\//i.test(window.location.pathname);
  const arquivo = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase().replace('.html', '');
  const paginaAtual = arquivo === 'index' || arquivo === '' ? 'dashboard' : arquivo;
  const ehInterna = PAGINAS.includes(paginaAtual);

  const hrefPagina = (id) => (id === 'dashboard' ? (emPages ? '../index.html' : 'index.html') : `${emPages ? '' : 'Pages/'}${id}.html`);
  const hrefLogin = () => `${emPages ? '' : 'Pages/'}Pg_Login.html`;

  let dados = ler();

  function ler() {
    try { return JSON.parse(sessionStorage.getItem(CHAVE)); } catch (_) { return null; }
  }

  const usuario = () => dados?.usuario || null;
  const pode = (permissao) => Boolean(dados?.permissoes?.includes(permissao));
  const podePagina = (id) => pode(`pagina.${id}`);
  // Primeira página que o perfil pode abrir (destino depois do login ou de um bloqueio).
  const paginaInicial = () => hrefPagina(PAGINAS.find(podePagina) || 'dashboard');

  function salvar(resposta) {
    // "todas" vem do servidor (app/Core/Permissoes.php): é a lista usada para marcar o que falta.
    dados = { usuario: resposta.usuario, permissoes: resposta.permissoes || [], todas: resposta.todas || [] };
    try { sessionStorage.setItem(CHAVE, JSON.stringify(dados)); } catch (_) { /* aba privada etc. */ }
    if (resposta.csrf && typeof Api !== 'undefined') Api.definirCsrf(resposta.csrf);
    aplicar();
  }

  function limpar() {
    dados = null;
    try { sessionStorage.removeItem(CHAVE); } catch (_) { /* nada */ }
  }

  // Classes no <html> para o CSS e data-requer para o HTML estático.
  function aplicar() {
    const raiz = document.documentElement;
    [...raiz.classList].filter(c => /^(perfil|sem)-/.test(c)).forEach(c => raiz.classList.remove(c));
    raiz.classList.add(`pagina-${paginaAtual}`);
    if (!dados) return;
    raiz.classList.add(`perfil-${dados.usuario.perfil}`);
    (dados.todas || []).filter(p => !pode(p)).forEach(p => raiz.classList.add(`sem-${p.replace('.', '-')}`));
    document.querySelectorAll('[data-requer]').forEach(el => { el.hidden = !pode(el.dataset.requer); });
    // data-sem="x": aparece só quando o perfil NÃO tem x (avisos do modo de cada perfil).
    document.querySelectorAll('[data-sem]').forEach(el => { el.hidden = pode(el.dataset.sem); });
  }

  async function sair() {
    try { if (typeof Api !== 'undefined') await Api.post('/auth/logout'); } catch (_) { /* sai mesmo assim */ }
    limpar();
    window.location.href = hrefLogin();
  }

  // ---------- Guarda das páginas internas ----------
  if (ehInterna) {
    if (!usuario()) {
      window.location.replace(hrefLogin());
    } else if (!podePagina(paginaAtual)) {
      window.location.replace(paginaInicial());
    } else {
      aplicar();
      document.addEventListener('DOMContentLoaded', aplicar);
      // Confere com o servidor: perfil trocado ou conta desativada valem na hora.
      if (typeof Api !== 'undefined') {
        Api.get('/auth/eu').then((resposta) => {
          salvar(resposta);
          if (!podePagina(paginaAtual)) window.location.replace(paginaInicial());
          // A tela de Animais carrega do servidor sozinha; nas outras, atualiza a cópia
          // local (Dashboard, Adoções, Resgates... ainda leem dela) para a próxima abertura.
          if (paginaAtual !== 'animais' && pode('pagina.animais') && typeof PawData !== 'undefined') {
            PawData.syncAnimalsFromServer().catch(() => { /* segue com a cópia */ });
          }
          // Adotantes (dados pessoais): só para quem tem acesso; a tela de Adoções carrega sozinha.
          if (paginaAtual !== 'adocoes' && pode('adotantes.gerenciar') && typeof PawData !== 'undefined') {
            PawData.syncAdoptersFromServer().catch(() => { /* segue com a cópia */ });
          }
          // Perfil sem acesso a adotantes (LGPD): não deixa neste navegador a cópia
          // que outro usuário trouxe do servidor (computador compartilhado).
          if (!pode('adotantes.gerenciar') && typeof PawData !== 'undefined') {
            PawData.forgetServerAdopters();
          }
          document.dispatchEvent(new CustomEvent('pawsafe:sessao', { detail: usuario() }));
        }).catch((erro) => {
          // Sem resposta (servidor desligado) mantém a tela; sessão inválida volta ao login.
          if (erro.status === 401) { limpar(); window.location.replace(hrefLogin()); }
        });
      }
    }
  }

  return { usuario, pode, podePagina, salvar, limpar, sair, paginaInicial, hrefPagina, aplicar, PAGINAS };
})();
