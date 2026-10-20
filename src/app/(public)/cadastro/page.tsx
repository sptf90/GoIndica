import Link from 'next/link';
import { ActionForm } from '@/components/action-form';
import { EmailField, PasswordFields, AuthTerms } from '@/components/auth-fields';
import { CompanySignupForm } from '@/components/company-signup';
import { signupWithEmail } from '@/server/password-auth';
import { configured } from '@/lib/env';
import { accessLink, returnPath } from '@/lib/return-path';

export const metadata = { title: 'Criar conta', robots: { index: false, follow: false } };
export default async function Signup({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; tipo?: string }>;
}) {
  const params = await searchParams;
  const next = returnPath(params.next);
  const business = params.tipo === 'empresa';
  return (
    <main id="conteudo" className="auth-page wrap">
      <nav className="account-kind" aria-label="Tipo de conta">
        <Link
          href={accessLink('/cadastro', next)}
          aria-current={business ? undefined : 'page'}
          replace
          scroll={false}
        >
          Para mim
        </Link>
        <Link
          href="/cadastro?tipo=empresa"
          aria-current={business ? 'page' : undefined}
          replace
          scroll={false}
        >
          Para minha empresa
        </Link>
      </nav>
      {business ? (
        <>
          <p className="eyebrow">Conta empresarial</p>
          <h1>Cadastre seu estabelecimento</h1>
          <p className="lead small">
            A conta empresarial serve para patrocinar rankings da comunidade. Ela não pede nem envia
            indicações, e sua empresa não aparece em buscas ou catálogos do GoIndica.
          </p>
        </>
      ) : (
        <>
          <p className="eyebrow">Seu lugar na comunidade</p>
          <h1>Crie sua conta</h1>
          <p className="lead small">
            Use seu e-mail para perguntar à cidade e ajudar quem procura.
          </p>
        </>
      )}
      {!configured() ? (
        <p className="notice" role="status">
          O cadastro ficará disponível após configurar a conexão com o serviço.
        </p>
      ) : null}
      {business ? (
        <CompanySignupForm disabled={!configured()} />
      ) : (
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
      )}
      <p className="auth-links">
        Já tem uma conta? <Link href={accessLink('/entrar', next)}>Entrar</Link>
      </p>
      <AuthTerms />
    </main>
  );
}
