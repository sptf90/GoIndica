# Reformulação da área interna do GoIndica

Especificação principal: `Melhoria-APP.md`, lida integralmente (377 linhas). Repositório confirmado: `sptf90/GoIndica`, sem hífen final. As correções da tarefa anterior foram mantidas; a reformulação foi aplicada sobre esse estado, sem descartar alterações existentes.

## Direção visual implementada

A experiência parte do trabalho de uma comunidade local: perguntar, indicar e confirmar. A evolução mantém Inter Variable, o laranja e a linguagem de papel do GoIndica, com três níveis claros: navegação, contexto da página e conteúdo acionável.

| Papel | Cor/token |
|---|---|
| Ação principal | `--brand-orange`, `#ec5e27` |
| Texto e títulos | `--ink`, `#29231f` |
| Informação secundária | `--ink-soft`, `#6c6158` |
| Canvas interno | `--surface-subtle`, `#f6f2e7` |
| Superfície de navegação | `--brand-white`, `#fdfdf1` |
| Painel de trabalho | `--workspace-panel`, `#fffef9` |

Títulos fluidos de 26–36px, texto de trabalho de 14–16px, campos de 16px (inclusive em labels implícitos) e labels de 13px. Os tamanhos vêm da escala existente; bordas, raios, sombras e movimento reutilizam os tokens do projeto.

Composições:

```text
Feed:        contexto + cidade → busca/ação → filtros → pedidos | resumo pessoal
Pedido:      etapas + ações + pergunta + autoria/local → respostas | contexto
Formulário:  título e descrição → preenchimento                 | orientação
Perfil:      identidade e participação → atalhos                 | edição
Config.:     contexto da operação                                | formulário
Admin.:      contexto → abas → filtros → registros ou indicadores
```

As recomendações automáticas da skill UI/UX não corresponderam à identidade existente, mesmo após refinamento da busca; não foram usadas como paleta nem como direção estética. A implementação segue os princípios das skills de frontend design, composição visual, Design System, HTML semântico e acessibilidade, com decisões fundamentadas na aplicação atual.

## Páginas e melhorias individuais

| Rota/estado | Trabalho realizado |
|---|---|
| `/app`, `OPEN`, `UNANSWERED`, `RESOLVED` | Contexto da cidade, título de busca, formulário e CTA agrupados, cards com conteúdo e rodapé separados, resumo lateral com números reais de pendências/notificações e atalho para salvos. |
| `/atividades` e suas abas | Cabeçalho consistente, ação de criação, filtros com estado ativo, histórico de pontos com leitura de registro e valor separados. |
| `/salvos`, `?tab=following` | Composição de coleção, abas de salvos/acompanhados e ação de exploração contextual sem duplicação no estado vazio. |
| `/notificacoes` | Toolbar de acompanhamento/leitura, lista em superfície própria, notificações não lidas com rótulo existente, fundo e marcador lateral. |
| `/ranking` | Cabeçalho, filtro em painel, contexto da cidade, lista de reputação com números alinhados e contrato responsivo de avatar preservado. |
| `/perfil` | Visão geral de identidade e participação privada, estatísticas, reconhecimento e organização em atalhos e edição. |
| `/perfil/[username]` | Cartão de identidade/reconhecimento e retorno contextual, preservando a privacidade e autorização por pedido/ranking. |
| `/pedidos/novo` | Composição própria para preenchimento e orientações úteis, preservando rascunhos, busca de descobertas, fotos e validações. |
| `/pedidos/[id]/editar` | Mesma família de tarefa, com orientação sobre edição e bloqueio após indicação. |
| `/pedidos/[id]/indicar` | Pedido como contexto, seleção de estabelecimento e orientação sobre confiança/privacidade, sem alteração de envio ou seleção. |
| `/pedidos/[id]` | Cabeçalho, etapas, metadados, ações, respostas, participação e painel de contexto com hierarquia de superfícies. Estados de indicação e resolução mantidos. |
| `/preferencias` | Seções independentes para lembretes, alertas e cidades, com formulários agrupados e comandos de remoção preservados. |
| `/conta` | Identificação de acesso, seções de exportação/e-mail/senha/ajuda/encerramento/solicitações; encerramento diferenciado visualmente, preservando confirmação e revisão. |
| `/admin` — dez abas | Cabeçalho, navegação, busca/filtros, painel de registros, métricas em grid e logs com rolagem interna. Usuários, pedidos, indicações, estabelecimentos, denúncias, recompensas, logs, métricas, suporte e operação preservados. |
| Loading, empty, error e disabled | Skeleton de tarefa acompanha as novas colunas; estados vazios recebem superfície e foco na próxima ação; feedback e mecanismos de processamento originais mantidos. |

