# Padrão de organização do projeto (back-end)

Este documento descreve a arquitetura do back-end do PAWSAFE e como seguir o
padrão ao criar módulos novos. O objetivo é que todo o sistema tenha a mesma
cara, seja fácil de explicar para a banca e **rode sem `composer install`**.

## Por que PHP puro (sem Laravel / sem Composer)

O sistema usa um mini-framework MVC escrito dentro do próprio projeto. Isso
substitui o Laravel e elimina a pasta `vendor/` (que o `composer install`
baixaria). Na prática: **copiar a pasta para o `htdocs` do XAMPP já faz o
sistema rodar** — não é preciso instalar dependências.

O papel que o Composer teria (carregar as classes automaticamente) é feito por
`app/Core/Autoloader.php`, um autoloader no padrão PSR-4.

## Estrutura de pastas

```text
PAWSAFE/
├── public/                 ← ÚNICA pasta exposta no servidor
│   ├── index.php           ← front controller (porta de entrada)
│   ├── .htaccess           ← manda os pedidos /api/* para o index.php
│   ├── index.html          ← dashboard (front-end)
│   ├── Pages/ CSS/ js/ Img/ ← front-end (continua igual ao protótipo)
│
├── app/
│   ├── Core/               ← o mini-framework (não mexer no dia a dia)
│   │   ├── Autoloader.php   App.php  Config.php  Database.php
│   │   ├── Router.php  Request.php  Response.php
│   │   ├── Controller.php  Model.php  Validator.php
│   │   ├── Session.php  Csrf.php
│   │   └── Middleware/      ← Autenticar, VerificarCsrf
│   ├── Controllers/        ← um por módulo (AnimalController, ...)
│   ├── Models/             ← um por tabela (Animal, Usuario, ...)
│   └── Views/              ← telas renderizadas pelo servidor (reservado)
│
├── config/config.php       ← credenciais do banco e ajustes do ambiente
├── routes/web.php          ← todas as rotas da API
├── database/schema.sql     ← cria o banco e as tabelas
├── storage/                ← uploads (fotos) e logs — fora do alcance do navegador
└── .htaccess               ← redireciona a raiz para public/ (XAMPP sem vhost)
```

Regra de ouro: **só `public/` fica acessível pelo navegador.** `app/`, `config/`,
`database/` e `storage/` ficam de fora, o que protege o código e as credenciais.

## Como um pedido é atendido (ciclo de vida)

1. O navegador chama, por exemplo, `GET /api/animais`.
2. O `.htaccess` vê que não é um arquivo real e manda para `public/index.php`.
3. O `index.php` liga o autoloader e chama `Core\App::iniciar()`.
4. A `App` carrega a configuração, abre a sessão, monta a `Request` e lê as
   rotas de `routes/web.php`.
5. O `Router` acha a rota, roda os **middlewares** (ex.: exigir login) e chama
   o método do **Controller**.
6. O Controller usa o **Model** para falar com o banco (PDO) e responde em JSON
   com `Response::ok(...)` ou `Response::erro(...)`.

## O formato das respostas da API

Sempre JSON, sempre no mesmo formato:

```jsonc
// sucesso
{ "ok": true, "dados": { ... } }
// erro
{ "ok": false, "erro": "mensagem", "campos": { "name": "Nome é obrigatório." } }
```

`campos` só aparece nos erros de validação (status 422), para a interface
destacar cada campo.

## Segurança embutida

- **Login real** com senha em hash bcrypt (`password_hash`), sessão em cookie
  `HttpOnly`. Perfis: `admin` e `equipe`.
- **CSRF**: gravações (POST/PUT/DELETE) exigem o token `X-CSRF-Token`. O
  ajudante `js/api.js` cuida disso sozinho.
- **Validação no servidor** (`Core\Validator`): repete as regras que o protótipo
  só tinha no JavaScript (ver `pendencias-backend.md`, seção 2).
- **Consultas preparadas** (PDO) em tudo, contra SQL injection.

## Como criar um módulo novo (passo a passo)

Use o módulo de **Animais** como molde. Para criar, por exemplo, o módulo de
Resgates:

