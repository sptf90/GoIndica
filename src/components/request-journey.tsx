import type { RequestStatus } from '@/lib/types';
import { Icon } from './icon';
export function RequestJourney({ status }: { status: RequestStatus }) {
  const stage = status === 'OPEN' ? 0 : status === 'REVEALED' ? 1 : 2;
  const closed = status === 'CANCELED' || status === 'CLOSED_NO_RESULT';
  if (closed) return null;
  return (
    <ol className="request-journey" aria-label="Etapas do pedido">
      {['Procurando', 'Conferir locais', 'Encontrado'].map((label, index) => (
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
