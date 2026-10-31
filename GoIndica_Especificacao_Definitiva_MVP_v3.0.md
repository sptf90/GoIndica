# GOINDICA — ESPECIFICAÇÃO FUNCIONAL E TÉCNICA CONSOLIDADA DO MVP

**Versão de trabalho:** 3.0 — 31/10/2026  
**Finalidade:** fonte única de verdade para implementação do MVP existente, substituindo em caso de conflito as especificações históricas e os prompts de auditoria v2.0, v2.1 e v2.2.  
**Situação:** DEC-01 a DEC-10 são escolhas expressamente confirmadas pelo responsável pelo produto. As resoluções R-01 a R-20 abaixo são **defaults adicionais propostos nesta consolidação para destravar o desenvolvimento**; não devem ser descritos retroativamente como aprovações explícitas do usuário. O fluxo de implementação pode utilizá-los como escopo de trabalho salvo alteração expressa posterior.

> Não confundir esta especificação com o estado atual do repositório. O diagnóstico anterior identificou `OPEN|REVEALED|RESOLVED`, feed e `reveal_responses`; essas evidências são hipóteses históricas para validar no código atual, não prova de que os arquivos ainda estejam assim.

## 1. Prioridade das regras e escopo

1. Prevalecem as decisões expressas DEC-01 a DEC-10.
2. Na ausência de conflito, prevalecem os requisitos funcionais consolidados neste documento.
3. Os defaults R-01 a R-20 fecham lacunas funcionais para o MVP; registrar alterações futuras no changelog, não improvisar regras.
4. Os documentos originais são fontes históricas, não contratos paralelos de implementação.
5. Não reescrever o projeto, não apagar dados existentes, não executar migrations destrutivas e não chamar ambiente de produção sem autorização e backup verificado.

**Objetivo do MVP:** plataforma web responsiva que conecta pedidos de ajuda a recomendações de pessoas. Três ações centrais: **Pedir uma indicação**, **Fazer uma indicação**, **Minhas indicações**. Não utilizar um feed público de descoberta como home principal. Empresas não participam como usuários comuns; podem patrocinar rankings.

## 2. DECISÕES EXPRESSAMENTE CONFIRMADAS (DEC-01 A DEC-10)

| ID | Regra vinculante | Evento/observação |
|---|---|---|
| DEC-01 | O solicitante pode comparar **todas as indicações completas disponíveis**, com descrição, links e local, **sem identidade dos indicadores**. | Autoria de uma indicação só pode ser revelada após selecionar e confirmar essa indicação para teste. |
| DEC-02 | Abrir/consultar a comparação **não** impede novos envios e **não** altera o pedido de Aberto para Em avaliação. | Apenas **confirmar uma indicação para testar** bloqueia novas indicações e muda o status. |
| DEC-03 | Cada indicação escolhida tem **36 horas corridas** para avaliação; primeira, segunda, seguintes e depois da reabertura. | Expiração sem avaliação fecha automaticamente o pedido por falta de avaliação. |
| DEC-04 | Ranking patrocinado exibe **nome e logotipo** com indicação discreta **“Patrocinado por”**. | Não cria perfil público pesquisável da empresa. |
| DEC-05 | Solicitante permanece **anônimo para os indicadores**, incluindo em “Fazer uma indicação” e “Minhas indicações”. | Nunca retornar nome, foto, username, link de perfil ou identificador exposto de solicitante nos payloads do indicador. |
| DEC-06 | Uma indicação se torna **imutável e não excluível assim que seu conteúdo for apresentado** na comparação ao solicitante. | Trava persistida no servidor, também para apresentação automática de novas respostas. |
| DEC-07 | Novas respostas surgem **automaticamente** na comparação aberta **sem recarregar a página**. | Atualização não deve expor identidades ou quebrar ordem/consistência. |
| DEC-08 | A **primeira abertura efetiva** da comparação impede excluir o pedido, mesmo permanecendo no status Aberto. | Persistir marco durável no servidor, não apenas na sessão. |
| DEC-09 | Após avaliação inválida confirmada com justificativa, **havendo outras opções**, o solicitante tem **36h para selecionar a próxima**. | Se expirar: permanece **Em avaliação**, sem novos envios; ao retornar, pode escolher outra normalmente. Não encerra nem reabre. |
| DEC-10 | Autor de indicação **não escolhida** vê somente que o **pedido foi concluído** quando outra é validada. | Não revelar que perdeu, quem venceu, o resultado ou a identidade de outras respostas. |

