/* PAWSAFE — módulo de Estoque
   Cadastro de itens (ração, medicamentos, vacinas, utensílios...), entradas e saídas,
   lotes com validade (saída FEFO), alertas de estoque mínimo e vencimento,
   inventário (ajuste) e estorno de lançamentos.
   O saldo nunca é digitado: ele é calculado a partir das movimentações (PawData.stockInfo).
   Depende de: Bootstrap 5, js/dados.js (PawData), js/utils.js (PawUtils) e js/sidebar.js. */

const $ = (id) => document.getElementById(id);
const { today, formatDate, escapeHtml, plural } = PawUtils;
const { round3, STOCK_REASONS } = PawData;
const itemCode = (id) => PawUtils.code('EST', id);
const moveCode = (id) => PawUtils.code('MOV', id);
const animalCode = (id) => PawUtils.code('PAW', id);

// Usuário logado. No back-end virá da sessão (Laravel Auth) e o perfil
// (funcionário ou voluntário) define quem pode cadastrar itens, ajustar e estornar.
const CURRENT_USER = 'Renata Oliveira';

// ================= Estado =================
let items = PawData.loadStockItems();
let moves = PawData.loadStockMoves();
const animals = PawData.loadAnimals(); // só leitura: usado no "uso em animal"

let infoCache = new Map();
let openItemId = null;
let returnToDetail = null; // reabre a ficha depois de fechar um formulário aberto a partir dela

const itemModal = new bootstrap.Modal($('itemModal'));
const moveModal = new bootstrap.Modal($('moveModal'));
const countModal = new bootstrap.Modal($('countModal'));
const detailModal = new bootstrap.Modal($('detailModal'));
const toast = new bootstrap.Toast($('toast'), { delay: 3200 });

const CATEGORY_ICON = {
  'Ração': 'bi-basket', 'Medicamento': 'bi-capsule', 'Vacina': 'bi-eyedropper',
  'Higiene e limpeza': 'bi-droplet', 'Utensílio': 'bi-tools'
};
const STATUS_ORDER = Object.fromEntries(PawData.STOCK_STATUS.map((s, i) => [s, i]));
const PARTY_LABEL = { doacao: 'Doador', compra: 'Fornecedor', repasse: 'Destino' };

const fmt = (n) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const qtyText = (n, unit) => `${fmt(n)} ${unit}`;
const normalize = (text) => String(text ?? '').toLocaleLowerCase('pt-BR');
const findItem = (id) => items.find(i => i.id === id);
const findMove = (id) => moves.find(m => m.id === id);
const findAnimal = (id) => animals.find(a => a.id === id);
const infoOf = (id) => infoCache.get(id);
const reasonLabel = (m) => STOCK_REASONS[m.type]?.[m.reason] ?? m.reason;
const refreshInfo = () => { infoCache = new Map(items.map(i => [i.id, PawData.stockInfo(i, moves)])); };

function notify(message) {
  $('toastText').textContent = message;
  toast.show();
}

// Salva itens e movimentações juntos; se falhar, desfaz o que estava na memória.
function commit(backup) {
  if (PawData.saveStockItems(items) && PawData.saveStockMoves(moves)) return true;
  ({ items, moves } = JSON.parse(backup));
  notify('Não foi possível salvar. Tente novamente.');
  return false;
}
const snapshot = () => JSON.stringify({ items, moves });

function coverageText(info) {
  if (info.usable <= 0) return 'Esgotado';
  if (info.coverageDays === null) return 'Sem consumo recente';
  return `≈ ${plural(info.coverageDays, 'dia', 'dias')}`;
}

function expiryText(days) {
  if (days < 0) return `venceu há ${plural(-days, 'dia', 'dias')}`;
  if (days === 0) return 'vence hoje';
  return `vence em ${plural(days, 'dia', 'dias')}`;
}

// ================= Resumo e alertas =================
function renderSummary() {
  const active = items.filter(i => i.active);
  const restock = active.filter(i => ['Em falta', 'Crítico'].includes(infoOf(i.id).status)).length;
  const lotsWarning = active.reduce((s, i) => s + infoOf(i.id).expiringLots.length + infoOf(i.id).expiredLots.length, 0);
  const month = today().slice(0, 7);
  const monthMoves = moves.filter(m => m.date.startsWith(month)).length;

  const stats = [
    ['Itens ativos', active.length, 'bi-box-seam', 'icon-green'],
    ['Para repor', restock, 'bi-cart-plus', restock ? 'icon-danger' : 'icon-green'],
    ['Lotes vencendo / vencidos', lotsWarning, 'bi-calendar-x', lotsWarning ? 'icon-terra' : 'icon-green'],
    ['Movimentações no mês', monthMoves, 'bi-arrow-left-right', 'icon-blue']
  ];
  $('summaryStats').innerHTML = stats.map(([label, value, icon, color]) => `
    <div class="summary-stat">
      <span class="summary-icon ${color}"><i class="bi ${icon}"></i></span>
      <div><strong>${value}</strong><small>${label}</small></div>
    </div>`).join('');

  $('itemsText').textContent = plural(active.length, 'item ativo', 'itens ativos');
  $('restockText').textContent = restock ? plural(restock, 'item para repor', 'itens para repor') : 'nenhum item abaixo do mínimo';

  const badge = document.querySelector('[data-count="estoque"]');
  if (badge) {
    badge.textContent = restock;
    badge.classList.toggle('d-none', !restock);
  }
}

