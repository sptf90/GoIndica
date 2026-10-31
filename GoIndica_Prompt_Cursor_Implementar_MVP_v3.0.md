# PROMPT PARA O CURSOR — IMPLEMENTAR GOINDICA MVP v3.0

## MISSÃO
Você é um arquiteto de software e engenheiro full-stack sênior responsável por **ADAPTAR E IMPLEMENTAR**, não apenas auditar, o GoIndica que já existe neste workspace.

**Documento vinculante:** leia INTEGRALMENTE `GoIndica_Especificacao_Definitiva_MVP_v3.0.md`, que deve estar na raiz do repositório, antes de executar qualquer modificação. Ele contém DEC-01..DEC-10 (decisões confirmadas), defaults R-01..R-20 (fechamento em lote das pendências), critérios AC-01..AC-30 e fases de implementação. **Em caso de conflito com docs de auditoria v2.0/v2.1/v2.2 ou implementação legada, prevalece o v3.0.** O arquivo v3.0 é o escopo funcional de trabalho; os defaults foram definidos para destravar a execução, não são afirmações de aceite histórico pelo usuário.

## AÇÕES OBRIGATÓRIAS

1. **Confirme o ambiente real** lendo `package.json`, `git status`, commit atual, rotas, actions, migrations MySQL, modelos, jobs e testes. Auditorias anteriores apresentaram nomes/versões divergentes; **não assuma que caminhos citados estão corretos**. Verifique os equivalentes reais.
2. **Execute a implementação**, fase a fase, com atenção ao menor conjunto seguro de alterações por módulo. Não recrie o sistema inteiro. Reuse autenticação, CNPJ, Google Places, infraestrutura de notificação, banco, layouts e testes existentes onde compatíveis.
3. Faça **migração de banco incremental, não destrutiva**, com scripts revisáveis, mapeamento explícito de `OPEN`, `REVEALED`, `RESOLVED`, `CLOSED_NO_RESULT`, `CANCELED` e procedimentos de reversão. **Não toque em banco remoto/produção nem rode migrations em produção sem autorização explícita.** Para testes, use banco de desenvolvimento/teste isolado quando disponível.
4. Corrija **vazamentos de privacidade** em UI **e no payload**: indicadores não podem ver solicitante; solicitante não vê autores na comparação antes de seleção; somente o escolhido é revelado na confirmação. Verifique acessos diretos/IDOR.
5. Substitua o fluxo `reveal_responses` por comparação anônima de todas as respostas, mantendo pedido Aberto e aceitando envios. **A primeira entrada** registra abertura e proíbe exclusão (DEC-08); **cada resposta apresentada** torna-se imutável (DEC-06), inclusive respostas novas durante polling automático (DEC-07).
6. Seleção confirmada muda para Em avaliação e bloqueia novos envios, revela apenas escolhido e inicia **36h de avaliação**. Avaliação válida ou inválida exige persistência e transação. Implementar motivos, encerramento automático idempotente, valores de pontos v3.0, histórico e até 3 reaberturas.
7. Implementar **DEC-09 corretamente**: após invalidar e havendo outras opções, iniciar **36h de inatividade para escolher outra**. Se vencer, manter Em avaliação e bloqueado até retorno; não fechar nem liberar envios. Ao escolher, iniciar **outros 36h de avaliação**. **Não confundir os dois timers.**
8. Implementar UI com **três ações principais**, listas, formulário descrição 500/links/local opcional/manual, ranking patrocinado com nome/logo/rótulo. Atualização da comparação a cada 5s quando visível, sem full reload e sem vazamento de autoria.
9. **Adote R-01..R-20 como defaults para este MVP**, sem solicitar ao usuário as mesmas decisões por etapas. Se houver uma impossibilidade técnica real, documente o bloqueio e continue os trabalhos independentes; não invente regras diferentes sem registrar desvio.
10. Criar/ajustar **testes unitários, integração e e2e** com foco nos casos AC-01..AC-30 e regressões legadas; `typecheck`, lint, tests e build. Corrigir erros prévios de TypeScript em notificações se ainda existirem, distinguindo-os de problemas introduzidos.

## ETAPAS DE EXECUÇÃO

### ETAPA 0 — Baseline e proteção
- Documente `git status`, branch e commit; preserve alterações preexistentes e não sobrescreva trabalho do usuário.
- Identifique migrations e ligação entre auth/requests/indications/reward_events/places/companies/ranking/notifications.
- Prepare mapa de alterações, scripts de migração e planos de rollback; identifique quais operações exigem autorização de produção.
- Corrija primeiro vazamentos de identidade e guards de leitura.
- Execute validações locais acessíveis.