**Dois relógios que não devem ser misturados:**
- `evaluation_deadline_at = selected_at + 36h`: quando expira sem avaliação, **encerra o pedido**.
- `next_choice_deadline_at = invalid_evaluation_confirmed_at + 36h`: quando expira sem nova escolha, **mantém pedido Em avaliação**, bloqueado, até retorno; não gera punição adicional.

## 3. FECHAMENTO EM LOTE DAS PENDÊNCIAS (DEFAULTS R-01 A R-20)

As regras abaixo encerram decisões operacionais do MVP, exceto requisitos legais e verificações técnicas indispensáveis para produção, que não podem ser afirmados sem verificação. A coluna “efeito” descreve o comportamento a implementar.

| Origem | Resolução v3.0 | Efeito para o MVP |
|---|---|---|
| R-01 / PEN-01 — pontos e reputação | **Pontuação:** +10 para autor de indicação confirmada **válida**; 0 por enviar, ser selecionado, ser inválido ou não ser escolhido; **−5 para o solicitante** que deixar vencer as 36h de avaliação. Nunca gerar pontos duas vezes pelo mesmo evento. **Reputação pública:** índice de acerto `100 × válidas / (selecionadas avaliadas)` arredondado; quando não houver avaliações, exibir **“Sem avaliações”**, não `0%`. Comparação ordena primeiro por usuários com avaliação e maior índice, depois por número absoluto de indicações válidas; usuários sem avaliações após esses; empates por chave pseudoaleatória estável por rodada. | Não converter pontos legados automaticamente em avaliações válidas nem apagar `reward_events`; manter ledger histórico e criar eventos novos idempotentes e identificáveis. Comportamento dos pontos antigos no ranking deve ser compatibilizado sem perda. |
| R-02 / PEN-02 — exclusão do pedido | **Resolvida por DEC-08:** depois da primeira abertura da comparação, não permitir excluir. | A permissão de cancelar/excluir não pode depender só de `status === OPEN`. |
| R-03 / PEN-03 — resposta apresentada | Considerar **apresentada quando o backend autoriza e entrega seu conteúdo em resposta à comparação**, inclusive atualizações automáticas; registrar em transação, antes de disponibilizar o payload ao solicitante. | `presented_at` ou equivalente, imutabilidade atômica; falha de renderização após entrega não libera edição. Evitar prefetch/rotas que registrem visualização antes de ação efetiva. |
| R-04 / PEN-04 — novas respostas | **Resolvida por DEC-07:** atualização incremental **a cada 5 segundos** enquanto a comparação estiver visível; quando aba voltar ao foco, sincronizar imediatamente; recuperar após falha de rede sem duplicar itens. SSE é melhoria futura, não pré-requisito. | Polling autenticado somente ao dono, com cursor e controle de carga; sem reload completo. |
| R-05 / PEN-05 — inatividade após invalidar | **Resolvida por DEC-09:** 36h para próxima escolha; ao vencer, pedido permanece Em avaliação, sem novos envios e sem autoencerramento. | Relógio separado de avaliação. Retorno permite selecionar mesmo depois de vencido. |
| R-06 / PEN-06 — encerramento voluntário | Status visível **“Encerrado sem solução”**; permitido quando todas as indicações da rodada forem inválidas ou, após a primeira comparação, quando o solicitante optar por encerrar sem selecionar nenhuma. Confirmar ação. Sem penalização de pontos por encerramento voluntário. | Não equivale a excluir pedido: preservar histórico, respostas próprias e restrições de participação. |
| R-07 / PEN-07 — resultados individuais | **Não escolhida:** apenas “Pedido concluído” (DEC-10). **Escolhida e válida:** “Sua indicação foi validada”. **Escolhida e inválida:** “Sua indicação foi considerada não válida”, com motivo/justificativa próprios. Outras informações de terceiros sempre ocultas. | Sem contagem dos outros, vencedor ou status “Não selecionada”. |
| R-08 / PEN-08 — erro antifraude | Mensagem neutra: **“Não é possível enviar outra indicação neste momento. Tente novamente mais tarde.”** | Sem revelar que os pedidos pertencem ao mesmo solicitante ou informar identificadores. |
| R-09 / PEN-09 — desistência durante avaliação | Solicitante **não pode cancelar ou pular** uma indicação selecionada sem avaliá-la. Deve avaliá-la como válida/inválida ou deixar expirar o prazo. | Previne desvio do fluxo; avaliação inválida exige motivo. |
| R-10 / PEN-10 — validações de conteúdo | Título do pedido **1–120 caracteres**, detalhes **0–2.000**, foto opcional **1 arquivo JPEG/PNG/WebP de até 5 MB**, descrição da indicação **1–500 caracteres**, cada URL **até 2.048 caracteres**, somente `http/https`, links sem limite funcional fixo de quantidade com **limite técnico total de payload de 64 KB** para prevenir abuso. Validar MIME real, tamanho, texto sanitizado e URLs no servidor. | Ajustar validações existentes preservando dados legados; não buscar/seguir URLs do usuário no backend. |
| R-11 / PEN-11 — Maps | Reutilizar **Google Places já integrado**. Local físico é opcional, no máximo 1; se local físico não for encontrado ou integração falhar, permitir **nome + endereço manuais**. Sem local para produtos online; nunca calcular distância. Guardar apenas dados necessários e identificador quando permitido pelos termos vigentes. | Uso/armazenamento da API devem observar termos atuais e credenciais existentes. |
| R-12 / PEN-12 — notificações | **MVP somente in-app** para solicitante receber indicação e para autor quando a **própria indicação** for selecionada ou avaliada. Aviso in-app ao solicitante **12 horas antes de expirar** a avaliação selecionada, uma vez por seleção. **Sem notificação específica ao indicador** sobre encerramento por falta de avaliação ou exaustão das reaberturas. Sem e-mails automáticos de negócio no MVP além dos fluxos de autenticação atuais. | Evitar expor solicitante e dados de terceiros; persistir deduplicação. |
| R-13 / PEN-13 — exclusão e retenção | Exclusão lógica imediata da visualização e APIs comuns; manter **registro mínimo antifraude por até 180 dias** após exclusão e **logs restritos de segurança por até 365 dias**, com expurgo seguro quando não houver obrigação legal superior; fotos excluídas da mídia acessível imediatamente e removidas do armazenamento em até 30 dias; não reutilizar esses dados em interfaces. | **Política operacional proposta**, sujeita à revisão de privacidade/LGPD antes de produção. Não afirmar conformidade legal automática; documentar base legal, pedidos do titular e exceções. |
| R-14 / PEN-14 — patrocínio | **MVP com patrocínio cadastrado/ativado pelo administrador**, sem checkout, cobranças ou contrato automatizados. **No máximo um patrocinador ativo por ranking de cidade por intervalo de tempo**, com vigência `[inicio, fim)`; exibir nome, logo e “Patrocinado por” somente enquanto ativo. | Empresas por CNPJ; sem perfil público, busca comercial ou pagamento antes de uma especificação comercial futura. |
| R-15 / PEN-15 — pedidos sem respostas | Pedido Aberto **não expira automaticamente** por ausência de indicação. Antes de abrir a comparação, solicitante pode excluir segundo regras estabelecidas; depois dela, pode encerrar voluntariamente sem solução, mas não excluir. | Nenhum job de encerramento de pedidos simplesmente sem respostas. |
| R-16 / PEN-16 — ordenação | Utilizar **índice reputacional definido em R-01**, depois quantidade de válidas; desempate pseudoaleatório estável por sessão/rodada. | Sem depender de fórmula futura para liberar comparação. Não reordenar elementos bruscamente enquanto o usuário lê; novas respostas se encaixam de modo previsível. |
| R-17 / PEN-17 — concorrência/reabertura | Máximo **3 reaberturas** depois da publicação inicial. Nova rodada aceita apenas participações novas; autores antigos continuam inelegíveis. Seleção, envio, exibição, avaliação, reabertura, limite e pontos transacionais/idempotentes, com ordem de bloqueios definida. | Não perder histórico, não duplicar avaliação nem permitir envio após confirmação de seleção. |
| R-18 / PEN-18 — autenticação e administração | **Preservar autenticação, recuperação de senha, sessão e papéis existentes**, ajustando apenas autorização necessária ao novo produto. Não reescrever sistema de login. | Empresa não pode pedir/indicar; admin opera patrocínio e suporte com RBAC. |
| R-19 / PEN-19 — comparação inicial sem escolha | **Não existe timeout** depois de abrir a comparação pela primeira vez sem selecionar. Pedido continua Aberto e recebendo indicações. O solicitante pode encerrar voluntariamente sem solução, mas não excluir depois da primeira comparação. | Diferente de DEC-09; não criar prazo automático na primeira comparação. |
| R-20 / PEN-20 — entrega em tempo real | Polling da comparação **a cada 5s com aba visível**, sincronização ao retomar foco; em segundo plano usar pausa ou intervalo maior; reconectar e deduplicar após falha. | Sem cron para atualizar navegador; servidor checa permissão a cada consulta. Métrica de monitoramento, sem prometer entrega exata em redes instáveis. |

