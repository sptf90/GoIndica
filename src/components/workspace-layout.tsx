import Link from 'next/link';
import { useId, type ReactNode } from 'react';
import { PageHeading } from './page-heading';
import { Icon } from './icon';

export function TaskPage({
  title, description, eyebrow, back, guidance, children,
}: {
  title: string;
  description: string;
  eyebrow: string;
  back?: { href: string; label: string };
  guidance: { title: string; items: string[] };
  children: ReactNode;
}) {
  return (
    <div className="task-page">
      {back ? <Link href={back.href} className="back-link"><Icon name="back" size={16} />{back.label}</Link> : null}
      <PageHeading title={title} description={description} eyebrow={eyebrow} />
      <div className="task-layout">
        <div className="task-form">{children}</div>
        <aside className="task-guidance" aria-label={guidance.title}>
          <span className="guidance-symbol"><Icon name="message" size={22} /></span>
          <h2>{guidance.title}</h2>
          <ul>{guidance.items.map((item) => <li key={item}><Icon name="check" size={16} /><span>{item}</span></li>)}</ul>
        </aside>
      </div>
    </div>
  );
}

export function SettingsSection({ title, description, danger = false, children }: {
  title: string;
  description?: string;
  danger?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className={`settings-section${danger ? ' settings-section-danger' : ''}`} aria-labelledby={id}>
      <div className="settings-section-heading">
        <h2 id={id}>{title}</h2>
        {description ? <p className="muted">{description}</p> : null}
      </div>
      <div className="settings-section-content">{children}</div>
    </section>
  );
}
