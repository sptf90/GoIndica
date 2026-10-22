# PROMPT DE IMPLEMENTAÇÃO — CORREÇÃO E PADRONIZAÇÃO VISUAL DO G O I N D I C A

## 1. Contexto técnico e objetivo

Atue como um **Senior UI/UX Engineer, Design System Architect, Frontend Specialist e Accessibility Engineer**.

Sua missão é executar uma correção sistêmica e controlada das inconsistências visuais, de layout, responsividade e acessibilidade identificadas no GoIndica, preservando a identidade visual, as funcionalidades e os fluxos existentes.

**Repositório:** https://github.com/sptf90/GoIndica

**Referência da análise:** branch `main`, commit `20d8d0c57432991276d134cdd39045d18ebeb255`, de 22 de outubro de 2026.

O endereço inicialmente informado, `sptf90/GoIndica-`, retornou 404. O repositório acessível e examinado pertence ao mesmo proprietário e utiliza o nome `GoIndica`, sem hífen final. Confirme essa correspondência antes de implementar.

### Stack identificada

- Next.js 16 com App Router.
- React 19 e TypeScript.
- CSS modularizado por responsabilidade, com design tokens em CSS custom properties.
- Fonte Inter Variable, distribuída por `@fontsource-variable/inter`.
- Lucide React para iconografia.
- Motion para animações.
- `cmdk` para a paleta de comandos.
- Playwright para testes E2E e revisão de layouts.
- Vitest para testes automatizados.
- ESLint com `eslint-plugin-jsx-a11y`.

### Estado atual e limites da auditoria

A análise estática identificou a estrutura do repositório, as rotas de interface, os estilos globais, os componentes visuais e os testes de responsividade existentes.

**Não houve execução da aplicação, captura de telas atuais ou validação visual em navegador.** Portanto:

1. Trate os problemas explicitamente demonstrados pelo código como correções fundamentadas.
2. Trate possíveis quebras de layout, sobreposições e problemas dependentes de renderização como hipóteses que precisam ser reproduzidas antes de qualquer correção.
3. Não suponha que testes existentes estejam passando apenas porque estão implementados.
4. Não faça alterações baseadas exclusivamente em preferência estética.
5. Não amplie o escopo para redesign, reestruturação de arquitetura ou mudanças de regras de negócio.

O resultado esperado é uma aplicação visualmente consistente, acessível, responsiva e funcionalmente equivalente à versão original.

---

## 2. Regras inegociáveis

### 2.1. Preservação funcional

Preserve integralmente:

- Autenticação, cadastro, recuperação de senha e onboarding.
- Criação, edição, indicação, acompanhamento e resolução de pedidos.
- Privacidade das indicações antes da abertura pelo solicitante.
- Ranking, reputação, pontos e confirmações.
- Perfis, preferências, notificações e atividades.
- Funcionalidades administrativas e empresariais.
- Integrações com banco de dados, serviços externos e Google Places.
- URLs, parâmetros de navegação, autenticação e permissões.
- Regras de validação, mensagens e consequências das operações.

Não altere migrations, APIs, contratos de dados, lógica de negócio, serviços ou mecanismos de autenticação para resolver problemas puramente visuais.

### 2.2. Identidade visual

**É proibido substituir arbitrariamente a identidade visual atual.**

Preserve o conceito visual existente:

- Laranja característico da marca.
- Superfícies claras em tonalidade de papel.
- Tipografia Inter Variable.
- Cantos arredondados moderados.
- Bordas suaves como principal elemento de separação.
- Sombras discretas.
- Layout mobile-first.
- Navegação inferior móvel e sidebar em desktop.
- Iconografia Lucide.
- Linguagem visual baseada em simplicidade, confiança e colaboração comunitária.

Não introduza uma estética genérica de dashboard, novos gradientes, efeitos glassmorphism ou cores sem relação com o Design System atual.

### 2.3. Política de implementação

- Reutilize componentes existentes antes de criar novos.
- Não adicione dependências para resolver problemas cobertos por React, HTML e CSS.
- Evite `!important`, estilos inline para constantes visuais e seletores excessivamente específicos.
- Não converta toda a aplicação para Tailwind, CSS Modules ou outra arquitetura de estilo.
- Preserve a organização existente das folhas CSS.
- Realize mudanças pequenas, verificáveis e organizadas por responsabilidade.
- Não remova animações ou padrões visuais válidos sem demonstrar necessidade.
- Não introduza dark mode, pois não foi identificado um contrato existente que exija sua implementação.

---

## 3. Design System a preservar e consolidar

### 3.1. Fonte de verdade

O arquivo principal é:

`src/app/styles/foundation.css`

Ele define os tokens de cores, tipografia, espaçamento, raios, dimensões, sombras e animações.

As demais folhas de estilo devem consumir esses tokens conforme suas responsabilidades:

| Arquivo | Responsabilidade |
|---|---|
| `foundation.css` | Tokens, estilos globais e primitivas |
| `public.css` | Landing page e autenticação |
| `application.css` | Shell autenticado, navegação, feed e formulários |
| `components.css` | Componentes de tarefas e interfaces compartilhadas |
| `community.css` | Comunidade, notificações e preferências |
| `discovery.css` | Fotos e descoberta de locais |
| `company.css` | Cadastro e painel empresarial |
| `responsive.css` | Adaptações responsivas |

A ordem de importação em `src/app/globals.css` deve continuar previsível.

### 3.2. Paleta existente

Preserve inicialmente estes tokens:

| Token | Valor atual |
|---|---|
| `--brand-orange` | `#ec5e27` |
| `--brand-white` | `#fdfdf1` |
| `--orange-strong` | `#b54115` |
| `--orange-dark` | `#92330f` |
| `--surface-subtle` | `#f6f2e7` |
| `--ink` | `#29231f` |
| `--ink-soft` | `#6c6158` |
| `--line` | `#e6ddcf` |
| `--line-strong` | `#bfb09f` |
| `--danger` | `#a12732` |

