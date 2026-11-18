/* PAWSAFE — Dashboard
   Todos os números vêm de js/dados.js — a mesma fonte dos módulos. */

const animals = PawData.loadAnimals();
const adopters = PawData.loadAdopters();
const adoptions = PawData.loadAdoptions();
const rescues = PawData.loadRescues();
const volunteers = PawData.loadVolunteers();
const thisMonth = PawUtils.today().slice(0, 7); // "AAAA-MM"
const monthFinancial = PawData.loadDonations().filter(d => PawFinance.isFinancial(d) && PawFinance.monthKey(d.date) === thisMonth);
const [monthFlow] = PawFinance.monthlyFlow(PawData.loadDonations(), PawData.loadExpenses(), [thisMonth], PawData.loadOpening());
const isOpenRescue = (r) => PawData.OPEN_RESCUE_STAGES.includes(r.stage);
const { escapeHtml, formatDate } = PawUtils;
const countBy = (test) => animals.filter(test).length;

const speciesCount = {
  'Cão': countBy(a => a.species === 'Cão'),
  'Gato': countBy(a => a.species === 'Gato'),
  'Outros': countBy(a => a.species !== 'Cão' && a.species !== 'Gato')
};

// ---------- Datas ----------
const now = new Date();
document.getElementById('currentDate').textContent = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
}).format(now);
document.getElementById('currentYear').textContent = now.getFullYear();

// ---------- Indicadores ----------
const stats = {
  total: animals.length,
  available: countBy(a => a.status === 'Disponível'),
  adopted: countBy(a => a.status === 'Adotado'),
  openRescues: rescues.filter(isOpenRescue).length,
  activeVolunteers: volunteers.filter(v => v.status === 'Ativo').length,
  monthDonations: PawUtils.money(monthFlow.income),
  monthDonationsFoot: PawUtils.plural(monthFinancial.length, 'doação financeira registrada', 'doações financeiras registradas'),
  pendingVolunteers: PawUtils.plural(volunteers.filter(v => v.status === 'Interessado').length, 'interessado aguardando', 'interessados aguardando')
};
stats.availableFoot = `${PawUtils.plural(stats.available, 'disponível', 'disponíveis')} para adoção`;
document.querySelectorAll('[data-stat]').forEach(el => { el.textContent = stats[el.dataset.stat]; });
document.querySelectorAll('[data-species]').forEach(el => { el.textContent = speciesCount[el.dataset.species]; });

// ---------- Distribuição por status: barras com trilho hachurado ----------
const STATUS_COLOR = {
  'Disponível': 'var(--status-ok)', 'Adotado': 'var(--status-info)', 'Em Tratamento': 'var(--status-alerta)',
  'Resgatado': 'var(--status-roxo)', 'Em Lar Temporário': 'var(--status-rosa)'
};
const statusList = document.getElementById('statusList');
statusList.innerHTML = PawData.STATUS.map(status => {
  const n = countBy(a => a.status === status);
  const pct = animals.length ? Math.round((n / animals.length) * 100) : 0;
  return `<div class="status-bar" title="${status}: ${n} (${pct}%)">
    <span>${status}</span>
    <span class="bar-track" role="img" aria-label="${status}: ${pct}%"><span class="bar-fill" style="color:${STATUS_COLOR[status] || 'var(--primary)'}" data-width="${pct}"></span></span>
    <strong>${n}</strong>
  </div>`;
}).join('');
requestAnimationFrame(() => statusList.querySelectorAll('.bar-fill').forEach(b => { b.style.width = `${Math.max(b.dataset.width, b.dataset.width > 0 ? 4 : 0)}%`; }));

// Linhas clicáveis (mouse e teclado) levam ao registro correspondente
function ligarLinhas(lista) {
  const ir = (row) => { if (row) window.location.href = row.dataset.href; };
  lista.addEventListener('click', (e) => ir(e.target.closest('[data-href]')));
  lista.addEventListener('keydown', (e) => { if (e.key === 'Enter') ir(e.target.closest('[data-href]')); });
}

// ---------- Últimas adoções ----------
const recent = [...adoptions].sort((a, b) => b.openedAt.localeCompare(a.openedAt)).slice(0, 5);
const adoptionsList = document.getElementById('recentAdoptions');
adoptionsList.innerHTML = recent.length
  ? recent.map(o => {
    const animal = animals.find(a => a.id === o.animalId);
    const adopter = adopters.find(p => p.id === o.adopterId);
    const avatar = animal?.species === 'Gato' ? 'animal-cat' : 'animal-dog';
    return `<li class="item-row" data-href="Pages/adocoes.html?processo=${o.id}" tabindex="0">
      <span class="item-icon ${avatar}"><i class="bi bi-paw-fill"></i></span>
      <span class="item-text"><strong>${escapeHtml(animal?.name ?? 'Animal removido')}</strong>
        <small title="Aberto em ${formatDate(o.openedAt)}">${adopter ? escapeHtml(adopter.name) : `Aberto em ${formatDate(o.openedAt)}`}</small></span>
      <span class="item-badges"><span class="status-badge ${PawData.stageClass(o.stage)}">${o.stage}</span></span>
    </li>`;
  }).join('')
  : '<li class="item-empty">Nenhum processo de adoção registrado.</li>';
