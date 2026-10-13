import { ScrollableTabs } from '@/components/scrollable-tabs';
import Link from 'next/link';
import { pageNumber } from '@/lib/pagination';
import type { LocalRequest, Reward } from '@/lib/types';
import { member } from '@/server/auth';
import { check } from '@/lib/errors';
import { citiesFor, date, resolutionsFor } from '@/server/queries';
import { RequestCard } from '@/components/request-card';
import { Empty, Pagination } from '@/components/ui';
export const metadata = { title: 'Minhas atividades' };
const tabs = {
  requests: 'Meus pedidos',
  decision: 'Para decidir',
  indications: 'Minhas indicações',
  confirmed: 'Confirmadas',
  closed: 'Encerrados',
};
export default async function Activities({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const { db, user } = await member();
  const params = await searchParams;
  const tab = params.tab && params.tab in tabs ? (params.tab as keyof typeof tabs) : 'requests';
  const page = pageNumber(params.page);
  const start = (page - 1) * 20;
  let requests: LocalRequest[] = [];
  let rewards: Reward[] | undefined;
  if (tab === 'indications') {
    const indications = check(
      await db
        .from('indications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .order('id')
        .range(start, start + 20),
    );
    const ids = indications.map((i) => i.request_id);
    requests = ids.length
      ? check(await db.from('requests').select('*').in('id', ids)).sort(
          (a, b) => ids.indexOf(a.id) - ids.indexOf(b.id),
        )
      : [];
  } else if (tab === 'confirmed') {
    rewards = check(
      await db
        .from('reward_events')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .order('id')
        .range(start, start + 20),
    );
    const ids = rewards.map((r) => r.request_id);
    requests = ids.length ? check(await db.from('requests').select('*').in('id', ids)) : [];
  } else {
    let query = db
      .from('requests')
      .select('*')
      .eq('requester_id', user.id)
      .order('created_at', { ascending: false })
      .order('id');
    if (tab === 'decision')
      query = query.or('status.eq.REVEALED,and(status.eq.OPEN,indication_count.gt.0)');
    if (tab === 'closed') query = query.in('status', ['RESOLVED', 'CLOSED_NO_RESULT', 'CANCELED']);
    requests = check(await query.range(start, start + 20));
  }
  const [cities, resolutions] = await Promise.all([citiesFor(requests), resolutionsFor(requests)]);
  return (
    <>
      <p className="eyebrow">Tudo o que você movimentou</p>
      <div className="heading-action">
        <h1>Minhas atividades</h1>
        <Link href="/pedidos/novo" className="button">
          Novo pedido
        </Link>
      </div>
      <ScrollableTabs active={tab} label="Tipo de atividade" className="activity-tabs">
        {Object.entries(tabs).map(([key, label]) => (
          <Link
            className={tab === key ? 'active' : ''}
            aria-current={tab === key ? 'page' : undefined}
            key={key}
            href={'/atividades?tab=' + key}
          >
            {label}
          </Link>
        ))}
      </ScrollableTabs>
      {tab === 'confirmed' ? (
        rewards?.length ? (
          <div>
            {rewards.slice(0, 20).map((e) => {
              const request = requests.find((r) => r.id === e.request_id);
              return (
                <article className="ledger-row" key={e.id}>
                  <div>
                    {request ? (
                      <Link href={'/pedidos/' + request.id}>
                        <strong>{request.description}</strong>
                      </Link>
                    ) : (
                      <strong>Solicitação moderada</strong>
                    )}
                    <p className="hint">
                      Indicação confirmada · {date(e.created_at)} ·{' '}
                      {cities.get(e.city_id)?.name || 'Recompensa registrada'}
                    </p>
                  </div>
                  <strong className="points">+{e.points}</strong>
                </article>
              );
            })}
          </div>
        ) : (
          <Empty title="Suas primeiras confirmações vão aparecer aqui.">
            Cada indicação confirmada rende 10 pontos.
          </Empty>
        )
      ) : requests.length ? (
        <div>
          {requests.slice(0, 20).map((r) => (
            <RequestCard
              key={r.id}
              request={r}
              city={cities.get(r.city_id)}
              resolution={resolutions.get(r.id)}
            />
          ))}
        </div>
      ) : (
        <Empty title="Suas perguntas e indicações aparecerão aqui.">
          <Link className="text-link" href="/app">
            Explorar os pedidos da cidade ↗
          </Link>
        </Empty>
      )}
      <Pagination
        page={page}
        hasMore={(rewards || requests).length > 20}
        base="/atividades"
        params={{ tab }}
      />
    </>
  );
}
