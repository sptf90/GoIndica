'use client';
import { useState, useId, useEffect, useLayoutEffect, useRef, type KeyboardEvent } from 'react';
import type { City } from '@/lib/types';

export function CitySelector({
  initial,
  onChange,
  name = 'cityId',
  required = true,
}: {
  initial?: City | null;
  onChange?: (city: City | null) => void;
  name?: string;
  required?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const request = useRef<AbortController | null>(null);
  const [selected, setSelected] = useState<City | null>(initial || null);
  const [query, setQuery] = useState(initial ? `${initial.name} — ${initial.state_code}` : '');
  const [results, setResults] = useState<City[]>([]);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [retry, setRetry] = useState(0);
  const expanded = open && results.length > 0;

  useLayoutEffect(() => {
    if (!expanded) return;
    function position() {
      if (!input.current || !list.current) return;
      const rect = input.current.getBoundingClientRect();
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop || 0;
      const viewportBottom = viewportTop + (viewport?.height || window.innerHeight);
      const header = document.querySelector('.app-header')?.getBoundingClientRect();
      const navigation = document.querySelector('.bottom-nav');
      const navBounds =
        navigation && getComputedStyle(navigation).visibility !== 'hidden'
          ? navigation.getBoundingClientRect()
          : null;
      const top = Math.max(viewportTop, header?.bottom || viewportTop);
      const bottom = Math.min(viewportBottom, navBounds?.top || viewportBottom);
      const below = bottom - rect.bottom - 12;
      const above = rect.top - top - 12;
      const upwards = below < 160 && above > below;
      list.current.style.maxHeight = `${Math.max(48, Math.min(300, upwards ? above : below))}px`;
      list.current.style.top = upwards ? 'auto' : 'calc(100% + 6px)';
      list.current.style.bottom = upwards ? 'calc(100% + 6px)' : 'auto';
    }
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    window.visualViewport?.addEventListener('resize', position);
    window.visualViewport?.addEventListener('scroll', position);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      window.visualViewport?.removeEventListener('resize', position);
      window.visualViewport?.removeEventListener('scroll', position);
    };
  }, [expanded]);

  useEffect(() => {
    if (selected || query.trim().length < 2) return;
    const controller = new AbortController();
    request.current = controller;
    const timer = setTimeout(async () => {
      setBusy(true);
      setError('');
      try {
        const response = await fetch('/api/cities?q=' + encodeURIComponent(query.trim()), {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error();
        const cities = (await response.json()) as City[];
        if (!Array.isArray(cities)) throw new Error();
        if (!controller.signal.aborted) {
          setResults(cities);
          setSearched(true);
        }
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
          setError('Não foi possível carregar as cidades. Tente novamente.');
        }
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, selected, retry]);

  useEffect(() => {
    if (active >= 0 && expanded) {
      document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: 'nearest' });
    }
  }, [active, expanded, id]);

  function choose(city: City) {
    request.current?.abort();
    setSelected(city);
    setQuery(`${city.name} — ${city.state_code}`);
    setResults([]);
    setError('');
    setBusy(false);
    setSearched(false);
    setOpen(false);
    setActive(-1);
    input.current?.setCustomValidity('');
    onChange?.(city);
    input.current?.focus({ preventScroll: true });
  }

  function navigate(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape') {
      if (expanded) event.preventDefault();
      setOpen(false);
      setActive(-1);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!results.length) return;
      event.preventDefault();
      setOpen(true);
      setActive((current) =>
        event.key === 'ArrowDown'
          ? (current + 1) % results.length
          : (current <= 0 ? results.length : current) - 1,
      );
    } else if (event.key === 'Enter' && !selected) {
      event.preventDefault();
      if (expanded && active >= 0) choose(results[active]);
      else {
        setOpen(true);
        input.current?.reportValidity();
      }
    } else if (event.key === 'Tab') {
      setOpen(false);
      setActive(-1);
    }
  }

  const hint = selected
    ? `${selected.name} — ${selected.state_code}, Brasil`
    : busy
      ? 'Buscando cidades…'
      : searched && !results.length
        ? 'Nenhuma cidade encontrada. Confira o nome ou inclua a UF.'
        : results.length
          ? `${results.length} sugestões. Selecione a cidade e confira a UF.`
          : 'Digite pelo menos 2 letras e selecione uma cidade do Brasil.';

  return (
    <div
      className="field city-selector"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
          setActive(-1);
        }
      }}
    >
      <label htmlFor={id}>Cidade</label>
      <input type="hidden" name={name} value={selected?.id || ''} />
      <div className="city-input">
        <input
          ref={input}
          id={id}
          value={query}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={expanded ? `${id}-list` : undefined}
          aria-activedescendant={expanded && active >= 0 ? `${id}-option-${active}` : undefined}
          aria-describedby={`${id}-hint`}
          aria-invalid={Boolean(error)}
          placeholder="Ex.: São José do Rio Preto…"
          autoComplete="off"
          autoCapitalize="words"
          spellCheck={false}
          maxLength={60}
          required={required}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            request.current?.abort();
            event.currentTarget.setCustomValidity(
              event.target.value ? 'Selecione uma cidade nas sugestões.' : '',
            );
            setQuery(event.target.value);
            setSelected(null);
            onChange?.(null);
            setResults([]);
            setError('');
            setBusy(false);
            setSearched(false);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={navigate}
        />
        {busy ? <span className="city-loading" aria-hidden="true" /> : null}
        {expanded ? (
          <ul
            ref={list}
            className="city-options"
            id={`${id}-list`}
            role="listbox"
            aria-label="Cidades encontradas"
          >
            {results.map((city, index) => (
              <li key={city.id} role="presentation">
                <button
                  id={`${id}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={active === index}
                  tabIndex={-1}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(city)}
                >
                  <span>{city.name}</span>
                  <span className="city-state">{city.state_code}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <span
        className={error ? 'hint field-error' : 'hint'}
        id={`${id}-hint`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {error || hint}
        {error ? (
          <button
            type="button"
            className="city-retry"
            onClick={() => {
              setOpen(true);
              setRetry((current) => current + 1);
            }}
          >
            Tentar novamente
          </button>
        ) : null}
      </span>
    </div>
  );
}
