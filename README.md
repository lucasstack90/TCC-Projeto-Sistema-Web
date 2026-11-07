# PAWSAFE — Front-end (protótipo)

Sistema web para gestão de ONGs e grupos de proteção animal — TCC do Técnico em Desenvolvimento de Sistemas (C. E. Ana Vanda Bassara).
Front-end em HTML, CSS, JavaScript, Bootstrap 5 e Chart.js. O back-end previsto é PHP/Laravel com MySQL.

## Estrutura

```text
PAWSAFE/
├── CSS/
│   ├── base.css        # cores, fontes, botões, formulários, status, componentes comuns e ícone de pata
│   ├── sidebar.css     # menu lateral (único lugar com estilos do menu)
│   ├── dashboard.css   # index.html
│   ├── animais.css     # Pages/animais.html
│   ├── adocoes.css     # Pages/adocoes.html
│   ├── resgates.css    # Pages/resgates.html
│   ├── estoque.css     # Pages/estoque.html
│   ├── relatorios.css  # Pages/relatorios.html (inclui layout de impressão)
│   └── login.css       # Pages/Pg_Login.html
├── Img/
├── js/
│   ├── dados.js        # fonte única de dados (localStorage) — carregar antes dos outros
│   ├── utils.js        # datas, escape de HTML, códigos, compressão de imagem
│   ├── sidebar.js      # menu lateral, contador de animais e botão Sair
│   ├── dashboard.js
│   ├── animais.js
│   ├── adocoes.js
│   ├── resgates.js
│   ├── estoque.js
│   ├── relatorios.js
│   └── login.js
├── Pages/
│   ├── Pg_Login.html
│   ├── animais.html
│   ├── adocoes.html
│   ├── resgates.html
│   ├── estoque.html
│   └── relatorios.html
└── index.html          # dashboard
```

## Executar

Abra a pasta no VS Code e rode `Pages/Pg_Login.html` (ou `index.html`) com o Live Server. É preciso internet para Bootstrap, Chart.js, fontes e fotos de exemplo.

## Como os dados funcionam no protótipo

- Animais, adotantes, processos de adoção e resgates ficam no `localStorage` do navegador (`js/dados.js`). Todas as páginas leem a mesma fonte.
- Para voltar aos dados de exemplo: no console do navegador, rode `PawData.resetAll()` e recarregue a página.
- Os indicadores de voluntários e doações são ilustrativos até esses módulos existirem.

## Nova página do sistema

Para manter o padrão nas páginas de `Pages/`:

1. No `<head>`, nesta ordem: Bootstrap, Bootstrap Icons, fontes, `../CSS/base.css`, `../CSS/sidebar.css` e o CSS da página.
2. No `<body>`: `<div id="sidebarMount"></div>` e `<main class="main-content">` com o cabeçalho `<header class="topbar">` (botão `class="mobile-menu" id="menuToggle"` + `<div class="topbar-title">`).
3. Antes do JS da página: `../js/dados.js`, `../js/utils.js` e `../js/sidebar.js`, nesta ordem.

Páginas do menu ainda não criadas: `voluntarios.html` e `doacoes.html`.

## Padrão do CSS

- Cores, fontes e espaçamentos são variáveis no topo do `base.css` (`--green-700`, `--border`, `--font-title`...). Mude ali para alterar o sistema inteiro.
- As cores de status (`status-disponivel`, `status-adotado`...) são as mesmas no dashboard e em Animais. O nome da classe vem de `PawData.statusClass()` em `js/dados.js`.
- Cada página tem um CSS só com o que é dela; nada de repetir menu, botões ou formulários.

## Módulo de Adoções

- **Adotantes:** nome, data de nascimento (18+), CPF (validado e único), telefone, e-mail, endereço, moradia, família, outros animais, motivação, até 3 fotos de documentos e consentimento LGPD. Nas listas o CPF aparece parcialmente oculto.
- **Processo:** `Novo → Em análise → Aprovada → Concluída` (ou `Recusada` / `Cancelada`, com motivo obrigatório).
- **Verificação da equipe:** entrevista, visita, documentos e termo. Aprovar exige os três primeiros; concluir exige o termo.
- **Ao concluir:** o animal passa para "Adotado", ganha o registro no histórico e os outros processos do mesmo animal são cancelados.
- Todo passo fica no histórico do processo. O dashboard abre um processo direto por `adocoes.html?processo=ID`.

## Módulo de Resgates

- **Ocorrência:** data do ocorrido, endereço (rua, número, bairro, cidade e referência), descrição da situação, responsável pelo resgate, prioridade, espécie, quantidade e quem informou.
- **Situação:** `Pendente → Em atendimento → Concluído` ou `Sem sucesso` (com motivo). Dá para reabrir e adicionar observações; tudo fica no acompanhamento.
- **Resumo:** total de ocorrências, concluídos, em aberto, animais acolhidos e quantos resgates cada responsável atendeu.
- **Animal resgatado:** “Cadastrar animal resgatado” abre o formulário de Animais já preenchido (status Resgatado, data de chegada, espécie). O animal fica ligado ao resgate e a ficha dele mostra a origem.
- Menu lateral e dashboard mostram as ocorrências em aberto. Links diretos: `resgates.html?resgate=ID`, `animais.html?animal=ID`.

## Módulo de Relatório técnico

Gera o relatório a partir dos dados dos outros módulos — nenhum número é digitado à mão.

- **Período:** mês atual, mês anterior, trimestre, semestre, ano, vigência da parceria ou datas personalizadas. Se o período termina no futuro, os dados vão até hoje.
- **Modelos:** *Prestação de contas* (para a prefeitura ou outro financiador, com declaração e assinatura), *Gestão interna* (com pendências e equipe) e *Completo*. Cada seção pode ser ligada ou desligada.
- **Seções:** identificação da ONG e da parceria; resumo; metas pactuadas × realizadas; resgates (taxa de sucesso, tempo de atendimento, bairros, prioridade); balanço de animais (início + entradas − saídas = fim) e permanência; saúde (vacinas, atendimentos e cobertura de vacinação, castração e microchip); adoções (conversão e duração); insumos (doado, comprado, consumido, perdas, doadores); execução financeira; equipe; pendências; análise escrita da equipe; declaração.
- **Estrutura de prestação de contas:** segue a lógica da Lei 13.019/2014 (MROSC) — relatório de execução do objeto (metas e resultados) e de execução financeira.
- **Metas:** cadastradas por mês em “Configurar relatório”; o relatório calcula a meta proporcional ao período.
- **Pendências:** resgates urgentes em aberto, vacinas vencidas, animais sem vacina, estoque em falta, lotes vencidos ou vencendo, adoções paradas há mais de 15 dias e animais disponíveis há mais de 6 meses — cada uma com link para o módulo.
- **LGPD:** o relatório não mostra CPF, telefone, endereço completo do resgate nem quem denunciou; o adotante aparece abreviado (ex.: “Carlos M.”).
- **Saídas:** Imprimir / PDF (layout A4) e CSV com os indicadores (abre no Excel).
- **Pendente:** a seção financeira e os números de voluntários serão preenchidos quando os módulos Doações/Financeiro e Voluntários existirem.
