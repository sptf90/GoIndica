import { memberSummary } from '@/server/queries';
import { InstallApp } from '@/components/install-app';
import { ProfileMenu } from '@/components/profile-menu';
import { Icon } from '@/components/icon';
import { member } from '@/server/auth';
import { check } from '@/lib/errors';
import { ProfileForm } from '@/components/profile-form';
import { Avatar } from '@/components/ui';
import { CountUp } from '@/components/count-up';
import { logout } from '@/server/actions';
import { profilePhotoUrl } from '@/lib/profile-links';
import { reputationLabel } from '@/lib/reputation';
export const metadata = { title: 'Meu perfil' };
export default async function MyProfile() {
  const { db, profile, admin } = await member();
  const [cityResult, statsResult] = await Promise.all([
    db.from('cities').select('*').eq('id', profile.home_city_id).single(),
    db.call('profile_stats'),
  ]);
  const summary = await memberSummary();
  const city = check(cityResult),
    stats = check(statsResult);
  return (
    <div className="form-page profile-page">
      <div className="profile-heading">
        <Avatar name={profile.display_name} size={72} src={profilePhotoUrl(profile)} />
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
          <strong>
            <CountUp value={stats.requests} />
          </strong>{' '}
          pedidos publicados
        </p>
        <p>
          <strong>
            <CountUp value={stats.indications} />
          </strong>{' '}
          indicações enviadas
        </p>
        <p>
          <strong>
            <CountUp value={stats.points} />
          </strong>{' '}
          pontos
        </p>
        <p>
          <strong>
            <CountUp value={stats.confirmations} />
          </strong>{' '}
          indicações confirmadas
        </p>
      </div>
      <p className="recognition">{reputationLabel(stats.confirmations)}</p>
      <p className="hint">
        Outras pessoas veem apenas seu nome, nome de usuário, foto, cidade e este selo. Os números acima
        ficam visíveis só para você.
      </p>
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
