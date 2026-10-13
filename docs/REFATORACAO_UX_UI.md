# GoIndica — experiência mobile, 13 de outubro de 2026

## Auditoria antes da implementação

Leitura: README, especificação mestre (60 seções), arquitetura, análise do sistema, decisões visuais, descoberta comunitária, layouts, todas as rotas e componentes de frontend, CSS, manifest/service worker e suítes de navegador. Baseline de produção compilado após `npm ci`; screenshot do feed em 390 × 844 em `/tmp/goindica-review/before-feed.png`.

1. **Navegação escondida:** sete destinos no menu superior competem com perfil/notificações. Trocar por quatro destinos persistentes (Início, Atividades, Ranking, Perfil); salvos e configurações ficam no perfil e na lateral desktop.
2. **Painel dentro da janela:** `100dvh`, overflow oculto e rolagem interna cortam conteúdo, desperdiçam largura e criam dificuldade com teclado, autocomplete e foco. Usar rolagem natural e barras com compensação de espaço e safe areas.
3. **Busca ocupa quase toda a primeira tela:** título, botão, descrição, cidade repetida e formulário vertical afastam os pedidos. Uma busca principal, cidade como controle de expansão, filtros curtos e publicação acessível.
4. **Hierarquia do pedido:** título enorme, ações secundárias e área ilustrativa competem com indicar/revelar/confirmar. Cabeçalho contextual, opções secundárias recolhidas, jornada explícita e contexto compacto no mobile.
5. **Perfil mistura identidade e manutenção:** estatísticas quebram, links soltos e edição sempre aberta. Identidade + reputação, menu em linhas e edição expansível.
6. **Estados e listas:** caixas verdes excessivas, letras pequenas e títulos promocionais. Listas com divisórias, vazios simples com próximo passo, estado textual, skeletons de conteúdo e erros próximos da ação.
7. **Desktop determinado pelo painel:** largura fixa sem composição funcional. Navegação lateral, coluna de leitura, apoio contextual no feed e no detalhe. Tablet usa rail.

## Processo e skills

`impeccable` não instalada: busca sem resultados em `/home/metabit/.agents` e `/home/metabit/.codex` (incluindo plugins). Não foi instalado pacote externo em seu nome. Aplicadas frontend-design, design-systems-frontend-architecture e ui-ux-pro-max: inventário → auditoria/crítica → direção → construção → screenshots/polimento. A consulta de design system retornou estilos de landing/rede social e paletas alheias à marca; foram rejeitados por inadequação ao produto. Aplicadas recomendações verificadas de navegação, foco, teclado e toque.

Referências: [Apple HIG — Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars), [Material 3 — App bars](https://m3.material.io/components/app-bars/), [Material 3 — layout adaptativo](https://m3.material.io/foundations/layout/canonical-examples/overview). Instagram informa a separação identidade/conteúdo; Airbnb, descoberta antes da publicação; WhatsApp, clareza e economia das interações. Nenhum desenho foi copiado.

## Direção: a cidade em conversa

O elemento característico é a pergunta, com o símbolo de conversa da marca e o percurso **Procurar → Receber indicações → Confirmar**. Evitar mural de cards, estatísticas de dashboard e decoração sem função. Sem categorias, estrelas, seguidores, estoque ou recompensas novas.

- Fundo branco no mobile; canvas neutro no desktop. Verde original `#347d25` para ação e confirmação; azul `#0252dc` para atenção e descoberta. Texto quase preto neutro, sem tingir toda a interface de verde.
- Inter variável local; corpo 16 px; auxiliares 12–14 px; títulos mobile 24–28 px. Espaçamentos semânticos sobre escala de 4 px. Controles 48 px, ícones de navegação 22 px, traço consistente.
- Quatro destinos na barra inferior até 767 px; rail entre 768 e 1199; lateral com rótulos a partir de 1200. Publicação é ação, não aba. Criação/edição/indicação e configurações usam voltar contextual e não a barra inferior.
- Documento rola; header sticky e bottom nav fixed com espaço reservado; `viewport-fit=cover`, `100svh` e insets nos quatro lados. Campos de 16 px evitam zoom de foco no iOS. Sem bloquear zoom ou gestos do navegador.
- Busca por GET preserva deep links e filtros. Cidade muda pelo autocomplete existente; opções secundárias em disclosure nativo. CTA de novo pedido usa submissão GET nativa para conservar cidade e termo, inclusive ao digitar antes da hidratação.
- Perfil com métricas em grade, linhas navegáveis, edição em disclosure. Salvos com abas; notificações em lista; preferências agrupadas sem cards decorativos.
- Touch feedback discreto, foco visível, redução de movimento, estado anunciado e botões com nomes acessíveis. CSS nos módulos existentes, removendo regras do painel e do menu antigos.

## Contratos e preservação

`AppChrome`: composição responsiva/contextual, recebe slots do servidor, nunca decide autorização. `FeedSearch`: termo + cidade expandida, mesma ação GET. `RequestCard`: pergunta + localização + contagem, sem revelar respostas privadas. `RequestJourney`: estado derivado do status existente, sem nova regra. `PageHeading`, `Empty`, `Status`, `Avatar`, `ActionForm`: padrões comuns de hierarquia e feedback.

Actions, APIs, RPCs, RLS, autenticação, Places, ledger, paginação, rascunhos, upload, moderação e exportação permanecem preservados. PWA conserva cache exclusivamente da página offline neutra. O harness foi corrigido para caminhos com espaços via URL de arquivo no preload de teste.

## Validação

Registrar resultados e limitações reais em `docs/VERIFICACAO_UX_UI.md`. Testes antigos que impunham painel fixo/menu hamburguer devem verificar a nova experiência; testes das regras de produto permanecem.
