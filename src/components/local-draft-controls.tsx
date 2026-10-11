'use client';
import { useState } from 'react';
export function LocalDraftControls({ userId }: { userId: string }) {
  const [message, setMessage] = useState('');
  return (
    <div>
      <p className="hint">
        Se houver um rascunho neste navegador, você pode apagar antes de encerrar a conta.
      </p>
      <button
        type="button"
        className="button secondary"
        onClick={() => {
          try {
            localStorage.removeItem('goindica:request:v1:' + userId);
            setMessage('Rascunho deste dispositivo apagado.');
          } catch {
            setMessage('Não foi possível acessar o armazenamento deste navegador.');
          }
        }}
      >
        Apagar meu rascunho neste dispositivo
      </button>
      {message ? (
        <p className="hint" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
