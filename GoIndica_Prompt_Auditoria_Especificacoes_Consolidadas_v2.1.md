# GOINDICA — PROMPT MESTRE PARA AUDITORIA DO SISTEMA
## Especificação funcional consolidada v2.1 + diagnóstico de compatibilidade + plano de implementação

**Tipo de documento:** instrução executável por uma IA de análise de repositórios (Cursor, agente de programação ou equivalente)  
**Versão desta consolidação:** 2.1 — 31/10/2026 (adendo de cinco decisões complementares pós-auditoria)  
**Idioma obrigatório dos relatórios e documentação produzida:** português do Brasil  
**Produto:** GoIndica — plataforma web responsiva de pedidos e indicações  
**Tarefa solicitada:** analisar o sistema EXISTENTE, comparar com esta especificação e identificar o que já funciona, o que está parcial, o que diverge e o que ainda falta implementar. **NÃO modificar o código nesta execução.**

> **REVISÃO v2.1:** As decisões DEC-06 a DEC-10 foram aprovadas após a auditoria do MVP. Substituem dúvidas anteriores PEN-02, PEN-03 (regra de negócio), PEN-04 e parte de PEN-05/PEN-07. Não altere código do repositório nesta etapa.

> **COMECE POR AQUI:** Este arquivo é simultaneamente (1) o prompt de trabalho e (2) a referência funcional consolidada. Leia tudo antes de avaliar o projeto. Não assuma que o repositório já implementa alguma regra; descubra o estado real no código. As decisões registradas como **CONFIRMADAS** têm prioridade sobre os documentos históricos. Itens marcados como **PENDENTES** não estão autorizados para implementação arbitrária.

---

# PARTE I — MISSÃO E MÉTODO DE TRABALHO DA IA

## 1. Papel

Atue como **arquiteto de software sênior, analista de requisitos, engenheiro full-stack, especialista em segurança de aplicações web e QA técnico**. Sua responsabilidade é realizar uma auditoria rastreável da aplicação GoIndica, e não apenas uma revisão superficial de telas.

Você deve:

1. **Reconhecer o projeto real**: stack, framework, versões, organização, rotas, componentes, API, banco, autenticação, autorização, serviços externos, tarefas assíncronas e testes.
2. **Entender o funcionamento existente** percorrendo arquivos, relacionamentos, funções, chamadas de API, regras de negócio e estados dos pedidos.
3. **Comparar cada requisito identificado por ID neste documento** com a implementação real, verificando frontend, backend, persistência, segurança e testes quando aplicável.
4. **Demonstrar evidências**: caminhos de arquivos, símbolos/classes/funções, endpoints, tabelas/colunas/migrations, testes e linhas quando disponíveis.
5. **Detectar incompatibilidades** entre o código e as decisões definitivas, inclusive funcionalidades antigas que deveriam ser removidas ou alteradas.
6. **Apresentar lacunas e riscos** com prioridade e dependências de implementação.
7. **Produzir um plano ordenado de adequação**, que aproveite o código existente e evite reescritas sem justificativa.
8. **Documentar o que NÃO foi possível verificar**. Ausência de evidência não é prova de ausência de funcionalidade.

### 1.1 O que você NÃO deve fazer

- Não implementar, editar, excluir, renomear ou formatar arquivos do projeto por conta própria nesta etapa.
- Não instalar bibliotecas nem executar migrações, deploys ou scripts destrutivos.
- Não alterar banco de dados de produção nem usar credenciais reais para testes inseguros.
- Não inventar endpoints, telas, tabelas, fluxos, testes ou tecnologias que não tenham sido constatados.
- Não afirmar “concluído” somente porque há uma tela, mock, TODO, função vazia, comentário ou estrutura preparada.
- Não tomar as especificações históricas como autoridade quando divergirem das decisões confirmadas neste arquivo.
- Não implementar pontos pendentes em silêncio; reporte-os como decisão de produto necessária.
- Não imprimir segredos de `.env`, tokens, chaves, dados pessoais ou payloads sensíveis no relatório.
- Não trocar o objetivo de auditoria por uma refatoração geral do projeto.

### 1.2 Como obter acesso

1. Inspecione o **repositório/workspace atualmente aberto** e identifique a raiz correta. Se houver múltiplos projetos, procure aquele que corresponde ao GoIndica.
2. Se o ambiente oferecer GitHub conectado e houver repositório GoIndica identificado de modo inequívoco, use-o para leitura. Não suponha a URL a partir do nome do projeto.
3. Se não houver código acessível, **interrompa qualquer classificação de implementação**, descreva a limitação e solicite o caminho ou acesso ao repositório; não fabrique uma auditoria.
4. Leia README, documentação técnica, configurações, arquivos de dependências, esquema e migrações do banco, testes, componentes, rotas e serviços.
5. Quando possível e seguro, execute apenas comandos **não destrutivos** de inspeção, lint, typecheck, testes existentes e build de verificação. Informe comandos e resultados. Se não puder executar, identifique-os como não executados.

## 2. Hierarquia de autoridade dos requisitos

Use esta ordem, da mais alta para a mais baixa:

1. **Dez decisões definitivas do responsável pelo produto** (DEC-01 a DEC-10, seção 3).
2. **Regras funcionais compatíveis entre os três documentos originais**, consolidadas neste arquivo.
3. **Regras adicionais expressas e não contraditórias dos documentos originais**, mantidas neste arquivo.
4. **Interpretações técnicas recomendadas**, sempre identificadas como recomendações, nunca como decisão aprovada.
5. **Pendências e lacunas de especificação**, que só podem ser resolvidas mediante decisão posterior.

Se detectar qualquer conflito residual, registre a divergência na seção `Decisões necessárias` do relatório; **não escolha por conta própria**.

### Documentos históricos de origem (para rastreabilidade)

- **D1** — `GoIndica_Especificacao_Funcional_Telas_e_Fluxos.pdf` (17 páginas, v1.0 de 19/10/2026). Navegação, pedidos, comparação, formulários, Google Maps, avaliações, reabertura, estados e critérios de aceite.
- **D2** — `GoIndica_Especificacao_Perfil_Usuario_Empresas.pdf` (6 páginas). Perfil do usuário, visibilidade contextual, alteração de cidade e cadastro empresarial.
- **D3** — `GoIndica_Especificacao_Fluxo_de_Indicacoes.docx` (8 páginas, v1.0 de 19/10/2026). Fluxos, autorizações, antifraude, prazo, estados e eventos técnicos.

**Atenção:** estes documentos têm contradições conhecidas. O presente prompt resolve as contradições definidas pelo proprietário do produto, mas não supre decisões ainda pendentes. Se os três arquivos não estiverem disponíveis no workspace, este arquivo ainda serve como referência consolidada para auditoria.

### 2.1 Contexto da auditoria anterior — informação relatada, não prova definitiva de código

O responsável pelo produto forneceu um diagnóstico do repositório local `C:\Users\kaue\Desktop\Projetos\GoIndica` (branch `main`, commit informado `39bf322`). Segundo aquele relatório, a aplicação usa Next.js/React, Server Actions com MySQL, autenticação própria, Google Places, cadastro empresarial e testes Vitest/Playwright. O fluxo existente teria `reveal_responses`/`REVEALED`, bloqueio de envios ao abrir respostas, exposição de autoria e ausência do controle de avaliação de 36h e reabertura.

**Não apresente esses achados como se você os tivesse verificado agora.** Use o relatório anterior como hipótese inicial e inspecione código para confirmar desvios, ou marque `NÃO VERIFICADO` se não houver acesso. O novo pedido do usuário é atualizar **regras e pendências**, sem implementar, aplicar migrations, alterar o repositório ou reconstruir o código.

---

# PARTE II — REGRAS DE PRODUTO E ESPECIFICAÇÃO CONSOLIDADA

## 3. DECISÕES DEFINITIVAS — NÃO NEGOCIÁVEIS (DEC-01 A DEC-10)