Não substitua a paleta inteira.

Utilize os tokens semânticos existentes para determinar as cores dos componentes e corrija apenas combinações que não atendam aos requisitos de contraste ou aos papéis semânticos definidos.

### 3.3. Tipografia

Mantenha a escala existente:

- `--text-xs`: 12px.
- `--text-sm`: 13px.
- `--text-md`: 14px.
- `--text-base`: 16px.
- `--text-lg`: 18px.
- `--text-xl`: 20px.
- `--text-2xl`: 24px.
- `--text-3xl`: 28px.
- `--text-title`: escala fluida.
- `--text-display`: escala fluida.

O objetivo não é substituir a escala, mas eliminar divergências sem justificativa e garantir legibilidade quando o texto é ampliado.

Não reduza arbitrariamente o tamanho de textos para fazer componentes caberem na tela. Priorize reflow, quebra de linha e adaptação estrutural.

### 3.4. Espaçamento e dimensões

Preserve o grid de espaçamento em múltiplos de 4px:

`--space-1`, `--space-2`, `--space-3`, `--space-4`, `--space-5`, `--space-6`, `--space-8`, `--space-10`, `--space-12`, `--space-16` e `--space-20`.

Utilize os tokens de raios existentes:

- `--radius-sm`: 8px.
- `--radius-md`: 10px.
- `--radius-lg`: 14px.
- `--radius-xl`: 20px.
- `--radius-pill`: 999px.

Preserve os tokens de sombras e de movimento, evitando valores independentes que representem exatamente o mesmo padrão.

---

## 4. Correções prioritárias comprovadas pelo código

### P1-01 — Corrigir o foco visual da paleta de comandos

**Arquivos:**

- `src/app/styles/application.css`
- `src/app/styles/components.css`
- `src/app/styles/foundation.css`
- `src/components/command-palette.tsx`

**Evidência:**

Em `application.css`, aproximadamente linhas 948–953, a regra `input:focus` utiliza `outline: none` e substitui o contorno por borda e sombra.

Em `components.css`, aproximadamente linhas 1267–1278, o campo da paleta de comandos elimina a borda e também desativa sua sombra de foco.

Como a regra `input:focus` possui maior especificidade que a regra global `:focus-visible`, o contorno global não é preservado nesse campo.

**Correção:**

1. Criar um tratamento de foco visível específico para o campo da paleta, utilizando `:focus-visible` ou `:focus-within` no contêiner `.command-search`.
2. Preservar o layout atual do diálogo.
3. Utilizar o laranja de foco já definido no Design System.
4. Garantir que o indicador visual não dependa exclusivamente de uma alteração sutil de cor.
5. Evitar contornos duplicados.
6. Revisar os demais campos afetados pela regra global `input:focus`, mantendo um indicador suficientemente perceptível em cada um.
7. Manter o comportamento atual de abertura por `Ctrl+K` e `Cmd+K`, fechamento com Escape e navegação por teclado.

**Critérios de aceitação:**

- O foco na busca da paleta é claramente identificável.
- Todos os elementos interativos do diálogo possuem indicação de foco apropriada.
- O diálogo continua acessível exclusivamente pelo teclado.
- O foco retorna adequadamente ao acionador após o fechamento.
- Não há alteração indevida das dimensões do campo ao receber foco.

**Referências WCAG 2.2:** 2.1.1, 2.4.7 e 2.4.11.

### P1-02 — Corrigir o contrato de interação do menu de conta

**Arquivos:**

- `src/app/(member)/layout.tsx`
- `src/app/styles/application.css`
- `src/components/app-chrome.tsx`
- `tests/e2e/account-menu.spec.ts`

**Evidência:**

O acionador `.profile-link`, em `src/app/(member)/layout.tsx`, é um link de navegação para `/perfil`, mas possui `aria-haspopup="true"`.

O `.account-popover` é apresentado por CSS mediante `:hover` ou `:focus-within`, aproximadamente nas linhas 1047–1116 de `application.css`.

Existe, portanto, uma divergência entre a semântica de abertura de popup e a ação principal do elemento, que navega para outra página.

**Correção:**

1. Separar claramente a ação de navegar ao perfil da ação de abrir o menu, caso o popup continue sendo necessário.
2. Para o acionador do popup, utilizar um botão semântico com estado `aria-expanded` e associação ao conteúdo controlado.
3. Preservar o acesso direto a `/perfil`.
4. Permitir abertura e fechamento com teclado, mouse e toque.
5. Manter o comportamento de hover somente como conveniência, não como único mecanismo de acesso.
6. Garantir que links e botões ocultos não participem indevidamente da navegação por teclado.
7. Não bloquear a interação ao mover o ponteiro do acionador para o popup.
8. Verificar o posicionamento do menu na sidebar compacta de 76px e na sidebar expandida de 248px.
9. Preservar as ações existentes de perfil e logout.

Prefira estado local em React e comportamento semântico nativo. Não introduza uma biblioteca de menus.

**Critérios de aceitação:**

- O menu abre e fecha por teclado, clique e toque.
- Escape fecha o popup e retorna o foco ao acionador, quando apropriado.
- O usuário consegue acessar o perfil e sair da conta.
- Não há elementos do popup sobrepostos ou cortados.
- O comportamento é consistente nas resoluções de 768px, 1024px, 1200px e 1440px.
- O teste E2E existente continua passando, com atualização das expectativas quando o novo contrato acessível justificar a mudança.

### P1-03 — Corrigir contraste insuficiente do status de indicações abertas

