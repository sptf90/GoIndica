# Análise do GoIndica — 7 de outubro de 2026

O GoIndica já tem o núcleo de um MVP funcional: uma pessoa publica um pedido, outras indicam estabelecimentos, o autor revela as respostas e confirma o resultado, e o banco recompensa as indicações elegíveis. Minha prioridade seria melhorar o retorno dos usuários, a utilidade do histórico e a operação do serviço.

Esta análise considera a especificação, a documentação, as rotas e componentes de produção, autenticação, APIs, consultas, migrations, testes e CI. Os achados abaixo distinguem comportamento observado no código, lacunas da especificação e propostas de evolução. Não foram feitas alterações nas funcionalidades nem escritas em serviços remotos.

## Verificação realizada

| Verificação                                    | Resultado nesta análise                                                       |
| ---------------------------------------------- | ----------------------------------------------------------------------------- |
| ESLint                                         | Aprovado, sem warnings                                                        |
| TypeScript                                     | Aprovado                                                                      |
| Vitest                                         | 78 testes aprovados em 5 arquivos                                             |
| Build de produção                              | Aprovado, usando `.next-review`                                               |
| Playwright                                     | 41 testes aprovados no Chromium                                               |
| Auditoria npm de dependências de produção      | 0 vulnerabilidades conhecidas reportadas                                      |
| Inspeção visual                                | Screenshots representativas de feed e detalhe em celular                      |
| Experimento adicional no PostgreSQL temporário | Confirmou que a métrica de resolução agrega `INDICATED_PLACE` e `OTHER_PLACE` |

Os E2E executam PostgreSQL real e fixtures HTTP de Supabase/Google. Eles não confirmam SMTP, login nos provedores reais, billing, quotas externas ou configuração de produção. Safari, Firefox, aparelhos físicos, carga simultânea e recuperação de backup não foram validados nesta análise. A ausência de vulnerabilidades conhecidas nas dependências de produção não equivale a uma auditoria completa de segurança.

## O que está bem resolvido

- **Regras de negócio no banco.** Constraints, triggers, RLS e RPCs protegem identidade, autoindicação, uma indicação por pessoa, estados e recompensas.
- **Concorrência e integridade.** Indicação, revelação e resolução usam locks; a resolução e o ledger são transacionais. Há testes de concorrência, rollback e confirmação repetida.
- **Recompensa por resultado.** Todas as pessoas elegíveis que indicaram o local confirmado recebem os pontos, sem premiar apenas o primeiro indicante.
- **Autenticação.** Login, cadastro, confirmação de e-mail e recuperação possuem fluxos implementados e testes. As actions verificam o usuário no servidor.
- **Cidades e estabelecimentos.** Município estruturado pelo catálogo IBGE e validação oficial dos componentes de endereço evitam confiar em cidade enviada pelo navegador.
- **Interface.** Componentes compartilhados, estados de erro, preservação dos campos após falha, navegação por teclado e verificações de responsividade oferecem uma base consistente.
- **Entrega técnica.** Há documentação, migrations, lockfile e CI com lint, tipos, testes, build e E2E.

## Correções e melhorias técnicas prioritárias

### 1. Atualização de cidades sobrescreve uma migration aplicada

**Confirmado por leitura do código. Prioridade alta antes de atualizar o catálogo.**

