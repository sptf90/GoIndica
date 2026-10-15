import { describe, test, expect, vi, afterEach } from 'vitest';
import {
  validatePlaceCity,
  placeDetails,
  autocomplete,
  safeMapsUrl,
  type GooglePlace,
} from '@/lib/google/places';
import type { City } from '@/lib/types';
const city: City = {
  id: 3549805,
  name: 'São José do Rio Preto',
  normalized_name: 'sao jose do rio preto',
  state_code: 'SP',
  state_name: 'São Paulo',
  country_code: 'BR',
  country_name: 'Brasil',
  slug: 'sao-jose-do-rio-preto-sp',
};
const place: GooglePlace = {
  id: 'official_place',
  displayName: { text: 'Empório' },
  formattedAddress: 'Endereço oficial',
  types: ['store', 'establishment', 'point_of_interest'],
  businessStatus: 'OPERATIONAL',
  addressComponents: [
    { longText: 'São José do Rio Preto', types: ['administrative_area_level_2'] },
    { longText: 'São Paulo', shortText: 'SP', types: ['administrative_area_level_1'] },
    { longText: 'Brasil', shortText: 'BR', types: ['country'] },
  ],
  attributions: [],
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
describe('Validação oficial de cidade', () => {
  test('normaliza acentos sem confundir município com bairro', () => {
    expect(() => validatePlaceCity(place, city)).not.toThrow();
    const withNeighborhood = {
      ...place,
      addressComponents: [
        ...place.addressComponents,
        { longText: 'Centro', types: ['sublocality_level_1'] },
      ],
    };
    expect(() => validatePlaceCity(withNeighborhood, city)).not.toThrow();
  });
  test('nome e endereço livre não substituem componentes oficiais', () => {
    expect(() =>
      validatePlaceCity(
        {
          ...place,
          formattedAddress: 'São José do Rio Preto SP',
          addressComponents: place.addressComponents.map((c) =>
            c.types.includes('administrative_area_level_2') ? { ...c, longText: 'Mirassol' } : c,
          ),
        },
        city,
      ),
    ).toThrow('INVALID_CITY');
  });
  test.each(['state', 'country', 'missing', 'ambiguous', 'political', 'closed', 'conflict'])(
    'rejeita localização insegura: %s',
    (kind) => {
      const candidate: GooglePlace = structuredClone(place);
      if (kind === 'state') candidate.addressComponents[1].shortText = 'RJ';
      if (kind === 'country') candidate.addressComponents[2].shortText = 'US';
      if (kind === 'missing') candidate.addressComponents.shift();
      if (kind === 'ambiguous')
        candidate.addressComponents.push({
          longText: 'Mirassol',
          types: ['administrative_area_level_2'],
        });
      if (kind === 'political') candidate.types = ['locality', 'political'];
      if (kind === 'closed') candidate.businessStatus = 'CLOSED_PERMANENTLY';
      if (kind === 'conflict')
        candidate.addressComponents.push({ longText: 'Mirassol', types: ['locality'] });
      expect(() => validatePlaceCity(candidate, city)).toThrow('INVALID_CITY');
    },
  );
  test('aceita locality somente quando o município não foi retornado', () => {
    const fallback = {
      ...place,
      addressComponents: place.addressComponents.map((c) =>
        c.types.includes('administrative_area_level_2') ? { ...c, types: ['locality'] } : c,
      ),
    };
    expect(() => validatePlaceCity(fallback, city)).not.toThrow();
  });
});
describe('Places API New', () => {
  test('consulta servidor oficial com máscara, timeout e sem cache', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'test-key');
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => place });
    vi.stubGlobal('fetch', fetch);
    expect(await placeDetails('official_place')).toEqual(place);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://places.googleapis.com/v1/places/official_place'),
      expect.objectContaining({
        cache: 'no-store',
        signal: expect.any(AbortSignal),
        headers: expect.objectContaining({
          'X-Goog-FieldMask': expect.stringContaining('addressComponents'),
        }),
      }),
    );
  });
  test.each(['http', 'timeout', 'malformed'])(
    'falha %s não aceita indicação nem vaza erro externo',
    async (kind) => {
      vi.stubEnv('GOOGLE_PLACES_API_KEY', 'test-key');
      vi.stubGlobal(
        'fetch',
        kind === 'timeout'
          ? vi.fn().mockRejectedValue(new DOMException('secret details', 'TimeoutError'))
          : vi.fn().mockResolvedValue({
              ok: kind !== 'http',
              json: async () => ({ unexpected: 'secret' }),
            }),
      );
      await expect(placeDetails('official_place')).rejects.toThrow('PLACES_UNAVAILABLE');
    },
  );
  test('autocomplete usa sessão, país, atribuição e retorna apenas predições reais', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'test-key');
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        suggestions: [
          { placePrediction: { placeId: 'official_place', text: { text: 'Empório, Rua A' } } },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetch);
    expect(await autocomplete('Empório', city, 'token')).toEqual([
      { id: 'official_place', label: 'Empório, Rua A' },
    ]);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
      sessionToken: 'token',
      includedRegionCodes: ['br'],
    });
  });
  test('link não aceita URI de outro domínio', () => {
    expect(safeMapsUrl({ ...place, googleMapsUri: 'https://evil.example/path' })).toMatch(
      /^https:\/\/www.google.com\/maps\/search/,
    );
  });
});
