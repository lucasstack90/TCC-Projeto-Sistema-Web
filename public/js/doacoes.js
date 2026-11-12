/* PAWSAFE — módulo de Doações / Gestão Financeira
   Registro das doações (origem: pessoa física ou jurídica; categoria: financeira ou material),
   total doado e registro das despesas (recursos usados).
   O saldo é calculado em js/financeiro.js (PawFinance) e se atualiza sozinho a cada despesa.
   Aba Resumo: fôlego de caixa, fluxo mensal, orçamento por categoria, custo por animal,
   maiores doadores e exportação da prestação de contas.
   Aba Contribuintes: cadastro de doadores frequentes e fornecedores (CPF/CNPJ), selecionados
   nas doações e despesas em vez de digitar o nome (js/contribuintes.js, dados no MySQL).
   Doações e despesas ainda ficam no localStorage e guardam o id do contribuinte + o nome da época.
   Depende de: Bootstrap 5, Chart.js, js/dados.js (PawData), js/utils.js (PawUtils), js/api.js (PawApi),
   js/financeiro.js (PawFinance), js/contribuintes.js (PawContributors) e js/sidebar.js. */

const $ = (id) => document.getElementById(id);
const { today, formatDate, escapeHtml, plural, money } = PawUtils;
const F = PawFinance;

// ================= Estado =================
let donations = PawData.loadDonations();
let expenses = PawData.loadExpenses();
let budgets = PawData.loadBudgets();
let opening = PawData.loadOpening();
const animals = PawData.loadAnimals();
let view = 'summary'; // 'summary' | 'donations' | 'expenses' | 'contributors'
let month = F.monthKey(today());
let balanceChange = null; // { before, after } — destaque no card de Saldo após uma despesa
let flowChart = null;

const donationModal = new bootstrap.Modal($('donationModal'));
const expenseModal = new bootstrap.Modal($('expenseModal'));
const settingsModal = new bootstrap.Modal($('settingsModal'));
const toast = new bootstrap.Toast($('toast'), { delay: 4500 });

const normalize = (text) => String(text ?? '').toLocaleLowerCase('pt-BR');
const byDateDesc = (a, b) => b.date.localeCompare(a.date) || b.id - a.id;
const C = PawContributors;
let contributorsFailed = false;
// Nome atual do cadastro (se o contribuinte foi editado) ou o nome gravado no lançamento.
const donorName = (d) => (d.contributorId && C.label(C.find(d.contributorId))) || d.donor || 'Doador não identificado';
const payeeName = (e) => (e.contributorId && C.label(C.find(e.contributorId))) || e.paidTo || '';
const percent = (ratio) => `${Math.round(ratio * 100)}%`;
const animalName = (id) => animals.find(a => a.id === id)?.name;

// Cores do gráfico (validadas para daltonismo: entradas × saídas × saldo)
// Cores do gráfico vêm dos tokens do tema (CSS/tema.css)
const COLOR_TOKENS = { income: '--chart-entrada', outcome: '--chart-saida', balance: '--chart-saldo' };

function notify(message, detail = '') {
  $('toastText').textContent = message;
  $('toastDetail').textContent = detail;
  $('toastDetail').classList.toggle('d-none', !detail);
  toast.show();
}

// ================= Totais (topo da página) =================
function renderStats() {
  const { initial, received, spent, balance, materials } = F.totals(donations, expenses, opening);

  // Depois de registrar/editar/excluir uma despesa, o card mostra de onde o saldo veio
  const change = balanceChange && balanceChange.before !== balanceChange.after
    ? `<em class="balance-change">${money(balanceChange.before)} → ${money(balanceChange.after)}</em>` : '';

  const cards = [
    { label: 'Total doado', value: money(received), icon: 'bi-arrow-down-circle', color: 'icon-green', foot: 'Doações financeiras' },
    { label: 'Despesas', value: money(spent), icon: 'bi-arrow-up-circle', color: 'icon-terra', foot: 'Recursos usados' },
    {
      label: 'Saldo', value: money(balance), icon: 'bi-wallet2', color: balance < 0 ? 'icon-danger' : 'icon-blue',
      foot: change || `Saldo inicial ${money(initial)} + doações − despesas`, id: 'balanceCard', negative: balance < 0
    },
    { label: 'Doações materiais', value: materials, icon: 'bi-box-seam', color: 'icon-lilac', foot: 'Itens recebidos' }
  ];
  $('financeStats').innerHTML = cards.map(c => `
    <div class="finance-stat${c.id && change ? ' updated' : ''}"${c.id ? ` id="${c.id}"` : ''}>
      <span class="finance-icon ${c.color}"><i class="bi ${c.icon}"></i></span>
      <div><small>${c.label}</small><strong class="${c.negative ? 'negative' : ''}">${c.value}</strong><span>${c.foot}</span></div>
    </div>`).join('');

  $('donationText').textContent = plural(donations.length, 'doação registrada', 'doações registradas');
  $('expenseText').textContent = plural(expenses.length, 'despesa registrada', 'despesas registradas');
}

