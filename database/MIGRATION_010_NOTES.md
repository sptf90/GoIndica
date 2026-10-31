# Migration 010 — MVP comparação (não aplicada automaticamente)

**Arquivo:** `database/migrations/010_mvp_comparison.sql`

## Antes de aplicar

1. Backup completo do banco.
2. Confirmar ambiente (dev/staging). **Não rodar em produção sem autorização explícita.**
3. Revisar o SQL (ENUM novos, colunas, triggers, `ranking_sponsorships`, `indication_evaluations`).

## Aplicar (dev/staging)

```bash
npm run banco:migrar
```

## Rollback

Restaurar o backup verificado. Não há script destrutivo de down; a migration é compensável via restore.

## Mapeamento legado

| Antes | Depois |
|---|---|
| `REVEALED` sem seleção | `OPEN` + `first_comparison_opened_at` preenchido |
| `RESOLVED` | permanece; pontos legados em `SUCCESSFUL_INDICATION_REWARD` preservados |
| `CLOSED_NO_RESULT` | Encerrado sem solução |
| Novos | `EVALUATING`, `CLOSED_TIMEOUT`, `CLOSED_EXHAUSTED` |

## Cron após migrate

```bash
npm run cron:avaliacoes
```

Configurar no host o mesmo padrão de `cron:lembretes`.