**Escopo que permanece fora do MVP, sem impedir implementação:** contratação/pagamentos comerciais automáticos, catálogo de empresas, exploração pública de perfis, métricas analíticas avançadas e fórmula estatística alternativa de reputação. Isso é **escopo excluído**, não pendência de decisão. **Verificações obrigatórias pré-produção:** autorização, proteção de dados e política legal de retenção, backups/restauração, configuração do cron e comportamento real das APIs de terceiros.

## 4. Navegação, perfil e permissões

- **Home autenticada:** exatamente três CTAs verticais: `Pedir uma indicação`, `Fazer uma indicação`, `Minhas indicações`; a seção `Meus pedidos` fica dentro da primeira. Não criar quarta CTA principal nem deixar feed público como destino principal.
- **Perfil comum:** nome de usuário único, foto, cidade editáveis sem aprovação; reputação pública contextual; não há diretório ou busca geral de pessoas. Cidade do perfil é filtro inicial em `Fazer uma indicação`, mas pode ser trocada sem mudar perfil ou pedidos antigos.
- **Privacidade:** indicador vê pedido elegível com título, cidade, detalhes e foto se houver, **nunca a identidade do solicitante**. Abrir um perfil não permite ler pedidos/indicações de terceiros. Solicita-se autorização por recurso no backend, não apenas escondendo campos no JSX.
- **Empresas:** cadastro por CNPJ único; unidade/estabelecimento com cadastro próprio; não possui funções de pedir/indicar; exibição patrocinada apenas no ranking com as regras R-14.
- **Lista Fazer uma indicação:** filtrar cidade; excluir pedidos próprios e aqueles já respondidos; mostrar pedidos Em avaliação apenas em modo resumido/informativo e sem ação de enviar; rolagem infinita com paginação estável e sem duplicatas; lista vazia: “Não há pedidos disponíveis no momento.”; não mostrar total de indicações.

