# Avaliação do front-end com /impeccable — 12/11/2026

Branch: design/impeccable-frontend. Nenhum arquivo do sistema foi alterado; este documento registra o critique do Dashboard e o audit técnico de todas as páginas.

# Parte 1 — Critique do Dashboard (index.html)

Método: dual-agent (A: revisão de design · B: detector + navegador), ambos isolados.
Ressalva de ambiente: CDNs bloqueados no sandbox (Bootstrap aproximado pelo Bootswatch 5.3.2; Bootstrap Icons, Google Fonts e Chart.js ausentes). Ícones vazios, gráficos em branco e fonte de fallback não contam como defeito; os gráficos foram avaliados pelo código.

## Nota de saúde do design: 23/40 (Aceitável)

| # | Heurística | Nota | Problema principal |
|---|---|---|---|
| 1 | Visibilidade do status | 3 | Data e badges de pendência funcionam; "R$ 0,00" e gráfico zerado aparecem sem contexto. |
| 2 | Linguagem do mundo real | 3 | Vocabulário da ONG correto; rodapés como `Status "Adotado"` e "Total registrado" soam técnicos. |
| 3 | Controle e liberdade | 3 | Página de leitura; sem período/filtro nos gráficos e pílulas de status. |
| 4 | Consistência e padrões | 3 | Badges compartilhados entre módulos; cards sobem no hover sem serem clicáveis; azul significa "Novo", "Adotado" e "Em atendimento". |
| 5 | Prevenção de erros | 3 | Pouca superfície; HTML escapado. |
| 6 | Reconhecer em vez de lembrar | 2 | Descrição do resgate truncada sem `title`; coluna "Situação" cortada; alerta de estoque só como número na lateral. |
| 7 | Flexibilidade e eficiência | 1 | Sem ações rápidas (Novo resgate, Registrar doação), sem busca; cards e pílulas não filtram; linhas não alcançáveis por teclado. |
| 8 | Estética e minimalismo | 2 | O total "8 animais" aparece 4 vezes; o maior painel é um gráfico zerado. |
| 9 | Recuperação de erros | 2 | Se o Chart.js falha, só um `console.warn` (dashboard.js:99) e canvas em branco. |
| 10 | Ajuda e documentação | 1 | Prioridades, etapas e métricas sem explicação para voluntários iniciantes. |

## Especificidade do design

Avaliação: majoritariamente intercambiável com um template de admin. Troque "Animais/Resgates" por "Clientes/Tickets" e vira um CRM: seis cards iguais com ícone em quadrado tingido e faixa colorida de 4px na borda direita, rótulo maiúsculo acima do título, barra + rosca, duas tabelas de "últimos itens". O único trecho realmente do domínio é a ordenação dos resgates (abertos primeiro, depois prioridade; dashboard.js:70–75), escondido no canto inferior direito em texto de 11px. Faltam: o trabalho do dia (resgates críticos, estoque em falta, voluntários aguardando, adoções aguardando visita), os próprios animais (nomes e fotos) e o prazo do relatório de recursos públicos.

Detector: 38 achados no index.html (21 texto pequeno, 6 faixas laterais `span.stat-accent` em dashboard.css:68, 6 texto de corpo minúsculo, 4 contraste, 1 rótulo acima do título). Overlay no navegador: 62 (claro), 57 (escuro, 0 de contraste), 55 (390px). O navegador pegou além do CLI: badges de alerta da lateral branco sobre #c37655 (3,5:1) e cores de status logo abaixo de 4,5:1 (Em análise/Pendente/Em Tratamento 4,1:1; Média 4,4:1; Sem sucesso 4,0:1). Falsos positivos: estouro horizontal em 390px (canvas do stub do Chart.js) e contrastes de 1,0–1,9 na lateral (gradiente ignorado pelo script; o texto real tem 7–12:1).

## Impressão geral

Calmo, consistente e honesto nos dados, mas parece um template tingido de verde. Mostra totais quando a equipe precisa saber o que fazer hoje, e boa parte do texto é pequena e clara demais para voluntários. A maior oportunidade: transformar o topo em "Precisa de atenção".

## O que funciona

1. Fonte única de dados: todo número vem de `PawData`, a mesma dos módulos; badges da lateral (Resgates 3, Voluntários 2, Estoque 2) são sinais reais de triagem e somem quando zeram.
2. A ordenação dos resgates codifica a lógica do abrigo: abertos antes de encerrados, Crítica → Baixa, mais recentes.
3. Tema por tokens bem feito: cores dos gráficos vêm do CSS e são reaplicadas ao trocar o tema; o modo escuro passa em contraste em toda a página.

