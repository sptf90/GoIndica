# GoIndica

Aplicação Next.js com MySQL e autenticação própria, preparada para o plano **Web Unlimited da Hostinger**. O site, banco, fotos, sessões, catálogo de estabelecimentos e envio de e-mails ficam na Hostinger. A busca de estabelecimentos usa Google Places API (New), com chave privada no servidor. Não há dependência de Supabase, Google OAuth, Resend ou Vercel em execução.

A identidade visual usa laranja `#EC5E27` e branco suave `#FDFDF1`.

## Executar

Requer Node.js 22 ou 24 e npm. O hPanel pode executar a aplicação com Node 24.

```bash
npm ci
cp .env.example .env.local
# Preencha as credenciais de MySQL e SMTP no arquivo local.
npm run banco:migrar
npm run dev
```

As migrations em `database/migrations` criam o esquema e instalam os 5.571 municípios brasileiros. A busca de cidades é local. As sugestões automáticas de estabelecimentos consultam o Google Places.

## Publicar na Hostinger

As configurações conhecidas de `goindica.com.br` estão no arquivo privado `.env.hostinger`, ignorado pelo Git. Complete a senha do MySQL e a senha da caixa `contato@goindica.com.br` nesse arquivo. As senhas não são necessariamente iguais.

No hPanel, adicione uma **aplicação Node.js**, selecione Next.js e Node 24 e configure as variáveis de ambiente descritas em `.env.example`. Use `npm run build` para build e `npm start` para execução do código-fonte. A publicação e a transferência dos dados reais ainda exigem credenciais e acesso à conta.

Para gerar um pacote de execução pronto:

```bash
npm run build
npm run hostinger:pacote
```

O ZIP e o TAR.GZ incluem o servidor standalone, dependências de execução e arquivos estáticos; não incluem arquivos `.env`. Esse pacote inicia com `node server.js`. Para o fluxo de upload de código-fonte do hPanel, use o pacote fonte descrito em [HOSTINGER.md](docs/HOSTINGER.md).

O acesso por **SSH é opcional**. A aplicação pode ser publicada pelo hPanel, e o banco pode ser preparado a partir deste computador via Remote MySQL ou pelo phpMyAdmin.

## Preservar os dados existentes

A migração de código está separada da transferência dos dados reais. O sistema antigo não é apagado pelos scripts.

```bash
# Conexão direta PostgreSQL do projeto antigo, exclusivamente para exportação.
# Coloque SOURCE_POSTGRES_URL no arquivo .env.hostinger, sem publicar essa variável no hPanel.
npm run banco:exportar-origem -- --env=.env.hostinger
npm run banco:migrar -- --env=.env.hostinger
npm run banco:importar -- --env=.env.hostinger --input=.migration-data/supabase-export.json
```

A exportação usa um snapshot consistente e inclui usuários, hashes de senha, perfis, pedidos, indicações, resoluções, recompensas, denúncias, fotos, notificações, preferências, auditoria e fila de e-mails. Os IDs são preservados. A importação exige destino sem usuários e pedidos, usa transação e confere as contagens; uma falha nos dados causa rollback. Senhas bcrypt existentes continuam funcionando. Usuários sem senha usam a recuperação por e-mail. Sessões antigas são encerradas.

As fotos de perfil externas são copiadas uma única vez para armazenamento local. Os estabelecimentos antigos guardavam apenas o identificador do Google, sem nome/endereço. Seus IDs e vínculos com pedidos e recompensas são mantidos, mas nome/endereço devem ser completados em **Administração → Estabelecimentos**. A importação não inventa dados nem consulta Google Places.

Consulte o procedimento completo, incluindo manutenção, validação e retorno à versão anterior, em [HOSTINGER.md](docs/HOSTINGER.md).

## Acesso e administração

