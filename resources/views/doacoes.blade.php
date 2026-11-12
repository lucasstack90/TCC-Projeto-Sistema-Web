@extends('layouts.app')

@section('title', 'PAWSAFE | Doações / Financeiro')

@push('css')
  <link rel="stylesheet" href="{{ asset('css/sidebar.css') }}">
  <link rel="stylesheet" href="{{ asset('css/doacoes.css') }}">
  <link rel="stylesheet" href="{{ asset('css/cadastros.css') }}">
@endpush

@section('content')
@verbatim
<div id="sidebarMount"></div>

<main class="main-content">
  <header class="topbar">
    <button class="mobile-menu" id="menuToggle" type="button" aria-label="Abrir menu" aria-expanded="false"><i class="bi bi-list"></i></button>
    <div class="topbar-title">
      <div class="eyebrow">Gestão financeira</div>
      <h1>Doações / Financeiro</h1>
      <p class="page-subtitle"><span id="donationText"></span> <span class="subtitle-dot">•</span> <span id="expenseText"></span></p>
    </div>
    <div class="topbar-actions">
      <button class="btn btn-outline-green" id="addExpense" type="button"><i class="bi bi-dash-circle me-2"></i>Registrar despesa</button>
      <button class="btn btn-green" id="addDonation" type="button"><i class="bi bi-plus-lg me-2"></i>Registrar doação</button>
    </div>
  </header>

  <!-- Totais: o artigo pede o total doado e o registro dos recursos usados (despesas).
       O saldo é calculado (saldo inicial + doações − despesas) e muda sozinho a cada lançamento. -->
  <section class="finance-stats" id="financeStats" aria-label="Totais"></section>

  <nav class="tabs view-tabs" aria-label="Visualização">
    <button type="button" class="tab active" data-view="summary"><i class="bi bi-graph-up-arrow"></i>Resumo</button>
    <button type="button" class="tab" data-view="donations"><i class="bi bi-gift"></i>Doações</button>
    <button type="button" class="tab" data-view="expenses"><i class="bi bi-receipt"></i>Despesas</button>
    <button type="button" class="tab" data-view="contributors"><i class="bi bi-person-vcard"></i>Contribuintes</button>
  </nav>

  <!-- Resumo: indicadores para decidir, não só para registrar -->
  <section id="summaryView">
    <div class="summary-toolbar">
      <label class="month-picker" for="monthSelect"><i class="bi bi-calendar3"></i><span>Mês de referência</span>
        <select id="monthSelect" class="form-select"></select>
      </label>
      <div class="summary-actions">
        <button class="btn btn-outline-green" id="openSettings" type="button"><i class="bi bi-sliders me-2"></i>Orçamento e saldo inicial</button>
        <button class="btn btn-outline-green" id="exportCsv" type="button"><i class="bi bi-filetype-csv me-2"></i>Exportar prestação de contas</button>
      </div>
    </div>

    <div class="insight-grid" id="insights"></div>

    <div class="summary-grid">
      <article class="summary-panel">
        <header><h2>Fluxo de caixa</h2><p>Entradas e saídas dos últimos 6 meses e o saldo ao final de cada mês</p></header>
        <div class="flow-chart"><canvas id="flowChart" role="img" aria-label="Gráfico de entradas, saídas e saldo por mês. Os mesmos números estão na tabela abaixo."></canvas></div>
        <div class="table-responsive">
          <table class="table flow-table mb-0">
            <thead><tr><th>Mês</th><th class="text-end">Entradas</th><th class="text-end">Saídas</th><th class="text-end">Resultado</th><th class="text-end">Saldo</th></tr></thead>
            <tbody id="flowRows"></tbody>
          </table>
        </div>
      </article>
      <article class="summary-panel">
        <header><h2>Orçamento do mês</h2><p id="budgetSubtitle"></p></header>
        <div id="budgetList" class="budget-list"></div>
      </article>
    </div>

    <div class="summary-grid">
      <article class="summary-panel">
        <header><h2>Custo por animal</h2><p>Despesas vinculadas a cada animal no registro da despesa</p></header>
        <div id="animalCost"></div>
      </article>
      <article class="summary-panel">
        <header><h2>Maiores doadores</h2><p>Doações financeiras por doador identificado</p></header>
        <div id="donorList"></div>
      </article>
    </div>
  </section>

  <!-- Doações -->
  <section id="donationsView" class="d-none">
    <div class="filter-panel">
      <div class="search"><i class="bi bi-search"></i><input id="donationSearch" type="search" class="form-control" placeholder="Buscar por doador, item ou observação..." aria-label="Buscar doações"></div>
      <div class="filter-controls">
        <select id="typeFilter" class="form-select" aria-label="Filtrar por categoria"><option value="">Financeiras e materiais</option></select>
        <select id="originFilter" class="form-select" aria-label="Filtrar por origem"><option value="">Qualquer origem</option></select>
      </div>
    </div>
    <div class="table-card">
      <div class="table-responsive">
        <table class="table data-table align-middle mb-0">
          <thead><tr><th>Data</th><th>Doador</th><th>Categoria</th><th>Recurso</th><th class="text-end">Valor</th></tr></thead>
          <tbody id="donationRows"></tbody>
        </table>
      </div>
    </div>
  </section>

  <!-- Despesas -->
  <section id="expensesView" class="d-none">
    <div class="filter-panel">
      <div class="search"><i class="bi bi-search"></i><input id="expenseSearch" type="search" class="form-control" placeholder="Buscar por descrição ou fornecedor..." aria-label="Buscar despesas"></div>
      <div class="filter-controls">
        <select id="categoryFilter" class="form-select" aria-label="Filtrar por categoria"><option value="">Todas as categorias</option></select>
      </div>
    </div>
    <div class="table-card">
      <div class="table-responsive">
        <table class="table data-table align-middle mb-0">
          <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Pago a</th><th class="text-end">Valor</th></tr></thead>
          <tbody id="expenseRows"></tbody>
        </table>
      </div>
    </div>
  </section>

  <!-- Contribuintes: doadores frequentes e fornecedores (pessoa física ou jurídica) -->
  <section id="contributorsView" class="d-none">
    <div class="filter-panel">
      <div class="search"><i class="bi bi-search"></i><input id="contributorSearch" type="search" class="form-control" placeholder="Buscar por nome, CPF/CNPJ, cidade ou contato..." aria-label="Buscar contribuintes"></div>
      <div class="filter-controls">
        <select id="contributorTypeFilter" class="form-select" aria-label="Filtrar por tipo"><option value="">Pessoa física e jurídica</option></select>
        <select id="contributorRoleFilter" class="form-select" aria-label="Filtrar por papel">
          <option value="">Doadores e fornecedores</option><option value="donor">Só doadores</option><option value="supplier">Só fornecedores</option><option value="inactive">Inativos</option>
        </select>
        <button class="btn btn-green" id="addContributor" type="button"><i class="bi bi-person-plus me-2"></i>Novo contribuinte</button>
      </div>
    </div>
    <div id="contributorStatus" class="alert-soft d-none" role="status"></div>
    <div class="table-card">
      <div class="table-responsive">
        <table class="table data-table align-middle mb-0">
          <thead><tr><th>Nome / razão social</th><th>CPF / CNPJ</th><th>Contato</th><th>Papel</th><th class="text-end">Doado</th></tr></thead>
          <tbody id="contributorRows"></tbody>
        </table>
      </div>
    </div>
  </section>

  <div id="empty" class="empty d-none">
    <i class="bi bi-search"></i>
    <h2>Nenhum registro encontrado</h2>
    <p>Altere a busca ou os filtros.</p>
  </div>

  <footer class="page-footer"><span><i class="bi bi-shield-check me-1"></i> Clique em uma linha para editar ou excluir o registro.</span><span>Protótipo com dados demonstrativos</span></footer>
