# Pendências para o back-end (Laravel + MySQL)

Decisões e cuidados levantados durante o desenvolvimento do front-end que **precisam** ser
resolvidos quando o back-end for implementado. Marque cada item ao concluir.

## 1. Formulário público de voluntários (`voluntario-cadastro.html`)

É a única página do sistema aberta sem login, por isso é o ponto mais exposto a abuso
(alguém enviando inscrições falsas em massa).

- [ ] **Limite de envios por IP** com o middleware `throttle` do Laravel na rota pública
      (ex.: 5 envios por minuto; ajustar conforme o uso real).
- [ ] **CAPTCHA** no formulário (ex.: Cloudflare Turnstile, gratuito), validado no servidor.
- [ ] **Campo-armadilha (honeypot)**: campo invisível para pessoas; se vier preenchido,
      descartar a inscrição em silêncio.
- [ ] **Validação no servidor** (Form Request): e-mail válido e `unique` na tabela de
      voluntários, telefone com DDD, tamanho máximo de todos os campos, habilidades/dias/turnos
      só da lista permitida, consentimento LGPD obrigatório.
- [ ] **Confirmação por e-mail** (opcional, desejável): a inscrição só aparece em
      "Interessados" depois que a pessoa clicar no link recebido.
- [ ] **Proteção contra queda do servidor (DoS/DDoS)**: tratada na hospedagem
      (ex.: proxy como o Cloudflare na frente do site), não no formulário.

> Hoje (protótipo) nada disso existe: as validações estão só no JavaScript, que pode ser
> contornado pelo console do navegador, e a inscrição grava no `localStorage` de quem preenche.

## 2. Regras que hoje estão só no JavaScript

Precisam ser repetidas no servidor, senão qualquer pessoa contorna pelo console:

- [ ] Adotantes: CPF válido e único, maior de 18 anos, consentimento LGPD.
- [ ] Adoções: só abre processo para animal Disponível ou Em Lar Temporário; aprovar exige
      entrevista, visita e documentos; concluir exige o termo; concluir muda o animal para
      "Adotado" e cancela os outros processos do mesmo animal (fazer numa transação).
- [ ] Resgates: "Sem sucesso" e "Reabrir" exigem observação.
- [ ] Voluntários: quem é responsável por resgate não pode ser excluído, só inativado.

## 3. Modelo de dados

- [ ] Resgate guarda o **id** do voluntário responsável (chave estrangeira), não o nome.
      Remove o remendo atual que renomeia os resgates quando o voluntário muda de nome.
- [ ] Animal ↔ resgate de origem também por chave estrangeira.
- [ ] Fotos de animais e documentos de adotantes em armazenamento de arquivos
      (`storage`), não em base64 dentro do banco.
- [ ] Valores em dinheiro em colunas `DECIMAL(10,2)`, nunca `FLOAT` (o JavaScript do protótipo
      usa números decimais comuns, que podem gerar erros de centavos em somas grandes).
- [ ] **Saldo calculado, não guardado:** o saldo vem de `SUM` das doações financeiras menos `SUM`
      das despesas (mais o saldo inicial), numa consulta ou *view* do MySQL. Não criar uma coluna
      `saldo` atualizada pelo PHP: se uma gravação falhar no meio, o saldo fica errado para sempre.
      Se um dia for preciso guardar (por desempenho), atualizar na **mesma transação** da despesa.
- [ ] Tabelas novas: `orcamentos` (categoria, valor mensal) e `configuracoes_financeiras`
      (saldo inicial e data). Despesa ganha `animal_id` (chave estrangeira opcional para `animais`).
- [ ] Regras do protótipo a repetir no servidor: valor maior que zero, data não futura, categoria da
      lista; aviso de saldo negativo e de orçamento estourado devolvidos pela API.
- [ ] Exportação da prestação de contas gerada no servidor (CSV/PDF), base do módulo de Relatório técnico.
- [ ] Doação **material** deve gerar uma entrada no Estoque (mesmo item, quantidade e unidade),
      para não ser registrada duas vezes à mão.
