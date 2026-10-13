# Varredura de UI/UX, lógica e layout — GoIndica

Data: 13 de outubro de 2026. Revisão do código presente no workspace, incluindo suas migrations, com build novo de produção e execução no Chromium. O objetivo foi identificar problemas; nenhuma correção de comportamento foi aplicada.

## Resultado

Foram identificados **12 achados: 2 de prioridade alta, 6 de prioridade média e 4 de prioridade baixa**. Não foi identificado bloqueio geral de uso nos fluxos exercitados. Há perda de conteúdo em situações específicas e falhas visuais que os testes existentes não detectam.

Prioridade alta: quebra uma tarefa ou perde conteúdo. Média: compromete previsibilidade, acessibilidade, compreensão ou estabilidade visual. Baixa: comportamento de borda ou acabamento.

| ID | Prioridade | Achado | Evidência |
| --- | --- | --- | --- |
| 01 | Alta | Texto novo é perdido quando existe rascunho antigo pendente | Reproduzido no navegador |
| 02 | Alta | Alternativa de compartilhamento fica cortada no celular | Reproduzido, medido e fotografado |
| 03 | Média | Descrição do pedido encolhe durante a digitação no desktop | Reproduzido e medido |
| 04 | Média | Voltar perde o contexto da navegação | Reproduzido no navegador |
| 05 | Média | Recuperação de senha perde o destino do pedido compartilhado | Link inspecionado e fluxo confirmado no código |
| 06 | Média | Erros de validação não são associados aos campos | Reproduzido e inspecionado no DOM |
| 07 | Média | Edição de pedido é perdida ao sair sem salvar | Reproduzido no navegador |
| 08 | Baixa | Ranking e lista administrativa podem oferecer próxima página vazia | Confirmado no código e SQL |
| 09 | Baixa | Validação de abas aceita propriedades herdadas | Reproduzido em Atividades; mesmo padrão em Admin |
| 10 | Média | Banner de indicação enviada aparece sem indicação do usuário | Reproduzido no navegador |
| 11 | Baixa | Estado vazio de busca não orienta a recuperação da pesquisa | Reproduzido no navegador |
| 12 | Baixa | Edição mostra “Publicando…” ao salvar | Confirmado no código |

## Achados e recomendações

### 01 — Conteúdo novo não é salvo enquanto existe um rascunho antigo pendente

**Local:** `src/components/request-composer.tsx:32–73`.

**Reprodução:** criar um rascunho, sair e retornar a Novo pedido. Sem clicar em Restaurar/Apagar rascunho, escrever outro texto e sair novamente. Ao retornar e restaurar, aparece o texto antigo; o novo foi perdido.

**Causa:** quando encontra um rascunho, o componente mantém `draftReady=false`. O formulário continua editável, mas a persistência exige `draftReady=true`. Também deixa de persistir quando a cidade está temporariamente sem seleção, o que exige atenção ao corrigir o fluxo.

**Recomendação:** tornar explícita a escolha entre continuar o rascunho e iniciar outro pedido, ou preservar separadamente o conteúdo novo enquanto essa decisão está pendente. Não deixar uma área editável aparentar proteção por rascunho sem salvar suas alterações.

### 02 — Campo de compartilhamento fica fora da tela no celular

**Local:** `src/app/styles/components.css:242–260`; `src/components/share-request.tsx`.

**Reprodução:** em 390 px, abrir um pedido próprio e usar Compartilhar pedido com `navigator.share` e clipboard indisponíveis. O campo “Link do pedido” aparece parcialmente fora da margem esquerda.

**Medição:** campo em **x = −165 px**, largura de 270 px. A página continua com `scrollWidth=390`, por isso as verificações atuais de ausência de transbordamento passam mesmo com o controle cortado.

**Causa:** o painel de até 300 px usa `right:0` em relação ao botão pequeno, posicionado perto da esquerda na barra de ações mobile.

**Recomendação:** posicionar o painel dentro dos limites da tela, com alinhamento mobile adequado, ou apresentar o link em uma região abaixo da barra. Incluir verificação dos limites esquerdo e direito do controle.

**Imagem:** [alternativa de compartilhamento](ux-ui/auditoria-2026-10-13/compartilhar-alternativa.png).

### 03 — Campo de descrição muda de largura ao começar a digitar

**Local:** `src/app/styles/components.css:900`; `src/components/request-composer.tsx:158–208`.

**Reprodução:** em 1440 px, abrir Novo pedido sem rascunho e digitar uma descrição. A descrição deixa de ocupar a largura inteira quando surge “Apagar rascunho atual”.