// O destaque some sozinho depois de alguns segundos
let changeTimer = null;
function highlightBalance(before) {
  const after = F.totals(donations, expenses, opening).balance;
  balanceChange = { before, after };
  clearTimeout(changeTimer);
  changeTimer = setTimeout(() => { balanceChange = null; renderStats(); }, 6000);
  return after;
}

// ================= Resumo =================
const LEVEL = {
  healthy: { label: 'Saudável', icon: 'bi-check-circle-fill', cls: 'level-ok' },
  ok: { label: 'Dentro do orçamento', icon: 'bi-check-circle-fill', cls: 'level-ok' },
  warning: { label: 'Atenção', icon: 'bi-exclamation-triangle-fill', cls: 'level-warning' },
  over: { label: 'Estourado', icon: 'bi-x-octagon-fill', cls: 'level-critical' },
  critical: { label: 'Crítico', icon: 'bi-x-octagon-fill', cls: 'level-critical' }
};
const badge = (level, label = LEVEL[level].label) => `<span class="level-badge ${LEVEL[level].cls}"><i class="bi ${LEVEL[level].icon}"></i>${label}</span>`;
const bar = (ratio, level) => `<div class="meter" role="presentation"><span class="${LEVEL[level].cls}" style="width:${Math.min(100, Math.round(ratio * 100))}%"></span></div>`;

function renderInsights() {
  // 1. Fôlego de caixa
  const r = F.runway(donations, expenses, opening);
  const runwayValue = r.months === Infinity ? '—' : `${r.months.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${r.months >= 1 && r.months < 2 ? 'mês' : 'meses'}`;
  const runwayFoot = r.months === Infinity
    ? `Sem despesas nos últimos ${r.window} meses para calcular a média.`
    : `Média de ${money(r.monthlyAverage)}/mês nos últimos ${r.window} meses. ` +
      (r.gap > 0 ? `Faltam <strong>${money(r.gap)}</strong> para a reserva de ${F.RESERVE_MONTHS} meses.` : `Reserva de ${F.RESERVE_MONTHS} meses atingida.`);

  // 2. Resultado do mês escolhido
  const [m] = F.monthlyFlow(donations, expenses, [month], opening);
  const idle = !m.income && !m.outcome;
  const monthLevel = m.net >= 0 ? 'healthy' : 'critical';
  const monthBadge = idle ? '<span class="level-badge level-neutral"><i class="bi bi-dash-circle"></i>Sem lançamentos</span>' : badge(monthLevel, m.net >= 0 ? 'Superávit' : 'Déficit');

  // 3. Dependência de doadores
  const d = F.donorRanking(donations);
  const pf = d.total ? d.byOrigin['Pessoa física'] / d.total : 0;
  const donorLevel = d.concentrated ? 'warning' : 'healthy';

  $('insights').innerHTML = `
    <article class="insight">
      <header><small>Fôlego de caixa</small>${badge(r.level)}</header>
      <strong>${runwayValue}</strong>
      ${r.months === Infinity ? '' : bar(r.months / F.RESERVE_MONTHS, r.level)}
      <p>${runwayFoot}</p>
    </article>
    <article class="insight">
      <header><small>Resultado de ${F.monthName(month)}</small>${monthBadge}</header>
      <strong class="${m.net < 0 ? 'negative' : ''}">${m.net < 0 ? '− ' : ''}${money(Math.abs(m.net))}</strong>
      <p>Entradas ${money(m.income)} · Saídas ${money(m.outcome)}</p>
    </article>
    <article class="insight">
      <header><small>Dependência de doadores</small>${badge(donorLevel, d.concentrated ? 'Concentrada' : 'Diversificada')}</header>
      <strong>${d.top ? percent(d.top.share) : '—'}</strong>
      <p>${d.top ? `do total vem de <strong>${escapeHtml(d.top.donor)}</strong>. ` : ''}Pessoa física ${percent(pf)} · jurídica ${percent(d.total ? 1 - pf : 0)} · ${plural(d.recurring, 'doador recorrente', 'doadores recorrentes')}.</p>
    </article>`;
}

