# Verificação da implementação

Revisão inicial em 4 de outubro e revisão das melhorias em 7 de outubro de 2026, com Node 24 e build de produção do Next.js.

## Adições revisadas em 10 de outubro

As seis funcionalidades de [descobertas comunitárias](./DESCOBERTAS_COMUNITARIAS.md) estão implementadas: foto opcional, filtro de pedidos sem indicação, interesse compartilhado, reconfirmações históricas, alertas por assunto e card PNG com QR code.

| Verificação                                      | Resultado                                                                                                                                            |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint, TypeScript e tipos derivados do banco    | Aprovados, sem warnings de lint ou divergências                                                                                                      |
| Testes unitários/integrados                      | **155 aprovados em 17 arquivos**                                                                                                                     |
| Build de produção em `.next-review`              | Aprovado                                                                                                                                             |
| Chromium, suíte completa                         | **49 aprovados**                                                                                                                                     |
| Firefox/WebKit, fluxos críticos e seis novidades | **6 aprovados**, três por navegador                                                                                                                  |
| Verificações adicionais no build final           | Dois fluxos novos repetidos no Chromium e três no WebKit, aprovados                                                                                  |
| PostgREST real                                   | Fotos, interesses, alertas, reconfirmação, exportação, busca e autorização aprovados                                                                 |
| Escala                                           | 10 mil pedidos; índice do filtro sem indicação e índice da busca confirmados                                                                         |
| Backup/restauração                               | Fotos, alertas, interesses, reconfirmações e recompensas comparados e preservados                                                                    |
| Auditoria de dependências de produção            | Zero vulnerabilidades conhecidas reportadas                                                                                                          |
| Supabase da aplicação                            | Migração `202610100001` aplicada; quatro tabelas/colunas, nove RPCs novas e health check confirmados por leitura, sem ler ou criar dados de usuários |

A prévia final de migrations retornou `upToDate: true` e nenhuma migration pendente. Nenhum deploy foi feito.

As bibliotecas que faltavam para WebKit foram extraídas em `.test-tools/webkit-libs`, sem instalar pacotes no sistema. A configuração de testes detecta esses arquivos e os carrega somente no processo do WebKit; também aceita `GOINDICA_WEBKIT_PRELOAD` quando necessário. Os clientes PostgreSQL 18 foram extraídos em `.test-tools/postgres-client` para executar a restauração. Essas ferramentas locais são ignoradas pelo Git.

O ambiente de teste usa provedores HTTP isolados e PostgreSQL real. O arquivo `.env.local` continua sem uma chave válida de Google Places e não há contas/sessões preparadas para a suíte de provedores reais. Portanto, os testes aprovados não equivalem à homologação de consultas a estabelecimentos reais ou de e-mails. A chave precisa ser configurada para esse uso.

## Melhorias revisadas em 7 de outubro

Os 24 itens têm revisão individual registrada em [IMPLEMENTACAO_E_REVISAO.md](./IMPLEMENTACAO_E_REVISAO.md). Foram adicionadas sete migrations sem alterar as antigas, funcionalidades de conta/comunidade e verificadores reproduzíveis. A aplicação não foi publicada e nenhuma migration foi aplicada remotamente nesta etapa.

Consolidado: **141 testes unitários/integrados em 14 arquivos**, lint sem warnings, typecheck, comparação dos tipos gerados e build de produção aprovados. A auditoria das dependências de produção retornou zero vulnerabilidades conhecidas. Após os últimos ajustes, os seis fluxos de produto passaram novamente no build final.

