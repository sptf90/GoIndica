# Descobertas comunitárias — 10 de outubro de 2026

As seis adições foram integradas ao fluxo existente de pedidos, sem alterar a recompensa de +10 pontos por indicação confirmada.

| Funcionalidade          | Onde usar                                            | Regra                                                                                                                                                                                                                         |
| ----------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foto opcional           | Criar ou editar pedido                               | Uma foto JPG, PNG ou WebP de até 5 MB; prévia e remoção. Edição respeita o bloqueio após a primeira indicação.                                                                                                                |
| Pedidos sem indicação   | Início → Sem indicação                               | Apenas pedidos abertos sem indicações na cidade escolhida, ordenados dos mais antigos para os mais recentes. Busca e paginação preservadas.                                                                                   |
| Também estou procurando | Detalhe de pedido aberto ou revelado de outra pessoa | Registra interesse e ativa acompanhamento. Remover interesse conserva salvos e a escolha de acompanhamento. Só o total de interessados é mostrado.                                                                            |
| Encontrei aqui também   | Descoberta resolvida em local indicado               | Uma confirmação por pessoa e pedido, com data do servidor. O autor não reconfirma sua própria resolução. Não gera pontos nem altera o resultado original.                                                                     |
| Alertas por assunto     | Preferências → Alertas por assunto                   | Até 12 pares de assunto/cidade. Novos pedidos ou edições que passam a corresponder geram uma notificação interna por pessoa e pedido. Busca textual em português, com todas as palavras relevantes e normalização de acentos. |
| Card para compartilhar  | Detalhe → Baixar card para compartilhar              | PNG de 1080 × 1350 com marca, descrição, cidade e QR code. Não contém indicações ou dados pessoais dos participantes.                                                                                                         |

## Fotos

O servidor verifica formato e conteúdo, aplica orientação, remove metadados, reduz dimensões para até 1200 × 1200 e converte para JPEG. Imagens detalhadas recebem uma segunda compressão. A entrada é limitada a 24 milhões de pixels para controlar memória; imagens que ultrapassam esse limite recebem orientação para reduzir a resolução. O arquivo processado ocupa no máximo 512 KiB.

Para este MVP, a imagem compacta fica em `private.request_photos`, separada das tabelas de leitura do feed. A gravação do pedido e da foto ocorre na mesma transação; uma foto inválida não deixa um pedido incompleto. Não é necessário criar um bucket. Essa escolha mantém os backups e a remoção de dados no fluxo existente; se o volume de imagens crescer, pode-se migrar os arquivos para armazenamento de objetos.

`/api/request-photo` exige sessão e onboarding, verifica bloqueio e visibilidade do pedido e entrega apenas JPEG com `private, no-store` e `nosniff`. As páginas do feed recebem só o indicador de foto, sem carregar os bytes. Rascunhos preservam o texto; a foto precisa ser selecionada novamente ao sair da tela.

## Privacidade, concorrência e operação

Listas de interesses, alertas e reconfirmações são privadas por RLS. Somente totais e a última data de reconfirmação são visíveis no pedido. Alterações usam RPCs e locks; cliques repetidos e pedidos concorrentes não duplicam contagens ou pontos. Alertas não expõem nomes ou locais de indicações protegidas. Reconfirmações não significam estoque disponível agora.

Exportação de conta inclui fotos próprias em base64, alertas e reconfirmações. Encerramento remove esses dados, atualiza contadores e conserva o ledger existente. As regras também aparecem nas páginas de privacidade e termos.

A migração é `supabase/migrations/202610100001_community_discovery.sql`. Os tipos foram gerados a partir do PostgreSQL com essa migração. Configure `NEXT_PUBLIC_APP_URL` com a origem real: esse endereço compõe o QR code. A geração do card tem limite de 10 por minuto por conta. Alertas funcionam na central interna, sem exigir SMTP ou agendamento.

## Verificação

Testes cobrem upload real e inválido, remoção/troca de foto, processamento e metadados, filtros de cidade/texto, ordenação, privacidade, concorrência, deduplicação, bloqueio, limites de alertas, exportação e encerramento. O PNG é decodificado para verificar o QR code e inspecionado para garantir que textos longos permaneçam dentro das margens.

Os testes de navegador exercitam o ciclo completo das seis funcionalidades, além da regressão existente, em Chromium, Firefox e WebKit. A revisão inclui 320, 390, 768 e 1440 px nas telas novas e os oito tamanhos da suíte existente. Os contratos das novas RPCs também são executados pelo PostgREST real; escala usa 10 mil pedidos e restauração compara os novos dados junto com as recompensas.

Os testes de navegador usam PostgreSQL real e provedores HTTP isolados de teste. Eles não comprovam envio de e-mails ou login/Places em contas reais. A homologação externa continua descrita em `HOMOLOGACAO.md`.

Resultado final: 155 testes unitários/integrados, 49 testes Chromium e seis testes Firefox/WebKit aprovados, além de lint, tipos, build, PostgREST, escala e recuperação. A migração foi aplicada ao Supabase da aplicação, e a disponibilidade das novas tabelas/colunas e das nove RPCs foi confirmada sem ler ou criar dados de usuários. Não há migrations pendentes. Consolidado em [VERIFICACAO.md](./VERIFICACAO.md).
