# Pendências para o back-end (Laravel + MySQL)

> Situação em nov/2026: projeto Laravel criado, migrations de todos os módulos, login com perfis
> e módulo de Animais integrado. Itens marcados com [x] já estão no código (ao menos na estrutura do banco).

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

- [x] Resgate guarda o **id** do voluntário responsável (chave estrangeira), não o nome.
      Remove o remendo atual que renomeia os resgates quando o voluntário muda de nome.
- [x] Animal ↔ resgate de origem também por chave estrangeira.
- [x] Fotos de animais e documentos de adotantes em armazenamento de arquivos
      (`storage`), não em base64 dentro do banco. *(fotos de animais prontas; documentos: tabela
      `adotante_documentos` criada, upload entra com o módulo de Adoções)*
- [x] Valores em dinheiro em colunas `DECIMAL(10,2)`, nunca `FLOAT` (o JavaScript do protótipo
      usa números decimais comuns, que podem gerar erros de centavos em somas grandes).
- [x] **Saldo calculado, não guardado:** o saldo vem de `SUM` das doações financeiras menos `SUM`
      das despesas (mais o saldo inicial), numa consulta ou *view* do MySQL. Não criar uma coluna
      `saldo` atualizada pelo PHP: se uma gravação falhar no meio, o saldo fica errado para sempre.
      Se um dia for preciso guardar (por desempenho), atualizar na **mesma transação** da despesa.
- [x] Tabelas novas: `orcamentos` (categoria, valor mensal) e `configuracoes_financeiras`
      (saldo inicial e data). Despesa ganha `animal_id` (chave estrangeira opcional para `animais`).
- [ ] Regras do protótipo a repetir no servidor: valor maior que zero, data não futura, categoria da
      lista; aviso de saldo negativo e de orçamento estourado devolvidos pela API.
- [ ] Exportação da prestação de contas gerada no servidor (CSV/PDF), base do módulo de Relatório técnico.
- [ ] Doação **material** deve gerar uma entrada no Estoque (mesmo item, quantidade e unidade),
      para não ser registrada duas vezes à mão.
- [x] *(estrutura: `softDeletes` + `alterado_por` nas tabelas)* Doações e despesas não devem ser apagadas de verdade: guardar quem alterou e quando
      (prestação de contas), em vez do "Excluir" do protótipo.

## 4. Acesso e LGPD

- [x] Login real com senha criptografada (hash) e sessão; todas as páginas internas
      exigem usuário autenticado.
- [ ] Dados pessoais (CPF, documentos, contatos) visíveis só para usuários da equipe.

- [x] Dados pessoais (CPF) criptografados no banco; `cpf_hash` para unicidade.
- [x] Registro de auditoria (`log_auditoria`) para login, cadastro, alteração e exclusão.
- [ ] Tela/rotina para o titular pedir a exclusão: usar `Voluntario::anonimizar()` (e o equivalente para adotantes).
