import type { ReactNode } from 'react';
export function PageHeading({
  title,
  description,
  eyebrow,
  action,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <div className="heading-action">
        <h1>{title}</h1>
        {action}
      </div>
      {description ? <p className="muted">{description}</p> : null}
    </header>
  );
}
