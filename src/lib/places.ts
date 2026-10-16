import 'server-only';
import { randomUUID } from 'node:crypto';
import { pool, rows, transaction } from './database/pool';
import { rate } from './database/rate';
import { normalizeCity } from './validation/schemas';
import {
  placeDetails as googleDetails,
  validatePlaceCity as validateGoogleCity,
} from './google-places';
import type { City } from './types';
export interface LocalPlace {
  id: string;
  displayName: { text: string };
  formattedAddress: string;
  cityId: number;
  googleMapsUri?: string;
  attributions?: { provider: string; providerUri?: string }[];
}
export async function placeDetails(id: string): Promise<LocalPlace> {
  const [place] = await rows<{
    id: string;
    name: string;
    address: string;
    city_id: number;
    google_place_id: string | null;
  }>(
    pool(),
    'SELECT id,name,address,city_id,google_place_id FROM places WHERE id=? AND hidden_at IS NULL',
    [id],
  );
  if (!place) throw new Error('INVALID_PLACE');
  if (place.google_place_id) {
    const details = await googleDetails(place.google_place_id);
    const [city] = await rows<City>(pool(), 'SELECT * FROM cities WHERE id=?', [place.city_id]);
    if (!city) throw new Error('INVALID_CITY');
    validateGoogleCity(details, city);
    return {
      ...details,
      googleMapsUri:
        details.googleMapsUri ||
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(details.displayName.text)}&query_place_id=${encodeURIComponent(place.google_place_id)}`,
      id: place.id,
      cityId: place.city_id,
    };
  }
  return {
    id: place.id,
    displayName: { text: place.name },
    formattedAddress: place.address,
    cityId: place.city_id,
  };
}
export function validatePlaceCity(place: LocalPlace, city: Pick<City, 'id'>) {
  if (place.cityId !== city.id) throw new Error('INVALID_CITY');
}
export async function registerPlace(actor: string, cityId: number, name: string, address: string) {
  return transaction(async (db) => {
    const [account] = await rows<{ blocked: boolean }>(
      db,
      'SELECT blocked FROM accounts WHERE id=? FOR UPDATE',
      [actor],
    );
    if (!account || account.blocked) throw new Error('ACCOUNT_BLOCKED');
    if (!(await rows(db, 'SELECT id FROM profiles WHERE id=?', [actor])).length)
      throw new Error('ONBOARDING_REQUIRED');
    await rate(db, actor, 'places_create', 10, 3600);
    const normal = normalizeCity(name);
    const [existing] = await rows<{ id: string }>(
      db,
      'SELECT id FROM places WHERE city_id=? AND normalized_name=? AND address=? AND hidden_at IS NULL',
      [cityId, normal, address],
    );
    if (existing) return existing.id;
    const id = randomUUID();
    await db.execute(
      'INSERT INTO places(id,city_id,name,address,normalized_name,created_by) VALUES(?,?,?,?,?,?)',
      [id, cityId, name, address, normal, actor],
    );
    return id;
  });
}

export async function selectGooglePlace(
  actor: string,
  city: City,
  googleId: string,
  sessionToken: string,
) {
  const details = await googleDetails(googleId, sessionToken);
  if (details.id !== googleId) throw new Error('INVALID_PLACE');
  validateGoogleCity(details, city);
  const id = await transaction(async (db) => {
    const [account] = await rows<{ blocked: boolean }>(
      db,
      'SELECT blocked FROM accounts WHERE id=? FOR UPDATE',
      [actor],
    );
    if (!account || account.blocked) throw new Error('ACCOUNT_BLOCKED');
    const [existing] = await rows<{ id: string; hidden_at: string | null }>(
      db,
      'SELECT id,hidden_at FROM places WHERE google_place_id=?',
      [googleId],
    );
    if (existing) {
      if (existing.hidden_at) throw new Error('INVALID_PLACE');
      return existing.id;
    }
    const id = randomUUID();
    // Placeholder values satisfy the existing local catalog schema without storing Google content.
    // The unique address marker prevents different Google places from collapsing into one local row.
    await db.execute(
      `INSERT INTO places(id,city_id,name,address,normalized_name,created_by,google_place_id)
       VALUES(?,?,'Estabelecimento Google Maps',?,'google maps',?,?)
       ON DUPLICATE KEY UPDATE google_place_id=VALUES(google_place_id)`,
      [id, city.id, 'Referência: ' + googleId, actor, googleId],
    );
    const [saved] = await rows<{ id: string; hidden_at: string | null }>(
      db,
      'SELECT id,hidden_at FROM places WHERE google_place_id=?',
      [googleId],
    );
    if (!saved || saved.hidden_at) throw new Error('INVALID_PLACE');
    return saved.id;
  });
  return {
    id,
    label: details.displayName.text + ', ' + details.formattedAddress,
    attributions: details.attributions,
  };
}