**Arquivos:**

- `src/app/styles/application.css`
- `src/app/styles/foundation.css`
- `src/components/ui.tsx`

**Evidência:**

A classe `.status-revealed`, aproximadamente linhas 527–530 de `application.css`, utiliza:

- Texto: `--orange-strong`, `#b54115`.
- Fundo: `--orange-tint`, `#f9dfcf`.

A relação calculada de contraste é de aproximadamente **4,42:1**, inferior ao mínimo de 4,5:1 exigido para texto normal pela WCAG AA.

**Correção:**

1. Preservar o fundo e a identidade visual do status.
2. Alterar preferencialmente a cor textual desse estado para `--orange-dark`, já existente, desde que o contraste resultante seja validado.
3. Não modificar o laranja principal da marca para resolver este caso isolado.
4. Conferir também as variantes `OPEN`, `RESOLVED`, `CLOSED_NO_RESULT` e `CANCELED`.
5. Manter os rótulos textuais existentes, sem depender apenas de cor para comunicar o estado.

**Critérios de aceitação:**

- Todos os status com texto normal atingem contraste mínimo de 4,5:1.
- As diferentes situações continuam compreensíveis sem percepção de cor.
- As variantes permanecem visualmente integradas à paleta atual.
- Não surgem regressões de contraste em hover ou outros estados.

**Referência WCAG 2.2:** 1.4.3.

### P1-04 — Corrigir estrutura semântica e skip link da página de erro

**Arquivos:**

- `src/app/error.tsx`
- `src/app/layout.tsx`
- `src/app/styles/components.css`

**Evidência:**

O layout principal declara um link para `#conteudo`.

Entretanto, `src/app/error.tsx`, linhas 4–12, renderiza uma `<div className="wrap error-page">` sem o destino `id="conteudo"` e sem landmark principal explícito.

**Correção:**

1. Garantir que a página de erro possua um destino válido para o skip link.
2. Utilizar uma estrutura semântica apropriada para o conteúdo principal, sem criar landmarks principais duplicados quando renderizada dentro de um layout que já contém `<main>`.
3. Manter o botão de recuperação `Tentar novamente`.
4. Preservar o componente de apresentação `.error-page`.
5. Conferir o mesmo contrato na rota de página não encontrada.

**Critérios de aceitação:**

- O link “Pular para o conteúdo” possui destino válido.
- O conteúdo da página de erro é navegável por teclado.
- A hierarquia semântica é apropriada ao layout que hospeda o erro.
- A ação de tentar novamente continua funcional.

---

## 5. Padronização e manutenção do Design System

### P2-01 — Eliminar definição duplicada da grid de detalhes

**Arquivo:** `src/app/styles/components.css`

**Evidência:**

Dentro do breakpoint de largura mínima de 1024px, aproximadamente nas linhas 919–926, `.detail-grid` é declarada duas vezes consecutivamente:

- Primeiro com coluna lateral de 260px.
- Depois com coluna lateral de 300px.

A segunda declaração substitui a largura definida pela primeira.

**Correção:**

1. Manter uma única declaração efetiva de `grid-template-columns` nesse breakpoint.
2. Preservar inicialmente a largura efetiva atual de 300px.
3. Confirmar o comportamento da coluna de conteúdo e de `.request-context`.
4. Verificar se a proporção permanece adequada em 1024px, 1280px e 1440px.
5. Somente introduzir outra largura de sidebar se houver evidência visual que justifique um breakpoint adicional.

**Aceitação:** uma única regra controla o mesmo layout em cada faixa responsiva, e o painel de contexto permanece ao lado do conteúdo apenas quando há espaço suficiente.

### P2-02 — Reduzir dependência de `!important` nas imagens de perfil

**Arquivos:**

- `src/app/styles/responsive.css`
- `src/app/styles/components.css`
- `src/components/ui.tsx`
- `src/app/(member)/perfil/page.tsx`
- `src/app/(member)/ranking/page.tsx`

**Evidência:**

`responsive.css`, aproximadamente linhas 242–255, força os tamanhos de `.ranking-row .avatar` e `.profile-heading > .avatar` usando `!important`.

O componente `Avatar` também permite definir dimensões por propriedades inline.

**Correção:**

1. Definir uma estratégia única de tamanho de avatar.
2. Preservar as dimensões visuais atualmente pretendidas para ranking, cabeçalho de perfil e listas.
3. Preferir variantes explícitas do componente ou CSS custom properties controladas pelo componente.
4. Remover os `!important` específicos de dimensão quando o novo contrato permitir.
5. Garantir que avatares com foto e avatares por iniciais sigam exatamente as mesmas dimensões.
6. Preservar o formato circular e `object-fit: cover`.

Não remova automaticamente todos os `!important` do projeto: as regras relacionadas a `prefers-reduced-motion` devem ser avaliadas separadamente.

**Aceitação:** avatares mantêm tamanho e alinhamento coerentes em dispositivos móveis e desktop, sem depender de conflito entre propriedades inline e CSS.

### P2-03 — Consolidar padrões de controles compactos

**Arquivos:**

- `src/app/styles/foundation.css`
- `src/app/styles/application.css`
- `src/app/styles/components.css`
- `src/components/action-form.tsx`

**Evidência:**

O projeto define:

- `--touch-target: 44px`.
- `--control-sm: 40px` em dispositivos menores.
- `--control-sm: 36px` a partir de 768px.

Alguns controles compactos, links da sidebar e ações de menus utilizam alturas menores que a referência interna de 44px.

**Correção:**

