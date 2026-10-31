import { PageHeading } from '@/components/page-heading';
import Image from 'next/image';
import Link from 'next/link';
import { pageNumber } from '@/lib/pagination';
import { member } from '@/server/auth';
import { check } from '@/lib/errors';
import { CitySelector } from '@/components/city-selector';
import { Empty, Avatar, Pagination } from '@/components/ui';
import { profilePhotoUrl, profileUrl } from '@/lib/profile-links';
import { pool, rows } from '@/lib/database/pool';
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
  let sponsor: { display_name: string; logo_path: string | null } | null = null;
  try {
    const active = await rows<{ display_name: string; logo_path: string | null }>(
      pool(),
      `SELECT display_name,logo_path FROM ranking_sponsorships
       WHERE city_id=? AND active=TRUE AND starts_at<=UTC_TIMESTAMP(3) AND ends_at>UTC_TIMESTAMP(3)
       ORDER BY starts_at DESC LIMIT 1`,
      [city.id],
    );
    sponsor = active[0] || null;
  } catch {
    sponsor = null;
  }
  return (
    <div className="ranking-page">
      <PageHeading title="Quem ajuda a cidade" eyebrow="Conhecimento que fez a diferença"
        description="Somente indicações confirmadas contam. Os pontos pertencem à cidade do pedido."
      />
      <div className="ranking-filter-panel">
        <form action="/ranking" className="city-filter">
          <CitySelector key={city.id} initial={city} name="city" />
          <div className="field-action">
            <span className="field-action-label" aria-hidden="true">
              &nbsp;
            </span>
            <button className="button secondary">Ver ranking</button>
          </div>
        </form>
      </div>
      <div className="ranking-section-heading">
        <h2 className="city-title">
          {city.name} — {city.state_code}
        </h2>
        <p className="hint">Pessoas que transformam indicações em descobertas</p>
        {sponsor ? (
          <p className="ranking-sponsor hint">
            Patrocinado por <strong>{sponsor.display_name}</strong>
            {sponsor.logo_path ? (
              <Image
                className="ranking-sponsor-logo"
                src={sponsor.logo_path}
                alt={`Logo ${sponsor.display_name}`}
                width={96}
                height={32}
                unoptimized
              />
            ) : null}
          </p>
        ) : null}
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
