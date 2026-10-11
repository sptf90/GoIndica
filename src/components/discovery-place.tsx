'use client';
import { useState } from 'react';
import { PlacePanel } from './place-panel';
export function DiscoveryPlace({ requestId, placeId }: { requestId: string; placeId: string }) {
  const [visited, setVisited] = useState(false);
  return (
    <details
      className="discovery-place"
      onToggle={(event) => {
        if (event.currentTarget.open) setVisited(true);
      }}
    >
      <summary>Ver local confirmado</summary>
      {visited ? <PlacePanel requestId={requestId} placeId={placeId} autoLoad /> : null}
    </details>
  );
}