</main>

<!-- Doação -->
<div class="modal fade" id="donationModal" tabindex="-1" aria-labelledby="donationTitle" aria-hidden="true"><div class="modal-dialog modal-dialog-centered modal-dialog-scrollable"><div class="modal-content">
  <div class="modal-header"><div><h2 id="donationTitle">Registrar doação</h2><p>Origem, categoria e o que foi recebido.</p></div><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button></div>
  <form id="donationForm">
    <div class="modal-body">
      <input type="hidden" id="donationId">
      <div class="row g-3">
        <div class="col-12">
          <label class="form-label" for="dContributor">Doador</label>
          <div class="select-with-action">
            <select id="dContributor" class="form-select"></select>
            <button type="button" class="btn btn-outline-green" data-new-contributor="donation"><i class="bi bi-person-plus me-1"></i>Cadastrar</button>
          </div>
          <div class="field-hint" id="dContributorHint">Selecione um contribuinte cadastrado. Doações de quem doa uma única vez podem ser avulsas.</div>
        </div>
        <div class="col-12 d-none" id="dDonorWrap"><label class="form-label" for="dDonor">Nome do doador avulso *</label><input id="dDonor" class="form-control" maxlength="100" placeholder="Nome da pessoa ou empresa"></div>
        <div class="col-md-6"><label class="form-label" for="dDate">Data *</label><input id="dDate" type="date" class="form-control" required></div>
        <div class="col-md-6"><label class="form-label" for="dOrigin">Origem *</label><select id="dOrigin" class="form-select" required></select></div>
        <div class="col-12"><label class="form-label" for="dType">Categoria do recurso *</label><select id="dType" class="form-select" required></select></div>

        <!-- Financeira -->
        <div class="col-md-6 financial-field"><label class="form-label" for="dAmount">Valor (R$) *</label><input id="dAmount" type="number" min="0.01" step="0.01" class="form-control" placeholder="0,00"></div>
        <div class="col-md-6 financial-field"><label class="form-label" for="dMethod">Forma de pagamento *</label><select id="dMethod" class="form-select"></select></div>

        <!-- Material -->
        <div class="col-12 material-field"><label class="form-label" for="dItem">Item doado *</label><input id="dItem" class="form-control" maxlength="100" placeholder="Ex.: ração para filhotes, cobertores"></div>
        <div class="col-md-6 material-field"><label class="form-label" for="dQuantity">Quantidade *</label><input id="dQuantity" type="number" min="0.01" step="0.01" class="form-control"></div>
        <div class="col-md-6 material-field"><label class="form-label" for="dUnit">Unidade *</label><select id="dUnit" class="form-select"></select></div>

        <div class="col-12"><label class="form-label" for="dNotes">Observação</label><textarea id="dNotes" class="form-control" rows="2" maxlength="300"></textarea></div>
      </div>
    </div>
    <div class="modal-footer">
      <button type="button" id="deleteDonation" class="btn btn-outline-danger me-auto d-none"><i class="bi bi-trash me-1"></i>Excluir</button>
      <button type="button" class="btn btn-outline-green" data-bs-dismiss="modal">Cancelar</button>
      <button type="submit" id="saveDonationButton" class="btn btn-green"><i class="bi bi-check2 me-2"></i>Registrar doação</button>
    </div>
  </form>
