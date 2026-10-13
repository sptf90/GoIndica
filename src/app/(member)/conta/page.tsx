import { LocalDraftControls } from '@/components/local-draft-controls';
import Link from 'next/link';
import { PageHeading } from '@/components/page-heading';
import { member } from '@/server/auth';
import { check } from '@/lib/errors';
import { timestamp } from '@/server/queries';
import { changeEmail, changePassword, requestSupport } from '@/server/community-actions';
import { ActionForm } from '@/components/action-form';
export const metadata = { title: 'Minha conta' };
export default async function Account() {
  const { db, user, admin } = await member();
  const supports = check(
    await db
      .from('support_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20),
  );
  const emailProvider = user.app_metadata.providers?.includes('email');
  const current = emailProvider ? (
    <label className="field">
      Senha atual
      <input
        type="password"
        name="currentPassword"
        autoComplete="current-password"
        required
        maxLength={128}
      />
    </label>
  ) : null;
  return (
    <div className="form-page settings-page">
      <PageHeading title="Minha conta" description="Seu acesso, sua privacidade e seus dados." />
      <p className="muted">E-mail atual: {user.email}</p>
      <h2>Exportar meus dados</h2>
      <p>Baixe seus dados, pedidos, indicações e histórico de pontos em JSON.</p>
      <a className="button secondary" href="/api/account/export" download>
        Baixar meus dados
      </a>
      <h2>Alterar e-mail</h2>
      <ActionForm action={changeEmail} label="Solicitar alteração">
        {current}
        <label className="field">
          Novo e-mail
          <input type="email" name="email" autoComplete="email" required maxLength={254} />
        </label>
      </ActionForm>
      <h2>Alterar senha</h2>
      <ActionForm action={changePassword} label="Atualizar senha">
        {current}
        <label className="field">
          Nova senha
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
          />
        </label>
        <label className="field">
          Confirmar nova senha
          <input
            name="passwordConfirmation"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
          />
        </label>
      </ActionForm>
      <h2>Ajuda com meus dados</h2>
      <ActionForm action={requestSupport} label="Solicitar ajuda">
        <input type="hidden" name="kind" value="DATA_HELP" />
        <label className="field">
          Descreva o que precisa
          <textarea name="reason" minLength={10} maxLength={500} rows={3} required />
        </label>
      </ActionForm>
      <h2>Encerrar minha conta</h2>
      <LocalDraftControls userId={user.id} />
      <p>
        O encerramento bloqueia o acesso e anonimiza seu perfil e seus textos. O registro de
        recompensas é preservado para manter o histórico de pontos da comunidade.
      </p>
      {admin ? (
        <p className="notice">Transfira a administração antes de solicitar o encerramento.</p>
      ) : (
        <ActionForm
          action={requestSupport}
          label="Solicitar encerramento"
          confirm="Solicitar o encerramento e a anonimização dos seus dados? A administração revisará seu pedido."
        >
          <input type="hidden" name="kind" value="CLOSE_ACCOUNT" />
          <label className="field">
            Motivo ou instruções para a equipe
            <textarea name="reason" minLength={10} maxLength={500} rows={3} required />
          </label>
        </ActionForm>
      )}
      <h2>Minhas solicitações</h2>
      {!supports.length ? (
        <p className="muted">Você ainda não enviou solicitações à equipe.</p>
      ) : null}
      {supports.map((s) => (
        <article className="community-row" key={s.id}>
          <div>
            <strong>
              {s.kind === 'CLOSE_ACCOUNT' ? 'Encerramento da conta' : 'Ajuda com dados'}
            </strong>
            <p>
              {
                (
                  {
                    OPEN: 'Pendente',
                    PROCESSING: 'Em processamento',
                    COMPLETED: 'Concluída',
                    DECLINED: 'Recusada',
                  } as Record<string, string>
                )[s.status]
              }{' '}
              · {timestamp(s.created_at)}
            </p>
            {s.decision_note ? <p>{s.decision_note}</p> : null}
          </div>
        </article>
      ))}
      <Link href="/perfil" className="back-link">
        ← Meu perfil
      </Link>
    </div>
  );
}
