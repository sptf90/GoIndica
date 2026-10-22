import { PageHeading } from '@/components/page-heading';
import Link from 'next/link';
import { pageNumber } from '@/lib/pagination';
import { member } from '@/server/auth';
import { check } from '@/lib/errors';
import { CitySelector } from '@/components/city-selector';
import { Empty, Avatar, Pagination } from '@/components/ui';
import { profilePhotoUrl, profileUrl } from '@/lib/profile-links';
export const metadata = { title: 'Ranking da cidade' };
export default async function Ranking({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; page?: string }>;
}) {
  const { db, profile } = await member();
  const params = await searchParams;
  const page = pageNumber(params.page);
  const found = await db
    .from('cities')
    .select('*')
    .eq('id', Number(params.city) || profile.home_city_id)
    .maybeSingle();
  const city =
    found.data ||
    check(await db.from('cities').select('*').eq('id', profile.home_city_id).single());
  const entries = check(
    await db.call('city_ranking', { p_city_id: city.id, p_offset: (page - 1) * 30 }),
  );
  return (
    <div className="ranking-page">
      <PageHeading title="Quem ajuda a cidade" eyebrow="Conhecimento que fez a diferença"
        description="Somente indicações confirmadas contam. Os pontos pertencem à cidade do pedido."
      />
      <div className="ranking-filter-panel">
        <form action="/ranking" className="city-filter">
          <CitySelector key={city.id} initial={city} name="city" />
          <button className="button secondary">Ver ranking</button>
        </form>
      </div>
      <div className="ranking-section-heading">
        <h2 className="city-title">
          {city.name} — {city.state_code}
        </h2>
        <p className="hint">Pessoas que transformam indicações em descobertas</p>
      </div>
      {entries.length ? (
        <ol className="ranking-list">
          {entries.map((e) => (
            <li className="ranking-row" key={e.username}>
              <span className="rank-number">{e.position}</span>
              <Link
                className="avatar-link"
                href={profileUrl(e.username, { rankingCity: city.id })}
                tabIndex={-1}
                aria-hidden="true"
              >
                <Avatar
                  mobileSize={36}
                  name={e.display_name}
                  src={profilePhotoUrl(e, { rankingCity: city.id })}
                />
              </Link>
              <div>
                <Link href={profileUrl(e.username, { rankingCity: city.id })}>
                  <strong>{e.display_name}</strong>
                </Link>
                <p className="hint">
                  @{e.username} · {e.confirmations}{' '}
                  {e.confirmations === 1 ? 'confirmação' : 'confirmações'}
                </p>
              </div>
              <strong className="ranking-points">
                {e.points}
                <span>pontos</span>
              </strong>
            </li>
          ))}
        </ol>
      ) : (
        <Empty title="Ainda não existem pontos nesta cidade.">
          As primeiras indicações confirmadas começam este ranking.
        </Empty>
      )}
      <Pagination
        page={page}
        hasMore={entries.length === 30}
        base="/ranking"
        params={{ city: String(city.id) }}
      />
      <p className="hint">
        Em caso de empate, fica à frente quem tem mais confirmações e recebeu a primeira antes.
      </p>
    </div>
  );
}
