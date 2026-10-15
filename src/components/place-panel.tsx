'use client';
import { useEffect, useState } from 'react';
import { ActionForm } from './action-form';
import { resolve } from '@/server/actions';
import type { LocalPlace } from '@/lib/places';

async function obtain(
  requestId: string,
  placeId: string,
  signal?: AbortSignal,
): Promise<LocalPlace> {
  const response = await fetch(
    '/api/place-details?' + new URLSearchParams({ requestId, placeId }),
    { signal },
  );
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error('Não foi possível consultar o local. Tente novamente.');
  }
  if (!response.ok)
    throw new Error(body.error || 'Não foi possível consultar o local. Tente novamente.');
  if (!body?.displayName?.text || !body?.formattedAddress)
    throw new Error('Não foi possível consultar o local. Tente novamente.');
  return body as LocalPlace;
}

export function PlacePanel({
  requestId,
  placeId,
  autoLoad = false,
  confirmed = false,
  allowResolve = false,
  count,
}: {
  requestId: string;
  placeId: string;
  autoLoad?: boolean;
  confirmed?: boolean;
  allowResolve?: boolean;
  count?: number;
}) {
  const [place, setPlace] = useState<LocalPlace | null>(null);
  const [busy, setBusy] = useState(autoLoad);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!autoLoad) return;
    const controller = new AbortController();
    void obtain(requestId, placeId, controller.signal)
      .then(setPlace)
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error && !(e instanceof TypeError)
              ? e.message
              : 'Não foi possível consultar o local. Tente novamente.',
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [requestId, placeId, autoLoad]);
  async function load() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      setPlace(await obtain(requestId, placeId));
    } catch (e) {
      setError(
        e instanceof Error && !(e instanceof TypeError)
          ? e.message
          : 'Não foi possível consultar o local. Tente novamente.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="place-panel">
      <div className="group-heading">
        <div>
          {confirmed ? (
            <h2>
              {place
                ? `Encontrado em ${place.displayName.text}`
                : 'Encontrado em um estabelecimento indicado'}
            </h2>
          ) : (
            <h3>{place?.displayName.text || 'Local indicado'}</h3>
          )}
          {place ? <p className="muted">{place.formattedAddress}</p> : null}
        </div>
        {count !== undefined ? (
          <span className="convergence">
            {count} {count === 1 ? 'pessoa indicou' : 'pessoas indicaram'}
          </span>
        ) : null}
      </div>
      {busy ? (
        <p className="hint" role="status">
          Consultando estabelecimento…
        </p>
      ) : null}
      {error ? (
        <p className="notice error" role="alert">
          {error}
        </p>
      ) : null}
      {!place && !busy ? (
        <button type="button" className="button secondary" onClick={load}>
          {error ? 'Tentar consultar novamente' : 'Ver estabelecimento'}
        </button>
      ) : null}
      {allowResolve && place ? (
        <ActionForm
          action={resolve}
          label="Encontrei neste local"
          pendingLabel="Confirmando…"
          confirm={`Confirmar que encontrou em ${place.displayName.text}? Esta decisão é definitiva.`}
        >
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="type" value="INDICATED_PLACE" />
          <input type="hidden" name="placeId" value={placeId} />
          <p className="hint">
            Todas as pessoas elegíveis que indicaram este local recebem +10 pontos.
          </p>
        </ActionForm>
      ) : null}
    </div>
  );
}
