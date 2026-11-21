/* PAWSAFE — ajudante de acesso à API (back-end PHP).
 *
 * É o jeito oficial de as páginas falarem com o servidor. Cuida de:
 *   - montar a URL base (funciona na raiz ou numa subpasta do XAMPP);
 *   - enviar e receber JSON;
 *   - guardar e reenviar o token CSRF nas gravações (POST/PUT/DELETE);
 *   - padronizar o tratamento de erro (lança Error com .campos quando houver).
 *
 * Uso:
 *   const lista = await Api.get('/animais');
 *   const novo  = await Api.post('/animais', { name: 'Rex', species: 'Cão', status: 'Disponível' });
 *   await Api.put('/animais/' + id, dados);
 *   await Api.del('/animais/' + id);
 *
 * Em caso de erro de validação (422), o Error tem .campos = { campo: mensagem }.
 */
const Api = (() => {
  // Descobre o prefixo base a partir do próprio endereço da página.
  // Ex.: em /pawsafe/public/Pages/animais.html, a base da API é /pawsafe/public.
  const BASE = (() => {
    const p = window.location.pathname;
    const corte = p.indexOf('/Pages/');
    if (corte !== -1) return p.slice(0, corte);          // páginas internas
    return p.replace(/\/[^/]*$/, '');                     // dashboard na raiz do site
  })();

  let csrf = null;

  const url = (rota) => `${BASE}/api${rota.startsWith('/') ? '' : '/'}${rota}`;

  async function garantirCsrf() {
    if (csrf) return csrf;
    const r = await fetch(url('/csrf'), { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
    const j = await r.json();
    csrf = j?.dados?.csrf || null;
    return csrf;
  }

  async function pedir(metodo, rota, corpo) {
    const opcoes = {
      method: metodo,
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    };

    if (corpo !== undefined) {
      opcoes.headers['Content-Type'] = 'application/json';
      opcoes.body = JSON.stringify(corpo);
    }
    if (!['GET', 'HEAD'].includes(metodo)) {
      opcoes.headers['X-CSRF-Token'] = await garantirCsrf();
    }

    const resp = await fetch(url(rota), opcoes);
    let json = null;
    try { json = await resp.json(); } catch (_) { /* resposta sem corpo */ }

    if (!resp.ok || (json && json.ok === false)) {
      const erro = new Error(json?.erro || `Erro ${resp.status}`);
      erro.status = resp.status;
      erro.campos = json?.campos || null;
      // Sessão expirou: manda para o login.
      if (resp.status === 401 && !window.location.pathname.endsWith('Pg_Login.html')) {
        erro.sessaoExpirada = true;
      }
      throw erro;
    }
    return json ? json.dados : null;
  }

  return {
    base: BASE,
    get:  (rota) => pedir('GET', rota),
    post: (rota, corpo) => pedir('POST', rota, corpo ?? {}),
    put:  (rota, corpo) => pedir('PUT', rota, corpo ?? {}),
    patch: (rota, corpo) => pedir('PATCH', rota, corpo ?? {}),
    del:  (rota) => pedir('DELETE', rota),
    garantirCsrf,
    // Após o login, o servidor já devolve o token; guarde-o para evitar uma ida extra.
    definirCsrf: (token) => { csrf = token || csrf; },
  };
})();