function renderAlerts() {
  const alerts = [];
  items.filter(i => i.active).forEach(item => {
    const info = infoOf(item.id);
    if (info.status === 'Em falta') {
      alerts.push({ level: 0, item, icon: 'bi-x-octagon', danger: true, title: `${item.name} · em falta`, text: `Mínimo de ${qtyText(item.min, item.unit)}` });
    } else if (info.status === 'Crítico') {
      alerts.push({ level: 1, item, icon: 'bi-exclamation-octagon', danger: true, title: `${item.name} · abaixo do mínimo`, text: `${qtyText(info.usable, item.unit)} de ${qtyText(item.min, item.unit)} · ${coverageText(info)}` });
    }
    info.expiredLots.forEach(l => alerts.push({
      level: 1, item, icon: 'bi-calendar-x', danger: true,
      title: `${item.name} · lote ${l.lot} vencido`, text: `${qtyText(l.qty, item.unit)} · ${expiryText(l.daysLeft)} · registre o descarte`
    }));
    info.expiringLots.forEach(l => alerts.push({
      level: 2, item, icon: 'bi-hourglass-split', danger: false,
      title: `${item.name} · lote ${l.lot}`, text: `${qtyText(l.qty, item.unit)} · ${expiryText(l.daysLeft)} (${formatDate(l.expiry)})`
    }));
  });

  alerts.sort((a, b) => a.level - b.level || a.item.name.localeCompare(b.item.name, 'pt-BR'));
  $('alertPanel').classList.toggle('d-none', !alerts.length);
  $('alertList').innerHTML = alerts.map(a => `
    <button type="button" class="alert-item ${a.danger ? 'is-danger' : 'is-warning'}" data-item="${a.item.id}">
      <i class="bi ${a.icon}"></i>
      <div><strong>${escapeHtml(a.title)}</strong><small>${escapeHtml(a.text)}</small></div>
    </button>`).join('');
}

// ================= Lista de itens =================
function getFilteredItems() {
  const term = normalize($('search').value.trim());
  const category = $('categoryFilter').value;
  const status = $('statusFilter').value;
  const showInactive = $('showInactive').checked;

  return items
    .filter(i => showInactive || i.active)
    .filter(i => category === 'Todas' || i.category === category)
    .filter(i => status === 'Todos' || infoOf(i.id).status === status)
    .filter(i => !term || normalize([i.name, i.category, itemCode(i.id), ...infoOf(i.id).lots.map(l => l.lot)].join(' ')).includes(term))
    // Mais graves primeiro (em falta, crítico, baixo); depois por nome.
    .sort((a, b) => (b.active - a.active)
      || STATUS_ORDER[infoOf(a.id).status] - STATUS_ORDER[infoOf(b.id).status]
      || a.name.localeCompare(b.name, 'pt-BR'));
}

function rowHtml(item) {
  const info = infoOf(item.id);
  const nextLot = info.lots.find(l => l.state !== 'vencido');
  let expiryCell = '<span class="muted-cell">Não controla</span>';
  if (item.tracksExpiry) {
    expiryCell = nextLot
      ? `<span class="${nextLot.state === 'vencendo' ? 'text-warning-soft' : ''}">${formatDate(nextLot.expiry)}</span><small>${expiryText(nextLot.daysLeft)}</small>`
      : '—';
  }
  const canTakeOut = info.total > 0;

  return `
    <tr class="${item.active ? '' : 'is-inactive'}">
      <td>
        <div class="item-cell">
          <span class="item-icon"><i class="bi ${CATEGORY_ICON[item.category] ?? 'bi-box'}"></i></span>
          <div>
            <button type="button" class="item-link" data-item="${item.id}">${escapeHtml(item.name)}</button>
            <small>${itemCode(item.id)} · ${escapeHtml(item.category)}${item.active ? '' : ' · inativo'}</small>
          </div>
        </div>
      </td>
      <td data-label="Saldo"><span class="qty">${qtyText(info.usable, item.unit)}</span>${info.expired > 0 ? `<span class="qty-extra">+ ${qtyText(info.expired, item.unit)} vencidos</span>` : ''}</td>
      <td data-label="Mínimo" class="muted-cell">${qtyText(item.min, item.unit)}</td>
      <td data-label="Situação"><span class="status-badge ${PawData.stockClass(info.status)}">${info.status}</span></td>
      <td data-label="Cobertura" class="muted-cell"><span class="${info.coverageDays !== null && info.coverageDays < 7 ? 'text-danger-soft' : ''}">${coverageText(info)}</span>${info.dailyUse > 0 ? `<small>${fmt(round3(info.dailyUse))} ${item.unit}/dia</small>` : ''}</td>
      <td data-label="Próx. validade" class="muted-cell">${expiryCell}</td>
      <td>
        <div class="row-actions">
          ${item.active ? `
            <button type="button" class="btn btn-green" data-move-in="${item.id}"><i class="bi bi-box-arrow-in-down me-1"></i>Entrada</button>
            <button type="button" class="btn btn-outline-green" data-move-out="${item.id}"${canTakeOut ? '' : ' disabled'}><i class="bi bi-box-arrow-up me-1"></i>Saída</button>` : ''}
          <button type="button" class="btn btn-outline-green" data-item="${item.id}">Abrir</button>
        </div>
      </td>
    </tr>`;
}

function render() {
  refreshInfo();
  const list = getFilteredItems();
  $('stockRows').innerHTML = list.map(rowHtml).join('');
  $('stockTableWrap').classList.toggle('d-none', !list.length);
  $('empty').classList.toggle('d-none', list.length > 0);
  const visibleTotal = items.filter(i => $('showInactive').checked || i.active).length;
  $('resultsText').textContent = `Exibindo ${list.length} de ${plural(visibleTotal, 'item', 'itens')}`;
  renderSummary();
  renderAlerts();
}

function clearFilters() {
  $('search').value = '';
  $('categoryFilter').value = 'Todas';
  $('statusFilter').value = 'Todos';
  render();
}

