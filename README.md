# PAWSAFE

Sistema web para gestão de ONGs e grupos de proteção animal — TCC do Técnico em Desenvolvimento de Sistemas (C. E. Ana Vanda Bassara, Guarapuava - PR).

**Tecnologias (artigo, seção 2.2):** PHP 8.2+ com Laravel 12 no back-end; HTML, CSS, JavaScript, Bootstrap 5 e Chart.js no front-end; banco de dados MySQL (do XAMPP); VS Code, GitHub e Figma.

## Situação da integração com o back-end

| Módulo | Onde ficam os dados |
|---|---|
| Login e perfis (funcionário / voluntário) | **MySQL** — senha com hash bcrypt, sessão do Laravel |
| Animais (ficha, vacinas, histórico, pesagens, foto) | **MySQL** — API em `/api/animais` |
| Adoções, Resgates, Estoque, Voluntários, Doações/Financeiro, Relatório | localStorage do navegador (tabelas já criadas no MySQL; integração nos próximos passos) |

Todas as tabelas de todos os módulos já existem nas migrations (`database/migrations`).

## Como rodar no computador (XAMPP)

Precisa de: **XAMPP** (com PHP 8.2 ou mais novo) e **Composer** (https://getcomposer.org).

1. Abra o painel do XAMPP e clique em **Start** no **MySQL** (e no Apache, se for usar o phpMyAdmin).
2. Entre em http://localhost/phpmyadmin, clique em **Novo** e crie o banco **`pawsafe`** com o agrupamento **`utf8mb4_unicode_ci`**.
3. No terminal do VS Code, dentro da pasta do projeto:

   ```bash
   composer install
   copy .env.example .env        # no Linux/macOS: cp .env.example .env
   php artisan key:generate
   php artisan migrate --seed    # cria as tabelas e os dados de exemplo
   php artisan storage:link      # libera as fotos dos animais em /storage
   php artisan serve
   ```

4. Acesse **http://127.0.0.1:8000** e entre com um dos logins de demonstração:

   | Perfil | E-mail | Senha |
   |---|---|---|
   | Funcionária (acesso completo) | renata.oliveira@email.com | pawsafe123 |
   | Voluntário (acesso limitado) | marcos.ribeiro@email.com | pawsafe123 |

   Troque essas senhas antes de usar com dados reais.

> O `.env` já vem configurado para o MySQL do XAMPP (usuário `root`, sem senha). Se o seu MySQL tiver senha, preencha `DB_PASSWORD`.
>
> **Sem `php artisan serve`:** copie a pasta para `C:\xampp\htdocs\pawsafe`, ajuste `APP_URL=http://localhost/pawsafe/public` no `.env` e acesse esse endereço com o Apache ligado.
>
> **Recomeçar do zero:** `php artisan migrate:fresh --seed` apaga e recria todas as tabelas. Os módulos que ainda usam o localStorage voltam ao exemplo com `PawData.resetAll()` no console do navegador.

## Estrutura

```text
PAWSAFE/
├── app/
│   ├── Http/Controllers/AuthController.php        # login e logout
│   ├── Http/Controllers/Api/AnimalController.php  # API JSON do módulo de Animais
│   ├── Http/Middleware/VerificaPerfil.php         # perfil:funcionario (acesso limitado do voluntário)
│   ├── Http/Requests/AnimalRequest.php            # validação do cadastro de animal no servidor
│   ├── Models/                                    # Animal, AnimalVacina, AnimalHistorico, AnimalPesagem,
│   │                                              # User, Voluntario, Adotante (CPF criptografado), LogAuditoria...
│   └── Providers/AppServiceProvider.php           # entrega usuário e animais ao JavaScript (window.PAWSAFE)
├── database/
│   ├── migrations/   # tabelas de TODOS os módulos (MySQL, pensadas para a LGPD)
│   └── seeders/      # dados de exemplo (os mesmos do protótipo, com os mesmos ids)
├── lang/pt_BR/       # mensagens de validação em português
├── public/           # pasta aberta ao navegador
│   ├── css/          # estilos (antes em CSS/)
│   └── js/           # scripts das telas (antes em js/) + api.js (fetch com CSRF)
├── resources/views/  # páginas Blade (antes em Pages/*.html)
│   ├── layouts/app.blade.php   # <head> comum, token CSRF e window.PAWSAFE
│   ├── auth/login.blade.php
│   └── dashboard, animais, adocoes, resgates, voluntarios, doacoes, estoque, relatorios, voluntario-cadastro
├── routes/web.php    # páginas e rotas /api
└── docs/             # decisões e pendências do back-end
```

## Como o front-end conversa com o Laravel

- As páginas continuam sendo o HTML do protótipo, agora como views Blade. O Laravel exige login antes de abri-las.
- Ao abrir uma página, o Laravel coloca em `window.PAWSAFE` o usuário logado e a lista de animais vinda do MySQL. `PawData.loadAnimals()` passa a ler dali, então o dashboard, adoções, estoque e relatório já mostram os animais do banco.
- O módulo de Animais grava pela API (`public/js/api.js` envia o token CSRF e a sessão). A validação final é feita no servidor (`AnimalRequest`), porque a do JavaScript pode ser contornada.
- Os nomes dos campos no JavaScript continuam os do protótipo (`name`, `species`...). As colunas do banco estão em português (`nome`, `especie`...). A conversão fica em `Animal::paraTela()` e `AnimalRequest::dadosDoBanco()`.
- Ponte temporária: quando o módulo de Adoções conclui uma adoção, `PawData.saveAnimals()` envia a mudança de status para `PATCH /api/animais/{id}/status`.

## LGPD no banco de dados

- Senhas só como hash (bcrypt); sessão criptografada; troca do ID da sessão no login; limite de 5 tentativas de login por minuto.
- CPF do adotante **criptografado** (`encrypted`), com um hash HMAC (`cpf_hash`) para impedir CPF repetido sem descriptografar.
- Documentos dos adotantes em `storage/app/private` (fora da pasta pública).
- Data do consentimento registrada (adotantes e voluntários) e anonimização em vez de exclusão quando o registro precisa ficar para a prestação de contas.
- Tabela `log_auditoria`: quem fez o quê e quando (login, cadastro, alteração, exclusão), sem copiar os dados pessoais.
- Exclusão lógica (`deleted_at`) em animais, doações e despesas.

## Nova página do sistema

1. Crie `resources/views/<pagina>.blade.php` com `@extends('layouts.app')`, o título em `@section('title')`, o CSS da página em `@push('css')`, o conteúdo em `@section('content')` (com `<div id="sidebarMount"></div>` e o `<header class="topbar">`) e os scripts em `@push('scripts')`.
2. Scripts, nesta ordem: `tema.js`, `dados.js`, `utils.js`, `api.js`, `sidebar.js` e o JS da página — sempre com `{{ asset('js/...') }}`.
3. Registre a rota em `routes/web.php` dentro do grupo `auth` (e em `perfil:funcionario` se o voluntário não puder acessar).

## Padrão do CSS

- Cores, fontes e espaçamentos são variáveis no topo do `public/css/base.css` (`--green-700`, `--border`, `--font-title`...). Mude ali para alterar o sistema inteiro.
- As cores de status (`status-disponivel`, `status-adotado`...) são as mesmas no dashboard e em Animais. O nome da classe vem de `PawData.statusClass()` em `public/js/dados.js`.
- Cada página tem um CSS só com o que é dela; nada de repetir menu, botões ou formulários.

## Módulo de Adoções

- **Adotantes:** nome, data de nascimento (18+), CPF (validado e único), telefone, e-mail, endereço, moradia, família, outros animais, motivação, até 3 fotos de documentos e consentimento LGPD. Nas listas o CPF aparece parcialmente oculto.
- **Processo:** `Novo → Em análise → Aprovada → Concluída` (ou `Recusada` / `Cancelada`, com motivo obrigatório).
- **Verificação da equipe:** entrevista, visita, documentos e termo. Aprovar exige os três primeiros; concluir exige o termo.
- **Ao concluir:** o animal passa para "Adotado", ganha o registro no histórico e os outros processos do mesmo animal são cancelados.
- Todo passo fica no histórico do processo. O dashboard abre um processo direto por `adocoes?processo=ID`.

## Módulo de Resgates

- **Ocorrência:** data do ocorrido, endereço (rua, número, bairro, cidade e referência), descrição da situação, responsável pelo resgate, prioridade, espécie, quantidade e quem informou.
- **Situação:** `Pendente → Em atendimento → Concluído` ou `Sem sucesso` (com motivo). Dá para reabrir e adicionar observações; tudo fica no acompanhamento.
- **Resumo:** total de ocorrências, concluídos, em aberto, animais acolhidos e quantos resgates cada responsável atendeu.
- **Animal resgatado:** “Cadastrar animal resgatado” abre o formulário de Animais já preenchido (status Resgatado, data de chegada, espécie). O animal fica ligado ao resgate e a ficha dele mostra a origem.
- Menu lateral e dashboard mostram as ocorrências em aberto. Links diretos: `resgates?resgate=ID`, `animais?animal=ID`.

## Módulo de Voluntários e Equipe

- **Formulário de inscrição** (`voluntario-cadastro`, aberto pelo “Link de voluntariado” do menu): nome completo, e-mail, telefone, habilidades, experiências e disponibilidade (dias e turnos), com consentimento LGPD. Quem se inscreve entra como **Interessado**.
- **Equipe** (`voluntarios`): abas Equipe e Interessados, busca, filtro por habilidade e por dia disponível. Interessado → **Aprovar** (Ativo) ou **Arquivar**; Ativo ↔ Inativo.
- Resgates escolhem o responsável entre os voluntários ativos. Quem é responsável por algum resgate não pode ser excluído, só inativado.
- No protótipo o formulário grava no mesmo `localStorage`, então só funciona no mesmo navegador. No back-end ele vira uma rota pública que grava no banco; ali o resgate deve guardar o **id** do voluntário, e não o nome.

## Módulo de Doações / Financeiro

- **Doação:** data, origem (pessoa física ou jurídica), doador (opcional, para doações anônimas) e categoria. **Financeira:** valor e forma de pagamento. **Material:** item, quantidade e unidade (kg, un, L, mL — as mesmas do Estoque).
- **Despesa:** data, categoria, descrição, valor, a quem foi pago e, opcionalmente, o animal relacionado.
- **Totais:** total doado (doações financeiras), despesas, saldo e quantidade de doações materiais. O dashboard mostra as doações financeiras do mês atual.
- **Saldo automático:** o saldo nunca é digitado nem guardado; é sempre calculado em `public/js/financeiro.js` como *saldo inicial + doações financeiras − despesas*. Ao registrar, editar ou excluir uma despesa, o card de Saldo é destacado com "antes → depois" e o aviso mostra o novo valor. Enquanto a despesa é digitada, o formulário já mostra como ficam o saldo e o orçamento da categoria. Outras abas abertas do sistema também se atualizam.
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

## Pendências do back-end

Veja [`docs/pendencias-backend.md`](docs/pendencias-backend.md): proteção do formulário público contra envios em massa, regras que hoje só existem no JavaScript, ajustes no modelo de dados e LGPD.

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
