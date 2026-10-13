# GoIndica — design system

Atualizado em 13 de outubro de 2026. Auditoria e direção: [REFATORACAO_UX_UI.md](./REFATORACAO_UX_UI.md). A especificação mestre continua governando as regras do produto.

## Identidade e tokens

A marca preserva os dois balões entrelaçados e a logo vetorial em `public/goindica-logo.svg`. Nenhuma fonte externa ou biblioteca de UI foi adicionada.

| Papel                | Token / valor                                            |
| -------------------- | -------------------------------------------------------- |
| Ação / marca         | `--brand-green: #347d25`                                 |
| Atenção / descoberta | `--brand-blue: #0252dc`                                  |
| Texto                | `--ink: #20251f`                                         |
| Texto auxiliar       | `--muted: #646b61`                                       |
| Superfície           | `--surface: #fff`                                        |
| Fundo desktop        | `--canvas: #f5f6f4`                                      |
| Divisória            | `--line: #e3e6df`                                        |
| Confirmação          | `--wash: #eef6eb`                                        |
| Erro                 | `--danger: #a12732`                                      |
| Fonte                | Inter Variable, servida localmente                       |
| Espaçamento          | `--space-1/2/3/4/6/8`: 4/8/12/16/24/32 px                |
| Controle             | `--control-height: 48px`, `--radius-control: 12px`       |
| Conteúdo contextual  | `--radius: 14px`                                         |
| Navegação            | header 60 px, bottom nav 68 px, acrescidos de safe areas |
| Movimento            | `--motion-fast: 160ms`, sem animação em reduced motion   |

Usar tokens semânticos para papéis. Verde não é o fundo padrão: identifica ações e resultados. Azul é pontual. Texto auxiliar deve continuar legível em branco. Não usar gradientes ornamentais ou elevar cada linha com sombra. Sombras apenas em popovers e ação flutuante.

## Navegação e templates

- Até 767 px: conteúdo de largura natural, margens de 20 px (safe area quando maior), quatro destinos inferiores: Início, Atividades, Ranking, Perfil. Novo pedido é uma ação flutuante no feed.
- 768–1199 px: rail de 88 px, destinos com nomes acessíveis e tooltips nativos, coluna de leitura central.
- A partir de 1200 px: lateral de 224 px com rótulos; feed com coluna principal e contexto da comunidade. Detalhe tem coluna de contexto desde 1024 px.
- Formulários focados (`novo`, `editar`, `indicar`, `preferencias`, `conta`): voltar contextual; sem bottom nav. Browser back, deep links e restauração de histórico continuam sob responsabilidade do Next/navegador.
- Documento rola, com espaço reservado no final para barras. Não reintroduzir `height: 100dvh`, `overflow: hidden` ou rolagem de `.app-content`.
- Teclado: visual viewport reduzido oculta a barra flutuante/inferior somente enquanto há um campo focado. Pinch zoom não é tratado como teclado. Autocomplete calcula espaço entre cabeçalho e barra inferior/teclado.

## Contratos dos componentes

| Componente     | Usar para                 | Estados e interação                                                                                                          |
| -------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| AppChrome      | Navegação autenticada     | Slot de notificações e conta do servidor; destino com `aria-current`; voltar é link determinístico                           |
| FeedSearch     | Busca por pedido/cidade   | GET com q/city/status, campo search e submit; cidade em details, autocomplete nacional; erros/retry preservados              |
| RequestCard    | Pedido em listas          | Pergunta, cidade, status, data, contagem; local histórico carrega ao expandir; nunca mostrar respostas privadas              |
| RequestJourney | Percurso do pedido        | Status existente determina etapa; `aria-current=step`; não mostrar jornada completa em cancelado/sem resultado               |
| PageHeading    | Seções e configurações    | h1, descrição curta e ação opcional; não substituir títulos por slogans longos                                               |
| Status         | Estado do pedido          | Texto + indicador, independente da cor; Procurando, Indicações abertas, Encontrado, Não encontrado, Cancelado                |
| Empty          | Ausência de conteúdo      | Ícone simples, título curto, orientação e link para a próxima ação                                                           |
| ActionForm     | Alterações autenticadas   | Pending desabilita submit e marca aria-busy; erro anunciado e foco no campo; sucesso anunciado; valores preservados em falha |
| PasswordInput  | Acesso com senha          | Reveal com button type=button/aria-pressed; não bloqueia paste/autocomplete; valor permanece no input                        |
| ProfileMenu    | Conta, salvos e reputação | Linhas de 56 px; texto/ícone/seta e contador de decisão; administração apenas quando autorizada pelo servidor                |
| Profile editor | Atualização de identidade | Details nativo; edição explícita, formulário e labels preservados                                                            |
| ScrollableTabs | Filtros locais            | Navegação por links/deep links, aba atual visível; scroll horizontal exclusivamente na lista                                 |

Áreas clicáveis principais ≥44 px; inputs ≥48 px e fonte de 16 px. Foco azul visível; labels reais; SVGs decorativos com aria-hidden. Não criar interação dependente de hover. `details` preserva teclado e leitura sem biblioteca. Confirmações definitivas continuam usando o diálogo nativo do navegador e as mesmas mensagens de consequências.

## Organização e evolução

`foundation.css` define tokens/atoms; `public.css` contém landing/acesso; `application.css` contém chrome/feed/autocomplete; `components.css` contém formulários/detalhe/perfil/estados; `community.css` contém atividades de comunidade; `discovery.css` conserva fotos e reconfirmação; `responsive.css` concentra os ajustes finais.

Atualize o módulo proprietário ao alterar um padrão. Não acrescente um arquivo de overrides para esconder estruturas antigas. Novos componentes precisam de propósito recorrente e estados documentados; testar texto longo, 320 px, teclado e zoom. Não introduzir novas regras de reputação para justificar decoração.
