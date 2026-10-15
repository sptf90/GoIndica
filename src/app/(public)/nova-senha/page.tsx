import { redirect } from 'next/navigation';
import { ActionForm } from '@/components/action-form';
import { PasswordFields } from '@/components/auth-fields';
import { updatePassword } from '@/server/password-auth';
import { database } from '@/lib/database/server';
import { configured } from '@/lib/env';

export const metadata = { title: 'Nova senha', robots: { index: false, follow: false } };
export default async function NewPassword() {
  if (!configured()) redirect('/entrar?motivo=configuracao');
  const db = await database();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) redirect('/recuperar-senha?motivo=link_expirado');
  return (
    <main id="conteudo" className="auth-page wrap">
      <p className="eyebrow">Recupere seu acesso</p>
      <h1>Escolha uma nova senha</h1>
      <p className="lead small">Depois de salvar, entre novamente com a nova senha.</p>
      <ActionForm action={updatePassword} label="Salvar nova senha" pendingLabel="Salvando…">
        <PasswordFields creating />
      </ActionForm>
    </main>
  );
}