1. **Tabela** — adicione a tabela em `database/schema.sql`.
2. **Model** — crie `app/Models/Resgate.php` estendendo `Core\Model`:

   ```php
   final class Resgate extends Core\Model {
       protected string $tabela = 'resgates';
       protected array $preenchivel = ['data', 'endereco', 'prioridade', ...];
   }
   ```
   `$preenchivel` lista as colunas que a API pode gravar (protege contra
   *mass assignment*). Herdando de `Core\Model`, você já ganha
   `todos()`, `encontrar()`, `criar()`, `atualizar()` e `remover()`.

3. **Controller** — crie `app/Controllers/ResgateController.php` com as cinco
   ações (copie de `AnimalController`): `index`, `show`, `store`, `update`,
   `destroy`. Valide a entrada com `Core\Validator` no `store` e no `update`.

4. **Rotas** — em `routes/web.php`, dentro do grupo que exige login, copie o
   bloco de animais:

   ```php
   $r->get('/api/resgates', [ResgateController::class, 'index']);
   $r->get('/api/resgates/{id}', [ResgateController::class, 'show']);
   $r->post('/api/resgates', [ResgateController::class, 'store'], [VerificarCsrf::class]);
   $r->put('/api/resgates/{id}', [ResgateController::class, 'update'], [VerificarCsrf::class]);
   $r->delete('/api/resgates/{id}', [ResgateController::class, 'destroy'], [VerificarCsrf::class]);
   ```

5. **Interface** — na página do módulo, troque as chamadas ao `localStorage`
   (`PawData`) por chamadas ao `Api` (ver abaixo).

## Como migrar uma página do `localStorage` para a API

As páginas ainda não migradas leem e gravam no `localStorage` via `PawData`
(protótipo). Ao integrar um módulo, troque essas chamadas por `Api` (`js/api.js`).
O módulo de **Animais já foi migrado** (`public/js/animais.js`) e serve de exemplo.

Antes (protótipo, síncrono):

```js
let animals = PawData.loadAnimals();
// ...altera a lista...
PawData.saveAnimals(animals);
```

Depois (API, assíncrono):

```js
let animals = await Api.get('/animais');          // lista do banco
const novo  = await Api.post('/animais', dados);  // cria
await Api.put('/animais/' + id, dados);           // edita
await Api.del('/animais/' + id);                  // remove
```

Pontos de atenção na migração:

- As funções que usam `Api` viram `async`; quem as chama precisa usar `await`.
- Trate o erro de validação: `catch (e) { if (e.campos) { /* destaca campos */ } }`.
- Se a sessão expirar, `Api` marca `e.sessaoExpirada`; mande o usuário ao login.
- As **chaves dos dados não mudam** (`name`, `species`, `status`...). O back-end
  fala a mesma língua da interface de propósito, para a migração ser quase um
  encontrar-e-substituir.

## Perfis de usuário e permissões

O sistema tem cinco perfis. O que cada um pode fazer está em **um único arquivo**,
`app/Core/Permissoes.php`. Para mudar uma regra, altere só ele: o servidor passa
a recusar a ação e a interface se ajusta sozinha no próximo carregamento.

Os perfis descrevem a **função** da pessoa na ONG, não o vínculo de trabalho:
um voluntário de confiança que conduz adoções pode receber o perfil **Equipe**.