function renderFlow() {
  const flow = F.monthlyFlow(donations, expenses, F.lastMonths(6, `${month}-01`), opening);
  $('flowRows').innerHTML = flow.map(f => `
    <tr${f.key === month ? ' class="current"' : ''}>
      <td>${f.label}</td>
      <td class="text-end">${money(f.income)}</td>
      <td class="text-end">${money(f.outcome)}</td>
      <td class="text-end ${f.net < 0 ? 'negative' : ''}">${f.net < 0 ? '− ' : ''}${money(Math.abs(f.net))}</td>
      <td class="text-end"><strong>${money(f.balance)}</strong></td>
    </tr>`).join('');

  if (typeof Chart === 'undefined') return; // sem internet: a tabela continua com os números
  const data = {
    labels: flow.map(f => f.label),
    datasets: [
      { type: 'line', label: 'Saldo ao fim do mês', data: flow.map(f => f.balance), borderColor: PawTema.cor(COLOR_TOKENS.balance), backgroundColor: PawTema.cor(COLOR_TOKENS.balance), tokens: { borderColor: COLOR_TOKENS.balance, backgroundColor: COLOR_TOKENS.balance }, borderWidth: 2, pointRadius: 4, pointHoverRadius: 6, tension: 0.25, order: 0 },
      { type: 'bar', label: 'Entradas', data: flow.map(f => f.income), backgroundColor: PawTema.cor(COLOR_TOKENS.income), tokens: { backgroundColor: COLOR_TOKENS.income }, borderRadius: 4, maxBarThickness: 22, order: 1 },
      { type: 'bar', label: 'Saídas', data: flow.map(f => f.outcome), backgroundColor: PawTema.cor(COLOR_TOKENS.outcome), tokens: { backgroundColor: COLOR_TOKENS.outcome }, borderRadius: 4, maxBarThickness: 22, order: 2 }
    ]
  };
  if (flowChart) {
    flowChart.data = data;
    flowChart.update();
    return;
  }
  Chart.defaults.font.family = "'DM Sans', sans-serif";
  Chart.defaults.color = PawTema.cor('--chart-text');
  flowChart = new Chart($('flowChart'), {
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, padding: 14 } },
        tooltip: { backgroundColor: PawTema.cor('--chart-tooltip'), padding: 11, callbacks: { label: ctx => ` ${ctx.dataset.label}: ${money(ctx.parsed.y)}` } }
      },
      scales: {
        x: { grid: { display: false }, border: { display: false } },
        y: { beginAtZero: true, ticks: { callback: v => money(v).replace(',00', '') }, grid: { color: PawTema.cor('--chart-grid') }, border: { display: false } }
      }
    }
  });
}

function renderBudget() {
  const usage = F.budgetUsage(expenses, budgets, month).sort((a, b) => b.ratio - a.ratio || b.spent - a.spent);
  const planned = usage.reduce((t, u) => t + u.budget, 0);
  const used = usage.reduce((t, u) => t + u.spent, 0);
  $('budgetSubtitle').textContent = `${F.monthName(month)} · ${money(used)} de ${money(planned)} planejados (${planned ? percent(used / planned) : '—'})`;
  $('budgetList').innerHTML = usage.map(u => `
    <div class="budget-row">
      <div class="budget-head">
        <span>${escapeHtml(u.category)}</span>
        ${u.level === 'ok' ? '' : badge(u.level)}
        <small>${money(u.spent)} ${u.budget ? `de ${money(u.budget)}` : '· sem limite'}</small>
      </div>
      ${u.budget ? bar(u.ratio, u.level) : ''}
    </div>`).join('');
}

function renderAnimalCost() {
  const c = F.costPerAnimal(expenses, animals);
  if (!c.list.length) {
    $('animalCost').innerHTML = '<p class="summary-empty">Nenhuma despesa vinculada a um animal. Ao registrar uma despesa, escolha o animal relacionado.</p>';
    return;
  }
  $('animalCost').innerHTML = `
    <ul class="rank-list">${c.list.slice(0, 5).map(e => `
      <li><span class="rank-name">${escapeHtml(e.animal?.name || `Animal #${e.animalId}`)}<small>${plural(e.count, 'despesa', 'despesas')}${e.animal ? ` · ${escapeHtml(e.animal.status)}` : ''}</small></span><strong>${money(e.total)}</strong></li>`).join('')}
    </ul>
    <p class="rank-foot">Custo médio por animal atendido: <strong>${money(c.average)}</strong> · ${percent(c.linkedShare)} das despesas estão vinculadas a um animal.</p>`;
}