## 5. Pedidos

- Criar: título obrigatório 1–120, cidade obrigatória, detalhes e no máximo uma foto opcionais; sem categoria/tags; cidade inicialmente do perfil, mas usuário pode trocar; prévia antes de publicação e confirmação expressa; sucesso volta à home, status Aberto, novo pedido no topo de Meus pedidos.
- Editar pedido: permitido **somente antes da primeira indicação recebida**, validado pelo servidor.
- Excluir pedido: permitido antes da primeira abertura efetiva da comparação, ainda que tenha recebido indicações, desde que as demais restrições do servidor sejam satisfeitas. A partir da primeira abertura: **proibido** (DEC-08). Ocultar pedido excluído em Meus pedidos/Minhas indicações, APIs e links diretos. Retenção técnica somente para prevenção a fraude/auditoria.
- Encerramento voluntário após comparação aberta e nenhuma escolha: opção separada de exclusão, com confirmação, status “Encerrado sem solução” e preservação de histórico (R-06/R-19).
- Meus pedidos: título, cidade, status sem contador; ordenação mais recente primeiro; detalhe pode mostrar pedido original e indicação validada quando concluído.

## 6. Indicações

- Autor pode responder no máximo uma vez por pedido por toda a vida do pedido, inclusive se excluiu a própria indicação ou após reabertura.
- **Antifraude 24h:** impedir nova indicação a qualquer pedido do mesmo solicitante nas 24h corridas desde o último envio; validação atômica via servidor; mensagem neutra R-08.
- Formulário: descrição 1–500, URLs opcionais 0..N (validações técnicas R-10), um local Maps opcional ou local manual (nome/endereço), ou sem localização para online. Prévia e confirmação de envio; rascunho mantido enquanto navega durante a sessão, não há obrigação de persistir após reload.
- Autor pode editar/excluir apenas **antes que sua resposta seja apresentada** na comparação. A exclusão não reabilita a participação. Ao apresentar pela primeira vez, persistir `presented_at` antes de entregar conteúdo; bloquear edição/exclusão no servidor (DEC-06).
- Uma indicação deve ser revalidada no instante do envio contra status, autorização, participação, janela antifraude e bloqueios transacionais. Após sucesso vai para histórico `Minhas indicações`.
- Diferentes autores podem indicar mesmo local, sem fusão de autoria. Não calcular distâncias. Links abrem com segurança.

