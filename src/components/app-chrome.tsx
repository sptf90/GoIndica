'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';
import { Brand } from './ui';
import { Icon } from './icon';
import { DesktopNavigation, MobileNavigation } from './navigation';

function contextFor(path: string) {
  if (path === '/pedidos/novo') return { title: 'Perguntar à cidade', back: '/app', focused: true };
  if (/\/pedidos\/[^/]+\/(editar|indicar)$/.test(path))
    return {
      title: path.endsWith('/editar') ? 'Editar pedido' : 'Ajudar alguém',
      back: path.replace(/\/(editar|indicar)$/, ''),
      focused: true,
    };
  if (path.startsWith('/pedidos/')) return { title: 'Pedido da comunidade', back: '/app' };
  if (path === '/preferencias' || path === '/conta')
    return {
      title: path === '/conta' ? 'Conta e dados' : 'Preferências',
      back: '/perfil',
      focused: true,
    };
  if (path.startsWith('/perfil/')) return { title: 'Perfil da comunidade', back: '/ranking' };
  if (path === '/salvos') return { title: 'Sua lista', back: '/perfil' };
  if (path === '/notificacoes') return { title: 'Novidades', back: '/app' };
  if (path === '/admin') return { title: 'Administração', back: '/perfil' };
  return null;
}
export function AppChrome({
  children,
  admin,
  account,
  notifications,
}: {
  children: ReactNode;
  admin: boolean;
  account: ReactNode;
  notifications: ReactNode;
}) {
  const path = usePathname();
  const context = contextFor(path);
  const shell = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    // Keyboard visibility is derived from the visual viewport, never user-agent sniffing.
    // Pinch zoom is not treated as a keyboard; navigation remains available when zoomed.
    const update = () => {
      const editing = document.activeElement?.matches('input, textarea, select');
      const keyboard =
        editing && viewport.scale === 1 && window.innerHeight - viewport.height > 150;
      shell.current?.toggleAttribute('data-keyboard', Boolean(keyboard));
    };
    viewport.addEventListener('resize', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    return () => {
      viewport.removeEventListener('resize', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
    };
  }, []);
  return (
    <div ref={shell} className={`app-shell${context?.focused ? ' focused-shell' : ''}`}>
      <aside className="app-sidebar">
        <Brand href="/app" />
        <DesktopNavigation admin={admin} />
        <Link href="/pedidos/novo" className="button sidebar-create" title="Novo pedido">
          <Icon name="plus" />
          <span>Novo pedido</span>
        </Link>
        <div className="sidebar-account">{account}</div>
        <p className="sidebar-note">
          O conhecimento da cidade,
          <br />
          compartilhado.
        </p>
      </aside>
      <header className="app-header">
        <div className="wrap">
          {context ? (
            <div className="contextual-heading">
              <Link href={context.back} className="icon-button" aria-label="Voltar">
                <Icon name="back" size={24} />
              </Link>
              <span>{context.title}</span>
            </div>
          ) : (
            <div className="main-brand">
              <Brand href="/app" />
              <span className="desktop-context">Conhecimento de quem vive aqui</span>
            </div>
          )}
          <div className="header-account">{notifications}</div>
        </div>
      </header>
      <main id="conteudo" className="app-main wrap" tabIndex={-1}>
        <div className="app-content">{children}</div>
      </main>
      {!context?.focused ? <MobileNavigation /> : null}
    </div>
  );
}
