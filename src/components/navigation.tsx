'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { Icon } from './icon';
const destinations = [
  { href: '/app', label: 'Início' },
  { href: '/atividades', label: 'Minhas atividades' },
  { href: '/ranking', label: 'Ranking' },
  { href: '/perfil', label: 'Perfil' },
  { href: '/salvos', label: 'Pedidos salvos' },
  { href: '/notificacoes', label: 'Notificações' },
  { href: '/preferencias', label: 'Preferências' },
];
export function DesktopNavigation({ admin }: { admin: boolean }) {
  const path = usePathname();
  const items = destinations.filter((item) =>
    ['/app', '/atividades', '/ranking'].includes(item.href),
  );
  if (admin) items.push({ href: '/admin', label: 'Administração' });
  return (
    <nav className="desktop-nav" aria-label="Navegação principal">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={
            path === item.href || (item.href === '/app' && path.startsWith('/pedidos'))
              ? 'page'
              : undefined
          }
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
export function MobileNavigation({ admin }: { admin: boolean }) {
  const path = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const element = menu.current;
    function focusOutside(event: FocusEvent) {
      if (element && event.relatedTarget instanceof Node && !element.contains(event.relatedTarget))
        element.open = false;
    }
    function resize() {
      if (element && window.innerWidth >= 768) element.open = false;
    }
    function closeOutside(event: PointerEvent) {
      if (
        menu.current?.open &&
        event.target instanceof Node &&
        !menu.current.contains(event.target)
      ) {
        menu.current.open = false;
      }
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape' && menu.current?.open) {
        menu.current.open = false;
        menu.current.querySelector('summary')?.focus();
      }
    }
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', escape);
    element?.addEventListener('focusout', focusOutside);
    window.addEventListener('resize', resize);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', escape);
      element?.removeEventListener('focusout', focusOutside);
      window.removeEventListener('resize', resize);
    };
  }, []);
  const items = admin
    ? [...destinations, { href: '/admin', label: 'Administração' }]
    : destinations;
  return (
    <details className="mobile-menu" ref={menu}>
      <summary aria-label="Menu de navegação">
        <span className="menu-open-icon">
          <Icon name="menu" />
        </span>
        <span className="menu-close-icon">
          <Icon name="close" />
        </span>
      </summary>
      <nav className="mobile-nav" aria-label="Navegação principal">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => {
              if (menu.current) menu.current.open = false;
            }}
            aria-current={
              path === item.href || (item.href === '/app' && path.startsWith('/pedidos'))
                ? 'page'
                : undefined
            }
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </details>
  );
}
