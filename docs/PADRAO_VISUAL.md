# Identidade visual do GoIndica

A identidade segue os dois balões entrelaçados da referência [logo-original.png](../logo-original.png), redesenhados em [logo.svg](../logo.svg) em 7 de outubro de 2026. A versão vetorial elimina sombras e diferenças de cor entre símbolo e tipografia; [logo.png](../logo.png) é uma exportação transparente de 4.096 × 990 px. A estrutura de navegação e dos painéis mantém o desenho existente. A especificação `ESPECIFICACAO_MVP_DESCOBERTA_LOCAL.md` permanece como fonte das regras de produto.

## Identidade

| Elemento                | Padrão                                                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Marca                   | GoIndica; logo vetorial servida por `public/goindica-logo.svg`.                                                        |
| Verde principal         | `#347d25`, idêntico no balão verde, em “Indica” e nos botões primários.                                                |
| Verde para leitura      | `#397527` em links, títulos e estados; `#2c5c1e` na interação escura.                                                  |
| Verde-lima              | `#85c808`, reservado a detalhes decorativos da interface; não aparece na logo.                                         |
| Azul secundário         | `#0252dc`, idêntico no balão azul e em “Go”; também usado no favicon e no rótulo da demonstração.                      |
| Texto principal         | `#1c2b18`.                                                                                                             |
| Texto secundário        | `#53624d`.                                                                                                             |
| Fundo da página         | `#f4f7f1`.                                                                                                             |
| Superfícies             | `#ffffff` e `#f0f5eb`.                                                                                                 |
| Superfícies de destaque | `#edf7e7` e `#f5faef`.                                                                                                 |
| Divisórias              | `#dfe7d9` e `#eaf0e5`; bordas de destaque `#d4e7c8`.                                                                   |
| Tipografia              | Inter variável, hospedada localmente pelo pacote `@fontsource-variable/inter`. Títulos em peso 600.                    |
| Cantos                  | 20 px na superfície principal, 16 px nos painéis internos, 10 px nos controles e formato circular nos avatares/status. |
| Espaçamento             | Base de 4 px, com uso recorrente de 8, 12, 16, 24 e 32 px.                                                             |

Os botões primários usam um tom mais sóbrio derivado do verde da marca (`#347d25`), com texto e ícones brancos e contraste de 5,11:1. O texto permanece branco no hover (`#2d6b1f`) e durante o clique (`#245719`). A logo usa exatamente o mesmo verde dos botões. Links e textos pequenos usam o verde `#397527`, com contraste de 5,6:1 em branco. O vermelho continua reservado aos erros.

Os botões secundários têm fundo branco, texto neutro (`#354331`) e borda discreta (`#d0ddc9`). No hover, recebem fundo suave (`#f1f6ed`), texto verde escuro e borda mais definida. Ações discretas usam fundo e borda transparentes, com o mesmo tratamento de hover. Estados desabilitados usam fundo `#edf0e9` e texto `#6b7663`, sem opacidade ou mudança ao passar o mouse. O foco de teclado mantém um contorno verde visível. Os estados são definidos no estilo compartilhado `.button`; variantes alteram variáveis locais, sem sobrescrever as regras de interação. Sugestões de cidades e locais e o botão de menu seguem os mesmos tons neutros e de hover.

Os tokens e os estilos compartilhados estão em `src/app/globals.css`. Novas telas devem usar esses tokens e os componentes existentes. A logo aparece no componente `Brand`, compartilhado por telas públicas, internas e onboarding. O favicon usa os dois balões de conversa em SVG; a imagem Open Graph incorpora a logo vetorial. A tipografia da marca foi convertida em contornos SVG para não depender de fontes instaladas. Ícones funcionais continuam em `src/components/icon.tsx`, com traço de 1,6 px.

## Estrutura

- Cabeçalho branco de 68 px no desktop e 64 px no celular. Navegação central no desktop, perfil à direita e menu expansível no celular. Página atual indicada visualmente e com `aria-current`.
- Telas internas usam o mesmo painel principal: largura máxima de 1.280 px e altura determinada pela janela, sem crescer com o conteúdo. A estrutura `app-shell` ocupa `100dvh`, reserva a linha do cabeçalho e distribui o restante ao painel. Margens superior/inferior de 22 px no desktop e 10 px no celular; espaçamento interno de 24 px no desktop e menor no celular.
- Landing, login, cadastro, recuperação de senha e páginas legais usam o layout público completo, com rolagem natural do documento, cabeçalho e rodapé. Não usam `app-shell` ou `ViewportContent`. Formulários de acesso têm largura máxima de 560 px e altura natural; textos legais têm largura máxima de 740 px.
- Formulários internos têm largura de leitura controlada **dentro** do painel. O onboarding, exibido após autenticação, também usa esse painel. Composição e perfil usam duas colunas a partir de 768 px.
- Feed, atividades, ranking e administração continuam usando listas com divisórias. Painéis adicionais aparecem quando representam uma função específica, como o contexto de um pedido ou um grupo de indicações.
- Inputs e botões de filtro têm 52 px e compartilham a linha do campo, mantendo labels e textos de ajuda separados. Ações compactas do detalhe têm área de interação de pelo menos 44 px no celular.
- Abas rolam horizontalmente quando necessário e mantêm a opção ativa visível. Cidades usam o autocomplete nacional já existente, sem botão de busca.
- Estados vazios usam a ilustração de localização com a paleta verde, sem redução involuntária do tamanho no celular. Erros, carregamento, foco e sucesso continuam sendo comunicados pelos componentes funcionais.
- Avatares sem foto mostram até duas iniciais. As estatísticas de pontos e confirmações do perfil compartilham a mesma linha de base, sem a margem vertical automática entre parágrafos.

