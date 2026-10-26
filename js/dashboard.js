/* PAWSAFE — Dashboard
   Indicadores de animais vêm de js/dados.js (mesma fonte do módulo de Animais).
   O gráfico de adoções por mês continua ilustrativo até o módulo de Adoções existir. */

const animals = PawData.loadAnimals();
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
  adopted: countBy(a => a.status === 'Adotado')
};
document.querySelectorAll('[data-stat]').forEach(el => { el.textContent = stats[el.dataset.stat]; });
document.querySelectorAll('[data-species]').forEach(el => { el.textContent = speciesCount[el.dataset.species]; });

document.getElementById('statusList').innerHTML = PawData.STATUS.map(status =>
  `<span class="status-pill ${PawData.statusClass(status)}"><i></i>${status} <strong>${countBy(a => a.status === status)}</strong></span>`
).join('');

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
      labels: ['Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out'],
      datasets: [{
        data: [3, 5, 4, 7, 6, 2],
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
        y: { beginAtZero: true, ticks: { stepSize: 2 }, grid: { color: 'rgba(44, 77, 62, 0.08)' }, border: { display: false } }
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
