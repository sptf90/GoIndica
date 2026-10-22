# Correção e padronização visual — GoIndica

Referência: `main`, `20d8d0c57432991276d134cdd39045d18ebeb255`, repositório `https://github.com/sptf90/GoIndica.git`.

A especificação `Correção-padronização.md` foi lida integralmente. Não havia alterações em arquivos versionados no início da execução; a especificação estava como arquivo não versionado. A identidade visual, os textos jurídicos e as regras de negócio foram preservados.

## Implementação

| Item | Correção e evidência |
|---|---|
| P1-01 | Contorno de 3px no contêiner de busca da paleta; a regra global de foco deixa de apagar o outline dos campos. A busca do feed recebe contorno no contêiner. Sem variação de dimensão ou contornos duplicados na busca. |
| P1-02 | Acionador de conta passa a ser botão com `aria-expanded`/`aria-controls`. Estado React controla clique, toque, hover, Escape, saída de foco e clique externo. Conteúdo fechado usa `hidden`. “Meu perfil” continua apontando para `/perfil`; o formulário de logout usa a mesma action. A ponte e um pequeno atraso de fechamento permitem atravessar o espaço inclusive em diagonal; o teste movimenta o ponteiro em 20 passos até “Sair”. Preservada animação de entrada com suporte a movimento reduzido. |
| P1-03 | Texto de `.status-revealed` passa a `--orange-dark`, mantendo o fundo. Contraste sobe de aproximadamente 4,42:1 para 6,10:1. Todas as variantes preservam seus rótulos. |
| P1-04 | Primitiva `MainContent` mantém um único `main#conteudo` focável. Fallbacks usam o landmark existente quando estão dentro do shell e criam o próprio quando renderizados diretamente no layout raiz. Corrigida também a duplicação de `main` na página ausente dentro da área autenticada. |
| P2-01 | Uma única regra desktop de `.detail-grid`, mantendo a largura efetiva de 300px para o contexto. |
| P2-02 | Fotos e iniciais usam as mesmas propriedades CSS de tamanho do `Avatar`, com `mobileSize` explícito para ranking e perfis. Removidos os `!important` de dimensão. Mantidos 36/40px no ranking, 64/72px no perfil próprio e 64/80px no perfil público (mobile/desktop). Prévia de foto mantém 96px. |
| P2-03 | Variante `.button.sm` reutilizada no cabeçalho público e nas ações de pedido. Base compartilhada oferece alvo mínimo de 44px em mobile/dispositivos com ponteiro coarse, mantendo controles compactos de 36px em desktop. Sidebar e menu usam 44px. |
| P2-04 | Espaçamento de ícone e texto em status, contagem, opções e metadados usa `--gap-inline-tight`. Altura grande reutiliza `--space-12`. Mantidas dimensões especializadas e sombras com finalidades distintas, sem tokenização indiscriminada. |
| Adicional — sidebar horizontal | Captura e medição de 850×390px mostraram o acionador de conta em y=502px, fora da viewport de 390px. A lista de navegação passa a ter `min-height: 0`, flex e rolagem interna; criação e conta permanecem acessíveis. Acrescentado teste também em 1200×390px. |
| Adicional — texto ampliado público | Em 320px, texto a 200% produzia `scrollWidth=382px`: links do rodapé sem quebra e largura mínima intrínseca dos filhos do hero. Rodapé agora quebra os links e os filhos da grid podem encolher (`min-width: 0`). Teste cobre landing, autenticação, cadastro empresarial e páginas legais. |
| Adicional — ranking e skip link com texto ampliado | Captura localizada mostrou a identificação da pessoa quebrada em fragmentos de poucas letras e o skip link parcialmente visível sem foco após ampliação. Abaixo de 360px, pontos passam para a linha abaixo da identificação; o skip link passa a se ocultar pela própria altura, sem deslocamento fixo de 100px. |
| Seção 6.6 | Captura inicial de 320px confirmou etapas comprimidas com fonte de 10px. Retirado esse ajuste; rótulos usam ao menos 12px, com quebra flexível e organização vertical abaixo de 360px. Estado e ordem das etapas não foram alterados. |

## Arquivos de aplicação