## Detalhe do pedido

O detalhe reproduz a hierarquia do protótipo: retorno à cidade, status e data, ferramentas autorizadas, título, município e autor. Indicações e contexto ficam em duas colunas a partir de 1.024 px; abaixo disso, o contexto vem depois das respostas.

A ilustração da área é decorativa e não representa coordenadas reais nem disponibilidade de produtos. O município vem do pedido persistido. Consultas e links reais de estabelecimentos continuam usando Google Places/Maps com atribuição.

As adaptações funcionais seguem a especificação:

- A contagem representa **indicações recebidas**. Estabelecimentos e autores das outras respostas permanecem privados antes da revelação.
- Editar só aparece quando a solicitação é editável. Cancelar mantém confirmação e validação no servidor/banco.
- Revelar encerra o recebimento de novas respostas. O solicitante confirma o estabelecimento por meio do fluxo existente; a interface não fornece um atalho para marcar o pedido como encontrado sem essa decisão.
- Indicações reveladas continuam agrupadas por estabelecimento, com participantes, comentários, denúncia e confirmação. Recompensas e idempotência permanecem no PostgreSQL.
- Compartilhar usa a interface nativa do dispositivo quando disponível. A alternativa copia a URL canônica do pedido; se o clipboard estiver indisponível ou for recusado, mostra um campo para cópia manual. Parâmetros de feedback e paginação são removidos do link. O acesso ao pedido mantém os requisitos de autenticação existentes.
- O autor continua disponível no celular. O documento não rola: conteúdos que excedem o espaço permanecem acessíveis por rolagem interna em `ViewportContent`, com o painel e o cabeçalho fixos. A navegação para outra página/filtro retorna o conteúdo ao início. A densidade é ajustada em janelas baixas, preservando texto legível e controles acessíveis.

## Verificação

Os testes em `tests/e2e/design.spec.ts` verificam a identidade GoIndica, fonte/carregamento, cores, disposição das colunas, tamanho da ilustração, limites da superfície, privacidade e ferramentas permitidas no pedido aberto. Também exercitam menu por mouse/teclado, Escape, clique externo, links e acesso administrativo, além de cópia e alternativa manual de compartilhamento.

As suítes existentes continuam verificando o fluxo completo e a responsividade das demais telas. Larguras: 320, 375, 390, 414, 768, 1.024, 1.280 e 1.440 px. Screenshots são geradas em `test-results/`, incluindo `prototipo-pedido-vazio-*` e `prototipo-menu-*`, para comparação com a referência.

`tests/e2e/viewport.spec.ts` compara posição, largura e altura do painel entre feed, ranking, atividades, perfis, composição, edição e detalhe, nos oito tamanhos e em alturas de 600 e 850 px. Verifica ausência de rolagem do documento, acesso aos controles ao fim de formulários longos, cabeçalho imóvel, navegação ao início e sugestões de cidade dentro do espaço visível. A lista de cidades considera tanto `visualViewport` quanto a área interna do painel.

`tests/e2e/public.spec.ts` verifica que landing, login, cadastro, recuperação e páginas legais têm rolagem natural, rodapé acessível e ausência de overflow horizontal nas oito larguras, com altura de 600 px. As páginas públicas preservam a identidade visual sem o painel fixo das telas internas.

A revisão visual original não exigiu migrations nem alterou regras de pontuação ou validação de estabelecimentos. A dependência de fonte Inter substitui DM Sans e Manrope. O teste visual completo usa Chromium; serviços externos nos E2E ficam isolados, conforme `VERIFICACAO.md`.

Na evolução de 7 de outubro, `globals.css` passou a importar estilos de `src/app/styles`: foundation (tokens/base), application (painel/listas), components, responsive e community (telas novas). A ordem anterior das regras foi preservada. Notificações, salvos, preferências e conta reutilizam o painel, botões e tokens GoIndica. A revisão individual e as migrations dessa evolução estão em `IMPLEMENTACAO_E_REVISAO.md`.
