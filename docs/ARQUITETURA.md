# Decisões técnicas

## Identidade e fronteiras

O acesso por e-mail e senha foi adicionado por solicitação posterior do responsável, alterando a escolha Google-only da seção 13 da especificação original. Google continua opcional via `GOOGLE_OAUTH_ENABLED=true`. Os dois métodos geram a mesma identidade Supabase Auth; o banco não depende do provider. Senhas, confirmação e recuperação são gerenciadas pelo Supabase, sem service role no fluxo de login. E-mails e senhas não são devolvidos em estados de formulário, logs ou perfis públicos. Recuperação e cadastro repetido usam respostas genéricas para não divulgar contas existentes. Limites de tentativas de autenticação ficam no Supabase Auth.

O cadastro respeita confirmação de e-mail definida no projeto. O callback PKCE aceita somente destinos fixos; `/auth/confirm` aceita somente `email` ou `recovery`, valida o token com o Supabase e não aceita redirecionamento externo. O perfil não exige foto de Google para contas por e-mail.

O identificador interno é o UUID do Supabase Auth. O servidor verifica `getUser`; não aceita um `user_id` do formulário como identidade. Cookies são HttpOnly, SameSite=Lax e Secure quando a URL da aplicação é HTTPS. O proxy renova tokens e aplica CSP com nonce, mas cada página, ação e endpoint também verifica acesso. Bloqueio de conta é consultado no banco e não depende de atualizar o JWT.

As variáveis do servidor são lidas em execução por nome, inclusive a URL pública de callback. Isso evita que o build de localhost congele a URL e direcione sessões do ambiente isolado de testes para outra porta. Variáveis públicas usadas no navegador continuam sujeitas ao comportamento de build do Next.js.

As leituras passam pelo cliente Supabase com a sessão do usuário e RLS. Todas as tabelas têm RLS; o cliente não recebe grants de insert/update/delete. Funções públicas têm grants explícitos; funções internas de transação ficam em `private`, que não deve ser incluído em schemas expostos no Supabase.

Somente `submit_verified_indication` e analytics usam a chave de serviço em módulos server-only. A primeira recebe a identidade já autenticada pelo servidor e a cidade validada por Place Details oficial. Seu grant é exclusivo de service_role. O navegador pode invocar outras RPCs diretamente; os testes demonstram que isso não permite alterar usuário, pontuação, estado ou conteúdo de terceiros.

## Concorrência

`submit_verified_indication`, `reveal_responses`, `edit_request`, `cancel_request`, moderação e `resolve_request` bloqueiam a mesma linha de `requests` com `SELECT ... FOR UPDATE`.

- Se a indicação adquire o lock primeiro, grava e incrementa a contagem; a revelação aguarda o commit e inclui essa indicação.
- Se a revelação adquire o lock primeiro, o estado muda e a indicação é rejeitada após aguardar.
- A resolução, o estado e as recompensas são gravados na mesma transação da RPC. Falha no ledger reverte tudo.
- Duas confirmações equivalentes retornam o mesmo ID de resolução. Confirmação divergente posterior retorna solicitação encerrada.

Triggers impedem também escrita privilegiada incoerente em indicações, resolução, edição e ledger. `UNIQUE(request_id,user_id)`, `UNIQUE(request_id)` na resolução, `UNIQUE(indication_id,type)` e `UNIQUE(user_id,request_id,type)` no ledger são garantias físicas adicionais.

O count visível é atualizado sob o lock. Nenhum usuário precisa ler os lugares indicados para conhecer a quantidade. A edição verifica a existência de **qualquer** indicação, incluindo uma posteriormente removida. A interface consulta a mesma condição para oferecer o botão de edição.

## Recompensas e moderação

Uma resolução identifica um `place_id` interno, relacionado a um identificador Google único. Os registros das indicações continuam independentes. O INSERT SELECT gera +10 para todas as indicações daquele local que não foram removidas e cujas contas estão ativas no momento da resolução. O banco valida correspondência de usuário, indicação, solicitação, cidade e resolução.

