import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { City, LocalRequest, Resolution } from '@/lib/types';
import { Status } from './ui';
import { date } from '@/server/queries';
import { Icon } from './icon';
import { DiscoveryPlace } from './discovery-place';
export function RequestCard({
  request,
  city,
  resolution,
  index = 0,
}: {
  request: LocalRequest;
  city?: City;
  resolution?: Resolution;
  index?: number;
}) {
  return (
    <article className="request-row" style={{ '--i': Math.min(index, 10) } as CSSProperties}>
      <div className="request-summary">
        <div className="row-meta">
          <Status status={request.status} />
          <time dateTime={request.created_at}>{date(request.created_at)}</time>
        </div>
        <h2>
          <Link href={'/pedidos/' + request.id}>{request.description}</Link>
        </h2>
        {request.has_photo || request.wanting_count > 0 ? (
          <p className="hint request-signals">
            {request.has_photo ? <span>Com foto</span> : null}
            {request.wanting_count > 0 ? (
              <span>
                {request.wanting_count}{' '}
                {request.wanting_count === 1 ? 'pessoa também procura' : 'pessoas também procuram'}
              </span>
            ) : null}
          </p>
        ) : null}
        {request.reconfirmation_count > 0 ? (
          <p className="hint">
            {request.reconfirmation_count}{' '}
            {request.reconfirmation_count === 1
              ? 'pessoa encontrou aqui também'
              : 'pessoas encontraram aqui também'}
            {request.last_reconfirmed_at
              ? ` · Última confirmação em ${date(request.last_reconfirmed_at)}`
              : ''}
          </p>
        ) : null}
        {resolution ? (
          <p className="hint discovery-context">
            {resolution.type === 'INDICATED_PLACE'
              ? 'Local confirmado pela comunidade'
              : resolution.type === 'OTHER_PLACE'
                ? 'Encontrado em outro local'
                : 'Encerrado sem resultado'}{' '}
            · {date(resolution.created_at)}.{' '}
            {resolution.type !== 'NOT_FOUND' ? 'A disponibilidade pode ter mudado.' : ''}
          </p>
        ) : null}
        {resolution?.type === 'INDICATED_PLACE' && resolution.place_id ? (
          <DiscoveryPlace requestId={request.id} placeId={resolution.place_id} />
        ) : null}
      </div>
      <div className="request-card-footer">
        <p className="muted request-location">
          <Icon name="pin" size={14} />
          {city ? `${city.name} — ${city.state_code}` : ''}
          {request.neighborhood ? ` · ${request.neighborhood}` : ''}
        </p>
        <Link
          href={'/pedidos/' + request.id}
          className="request-count"
          aria-label={`${request.indication_count} ${request.indication_count === 1 ? 'indicação' : 'indicações'} — Abrir pedido: ${request.description}`}
        >
          <Icon name="message" size={17} />
          <strong>{request.indication_count}</strong>{' '}
          <span>{request.indication_count === 1 ? 'indicação' : 'indicações'}</span>
          <Icon name="arrow" size={16} />
        </Link>
      </div>
    </article>
  );
}
