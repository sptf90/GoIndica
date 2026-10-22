import { Suspense } from 'react';
import { memberSummary } from '@/server/queries';
import { ScrollableTabs } from '@/components/scrollable-tabs';
import Link from 'next/link';
import { pageNumber } from '@/lib/pagination';
import { member } from '@/server/auth';
import { check } from '@/lib/errors';
import { FeedSearch } from '@/components/feed-search';
import { Icon } from '@/components/icon';
import { RequestCard } from '@/components/request-card';
import { RequestRowsSkeleton } from '@/components/skeletons';
import { Empty, Pagination } from '@/components/ui';
import { resolutionsFor } from '@/server/queries';
import type { City } from '@/lib/types';
export const metadata = { title: 'Pergunte à cidade' };
type FeedStatus = 'OPEN' | 'UNANSWERED' | 'RESOLVED';
async function FeedResults({
  city,
  q,
  status,
  page,
  newRequest,
}: {
  city: City;
  q: string;
  status: FeedStatus;
  page: number;
  newRequest: string;
}) {
  const { db } = await member();
  const requests = check(
    status === 'UNANSWERED'
      ? await db.call('search_unanswered_requests', {
          p_city_id: city.id,
          p_query: q,
          p_offset: (page - 1) * 20,
        })
      : await db.call('search_requests', {
          p_city_id: city.id,
          p_query: q,
          p_status: status,
          p_offset: (page - 1) * 20,
        }),
  );
  const resolutions = await resolutionsFor(requests);
  const more = requests.length > 20;
  return (
    <div className="stream-enter">
      {requests.length ? (
        <div className="request-list">
          {requests.slice(0, 20).map((r, index) => (
            <RequestCard
              key={r.id}
              index={index}
              request={r}
              city={city}
              resolution={resolutions.get(r.id)}
            />
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
    </div>
  );
}
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
  const status: FeedStatus =
    params.status === 'RESOLVED'
      ? 'RESOLVED'
      : params.status === 'UNANSWERED'
        ? 'UNANSWERED'
        : 'OPEN';
  const [cityResult, followedResult, summary] = await Promise.all([
    db.from('cities').select('*').eq('id', cityId).maybeSingle(),
    db.from('followed_cities').select('city_id'),
    memberSummary(),
  ]);
  const followed = check(followedResult);
  const city =
    cityResult.data ||
    check(await db.from('cities').select('*').eq('id', profile.home_city_id).single());
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
  const newRequest =
    '/pedidos/novo?' + new URLSearchParams({ city: String(city.id), ...(q ? { q } : {}) });
  return (
    <>
      <div className="feed-layout">
        <div className="feed-primary">
          <section className="app-intro">
            <p className="eyebrow">A cidade em conversa</p>
            <h1>
              O que você está <span className="accent-text">procurando?</span>
            </h1>
            <p className="muted">Pergunte a quem conhece. Ajude quem procura.</p>
          </section>
          <FeedSearch
            key={city.id + ':' + q + ':' + status}
            city={city}
            query={q}
            status={status}
          />
          {summary.pending > 0 ? (
            <Link className="decision-banner" href="/atividades?tab=decision">
              <span className="decision-icon">
                <Icon name="message" />
              </span>
              <span>
                <strong>
                  {summary.pending === 1
                    ? 'Um pedido precisa de você'
                    : `${summary.pending} pedidos precisam de você`}
                </strong>
                <span>Confira as indicações e conte onde encontrou.</span>
              </span>
              <Icon name="arrow" size={18} />
            </Link>
          ) : null}
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
                href={
                  '/app?' + new URLSearchParams({ city: String(city.id), q, status: 'UNANSWERED' })
                }
              >
                Sem indicação
              </Link>
              <Link
                className={status === 'RESOLVED' ? 'active' : ''}
                aria-current={status === 'RESOLVED' ? 'page' : undefined}
                href={
                  '/app?' + new URLSearchParams({ city: String(city.id), q, status: 'RESOLVED' })
                }
              >
                Encontrados
              </Link>
            </ScrollableTabs>
          </div>
          {status === 'UNANSWERED' ? (
            <p className="hint unanswered-hint">
              Pedidos que ainda precisam de ajuda, começando pelos mais antigos.
            </p>
          ) : null}
          <Suspense
            key={`${city.id}:${q}:${status}:${page}`}
            fallback={
              <div role="status" aria-label="Carregando pedidos">
                <RequestRowsSkeleton />
              </div>
            }
          >
            <FeedResults city={city} q={q} status={status} page={page} newRequest={newRequest} />
          </Suspense>
        </div>
        <aside className="feed-aside" aria-label="Sobre a comunidade">
          <span className="aside-symbol">
            <Icon name="message" size={28} />
          </span>
          <p className="eyebrow">Conhecimento que circula</p>
          <h2>
            Alguém daqui
            <br />
            pode saber.
          </h2>
          <p className="muted">
            Uma peça difícil de achar, um ingrediente especial, um serviço perto de casa. Sua
            pergunta encontra quem conhece o caminho.
          </p>
          <ol className="community-steps">
            <li>
              <span>1</span>Conte o que procura
            </li>
            <li>
              <span>2</span>Receba indicações de pessoas
            </li>
            <li>
              <span>3</span>Confirme onde encontrou
            </li>
          </ol>
          <Link href="/ranking" className="text-link">
            Conheça quem ajuda <Icon name="arrow" size={16} />
          </Link>
          <p className="hint">
            Cada indicação confirmada vale 10 pontos. As descobertas ficam para a cidade.
          </p>
        </aside>
      </div>
    </>
  );
}
