import Link from 'next/link';
import Image from 'next/image';
import type { GooglePlace } from '@/lib/google/places';
import type { RequestStatus } from '@/lib/types';
import { Icon } from './icon';
export const statusLabels: Record<RequestStatus, string> = {
  OPEN: 'Procurando',
  REVEALED: 'Indicações abertas',
  RESOLVED: 'Encontrado',
  CLOSED_NO_RESULT: 'Não encontrado',
  CANCELED: 'Cancelado',
};
export function Status({ status }: { status: RequestStatus }) {
  return <span className={`status status-${status.toLowerCase()}`}>{statusLabels[status]}</span>;
}
export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="empty">
      <LocationIllustration />
      <h3>{title}</h3>
      {children ? <div className="muted">{children}</div> : null}
    </div>
  );
}
export function LocationIllustration() {
  return (
    <div className="location-illustration" aria-hidden="true">
      <span className="location-illustration-core">
        <Icon name="pin" size={26} />
      </span>
      <i />
      <i />
      <i />
    </div>
  );
}
export function Avatar({
  name,
  url,
  size = 40,
}: {
  name: string;
  url?: string | null;
  size?: number;
}) {
  return url ? (
    <Image
      className="avatar"
      src={url}
      alt=""
      width={size}
      height={size}
      referrerPolicy="no-referrer"
    />
  ) : (
    <span
      className="avatar avatar-letter"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.3) }}
      aria-hidden="true"
    >
      {name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0))
        .join('')
        .toUpperCase()}
    </span>
  );
}
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="GoIndica — início">
      <Image
        className="brand-logo"
        src="/goindica-logo.svg"
        alt="GoIndica"
        width={190}
        height={46}
      />
    </Link>
  );
}
export function GoogleAttribution() {
  return (
    <div className="google-attribution">
      <Image
        src="/google-attribution.svg"
        width={98}
        height={18}
        alt="Google Maps"
        translate="no"
      />
    </div>
  );
}
export function Pagination({
  page,
  hasMore,
  base,
  params = {},
  pageKey = 'page',
}: {
  page: number;
  hasMore: boolean;
  base: string;
  params?: Record<string, string>;
  pageKey?: string;
}) {
  const href = (p: number) => `${base}?${new URLSearchParams({ ...params, [pageKey]: String(p) })}`;
  if (page === 1 && !hasMore) return null;
  return (
    <nav className="pagination" aria-label="Paginação">
      {page > 1 ? (
        <Link href={href(page - 1)} className="button secondary">
          Anterior
        </Link>
      ) : null}
      <span className="muted">Página {page}</span>
      {hasMore ? (
        <Link href={href(page + 1)} className="button secondary">
          Próxima
        </Link>
      ) : null}
    </nav>
  );
}

export function PlaceAttributions({ place }: { place: GooglePlace }) {
  return (
    <>
      {place.attributions.map((a, i) => (
        <p className="hint" key={a.provider + String(i)}>
          {a.providerUri?.startsWith('https://') ? (
            <a href={a.providerUri} target="_blank" rel="noopener noreferrer">
              {a.provider}
            </a>
          ) : (
            a.provider
          )}
        </p>
      ))}
    </>
  );
}
