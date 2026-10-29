/* PAWSAFE — Dashboard
   Animais, adoções e resgates vêm de js/dados.js — a mesma fonte dos módulos.
   Os cartões de voluntários e doações seguem ilustrativos até esses módulos existirem. */

const animals = PawData.loadAnimals();
const adopters = PawData.loadAdopters();
const adoptions = PawData.loadAdoptions();
const rescues = PawData.loadRescues();
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
  openRescues: rescues.filter(isOpenRescue).length
};
document.querySelectorAll('[data-stat]').forEach(el => { el.textContent = stats[el.dataset.stat]; });
document.querySelectorAll('[data-species]').forEach(el => { el.textContent = speciesCount[el.dataset.species]; });

document.getElementById('statusList').innerHTML = PawData.STATUS.map(status =>
  `<span class="status-pill ${PawData.statusClass(status)}"><i></i>${status} <strong>${countBy(a => a.status === status)}</strong></span>`
).join('');

// ---------- Últimas adoções ----------
const recent = [...adoptions].sort((a, b) => b.openedAt.localeCompare(a.openedAt)).slice(0, 4);
document.getElementById('recentAdoptions').innerHTML = recent.length
  ? recent.map(o => {
    const animal = animals.find(a => a.id === o.animalId);
    const adopter = adopters.find(p => p.id === o.adopterId);
    const avatar = animal?.species === 'Gato' ? 'animal-cat' : 'animal-dog';
    return `<tr class="clickable-row" data-href="Pages/adocoes.html?processo=${o.id}">
      <td><div class="animal-cell"><span class="animal-avatar ${avatar}"><i class="bi bi-paw-fill"></i></span>
        <span><strong>${escapeHtml(animal?.name ?? 'Animal removido')}</strong><small>${escapeHtml(animal ? `${animal.sex} · ${animal.age || 'idade não informada'}` : '')}</small></span></div></td>
      <td>${escapeHtml(adopter?.name ?? '—')}</td>
      <td>${formatDate(o.openedAt)}</td>
      <td><span class="status-badge ${PawData.stageClass(o.stage)}">${o.stage}</span></td>
    </tr>`;
  }).join('')
  : '<tr><td colspan="4" class="text-center py-4">Nenhum processo de adoção registrado.</td></tr>';

document.getElementById('recentAdoptions').addEventListener('click', (event) => {
  const row = event.target.closest('[data-href]');
  if (row) window.location.href = row.dataset.href;
});

// ---------- Resgates: em aberto primeiro (mais urgentes no topo), depois os mais recentes ----------
const PRIORITY_ORDER = { 'Crítica': 0, 'Alta': 1, 'Média': 2, 'Baixa': 3 };
const recentRescues = [...rescues]
  .sort((a, b) => (isOpenRescue(b) - isOpenRescue(a))
    || (isOpenRescue(a) ? PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] : 0)
    || b.date.localeCompare(a.date))
  .slice(0, 4);

document.getElementById('recentRescues').innerHTML = recentRescues.length
  ? recentRescues.map(r => `<tr class="clickable-row" data-href="Pages/resgates.html?resgate=${r.id}">
      <td><div class="animal-cell"><span class="animal-avatar ${r.species === 'Gato' ? 'animal-cat' : 'animal-dog'}"><i class="bi bi-geo-alt-fill"></i></span>
        <span><strong>${escapeHtml(r.description)}</strong><small>${escapeHtml(r.district)}, ${escapeHtml(r.city)}</small></span></div></td>
      <td>${formatDate(r.date)}</td>
      <td><span class="status-badge ${PawData.priorityClass(r.priority)}">${r.priority}</span></td>
      <td><span class="status-badge ${PawData.rescueClass(r.stage)}">${r.stage}</span></td>
    </tr>`).join('')
  : '<tr><td colspan="4" class="text-center py-4">Nenhum resgate registrado.</td></tr>';

// Linhas clicáveis das duas tabelas levam ao registro correspondente
document.getElementById('recentRescues').addEventListener('click', (event) => {
  const row = event.target.closest('[data-href]');
  if (row) window.location.href = row.dataset.href;
});

// ---------- Adoções concluídas por mês (últimos 6 meses) ----------
const months = Array.from({ length: 6 }, (_, i) => {
  const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
  return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') };
});
const adoptionsPerMonth = months.map(m =>
  adoptions.filter(o => o.stage === 'Concluída' && o.closedAt.startsWith(m.key)).length);

// ---------- Gráficos (Chart.js) ----------
if (typeof Chart === 'undefined') {
  console.warn('Chart.js não foi carregado. Verifique sua conexão com a internet.');
} else {
  Chart.defaults.font.family = "'DM Sans', sans-serif";
  Chart.defaults.color = '#718077';
  const tooltip = { backgroundColor: '#19372e', padding: 11 };

  new Chart(document.getElementById('adoptionsChart'), {
    type: 'bar',
    data: {
      labels: months.map(m => m.label),
      datasets: [{
        data: adoptionsPerMonth,
        backgroundColor: '#397665',
        hoverBackgroundColor: '#244438',
        borderRadius: 6,
        maxBarThickness: 31
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { ...tooltip, displayColors: false, callbacks: { label: ctx => ` ${ctx.parsed.y} adoção(ões)` } }
      },
      scales: {
        x: { grid: { display: false }, border: { display: false } },
        y: { beginAtZero: true, suggestedMax: 4, ticks: { stepSize: 1, precision: 0 }, grid: { color: 'rgba(44, 77, 62, 0.08)' }, border: { display: false } }
      }
    }
  });

  new Chart(document.getElementById('speciesChart'), {
    type: 'doughnut',
    data: {
      labels: ['Cães', 'Gatos', 'Outros'],
      datasets: [{
        data: Object.values(speciesCount),
        backgroundColor: ['#397665', '#78977c', '#c47755'],
        borderColor: '#ffffff',
        borderWidth: 4,
        hoverOffset: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: { legend: { display: false }, tooltip }
    }
  });
}
