import { company } from '@/server/auth';
import { check } from '@/lib/errors';
import { formatCnpj } from '@/lib/cnpj';
import { date } from '@/server/queries';
import { ActionForm } from '@/components/action-form';
import { Icon } from '@/components/icon';
import {
  changeCompanyPassword,
  refreshCompanyData,
  saveCompanyName,
} from '@/server/company-actions';
export const metadata = { title: 'Painel da empresa' };
export default async function CompanyPanel() {
  const { db, user, company: data } = await company();
  const city = data.city_id
    ? check(await db.from('cities').select('*').eq('id', data.city_id).maybeSingle())
    : null;
  const verified = data.data_source === 'RECEITA';
  return (
    <div className="form-page company-page">
      <p className="eyebrow">Conta empresarial</p>
      <h1>{data.display_name}</h1>
      <p className="muted">
        {data.legal_name} · CNPJ {formatCnpj(data.cnpj)}
      </p>
      <p className={verified ? 'company-badge' : 'company-badge pending'}>
        <Icon name={verified ? 'check' : 'clock'} size={16} />
        {verified
          ? `Dados conferidos na Receita Federal em ${date(String(data.data_checked_at))}`
          : 'Razão social informada no cadastro; será conferida na Receita Federal'}
      </p>

      <section className="company-section" aria-labelledby="sponsorship">
        <h2 id="sponsorship">Patrocínio de rankings</h2>
        <p>
          Esta conta existe para que o estabelecimento patrocine rankings da comunidade, que
          reconhecem quem mais ajuda a cidade com boas indicações.
        </p>
        <p className="notice">
          A contratação de patrocínios ainda está em preparação. Quando abrir, ela aparece aqui,
          neste painel, sem precisar de outro cadastro.
        </p>
        <ul className="company-rules">
          <li>Sua empresa não aparece em buscas, catálogos ou listas do GoIndica.</li>
          <li>A conta não pede nem envia indicações, então não interfere nas recomendações.</li>
          <li>Você altera os dados do painel quando quiser, sem aprovação da administração.</li>
        </ul>
      </section>

      <section className="company-section" aria-labelledby="presentation">
        <h2 id="presentation">Como chamamos sua empresa</h2>
        <ActionForm action={saveCompanyName} label="Salvar nome">
          <div className="field">
            <label htmlFor="displayName">Nome de apresentação</label>
            <input
              id="displayName"
              name="displayName"
              minLength={2}
              maxLength={80}
              required
              defaultValue={data.display_name}
              aria-describedby="displayName-hint"
            />
            <span className="hint" id="displayName-hint">
              Usado neste painel e nas nossas comunicações. Por enquanto não é exibido aos usuários
              do app.
            </span>
          </div>
        </ActionForm>
      </section>

      <section className="company-section" aria-labelledby="registry">
        <h2 id="registry">Dados do estabelecimento</h2>
        <dl className="company-data">
          <div>
            <dt>Razão social</dt>
            <dd>{data.legal_name}</dd>
          </div>
          <div>
            <dt>Nome fantasia</dt>
            <dd>{data.trade_name || 'Não informado'}</dd>
          </div>
          <div>
            <dt>CNPJ</dt>
            <dd>{formatCnpj(data.cnpj)}</dd>
          </div>
          <div>
            <dt>Situação cadastral</dt>
            <dd>{data.registration_status || 'Não consultada'}</dd>
          </div>
          <div>
            <dt>Sede</dt>
            <dd>{city ? `${city.name} — ${city.state_code}` : 'Não informada'}</dd>
          </div>
          <div>
            <dt>Unidade</dt>
            <dd>
              {data.branch === 'MATRIZ' ? 'Matriz' : data.branch === 'FILIAL' ? 'Filial' : '—'}
            </dd>
          </div>
        </dl>
        <p className="hint">
          Estes dados vêm da Receita Federal e não podem ser editados aqui. Se algo mudou no
          cadastro da empresa, atualize a consulta.
        </p>
        <ActionForm
          action={refreshCompanyData}
          label="Atualizar dados da Receita"
          pendingLabel="Consultando…"
          className="compact secondary"
        />
      </section>

      <section className="company-section" aria-labelledby="access">
        <h2 id="access">Acesso</h2>
        <p className="muted">E-mail de acesso: {user.email}</p>
        <details className="company-password">
          <summary>Alterar senha</summary>
          <ActionForm action={changeCompanyPassword} label="Atualizar senha">
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
        </details>
      </section>
    </div>
  );
}
