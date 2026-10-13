# GoIndica — verificação da refatoração UX/UI

Executada em 13 de outubro de 2026. Direção e auditoria em [REFATORACAO_UX_UI.md](./REFATORACAO_UX_UI.md); contratos em [PADRAO_VISUAL.md](./PADRAO_VISUAL.md).

## Resultados

| Verificação                                            | Resultado                                                  |
| ------------------------------------------------------ | ---------------------------------------------------------- |
| ESLint, sem warnings                                   | Passou                                                     |
| TypeScript                                             | Passou                                                     |
| Build de produção                                      | Passou                                                     |
| Vitest, unitários e integração com PostgreSQL          | 155 testes passaram, 17 arquivos                           |
| Playwright principal, Chromium                         | 49 testes passaram                                         |
| Android Chrome / iOS WebKit / Firefox / WebKit desktop | 10 testes passaram (2 Android, 2 iOS, 3 Firefox, 3 WebKit) |
| axe-core 4.14.0, mobile e desktop                      | Zero violações em 27 combinações de rota/largura           |
| Revisão visual de screenshots                          | Feed, perfil, pedido, publicação, login, tablet e estados  |

O build informa que há um `package-lock.json` fora deste repositório, em `/home/metabit`. Isso não impediu compilação ou execução; não foi alterada a configuração de produção para resolver uma particularidade desta máquina.

## Cobertura de produto

Os testes exercitam Google OAuth PKCE e onboarding, cadastro/confirmar e-mail em outro navegador, login e recuperação, retorno ao pedido compartilhado, cidade por teclado/toque, rascunho e publicação, foto válida/inválida, indicação com Places, privacidade antes da revelação, revelação e confirmação, recompensa, ranking, histórico, salvos, acompanhamento, notificações, reconfirmação, denúncias, moderação, exportação e encerramento de conta. O teste de PWA verifica manifest e cache exclusivo da página offline neutra. Nenhuma migration, API, RPC, action de negócio ou política RLS foi modificada.

Estados exercitados: listas vazias; requisição de cidades lenta; erro de rede e nova tentativa preservando o texto; indicação/publicação em andamento; sucesso das ações; autenticação inválida; upload inválido; pedido sem respostas, com respostas privadas, revelado e concluído. Confirmações destrutivas nativas existentes foram preservadas.

## Matriz responsiva e acessibilidade

Larguras exigidas: **320, 375, 390, 430, 768, 1024 e 1440 px**. Também mantidas as larguras históricas 414 e 1280 px. A suíte de viewport verifica alturas 600 e 850 px, rolagem do documento, ausência de overflow horizontal, barras/contextos corretos, conteúdo final acessível, autocomplete limitado à área disponível, nomes longos, foco e navegação entre rotas. As jornadas mobile usam toque, presets Pixel 7/iPhone 13 e histórico de navegação nas sete larguras.

O [relatório de acessibilidade](./ux-ui/acessibilidade.json) contém feed, atividades, perfil, salvos, notificações, ranking, preferências, conta, novo pedido, detalhe e edição em 390/1440 px; login, cadastro, recuperação, termos e privacidade em 390 px. Corrigidos níveis de títulos, nomes acessíveis, estado de notificações e legibilidade. A auditoria automática complementa a verificação de teclado e toque; não equivale a homologação com todas as tecnologias assistivas.

## Evidências visuais

As imagens usam somente usuários e dados fictícios do harness. Screenshots de página inteira capturam as barras fixas na posição do primeiro viewport; o conteúdo sob elas continua acessível ao rolar, conforme verificado nos testes.

| Experiência          | Screenshot                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| Antes da refatoração | [Feed mobile original](./ux-ui/antes-feed-390.png)                                                           |
| Feed mobile          | [390 px](./ux-ui/app-390.png)                                                                                |
| Feed desktop         | [1440 px](./ux-ui/app-1440.png)                                                                              |
| iOS compacto         | [320 px](./ux-ui/feed-ios-safari-320.png)                                                                    |
| iOS                  | [390 px](./ux-ui/feed-ios-safari-390.png)                                                                    |
| Tablet               | [768 px](./ux-ui/feed-ios-safari-768.png)                                                                    |
| Android              | [430 px](./ux-ui/feed-android-chrome-430.png)                                                                |
| Perfil               | [Mobile](./ux-ui/perfil-390.png), [desktop](./ux-ui/perfil-1440.png)                                         |
| Detalhe do pedido    | [Mobile](./ux-ui/pedido-390.png), [desktop](./ux-ui/pedido-1440.png)                                         |
| Publicação           | [Mobile](./ux-ui/pedidos-novo-390.png), [desktop](./ux-ui/pedidos-novo-1440.png)                             |
| Login                | [Mobile](./ux-ui/entrar-390.png)                                                                             |
| Ausência de dados    | [Feed](./ux-ui/feed-sem-dados-390.png)                                                                       |
| Carregamento e erro  | [Carregando cidades](./ux-ui/cidade-carregando-390.png), [erro com recuperação](./ux-ui/cidade-erro-390.png) |

## Reprodução e limites

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium firefox webkit
npm run test:e2e
npm run test:e2e:cross
```

O WebKit local deste Linux travou na criação de uma página vazia, antes de acessar o aplicativo. A validação foi realizada com a imagem oficial do Playwright, mantendo a versão do projeto e sem alterar dependências do aplicativo. Para reproduzir neste ambiente, inicie o harness em um terminal e rode os browsers no container em outro:

```bash
npx tsx tests/e2e/start-harness.ts
```

```bash
docker run --rm --network host --ipc=host --user "$(id -u):$(id -g)" \
  -e E2E_BASE_URL=http://localhost:3100 -v "$PWD:/work" -w /work \
  mcr.microsoft.com/playwright:v1.63.0-noble \
  npx playwright test --config playwright.cross-browser.config.ts
```

A injeção de erro de rede nos testes mobile bloqueia service workers para tornar a interceptação determinística no WebKit; a PWA continua habilitada no produto e é testada separadamente. O harness usa PostgreSQL descartável e fixtures de Auth/Google/Places; não envia e-mails reais nem modifica o Supabase hospedado.

Não foram usados aparelhos físicos. Teclado real, barras do sistema, instalação no launcher e gestos próprios do Android/iOS ainda dependem de homologação em hardware. Insets, visual viewport e redução de movimento estão implementados, mas a emulação não substitui essa etapa. Integrações reais e entrega de e-mail também não foram homologadas por esta refatoração.