Recompensas já registradas não são revertidas quando o conteúdo é moderado. O ledger e os logs são imutáveis. Remoção é lógica (`hidden_at`), e conteúdo aberto/revelado removido é cancelado pela administração. Contas bloqueadas não participam do ranking público. Desbloquear restaura a visibilidade dos pontos existentes. Não há penalidade ou pontos negativos.

## Visibilidade

| Dado                                     | Acesso                                                             |
| ---------------------------------------- | ------------------------------------------------------------------ |
| Cidades, perfil sem email e ranking      | Leitura pública permitida por RLS/RPC                              |
| Pedidos não removidos                    | Conta autenticada ativa                                            |
| Contagem do pedido aberto                | Usuários que podem ler o pedido                                    |
| Indicação antes da revelação             | Seu próprio indicante; administrador para moderação                |
| Indicações completas depois da revelação | Solicitante e administrador                                        |
| Local confirmado e resolução             | Conta autenticada ativa; nenhuma abertura das respostas perdedoras |
| Ledger individual                        | Próprio usuário e administrador                                    |
| Denúncias                                | Próprio denunciante e administrador                                |
| Logs, contas bloqueadas e métricas       | Administrador                                                      |

Administradores são uma fronteira de confiança: possuem acesso de moderação às respostas. O papel é concedido manualmente no banco, nunca pelo onboarding.

## Places e cidades

O MVP suporta Brasil. IDs de cidade são códigos IBGE, evitando texto livre. O perfil apenas sugere a cidade da pergunta. Endereço Google usa município `administrative_area_level_2`; quando ele está ausente, é aceito `locality` inequívoco. UF e país também precisam corresponder. Componentes conflitantes, cidade ausente, região política e estabelecimento permanentemente fechado são rejeitados.

