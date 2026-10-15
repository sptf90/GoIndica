import type { Metadata } from 'next';
import Link from 'next/link';
import { loginWithEmail } from '@/server/password-auth';
import { configured } from '@/lib/env';
import { ActionForm } from '@/components/action-form';
import { EmailField, PasswordFields, AuthTerms } from '@/components/auth-fields';
import { accessLink, returnPath } from '@/lib/return-path';
export const metadata: Metadata = { title: 'Entrar', robots: { index: false, follow: false } };
const reasons: Record<string, string> = {
  configuracao: 'O acesso está temporariamente indisponível. Tente novamente em instantes.',
  banco:
    'O banco ainda precisa ser preparado. Aplique as migrations do projeto para concluir o acesso.',
  bloqueado: 'Esta conta está bloqueada ou indisponível. Entre em contato com a administração.',
  falha: 'Não foi possível concluir o login. Tente novamente.',
  link_expirado: 'Este link é inválido ou expirou. Entre com sua senha ou solicite outro link.',
};
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string; next?: string }>;
}) {
  const { motivo, next: target } = await searchParams;
  const next = returnPath(target);
  return (
    <main id="conteudo" className="auth-page wrap">
      <p className="eyebrow">Sua cidade sabe mais do que parece</p>
      <h1>Bom ter você por aqui.</h1>
      <p className="lead small">
        Entre para perguntar, compartilhar o que sabe e acompanhar suas descobertas.
      </p>
      {motivo && reasons[motivo] ? (
        <p className="notice error" role="alert">
          {reasons[motivo]}
        </p>
      ) : null}
      {motivo === 'senha_atualizada' ? (
        <p className="notice success" role="status">
          Senha atualizada. Entre com sua nova senha.
        </p>
      ) : null}
      {!configured() && !motivo ? (
        <p className="notice" role="status">
          O login ficará disponível após configurar as variáveis de ambiente.
        </p>
      ) : null}
      <ActionForm
        action={loginWithEmail}
        label="Entrar"
        pendingLabel="Entrando…"
        disabled={!configured()}
      >
        <input type="hidden" name="next" value={next} />
        <EmailField />
        <PasswordFields />
      </ActionForm>
      <nav className="auth-links" aria-label="Acesso à conta">
        <Link href={accessLink('/cadastro', next)}>Criar uma conta</Link>
        <Link href="/recuperar-senha">Esqueci minha senha</Link>
      </nav>
      <AuthTerms />
    </main>
  );
}
