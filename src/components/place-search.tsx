'use client';
import { useState, useRef, useEffect } from 'react';
import { ActionForm } from './action-form';
import { indicate } from '@/server/actions';
interface Prediction {
  id: string;
  label: string;
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
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function search() {
    if (busy || input.trim().length < 3) return;
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    setBusy(true);
    setError('');
    setResults([]);
    try {
      const response = await fetch(
        '/api/places?' + new URLSearchParams({ input, cityId: String(cityId) }),
        { signal: controller.signal },
      );
      const data = (await response.json()) as Prediction[] | { error: string };
      if (!response.ok || !Array.isArray(data))
        throw new Error(!Array.isArray(data) ? data.error : 'Não foi possível buscar.');
      if (!controller.signal.aborted) {
        setResults(data);
        if (!data.length) setError('Nenhum estabelecimento encontrado. Tente outro nome.');
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(
          e instanceof Error && !(e instanceof TypeError) && !(e instanceof SyntaxError)
            ? e.message
            : 'Não foi possível buscar agora. Tente novamente.',
        );
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  async function register(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
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
        Indique um estabelecimento em {cityName} que você conhece. Escolha um local do cadastro da
        cidade ou adicione um estabelecimento.
      </p>
      <div className="field">
        <label htmlFor="place-search">Nome do estabelecimento</label>
        <div className="input-with-button">
          <input
            id="place-search"
            value={input}
            maxLength={120}
            placeholder="Busque pelo nome do lugar"
            onChange={(e) => {
              request.current?.abort();
              setInput(e.target.value);
              setSelected(null);
              setResults([]);
              setError('');
              setBusy(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void search();
              }
            }}
          />
          <button
            className="button secondary"
            type="button"
            disabled={busy || input.trim().length < 3}
            onClick={search}
          >
            {busy ? 'Buscando…' : 'Buscar'}
          </button>
        </div>
      </div>
      {error ? (
        <p className="notice error" role="alert">
          {error}
        </p>
      ) : null}
      {results.length ? (
        <ul className="search-results">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                data-place-id={p.id}
                onClick={() => {
                  setSelected(p);
                  setResults([]);
                }}
              >
                {p.label}
                <span>Selecionar</span>
              </button>
            </li>
          ))}
        </ul>
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
