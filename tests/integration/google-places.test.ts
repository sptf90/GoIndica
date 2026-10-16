import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { testDatabase } from './database';
const google = vi.hoisted(() => ({ details: vi.fn(), validate: vi.fn() }));
vi.mock('@/lib/google-places', () => ({
  placeDetails: google.details,
  validatePlaceCity: google.validate,
}));
import { selectGooglePlace, placeDetails } from '@/lib/places';
import { pool } from '@/lib/database/pool';
import type { City } from '@/lib/types';
let db: Awaited<ReturnType<typeof testDatabase>>;
let city: City;
const actors = [randomUUID(), randomUUID()];
beforeAll(async () => {
  db = await testDatabase();
  for (const [name, value] of Object.entries(db.env)) vi.stubEnv(name, value);
  for (const actor of actors) {
    await db.pool.execute('INSERT INTO users(id) VALUES(?)', [actor]);
    await db.pool.execute('INSERT INTO accounts(id) VALUES(?)', [actor]);
  }
  const [rows] = await db.pool.query('SELECT * FROM cities WHERE id=3549805');
  city = (rows as City[])[0];
  google.details.mockResolvedValue({
    id: 'ChIJ_integration',
    displayName: { text: 'Nome Google' },
    formattedAddress: 'Endereço Google',
    attributions: [],
  });
});
afterAll(async () => {
  if (db) {
    await pool().end();
    delete (globalThis as typeof globalThis & { goindicaPool?: unknown }).goindicaPool;
    await db.close();
  }
  vi.unstubAllEnvs();
});
test('seleções concorrentes compartilham ID local e não persistem nomes ou endereços Google', async () => {
  const selected = await Promise.all(
    actors.map((actor) => selectGooglePlace(actor, city, 'ChIJ_integration', randomUUID())),
  );
  expect(selected[0].id).toBe(selected[1].id);
  expect(selected[0].label).toBe('Nome Google, Endereço Google');
  const [rows] = await db.pool.query('SELECT * FROM places WHERE google_place_id=?', [
    'ChIJ_integration',
  ]);
  expect(rows).toHaveLength(1);
  expect(JSON.stringify(rows)).not.toContain('Nome Google');
  expect(JSON.stringify(rows)).not.toContain('Endereço Google');
  const details = await placeDetails(selected[0].id);
  expect(details.displayName.text).toBe('Nome Google');
  expect(details.id).toBe(selected[0].id);
  expect(details.cityId).toBe(city.id);
  await db.pool.execute('UPDATE places SET hidden_at=UTC_TIMESTAMP(3) WHERE id=?', [
    selected[0].id,
  ]);
  await expect(
    selectGooglePlace(actors[0], city, 'ChIJ_integration', randomUUID()),
  ).rejects.toThrow('INVALID_PLACE');
});
test('cidade inválida ou falha do Google não cria local', async () => {
  google.details.mockRejectedValueOnce(new Error('PLACES_UNAVAILABLE'));
  await expect(selectGooglePlace(actors[0], city, 'ChIJ_other', randomUUID())).rejects.toThrow(
    'PLACES_UNAVAILABLE',
  );
  google.details.mockResolvedValueOnce({ id: 'ChIJ_other', displayName: { text: 'Outra loja' } });
  google.validate.mockImplementationOnce(() => {
    throw new Error('INVALID_CITY');
  });
  await expect(selectGooglePlace(actors[0], city, 'ChIJ_other', randomUUID())).rejects.toThrow(
    'INVALID_CITY',
  );
  const [rows] = await db.pool.query('SELECT id FROM places WHERE google_place_id=?', [
    'ChIJ_other',
  ]);
  expect(rows).toHaveLength(0);
});