</div></div></div>

<!-- Despesa -->
<div class="modal fade" id="expenseModal" tabindex="-1" aria-labelledby="expenseTitle" aria-hidden="true"><div class="modal-dialog modal-dialog-centered modal-dialog-scrollable"><div class="modal-content">
  <div class="modal-header"><div><h2 id="expenseTitle">Registrar despesa</h2><p>Recurso financeiro usado pela organização.</p></div><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button></div>
  <form id="expenseForm">
    <div class="modal-body">
      <input type="hidden" id="expenseId">
      <div class="row g-3">
        <div class="col-md-6"><label class="form-label" for="eDate">Data *</label><input id="eDate" type="date" class="form-control" required></div>
        <div class="col-md-6"><label class="form-label" for="eCategory">Categoria *</label><select id="eCategory" class="form-select" required></select></div>
        <div class="col-12"><label class="form-label" for="eDescription">Descrição *</label><input id="eDescription" class="form-control" required maxlength="120" placeholder="Ex.: castração — Simba"></div>
        <div class="col-md-6"><label class="form-label" for="eAmount">Valor (R$) *</label><input id="eAmount" type="number" min="0.01" step="0.01" class="form-control" required placeholder="0,00"></div>
        <div class="col-12">
          <label class="form-label" for="eContributor">Pago a</label>
          <div class="select-with-action">
            <select id="eContributor" class="form-select"></select>
            <button type="button" class="btn btn-outline-green" data-new-contributor="expense"><i class="bi bi-person-plus me-1"></i>Cadastrar</button>
          </div>
        </div>
        <div class="col-12 d-none" id="ePaidToWrap"><label class="form-label" for="ePaidTo">Fornecedor avulso *</label><input id="ePaidTo" class="form-control" maxlength="100" placeholder="Nome do fornecedor ou prestador"></div>
        <div class="col-12"><label class="form-label" for="eAnimal">Animal relacionado</label><select id="eAnimal" class="form-select"></select><div class="form-text">Opcional. Permite saber quanto custa cada animal atendido.</div></div>
        <div class="col-12"><div id="expensePreview" class="expense-preview" aria-live="polite"></div></div>
        <div class="col-12"><label class="form-label" for="eNotes">Observação</label><textarea id="eNotes" class="form-control" rows="2" maxlength="300"></textarea></div>
      </div>
    </div>
    <div class="modal-footer">
      <button type="button" id="deleteExpense" class="btn btn-outline-danger me-auto d-none"><i class="bi bi-trash me-1"></i>Excluir</button>
      <button type="button" class="btn btn-outline-green" data-bs-dismiss="modal">Cancelar</button>
      <button type="submit" id="saveExpenseButton" class="btn btn-green"><i class="bi bi-check2 me-2"></i>Registrar despesa</button>
    </div>
  </form>
