import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import {
  autocomplete,
  placeDetails,
  validatePlaceCity,
  type GooglePlace,
} from '@/lib/google-places';
import type { City } from '@/lib/types';
import { googleSelectionSchema, searchSchema } from '@/lib/validation/schemas';
const city: City = {
  id: 3549805,
  name: 'São José do Rio Preto',
  normalized_name: 'sao jose do rio preto',
  state_code: 'SP',
  state_name: 'São Paulo',
  country_code: 'BR',
  country_name: 'Brasil',
  slug: 'rio-preto-sp',
};
const token = 'd632082a-3498-452a-ad33-c7f45bac7733';
export const place: GooglePlace = {
  id: 'ChIJ_example',
  displayName: { text: 'Empório A' },
  formattedAddress: 'Rua A, 10',
  types: ['establishment', 'point_of_interest'],
  businessStatus: 'OPERATIONAL',
  attributions: [],
  addressComponents: [
    { longText: city.name, types: ['administrative_area_level_2'] },
    { longText: 'São Paulo', shortText: 'SP', types: ['administrative_area_level_1'] },
    { longText: 'Brasil', shortText: 'BR', types: ['country'] },
  ],
};
beforeEach(() => {
  vi.stubEnv('GOOGLE_PLACES_API_KEY', 'test-private-key');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
test('autocomplete usa Places New, cidade, idioma e sessão sem expor a chave nos resultados', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      Response.json({
        suggestions: [
          { placePrediction: { placeId: place.id, text: { text: 'Empório A, Rua A' } } },
          { queryPrediction: { text: { text: 'ignorar' } } },
        ],
      }),
    );
  vi.stubGlobal('fetch', fetch);
  expect(await autocomplete('Empório', city, token)).toEqual([
    { id: place.id, label: 'Empório A, Rua A' },
  ]);
  const [url, options] = fetch.mock.calls[0];
  expect(url).toBe('https://places.googleapis.com/v1/places:autocomplete');
  expect(options.cache).toBe('no-store');
  expect(options.headers['X-Goog-Api-Key']).toBe('test-private-key');
  expect(JSON.parse(options.body)).toMatchObject({
    input: 'Empório, São José do Rio Preto, SP',
    includedRegionCodes: ['br'],
    sessionToken: token,
    languageCode: 'pt-BR',
  });
});
test('detalhes encerram a mesma sessão e preservam atribuições', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json(place));
  vi.stubGlobal('fetch', fetch);
  expect(await placeDetails(place.id, token)).toEqual(place);
  expect(fetch.mock.calls[0][0]).toContain('sessionToken=' + token);
  expect(fetch.mock.calls[0][1].headers['X-Goog-FieldMask']).toContain('attributions');
});
test('falhas e resposta inválida não retornam estabelecimentos fabricados', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 403 }));
  vi.stubGlobal('fetch', fetch);
  await expect(autocomplete('Loja', city, token)).rejects.toThrow('PLACES_UNAVAILABLE');
  fetch.mockResolvedValue(Response.json({ id: place.id }));
  await expect(placeDetails(place.id)).rejects.toThrow('PLACES_UNAVAILABLE');
  fetch.mockRejectedValue(new DOMException('timeout', 'TimeoutError'));
  await expect(placeDetails(place.id)).rejects.toThrow('PLACES_UNAVAILABLE');
});
test('valida cidade, UF, país, estabelecimento aberto e endereço sem ambiguidade', () => {
  expect(() => validatePlaceCity(place, city)).not.toThrow();
  for (const invalid of [
    { ...place, businessStatus: 'CLOSED_PERMANENTLY' },
    { ...place, types: ['locality', 'political'] },
    { ...place, addressComponents: [] },
    {
      ...place,
      addressComponents: place.addressComponents.map((c) =>
        c.shortText === 'SP' ? { ...c, shortText: 'RJ' } : c,
      ),
    },
    {
      ...place,
      addressComponents: [
        ...place.addressComponents,
        { longText: 'Mirassol', types: ['locality'] },
      ],
    },
  ])
    expect(() => validatePlaceCity(invalid, city)).toThrow('INVALID_CITY');
});
test('sessão e identificador são validados antes de consultar o Google', () => {
  expect(searchSchema.safeParse({ input: 'Loja', cityId: city.id }).success).toBe(false);
  expect(
    googleSelectionSchema.safeParse({
      googlePlaceId: '../../places',
      cityId: city.id,
      sessionToken: token,
    }).success,
  ).toBe(false);
  expect(
    googleSelectionSchema.safeParse({
      googlePlaceId: place.id,
      cityId: city.id,
      sessionToken: token,
    }).success,
  ).toBe(true);
});
