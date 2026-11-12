/* PAWSAFE — funções utilitárias usadas por mais de um módulo. */

const PawUtils = (() => {
  // Data de hoje no formato do <input type="date"> (AAAA-MM-DD), no fuso local.
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const formatDate = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR') : '—');

  // Evita que um texto digitado pelo usuário vire HTML na página.
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  // Código legível: code('PAW', 7) → "PAW-0007".
  const code = (prefix, id) => `${prefix}-${String(id).padStart(4, '0')}`;

  const nextId = (list) => Math.max(0, ...list.map(item => item.id)) + 1;

  // Reduz a imagem antes de salvar (o localStorage tem cerca de 5 MB no total).
  function compressImage(file, maxSize = 1000, quality = 0.78) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) return reject(new Error('Selecione um arquivo de imagem válido.'));
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onerror = () => reject(new Error('Não foi possível abrir essa imagem.'));
      image.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      image.src = url;
    });
  }

  // Foto de animal com substituto: se a imagem não carregar, mostra a pata.
  function animalPhoto(animal, imgClass, fallbackClass) {
    const fallback = `<div class="${fallbackClass}"><i class="bi bi-paw"></i></div>`;
    if (!animal?.photo) return fallback;
    return `<img class="${imgClass}" src="${escapeHtml(animal.photo)}" alt="Foto de ${escapeHtml(animal.name)}" data-fallback="${fallbackClass}">`;
  }

  document.addEventListener('error', (event) => {
    const img = event.target;
    if (img.tagName === 'IMG' && img.dataset.fallback) {
      img.outerHTML = `<div class="${img.dataset.fallback}"><i class="bi bi-paw"></i></div>`;
    }
  }, true);

  // (42) 99999-9999 (celular) ou (42) 3333-4444 (fixo) enquanto digita
  const maskPhone = (value) => {
    const d = String(value ?? '').replace(/\D/g, '').slice(0, 11);
    return d.replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(d.length === 11 ? /(\d{5})(\d{4})$/ : /(\d{4})(\d{1,4})$/, '$1-$2');
  };

  // Caixas de marcar no estilo .choice-options: checkboxes('skill', ['Resgate', ...], ['Resgate'])
  const checkboxes = (name, options, checked = []) => options.map(option => `
    <label><input type="checkbox" name="${name}" value="${escapeHtml(option)}"${checked.includes(option) ? ' checked' : ''}><span>${escapeHtml(option)}</span></label>`).join('');

  const checkedValues = (root, name) => [...root.querySelectorAll(`input[name="${name}"]:checked`)].map(input => input.value);

  // ---------- CPF, CNPJ e CEP ----------
  // A mesma conta é refeita no servidor (app/Rules/DocumentoValido.php).
  const digits = (value) => String(value ?? '').replace(/\D/g, '');

  function isValidCpf(value) {
    const d = digits(value);
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
    for (let t = 9; t < 11; t++) {
      let sum = 0;
      for (let i = 0; i < t; i++) sum += Number(d[i]) * (t + 1 - i);
      if (Number(d[t]) !== ((10 * sum) % 11) % 10) return false;
    }
    return true;
  }

  function isValidCnpj(value) {
    const d = digits(value);
    if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
    for (const t of [12, 13]) {
      const weights = t === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      const rest = weights.reduce((sum, w, i) => sum + Number(d[i]) * w, 0) % 11;
      if (Number(d[t]) !== (rest < 2 ? 0 : 11 - rest)) return false;
    }
    return true;
  }

  // 000.000.000-00 enquanto digita
  const maskCpf = (value) => digits(value).slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  // 00.000.000/0000-00 enquanto digita
  const maskCnpj = (value) => digits(value).slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
  // 00000-000
  const maskCep = (value) => digits(value).slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');

  // Valores em reais: money(1550) → "R$ 1.550,00"
  const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  return {
    today, formatDate, escapeHtml, plural, code, nextId, compressImage, animalPhoto, maskPhone, checkboxes, checkedValues, money,
    digits, isValidCpf, isValidCnpj, maskCpf, maskCnpj, maskCep
  };
})();
