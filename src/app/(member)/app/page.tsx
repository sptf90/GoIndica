import { ScrollableTabs } from '@/components/scrollable-tabs';
import Link from 'next/link';
import { pageNumber } from '@/lib/pagination';
import { member } from '@/server/auth';
import { check } from '@/lib/errors';
import { CitySelector } from '@/components/city-selector';
import { RequestCard } from '@/components/request-card';
import { Empty, Pagination } from '@/components/ui';
import { resolutionsFor } from '@/server/queries';
export const metadata = { title: 'Pergunte à cidade' };
export default async function Feed({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; q?: string; status?: string; page?: string }>;
}) {
  const { db, profile } = await member();
  const params = await searchParams;
  const cityId = Number(params.city) || profile.home_city_id;
  const page = pageNumber(params.page);
  const q = (params.q || '').trim().slice(0, 300);
  const status =
    params.status === 'RESOLVED'
      ? 'RESOLVED'
      : params.status === 'UNANSWERED'
        ? 'UNANSWERED'
        : 'OPEN';
  const cityResult = await db.from('cities').select('*').eq('id', cityId).maybeSingle();
  const city =
    cityResult.data ||
    check(await db.from('cities').select('*').eq('id', profile.home_city_id).single());
  const requests = check(
    status === 'UNANSWERED'
      ? await db.rpc('search_unanswered_requests', {
          p_city_id: city.id,
          p_query: q,
          p_offset: (page - 1) * 20,
        })
      : await db.rpc('search_requests', {
          p_city_id: city.id,
          p_query: q,
          p_status: status,
          p_offset: (page - 1) * 20,
        }),
  );
  const resolutions = await resolutionsFor(requests);
  const newRequest =
    '/pedidos/novo?' + new URLSearchParams({ city: String(city.id), ...(q ? { q } : {}) });
  const followed = check(await db.from('followed_cities').select('city_id'));
  const followedCities = followed.length
    ? check(
        await db
          .from('cities')
          .select('*')
          .in(
            'id',
            followed.map((f) => f.city_id),
          ),
      )
    : [];
  const more = requests.length > 20;
  return (
    <>
      <section className="app-intro">
        <p className="eyebrow">O conhecimento começa com uma pergunta</p>
        <div className="heading-action">
          <h1>
            O que você está
            <br className="mobile-break" /> procurando?
          </h1>
          <Link href={newRequest} className="button">
            {q ? 'Publicar esta busca' : 'Novo pedido +'}
          </Link>
        </div>
        <p className="muted">Pergunte à cidade ou ajude alguém a encontrar o caminho.</p>
      </section>
      {followedCities.length ? (
        <nav className="city-shortcuts" aria-label="Cidades acompanhadas">
          {followedCities.map((c) => (
            <Link
              key={c.id}
              href={'/app?' + new URLSearchParams({ city: String(c.id), q, status })}
            >
              {c.name} — {c.state_code}
            </Link>
          ))}
          <Link href="/preferencias">Gerenciar cidades ↗</Link>
        </nav>
      ) : null}
      <form className="feed-search" action="/app">
        <div className="field">
          <label htmlFor="query">Buscar pedidos</label>
          <input
            id="query"
            name="q"
            placeholder="O que você precisa encontrar?"
            defaultValue={q}
            maxLength={300}
          />
        </div>
        <CitySelector key={city.id} initial={city} name="city" />
        <input type="hidden" name="status" value={status} />
        <button className="button secondary">Buscar na cidade</button>
      </form>
      <div className="section-bar">
        <ScrollableTabs active={status} label="Filtrar solicitações">
          <Link
            className={status === 'OPEN' ? 'active' : ''}
            aria-current={status === 'OPEN' ? 'page' : undefined}
            href={'/app?' + new URLSearchParams({ city: String(city.id), q, status: 'OPEN' })}
          >
            Procurando
          </Link>
          <Link
            className={status === 'UNANSWERED' ? 'active' : ''}
            aria-current={status === 'UNANSWERED' ? 'page' : undefined}
            href={'/app?' + new URLSearchParams({ city: String(city.id), q, status: 'UNANSWERED' })}
          >
            Sem indicação
          </Link>
          <Link
            className={status === 'RESOLVED' ? 'active' : ''}
            aria-current={status === 'RESOLVED' ? 'page' : undefined}
            href={'/app?' + new URLSearchParams({ city: String(city.id), q, status: 'RESOLVED' })}
          >
            Descobertas confirmadas
          </Link>
        </ScrollableTabs>
        <span className="hint">
          {city.name} — {city.state_code}
        </span>
      </div>
      {status === 'UNANSWERED' ? (
        <p className="hint unanswered-hint">
          Pedidos que ainda precisam de ajuda, começando pelos mais antigos.
        </p>
      ) : null}
      {requests.length ? (
        <div className="request-list">
          {requests.slice(0, 20).map((r) => (
            <RequestCard key={r.id} request={r} city={city} resolution={resolutions.get(r.id)} />
          ))}
        </div>
      ) : (
        <Empty
          title={
            q
              ? 'Nenhum pedido encontrado.'
              : status === 'UNANSWERED'
                ? 'Nenhum pedido sem indicação nesta cidade.'
                : status === 'OPEN'
                  ? 'Ainda não há pedidos por aqui.'
                  : 'A cidade ainda está construindo seu histórico.'
          }
        >
          <p>
            {status === 'UNANSWERED'
              ? 'Veja os outros pedidos da cidade ou publique o que você procura.'
              : status === 'OPEN'
                ? 'Que tal ser a primeira pessoa a perguntar?'
                : 'As descobertas aparecem quando alguém confirma onde encontrou.'}
          </p>
          <Link href={newRequest} className="text-link">
            Publicar um pedido ↗
          </Link>
        </Empty>
      )}
      <Pagination
        page={page}
        hasMore={more}
        base="/app"
        params={{ city: String(city.id), q, status }}
      />
    </>
  );
}