</div></div></div>

<!-- Contribuinte (pessoa física ou jurídica) -->
<div class="modal fade" id="contributorModal" tabindex="-1" aria-labelledby="contributorTitle" aria-hidden="true"><div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable"><div class="modal-content">
  <div class="modal-header"><div><h2 id="contributorTitle">Novo contribuinte</h2><p>Cadastre uma vez e selecione ao registrar doações e despesas.</p></div><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button></div>
  <form id="contributorForm" novalidate>
    <div class="modal-body">
      <input type="hidden" id="contributorId">
      <div class="choice-options two-cols mb-3" role="radiogroup" aria-label="Tipo de contribuinte">
        <label><input type="radio" name="cType" value="Pessoa física" checked><span><i class="bi bi-person"></i>Pessoa física (CPF)</span></label>
        <label><input type="radio" name="cType" value="Pessoa jurídica"><span><i class="bi bi-building"></i>Pessoa jurídica (CNPJ)</span></label>
      </div>

      <div class="section-title">IDENTIFICAÇÃO</div>
      <div class="row g-3">
        <div class="col-md-8"><label class="form-label" for="cName" id="cNameLabel">Nome completo *</label><input id="cName" class="form-control" required minlength="3" maxlength="150"></div>
        <div class="col-md-4"><label class="form-label" for="cDocument" id="cDocumentLabel">CPF *</label><input id="cDocument" class="form-control" required inputmode="numeric" maxlength="18" placeholder="000.000.000-00"></div>
        <div class="col-md-6 pj-field d-none"><label class="form-label" for="cTradeName">Nome fantasia</label><input id="cTradeName" class="form-control" maxlength="150"></div>
        <div class="col-md-6 pj-field d-none"><label class="form-label" for="cContact">Pessoa de contato</label><input id="cContact" class="form-control" maxlength="120" placeholder="Quem fala pela empresa"></div>
      </div>

      <div class="section-title mt-4">CONTATO E ENDEREÇO</div>
      <div class="row g-3">
        <div class="col-md-6"><label class="form-label" for="cPhone">Telefone *</label><input id="cPhone" class="form-control" required inputmode="tel" maxlength="15" placeholder="(42) 99999-9999"></div>
        <div class="col-md-6"><label class="form-label" for="cEmail">E-mail</label><input id="cEmail" type="email" class="form-control" maxlength="150"></div>
        <div class="col-md-3"><label class="form-label" for="cCep">CEP</label><input id="cCep" class="form-control" inputmode="numeric" maxlength="9" placeholder="00000-000"></div>
        <div class="col-md-7"><label class="form-label" for="cStreet">Logradouro</label><input id="cStreet" class="form-control" maxlength="150" placeholder="Rua, avenida..."></div>
        <div class="col-md-2"><label class="form-label" for="cNumber">Número</label><input id="cNumber" class="form-control" maxlength="20"></div>
        <div class="col-md-3"><label class="form-label" for="cComplement">Complemento</label><input id="cComplement" class="form-control" maxlength="60"></div>
        <div class="col-md-3"><label class="form-label" for="cDistrict">Bairro</label><input id="cDistrict" class="form-control" maxlength="100"></div>
        <div class="col-8 col-md-4"><label class="form-label" for="cCity">Cidade</label><input id="cCity" class="form-control" maxlength="100"></div>
        <div class="col-4 col-md-2"><label class="form-label" for="cUf">UF</label><select id="cUf" class="form-select"></select></div>
      </div>

      <div class="section-title mt-4">PAPEL NO FINANCEIRO</div>
      <div class="choice-options two-cols">
        <label><input type="checkbox" id="cDonor" checked><span><i class="bi bi-gift"></i>Doador (aparece em Registrar doação)</span></label>
        <label><input type="checkbox" id="cSupplier"><span><i class="bi bi-receipt"></i>Fornecedor (aparece em Registrar despesa)</span></label>
      </div>
      <label class="form-label mt-3" for="cNotes">Observações</label>
      <textarea id="cNotes" class="form-control" rows="2" maxlength="1000" placeholder="Ex.: doa todo início de mês; emite nota fiscal; prefere contato por WhatsApp"></textarea>

      <label class="consent mt-3" id="cConsentRow">
        <input id="cConsent" type="checkbox">
        <span>A pessoa autorizou a organização a guardar estes dados para o registro das doações e a prestação de contas (LGPD). *</span>
      </label>
      <div class="form-check form-switch mt-3 d-none" id="cActiveWrap">
        <input class="form-check-input" type="checkbox" role="switch" id="cActive">
        <label class="form-check-label" for="cActive">Cadastro ativo (aparece para seleção nas doações e despesas)</label>
      </div>
      <div id="cError" class="alert-soft warning d-none mt-3 mb-0" role="alert"></div>
    </div>
    <div class="modal-footer">
      <button type="button" id="deleteContributor" class="btn btn-outline-danger me-auto d-none"><i class="bi bi-trash me-1"></i>Excluir</button>
      <button type="button" class="btn btn-outline-green" data-bs-dismiss="modal">Cancelar</button>
      <button type="submit" id="saveContributorButton" class="btn btn-green"><i class="bi bi-check2 me-2"></i>Cadastrar contribuinte</button>
    </div>
  </form>
