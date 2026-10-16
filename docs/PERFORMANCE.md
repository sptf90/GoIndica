# Desempenho — 16 de outubro de 2026

O carregamento do feed fazia transações de leitura com vários comandos de configuração,
validação e limpeza. Esse custo existia mesmo com poucas linhas no banco.

## Comparação controlada

Medição feita nesta máquina, pelo Node.js 22, com o banco remoto configurado no ambiente
local. Foram três execuções consecutivas de cada versão, usando uma identidade fornecida
ao `DatabaseClient` e um pool reutilizado. Nenhum registro foi alterado.

A sequência foi: estado da conta, perfil, cidade, busca de pedidos abertos, cidades
acompanhadas e resumo do membro. A contagem inclui `BEGIN` e `COMMIT`.

| Medida                    | Antes            | Depois           |
| ------------------------- | ---------------- | ---------------- |
| Comandos ao banco         | 29               | 8                |
| Tempos das três execuções | 455, 357, 367 ms | 182, 100, 102 ms |
| Mediana                   | 367 ms           | 102 ms           |

A redução de aproximadamente 72% se refere a essa sequência de leitura. Não inclui
login, navegador, transferência de arquivos, consultas adicionais de resoluções nem o
tempo de autenticação da sessão. A conexão com o banco varia; medições anteriores da
versão antiga também registraram de 495 a 1768 ms. Não representa uma garantia de
latência na hospedagem nem uma medição de Core Web Vitals.

## Alterações

- Estado da conta e perfil completo são consultados em paralelo durante a autenticação.
- A verificação de conta e existência do perfil usa uma consulta, em vez de duas.
- Busca, resumo, disponibilidade de edição e leitura de fotos dispensam transações.
- As consultas de dados dessas leituras verificam novamente conta ativa, perfil e
  privilégios administrativos no próprio SQL, protegendo contra mudanças após a validação.
- Ranking, estatísticas públicas e verificação de saúde fazem leituras sem transação.
- O feed busca cidade, cidades acompanhadas e resumo em paralelo. As resoluções e os
  nomes das cidades acompanhadas também são carregados em paralelo.
- Cada operação usa sua própria cópia das permissões, evitando interferência entre
  operações simultâneas do mesmo cliente.
- Gravações mantêm transações, bloqueios, limites e retentativas; dois comandos de
  configuração da conexão foram unidos em um.

## Verificação

Execute `npm run check` e os fluxos de navegador:

```sh
npm run test:e2e -- tests/e2e/email-auth.spec.ts tests/e2e/migration.spec.ts tests/e2e/discovery.spec.ts tests/e2e/google-places.spec.ts
```

Os testes de integração usam um MySQL descartável no Docker e cobrem também bloqueio
entre validação e consulta, remoção de privilégios e acesso sem perfil.

Validação desta alteração: lint, TypeScript, build e os 72 testes do projeto passaram.
Os 14 testes de navegador acima passaram usando o build de produção e um banco
descartável. A suíte principal de integração também passou no MariaDB 10.11 (14 testes).

Após publicar, medir novamente uma sessão autenticada em `/app` e no detalhe de um
pedido, incluindo envio de indicação. Comparar três navegações equivalentes, com o
mesmo dispositivo, conexão e estado de cache. Os números locais não substituem essa
verificação no servidor publicado.
