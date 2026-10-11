'use client';
import { useState } from 'react';

export function ShareCard({ requestId }: { requestId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return (
    <div className="share-card-control">
      <button
        type="button"
        className="button secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMessage('');
          try {
            const response = await fetch('/api/share-card?id=' + requestId);
            if (!response.ok) {
              const failure = await response.json();
              throw new Error(failure.error || 'Não foi possível gerar o card. Tente novamente.');
            }
            const file = new File([await response.blob()], 'goindica-pedido.png', {
              type: 'image/png',
            });
            const url = URL.createObjectURL(file);
            const link = document.createElement('a');
            link.href = url;
            link.download = file.name;
            document.body.append(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 60000);
            setMessage('Card baixado. Compartilhe a imagem nos seus grupos ou stories.');
          } catch (error) {
            setMessage(
              error instanceof Error
                ? error.message
                : 'Não foi possível gerar o card. Tente novamente.',
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Gerando card…' : 'Baixar card para compartilhar'}
      </button>
      {message ? (
        <p className="hint" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