ligarLinhas(adoptionsList);

// ---------- Resgates: em aberto primeiro (mais urgentes no topo), depois os mais recentes ----------
const PRIORITY_ORDER = { 'Crítica': 0, 'Alta': 1, 'Média': 2, 'Baixa': 3 };
const sortedRescues = [...rescues]
  .sort((a, b) => (isOpenRescue(b) - isOpenRescue(a))
    || (isOpenRescue(a) ? PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] : 0)
    || b.date.localeCompare(a.date));

const rescuesList = document.getElementById('recentRescues');
rescuesList.innerHTML = sortedRescues.length
  ? sortedRescues.slice(0, 4).map(r => `<li class="item-row" data-href="Pages/resgates.html?resgate=${r.id}" tabindex="0">
      <span class="item-icon ${r.species === 'Gato' ? 'animal-cat' : 'animal-dog'}"><i class="bi bi-geo-alt-fill"></i></span>
      <span class="item-text"><strong>${escapeHtml(r.description)}</strong><small>${escapeHtml(r.district)}, ${escapeHtml(r.city)} · ${formatDate(r.date)}</small></span>
      <span class="item-badges"><span class="status-badge ${PawData.priorityClass(r.priority)}">${r.priority}</span><span class="status-badge ${PawData.rescueClass(r.stage)}">${r.stage}</span></span>
    </li>`).join('')
  : '<li class="item-empty">Nenhum resgate registrado.</li>';
ligarLinhas(rescuesList);

// ---------- Resgate prioritário (o mais urgente em aberto) ----------
const urgent = sortedRescues.find(isOpenRescue);
const focus = document.getElementById('priorityRescue');
focus.innerHTML = `<div class="panel-heading"><div><h2>Resgate prioritário</h2><p>O mais urgente em aberto</p></div></div>
  ${urgent ? `
    <p class="focus-title">${escapeHtml(urgent.description)}</p>
    <div class="focus-meta">
      <span><i class="bi bi-geo-alt"></i>${escapeHtml(urgent.district)}, ${escapeHtml(urgent.city)}</span>
      <span><i class="bi bi-calendar3"></i>Registrado em ${formatDate(urgent.date)}</span>
    </div>
    <div class="focus-badges"><span class="status-badge ${PawData.priorityClass(urgent.priority)}">Prioridade ${urgent.priority.toLowerCase()}</span><span class="status-badge ${PawData.rescueClass(urgent.stage)}">${urgent.stage}</span></div>
    <a class="btn btn-green" href="Pages/resgates.html?resgate=${urgent.id}"><i class="bi bi-arrow-right-circle"></i>Abrir resgate</a>`
  : `<div class="focus-empty"><div><i class="bi bi-check2-circle"></i>Nenhum resgate em aberto agora.</div></div>`}`;

// ---------- Adoções concluídas por mês (últimos 6 meses) ----------
const months = Array.from({ length: 6 }, (_, i) => {
  const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
  return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') };
});
const adoptionsPerMonth = months.map(m =>
  adoptions.filter(o => o.stage === 'Concluída' && o.closedAt.startsWith(m.key)).length);
const periodTotal = adoptionsPerMonth.reduce((a, b) => a + b, 0);
document.getElementById('adoptionsTotal').textContent = PawUtils.plural(periodTotal, 'adoção no período', 'adoções no período');
// Nenhuma adoção no período: em vez de seis trilhos "cheios", uma mensagem clara.
if (periodTotal === 0) {
  const wrap = document.getElementById('adoptionsChart').parentElement;
  wrap.classList.add('is-empty');
  wrap.insertAdjacentHTML('beforeend', '<p class="chart-empty"><span>Nenhuma adoção concluída nos últimos 6 meses.</span></p>');
}

// ---------- Taxa de adoção ----------
const adoptionRate = animals.length ? Math.round((stats.adopted / animals.length) * 100) : 0;
document.getElementById('adoptionRate').textContent = `${adoptionRate}%`;

