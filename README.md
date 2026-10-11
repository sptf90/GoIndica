# GoIndica

Plataforma de indicações da comunidade, com identidade visual baseada em [logo.png](./logo.png). Implementação de [ESPECIFICACAO_MVP_DESCOBERTA_LOCAL.md](./ESPECIFICACAO_MVP_DESCOBERTA_LOCAL.md), que continua sendo a fonte principal das regras de produto.

Por solicitação posterior do responsável, o acesso também aceita **e-mail e senha pelo Supabase**, além do Google opcional. Essa é uma alteração da decisão de autenticação da seção 13 da especificação; as regras do produto e o modelo de permissões permanecem os mesmos.

Uma pessoa procura → outra indica → a pessoa encontra → quem ajudou ganha pontos.

## Executar

Requer Node.js 22 ou mais recente (desenvolvido com Node 24) e npm. Não precisa de Docker.

```bash
npm ci
# Somente se .env.local ainda não existir:
cp -n .env.example .env.local
npm run dev
```

A landing funciona sem credenciais. Os fluxos autenticados precisam das configurações abaixo; não existe modo de demonstração com contas ou dados falsos na aplicação.

## Supabase

1. Crie um projeto Supabase dedicado ao produto.
2. Preencha `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SERVICE_ROLE_KEY` em `.env.local`. A chave de serviço é exclusivamente do servidor.
3. Aplique, em ordem, os arquivos de `supabase/migrations` no SQL Editor do Supabase. Alternativamente, instale a CLI, execute `supabase login`, `supabase link --project-ref SEU_PROJECT_REF` e `supabase db push`. Esses comandos usam o banco remoto; não é necessário executar `supabase start`.
4. Em Authentication → Providers (ou Sign In / Providers), habilite **Email** para cadastro e login por e-mail/senha. Mantenha login anônimo desabilitado. Google é opcional: configure suas credenciais no Supabase e defina `GOOGLE_OAUTH_ENABLED=true` somente quando o provider estiver pronto.
5. Em Authentication → URL Configuration, defina Site URL como `http://localhost:3000` no desenvolvimento e permita `http://localhost:3000/auth/callback` e `http://localhost:3000/auth/callback?destino=senha`. Use as URLs HTTPS correspondentes em produção e evite curingas amplos.
6. Configure proteção de abuso e limites do Supabase Auth, duração de sessão e rotação de refresh tokens. A aplicação verifica a sessão no servidor com `getUser` e o bloqueio no banco em todas as ações.
7. Habilite backups e monitore logs/erros do projeto.

Para aplicar as migrations pelo terminal na raiz deste repositório, prepare a CLI uma única vez (sem instalar globalmente):

```bash
# Inicialize a configuração da CLI se supabase/config.toml ainda não existir:
npx supabase init
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
```

Depois, use:

```bash
npm run banco:migrar
```

Informe a senha do banco quando a CLI solicitar. O script executa `supabase db push`, aplica os arquivos pendentes em ordem e registra o histórico no banco remoto. Não é necessário iniciar um Supabase local para esse fluxo. Se já tiver inicializado a CLI, pule `init`. Use `npm run banco:migrar -- --dry-run` para listar as migrations pendentes sem aplicá-las. Os arquivos temporários de vinculação da CLI são ignorados pelo Git.

A aplicação usa o papel autenticado e RLS nas leituras e RPCs. A chave de serviço fica nas operações restritas do servidor: registro de indicação validada pelo Google, analytics, diagnóstico, fila de e-mails e encerramento no Auth. Ela nunca é enviada ao navegador.

### Login sem Google

**Ambiente atual de teste:** no painel do projeto Supabase, abra Authentication → Sign In / Providers (ou Providers) → Email, desative **Confirm email** e salve. Com essa opção desligada, o Supabase retorna uma sessão ao cadastrar e o aplicativo segue diretamente para o onboarding, sem enviar confirmação. Essa configuração é do projeto hospedado; não existe variável `.env` da aplicação que a altere. Contas de teste criadas antes da mudança podem precisar ser confirmadas no painel Authentication → Users. A confirmação pode ser reativada no projeto usado para publicação.

