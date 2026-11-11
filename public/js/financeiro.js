/* PAWSAFE — cálculos financeiros (fonte única)
   O saldo NUNCA é guardado: é sempre calculado a partir das doações e despesas registradas.
   Assim, qualquer despesa nova, editada ou excluída muda o saldo na hora e não existe risco
   de um "saldo salvo" ficar diferente da soma dos lançamentos.
   Usado por Pages/doacoes e pelo dashboard (index.html).
   Depende de: js/utils.js (PawUtils). */

const PawFinance = (() => {
  // Meta de reserva: quantos meses de despesas a organização deveria ter em caixa.
  const RESERVE_MONTHS = 3;
  // A partir de quanto do orçamento a categoria entra em alerta.
  const BUDGET_WARNING = 0.8;
  // Acima desta fatia do total arrecadado, um único doador é risco de dependência.
  const CONCENTRATION_LIMIT = 0.4;

  const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  // Centavos inteiros evitam erros de arredondamento (0,1 + 0,2 ≠ 0,3 em JavaScript).
  const cents = (value) => Math.round((Number(value) || 0) * 100);
  const sum = (list) => list.reduce((total, item) => total + cents(item.amount), 0) / 100;

  const isFinancial = (d) => d.type === 'Financeira';
  const monthKey = (date) => String(date).slice(0, 7); // "AAAA-MM"
  const monthLabel = (key) => `${MONTHS[Number(key.slice(5, 7)) - 1]}/${key.slice(2, 4)}`;
  const monthName = (key) => new Date(`${key}-15T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

  // Os n meses que terminam em `ref` (inclusive), do mais antigo para o mais novo.
  function lastMonths(n, ref = PawUtils.today()) {
    const [year, month] = monthKey(ref).split('-').map(Number);
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(year, month - 1 - (n - 1 - i), 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
  }

  // ---------- Totais e saldo ----------
  // opening = saldo inicial { amount, date }: o dinheiro que a organização já tinha em caixa
  // quando começou a usar o sistema. Sem ele o saldo nunca bate com o extrato do banco.
  const openingAmount = (opening, upToMonth = null) =>
    opening && (!upToMonth || !opening.date || monthKey(opening.date) <= upToMonth) ? Number(opening.amount) || 0 : 0;

  function totals(donations, expenses, opening = null) {
    const received = sum(donations.filter(isFinancial));
    const spent = sum(expenses);
    const initial = openingAmount(opening);
    return {
      initial,
      received,
      spent,
      balance: (cents(initial) + cents(received) - cents(spent)) / 100,
      materials: donations.filter(d => !isFinancial(d)).length
    };
  }

  // Saldo se uma despesa for registrada (ou trocada, na edição) — usado no aviso antes de salvar.
  function balanceAfterExpense(donations, expenses, opening, newAmount, replacedAmount = 0) {
    const { balance } = totals(donations, expenses, opening);
    return (cents(balance) + cents(replacedAmount) - cents(newAmount)) / 100;
  }

  // ---------- Fluxo de caixa mensal ----------
  // Entradas, saídas, resultado do mês e saldo acumulado ao final de cada mês.
  function monthlyFlow(donations, expenses, months, opening = null) {
    const financial = donations.filter(isFinancial);
    return months.map(key => {
      const inMonth = (item) => monthKey(item.date) === key;
      const untilMonth = (item) => monthKey(item.date) <= key;
      const income = sum(financial.filter(inMonth));
      const outcome = sum(expenses.filter(inMonth));
      return {
        key,
        label: monthLabel(key),
        income,
        outcome,
        net: (cents(income) - cents(outcome)) / 100,
        balance: (cents(openingAmount(opening, key)) + cents(sum(financial.filter(untilMonth))) - cents(sum(expenses.filter(untilMonth)))) / 100
      };
    });
  }

  // ---------- Fôlego de caixa ----------
  // Por quantos meses o saldo atual paga as despesas, pela média dos últimos meses completos.
  function runway(donations, expenses, opening = null, ref = PawUtils.today(), window = 3) {
    const months = lastMonths(window + 1, ref).slice(0, window); // ignora o mês atual (incompleto)
    const monthlyAverage = sum(expenses.filter(e => months.includes(monthKey(e.date)))) / window;
    const { balance } = totals(donations, expenses, opening);
    const value = monthlyAverage > 0 ? Math.max(0, balance) / monthlyAverage : Infinity;
    const level = balance <= 0 || value < 1 ? 'critical' : value < RESERVE_MONTHS ? 'warning' : 'healthy';
    // Quanto falta arrecadar para chegar à reserva recomendada
    const gap = Math.max(0, (cents(monthlyAverage * RESERVE_MONTHS) - cents(Math.max(0, balance))) / 100);
    return { months: value, monthlyAverage, balance, level, gap, window };
  }

  // ---------- Orçamento mensal ----------
  function budgetUsage(expenses, budgets, month) {
    return Object.entries(budgets).map(([category, budget]) => {
      const spent = sum(expenses.filter(e => e.category === category && monthKey(e.date) === month));
      const ratio = budget > 0 ? spent / budget : (spent > 0 ? Infinity : 0);
      const level = ratio > 1 ? 'over' : ratio >= BUDGET_WARNING ? 'warning' : 'ok';
      return { category, budget: Number(budget) || 0, spent, ratio, level };
    });
  }

  // Situação de UMA categoria depois de uma despesa (para avisar ao registrar).
  function budgetStatus(expenses, budgets, category, month) {
    return budgetUsage(expenses, { [category]: budgets[category] ?? 0 }, month)[0];
  }

  // ---------- Doadores ----------
  // Ranking das doações financeiras por doador identificado; doações anônimas ficam à parte.
  function donorRanking(donations) {
    const financial = donations.filter(isFinancial);
    const total = sum(financial);
    const map = new Map();
    financial.filter(d => d.donor).forEach(d => {
      const key = d.donor.trim().toLocaleLowerCase('pt-BR');
      const entry = map.get(key) || { donor: d.donor.trim(), origin: d.origin, amount: 0, count: 0, months: new Set() };
      entry.amount = (cents(entry.amount) + cents(d.amount)) / 100;
      entry.count += 1;
      entry.months.add(monthKey(d.date));
      map.set(key, entry);
    });
    const ranking = [...map.values()]
      .map(e => ({ ...e, share: total ? e.amount / total : 0, recurring: e.months.size >= 2 }))
      .sort((a, b) => b.amount - a.amount);
    const anonymous = sum(financial.filter(d => !d.donor));
    const byOrigin = Object.fromEntries(['Pessoa física', 'Pessoa jurídica'].map(origin =>
      [origin, sum(financial.filter(d => d.origin === origin))]));
    const top = ranking[0];
    return {
      total,
      ranking,
      anonymous,
      byOrigin,
      recurring: ranking.filter(e => e.recurring).length,
      concentrated: Boolean(top && top.share >= CONCENTRATION_LIMIT),
      top
    };
  }

  // ---------- Custo por animal ----------
  function costPerAnimal(expenses, animals) {
    const map = new Map();
    expenses.filter(e => e.animalId).forEach(e => {
      const entry = map.get(e.animalId) || { animalId: e.animalId, total: 0, count: 0 };
      entry.total = (cents(entry.total) + cents(e.amount)) / 100;
      entry.count += 1;
      map.set(e.animalId, entry);
    });
    const list = [...map.values()]
      .map(e => ({ ...e, animal: animals.find(a => a.id === e.animalId) }))
      .sort((a, b) => b.total - a.total);
    const linked = sum(list.map(e => ({ amount: e.total })));
    return { list, average: list.length ? linked / list.length : 0, linked, linkedShare: sum(expenses) ? linked / sum(expenses) : 0 };
  }

  // ---------- Prestação de contas (CSV) ----------
  // Separador ";" e vírgula decimal: o Excel em português abre direto, com acentos (BOM UTF-8).
  function toCSV(donations, expenses, animals, opening = null, month = '') {
    const inPeriod = (item) => !month || monthKey(item.date) === month;
    const cell = (value) => {
      const text = String(value ?? '');
      return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const number = (value) => (value === null || value === undefined || value === '' ? '' : Number(value).toFixed(2).replace('.', ','));
    const animalName = (id) => animals.find(a => a.id === id)?.name || '';

    const rows = [
      ...donations.filter(inPeriod).map(d => [
        d.date, 'Entrada', `Doação ${d.type.toLowerCase()}`, d.origin, d.donor || 'Não identificado',
        isFinancial(d) ? d.method : `${d.item} — ${String(d.quantity).replace('.', ',')} ${d.unit}`,
        '', isFinancial(d) ? number(d.amount) : '', d.notes
      ]),
      ...expenses.filter(inPeriod).map(e => [
        e.date, 'Saída', e.category, '', e.paidTo, e.description, animalName(e.animalId), number(-e.amount), e.notes
      ])
    ].sort((a, b) => a[0].localeCompare(b[0]));

    const { received, spent } = totals(donations.filter(inPeriod), expenses.filter(inPeriod));
    const { balance } = month ? { balance: null } : totals(donations, expenses, opening);
    const header = ['Data', 'Tipo', 'Categoria', 'Origem', 'Doador / Pago a', 'Descrição', 'Animal', 'Valor (R$)', 'Observação'];
    const summary = [
      [],
      ...(month ? [] : [['', '', '', '', '', 'Saldo inicial', '', number(openingAmount(opening))]]),
      ['', '', '', '', '', 'Total de entradas financeiras', '', number(received)],
      ['', '', '', '', '', 'Total de saídas', '', number(-spent)],
      month
        ? ['', '', '', '', '', 'Resultado do período', '', number((cents(received) - cents(spent)) / 100)]
        : ['', '', '', '', '', 'Saldo atual', '', number(balance)]
    ];
    return '﻿' + [header, ...rows.map(r => [PawUtils.formatDate(r[0]), ...r.slice(1)]), ...summary]
      .map(r => r.map(cell).join(';')).join('\r\n');
  }

  return {
    RESERVE_MONTHS, BUDGET_WARNING, CONCENTRATION_LIMIT,
    isFinancial, monthKey, monthLabel, monthName, capitalize, lastMonths,
    totals, balanceAfterExpense, monthlyFlow, runway,
    budgetUsage, budgetStatus, donorRanking, costPerAnimal, toCSV
  };
})();
