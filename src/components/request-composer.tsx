'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { CitySelector } from './city-selector';
import { ActionForm } from './action-form';
import { createRequest, editRequest } from '@/server/actions';
import { sendEvent, searchEvent } from '@/lib/analytics-client';
import { parseDraft, type RequestDraft } from '@/lib/drafts';
import { RequestPhotoField } from './request-photo-field';
import type { City, LocalRequest, Resolution } from '@/lib/types';
export function RequestComposer({
  city,
  request,
  initialDescription = '',
  draftKey,
}: {
  city: City;
  request?: LocalRequest;
  initialDescription?: string;
  draftKey?: string;
}) {
  const published = useRef(false);
  const erased = useRef(false);
  const [selected, setSelected] = useState<City | null>(city);
  const [description, setDescription] = useState(request?.description || initialDescription);
  const [matches, setMatches] = useState<(LocalRequest & { resolution?: Resolution | null })[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [neighborhood, setNeighborhood] = useState(request?.neighborhood || '');
  const [savedDraft, setSavedDraft] = useState<RequestDraft | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  useEffect(() => {
    if (!draftKey) return;
    const timer = setTimeout(() => {
      try {
        const draft = parseDraft(localStorage.getItem(draftKey));
        if (draft && (draft.description || draft.neighborhood)) setSavedDraft(draft);
        else setDraftReady(true);
      } catch {
        setDraftReady(true);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [draftKey]);
  useEffect(() => {
    if (!draftKey || !draftReady || !selected || published.current) return;
    const persist = () => {
      try {
        if (published.current || erased.current) return;
        if (!description && !neighborhood) localStorage.removeItem(draftKey);
        else
          localStorage.setItem(
            draftKey,
            JSON.stringify({
              version: 1,
              description,
              neighborhood,
              city: selected,
              savedAt: Date.now(),
            }),
          );
      } catch {
        /* Storage is optional. */
      }
    };
    const timer = setTimeout(persist, 300);
    window.addEventListener('pagehide', persist);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pagehide', persist);
      persist();
    };
  }, [draftKey, draftReady, description, neighborhood, selected]);
  useEffect(() => {
    if (!selected || description.trim().length < 3) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError('');
      try {
        const response = await fetch(
          `/api/resolved?cityId=${selected.id}&q=${encodeURIComponent(description)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error();
        const matches = (await response.json()) as (LocalRequest & {
          resolution?: Resolution | null;
        })[];
        if (!controller.signal.aborted) setMatches(matches);
      } catch {
        if (!controller.signal.aborted) {
          setMatches([]);
          setSearchError('A busca no histórico está indisponível. Você ainda pode publicar.');
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 600);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [description, selected]);
  return (
    <ActionForm
      action={request ? editRequest : createRequest}
      label={request ? 'Salvar pedido' : 'Publicar pedido'}
      pendingLabel="Publicando…"
      className="composer"
      onSuccess={() => {
        published.current = true;
        if (draftKey) {
          try {
            localStorage.removeItem(draftKey);
          } catch {
            /* Storage is optional. */
          }
        }
      }}
    >
      {savedDraft ? (
        <aside className="draft-notice notice">
          <strong>Há um rascunho salvo neste dispositivo.</strong>
          <div className="inline-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setDescription(savedDraft.description);
                setNeighborhood(savedDraft.neighborhood);
                setSelected(savedDraft.city);
                setSavedDraft(null);
                setDraftReady(true);
              }}
            >
              Restaurar rascunho
            </button>
            <button
              type="button"
              className="text-link"
              onClick={() => {
                if (draftKey) {
                  try {
                    localStorage.removeItem(draftKey);
                  } catch {
                    /* Storage is optional. */
                  }
                }
                setSavedDraft(null);
                setDraftReady(true);
              }}
            >
              Apagar rascunho
            </button>
          </div>
        </aside>
      ) : null}
      {draftKey && draftReady && description ? (
        <button
          type="button"
          className="text-link draft-clear"
          onClick={() => {
            erased.current = true;
            setDescription('');
            setNeighborhood('');
            if (draftKey) {
              try {
                localStorage.removeItem(draftKey);
              } catch {
                /* Storage is optional. */
              }
            }
          }}
        >
          Apagar rascunho atual
        </button>
      ) : null}
      {request ? <input type="hidden" name="requestId" value={request.id} /> : null}
      <div className="field">
        <label htmlFor="description">O que você está procurando?</label>
        <textarea
          id="description"
          name="description"
          maxLength={300}
          minLength={3}
          rows={3}
          required
          value={description}
          placeholder="Uma peça de reposição, um ingrediente, um serviço…"
          onChange={(e) => {
            erased.current = false;
            setDescription(e.target.value);
            setMatches([]);
            setSearching(false);
            setSearchError('');
          }}
        />
        <span className="hint count">{description.length}/300</span>
      </div>
      <CitySelector
        key={savedDraft ? 'pending' : draftReady ? 'ready' : 'initial'}
        initial={selected}
        onChange={(c) => {
          setSelected(c);
          setMatches([]);
          setSearching(false);
          setSearchError('');
        }}
      />
      <div className="field">
        <label htmlFor="neighborhood">
          Bairro ou região <span className="muted">(opcional)</span>
        </label>
        <input
          id="neighborhood"
          name="neighborhood"
          maxLength={100}
          value={neighborhood}
          onChange={(event) => {
            erased.current = false;
            setNeighborhood(event.target.value);
          }}
        />
      </div>
      <RequestPhotoField
        existingUrl={
          request?.has_photo
            ? '/api/request-photo?id=' + request.id + '&v=' + request.photo_updated_at
            : undefined
        }
      />
      {searching ? (
        <p className="hint" role="status">
          Procurando descobertas anteriores…
        </p>
      ) : null}
      {searchError ? (
        <p className="hint" role="status">
          {searchError}
        </p>
      ) : null}
      {matches.length && selected && description.length >= 3 ? (
        <aside className="reuse">
          <strong>Talvez alguém já tenha procurado algo parecido.</strong>
          <ul>
            {matches.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/pedidos/${r.id}`}
                  target="_blank"
                  onClick={() => {
                    void sendEvent('SEARCH_REUSED');
                    void searchEvent('CLICKED', selected.id, r.id);
                  }}
                >
                  {r.description} ↗
                </Link>
                {r.resolution ? (
                  <p className="hint">
                    {r.resolution.type === 'INDICATED_PLACE'
                      ? 'Local confirmado pela comunidade'
                      : 'Encontrado em outro local'}{' '}
                    ·{' '}
                    {new Date(r.resolution.created_at).toLocaleDateString('pt-BR', {
                      timeZone: 'America/Sao_Paulo',
                    })}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="hint">
            São descobertas da comunidade. A disponibilidade pode ter mudado. Você pode publicar
            mesmo assim.
          </p>
        </aside>
      ) : null}
    </ActionForm>
  );
}
