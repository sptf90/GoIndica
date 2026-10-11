import type { GooglePlace } from './google/places';
export function safeMapsUrl(place: GooglePlace) {
  if (place.googleMapsUri) {
    const url = new URL(place.googleMapsUri);
    if (
      url.protocol === 'https:' &&
      (url.hostname === 'maps.google.com' ||
        (url.hostname === 'www.google.com' && /^\/maps(?:\/|$)/.test(url.pathname)) ||
        url.hostname === 'maps.app.goo.gl')
    )
      return url.toString();
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.displayName.text)}&query_place_id=${encodeURIComponent(place.id)}`;
}
