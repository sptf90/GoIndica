import { ScrollableTabs } from '@/components/scrollable-tabs';
import Link from 'next/link';
import { pageNumber } from '@/lib/pagination';
import { administrator } from '@/server/auth';
import { check } from '@/lib/errors';
import { reviewSupport } from '@/server/community-actions';
import { environmentStatus } from '@/lib/env';
import { CitySelector } from '@/components/city-selector';
import { updatePlace } from '@/server/place-actions';
import { moderate } from '@/server/actions';
import { ActionForm } from '@/components/action-form';
import { Empty, Pagination, Status } from '@/components/ui';
import { timestamp } from '@/server/queries';
import { PlacePanel } from '@/components/place-panel';
import { uuid } from '@/lib/validation/schemas';
import { formatCnpj } from '@/lib/cnpj';
export const metadata = { title: 'Administração' };
const tabs = {
  users: 'Usuários',
  requests: 'Pedidos',
  indications: 'Indicações',
  places: 'Estabelecimentos',
  reports: 'Denúncias',
  rewards: 'Recompensas',
  logs: 'Logs',
  metrics: 'Métricas',
  support: 'Suporte',
  operations: 'Operação',
};
function Control({ id, action, label }: { id: string; action: string; label: string }) {
  return (
    <ActionForm
      action={moderate}
      label={label}
      className="compact quiet"
      confirm={`Confirmar: ${label}? A ação será registrada na auditoria.`}
    >
      <input type="hidden" name="targetId" value={id} />
      <input type="hidden" name="action" value={action} />
      <details className="decision-note">
        <summary>Motivo da decisão</summary>
        <label className="field">
          Justificativa
          <textarea
            name="note"
            minLength={10}
            maxLength={500}
            rows={2}
            defaultValue="Revisão administrativa registrada"
            required
          />
        </label>
      </details>
    </ActionForm>
  );
}
export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    q?: string;
    page?: string;
    target?: string;
    status?: string;
    city?: string;
    since?: string;
    until?: string;
  }>;
}) {
  const { db } = await administrator();
  const params = await searchParams;
  const tab = params.tab && params.tab in tabs ? (params.tab as keyof typeof tabs) : 'reports';
  const q = (params.q || '').slice(0, 60);
  const page = pageNumber(params.page);
  const start = (page - 1) * 30;
  let body: React.ReactNode;
  let more = false;
  if (tab === 'users') {
    const rows = check(await db.call('admin_accounts', { p_search: q, p_offset: start }));
    more = rows.length === 30;
    body = rows.map((r) => (
      <article className="admin-row" key={r.id}>
        {r.kind === 'company' ? (
          <div>
            <strong>{r.company_name || 'Cadastro empresarial expirado'}</strong>
            <p className="hint">
              Empresa{r.cnpj ? ' · CNPJ ' + formatCnpj(r.cnpj) : ''} ·{' '}
              {r.blocked ? 'Bloqueada' : 'Ativa'}
            </p>
          </div>
        ) : (
          <div>
            <strong>{r.display_name || 'Onboarding pendente'}</strong>
            <p className="hint">
              @{r.username || 'sem username'} · {r.blocked ? 'Bloqueado' : 'Ativo'}
            </p>
            {r.username ? <Link href={'/perfil/' + r.username}>Ver perfil ↗</Link> : null}
          </div>
        )}
        <Control
          id={r.id}
          action={r.blocked ? 'UNBLOCK_USER' : 'BLOCK_USER'}
          label={r.blocked ? 'Desbloquear' : 'Bloquear'}
        />
      </article>
    ));
  } else if (tab === 'places') {
    let query = db.from('places').select('*').order('name');
    if (q) query = query.ilike('name', '%' + q + '%');
    const rows = check(await query.range(start, start + 30));
    more = rows.length > 30;
    body = rows.slice(0, 30).map((place) => (
      <details className="admin-row" key={place.id}>
        <summary>
          {place.name} — {place.address}
        </summary>
        {place.google_place_id ? (
          <p>
            Dados consultados diretamente no Google Maps.{' '}
            <a
              className="text-link"
              target="_blank"
              rel="noreferrer"
              href={`https://www.google.com/maps/search/?api=1&query=estabelecimento&query_place_id=${encodeURIComponent(place.google_place_id)}`}
            >
              Ver no Google Maps
            </a>
          </p>
        ) : (
          <ActionForm action={updatePlace} label="Salvar estabelecimento">
            <input type="hidden" name="placeId" value={place.id} />
            <label className="field">
              Nome
              <input name="name" defaultValue={place.name} minLength={2} maxLength={160} required />
            </label>
            <label className="field">
              Endereço
              <input
                name="address"
                defaultValue={place.address}
                minLength={5}
                maxLength={300}
                required
              />
            </label>
          </ActionForm>
        )}
      </details>
    ));
  } else if (tab === 'requests') {
    let query = db.from('requests').select('*').order('created_at', { ascending: false });
    if (q) query = query.ilike('description', '%' + q + '%');
    const rows = check(await query.range(start, start + 30));
    more = rows.length > 30;
    body = rows.slice(0, 30).map((r) => (
      <article className="admin-row" key={r.id}>
        <div>
          <Link href={'/pedidos/' + r.id}>
            <strong>{r.description}</strong>
          </Link>
          <p>
            <Status status={r.status} />
          </p>
          <p className="hint">
            {r.hidden_at ? 'Conteúdo removido' : 'Visível'} · {timestamp(r.created_at)}
          </p>
        </div>
        {!r.hidden_at ? <Control id={r.id} action="HIDE_REQUEST" label="Remover conteúdo" /> : null}
      </article>
    ));
  } else if (tab === 'indications') {
    let query = db.from('indications').select('*').order('created_at', { ascending: false });
    if (q) query = query.ilike('comment', '%' + q + '%');
    const selectedId = uuid.safeParse(params.target);
    if (selectedId.success) query = query.eq('id', selectedId.data);
    const rows = check(await query.range(start, start + 30));
    more = rows.length > 30;
    const selected = selectedId.success ? rows[0] : null;
    const person = selected
      ? check(await db.from('profiles').select('*').eq('id', selected.user_id).single())
      : null;
    body = rows.slice(0, 30).map((r) => (
      <article className="admin-row" key={r.id}>
        <div>
          <Link href={'/pedidos/' + r.request_id}>Ver pedido ↗</Link>
          <p>{r.comment || 'Sem comentário'}</p>
          <p className="hint">
            Local: {r.place_id} · {timestamp(r.created_at)}
          </p>
          {selectedId.success ? (
            <>
              <p>
                {person?.display_name} · @{person?.username}
              </p>
              <PlacePanel requestId={r.request_id} placeId={r.place_id} autoLoad />
            </>
          ) : (
            <Link href={'/admin?tab=indications&target=' + r.id}>Inspecionar indicação ↗</Link>
          )}
        </div>
        {!r.hidden_at ? (
          <Control id={r.id} action="HIDE_INDICATION" label="Remover indicação" />
        ) : null}
      </article>
    ));
  } else if (tab === 'reports') {
    let reportQuery = db
      .from('reports')
      .select('*')
      .order('status')
      .order('created_at', { ascending: false });
    if (['OPEN', 'REVIEWED'].includes(params.status || ''))
      reportQuery = reportQuery.eq('status', params.status!);
    const rows = check(await reportQuery.range(start, start + 30));
    const reviewers = rows
      .flatMap((r) => [r.reporter_id, r.reviewed_by])
      .filter((id): id is string => Boolean(id));
    const reviewerRows = reviewers.length
      ? check(await db.from('profiles').select('id,display_name').in('id', reviewers))
      : [];
    const reviewerMap = new Map(reviewerRows.map((p) => [p.id, p.display_name]));
    more = rows.length > 30;
    body = rows.slice(0, 30).map((r) => (
      <article className="admin-row" key={r.id}>
        <div>
          <strong>
            {r.target_type === 'REQUEST' ? 'Pedido denunciado' : 'Indicação denunciada'}
          </strong>
          <p>{r.reason}</p>
          <p className="hint">
            Denunciado por {reviewerMap.get(r.reporter_id) || 'Perfil indisponível'}
          </p>
          <p className="hint">
            {r.status === 'OPEN' ? 'Pendente' : 'Revisada'} · {timestamp(r.created_at)}
            {r.reviewed_at
              ? ' · Revisada em ' +
                timestamp(r.reviewed_at) +
                ' por ' +
                (reviewerMap.get(r.reviewed_by!) || 'Administrador')
              : ''}
          </p>
          {r.decision_note ? <p>Decisão: {r.decision_note}</p> : null}
          {r.target_type === 'REQUEST' ? (
            <Link href={'/pedidos/' + r.target_id}>Abrir pedido ↗</Link>
          ) : (
            <Link href={'/admin?tab=indications&target=' + r.target_id}>
              Inspecionar indicação ↗
            </Link>
          )}
        </div>
        <div>
          {r.status === 'OPEN' ? (
            <Control id={r.id} action="REVIEW_REPORT" label="Marcar revisada" />
          ) : null}
          <Control
            id={r.target_id}
            action={r.target_type === 'REQUEST' ? 'HIDE_REQUEST' : 'HIDE_INDICATION'}
            label="Remover conteúdo"
          />
        </div>
      </article>
    ));
  } else if (tab === 'rewards') {
    const rows = check(
      await db
        .from('reward_events')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id')
        .range(start, start + 30),
    );
    const people = rows.length
      ? check(
          await db
            .from('profiles')
            .select('id,display_name,username')
            .in(
              'id',
              rows.map((r) => r.user_id),
            ),
        )
      : [];
    const peopleMap = new Map(people.map((p) => [p.id, p]));
    more = rows.length > 30;
    body = rows.slice(0, 30).map((r) => (
      <article className="admin-row" key={r.id}>
        <div>
          <strong>+{r.points} · Indicação confirmada</strong>
          <p className="hint">
            {peopleMap.get(r.user_id)?.display_name || 'Perfil indisponível'} · @
            {peopleMap.get(r.user_id)?.username || 'indisponível'}
          </p>
          <Link href={'/pedidos/' + r.request_id}>Ver solicitação ↗</Link>
          <p className="hint">
            {timestamp(r.created_at)} · Evento {r.id}
          </p>
        </div>
      </article>
    ));
  } else if (tab === 'logs') {
    const rows = check(
      await db
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id')
        .range(start, start + 30),
    );
    const actors = rows.map((r) => r.actor_id).filter((id): id is string => Boolean(id));
    const people = actors.length
      ? check(await db.from('profiles').select('id,display_name,username').in('id', actors))
      : [];
    const peopleMap = new Map(people.map((p) => [p.id, p]));
    more = rows.length > 30;
    body = rows.slice(0, 30).map((r) => (
      <article className="admin-row" key={r.id}>
        <div>
          <strong>{r.event_type}</strong>
          <p className="hint">
            {r.actor_id
              ? peopleMap.get(r.actor_id)?.display_name || 'Perfil indisponível'
              : 'Sistema'}
          </p>
          <p className="hint">
            {r.entity_type} · {r.entity_id}
          </p>
          <p className="hint">{timestamp(r.created_at)}</p>
          <pre>{JSON.stringify(r.metadata, null, 2)}</pre>
        </div>
      </article>
    ));
  } else if (tab === 'support') {
    const rows = check(
      await db
        .from('support_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id')
        .range(start, start + 30),
    );
    more = rows.length > 30;
    const names = rows.length
      ? check(
          await db
            .from('profiles')
            .select('id,display_name,username')
            .in(
              'id',
              rows.map((r) => r.user_id),
            ),
        )
      : [];
    const nameMap = new Map(names.map((p) => [p.id, p]));
    body = rows.slice(0, 30).map((r) => (
      <article key={r.id} className="admin-row">
        <div>
          <strong>
            {r.kind === 'CLOSE_ACCOUNT' ? 'Encerramento de conta' : 'Ajuda com dados'}
          </strong>
          <p>
            {nameMap.get(r.user_id)?.display_name} · @{nameMap.get(r.user_id)?.username}
          </p>
          <p>{r.reason}</p>
          <p className="hint">
            {r.status} · {timestamp(r.created_at)}
          </p>
          {r.decision_note ? <p>{r.decision_note}</p> : null}
        </div>
        {['OPEN', 'PROCESSING'].includes(r.status) ? (
          <div>
            {(r.kind === 'CLOSE_ACCOUNT' && r.status === 'PROCESSING'
              ? ['CLOSE']
              : [r.kind === 'CLOSE_ACCOUNT' ? 'CLOSE' : 'COMPLETED', 'DECLINED']
            ).map((decision) => (
              <ActionForm
                key={decision}
                action={reviewSupport}
                label={
                  decision === 'CLOSE'
                    ? 'Encerrar e anonimizar'
                    : decision === 'COMPLETED'
                      ? 'Concluir atendimento'
                      : 'Recusar solicitação'
                }
                confirm={
                  decision === 'CLOSE'
                    ? 'Encerrar o acesso e anonimizar esta conta? Esta ação é definitiva.'
                    : 'Registrar esta decisão?'
                }
                className="quiet"
              >
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="decision" value={decision} />
                <label className="field">
                  Motivo da decisão
                  <textarea name="note" minLength={10} maxLength={500} required rows={2} />
                </label>
              </ActionForm>
            ))}
          </div>
        ) : null}
      </article>
    ));
  } else if (tab === 'operations') {
    const operations = check(await db.call('admin_operations'));
    body = (
      <>
        <h2>Configuração dos serviços</h2>
        <div className="metrics">
          {Object.entries(environmentStatus()).map(([key, ok]) => (
            <p key={key}>
              {key}
              <strong>{ok ? 'Configurado' : 'Pendente'}</strong>
            </p>
          ))}
        </div>
        <h2>Entrega de lembretes</h2>
        <div className="metrics">
          <p>
            Na fila<strong>{operations.pending_email}</strong>
          </p>
          <p>
            Enviados<strong>{operations.sent_email}</strong>
          </p>
          <p>
            Falharam após tentativas<strong>{operations.failed_email}</strong>
          </p>
        </div>
        <p className="hint">
          A disponibilidade do banco é verificada em /api/health. Erros operacionais são registrados
          sem dados pessoais.
        </p>
      </>
    );
  } else {
    const validDate = (value: string | undefined) =>
      value && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value))
        ? value
        : undefined;
    const since = validDate(params.since),
      until = validDate(params.until);
    const cityId = /^\d{7}$/.test(params.city || '') ? Number(params.city) : undefined;
    const city = cityId
      ? check(await db.from('cities').select('*').eq('id', cityId).maybeSingle())
      : null;
    const validRange = !since || !until || since <= until;
    const m = check(
      await db.call('admin_metrics', {
        ...(city ? { p_city_id: city.id } : {}),
        ...(since && validRange ? { p_since: since + 'T00:00:00Z' } : {}),
        ...(until && validRange
          ? { p_until: new Date(Date.parse(until) + 86400000).toISOString() }
          : {}),
      }),
    );
    body = (
      <>
        <form className="metrics-filter" action="/admin">
          <input type="hidden" name="tab" value="metrics" />
          <CitySelector initial={city} name="city" required={false} />
          <label className="field">
            Desde (UTC)
            <input type="date" name="since" defaultValue={since} />
          </label>
          <label className="field">
            Até (UTC)
            <input type="date" name="until" defaultValue={until} />
          </label>
          <button className="button secondary">Filtrar métricas</button>
          <Link href="/admin?tab=metrics">Limpar filtros</Link>
        </form>
        {!validRange ? (
          <p className="notice error">
            O início deve ser anterior ao fim. Exibindo todos os períodos.
          </p>
        ) : null}
        <div className="metrics">
          <p>
            Pedidos criados <strong>{m.requests}</strong>
          </p>
          <p>
            Receberam indicações{' '}
            <strong>{m.requests ? Math.round((100 * m.with_indications) / m.requests) : 0}%</strong>
          </p>
          <p>
            Confirmados em local indicado{' '}
            <strong>{m.requests ? Math.round((100 * m.resolved) / m.requests) : 0}%</strong>
          </p>
          <p>
            Encontrados em outro local<strong>{m.other_place}</strong>
          </p>
          <p>
            Encerrados sem resultado<strong>{m.not_found}</strong>
          </p>
          <p>
            Abertos sem indicação<strong>{m.without_indications}</strong>
          </p>
          <p>
            Aguardando decisão<strong>{m.awaiting_decision}</strong>
          </p>
          <p>
            Retorno de colaboradores<strong>{m.returning_contributors}</strong>
          </p>
          <p>
            Onboardings concluídos<strong>{m.onboarded}</strong>
          </p>
          <p>
            Pessoas que contribuíram <strong>{m.contributors}</strong>
          </p>
          <p>
            Tempo médio até a primeira indicação{' '}
            <strong>
              {m.avg_first_indication_seconds === null
                ? '—'
                : Math.round(m.avg_first_indication_seconds / 60) + ' min'}
            </strong>
          </p>
          <p>
            Tempo médio até resolução{' '}
            <strong>
              {m.avg_resolution_seconds === null
                ? '—'
                : Math.round(m.avg_resolution_seconds / 60) + ' min'}
            </strong>
          </p>
          <p>
            Visitas à landing <strong>{m.analytics.LANDING_VISIT || 0}</strong>
          </p>
          <p>
            Cliques para começar <strong>{m.analytics.CTA_CLICK || 0}</strong>
          </p>
          <p>
            Consultas a descobertas anteriores <strong>{m.analytics.SEARCH_REUSED || 0}</strong>
          </p>
          <p>
            Mediana até primeira indicação
            <strong>
              {m.median_first_indication_seconds === null
                ? '—'
                : Math.round(m.median_first_indication_seconds / 60) + ' min'}
            </strong>
          </p>
          <p>
            P90 até primeira indicação
            <strong>
              {m.p90_first_indication_seconds === null
                ? '—'
                : Math.round(m.p90_first_indication_seconds / 60) + ' min'}
            </strong>
          </p>
          <p>
            Mediana até confirmação
            <strong>
              {m.median_resolution_seconds === null
                ? '—'
                : Math.round(m.median_resolution_seconds / 60) + ' min'}
            </strong>
          </p>
          <p>
            P90 até confirmação
            <strong>
              {m.p90_resolution_seconds === null
                ? '—'
                : Math.round(m.p90_resolution_seconds / 60) + ' min'}
            </strong>
          </p>
          {Object.entries(m.search).map(([kind, hits]) => (
            <p key={kind}>
              Histórico: {kind}
              <strong>{hits}</strong>
            </p>
          ))}
        </div>
        <p className="hint">
          Os indicadores de tempo de resolução consideram confirmações em locais indicados.
          Analytics da página pública são globais; as métricas de busca seguem a cidade selecionada.
        </p>
      </>
    );
  }
  return (
    <>
      <p className="eyebrow">Revisão humana, ações auditáveis</p>
      <h1>Administração</h1>
      <ScrollableTabs active={tab} label="Áreas administrativas" className="activity-tabs">
        {Object.entries(tabs).map(([key, label]) => (
          <Link
            key={key}
            href={'/admin?tab=' + key}
            className={tab === key ? 'active' : ''}
            aria-current={tab === key ? 'page' : undefined}
          >
            {label}
          </Link>
        ))}
      </ScrollableTabs>
      {tab === 'reports' ? (
        <form className="admin-search" action="/admin">
          <input type="hidden" name="tab" value="reports" />
          <label className="field">
            Status
            <select name="status" defaultValue={params.status || ''}>
              <option value="">Todos</option>
              <option value="OPEN">Pendentes</option>
              <option value="REVIEWED">Revisadas</option>
            </select>
          </label>
          <button className="button secondary">Filtrar denúncias</button>
        </form>
      ) : null}
      {['users', 'requests', 'indications', 'places'].includes(tab) ? (
        <form action="/admin" className="admin-search">
          <input type="hidden" name="tab" value={tab} />
          <label className="field">
            Pesquisar
            <input name="q" maxLength={60} defaultValue={q} />
          </label>
          <button className="button secondary">Buscar</button>
        </form>
      ) : null}
      {Array.isArray(body) && !body.length ? <Empty title="Nenhum registro para revisar." /> : body}
      <Pagination
        page={page}
        hasMore={more}
        base="/admin"
        params={{ tab, q, ...(params.status ? { status: params.status } : {}) }}
      />
    </>
  );
}
