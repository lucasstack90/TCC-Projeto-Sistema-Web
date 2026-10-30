/* PAWSAFE — módulo de Doações / Gestão Financeira
   Registro das doações (origem: pessoa física ou jurídica; categoria: financeira ou material),
   total doado e registro das despesas (recursos usados).
   Depende de: Bootstrap 5, js/dados.js (PawData), js/utils.js (PawUtils) e js/sidebar.js. */

const $ = (id) => document.getElementById(id);
const { today, formatDate, escapeHtml, plural, money } = PawUtils;

// ================= Estado =================
let donations = PawData.loadDonations();
let expenses = PawData.loadExpenses();
let view = 'donations'; // 'donations' | 'expenses'

const donationModal = new bootstrap.Modal($('donationModal'));
const expenseModal = new bootstrap.Modal($('expenseModal'));
const toast = new bootstrap.Toast($('toast'), { delay: 2800 });

const normalize = (text) => String(text ?? '').toLocaleLowerCase('pt-BR');
const sum = (list) => list.reduce((total, item) => total + (item.amount || 0), 0);
const byDateDesc = (a, b) => b.date.localeCompare(a.date) || b.id - a.id;
const donorName = (d) => d.donor || 'Doador não identificado';

function notify(message) {
  $('toastText').textContent = message;
  toast.show();
}

// ================= Totais =================
function renderStats() {
  const received = sum(donations.filter(d => d.type === 'Financeira'));
  const spent = sum(expenses);
  const balance = received - spent;
  const materials = donations.filter(d => d.type === 'Material').length;

  const cards = [
    ['Total doado', money(received), 'bi-arrow-down-circle', 'icon-green', 'Doações financeiras'],
    ['Despesas', money(spent), 'bi-arrow-up-circle', 'icon-terra', 'Recursos usados'],
    ['Saldo', money(balance), 'bi-wallet2', balance < 0 ? 'icon-danger' : 'icon-blue', 'Total doado − despesas'],
    ['Doações materiais', materials, 'bi-box-seam', 'icon-lilac', 'Itens recebidos']
  ];
  $('financeStats').innerHTML = cards.map(([label, value, icon, color, foot]) => `
    <div class="finance-stat">
      <span class="finance-icon ${color}"><i class="bi ${icon}"></i></span>
      <div><small>${label}</small><strong class="${label === 'Saldo' && balance < 0 ? 'negative' : ''}">${value}</strong><span>${foot}</span></div>
    </div>`).join('');

  $('donationText').textContent = plural(donations.length, 'doação registrada', 'doações registradas');
  $('expenseText').textContent = plural(expenses.length, 'despesa registrada', 'despesas registradas');
}

// ================= Listas =================
function donationRows() {
  const term = normalize($('donationSearch').value.trim());
  const type = $('typeFilter').value;
  const origin = $('originFilter').value;
  const list = donations
    .filter(d => !type || d.type === type)
    .filter(d => !origin || d.origin === origin)
    .filter(d => !term || normalize([d.donor, d.item, d.notes, d.method].join(' ')).includes(term))
    .sort(byDateDesc);

  $('donationRows').innerHTML = list.map(d => `
    <tr class="clickable-row" data-donation="${d.id}">
      <td>${formatDate(d.date)}</td>
      <td><strong>${escapeHtml(donorName(d))}</strong><small>${d.origin}</small></td>
      <td><span class="status-badge type-${d.type === 'Financeira' ? 'financeira' : 'material'}">${d.type}</span></td>
      <td>${d.type === 'Financeira' ? escapeHtml(d.method) : `${escapeHtml(d.item)} — ${d.quantity} ${d.unit}`}</td>
      <td class="text-end amount">${d.type === 'Financeira' ? money(d.amount) : '—'}</td>
    </tr>`).join('');
  return list.length;
}