- [ ] Doações e despesas não devem ser apagadas de verdade: guardar quem alterou e quando
      (prestação de contas), em vez do "Excluir" do protótipo.

## 4. Acesso e LGPD (Lei 13.709/2018)

A LGPD é critério de projeto do banco desde a primeira tabela, não um ajuste no final.
Prazos e bases legais abaixo devem ser conferidos com o professor orientador.

### 4.1 Minimização (art. 6º, III)

- [ ] Revisar campo por campo antes de criar as tabelas: todo dado pessoal precisa de um motivo.
      Ex.: data de nascimento do adotante existe só para confirmar 18+; quem informou o resgate é opcional.
- [ ] Animais, estoque e resgates não são dados pessoais; não misturar dados de pessoas nessas tabelas
      além da chave estrangeira (ex.: `volunteer_id`).

### 4.2 Proteção dos dados (art. 46)

- [ ] **CPF criptografado** com o cast `encrypted` do Laravel + coluna `cpf_hash` (hash do CPF)
      com índice `UNIQUE`, usada só para impedir cadastro duplicado e para buscar por CPF.
- [ ] **Documentos dos adotantes** no disco privado (`storage/app/private`), nunca em `public`
      nem em base64 no banco. Download só por rota autenticada que confere a permissão.
- [ ] Senhas com hash (bcrypt, padrão do Laravel).
- [ ] HTTPS obrigatório na hospedagem.
- [ ] Usuário do MySQL da aplicação sem permissão de `DROP`/`GRANT` (privilégio mínimo).
- [ ] Backups criptografados; nada de cópias do banco em pendrive ou e-mail.
- [ ] Logs do Laravel não podem conter CPF, telefone ou documentos.

### 4.3 Base legal e consentimento (arts. 7º e 8º)

- [ ] Tabela `consents`: titular (tipo + id), finalidade, versão do termo, data/hora e IP.
      Hoje o protótipo guarda só "sim/não", o que não serve como prova.
- [ ] Texto do termo versionado; se o termo mudar, novos cadastros registram a nova versão.
- [ ] Registrar a base legal de cada tipo de dado: consentimento (voluntários, adotantes),
      cumprimento de obrigação legal (prestação de contas de doações e despesas com recurso público).

### 4.4 Controle de acesso e rastreabilidade

- [ ] Login real com senha criptografada (hash) e sessão; todas as páginas internas
      exigem usuário autenticado.
- [ ] Permissões com *Policies* do Laravel: **voluntário não vê** CPF, documentos nem contatos
      completos; **funcionário vê**. Esconder botão na tela não protege nada.
- [ ] Tabela `audit_logs`: quem consultou ou alterou dados pessoais, quando e o quê
      (sem gravar o dado em si no log).

### 4.5 Direitos do titular e prazo de guarda (art. 15, 16 e 18)

- [ ] Funções para o titular **ver, corrigir e pedir exclusão** dos próprios dados
      (pode ser pela equipe, mediante pedido registrado).
- [ ] **Anonimizar em vez de apagar** quando o registro precisa continuar existindo
      (adoção concluída, doação de recurso público): nome vira "Adotante #12", CPF/contatos/documentos
      são removidos, os números do relatório continuam corretos.
- [ ] Prazos de guarda (sugestão, a confirmar): adotante recusado/cancelado → anonimizar após 1 ano;
      voluntário inativo → anonimizar após 2 anos; documentos do adotante → apagar após a conclusão
      do processo + prazo de guarda do termo.
- [ ] Rotina agendada (`schedule` do Laravel) que aplica os prazos automaticamente.
- [ ] Campo do **encarregado de dados (DPO)** na configuração da ONG, com contato público.

### 4.6 Relatórios e exportações

- [ ] Manter o que o front-end já faz: relatório técnico sem CPF, telefone, endereço do resgate
      e denunciante; adotante abreviado ("Carlos M.").
- [ ] CSVs exportados seguem a mesma regra.