// ================= Cadastro / edição de item =================
function packageRowHtml(pkg = { name: '', size: '' }) {
  return `
    <div class="package-row">
      <input class="form-control pk-name" maxlength="40" placeholder="Ex.: Saco 15 kg" value="${escapeHtml(pkg.name)}" aria-label="Nome da embalagem">
      <div class="input-group">
        <input type="number" class="form-control pk-size" min="0.001" step="0.001" placeholder="Contém" value="${pkg.size}" aria-label="Quantidade na embalagem">
        <span class="input-group-text unit-tag" data-unit-tag></span>
      </div>
      <button type="button" class="btn btn-outline-danger" data-remove-package aria-label="Remover embalagem"><i class="bi bi-x-lg"></i></button>
    </div>`;
}

function syncUnitTags() {
  document.querySelectorAll('#itemModal [data-unit-tag]').forEach(tag => { tag.textContent = $('itUnit').value; });
}

function openItemForm(item = null) {
  $('itemForm').reset();
  $('itemForm').querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
  $('itemId').value = item?.id ?? '';

  // Unidade e controle de validade não mudam depois que já há movimentações,
  // senão o histórico deixaria de fazer sentido (ex.: 30 "kg" virariam 30 "un").
  const locked = item ? infoOf(item.id).moveCount > 0 : false;
  $('itUnit').disabled = locked;
  $('itExpiry').disabled = locked;
  $('unitHint').textContent = locked ? 'Não pode mudar: o item já tem movimentações.' : 'Em que unidade o saldo é contado.';

  $('itName').value = item?.name ?? '';
  $('itCategory').value = item?.category ?? PawData.STOCK_CATEGORIES[0];
  $('itUnit').value = item?.unit ?? 'kg';
  $('itMin').value = item?.min ?? '';
  $('itExpiry').checked = item?.tracksExpiry ?? true;
  $('itNotes').value = item?.notes ?? '';
  $('packageRows').innerHTML = (item?.packages ?? []).map(packageRowHtml).join('');
  syncUnitTags();

  $('itemFormTitle').textContent = item ? `Editar ${itemCode(item.id)}` : 'Cadastrar item';
  $('saveItemButton').innerHTML = `<i class="bi bi-check2 me-2"></i>${item ? 'Salvar alterações' : 'Cadastrar item'}`;
  itemModal.show();
}

function invalid(el, message) {
  el.classList.add('is-invalid');
  el.focus();
  notify(message);
  return false;
}

$('itemForm').addEventListener('submit', (event) => {
  event.preventDefault();
  $('itemForm').querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
  const existing = findItem(Number($('itemId').value));
  const name = $('itName').value.trim().replace(/\s+/g, ' ');
  const min = Number($('itMin').value);

  if (!name) return invalid($('itName'), 'Informe o nome do item.');
  if (items.some(i => i.id !== existing?.id && normalize(i.name) === normalize(name))) {
    return invalid($('itName'), 'Já existe um item com esse nome.');
  }
  if ($('itMin').value === '' || !(min >= 0)) return invalid($('itMin'), 'Informe o estoque mínimo (pode ser 0).');

  const packages = [];
  for (const row of document.querySelectorAll('#packageRows .package-row')) {
    const pkName = row.querySelector('.pk-name');
    const pkSize = row.querySelector('.pk-size');
    const label = pkName.value.trim();
    const size = Number(pkSize.value);
    if (!label && !pkSize.value) continue; // linha vazia é ignorada
    if (!label) return invalid(pkName, 'Dê um nome para a embalagem.');
    if (!(size > 0)) return invalid(pkSize, `Informe quanto cabe em “${label}”.`);
    if (packages.some(p => normalize(p.name) === normalize(label))) return invalid(pkName, 'Embalagem repetida.');
    packages.push({ name: label, size: round3(size) });
  }

  const data = {
    name, min: round3(min), packages,
    category: $('itCategory').value,
    unit: $('itUnit').value,
    tracksExpiry: $('itExpiry').checked,
    notes: $('itNotes').value.trim()
  };

  const backup = snapshot();
  let item = existing;
  if (existing) Object.assign(existing, data);
  else {
    item = { id: PawUtils.nextId(items), ...data, active: true };
    items.push(item);
  }
  if (!commit(backup)) return;
  if (!existing) returnToDetail = item.id; // mostra a ficha do item recém-criado
  itemModal.hide();
  render();
  notify(existing ? 'Item atualizado.' : `Item ${itemCode(item.id)} cadastrado. Registre a primeira entrada.`);
});

$('addPackage').addEventListener('click', () => {
  $('packageRows').insertAdjacentHTML('beforeend', packageRowHtml());
  syncUnitTags();
  $('packageRows').lastElementChild.querySelector('.pk-name').focus();
});
$('packageRows').addEventListener('click', (event) => {
  event.target.closest('[data-remove-package]')?.closest('.package-row').remove();
});
$('itUnit').addEventListener('change', syncUnitTags);

// ================= Entrada / saída =================
const moveType = () => document.querySelector('input[name="mvType"]:checked').value;
const selectedItem = () => findItem(Number($('mvItem').value));

function measureSize(item) {
  const index = $('mvMeasure').value;
  return index === '' ? 1 : item.packages[Number(index)]?.size ?? 1;
}

// Distribui a saída entre os lotes. "auto" = FEFO: o que vence primeiro sai primeiro.
// Lote vencido só sai como perda/descarte (nunca vai para consumo ou para um animal).
function allocate(info, qty, choice, reason) {
  const pool = choice === 'auto'
    ? info.lots.filter(l => reason === 'perda' || l.state !== 'vencido')
    : info.lots.filter(l => l.lot === choice);
  let rest = qty;
  const parts = [];
  for (const l of pool) {
    if (rest <= 0) break;
    const take = Math.min(rest, l.qty);
    parts.push({ lot: l.lot, expiry: l.expiry, qty: round3(take) });
    rest = round3(rest - take);
  }
  return { parts, missing: rest };
}