function expenseRows() {
  const term = normalize($('expenseSearch').value.trim());
  const category = $('categoryFilter').value;
  const list = expenses
    .filter(e => !category || e.category === category)
    .filter(e => !term || normalize([e.description, e.paidTo, e.notes].join(' ')).includes(term))
    .sort(byDateDesc);

  $('expenseRows').innerHTML = list.map(e => `
    <tr class="clickable-row" data-expense="${e.id}">
      <td>${formatDate(e.date)}</td>
      <td><strong>${escapeHtml(e.description)}</strong>${e.notes ? `<small>${escapeHtml(e.notes)}</small>` : ''}</td>
      <td>${escapeHtml(e.category)}</td>
      <td>${escapeHtml(e.paidTo || '—')}</td>
      <td class="text-end amount expense">− ${money(e.amount)}</td>
    </tr>`).join('');
  return list.length;
}

function render() {
  renderStats();
  const count = view === 'donations' ? donationRows() : expenseRows();
  const current = view === 'donations' ? 'donationsView' : 'expensesView';
  $(current).querySelector('.table-card').classList.toggle('d-none', !count);
  $('empty').classList.toggle('d-none', count > 0);
}

function setView(next) {
  view = next;
  document.querySelectorAll('[data-view]').forEach(tab => tab.classList.toggle('active', tab.dataset.view === next));
  $('donationsView').classList.toggle('d-none', next !== 'donations');
  $('expensesView').classList.toggle('d-none', next !== 'expenses');
  render();
}

// ================= Doação =================
// Mostra só os campos da categoria escolhida e torna obrigatórios apenas esses.
function toggleDonationFields() {
  const financial = $('dType').value === 'Financeira';
  document.querySelectorAll('.financial-field').forEach(el => el.classList.toggle('d-none', !financial));
  document.querySelectorAll('.material-field').forEach(el => el.classList.toggle('d-none', financial));
  ['dAmount', 'dMethod'].forEach(id => { $(id).required = financial; });
  ['dItem', 'dQuantity', 'dUnit'].forEach(id => { $(id).required = !financial; });
}

function openDonation(d = null) {
  $('donationForm').reset();
  $('donationId').value = d?.id ?? '';
  $('dDate').max = today();
  $('dDate').value = d?.date ?? today();
  $('dOrigin').value = d?.origin ?? 'Pessoa física';
  $('dDonor').value = d?.donor ?? '';
  $('dType').value = d?.type ?? 'Financeira';
  $('dAmount').value = d?.amount ?? '';
  $('dMethod').value = d?.method || 'PIX';
  $('dItem').value = d?.item ?? '';
  $('dQuantity').value = d?.quantity ?? '';
  $('dUnit').value = d?.unit || 'kg';
  $('dNotes').value = d?.notes ?? '';
  toggleDonationFields();

  $('donationTitle').textContent = d ? 'Editar doação' : 'Registrar doação';
  $('saveDonationButton').innerHTML = `<i class="bi bi-check2 me-2"></i>${d ? 'Salvar alterações' : 'Registrar doação'}`;
  $('deleteDonation').classList.toggle('d-none', !d);
  donationModal.show();
}

$('donationForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const financial = $('dType').value === 'Financeira';
  const existing = donations.find(d => d.id === Number($('donationId').value));
  const data = {
    date: $('dDate').value,
    origin: $('dOrigin').value,
    donor: $('dDonor').value.trim(),
    type: $('dType').value,
    // Os campos da outra categoria são limpos para não guardar dado sem sentido
    amount: financial ? Number($('dAmount').value) : null,
    method: financial ? $('dMethod').value : '',
    item: financial ? '' : $('dItem').value.trim(),
    quantity: financial ? null : Number($('dQuantity').value),
    unit: financial ? '' : $('dUnit').value,
    notes: $('dNotes').value.trim()
  };

  if (existing) Object.assign(existing, data);
  else donations.push({ id: PawUtils.nextId(donations), ...data });
  if (!PawData.saveDonations(donations)) return notify('Não foi possível salvar.');

  donationModal.hide();
  setView('donations');
  notify(existing ? 'Doação atualizada.' : `Doação registrada${financial ? `: ${money(data.amount)}` : ''}.`);
});

