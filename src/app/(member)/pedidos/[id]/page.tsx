import { RequestJourney } from '@/components/request-journey';
import { LiveRequest } from '@/components/community-status';
import { interest } from '@/server/community-actions';
import Link from 'next/link';
import { pageNumber } from '@/lib/pagination';
import { notFound } from 'next/navigation';
import { member } from '@/server/auth';
import { uuid } from '@/lib/validation/schemas';
import { check } from '@/lib/errors';
import { ActionForm } from '@/components/action-form';
import {
  Status,
  Avatar,
  Empty,
  Pagination,
  LocationIllustration,
  statusLabels,
} from '@/components/ui';
import { Icon } from '@/components/icon';
import { ShareRequest } from '@/components/share-request';
import { reveal, resolve, cancel, report } from '@/server/actions';
import { date, timestamp } from '@/server/queries';
import { PlacePanel } from '@/components/place-panel';
import { DiscoveryFeedback } from '@/components/discovery-feedback';
import { wanted, reconfirm } from '@/server/discovery-actions';
import { RequestPhoto } from '@/components/request-photo';
import { ShareCard } from '@/components/share-card';
export const metadata = { title: 'Pedido da comunidade' };
export default async function Detail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    page?: string;
    peoplePage?: string;
    peopleFor?: string;
    enviado?: string;
  }>;
}) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const { db, user } = await member();
  const search = await searchParams;
  const page = pageNumber(search.page);
  const peoplePage = pageNumber(search.peoplePage);
  const result = await db.from('requests').select('*').eq('id', id).maybeSingle();
  if (result.error) throw result.error;
  const request = result.data;
  if (!request) notFound();
  const [cityResult, authorResult, resolutionResult, ownResult] = await Promise.all([
    db.from('cities').select('*').eq('id', request.city_id).single(),
    db.from('profiles').select('*').eq('id', request.requester_id).maybeSingle(),
    db.from('request_resolutions').select('*').eq('request_id', id).maybeSingle(),
    db.from('indications').select('*').eq('request_id', id).eq('user_id', user.id).maybeSingle(),
  ]);
  const city = check(cityResult),
    author = authorResult.data,
    resolution = resolutionResult.data;
  const owner = request.requester_id === user.id;
  const interests = check(
    await db.from('request_interests').select('*').eq('request_id', id).maybeSingle(),
  );
  const ownReconfirmation =
    request.status === 'RESOLVED'
      ? check(
          await db
            .from('request_reconfirmations')
            .select('confirmed_at')
            .eq('request_id', id)
            .maybeSingle(),
        )
      : null;
  const editable =
    owner && request.status === 'OPEN'
      ? check(await db.rpc('request_editable', { p_request_id: id }))
      : false;
  const rawGroups =
    owner && ['REVEALED', 'RESOLVED', 'CLOSED_NO_RESULT'].includes(request.status)
      ? check(await db.rpc('indication_groups', { p_request_id: id, p_offset: (page - 1) * 10 }))
      : [];
  const peopleResults = await Promise.all(
    rawGroups.slice(0, 10).map((g) => {
      const current = search.peopleFor === g.place_id ? peoplePage : 1;
      return db
        .from('indications')
        .select('*')
        .eq('request_id', id)
        .eq('place_id', g.place_id)
        .order('created_at')
        .order('id')
        .range((current - 1) * 20, current * 20 - 1);
    }),
  );
  const peopleRows = peopleResults.map((r) => check(r));
  const profileIds = [...new Set(peopleRows.flatMap((rows) => rows.map((i) => i.user_id)))];
  const profileRows = profileIds.length
    ? check(await db.from('profiles').select('*').in('id', profileIds))
    : [];
  const profileMap = new Map(profileRows.map((p) => [p.id, p]));
  const groups = rawGroups.slice(0, 10).map((g, index) => ({
    ...g,
    people: peopleRows[index],
    peoplePage: search.peopleFor === g.place_id ? peoplePage : 1,
    profiles: profileMap,
  }));
  const createdDate = new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(request.created_at));
  return (
    <div className="detail-page">
      <LiveRequest id={id} count={request.indication_count} status={request.status} />
      <header className="request-header">
        <Link href="/app" className="back-link">
          <Icon name="back" size={18} /> Pedidos da cidade
        </Link>
        <RequestJourney status={request.status} />
        <div className="request-toolbar">
          <div className="row-meta">
            <Status status={request.status} />
            <span className="published-date">
              <Icon name="calendar" size={16} />
              <time dateTime={request.created_at}>Publicado em {createdDate}</time>
            </span>
          </div>
          <div className="request-actions">
            {editable ? (
              <Link className="button secondary edit-request" href={`/pedidos/${id}/editar`}>
                <Icon name="edit" size={16} />
                <span>Editar pedido</span>
              </Link>
            ) : null}
            <ShareRequest description={request.description} compact />
            <details className="request-options">
              <summary>
                <Icon name="bookmark" size={18} /> <span>Opções</span>
                <Icon name="chevron" size={14} />
              </summary>
              <div className="request-options-content">
                {(['saved', 'following'] as const).map((kind) => (
                  <ActionForm
                    key={kind}
                    action={interest}
                    label={
                      kind === 'saved'
                        ? interests?.saved
                          ? 'Remover dos salvos'
                          : 'Salvar pedido'
                        : interests?.following
                          ? 'Deixar de acompanhar'
                          : 'Acompanhar pedido'
                    }
                    className="compact quiet"
                  >
                    <input type="hidden" name="requestId" value={id} />
                    <input type="hidden" name="kind" value={kind} />
                    <input type="hidden" name="enabled" value={String(!interests?.[kind])} />
                  </ActionForm>
                ))}
              </div>
            </details>
          </div>
        </div>
        <h1>{request.description}</h1>
        <div className="request-metadata">
          <div className="metadata-location">
            <span className="metadata-icon">
              <Icon name="pin" size={20} />
            </span>
            <div>
              <span className="metadata-label">Local</span>
              <p className="location">
                {city.name} — {city.state_code}
                {request.neighborhood ? ` · ${request.neighborhood}` : ''}
              </p>
            </div>
          </div>
          {author ? (
            <Link className="byline" href={'/perfil/' + author.username}>
              <Avatar name={author.display_name} url={author.avatar_url} size={38} />
              <span>
                <span className="metadata-label">Publicado por</span>
                <strong>{author.display_name}</strong>{' '}
                <span className="hint">— @{author.username}</span>
              </span>
            </Link>
          ) : (
            <p className="hint">Autor indisponível</p>
          )}
        </div>
      </header>
      <div className="request-community-interest">
        {request.wanting_count > 0 ? (
          <p>
            {request.wanting_count}{' '}
            {request.wanting_count === 1
              ? 'pessoa também procura isso'
              : 'pessoas também procuram isso'}
            .
          </p>
        ) : null}
        {!owner && (['OPEN', 'REVEALED'].includes(request.status) || interests?.wanted) ? (
          <ActionForm
            action={wanted}
            label={interests?.wanted ? 'Deixar de procurar junto' : 'Também estou procurando'}
            className="compact quiet"
          >
            <input type="hidden" name="requestId" value={id} />
            <input type="hidden" name="wanted" value={String(!interests?.wanted)} />
          </ActionForm>
        ) : null}
      </div>
      <div className="detail-grid">
        <div className="detail-content">
          {request.has_photo ? (
            <RequestPhoto url={'/api/request-photo?id=' + id + '&v=' + request.photo_updated_at} />
          ) : null}
          {search.enviado ? (
            <p className="notice success" role="status">
              Sua indicação foi recebida. Você ganha pontos se este local for confirmado.
            </p>
          ) : null}
          {request.status === 'OPEN' ? (
            <>
              <div className="responses-heading">
                <div>
                  <p className="eyebrow">Respostas da comunidade</p>
                  <h2>Indicações</h2>
                </div>
                <span className="response-total">
                  {request.indication_count}{' '}
                  {request.indication_count === 1 ? 'indicação recebida' : 'indicações recebidas'}
                </span>
              </div>
              <section className="response-gate">
                {request.indication_count === 0 ? (
                  <>
                    <LocationIllustration />
                    <h3>Sua cidade ainda não respondeu.</h3>
                    <p className="muted">
                      Quando alguém souber onde encontrar, a indicação chegará aqui.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="eyebrow">O conhecimento está chegando</p>
                    <div className="big-count">
                      {request.indication_count}
                      <span>
                        {request.indication_count === 1
                          ? 'indicação recebida'
                          : 'indicações recebidas'}
                      </span>
                    </div>
                  </>
                )}
                {owner ? (
                  <>
                    {request.indication_count > 0 ? (
                      <p className="muted">
                        Ao abrir as indicações, você encerra o recebimento de novas respostas. Os
                        locais ficam disponíveis para você conferir.
                      </p>
                    ) : null}
                    {request.indication_count > 0 ? (
                      <ActionForm
                        action={reveal}
                        label="Ver indicações"
                        pendingLabel="Abrindo…"
                        confirm="Abrir as indicações? Novas respostas serão bloqueadas definitivamente."
                      >
                        <input type="hidden" name="requestId" value={id} />
                      </ActionForm>
                    ) : (
                      <ShareRequest description={request.description} />
                    )}
                    <div className="owner-tools">
                      <span className="hint">
                        {request.indication_count
                          ? 'Os locais continuam privados até você abrir.'
                          : 'Convide quem conhece a cidade.'}
                      </span>
                      <ActionForm
                        action={cancel}
                        label="Cancelar pedido"
                        className="compact quiet"
                        confirm="Cancelar esta solicitação?"
                      >
                        <input type="hidden" name="requestId" value={id} />
                      </ActionForm>
                    </div>
                  </>
                ) : ownResult.data ? (
                  <p className="notice success">
                    Você já indicou um local. As outras indicações permanecem privadas.
                  </p>
                ) : (
                  <>
                    <p className="muted">
                      Conhece um estabelecimento nessa cidade? Seu conhecimento pode ajudar.
                    </p>
                    <Link className="button" href={`/pedidos/${id}/indicar`}>
                      Indicar local ↗
                    </Link>
                  </>
                )}
              </section>
            </>
          ) : null}
          {!owner && request.status === 'REVEALED' ? (
            <div className="notice">
              O solicitante abriu as indicações. Novas respostas estão bloqueadas e os locais
              permanecem privados.
            </div>
          ) : null}
          {resolution ? (
            <section className="resolution-history">
              <p className="eyebrow">Resultado registrado em {date(resolution.created_at)}</p>
              {resolution.type === 'INDICATED_PLACE' ? (
                <>
                  <PlacePanel requestId={id} placeId={resolution.place_id!} confirmed autoLoad />
                  <p className="hint">
                    Este item foi encontrado neste local em {date(resolution.created_at)}. A
                    disponibilidade pode ter mudado.
                  </p>
                  <div className="discovery-reconfirmations">
                    {request.reconfirmation_count > 0 ? (
                      <p>
                        <strong>
                          {request.reconfirmation_count}{' '}
                          {request.reconfirmation_count === 1
                            ? 'pessoa encontrou aqui também'
                            : 'pessoas encontraram aqui também'}
                          .
                        </strong>
                        {request.last_reconfirmed_at
                          ? ` Última confirmação em ${date(request.last_reconfirmed_at)}.`
                          : ''}
                      </p>
                    ) : null}
                    {!owner ? (
                      ownReconfirmation ? (
                        <p className="notice success">
                          Você encontrou aqui também em {date(ownReconfirmation.confirmed_at)}.
                        </p>
                      ) : (
                        <ActionForm
                          action={reconfirm}
                          label="Encontrei aqui também"
                          className="quiet"
                          confirm="Você encontrou o item neste mesmo local? Registrar sua confirmação com a data de hoje?"
                        >
                          <input type="hidden" name="requestId" value={id} />
                        </ActionForm>
                      )
                    ) : null}
                  </div>
                </>
              ) : resolution.type === 'OTHER_PLACE' ? (
                <>
                  <h2>Encontrado em outro local</h2>
                  <p className="muted">
                    O local não veio das indicações. Nenhum ponto foi distribuído.
                  </p>
                </>
              ) : (
                <>
                  <h2>Ainda não foi desta vez.</h2>
                  <p className="muted">
                    O pedido foi encerrado sem resultado. Ninguém perdeu pontos.
                  </p>
                </>
              )}
              {request.status === 'RESOLVED' ? (
                <DiscoveryFeedback requestId={id} cityId={city.id} />
              ) : null}
            </section>
          ) : null}
          {request.status === 'CANCELED' ? (
            <div className="notice">
              Esta solicitação foi cancelada e não recebe novas indicações.
            </div>
          ) : null}
          {owner && request.status !== 'OPEN' && request.status !== 'CANCELED' ? (
            <section className="indication-groups">
              <div className="section-heading">
                <p className="eyebrow">Caminhos que a cidade indicou</p>
                <h2>{request.indication_count} indicações, agrupadas por local.</h2>
              </div>
              {groups.map((g, index) => (
                <article className="indication-group" key={g.place_id}>
                  <PlacePanel
                    requestId={id}
                    placeId={g.place_id}
                    count={g.indications}
                    autoLoad={request.status === 'REVEALED' && index === 0}
                    allowResolve={request.status === 'REVEALED'}
                  />
                  <ul className="indicators">
                    {g.people.map((i) => {
                      const p = g.profiles.get(i.user_id);
                      return (
                        <li key={i.id}>
                          <Avatar
                            name={p?.display_name || 'Pessoa'}
                            url={p?.avatar_url}
                            size={32}
                          />
                          <div>
                            {p ? (
                              <Link href={'/perfil/' + p.username}>
                                <strong>{p.display_name}</strong>{' '}
                                <span className="hint">@{p.username}</span>
                              </Link>
                            ) : (
                              <strong>Perfil indisponível</strong>
                            )}
                            {i.comment ? <p>{i.comment}</p> : null}
                            <time className="hint" dateTime={i.created_at}>
                              {timestamp(i.created_at)}
                            </time>
                            <details className="report-details">
                              <summary>Denunciar indicação</summary>
                              <ActionForm action={report} label="Enviar denúncia">
                                <input type="hidden" name="targetType" value="INDICATION" />
                                <input type="hidden" name="targetId" value={i.id} />
                                <label className="field">
                                  Motivo
                                  <textarea
                                    name="reason"
                                    minLength={10}
                                    maxLength={500}
                                    rows={2}
                                    required
                                  />
                                </label>
                              </ActionForm>
                            </details>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  {g.indications > 20 ? (
                    <Pagination
                      page={g.peoplePage}
                      hasMore={g.peoplePage * 20 < g.indications}
                      base={'/pedidos/' + id}
                      params={{ page: String(page), peopleFor: g.place_id }}
                      pageKey="peoplePage"
                    />
                  ) : null}
                </article>
              ))}
              {!groups.length ? (
                <Empty headingLevel={3} title="Nenhuma indicação disponível nesta página." />
              ) : null}
              <Pagination page={page} hasMore={rawGroups.length > 10} base={'/pedidos/' + id} />
            </section>
          ) : null}
          {owner && request.status === 'REVEALED' ? (
            <section className="other-resolution">
              <h2>O resultado foi outro?</h2>
              <div className="two-actions">
                <ActionForm
                  action={resolve}
                  label="Encontrei em outro local"
                  className="quiet"
                  confirm="Registrar que encontrou em outro local e encerrar sem recompensas?"
                >
                  <input type="hidden" name="requestId" value={id} />
                  <input type="hidden" name="type" value="OTHER_PLACE" />
                </ActionForm>
                <ActionForm
                  action={resolve}
                  label="Não encontrei"
                  className="quiet"
                  confirm="Encerrar sem resultado? Nenhum ponto será distribuído."
                >
                  <input type="hidden" name="requestId" value={id} />
                  <input type="hidden" name="type" value="NOT_FOUND" />
                </ActionForm>
              </div>
              <p className="hint">
                Nenhum ponto é distribuído nessas opções. Ninguém perde pontos.
              </p>
            </section>
          ) : null}
          <details className="report-details">
            <summary>Denunciar este pedido</summary>
            <ActionForm action={report} label="Enviar denúncia">
              <input type="hidden" name="targetType" value="REQUEST" />
              <input type="hidden" name="targetId" value={id} />
              <label className="field">
                Motivo
                <textarea name="reason" minLength={10} maxLength={500} rows={3} required />
              </label>
            </ActionForm>
          </details>
        </div>
        <aside className="request-context" aria-labelledby="request-context-title">
          <ShareCard requestId={id} />
          <div className="context-heading">
            <span className="context-icon">
              <Icon name="map" size={20} />
            </span>
            <div>
              <p className="metadata-label">Contexto do pedido</p>
              <h2 id="request-context-title">Área da busca</h2>
            </div>
          </div>
          <div className="area-illustration" aria-hidden="true">
            <span className="area-marker">
              <Icon name="pin" size={20} />
            </span>
            <span className="area-city">{city.name}</span>
          </div>
          <dl className="context-facts">
            <div>
              <dt>
                <Icon name="pin" size={15} />
                Cidade
              </dt>
              <dd>
                {city.name} — {city.state_code}
              </dd>
            </div>
            {request.neighborhood ? (
              <div>
                <dt>Bairro ou região</dt>
                <dd>{request.neighborhood}</dd>
              </div>
            ) : null}
            <div>
              <dt>
                <Icon name="search" size={15} />
                Status
              </dt>
              <dd className="context-status">{statusLabels[request.status]}</dd>
            </div>
            <div>
              <dt>
                <Icon name="clock" size={15} />
                Data de criação
              </dt>
              <dd>
                <time dateTime={request.created_at}>{createdDate}</time>
              </dd>
            </div>
          </dl>
          <p className="context-note">
            <Icon name="sparkle" size={16} />
            <span>
              As indicações vêm de pessoas da comunidade. Confirme a disponibilidade com o
              estabelecimento.
            </span>
          </p>
        </aside>
      </div>
    </div>
  );
}