function openMoveForm({ itemId = null, type = 'entrada', reason = null, lot = null, qty = '', note = '' } = {}) {
  $('moveForm').reset();
  $('moveForm').querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));

  const active = items.filter(i => i.active).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  $('mvItem').innerHTML = '<option value="">Selecione o item</option>' + active
    .map(i => `<option value="${i.id}">${escapeHtml(i.name)} (${itemCode(i.id)})</option>`).join('');
  $('mvItem').value = itemId ?? '';
  document.querySelector(`input[name="mvType"][value="${type}"]`).checked = true;
  $('mvDate').value = today();
  $('mvDate').max = today();
  $('mvQty').value = qty;
  $('mvNote').value = note;
  $('mvUser').textContent = CURRENT_USER;

  $('mvAnimal').innerHTML = '<option value="">Selecione o animal</option>' + animals
    .filter(a => a.status !== 'Adotado')
    .map(a => `<option value="${a.id}">${escapeHtml(a.name)} (${animalCode(a.id)}) · ${escapeHtml(a.species)}</option>`).join('');

  updateMoveForm({ reason, lot, resetMeasure: true });
  moveModal.show();
}

function updateMoveForm({ reason = null, lot = null, resetMeasure = false } = {}) {
  const item = selectedItem();
  const type = moveType();
  const isIn = type === 'entrada';

  // Motivos (ajuste e estorno têm fluxo próprio)
  const current = reason ?? $('mvReason').value;
  const reasons = Object.entries(STOCK_REASONS[type]).filter(([key]) => key !== 'ajuste' && key !== 'estorno');
  $('mvReason').innerHTML = reasons.map(([key, label]) => `<option value="${key}">${label}</option>`).join('');
  $('mvReason').value = reasons.some(([key]) => key === current) ? current : reasons[0][0];
  const why = $('mvReason').value;

  // Medida: unidade de controle ou uma das embalagens do item
  if (resetMeasure || !item || $('mvMeasure').dataset.item !== String(item?.id)) {
    $('mvMeasure').innerHTML = item
      ? `<option value="">${item.unit} (unidade de controle)</option>` + item.packages
        .map((p, i) => `<option value="${i}">${escapeHtml(p.name)} (= ${qtyText(p.size, item.unit)})</option>`).join('')
      : '<option value="">Selecione o item primeiro</option>';
    // Entrada costuma ser por embalagem; saída, pela unidade de controle.
    $('mvMeasure').value = isIn && item?.packages.length ? '0' : '';
    $('mvMeasure').dataset.item = item?.id ?? '';
  }

  const tracks = Boolean(item?.tracksExpiry);
  document.querySelectorAll('.lot-in').forEach(el => el.classList.toggle('d-none', !(isIn && tracks)));
  document.querySelectorAll('.lot-out').forEach(el => el.classList.toggle('d-none', !(!isIn && tracks)));

  const showParty = (isIn && (why === 'doacao' || why === 'compra')) || why === 'repasse';
  $('mvParty').closest('.field-party').classList.toggle('d-none', !showParty);
  $('partyLabel').textContent = why === 'compra' ? 'Fornecedor' : why === 'repasse' ? 'ONG de destino *' : 'Doador / origem';
  $('mvParty').placeholder = why === 'compra' ? 'Ex.: Agropecuária Campos Gerais' : why === 'repasse' ? 'Nome da organização' : 'Pessoa, empresa ou campanha';
  $('mvAnimal').closest('.field-animal').classList.toggle('d-none', why !== 'uso_animal');
  $('noteLabel').textContent = why === 'perda' ? 'Observação * (o que aconteceu)' : 'Observação';

  // Lotes disponíveis para a saída
  if (!isIn && tracks) {
    const info = infoOf(item.id);
    const chosen = lot ?? $('mvLotOut').value;
    const options = info.lots.filter(l => why === 'perda' || l.state !== 'vencido');
    $('mvLotOut').innerHTML = '<option value="auto">Automático: vence primeiro, sai primeiro (FEFO)</option>' + options
      .map(l => `<option value="${escapeHtml(l.lot)}">Lote ${escapeHtml(l.lot)} · ${qtyText(l.qty, item.unit)} · ${l.state === 'vencido' ? 'VENCIDO' : `vence ${formatDate(l.expiry)}`}</option>`).join('');
    $('mvLotOut').value = options.some(l => l.lot === chosen) ? chosen : 'auto';
  }

  const ready = Boolean(item);
  $('moveFormTitle').textContent = `${isIn ? 'Registrar entrada' : 'Registrar saída'}${item ? ` · ${item.name}` : ''}`;
  $('saveMoveButton').innerHTML = `<i class="bi bi-check2 me-2"></i>${isIn ? 'Registrar entrada' : 'Registrar saída'}`;
  $('saveMoveButton').disabled = !ready;
  updatePreview();
}