$('deleteDonation').addEventListener('click', () => {
  const id = Number($('donationId').value);
  if (!window.confirm('Excluir esta doação? O total doado será recalculado.')) return;
  donations = donations.filter(d => d.id !== id);
  PawData.saveDonations(donations);
  donationModal.hide();
  render();
  notify('Doação excluída.');
});

// ================= Despesa =================
function openExpense(e = null) {
  $('expenseForm').reset();
  $('expenseId').value = e?.id ?? '';
  $('eDate').max = today();
  $('eDate').value = e?.date ?? today();
  $('eCategory').value = e?.category ?? 'Veterinário';
  $('eDescription').value = e?.description ?? '';
  $('eAmount').value = e?.amount ?? '';
  $('ePaidTo').value = e?.paidTo ?? '';
  $('eNotes').value = e?.notes ?? '';

  $('expenseTitle').textContent = e ? 'Editar despesa' : 'Registrar despesa';
  $('saveExpenseButton').innerHTML = `<i class="bi bi-check2 me-2"></i>${e ? 'Salvar alterações' : 'Registrar despesa'}`;
  $('deleteExpense').classList.toggle('d-none', !e);
  expenseModal.show();
}

$('expenseForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const existing = expenses.find(e => e.id === Number($('expenseId').value));
  const data = {
    date: $('eDate').value,
    category: $('eCategory').value,
    description: $('eDescription').value.trim(),
    amount: Number($('eAmount').value),
    paidTo: $('ePaidTo').value.trim(),
    notes: $('eNotes').value.trim()
  };

  // Aviso (não bloqueio): a organização pode ter recursos fora do sistema.
  const balanceAfter = sum(donations.filter(d => d.type === 'Financeira')) - sum(expenses) + (existing?.amount || 0) - data.amount;
  if (balanceAfter < 0 && !window.confirm(`Com esta despesa o saldo fica negativo (${money(balanceAfter)}). Registrar mesmo assim?`)) return;

  if (existing) Object.assign(existing, data);
  else expenses.push({ id: PawUtils.nextId(expenses), ...data });
  if (!PawData.saveExpenses(expenses)) return notify('Não foi possível salvar.');

  expenseModal.hide();
  setView('expenses');
  notify(existing ? 'Despesa atualizada.' : `Despesa registrada: ${money(data.amount)}.`);
});

$('deleteExpense').addEventListener('click', () => {
  const id = Number($('expenseId').value);
  if (!window.confirm('Excluir esta despesa? O saldo será recalculado.')) return;
  expenses = expenses.filter(e => e.id !== id);
  PawData.saveExpenses(expenses);
  expenseModal.hide();
  render();
  notify('Despesa excluída.');
});

// ================= Eventos =================
document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-view], [data-donation], [data-expense]');
  if (!target) return;
  const d = target.dataset;
  if (d.view) setView(d.view);
  else if (d.donation) openDonation(donations.find(x => x.id === Number(d.donation)));
  else if (d.expense) openExpense(expenses.find(x => x.id === Number(d.expense)));
});

$('dType').addEventListener('change', toggleDonationFields);
['donationSearch', 'expenseSearch'].forEach(id => $(id).addEventListener('input', render));
['typeFilter', 'originFilter', 'categoryFilter'].forEach(id => $(id).addEventListener('change', render));
$('addDonation').addEventListener('click', () => openDonation());
$('addExpense').addEventListener('click', () => openExpense());

// Opções vindas de dados.js
const options = (list) => list.map(item => `<option>${item}</option>`).join('');
$('typeFilter').innerHTML += options(PawData.DONATION_TYPES);
$('originFilter').innerHTML += options(PawData.ORIGINS);
$('categoryFilter').innerHTML += options(PawData.EXPENSE_CATEGORIES);
$('dOrigin').innerHTML = options(PawData.ORIGINS);
$('dType').innerHTML = options(PawData.DONATION_TYPES);
$('dMethod').innerHTML = options(PawData.PAYMENT_METHODS);
$('dUnit').innerHTML = options(PawData.UNITS);
$('eCategory').innerHTML = options(PawData.EXPENSE_CATEGORIES);

render();