| O que | Administrador | Financeiro | Equipe | Veterinário | Voluntário |
|---|:---:|:---:|:---:|:---:|:---:|
| Dashboard (indicadores gerais) | ✓ | ✓ | ✓ | ✓ sem o nome dos adotantes | ✓ sem o nome dos adotantes |
| Dashboard — doações arrecadadas no mês (R$) | ✓ | ✓ | — | — | — |
| Animais — consultar fichas | ✓ | — | ✓ | ✓ | ✓ |
| Animais — cadastrar, editar, excluir | ✓ | — | ✓ | — | — |
| Animais — vacinas, histórico, pesagens | ✓ | — | ✓ | ✓ | — |
| Adoções | ✓ | — | ✓ | — | — |
| Resgates | ✓ | — | ✓ | ✓ | ✓ |
| Voluntários — aprovar ou arquivar inscrições | ✓ | — | ✓ | — | — |
| Voluntários — cadastrar, editar, inativar, excluir | ✓ | — | consulta | — | — |
| Doações materiais (ração, remédios, utensílios) | ✓ | consulta | ✓ | — | — |
| Caixa — doações em dinheiro, despesas, saldo, orçamento | ✓ | ✓ | — | — | — |
| Estoque — entradas, itens, inventário, estornos | ✓ | — | ✓ | ✓ | — |
| Estoque — saída por consumo / uso em animal | ✓ | — | ✓ | ✓ | ✓ |
| Relatório — gerar, imprimir | ✓ | ✓ | ✓ | ✓ | — |
| Relatório — preencher a análise da equipe | ✓ | ✓ | ✓ | — | — |
| Relatório — execução financeira | ✓ | ✓ | — | — | — |
| Relatório — configurar (dados da ONG, metas, responsáveis) | ✓ | — | — | — | — |
| Cadastros — usuários, veterinários e contribuintes | ✓ | — | — | — | — |

Critérios usados:

- **O dia a dia não depende do administrador**, que muitas vezes é da diretoria
  e não está no abrigo todo dia: a equipe registra doações materiais, aprova
  voluntários e preenche o relatório.
- **Segregação de funções no caixa:** doações em dinheiro, despesas, saldo e
  orçamento ficam com o perfil **Financeiro** (o responsável pela prestação de
  contas). Ver e registrar são uma permissão só (`financeiro.gerenciar`), porque
  quem cuida do caixa faz as duas coisas. Doações materiais continuam com a
  equipe, que as recebe no abrigo e dá entrada no estoque.
- **Cadastros ficam com a coordenação** (administrador): contas de acesso,
  veterinários e contribuintes. Equipe e financeiro só consultam as listas de
  veterinários e contribuintes onde precisam delas (vacinas, doações, despesas).
- **Mínimo necessário (LGPD):** o voluntário não vê dados pessoais de terceiros
  (CPF de adotantes e contribuintes) nem finanças; o valor arrecadado no mês só
  aparece no dashboard para quem cuida do caixa, e nem é colocado na página dos
  outros perfis.
- **Recomendação:** ter pelo menos dois administradores (ex.: presidente e
  vice), para ninguém ficar sem acesso se um faltar.

**Como funciona por dentro**

1. No login, o servidor devolve o perfil e a lista de permissões do usuário.
2. `js/auth.js` guarda essa lista na aba (sessionStorage), bloqueia páginas que o
   perfil não pode abrir, e o `sidebar.js` só mostra os itens permitidos.
3. Botões de escrita somem pelo CSS (`html.sem-animais-cadastrar #addAnimal ...`)
   e blocos com `data-requer="permissao"` somem quando ela falta.
4. A proteção de verdade é no servidor: cada rota da API usa
   `[ExigirPermissao::class, 'permissao']` e responde **403** fora do perfil.
   Esconder na tela é só conforto.
5. A cada página aberta a interface consulta `/api/auth/eu`: se um administrador
   trocar o perfil de alguém ou desativar a conta, vale na hora.

Travas da gestão de usuários: ninguém muda o próprio perfil, desativa ou exclui a
própria conta, e o sistema nunca fica sem um administrador ativo. Cada
movimentação de estoque registra o nome do usuário logado que a fez.

> Enquanto Adoções, Resgates, Estoque etc. ainda gravam no `localStorage`, o
> bloqueio desses módulos é feito na interface. Quando cada um migrar para a API,
> basta proteger as rotas dele com a permissão correspondente.

## Módulo de Animais e ficha clínica (já no servidor)

A tela de Animais usa só a API. Rotas (em `routes/web.php`):