| ID | Tema | Comportamento aprovado | Origem |
|---|---|---|---|
| DEC-01 | Visualização | O **solicitante pode comparar todas as indicações completas disponíveis**, com descrição, links e local, mas **sem nome/foto/identificação dos indicadores antes da escolha**. | Decisão expressa do produto, 31/10/2026 |
| DEC-02 | Bloqueio de novas respostas | **Abrir a comparação NÃO bloqueia novos envios nem altera o pedido para `Em avaliação`.** O bloqueio começa **quando o solicitante CONFIRMA uma indicação para testar**. | Decisão expressa do produto, 31/10/2026 |
| DEC-03 | Prazo | **Toda indicação confirmada para teste tem 36 horas corridas**, seja primeira, segunda, terceira ou posterior, inclusive após reabertura. | Decisão expressa do produto, 31/10/2026 |
| DEC-04 | Ranking patrocinado | Onde houver ranking patrocinado, exibir **nome e logotipo da empresa patrocinadora**, com a identificação **“Patrocinado por”**. | Decisão expressa do produto, 31/10/2026 |
| DEC-05 | Anonimato do solicitante | O solicitante permanece **anônimo para os indicadores**, inclusive em detalhes de **`Minhas indicações`**. Não expor nome, foto, perfil ou identificador público que revele sua identidade. | Decisão expressa do produto, 31/10/2026 |
| DEC-06 | Imutabilidade após apresentação | **Cada indicação deixa de poder ser editada/excluída quando seu conteúdo for apresentado ao solicitante na comparação**, inclusive quando entrar por atualização automática. Indicações ainda não apresentadas podem ser alteradas/excluídas enquanto as demais regras permitirem. | Decisão complementar expressa, 31/10/2026 |
| DEC-07 | Comparação com atualização automática | Enquanto o pedido estiver `Aberto` e o solicitante mantiver a comparação aberta, **novas indicações elegíveis aparecem automaticamente, sem recarregar a página ou acionar atualização manual**. A escolha confirmada interrompe a entrada de novas respostas. | Decisão complementar expressa, 31/10/2026 |
| DEC-08 | Exclusão do pedido após comparação | **A primeira abertura efetiva da comparação impede definitivamente a exclusão do pedido pelo solicitante**, mesmo que ele continue `Aberto` e ainda não tenha escolhido indicação. | Decisão complementar expressa, 31/10/2026 |
| DEC-09 | Inatividade depois de avaliação negativa | Após avaliar uma indicação como inválida, **se houver outra indicação disponível para escolha e o solicitante não escolher**, deverá ser aplicado um **prazo de inatividade**. O prazo numérico, seu marco inicial e a consequência do vencimento **ainda não estão definidos**. Não inventar duração ou encerramento automático. | Decisão complementar expressa quanto à existência da regra, 31/10/2026 |
| DEC-10 | Histórico de respostas não selecionadas | Quando o pedido for concluído pela validação de outra indicação, o autor de uma resposta **não selecionada** verá **apenas que o pedido foi concluído**. Não exibir `Não selecionada`, quem foi selecionado, qual resposta foi validada nem dados de terceiros. | Decisão complementar expressa, 31/10/2026 |

**Interpretação obrigatória:** a comparação completa da DEC-01 permite que o solicitante **deduza/ conte** as respostas exibidas. Portanto, o requisito preservado é **não apresentar contador explícito do total do pedido**, e não prometer sigilo matemático do número de itens mostrados. É permitido que o backend entregue ao próprio dono do pedido as respostas autorizadas para a comparação, mas **sem os campos identificadores dos autores não selecionados**. Outros usuários jamais recebem o conjunto de respostas de terceiros.

### 3.1 Delimitações das novas decisões complementares

1. **DEC-06 é individual por indicação**. Abrir a comparação não deve congelar antecipadamente uma indicação enviada depois que a tela já estava aberta: ela se torna imutável quando **for apresentada** ao solicitante, seja na abertura inicial, seja em atualização automática posterior. Nunca liberar alteração de indicação já apresentada por sair da tela, recarregar, expirar sessão ou abrir outro dispositivo.
2. **DEC-07 exige atualização automática real da UI** sem recarga manual; WebSocket, SSE, polling ou mecanismo equivalente são **opções de engenharia**, não tecnologias impostas. Não há latência máxima ou intervalo numérico aprovado. Não transmitir identidade dos indicadores junto a eventos, notificações de atualização ou payloads.
3. **DEC-08 exige rastreabilidade persistente do primeiro acesso à comparação** (`first_comparison_opened_at` ou equivalente). Não é suficiente um flag mantido no React. O bloqueio de exclusão vale mesmo se ainda não houve seleção e a comparação foi aberta sem respostas. A edição do pedido continua sujeita à regra independente PED-06.
4. **DEC-09 não altera o prazo de avaliação DEC-03**. O relógio de 36 horas só vale quando há uma indicação efetivamente selecionada e aguardando avaliação. A espera pela escolha seguinte, após avaliação negativa, precisa de **outro controle de inatividade**; seu valor e desfecho ficam pendentes. A situação de abrir uma comparação inicial e nunca escolher também permanece sem prazo aprovado (PEN-19).
5. **DEC-10 limita a informação exibida sobre resposta não selecionada** quando o pedido for concluído. O histórico de uma indicação própria que **foi selecionada e avaliada como inválida** continua podendo mostrar o motivo correspondente, conforme AVL-07; não confundir esses casos.
6. **Comparação e edição não são o mesmo evento**: a confirmação de escolha bloqueia novos envios, mas a primeira apresentação da indicação bloqueia a edição/exclusão individual; a primeira abertura da comparação bloqueia a exclusão do pedido. Implementar e auditar três marcas distintas, com autorização e tratamento de concorrência no servidor.

### 3.2 Regras históricas que foram SUBSTITUÍDAS

Não trate as regras abaixo como válidas, mesmo que apareçam em D1/D2/D3 ou estejam implementadas:

- **INC-01:** “O solicitante só pode ver o conteúdo de uma indicação por vez.” **Revogado por DEC-01.**
- **INC-02:** “Abrir a comparação altera o pedido para `Em avaliação` e bloqueia novos envios.” **Revogado por DEC-02.**
- **INC-03:** “A segunda indicação e as seguintes têm prazo de 24 horas.” **Revogado por DEC-03.**
- **INC-04:** “Nome/logotipo do patrocinador ainda não podem ser exibidos porque aguardam decisão.” **Resolvido por DEC-04.**
- **INC-05:** “A identidade do solicitante pode aparecer em `Minhas indicações`.” **Revogado por DEC-05.**
- **INC-06:** “Pedido possui campo `categoria`.” **Não aplicável à especificação consolidada: categoria e tags foram removidas no D1.**
- **INC-07:** “Distância calculada é critério de comparação.” **Não aplicável: D1 determina não calcular nem exibir distância.**
- **INC-08:** “A seleção pode ocorrer antes de exibir integralmente a indicação e o conteúdo dos demais é sempre inacessível.” **Revogado enquanto não houver escolha; depois de confirmada uma escolha, as outras ficam temporariamente inacessíveis.**

Se o código refletir essas versões antigas, classifique como **DIVERGENTE**, e não como implementado.

## 4. Produto, navegação e apresentação

| ID | Requisito funcional confirmado |
|---|---|
| NAV-01 | Aplicação web responsiva, utilizável em navegadores de computador e celular. |
| NAV-02 | Tela inicial pós-acesso com exatamente três ações principais, em botões grandes e verticais: **Pedir uma indicação**, **Fazer uma indicação**, **Minhas indicações**. Sem cartões ou descrições adicionais nesses botões. |
| NAV-03 | `Meus pedidos` fica dentro de `Pedir uma indicação`; **não** deve ser criado um quarto botão principal na tela inicial. |
| NAV-04 | Não criar feed público de indicações, catálogo geral pesquisável de empresas ou diretório pesquisável de usuários. |
| NAV-05 | Listagens e páginas apresentam somente dados autorizados. Acessar uma URL diretamente não amplia as permissões. |
| VIS-01 | Identidade visual de referência: laranja `#EC5E27` para destaques e ações principais; creme `#FDFDF1` como base visual. |
| VIS-02 | Cabeçalho, ícones, avatar, microinterações e espaçamentos finos não foram fechados; **não classifique diferenças puramente estéticas não especificadas como bug funcional**. |

## 5. Perfil comum e privacidade contextual

| ID | Requisito funcional confirmado |
|---|---|
| PER-01 | O perfil comum tem **nome de usuário**, **foto** e **cidade** editáveis; **reputação** aparece no perfil público autorizado, com cálculo ainda pendente. |
| PER-02 | Nome de usuário deve ser **único na plataforma**, com validação na camada de dados/backend e proteção contra alterações concorrentes. |
| PER-03 | O próprio usuário pode mudar nome, foto e cidade sem aprovação prévia do administrador, observadas validações. |
| PER-04 | A cidade do perfil é a cidade padrão de `Fazer uma indicação` e o valor inicial ao criar pedido, mas o usuário pode escolher manualmente outra cidade em ambos os fluxos. |
| PER-05 | Mudar a cidade do perfil **não** altera a cidade registrada em pedidos já criados ou indicações anteriores. |
| PER-06 | Perfis de outros usuários só podem ser abertos nos **contextos autorizados** a partir de nome/foto que possam ser legalmente exibidos. Sem busca geral e sem diretório público de pessoas. |
| PER-07 | Abrir perfil não autoriza consultar indicações de terceiros, pedidos privados ou histórico protegido. |
| PER-08 | A identidade do solicitante permanece **oculta em toda jornada do indicador**, inclusive `Fazer uma indicação`, detalhes do pedido e `Minhas indicações` (DEC-05). |
| PER-09 | Na comparação, autores das indicações ficam anônimos até a confirmação de uma escolha; **somente a identidade do indicador escolhido** é revelada ao solicitante. |
| PER-10 | Autorização é aplicada por recurso e usuário no servidor, não apenas por condição visual em componentes. |

**Dependência funcional:** a reputação deve constar onde prevista, mas fórmula, pesos, atualização e cálculo dos pontos **não estão aprovados**; não invente valores ou algoritmos para preencher essa lacuna.

## 6. Criação, acompanhamento, edição e exclusão de pedidos

