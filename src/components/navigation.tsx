'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import { Icon, type IconName } from './icon';

export const destinations = [
  { href: '/app', label: 'Início', icon: 'compass' },
  { href: '/atividades', label: 'Atividades', icon: 'activity' },
  { href: '/ranking', label: 'Ranking', icon: 'award' },
  { href: '/perfil', label: 'Perfil', icon: 'person' },
] as const;
export const secondary = [
  { href: '/salvos', label: 'Pedidos salvos', icon: 'bookmark' },
  { href: '/notificacoes', label: 'Notificações', icon: 'bell' },
  { href: '/preferencias', label: 'Preferências', icon: 'settings' },
] as const;

const spring = {
  type: 'spring',
  stiffness: 520,
  damping: 40,
  mass: 0.8,
} as const;

function selected(path: string, href: string) {
  return path === href || (href === '/app' && path.startsWith('/pedidos'));
}
function SidebarLink({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: IconName;
  active: boolean;
}) {
  return (
    <Link href={href} title={label} aria-current={active ? 'page' : undefined}>
      {active ? (
        <motion.span layoutId="sidebar-pill" className="nav-pill" transition={spring} />
      ) : null}
      <Icon name={icon} size={22} />
      <span>{label}</span>
    </Link>
  );
}
export function DesktopNavigation({ admin }: { admin: boolean }) {
  const path = usePathname();
  return (
    <nav className="desktop-nav" aria-label="Navegação principal">
      <p className="nav-group-label">Sua cidade</p>
      {destinations
        .filter((item) => item.href !== '/perfil')
        .map((item) => (
          <SidebarLink key={item.href} {...item} active={selected(path, item.href)} />
        ))}
      <div className="nav-secondary">
        <p className="nav-group-label">Seu espaço</p>
        {secondary.map((item) => (
          <SidebarLink key={item.href} {...item} active={selected(path, item.href)} />
        ))}
        {admin ? (
          <SidebarLink
            href="/admin"
            label="Administração"
            icon="shield"
            active={path === '/admin'}
          />
        ) : null}
      </div>
    </nav>
  );
}
export function MobileNavigation() {
  const path = usePathname();
  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      {destinations.map((item) => {
        const active = selected(path, item.href);
        return (
          <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined}>
            <span className="nav-icon">
              {active ? (
                <motion.span layoutId="dock-pill" className="dock-pill" transition={spring} />
              ) : null}
              <Icon name={item.icon} size={22} />
            </span>
            <span className="nav-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