</div></div></div>

<!-- Orçamento mensal e saldo inicial -->
<div class="modal fade" id="settingsModal" tabindex="-1" aria-labelledby="settingsTitle" aria-hidden="true"><div class="modal-dialog modal-dialog-centered modal-dialog-scrollable"><div class="modal-content">
  <div class="modal-header"><div><h2 id="settingsTitle">Orçamento e saldo inicial</h2><p>Limites de gasto por mês e o dinheiro que já havia em caixa.</p></div><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button></div>
  <form id="settingsForm">
    <div class="modal-body">
      <h3 class="form-section-title">Saldo inicial</h3>
      <p class="form-hint">Valor em caixa quando a organização começou a usar o PAWSAFE. Sem ele, o saldo do sistema não bate com o extrato do banco.</p>
      <div class="row g-3 mb-4">
        <div class="col-md-6"><label class="form-label" for="openingAmount">Valor (R$) *</label><input id="openingAmount" type="number" min="0" step="0.01" class="form-control" required></div>
        <div class="col-md-6"><label class="form-label" for="openingDate">Data *</label><input id="openingDate" type="date" class="form-control" required></div>
      </div>
      <h3 class="form-section-title">Orçamento mensal por categoria</h3>
      <p class="form-hint">Use 0 para categorias sem limite definido. O sistema avisa ao chegar a 80% e ao passar de 100%.</p>
      <div class="row g-3" id="budgetFields"></div>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-outline-green" data-bs-dismiss="modal">Cancelar</button>
      <button type="submit" class="btn btn-green"><i class="bi bi-check2 me-2"></i>Salvar</button>
    </div>
  </form>
</div></div></div>

<div class="toast-container position-fixed bottom-0 end-0 p-3"><div id="toast" class="toast" role="status" aria-live="polite"><div class="toast-body"><i class="bi bi-check-circle-fill me-2"></i><span id="toastText"></span><small id="toastDetail" class="toast-detail"></small></div></div></div>
@endverbatim
@endsection

@push('scripts')
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
<script src="{{ asset('js/tema.js') }}"></script>
<script src="{{ asset('js/dados.js') }}"></script>
<script src="{{ asset('js/utils.js') }}"></script>
<script src="{{ asset('js/api.js') }}"></script>
<script src="{{ asset('js/financeiro.js') }}"></script>
<script src="{{ asset('js/contribuintes.js') }}"></script>
<script src="{{ asset('js/sidebar.js') }}"></script>
<script src="{{ asset('js/doacoes.js') }}"></script>
@endpush