O cadastro exige confirmação por e-mail enviado pelo SMTP da Hostinger. Senhas novas usam scrypt com salt individual. Cookies de sessão são HttpOnly, SameSite=Lax e Secure em HTTPS. Tokens de confirmação e recuperação têm prazo, uso único e apenas seu hash é armazenado. Sessões de recuperação não permitem acessar páginas de membros.

Para promover um perfil já cadastrado:

```bash
npm run banco:admin -- --env=.env.hostinger --username=nome_do_responsavel
```

As permissões são aplicadas no servidor a todas as leituras e ações. Antes da revelação, as indicações continuam privadas. Transações, bloqueios de linha, constraints e triggers protegem a resolução e os registros imutáveis de pontos e auditoria.

## Lembretes

Configure um cron job **personalizado** no hPanel para chamar o endpoint de lembretes, usando a chave privada `CRON_SECRET`:

```bash
curl -fsS -X POST -H 'Authorization: Bearer SUA_CHAVE_CRON' https://goindica.com.br/api/cron/reminders
```

Substitua `SUA_CHAVE_CRON` pelo valor privado de `CRON_SECRET`. Esse agendamento roda na Hostinger e não exige Node.js no acesso SSH. Para executar a mesma chamada a partir do seu computador:

```bash
npm run cron:lembretes -- --env=.env.hostinger
```

Somente pessoas que ativaram lembretes recebem essas mensagens. A fila usa leases e retries. SMTP não oferece confirmação de entrega exatamente uma vez; uma falha entre aceitação pelo servidor e confirmação no banco pode gerar repetição.

## Verificar

```bash
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Os testes de integração e navegador usam um **MySQL 8.4 ou MariaDB 10.11 descartável no Docker**. Eles não acessam o banco da Hostinger nem o projeto antigo. O navegador exercita login por senha e um servidor SMTP TLS local, além dos fluxos de pedidos e indicações. Isso não substitui verificar a entrega de e-mail e a publicação no ambiente real.

## Histórico

`legacy/` preserva a implementação, migrations e testes específicos da antiga arquitetura para consulta. Esses arquivos não são executados, não entram na aplicação standalone e são excluídos do lint e TypeScript. A especificação original e os documentos de Supabase/Google são históricos; para a infraestrutura atual, valem este README e [HOSTINGER.md](docs/HOSTINGER.md).

## Google Places

Ative **Places API (New)** e o faturamento no projeto do Google Cloud. Crie uma chave com restrição de API para Places API (New); como as chamadas partem do servidor, use restrição por IP do servidor quando houver IP de saída fixo, conforme a infraestrutura da hospedagem. Não use restrição de referenciador de navegador nesta chave.

Preencha `GOOGLE_PLACES_API_KEY` no `.env.local` e nas variáveis da aplicação Node.js no hPanel. Reinicie a aplicação após alterar a configuração. A chave não deve usar prefixo `NEXT_PUBLIC_`.

Execute `npm run banco:migrar` para aplicar `006_google_places.sql`. O autocomplete inicia após 3 caracteres e 350 ms sem digitação. Um token de sessão acompanha as buscas até a seleção e validação do local. A cidade do pedido é incluída na consulta; o servidor valida município, UF, país, tipo e situação do estabelecimento antes de aceitar a seleção. Os resultados e sua ordem vêm do Autocomplete do Google; podem diferir da interface do Google Maps.

Apenas o ID do Google é persistido; nome e endereço oficiais são consultados sem cache persistente. Cadastros locais anteriores e cadastro comunitário continuam disponíveis. Falhas do Google não criam locais nem indicações. A confirmação da indicação mantém os controles de cidade, identidade e estado do pedido.

Referências: [Autocomplete (New)](https://developers.google.com/maps/documentation/places/web-service/place-autocomplete), [sessões](https://developers.google.com/maps/documentation/places/web-service/place-session-tokens) e [atribuição e armazenamento](https://developers.google.com/maps/documentation/places/web-service/policies).
