'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type ComparisonItem = { id: string; created_at: string };

/** Polling da comparação a cada 5s com aba visível (R-04 / R-20). */
export function ComparisonLive({
  requestId,
  enabled,
}: {
  requestId: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const sinceRef = useRef<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        timer = setTimeout(tick, 15000);
        return;
      }
      try {
        const params = new URLSearchParams({ id: requestId });
        if (sinceRef.current) params.set('since', sinceRef.current);
        const response = await fetch('/api/comparison?' + params, { cache: 'no-store' });
        if (!response.ok) throw new Error('poll');
        const data = (await response.json()) as { items?: ComparisonItem[] };
        setError(false);
        const items = data.items || [];
        if (items.length) {
          const last = items[items.length - 1];
          const previous = sinceRef.current;
          sinceRef.current = last.created_at;
          if (previous) router.refresh();
          else sinceRef.current = last.created_at;
        }
      } catch {
        if (!cancelled) setError(true);
      }
      if (!cancelled) timer = setTimeout(tick, 5000);
    }

    function onFocus() {
      void tick();
    }
    document.addEventListener('visibilitychange', onFocus);
    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [enabled, requestId, router]);

  if (!enabled) return null;
  return (
    <p className="hint" aria-live="polite">
      {error
        ? 'Atualização automática temporariamente indisponível. Tentando novamente…'
        : 'Comparação atualiza automaticamente enquanto esta página estiver aberta.'}
    </p>
  );
}