Abra `/cadastro` para criar uma conta ou `/entrar` para entrar com e-mail e senha. O cadastro respeita a configuração **Confirm email** do Supabase; o aplicativo não confirma contas usando a chave secreta. Na produção, mantenha confirmação ativa e configure [SMTP próprio](https://supabase.com/docs/guides/auth/auth-smtp): o remetente padrão do Supabase é limitado e pode enviar somente aos membros autorizados do projeto. Para um teste local com Supabase hospedado, também é possível criar e confirmar uma conta de teste no painel Authentication → Users e entrar com ela.

`/recuperar-senha` envia o link e `/nova-senha` exige uma sessão autenticada para trocar a senha. Formulários validam e-mail, confirmação e senha no servidor; senha nova tem pelo menos 12 caracteres. Erros do provedor não são expostos, e a recuperação não informa se uma conta existe.

Os links padrão (`{{ .ConfirmationURL }}`) utilizam `/auth/callback` com PKCE e devem ser abertos no navegador que iniciou o fluxo. Para confirmação e recuperação em outro navegador/dispositivo, use estes links nos templates em Authentication → Email Templates, com Site URL corretamente configurada:

```html
<!-- Confirm signup -->
<a
  href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo | urlquery }}"
  >Confirmar e-mail</a
>
<!-- Reset password -->
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery"
  >Definir nova senha</a
>
```

O parâmetro `next` preserva o pedido compartilhado durante cadastro, confirmação e onboarding. O callback aceita somente rotas internas permitidas, validando também a origem quando recebe `.RedirectTo`. O template usa as [variáveis oficiais de e-mail do Supabase](https://supabase.com/docs/guides/auth/auth-email-templates) e o escape de query do [Go template](https://pkg.go.dev/text/template). Inclua na allowlist as variantes de `/auth/callback` com `next` usadas pela aplicação, restringindo origem e caminho conforme a [configuração de redirecionamentos](https://supabase.com/docs/guides/auth/redirect-urls). Para alteração de e-mail, mantenha o template padrão com `.ConfirmationURL` e homologue o retorno a `/conta`.

Nenhum login depende de Google Places. As migrations continuam necessárias para onboarding e demais fluxos; Places continua necessário para indicar estabelecimentos.

### Primeiro administrador

Após o responsável fazer login e onboarding, atribua o papel pelo SQL Editor. Não há endpoint público de promoção:

```sql
update private.accounts
set is_admin = true
where id = (
  select id from public.profiles where username = 'username_do_responsavel'
);
```

Confirme que exatamente uma conta foi alterada. O administrador acessa `/admin` pelo perfil. Todas as ações de moderação geram logs; ele não pode bloquear a si mesmo.

## Sugestões de cidades

Cidade é escolhida pelas sugestões enquanto a pessoa digita, sem botão Buscar. O mesmo seletor atende onboarding, perfil, pedidos, feed e ranking. A API `/api/cities` consulta todos os municípios brasileiros do catálogo IBGE no Supabase, aceita partes do nome e uma UF ao final, como `Rio Preto SP` ou `Bom Jesus RS`. Não precisa de Google, billing ou chave adicional para pesquisar cidades.

A busca começa com duas letras, aguarda 300 ms e cancela consultas anteriores. Setas e Enter selecionam; Escape fecha a lista. É necessário escolher um município para enviar o identificador correto ao servidor. A API de cidades e suas tabelas precisam estar disponíveis; falhas mostram uma opção de tentar novamente.

## Google Cloud e OAuth

Esta configuração é opcional para o login por e-mail. Depois de concluí-la, defina `GOOGLE_OAUTH_ENABLED=true` na aplicação.

1. Configure a tela de consentimento OAuth e o domínio autorizado. Em modo de teste do Google, cadastre os usuários de teste.
2. Crie um cliente OAuth do tipo Web.
3. Cadastre `https://SEU_PROJECT_REF.supabase.co/auth/v1/callback` como redirect URI autorizado do cliente Google. Esse é o callback do **Supabase**, distinto de `/auth/callback` da aplicação.
4. Copie o Client ID e Client Secret para o provider Google do Supabase.
5. Antes de abrir ao público, publique/configure a tela de consentimento e links reais de privacidade e termos.

## Google Maps Platform

1. Habilite billing e **Places API (New)** no Google Cloud.
2. Crie uma chave exclusivamente para uso no servidor e preencha `GOOGLE_PLACES_API_KEY`.
3. Restrinja a chave à Places API (New). Não use restrição por HTTP referrer em uma chave de servidor. Quando o ambiente possuir IP de saída estável, aplique também restrição por IP. Em serverless com IP variável, use a restrição de API, cotas, alertas e rotação da chave.
4. Configure cotas e alertas de orçamento adequados ao piloto. Buscas são explícitas, usam sessão e field masks; cada usuário tem limites persistidos no PostgreSQL.
5. Revise as [políticas oficiais de Places](https://developers.google.com/maps/documentation/places/web-service/policies). O banco persiste somente o `google_place_id` e os metadados próprios de validação/contribuição. Nome, endereço e links oficiais são consultados ao exibir o local, sem cache persistente. A marca oficial Google Maps e atribuições de terceiros são exibidas junto aos dados.

O backend reconsulta o local selecionado e compara município, UF e país com o catálogo IBGE. Bairro, coordenadas ou endereço enviados pelo navegador não provam a cidade. Local sem componentes seguros é rejeitado. A busca não afirma disponibilidade de produtos.

## Produção

Compatível com Next.js em Vercel e banco/Auth em Supabase:

- comando de build: `npm run build`;
- comando para execução Node: `npm run start`;
- defina `NEXT_PUBLIC_APP_URL` como o domínio HTTPS real **antes de gerar o build**;
- preencha as chaves no gerenciador de secrets do ambiente, com escopo correto de preview/produção;
- execute as migrations antes de liberar os fluxos;
- configure URLs OAuth de produção;
- defina `NEXT_PUBLIC_SUPPORT_EMAIL` com o contato real e revise os documentos legais com a identidade do operador;
- habilite proteção de tráfego na hospedagem, especialmente OAuth, páginas públicas e APIs. A fingerprint usada para limitar analytics depende de `X-Forwarded-For` ser sobrescrito pelo proxy confiável da hospedagem;
- mantenha sessões privadas sem cache de CDN. A CSP usa nonce por requisição; as páginas com nonce são dinâmicas;
- use ambientes separados para teste/homologação e produção.

Nenhum deploy ou provisionamento de conta externa foi feito automaticamente. A confirmação operacional em Google/Supabase reais requer os dados desse ambiente.

## Verificar

```bash
npm run lint
npm run typecheck
npm run db:types:check
npm test
npm run build
npx playwright install --with-deps chromium firefox webkit
npm run test:e2e
npm run test:e2e:cross
npm run tools:postgrest
POSTGREST_BIN=.test-tools/postgrest npm run verify:postgrest
npm run verify:scale
npm run verify:recovery
```

`npm test` executa validações de integração no **PostgreSQL real**, provisionado temporariamente pelo pacote de desenvolvimento `embedded-postgres`. As migrations, triggers, transações, constraints e papéis RLS são exercitados sem reimplementar as regras de negócio em memória.

`npm run test:e2e` usa a aplicação com build de produção na porta **3100**, PostgreSQL temporário e fixtures HTTP de Supabase Auth/REST e Google Places isoladas em `tests/e2e`. O fluxo PKCE verifica o code verifier. Essas fixtures não são incluídas em `src`, nem ativadas por uma flag da aplicação. Elas permitem validar o navegador sem chaves externas, mas não substituem a homologação dos provedores reais.

Para validar enquanto o servidor de desenvolvimento está aberto, use um diretório de build separado:

```bash
NEXT_DIST_DIR=.next-review npm run build
NEXT_DIST_DIR=.next-review npm run test:e2e
```

Screenshots dos oito tamanhos ficam em `test-results/`. Trace e screenshot de falhas são retidos. Testes de banco iniciam seu próprio PostgreSQL e encerram/removem os dados no final. Não execute o teste com banco de produção. `TEST_DATABASE_URL`, se usado, deve apontar para um banco **vazio e dedicado**, cujo nome termine com `_test`.

Se npm exigir aprovação de scripts de dependências, aprove o pacote `@embedded-postgres` correspondente ao sistema e `esbuild`; são necessários para os testes. O lockfile inclui as versões usadas.

Para homologar o ciclo com serviços reais, consulte [docs/HOMOLOGACAO.md](./docs/HOMOLOGACAO.md).

A suíte completa roda no Chromium; Firefox/WebKit cobrem fluxos críticos. `verify:postgrest` exercita RPCs e permissões pelo servidor PostgREST real em banco temporário. Escala valida busca indexada com 10 mil pedidos, e recuperação exige `pg_dump`/`pg_restore` compatíveis com PostgreSQL 18. Os tipos em `src/lib/supabase/database.types.ts` são gerados por `npm run db:types`; o CI confere divergências. Consulte [operação e recuperação](./docs/OPERACAO.md) para detalhes e configurações de e-mails opcionais.

## Documentação

- [Fotos, pedidos sem ajuda, interesses, reconfirmações, alertas e cards](./docs/DESCOBERTAS_COMUNITARIAS.md)
- [Análise inicial e cobertura da especificação](./docs/ANALISE_E_COBERTURA.md)
- [Análise do sistema e melhorias propostas](./docs/ANALISE_SISTEMA.md)
- [Implementação e revisão individual dos 24 itens](./docs/IMPLEMENTACAO_E_REVISAO.md)
- [Operação, lembretes e recuperação](./docs/OPERACAO.md)
- [Decisões, concorrência e permissões](./docs/ARQUITETURA.md)
- [Revisão de interface e sugestões de cidades](./docs/REVISAO_INTERFACE.md)
- [Identidade visual do GoIndica](./docs/PADRAO_VISUAL.md)
- [Verificação e seus limites](./docs/VERIFICACAO.md)
- [Homologação com provedores reais](./docs/HOMOLOGACAO.md)

O catálogo contém 5.571 municípios brasileiros oficiais do IBGE, importados em 4 de outubro de 2026 e conferidos novamente em 7 de outubro. Para conferir mudanças sem gravar arquivos: `npm run cities:update -- --dry-run`. Para atualizar, `npm run cities:update` cria uma migration nova, preservando as anteriores; revise-a antes de aplicar.
