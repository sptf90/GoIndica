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
import {
  reveal,
  cancel,
  report,
  selectIndication,
  evaluateIndication,
  closeRequestVoluntarily,
  reopenRequest,
} from '@/server/actions';
import { ComparisonLive } from '@/components/comparison-live';
import { date, timestamp } from '@/server/queries';
import { PlacePanel } from '@/components/place-panel';
import { DiscoveryFeedback } from '@/components/discovery-feedback';
import { wanted, reconfirm } from '@/server/discovery-actions';
import { RequestPhoto } from '@/components/request-photo';
import { ShareCard } from '@/components/share-card';
import { profilePhotoUrl, profileUrl } from '@/lib/profile-links';
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
  const owner = request.requester_id === user.id;
  const [cityResult, authorResult, resolutionResult, ownResult] = await Promise.all([
    db.from('cities').select('*').eq('id', request.city_id).single(),
    // DEC-05: nunca carregar perfil do solicitante para indicadores.
    owner
      ? db.from('profiles').select('*').eq('id', request.requester_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    db.from('request_resolutions').select('*').eq('request_id', id).maybeSingle(),
    db.from('indications').select('*').eq('request_id', id).eq('user_id', user.id).maybeSingle(),
  ]);
  const city = check(cityResult),
    author = authorResult.data,
    resolution = resolutionResult.data;
  const comparisonOpen = Boolean(request.first_comparison_opened_at) || request.status === 'REVEALED';
  const canCompare =
    owner &&
    (comparisonOpen ||
      ['EVALUATING', 'RESOLVED', 'CLOSED_NO_RESULT', 'CLOSED_TIMEOUT', 'CLOSED_EXHAUSTED'].includes(
        request.status,
      ));
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
      ? check(await db.call('request_editable', { p_request_id: id }))
      : false;
  const rawGroups = canCompare
    ? check(await db.call('indication_groups', { p_request_id: id, p_offset: (page - 1) * 10 }))
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
  // DEC-01/09: revelar identidade somente do indicador selecionado (em avaliação/concluído).
  const revealSelectedId =
    request.status === 'EVALUATING' || request.status === 'RESOLVED'
      ? request.selected_indication_id
      : null;
  const profileIds = revealSelectedId
    ? [
        ...new Set(
          peopleRows
            .flatMap((rows) => rows)
            .filter((i) => i.id === revealSelectedId)
            .map((i) => i.user_id),
        ),
      ]
    : [];
  const profileRows = profileIds.length
    ? check(await db.from('profiles').select('*').in('id', profileIds))
    : [];
  const profileMap = new Map(profileRows.map((p) => [p.id, p]));
  const groups = rawGroups.slice(0, 10).map((g, index) => ({
    ...g,
    people:
      request.status === 'EVALUATING' && request.selected_indication_id
        ? peopleRows[index].filter((i) => i.id === request.selected_indication_id)
        : request.status === 'RESOLVED' && request.selected_indication_id
          ? peopleRows[index].filter((i) => i.id === request.selected_indication_id)
          : peopleRows[index],
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
      <ComparisonLive requestId={id} enabled={owner && comparisonOpen && request.status === 'OPEN'} />
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
              <Link className="button secondary sm edit-request" href={`/pedidos/${id}/editar`}>
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
          {owner && author ? (
            <Link className="byline" href={profileUrl(author.username, { request: id })}>
              <Avatar
                name={author.display_name}
                size={38}
                src={profilePhotoUrl(author, { request: id })}
              />
              <span>
                <span className="metadata-label">Seu pedido</span>
                <strong>{author.display_name}</strong>{' '}
                <span className="hint">— @{author.username}</span>
              </span>
            </Link>
          ) : null}
        </div>
      </header>
      <div className="request-community-interest request-interest-bar">
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
                    <p className="eyebrow">Há respostas disponíveis</p>
                    <p className="muted">
                      Abra a comparação para ver o conteúdo completo, sem identidade dos
                      indicadores. O pedido continua Aberto e pode receber novas indicações.
                    </p>
                  </>
                )}
                {owner ? (
                  <>
                    {request.indication_count > 0 && !comparisonOpen ? (
                      <ActionForm
                        action={reveal}
                        label="Abrir comparação"
                        pendingLabel="Abrindo…"
                        confirm="Abrir a comparação? Você não poderá mais excluir este pedido. Novas indicações continuam sendo aceitas até você escolher uma para testar."
                      >
                        <input type="hidden" name="requestId" value={id} />
                      </ActionForm>
                    ) : null}
                    {request.indication_count === 0 ? (
                      <ShareRequest description={request.description} />
                    ) : null}
                    <div className="owner-tools">
                      <span className="hint">
                        {comparisonOpen
                          ? 'Comparação aberta: exclusão do pedido bloqueada.'
                          : request.indication_count
                            ? 'Os conteúdos permanecem privados até você abrir a comparação.'
                            : 'Convide quem conhece a cidade.'}
                      </span>
                      {!comparisonOpen ? (
                        <ActionForm
                          action={cancel}
                          label="Excluir pedido"
                          className="compact quiet"
                          confirm="Excluir esta solicitação?"
                        >
                          <input type="hidden" name="requestId" value={id} />
                        </ActionForm>
                      ) : (
                        <ActionForm
                          action={closeRequestVoluntarily}
                          label="Encerrar sem solução"
                          className="compact quiet"
                          confirm="Encerrar este pedido sem selecionar indicação? O histórico será preservado."
                        >
                          <input type="hidden" name="requestId" value={id} />
                        </ActionForm>
                      )}
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
          {!owner && request.status === 'EVALUATING' ? (
            <div className="notice">
              Este pedido está em avaliação e não aceita novas indicações.
            </div>
          ) : null}
          {!owner && request.status === 'OPEN' && comparisonOpen ? (
            <div className="notice">
              O solicitante está comparando respostas. Você ainda pode enviar uma indicação se
              ainda não participou.
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
          {owner && canCompare ? (
            <section className="indication-groups">
              <div className="section-heading">
                <p className="eyebrow">Comparação</p>
                <h2>
                  {request.status === 'EVALUATING'
                    ? 'Indicação em teste'
                    : 'Respostas disponíveis (autores ocultos)'}
                </h2>
              </div>
              {request.status === 'EVALUATING' && request.evaluation_deadline_at ? (
                <p className="notice">
                  Avalie até{' '}
                  <time dateTime={request.evaluation_deadline_at}>
                    {timestamp(request.evaluation_deadline_at)}
                  </time>
                  .
                </p>
              ) : null}
              {groups.map((g, index) => (
                <article className="indication-group" key={g.place_id || g.people[0]?.id || index}>
                  {g.place_id ? (
                    <PlacePanel
                      requestId={id}
                      placeId={g.place_id}
                      count={undefined}
                      autoLoad={index === 0}
                      allowResolve={false}
                    />
                  ) : null}
                  <ul className="indicators">
                    {g.people.map((i) => {
                      const revealed = revealSelectedId === i.id;
                      const p = revealed ? g.profiles.get(i.user_id) : null;
                      return (
                        <li key={i.id}>
                          {p ? (
                            <Link
                              className="avatar-link"
                              href={profileUrl(p.username, { request: id })}
                              tabIndex={-1}
                              aria-hidden="true"
                            >
                              <Avatar
                                name={p.display_name}
                                size={32}
                                src={profilePhotoUrl(p, { request: id })}
                              />
                            </Link>
                          ) : (
                            <Avatar name="Indicação" size={32} />
                          )}
                          <div>
                            {p ? (
                              <Link href={profileUrl(p.username, { request: id })}>
                                <strong>{p.display_name}</strong>{' '}
                                <span className="hint">@{p.username}</span>
                              </Link>
                            ) : (
                              <strong>Indicação anônima</strong>
                            )}
                            {i.comment ? <p>{i.comment}</p> : null}
                            {(request.status === 'OPEN' ||
                              request.status === 'REVEALED' ||
                              (request.status === 'EVALUATING' && !request.selected_indication_id)) &&
                            !i.hidden_at ? (
                              <ActionForm
                                action={selectIndication}
                                label="Escolher para testar"
                                confirm="Confirmar esta indicação para teste? O autor será revelado, as demais ficam inacessíveis temporariamente e começa o prazo de 36 horas."
                                className="compact"
                              >
                                <input type="hidden" name="requestId" value={id} />
                                <input type="hidden" name="indicationId" value={i.id} />
                              </ActionForm>
                            ) : null}
                            {request.status === 'EVALUATING' &&
                            request.selected_indication_id === i.id ? (
                              <div className="two-actions">
                                <ActionForm
                                  action={evaluateIndication}
                                  label="Válida"
                                  confirm="Confirmar como válida e concluir o pedido?"
                                >
                                  <input type="hidden" name="requestId" value={id} />
                                  <input type="hidden" name="result" value="VALID" />
                                </ActionForm>
                                <ActionForm action={evaluateIndication} label="Não válida">
                                  <input type="hidden" name="requestId" value={id} />
                                  <input type="hidden" name="result" value="INVALID" />
                                  <label className="field">
                                    Motivo
                                    <select name="reasonCode" required defaultValue="">
                                      <option value="" disabled>
                                        Selecione
                                      </option>
                                      <option value="INCORRECT_OR_INSUFFICIENT">
                                        Informação incorreta ou insuficiente
                                      </option>
                                      <option value="UNAVAILABLE">
                                        Produto ou serviço indisponível
                                      </option>
                                      <option value="CLOSED_OR_MISSING">
                                        Estabelecimento fechado ou inexistente
                                      </option>
                                      <option value="NO_CONTACT">
                                        Não foi possível entrar em contato
                                      </option>
                                      <option value="OTHER">Outro motivo</option>
                                    </select>
                                  </label>
                                  <label className="field">
                                    Detalhe opcional
                                    <textarea name="reasonNote" maxLength={500} rows={2} />
                                  </label>
                                </ActionForm>
                              </div>
                            ) : null}
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
                </article>
              ))}
              {!groups.length ? (
                <Empty headingLevel={3} title="Nenhuma indicação disponível nesta página." />
              ) : null}
              {request.status === 'EVALUATING' && !request.selected_indication_id ? (
                <div className="two-actions">
                  <ActionForm
                    action={reopenRequest}
                    label="Reabrir pedido"
                    confirm="Reabrir para receber novas indicações? Autores anteriores não poderão participar de novo."
                  >
                    <input type="hidden" name="requestId" value={id} />
                  </ActionForm>
                  <ActionForm
                    action={closeRequestVoluntarily}
                    label="Encerrar sem solução"
                    className="quiet"
                    confirm="Encerrar sem solução?"
                  >
                    <input type="hidden" name="requestId" value={id} />
                  </ActionForm>
                </div>
              ) : null}
              <Pagination page={page} hasMore={rawGroups.length > 10} base={'/pedidos/' + id} />
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