function renderDonors() {
  const d = F.donorRanking(donations);
  if (!d.total) {
    $('donorList').innerHTML = '<p class="summary-empty">Nenhuma doação financeira registrada.</p>';
    return;
  }
  $('donorList').innerHTML = `
    <ul class="rank-list">${d.ranking.slice(0, 5).map(e => `
      <li>
        <span class="rank-name">${escapeHtml(e.donor)}<small>${e.origin} · ${plural(e.count, 'doação', 'doações')}${e.recurring ? ' · <b>recorrente</b>' : ''}</small></span>
        <span class="rank-value"><strong>${money(e.amount)}</strong><small>${percent(e.share)}</small></span>
      </li>`).join('')}
    </ul>
    <p class="rank-foot">${d.anonymous ? `Doações sem doador identificado: <strong>${money(d.anonymous)}</strong> (${percent(d.anonymous / d.total)}). ` : ''}${d.concentrated
      ? `Mais de ${percent(F.CONCENTRATION_LIMIT)} vem de um só doador: se ele parar, o caixa sente. Vale buscar novos apoiadores.`
      : 'Nenhum doador responde sozinho por mais de ' + percent(F.CONCENTRATION_LIMIT) + ' do arrecadado.'}</p>`;
}

function renderSummary() {
  renderInsights();
  renderFlow();
  renderBudget();
  renderAnimalCost();
  renderDonors();
}

// Meses para o seletor: os últimos 12 e qualquer mês com lançamento, do mais novo para o mais antigo
function renderMonthOptions() {
  const keys = new Set([...F.lastMonths(12), ...donations.map(d => F.monthKey(d.date)), ...expenses.map(e => F.monthKey(e.date))]);
  $('monthSelect').innerHTML = [...keys].sort().reverse()
    .map(k => `<option value="${k}"${k === month ? ' selected' : ''}>${F.capitalize(F.monthName(k))}</option>`).join('');
}

// ================= Listas =================
function donationRows() {
  const term = normalize($('donationSearch').value.trim());
  const type = $('typeFilter').value;
  const origin = $('originFilter').value;
  const list = donations
    .filter(d => !type || d.type === type)
    .filter(d => !origin || d.origin === origin)
    .filter(d => !term || normalize([donorName(d), d.item, d.notes, d.method].join(' ')).includes(term))
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
    .filter(e => !term || normalize([e.description, payeeName(e), e.notes, animalName(e.animalId)].join(' ')).includes(term))
    .sort(byDateDesc);

  $('expenseRows').innerHTML = list.map(e => {
    const animal = animalName(e.animalId);
    const details = [animal && `<i class="bi bi-paw"></i> ${escapeHtml(animal)}`, e.notes && escapeHtml(e.notes)].filter(Boolean).join(' · ');
    return `
    <tr class="clickable-row" data-expense="${e.id}">
      <td>${formatDate(e.date)}</td>
      <td><strong>${escapeHtml(e.description)}</strong>${details ? `<small>${details}</small>` : ''}</td>
      <td>${escapeHtml(e.category)}</td>
      <td>${escapeHtml(payeeName(e) || '—')}</td>
      <td class="text-end amount expense">− ${money(e.amount)}</td>
    </tr>`;
  }).join('');
  return list.length;
}

// ================= Contribuintes =================
function contributorRows() {
  const term = normalize($('contributorSearch').value.trim());
  const termDigits = PawUtils.digits(term);
  const type = $('contributorTypeFilter').value;
  const role = $('contributorRoleFilter').value;
  const list = C.list()
    .filter(c => !type || c.type === type)
    .filter(c => role === 'inactive' ? !c.active : (c.active || role === '') && (!role || c[role]))
    .filter(c => !term
      || normalize([c.name, c.tradeName, c.contact, c.city, c.email, c.phone].join(' ')).includes(term)
      || (termDigits.length >= 3 && PawUtils.digits(c.document).includes(termDigits)));

  $('contributorRows').innerHTML = list.map(c => {
    const given = donations.filter(d => d.contributorId === c.id);
    const financial = given.filter(F.isFinancial);
    const paid = expenses.filter(e => e.contributorId === c.id);
    const totalGiven = financial.reduce((s, d) => s + (Number(d.amount) || 0), 0);
    const totalPaid = paid.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const place = [c.city, c.uf].filter(Boolean).join(' - ');
    return `
    <tr class="clickable-row" data-contributor="${c.id}">
      <td><strong>${escapeHtml(C.label(c))}</strong><small>${[c.contact && `Contato: ${escapeHtml(c.contact)}`, place && escapeHtml(place)].filter(Boolean).join(' · ') || '&nbsp;'}</small></td>
      <td>${escapeHtml(c.documentMasked)}<small>${c.type}</small></td>
      <td>${escapeHtml(c.phone)}<small>${escapeHtml(c.email || '—')}</small></td>
      <td><div class="role-tags">
        ${c.donor ? '<span class="status-badge type-financeira">Doador</span>' : ''}
        ${c.supplier ? '<span class="status-badge type-material">Fornecedor</span>' : ''}
        ${c.active ? '' : '<span class="status-badge volunteer-inativo">Inativo</span>'}
      </div></td>
      <td class="text-end"><span class="amount">${financial.length ? money(totalGiven) : '—'}</span>
        <small>${[given.length && plural(given.length, 'doação', 'doações'), paid.length && `pago ${money(totalPaid)}`].filter(Boolean).join(' · ') || 'sem lançamentos'}</small></td>
    </tr>`;
  }).join('');
  return list.length;
}