## Problemas prioritários

- [P1] Texto pequeno e claro demais. Cabeçalhos de tabela 9px a ~3,1:1 (dashboard.css:208–215), badges 9px, subtítulos 11px a 3,2:1 (`--tinta-87938b`), rodapés dos cards 10px a 3,6:1. Contraria o compromisso WCAG AA do PRODUCT.md. Correção: mínimo de 12px para metadados e 13–14px nas células; mapear os tokens `--tinta-*` de texto para `--muted-foreground` (5,0:1). Comando: /impeccable typeset.
- [P1] Hierarquia mostra totais em vez de trabalho. Seis cards de mesmo peso e dois gráficos ocupam a primeira tela; o resgate "Crítica" é um badge de 9px no fim da página. Correção: faixa "Precisa de atenção" no topo (resgates críticos/abertos, estoque crítico, voluntários aguardando, adoções em análise, cada um como link filtrado); reduzir para 4 cards; subir a tabela de resgates. Comando: /impeccable layout (+ distill).
- [P1] Tabela de resgates cortada e linhas só com mouse. Em 1440px a coluna "Situação" é cortada ("Em atendimen…"); em 390px Prioridade e Situação somem. `tr[data-href]` só com clique (dashboard.js:54, 78): sem foco, sem leitor de tela. Correção: link real (stretched link) no nome/descrição; tirar a coluna Data do dashboard; descrição em 2 linhas; no celular, linhas viram cards com a prioridade primeiro. Comandos: /impeccable harden + /impeccable adapt.
- [P2] Estados vazios e de falha. Gráfico de adoções zerado (a única adoção concluída é de 20/12/2025, fora da janela) e "R$ 0,00" sem explicação; canvas em branco se o Chart.js falhar. Correção: mensagem inline ("Nenhuma adoção concluída nos últimos 6 meses"), fallback em texto no `.chart-wrap`, dados de demonstração dentro da janela. Comando: /impeccable clarify.
- [P2] Sinais de template e falsas affordances: faixas laterais coloridas, ícones decorativos em todo card e cabeçalho, hover que levanta cards não clicáveis, rótulo maiúsculo acima do título. Correção: remover faixas e ícones decorativos; tornar os cards links filtrados ou tirar o hover. Comando: /impeccable quieter.

## Personas

- Alex (usuário avançado): sem ações rápidas na barra superior, sem busca, cards e pílulas não filtram, não dá para navegar pelas linhas com Tab.
- Sam (acessibilidade): `tr.clickable-row` sem foco; `#adoptionsChart` sem alternativa em texto/tabela; falhas de contraste do tema claro; texto de 9px nas tabelas; badges de alerta a 3,5:1.
- Voluntário iniciante no PC do abrigo (PRODUCT.md): sem primeira ação clara; rótulos maiúsculos de 10px; Crítica/Alta/Média sem explicação; vê "Doações neste mês" embora deveria ter acesso limitado; o perfil "Administradora" está fixo em sidebar.js:57.

## Observações menores

- "Últimas adoções — Processos abertos mais recentes" lista Rex como "Concluída": o subtítulo está errado.
- Mesma cor com significados diferentes: âmbar = Em análise, Pendente, Em Tratamento; azul = Novo, Adotado, Em atendimento.
- A legenda e o centro da rosca repetem o card "Animais cadastrados".
- O ícone da marca (`bi-heart-pulse-fill`) difere da pata usada nos animais; conferir com a logo.

## Perguntas para pensar

1. Às 8h, no computador do abrigo, qual é a primeira coisa que o voluntário deve fazer — e a página diz isso? O dashboard deveria ser uma lista de tarefas em vez de um relatório?
2. O gráfico de 6 meses merece o maior painel para a ONG, ou está ali para a banca?
3. Uma administradora e um voluntário iniciante deveriam ver o mesmo dashboard, incluindo as finanças?

# Parte 2 — Audit técnico do front-end

Escopo: todo o front-end (10 páginas), temas claro e escuro, larguras 1440px e 390px. Ressalva de ambiente: CDNs bloqueados no sandbox (Bootstrap aproximado, sem ícones, fontes e Chart.js); estouros e contrastes causados só por isso foram descartados.

## Nota de saúde do audit: 13/20 (Aceitável)

