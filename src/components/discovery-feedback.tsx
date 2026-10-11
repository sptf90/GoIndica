'use client';
import { useState } from 'react';
import { searchEvent } from '@/lib/analytics-client';
export function DiscoveryFeedback({ requestId, cityId }: { requestId: string; cityId: number }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  return (
    <div className="discovery-feedback">
      <button
        type="button"
        className="button secondary"
        disabled={state === 'busy' || state === 'done'}
        onClick={async () => {
          setState('busy');
          setState((await searchEvent('USEFUL', cityId, requestId)) ? 'done' : 'error');
        }}
      >
        {state === 'done'
          ? 'Obrigado por registrar!'
          : state === 'busy'
            ? 'Registrando…'
            : 'Este resultado me ajudou'}
      </button>
      {state === 'error' ? (
        <p className="hint" role="alert">
          Não foi possível registrar. Tente novamente.
        </p>
      ) : null}
    </div>
  );
}