// Mostra a conversão ("2 × Saco 15 kg = 30 kg"), o saldo resultante e de quais lotes sai.
function updatePreview() {
  const item = selectedItem();
  const conv = $('conversion');
  const alloc = $('allocation');
  conv.classList.remove('is-error');
  alloc.classList.remove('is-error');
  alloc.innerHTML = '';
  const typed = Number($('mvQty').value);
  if (!item || !(typed > 0)) { conv.innerHTML = ''; return; }

  const info = infoOf(item.id);
  const isIn = moveType() === 'entrada';
  const size = measureSize(item);
  const base = round3(typed * size);
  const pkg = $('mvMeasure').value === '' ? null : item.packages[Number($('mvMeasure').value)];
  const description = pkg ? `${fmt(typed)} × ${escapeHtml(pkg.name)} = <strong>${qtyText(base, item.unit)}</strong>` : `<strong>${qtyText(base, item.unit)}</strong>`;

  if (isIn) {
    conv.innerHTML = `${description} · saldo passa de ${qtyText(info.usable, item.unit)} para ${qtyText(round3(info.usable + base), item.unit)}`;
    return;
  }

  const why = $('mvReason').value;
  if (!item.tracksExpiry) {
    if (base > info.total) {
      conv.classList.add('is-error');
      conv.innerHTML = `${description} · saldo insuficiente (há ${qtyText(info.total, item.unit)})`;
    } else {
      conv.innerHTML = `${description} · saldo passa de ${qtyText(info.total, item.unit)} para ${qtyText(round3(info.total - base), item.unit)}`;
    }
    return;
  }

  const { parts, missing } = allocate(info, base, $('mvLotOut').value, why);
  conv.innerHTML = `${description} · saldo disponível: ${qtyText(info.usable, item.unit)}`;
  if (missing > 0) {
    alloc.classList.add('is-error');
    const available = round3(base - missing);
    alloc.innerHTML = `Faltam ${qtyText(missing, item.unit)}. Disponível para esta saída: ${qtyText(available, item.unit)}.`
      + (info.expired > 0 && why !== 'perda' ? ' Lotes vencidos só saem como “Perda / descarte”.' : '');
  } else {
    alloc.innerHTML = `Sairá de: <ul>${parts.map(p => `<li>Lote <strong>${escapeHtml(p.lot)}</strong>: ${qtyText(p.qty, item.unit)} (vence ${formatDate(p.expiry)})</li>`).join('')}</ul>`;
  }
}

$('moveForm').addEventListener('submit', (event) => {
  event.preventDefault();
  $('moveForm').querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
  const item = selectedItem();
  if (!item) return invalid($('mvItem'), 'Selecione o item.');

  const type = moveType();
  const reason = $('mvReason').value;
  const typed = Number($('mvQty').value);
  if (!(typed > 0)) return invalid($('mvQty'), 'Informe uma quantidade maior que zero.');
  const qty = round3(typed * measureSize(item));
  const date = $('mvDate').value;
  if (!date || date > today()) return invalid($('mvDate'), 'Informe uma data até hoje.');

  const party = $('mvParty').value.trim();
  const note = $('mvNote').value.trim();
  const animalId = reason === 'uso_animal' ? Number($('mvAnimal').value) || null : null;
  if (reason === 'uso_animal' && !animalId) return invalid($('mvAnimal'), 'Selecione o animal que recebeu o item.');
  if (reason === 'repasse' && !party) return invalid($('mvParty'), 'Informe a ONG de destino.');
  if (reason === 'perda' && !note) return invalid($('mvNote'), 'Descreva o motivo da perda ou descarte.');

  const info = infoOf(item.id);
  let lots = [];
  if (type === 'entrada' && item.tracksExpiry) {
    const lotCode = $('mvLot').value.trim().toUpperCase();
    const expiry = $('mvExpiry').value;
    if (!lotCode) return invalid($('mvLot'), 'Informe o lote impresso na embalagem.');
    if (!expiry) return invalid($('mvExpiry'), 'Informe a validade do lote.');
    if (expiry < date) return invalid($('mvExpiry'), 'Este lote já está vencido. Não registre a entrada; descarte o produto.');
    // Mesmo lote não pode ter duas validades diferentes
    const sameLot = moves.find(m => m.itemId === item.id && m.lots.some(l => l.lot === lotCode && l.expiry !== expiry));
    if (sameLot) {
      const known = sameLot.lots.find(l => l.lot === lotCode).expiry;
      return invalid($('mvExpiry'), `O lote ${lotCode} já foi registrado com validade ${formatDate(known)}. Confira a data.`);
    }
    lots = [{ lot: lotCode, expiry, qty }];
  }
  if (type === 'saida') {
    if (item.tracksExpiry) {
      const { parts, missing } = allocate(info, qty, $('mvLotOut').value, reason);
      if (missing > 0) return invalid($('mvQty'), 'Quantidade maior que o disponível nos lotes.');
      lots = parts;
    } else if (qty > info.total) {
      return invalid($('mvQty'), `Saldo insuficiente: há ${qtyText(info.total, item.unit)}.`);
    }
  }

  const pkg = $('mvMeasure').value === '' ? null : item.packages[Number($('mvMeasure').value)];
  const backup = snapshot();
  moves.push({
    id: PawUtils.nextId(moves), itemId: item.id, type, reason, qty, date,
    packageLabel: pkg ? `${fmt(typed)} × ${pkg.name}` : '',
    lots, user: CURRENT_USER, animalId, party: PARTY_LABEL[reason] ? party : '', note,
    reversalOf: null, reversedBy: null
  });
  if (!commit(backup)) return;

  moveModal.hide();
  render();
  const after = infoOf(item.id);
  const warning = type === 'saida' && ['Crítico', 'Em falta'].includes(after.status) ? ` Atenção: ${item.name} está ${after.status.toLowerCase()}.` : '';
  notify(`${type === 'entrada' ? 'Entrada' : 'Saída'} de ${qtyText(qty, item.unit)} registrada.${warning}`);
});

document.querySelectorAll('input[name="mvType"]').forEach(radio => radio.addEventListener('change', () => updateMoveForm({ resetMeasure: true })));
$('mvItem').addEventListener('change', () => updateMoveForm({ resetMeasure: true }));
$('mvReason').addEventListener('change', () => updateMoveForm());
['mvQty', 'mvMeasure', 'mvLotOut'].forEach(id => $(id).addEventListener(id === 'mvQty' ? 'input' : 'change', updatePreview));