| # | Dimensão | Nota | Achado principal |
|---|---|---|---|
| 1 | Acessibilidade | 2 | Tema claro falha AA em textos secundários em quase todas as páginas; texto de 9–11px generalizado; linhas de tabela clicáveis só com mouse. |
| 2 | Desempenho | 3 | Site estático e leve; reduced-motion corta todas as transições de uma vez. |
| 3 | Tema | 3 | Tokens shadcn completos e escuro passando AA; 44 tokens nomeados pelo hex antigo (`--tinta-87938b`) e cores fixas em sidebar.css e login.css. |
| 4 | Responsivo | 3 | Sem estouro horizontal real em 390px; links/botões de texto com 16–18px de altura; tabela de resgates esconde colunas no celular. |
| 5 | Integridade da implementação | 2 | Padrões de template repetidos (rótulo acima do título em 9 páginas, faixas laterais) e tokens com nome de cor. |

## Veredito de integridade

Reprovado por pouco. O sistema é coerente (uma base CSS, tokens, mesmos badges em todos os módulos, dados de uma fonte só), mas a camada visual repete padrões de template que o detector marca em quase todas as páginas, e os tokens `--tinta-<hex>` mostram uma migração mecânica que não virou sistema: o nome descreve a cor antiga, não a função.

## Resumo executivo

- Nota: 13/20 (Aceitável).
- 171 achados do detector nas 10 páginas (75 texto pequeno, 69 contraste, 10 rótulo acima do título, 7 faixa lateral, 4 padding apertado, 3 borda colorida em elemento arredondado, 2 espaçamento largo, 1 imagem).
- Problemas por severidade: P0 0 · P1 3 · P2 4 · P3 2.
- Top 3: contraste do tema claro; tamanho de texto 9–11px; linhas clicáveis sem teclado.

## Achados por severidade