| ID | Requisito funcional confirmado |
|---|---|
| PED-01 | Criar pedido com `O que você procura?` (título obrigatório), `Cidade` obrigatória, `Detalhes` opcionais e **no máximo uma foto** opcional. Sem campo de categoria nem tags. |
| PED-02 | Cidade vem inicialmente do perfil, pode ser substituída antes da publicação e permanece vinculada àquele pedido mesmo se o perfil mudar. |
| PED-03 | Antes da publicação, apresentar prévia dos campos e botões `Voltar para editar` e `Confirmar publicação`; voltar preserva dados. |
| PED-04 | Após publicação bem-sucedida no servidor, apresentar sucesso e retornar à tela inicial. Pedido começa `Aberto` e aparece no topo de `Meus pedidos`. |
| PED-05 | `Meus pedidos`: apenas pedidos do próprio usuário; lista com **título, cidade e status**, ordenada pela data de criação decrescente, sem contador de indicações. Detalhes ao abrir. |
| PED-06 | Pedido editável **somente antes de receber sua primeira indicação**. Bloqueio no servidor após primeira participação. |
| PED-07 | Pedido excluível **enquanto não houve abertura da comparação**, ainda que tenha recebido indicações. **DEC-08 confirma definitivamente** a regra: a primeira abertura efetiva da comparação impede excluir o pedido, **ainda que a comparação não bloqueie novas indicações**. Persistir esse evento no servidor para manter o bloqueio após recarga e entre sessões. |
| PED-08 | Ao excluir pedido permitido, ele deixa a interface do solicitante e dos indicadores, inclusive `Minhas indicações`; não fica acessível por URLs ou endpoints de usuário. Retenção técnica mínima para auditoria/antifraude é tema separado. |
| PED-09 | Após conclusão, o solicitante pode abrir o pedido e consultar seus detalhes originais e a indicação que foi escolhida e validada. Outras indicações continuam inacessíveis. |

**Separação obrigatória de marcos:** (a) primeira abertura da comparação bloqueia a exclusão do **pedido** (DEC-08); (b) apresentação de uma resposta bloqueia edição/exclusão **dessa indicação** (DEC-06); (c) confirmação da escolha bloqueia **novos envios** e inicia avaliação de 36h (DEC-02/03). Eventos independentes, com timestamps persistidos e verificação no backend; a estratégia de entrega/registro e concorrência é decisão técnica, não novo requisito de produto.

## 7. Listagem `Fazer uma indicação` e elegibilidade

| ID | Requisito funcional confirmado |
|---|---|
| LIS-01 | Filtro inicial por cidade do perfil; permitir selecionar outra cidade manualmente sem atualizar o perfil. |
| LIS-02 | Pedidos da lista pertencem à cidade gravada na publicação pelo solicitante. |
| LIS-03 | Não mostrar pedidos criados pelo próprio indicador nem pedidos em que já houve participação daquele indicador. |
| LIS-04 | Na lista, mostrar apenas **título, cidade, status**. Não mostrar nome/foto/identidade do solicitante nem contador total de respostas. |
| LIS-05 | A ordenação é variada, mas deve permanecer estável durante navegação da listagem; pode variar ao atualizar. |
| LIS-06 | Carregamento por **rolagem infinita**, sem duplicar itens dentro de uma sessão/paginação. |
| LIS-07 | Estado vazio exibe **somente** `Não há pedidos disponíveis no momento.` sem botão ou sugestão adicional. |
| LIS-08 | Ao abrir pedido `Aberto`, mostrar título, cidade, detalhes, foto se existir e botão `Fazer uma indicação`; solicitante permanece anônimo. |
| LIS-09 | Pedidos `Em avaliação` continuam **visíveis na lista** nos contextos elegíveis para visualização, embora sem ação para indicar. Ao abrir, mostrar somente título, cidade e `Este pedido está em avaliação e não aceita novas indicações.` |
| LIS-10 | Pedidos concluídos/encerrados não admitem novas indicações. Diferenciar elegibilidade **para envio** de visibilidade **somente para consulta**. |
| LIS-11 | Usuário que já participou não volta a receber o mesmo pedido como oportunidade de envio, ainda que apague sua indicação ou haja reabertura. |

**Observação de auditoria:** a frase antiga “mostrar somente pedidos que aceitam indicações” não pode eliminar os pedidos `Em avaliação` que devem permanecer visíveis. Verificar ambos os comportamentos.

## 8. Formulário de indicação, links e localização

| ID | Requisito funcional confirmado |
|---|---|
| IND-01 | Uma indicação por usuário por pedido em toda a vida do pedido, inclusive depois de exclusão da própria indicação e depois de reabertura. |
| IND-02 | Descrição obrigatória, de **até 500 caracteres incluindo espaços**, validada no servidor. |
| IND-03 | Zero ou mais links opcionais. Botão `Adicionar link`. Não há limite funcional fixo de quantidade; proteção técnica contra abuso fica pendente. Validar URL e renderizar links de modo seguro. |
| IND-04 | No máximo **um local do Google Maps** por indicação. Campo opcional, com busca integrada, seleção, confirmação, substituição e remoção antes do envio. |
| IND-05 | Registrar identificador do Google Maps (`place ID` ou equivalente, quando disponível), nome, endereço e referência de abertura. Ao solicitante mostrar nome/endereço/link do Maps; **não calcular ou mostrar distância**. |
| IND-06 | Se estabelecimento físico não aparecer no Maps, permitir **nome e endereço manuais**; registro manual é independente, não deve ser sugerido automaticamente ou mesclado por semelhança textual. |
| IND-07 | Para produtos ou serviços online, localização pode estar vazia. |
| IND-08 | Usuários distintos podem indicar o mesmo local no mesmo pedido; indicações continuam independentes, com autores e avaliações próprios. |
| IND-09 | O rascunho mantém descrição, links e local quando o usuário volta ao formulário na navegação atual; não é obrigatório persistir após recarregar página ou fechar navegador. |
| IND-10 | Antes do envio, apresentar prévia com descrição, todos os links e local se houver. `Voltar para editar` preserva o conteúdo. |
| IND-11 | Na confirmação, o servidor revalida elegibilidade, status do pedido, participação anterior e limite antifraude. Após sucesso, mensagem `Indicação enviada com sucesso`, retorno à lista e entrada em `Minhas indicações` com status inicial `Enviada`. |
| IND-12 | **DEC-06 confirmada:** o autor pode editar/excluir sua indicação enquanto não tenha sido **apresentada** ao solicitante; no primeiro evento de apresentação, essa indicação específica se torna permanentemente imutável para seu autor, inclusive se a apresentação ocorrer por atualização automática. Persistir o controle no backend e resolver concorrência entre apresentação, edição e exclusão. |
| IND-13 | Apagar indicação antes de sua visualização não apaga a participação: o autor nunca pode substituí-la por outra ao mesmo pedido. |
| IND-14 | Todas as validações críticas ocorrem também no backend; cliques duplicados e requisições simultâneas não geram duplicação. |

### 8.1 Regra antifraude por solicitante

- **ANT-01:** o usuário não pode indicar novamente para **qualquer outro pedido do mesmo solicitante** durante as **24 horas corridas** seguintes ao envio anterior.
- **ANT-02:** regra independente da limitação permanente de uma indicação por pedido; calcular por timestamps do servidor e validar atomicamente.
- **ANT-03:** exclusão de indicação não elimina o histórico necessário ao bloqueio.
- **ANT-04:** não expor o identificador, perfil ou identidade do solicitante nas verificações, telas ou APIs para o indicador. A mensagem de erro antiga que relaciona pedidos ao “mesmo solicitante” tem risco de associação de identidade — **ver PEN-08**.

## 9. Comparação, seleção e avaliação (fluxo central)

### 9.1 Comparação ANTES de selecionar

| ID | Requisito funcional confirmado |
|---|---|
| CMP-01 | Só o **dono do pedido** pode consultar as indicações daquele pedido para comparação. |
| CMP-02 | A comparação mostra **todas as respostas completas disponíveis no momento da consulta**: descrição, links, local/endereço/link Maps quando houver, reputação e contagem de indicações válidas do indicador, se calculáveis conforme regras aprovadas. |
| CMP-03 | **Não mostrar** nome, foto, nome de usuário, link de perfil ou dados identificadores dos indicadores antes de escolher; evitar retorno desses campos no payload da API de comparação. |
| CMP-04 | **Abrir comparação NÃO bloqueia novas indicações, NÃO altera o pedido para `Em avaliação`, NÃO inicia o prazo de 36h.** O estado continua `Aberto`. |
| CMP-05 | Não adicionar contador explícito do **total de indicações deste pedido**. É normal que o dono consiga inferir o total pelo conjunto de respostas completas exibidas. Não esconder indevidamente respostas apenas para ocultar sua quantidade. |
| CMP-06 | Ordenar por **maior reputação**, depois **maior quantidade de indicações válidas do indicador**, e variar somente empates exatos. Os cálculos definitivos dessas métricas são **PENDENTES** (não inventar ranking artificial). |
| CMP-07 | **DEC-07 confirmada:** enquanto o pedido permanece `Aberto`, novas respostas devem surgir **automaticamente na comparação já aberta**, sem recarregar a página nem solicitar atualização manual. Garantir apresentação anônima, ordenação compatível e revalidação no servidor ao confirmar escolha. Meio de transporte e intervalo técnico não estão prescritos. |
| CMP-08 | O indicador e terceiros não recebem conteúdo de respostas enviadas por outras pessoas. Autorizações de acesso variam pelo papel real do usuário, nunca só pelo ID informado no cliente. |
| CMP-09 | Ao abrir a comparação pela primeira vez, persistir o evento **de abertura efetiva** para impedir exclusão posterior do pedido (DEC-08). Esse evento não bloqueia novos envios nem inicia avaliação. |
| CMP-10 | Ao retornar/exibir respostas na comparação inicial ou em atualizações automáticas, marcar **individualmente** quais indicações foram apresentadas ao solicitante. O registro deve impedir alterações/exclusões posteriores, inclusive concorrentes (DEC-06). |
| CMP-11 | Atualizações automáticas só entregam dados de comparação ao **dono autenticado** do pedido, sem identidades dos autores; não devem permitir acesso a terceiros por canal/evento nem continuar aceitando novas respostas após a escolha. |

