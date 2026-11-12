# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Funcionários de ONGs e grupos de proteção animal de Guarapuava (PR):** pessoas com experiência nos processos da organização (resgate, tratamento, adoção, finanças, estoque). Acesso amplo aos módulos.
- **Voluntários:** pessoas em fase inicial de aprendizado no grupo. Acesso limitado a alguns módulos.
- **Interessados em ser voluntário (público, sem login):** preenchem o formulário de inscrição aberto (`Pages/voluntario-cadastro.html`).
- **Situação de uso:** principalmente no computador do abrigo, durante a rotina de gestão (cadastros, acompanhamento de processos, conferência de estoque e finanças). A responsividade é requisito, mas o celular não é o cenário principal.

## Product Purpose

Centralizar em uma única plataforma a administração de ONGs e grupos independentes de proteção animal, substituindo "caneta e papel", planilhas e o Drive, que se tornam insuficientes diante da alta demanda de resgates na cidade. O sucesso é a equipe acompanhar do resgate até a adoção com eficiência, organização e segurança dos dados.

## Positioning

Feito a partir das dores observadas nas ONGs de Guarapuava (não para uma ONG específica): reúne em um só lugar os módulos que hoje ficam espalhados — animais, resgates, adoções com verificação da equipe, voluntários, doações/financeiro, estoque — e gera automaticamente o relatório técnico exigido quando a organização recebe recursos públicos municipais.

## Operating Context

- Projeto de Conclusão de Curso do Técnico em Desenvolvimento de Sistemas (C. E. Ana Vanda Bassara). Será avaliado pela banca e precisa funcionar para equipes reais de ONGs: os dois públicos importam igualmente.
- Fluxo de adoção: `Novo → Em análise → Aprovada → Concluída` (ou `Recusada` / `Cancelada`, com motivo), com entrevista, visita, documentos e termo.
- Relatório técnico para prestação de contas de recursos públicos municipais.

## Capabilities and Constraints

- Módulos: Dashboard, Animais, Resgates, Adoções, Voluntários & Equipe (com formulário público), Doações/Financeiro, Estoque, Relatório técnico, Login.
- Front-end atual: HTML, CSS, JavaScript, Bootstrap 5, Bootstrap Icons e Chart.js; dados de protótipo em `localStorage` (`js/dados.js`). Tema claro e escuro.
- Back-end previsto: PHP/Laravel com MySQL (views Blade + rotas JSON), integrado módulo a módulo.
- Requisitos não funcionais do artigo: páginas e consultas em ~2 s, responsividade, alta disponibilidade, conformidade com a LGPD.
- Estoque em local único, com unidades de medida e alertas de nível crítico.

## Brand Commitments

- Nome: **PAWSAFE**. Logo própria, que deve funcionar nos modos claro e escuro.
- Interface em português do Brasil; tom direto e prático para a rotina da equipe.

## Evidence on Hand

- Artigo do TCC com problema, requisitos e dados de contexto (canil de Guarapuava resgata em média 300 a 360 animais; RSN fala em mais de 80 mil animais abandonados na cidade e região).
- Os dados das telas são demonstrativos; não há ONG parceira, depoimentos nem métricas de uso reais. Não inventar.

## Product Principles

1. **Rotina antes de vitrine:** cada tela serve a uma tarefa da equipe; clareza e velocidade de leitura vêm primeiro.
2. **Do resgate à adoção em um só lugar:** os módulos se conversam (estoque, financeiro, animais, relatório) em vez de duplicar dados.
3. **Dados pessoais com cuidado:** LGPD visível no produto — consentimento, CPF oculto nas listas, acesso por perfil.
4. **Acessível a quem está aprendendo:** voluntários iniciantes precisam entender a tela sem treinamento longo.

## Accessibility & Inclusion

Meta de contraste e legibilidade WCAG 2.1 AA, nos temas claro e escuro, com uso por teclado nos formulários.