function render() {
  renderStats();
  if (view === 'summary') {
    renderSummary();
    $('empty').classList.add('d-none');
    return;
  }
  const count = view === 'donations' ? donationRows() : view === 'expenses' ? expenseRows() : contributorRows();
  $(`${view}View`).querySelector('.table-card').classList.toggle('d-none', !count);
  $('empty').classList.toggle('d-none', count > 0);
}

function setView(next) {
  view = next;
  document.querySelectorAll('[data-view]').forEach(tab => tab.classList.toggle('active', tab.dataset.view === next));
  ['summary', 'donations', 'expenses', 'contributors'].forEach(v => $(`${v}View`).classList.toggle('d-none', v !== next));
  render();
}

// ================= Seleção do contribuinte (doação e despesa) =================
// '' = anônimo / não informado · número = contribuinte cadastrado · 'other' = nome digitado, sem cadastro
function fillContributorSelects() {
  const keep = { d: $('dContributor').value, e: $('eContributor').value };
  $('dContributor').innerHTML = `<option value="">Anônimo / não identificado</option>
    <optgroup label="Contribuintes cadastrados">${C.options('donor', keep.d)}</optgroup>
    <option value="other">Doador avulso (digitar o nome, sem cadastro)…</option>`;
  $('eContributor').innerHTML = `<option value="">Não informado</option>
    <optgroup label="Fornecedores cadastrados">${C.options('supplier', keep.e)}</optgroup>
    <option value="other">Fornecedor avulso (digitar o nome, sem cadastro)…</option>`;
  if (keep.d) $('dContributor').value = keep.d;
  if (keep.e) $('eContributor').value = keep.e;
}

// Valor do <select> a partir do lançamento salvo
const selectValue = (item, name) => (item?.contributorId ? String(item.contributorId) : item?.[name] ? 'other' : '');

function syncDonorField() {
  const value = $('dContributor').value;
  const contributor = C.find(value);
  const other = value === 'other';
  $('dDonorWrap').classList.toggle('d-none', !other);
  $('dDonor').required = other;
  // Contribuinte cadastrado: a origem (PF/PJ) vem do cadastro.
  $('dOrigin').disabled = Boolean(contributor);
  if (contributor) $('dOrigin').value = contributor.type;
  $('dContributorHint').innerHTML = contributor
    ? `${escapeHtml(contributor.type)} · ${escapeHtml(contributor.documentMasked)} · ${escapeHtml(contributor.phone)}`
    : other ? 'Use para quem doa uma única vez. Quem doa com frequência: clique em <strong>Cadastrar</strong>.'
      : C.isLoaded() ? 'Selecione um contribuinte cadastrado, ou deixe anônimo.'
        : contributorsFailed ? 'Não foi possível carregar os contribuintes cadastrados. Registre como avulso ou recarregue a página.'
          : 'Carregando contribuintes cadastrados…';
}

function syncPayeeField() {
  const other = $('eContributor').value === 'other';
  $('ePaidToWrap').classList.toggle('d-none', !other);
  $('ePaidTo').required = other;
}

// "Cadastrar" ao lado do select: fecha o lançamento, abre o cadastro e volta com o novo contribuinte
// já selecionado (sem perder o que foi digitado — o formulário não é reiniciado).
function newContributorFrom(which) {
  const isDonation = which === 'donation';
  const formModal = isDonation ? donationModal : expenseModal;
  $(isDonation ? 'donationModal' : 'expenseModal').addEventListener('hidden.bs.modal', () => {
    C.openForm(null, {
      role: isDonation ? 'donor' : 'supplier',
      type: isDonation && !$('dOrigin').disabled ? $('dOrigin').value : undefined,
      onDone: (saved) => {
        fillContributorSelects();
        if (saved && !saved.removed) $(isDonation ? 'dContributor' : 'eContributor').value = String(saved.id);
        syncDonorField();
        syncPayeeField();
        formModal.show();
      }
    });
  }, { once: true });
  formModal.hide();
}