### 9.2 Confirmação da escolha e bloqueio

| ID | Requisito funcional confirmado |
|---|---|
| SEL-01 | O solicitante pode escolher qualquer indicação ainda elegível entre as respostas disponíveis para comparação e confirma a intenção de testá-la. |
| SEL-02 | Antes de efetivar a escolha, apresentar confirmação explicando revelação do autor escolhido, indisponibilidade temporária das demais respostas e início do prazo de **36 horas**. Cancelar não seleciona e mantém `Aberto`. |
| SEL-03 | **Somente após confirmação efetiva no servidor**, o pedido muda de `Aberto` para `Em avaliação` e passa a rejeitar novos envios. A operação deve ser atômica frente a envios concorrentes. |
| SEL-04 | A identidade do **indicador escolhido** é então revelada **somente ao solicitante**. Autores das demais respostas permanecem anônimos. |
| SEL-05 | Durante o teste da indicação selecionada, as outras respostas ficam inacessíveis ao solicitante. O servidor não deve permitir contornar essa etapa com consultas diretas. |
| SEL-06 | No instante da escolha, registrar `selected_recommendation_id`, `evaluation_started_at` e `evaluation_deadline_at = started_at + 36h`; mostrar data/hora limite e contagem regressiva baseada no horário do servidor. |
| SEL-07 | Ao finalizar uma avaliação como inválida e confirmar a justificativa, liberar novamente **a comparação das respostas restantes completas**. Não exigir que o solicitante selecione sem ver o conteúdo. |
| SEL-08 | Quando o solicitante confirma outra indicação, iniciar **novo prazo integral de 36h**, independentemente de ser segunda, terceira etc. O pedido permanece `Em avaliação` e continua bloqueado para novos envios. |

### 9.3 Avaliação e desfechos

| ID | Requisito funcional confirmado |
|---|---|
| AVL-01 | O solicitante testa a indicação antes de avaliá-la como **válida** ou **não válida**. A avaliação fica registrada no servidor. |
| AVL-02 | Ao marcar **válida**, apresentar confirmação sobre conclusão e indisponibilidade definitiva das demais. Se confirmar, pedido `Concluído`, retorno a `Meus pedidos`; a indicação validada permanece consultável pelo dono. |
| AVL-03 | O indicador escolhido e validado pode consultar o resultado da **própria** indicação. Pontos/reputação só quando esses critérios forem definidos. |
| AVL-04 | Ao marcar **não válida**, exigir um **motivo predefinido obrigatório** e permitir explicação livre complementar opcional. |
| AVL-05 | Motivos previstos: `Informação incorreta ou insuficiente`; `Produto ou serviço indisponível`; `Estabelecimento fechado ou inexistente`; `Não foi possível entrar em contato`; `Outro motivo`. |
| AVL-06 | Depois de confirmar avaliação negativa e avançar, decisão e justificativa são **definitivas**; não liberar retorno para editar a avaliação anterior. |
| AVL-07 | O autor pode consultar a justificativa referente à **própria indicação inválida**, mantendo o solicitante anônimo. |
| AVL-08 | Se ainda houver indicações elegíveis na rodada, permitir escolher entre as restantes. Não iniciar novo prazo de **avaliação** antes de a escolha seguinte ser confirmada. Enquanto não houver nova escolha após uma avaliação inválida, aplicar a **regra de inatividade aprovada em princípio** (DEC-09), mas **não definir ou executar timeout até a aprovação dos detalhes em PEN-05**. |
| AVL-09 | Se todas as indicações daquela rodada forem consideradas inválidas, oferecer encerramento voluntário ou reabertura quando permitida. |
| AVL-10 | Quando uma indicação selecionada não for avaliada em **36 horas corridas**, encerrar automaticamente o pedido com motivo `falta_de_avaliacao`, registrar evento de penalização do solicitante (valor ainda pendente), preservar histórico e mostrar `Encerrado por falta de avaliação` em `Minhas indicações`, **sem notificação específica desse evento**. |
| AVL-11 | Rejeitar avaliação tardia depois do encerramento, com tratamento consistente de concorrência entre avaliação e rotina automática. |

## 10. Estados, transições e prazos

**Estados públicos / funcionais a conferir:**

| Estado | Entrada | Recebe indicações? |
|---|---|---|
| `Aberto` | Criação, reabertura; inclui comparação aberta sem escolha confirmada. A primeira comparação aberta impede exclusão do pedido, mas não novos envios. | **Sim** |
| `Em avaliação` | Confirmação de escolha para testar; continua assim entre avaliação negativa e escolha seguinte, sob futura regra separada de inatividade. | **Não** |
| `Concluído` | Avaliação válida confirmada. | Não |
| `Encerrado por falta de avaliação` | 36h expiradas sem avaliação da indicação ativa. | Não |
| `Encerrado sem solução` | Encerramento voluntário após avaliar respostas restantes como inválidas. | Não |
| `Encerrado - nenhuma indicação válida` | Três reaberturas consumidas e todas as respostas do último ciclo inválidas. | Não |

> **Nota de classificação:** `Encerrado sem solução` é o rótulo existente em D3, proposto aqui como **padronização técnica**, mas seu nome final e a apresentação aos indicadores ainda dependem de confirmação (PEN-06). Não trate a grafia exata como decisão definitiva. As grafias dos demais estados devem ser conciliadas com o modelo existente sem reescrever desnecessariamente o banco.

**Fluxo resumido:**

```text
Criar pedido
  -> Aberto (aceita indicações)
  -> Abrir comparação: continua Aberto, sem prazo de avaliação; autores ocultos; grava primeiro acesso e impede exclusão do pedido
  -> Novas respostas aparecem automaticamente; cada resposta apresentada fica imutável para seu autor
  -> Confirmar uma indicação: Em avaliação, bloqueio de novos envios, +36h
      -> Avaliar como válida: Concluído
      -> Avaliar como não válida e justificar:
          -> há outras: comparar restantes completas -> aguardar escolha com regra de inatividade (duração/efeito PENDENTES) -> confirmar próxima -> +36h
          -> não há outras: decidir encerrar ou reabrir (até 3 vezes)
      -> 36h expiram sem avaliação: Encerrado por falta de avaliação
  -> Reabrir: Aberto, novas indicações; não reapresentar inválidas anteriores
  -> Esgotar três reaberturas sem válidas: Encerrado - nenhuma indicação válida
```

### 10.1 Eventos distintos: abertura da comparação, apresentação e seleção

- **Evento A — primeira abertura efetiva da comparação:** persistir evento no servidor; pedido continua `Aberto` e pode receber novas indicações, mas o solicitante não pode mais **excluir o pedido** (DEC-08). A regra vale mesmo sem nenhuma resposta.
- **Evento B — primeira apresentação de cada indicação:** persistir controle individual no servidor; o **autor daquela indicação** deixa de poder editá-la/excluí-la (DEC-06). Esse evento se repete para respostas novas entregues por atualização automática, sem bloquear respostas ainda não apresentadas.
- **Evento C — confirmação da escolha:** operação atômica de seleção; bloquear **novos envios** ao pedido e iniciar prazo de avaliação de **36h** (DEC-02/03). Todas as respostas restantes ficam temporariamente inacessíveis ao solicitante durante teste ativo.
- **Evento D — avaliação negativa:** liberar opções restantes para comparação e aguardar uma nova escolha. O prazo de avaliação da resposta anterior terminou; há uma nova regra de **inatividade entre escolhas** confirmada em princípio, mas sem duração, início exato e consequência do vencimento aprovados (DEC-09 / PEN-05). Não usar 36 horas como valor implícito.
- **Evento E — conclusão do pedido:** para autores de respostas **não selecionadas**, mostrar somente conclusão genérica do pedido (DEC-10), sem dizer quem foi escolhido. Para própria indicação invalidada, conservar justificativa própria permitida.

**Concorrência recomendada para auditoria:** estudar garantia transacional ou equivalente entre autorização de leitura/entrega da comparação, gravação de apresentação, edição/exclusão da indicação, seleção e envio. Não pressupor que apenas um `useState`, componente visual ou evento de navegador garanta persistência. A definição de mecanismo (`seen_at`, timestamp de entrega, trilha de auditoria, locks, eventos SSE, WebSocket ou polling) é de engenharia e deverá ter testes de corrida. O sistema deve operar de modo consistente após múltiplas abas, logout, recarga e falhas de conexão.

## 11. Reabertura, encerramento e histórico

