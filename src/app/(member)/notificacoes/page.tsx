import Link from 'next/link';
import { member } from '@/server/auth';
import { check } from '@/lib/errors';
import { pageNumber } from '@/lib/pagination';
import { timestamp } from '@/server/queries';
import { readNotifications } from '@/server/community-actions';
import { ActionForm } from '@/components/action-form';
import { Empty, Pagination } from '@/components/ui';
export const metadata = { title: 'Notificações' };
const labels = {
  INDICATION_RECEIVED: 'Uma nova indicação chegou',
  RESULT_RECORDED: 'O resultado de um pedido foi registrado',
  REWARD_RECEIVED: 'Sua indicação foi confirmada: +10 pontos',
  DECISION_REMINDER: 'Há um pedido aguardando sua decisão',
  TOPIC_MATCH: 'Um novo pedido combina com seus assuntos',
};
export default async function Notifications({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { db } = await member();
  check(await db.rpc('refresh_reminders'));
  const page = pageNumber((await searchParams).page);
  const rows = check(
    await db
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id')
      .range((page - 1) * 20, page * 20),
  );
  const requests = rows.length
    ? check(
        await db
          .from('requests')
          .select('id,description')
          .in(
            'id',
            rows.map((r) => r.request_id),
          ),
      )
    : [];
  const descriptions = new Map(requests.map((r) => [r.id, r.description]));
  return (
    <>
      <p className="eyebrow">A comunidade continua a conversa</p>
      <h1>Notificações</h1>
      <p className="muted">
        Locais e pessoas continuam privados enquanto as indicações não forem abertas.
      </p>
      <Link className="text-link" href="/atividades?tab=decision">
        Pedidos aguardando minha decisão ↗
      </Link>
      <ActionForm
        action={readNotifications}
        label="Marcar todas como lidas"
        className="compact quiet"
      />
      {rows.length ? (
        <div className="community-list">
          {rows.slice(0, 20).map((r) => (
            <article className="community-row" key={r.id}>
              <div>
                <p>
                  {!r.read_at ? <span className="unread-dot" aria-label="Não lida" /> : null}
                  <strong>{labels[r.kind as keyof typeof labels]}</strong>
                </p>
                <Link href={'/pedidos/' + r.request_id}>
                  {descriptions.get(r.request_id) || 'Abrir pedido'} ↗
                </Link>
                <p className="hint">{timestamp(r.created_at)}</p>
              </div>
              {!r.read_at ? (
                <ActionForm
                  action={readNotifications}
                  label="Marcar como lida"
                  className="compact quiet"
                >
                  <input name="id" type="hidden" value={r.id} />
                </ActionForm>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <Empty title="Nenhuma notificação por enquanto." />
      )}
      <Pagination page={page} hasMore={rows.length > 20} base="/notificacoes" />
    </>
  );
}