| Caminho | Motivo |
|---|---|
| `src/components/account-menu.tsx` | Disclosure acessível para conta, com estado e fechamento. |
| `src/app/(member)/layout.tsx` | Composição do menu com os mesmos dados, link de perfil e logout. |
| `src/components/main-content.tsx` | Contrato reutilizável de landmark e destino do skip link. |
| `src/components/app-chrome.tsx` | Provider de conteúdo principal no shell autenticado. |
| `src/app/empresa/layout.tsx` | Mesmo contrato no shell empresarial. |
| `src/app/error.tsx` | Landmark/destino de skip link, preservando `reset`. |
| `src/app/not-found.tsx` | Landmark sem duplicação, preservando a ação de retorno. |
| `src/components/ui.tsx` | Dimensões compartilhadas de fotos e iniciais de avatar. |
| `src/app/(member)/perfil/page.tsx` | Dimensão móvel explícita do avatar próprio. |
| `src/app/(member)/perfil/[username]/page.tsx` | Dimensão móvel explícita do avatar público. |
| `src/app/(member)/ranking/page.tsx` | Dimensão móvel explícita dos avatares do ranking. |
| `src/app/(member)/pedidos/[id]/page.tsx` | Uso da variante compacta no botão de edição. |
| `src/components/share-request.tsx` | Uso da mesma variante compacta ao compartilhar. |
| `src/app/(public)/layout.tsx` | Uso da variante compartilhada no CTA do cabeçalho. |
| `src/app/styles/foundation.css` | Espaçamento compartilhado, dimensão de botões, área de toque e ocultação robusta do skip link. |
| `src/app/styles/application.css` | Foco, contraste de status, menu e controles do shell. |
| `src/app/styles/components.css` | Paleta, grid única, avatar, etapas e controles do pedido. |
| `src/app/styles/responsive.css` | Remoção de `!important` de avatar e de fonte de 10px; reflow das etapas e ranking compacto. |
| `src/app/styles/public.css` | Retirada de variante duplicada, token de altura, reflow do hero e quebra de links do rodapé. |
| `src/app/styles/discovery.css` | Preservação da dimensão da prévia de foto sob o contrato de avatar. |

Não foi necessário alterar `ActionForm`, `command-palette.tsx`, `globals.css`, os tokens da paleta principal, backend, migrations, APIs, permissões, serviços ou dependências.

## Arquivos de testes

- `tests/e2e/account-menu.spec.ts`: hover, travessia ao popup, Enter, Tab, clique, Escape, retorno de foco, toque, clique externo, perfil e logout em sidebar compacta/expandida.
- `tests/e2e/command-palette.spec.ts`: contorno efetivo e retorno do foco ao acionador.
- `tests/e2e/visual-contracts.spec.ts`: contraste dos cinco status normal/hover, dimensões foto/iniciais, skip links, landmarks, etapas, alvos e texto a 200%.
- `tests/e2e/render-visual-fixtures.ts`: renderiza os componentes reais para testar seus estados com o CSS da aplicação, sem criar rotas de teste no produto.
- `tests/unit/main-content.test.ts`: erro e ausência de conteúdo com/sem shell, sem duplicação de `main` e `id`.
- `tests/e2e/design.spec.ts`, `tests/e2e/viewport.spec.ts`, `tests/e2e/visual-review.spec.ts`, `tests/e2e/public.spec.ts`: matriz ampliada para 1200px e as nove larguras solicitadas.

## Contrastes dos estados usados

| Estado | Relação |
|---|---:|
| OPEN | 4,95:1 |
| REVEALED | 6,10:1 |
| RESOLVED | 7,29:1 |
| CLOSED_NO_RESULT / CANCELED | 5,38:1 |
| Botão primário normal | 4,58:1 |
| Botão primário hover | 5,49:1 |
| Botão primário active | 7,58:1 |
| Contorno de foco sobre a superfície principal | 5,49:1 |

Os testes de status calculam as cores computadas no navegador, inclusive hover. As demais relações acima foram calculadas a partir dos tokens utilizados.

## Resultados de validação

- `npm run lint`: aprovado, zero avisos.
- `npm run typecheck`: aprovado.
- `npm test`: 14 arquivos, 89 testes aprovados, incluindo integração MySQL em Docker e os novos testes de landmarks.
- `npm run build`: aprovado, mantendo as rotas existentes.
- `npm run test:e2e`: suíte completa de 57 testes aprovada após as correções de reflow; após a última melhoria de hover, `npx playwright test tests/e2e/account-menu.spec.ts tests/e2e/command-palette.spec.ts` passou nos 5 testes de regressão (incluindo movimento diagonal), e lint/typecheck/build foram novamente aprovados.
- `git diff --check`: aprovado.

O ambiente E2E utiliza MySQL descartável, SMTP local e fixtures de CNPJ/Google Places. Nenhum fluxo foi executado contra dados de produção.

### Responsividade e revisão visual

Larguras de **320, 375, 390, 430, 768, 1024, 1200, 1280 e 1440px**. A suíte de viewport percorre feed, ranking, atividades, perfil próprio/público, criação, detalhe, edição, salvos, notificações, preferências e conta nas nove larguras, com alturas de **600 e 850px**. A revisão adicional cobre todas as sete abas administrativas previstas na especificação, indicação/estabelecimento selecionado, comentários e nomes longos, landing, páginas legais e ausência de conteúdo.

