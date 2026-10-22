'use client';
import { useId, useState } from 'react';
import type { City } from '@/lib/types';
import { CitySelector } from './city-selector';
import { Icon } from './icon';

export function FeedSearch({ city, query, status }: { city: City; query: string; status: string }) {
  const [selected, setSelected] = useState<City | null>(city);
  const [text, setText] = useState(query);
  const formId = useId();
  return (
    <div className="feed-tools">
      <form id={formId} className="feed-search" action="/app">
        <div className="search-bar">
          <label className="sr-only" htmlFor="query">
            Buscar pedidos
          </label>
          <Icon name="search" size={20} />
          <input
            id="query"
            name="q"
            type="search"
            enterKeyHint="search"
            placeholder="O que você precisa encontrar?"
            defaultValue={query}
            onChange={(event) => setText(event.target.value)}
            maxLength={300}
          />
          <button className="search-submit" aria-label="Buscar na cidade">
            <Icon name="arrow" />
          </button>
        </div>
        <details className="city-disclosure">
          <summary>
            <Icon name="pin" size={16} />
            <span>
              {selected ? `${selected.name} — ${selected.state_code}` : 'Escolha a cidade'}
            </span>
            <Icon name="chevron" size={16} />
          </summary>
          <div className="city-disclosure-content">
            <CitySelector initial={city} name="city" onChange={setSelected} />
            <button className="button secondary">Buscar na cidade</button>
          </div>
        </details>
        <input type="hidden" name="status" value={status} />
      </form>
      <button type="submit" form={formId} formAction="/pedidos/novo" className="button feed-create">
        <Icon name="plus" size={20} />
        {text.trim() ? 'Publicar esta busca' : 'Novo pedido'}
      </button>
    </div>
  );
}
