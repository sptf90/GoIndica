import Link from 'next/link';
import { PageHeading } from '@/components/page-heading';
import { Icon } from '@/components/icon';
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
  check(await db.call('refresh_reminders'));
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
    <div className="collection-page notifications-page">
      <PageHeading
        title="Notificações"
        description="Indicações, descobertas e reconhecimento. Tudo por aqui."
      />
      <div className="notification-toolbar">
        <Link className="text-link" href="/atividades?tab=decision">
          Pedidos aguardando minha decisão ↗
        </Link>
        <ActionForm
          action={readNotifications}
          label="Marcar todas como lidas"
          className="compact quiet"
        />
      </div>
      {rows.length ? (
        <div className="community-list">
          {rows.slice(0, 20).map((r) => (
            <article className={`community-row notification-row${!r.read_at ? ' is-unread' : ''}`} key={r.id}>
              <span className="notification-event">
                <Icon name={r.kind === 'REWARD_RECEIVED' ? 'award' : 'message'} size={22} />
              </span>
              <div>
                <p>
                  {!r.read_at ? (
                    <span className="unread-dot" role="img" aria-label="Não lida" />
                  ) : null}
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
        <Empty title="Você está em dia.">
          <p>Novas indicações e confirmações aparecem aqui.</p>
          <Link href="/app" className="text-link">
            Ver pedidos da cidade
          </Link>
        </Empty>
      )}
      <Pagination page={page} hasMore={rows.length > 20} base="/notificacoes" />
    </div>
  );
}