`scripts/import-cities.ts:28` grava sempre em `supabase/migrations/202610040002_cities.sql`, inclusive com a data fixa de 4 de outubro. Se essa versão já foi aplicada, modificar o arquivo não faz o `db push` executá-la novamente. O fluxo recomendado no README pode, portanto, atualizar o arquivo local e deixar o catálogo remoto antigo. O Supabase executa apenas migrations ainda não registradas no histórico. [Documentação oficial de migrations](https://supabase.com/docs/guides/deployment/database-migrations#how-migration-tracking-works).

**Proposta:** gerar uma nova migration com timestamp e data corretos a cada atualização, preservar os arquivos aplicados e exibir um resumo das alterações do catálogo.

**Aceite:** um banco com todas as migrations atuais aplicadas recebe a atualização por uma nova migration, sem recriar o banco.

### 2. Falhas de serviço podem parecer bloqueio da conta

**Confirmado por leitura do código. Prioridade alta.**

Em `src/server/auth.ts:15`, erros de `account_state` que não sejam dois códigos específicos viram `/entrar?motivo=bloqueado`. Uma indisponibilidade pode mostrar a mensagem de conta bloqueada ou indisponível, dificultando entender o problema. Na linha 20, o erro da consulta de perfil é ignorado; perfil ausente por falha de leitura pode levar ao onboarding.

**Proposta:** distinguir bloqueio explícito, sessão expirada, perfil realmente ausente, schema não preparado e indisponibilidade temporária; registrar as falhas técnicas de forma sanitizada.

**Aceite:** uma falha temporária de `account_state` ou `profiles` apresenta opção de tentar novamente e não inicia o onboarding de um usuário existente.

### 3. Consultas ao Google crescem com os grupos mostrados

**Comportamento confirmado; impacto de custo e latência ainda precisa de medição. Prioridade alta para o piloto.**

`src/app/(member)/pedidos/[id]/page.tsx:59` busca detalhes de até dez locais por renderização. Cada `livePlace` consome o mesmo limite de detalhes usado para enviar uma indicação (`src/server/queries.ts:31` e `src/server/actions.ts:122`). O limite no banco é de 30 detalhes por minuto, além do limite diário combinado. A deduplicação por `React.cache` vale para aquela renderização; não evita novas consultas em outros acessos.

Uma página com dez locais distintos pode consumir dez consultas em um acesso. Após esgotar a cota, `livePlace` retorna `null` sem distinguir o motivo; a interface pede para atualizar, e o botão de confirmar aquele local deixa de ser exibido. Também há consultas de grupos para pedidos cancelados, embora essa seção não seja renderizada.

**Proposta:** carregar grupos secundários sob demanda, destacar o local confirmado em pedidos encerrados, evitar consultas de grupos que não serão exibidos e oferecer mensagens diferentes para limite e indisponibilidade. Rever cotas por finalidade, mantendo proteção de custo. Medir chamadas, erros e tempo por jornada antes de alterar limites.

Os campos atuais incluem `displayName`, `businessStatus` e `googleMapsUri`, associados ao SKU Place Details Pro. Novos campos precisam de avaliação de custo. [Documentação oficial dos campos](https://developers.google.com/maps/documentation/places/web-service/place-details#fieldmask).

Qualquer estratégia de cache deve respeitar as condições do provedor; o armazenamento permanente de place IDs tem uma exceção específica. [Políticas oficiais do Places](https://developers.google.com/maps/documentation/places/web-service/policies#exceptions_from_caching_restrictions).

**Aceite:** navegar e paginar participantes não dispara consultas desnecessárias a todos os locais; erros de cota possuem orientação adequada.

### 4. Link compartilhado perde o pedido depois do login

**Confirmado por leitura do fluxo. Prioridade alta para aquisição.**

`ShareRequest` compartilha corretamente o endereço do pedido. Porém, `session()` envia visitantes para `/entrar`, e login por senha, callback Google, confirmação e conclusão do onboarding levam a `/app`. O destino original não é preservado.

**Proposta:** preservar o destino em todo o fluxo com uma lista de rotas internas permitidas e validação no servidor.

**Aceite:** uma pessoa sem sessão abre um pedido compartilhado, entra ou cria conta, conclui o perfil se necessário e volta ao mesmo pedido. URLs externas e destinos adulterados continuam rejeitados.

### 5. Métricas precisam separar os resultados e o período

**Confirmado no código e por experimento no PostgreSQL temporário. Prioridade alta para avaliar o produto.**

`admin_metrics` em `supabase/migrations/202610040001_core.sql:299` conta `INDICATED_PLACE` e `OTHER_PLACE` juntos como resolvidos. No experimento, dois pedidos — um de cada tipo — produziram `resolved = 2`, mas apenas um tinha local confirmado pelas indicações. Isso pode ser útil como taxa de sucesso geral, mas não mede isoladamente o valor das indicações.

O painel também mistura todas as cidades e datas, inclui pedidos removidos/cancelados no total e calcula tempo de resolução incluindo resultados sem sucesso. A liquidez usa a contagem atual de indicações, que pode mudar após moderação. O evento `SEARCH_REUSED` mede clique em um resultado, e não a quantidade de buscas que encontraram conhecimento nem sua utilidade confirmada.

**Proposta:** separar os três tipos de resultado, definir quais pedidos entram em cada denominador e oferecer filtros de cidade/período. Usar mediana e percentis além da média; acompanhar pedidos ainda sem indicação, onboarding concluído e retorno dos participantes. Distinguir resultado encontrado, clicado e útil.

**Aceite:** o operador consegue distinguir sucesso da comunidade, sucesso em outro local e ausência de resultado, com denominadores e janela de análise explícitos.

### 6. Analytics ignora erros retornados pela RPC

**Confirmado por leitura do código. Prioridade média.**

`src/app/api/analytics/route.ts:18` aguarda `record_analytics`, mas não verifica o campo `error` retornado pelo Supabase. Mesmo quando o registro falha, o endpoint pode responder 204 e gravar o cookie de deduplicação por 30 minutos. Parte dos eventos pode ser perdida silenciosamente. As chamadas de analytics no cliente também não tratam rejeições de rede.

**Proposta:** verificar o resultado da RPC, registrar erros sanitizados e definir o comportamento de deduplicação em falhas temporárias e limites. Tratar falhas no cliente para preservar a navegação.

**Aceite:** uma falha de persistência não é contabilizada internamente como entrega bem-sucedida nem fica invisível na operação.

### 7. Paginação de participantes é compartilhada entre grupos

**Confirmado por leitura do código. Prioridade média.**

O mesmo `peoplePage` controla todos os grupos (`src/app/(member)/pedidos/[id]/page.tsx:69`). Se um local tem 25 indicações e outro tem uma, avançar a página do primeiro também consulta a segunda página do outro. O segundo grupo passa a mostrar a contagem sem seu participante, e não tem paginação própria por possuir menos de 21 indicações.

**Proposta:** paginar participantes por grupo ou abrir seus participantes em uma expansão independente. Acrescentar desempate por ID às ordenações paginadas onde necessário.

**Aceite:** avançar participantes de um local mantém os participantes dos demais locais visíveis.

## O que falta completar no produto atual

| Área                   | Situação atual                                                                                                 | Evolução sugerida                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Histórico reutilizável | Sugestões no compositor e cards mostram descrição; local confirmado e data da resolução exigem abrir o detalhe | Mostrar data e contexto do resultado; disponibilizar o local sem gerar consultas externas para todos os cards indiscriminadamente     |
| Busca → publicação     | A busca do feed não transfere o texto ao formulário de novo pedido                                             | Oferecer “Publicar esta busca” com texto e cidade preservados                                                                         |
| Perfil próprio         | Exibe pontos, confirmações e acesso ao ledger; pedidos e indicações ficam em outra tela                        | Completar os contadores e atalhos previstos na seção 36 da especificação                                                              |
| Administração          | Denúncias são marcadas como revisadas; ações têm auditoria                                                     | Registrar motivo da decisão, responsável, data de revisão e filtros de status; apresentar contexto das pessoas em vez de apenas UUIDs |
| Cidade da landing      | Ranking e texto fixos em São José do Rio Preto                                                                 | Tornar a cidade piloto configurável e ajustar a apresentação ao plano de expansão                                                     |
| Conta e suporte        | Edição de perfil e recuperação disponíveis; demais solicitações dependem do operador                           | Oferecer exportação dos dados, alteração de credenciais e solicitação de encerramento com procedimento de anonimização definido       |
| Operação               | CI e logs de negócio presentes; não há integração de erros de aplicação em `src`                               | Monitorar falhas, dependências, disponibilidade e restauração de backups                                                              |

A especificação dispensa push no primeiro MVP. Portanto, notificações externas são uma evolução de produto, não um requisito obrigatório descumprido. Histórico com contexto e estatísticas do perfil já têm apoio na especificação.

## Adições com maior potencial de utilidade

1. **Central de notificações e badge de pendências.** Avisar sobre novas indicações, resultado confirmado e pontos recebidos. Antes da revelação, mostrar apenas que chegaram indicações, preservando os locais e autores protegidos pelo fluxo.
2. **Lembretes para concluir pedidos.** Mostrar pedidos com respostas aguardando decisão; permitir lembretes por e-mail com preferências. Isso pode ajudar a fechar o ciclo e gerar conhecimento reutilizável — hipótese a medir no piloto.
3. **Seguir pedidos e salvar descobertas.** Facilitar o retorno a pedidos interessantes e consultas recorrentes, sem precisar refazer a busca.
4. **Atualização da contagem de indicações.** Atualizar a quantidade enquanto a tela está aberta, por atualização periódica ou canal autorizado, sem revelar respostas privadas.
5. **Rascunho do pedido.** Preservar texto e cidade ao sair acidentalmente ou perder a conexão, com opção clara de apagar o rascunho.
6. **Preferências de cidades.** Além da cidade principal, permitir acompanhar outras cidades onde a pessoa costuma procurar ou contribuir.
7. **Reconhecimento por contribuição confirmada.** Marcos como primeira descoberta ou dez confirmações podem dar contexto à reputação, preservando as regras de pontuação existentes.
8. **Experiência instalável no celular.** Avaliar manifest e instalação após validar o uso recorrente; definir separadamente o que pode funcionar sem conexão.

Categorias, notificações externas, novos sinais de reputação e mudanças de visibilidade precisam ser tratados como decisões de produto. As sugestões não alteram as regras automaticamente.

## Manutenção e escala

- **Tipos do banco:** `database.types.ts` é mantido manualmente e declara `Relationships: []`. Gerar tipos a partir do schema reduz divergências e facilita consultas relacionadas.
- **Consultas do detalhe:** há várias leituras por grupo, inclusive perfis. Agrupar leituras quando possível e usar carregamento progressivo pode reduzir espera; medir antes e depois.
- **Busca:** a base já possui índice GIN em português. Validar o plano e o comportamento pelo PostgREST real, incluindo acentos, marcas e consultas com várias palavras. A fixture HTTP traduz a busca manualmente e não substitui essa verificação. Não há evidência nesta análise de que o índice esteja incorreto. [Documentação oficial do PostgREST](https://docs.postgrest.org/en/stable/references/api/tables_views.html#full-text-search).
- **Paginação e ranking:** testar com volume representativo antes de adotar cursores ou agregados persistidos; a implementação atual pode ser suficiente para o piloto.
- **CSS:** `globals.css` tem 2.750 linhas. Separar estilos de componentes e manter tokens compartilhados ajuda futuras alterações visuais; esse tamanho, sozinho, não prova problema de performance.
- **Ambiente:** validar variáveis obrigatórias por capacidade e diagnosticar configuração incompleta. `configured()` verifica apenas a existência das duas variáveis públicas do Supabase.
- **CI:** ampliar a cobertura com os casos encontrados, homologação dos contratos reais em ambiente dedicado e navegadores adicionais. Evitar testes que apenas repitam a implementação.

## Ordem que eu seguiria

| Etapa              | Entrega                                                                                                                         | Como avaliar                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1 — Confiabilidade | Corrigir importador, classificação de erros, destino após login, analytics e paginação de participantes; homologar o ciclo real | Usuário chega ao pedido compartilhado, falhas são recuperáveis e atualizações chegam ao banco existente |
| 2 — Fechar o ciclo | Badges, notificações internas, pendências e histórico mais informativo; melhorar métricas                                       | Mais pedidos recebem decisão; tempo até resposta e taxa de confirmação são visíveis por cidade/período  |
| 3 — Uso recorrente | Favoritos, acompanhamento, rascunhos, preferências e instalação no celular                                                      | Participantes voltam para ajudar e reutilizam descobertas                                               |

Minha hipótese de produto é que uma comunidade ativa na cidade piloto trará mais aprendizado inicial do que ampliar a quantidade de funcionalidades. O painel deveria ajudar a observar se os pedidos recebem ajuda, se o autor volta para confirmar e se outra pessoa consegue aproveitar o resultado depois.

As sugestões acima são propostas de trabalho. Configuração externa, custo real, comportamento sob carga e adequação operacional continuam dependendo de homologação e medição.
