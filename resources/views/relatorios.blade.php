@extends('layouts.app')

@section('title', 'PAWSAFE | Relatório técnico')

@push('css')
  <link rel="stylesheet" href="{{ asset('css/sidebar.css') }}">
  <link rel="stylesheet" href="{{ asset('css/relatorios.css') }}">
  <link rel="stylesheet" href="{{ asset('css/cadastros.css') }}">
@endpush

@section('content')
@verbatim
<div id="sidebarMount"></div>

<main class="main-content">
  <header class="topbar no-print">
    <button class="mobile-menu" id="menuToggle" type="button" aria-label="Abrir menu" aria-expanded="false"><i class="bi bi-list"></i></button>
    <div class="topbar-title">
      <div class="eyebrow">Prestação de contas e gestão</div>
      <h1>Relatório técnico</h1>
      <p class="page-subtitle">Gerado automaticamente com os dados de Animais, Resgates, Adoções e Estoque</p>
    </div>
    <div class="topbar-actions">
      <button class="btn btn-outline-green" id="openConfig" type="button"><i class="bi bi-gear me-2"></i>Configurar relatório</button>
      <button class="btn btn-outline-green" id="exportCsv" type="button"><i class="bi bi-filetype-csv me-2"></i>Exportar CSV</button>
      <button class="btn btn-green" id="printReport" type="button"><i class="bi bi-printer me-2"></i>Imprimir / PDF</button>
    </div>
  </header>

  <!-- Período, modelo e seções -->
  <section class="report-controls no-print" aria-label="Opções do relatório">
    <div class="row g-3 align-items-end">
      <div class="col-6 col-md-3"><label class="form-label" for="periodStart">De</label><input id="periodStart" type="date" class="form-control"></div>
      <div class="col-6 col-md-3"><label class="form-label" for="periodEnd">Até</label><input id="periodEnd" type="date" class="form-control"></div>
      <div class="col-md-6">
        <label class="form-label" for="reportModel">Modelo</label>
        <select id="reportModel" class="form-select">
          <option value="prefeitura">Prestação de contas (prefeitura / órgão financiador)</option>
          <option value="gestao">Gestão interna (equipe e diretoria)</option>
          <option value="completo">Completo</option>
        </select>
      </div>
    </div>
    <div class="section-toggles" id="sectionToggles" aria-label="Seções incluídas"></div>
    <div id="periodWarning" class="alert-soft warning d-none mt-3 mb-0"></div>
  </section>

  <!-- O relatório em si (é o que vai para a impressão) -->
  <article class="report-paper" id="report" aria-live="polite"></article>

  <footer class="page-footer no-print"><span><i class="bi bi-shield-check me-1"></i> PAWSAFE · Transparência que gera confiança.</span><span>Protótipo com dados demonstrativos</span></footer>
</main>

