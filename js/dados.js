/* PAWSAFE — fonte única de dados do protótipo.
   Enquanto o back-end (Laravel + MySQL) não existe, os animais ficam no localStorage.
   Dashboard, menu lateral e módulo de Animais leem daqui, então os números sempre batem.
   Na integração com o back-end, troque loadAnimals/saveAnimals por chamadas à API. */

const PawData = (() => {
  const STORAGE_KEY = 'pawsafe_animais_v1';

  const STATUS = ['Disponível', 'Adotado', 'Em Tratamento', 'Resgatado', 'Em Lar Temporário'];
  const SPECIES = ['Cão', 'Gato', 'Outros'];

  // Classe CSS de cada status (cores definidas em CSS/base.css).
  const STATUS_CLASS = {
    'Disponível': 'status-disponivel',
    'Adotado': 'status-adotado',
    'Em Tratamento': 'status-tratamento',
    'Resgatado': 'status-resgatado',
    'Em Lar Temporário': 'status-temporario'
  };
  const statusClass = (status) => STATUS_CLASS[status] || 'status-disponivel';

  const photo = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=900&q=80`;

  // Dados de demonstração usados na primeira abertura do sistema.
  const SEED = [
    {
      id: 1, name: 'Thor', species: 'Cão', breed: 'Labrador', color: 'Dourado', age: '3 anos',
      arrival: '2026-03-14', sex: 'Macho', size: 'Grande', status: 'Disponível',
      photo: photo('1552053831-71594a27632d'), weight: 26.4,
      vaccinated: true, neutered: true, chip: false, notes: 'Sociável e ativo. Gosta de passeios.',
      vaccines: [{ name: 'V8', date: '2026-03-15', next: '2027-03-15', lot: 'V8-2048', vet: 'Dra. Marina Lopes' }],
      history: [{ type: 'Consulta', date: '2026-03-14', description: 'Avaliação geral de chegada', vet: 'Dra. Marina Lopes', notes: 'Saúde geral boa.' }],
      weights: [{ weight: 26.4, date: '2026-03-14', note: 'Avaliação inicial' }]
    },
    {
      id: 2, name: 'Mia', species: 'Gato', breed: 'Siamês', color: 'Creme e marrom', age: '2 anos',
      arrival: '2026-02-09', sex: 'Fêmea', size: 'Pequeno', status: 'Disponível',
      photo: photo('1573865526739-10659f8f3bcf'), weight: 4.2,
      vaccinated: true, neutered: true, chip: false, notes: 'Tranquila e aparentemente saudável.',
      vaccines: [
        { name: 'Tríplice Felina', date: '2026-02-10', next: '2027-02-10', lot: 'TF-2026-220', vet: 'Dr. Henrique Farias' },
        { name: 'Antirrábica', date: '2026-02-10', next: '2027-02-10', lot: 'AR-2026-046', vet: 'Dr. Henrique Farias' }
      ],
      history: [
        { type: 'Consulta', date: '2026-03-10', description: 'Retorno — avaliação nutricional', vet: 'Dr. Henrique Farias', notes: 'Ganhou 400 g. Ótima evolução.' },
        { type: 'Consulta', date: '2026-02-09', description: 'Avaliação geral de chegada', vet: 'Dr. Henrique Farias', notes: 'Dieta de recuperação prescrita.' }
      ],
      weights: [
        { weight: 4.2, date: '2026-03-10', note: 'Retorno' },
        { weight: 3.8, date: '2026-02-09', note: 'Chegada' }
      ]
    },
    {
      id: 3, name: 'Bolinha', species: 'Cão', breed: 'Vira-lata', color: 'Branco e marrom', age: '1 ano',
      arrival: '2026-04-02', sex: 'Macho', size: 'Médio', status: 'Em Tratamento',
      photo: photo('1543466835-00a7907e9de1'), weight: 12.1,
      vaccinated: false, neutered: false, chip: false, notes: 'Em acompanhamento veterinário.',
      vaccines: [],
      history: [{ type: 'Tratamento', date: '2026-04-02', description: 'Início de tratamento dermatológico', vet: 'Dra. Marina Lopes', notes: 'Retorno agendado.' }],
      weights: [{ weight: 12.1, date: '2026-04-02', note: 'Pesagem de chegada' }]
    },
    {
      id: 4, name: 'Nina', species: 'Gato', breed: 'Persa', color: 'Caramelo', age: '4 anos',
      arrival: '2026-01-20', sex: 'Fêmea', size: 'Médio', status: 'Em Lar Temporário',
      photo: photo('1574158622682-e40e69881006'), weight: 3.9,
      vaccinated: true, neutered: true, chip: true, notes: 'Em lar temporário.',
      vaccines: [{ name: 'Antirrábica', date: '2026-01-20', next: '2027-01-20', lot: 'AR-9012', vet: 'Dr. Henrique Farias' }],
      history: [],
      weights: [{ weight: 3.9, date: '2026-01-20', note: 'Chegada' }]
    },
    {
      id: 5, name: 'Rex', species: 'Cão', breed: 'Pastor Alemão', color: 'Preto e caramelo', age: '5 anos',
      arrival: '2025-12-11', sex: 'Macho', size: 'Grande', status: 'Adotado',
      photo: photo('1568572933382-74d440642117'), weight: 31.5,
      vaccinated: true, neutered: true, chip: true, notes: 'Adoção concluída.',
      vaccines: [],
      history: [{ type: 'Adoção', date: '2025-12-20', description: 'Adoção concluída', vet: 'Equipe PAWSAFE', notes: 'Termo arquivado.' }],
      weights: [{ weight: 31.5, date: '2025-12-11', note: 'Chegada' }]
    },
    {
      id: 6, name: 'Pérola', species: 'Outros', breed: 'Coelho angorá', color: 'Branco', age: '8 meses',
      arrival: '2026-05-02', sex: 'Fêmea', size: 'Pequeno', status: 'Disponível',
      photo: photo('1591382386627-349b692688ff'), weight: 1.8,
      vaccinated: true, neutered: false, chip: false, notes: 'Coelha dócil.',
      vaccines: [], history: [],
      weights: [{ weight: 1.8, date: '2026-05-02', note: 'Chegada' }]
    },
    {
      id: 7, name: 'Mel', species: 'Cão', breed: 'Golden Retriever', color: 'Dourado', age: '2 anos',
      arrival: '2026-04-12', sex: 'Fêmea', size: 'Grande', status: 'Resgatado',
      photo: photo('1516734212186-a967f81ad0d7'), weight: 24.7,
      vaccinated: false, neutered: false, chip: false, notes: 'Resgate recente. Aguardando avaliação veterinária.',
      vaccines: [],
      history: [{ type: 'Resgate', date: '2026-04-12', description: 'Resgate em área urbana', vet: 'Equipe PAWSAFE', notes: 'Encaminhada para avaliação.' }],
      weights: [{ weight: 24.7, date: '2026-04-12', note: 'Chegada' }]
    },
    {
      id: 8, name: 'Simba', species: 'Gato', breed: 'Maine Coon', color: 'Laranja', age: '3 anos',
      arrival: '2026-02-18', sex: 'Macho', size: 'Grande', status: 'Disponível',
      photo: photo('1514888286974-6c03e2ca1dba'), weight: 6.2,
      vaccinated: true, neutered: true, chip: true, notes: 'Sociável com pessoas.',
      vaccines: [{ name: 'Tríplice Felina', date: '2026-02-18', next: '2027-02-18', lot: 'TF-2210', vet: 'Dr. Henrique Farias' }],
      history: [],
      weights: [{ weight: 6.2, date: '2026-02-18', note: 'Chegada' }]
    }
  ];

  function loadAnimals() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (error) {
      console.warn('Não foi possível recuperar os animais salvos.', error);
    }
    return structuredClone(SEED);
  }

  function saveAnimals(animals) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(animals));
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  // Útil na apresentação: no console do navegador, rode PawData.resetAnimals() e recarregue.
  function resetAnimals() {
    localStorage.removeItem(STORAGE_KEY);
  }

  return { STATUS, SPECIES, statusClass, loadAnimals, saveAnimals, resetAnimals };
})();
