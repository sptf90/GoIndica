# Operação das melhorias

## Banco e configuração

Aplique as sete migrations novas (`202610070001` a `202610070007`) em ordem após as anteriores. Use `npm run banco:migrar -- --dry-run` para conferir as pendentes antes de `npm run banco:migrar`. Os testes locais já aplicam o conjunto inteiro em bancos temporários; o projeto remoto não foi alterado nesta entrega.

Além das configurações de Auth e Places do README, `PILOT_CITY_ID` define o município IBGE da landing e do ranking piloto. O padrão é `3549805`. Configure domínio real, contato de suporte e chaves no gerenciador de secrets; placeholders da `.env.example` não habilitam integrações.

Para atualizar cidades, execute `npm run cities:update -- --dry-run`. O relatório compara o IBGE com as migrations locais e mostra municípios novos, alterados, iguais e antigos preservados. `npm run cities:update` cria uma migration nova com timestamp posterior às existentes; revise-a antes de aplicar. Não remove automaticamente municípios que já tenham vínculos no produto.

## E-mails de lembrete

São opcionais e desligados por padrão em cada conta. Configure `RESEND_API_KEY`, `EMAIL_FROM` com remetente verificado e `CRON_SECRET` com pelo menos 32 caracteres aleatórios. O SMTP usado pelo Supabase Auth para confirmação/recuperação é uma configuração separada.

No agendador da hospedagem, configure uma chamada **POST** para `/api/cron/reminders`, com header `Authorization: Bearer <CRON_SECRET>` obtido do cofre de secrets. Uma frequência inicial de 15 minutos permite retentativas; ajuste ao tamanho da fila. O endpoint não oferece um GET compatível com agendadores que aceitam somente esse método. Nenhum agendamento foi provisionado automaticamente.

Cada execução prepara lembretes de pedidos pendentes há mais de um dia e processa até cinco envios. Existe um lembrete por pedido por semana ISO, com consentimento e elegibilidade conferidos novamente antes do envio. A resolução do pedido, bloqueio/encerramento ou retirada do consentimento cancelam sua elegibilidade. Notificações internas também podem ser preparadas quando a pessoa abre a página de notificações.

A fila usa bloqueios com `SKIP LOCKED`, lease de 15 minutos, até cinco tentativas e retentativa após dez minutos. A chave do provedor é estável por job. Retentativas cessam após 23 horas da primeira tentativa, mantendo margem para a [janela de idempotência do Resend](https://resend.com/docs/dashboard/emails/idempotency-keys). Um envio pode ter sido aceito antes de uma falha de rede; não reenvie manualmente sem consultar o provedor. O painel `/admin?tab=operations` mostra pendências, entregas registradas e falhas por esgotamento de tentativas.

## Conta e atendimento

`/conta` permite baixar exportação JSON, solicitar mudança de e-mail, trocar senha, apagar o rascunho deste navegador e pedir ajuda/encerramento. Contas com senha devem confirmar a senha atual nas mudanças de credenciais. Homologue a confirmação de mudança de e-mail no Supabase e seus templates reais antes da liberação.

O administrador revisa solicitações em `/admin?tab=support`, registrando o motivo. O encerramento bloqueia a conta, executa soft delete no Auth e anonimiza perfil/textos, preservando os identificadores necessários ao ledger e às relações do banco. Se o provedor falhar, a solicitação permanece em processamento e pode ser retomada. Após iniciar esse processo, não se oferece recusa que reative uma identidade já apagada no Auth. Um administrador precisa transferir sua função antes de solicitar encerramento.

O histórico de pontos permanece vinculado a uma identidade anonimizada; isso deve constar da política de retenção do operador. A revisão do código não define prazos legais nem provisiona um processo externo de atendimento.

## Métricas e disponibilidade

Os filtros de datas do painel são dias UTC, com a data final inclusiva na interface. Métricas de pedidos usam a coorte de criação: acompanham os resultados dos pedidos criados no período. “Encontrado pela comunidade” considera somente `INDICATED_PLACE`; outros locais e não encontrado têm contadores próprios. Média, mediana e p90 usam apenas pedidos com o evento correspondente. Eventos de busca/onboarding usam o horário do próprio evento; analytics da landing é agregado por dia e não por cidade.

As confirmações são históricas e não prometem estoque atual. Nome/endereço Google são carregados ao abrir o local, sem persistência no banco ou service worker. A visualização possui cota própria de 30 por minuto e compartilha o limite diário de 300 operações Places por conta com os demais usos.

`GET /api/health` retorna apenas `{ "ready": true|false }`, com 200/503 e sem cache; verifica acesso ao catálogo e estrutura mínima de notificações. Não certifica SMTP, Google, filas ou toda a configuração do domínio. Configure uma sonda externa e alertas para 503/erros do servidor. Logs operacionais contêm contexto, código e horário, sem senha/token/consulta de usuário.

Rascunhos ficam no navegador por conta, expiram após sete dias e podem ser apagados. O modo offline exibe uma página neutra: ações exigem conexão. A instalação depende das capacidades e opções do navegador.

## Verificação e recuperação

```bash
npm run db:types:check
npm run tools:postgrest
POSTGREST_BIN=.test-tools/postgrest npm run verify:postgrest
npm run verify:scale
npm run verify:recovery
npx playwright install --with-deps chromium firefox webkit
npm run test:e2e
npm run test:e2e:cross
```

O instalador PostgREST está fixado na versão 16.4, valida SHA-256 e atende Linux x64. Em outro sistema, forneça seu executável via `POSTGREST_BIN`. O teste usa servidor PostgREST real, JWTs e PostgreSQL temporários, verificando leitura, parâmetros padrão, busca e negação de acesso. O E2E usa fixtures para Auth/Google e regras de banco reais.

Os verificadores de escala e recuperação recusam `TEST_DATABASE_URL`: sempre provisionam bancos temporários. O de escala cria 10 mil pedidos e mil indicações, confere resultados/paginação e o uso do índice de busca. Seus tempos são diagnóstico local, sem garantia de capacidade em produção.

Recuperação requer `pg_dump`/`pg_restore` compatíveis com PostgreSQL 18, disponível no [repositório oficial do PostgreSQL](https://www.postgresql.org/download/linux/ubuntu/). Se necessário, indique os executáveis com `PG_DUMP_BIN` e `PG_RESTORE_BIN`. O script restaura um dump em outro banco temporário e compara resoluções, recompensas e RLS; remove os dados e o arquivo ao terminar.

Esse ensaio não cria backups remotos. Configure backups/PITR no Supabase conforme o ambiente, retenção e alertas do operador. Faça um ensaio separado de restauração do projeto hospedado e de suas integrações antes de depender desse processo em produção. Homologação externa está em [HOMOLOGACAO.md](./HOMOLOGACAO.md).
