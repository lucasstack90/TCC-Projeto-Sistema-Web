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

  return { today, formatDate, escapeHtml, plural, code, nextId, compressImage, animalPhoto };
})();