## 7. Comparação, seleção e avaliação

1. O **dono** abre comparação por ação explícita; servidor registra `first_comparison_opened_at` de modo durável. Isso impede excluir pedido a partir daquele instante, mas **status continua Aberto e novos envios permanecem permitidos**.
2. Ao carregar comparação, servidor autoriza e disponibiliza **todas as respostas disponíveis** com conteúdo completo, links, local e métricas permitidas de reputação, sem IDs ou dados de identidade dos autores. Registrar atomica e individualmente apresentação das respostas entregues (DEC-06).
3. Não mostrar widget de **contador explícito** de respostas do pedido. Como o dono consegue ver as respostas completas, reconhece-se que ele **pode inferir a quantidade**; não prometer ocultação matematicamente impossível.
4. Novas respostas enviadas durante comparação Aberta aparecem **automaticamente** (R-04/R-20) e também recebem registro de apresentação antes do payload ser entregue. Atualização incremental não altera o status.
5. Ordenar por índice reputacional, quantidade de válidas, empate estável (R-01/R-16). Não exibir nome/foto dos autores antes da escolha, nem oferecer links indiretos aos seus perfis.
6. Ao **confirmar** determinada indicação, transação verifica se continua elegível, muda status para **Em avaliação**, rejeita novos envios, registra autor escolhido e `evaluation_deadline_at = selected_at + 36h`, revela **apenas identidade do escolhido** e restringe na UI/API leitura adicional das demais respostas enquanto aquela está em teste.
7. **Indicação válida:** confirmação adicional; pedido Concluído; recompensa +10 ao indicador selecionado; não selecionados veem só conclusão genérica. Histórico preservado; outras respostas não disponíveis na UI/API do solicitante após concluir.
8. **Indicação inválida:** exigir escolha de motivo predefinido: “Informação incorreta ou insuficiente”, “Produto ou serviço indisponível”, “Estabelecimento fechado ou inexistente”, “Não foi possível entrar em contato”, “Outro motivo”; comentário opcional. Avaliação definitiva, sem alteração posterior; indicador da própria resposta pode ver sua justificativa. Se houver opções restantes, abrir comparação delas (já recebidas), iniciar relógio de escolha DEC-09 (36h); **pedido permanece Em avaliação, não aceita novos envios**.
9. **DEC-09:** ao completar 36h sem próxima escolha não transitar status; apenas marcar prazo vencido. Solicitante retorna e pode escolher outra indicação, que terá novo prazo de avaliação 36h. Não emitir multa adicional de pontos nem desbloquear envios.
10. **Avaliação não realizada em 36h:** encerrar automaticamente como “Encerrado por falta de avaliação”, registrar `close_reason`, aplicar −5 pontos ao solicitante uma única vez e preservar histórico; sem notificação específica ao indicador pelo fechamento.
11. **Sem opções restantes:** oferecer encerrar ou reabrir, com confirmação. Máximo de três reaberturas; após esgotadas e todas inválidas, “Encerrado — nenhuma indicação válida” e botão “Criar novo pedido”. Reabrir permite só **novas** respostas; antigos autores continuam inelegíveis. Nova primeira/segunda/terceira seleção continua com 36h cada.
12. **Impossibilidade de revogar informações já apresentadas:** a interface deve deixar outras respostas indisponíveis durante avaliação e após conclusão, mas conteúdo previamente entregue ao solicitante não pode ser apagado da memória do usuário. Nunca anunciar garantia de sigilo retroativo.

