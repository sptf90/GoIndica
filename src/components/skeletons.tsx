function Bar({ className = '', size }: { className?: string; size?: number }) {
  return (
    <span
      className={`skeleton ${className}`}
      style={size ? { width: size, height: size } : undefined}
    />
  );
}
function Loading({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="loading-state" role="status" aria-label={label}>
      {children}
    </div>
  );
}
function Heading() {
  return (
    <div className="loading-state">
      <Bar className="skeleton-eyebrow" />
      <Bar className="skeleton-title" />
      <Bar className="skeleton-text" />
    </div>
  );
}
export function RequestRowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }, (_, item) => (
        <div className="skeleton-row" key={item}>
          <Bar className="skeleton-meta" />
          <Bar className="skeleton-line" />
          <Bar className="skeleton-line short" />
        </div>
      ))}
    </div>
  );
}
export function FeedSkeleton() {
  return (
    <Loading label="Carregando pedidos da cidade">
      <Heading />
      <Bar className="skeleton-control" />
      <div className="skeleton-tabs" aria-hidden="true">
        <Bar />
        <Bar />
        <Bar />
      </div>
      <RequestRowsSkeleton />
    </Loading>
  );
}
export function ListSkeleton() {
  return (
    <Loading label="Carregando">
      <Heading />
      <RequestRowsSkeleton />
    </Loading>
  );
}
export function FormSkeleton() {
  return (
    <Loading label="Carregando">
      <div className="form-page loading-state">
        <Heading />
        <Bar className="skeleton-control" />
        <Bar className="skeleton-control" />
        <Bar className="skeleton-control" />
      </div>
    </Loading>
  );
}
export function DetailSkeleton() {
  return (
    <Loading label="Carregando pedido">
      <Bar className="skeleton-meta" />
      <Bar className="skeleton-title" />
      <Bar className="skeleton-text" />
      <div className="detail-grid" aria-hidden="true">
        <Bar className="skeleton-panel" />
        <Bar className="skeleton-panel" />
      </div>
    </Loading>
  );
}
export function ProfileSkeleton() {
  return (
    <Loading label="Carregando perfil">
      <div className="form-page loading-state">
        <div className="skeleton-profile">
          <Bar className="skeleton-avatar" size={80} />
          <div>
            <Bar className="skeleton-eyebrow" />
            <Bar className="skeleton-title" />
            <Bar className="skeleton-text" />
          </div>
        </div>
        <Bar className="skeleton-stats" />
        <RequestRowsSkeleton rows={4} />
      </div>
    </Loading>
  );
}
export function RankingSkeleton() {
  return (
    <Loading label="Carregando ranking">
      <Heading />
      <Bar className="skeleton-control" />
      <div aria-hidden="true">
        {Array.from({ length: 5 }, (_, item) => (
          <div className="skeleton-row-inline" key={item}>
            <Bar />
            <Bar className="skeleton-avatar" size={40} />
            <Bar className="skeleton-line" />
            <Bar className="skeleton-line" />
          </div>
        ))}
      </div>
    </Loading>
  );
}