| Rota | Permissão | O que faz |
|---|---|---|
| `GET /api/animais` | `pagina.animais` | Lista, já com vacinas, histórico e pesagens |
| `GET /api/animais/{id}` · `/{id}/foto` | `pagina.animais` | Um animal · a foto enviada |
| `POST`, `PUT`, `DELETE /api/animais[/{id}]` | `animais.cadastrar` | Cadastra, edita, exclui |
| `PATCH /api/animais/{id}/status` | `animais.cadastrar` | Muda o status (usado ao concluir uma adoção) |
| `POST /api/animais/{id}/{tipo}` | `animais.registros` | Registra vacina, evento ou pesagem |
| `PUT`, `DELETE /api/animais/{id}/{tipo}/{registro}` | `animais.registros` | Corrige ou remove um registro |

`{tipo}` = `vacinas`, `historico` ou `pesagens` (model `RegistroClinico`).

Regras que valem no servidor:

- **Auditoria:** cada registro clínico guarda quem registrou, quem corrigiu por
  último e quem removeu (`registrado_por`, `atualizado_por`, `removido_por`, com
  as datas). A ficha mostra "Registrado por… · corrigido por…".
- **Nada é apagado de verdade:** remover um registro ou excluir um animal só
  marca a data (`removido_em`, `excluido_em`). As chaves estrangeiras não usam
  mais `ON DELETE CASCADE`, então o histórico clínico nunca some junto.
- **Peso atual** = pesagem mais recente; corrigir ou remover uma pesagem
  recalcula. Mudar o peso em "Editar ficha" vira uma pesagem nova.
- **Vacinado** passa a "sim" quando há vacina registrada. Um evento do tipo
  **Castração** marca o animal como castrado.
- **Veterinário** escolhido da lista é guardado por id (`veterinario_id`, com
  chave estrangeira); o nome digitado fica como alternativa (administrador e
  equipe registram pelo profissional que atendeu).
- **Perfil veterinário não escolhe o responsável:** o registro sai em nome da
  própria conta, e o servidor ignora o que vier no formulário. O cadastro de
  Veterinários com o mesmo nome do login é ligado automaticamente. Numa
  correção, o responsável original é mantido e fica registrado quem corrigiu.
- **Foto** enviada fica em `storage/uploads/animais/` (fora da pasta pública),
  com o tipo conferido pelo conteúdo do arquivo, e é entregue pela rota
  `/foto`, que exige login.

As outras páginas (Dashboard, Adoções, Resgates, Estoque, Relatório) ainda leem
os animais do `localStorage`. Para os números baterem, a tela de Animais e o
`js/auth.js` (a cada página aberta) copiam a lista do servidor para lá
(`PawData.syncAnimalsFromServer`). Concluir uma adoção também avisa o servidor
(status "Adotado" e evento no histórico).

## Cadastros de apoio (veterinários e contribuintes)

Dois cadastros já seguem este padrão no back-end e servem de exemplo prático,
além do módulo de Animais:

- **Veterinários** (`/api/veterinarios`): usados nas fichas de vacina e histórico
  do módulo de Animais e na assinatura do Relatório técnico. Model `Veterinario`,
  controller `VeterinarioController`.
- **Contribuintes** (`/api/contribuintes`): doadores frequentes e fornecedores
  (pessoa física com CPF ou jurídica com CNPJ), selecionáveis ao registrar
  doações e despesas. Model `Contribuinte`, controller `ContribuinteController`.
  O CPF/CNPJ é validado no servidor por `Core\Documento` (dígitos verificadores),
  além da validação no navegador.

Os dois têm tela de gestão na página **Cadastros** (`public/Pages/cadastros.html`,
no menu lateral). Os registros clínicos dos animais já guardam o `id` do
veterinário no banco; as doações continuam no `localStorage` por enquanto, mas
guardam o `id` do contribuinte (`contributorId`), prontas para a migração.

As três melhorias pedidas foram feitas aqui: cadastro de veterinários, cadastro
de contribuintes e a assinatura dupla (responsável legal + veterinário) no
relatório técnico.

## Rodando e testando

Veja o `README.md` (seção "Executar"). Para um teste rápido de que o back-end
está no ar, abra `/api/ping` no navegador — deve responder
`{"ok":true,"dados":{"pong":true,...}}`.
