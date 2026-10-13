import Link from 'next/link';
import { Icon } from './icon';
export function ProfileMenu({
  pending,
  username,
  admin,
}: {
  pending: number;
  username: string;
  admin: boolean;
}) {
  const items = [
    {
      href: '/atividades?tab=decision',
      label: 'Pedidos aguardando decisão',
      icon: 'activity',
      detail: String(pending),
    },
    { href: '/salvos', label: 'Pedidos salvos', icon: 'bookmark' },
    { href: '/notificacoes', label: 'Notificações', icon: 'bell' },
    { href: '/preferencias', label: 'Preferências', icon: 'settings' },
    { href: '/conta', label: 'Conta e dados', icon: 'shield' },
    { href: '/perfil/' + username, label: 'Ver perfil público', icon: 'person' },
    { href: '/atividades?tab=confirmed', label: 'Histórico de pontos', icon: 'award' },
    ...(admin ? [{ href: '/admin', label: 'Administração', icon: 'shield' } as const] : []),
  ] as const;
  return (
    <nav className="profile-menu" aria-label="Seu perfil e configurações">
      {items.map((item) => (
        <Link key={item.href} href={item.href}>
          <Icon name={item.icon} size={20} />
          <span>{item.label}</span>
          {'detail' in item ? <span className="menu-count">{item.detail}</span> : null}
          <Icon name="back" size={16} />
        </Link>
      ))}
    </nav>
  );
}
