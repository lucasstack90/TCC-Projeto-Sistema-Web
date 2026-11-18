# PAWSAFE

Sistema web para gestão de ONGs e grupos de proteção animal — TCC do Técnico em Desenvolvimento de Sistemas (C. E. Ana Vanda Bassara).
Front-end em HTML, CSS, JavaScript, Bootstrap 5 e Chart.js. Back-end em **PHP puro com arquitetura MVC própria** (sem Laravel e sem Composer) e banco **MySQL** (XAMPP).

> **Roda sem `composer install`.** O carregamento das classes é feito por um autoloader próprio (`app/Core/Autoloader.php`), então basta copiar a pasta para o `htdocs` do XAMPP. O padrão de organização do back-end está em [`docs/padrao-do-projeto.md`](docs/padrao-do-projeto.md).

## Estrutura

```text
PAWSAFE/
├── public/                 # ÚNICA pasta exposta no servidor
│   ├── index.php           # front controller (porta de entrada; trata /api/*)
│   ├── .htaccess           # manda os pedidos /api/* para o index.php
│   ├── index.html          # dashboard
│   ├── Pages/              # demais telas (Pg_Login, animais, ..., cadastros)
│   ├── CSS/                # base, sidebar, dashboard, ..., cadastros, login, tema
│   ├── js/                 # dados.js, utils.js, api.js, sidebar.js, animais.js,
│   │                       #   veterinarios.js, contribuintes.js, ...
│   └── Img/
│
├── app/                    # back-end (fora do alcance do navegador)
│   ├── Core/               # mini-framework: Autoloader, App, Router, Request,
│   │                       #   Response, Controller, Model, Database, Config,
│   │                       #   Session, Csrf, Validator, Documento, Middleware/
│   ├── Controllers/        # Auth, Animal, Veterinario, Contribuinte, Meta
│   ├── Models/             # Usuario, Animal, Veterinario, Contribuinte
│   └── Views/              # telas renderizadas pelo servidor (reservado)
│
├── config/config.php       # credenciais do banco e ajustes do ambiente
├── routes/web.php          # todas as rotas da API
├── database/schema.sql     # cria o banco, as tabelas e o usuário admin
├── storage/                # uploads (fotos) e logs
├── docs/                   # padrão do projeto e pendências do back-end
└── .htaccess               # redireciona a raiz para public/ (XAMPP sem vhost)
```

No front-end, cada CSS/JS continua com a mesma função de antes; a novidade é o
`js/api.js`, o ajudante que conversa com o back-end (ver padrão do projeto).

## Executar

### Protótipo só do front-end (sem banco)
As telas ainda guardam os dados no `localStorage`, mas agora **todas exigem login**, e o login depende do back-end. Por isso, para usar o sistema, rode-o no XAMPP (abaixo); o Live Server sozinho só mostra a tela de login.

### Sistema completo (com back-end, no XAMPP)
1. Instale o **XAMPP** e ligue **Apache** e **MySQL** no painel.
2. Copie a pasta do projeto para `xampp/htdocs/` (ex.: `htdocs/pawsafe`).
3. Crie o banco: abra `http://localhost/phpmyadmin`, importe `database/schema.sql` (cria o banco `pawsafe`, as tabelas e um usuário de cada perfil). Se você já tinha importado uma versão anterior, importe de novo: o arquivo atualiza o banco sem duplicar dados.
4. Confira as credenciais em `config/config.php` (no XAMPP padrão: usuário `root`, sem senha).
5. Abra `http://localhost/pawsafe/public/Pages/Pg_Login.html`.
   - Se o projeto estiver numa subpasta (como acima), defina `base_url` em `config/config.php` como `/pawsafe/public` (ou configure um VirtualHost com `DocumentRoot` em `public/` e deixe `base_url` vazio).