function openContributor(c = null) {
  C.openForm(c, { onDone: (saved) => { if (saved) syncContributorSnapshots(saved); render(); } });
}

// Doações e despesas guardam o nome da época. Ao editar o cadastro, o nome acompanha;
// ao excluir (anonimizar, LGPD), o nome sai também dos lançamentos deste navegador.
function syncContributorSnapshots(c) {
  let changedD = false;
  let changedE = false;
  donations.filter(d => d.contributorId === c.id).forEach(d => {
    if (c.removed) { d.donor = `Contribuinte removido #${c.id}`; d.contributorId = null; } else { d.donor = C.label(c); d.origin = c.type; }
    changedD = true;
  });
  expenses.filter(e => e.contributorId === c.id).forEach(e => {
    if (c.removed) { e.paidTo = `Contribuinte removido #${c.id}`; e.contributorId = null; } else e.paidTo = C.label(c);
    changedE = true;
  });
  if (changedD) PawData.saveDonations(donations);
  if (changedE) PawData.saveExpenses(expenses);
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
  fillContributorSelects();
  $('dContributor').value = selectValue(d, 'donor');
  $('dDonor').value = d?.contributorId ? '' : (d?.donor ?? '');
  syncDonorField();
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
  const before = F.totals(donations, expenses, opening).balance;
  const contributor = C.find($('dContributor').value);
  const data = {
    date: $('dDate').value,
    origin: contributor ? contributor.type : $('dOrigin').value,
    contributorId: contributor ? contributor.id : null,
    donor: contributor ? C.label(contributor) : $('dContributor').value === 'other' ? $('dDonor').value.trim() : '',
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

  const after = highlightBalance(before);
  donationModal.hide();
  renderMonthOptions();
  setView('donations');
  notify(existing ? 'Doação atualizada.' : `Doação registrada${financial ? `: ${money(data.amount)}` : ''}.`,
    before !== after ? `Saldo: ${money(before)} → ${money(after)}` : '');
});

