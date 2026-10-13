import Link from 'next/link';
import { notFound } from 'next/navigation';
import { member } from '@/server/auth';
import { check } from '@/lib/errors';
import { Avatar } from '@/components/ui';
export const metadata = { title: 'Perfil da comunidade' };
export default async function PublicProfile({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  if (!/^[a-z][a-z0-9_]{2,23}$/.test(username)) notFound();
  const { db, user } = await member();
  const result = await db.from('profiles').select('*').eq('username', username).maybeSingle();
  const profile = check(result);
  if (!profile) notFound();
  const [cityResult, statsResult] = await Promise.all([
    db.from('cities').select('*').eq('id', profile.home_city_id).single(),
    db.rpc('profile_stats', { p_username: username }),
  ]);
  const city = check(cityResult),
    stats = check(statsResult);
  return (
    <div className="form-page profile-page">
      <Link className="back-link" href="/ranking">
        ← Comunidade
      </Link>
      <div className="profile-heading">
        <Avatar name={profile.display_name} url={profile.avatar_url} size={80} />
        <div>
          <h1>{profile.display_name}</h1>
          <p className="muted">@{profile.username}</p>
          <p>
            {city.name} — {city.state_code}
          </p>
        </div>
      </div>
      <div className="profile-stats">
        <p>
          <strong>{stats.requests}</strong> pedidos publicados
        </p>
        <p>
          <strong>{stats.indications}</strong> indicações enviadas
        </p>
        <p>
          <strong>{stats.points}</strong> pontos
        </p>
        <p>
          <strong>{stats.confirmations}</strong> indicações confirmadas
        </p>
      </div>
      {stats.confirmations > 0 ? (
        <p className="recognition">
          {stats.confirmations >= 50
            ? 'Referência da comunidade'
            : stats.confirmations >= 10
              ? 'Ajuda frequente'
              : 'Primeira indicação confirmada'}
        </p>
      ) : null}
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
