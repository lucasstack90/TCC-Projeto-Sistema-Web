/* PAWSAFE — fonte única de dados do protótipo.
   Enquanto o back-end (Laravel + MySQL) não existe, animais, adotantes e processos de
   adoção ficam no localStorage. Todas as páginas leem daqui, então os números sempre batem.
   Na integração com o back-end, troque as funções load/save por chamadas à API. */

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

  // ================= Adoções =================
  // Etapas do processo, na ordem. As três primeiras são "em andamento".
  const ADOPTION_STAGES = ['Novo', 'Em análise', 'Aprovada', 'Concluída', 'Recusada', 'Cancelada'];
  const ACTIVE_STAGES = ['Novo', 'Em análise', 'Aprovada'];

  const STAGE_CLASS = {
    'Novo': 'stage-novo',
    'Em análise': 'stage-analise',
    'Aprovada': 'stage-aprovada',
    'Concluída': 'stage-concluida',
    'Recusada': 'stage-recusada',
    'Cancelada': 'stage-cancelada'
  };
  const stageClass = (stage) => STAGE_CLASS[stage] || 'stage-novo';

  // Etapas de verificação feitas pela equipe antes de entregar o animal.
  const CHECKLIST = [
    { key: 'interview', label: 'Entrevista com o adotante' },
    { key: 'visit', label: 'Visita à residência' },
    { key: 'documents', label: 'Documentos conferidos' },
    { key: 'term', label: 'Termo de adoção assinado' }
  ];

  const SEED_ADOPTERS = [
    {
      id: 1, name: 'Carlos Mendes', cpf: '529.982.247-25', birth: '1988-05-14',
      phone: '(42) 99912-3456', email: 'carlos.mendes@email.com',
      street: 'Rua XV de Novembro', number: '1240', district: 'Centro', city: 'Guarapuava - PR',
      housingType: 'Casa', ownership: 'Própria', hasYard: true, hasScreens: false,
      residents: 3, hasChildren: true, otherPets: 'Uma gata castrada',
      hoursAlone: 4, experience: 'Já teve cães de grande porte.',
      motivation: 'Família procura um cão companheiro para as crianças.',
      documents: [], consent: true, createdAt: '2025-12-10'
    },
    {
      id: 2, name: 'Fernanda Lima', cpf: '312.987.654-55', birth: '1995-09-02',
      phone: '(42) 99845-1122', email: 'fernanda.lima@email.com',
      street: 'Rua Saldanha Marinho', number: '310', district: 'Trianon', city: 'Guarapuava - PR',
      housingType: 'Casa', ownership: 'Alugada', hasYard: true, hasScreens: false,
      residents: 2, hasChildren: false, otherPets: '',
      hoursAlone: 6, experience: 'Primeiro animal.',
      motivation: 'Quer um cão ativo para acompanhar nas caminhadas.',
      documents: [], consent: true, createdAt: '2026-10-01'
    },
    {
      id: 3, name: 'Juliana Alves', cpf: '471.236.598-64', birth: '1990-01-23',
      phone: '(42) 99734-8890', email: 'juliana.alves@email.com',
      street: 'Rua Pedro Alves', number: '85', district: 'Bairro Santa Cruz', city: 'Guarapuava - PR',
      housingType: 'Apartamento', ownership: 'Própria', hasYard: false, hasScreens: true,
      residents: 1, hasChildren: false, otherPets: '',
      hoursAlone: 8, experience: 'Já teve gatos.',
      motivation: 'Mora sozinha e quer um gato tranquilo.',
      documents: [], consent: true, createdAt: '2026-10-14'
    }
  ];

  const SEED_ADOPTIONS = [
    {
      id: 1, animalId: 5, adopterId: 1, stage: 'Concluída',
      openedAt: '2025-12-12', closedAt: '2025-12-20',
      checklist: { interview: true, visit: true, documents: true, term: true },
      log: [
        { date: '2025-12-20', stage: 'Concluída', text: 'Animal entregue. Termo arquivado.' },
        { date: '2025-12-17', stage: 'Aprovada', text: 'Residência adequada, família preparada.' },
        { date: '2025-12-13', stage: 'Em análise', text: 'Entrevista agendada.' },
        { date: '2025-12-12', stage: 'Novo', text: 'Processo aberto.' }
      ]
    },
    {
      id: 2, animalId: 1, adopterId: 2, stage: 'Em análise',
      openedAt: '2026-10-02', closedAt: '',
      checklist: { interview: true, visit: false, documents: false, term: false },
      log: [
        { date: '2026-10-05', stage: 'Em análise', text: 'Entrevista feita. Falta agendar a visita.' },
        { date: '2026-10-02', stage: 'Novo', text: 'Processo aberto.' }
      ]
    },
    {
      id: 3, animalId: 8, adopterId: 3, stage: 'Novo',
      openedAt: '2026-10-15', closedAt: '',
      checklist: { interview: false, visit: false, documents: false, term: false },
      log: [{ date: '2026-10-15', stage: 'Novo', text: 'Processo aberto.' }]
    }
  ];

  // ================= Armazenamento (localStorage) =================
  const KEYS = {
    animals: STORAGE_KEY,
    adopters: 'pawsafe_adotantes_v1',
    adoptions: 'pawsafe_adocoes_v1'
  };

  function load(key, seed) {
    try {
      const saved = localStorage.getItem(key);
      if (saved) return JSON.parse(saved);
    } catch (error) {
      console.warn(`Não foi possível recuperar "${key}".`, error);
    }
    return structuredClone(seed);
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  // Útil na apresentação: no console do navegador, rode PawData.resetAll() e recarregue.
  function resetAll() {
    Object.values(KEYS).forEach(key => localStorage.removeItem(key));
  }

  return {
    STATUS, SPECIES, statusClass,
    ADOPTION_STAGES, ACTIVE_STAGES, CHECKLIST, stageClass,
    loadAnimals: () => load(KEYS.animals, SEED),
    saveAnimals: (list) => save(KEYS.animals, list),
    loadAdopters: () => load(KEYS.adopters, SEED_ADOPTERS),
    saveAdopters: (list) => save(KEYS.adopters, list),
    loadAdoptions: () => load(KEYS.adoptions, SEED_ADOPTIONS),
    saveAdoptions: (list) => save(KEYS.adoptions, list),
    resetAll,
    resetAnimals: resetAll // nome antigo, mantido por compatibilidade
  };
})();