1. Diferenciar dimensão visual do controle e área interativa efetiva.
2. Preservar a densidade das interfaces administrativas.
3. Sempre que possível, oferecer área interativa de pelo menos 44 × 44px.
4. Se uma área menor for mantida por necessidade comprovada, verificar individualmente o requisito mínimo de 24 × 24px da WCAG 2.2, considerando suas exceções.
5. Centralizar variantes compactas na base compartilhada `.button`, evitando alturas independentes em diferentes páginas.
6. Validar espaçamento entre controles adjacentes para evitar acionamentos acidentais.

**Aceitação:** botões equivalentes possuem dimensões previsíveis, sem aumentar desnecessariamente a densidade dos painéis.

### P2-04 — Consolidar valores recorrentes de estilo

**Arquivos:** todas as folhas em `src/app/styles/`.

**Evidência:**

Embora os tokens sejam amplamente utilizados, permanecem valores isolados, incluindo exemplos como:

- `gap: 6px` em diferentes componentes.
- Dimensões específicas de elementos interativos.
- Sombras declaradas diretamente em componentes que possuem tokens de sombra disponíveis.
- Larguras de colunas e containers usadas em layouts especializados.

**Correção:**

1. Procurar valores repetidos que representam a mesma decisão visual.
2. Substituir repetições semânticas por tokens existentes.
3. Criar novos tokens apenas quando a mesma decisão realmente for compartilhada.
4. Manter dimensões específicas quando representarem requisitos próprios de um componente.
5. Não trocar automaticamente todo valor em pixels por variável.
6. Evitar transformar o Design System em um conjunto excessivo de tokens sem significado.

Dê prioridade a alturas, espaçamentos e sombras realmente compartilhados entre botões, campos, cards, menus e painéis.

**Aceitação:** componentes equivalentes compartilham regras sem perder suas diferenças funcionais legítimas.

---

## 6. Correções por área da aplicação

### 6.1. Landing page e páginas públicas

**Arquivos:**

- `src/app/(public)/page.tsx`
- `src/app/(public)/layout.tsx`
- `src/app/styles/public.css`
- `src/app/styles/responsive.css`

Preserve a estrutura atual da landing page:

1. Hero de apresentação.
2. Demonstração ilustrativa.
3. Etapas de funcionamento.
4. Conhecimento compartilhado.
5. Prévia do ranking.
6. Chamada final para ação.

**Implementação:**

- Preservar a hierarquia visual que diferencia o hero das seções informativas.
- Validar a composição em duas colunas no desktop e em uma coluna no mobile.
- Confirmar que a quebra de linha do título não provoca overflow.
- Verificar que as chamadas para ação permanecem visíveis e acionáveis.
- Manter as informações de demonstração identificadas como ilustrativas.
- Preservar a navegação e os links do rodapé.
- Validar os textos de diferentes comprimentos sem truncamento indevido.
- Verificar o reflow quando o texto é ampliado até 200%.

Não alterar cores, textos de marketing ou composições que não apresentem falhas demonstradas.

**Critérios:** nenhuma rolagem horizontal da página, links acessíveis, conteúdo legível e hierarquia preservada.

### 6.2. Autenticação e onboarding

**Arquivos:**

- `src/app/(public)/entrar/page.tsx`
- `src/app/(public)/cadastro/page.tsx`
- `src/app/(public)/recuperar-senha/page.tsx`
- `src/app/(public)/nova-senha/page.tsx`
- `src/app/onboarding/page.tsx`
- `src/components/auth-fields.tsx`
- `src/components/password-input.tsx`
- `src/components/profile-form.tsx`
- `src/components/profile-fields.tsx`
- `src/components/action-form.tsx`

**Implementação:**

1. Preservar o container de autenticação com largura máxima de 480px.
2. Manter a apresentação simplificada no mobile, já prevista no CSS.
3. Padronizar as alturas, os alinhamentos e os estados dos campos.
4. Garantir que os botões de mostrar e ocultar senha tenham foco visível e rótulos acessíveis.
5. Preservar mensagens de erro e sucesso já implementadas.
6. Conferir o comportamento de textos longos, e-mails e mensagens de validação.
7. Verificar o preenchimento automático e o uso de teclado virtual.
8. Garantir que o formulário não fique oculto por interfaces fixas.
9. Preservar o seletor entre cadastro pessoal e empresarial e seu estado atual.
10. Manter a navegação entre login, cadastro e recuperação de senha.

**Critérios:** todos os campos permanecem identificáveis e utilizáveis em 320px, 375px, 390px, 430px e desktop. Nenhuma mudança visual altera o comportamento de autenticação.

### 6.3. Shell, sidebar e navegação principal

**Arquivos:**

- `src/components/app-chrome.tsx`
- `src/components/navigation.tsx`
- `src/components/community-status.tsx`
- `src/app/styles/application.css`
- `src/app/styles/responsive.css`

**Implementação:**

1. Preservar a navegação inferior com quatro destinos no mobile.
2. Preservar a sidebar compacta entre 768px e 1199px.
3. Preservar a sidebar expandida a partir de 1200px.
4. Corrigir o menu de conta conforme P1-02.
5. Verificar que indicadores ativos não dependam exclusivamente de cor.
6. Confirmar que os ícones e rótulos da navegação inferior continuem compreensíveis.
7. Preservar o espaço inferior reservado para a navegação fixa.
8. Validar a interação da navegação com o teclado virtual.
9. Verificar que o cabeçalho sticky não esconda o foco ou o título da seção.
10. Manter a navegação contextual nas páginas de criação, edição e preferências.

**Critérios:** navegação utilizável em todos os breakpoints, sem perda de conteúdo ou de acesso às ações principais.

### 6.4. Feed e listagens de pedidos

**Arquivos:**

- `src/app/(member)/app/page.tsx`
- `src/components/feed-search.tsx`
- `src/components/request-card.tsx`
- `src/components/scrollable-tabs.tsx`
- `src/app/styles/application.css`

**Implementação:**

