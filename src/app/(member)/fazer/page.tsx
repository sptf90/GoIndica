import { Suspense } from 'react';
import Link from 'next/link';
import { pageNumber } from '@/lib/pagination';
import { member } from '@/server/auth';
import { check } from '@/lib/errors';
import { FeedSearch } from '@/components/feed-search';
import { Icon } from '@/components/icon';
import { RequestCard } from '@/components/request-card';
import { RequestRowsSkeleton } from '@/components/skeletons';
import { Empty, Pagination } from '@/components/ui';
import type { City } from '@/lib/types';
import { PageHeading } from '@/components/page-heading';

export const metadata = { title: 'Fazer uma indicação' };

async function IndicateList({ city, q, page }: { city: City; q: string; page: number }) {
  const { db, user } = await member();
  const requests = check(
    await db.call('search_requests', {
      p_city_id: city.id,
      p_query: q,
      p_status: 'OPEN',
      p_offset: (page - 1) * 20,
    }),
  );
  // LIS-03: excluir próprios e já respondidos na camada de apresentação.
  const ownIds = new Set(
    check(
      await db.from('indications').select('request_id').eq('user_id', user.id),
    ).map((i) => i.request_id),
  );
  const visible = requests.filter((r) => r.requester_id !== user.id && !ownIds.has(r.id));
  const more = requests.length > 20;
  return (
    <div className="stream-enter">
      {visible.length ? (
        <div className="request-list">
          {visible.slice(0, 20).map((r, index) => (
            <RequestCard key={r.id} index={index} request={r} city={city} />
          ))}
        </div>
      ) : (
        <Empty title="Não há pedidos disponíveis no momento." />
      )}
      <Pagination
        page={page}
        hasMore={more}
        base="/fazer"
        params={{ city: String(city.id), q }}
      />
    </div>
  );
}

export default async function FazerPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; q?: string; page?: string }>;
}) {
  const { db, profile } = await member();
  const params = await searchParams;
  const cityId = Number(params.city) || profile.home_city_id;
  const page = pageNumber(params.page);
  const q = (params.q || '').trim().slice(0, 300);
  const cityResult = await db.from('cities').select('*').eq('id', cityId).maybeSingle();
  const city =
    cityResult.data ||
    check(await db.from('cities').select('*').eq('id', profile.home_city_id).single());
  return (
    <div className="collection-page">
      <PageHeading
        title="Fazer uma indicação"
        eyebrow="Pedidos da cidade"
        description="Ajude pedidos abertos na cidade escolhida. O solicitante permanece anônimo."
      />
      <p className="feed-city">
        <Icon name="pin" size={17} />
        <span>
          {city.name}
          <small>{city.state_code}</small>
        </span>
      </p>
      <FeedSearch
        key={city.id + ':' + q}
        city={city}
        query={q}
        status="OPEN"
        action="/fazer"
        showCreate={false}
      />
      <p className="hint">
        A cidade do filtro pode ser trocada sem alterar seu perfil. Pedidos em avaliação aparecem
        só como consulta, sem ação de enviar.
      </p>
      <Suspense
        key={`${city.id}:${q}:${page}`}
        fallback={
          <div role="status" aria-label="Carregando pedidos">
            <RequestRowsSkeleton />
          </div>
        }
      >
        <IndicateList city={city} q={q} page={page} />
      </Suspense>
      <p className="hint">
        <Link href="/app">Voltar às ações principais ↗</Link>
      </p>
    </div>
  );
}