| ID | Requisito funcional confirmado |
|---|---|
| REA-01 | Se todas as indicações elegíveis da rodada forem inválidas, o solicitante escolhe **encerrar** ou **reabrir** (se ainda houver reaberturas disponíveis). |
| REA-02 | Ao reabrir, mostrar confirmação e retornar pedido a `Aberto`, novamente aceitando indicações. |
| REA-03 | No novo ciclo, somente **novas indicações** são consideradas na comparação; as antigas avaliadas como inválidas não voltam a ser oferecidas para escolha. Manter histórico interno. |
| REA-04 | Usuários que já participaram daquele pedido ficam impedidos de participar novamente, mesmo que a indicação tenha sido excluída. |
| REA-05 | Limite de **três reaberturas** por pedido. Criação inicial não conta como reabertura. Incremento atômico no servidor; impedir quarta. |
| REA-06 | Depois de gastar a terceira reabertura sem encontrar indicação válida, encerrar como `Encerrado - nenhuma indicação válida` e oferecer `Criar novo pedido`, sem reaproveitar respostas anteriores. |
| REA-07 | Indicadores podem ver status final de seus próprios registros, mas não têm acesso a respostas de outras pessoas e não recebem notificação específica para esse encerramento. |
| REA-08 | Encerramento voluntário antes do limite é permitido; o rótulo exato e efeito de pontuação continuam **PENDENTES**. |

## 12. Área `Minhas indicações`

| ID | Requisito funcional confirmado |
|---|---|
| MIN-01 | Exibir **apenas indicações de autoria do usuário autenticado**. |
| MIN-02 | Ordenar por data/hora de envio, decrescente. Lista mostra **somente título do pedido, cidade e status**; não mostrar data de envio na lista nem marcar “o solicitante visualizou”. |
| MIN-03 | Detalhe permite consultar o pedido original autorizado, o conteúdo da indicação própria, seu status e seu resultado permitido. **Não** exibir conteúdo de indicações de terceiros. |
| MIN-04 | Manter nome, foto, perfil e identidade do solicitante **ocultos**, inclusive em detalhes/histórico (DEC-05). |
| MIN-05 | Mostrar status como `Enviada`, `Em avaliação`, `Concluída`, `Encerrado por falta de avaliação`, `Encerrado - nenhuma indicação válida`, conforme evento real. Ajustar nomenclatura de casos ainda pendentes, sem inventar. |
| MIN-06 | Quando pertinente, mostrar se a própria indicação **selecionada** foi validada; justificativa referente à própria indicação inválida. **DEC-10:** se outra indicação encerrou o pedido e a própria resposta **não foi escolhida**, mostrar **somente que o pedido foi concluído** — sem rótulo `Não selecionada`, autor vencedor, resultado alheio ou dados de terceiros. Pontuação e reputação só após regras próprias. |
| MIN-07 | Pedido excluído legitimamente deixa de aparecer no histórico público do indicador; registros técnicos mínimos para antifraude podem ser retidos em camada interna apropriada. |
| MIN-08 | Nenhuma notificação específica é exigida para encerramento por falta de avaliação ou esgotamento das reaberturas; demais notificações permanecem pendentes. |

## 13. Cadastro empresarial e rankings patrocinados

| ID | Requisito funcional confirmado |
|---|---|
| EMP-01 | Empresa é um tipo de cadastro voltado **exclusivamente ao patrocínio de rankings**, distinto de usuário comum. |
| EMP-02 | Empresa **não pode** pedir nem enviar indicações; não participa do fluxo de recomendações. |
| EMP-03 | Empresa **não tem perfil público de estabelecimento**, catálogo comercial, lista pesquisável nem diretório de descoberta. |
| EMP-04 | Cadastro empresarial identificado por **CNPJ**. Cada estabelecimento/unidade tem cadastro próprio quando possuir seu próprio CNPJ; impedir duplicidade de CNPJ. |
| EMP-05 | Empresa pode alterar dados de cadastro pertinentes sem aprovação prévia; conjunto exato de campos está pendente. |
| EMP-06 | Ranking patrocinado, quando existente, apresenta **nome e logotipo** do patrocinador e texto discreto `Patrocinado por` (DEC-04). |
| EMP-07 | Não confundir identidade no **ranking patrocinado** com criação de perfil empresarial público. |
| EMP-08 | Consulta/validação automática de CNPJ, campos internos, contratos, pagamento, vigência, administração e funcionamento do ranking estão **fora do escopo funcional detalhado** atual; se não existirem, marcar como dependências/pendências, não criar regras comerciais. |

## 14. Segurança, autorização, integridade e auditoria

| ID | Requisito técnico-funcional confirmado |
|---|---|
| SEC-01 | Controlar autorização de leitura por recurso no backend: dono do pedido lê comparação, indicador lê apenas suas respostas, terceiros não leem indicações alheias. |
| SEC-02 | Ao retornar respostas para comparação, **não retornar identidade dos indicadores não selecionados**. Depois da escolha, revelar apenas a identidade do selecionado ao solicitante. |
| SEC-03 | Nunca enviar identidade do **solicitante** ao indicador por fluxos de pedidos/indicações, incluindo `Minhas indicações`. Os IDs internos de relação podem existir no servidor para autorização e antifraude, mas sua divulgação precisa ser limitada. |
| SEC-04 | Não expor contador explícito total de indicações do pedido na interface ou em campos de contagem específicos para usuários. Respostas completas acessíveis ao dono, conforme DEC-01, são permitidas. |
| SEC-05 | Validar no servidor: cidade, status, propriedade do pedido, unicidade de participação, antifraude 24h, elegibilidade, exclusões, seleção, avaliação e reabertura. |
| SEC-06 | Tratar **operações concorrentes** com transações/restrições equivalentes: **entrega/apresentação versus edição/exclusão**, **abertura da comparação versus exclusão do pedido**, seleção versus envio, atualização automática versus seleção, envio duplo, duas avaliações, reabertura simultânea, fechamento automático versus avaliação no limite. |
| SEC-07 | Controlar prazos por hora confiável do servidor, persistir início e vencimento, executar encerramentos automáticos de modo **idempotente**. |
| SEC-08 | Registrar histórico de status, **primeira abertura da comparação**, **apresentação individual de indicações**, seleção, avaliações (resultado/motivo), reaberturas, exclusões lógicas quando cabíveis e eventos de possível pontuação futura para auditoria. Modelar futura janela de inatividade entre escolhas sem presumir duração/efeitos. |
| SEC-09 | Validar uploads e URLs; impedir exposição de dados ou acesso indevido por referência direta (`IDOR`/`BOLA`), mesmo que a interface oculte links. |
| SEC-10 | Política de retenção técnica, conformidade LGPD, moderação, segurança de conteúdo e tratamento definitivo de dados excluídos demandam definições próprias. Não armazenar dados ilimitadamente por suposição. |

### 14.1 Modelo de dados — verificar equivalência, NÃO exigir nomes específicos

Procure estruturas que desempenhem as funções abaixo, mesmo que nomes de tabelas/colunas sejam diferentes:

- **Usuário/perfil:** ID interno, nome de usuário único, foto, cidade, reputação (se existente).
- **Pedido:** ID, solicitante, cidade, título, detalhes, foto opcional, status, data de criação, **primeira abertura da comparação**, data de exclusão quando cabível, ciclo/reaberturas, indicação selecionada, início/vencimento de avaliação, desfecho; prever campo/evento separado de futura inatividade entre escolhas, sem impor duração.
- **Indicação:** ID, pedido, indicador, descrição, links, local Maps/manual, data, **marco individual de primeira apresentação ao solicitante** (inclusive atualização automática), imutabilidade após esse marco, status, vínculo com ciclo, exclusão, seleção e resultado.
- **Participação/antifraude:** evidência permanente de usuário que já indicou naquele pedido e instante de participação por solicitante, sem violar política de privacidade.
- **Avaliação:** indicação escolhida, solicitante autenticado, válida/inválida, motivo, observação opcional, timestamp e caráter definitivo.
- **Histórico de transições:** status anterior/novo, ator ou rotina, quando e motivo.
- **Empresa:** CNPJ único, dados básicos internos, identificação de patrocinador e logotipo quando usado.
- **Ranking/patrocínio:** apenas se o sistema já tiver tais entidades ou sua implementação estiver em curso; não inferir contratos/pagamentos não especificados.

**Cuidado:** esta lista é um guia de investigação de responsabilidade de dados, não um esquema SQL obrigatório. Se o projeto usa arquitetura diferente mas cumpre a regra, marque como compatível e cite as evidências.

---

# PARTE III — PENDÊNCIAS E LIMITES DA AUTORIZAÇÃO

## 15. Pendências de produto — NÃO inventar decisões

**Status nesta revisão:** `RESOLVIDA` = decisão de produto já tomada; `PARCIALMENTE RESOLVIDA` = princípio decidido, mas ainda existe definição essencial a aprovar; `ABERTA` = ainda depende do responsável pelo produto. Itens resolvidos ficam registrados para rastreabilidade do relatório já produzido, **não** devem ser apresentados como nova pergunta ao usuário.