$('deleteDonation').addEventListener('click', () => {
  const id = Number($('donationId').value);
  if (!window.confirm('Excluir esta doação? O total doado e o saldo serão recalculados.')) return;
  const before = F.totals(donations, expenses, opening).balance;
  donations = donations.filter(d => d.id !== id);
  PawData.saveDonations(donations);
  const after = highlightBalance(before);
  donationModal.hide();
  render();
  notify('Doação excluída.', before !== after ? `Saldo: ${money(before)} → ${money(after)}` : '');
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
  fillContributorSelects();
  $('eContributor').value = selectValue(e, 'paidTo');
  $('ePaidTo').value = e?.contributorId ? '' : (e?.paidTo ?? '');
  syncPayeeField();
  $('eAnimal').value = e?.animalId ?? '';
  $('eNotes').value = e?.notes ?? '';

  $('expenseTitle').textContent = e ? 'Editar despesa' : 'Registrar despesa';
  $('saveExpenseButton').innerHTML = `<i class="bi bi-check2 me-2"></i>${e ? 'Salvar alterações' : 'Registrar despesa'}`;
  $('deleteExpense').classList.toggle('d-none', !e);
  updateExpensePreview();
  expenseModal.show();
}

// Prévia ao vivo: enquanto o valor é digitado, mostra como ficam o saldo e o orçamento da categoria.
function expenseImpact() {
  const existing = expenses.find(e => e.id === Number($('expenseId').value));
  const amount = Number($('eAmount').value) || 0;
  const category = $('eCategory').value;
  const expenseMonth = F.monthKey($('eDate').value || today());
  const before = F.totals(donations, expenses, opening).balance;
  const after = F.balanceAfterExpense(donations, expenses, opening, amount, existing?.amount || 0);
  // Orçamento como ficaria: tira a versão antiga desta despesa e entra a nova
  const simulated = [...expenses.filter(e => e !== existing), { category, date: `${expenseMonth}-01`, amount }];
  const budget = F.budgetStatus(simulated, budgets, category, expenseMonth);
  return { amount, before, after, budget, expenseMonth };
}

function updateExpensePreview() {
  const { amount, before, after, budget, expenseMonth } = expenseImpact();
  if (!amount) {
    $('expensePreview').innerHTML = `<span><i class="bi bi-wallet2"></i> Saldo atual: <strong>${money(before)}</strong></span>`;
    $('expensePreview').className = 'expense-preview';
    return;
  }
  const budgetText = budget.budget
    ? `${escapeHtml(budget.category)} em ${F.monthLabel(expenseMonth)}: ${money(budget.spent)} de ${money(budget.budget)} (${percent(budget.ratio)})`
    : `${escapeHtml(budget.category)} sem orçamento definido`;
  const level = after < 0 || budget.level === 'over' ? 'critical' : budget.level === 'warning' ? 'warning' : 'ok';
  $('expensePreview').className = `expense-preview preview-${level}`;
  $('expensePreview').innerHTML = `
    <span><i class="bi bi-wallet2"></i> Saldo: ${money(before)} → <strong>${money(after)}</strong></span>
    <span><i class="bi bi-pie-chart"></i> ${budgetText}</span>`;
}

$('expenseForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const existing = expenses.find(e => e.id === Number($('expenseId').value));
  const { before, after, budget, expenseMonth } = expenseImpact();
  const payee = C.find($('eContributor').value);
  const data = {
    date: $('eDate').value,
    category: $('eCategory').value,
    description: $('eDescription').value.trim(),
    amount: Number($('eAmount').value),
    contributorId: payee ? payee.id : null,
    paidTo: payee ? C.label(payee) : $('eContributor').value === 'other' ? $('ePaidTo').value.trim() : '',
    animalId: Number($('eAnimal').value) || null,
    notes: $('eNotes').value.trim()
  };

  // Aviso (não bloqueio): a organização pode ter recursos fora do sistema.
  if (after < 0 && !window.confirm(`Com esta despesa o saldo fica negativo (${money(after)}). Registrar mesmo assim?`)) return;

  if (existing) Object.assign(existing, data);
  else expenses.push({ id: PawUtils.nextId(expenses), ...data });
  if (!PawData.saveExpenses(expenses)) return notify('Não foi possível salvar.');

  // Atualização automática do saldo: recalcula a partir dos lançamentos e destaca a mudança
  highlightBalance(before);
  expenseModal.hide();
  renderMonthOptions();
  setView('expenses');

  const budgetAlert = budget.level === 'over'
    ? ` · Orçamento de ${budget.category} estourado em ${F.monthLabel(expenseMonth)} (${percent(budget.ratio)})`
    : budget.level === 'warning' ? ` · ${budget.category} já usou ${percent(budget.ratio)} do orçamento de ${F.monthLabel(expenseMonth)}` : '';
  notify(existing ? 'Despesa atualizada.' : `Despesa registrada: ${money(data.amount)}.`,
    `Saldo: ${money(before)} → ${money(after)}${budgetAlert}`);
});

$('deleteExpense').addEventListener('click', () => {
  const id = Number($('expenseId').value);
  if (!window.confirm('Excluir esta despesa? O saldo será recalculado.')) return;
  const before = F.totals(donations, expenses, opening).balance;
  expenses = expenses.filter(e => e.id !== id);
  PawData.saveExpenses(expenses);
  const after = highlightBalance(before);
  expenseModal.hide();
  render();
  notify('Despesa excluída.', `Saldo: ${money(before)} → ${money(after)}`);
});

['eAmount', 'eCategory', 'eDate'].forEach(id => $(id).addEventListener('input', updateExpensePreview));

// ================= Orçamento e saldo inicial =================
function openSettings() {
  $('openingAmount').value = opening?.amount ?? 0;
  $('openingDate').value = opening?.date ?? today();
  $('openingDate').max = today();
  $('budgetFields').innerHTML = PawData.EXPENSE_CATEGORIES.map((c, i) => `
    <div class="col-sm-6"><label class="form-label" for="budget${i}">${escapeHtml(c)} (R$/mês)</label>
      <input id="budget${i}" data-category="${escapeHtml(c)}" type="number" min="0" step="0.01" class="form-control" value="${budgets[c] ?? 0}"></div>`).join('');
  settingsModal.show();
}

$('settingsForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const before = F.totals(donations, expenses, opening).balance;
  opening = { amount: Number($('openingAmount').value) || 0, date: $('openingDate').value };
  budgets = Object.fromEntries([...$('budgetFields').querySelectorAll('input')].map(i => [i.dataset.category, Number(i.value) || 0]));
  if (!PawData.saveOpening(opening) || !PawData.saveBudgets(budgets)) return notify('Não foi possível salvar.');
  const after = highlightBalance(before);
  settingsModal.hide();
  render();
  notify('Orçamento e saldo inicial salvos.', before !== after ? `Saldo: ${money(before)} → ${money(after)}` : '');
});

