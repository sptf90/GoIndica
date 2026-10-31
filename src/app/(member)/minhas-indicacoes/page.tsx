import Link from 'next/link';
import { PageHeading } from '@/components/page-heading';
import { member } from '@/server/auth';
import { check } from '@/lib/errors';
import { Empty, Status } from '@/components/ui';
import { citiesFor } from '@/server/queries';
import { pool, rows } from '@/lib/database/pool';
import type { LocalRequest } from '@/lib/types';

export const metadata = { title: 'Minhas indicações' };

function ownOutcome(request: LocalRequest, indicationId: string, selectedId: string | null) {
  if (request.status === 'RESOLVED') {
    if (selectedId && selectedId === indicationId) return 'Sua indicação foi validada';
    return 'Pedido concluído';
  }
  if (request.status === 'CLOSED_TIMEOUT') return 'Encerrado por falta de avaliação';
  if (request.status === 'CLOSED_EXHAUSTED') return 'Encerrado — nenhuma indicação válida';
  if (request.status === 'CLOSED_NO_RESULT') return 'Encerrado sem solução';
  if (request.status === 'EVALUATING' && selectedId === indicationId) return 'Em avaliação';
  if (request.status === 'CANCELED' || request.hidden_at) return null;
  return 'Enviada';
}

export default async function MinhasIndicacoesPage() {
  const { db, user } = await member();
  const indications = check(
    await db
      .from('indications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .order('id')
      .range(0, 49),
  );
  const visibleIndications = indications.filter((i) => !i.hidden_at);
  const ids = visibleIndications.map((i) => i.request_id);
  const requests = ids.length
    ? check(await db.from('requests').select('*').in('id', ids))
    : [];
  const requestMap = new Map(requests.map((r) => [r.id, r]));
  const cities = await citiesFor(requests);

  let evalMap = new Map<
    string,
    { result: string; reason_code: string | null; reason_note: string | null }
  >();
  if (visibleIndications.length) {
    try {
      const raw = await rows<{
        indication_id: string;
        result: string;
        reason_code: string | null;
        reason_note: string | null;
      }>(
        pool(),
        `SELECT indication_id,result,reason_code,reason_note FROM indication_evaluations WHERE indication_id IN (${visibleIndications.map(() => '?').join(',')})`,
        visibleIndications.map((i) => i.id),
      );
      evalMap = new Map(raw.map((e) => [e.indication_id, e]));
    } catch {
      evalMap = new Map();
    }
  }

  const items = visibleIndications
    .map((indication) => {
      const request = requestMap.get(indication.request_id);
      if (!request || request.hidden_at) return null;
      const label = ownOutcome(request, indication.id, request.selected_indication_id);
      if (!label) return null;
      return { indication, request, label, evaluation: evalMap.get(indication.id) };
    })
    .filter(Boolean);

  return (
    <div className="collection-page">
      <PageHeading
        title="Minhas indicações"
        eyebrow="Seu histórico"
        description="Somente as indicações que você enviou. O solicitante permanece anônimo."
      />
      {items.length ? (
        <div className="request-list">
          {items.map((item) => {
            if (!item) return null;
            const { indication, request, label, evaluation } = item;
            const city = cities.get(request.city_id);
            return (
              <article className="request-row" key={indication.id}>
                <div className="request-summary">
                  <div className="row-meta">
                    <Status status={request.status} />
                    <span className="hint">{label}</span>
                  </div>
                  <h2>
                    <Link href={'/pedidos/' + request.id}>{request.description}</Link>
                  </h2>
                  <p className="muted request-location">
                    {city ? `${city.name} — ${city.state_code}` : ''}
                  </p>
                  {evaluation?.result === 'INVALID' ? (
                    <p className="hint">
                      Sua indicação foi considerada não válida
                      {evaluation.reason_note ? `: ${evaluation.reason_note}` : '.'}
                    </p>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty title="Você ainda não enviou indicações.">
          <p>
            <Link href="/fazer" className="text-link">
              Ver pedidos para indicar ↗
            </Link>
          </p>
        </Empty>
      )}
    </div>
  );
}