| ID | Status | Tema | O que ficou decidido / o que ainda falta | Diretriz à IA |
|---|---|---|---|---|
| PEN-01 | ABERTA | Reputação e pontos | Fórmula, valores, pesos, ganhos/perdas, penalização, contagem de válidas e janela de cálculo. | Mapear sistema atual de pontos sem equipará-lo automaticamente à nova regra. |
| PEN-02 | **RESOLVIDA por DEC-08** | Exclusão do pedido | Primeira abertura efetiva da comparação **impede exclusão**, mesmo com pedido ainda aberto. | Implementação exigida; auditar persistência do primeiro acesso. Não listar como pendência. |
| PEN-03 | **PARCIALMENTE RESOLVIDA por DEC-06** | Imutabilidade da indicação | **Regra de produto definida:** primeira apresentação da própria resposta impede edição/exclusão. **Aspecto técnico a projetar:** registro confiável e atomicidade, inclusive atualizações automáticas, múltiplas sessões e falhas. | Não perguntar novamente *quando* bloquear; auditar mecanismo e recomendar estratégia sem inventar SLA. |
| PEN-04 | **RESOLVIDA por DEC-07** | Atualização da comparação | Novas indicações devem surgir **automaticamente, sem recarregar**. Transporte e intervalo são decisões de engenharia; SLA numérico não foi aprovado. | Tratar atualização automática ausente como lacuna/bug do requisito, e não como pendência de produto. |
| PEN-05 | **PARCIALMENTE RESOLVIDA por DEC-09** | Inatividade entre escolhas | **Obrigação confirmada:** aplicar prazo se, após invalidar uma indicação, houver outra disponível e solicitante não fizer nova escolha. **Ainda faltam:** duração, início exato da contagem, avisos, desfecho no vencimento, penalidade e exposição ao indicador. | Não usar o prazo de 36h para isso e não implementar prazo ou status arbitrários. **Bloqueia somente a conclusão dessa automação, não todo o fluxo.** |
| PEN-06 | ABERTA | Encerramento voluntário | Rótulo oficial, visibilidade para indicador e efeito em pontos. | `Encerrado sem solução` é candidato histórico. |
| PEN-07 | **PARCIALMENTE RESOLVIDA por DEC-10** | Resultado não selecionado | Para indicação **não selecionada** em pedido concluído, mostrar **somente “pedido concluído”**, sem motivo ou identidade de outra indicação. Status/rótulos de indicações efetivamente avaliadas como inválidas seguem regras AVL e outros detalhes de histórico podem depender de decisão. | Não apresentar `Não selecionada`, dados do vencedor ou pontuação inferida. Não perguntar novamente como exibir a conclusão de não escolhidas. |
| PEN-08 | ABERTA | Mensagem antifraude | Mensagem sobre “mesmo solicitante” pode correlacionar pedidos anônimos. | Sugerir mensagem neutra, sem declarar aprovado texto exato. |
| PEN-09 | ABERTA | Cancelamento durante avaliação | Pode desistir de indicação selecionada antes das 36h? Quais efeitos? | Sem criar opção por conta própria. |
| PEN-10 | ABERTA | Limites de conteúdo | Limites de título, tipo/tamanho de foto e URL; moderação/antispam. | Mapear controles atuais e pontos não definidos. |
| PEN-11 | ABERTA | Google Maps | Provedor/API, custo, quota, cache/consentimento e falhas de integração. | Aproveitar integrações existentes; não expor credenciais. |
| PEN-12 | ABERTA | Notificações | Eventos, canais e frequência, além dos dois encerramentos sem notificação específica. | Não criar avisos de negócio arbitrários. |
| PEN-13 | ABERTA | LGPD e retenção | Retenção e remoção de participação, pedidos e respostas excluídos. | Apontar necessidade de política formal. |
| PEN-14 | ABERTA | Patrocínio comercial | Contratos, pagamentos, vigência, gestão do ranking e campos empresariais. | Exibição “Patrocinado por” já é confirmada; o restante não. |
| PEN-15 | ABERTA | Pedidos abertos sem respostas | Expiração por tempo sem indicação? | Não fechar silenciosamente. |
| PEN-16 | ABERTA | Ordenação sem reputação calculada | Como ordenar enquanto fórmula/contagem válida não forem definidas? | Não simular valor reputacional. |
| PEN-17 | ABERTA | Reabertura com estados atípicos | Regras em cenários de corrida e resposta parcialmente processada. | Verificar invariantes e solicitar decisão onde faltar. |
| PEN-18 | ABERTA / OUTRO ESCOPO | Cadastro e autenticação | Login, recuperação e administração não foram totalmente fechados nas especificações funcionais comparadas. | Não confundir ausência de especificação com ausência de código. |
| PEN-19 | **ABERTA** | Comparação inicial sem selecionar | Se o solicitante abrir a comparação **pela primeira vez** e nunca escolher qualquer indicação, haverá timeout? Qual ação no vencimento? | A DEC-09 se refere especificamente à inatividade **após avaliação inválida**; não estender por analogia. |
| PEN-20 | **ABERTA (técnica/experiência)** | Latência de atualização automática | Não há tempo máximo de aparecimento, mecanismo de reconexão ou frequência de polling aprovados. | Propor arquitetura e testes de atualização eventual; **não inventar compromisso de segundos** nem tornar atualização manual aceitável. |

### 15.1 Matriz de decisões complementares e impacto

| Nova decisão | Requisitos afetados | Testes de regressão novos/atualizados |
|---|---|---|
| DEC-06 — trava individual ao apresentar | IND-12, CMP-10, SEC-06, SEC-08, modelo de indicação | T-17, T-46, T-47, T-48 |
| DEC-07 — atualização automática | CMP-07, CMP-11, SEC-06 | T-21, T-49, T-50 |
| DEC-08 — trava de exclusão ao abrir | PED-07, CMP-09, SEC-06, modelo de pedido | T-06, T-51, T-52 |
| DEC-09 — prazo de inatividade pós-inválida | AVL-08, estados, processamento de prazos separado | T-53, T-54 (dependentes de PEN-05) |
| DEC-10 — conclusão genérica para não escolhidas | MIN-06, histórico individual e privacidade | T-55, T-56 |

**Classificação:** `PENDENTE` não é sinônimo de `BUG`. Uma decisão de produto já confirmada com implementação ausente é **lacuna funcional real**. Uma regra futura sem duração, como a janela DEC-09, é **parcialmente aprovada** e sua execução deve ficar bloqueada até a definição restante.
---

# PARTE IV — COMO AUDITAR O REPOSITÓRIO

## 16. Etapas obrigatórias de investigação

### Etapa A — Inventário técnico

Identifique e reporte:

- Frameworks e versões reais; gerenciador de pacotes, comandos de desenvolvimento/build/test.
- Organização de pastas e entradas reais (`app`, `pages`, `src`, `routes`, `api`, `server`, `services`, `db`, etc., conforme existam).
- Rotas/telas e componentes de navegação.
- Modelos, migrations, ORM, tabelas e chaves/restrições do banco.
- Login/sessões, papéis de conta, guardas, middleware e políticas de acesso.
- APIs, ações do servidor, formulários e serviços utilizados.
- Webhooks, workers, cron/schedulers e tratamento de deadlines.
- Integrações (Maps, storage, imagem, patrocinadores, telemetria), sem expor segredos.
- Testes unitários, integração, e2e, pipelines e ambiente de homologação.

### Etapa B — Reconstrução do comportamento real

Rastreie **ponta a ponta**, do clique ao banco e de volta, pelo menos as jornadas:

1. Login/acesso existente → tela inicial → ações principais.
2. Criar pedido → prévia → confirmar → persistência → `Meus pedidos`.
3. Editar/excluir pedido com zero, uma ou várias indicações.
4. Listar pedidos por cidade → abrir pedido → enviar indicação → prévia → histórico.
5. Abrir comparação → observar se bloqueia ou não novos envios → visualizar respostas anônimas.
6. Confirmar seleção → bloquear envios → revelar autor escolhido → iniciar 36h.
7. Avaliar válida → concluir → histórico autorizado.
8. Avaliar inválida com motivo → comparar restantes → selecionar próxima → novo prazo 36h.
9. Expirar 36h → rotina automática → impedir avaliação tardia → refletir status.
10. Reabrir até três vezes → preservar participação → impedir quarta.
11. Visualizar `Minhas indicações` sem revelar solicitante ou outras respostas.
12. Editar perfil/cidade → efeito no filtro → manutenção de cidades de pedidos antigos.
13. Cadastrar empresa por CNPJ → permissões empresariais → identificação nos rankings existentes.

### Etapa C — Rastreabilidade por requisito

**Para TODOS os IDs** (`NAV`, `VIS`, `PER`, `PED`, `LIS`, `IND`, `ANT`, `CMP`, `SEL`, `AVL`, `REA`, `MIN`, `EMP`, `SEC`):

1. Busque evidência de implementação.
2. Se existir, verifique se cumpre **todas** as condições do requisito.
3. Examine backend e banco sempre que houver regra de integridade; UI isolada não é suficiente.
4. Localize teste automatizado quando houver. Teste ausente não torna automaticamente funcionalidade ausente, mas reduz confiança.
5. Classifique com uma das categorias do item 17.
6. Documente impacto, prioridade, dependências e correção sugerida.
7. Se não houver acesso à camada necessária, marque **NÃO VERIFICÁVEL**, não “não implementado”.

### Etapa D — Verificações de segurança e concorrência

Concentre atenção em:

- IDOR/BOLA: visualizar indicação por ID, pedido de outra pessoa, perfil de solicitante oculto.
- Respostas JSON: campos extra de autor/solicitante que a interface não mostra.
- APIs de comparação: retornar apenas respostas do pedido do usuário autenticado, com anonimato correto.
- Mudança de estado: a simples leitura/abertura da comparação não deve bloquear novas indicações.
- Race condition: pedido recebe nova indicação exatamente quando outra é selecionada.
- Unicidade após exclusão e após reabertura.
- Janela antifraude de 24h por solicitante sem revelar identidade.
- Verificação do deadline contra timestamp confiável, não só `setTimeout` do navegador.
- Idempotência de jobs de encerramento e concorrência com avaliação.
- Validação de conteúdo, upload e URL; riscos de XSS/redirect/links maliciosos.
- Visibilidade de patrocinador sem criar perfis comerciais públicos.