## 8. Estados e transições

| Estado público | Pode receber? | Como entra | Como sai |
|---|---|---|---|
| `Aberto` | Sim | Publicação/reabertura | Escolha confirmada → Em avaliação; encerramento voluntário → Encerrado sem solução. Abrir comparação **não muda estado**. |
| `Em avaliação` | Não | Escolha confirmada | Válida → Concluído; inválida com alternativas → continua Em avaliação aguardando escolha (inclusive DEC-09 vencida); sem alternativas → reabre ou encerra; timeout da seleção → Encerrado por falta de avaliação. |
| `Concluído` | Não | Escolha válida confirmada | Terminal |
| `Encerrado por falta de avaliação` | Não | Timeout de 36h da indicação selecionada | Terminal |
| `Encerrado sem solução` | Não | Encerramento voluntário | Terminal |
| `Encerrado — nenhuma indicação válida` | Não | Final da quarta rodada sem sucesso (original + 3 reaberturas) | Terminal |

**Estados internos adicionais, sem virar status público:** primeiro acesso à comparação; datas de apresentação de cada indicação; seleção ativa; relógio de avaliação; relógio de próxima escolha; rodada (0..3); final de seleção e pontos idempotentes. É proibido usar `REVEALED` como estado que bloqueia novos envios apenas por abrir comparação.

## 9. Banco, API e concorrência (contrato de implementação)

- **Preservar o schema existente e evoluir por migrations incrementais reversíveis ou compensáveis:** não renomear enums existentes cegamente; planejar compatibilidade de registros `OPEN`, `REVEALED`, `RESOLVED`, `CLOSED_NO_RESULT`, `CANCELED`; produzir tabela de mapeamento e plano de rollback antes de alterar migrations.
- Campos/eventos sugeridos, ou equivalentes: `requests.first_comparison_opened_at`, `requests.reopen_count`, `requests.current_round`, `requests.selected_indication_id`, `requests.evaluation_started_at`, `requests.evaluation_deadline_at`, `requests.next_choice_started_at`, `requests.next_choice_deadline_at`; `indications.presented_at`; tabela de avaliações/justificativas imutáveis; ledger de pontos idempotente; log de transições e `close_reason`; patrocínio com `company_id/city_id/starts_at/ends_at/logo`.
- **Ação de entrar na comparação** não pode ser disparada por prefetch de rota/crawler nem por simples render de listagem; usar ação autenticada explícita que faz a marcação da primeira abertura e entrega respostas anônimas. Cada consulta incremental atualiza `presented_at` para apenas novos itens realmente entregues. Após apresentação, a API de editar/excluir recusa alterações.
- **Ordem de locks:** travar o pedido para selecionar, enviar, avaliar e encerrar; validar estado dentro da mesma transação, com `FOR UPDATE` ou mecanismo seguro equivalente. Impedir duas seleções simultâneas, double-click, duplicidade e corrida entre envio e bloqueio.
- **Job do prazo de avaliação**: idempotente, checar prazo e status atual ao executar, nunca fechar se avaliação válida já foi persistida; não confundir com relógio DEC-09. Configurar cron no ambiente de hospedagem real; com relógio do servidor e timestamps UTC no banco.
- **Poll de comparação** autorizado para dono, sem perfis nem IDs de autoria retornados; deduplicar por ID opaco de indicação, sem expor `recommender_id`. Evitar `router.refresh` integral como única estratégia.
- **Ranking:** não reexecutar +10 legados, registrar novos pontos de maneira distinguível; cálculo de reputação usando avaliações válidas / avaliações efetivamente realizadas, e não o número bruto de envios.
- **Segurança:** proteger IDOR por recurso, testar papéis de empresa/admin/member, rate limits, MIME e tamanho de uploads, links seguros, ausência de solicitante e indicador em serializações não autorizadas, logs sem PII desnecessária.

