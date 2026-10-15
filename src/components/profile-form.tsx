import type { City, Profile } from '@/lib/types';
import { ActionForm } from './action-form';
import { CitySelector } from './city-selector';
import { saveProfile } from '@/server/actions';
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
      <div className="field">
        <label htmlFor="username">Nome de usuário</label>
        <input
          id="username"
          name="username"
          minLength={3}
          maxLength={24}
          pattern="[a-z][a-z0-9_]{2,23}"
          autoCapitalize="none"
          spellCheck={false}
          autoComplete="username"
          required
          defaultValue={profile?.username || ''}
          aria-describedby="username-hint"
        />
        <span className="hint" id="username-hint">
          3 a 24 letras minúsculas, números ou _. Comece com uma letra.
        </span>
      </div>
      <CitySelector initial={city} />
      <p className="hint">
        Sua cidade sugere onde procurar. Você pode perguntar e ajudar em outras cidades.
      </p>
    </ActionForm>
  );
}