- [P1] Contraste do tema claro abaixo de 4,5:1 — Acessibilidade. Local: tokens `--tinta-87938b`, `--tinta-7c8b81`, `--tinta-859188`, `--tinta-8b968e` (CSS/tema.css:~299), usados em subtítulos de painel, rodapés de card, cabeçalhos de tabela, IDs de card (animais), notas (estoque), abas, `label.remember-option` (login); cores de status (#98652a/#f6e7cb 4,1:1, #6c7570/#e9eceb 4,0:1, #896b1f/#f7efd4 4,4:1); badges de alerta da lateral (branco/#c37655 3,5:1). Medido: 15–80 elementos por página no claro, 0 no escuro (exceto login 4,2–4,49:1 e "Fim do período" em relatórios). Impacto: leitura difícil no monitor do abrigo. WCAG 1.4.3. Recomendação: escurecer esses tokens para ≥4,5:1 (ou mapear para `--muted-foreground`), escurecer o texto dos status âmbar/cinza e o fundo do badge de alerta. Comando: /impeccable colorize (ou polish).
- [P1] Texto de 9–11px como padrão — Acessibilidade/Responsivo. Local: 51 ocorrências de `font-size: 10px`, 60 de 11px, 24 de 9px no CSS; renderizado: 81 elementos a 9px e 303 a 10px no tema claro (relatorios.html sozinho tem 347 elementos abaixo de 12px). Impacto: voluntários iniciantes e qualquer pessoa com visão reduzida; o corpo é 14px mas o conteúdo roda em 9–11px. WCAG 1.4.4 (risco ao ampliar). Recomendação: escala com mínimo 12px (metadados), 13–14px (tabelas e formulários). Comando: /impeccable typeset.
- [P1] Linhas de tabela clicáveis só com mouse — Acessibilidade. Local: `tr.clickable-row[data-href]` em js/dashboard.js:54 e :78 e `tr.clickable-row` em js/doacoes.js:253 e :275 (só listener de clique, sem tabindex/role/link). Impacto: quem usa teclado ou leitor de tela não abre o registro. WCAG 2.1.1. Recomendação: link real no nome/descrição da linha cobrindo a linha (stretched link) ou botão; manter o clique na linha como atalho. Comando: /impeccable harden.
- [P2] Alvos de toque pequenos — Responsivo. Local: `a.view-all` (dashboard, 16,5px de altura), `#helpLink` (login, 16,5px), `button.card-details` (animais, 18,5px), `button.item-link` (estoque, 18px). Impacto: difícil tocar no celular. WCAG 2.5.8 (24px). Recomendação: padding vertical para ≥24px (ideal 44px no mobile). Comando: /impeccable adapt.
- [P2] Tabelas do dashboard no celular — Responsivo. Local: index.html:112 e :125 (`.table-responsive`); em 390px Prioridade e Situação ficam fora da tela, e em 1440px "Situação" é cortada. Recomendação: no celular, linhas viram cards com prioridade primeiro; tirar a coluna Data do dashboard. Comando: /impeccable adapt.
- [P2] Tokens com nome de cor e cores fixas — Tema. Local: 44 tokens `--tinta-<hex>` (87 definições em tema.css, 72 usos); 17 hex fixos em CSS/sidebar.css, 15 em CSS/login.css; cores em js/animais.js, js/relatorios.js. Impacto: manutenção difícil e risco de cor que não muda com o tema. Recomendação: renomear por função (`--text-subtle`, `--text-faint`) e consolidar; mover hex fixos para tokens. Comando: /impeccable polish.
- [P2] Gráficos sem alternativa em texto — Acessibilidade. Local: `#adoptionsChart` e demais canvas (dashboard, doações, relatórios) só com `aria-label` genérico; sem fallback se o Chart.js não carregar. WCAG 1.1.1. Recomendação: tabela/resumo em texto associado e mensagem de fallback. Comando: /impeccable harden.
- [P3] Reduced-motion global — Desempenho/Acessibilidade. Local: CSS/base.css:514 zera todas as transições e animações, inclusive feedback útil. Recomendação: manter transições curtas de opacidade/cor e remover só movimento. Comando: /impeccable animate.
- [P3] Padrões de template — Integridade. Local: rótulo maiúsculo acima do título em 9 páginas (index, login, adoções, animais, doações, estoque, relatórios, resgates, voluntários, voluntario-cadastro), faixas `span.stat-accent` (dashboard.css:68) e `border-left: 3px` (relatorios.css), bordas coloridas no login, `letter-spacing: .12em` em voluntario-cadastro. Recomendação: remover faixas e espaçamento largo; rótulo só onde agrega informação. Comando: /impeccable quieter.

## Falsos positivos verificados

- "broken-image" em animais.html: é o `#photoPreview`, escondido (`d-none`) e preenchido pelo JS.
- "cramped-padding" em `.table-card` (adoções, doações) e `.stock-table-wrap` (estoque): a tabela encosta na borda de propósito; as células têm padding.
- Estouro horizontal em 390px no dashboard: canvas do stub do Chart.js no sandbox.
- Contrastes de 1,0–1,9:1 na lateral e no painel visual do login: o script ignora gradiente/imagem de fundo.

## Padrões sistêmicos

- Os mesmos 4–5 tokens de texto claro causam quase todas as falhas de contraste: corrigir os tokens resolve dezenas de achados de uma vez.
- A escala tipográfica não tem piso: 9px, 9,5px, 10px, 10,5px, 11px e 11,5px coexistem.
- Linhas clicáveis seguem o mesmo padrão sem teclado no dashboard e em doações.

## Pontos positivos

- `lang="pt-BR"`, `<main>` e `<nav>` em todas as páginas; todos os campos de formulário têm rótulo; nenhum botão ou link sem nome acessível.
- `:focus-visible` com anel de 3px nos controles customizados (checkboxes, toggles, chips).
- Botão de tema com `aria-label` e `aria-pressed`; 13 regiões `aria-live`/`role="status"`/`role="alert"` para avisos.
- Confirmação antes de ações destrutivas (excluir animal, adotante, doação; saldo negativo).
- Tema escuro passa AA em todas as páginas internas; sem estouro horizontal real em 390px; nenhum erro de JavaScript nas 10 páginas.

## Ações recomendadas

1. [P1] /impeccable colorize: escurecer os tokens `--tinta-*` de texto, os status âmbar/cinza e o badge de alerta para ≥4,5:1 no tema claro.
2. [P1] /impeccable typeset: piso de 12px para metadados e 13–14px para tabelas e formulários em todas as páginas.
3. [P1] /impeccable harden: links reais nas linhas clicáveis (dashboard e doações) e alternativa em texto para os gráficos.
4. [P2] /impeccable adapt: alvos ≥24px e tabelas do dashboard em cards no celular.
5. [P3] /impeccable quieter: remover faixas laterais, bordas coloridas e espaçamento largo.
6. /impeccable polish: renomear tokens `--tinta-<hex>` por função e fechar o restante.
