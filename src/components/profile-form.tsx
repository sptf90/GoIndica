import type { City, Profile } from '@/lib/types';
import { ActionForm } from './action-form';
import { CitySelector } from './city-selector';
import { ProfilePhotoField, UsernameField } from './profile-fields';
import { saveProfile } from '@/server/actions';
import { profilePhotoUrl } from '@/lib/profile-links';
export function ProfileForm({
  profile,
  city,
  defaultName = '',
  next = '/app',
}: {
  profile?: Profile | null;
  city?: City | null;
  defaultName?: string;
  next?: string;
}) {
  return (
    <ActionForm
      action={saveProfile}
      label={profile ? 'Salvar perfil' : 'Concluir e entrar'}
      className="profile-form"
    >
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="displayName">Nome de exibição</label>
        <input
          id="displayName"
          name="displayName"
          minLength={2}
          maxLength={60}
          autoComplete="name"
          required
          defaultValue={profile?.display_name || defaultName}
        />
      </div>
      <UsernameField initial={profile?.username || ''} />
      <ProfilePhotoField existingUrl={profile ? profilePhotoUrl(profile) : undefined} />
      <CitySelector initial={city} />
      <p className="hint">
        Sua cidade abre os pedidos da cidade por padrão. Você pode perguntar e ajudar em outras
        cidades sem mudar o perfil.
      </p>
    </ActionForm>
  );
}
