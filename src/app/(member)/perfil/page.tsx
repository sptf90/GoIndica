import { memberSummary } from '@/server/queries';
import { InstallApp } from '@/components/install-app';
import { ProfileMenu } from '@/components/profile-menu';
import { Icon } from '@/components/icon';
import { member } from '@/server/auth';
import { check } from '@/lib/errors';
import { ProfileForm } from '@/components/profile-form';
import { Avatar } from '@/components/ui';
import { logout } from '@/server/actions';
export const metadata = { title: 'Meu perfil' };
export default async function MyProfile() {
  const { db, profile, admin } = await member();
  const [cityResult, statsResult] = await Promise.all([
    db.from('cities').select('*').eq('id', profile.home_city_id).single(),
    db.call('profile_stats', { p_username: profile.username }),
  ]);
  const summary = await memberSummary();
  const city = check(cityResult),
    stats = check(statsResult);
  return (
    <div className="form-page profile-page">
      <div className="profile-heading">
        <Avatar name={profile.display_name} size={72} />
        <div>
          <p className="eyebrow">Seu lugar na comunidade</p>
          <h1>{profile.display_name}</h1>
          <p className="muted">@{profile.username}</p>
          <p className="profile-city">
            <Icon name="pin" size={14} /> {city.name} — {city.state_code}
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
            ? 'Referência da comunidade · 50 confirmações'
            : stats.confirmations >= 10
              ? 'Ajuda frequente · 10 confirmações'
              : 'Primeira indicação confirmada'}
        </p>
      ) : null}
      <ProfileMenu pending={summary.pending} username={profile.username} admin={admin} />
      <details className="profile-editor">
        <summary>
          <Icon name="edit" size={20} />
          <span>Editar perfil</span>
          <Icon name="chevron" size={18} />
        </summary>
        <h2>Seus dados</h2>
        <ProfileForm profile={profile} city={city} />
      </details>
      <InstallApp />
      <form action={logout} className="logout-form">
        <button className="button secondary">Sair da conta</button>
      </form>
    </div>
  );
}