// ================= Inventário (ajuste por contagem física) =================
function openCount(itemId) {
  const item = findItem(itemId);
  const info = infoOf(itemId);
  $('countForm').reset();
  $('countNote').classList.remove('is-invalid');
  $('countTitle').textContent = `Inventário · ${item.name}`;
  $('countForm').dataset.item = itemId;

  const rows = item.tracksExpiry
    ? info.lots.map(l => ({ key: l.lot, label: `Lote ${l.lot}`, hint: `Validade ${formatDate(l.expiry)}${l.state === 'vencido' ? ' · vencido' : ''}`, qty: l.qty }))
    : [{ key: '', label: 'Saldo atual', hint: 'Item sem controle de lote', qty: info.total }];

  $('countRows').innerHTML = rows.length
    ? rows.map(r => `
      <div class="count-row" data-lot="${escapeHtml(r.key)}" data-system="${r.qty}">
        <div><strong>${escapeHtml(r.label)}</strong><small>${escapeHtml(r.hint)} · sistema: ${qtyText(r.qty, item.unit)}</small></div>
        <div class="input-group"><input type="number" class="form-control count-input" min="0" step="0.001" value="${r.qty}" aria-label="Quantidade contada em ${escapeHtml(r.label)}"><span class="input-group-text unit-tag">${item.unit}</span></div>
        <div class="count-diff"></div>
      </div>`).join('')
    : '<p class="text-secondary small m-0">Não há lotes com saldo. Para lotes novos, registre uma entrada.</p>';
  countModal.show();
}

$('countRows').addEventListener('input', (event) => {
  const row = event.target.closest('.count-row');
  if (!row) return;
  const unit = findItem(Number($('countForm').dataset.item)).unit;
  const diff = round3(Number(row.querySelector('.count-input').value || 0) - Number(row.dataset.system));
  const label = row.querySelector('.count-diff');
  label.className = `count-diff ${diff > 0 ? 'is-plus' : diff < 0 ? 'is-minus' : ''}`;
  label.textContent = diff ? `Diferença: ${diff > 0 ? '+' : '−'}${qtyText(Math.abs(diff), unit)}` : '';
});

$('countForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const item = findItem(Number($('countForm').dataset.item));
  const note = $('countNote').value.trim();
  const info = infoOf(item.id);
  const plus = [];
  const minus = [];

  for (const row of document.querySelectorAll('#countRows .count-row')) {
    const input = row.querySelector('.count-input');
    const counted = Number(input.value);
    if (input.value === '' || counted < 0) return invalid(input, 'Informe a quantidade contada (0 ou mais).');
    const diff = round3(counted - Number(row.dataset.system));
    if (!diff) continue;
    const lot = info.lots.find(l => l.lot === row.dataset.lot);
    const part = lot ? { lot: lot.lot, expiry: lot.expiry, qty: Math.abs(diff) } : { qty: Math.abs(diff) };
    (diff > 0 ? plus : minus).push(part);
  }

  if (!plus.length && !minus.length) {
    countModal.hide();
    notify('A contagem bate com o sistema. Nenhum ajuste necessário.');
    return;
  }
  if (!note) return invalid($('countNote'), 'Escreva a justificativa do ajuste.');

  const backup = snapshot();
  [['entrada', plus], ['saida', minus]].forEach(([type, parts]) => {
    if (!parts.length) return;
    moves.push({
      id: PawUtils.nextId(moves), itemId: item.id, type, reason: 'ajuste',
      qty: round3(parts.reduce((s, p) => s + p.qty, 0)), date: today(),
      packageLabel: '', lots: item.tracksExpiry ? parts : [], user: CURRENT_USER,
      animalId: null, party: '', note, reversalOf: null, reversedBy: null
    });
  });
  if (!commit(backup)) return;
  countModal.hide();
  render();
  notify('Inventário registrado como ajuste.');
});

// ================= Estorno =================
function reverseMove(id) {
  const m = findMove(id);
  const item = findItem(m.itemId);
  if (!m || m.reversedBy || m.reason === 'estorno') return;

  // Estornar uma entrada só é possível se o que entrou ainda está no estoque.
  if (m.type === 'entrada') {
    const info = infoOf(item.id);
    const missing = item.tracksExpiry
      ? m.lots.some(p => (info.lots.find(l => l.lot === p.lot)?.qty ?? 0) < p.qty)
      : info.total < m.qty;
    if (missing) {
      notify('Parte desta entrada já saiu do estoque. Estorne as saídas antes ou faça um inventário.');
      return;
    }
  }

  const note = window.prompt(`Estornar ${moveCode(m.id)} (${reasonLabel(m)} de ${qtyText(m.qty, item.unit)})?\nO lançamento original continua no histórico.\n\nMotivo do estorno:`);
  if (note === null) return;
  if (!note.trim()) { notify('O estorno precisa de um motivo.'); return; }

  const backup = snapshot();
  const reversal = {
    id: PawUtils.nextId(moves), itemId: m.itemId, type: m.type === 'entrada' ? 'saida' : 'entrada', reason: 'estorno',
    qty: m.qty, date: today(), packageLabel: '', lots: m.lots.map(l => ({ ...l })), user: CURRENT_USER,
    animalId: null, party: '', note: note.trim(), reversalOf: m.id, reversedBy: null
  };
  moves.push(reversal);
  m.reversedBy = reversal.id;
  if (!commit(backup)) return;
  render();
  renderDetail();
  notify(`${moveCode(m.id)} estornado.`);
}

// ================= Ficha do item =================
function openDetail(id) {
  openItemId = id;
  showTab('overview');
  renderDetail();
  detailModal.show();
}

