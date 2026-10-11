'use client';
import { useState } from 'react';

export function RequestPhoto({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return (
    <figure className="request-photo">
      {failed ? (
        <div className="notice">
          <p>Não foi possível carregar a foto.</p>
          <button
            type="button"
            className="text-link"
            onClick={() => {
              setAttempt((a) => a + 1);
              setFailed(false);
            }}
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <img
          src={url + '&attempt=' + attempt}
          width={1200}
          height={900}
          alt="Foto do item procurado neste pedido"
          onError={() => setFailed(true)}
        />
      )}
      <figcaption className="hint">
        Foto enviada pelo autor para identificar o que procura.
      </figcaption>
    </figure>
  );
}