<!-- Configuração: organização, parceria e metas -->
<div class="modal fade" id="configModal" tabindex="-1" aria-labelledby="configTitle" aria-hidden="true"><div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable"><div class="modal-content">
  <div class="modal-header"><div><h2 id="configTitle">Configurar relatório</h2><p>Dados fixos que aparecem no cabeçalho e nas metas. Ficam salvos para os próximos relatórios.</p></div><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button></div>
  <form id="configForm">
    <div class="modal-body">
      <div class="section-title">ORGANIZAÇÃO</div>
      <div class="row g-3">
        <div class="col-md-8"><label class="form-label" for="cfName">Nome da organização *</label><input id="cfName" class="form-control" required maxlength="120"></div>
        <div class="col-md-4"><label class="form-label" for="cfCnpj">CNPJ</label><input id="cfCnpj" class="form-control" maxlength="18" placeholder="00.000.000/0000-00"></div>
        <div class="col-md-8"><label class="form-label" for="cfAddress">Endereço</label><input id="cfAddress" class="form-control" maxlength="120"></div>
        <div class="col-md-4"><label class="form-label" for="cfCity">Cidade</label><input id="cfCity" class="form-control" maxlength="60"></div>
        <div class="col-md-6"><label class="form-label" for="cfPhone">Telefone</label><input id="cfPhone" class="form-control" maxlength="20"></div>
        <div class="col-md-6"><label class="form-label" for="cfEmail">E-mail</label><input id="cfEmail" type="email" class="form-control" maxlength="80"></div>
        <div class="col-md-6"><label class="form-label" for="cfRep">Responsável legal *</label><input id="cfRep" class="form-control" required maxlength="80"></div>
        <div class="col-md-6"><label class="form-label" for="cfRole">Cargo</label><input id="cfRole" class="form-control" maxlength="60"></div>
      </div>

      <div class="section-title mt-4">ASSINATURAS</div>
      <p class="form-hint mt-0">O relatório é assinado pelo responsável legal (acima) e, em conjunto, pelo(a) médico(a)-veterinário(a) responsável técnico(a), que confirma as informações de saúde e bem-estar dos animais.</p>
      <div class="row g-3">
        <div class="col-md-8">
          <label class="form-label" for="cfVet">Veterinário(a) que assina em conjunto</label>
          <select id="cfVet" class="form-select"></select>
          <div class="field-hint"><i class="bi bi-person-badge me-1"></i>A lista vem do cadastro de veterinários. <a href="animais?veterinarios=1">Cadastrar ou editar veterinários</a></div>
        </div>
      </div>

      <div class="section-title mt-4">PARCERIA COM O PODER PÚBLICO</div>
      <div class="choice-options mb-3" style="grid-template-columns:1fr">
        <label><input type="checkbox" id="cfFunding"><span><i class="bi bi-bank"></i>A organização recebe recurso público municipal</span></label>
      </div>
      <div class="row g-3" id="partnershipFields">
        <div class="col-md-6"><label class="form-label" for="cfInstrument">Instrumento (termo / convênio)</label><input id="cfInstrument" class="form-control" maxlength="120" placeholder="Ex.: Termo de Colaboração nº 012/2026"></div>
        <div class="col-md-6"><label class="form-label" for="cfGrantor">Órgão concedente</label><input id="cfGrantor" class="form-control" maxlength="140"></div>
        <div class="col-12"><label class="form-label" for="cfObject">Objeto da parceria</label><textarea id="cfObject" class="form-control" rows="2" maxlength="400"></textarea></div>
        <div class="col-md-6"><label class="form-label" for="cfStart">Início da vigência</label><input id="cfStart" type="date" class="form-control"></div>
        <div class="col-md-6"><label class="form-label" for="cfEnd">Fim da vigência</label><input id="cfEnd" type="date" class="form-control"></div>
      </div>

      <div class="section-title mt-4">METAS MENSAIS</div>
      <p class="form-hint">O relatório calcula a meta do período de forma proporcional (ex.: 2 por mês em um trimestre = 6). Use as metas pactuadas no plano de trabalho.</p>
      <div class="row g-3">
        <div class="col-6 col-md-3"><label class="form-label" for="gRescues">Resgates concluídos</label><input id="gRescues" type="number" min="0" max="999" class="form-control"></div>
        <div class="col-6 col-md-3"><label class="form-label" for="gAdoptions">Adoções concluídas</label><input id="gAdoptions" type="number" min="0" max="999" class="form-control"></div>
        <div class="col-6 col-md-3"><label class="form-label" for="gVaccines">Vacinas aplicadas</label><input id="gVaccines" type="number" min="0" max="999" class="form-control"></div>
        <div class="col-6 col-md-3"><label class="form-label" for="gHealth">Atendimentos veterinários</label><input id="gHealth" type="number" min="0" max="999" class="form-control"></div>
      </div>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-outline-green" data-bs-dismiss="modal">Cancelar</button>
      <button type="submit" class="btn btn-green"><i class="bi bi-check2 me-2"></i>Salvar</button>
    </div>
  </form>
</div></div></div>

<div class="toast-container position-fixed bottom-0 end-0 p-3 no-print"><div id="toast" class="toast" role="status" aria-live="polite"><div class="toast-body"><i class="bi bi-check-circle-fill me-2"></i><span id="toastText"></span></div></div></div>
@endverbatim
@endsection

@push('scripts')
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
<script src="{{ asset('js/tema.js') }}"></script>
<script src="{{ asset('js/dados.js') }}"></script>
<script src="{{ asset('js/utils.js') }}"></script>
<script src="{{ asset('js/api.js') }}"></script>
<script src="{{ asset('js/sidebar.js') }}"></script>
<script src="{{ asset('js/relatorios.js') }}"></script>
@endpush
