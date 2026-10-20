import Link from 'next/link';
import { notFound } from 'next/navigation';
import { member } from '@/server/auth';
import { check } from '@/lib/errors';
import { uuid } from '@/lib/validation/schemas';
import { Avatar } from '@/components/ui';
import { profilePhotoUrl, type ProfileContext } from '@/lib/profile-links';
export const metadata = { title: 'Perfil da comunidade' };
export default async function PublicProfile({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ pedido?: string; ranking?: string }>;
}) {
  const { username } = await params;
  if (!/^[a-z][a-z0-9_]{2,23}$/.test(username)) notFound();
  const search = await searchParams;
  const request = uuid.safeParse(search.pedido);
  const context: ProfileContext = {
    request: request.success ? request.data : undefined,
    rankingCity: Number(search.ranking) || undefined,
  };
  const { db, user } = await member();
  // Unknown names and names outside an authorized context get the same 404.
  const profile = check(
    await db.call('public_profile', {
      p_username: username,
      p_request_id: context.request || '',
      p_ranking_city_id: context.rankingCity || 0,
    }),
  );
  if (!profile) notFound();
  const city = check(await db.from('cities').select('*').eq('id', profile.home_city_id).single());
  const back = context.request
    ? { href: '/pedidos/' + context.request, label: '← Voltar ao pedido' }
    : context.rankingCity
      ? { href: '/ranking?city=' + context.rankingCity, label: '← Voltar ao ranking' }
      : { href: '/perfil', label: '← Meu perfil' };
  return (
    <div className="form-page profile-page">
      <Link className="back-link" href={back.href}>
        {back.label}
      </Link>
      <div className="profile-heading">
        <Avatar name={profile.display_name} size={80} src={profilePhotoUrl(profile, context)} />
        <div>
          <h1>{profile.display_name}</h1>
          <p className="muted">@{profile.username}</p>
          <p>
            {city.name} — {city.state_code}
          </p>
        </div>
      </div>
      <p className="recognition">{profile.reputation}</p>
      <p className="muted">
        Reconhecimento por ajudar outras pessoas a encontrar o que procuravam.
      </p>
      {user.id === profile.id ? (
        <Link className="button secondary" href="/perfil">
          Editar meu perfil
        </Link>
      ) : null}
    </div>
  );
}