- Preservar a hierarquia entre busca, filtros, ação de criar pedido e lista.
- Manter os cards de pedidos baseados em `.request-row`.
- Garantir que status, descrição, localização e quantidade de indicações possam ser interpretados rapidamente.
- Preservar a interação existente dos links nos cards.
- Manter as abas horizontalmente navegáveis quando não couberem na tela.
- Verificar o posicionamento da aba ativa após troca de filtros e redimensionamento.
- Confirmar que a ação móvel de criar pedido não cubra resultados ou controles.
- Manter os estados vazios e skeletons já existentes.
- Testar textos extensos em descrições, bairros e cidades.

Se houver truncamento ou sobreposição comprovados, prefira `min-width: 0`, quebra de linha e reorganização flexível ao uso de larguras rígidas.

**Critérios:** busca, filtros, cards e paginação continuam funcionais e não produzem overflow horizontal.

### 6.5. Detalhamento de pedidos

**Arquivos:**

- `src/app/(member)/pedidos/[id]/page.tsx`
- `src/components/request-journey.tsx`
- `src/components/place-panel.tsx`
- `src/components/share-request.tsx`
- `src/components/ui.tsx`
- `src/app/styles/components.css`
- `src/app/styles/responsive.css`

**Implementação:**

1. Consolidar `.detail-grid` conforme P2-01.
2. Manter a organização atual do cabeçalho, status, autor e metadados.
3. Preservar o painel lateral de contexto em desktop e seu reposicionamento abaixo do conteúdo em telas estreitas.
4. Conferir o comportamento sticky do painel quando a altura da viewport é reduzida.
5. Preservar a distinção visual entre indicação pendente, indicações abertas e pedido concluído.
6. Verificar que os controles de compartilhar, editar e opções não se sobreponham.
7. Manter intacto o fluxo de abrir indicações e confirmar o resultado.
8. Garantir que comentários, nomes de estabelecimentos e mensagens longas sejam quebrados corretamente.
9. Verificar que o popup de compartilhamento manual permaneça visível e acessível.
10. Não revelar informações que as regras atuais do produto mantêm privadas.

**Critérios:** detalhamento legível em mobile e desktop, sem mudanças nas transições de estado do pedido.

### 6.6. Indicador de etapas do pedido

**Arquivos:**

- `src/components/request-journey.tsx`
- `src/app/styles/components.css`
- `src/app/styles/responsive.css`

**Evidência:**

Abaixo de 360px, `responsive.css`, aproximadamente linhas 303–305, reduz os rótulos de `.request-journey li` para 10px.

**Correção:**

1. Avaliar o comportamento dos três estágios em 320px.
2. Evitar depender de fonte de 10px como solução de encaixe.
3. Se a ampliação tipográfica causar quebra, permitir distribuição em múltiplas linhas ou uma apresentação mais compacta dos indicadores.
4. Preservar a ordem e a semântica das etapas.
5. Não alterar a lógica que determina a etapa atual.

**Critérios:** indicadores continuam compreensíveis em 320px e com texto ampliado, sem colisões.

### 6.7. Criação, edição e indicação

**Arquivos:**

- `src/app/(member)/pedidos/novo/page.tsx`
- `src/app/(member)/pedidos/[id]/editar/page.tsx`
- `src/app/(member)/pedidos/[id]/indicar/page.tsx`
- `src/components/request-composer.tsx`
- `src/components/place-search.tsx`
- `src/components/city-selector.tsx`
- `src/components/request-photo-field.tsx`

**Implementação:**

- Preservar os formulários e a ordem de preenchimento.
- Garantir alinhamento e altura consistente dos campos.
- Validar a visualização das sugestões de cidade e estabelecimento.
- Não permitir que listas de autocomplete sejam cortadas por navegação fixa ou limites indevidos dos containers.
- Preservar a navegação por setas, Enter e Escape.
- Manter as mensagens de status e erro acessíveis.
- Preservar a apresentação do local selecionado.
- Verificar a prévia, substituição e remoção de fotos.
- Validar os formulários com conteúdo no limite máximo permitido.
- Manter o comportamento de rascunhos e os botões de ação existentes.

**Critérios:** nenhuma alteração de layout prejudica a seleção de locais, o envio de dados ou o retorno após erro.

### 6.8. Ranking e perfis

**Arquivos:**

- `src/app/(member)/ranking/page.tsx`
- `src/app/(member)/perfil/page.tsx`
- `src/app/(member)/perfil/[username]/page.tsx`
- `src/components/profile-menu.tsx`
- `src/components/ui.tsx`
- `src/app/styles/components.css`
- `src/app/styles/responsive.css`

**Implementação:**

1. Corrigir o contrato de tamanhos dos avatares conforme P2-02.
2. Preservar o ranking em linhas com posição, avatar, nome e pontos.
3. Validar alinhamento das colunas quando os nomes são longos.
4. Evitar que números extensos de pontos comprimam ou sobreponham os nomes.
5. Preservar a hierarquia de estatísticas e reconhecimento dos perfis.
6. Manter a edição de perfil por meio do componente existente.
7. Garantir alinhamento dos cards de estatísticas em suas diferentes configurações responsivas.
8. Preservar os links de perfil público e a navegação de retorno.

**Critérios:** conteúdos longos permanecem legíveis, pontos são alinhados e avatares compartilham regras consistentes.

### 6.9. Atividades, salvos e notificações

**Arquivos:**

- `src/app/(member)/atividades/page.tsx`
- `src/app/(member)/salvos/page.tsx`
- `src/app/(member)/notificacoes/page.tsx`
- `src/components/request-card.tsx`
- `src/components/page-heading.tsx`
- `src/app/styles/community.css`

**Implementação:**