### ETAPA 1 — Modelo e comparação
- Implemente persistência de primeira abertura, apresentação individual, seleção e estado de avaliação.
- API da comparação retorna respostas completas, anonimato e dados mínimos; entrada é ação explícita autenticada, não efeito de prefetch.
- Implemente envio ainda aberto após comparação, live updates a cada 5s sem reload, registro de apresentação atômico e impossibilidade de editar/excluir após entrega.
- Prove em testes as corridas de comparação×edição×envio×seleção.

### ETAPA 2 — Avaliação, dois timers e reaberturas
- Implemente decisão válida/inválida e justificativas; deadline 36h para cada seleção; job idempotente no ambiente configurável.
- Implemente DEC-09 com timer de 36h entre escolhas, vencimento não terminal e retomada posterior.
- Implemente no máximo 3 reaberturas, preservação de histórico e status individuais genéricos para não escolhidos.
- Implemente pontos e reputação v3.0 sem reaplicar recompensas legadas.

### ETAPA 3 — Jornadas, antiabuso e empresas
- Substitua o feed como home autenticada por três botões; insira Meus pedidos dentro de Pedir; implemente lista Fazer e Minhas.
- Formulários com prévia, limites, links, Maps opcional/manual; antifraude 24h com mensagem neutra.
- Ranking patrocinado com vigência e gestão administrativa mínima sem pagamentos.
- Notificações in-app aprovadas, testes de permissão, responsividade e limites de carga.

### ETAPA 4 — Testes e entrega
- Rode testes e registre as evidências por cenário AC-01..AC-30.
- Não declarar concluído se vazamento de privacidade, corrida crítica, timeout incorreto ou migration insegura persistirem.
- Entregue relatório com arquivos alterados, migrations criadas, comportamento antes/depois, testes realizados/falhos, débitos reais e riscos de deployment.
- **Não faça deploy ou migration no banco de produção sem minha autorização explícita.**

## REGRAS DE EXECUÇÃO E QUALIDADE

- **O objetivo é implementar, não gerar outra auditoria prolongada.** Uma checagem inicial curta é permitida para evitar regressão. Em seguida, altere o código realmente.
- Arquivos e código em português-BR quando for natural e consistente com a base, sem renomear indiscriminadamente código legível existente.
- Cada modificação de regra de negócio precisa de teste e validação do servidor, não apenas interface.
- Evite commits gigantes não verificáveis; organize as alterações por etapa e informe estado de execução.
- Preserve banco e eventos antigos. Nunca faça `DROP`, `TRUNCATE`, resets, mudanças destrutivas ou importação em produção para simplificar o trabalho.
- Proteja nomes, fotos e IDs pessoais em serialização, logs, payloads, notificações e links.
- Em `minhas-indicacoes`, quem não foi selecionado vê **apenas que o pedido foi concluído**. Quem teve a própria indicação invalidada pode ver somente seu próprio resultado/motivo.
- A comparação expõe todo conteúdo ao solicitante antes de escolher; portanto é possível inferir quantidade de respostas. **Não exiba contador explícito**, mas não prometa sigilo numérico impossível.
- Valide condições de corrida entre confirmar seleção e receber nova indicação, e entre marcar apresentação e o autor tentar editar/excluir.
- Disponibilize cron confiável para encerramento por avaliação não respondida e não o aplique ao prazo de inatividade entre escolhas.
- Se uma API de terceiro ou segredo impedir teste, use mocks/test doubles em teste e documente verificação pendente para produção; não simule que testes reais passaram.

## RELATÓRIO QUE DEVE ENTREGAR

1. **Progresso por etapa** (concluída, parcial, bloqueada por dependência real), com breve resumo do que foi alterado.
2. **Arquivos e migrations** criados/alterados; compatibilidade com schema legado.
3. **Matriz DEC-01..10 e R-01..20**, resultado em código e teste associado.
4. **Testes AC-01..AC-30** (passou, falhou, não executado + motivo).
5. **Segurança, concorrência, privacidade, timers e retenção**, com limitações concretas.
6. **Comandos de staging e próximos passos de deploy**, sem executá-los contra produção.

**Comece agora com a ETAPA 0 e siga implementando as ETAPAS 1–4, sem pedir uma nova rodada de decisões de produto.**