### Etapa E — Testes e evidências

- Verifique testes existentes antes de criar um inventário dos cenários faltantes.
- Se houver ambiente de testes autorizado, rode testes de forma **não destrutiva** e registre comandos, resultados e erros.
- Não execute ações que gerem cobrança externa, notifiquem usuários reais, publiquem mudanças ou modifiquem produção.
- Se precisar de dados especiais, **proponha** fixtures e testes; não use dados sensíveis reais.
- Examine casos responsivos apenas se houver meios de verificar navegador/screenshot; caso contrário marque não verificado.

## 17. Critérios de classificação do diagnóstico

| Status | Significado | Evidência mínima esperada |
|---|---|---|
| **IMPLEMENTADO** | Requisito cumprido integralmente no comportamento verificável e com validações necessárias. | Caminhos de arquivos, lógica correspondente e verificação/ teste quando possível. |
| **PARCIAL** | Existe parte funcional, mas faltam condições, estados, restrições ou integração. | O que funciona e o que falta, separados. |
| **AUSENTE** | Não foi encontrada implementação após pesquisa suficiente em área acessível. | Onde procurou e por que concluiu ausência. |
| **DIVERGENTE** | Implementação existente contradiz decisão/requisito confirmado. | Comportamento atual, comportamento esperado e origem do conflito. |
| **NÃO VERIFICÁVEL** | Falta acesso, ambiente, credenciais seguras, infraestrutura ou evidência suficiente. | Bloqueio concreto e como verificar posteriormente. |
| **PENDENTE DE DECISÃO** | Produto ainda não definiu a regra de negócio. | ID PEN correspondente e opções possíveis, sem implementá-las. |
| **FORA DO ESCOPO** | Elemento não exigido pelas especificações fornecidas. | Explicação curta; não contabilizar como gap obrigatório. |

**Proibido:** marcar IMPLEMENTADO se a regra de segurança só está no frontend; se a API expõe identidade indevida; se deadline é apenas uma contagem visual; se a condição depende de dados mockados; ou se não há persistência suficiente para cumprir uma regra que exige histórico.

### 17.1 Prioridades

- **P0 — Bloqueador/segurança:** vazamento de identidade/dados; acesso indevido; regras centrais de comparação/seleção incorretas; race condition capaz de burlar participação/estado.
- **P1 — Núcleo funcional:** envio, criação, avaliação, 36h, reaberturas, estados e persistência que impedem jornada completa.
- **P2 — Experiência/regras complementares:** ordenação, histórico, prévias, filtros, rascunhos, melhorias de UX e integrações auxiliares.
- **P3 — Refinamento/não essencial:** acabamento visual, observabilidade, melhorias incrementais fora do MVP imediato.

Classifique prioridade conforme impacto observado, não automaticamente pelo prefixo do requisito.

---

# PARTE V — CENÁRIOS DE ACEITE QUE DEVEM SER CHECADOS

## 18. Catálogo mínimo de testes (pode propor outros)

| Teste | Cenário | Resultado esperado |
|---|---|---|
| T-01 | Criar pedido sem detalhes/foto | Aceito com título e cidade; status `Aberto`. |
| T-02 | Criar pedido em cidade diferente do perfil | Pedido persiste na cidade escolhida. |
| T-03 | Prévia do pedido → voltar | Dados permanecem preenchidos. |
| T-04 | Editar pedido antes da primeira indicação | Permitido. |
| T-05 | Editar pedido após primeira indicação | Negado no servidor. |
| T-06 | Excluir pedido antes de abrir comparação | Sai da experiência de todos os participantes. |
| T-07 | Mudar cidade do perfil | Atualiza cidade padrão; pedidos antigos permanecem na cidade original. |
| T-08 | Listar pedidos para indicar | Sem próprio pedido, sem participação prévia, sem nome do solicitante e sem contador. |
| T-09 | Paginar por rolagem | Sem repetição de pedidos na mesma navegação. |
| T-10 | Nenhum pedido no filtro | Mensagem de vazio correta, sem ações extras. |
| T-11 | Indicação com 501 caracteres | Rejeitada; com 500 caracteres, permitida se demais regras satisfeitas. |
| T-12 | Indicação com múltiplos links | Formulário, prévia, validação e exibição corretos. |
| T-13 | Um local Maps opcional | Busca, seleção, substituição, remoção, link; sem distância. |
| T-14 | Local ausente do Maps | Entrada manual de nome e endereço. |
| T-15 | Dois indicadores recomendam mesmo estabelecimento | Ambas as indicações preservadas separadamente. |
| T-16 | Envio duplicado por clique duplo/requisições concorrentes | Apenas uma participação é registrada. |
| T-17 | Excluir indicação antes de visualização | Não permite nova indicação do mesmo autor ao mesmo pedido. |
| T-18 | Segundo pedido do mesmo solicitante em menos de 24h | Bloqueio atômico no servidor. |
| T-19 | Abrir comparação do próprio pedido | Mostra todas as respostas completas com autores ocultos. |
| T-20 | Abrir comparação e não selecionar | **Pedido continua `Aberto` e aceita novos envios.** |
| T-21 | Nova indicação enquanto comparação aberta | Se elegível, envio aceito e resposta aparece **automaticamente sem recarregar a página**, com autor anônimo. |
| T-22 | Cancelar confirmação de escolha | Continua `Aberto`, sem deadline ou bloqueio de envios. |
| T-23 | Confirmar escolha para testar | Muda a `Em avaliação`, bloqueia envios e revela somente autor escolhido. |
| T-24 | Tentar enviar após confirmação da seleção | Rejeição no servidor mesmo se o formulário estava aberto antes. |
| T-25 | Primeira indicação escolhida | Prazo exato de 36h corridas. |
| T-26 | Segunda, terceira ou posterior escolhida | **Cada uma tem novo prazo de 36h**, nunca 24h. |
| T-27 | Durante avaliação, acessar outras indicações | Conteúdo inacessível até avaliação inválida confirmada. |
| T-28 | Avaliar como inválida sem motivo | Rejeitar; com motivo aprovado, permitir e persistir justificativa. |
| T-29 | Avaliação inválida concluída | Reexibir **restantes completas, anônimas** para nova escolha; **não** iniciar novo prazo de avaliação de 36h antes de confirmar próxima escolha; inatividade segue DEC-09/PEN-05. |
| T-30 | Avaliar como válida | Confirmar, concluir pedido e bloquear acesso às demais respostas. |
| T-31 | Prazo de 36h expira | Encerrar automaticamente de modo idempotente, registrar evento, bloquear avaliação tardia. |
| T-32 | Avaliar próximo ao limite de tempo | Evitar estado inconsistente por corrida com fechamento automático. |
| T-33 | Reabrir após rodada inválida | Novo ciclo aceita novas indicações; autores anteriores bloqueados. |
| T-34 | Reabrir três vezes e tentar quarta | Quarta proibida; resultado final apropriado. |
| T-35 | `Minhas indicações` | Só próprios itens, título/cidade/status, sem identidade do solicitante. |
| T-36 | Indicador tenta ler indicação alheia por endpoint | Negado. |
| T-37 | Usuário comum tenta consultar comparação de pedido alheio | Negado. |
| T-38 | Comparação retorna JSON | Sem `nome`, `foto`, `username` ou identificadores públicos de outros indicadores. |
| T-39 | Perfil de usuário com username duplicado | Rejeitar inclusive em concorrência. |
| T-40 | Conta empresarial tenta indicar/pedir | Bloqueada no servidor. |
| T-41 | Repetir CNPJ empresarial | Cadastro duplicado rejeitado. |
| T-42 | Ranking patrocinado existente | Exibir `Patrocinado por`, nome e logotipo; sem catálogo público empresarial. |
| T-43 | Pedido `Em avaliação` na listagem | Visível sem botão de indicar, detalhe simplificado. |
| T-44 | Concluir pedido com indicação validada | Solicitante mantém acesso somente à indicação escolhida válida. |
| T-45 | Indicação invalidada | Indicador vê o motivo de sua própria resposta e não vê a identidade do solicitante. |
| T-46 | Indicação apresentada ao solicitante | A partir da **primeira apresentação**, edição e exclusão pelo autor são negadas no backend; recarga/logout não libera. |
| T-47 | Indicação recebida mas ainda não apresentada | Enquanto pedido está aberto e demais regras permitirem, o autor ainda pode editar/excluir. A simples abertura anterior da comparação **não congela resposta futura ainda não exibida**. |
| T-48 | Concorrência: apresentação versus edição/exclusão | Não ocorre edição/exclusão bem-sucedida **depois** de a indicação ser considerada apresentada; a transação deixa estado consistente. |
| T-49 | Nova resposta com comparação aberta em duas abas | A resposta aparece automaticamente, anônima, em cada visão autorizada; não aparece para usuários não autorizados. |
| T-50 | Atualização automática versus escolha confirmada | Se a escolha foi confirmada, não aceitar novos envios nem expor resposta nova indevida em eventos atrasados; UI preserva o estado `Em avaliação`. |
| T-51 | Abrir comparação pela primeira vez, sem selecionar | Pedido permanece `Aberto` e aceita indicações, mas **exclusão do pedido é negada** pelo servidor. |
| T-52 | Primeira comparação aberta sem indicações e depois recarregar | Proibição de exclusão permanece registrada, inclusive em outra sessão/dispositivo. |
| T-53 | Invalidar indicação e deixar de escolher outra | Regra de inatividade é **obrigatória em princípio**, mas o teste de vencimento aguarda duração e consequência definidas em PEN-05; sem simulação de 36h. |
| T-54 | Inatividade de avaliação versus inatividade entre escolhas | Cron/job de 36h não pode encerrar automaticamente pedido apenas porque o solicitante está entre escolhas; controle é separado. |
| T-55 | Concluir pedido quando há indicações não escolhidas | Autor de resposta não escolhida vê **somente que o pedido foi concluído**; sem `Não selecionada`, vencedor, local escolhido ou conteúdo alheio. |
| T-56 | Indicação própria invalidada e outra indicação válida | Autor da resposta inválida vê sua própria justificativa quando permitida, mas não identidade de quem venceu nem dados do solicitante. |