// ---------- Gráficos (Chart.js) ----------
// Listras diagonais (o "hachurado" da referência) para trilhos e partes vazias.
function hatch() {
  const c = document.createElement('canvas');
  c.width = c.height = 8;
  const g = c.getContext('2d');
  g.strokeStyle = PawTema.cor('--hatch');
  g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(-2, 10); g.lineTo(10, -2); g.moveTo(6, 10); g.lineTo(10, 6); g.moveTo(-2, 2); g.lineTo(2, -2); g.stroke();
  return g.createPattern(c, 'repeat');
}

if (typeof Chart === 'undefined') {
  console.warn('Chart.js não foi carregado. Verifique sua conexão com a internet.');
} else {
  Chart.defaults.font.family = "'DM Sans', sans-serif";
  Chart.defaults.color = PawTema.cor('--chart-text');
  const tooltip = { backgroundColor: PawTema.cor('--chart-tooltip'), padding: 11, cornerRadius: 10 };

  // Barras em pílula: o valor em verde sobre um trilho hachurado (o teto do gráfico).
  const teto = Math.max(4, ...adoptionsPerMonth) + 1;
  const ultimo = adoptionsPerMonth.length - 1;
  const barCores = () => adoptionsPerMonth.map((_, i) => PawTema.cor(i === ultimo ? '--chart-2' : '--chart-1'));
  const adoptionsChart = new Chart(document.getElementById('adoptionsChart'), {
    type: 'bar',
    data: {
      labels: months.map(m => m.label),
      datasets: [{
        label: 'Adoções',
        data: adoptionsPerMonth.map(v => v || null),
        backgroundColor: barCores(),
        borderRadius: 999,
        borderSkipped: false,
        maxBarThickness: 46,
        categoryPercentage: 0.7,
        barPercentage: 0.95,
        grouped: false,
        order: 1
      }, {
        label: 'trilho',
        data: adoptionsPerMonth.map(() => teto),
        backgroundColor: hatch(),
        borderColor: PawTema.cor('--hatch'),
        tokens: { borderColor: '--hatch' },
        borderWidth: 1,
        borderRadius: 999,
        borderSkipped: false,
        maxBarThickness: 46,
        categoryPercentage: 0.7,
        barPercentage: 0.95,
        grouped: false,
        order: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { ...tooltip, displayColors: false, filter: (item) => item.datasetIndex === 0,
          callbacks: { title: items => items[0]?.label, label: ctx => ` ${ctx.parsed.y} adoção(ões) concluída(s)` } }
      },
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { font: { weight: 600 } } },
        y: { display: false, beginAtZero: true, max: teto }
      }
    }
  });

  new Chart(document.getElementById('speciesChart'), {
    type: 'doughnut',
    data: {
      labels: ['Cães', 'Gatos', 'Outros'],
      datasets: [{
        data: Object.values(speciesCount),
        backgroundColor: ['--chart-1', '--chart-2', '--chart-3'].map(PawTema.cor),
        borderColor: PawTema.cor('--card'),
        tokens: { backgroundColor: ['--chart-1', '--chart-2', '--chart-3'], borderColor: '--card' },
        borderWidth: 4,
        borderRadius: 8,
        hoverOffset: 5
      }]
    },
    options: { responsive: true, maintainAspectRatio: false, cutout: '74%', plugins: { legend: { display: false }, tooltip } }
  });

  // Meio-donut: adotados (verde), disponíveis (escuro) e os demais (hachurado).
  const outros = Math.max(animals.length - stats.adopted - stats.available, 0);
  const escuroGauge = () => PawTema.escuro() ? 'hsl(150 30% 75%)' : PawTema.cor('--green-950');
  const gauge = new Chart(document.getElementById('adoptionGauge'), {
    type: 'doughnut',
    data: {
      labels: ['Adotados', 'Disponíveis', 'Outros'],
      datasets: [{
        data: animals.length ? [stats.adopted, stats.available, outros] : [0, 0, 1],
        backgroundColor: [PawTema.cor('--chart-1'), escuroGauge(), hatch()],
        borderColor: PawTema.cor('--card'),
        tokens: { borderColor: '--card' },
        borderWidth: 3,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      rotation: -90,
      circumference: 180,
      cutout: '68%',
      layout: { padding: { bottom: 0 } },
      plugins: { legend: { display: false }, tooltip: { ...tooltip, enabled: animals.length > 0 } }
    }
  });

  // Padrões (listras) e cores calculadas não são tokens: refaz ao trocar o tema.
  new MutationObserver(() => {
    const ds = adoptionsChart.data.datasets;
    ds[0].backgroundColor = barCores();
    ds[1].backgroundColor = hatch();
    gauge.data.datasets[0].backgroundColor = [PawTema.cor('--chart-1'), escuroGauge(), hatch()];
    adoptionsChart.update('none');
    gauge.update('none');
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
}