- Suíte Chromium completa: **47 testes aprovados**, incluindo os 41 anteriores e seis fluxos de produto novos. Cobertura de novas páginas em 320, 390, 768 e 1440 px, além dos oito tamanhos das páginas anteriores.
- Fluxos críticos Firefox/WebKit: **dois testes aprovados**, um por navegador, cobrindo login, rascunho, publicação, salvos, navegação e exportação. Esses navegadores não executaram a suíte completa de 47 testes.
- PostgreSQL com todas as migrations: notificações privadas, estados independentes de favoritos/acompanhamento, cotas, filtros e tipos de resultado, marcos, moderação, opt-in e concorrência da fila, exportação e anonimização sem apagar recompensas.
- PostgREST **16.4 real** em banco temporário: parâmetros padrão e nomeados das RPCs, JWTs, busca com acentos/múltiplas palavras/marcas, métricas, usuário bloqueado, conteúdo oculto, não administrador e visitante. A verificação revelou tentativas de locks em RPCs STABLE; a migration 006 corrige a autorização das leituras para funcionar em transações somente leitura.
- Escala com **10 mil pedidos e mil indicações**: busca realmente usa o índice GIN; feed, paginação, ranking e métricas retornam resultados esperados. Uma execução local durante outras validações mediu busca 34 ms, feed 6 ms, paginação 4 ms, ranking 7 ms e métricas 226 ms. Não é teste de usuários simultâneos nem previsão de latência em produção.
- Recuperação: dump e restauração em um segundo PostgreSQL temporário, comparando pedidos resolvidos, recompensas, estatísticas e RLS. Verifica o processo local; não provisiona nem certifica backups do Supabase hospedado.
- Prévia do importador sobre o catálogo oficial: **5.571 municípios e 27 UFs**, sem diferenças e sem gravar arquivos. Testes também aplicam uma atualização de cidade sobre um banco já migrado, mantendo seus vínculos.
- Inspeção visual das telas novas: checkbox de e-mail e espaçamento entre seções corrigidos. Histórico testado com prévia de local sob demanda, sem nova chamada ao fechar e reabrir.

Comandos e pré-requisitos em [OPERACAO.md](./OPERACAO.md). O CI inclui essas verificações e a comparação dos tipos gerados. Resultados de lint, tipos, testes unitários/integrados e build estão no consolidado abaixo.

## Verificações automatizadas

Na revisão inicial de 4 de outubro, interface, cidades, aplicação do protótipo Figma, painel interno e layout público passaram com **78 testes unitários/integrados e 41 E2E locais**. A instalação da fonte Inter e remoção de DM Sans/Manrope concluíram então a auditoria npm sem vulnerabilidades. A ampliação de 7 de outubro mantém essa cobertura e acrescenta as validações descritas acima.

