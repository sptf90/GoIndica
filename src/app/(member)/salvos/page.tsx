import Link from 'next/link';
import { PageHeading } from '@/components/page-heading';
import { ScrollableTabs } from '@/components/scrollable-tabs';
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
    <div className="collection-page saved-page">
      <PageHeading
        title={following ? 'Pedidos que acompanho' : 'Pedidos salvos'}
        description="Guarde os caminhos que quer explorar e acompanhe novas indicações."
        action={rows.length ? <Link href="/app" className="button secondary">Explorar pedidos</Link> : undefined}
      />
      <ScrollableTabs active={following ? 'following' : 'saved'} label="Itens da sua lista">
        <Link aria-current={!following ? 'page' : undefined} href="/salvos">
          Salvos
        </Link>
        <Link aria-current={following ? 'page' : undefined} href="/salvos?tab=following">
          Acompanhando
        </Link>
      </ScrollableTabs>
      {rows.length ? (
        <div className="request-list">
          {rows.map((r, index) => (
            <RequestCard
              key={r.id}
              index={index}
              request={r}
              city={cities.get(r.city_id)!}
              resolution={resolutions.get(r.id)}
            />
          ))}
        </div>
      ) : (
        <Empty title="Sua lista está vazia.">
          <p>Salve um pedido para voltar a ele depois.</p>
          <Link href="/app" className="text-link">
            Explorar pedidos
          </Link>
        </Empty>
      )}
      <Pagination
        page={page}
        hasMore={interests.length > 20}
        base="/salvos"
        params={following ? { tab: 'following' } : {}}
      />
    </div>
  );
}
