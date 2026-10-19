import Link from 'next/link';
import Image from 'next/image';
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
export function Empty({
  title,
  children,
  headingLevel = 2,
}: {
  title: string;
  children?: React.ReactNode;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 3 ? 'h3' : 'h2';
  return (
    <div className="empty">
      <LocationIllustration />
      <Heading>{title}</Heading>
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
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
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
