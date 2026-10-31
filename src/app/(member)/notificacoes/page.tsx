import Link from 'next/link';
import { PageHeading } from '@/components/page-heading';
import { Icon, type IconName } from '@/components/icon';
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
} as const;

const icons: Record<keyof typeof labels, IconName> = {
  INDICATION_RECEIVED: 'message',
  RESULT_RECORDED: 'check',
  REWARD_RECEIVED: 'award',
  DECISION_REMINDER: 'clock',
  TOPIC_MATCH: 'sparkle',
};

type NotificationKind = keyof typeof labels;

function NotificationCard({
  id,
  kind,
  requestId,
  description,
  createdAt,
  unread,
}: {
  id: number;
  kind: NotificationKind;
  requestId: number;
  description: string;
  createdAt: string;
  unread: boolean;
}) {
  return (
    <article className={`notification-card${unread ? ' is-unread' : ''}`}>
      <span className="notification-event" aria-hidden="true">
        <Icon name={icons[kind] || 'bell'} size={20} />
      </span>
      <div className="notification-body">
        <div className="notification-heading">
          <p className="notification-title">
            {unread ? <span className="unread-dot" role="img" aria-label="Não lida" /> : null}
            <strong>{labels[kind] || 'Nova notificação'}</strong>
          </p>
          <time className="notification-time" dateTime={createdAt}>
            {timestamp(createdAt)}
          </time>
        </div>
        <Link className="notification-request" href={'/pedidos/' + requestId}>
          {description}
          <Icon name="external" size={14} />
        </Link>
        {unread ? (
          <ActionForm
            action={readNotifications}
            label="Marcar como lida"
            className="compact quiet notification-read"
          >
            <input name="id" type="hidden" value={id} />
          </ActionForm>
        ) : null}
      </div>
    </article>
  );
}

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
  const visible = rows.slice(0, 20);
  const requests = visible.length
    ? check(
        await db
          .from('requests')
          .select('id,description')
          .in(
            'id',
            visible.map((r) => r.request_id),
          ),
      )
    : [];
  const descriptions = new Map(requests.map((r) => [r.id, r.description]));
  const unread = visible.filter((r) => !r.read_at);
  const read = visible.filter((r) => r.read_at);
  const showSections = unread.length > 0 && read.length > 0;

  return (
    <div className="collection-page notifications-page">
      <PageHeading
        title="Notificações"
        description="Indicações, descobertas e reconhecimento. Tudo por aqui."
      />
      <div className="notification-toolbar">
        <Link className="text-link" href="/atividades?tab=decision">
          Pedidos aguardando minha decisão
          <Icon name="external" size={14} />
        </Link>
        {unread.length ? (
          <ActionForm
            action={readNotifications}
            label="Marcar todas como lidas"
            className="compact quiet"
          />
        ) : null}
      </div>
      {visible.length ? (
        <div className="notification-feed">
          {showSections ? <h2 className="notification-section">Não lidas</h2> : null}
          {unread.length ? (
            <ul className="notification-list">
              {unread.map((r) => (
                <li key={r.id}>
                  <NotificationCard
                    id={r.id}
                    kind={r.kind as NotificationKind}
                    requestId={r.request_id}
                    description={descriptions.get(r.request_id) || 'Abrir pedido'}
                    createdAt={r.created_at}
                    unread
                  />
                </li>
              ))}
            </ul>
          ) : null}
          {showSections ? <h2 className="notification-section">Anteriores</h2> : null}
          {read.length ? (
            <ul className="notification-list">
              {read.map((r) => (
                <li key={r.id}>
                  <NotificationCard
                    id={r.id}
                    kind={r.kind as NotificationKind}
                    requestId={r.request_id}
                    description={descriptions.get(r.request_id) || 'Abrir pedido'}
                    createdAt={r.created_at}
                    unread={false}
                  />
                </li>
              ))}
            </ul>
          ) : null}
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
