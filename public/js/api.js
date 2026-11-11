/* PAWSAFE — comunicação com o back-end (Laravel).
   Todas as chamadas usam a sessão do login e o token CSRF que o Laravel coloca na página.
   Uso:
     const animal = await PawApi.post('api/animais', formData);
     await PawApi.del(`api/animais/${id}`);
   Em caso de erro, lança PawApi.Erro com uma mensagem pronta para mostrar ao usuário. */
const PawApi = (() => {
  const base = (window.PAWSAFE?.baseUrl || '').replace(/\/$/, '');
  const csrf = () => document.querySelector('meta[name="csrf-token"]')?.content || window.PAWSAFE?.csrf || '';

  class Erro extends Error {
    constructor(message, status, fields = {}) {
      super(message);
      this.status = status;
      this.fields = fields; // erros de validação por campo (status 422)
    }
  }

  async function request(method, path, body = null) {
    const isForm = body instanceof FormData;
    const options = {
      method,
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrf(), 'X-Requested-With': 'XMLHttpRequest' }
    };

    if (body !== null) {
      if (isForm) {
        options.body = body; // o navegador define o Content-Type com o boundary
      } else {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
      }
    }

    let response;
    try {
      response = await fetch(`${base}/${path.replace(/^\//, '')}`, options);
    } catch (error) {
      throw new Erro('Sem conexão com o servidor. Verifique se o Laravel e o MySQL (XAMPP) estão rodando.', 0);
    }

    if (response.status === 204) return null;

    const data = await response.json().catch(() => null);
    if (response.ok) return data;

    // Sessão expirou (401) ou token CSRF vencido (419): volta para o login.
    if (response.status === 401 || response.status === 419) {
      window.alert('Sua sessão expirou. Entre novamente.');
      window.location.href = `${base}/login`;
      throw new Erro('Sessão expirada.', response.status);
    }

    if (response.status === 422 && data?.errors) {
      const first = Object.values(data.errors)[0]?.[0];
      throw new Erro(first || 'Confira os dados informados.', 422, data.errors);
    }

    const messages = {
      403: 'Seu perfil não tem permissão para esta ação.',
      404: 'Registro não encontrado. Atualize a página.',
      429: 'Muitas solicitações seguidas. Aguarde um pouco.'
    };
    throw new Erro(messages[response.status] || data?.message || 'Erro no servidor. Tente novamente.', response.status);
  }

  return {
    Erro,
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    put: (path, body) => request('PUT', path, body),
    patch: (path, body) => request('PATCH', path, body),
    del: (path) => request('DELETE', path),
    // Envio com arquivo: o PHP só lê arquivos em POST, então PUT vai como POST + _method.
    putForm: (path, formData) => { formData.append('_method', 'PUT'); return request('POST', path, formData); }
  };
})();
