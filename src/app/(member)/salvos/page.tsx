import Link from 'next/link';
import { member } from '@/server/auth';
import { check } from '@/lib/errors';
import { pageNumber } from '@/lib/pagination';
import { citiesFor, resolutionsFor } from '@/server/queries';
import { Empty, Pagination } from '@/components/ui';
import { RequestCard } from '@/components/request-card';
export const metadata = { title: 'Pedidos salvos' };
export default async function Saved({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; tab?: string }>;
}) {
  const { db } = await member();
  const params = await searchParams,
    page = pageNumber(params.page),
    following = params.tab === 'following';
  const interests = check(
    await db
      .from('request_interests')
      .select('*')
      .eq(following ? 'following' : 'saved', true)
      .order('created_at', { ascending: false })
      .order('request_id')
      .range((page - 1) * 20, page * 20),
  );
  const ids = interests.slice(0, 20).map((i) => i.request_id);
  const rows = ids.length ? check(await db.from('requests').select('*').in('id', ids)) : [];
  const order = new Map(ids.map((id, index) => [id, index]));
  rows.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  const [cities, resolutions] = await Promise.all([citiesFor(rows), resolutionsFor(rows)]);
  return (
    <>
      <h1>{following ? 'Pedidos que acompanho' : 'Pedidos salvos'}</h1>
      <nav className="profile-links">
        <Link aria-current={!following ? 'page' : undefined} href="/salvos">
          Salvos
        </Link>
        <Link aria-current={following ? 'page' : undefined} href="/salvos?tab=following">
          Acompanhando
        </Link>
      </nav>
      <p className="muted">Abra um pedido para salvar, acompanhar ou remover da sua lista.</p>
      {rows.length ? (
        <div className="request-list">
          {rows.map((r) => (
            <RequestCard
              key={r.id}
              request={r}
              city={cities.get(r.city_id)!}
              resolution={resolutions.get(r.id)}
            />
          ))}
        </div>
      ) : (
        <Empty title="Sua lista está vazia." />
      )}
      <Pagination
        page={page}
        hasMore={interests.length > 20}
        base="/salvos"
        params={following ? { tab: 'following' } : {}}
      />
    </>
  );
}
