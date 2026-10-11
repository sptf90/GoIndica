# Homologação com Google e Supabase reais

A suíte local verifica PostgreSQL e PostgREST reais, permissões, RPCs e navegadores; Auth e Google usam fornecedores isolados no E2E. Ela não confirma consentimento OAuth do seu Google Cloud, quotas/billing, chave Places, Supabase hospedado ou URLs do seu domínio. Para isso, use um projeto de homologação separado e as integrações reais configuradas conforme o README.

## Primeiro ciclo externo

1. Execute migrations no Supabase de homologação e configure as variáveis reais fora do repositório.
2. Inicie a aplicação. Faça login por e-mail/senha ou Google como solicitante e conclua o onboarding. Para e-mail, valide também confirmação, recuperação e login com a senha nova; para Google, habilite o provider e `GOOGLE_OAUTH_ENABLED=true`.
3. Em dois outros perfis de navegador, faça login com contas distintas. Uma pode ter cidade de perfil diferente.
4. O solicitante publica um pedido em uma cidade conhecida.
5. Os dois indicantes selecionam o mesmo estabelecimento **real** na cidade, retornado pelo Google. Uma tentativa de local em município vizinho deve ser rejeitada.
6. O solicitante vê somente a contagem antes de revelar. Compare também as respostas REST autenticadas: indicações/places não podem revelar respostas de terceiros nessa fase.
7. Abra as indicações. Confirme o estabelecimento selecionado após verificar o resultado. Nas duas contas, confirme +10 no perfil, ledger e ranking da cidade do pedido.
8. Repita a confirmação em outra aba. Confira um único registro em request_resolutions e duas recompensas (uma para cada indicante).
9. Confirme que o histórico e a busca em novas solicitações mostram o local e a data, com o aviso de disponibilidade.
10. Teste “encontrei em outro local” e “não encontrei” em novos pedidos: nenhuma recompensa.
11. Atribua um administrador em homologação, denuncie conteúdo e verifique bloqueio, remoção e log.
12. Confira as sete migrations novas, métricas filtradas por cidade/dia UTC e painel de operações. Refaça cadastro por link de pedido, confirmação em outro navegador e retorno ao mesmo pedido; o template de confirmação deve carregar `.RedirectTo`, como no README.
13. Salve/acompanhe um pedido e confirme notificações sem revelar local antes da abertura. Habilite e depois desabilite o consentimento de e-mail em `/preferencias`; configure Resend/agendador conforme `OPERACAO.md` e confira envio real e cancelamento de novas entregas.
14. Em uma conta descartável com pontos, baixe a exportação, troque senha/e-mail com confirmação real e solicite encerramento. O administrador conclui; confira Auth anonimizado, novo acesso negado, textos anonimizados e recompensas preservadas. Esse ensaio altera irreversivelmente a identidade descartável; use apenas contas de homologação.
15. Configure monitoramento externo e backup do projeto; ensaie restauração em ambiente separado. O dump/restore temporário local não substitui o processo de recuperação do serviço hospedado.

A disponibilidade é indicada por pessoas e verificada pelo solicitante; não use esse teste para afirmar estoque automaticamente.

## Playwright em homologação

A configuração `playwright.live.config.ts` usa `E2E_BASE_URL` e estados de sessão capturados depois de **login real**, por e-mail/senha ou Google. Arquivos de sessão ficam em `tests/.auth` e são ignorados pelo Git. Trate-os como secrets temporários e não compartilhe os artifacts de traces publicamente.

Capture três contas distintas com onboarding concluído (o codegen grava cookies ao encerrar):

```bash
mkdir -p tests/.auth
npx playwright codegen --save-storage=tests/.auth/owner.json https://seu-ambiente-de-homologacao/entrar
npx playwright codegen --save-storage=tests/.auth/helper-a.json https://seu-ambiente-de-homologacao/entrar
npx playwright codegen --save-storage=tests/.auth/helper-b.json https://seu-ambiente-de-homologacao/entrar
```

Execute o teste passando ambiente, código IBGE da cidade e o nome/ID oficiais de um estabelecimento real. As variáveis podem ser injetadas pelo gerenciador de secrets ou por um arquivo de ambiente local ignorado pelo Git. O teste cria conteúdo em homologação e confirma a recompensa; não o aponte para produção.

```bash
npm run test:e2e:live
```

Variáveis específicas desse teste: `E2E_BASE_URL`, `E2E_CITY_ID`, `E2E_PLACE_QUERY`, `E2E_PLACE_ID`, `E2E_HELPER_A_USERNAME`, `E2E_HELPER_B_USERNAME` e `E2E_ALLOW_WRITES=homologacao`. O teste falha se essas informações ou estados de sessão faltarem; não é contado como aprovado sem executá-lo.

Remova os estados após a homologação, encerre as sessões e revise os dados de teste antes de abrir o serviço ao público.