## 10. Critérios de aceite obrigatórios — mínimos de liberação

| ID | Cenário | Resultado obrigatório |
|---|---|---|
| AC-01 | Abre comparação pela primeira vez | Pedido continua Aberto; marca primeira abertura; não pode mais excluir. |
| AC-02 | Dois indicadores enviam enquanto a comparação está aberta | Envios aceitos se elegíveis; respostas surgem automaticamente, sem reload. |
| AC-03 | Resposta entregue na comparação | Persistir `presented_at`; autor não consegue editar nem excluir via UI ou API. |
| AC-04 | Comparação aberta | Todas as respostas completas são visíveis ao dono sem identidade dos indicadores e sem contador explícito. |
| AC-05 | Indicador abre pedido | Solicitante anônimo na tela e em payloads de API. |
| AC-06 | Confirma indicação para teste | Somente então bloqueia novos envios, revela autor selecionado e inicia 36h. |
| AC-07 | Primeira, segunda, terceira escolha | Cada uma recebe 36h corridas integrais. |
| AC-08 | Invalida com justificativa e restam opções | Inicia relógio de escolha 36h, estado permanece Em avaliação. |
| AC-09 | DEC-09 vence e usuário não retorna | Não reabre, não encerra e não permite novos envios. |
| AC-10 | Usuário retorna após DEC-09 vencida | Pode escolher opção restante e inicia novo relógio de avaliação de 36h. |
| AC-11 | 36h de avaliação vence | Encerra pedido, registra penalidade −5 uma vez; late evaluation rejeitada. |
| AC-12 | Indicação válida | Conclui pedido, atribui +10 uma vez ao autor e torna outras indisponíveis. |
| AC-13 | Indicação não escolhida quando pedido é concluído | Autor vê somente “Pedido concluído”, sem detalhes dos demais. |
| AC-14 | Autor da indicação invalidada vê histórico | Só seu motivo/justificativa; não vê respostas de terceiros. |
| AC-15 | Tentativa de novo envio ao mesmo solicitante em 24h | Rejeitada no servidor, mensagem neutra. |
| AC-16 | Excluir indicação antes da apresentação e tentar outra | A anterior some da UI; segunda participação é proibida. |
| AC-17 | Reabre 3 vezes | Reaberturas 1,2,3 permitidas; 4ª rejeitada; autores anteriores não repetem. |
| AC-18 | Encerra voluntariamente depois de abrir comparação | Status Encerrado sem solução; preserva histórico; não é exclusão. |
| AC-19 | Sem indicações por longo período | Continua Aberto; sem encerramento automático. |
| AC-20 | Lista Fazer uma indicação | Cidade padrão, anonimato, status Em avaliação sem CTA, paginação sem duplicidade. |
| AC-21 | Indicação apenas online | Descrição e links são aceitos sem local Maps. |
| AC-22 | Maps indisponível | Permite nome/endereço manuais sem falhar envio. |
| AC-23 | Ranking patrocinado vigente | Nome, logo e “Patrocinado por”; ao vencer, não exibe mais; não criar perfil comercial público. |
| AC-24 | Corrida simultânea selecionar × enviar | Estado transacional determina apenas uma sequência válida; jamais aceitar envio após bloqueio. |
| AC-25 | API direta para ler resposta de pedido alheio | Rejeitar; não retornar autores ou solicitantes indevidos. |
| AC-26 | Job de avaliação executa repetidamente | Fecha e penaliza apenas uma vez, mantendo histórico íntegro. |
| AC-27 | Atualiza perfil/cidade | Cidade padrão muda; pedidos antigos mantêm cidade. |
| AC-28 | Logout/login ou aba em segundo plano na comparação | Reautorizar, recuperar atualizações e bloquear edições já apresentadas. |
| AC-29 | Contratos antigos `REVEALED/RESOLVED` no banco | Dados preservados, mapeamento auditável e sem regressões silenciosas. |
| AC-30 | `npm run typecheck`, testes e build | Passam; exceções preexistentes documentadas com solução antes de declarar MVP pronto. |