- Preservar os mesmos padrões de cards, listas e ações equivalentes.
- Conferir que cabeçalhos compartilham alinhamento e ritmo vertical coerentes.
- Manter tabs, paginação e filtros funcionais.
- Verificar que datas e metadados não comprimam as ações.
- Preservar a distinção entre notificações lidas e não lidas.
- Reutilizar os padrões de feedback já definidos.
- Conferir os estados vazios para que continuem compreensíveis e acionáveis.

Não unifique componentes diferentes apenas porque apresentam semelhanças superficiais.

**Critérios:** ações e informações mantêm hierarquia consistente, sem perda de conteúdo em telas estreitas.

### 6.10. Preferências e conta

**Arquivos:**

- `src/app/(member)/preferencias/page.tsx`
- `src/app/(member)/conta/page.tsx`
- `src/components/local-draft-controls.tsx`
- `src/components/page-heading.tsx`
- `src/components/action-form.tsx`
- `src/app/styles/community.css`

**Implementação:**

1. Manter a hierarquia de seções e seus títulos.
2. Padronizar espaçamentos entre grupos de campos e operações.
3. Preservar as mensagens de confirmação e erro.
4. Garantir que ações potencialmente destrutivas sejam diferenciadas de ações comuns.
5. Manter a distinção entre remoção de preferências e encerramento de conta.
6. Preservar os diálogos de confirmação e os fluxos de suporte.
7. Garantir que campos e controles não sejam encobertos pelo teclado virtual.
8. Verificar estados desabilitados e indicação de processamento.

**Critérios:** todos os fluxos atuais continuam reconhecíveis e utilizáveis, inclusive com navegação por teclado.

### 6.11. Administração

**Arquivos:**

- `src/app/(member)/admin/page.tsx`
- `src/app/styles/components.css`
- `src/app/styles/community.css`
- `src/components/scrollable-tabs.tsx`
- `src/components/action-form.tsx`

**Implementação:**

- Preservar todas as áreas administrativas atualmente existentes: denúncias, usuários, pedidos, indicações, recompensas, logs e métricas.
- Manter filtros, paginação, pesquisas e ações de moderação.
- Padronizar os formulários de busca e filtros que possuem a mesma função visual.
- Garantir que campos de pesquisa e seus botões permaneçam alinhados quando compartilharem uma linha.
- Em telas estreitas, utilizar reflow em vez de reduzir indefinidamente as larguras dos campos.
- Verificar que conteúdos longos de logs e valores de métricas não provoquem overflow da página.
- Preservar o overflow interno de conteúdos técnicos quando apropriado.
- Manter mensagens de erro e confirmações claramente diferenciadas.
- Não reestruturar as decisões administrativas nem modificar permissões.

**Critérios:** todas as abas e ações continuam acessíveis e funcionais em mobile e desktop, inclusive com conteúdos extensos.

### 6.12. Área empresarial

**Arquivos:**

- `src/app/empresa/layout.tsx`
- `src/app/empresa/page.tsx`
- `src/components/company-signup.tsx`
- `src/app/styles/company.css`
- `src/app/(public)/cadastro/page.tsx`

**Implementação:**

1. Preservar o formulário de cadastro por CNPJ.
2. Manter o cartão de dados retornados para conferência.
3. Garantir que mensagens de validação permaneçam associadas aos campos.
4. Preservar os estados de estabelecimento e a indicação de conta pendente.
5. Manter o comportamento de grid dos dados empresariais e sua passagem para uma coluna abaixo de 480px.
6. Verificar quebra de linha de nomes empresariais e endereços extensos.
7. Padronizar botões, inputs e áreas de informação com as primitivas existentes.
8. Manter o fluxo de alteração de senha e saída da conta.

**Critérios:** nenhuma informação empresarial é cortada ou sobreposta, e os fluxos continuam intactos.

### 6.13. Páginas legais, erro e ausência de conteúdo

**Arquivos:**

- `src/app/(public)/privacidade/page.tsx`
- `src/app/(public)/termos/page.tsx`
- `src/app/error.tsx`
- `src/app/not-found.tsx`
- `src/app/styles/components.css`

**Implementação:**

- Corrigir a estrutura da página de erro conforme P1-04.
- Preservar o conteúdo e a redação jurídica.
- Manter largura confortável para leitura e hierarquia dos títulos.
- Confirmar que links externos e internos possuem foco visível.
- Garantir reflow em 320px e com texto ampliado.
- Manter as ações de retorno e recuperação.

**Critérios:** leitura confortável, navegação semântica e nenhuma alteração indevida no conteúdo legal.

---

## 7. Estados visuais e interações compartilhadas

Os componentes equivalentes devem obedecer ao mesmo contrato visual, respeitando suas variantes existentes.

| Componente | Contrato de implementação |
|---|---|
| Botão primário | Cor principal da marca, foco visível, hover e disabled |
| Botão secundário | Superfície neutra, borda consistente e foco visível |
| Botão compacto | Densidade preservada e área interativa adequada |
| Input/textarea | Altura e raio compartilhados, rótulo e estados de validação |
| Card | Borda, raio, padding e sombra conforme papel semântico |
| Status | Rótulo textual, contraste e distinção apropriada |
| Lista | Alinhamento, separadores e tratamento de conteúdo longo |
| Popup/dialog | Foco gerenciado, abertura e fechamento acessíveis |
| Estado vazio | Título, explicação e ação quando aplicável |
| Skeleton | Dimensões coerentes com o conteúdo que será apresentado |

**Preserve os recursos positivos já implementados**, como `ActionForm`, `Empty`, `Status`, `Pagination`, `PageHeading`, os skeletons e as mensagens com `role="alert"` ou `role="status"`.

Não substitua essas soluções por implementações independentes em cada página.

---

