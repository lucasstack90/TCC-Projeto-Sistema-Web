/* PAWSAFE — Relatório técnico (Pages/relatorios)
   Nada aqui é digitado à mão: todos os números saem dos outros módulos
   (Animais, Resgates, Adoções e Estoque) através de js/dados.js.
   A única informação própria do relatório é a configuração (ONG, parceria e metas)
   e a análise escrita pela equipe em cada período.

   Estrutura pensada para a prestação de contas de parcerias com o município
   (Lei 13.019/2014 — MROSC): relatório de execução do objeto (metas, atividades
   e resultados) + relatório de execução financeira. No back-end (Laravel), cada
   função "calc..." vira uma consulta com filtro de data no MySQL. */

const $ = (id) => document.getElementById(id);
const { formatDate, escapeHtml, code } = PawUtils;
const toast = new bootstrap.Toast($('toast'), { delay: 2800 });
const showToast = (message) => { $('toastText').textContent = message; toast.show(); };

const TODAY = PawUtils.today();
const STALLED_DAYS = 15;     // processo de adoção sem movimentação há mais de 15 dias
const LONG_STAY_DAYS = 180;  // animal disponível há mais de 6 meses
const OLD_RESCUE_DAYS = 7;   // resgate em aberto há mais de 7 dias

// ---------- Seções e modelos ----------
// Cada modelo liga um conjunto de seções; o usuário ainda pode ligar ou desligar cada uma.
const SECTIONS = [
  { id: 'identificacao', label: 'Identificação', models: ['prefeitura', 'gestao', 'completo'] },
  { id: 'resumo', label: 'Resumo do período', models: ['prefeitura', 'gestao', 'completo'] },
  { id: 'metas', label: 'Metas e resultados', models: ['prefeitura', 'gestao', 'completo'] },
  { id: 'resgates', label: 'Resgates', models: ['prefeitura', 'gestao', 'completo'] },
  { id: 'animais', label: 'Animais sob responsabilidade', models: ['prefeitura', 'gestao', 'completo'] },
  { id: 'saude', label: 'Saúde e bem-estar', models: ['prefeitura', 'gestao', 'completo'] },
  { id: 'adocoes', label: 'Adoções', models: ['prefeitura', 'gestao', 'completo'] },
  { id: 'insumos', label: 'Insumos e estoque', models: ['prefeitura', 'gestao', 'completo'] },
  { id: 'financeiro', label: 'Execução financeira', models: ['prefeitura', 'completo'] },
  { id: 'equipe', label: 'Equipe', models: ['gestao', 'completo'] },
  { id: 'pendencias', label: 'Pendências e pontos de atenção', models: ['gestao', 'completo'] },
  { id: 'analise', label: 'Análise da equipe', models: ['prefeitura', 'gestao', 'completo'] },
  { id: 'assinatura', label: 'Declaração e assinatura', models: ['prefeitura', 'completo'] }
];

let config = PawData.loadReportConfig();
let enabled = new Set();
let charts = [];

// ---------- Datas ----------
const parse = (iso) => new Date(`${iso}T12:00:00`);
const toIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysBetween = (from, to) => Math.round((parse(to) - parse(from)) / 864e5);
const addDays = (iso, n) => { const d = parse(iso); d.setDate(d.getDate() + n); return toIso(d); };
const inRange = (iso, p) => Boolean(iso) && iso >= p.start && iso <= p.end;


function currentPeriod() {
  const start = $('periodStart').value;
  const end = $('periodEnd').value;
  // Dados "até hoje": se o período termina no futuro, os números param em hoje.
  const until = end > TODAY ? TODAY : end;
  const days = daysBetween(start, end) + 1;
  return { start, end, until, days, months: days / (365 / 12), key: `${start}_${end}` };
}

// ---------- Formatação ----------
const num = (n) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const pct = (part, total) => (total ? `${Math.round((part / total) * 100)}%` : '—');
const avg = (list) => (list.length ? list.reduce((s, n) => s + n, 0) / list.length : null);
const daysText = (n) => (n === null ? '—' : `${num(Math.round(n * 10) / 10)} ${Math.round(n) === 1 ? 'dia' : 'dias'}`);
// LGPD: o relatório sai da organização, então o adotante aparece só com nome e inicial.
const shortName = (name = '') => { const p = name.trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0] || '—'; };
const badge = (text, cls) => `<span class="status-badge ${cls}">${escapeHtml(text)}</span>`;

