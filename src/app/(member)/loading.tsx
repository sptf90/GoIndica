export default function Loading() {
  return (
    <div className="loading-state" role="status" aria-label="Carregando">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-search" />
      {[0, 1, 2].map((item) => (
        <div className="skeleton-request" key={item} aria-hidden="true">
          <div className="skeleton skeleton-meta" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line short" />
        </div>
      ))}
      <span className="hint">Carregando a cidade…</span>
    </div>
  );
}