**Importante:** alguns testes dependem de módulos ou integrações não implementados, e outros tocam regras parcialmente pendentes. Reporte como cenário sugerido/não executável onde faltar ambiente ou decisão; não simule testes aprovados.

---

# PARTE VI — ENTREGÁVEIS DA AUDITORIA

## 19. Formato obrigatório do relatório final

**O resultado deve ser uma auditoria**, não apenas uma lista genérica de sugestões. Redija em português do Brasil, de forma técnica, objetiva e verificável, seguindo obrigatoriamente esta ordem:

### 19.1 Resumo executivo

- O que é o repositório realmente analisado (caminho, branch, hash do commit se acessível).
- Stack/arquitetura resumida.
- Situação geral do MVP (pronto, parcialmente pronto, bloqueado), com justificativas e sem percentual inventado.
- **5 a 10 achados mais relevantes**, distinguindo funcionamento atual e decisão esperada.
- Riscos de segurança/privacidade mais urgentes.
- Principais restrições de acesso e testes não executados.

### 19.2 Inventário da implementação atual

Tabela com colunas: `Módulo | Componentes/rotas | Backend/APIs | Dados/migrations | Testes | Evidência/observações`.

### 19.3 Matriz completa de aderência — TODOS os requisitos

Tabela com colunas obrigatórias:

`ID | Requisito resumido | Status | Evidência concreta (arquivo:linha/símbolo/endpoint) | O que já funciona | O que falta / divergência | Impacto | Prioridade | Dependências | Teste sugerido`

- Cobrir **todos os IDs** das seções 4 a 14.
- Se a matriz for extensa, separar por módulo, mas **não omitir nenhum requisito**.
- Incluir as **dez decisões (`DEC-01` a `DEC-10`)** como verificações transversais; diferenciar o que é confirmado do que ainda falta precisar em DEC-09.
- Não apresentar caminhos ou linhas fictícios; quando não houver linha, informar caminho e símbolo encontrados ou `sem evidência verificável`.

### 19.4 Divergências com a versão definitiva

Tabela: `ID | Comportamento atual constatado | Regra correta | Onde ocorre | Correção recomendada | Risco de regressão`.

Dar ênfase a:

1. Comparação completa versus acesso sequencial antigo.
2. Bloqueio somente na confirmação, não na abertura da comparação.
3. Prazo de **36h em todas** as indicações selecionadas.
4. Anonimato do solicitante inclusive em `Minhas indicações`.
5. Nome/logotipo de patrocinador no ranking.
6. **Bloqueio de edição/exclusão da indicação na primeira apresentação**, inclusive atualização automática (DEC-06).
7. **Atualização automática da comparação sem recarregar** (DEC-07).
8. **Bloqueio de exclusão do pedido após primeira abertura da comparação** (DEC-08).
9. **Regra de inatividade entre escolhas** após avaliação inválida, com duração e efeito ainda pendentes (DEC-09/PEN-05).
10. **Resultado genérico de conclusão para indicações não escolhidas** (DEC-10).
11. Ausência de categoria e distância calculada.
12. Validações no backend e dados confidenciais retornados pelas APIs.

### 19.5 Lacunas funcionais e técnicas

Organizar por `P0`, `P1`, `P2`, `P3` e incluir:

- Descrição precisa da lacuna.
- Componentes e arquivos que podem ser reutilizados.
- Partes que precisam de criação, extensão ou remoção.
- Dependências e riscos de migração.
- Teste de aceite necessário.
- Distinção entre **obrigatório aprovado** e **pendência de produto**.

### 19.6 Plano de implementação por fases

Propor fases que minimizem retrabalho:

1. **Fase 0 — Segurança e consistência de dados:** corrigir exposições, autorizações, restrições e transações críticas.
2. **Fase 1 — Jornada principal:** pedidos, envios, comparação anônima com atualização automática, primeira abertura registrada, imutabilidade individual após apresentação e confirmação da seleção.
3. **Fase 2 — Avaliação e prazos:** 36h de avaliação, encerramento automático, justificativas, histórico e preparação separada para futura regra de inatividade entre escolhas **sem inventar duração/efeitos**.
4. **Fase 3 — Reabertura e elegibilidade:** limites, antifraude, estados e listagens.
5. **Fase 4 — Perfil, empresas e integrações:** conforme dependências existentes e escopo MVP.
6. **Fase 5 — Testes e validação:** regressão, segurança, concorrência e responsividade.

**Adapte a ordem ao que o código real mostrar**, explicando eventuais mudanças. Para cada fase: tarefas, arquivos afetados **se evidenciados**, dependências, critérios de aceite, esforço qualitativo (baixo/médio/alto, com justificativa) e riscos. Não forneça prazos exatos sem dados.

### 19.7 Decisões pendentes do responsável pelo produto

Tabela `ID PEN | Problema | Evidência/impacto | Opções de decisão | Recomendação técnica (não vinculante) | Bloqueia qual etapa?`. Não misturar decisões pendentes com bugs comprovados.

### 19.8 Qualidade, execução de testes e limites

- Comandos de análise executados, resultados e erros resumidos.
- Testes existentes mapeados e seus resultados reais.
- Testes que **não puderam ser executados**, com motivo.
- Áreas sem acesso suficiente (por exemplo, produção, configurações externas, APIs pagas).
- Cobertura qualitativa de fluxo, segurança e concorrência.

### 19.9 Próximos passos objetivos

Encerrar com um **backlog priorizado**, em tarefas pequenas e executáveis, agrupadas por dependências, preservando implementação atual quando compatível.

## 20. Critérios de qualidade do seu trabalho

O relatório **só estará pronto** quando:

- [ ] O repositório real foi inspecionado; ou a falta de acesso foi declarada sem inventar resultados.
- [ ] As **dez decisões definitivas** foram confrontadas com código real; DEC-09 tratada como regra aprovada em princípio e prazo/efeito ainda pendentes.
- [ ] Todos os requisitos com ID foram classificados com evidências ou falta de verificação explícita.
- [ ] Foram considerados frontend, backend, banco, segurança e tarefas automáticas.
- [ ] Não há afirmações de implementação baseadas apenas em nome de arquivo ou existência de botão.
- [ ] Foram identificadas regras antigas/revogadas que ainda possam permanecer no sistema.
- [ ] Nenhum ponto pendente foi apresentado como decisão já aprovada.
- [ ] Há plano incremental, prioridades, dependências e testes de aceite.
- [ ] Nenhum segredo, dado privado ou credencial foi reproduzido.
- [ ] **Nenhum arquivo foi modificado**, nenhuma migração foi executada e nenhuma funcionalidade foi implementada nesta etapa.

---

# 21. INSTRUÇÃO FINAL À IA EXECUTORA

**Agora analise o código real do GoIndica disponível no workspace ou no repositório autorizado.** Não faça suposições sobre a arquitetura. Leia este documento como contrato de requisitos consolidado, audite cada ID, destaque funcionalidades compatíveis, parciais, ausentes, divergentes e não verificáveis, apresente evidências e produza o relatório técnico e o plano de implementação ordenado.

**Não escreva código nem aplique correções neste momento.** A implementação somente poderá começar depois que o responsável pelo produto analisar o diagnóstico e aprovar as etapas e decisões pendentes.

**Ao iniciar a auditoria, informe somente qual projeto/repositório foi identificado e qual é o escopo de inspeção. Ao concluir, entregue todos os itens da seção 19.**

---

## Nota sobre a origem e natureza desta consolidação

Esta versão foi construída a partir dos três arquivos fornecidos para o GoIndica e das **dez escolhas expressamente confirmadas pelo responsável do produto em 31/10/2026** (cinco decisões iniciais e cinco complementares pós-auditoria). Regras compatíveis dos documentos antigos foram preservadas. **Exclusão após primeira comparação, imutabilidade de resposta apresentada e atualização automática agora estão confirmadas**, assim como a conclusão genérica do pedido para autores de indicações não escolhidas. A **existência de prazo de inatividade entre escolhas após avaliação inválida** também está aprovada, mas **não** a duração, o marco exato de início ou a consequência do vencimento. Reputação, nome final de encerramento voluntário, timeout da primeira comparação sem escolha e demais pontos da seção 15 continuam pendentes. Nenhum arquivo do repositório deve ser alterado na fase de auditoria.