function countBy(list, keyFn) {
  const map = {};
  list.forEach(item => { const k = keyFn(item); map[k] = (map[k] || 0) + 1; });
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

function table(headers, rows, emptyText = 'Nenhum registro no período.') {
  const head = headers.map(h => `<th${h.num ? ' class="num"' : ''}>${h.label ?? h}</th>`).join('');
  const body = rows.length
    ? rows.map(r => `<tr>${r.map((c, i) => `<td${headers[i].num ? ' class="num"' : ''}>${c}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${headers.length}" class="empty-row">${emptyText}</td></tr>`;
  return `<div class="table-responsive"><table class="report-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

const kpi = (value, label, hint = '', tone = '') =>
  `<div class="kpi ${tone}"><strong>${value}</strong><span>${label}</span>${hint ? `<small>${hint}</small>` : ''}</div>`;

// =========================================================
// Cálculos — um bloco por módulo
// =========================================================
function loadAll() {
  return {
    animals: PawData.loadAnimals(),
    adopters: PawData.loadAdopters(),
    adoptions: PawData.loadAdoptions(),
    rescues: PawData.loadRescues(),
    items: PawData.loadStockItems(),
    moves: PawData.loadStockMoves()
  };
}

// Data em que o animal saiu por adoção: processo concluído ou, se foi marcado à mão, o histórico.
function adoptionDate(animal, adoptions) {
  const done = adoptions.find(a => a.animalId === animal.id && a.stage === 'Concluída');
  if (done?.closedAt) return done.closedAt;
  const hist = (animal.history || []).find(h => h.type === 'Adoção');
  if (hist) return hist.date;
  return animal.status === 'Adotado' ? animal.arrival : '';
}

function calcAnimals(d, p) {
  const withExit = d.animals.map(a => ({ ...a, exit: adoptionDate(a, d.adoptions) }));
  const presentOn = (a, day) => a.arrival <= day && !(a.exit && a.exit <= day);
  const dayBefore = addDays(p.start, -1);

  const startPop = withExit.filter(a => presentOn(a, dayBefore));
  const entries = withExit.filter(a => inRange(a.arrival, { start: p.start, end: p.until }));
  const exits = withExit.filter(a => inRange(a.exit, { start: p.start, end: p.until }));
  const endPop = withExit.filter(a => presentOn(a, p.until));
  const current = withExit.filter(a => !a.exit);

  const stayAdopted = avg(exits.map(a => daysBetween(a.arrival, a.exit)));
  const stayCurrent = avg(current.map(a => daysBetween(a.arrival, TODAY)));
  // Quem já tem processo de adoção em andamento não precisa de divulgação.
  const inProcess = new Set(d.adoptions.filter(x => PawData.ACTIVE_STAGES.includes(x.stage)).map(x => x.animalId));
  const longStay = current
    .filter(a => a.status === 'Disponível' && !inProcess.has(a.id) && daysBetween(a.arrival, TODAY) > LONG_STAY_DAYS)
    .sort((a, b) => a.arrival.localeCompare(b.arrival));

  return {
    startPop, entries, exits, endPop, current, stayAdopted, stayCurrent, longStay,
    byStatus: PawData.STATUS.filter(s => s !== 'Adotado').map(s => [s, current.filter(a => a.status === s).length]),
    bySpecies: countBy(entries, a => a.species)
  };
}

function calcRescues(d, p) {
  const list = d.rescues.filter(r => inRange(r.date, { start: p.start, end: p.until }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const done = list.filter(r => r.stage === 'Concluído');
  const failed = list.filter(r => r.stage === 'Sem sucesso');
  const open = list.filter(r => PawData.OPEN_RESCUE_STAGES.includes(r.stage));
  const closed = [...done, ...failed].filter(r => r.closedAt);
  // Concluídos com data de encerramento no período (é o que conta para a meta).
  const doneInPeriod = d.rescues.filter(r => r.stage === 'Concluído' && inRange(r.closedAt, { start: p.start, end: p.until }));
  return {
    list, done, failed, open, doneInPeriod,
    reported: list.reduce((s, r) => s + Number(r.quantity || 0), 0),
    sheltered: list.reduce((s, r) => s + (r.animalIds?.length || 0), 0),
    responseTime: avg(closed.map(r => daysBetween(r.date, r.closedAt))),
    byPriority: PawData.PRIORITIES.map(pr => [pr, list.filter(r => r.priority === pr).length]),
    byDistrict: countBy(list, r => r.district || 'Não informado'),
    byResponsible: countBy(list, r => r.responsible || 'Não informado')
  };
}

function calcAdoptions(d, p) {
  const range = { start: p.start, end: p.until };
  const opened = d.adoptions.filter(a => inRange(a.openedAt, range));
  const closedIn = d.adoptions.filter(a => inRange(a.closedAt, range) && !PawData.ACTIVE_STAGES.includes(a.stage));
  const done = closedIn.filter(a => a.stage === 'Concluída').sort((a, b) => a.closedAt.localeCompare(b.closedAt));
  const refused = closedIn.filter(a => a.stage === 'Recusada');
  const cancelled = closedIn.filter(a => a.stage === 'Cancelada');
  const active = d.adoptions.filter(a => PawData.ACTIVE_STAGES.includes(a.stage));
  const lastMove = (a) => (a.log || []).reduce((max, l) => (l.date > max ? l.date : max), a.openedAt);
  const stalled = active.filter(a => daysBetween(lastMove(a), TODAY) > STALLED_DAYS)
    .map(a => ({ ...a, idle: daysBetween(lastMove(a), TODAY) }));
  return {
    opened, done, refused, cancelled, active, stalled,
    conversion: pct(done.length, closedIn.length),
    duration: avg(done.map(a => daysBetween(a.openedAt, a.closedAt))),
    byStage: PawData.ACTIVE_STAGES.map(s => [s, active.filter(a => a.stage === s).length])
  };
}

function calcHealth(d, p, animalsCalc) {
  const range = { start: p.start, end: p.until };
  const vaccines = [];
  const procedures = [];
  const NOT_HEALTH = ['Cadastro', 'Resgate', 'Adoção'];
  d.animals.forEach(a => {
    (a.vaccines || []).forEach(v => { if (inRange(v.date, range)) vaccines.push({ ...v, animal: a }); });
    (a.history || []).forEach(h => { if (!NOT_HEALTH.includes(h.type) && inRange(h.date, range)) procedures.push({ ...h, animal: a }); });
  });

  const pop = animalsCalc.current;
  // Vacina vencida: a dose mais recente de cada vacina já passou da data de reforço.
  const overdue = pop.map(a => {
    const latest = {};
    (a.vaccines || []).forEach(v => { if (!latest[v.name] || v.date > latest[v.name].date) latest[v.name] = v; });
    const late = Object.values(latest).filter(v => v.next && v.next < TODAY);
    return { animal: a, late };
  }).filter(x => x.late.length);

  return {
    vaccines, procedures, overdue,
    vaccinesByName: countBy(vaccines, v => v.name),
    proceduresByType: countBy(procedures, h => h.type),
    vaccinated: pop.filter(a => a.vaccinated).length,
    neutered: pop.filter(a => a.neutered).length,
    chipped: pop.filter(a => a.chip).length,
    inTreatment: pop.filter(a => a.status === 'Em Tratamento'),
    unvaccinated: pop.filter(a => !a.vaccinated),
    population: pop.length
  };
}

function calcStock(d, p) {
  const range = { start: p.start, end: p.until };
  // Lançamentos estornados e os próprios estornos se anulam: ficam fora do relatório.
  const valid = d.moves.filter(m => !m.reversedBy && m.reason !== 'estorno' && inRange(m.date, range));
  const rows = d.items.filter(i => i.active).map(item => {
    const own = valid.filter(m => m.itemId === item.id);
    const sum = (fn) => PawData.round3(own.filter(fn).reduce((s, m) => s + m.qty, 0));
    return {
      item,
      info: PawData.stockInfo(item, d.moves),
      donated: sum(m => m.type === 'entrada' && m.reason === 'doacao'),
      bought: sum(m => m.type === 'entrada' && m.reason === 'compra'),
      used: sum(m => m.type === 'saida' && (m.reason === 'consumo' || m.reason === 'uso_animal')),
      lost: sum(m => m.type === 'saida' && m.reason === 'perda'),
      moved: own.length
    };
  });
  const donations = valid.filter(m => m.type === 'entrada' && m.reason === 'doacao');
  const purchases = valid.filter(m => m.type === 'entrada' && m.reason === 'compra');
  const losses = valid.filter(m => m.type === 'saida' && m.reason === 'perda');
  const alerts = PawData.stockAlerts(d.items, d.moves);
  return {
    rows, donations, purchases, losses, alerts, valid,
    donors: countBy(donations, m => m.party || 'Não identificado'),
    suppliers: countBy(purchases, m => m.party || 'Não identificado')
  };
}

function calcPending(c) {
  const list = [];
  const add = (level, icon, text, href) => list.push({ level, icon, text, href });

  PawData.loadRescues().filter(r => PawData.OPEN_RESCUE_STAGES.includes(r.stage)).forEach(r => {
    const age = daysBetween(r.date, TODAY);
    const urgent = r.priority === 'Crítica' || r.priority === 'Alta';
    if (urgent || age > OLD_RESCUE_DAYS) {
      add(urgent ? 'alta' : 'media', 'bi-house-heart',
        `Resgate ${code('RES', r.id)} (${r.priority}, ${escapeHtml(r.district)}) em aberto há ${age} dias — ${r.stage.toLowerCase()}.`,
        `resgates?resgate=${r.id}`);
    }
  });
  c.health.overdue.forEach(x => add('alta', 'bi-shield-exclamation',
    `${escapeHtml(x.animal.name)} (${code('PAW', x.animal.id)}) com reforço vencido: ${x.late.map(v => `${escapeHtml(v.name)} desde ${formatDate(v.next)}`).join(', ')}.`,
    `animais?animal=${x.animal.id}`));
  c.health.unvaccinated.forEach(a => add('media', 'bi-capsule',
    `${escapeHtml(a.name)} (${code('PAW', a.id)}) ainda sem vacinação registrada — chegou em ${formatDate(a.arrival)}.`,
    `animais?animal=${a.id}`));
  c.stock.alerts.restock.forEach(({ item, info }) => add(info.status === 'Em falta' ? 'alta' : 'media', 'bi-box-seam',
    `${escapeHtml(item.name)}: ${info.status.toLowerCase()} (${num(info.usable)} ${item.unit}; mínimo ${num(item.min)} ${item.unit}).`, 'estoque'));
  c.stock.alerts.expired.forEach(({ item, info }) => add('alta', 'bi-calendar-x',
    `${escapeHtml(item.name)}: lote vencido ${info.expiredLots.map(l => `${escapeHtml(l.lot)} (${num(l.qty)} ${item.unit})`).join(', ')} — dar baixa como perda.`, 'estoque'));
  c.stock.alerts.expiring.forEach(({ item, info }) => add('media', 'bi-hourglass-split',
    `${escapeHtml(item.name)}: lote ${info.expiringLots.map(l => `${escapeHtml(l.lot)} vence em ${l.daysLeft} dias`).join(', ')}.`, 'estoque'));
  c.adoptions.stalled.forEach(a => {
    const animal = PawData.loadAnimals().find(x => x.id === a.animalId);
    add('media', 'bi-heart', `Processo ${code('ADO', a.id)} (${escapeHtml(animal?.name || 'animal')}) parado há ${a.idle} dias na etapa "${a.stage}".`,
      `adocoes?processo=${a.id}`);
  });
  c.animals.longStay.forEach(a => add('info', 'bi-megaphone',
    `${escapeHtml(a.name)} está disponível há ${daysBetween(a.arrival, TODAY)} dias — considerar divulgação ou feira de adoção.`,
    `animais?animal=${a.id}`));

  const order = { alta: 0, media: 1, info: 2 };
  return list.sort((a, b) => order[a.level] - order[b.level]);
}

function calculate(p) {
  const d = loadAll();
  const animals = calcAnimals(d, p);
  const c = {
    data: d,
    animals,
    rescues: calcRescues(d, p),
    adoptions: calcAdoptions(d, p),
    health: calcHealth(d, p, animals),
    stock: calcStock(d, p)
  };
  c.pending = calcPending(c);
  return c;
}

// =========================================================
// Seções do relatório (HTML)
// =========================================================
const sectionHtml = (n, id, title, body, lead = '') =>
  `<section class="report-section" id="sec-${id}">
    <h2><span class="sec-num">${n}.</span> ${title}</h2>
    ${lead ? `<p class="sec-lead">${lead}</p>` : ''}
    ${body}
  </section>`;

const R = {
  identificacao(c, p) {
    const o = config.org;
    const ps = config.partnership;
    const rows = [
      ['Organização', escapeHtml(o.name)], ['CNPJ', escapeHtml(o.cnpj) || '—'],
      ['Endereço', `${escapeHtml(o.address)}${o.city ? ` — ${escapeHtml(o.city)}` : ''}`],
      ['Contato', [o.phone, o.email].filter(Boolean).map(escapeHtml).join(' · ') || '—'],
      ['Responsável legal', `${escapeHtml(o.legalRep)}${o.legalRole ? ` (${escapeHtml(o.legalRole)})` : ''}`]
    ];
    if (ps.publicFunding) {
      rows.push(['Instrumento', escapeHtml(ps.instrument) || '—'], ['Órgão concedente', escapeHtml(ps.grantor) || '—'],
        ['Objeto', escapeHtml(ps.object) || '—'], ['Vigência', `${formatDate(ps.start)} a ${formatDate(ps.end)}`]);
    }
    rows.push(['Período do relatório', `<strong>${formatDate(p.start)} a ${formatDate(p.end)}</strong>${p.until < p.end ? ` <span class="muted">(dados até ${formatDate(p.until)})</span>` : ''}`]);
    return `<dl class="id-grid">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
  },

  resumo(c) {
    const { animals: a, rescues: r, adoptions: ad, health: h } = c;
    return `<div class="kpi-grid">
      ${kpi(r.list.length, 'Ocorrências de resgate', `${r.done.length} concluídas · ${r.open.length} em aberto`)}
      ${kpi(a.entries.length, 'Animais acolhidos', `${r.sheltered} vindos de resgates`)}
      ${kpi(ad.done.length, 'Adoções concluídas', `taxa de conversão ${ad.conversion}`, 'tone-green')}
      ${kpi(a.endPop.length, 'Animais sob cuidado', `ao fim do período (início: ${a.startPop.length})`)}
      ${kpi(h.vaccines.length, 'Vacinas aplicadas', `${h.procedures.length} atendimentos veterinários`)}
      ${kpi(c.stock.donations.length, 'Doações de insumos', `de ${c.stock.donors.length} doador(es)`)}
    </div>`;
  },

  metas(c, p) {
    const g = config.goals;
    const goals = [
      { label: 'Resgates concluídos', monthly: g.rescues, done: c.rescues.doneInPeriod.length, source: 'Resgates' },
      { label: 'Adoções concluídas', monthly: g.adoptions, done: c.adoptions.done.length, source: 'Adoções' },
      { label: 'Vacinas aplicadas', monthly: g.vaccines, done: c.health.vaccines.length, source: 'Animais (vacinas)' },
      { label: 'Atendimentos veterinários', monthly: g.healthCare, done: c.health.procedures.length, source: 'Animais (histórico)' }
    ].filter(x => Number(x.monthly) > 0);
    if (!goals.length) return '<p class="muted">Nenhuma meta cadastrada. Use “Configurar relatório” para informar as metas do plano de trabalho.</p>';

    // Meta proporcional aos dias já decorridos do período (não cobra o futuro).
    const months = (daysBetween(p.start, p.until) + 1) / (365 / 12);
    const rows = goals.map(x => {
      const target = Math.max(1, Math.round(x.monthly * months));
      const rate = Math.round((x.done / target) * 100);
      const tone = rate >= 100 ? 'ok' : rate >= 70 ? 'warn' : 'bad';
      const status = rate >= 100 ? 'Atingida' : rate >= 70 ? 'Parcial' : 'Abaixo';
      return [
        `<strong>${x.label}</strong><small class="d-block muted">${x.source}</small>`,
        `${num(x.monthly)}/mês`, num(target), num(x.done),
        `<div class="goal-bar ${tone}"><span style="width:${Math.min(rate, 100)}%"></span></div><small>${rate}% · ${status}</small>`
      ];
    });
    return table([{ label: 'Meta' }, { label: 'Pactuado', num: true }, { label: 'Meta no período', num: true }, { label: 'Realizado', num: true }, { label: 'Atingimento' }], rows)
      + `<p class="note">Meta do período = meta mensal × ${num(Math.round(months * 10) / 10)} mês(es) decorridos. Metas abaixo de 70% devem ser justificadas na análise da equipe (seção de análise).</p>`;
  },

  resgates(c) {
    const r = c.rescues;
    const rows = r.list.map(x => [
      code('RES', x.id), formatDate(x.date), escapeHtml(x.district || '—'),
      `${escapeHtml(x.species)} (${x.quantity})`, badge(x.priority, PawData.priorityClass(x.priority)),
      badge(x.stage, PawData.rescueClass(x.stage)), escapeHtml(x.responsible || '—'),
      x.closedAt ? (daysBetween(x.date, x.closedAt) === 0 ? 'mesmo dia' : daysText(daysBetween(x.date, x.closedAt))) : '—'
    ]);
    const breakdown = (list) => list.filter(([, n]) => n).map(([k, n]) => `<li><span>${escapeHtml(k)}</span><strong>${n}</strong></li>`).join('') || '<li class="muted">—</li>';
    return `<div class="kpi-grid small">
        ${kpi(r.list.length, 'Ocorrências')}
        ${kpi(r.done.length, 'Concluídas', '', 'tone-green')}
        ${kpi(r.failed.length, 'Sem sucesso')}
        ${kpi(r.open.length, 'Em aberto', '', r.open.length ? 'tone-terra' : '')}
        ${kpi(pct(r.done.length, r.done.length + r.failed.length), 'Taxa de sucesso', 'entre as encerradas')}
        ${kpi(daysText(r.responseTime), 'Tempo médio', 'da ocorrência ao encerramento')}
      </div>
      <div class="split-3">
        <div><h3>Por prioridade</h3><ul class="breakdown">${breakdown(r.byPriority)}</ul></div>
        <div><h3>Bairros com mais ocorrências</h3><ul class="breakdown">${breakdown(r.byDistrict.slice(0, 6))}</ul></div>
        <div><h3>Animais</h3><ul class="breakdown">
          <li><span>Informados nas ocorrências</span><strong>${r.reported}</strong></li>
          <li><span>Acolhidos e cadastrados</span><strong>${r.sheltered}</strong></li></ul></div>
      </div>
      <h3>Ocorrências do período</h3>
      ${table(['Código', 'Data', 'Bairro', 'Espécie (qtd.)', 'Prioridade', 'Situação', 'Responsável', { label: 'Atendimento', num: true }], rows)}
      <p class="note">O endereço completo e quem fez a denúncia não aparecem no relatório (LGPD); ficam no módulo de Resgates.</p>`;
  },

  animais(c) {
    const a = c.animals;
    const other = a.startPop.length + a.entries.length - a.exits.length - a.endPop.length;
    const statusList = a.byStatus.map(([s, n]) => `<li><span>${badge(s, PawData.statusClass(s))}</span><strong>${n}</strong></li>`).join('');
    const entryRows = a.entries.sort((x, y) => x.arrival.localeCompare(y.arrival)).map(x => [
      code('PAW', x.id), escapeHtml(x.name), `${escapeHtml(x.species)} · ${escapeHtml(x.sex)}`, formatDate(x.arrival), badge(x.status, PawData.statusClass(x.status))
    ]);
    return `<div class="flow">
        <div><small>Início do período</small><strong>${a.startPop.length}</strong></div><i class="bi bi-plus-lg"></i>
        <div><small>Entradas</small><strong>${a.entries.length}</strong></div><i class="bi bi-dash-lg"></i>
        <div><small>Saídas por adoção</small><strong>${a.exits.length}</strong></div>${other ? `<i class="bi bi-dash-lg"></i><div><small>Outras saídas</small><strong>${other}</strong></div>` : ''}<i class="bi bi-arrow-right"></i>
        <div class="flow-total"><small>Fim do período</small><strong>${a.endPop.length}</strong></div>
      </div>
      <div class="split-2">
        <div>
          <h3>Situação atual dos animais sob cuidado</h3>
          <div class="chart-row"><div class="donut-box"><canvas id="statusChart" role="img" aria-label="Animais por situação"></canvas></div><ul class="breakdown">${statusList}</ul></div>
        </div>
        <div>
          <h3>Permanência</h3>
          <ul class="breakdown">
            <li><span>Tempo médio até a adoção (saídas do período)</span><strong>${daysText(a.stayAdopted)}</strong></li>
            <li><span>Tempo médio dos que continuam sob cuidado</span><strong>${daysText(a.stayCurrent)}</strong></li>
            <li><span>Disponíveis há mais de ${LONG_STAY_DAYS} dias</span><strong>${a.longStay.length}</strong></li>
          </ul>
          <h3 class="mt-3">Entradas por espécie</h3>
          <ul class="breakdown">${a.bySpecies.map(([k, n]) => `<li><span>${escapeHtml(k)}</span><strong>${n}</strong></li>`).join('') || '<li class="muted">Nenhuma entrada no período.</li>'}</ul>
        </div>
      </div>
      <h3>Evolução mensal</h3>
      <div class="chart-box"><canvas id="monthlyChart" role="img" aria-label="Resgates, entradas e adoções por mês"></canvas></div>
      <h3>Animais que entraram no período</h3>
      ${table(['Código', 'Nome', 'Espécie · sexo', 'Chegada', 'Situação atual'], entryRows)}`;
  },

  saude(c) {
    const h = c.health;
    const coverage = (n, label) => {
      const rate = h.population ? Math.round((n / h.population) * 100) : 0;
      return `<div class="coverage"><div class="d-flex justify-content-between"><span>${label}</span><strong>${n} de ${h.population} · ${rate}%</strong></div>
        <div class="goal-bar ${rate >= 80 ? 'ok' : rate >= 50 ? 'warn' : 'bad'}"><span style="width:${rate}%"></span></div></div>`;
    };
    const list = (entries) => entries.map(([k, n]) => `<li><span>${escapeHtml(k)}</span><strong>${n}</strong></li>`).join('') || '<li class="muted">Nenhum registro no período.</li>';
    return `<div class="kpi-grid small">
        ${kpi(h.vaccines.length, 'Vacinas aplicadas')}
        ${kpi(h.procedures.length, 'Atendimentos veterinários')}
        ${kpi(h.inTreatment.length, 'Em tratamento agora')}
        ${kpi(h.overdue.length, 'Com reforço vencido', '', h.overdue.length ? 'tone-terra' : '')}
      </div>
      <div class="split-2">
        <div>
          <h3>Cobertura dos animais sob cuidado</h3>
          ${coverage(h.vaccinated, 'Vacinados')}${coverage(h.neutered, 'Castrados')}${coverage(h.chipped, 'Microchipados')}
        </div>
        <div class="split-2 inner">
          <div><h3>Vacinas</h3><ul class="breakdown">${list(h.vaccinesByName)}</ul></div>
          <div><h3>Atendimentos</h3><ul class="breakdown">${list(h.proceduresByType)}</ul></div>
        </div>
      </div>
      <p class="note">Castração e microchipagem são indicadores de controle populacional e costumam ser exigidos em parcerias municipais.</p>`;
  },

  adocoes(c) {
    const ad = c.adoptions;
    const animals = c.data.animals;
    const adopters = c.data.adopters;
    const rows = ad.done.map(x => {
      const an = animals.find(a => a.id === x.animalId);
      const person = adopters.find(a => a.id === x.adopterId);
      return [code('ADO', x.id), formatDate(x.closedAt), escapeHtml(an ? `${an.name} (${an.species})` : '—'),
        escapeHtml(shortName(person?.name)), escapeHtml(person?.district || '—'), daysText(daysBetween(x.openedAt, x.closedAt))];
    });
    return `<div class="kpi-grid small">
        ${kpi(ad.opened.length, 'Processos abertos')}
        ${kpi(ad.done.length, 'Concluídos', '', 'tone-green')}
        ${kpi(ad.refused.length + ad.cancelled.length, 'Recusados / cancelados', `${ad.refused.length} recusados · ${ad.cancelled.length} cancelados`)}
        ${kpi(ad.conversion, 'Taxa de conversão', 'concluídos ÷ encerrados')}
        ${kpi(daysText(ad.duration), 'Duração média', 'abertura até a entrega')}
        ${kpi(ad.active.length, 'Em andamento hoje', ad.byStage.map(([s, n]) => `${n} ${s.toLowerCase()}`).join(' · '))}
      </div>
      <h3>Adoções concluídas no período</h3>
      ${table(['Processo', 'Concluída em', 'Animal', 'Adotante', 'Bairro', { label: 'Duração', num: true }], rows)}
      <p class="note">Todas as adoções concluídas passaram por entrevista, visita, conferência de documentos e termo assinado (regra do sistema). Adotantes aparecem abreviados (LGPD).</p>`;
  },

  insumos(c) {
    const s = c.stock;
    const fmt = (n, u) => (n ? `${num(n)} ${u}` : '—');
    const rows = s.rows.filter(x => x.moved || x.info.status !== 'Disponível').map(x => [
      `<strong>${escapeHtml(x.item.name)}</strong><small class="d-block muted">${escapeHtml(x.item.category)}</small>`,
      fmt(x.donated, x.item.unit), fmt(x.bought, x.item.unit), fmt(x.used, x.item.unit), fmt(x.lost, x.item.unit),
      `${num(x.info.usable)} ${x.item.unit}`, badge(x.info.status, PawData.stockClass(x.info.status))
    ]);
    const donorList = s.donors.slice(0, 8).map(([k, n]) => `<li><span>${escapeHtml(k)}</span><strong>${n}</strong></li>`).join('') || '<li class="muted">Nenhuma doação no período.</li>';
    const totalIn = s.donations.length + s.purchases.length;
    return `<div class="kpi-grid small">
        ${kpi(s.donations.length, 'Entradas por doação', `${pct(s.donations.length, totalIn)} das entradas`, 'tone-green')}
        ${kpi(s.purchases.length, 'Entradas por compra')}
        ${kpi(s.losses.length, 'Perdas / descartes', 'vencimento, avaria')}
        ${kpi(s.alerts.restock.length, 'Itens para repor', 'em falta ou críticos', s.alerts.restock.length ? 'tone-terra' : '')}
      </div>
      <h3>Movimentação por item</h3>
      ${table([{ label: 'Item' }, { label: 'Doado', num: true }, { label: 'Comprado', num: true }, { label: 'Consumido', num: true }, { label: 'Perdas', num: true }, { label: 'Saldo atual', num: true }, { label: 'Situação' }], rows)}
      <div class="split-2">
        <div><h3>Doadores de insumos</h3><ul class="breakdown">${donorList}</ul></div>
        <div><h3>Fornecedores (compras)</h3><ul class="breakdown">${s.suppliers.map(([k, n]) => `<li><span>${escapeHtml(k)}</span><strong>${n}</strong></li>`).join('') || '<li class="muted">Nenhuma compra no período.</li>'}</ul></div>
      </div>
      <p class="note">“Consumido” soma consumo geral e uso em animais. Lançamentos estornados não entram na conta. Quantidades em unidade base de cada item.</p>`;
  },

  financeiro() {
    const plan = [
      ['Receitas', 'Recurso público repassado (parcela do termo), doações de pessoa física, doações de pessoa jurídica, eventos e campanhas'],
      ['Despesas', 'Alimentação, atendimento veterinário, medicamentos e vacinas, castrações, limpeza, transporte, pessoal'],
      ['Conciliação', 'Saldo inicial + receitas − despesas = saldo final, conferido com o extrato da conta específica da parceria'],
      ['Comprovação', 'Cada despesa paga com recurso público ligada à nota fiscal e à meta que ela atende (nexo com o objeto)']
    ];
    return `<div class="alert-soft warning mb-3"><i class="bi bi-hourglass-split me-2"></i>
        Esta seção será preenchida automaticamente quando o módulo <strong>Doações / Financeiro</strong> estiver concluído. Até lá, anexe o demonstrativo financeiro em separado.</div>
      ${table(['Bloco', 'O que vai aparecer'], plan.map(([a, b]) => [`<strong>${a}</strong>`, b]))}
      <p class="note">As doações materiais (ração, medicamentos, utensílios) já estão na seção de insumos, com doador e quantidade.</p>`;
  },

  equipe(c) {
    const r = c.rescues;
    const users = countBy(c.stock.valid, m => m.user || 'Não informado');
    const list = (entries, unit) => entries.map(([k, n]) => `<li><span>${escapeHtml(k)}</span><strong>${n} ${unit}</strong></li>`).join('') || '<li class="muted">—</li>';
    return `<div class="split-2">
        <div><h3>Resgates por responsável</h3><ul class="breakdown">${list(r.byResponsible, '')}</ul></div>
        <div><h3>Lançamentos de estoque por pessoa</h3><ul class="breakdown">${list(users, '')}</ul></div>
      </div>
      <div class="alert-soft mt-2 mb-0"><i class="bi bi-people me-2"></i>Voluntários ativos, horas dedicadas e novos cadastros entram aqui quando o módulo <strong>Voluntários & Equipe</strong> estiver pronto.</div>`;
  },

  pendencias(c) {
    if (!c.pending.length) return '<div class="alert-soft mb-0"><i class="bi bi-check2-circle me-2"></i>Nenhuma pendência no momento.</div>';
    const labels = { alta: 'Urgente', media: 'Atenção', info: 'Sugestão' };
    const counts = ['alta', 'media', 'info'].map(l => [l, c.pending.filter(x => x.level === l).length]).filter(([, n]) => n);
    return `<p class="sec-lead">Situação em ${formatDate(TODAY)}, independente do período escolhido. ${counts.map(([l, n]) => `${n} ${labels[l].toLowerCase()}`).join(' · ')}.</p>
      <ul class="pending-list">${c.pending.map(x => `<li class="lvl-${x.level}"><i class="bi ${x.icon}"></i>
        <span class="lvl">${labels[x.level]}</span><span class="txt">${x.text}</span>
        <a class="no-print" href="${x.href}" aria-label="Abrir"><i class="bi bi-arrow-up-right"></i></a></li>`).join('')}</ul>`;
  },

  analise(c, p) {
    const saved = config.narratives[p.key] || {};
    const fields = [
      ['activities', 'Atividades realizadas e resultados alcançados', 'Ex.: feira de adoção em outubro, mutirão de vacinação, parcerias firmadas...'],
      ['difficulties', 'Dificuldades encontradas e justificativas', 'Explique metas não atingidas, falta de insumos, aumento de demanda...'],
      ['nextSteps', 'Ações para o próximo período', 'O que a equipe vai fazer para melhorar os resultados.']
    ];
    return fields.map(([key, label, placeholder]) => `<div class="narrative">
        <label class="form-label" for="nt-${key}">${label}</label>
        <textarea id="nt-${key}" class="form-control no-print" rows="3" maxlength="2000" data-narrative="${key}" placeholder="${placeholder}">${escapeHtml(saved[key] || '')}</textarea>
        <div class="print-only narrative-text" data-print="${key}">${escapeHtml(saved[key] || '') || '<span class="muted">Não informado.</span>'}</div>
      </div>`).join('') + '<p class="note no-print">O texto é salvo automaticamente para este período.</p>';
  },

  assinatura() {
    const o = config.org;
    const today = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
    return `<p>Declaro que as informações deste relatório correspondem às atividades executadas pela organização no período indicado e que os registros e documentos que as comprovam estão disponíveis para consulta do órgão concedente.</p>
      <p class="mt-3">${escapeHtml((o.city || '').replace(/\s*-\s*[A-Z]{2}$/, ''))}${o.city ? ', ' : ''}${today}.</p>
      <div class="signature"><span></span><strong>${escapeHtml(o.legalRep)}</strong><small>${escapeHtml(o.legalRole || 'Responsável legal')} — ${escapeHtml(o.name)}</small></div>`;
  }
};

// =========================================================
// Gráficos
// =========================================================
function monthsOf(p) {
  const list = [];
  const d = parse(p.start); d.setDate(1);
  const last = parse(p.until);
  while (d <= last && list.length < 24) {
    list.push({ key: toIso(d).slice(0, 7), label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') + (p.start.slice(0, 4) !== p.until.slice(0, 4) ? `/${String(d.getFullYear()).slice(2)}` : '') });
    d.setMonth(d.getMonth() + 1);
  }
  return list;
}

function drawCharts(c, p) {
  charts.forEach(ch => ch.destroy());
  charts = [];
  if (typeof Chart === 'undefined') return;
  Chart.defaults.font.family = "'DM Sans', sans-serif";
  Chart.defaults.color = PawTema.cor('--chart-text');
  const tooltip = { backgroundColor: PawTema.cor('--chart-tooltip'), padding: 11 };

  const statusCanvas = $('statusChart');
  if (statusCanvas) {
    const colors = { 'Disponível': '#4c8a77', 'Em Tratamento': '#c9954d', 'Resgatado': '#8373aa', 'Em Lar Temporário': '#b56a8b' };
    charts.push(new Chart(statusCanvas, {
      type: 'doughnut',
      data: { labels: c.animals.byStatus.map(([s]) => s), datasets: [{ data: c.animals.byStatus.map(([, n]) => n), backgroundColor: c.animals.byStatus.map(([s]) => colors[s]), borderColor: PawTema.cor('--card'), tokens: { borderColor: '--card' }, borderWidth: 3 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '68%', animation: false, plugins: { legend: { display: false }, tooltip } }
    }));
  }

  const monthlyCanvas = $('monthlyChart');
  if (monthlyCanvas) {
    const months = monthsOf(p);
    const per = (dates) => months.map(m => dates.filter(dt => dt && dt.startsWith(m.key)).length);
    charts.push(new Chart(monthlyCanvas, {
      type: 'bar',
      data: {
        labels: months.map(m => m.label),
        datasets: [
          { label: 'Ocorrências de resgate', data: per(c.rescues.list.map(r => r.date)), backgroundColor: PawTema.cor('--chart-3'), tokens: { backgroundColor: '--chart-3' } },
          { label: 'Animais acolhidos', data: per(c.animals.entries.map(a => a.arrival)), backgroundColor: PawTema.cor('--chart-2'), tokens: { backgroundColor: '--chart-2' } },
          { label: 'Adoções concluídas', data: per(c.adoptions.done.map(a => a.closedAt)), backgroundColor: PawTema.cor('--green-900'), tokens: { backgroundColor: '--green-900' } }
        ].map(ds => ({ ...ds, borderRadius: 4, maxBarThickness: 18 }))
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true } }, tooltip },
        scales: {
          x: { grid: { display: false }, border: { display: false } },
          y: { beginAtZero: true, suggestedMax: 3, ticks: { stepSize: 1, precision: 0 }, grid: { color: PawTema.cor('--chart-grid') }, border: { display: false } }
        }
      }
    }));
  }
}

// =========================================================
// Montagem da página
// =========================================================
function renderToggles() {
  $('sectionToggles').innerHTML = '<span class="toggles-label">Seções:</span>' + SECTIONS.map(s =>
    `<label class="toggle-chip"><input type="checkbox" value="${s.id}"${enabled.has(s.id) ? ' checked' : ''}><span>${s.label}</span></label>`).join('');
}

function applyModel(model) {
  enabled = new Set(SECTIONS.filter(s => s.models.includes(model)).map(s => s.id));
  renderToggles();
}

let lastCalc = null;

function render() {
  const p = currentPeriod();
  const warn = $('periodWarning');
  if (!p.start || !p.end || p.start > p.end) {
    warn.textContent = 'Informe um período válido: a data inicial precisa ser anterior à final.';
    warn.classList.remove('d-none');
    return;
  }
  if (p.start > TODAY) {
    warn.textContent = 'O período escolhido ainda não começou; não há dados para mostrar.';
    warn.classList.remove('d-none');
    return;
  }
  warn.classList.add('d-none');

  const c = calculate(p);
  lastCalc = { c, p };
  const titles = Object.fromEntries(SECTIONS.map(s => [s.id, s.label]));
  const leads = {
    metas: 'Comparação entre o pactuado no plano de trabalho e o realizado no período.',
    resgates: 'Ocorrências registradas no período e o resultado de cada atendimento.',
    animais: 'Balanço de entradas e saídas e situação de quem continua sob cuidado da organização.',
    saude: 'Cuidados veterinários prestados no período e cobertura dos animais sob cuidado hoje.',
    adocoes: 'Processos de adoção responsável e seus resultados.',
    insumos: 'Entrada, uso e situação de rações, medicamentos, vacinas e materiais.',
    financeiro: 'Receitas, despesas e comprovação do uso dos recursos.',
    equipe: 'Distribuição do trabalho entre as pessoas da equipe.',
    pendencias: '',
    analise: 'Leitura da equipe sobre os números acima.',
    assinatura: ''
  };

  let n = 0;
  const body = SECTIONS.filter(s => enabled.has(s.id)).map(s => sectionHtml(++n, s.id, titles[s.id], R[s.id](c, p), leads[s.id] || '')).join('');
  const generated = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const model = $('reportModel').selectedOptions[0].textContent;

  $('report').innerHTML = `
    <header class="report-head">
      <div class="report-brand"><span class="brand-mark"><i class="bi bi-heart-pulse-fill"></i></span>
        <div><strong>${escapeHtml(config.org.name)}</strong><small>${config.partnership.publicFunding ? escapeHtml(config.partnership.instrument) : 'Relatório de atividades'}</small></div></div>
      <div class="report-title">
        <div class="eyebrow">${escapeHtml(model)}</div>
        <h2>Relatório técnico de atividades</h2>
        <p>${formatDate(p.start)} a ${formatDate(p.end)}</p>
      </div>
    </header>
    ${body || '<div class="empty"><i class="bi bi-ui-checks"></i><h2>Nenhuma seção selecionada</h2><p>Marque ao menos uma seção acima.</p></div>'}
    <footer class="report-foot"><span>Gerado pelo PAWSAFE em ${generated}</span><span>Fonte: registros dos módulos Animais, Resgates, Adoções e Estoque</span></footer>`;

  drawCharts(c, p);
}

// ---------- Período (somente pelas datas De / Até) ----------
['periodStart', 'periodEnd'].forEach(id => $(id).addEventListener('change', render));
$('reportModel').addEventListener('change', (e) => { applyModel(e.target.value); render(); });
$('sectionToggles').addEventListener('change', (e) => {
  if (e.target.type !== 'checkbox') return;
  e.target.checked ? enabled.add(e.target.value) : enabled.delete(e.target.value);
  render();
});

// ---------- Análise escrita (salva por período, sem recarregar a página) ----------
let saveTimer;
$('report').addEventListener('input', (e) => {
  const key = e.target.dataset?.narrative;
  if (!key) return;
  const p = currentPeriod();
  config.narratives[p.key] = { ...(config.narratives[p.key] || {}), [key]: e.target.value };
  const print = document.querySelector(`[data-print="${key}"]`);
  if (print) print.innerHTML = escapeHtml(e.target.value) || '<span class="muted">Não informado.</span>';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => PawData.saveReportConfig(config), 400);
});

// ---------- Configuração ----------
const configModal = new bootstrap.Modal($('configModal'));
const CONFIG_FIELDS = {
  cfName: ['org', 'name'], cfCnpj: ['org', 'cnpj'], cfAddress: ['org', 'address'], cfCity: ['org', 'city'],
  cfPhone: ['org', 'phone'], cfEmail: ['org', 'email'], cfRep: ['org', 'legalRep'], cfRole: ['org', 'legalRole'],
  cfInstrument: ['partnership', 'instrument'], cfGrantor: ['partnership', 'grantor'], cfObject: ['partnership', 'object'],
  cfStart: ['partnership', 'start'], cfEnd: ['partnership', 'end'],
  gRescues: ['goals', 'rescues'], gAdoptions: ['goals', 'adoptions'], gVaccines: ['goals', 'vaccines'], gHealth: ['goals', 'healthCare']
};
const togglePartnership = () => $('partnershipFields').classList.toggle('is-disabled', !$('cfFunding').checked);

$('openConfig').addEventListener('click', () => {
  Object.entries(CONFIG_FIELDS).forEach(([id, [group, key]]) => { $(id).value = config[group][key] ?? ''; });
  $('cfFunding').checked = Boolean(config.partnership.publicFunding);
  togglePartnership();
  configModal.show();
});
$('cfFunding').addEventListener('change', togglePartnership);

$('configForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if ($('cfStart').value && $('cfEnd').value && $('cfStart').value > $('cfEnd').value) {
    $('cfEnd').setCustomValidity('O fim da vigência precisa ser depois do início.');
    $('cfEnd').reportValidity();
    return;
  }
  $('cfEnd').setCustomValidity('');
  Object.entries(CONFIG_FIELDS).forEach(([id, [group, key]]) => {
    const raw = $(id).value.trim();
    config[group][key] = group === 'goals' ? Math.max(0, Number(raw) || 0) : raw;
  });
  config.partnership.publicFunding = $('cfFunding').checked;
  PawData.saveReportConfig(config) ? showToast('Configuração salva.') : showToast('Não foi possível salvar a configuração.');
  configModal.hide();
  render();
});
$('cfEnd').addEventListener('input', () => $('cfEnd').setCustomValidity(''));

