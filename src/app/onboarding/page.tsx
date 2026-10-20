import { redirect } from 'next/navigation';
import { session } from '@/server/auth';
import { ProfileForm } from '@/components/profile-form';
import { Brand, Avatar } from '@/components/ui';
import { ViewportContent } from '@/components/viewport-content';
import { returnPath } from '@/lib/return-path';
export const metadata = { title: 'Seu perfil', robots: { index: false, follow: false } };
export default async function Onboarding({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = returnPath((await searchParams).next);
  const { profile, user, kind } = await session();
  if (kind === 'company') redirect('/empresa');
  if (profile) redirect(next);
  const name = typeof user.user_metadata.full_name === 'string' ? user.user_metadata.full_name : '';
  return (
    <div className="onboarding-shell">
      <header className="public-header">
        <div className="wrap">
          <Brand />
        </div>
      </header>
      <main id="conteudo" className="app-main wrap">
        <ViewportContent>
          <div className="form-page onboarding-form">
            <p className="eyebrow">Só falta se apresentar</p>
            <h1>Vamos nos conhecer?</h1>
            <p className="muted">
              Seu e-mail fica privado. A comunidade vê seu nome, nome de usuário, foto e cidade.
            </p>
            <Avatar name={name || 'Você'} size={64} />
            <ProfileForm defaultName={name} next={next} />
          </div>
        </ViewportContent>
      </main>
    </div>
  );
}
