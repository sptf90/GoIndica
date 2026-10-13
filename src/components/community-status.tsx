'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MemberSummary, RequestStatus } from '@/lib/types';
import { Icon } from './icon';
export function CommunityStatus({ initial }: { initial: MemberSummary }) {
  const [summary, setSummary] = useState(initial);
  useEffect(() => {
    let canceled = false,
      busy = false;
    const controller = new AbortController();
    async function update() {
      if (document.hidden || busy) return;
      busy = true;
      try {
        const response = await fetch('/api/summary', { signal: controller.signal });
        if (response.ok && !canceled) setSummary(await response.json());
      } catch {
        /* Optional refresh must preserve the current page. */
      } finally {
        busy = false;
      }
    }
    const timer = setInterval(() => void update(), 60000);
    const focus = () => void update();
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', focus);
    return () => {
      canceled = true;
      controller.abort();
      clearInterval(timer);
      window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', focus);
    };
  }, []);
  return (
    <Link
      href="/notificacoes"
      className="notification-link"
      aria-label={`Notificações ${summary.unread > 99 ? '99+' : summary.unread} não lidas. ${summary.pending} pedidos aguardando decisão.`}
    >
      <Icon name="bell" size={18} />
      <span className="notification-label">Notificações</span>{' '}
      {summary.unread ? (
        <span className="notification-count">{summary.unread > 99 ? '99+' : summary.unread}</span>
      ) : null}
    </Link>
  );
}
export function LiveRequest({
  id,
  count,
  status,
}: {
  id: string;
  count: number;
  status: RequestStatus;
}) {
  const router = useRouter();
  useEffect(() => {
    if (status !== 'OPEN') return;
    let busy = false;
    const controller = new AbortController();
    async function update() {
      if (document.hidden || busy) return;
      busy = true;
      try {
        const response = await fetch('/api/request-status?id=' + id, { signal: controller.signal });
        if (response.ok) {
          const data = await response.json();
          if (data.status !== status || data.indication_count !== count) router.refresh();
        }
      } catch {
        /* Optional refresh must preserve the current page. */
      } finally {
        busy = false;
      }
    }
    const timer = setInterval(() => void update(), 30000);
    const focus = () => void update();
    window.addEventListener('focus', focus);
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener('focus', focus);
    };
  }, [id, count, status, router]);
  return null;
}