A inspeção empresarial adicional cobre cadastro por CNPJ preenchido e painel com nome extenso nas nove larguras, confirmando uma coluna no mobile e duas no desktop. Orientação horizontal validada em **850×390 e 1200×390px** para navegação e menu. Texto a **200%** validado em 320px em páginas públicas e autenticadas. Ampliação por pinch foi emulada via CDP (`visualViewport.scale=2`), sem confundir zoom com teclado virtual nem ocultar a navegação. Não equivale a uma avaliação de todas as configurações de zoom de navegador/OS.

Foram inspecionadas capturas de pedido em mobile/desktop, administração, indicação, painel empresarial, menu horizontal, rodapé e ranking com texto ampliado. Os testes verificam também geometria da grid, limites de popups, sobreposição entre etapas, acesso a ações acima da navegação e alinhamento dos filtros; a avaliação não se limitou ao `scrollWidth`.

### Acessibilidade

- Teclado real via Playwright: Tab, Enter, setas e Escape; retorno de foco de paleta/menu; destinos de skip link; elementos ocultos fora da navegação.
- Menu também exercitado com clique, hover, movimento diagonal e toque em contexto com `hasTouch`.
- Cinco status com contraste AA normal/hover, fotos/iniciais com dimensões iguais e alvos compactos móveis de pelo menos 44×44px.
- Movimento reduzido emulado: as quatro estatísticas do perfil apresentam `animation-name: none`; regras CSS existentes e `MotionConfig` preservados.
- **axe-core 4.13.0**, disponível no ambiente, executado em **21 páginas/estados** com regras WCAG A/AA, 2.1 AA e 2.2 AA. Nenhuma violação persistente nos estados inspecionados. Um apontamento inicial no perfil ocorreu durante a entrada por opacidade; nova auditoria após as animações terminou com zero violações e zero itens incompletos no perfil. Não foi feita mudança especulativa nas cores das estatísticas.

A primeira passagem do axe também registrou itens **inconclusivos**, sem classificá-los como violações: nome ARIA/contraste da demonstração na landing e contraste em atividades/administração. Eles estão registrados no JSON; a revisão visual e o cálculo das cores efetivas não justificaram alterações especulativas. Uma avaliação assistiva completa continua fora do alcance desses resultados automatizados.

Resultados complementares: [auditoria renderizada](../artifacts/live-review.json) e [texto ampliado, perfil estabilizado, orientação e movimento](../artifacts/extra-review.json).

### Evidências visuais

- [Pedido inicial em 320px](../artifacts/visual-baseline/prototipo-pedido-vazio-320.png).
- [Sidebar horizontal antes da correção](../artifacts/visual-baseline/sidebar-horizontal.png).
- [Ranking ampliado antes da correção](../artifacts/visual-baseline/ranking-texto200.png).
- [Etapas e controles corrigidos em 320px](../artifacts/etapas-controles-320.png).
- [Menu horizontal corrigido](../artifacts/visual-final/menu-horizontal.png).
- [Ranking com texto a 200% corrigido](../artifacts/visual-final/ranking-texto200.png).
- [Rodapé com texto a 200% corrigido](../artifacts/visual-final/rodape-texto200.png).
- [Painel empresarial em 320px](../artifacts/visual-final/empresa-320.png).

As demais capturas geradas pela suíte ficam em `test-results/` (diretório já ignorado pelo repositório).

## Preservação funcional e limitações

Os testes de cadastro, confirmação/recuperação de e-mail, onboarding, login, troca de senha, exportação, criação/edição, privacidade/abertura de indicações, resolução, pontos, ranking, notificações, preferências, fotos, empresas e permissões passaram. Não houve alteração de contratos, migrations, APIs, actions, dados persistentes do usuário, rotas, textos legais ou dependências. As únicas mudanças nas páginas de negócio são composição do menu, primitivas visuais e classes/tamanhos de apresentação.

Não há pendência conhecida das correções P1/P2 aplicáveis nem regressão funcional conhecida causada pela implementação. Dimensões e sombras específicas com responsabilidades próprias foram preservadas, conforme a especificação.

Limites da validação: Chromium com emulação de toque, zoom e movimento; não houve uso de leitor de tela, teclado virtual de aparelho físico ou teste de todas as combinações de browser/OS. O fallback de erro foi validado por renderização do componente real, testes de composição com/sem shell e navegação pelo skip link; não se provocou falha deliberada de banco para exercitar o boundary em produção. A ligação original `onClick={reset}` foi preservada. Integrações pagas/externas foram verificadas pelas suítes e fixtures locais, sem chamadas reais a Google Places ou SMTP de produção. Os resultados automatizados não constituem declaração de conformidade WCAG completa.

