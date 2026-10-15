import 'server-only';
import { randomUUID } from 'node:crypto';
import { pool, rows, transaction } from './database/pool';
import { rate } from './database/rate';
import { normalizeCity } from './validation/schemas';
import type { City } from './types';
export interface LocalPlace {
  id: string;
  displayName: { text: string };
  formattedAddress: string;
  cityId: number;
}
export async function autocomplete(input: string, city: City) {
  return rows<{ id: string; label: string }>(
    pool(),
    `SELECT id,CONCAT(name,', ',address) AS label FROM places WHERE city_id=? AND hidden_at IS NULL AND normalized_name LIKE ? ORDER BY name LIMIT 20`,
    [city.id, '%' + normalizeCity(input).replace(/[\\%_]/g, '\\$&') + '%'],
  );
}
export async function placeDetails(id: string): Promise<LocalPlace> {
  const [place] = await rows<{ id: string; name: string; address: string; city_id: number }>(
    pool(),
    'SELECT id,name,address,city_id FROM places WHERE id=? AND hidden_at IS NULL',
    [id],
  );
  if (!place) throw new Error('INVALID_PLACE');
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