**Medição:** textarea passa de **660 para 320 px** e sua posição vertical muda em 64 px.

**Causa:** o CSS determina a largura pela condição `.composer > .field:first-child`. O botão de apagar rascunho passa a preceder o campo. Um aviso de rascunho ou o input oculto da edição também altera essa condição estrutural.

**Recomendação:** atribuir uma classe explícita ao campo de descrição e definir sua largura por função, independente da ordem dos filhos. Reservar uma posição estável para os controles de rascunho.

**Imagem:** [formulário desktop após digitação](ux-ui/auditoria-2026-10-13/composer-desktop.png).

### 04 — Voltar leva a destinos fixos e perde filtros e origem

**Local:** `src/components/app-chrome.tsx:9–28`; `src/app/(member)/perfil/[username]/page.tsx`; `src/app/(member)/pedidos/[id]/page.tsx`.

**Reprodução:** pesquisar em `/app?q=auditoria&status=OPEN`, abrir um pedido e usar Voltar: o destino é `/app`, sem a pesquisa. Abrir o próprio perfil público pelo Perfil e usar Voltar: o destino é `/ranking`, apesar de a origem ter sido `/perfil`.

**Impacto:** obriga a reconstruir filtros e muda inesperadamente de área. O mesmo padrão perde a cidade escolhida e a paginação quando esses parâmetros existiam na origem.

**Recomendação:** transportar um destino de retorno interno validado ou usar o histórico com fallback previsível para acessos diretos. Ajustar os links equivalentes no conteúdo para manter o mesmo comportamento.

### 05 — Recuperação de senha descarta o pedido compartilhado

**Local:** `src/app/(public)/entrar/page.tsx:60`; `src/app/(public)/recuperar-senha/page.tsx`; `src/server/password-auth.ts:73–115`.

**Reprodução:** abrir Entrar com `next=/pedidos/<id>` e selecionar Esqueci minha senha. O link é apenas `/recuperar-senha`. O formulário, o link enviado, a troca de senha e o retorno ao login não transportam o destino original.

**Impacto:** depois da recuperação, a pessoa precisa localizar novamente o pedido que motivou o acesso.

**Recomendação:** preservar `next` validado durante toda a recuperação, incluindo callback, confirmação por token e retorno a Entrar. Revisar também as saídas de falha de OAuth: `auth/callback/route.ts` volta a Entrar sem preservar `next`.

### 06 — Mensagens de validação ficam distantes e sem associação aos campos

**Local:** `src/components/action-form.tsx:43–89`; formulários em `src/components/profile-form.tsx`, `auth-fields.tsx` e `request-composer.tsx`.

**Reprodução:** preencher Nome de exibição com dois espaços e salvar. O servidor retorna “Informe seu nome.” e o foco vai corretamente ao campo. Porém, o input permanece sem `aria-invalid` e sem `aria-describedby` apontando para o erro.

**Causa:** `state.fields` é usado para escolher o foco, mas suas mensagens não são expostas junto aos controles. O erro é associado ao formulário e ao botão de envio.

**Recomendação:** mostrar erro próximo ao campo, associar a mensagem ao controle e marcar seu estado inválido. Manter o resumo e o foco que já existem. A condição de erro de rede do seletor de cidades também deve ser distinguida de validação do valor.

**Imagem:** [erro de perfil](ux-ui/auditoria-2026-10-13/erro-perfil.png).

### 07 — Alterações de edição são descartadas sem aviso

**Local:** `src/app/(member)/pedidos/[id]/editar/page.tsx:29`; `src/components/request-composer.tsx`.

**Reprodução:** editar a descrição, usar Voltar e abrir a edição novamente. A alteração desaparece e reaparece a descrição publicada.

**Causa:** edição usa o compositor sem `draftKey` e não possui proteção para saída com alterações. O autosalvamento disponível na criação não cobre a edição.

**Recomendação:** detectar alterações e oferecer salvar/descartar ao sair, ou manter rascunho de edição por pedido, validando novamente a possibilidade de editar. Explicar separadamente que fotos precisam ser selecionadas de novo, como a interface já faz.

### 08 — Próxima página pode existir somente na interface

**Local:** `src/app/(member)/ranking/page.tsx:70`; `src/app/(member)/admin/page.tsx:76`; RPCs `city_ranking` e `admin_accounts` em `supabase/migrations/202610040001_core.sql`.

**Condição:** exatamente 30 resultados restantes. As RPCs retornam no máximo 30, e a interface interpreta `length === 30` como existência de mais dados. A próxima página fica vazia.