## Código e isolamento

- `src/app/styles/workspace.css`: camada visual exclusiva de `.app-shell`, tokens internos, variantes de composição e responsividade. Não muda a aparência pública ou do shell empresarial.
- `src/app/(member)/layout.tsx`: carrega a camada interna.
- `src/components/workspace-layout.tsx`: composições reutilizáveis `TaskPage` e `SettingsSection`.
- `src/components/app-chrome.tsx`, `navigation.tsx`: contexto da página, marca móvel, grupos de navegação e estados ativos.
- `src/components/feed-search.tsx`, `request-card.tsx`: agrupamento da pesquisa e rodapé de localização/indicações.
- `src/components/skeletons.tsx`: loading compatível com os novos layouts.
- Páginas de `src/app/(member)/`: implementação individual das composições descritas acima.

Não foram alterados backend, queries, actions, permissões, parâmetros de rota, migrations, integrações ou dependências. O CSS interno é delimitado pelo shell autenticado; testes públicos são executados para verificar possíveis efeitos dos componentes compartilhados.

## Validação

A validação usa MySQL descartável em Docker, SMTP local e fixtures de provedores. Não foram usados dados de produção.

- `npm run lint`: aprovado, sem avisos.
- `npm run typecheck`: aprovado.
- `npm test`: **89 testes aprovados em 14 arquivos**, incluindo integração com MySQL.
- `npm run build`: aprovado, mesmas rotas preservadas.
- Suíte E2E completa: **59 cenários aprovados em 5,3 minutos**, incluindo os dois novos testes de workspace. Após o último ajuste do atalho de salvos e novo build, **mais 5 testes de workspace/design passaram em 36,7 segundos**; as capturas do feed também foram atualizadas.
- `git diff --check`: aprovado.

### Cobertura renderizada

- **320, 375, 390, 430, 768, 1024, 1200, 1280 e 1440px**.
- Viewport de **600 e 850px** de altura nas páginas de navegação, perfil, configurações e pedidos; orientação horizontal nas duas larguras de sidebar.
- As **dez abas administrativas** são percorridas nas nove larguras pela revisão visual ampliada.
- Coleções com os três estados do feed, as cinco abas de atividades e as duas abas de salvos também são percorridas individualmente em mobile, tablet e desktop.
- Texto a **200% em 320px** nas páginas autenticadas centrais, incluindo feed, perfil, ranking, conta, preferências, detalhe e criação de pedido; revisão complementar de texto ampliado em **768 e 1440px**.
- Teclado, foco, Escape, setas, Tab, toque emulado, autocomplete, filtros, privacidade e fluxos de confirmação preservados e exercitados pela suíte.
- Não se usa apenas `scrollWidth`: há verificações de limites de popup, geometria do campo/botão, nome da conta dentro da sidebar, grid de detalhes, visibilidade das ações, não colisão das etapas e limites dos rótulos de navegação.

### Acessibilidade

**axe-core 4.13.0** executado em **20 páginas/estados** internos com regras WCAG A/AA, 2.1 AA e 2.2 AA: **zero violações e zero itens inconclusivos** após estabilizar fontes e animações. A revisão cobre nove páginas centrais, um perfil público em contexto válido de ranking e as dez abas administrativas.

O relatório [workspace-review.json](../artifacts/workspace-review.json) registra os resultados e as verificações de texto ampliado em três larguras. Componentes existentes de foco, movimento reduzido, mensagens de erro/status e diálogos foram preservados. A barra inferior usa grid e altura relativas à tipografia: mantém os quatro destinos e pode distribuí-los em mais linhas com texto ampliado, sem fragmentar ou sobrepor os rótulos e reservando espaço no documento.

### Regressões encontradas e corrigidas

