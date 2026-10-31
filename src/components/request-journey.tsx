import type { RequestStatus } from '@/lib/types';
import { Icon } from './icon';
export function RequestJourney({ status }: { status: RequestStatus }) {
  const stage =
    status === 'OPEN' || status === 'REVEALED'
      ? 0
      : status === 'EVALUATING'
        ? 1
        : status === 'RESOLVED'
          ? 2
          : 0;
  const closed =
    status === 'CANCELED' ||
    status === 'CLOSED_NO_RESULT' ||
    status === 'CLOSED_TIMEOUT' ||
    status === 'CLOSED_EXHAUSTED';
  if (closed) return null;
  return (
    <ol className="request-journey" aria-label="Etapas do pedido">
      {['Aberto', 'Em avaliação', 'Concluído'].map((label, index) => (
        <li
          key={label}
          className={index <= stage ? 'reached' : ''}
          aria-current={index === stage ? 'step' : undefined}
        >
          <span>{index < stage ? <Icon name="check" size={14} /> : index + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}
