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

## 4. Acesso e LGPD

- [ ] Login real com senha criptografada (hash) e sessão; todas as páginas internas
      exigem usuário autenticado.
- [ ] Dados pessoais (CPF, documentos, contatos) visíveis só para usuários da equipe.