- Labels menores alteraram o alinhamento do filtro de cidade: altura de label compartilhada pelo cálculo de alinhamento.
- Log técnico passou a dimensionar seu contêiner: largura do registro limitada e rolagem mantida dentro de `pre`.
- Nome extenso da conta extrapolava a sidebar fixa: contrato de encolhimento explícito no contêiner e no botão.
- Hint da cidade desalinhava os filtros de métricas: grid adapta os campos por largura e alinha seus inputs.
- Separação visual do e-mail removeu a pontuação do texto original: restaurado `E-mail atual: …` sem modificar o teste funcional.
- Seletor de cidade e estatísticas comprimiam conteúdo com texto ampliado: limite de largura e grid guiada por `em`.
- O resumo existente normaliza `saved` como booleano: o novo painel usa atalho com seta para salvos, preservando o backend e evitando apresentar uma contagem incorreta.
- Rótulos ampliados da navegação inferior colidiam apesar da ausência de overflow da página: rótulos com quebra e altura ligada à tipografia; cobertura por limites do texto renderizado.

### Evidências

As capturas de referência foram preservadas em [workspace-before](../artifacts/workspace-before/); as novas capturas estão em [workspace-after](../artifacts/workspace-after/). A suíte gera ainda as capturas de todas as larguras em `test-results/`.

- [Feed desktop](../artifacts/workspace-after/app-1440.png) e [mobile](../artifacts/workspace-after/app-390.png).
- [Navegação com texto a 200%](../artifacts/workspace-after/nav-texto200.png).
- [Perfil desktop](../artifacts/workspace-after/perfil-1440.png).
- [Conta desktop](../artifacts/workspace-after/conta-1440.png) e [mobile](../artifacts/workspace-after/conta-390.png).
- [Administração mobile](../artifacts/workspace-after/admin-users-390.png) e [métricas mobile](../artifacts/workspace-after/admin-metrics-390.png).
- [Edição de pedido](../artifacts/workspace-after/editar-pedido-1440.png) e [indicação mobile](../artifacts/workspace-after/indicar-local-390.png).
- [Preferências desktop](../artifacts/workspace-after/preferencias-1440.png).
- [Novo pedido desktop](../artifacts/workspace-after/pedidos-novo-1440.png) e [mobile](../artifacts/workspace-after/pedidos-novo-390.png).

## Preservação e limites

A reformulação visual abrange o espaço de membros de `src/app/(member)`, incluindo a administração. As páginas públicas, onboarding e o painel empresarial mantêm seus layouts próprios; os fluxos correspondentes são cobertos pela regressão. As alterações públicas/empresariais da tarefa anterior não foram descartadas nem ampliadas por esta reformulação.

Queries, autenticação/autorização, permissões, APIs, contratos de dados, formulários, rascunhos, validações, privacidade das indicações, pontuação e integrações não foram modificados. A evolução ocorre na composição e apresentação.

Limites: Chromium e emulação de toque/texto; não houve uso de leitor de tela ou teste em aparelhos físicos. Provedores externos foram exercitados com fixtures locais e testes de contrato, sem consumo de APIs pagas ou dados de produção. Zero violações automatizadas não é declaração de conformidade WCAG completa. Nem todas as ações administrativas destrutivas foram executadas; seus handlers, confirmações e permissões foram preservados.


## Refinamento do encontro entre header e sidebar

Após feedback visual, o header em telas a partir de 768px passou a ser um painel contido na largura do conteúdo, com o mesmo recuo superior, borda e raio da sidebar. A faixa horizontal contínua foi removida nesse breakpoint; o comportamento sticky e o header mobile foram preservados. A correção está em `workspace.css`, com verificações geométricas de separação, alinhamento e largura em `tests/e2e/design.spec.ts`.

Lint, typecheck e build passaram. Os nove E2E de design, menu da conta e workspace passaram (52 segundos), incluindo a matriz de nove larguras. Capturas renderizadas inspecionadas em [desktop](../artifacts/workspace-after/header-sidebar-1440.png), [tablet](../artifacts/workspace-after/header-sidebar-768.png) e [mobile](../artifacts/workspace-after/header-sidebar-390.png).

## Foco da navegação e indicador ativo

Removido o traço lateral de seleção da sidebar; o preenchimento animado permanece como indicador de página ativa. Na navegação lateral e inferior, o foco de teclado usa contorno interno de 2px e offset de -2px para evitar recorte pelo contêiner com rolagem. Outros componentes mantêm seus indicadores de foco.

Lint, typecheck e build aprovados; sete E2E de menu e design aprovados (42,9 segundos). Revisão renderizada adicional em 390, 768, 1200 e 1440px confirmou `:focus-visible`, contorno interno e ausência da sombra lateral. [Captura do foco na sidebar](../artifacts/workspace-after/navigation-focus-1440.png).
