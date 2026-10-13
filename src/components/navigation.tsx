'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './icon';

const destinations = [
  { href: '/app', label: 'Início', icon: 'compass' },
  { href: '/atividades', label: 'Atividades', icon: 'activity' },
  { href: '/ranking', label: 'Ranking', icon: 'award' },
  { href: '/perfil', label: 'Perfil', icon: 'person' },
] as const;
const secondary = [
  { href: '/salvos', label: 'Pedidos salvos', icon: 'bookmark' },
  { href: '/notificacoes', label: 'Notificações', icon: 'bell' },
  { href: '/preferencias', label: 'Preferências', icon: 'settings' },
] as const;

function selected(path: string, href: string) {
  return path === href || (href === '/app' && path.startsWith('/pedidos'));
}
export function DesktopNavigation({ admin }: { admin: boolean }) {
  const path = usePathname();
  return (
    <nav className="desktop-nav" aria-label="Navegação principal">
      {destinations.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          title={item.label}
          aria-current={selected(path, item.href) ? 'page' : undefined}
        >
          <Icon name={item.icon} size={22} />
          <span>{item.label}</span>
        </Link>
      ))}
      <div className="nav-secondary">
        {secondary.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            aria-current={selected(path, item.href) ? 'page' : undefined}
          >
            <Icon name={item.icon} size={22} />
            <span>{item.label}</span>
          </Link>
        ))}
        {admin ? (
          <Link
            href="/admin"
            title="Administração"
            aria-current={path === '/admin' ? 'page' : undefined}
          >
            <Icon name="shield" size={22} />
            <span>Administração</span>
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
export function MobileNavigation() {
  const path = usePathname();
  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      {destinations.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={selected(path, item.href) ? 'page' : undefined}
        >
          <span className="nav-icon">
            <Icon name={item.icon} size={22} />
          </span>
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