// ---------- Exportar e imprimir ----------
$('printReport').addEventListener('click', () => window.print());
// Os gráficos precisam ser redesenhados no tamanho da folha.
window.addEventListener('beforeprint', () => charts.forEach(ch => ch.resize()));
window.addEventListener('afterprint', () => charts.forEach(ch => ch.resize()));

$('exportCsv').addEventListener('click', () => {
  if (!lastCalc) return;
  const { c, p } = lastCalc;
  const rows = [
    ['Indicador', 'Valor'],
    ['Período', `${formatDate(p.start)} a ${formatDate(p.end)}`],
    ['Ocorrências de resgate', c.rescues.list.length],
    ['Resgates concluídos', c.rescues.done.length],
    ['Resgates sem sucesso', c.rescues.failed.length],
    ['Resgates em aberto', c.rescues.open.length],
    ['Tempo médio de atendimento (dias)', c.rescues.responseTime === null ? '' : Math.round(c.rescues.responseTime * 10) / 10],
    ['Animais no início do período', c.animals.startPop.length],
    ['Entradas de animais', c.animals.entries.length],
    ['Saídas por adoção', c.animals.exits.length],
    ['Animais no fim do período', c.animals.endPop.length],
    ['Processos de adoção abertos', c.adoptions.opened.length],
    ['Adoções concluídas', c.adoptions.done.length],
    ['Adoções recusadas', c.adoptions.refused.length],
    ['Adoções canceladas', c.adoptions.cancelled.length],
    ['Duração média da adoção (dias)', c.adoptions.duration === null ? '' : Math.round(c.adoptions.duration * 10) / 10],
    ['Vacinas aplicadas', c.health.vaccines.length],
    ['Atendimentos veterinários', c.health.procedures.length],
    ['Animais sob cuidado vacinados (%)', pct(c.health.vaccinated, c.health.population)],
    ['Animais sob cuidado castrados (%)', pct(c.health.neutered, c.health.population)],
    ['Entradas de insumos por doação', c.stock.donations.length],
    ['Entradas de insumos por compra', c.stock.purchases.length],
    ['Perdas / descartes de insumos', c.stock.losses.length],
    ['Itens de estoque para repor', c.stock.alerts.restock.length]
  ];
  // ";" e BOM para o Excel em português abrir com acentos e colunas certas.
  const csv = '﻿' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = `relatorio-pawsafe_${p.start}_${p.end}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('Indicadores exportados em CSV.');
});

// ---------- Início ----------
applyModel($('reportModel').value);
// Datas iniciais: ano corrente (o usuário ajusta em De / Até).
$('periodStart').value = `${parse(TODAY).getFullYear()}-01-01`;
$('periodEnd').value = `${parse(TODAY).getFullYear()}-12-31`;
render();
