'use client';
export async function sendEvent(event: 'LANDING_VISIT' | 'CTA_CLICK' | 'SEARCH_REUSED') {
  try {
    return (
      await fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event }),
        keepalive: true,
      })
    ).ok;
  } catch {
    return false;
  }
}
export async function searchEvent(kind: 'CLICKED' | 'USEFUL', cityId: number, requestId: string) {
  try {
    return (
      await fetch('/api/search-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, cityId, requestId }),
        keepalive: true,
      })
    ).ok;
  } catch {
    return false;
  }
}
