import 'server-only';
import { z } from 'zod';
import type { City } from '@/lib/types';
import { normalizeCity } from '@/lib/validation/schemas';
import { requiredEnv } from '@/lib/env';
const component = z.object({
  longText: z.string(),
  shortText: z.string().optional(),
  types: z.array(z.string()),
});
const placeSchema = z.object({
  id: z.string(),
  displayName: z.object({ text: z.string() }),
  formattedAddress: z.string(),
  addressComponents: z.array(component),
  types: z.array(z.string()),
  businessStatus: z.string().optional(),
  googleMapsUri: z
    .url()
    .refine((value) => {
      const url = new URL(value);
      return (
        url.protocol === 'https:' &&
        ['maps.google.com', 'www.google.com', 'maps.app.goo.gl'].includes(url.hostname)
      );
    })
    .optional(),
  attributions: z
    .array(z.object({ provider: z.string(), providerUri: z.url().optional() }))
    .optional()
    .default([]),
});
export type GooglePlace = z.infer<typeof placeSchema>;
const autocompleteSchema = z.object({
  suggestions: z
    .array(
      z.object({
        placePrediction: z
          .object({
            placeId: z.string(),
            text: z.object({ text: z.string() }),
            structuredFormat: z
              .object({
                mainText: z.object({ text: z.string() }).optional(),
                secondaryText: z.object({ text: z.string() }).optional(),
              })
              .optional(),
          })
          .optional(),
      }),
    )
    .optional()
    .default([]),
});
async function google(path: string, body?: unknown, mask?: string) {
  const apiKey = requiredEnv('GOOGLE_PLACES_API_KEY');
  const started = performance.now();
  let success = false;
  try {
    const response = await fetch('https://places.googleapis.com/v1/' + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        ...(mask ? { 'X-Goog-FieldMask': mask } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) {
      console.warn(JSON.stringify({ event: 'places.http_error', status: response.status }));
      throw new Error('PLACES_UNAVAILABLE');
    }
    const result = (await response.json()) as unknown;
    success = true;
    return result;
  } catch {
    throw new Error('PLACES_UNAVAILABLE');
  } finally {
    console.info(
      JSON.stringify({
        event: 'places.request',
        operation: body ? 'search' : 'details',
        duration_ms: Math.round(performance.now() - started),
        success,
      }),
    );
  }
}
export async function autocomplete(input: string, city: City, sessionToken: string) {
  const result = autocompleteSchema.parse(
    await google(
      'places:autocomplete',
      {
        input: `${input}, ${city.name}, ${city.state_code}`,
        includedRegionCodes: ['br'],
        languageCode: 'pt-BR',
        regionCode: 'BR',
        sessionToken,
      },
      'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat',
    ),
  );
  return result.suggestions.flatMap((s) =>
    s.placePrediction
      ? [
          {
            id: s.placePrediction.placeId,
            label: s.placePrediction.text.text,
            ...(s.placePrediction.structuredFormat
              ? {
                  mainText: s.placePrediction.structuredFormat.mainText?.text,
                  secondaryText: s.placePrediction.structuredFormat.secondaryText?.text,
                }
              : {}),
          },
        ]
      : [],
  );
}
export async function placeDetails(id: string, sessionToken?: string): Promise<GooglePlace> {
  try {
    return placeSchema.parse(
      await google(
        `places/${encodeURIComponent(id)}?languageCode=pt-BR&regionCode=BR${sessionToken ? '&sessionToken=' + encodeURIComponent(sessionToken) : ''}`,
        undefined,
        'id,displayName,formattedAddress,addressComponents,types,businessStatus,googleMapsUri,attributions',
      ),
    );
  } catch {
    throw new Error('PLACES_UNAVAILABLE');
  }
}
export function validatePlaceCity(
  place: GooglePlace,
  city: Pick<City, 'name' | 'normalized_name' | 'state_code' | 'country_code'>,
) {
  const values = (type: string) => place.addressComponents.filter((c) => c.types.includes(type));
  const country = values('country'),
    state = values('administrative_area_level_1');
  // In Brazil, municipalities are usually administrative_area_level_2. Districts are not cities.
  const municipalities = values('administrative_area_level_2');
  const localities = values('locality');
  const cities = municipalities.length ? municipalities : localities;
  const ambiguous = (arr: typeof cities) =>
    new Set(arr.map((c) => normalizeCity(c.longText))).size !== 1;
  const isEstablishment =
    place.types.some((t) => t === 'establishment' || t === 'point_of_interest') &&
    !place.types.includes('political');
  if (
    !isEstablishment ||
    place.businessStatus === 'CLOSED_PERMANENTLY' ||
    country.length !== 1 ||
    state.length !== 1 ||
    cities.length === 0 ||
    ambiguous(cities) ||
    country[0]?.shortText?.toUpperCase() !== city.country_code ||
    state[0]?.shortText?.toUpperCase() !== city.state_code ||
    normalizeCity(cities[0].longText) !== city.normalized_name ||
    (municipalities.length > 0 &&
      localities.some((c) => normalizeCity(c.longText) !== city.normalized_name))
  )
    throw new Error('INVALID_CITY');
}