## 11. Plano de implementação vinculado às decisões

**Fase 0 — baseline e segurança:** conferir commit, rotas e `package.json` (auditorias tiveram versões e nomes de rotas divergentes), mapear migrations e dados legados; corrigir erros existentes de TypeScript; backups e plano de rollback; eliminar vazamentos de identidade de solicitante e de indicadores, sem quebrar autorização. Validar testes de acesso.

**Fase 1 — modelo de dados e operações centrais:** migrations incrementais com `first_comparison_opened_at`, `presented_at`, eventos de seleção/avaliação/rodada, migração de `reveal_responses`; comparação completa anônima sem bloquear; bloqueio de exclusão na primeira comparação; imutabilidade após apresentação; concorrência.

**Fase 2 — escolha, avaliação, deadlines e histórico:** confirmar escolha bloqueia envio, seleciona autor e inicia 36h; válida/inválida com motivos, job idempotente, penalidade e pontos; espera DEC-09 com 36h e retomada; status genéricos e visão de resultado próprio.

**Fase 3 — reabertura, elegibilidade e interface:** reaberturas 0..3, antifraude 24h, novo formulário com links/Maps opcional/manual, 3 CTAs e listas Meus pedidos/Minhas indicações; comparação com atualização automática a cada 5s.

**Fase 4 — empresas, rankings e acabamento:** patrocínio admin e exibição com vigência; reputação/ordenação R-01; validações de mídia e URLs; notificações in-app; UX responsiva.

**Fase 5 — testes e liberação:** testes AC-01..AC-30, testes existentes de regressão, migração de dados legados, ambientes de staging e revisão de privacidade; somente publicar com validação da produção e backups aprovados.

**Execução:** implementar de forma incremental; executar `typecheck`, testes e build por fase quando possível; relatar resultado, arquivos alterados, migrations, riscos e itens não concluídos. Não fazer deploy automático nem executar migrations em produção sem autorização explícita.

## 12. Definition of Done

- Todas DEC-01..DEC-10 e R-01..R-20 respeitadas ou exceção documentada com justificativa técnica real.
- Testes de regressão e de concorrência adequados, rotas existentes verificadas e código tipado.
- Nenhuma PII de solicitante ou indicador exposta a pessoas sem autorização, inclusive em APIs e jobs.
- Eventos de avaliação, expiração, reabertura, apresentação e pontos persistidos e idempotentes.
- Dados anteriores preservados com migrations seguras e política de rollback.
- Sem dependência de novo ciclo de decisões funcionais para implementar MVP descrito aqui.
- Avaliação obrigatória de privacidade/LGPD e verificação técnica dos serviços externos antes do deploy.

## 13. Changelog

- **v3.0:** encerramento em lote das antigas PEN-01..PEN-20 por defaults R-01..R-20, distinção de regras previamente confirmadas, critérios de aceite e ordem de implementação. Autorização para a IA implementadora é dada no **prompt executor separado**, não neste arquivo isoladamente.
- **v2.2:** DEC-09 em 36h, permanecendo bloqueado após vencimento.
- **v2.1:** DEC-06 a DEC-10.
- **v2.0:** DEC-01 a DEC-05 e consolidação dos três documentos históricos.
