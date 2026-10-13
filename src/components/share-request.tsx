'use client';
import { useState } from 'react';
import { Icon } from './icon';

export function ShareRequest({
  description,
  compact = false,
}: {
  description: string;
  compact?: boolean;
}) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  async function share() {
    if (busy) return;
    setBusy(true);
    setMessage('');
    setManualUrl('');
    const url = window.location.origin + window.location.pathname;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Pedido da comunidade · GoIndica',
          text: description,
          url,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setMessage('Link copiado. Compartilhe com quem conhece a cidade.');
      } else {
        setManualUrl(url);
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setManualUrl(url);
        setMessage('Copie o link abaixo para compartilhar.');
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={`share-request${compact ? ' share-compact' : ''}`}>
      <button
        type="button"
        className={`button secondary${compact ? ' icon-button' : ''}`}
        onClick={share}
        disabled={busy}
        aria-label={compact ? 'Compartilhar pedido' : undefined}
      >
        <Icon name="share" size={19} />
        {compact ? null : 'Compartilhar com a comunidade'}
      </button>
      {message && !manualUrl ? (
        <p className="hint" role="status">
          {message}
        </p>
      ) : null}
      {manualUrl ? (
        <label className="field">
          <span>Link do pedido</span>
          <input value={manualUrl} readOnly onFocus={(event) => event.currentTarget.select()} />
        </label>
      ) : null}
    </div>
  );
}