- ESLint sem warnings.
- TypeScript em modo strict.
- Build de produção do App Router.
- Auditoria npm sem vulnerabilidades.
- Testes unitários de schemas e Google Places: componentes da cidade, ambiguidades, estado/país, timeout, respostas malformadas, field masks, ausência de cache, sessão e links seguros.
- Integração em PostgreSQL real: onboarding, conta bloqueada, autorização, grants, RLS, autoindicação, duplicidade, corrida entre indicação/revelação, resolução concorrente, confirmação por local, duas recompensas +10, outros locais sem pontos, resultados sem recompensa, ledger imutável, rollback total e ranking por cidade.
- Inspeção de todas as tabelas com RLS e dos grants de funções SECURITY DEFINER; nenhum EXECUTE de definer é concedido a PUBLIC.
- E2E no Chromium: OAuth PKCE via fixture, onboarding, criação, busca e validação de estabelecimento, erro de cidade, indicação de pessoa de outra cidade, revelação, privacidade, confirmação, pontos, ranking, atividades, reutilização, moderação, bloqueio/desbloqueio, páginas legais, metadata e CSRF.
- Acesso por e-mail: validação e confirmação de senha no servidor, cadastro pendente, bloqueio antes de confirmar e-mail, confirmação em outro navegador, onboarding sem foto Google, criação de pedido, login com senha correta/incorreta, logout, recuperação, troca autenticada, senha antiga recusada, OTP de uso único, links inválidos e destinos externos rejeitados. Testes unitários verificam ausência de sessão e impedem alteração da identidade por formulário.
- O build com `.env.local` configurada é executado no E2E isolado com outra porta/URL, validando que callback e proxy leem as configurações do servidor em execução.
- Verificação de overflow e screenshots em 320, 375, 390, 414, 768, 1024, 1280 e 1440 px para landing, feed, composição, detalhe revelado, atividades, ranking e perfis.
- Revisão adicional de edição, indicação, áreas administrativas, páginas legais/ausentes, nomes e textos longos. Testes medem alinhamento dos filtros, verificam aba ativa visível no celular e exercitam busca nacional de cidades, debounce, seleção obrigatória, teclado/toque, retry e resposta atrasada. Formulários preservam valores após erro e edição do perfil mostra sucesso sem sair da página. Detalhes em `REVISAO_INTERFACE.md`.
- Identidade do protótipo: fonte Inter carregada localmente, cores das superfícies, limites laterais, colunas do detalhe, ilustração sem encolhimento e estatísticas alinhadas no perfil. Menu móvel exercitado por clique, teclado, Escape, clique externo e navegação administrativa. Compartilhamento copia a URL sem parâmetros de feedback/paginação e oferece cópia manual quando o clipboard não está disponível. Screenshots comparadas com o protótipo em desktop e celular; padrão documentado em `PADRAO_VISUAL.md`.
- Painel fixo interno: comparação real de posição, largura e altura entre oito rotas autenticadas, oito larguras e alturas de 600/850 px. Documento sem rolagem horizontal/vertical; conteúdo extenso acessível por rolagem interna sem deslocar cabeçalho ou aumentar o painel. Sugestões de cidades respeitam os limites do painel. Navegação retorna a área interna ao início. Formulários em duas colunas quando há espaço e topo do feed compacto no celular; testes adicionais verificam o primeiro pedido visível nas larguras a partir de 375 px em altura de 850 px.
- Layout público completo: landing, login, cadastro, recuperação, privacidade e termos sem painel fixo. Teste verifica rolagem natural da página, rodapé e links legais acessíveis, além de ausência de overflow horizontal nas oito larguras em altura de 600 px.
- Imagem Open Graph com a nova identidade: rota respondeu HTTP 200, conteúdo `image/png` e assinatura PNG válida. Busca por credenciais locais nos arquivos de código e documentação não encontrou exposição.

## Revisão de fronteiras

O código de produção usa Google e Supabase reais. Fixtures e identidades de teste ficam somente em `tests`, com banco temporário e preload de transporte carregado pelo processo de teste. Não há modo de demonstração, endpoints de teste, TODO crítico, mocks de dados ou fallback de integração em `src`.

Os arquivos versionáveis e `.env.example` não contêm chaves reais. As credenciais do ambiente local ficam somente em `.env.local`, ignorada pelo Git e com permissões de leitura/escrita do proprietário. A chave secreta do Supabase e a chave Places ficam em módulos do servidor. E-mails e senhas não são incluídos em perfis, ranking, pedidos, logs de produto ou respostas de erro. Formulários não controlam pontuação, usuário, status, autorização ou validação de localização.

Revelação e resolução bloqueiam a mesma linha que a indicação. As regras de negócio são protegidas no banco, não somente nos botões da interface.

## Limite da verificação

Os testes E2E usam fornecedores isolados, sem criar contas nem enviar e-mails no projeto remoto. Na revisão de interface, consultas de leitura a `/api/cities` no localhost com a configuração real retornaram HTTP 200 e municípios corretos para Manaus/AM, Salvador/BA e “Rio Preto SP”, confirmando que o catálogo está disponível nesse ambiente. A observação anterior sobre tabelas remotas ausentes é histórica; não representa o estado atual da tabela de cidades. A configuração remota de confirmação de e-mail não foi reavaliada nesta revisão.

A entrega SMTP/Resend, sessões remotas, confirmação real da troca de e-mail, encerramento no Supabase hospedado, consentimento Google, billing/cotas de Places e domínio de produção não foram homologados nem provisionados. A suíte live e as instruções em `HOMOLOGACAO.md` permitem verificar esse ambiente separadamente. Os testes visuais completos cobrem Chromium; Firefox e WebKit têm somente os fluxos críticos descritos acima. Aparelhos físicos e seus teclados virtuais não foram verificados. A aprovação local não comprova configuração completa dos provedores externos.
