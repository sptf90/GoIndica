'use client';
import { useState, useRef, useEffect, useId } from 'react';
import { ActionForm } from './action-form';
import { indicate } from '@/server/actions';
interface Prediction {
  id: string;
  label: string;
  mainText?: string;
  secondaryText?: string;
  attributions?: { provider: string; providerUri?: string }[];
}
export function PlaceSearch({
  requestId,
  cityId,
  cityName,
}: {
  requestId: string;
  cityId: number;
  cityName: string;
}) {
  const [input, setInput] = useState('');
  const [results, setResults] = useState<Prediction[]>([]);
  const [selected, setSelected] = useState<Prediction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const listId = useId();
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const request = useRef<AbortController | null>(null);
  const sessionToken = useRef('');
  const selecting = useRef(false);
  const menuOpen = open && results.length > 0;
  useEffect(() => {
    if (menuOpen && active >= 0) {
      document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
    }
  }, [active, menuOpen, listId]);
  useEffect(() => {
    if (input.trim().length < 3 || selected || selecting.current) return;
    const controller = new AbortController();
    request.current = controller;
    const timer = setTimeout(async () => {
      if (controller.signal.aborted) return;
      if (!sessionToken.current) sessionToken.current = crypto.randomUUID();
      setSearching(true);
      try {
        const response = await fetch(
          '/api/places?' +
            new URLSearchParams({
              input,
              cityId: String(cityId),
              sessionToken: sessionToken.current,
            }),
          { signal: controller.signal },
        );
        const data = await response.json();
        if (!response.ok || !Array.isArray(data))
          throw new Error(data.error || 'Não foi possível buscar.');
        if (!controller.signal.aborted) {
          setResults(data);
          setOpen(document.activeElement?.id === 'place-search');
          setActive(-1);
          if (!data.length) setError('Nenhum estabelecimento encontrado. Tente outro nome.');
        }
      } catch (e) {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error && !(e instanceof TypeError) && !(e instanceof SyntaxError)
              ? e.message
              : 'Não foi possível buscar agora. Tente novamente.',
          );
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [input, cityId, selected]);
  async function choose(prediction: Prediction) {
    if (selecting.current) return;
    request.current?.abort();
    selecting.current = true;
    setSearching(false);
    setBusy(true);
    setOpen(false);
    setError('');
    try {
      const response = await fetch('/api/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googlePlaceId: prediction.id,
          cityId,
          sessionToken: sessionToken.current || crypto.randomUUID(),
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || 'Não foi possível selecionar este estabelecimento.');
      setSelected(data);
      setResults([]);
    } catch (e) {
      setError(
        e instanceof Error && !(e instanceof TypeError)
          ? e.message
          : 'Não foi possível selecionar o local. Tente novamente.',
      );
    } finally {
      sessionToken.current = '';
      selecting.current = false;
      setBusy(false);
    }
  }
  async function register(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    request.current?.abort();
    setSearching(false);
    setOpen(false);
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, address: newAddress, cityId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível cadastrar o local.');
      setSelected(data);
      setResults([]);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível cadastrar o local.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <p className="muted">
        Digite o nome de um estabelecimento em {cityName} e escolha uma das sugestões do Google
        Maps.
      </p>
      <div className="field">
        <label htmlFor="place-search">Nome do estabelecimento</label>
        <div className="place-autocomplete" data-open={menuOpen}>
          <div className="place-autocomplete-input">
            <svg
              className="place-search-icon"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
            <input
              id="place-search"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={menuOpen}
              aria-controls={listId}
              aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
              aria-describedby={`${listId}-status`}
              autoComplete="off"
              value={input}
              maxLength={120}
              disabled={busy}
              placeholder="Digite o nome do lugar"
              onFocus={() => {
                if (results.length) setOpen(true);
              }}
              onBlur={() => setOpen(false)}
              onChange={(e) => {
                request.current?.abort();
                setInput(e.target.value);
                setSelected(null);
                setResults([]);
                setOpen(false);
                setActive(-1);
                setError('');
                setSearching(false);
              }}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return;
                if (e.key === 'Escape') {
                  setOpen(false);
                  setActive(-1);
                }
                if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && results.length) {
                  e.preventDefault();
                  setOpen(true);
                  setActive((previous) =>
                    e.key === 'ArrowDown'
                      ? (previous + 1) % results.length
                      : previous <= 0
                        ? results.length - 1
                        : previous - 1,
                  );
                }
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (open && active >= 0 && results[active]) void choose(results[active]);
                }
              }}
            />

            <svg
              className="place-search-chevron"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <path d="m7 10 5 5 5-5" />
            </svg>
          </div>
          <div className="place-suggestions-menu" hidden={!menuOpen}>
            <div className="place-suggestions-heading" aria-hidden="true">
              Estabelecimentos sugeridos
            </div>
            <ul
              id={listId}
              className="place-suggestions"
              role="listbox"
              aria-label="Estabelecimentos sugeridos"
            >
              {menuOpen
                ? results.map((p, index) => (
                    <li key={p.id} role="presentation">
                      <button
                        id={`${listId}-${index}`}
                        type="button"
                        role="option"
                        aria-label={p.label}
                        aria-selected={active === index}
                        tabIndex={-1}
                        data-place-id={p.id}
                        onMouseDown={(event) => event.preventDefault()}
                        onPointerMove={() => setActive(index)}
                        onClick={() => void choose(p)}
                      >
                        <span className="place-option-pin" aria-hidden="true">
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                          >
                            <path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z" />
                            <circle cx="12" cy="10" r="2.5" />
                          </svg>
                        </span>
                        <span className="place-option-text">
                          <strong>{p.mainText || p.label}</strong>
                          {p.secondaryText ? <span>{p.secondaryText}</span> : null}
                        </span>
                        <svg
                          className="place-option-arrow"
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          aria-hidden="true"
                        >
                          <path d="M5 12h14m-5-5 5 5-5 5" />
                        </svg>
                      </button>
                    </li>
                  ))
                : null}
            </ul>
            <div className="place-suggestions-footer">
              <span>Escolha um local</span>
              <GoogleAttribution />
            </div>
          </div>
        </div>
      </div>
      <p id={`${listId}-status`} className="hint place-search-status" role="status">
        <span className={menuOpen ? 'sr-only' : undefined}>
          {busy
            ? 'Validando estabelecimento…'
            : searching
              ? 'Buscando no Google Maps…'
              : results.length && open
                ? `${results.length} sugestões. Use as setas e Enter para selecionar.`
                : !selected
                  ? 'Digite pelo menos 3 caracteres para ver sugestões.'
                  : 'Estabelecimento selecionado.'}
        </span>
      </p>
      {error ? (
        <p className="notice error" role="alert">
          {error}
        </p>
      ) : null}
      <details className="place-registration">
        <summary>Não encontrou? Cadastrar estabelecimento</summary>
        <form onSubmit={register}>
          <label className="field">
            Nome do novo estabelecimento
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              minLength={2}
              maxLength={160}
              required
            />
          </label>
          <label className="field">
            Endereço em {cityName}
            <input
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              minLength={5}
              maxLength={300}
              required
              placeholder="Rua, número e bairro"
            />
          </label>
          <p className="hint">
            Informe um endereço nesta cidade. Os dados são fornecidos pela comunidade.
          </p>
          <button className="button secondary" disabled={busy}>
            {busy ? 'Cadastrando…' : 'Cadastrar e selecionar'}
          </button>
        </form>
      </details>
      {selected ? (
        <div className="selected-place">
          <p className="eyebrow">Local selecionado</p>
          <strong>{selected.label}</strong>
          {selected.attributions ? <GoogleAttribution /> : null}
          <ProviderAttributions attributions={selected.attributions} />
          <ActionForm action={indicate} label="Confirmar indicação" pendingLabel="Enviando…">
            <input type="hidden" name="requestId" value={requestId} />
            <input type="hidden" name="placeId" value={selected.id} />
            <div className="field">
              <label htmlFor="comment">
                Como você sabe? <span className="muted">(opcional)</span>
              </label>
              <textarea
                id="comment"
                name="comment"
                maxLength={300}
                rows={3}
                placeholder="Por exemplo: comprei lá na semana passada."
              />
            </div>
            <p className="hint">
              Você pode indicar uma vez neste pedido. O local não poderá ser trocado após o envio.
            </p>
          </ActionForm>
        </div>
      ) : null}
    </div>
  );
}

function GoogleAttribution() {
  return (
    <p className="google-maps-attribution" translate="no">
      Google Maps
    </p>
  );
}
function ProviderAttributions({ attributions }: Pick<Prediction, 'attributions'>) {
  return attributions?.map((attribution, index) => (
    <p className="hint" key={index}>
      {attribution.providerUri?.startsWith('https://') ? (
        <a href={attribution.providerUri} target="_blank" rel="noreferrer">
          {attribution.provider}
        </a>
      ) : (
        attribution.provider
      )}
    </p>
  ));
}