## 8. Regras responsivas obrigatórias

Utilize os breakpoints existentes como referência, sem criar breakpoints novos desnecessariamente.

Verifique as larguras:

| Largura | Objetivo |
|---|---|
| 320px | Mobile compacto e reflow |
| 375px | Mobile pequeno |
| 390px | Mobile padrão |
| 430px | Mobile amplo |
| 768px | Início da sidebar compacta |
| 1024px | Tablet horizontal e grid de detalhes |
| 1200px | Transição da sidebar expandida |
| 1280px | Desktop |
| 1440px | Desktop amplo |

Realize verificações adicionais com alturas de 600px e 850px, orientação horizontal, ampliação de texto e zoom.

### Requisitos verificáveis

1. Não deve existir overflow horizontal da página em nenhuma rota testada, exceto rolagem interna intencional de componentes.
2. Textos devem quebrar sem colisão.
3. Controles devem permanecer utilizáveis em diferentes tamanhos de viewport.
4. Menus e popups devem ficar dentro da área visível ou fornecer rolagem adequada.
5. Navegações fixas não podem impedir o acesso ao conteúdo.
6. Elementos sticky não devem ocultar foco, títulos ou controles.
7. Grid e Flexbox devem respeitar larguras mínimas apropriadas.
8. O layout deve suportar textos longos e conteúdos dinâmicos.
9. Respeitar `env(safe-area-inset-*)` onde já utilizado.
10. Evitar unidades rígidas quando comprometerem o reflow.

Não considere uma interface validada apenas porque `scrollWidth <= innerWidth`; também verifique sobreposição, cortes, ordem visual e facilidade de interação.

---

## 9. Acessibilidade — WCAG 2.2 AA

Adote WCAG 2.2 nível AA como referência.

### Contraste

- Texto normal: mínimo de 4,5:1.
- Texto grande: mínimo de 3:1.
- Indicadores visuais relevantes de componentes e estados: contraste não textual de 3:1 quando aplicável.

Calcule as combinações efetivamente utilizadas, incluindo estados hover, focus, disabled e fundos semânticos. Não altere cores que já atendem ao requisito.

### Navegação por teclado

- Todos os controles devem ser acessíveis por teclado.
- O foco deve ser perceptível.
- Modais precisam gerenciar abertura, foco, fechamento e retorno.
- Elementos ocultos não devem permanecer indevidamente na ordem de tabulação.
- Componentes de autocomplete devem manter navegação por teclado consistente.

### Semântica

- Preservar `main`, `header`, `nav`, `section`, `form` e demais elementos apropriados.
- Garantir associação entre campos, labels, erros e descrições.
- Manter hierarquia coerente de títulos.
- Evitar ARIA que descreva um comportamento diferente do real.
- Preservar textos acessíveis para ações compostas apenas por ícones.

### Movimento

O projeto já possui tratamento de `prefers-reduced-motion`, inclusive em CSS e componentes Motion.

Mantenha esse suporte.

Se uma transição transmitir estado, preserve a informação mesmo quando a animação for reduzida.

### Critérios WCAG prioritários

- 1.3.1 — Informações e relações.
- 1.4.3 — Contraste mínimo.
- 1.4.4 — Redimensionamento de texto.
- 1.4.10 — Reflow.
- 1.4.11 — Contraste não textual.
- 2.1.1 — Teclado.
- 2.4.3 — Ordem do foco.
- 2.4.7 — Foco visível.
- 2.4.11 — Foco não obscurecido.
- 2.5.8 — Tamanho do alvo.
- 3.3.1 — Identificação de erro.
- 4.1.2 — Nome, função e valor.

Não declare conformidade WCAG completa apenas por passar em testes automatizados. Inclua verificações manuais com teclado e, quando disponível, leitor de tela.

---

## 10. Ordem obrigatória de execução

### Etapa 0 — Revalidação do repositório

Antes de escrever código:

- Confirmar a branch e o commit atuais.
- Conferir se houve mudanças posteriores à referência desta auditoria.
- Reabrir os arquivos envolvidos.
- Revalidar cada evidência antes de corrigi-la.
- Identificar regras e componentes equivalentes já existentes.
- Capturar a aparência atual das telas, se o ambiente de execução estiver disponível.

Se um problema tiver sido corrigido em commit posterior, não reintroduza uma alteração desnecessária.

### Etapa 1 — Acessibilidade de prioridade alta

Executar:

1. P1-01 — Foco da paleta de comandos.
2. P1-02 — Menu de conta.
3. P1-03 — Contraste do status.
4. P1-04 — Landmark e skip link da página de erro.

Validar cada alteração antes de prosseguir.

### Etapa 2 — Correções estruturais

Executar:

1. P2-01 — Grid duplicada de detalhamento.
2. P2-02 — Tamanhos de avatar.
3. P2-03 — Controles compactos.
4. P2-04 — Tokens recorrentes.

Não realizar refatorações grandes se uma correção localizada na fonte compartilhada resolver o problema.

### Etapa 3 — Validação das áreas funcionais

Revisar e corrigir apenas falhas confirmadas nas seguintes áreas:

1. Landing e autenticação.
2. Navegação e feed.
3. Pedidos e indicações.
4. Ranking, perfis e comunidade.
5. Conta e preferências.
6. Administração.
7. Área empresarial.
8. Páginas legais e de erro.

Para cada correção adicional, documentar internamente arquivo, evidência, impacto e teste correspondente.

### Etapa 4 — Regressão e conclusão

Executar a suíte automatizada, revisar a renderização e confirmar os critérios de aceitação antes de finalizar.

---

## 11. Testes existentes que devem ser preservados

Utilize especialmente:

- `tests/e2e/design.spec.ts`
- `tests/e2e/viewport.spec.ts`
- `tests/e2e/visual-review.spec.ts`
- `tests/e2e/account-menu.spec.ts`
- `tests/e2e/public.spec.ts`
- `tests/e2e/profile.spec.ts`
- `tests/e2e/company.spec.ts`
- `tests/e2e/command-palette.spec.ts`
- `tests/e2e/discovery.spec.ts`
- `tests/e2e/account-flow.spec.ts`

Esses testes já estabelecem contratos importantes de interface, como ausência de overflow horizontal, navegação entre telas, adaptação de grids, layouts com textos extensos e disponibilidade das ações.

Amplie os testes quando necessário para os problemas efetivamente corrigidos.

### Validações automatizadas

Conforme o ambiente permitir, execute:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Utilize apenas ambientes e dados apropriados para teste.

Não execute fluxos que modifiquem dados de produção.

Se algum comando não puder ser executado, registre a limitação e não declare sucesso.

### Testes de interface adicionais

Acrescente cobertura onde for necessária para confirmar:

- Indicador visível de foco na paleta de comandos.
- Abertura do menu de conta por teclado e clique.
- Fechamento do menu por Escape.
- Preservação das ações do menu.
- Contraste das variantes de status.
- Navegação pelo skip link nas páginas de erro.
- Comportamento responsivo do indicador de etapas.
- Alinhamento dos avatares.
- Grid da página de pedidos.
- Componentes compactos em dispositivos móveis.

---

## 12. Critérios de aceitação final

A implementação só deve ser considerada concluída quando os itens abaixo tiverem sido verificados.

### Design System

- [ ] Identidade visual atual preservada.
- [ ] Cores semânticas utilizadas consistentemente.
- [ ] Contrastes relevantes validados.
- [ ] Tipografia e hierarquia preservadas ou corrigidas com justificativa.
- [ ] Espaçamentos compartilhados padronizados.
- [ ] Raios e sombras consistentes com os tokens.
- [ ] Valores duplicados relevantes consolidados.
- [ ] Ausência de novas dependências desnecessárias.

### Componentes

- [ ] Botões equivalentes compartilham padrões.
- [ ] Campos equivalentes compartilham padrões.
- [ ] Avatares possuem dimensões consistentes.
- [ ] Cards não apresentam divergências injustificadas.
- [ ] Status possuem apresentação e contraste apropriados.
- [ ] Menus e diálogos funcionam com teclado, mouse e toque.
- [ ] Mensagens de erro e sucesso permanecem acessíveis.
- [ ] Estados vazios, loading e disabled continuam funcionais.

### Responsividade

- [ ] Validado em 320px.
- [ ] Validado em 375px.
- [ ] Validado em 390px.
- [ ] Validado em 430px.
- [ ] Validado em 768px.
- [ ] Validado em 1024px.
- [ ] Validado em 1200px.
- [ ] Validado em 1280px.
- [ ] Validado em 1440px.
- [ ] Sem overflow horizontal não intencional.
- [ ] Sem elementos sobrepostos ou cortados.
- [ ] Conteúdo acessível acima da navegação fixa.
- [ ] Componentes funcionais com texto ampliado.
- [ ] Popups e autocomplete permanecem acessíveis.

### Acessibilidade

- [ ] Foco visível nos elementos interativos.
- [ ] Navegação por teclado funcional.
- [ ] Sem elementos ocultos indevidamente focáveis.
- [ ] Labels e mensagens de erro corretamente associados.
- [ ] Landmarks e skip links consistentes.
- [ ] Contraste textual AA nos casos aplicáveis.
- [ ] Contraste não textual avaliado.
- [ ] Alvos interativos adequados.
- [ ] Movimento reduzido respeitado.
- [ ] Nenhum novo problema crítico de acessibilidade introduzido.

### Integridade funcional

- [ ] Cadastro e autenticação preservados.
- [ ] Criação e edição de pedidos preservadas.
- [ ] Indicação e confirmação preservadas.
- [ ] Ranking e pontuação preservados.
- [ ] Notificações, atividades e preferências preservadas.
- [ ] Administração preservada.
- [ ] Área empresarial preservada.
- [ ] Integrações externas preservadas.
- [ ] Rotas e parâmetros preservados.
- [ ] Nenhuma modificação indevida em backend ou banco.
- [ ] Testes existentes aprovados ou limitações documentadas.

---

## 13. Formato da entrega da IA implementadora

Após executar as correções, entregue um resumo técnico objetivo contendo:

1. **Arquivos alterados:** caminhos exatos e motivo de cada alteração.
2. **Correções concluídas:** referência às prioridades P1 e P2.
3. **Correções adicionais:** apenas problemas novos demonstrados durante a inspeção renderizada, com respectivas evidências.
4. **Correções não executadas:** motivo e condição necessária para prosseguir.
5. **Validação visual:** viewports e telas efetivamente conferidos, com capturas quando disponíveis.
6. **Validação de acessibilidade:** verificações realizadas e limitações.
7. **Resultado dos testes:** comandos executados e seus resultados reais.
8. **Regressões:** problemas encontrados, corrigidos ou ainda pendentes.

Não declare uma correção concluída sem evidência compatível.

Não classifique hipóteses como problemas confirmados.

Não crie uma nova identidade visual nem reorganize a arquitetura sem necessidade demonstrada.

## DIRETRIZ FINAL

**A meta não é transformar o GoIndica em outro produto. É tornar seu Design System mais consistente, acessível, previsível e sustentável, preservando a experiência já construída.**

Execute primeiro os problemas comprovados, valide seu impacto no navegador e trate cada possível problema adicional como algo a verificar antes de modificar o código.

Conclua somente quando a padronização visual tiver sido validada nas áreas afetadas e não houver regressões funcionais conhecidas provocadas pelas alterações.