function showTab(name) {
  document.querySelectorAll('#detailModal .tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === name));
  ['overview', 'moves'].forEach(panel => $(`panel-${panel}`).classList.toggle('d-none', panel !== name));
}

function renderDetail() {
  const item = findItem(openItemId);
  if (!item) return;
  const info = infoOf(item.id);

  $('detailName').textContent = item.name;
  $('detailStatus').textContent = info.status;
  $('detailStatus').className = `status-badge ${PawData.stockClass(info.status)}`;
  $('detailSubtitle').textContent = `${itemCode(item.id)} · ${item.category} · controlado em ${item.unit}${item.tracksExpiry ? ' · com lote e validade' : ''}${item.active ? '' : ' · inativo'}`;

  const lotsHtml = !item.tracksExpiry ? '' : `
    <div class="panel-toolbar mt-4"><h3>Lotes em estoque</h3><small class="text-secondary">Ordem de saída: vence primeiro, sai primeiro</small></div>
    ${info.lots.length ? `
      <div class="table-responsive"><table class="mini-table">
        <thead><tr><th>Lote</th><th>Quantidade</th><th>Validade</th><th>Situação</th><th></th></tr></thead>
        <tbody>${info.lots.map(l => `
          <tr>
            <td><strong>${escapeHtml(l.lot)}</strong></td>
            <td>${qtyText(l.qty, item.unit)}</td>
            <td>${formatDate(l.expiry)}</td>
            <td><span class="status-badge lot-${l.state}">${l.state === 'ok' ? 'Em dia' : l.state === 'vencendo' ? expiryText(l.daysLeft) : 'Vencido'}</span></td>
            <td class="text-end">${l.state === 'vencido' && item.active ? `<button type="button" class="btn btn-outline-danger" data-discard="${escapeHtml(l.lot)}"><i class="bi bi-trash me-1"></i>Descartar</button>` : ''}</td>
          </tr>`).join('')}</tbody>
      </table></div>` : '<p class="text-secondary small m-0">Nenhum lote com saldo.</p>'}`;

  $('panel-overview').innerHTML = `
    <div class="overview-tiles">
      <div class="info-tile"><small>Saldo disponível</small><strong>${qtyText(info.usable, item.unit)}</strong><p>${info.expired > 0 ? `+ ${qtyText(info.expired, item.unit)} vencidos` : `Total físico: ${qtyText(info.total, item.unit)}`}</p></div>
      <div class="info-tile"><small>Estoque mínimo</small><strong>${qtyText(item.min, item.unit)}</strong><p>Baixo até ${qtyText(round3(item.min * 1.5), item.unit)}</p></div>
      <div class="info-tile"><small>Consumo médio</small><strong>${info.dailyUse > 0 ? `${fmt(round3(info.dailyUse))} ${item.unit}/dia` : '—'}</strong><p>Últimos ${PawData.CONSUMPTION_DAYS} dias</p></div>
      <div class="info-tile"><small>Cobertura</small><strong>${coverageText(info)}</strong><p>Com o consumo atual</p></div>
    </div>
    ${lotsHtml}
    <div class="panel-toolbar mt-4"><h3>Embalagens</h3></div>
    ${item.packages.length
      ? `<div class="package-chips">${item.packages.map(p => `<span class="package-chip">${escapeHtml(p.name)} = ${qtyText(p.size, item.unit)}</span>`).join('')}</div>`
      : '<p class="text-secondary small m-0">Nenhuma embalagem cadastrada: as quantidades são lançadas direto em ' + item.unit + '.</p>'}
    ${item.notes ? `<div class="info-tile mt-4"><small>Observações</small><p class="m-0">${escapeHtml(item.notes)}</p></div>` : ''}`;

  const history = moves.filter(m => m.itemId === item.id)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  $('moveCount').textContent = `(${history.length})`;
  $('panel-moves').innerHTML = history.length
    ? `<div class="move-list">${history.map(m => moveHtml(m, item)).join('')}</div>`
    : '<p class="text-secondary small m-0">Nenhuma movimentação ainda. Registre a primeira entrada.</p>';

  // Excluir só itens sem histórico; com histórico, o caminho é inativar.
  $('deleteItem').classList.toggle('d-none', info.moveCount > 0);
  $('toggleActive').innerHTML = item.active ? '<i class="bi bi-archive me-1"></i>Inativar' : '<i class="bi bi-arrow-counterclockwise me-1"></i>Reativar';
  $('toggleActive').classList.toggle('d-none', info.moveCount === 0 && item.active);
  ['countItem', 'detailIn', 'editItem'].forEach(btn => $(btn).classList.toggle('d-none', !item.active));
  $('detailOut').classList.toggle('d-none', !item.active || info.total <= 0);
  $('countItem').classList.toggle('d-none', !item.active || info.moveCount === 0);
}

function moveHtml(m, item) {
  const isIn = m.type === 'entrada';
  const animal = m.animalId ? findAnimal(m.animalId) : null;
  const details = [
    m.lots.length ? `Lote${m.lots.length > 1 ? 's' : ''}: ${m.lots.map(l => `${escapeHtml(l.lot)} (${qtyText(l.qty, item.unit)})`).join(', ')}` : '',
    m.animalId ? `Animal: ${animal ? `<a href="animais.html?animal=${animal.id}">${escapeHtml(animal.name)}</a>` : 'removido'} (${animalCode(m.animalId)})` : '',
    m.party ? `${PARTY_LABEL[m.reason] ?? 'Origem'}: ${escapeHtml(m.party)}` : '',
    m.note ? `“${escapeHtml(m.note)}”` : '',
    m.reversalOf ? `Estorno de ${moveCode(m.reversalOf)}` : '',
    m.reversedBy ? `<span class="text-danger-soft">Estornado por ${moveCode(m.reversedBy)}</span>` : ''
  ].filter(Boolean).map(text => `<p>${text}</p>`).join('');
  const canReverse = item.active && !m.reversedBy && !m.reversalOf;

  return `
    <div class="move ${isIn ? 'is-in' : 'is-out'}${m.reversedBy ? ' is-reversed' : ''}">
      <span class="move-icon"><i class="bi ${m.reason === 'estorno' ? 'bi-arrow-counterclockwise' : isIn ? 'bi-box-arrow-in-down' : 'bi-box-arrow-up'}"></i></span>
      <div class="move-main">
        <strong>${reasonLabel(m)}</strong> <span class="move-tag">${moveCode(m.id)}</span>
        <p>${formatDate(m.date)} · ${escapeHtml(m.user)}${m.packageLabel ? ` · ${escapeHtml(m.packageLabel)}` : ''}</p>
        ${details}
      </div>
      <div class="move-side">
        <span class="move-qty">${isIn ? '+' : '−'}${qtyText(m.qty, item.unit)}</span>
        ${canReverse ? `<button type="button" class="btn btn-outline-green" data-reverse="${m.id}"><i class="bi bi-arrow-counterclockwise me-1"></i>Estornar</button>` : ''}
      </div>
    </div>`;
}

// Troca de modal só depois que a ficha fecha (evita fundo escuro preso na tela).
function fromDetail(callback) {
  returnToDetail = openItemId;
  $('detailModal').addEventListener('hidden.bs.modal', callback, { once: true });
  detailModal.hide();
}

// Ao fechar um formulário aberto pela ficha (salvando ou cancelando), volta para ela.
['itemModal', 'moveModal', 'countModal'].forEach(id => $(id).addEventListener('hidden.bs.modal', () => {
  if (!returnToDetail) return;
  const itemId = returnToDetail;
  returnToDetail = null;
  openDetail(itemId);
}));

$('editItem').addEventListener('click', () => fromDetail(() => openItemForm(findItem(openItemId))));
$('detailIn').addEventListener('click', () => fromDetail(() => openMoveForm({ itemId: openItemId, type: 'entrada' })));
$('detailOut').addEventListener('click', () => fromDetail(() => openMoveForm({ itemId: openItemId, type: 'saida' })));
$('countItem').addEventListener('click', () => fromDetail(() => openCount(openItemId)));

$('toggleActive').addEventListener('click', () => {
  const item = findItem(openItemId);
  const info = infoOf(item.id);
  if (item.active && info.total > 0) {
    notify(`Ainda há ${qtyText(info.total, item.unit)} em estoque. Zere o saldo (saída ou inventário) antes de inativar.`);
    return;
  }
  if (item.active && !window.confirm(`Inativar “${item.name}”? Ele sai da lista, mas o histórico é mantido.`)) return;
  const backup = snapshot();
  item.active = !item.active;
  if (!commit(backup)) return;
  render();
  renderDetail();
  notify(item.active ? 'Item reativado.' : 'Item inativado.');
});

$('deleteItem').addEventListener('click', () => {
  const item = findItem(openItemId);
  if (!item || infoOf(item.id).moveCount > 0 || !window.confirm(`Excluir “${item.name}”? Esta ação não pode ser desfeita.`)) return;
  const backup = snapshot();
  items = items.filter(i => i.id !== item.id);
  if (!commit(backup)) return;
  detailModal.hide();
  render();
  notify('Item excluído.');
});

$('detailModal').addEventListener('click', (event) => {
  const tab = event.target.closest('[data-tab]');
  if (tab) showTab(tab.dataset.tab);
  const reverse = event.target.closest('[data-reverse]');
  if (reverse) reverseMove(Number(reverse.dataset.reverse));
  const discard = event.target.closest('[data-discard]');
  if (discard) {
    const lot = infoOf(openItemId).lots.find(l => l.lot === discard.dataset.discard);
    fromDetail(() => openMoveForm({ itemId: openItemId, type: 'saida', reason: 'perda', lot: lot.lot, qty: lot.qty, note: `Lote ${lot.lot} vencido em ${formatDate(lot.expiry)}.` }));
  }
});

// ================= Eventos da página =================
document.addEventListener('click', (event) => {
  if (event.target.closest('.modal')) return;
  const open = event.target.closest('[data-item]');
  if (open) openDetail(Number(open.dataset.item));
  const moveIn = event.target.closest('[data-move-in]');
  if (moveIn) openMoveForm({ itemId: Number(moveIn.dataset.moveIn), type: 'entrada' });
  const moveOut = event.target.closest('[data-move-out]');
  if (moveOut) openMoveForm({ itemId: Number(moveOut.dataset.moveOut), type: 'saida' });
});

$('search').addEventListener('input', render);
$('categoryFilter').addEventListener('change', render);
$('statusFilter').addEventListener('change', render);
$('showInactive').addEventListener('change', render);
$('clearFilters').addEventListener('click', clearFilters);
$('addItem').addEventListener('click', () => openItemForm());
$('addMove').addEventListener('click', () => openMoveForm());

// Opções dos filtros e do formulário vêm de dados.js
$('categoryFilter').innerHTML += PawData.STOCK_CATEGORIES.map(c => `<option>${c}</option>`).join('');
$('statusFilter').innerHTML += PawData.STOCK_STATUS.map(s => `<option>${s}</option>`).join('');
$('itCategory').innerHTML = PawData.STOCK_CATEGORIES.map(c => `<option>${c}</option>`).join('');
$('itUnit').innerHTML = PawData.STOCK_UNITS.map(u => `<option>${u}</option>`).join('');

render();

// Link direto (dashboard ou outro módulo): estoque.html?item=3
const linkedId = Number(new URLSearchParams(window.location.search).get('item'));
if (findItem(linkedId)) openDetail(linkedId);