**Recomendação:** consultar 31 registros e exibir 30, ou retornar explicitamente `hasMore`/total. Aplicar o mesmo critério de paginação usado em outras listas do projeto.

### 09 — Abas aceitam propriedades do protótipo como valores válidos

**Local:** `src/app/(member)/atividades/page.tsx:25`; `src/app/(member)/admin/page.tsx:70`.

**Reprodução:** acessar `/atividades?tab=toString`. A página não seleciona nenhuma aba. No Admin, o mesmo padrão aceita valores herdados e pode cair no conteúdo de métricas sem selecionar a aba correspondente.

**Causa:** `params.tab in tabs` aceita propriedades herdadas, além das chaves declaradas.

**Recomendação:** validar com `Object.hasOwn`, enum ou uma lista explícita e retornar à aba padrão quando inválido. É um problema de seleção de tela; não foi demonstrado bypass de autorização.

### 10 — Confirmação de indicação depende apenas da URL

**Local:** `src/app/(member)/pedidos/[id]/page.tsx:221`.

**Reprodução:** o próprio autor abre seu pedido já resolvido com `?enviado=1`. A tela informa “Sua indicação foi recebida. Você ganha pontos se este local for confirmado.”, embora o autor não possa indicar no próprio pedido.

**Causa:** qualquer valor verdadeiro de `search.enviado` ativa o banner, sem verificar `ownResult.data`, autoria ou estado do pedido. Reabrir uma URL antiga também pode repetir uma confirmação fora de contexto.

**Recomendação:** condicionar a mensagem a uma contribuição realmente existente do usuário e adequar o texto ao estado atual. Preferir feedback transitório da ação quando necessário.

### 11 — Busca sem resultados não oferece recuperação clara

**Local:** `src/app/(member)/app/page.tsx`, bloco `Empty`.

**Reprodução:** pesquisar um termo inexistente em Sem indicação. O título diz “Nenhum pedido encontrado”, mas o texto orienta genericamente a ver outros pedidos ou publicar. Não há ação explícita de limpar a pesquisa.

**Recomendação:** diferenciar ausência de pedidos da ausência de correspondência. Mostrar termo/cidade relevantes e oferecer “Limpar busca” preservando cidade e status. Manter Publicar pedido como alternativa.

### 12 — Feedback de envio usa verbo incorreto na edição

**Local:** `src/components/request-composer.tsx:108`.

O botão de edição é “Salvar pedido”, mas seu estado pendente é sempre “Publicando…”.

**Recomendação:** usar “Salvando alterações…” na edição e “Publicando…” na criação.

## Validação e limites

- `npm run lint`: passou.
- `npm run typecheck`: passou.
- `npm test`: **155 testes em 17 arquivos passaram**, incluindo integração com PostgreSQL temporário.
- Build de produção em diretório separado: passou.
- Suíte E2E: **49 testes passaram no Chromium**, incluindo verificações de responsividade em larguras de 320 a 1440 px.
- Inspeções adicionais: reprodução de estados de rascunho, navegação, formulário inválido, compartilhamento sem APIs, banner por URL e mudança de largura do compositor. Medições em [evidencias.json](ux-ui/auditoria-2026-10-13/evidencias.json).

Os testes usaram PostgreSQL descartável e fixtures HTTP de Supabase e Google Places. Não houve acesso a contas de produção nem homologação de provedores reais. Nesta varredura não foram executadas as suítes adicionais Firefox/WebKit, nem testes com teclado virtual de aparelho físico. Os achados de paginação e parte do fluxo de recuperação são sustentados pela inspeção do código; não são apresentados como reprodução integral com serviços reais.

Verificações adicionais também confirmaram que o formulário de perfil mantém o valor após salvar e que marcar notificações como lidas atualiza o contador do cabeçalho. Esses comportamentos não foram classificados como problemas.

## Ordem de correção sugerida

1. Preservar o texto novo quando há rascunho pendente e trazer o painel de compartilhamento para dentro da tela.
2. Estabilizar o layout do compositor, preservar o retorno e o destino da recuperação de senha.
3. Associar erros aos campos, proteger alterações de edição e corrigir a confirmação por URL.
4. Ajustar paginação, seleção de abas, estados vazios e texto de salvamento.

A cobertura atual é útil, mas ausência de transbordamento horizontal não garante que controles estejam dentro da área visível. Os dois primeiros ajustes de layout devem ter verificação dos próprios controles e dos estados que alteram a estrutura da tela.