6. Entre com um dos usuários iniciais (senha de todos: `pawsafe123` — **troque depois**, em Cadastros → Usuários, entrando como administrador):

   | Perfil | E-mail | O que faz |
   |---|---|---|
   | Administrador(a) | `admin@pawsafe.local` | tudo: usuários, caixa, configuração do relatório |
   | Administrador(a) | `tesouraria@pawsafe.local` | segundo administrador (ex.: tesoureiro) |
   | Equipe | `equipe@pawsafe.local` | operação: animais, adoções, resgates, estoque, registra doações, aprova voluntários |
   | Veterinário(a) | `veterinario@pawsafe.local` | fichas clínicas, resgates, estoque, consulta o relatório |
   | Voluntário(a) | `voluntario@pawsafe.local` | consulta animais, registra resgates e consumo no estoque |

   A regra completa de cada perfil está em [`docs/padrao-do-projeto.md`](docs/padrao-do-projeto.md#perfis-de-usuário-e-permissões).

Teste rápido do back-end: abra `.../public/api/ping` — deve responder `{"ok":true,...}`.
É preciso internet para Bootstrap, Chart.js, fontes e fotos de exemplo.

## Como os dados funcionam no protótipo

- Animais, adotantes, processos de adoção, resgates, voluntários, doações e despesas ficam no `localStorage` do navegador (`js/dados.js`). Todas as páginas leem a mesma fonte.
- Para voltar aos dados de exemplo: no console do navegador, rode `PawData.resetAll()` e recarregue a página.

## Nova página do sistema

Para manter o padrão nas páginas de `Pages/`:

1. No `<head>`, nesta ordem: Bootstrap, Bootstrap Icons, fontes, `../CSS/base.css`, `../CSS/sidebar.css` e o CSS da página.
2. No `<body>`: `<div id="sidebarMount"></div>` e `<main class="main-content">` com o cabeçalho `<header class="topbar">` (botão `class="mobile-menu" id="menuToggle"` + `<div class="topbar-title">`).
3. Antes do JS da página: `../js/dados.js`, `../js/utils.js` e `../js/sidebar.js`, nesta ordem.


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

## Módulo de Voluntários e Equipe

- **Formulário de inscrição** (`voluntario-cadastro.html`, aberto pelo “Link de voluntariado” do menu): nome completo, e-mail, telefone, habilidades, experiências e disponibilidade (dias e turnos), com consentimento LGPD. Quem se inscreve entra como **Interessado**.
- **Equipe** (`voluntarios.html`): abas Equipe e Interessados, busca, filtro por habilidade e por dia disponível. Interessado → **Aprovar** (Ativo) ou **Arquivar**; Ativo ↔ Inativo.
- Resgates escolhem o responsável entre os voluntários ativos. Quem é responsável por algum resgate não pode ser excluído, só inativado.
- No protótipo o formulário grava no mesmo `localStorage`, então só funciona no mesmo navegador. No back-end ele vira uma rota pública que grava no banco; ali o resgate deve guardar o **id** do voluntário, e não o nome.

## Módulo de Doações / Financeiro

- **Doação:** data, origem (pessoa física ou jurídica), doador (opcional, para doações anônimas) e categoria. **Financeira:** valor e forma de pagamento. **Material:** item, quantidade e unidade (kg, un, L, mL — as mesmas do Estoque).
- **Despesa:** data, categoria, descrição, valor, a quem foi pago e, opcionalmente, o animal relacionado.
- **Totais:** total doado (doações financeiras), despesas, saldo e quantidade de doações materiais. O dashboard mostra as doações financeiras do mês atual.
- **Saldo automático:** o saldo nunca é digitado nem guardado; é sempre calculado em `js/financeiro.js` como *saldo inicial + doações financeiras − despesas*. Ao registrar, editar ou excluir uma despesa, o card de Saldo é destacado com "antes → depois" e o aviso mostra o novo valor. Enquanto a despesa é digitada, o formulário já mostra como ficam o saldo e o orçamento da categoria. Outras abas abertas do sistema também se atualizam.
- **Aba Resumo** (indicadores para a coordenação decidir):
  - **Fôlego de caixa:** quantos meses o saldo paga as despesas, pela média dos últimos 3 meses completos. Meta: reserva de 3 meses.
  - **Resultado do mês:** superávit ou déficit do mês escolhido.
  - **Dependência de doadores:** quanto do arrecadado vem do maior doador (alerta acima de 40%), divisão pessoa física/jurídica e doadores recorrentes.
  - **Fluxo de caixa:** gráfico e tabela dos últimos 6 meses (entradas, saídas, resultado e saldo ao fim do mês).
  - **Orçamento mensal por categoria:** alerta ao chegar a 80% e ao passar de 100%, também no momento de registrar a despesa.
  - **Custo por animal:** total gasto com cada animal e custo médio por animal atendido.
  - **Maiores doadores** e **exportação da prestação de contas** do mês em CSV (abre no Excel e no Google Planilhas).
- **Orçamento e saldo inicial:** editáveis na aba Resumo. Sem o saldo inicial, o saldo do sistema não bate com o extrato do banco.
- Clique em uma linha para editar ou excluir.

## Antes de começar o back-end

Leia [`docs/pendencias-backend.md`](docs/pendencias-backend.md): proteção do formulário público contra envios em massa, regras que hoje só existem no JavaScript, ajustes no modelo de dados e LGPD.
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