// ================= Prestação de contas =================
function exportCsv() {
  // CPF/CNPJ na prestação de contas: de quem recebeu pagamento e das empresas doadoras.
  // CPF de doador pessoa física não sai do sistema (LGPD: não é necessário para a prestação de contas).
  const documentOf = (item, kind) => {
    const c = C.find(item.contributorId);
    if (!c) return '';
    return kind === 'expense' || c.type === C.PJ ? c.document : '';
  };
  const csv = F.toCSV(donations, expenses, animals, opening, month, documentOf);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = `pawsafe-prestacao-de-contas-${month}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  notify(`Prestação de contas de ${F.monthName(month)} exportada.`, 'Abra no Excel ou no Google Planilhas.');
}

// ================= Sincronização entre abas =================
// Se outra aba (ou outra pessoa no mesmo navegador) registrar uma despesa, este saldo também muda.
const FINANCE_KEYS = [PawData.KEYS.donations, PawData.KEYS.expenses, PawData.KEYS.budgets, PawData.KEYS.opening];
window.addEventListener('storage', (event) => {
  if (!FINANCE_KEYS.includes(event.key)) return;
  const before = F.totals(donations, expenses, opening).balance;
  donations = PawData.loadDonations();
  expenses = PawData.loadExpenses();
  budgets = PawData.loadBudgets();
  opening = PawData.loadOpening();
  highlightBalance(before);
  renderMonthOptions();
  render();
});

// ================= Eventos =================
document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-view], [data-donation], [data-expense], [data-contributor], [data-new-contributor]');
  if (!target) return;
  const d = target.dataset;
  if (d.newContributor) newContributorFrom(d.newContributor);
  else if (d.contributor) openContributor(C.find(d.contributor));
  else if (d.view) setView(d.view);
  else if (d.donation) openDonation(donations.find(x => x.id === Number(d.donation)));
  else if (d.expense) openExpense(expenses.find(x => x.id === Number(d.expense)));
});

$('dType').addEventListener('change', toggleDonationFields);
$('dContributor').addEventListener('change', syncDonorField);
$('eContributor').addEventListener('change', syncPayeeField);
$('addContributor').addEventListener('click', () => openContributor());
['donationSearch', 'expenseSearch', 'contributorSearch'].forEach(id => $(id).addEventListener('input', render));
['typeFilter', 'originFilter', 'categoryFilter', 'contributorTypeFilter', 'contributorRoleFilter'].forEach(id => $(id).addEventListener('change', render));
$('monthSelect').addEventListener('change', () => { month = $('monthSelect').value; render(); });
$('addDonation').addEventListener('click', () => openDonation());
$('addExpense').addEventListener('click', () => openExpense());
$('openSettings').addEventListener('click', openSettings);
$('exportCsv').addEventListener('click', exportCsv);

// Opções vindas de dados.js
const options = (list) => list.map(item => `<option>${item}</option>`).join('');
$('typeFilter').innerHTML += options(PawData.DONATION_TYPES);
$('originFilter').innerHTML += options(PawData.ORIGINS);
$('contributorTypeFilter').innerHTML += options(PawData.ORIGINS);
$('categoryFilter').innerHTML += options(PawData.EXPENSE_CATEGORIES);
$('dOrigin').innerHTML = options(PawData.ORIGINS);
$('dType').innerHTML = options(PawData.DONATION_TYPES);
$('dMethod').innerHTML = options(PawData.PAYMENT_METHODS);
$('dUnit').innerHTML = options(PawData.UNITS);
$('eCategory').innerHTML = options(PawData.EXPENSE_CATEGORIES);
$('eAnimal').innerHTML = '<option value="">Nenhum (despesa geral)</option>' + [...animals]
  .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  .map(a => `<option value="${a.id}">${escapeHtml(a.name)} — ${escapeHtml(a.species)}</option>`).join('');

renderMonthOptions();
fillContributorSelects();
setView('summary');

// Contribuintes vêm do servidor (MySQL). Enquanto carregam, doações e despesas funcionam como avulsas.
C.load()
  .then(() => { fillContributorSelects(); render(); })
  .catch((error) => {
    contributorsFailed = true;
    $('contributorStatus').textContent = `Não foi possível carregar os contribuintes: ${error.message}`;
    $('contributorStatus').classList.add('warning');
    $('contributorStatus').classList.remove('d-none');
  });
