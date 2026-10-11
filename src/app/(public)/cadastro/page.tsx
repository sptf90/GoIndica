import Link from 'next/link';
import { ActionForm } from '@/components/action-form';
import { EmailField, PasswordFields, AuthTerms } from '@/components/auth-fields';
import { signupWithEmail } from '@/server/password-auth';
import { configured } from '@/lib/env';
import { accessLink, returnPath } from '@/lib/return-path';

export const metadata = { title: 'Criar conta', robots: { index: false, follow: false } };
export default async function Signup({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = returnPath((await searchParams).next);
  return (
    <main id="conteudo" className="auth-page wrap">
      <p className="eyebrow">Seu lugar na comunidade</p>
      <h1>Crie sua conta</h1>
      <p className="lead small">Use seu e-mail para perguntar à cidade e ajudar quem procura.</p>
      {!configured() ? (
        <p className="notice" role="status">
          O cadastro ficará disponível após configurar a conexão com o serviço.
        </p>
      ) : null}
      <ActionForm
        action={signupWithEmail}
        label="Criar conta"
        pendingLabel="Criando conta…"
        disabled={!configured()}
      >
        <input type="hidden" name="next" value={next} />
        <EmailField />
        <PasswordFields creating />
      </ActionForm>
      <p className="auth-links">
        Já tem uma conta? <Link href={accessLink('/entrar', next)}>Entrar</Link>
      </p>
      <AuthTerms />
    </main>
  );
}