Não há nome, endereço, localização ou URL Google persistidos no banco. O `google_place_id` é a exceção de armazenamento prevista na [política oficial](https://developers.google.com/maps/documentation/places/web-service/policies). `city_id` e `last_verified_at` registram a própria decisão de validação do produto. Nome/endereço oficiais são obtidos sem cache persistente, com field masks e timeout de 6 segundos. `React.cache` deduplica somente dentro da mesma renderização. Mapa é um link Google; não existe outro mapa nem análise de estoque.

A interface de seleção mostra o texto oficial da predição. O servidor obtém e valida os detalhes antes de aceitar a indicação. Uma falha externa nunca cria indicação. Se os detalhes de um local já indicado não carregarem na revelação, a confirmação desse grupo fica indisponível até uma nova consulta, e o usuário recebe uma mensagem clara.

## Limites e analytics

Limites compartilhados no PostgreSQL: criação 10/hora; indicação 30/hora; edição de perfil 20/hora; denúncia 10/hora; buscas e detalhes Places 30/minuto por bucket e 300/dia combinados. Rate limit, bloqueio e disponibilidade são validados de novo no banco. Reveals/retries de resolução são baratos e protegidos por ownership e idempotência.

Analytics público usa três contadores diários (`LANDING_VISIT`, `CTA_CLICK`, `SEARCH_REUSED`), cookie essencial de deduplicação de 30 minutos e limite de 60/minuto por fingerprint. A fingerprint é HMAC do endereço técnico recebido do proxy confiável, com a chave server-only; não se armazena IP bruto. Fingerprints inativas são removidas após dois dias. Esses contadores são aproximados, não usados para premiação ou autorização. Não há rastreamento publicitário.

Eventos de negócio estão no audit log. Tempos de primeira indicação/resolução vêm das transações, sem eventos confiados ao frontend. Sinais de fraude são informativos e revisados por humanos. Não criam punições automáticas.

## UI e operação

A experiência é mobile-first, com Inter variável local e as cores originais da marca (`#347d25` e `#0252dc`). O celular usa fundo branco, navegação inferior com quatro destinos e cabeçalhos contextuais. Criação, edição, indicação e configurações usam voltar sem barra inferior. Tablet tem rail; desktop tem navegação lateral rotulada e composições com coluna de apoio. O documento é a superfície de rolagem: não há painel com altura fixa nem scroll interno. `AppChrome` recebe conteúdo e slots de sessão do servidor; o componente não concede permissões. `ViewportContent` permanece como wrapper simples no onboarding. Safe areas, visual viewport do teclado e campos de 16 px são tratados sem detectar user-agent. Busca conserva GET, cidade estruturada e paginação; `FeedSearch` recolhe a escolha de cidade. Perfil conserva identidade/reputação e expande o formulário de edição. Detalhe separa a jornada e ações principais das opções secundárias. Tokens e contratos em [PADRAO_VISUAL.md](./PADRAO_VISUAL.md); auditoria e decisões em [REFATORACAO_UX_UI.md](./REFATORACAO_UX_UI.md).

Feeds, atividades, ranking, grupos de indicação e participantes são paginados. Grupos têm contagem total no banco, mesmo quando os participantes ocupam mais de uma página. Páginas privadas têm `noindex`; sessões não são colocadas em cache compartilhado. Fontes, ícone e Open Graph são servidos localmente.

Os registros de auditoria e recompensa devem ser preservados com política de retenção apropriada. Solicitações de encerramento são recebidas em `/conta` e revistas pela administração. O procedimento bloqueia acesso, faz soft delete no Auth e anonimiza o produto, mantendo o ledger; se falhar, pode ser retomado. A identidade do responsável, o contato e a retenção devem ser preenchidos/revisados antes do lançamento.

## Evoluções de 7 de outubro de 2026

Notificações contêm apenas tipo do evento e pedido, sem copiar locais, nomes de indicantes ou comentários. RLS limita leitura ao destinatário. Favoritos/acompanhamento e cidades seguidas também são privados; acompanhar não amplia as permissões de leitura do pedido. O resumo do membro usa uma RPC autorizada e atualização periódica; o contador do pedido expõe somente quantidade/status.

O detalhe pagina participantes por estabelecimento e carrega seus perfis em lote. Detalhes Google secundários e prévias históricas são carregados ao abrir; a cota `places_view` é separada da indicação, mantendo o teto diário comum. Service worker conserva somente uma página offline neutra. Rascunhos locais são separados por usuário, expiram em sete dias e possuem limpeza explícita.

Leituras STABLE usam `private.read_actor`, sem locks incompatíveis com transações somente leitura do PostgREST. Alterações usam `private.actor`, preservando locks de autorização/concorrência. Busca SECURITY DEFINER valida conta e onboarding uma vez, aplica explicitamente visibilidade administrativa/conteúdo oculto e usa índice GIN com normalização de acentos; as políticas RLS das tabelas continuam ativas para acesso direto.

E-mail possui opt-in, fila privada, leases e idempotência no provedor. Exportação contém somente dados próprios e metadados necessários; não inclui tokens nem controle da fila. Logs de aplicação são sanitizados; diagnóstico público informa somente readiness. Métricas distinguem tipos de resultado e documentam coortes/UTC.

Tipos de tabelas, FKs e assinaturas RPC vêm da introspecção de PostgreSQL migrado, com comparação determinística no CI. CSS está dividido em foundation (tokens), public, application (chrome/feed/inputs), components (tarefas), community, discovery e responsive (adaptação final), sem regras antigas de painel/menu. O pipeline verifica PostgREST real, busca com volume representativo, recuperação e navegadores adicionais. Procedimentos e limites constam em [OPERACAO.md](./OPERACAO.md).

## Referências consultadas

- [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs)
- [Supabase Auth: validação de sessão](https://supabase.com/docs/guides/auth/server-side/advanced-guide)
- [Places API (New): field masks](https://developers.google.com/maps/documentation/places/web-service/choose-fields)
- [Places Autocomplete (New)](https://developers.google.com/maps/documentation/places/web-service/place-autocomplete)
- [Políticas e atribuições Places](https://developers.google.com/maps/documentation/places/web-service/policies)
- [Catálogo oficial IBGE](https://servicodados.ibge.gov.br/api/docs/localidades)
- [Next.js: CSP](https://nextjs.org/docs/app/guides/content-security-policy)
