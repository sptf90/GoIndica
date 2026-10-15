// Test-only transport fixture. Loaded by the harness process, never imported by the application.
const originalFetch = globalThis.fetch;
globalThis.fetch = async function (input, options) {
  const url = String(input);
  if (!url.startsWith('https://places.googleapis.com/v1/')) return originalFetch(input, options);
  if (url.includes('places:autocomplete'))
    return globalThis.Response.json({
      suggestions: [
        {
          placePrediction: {
            placeId: 'test_place_a',
            text: { text: 'Empório A, Rua da Comunidade, São José do Rio Preto — SP' },
          },
        },
        {
          placePrediction: {
            placeId: 'test_place_b',
            text: { text: 'Empório B, Avenida da Cidade, São José do Rio Preto — SP' },
          },
        },
        {
          placePrediction: {
            placeId: 'test_place_wrong_city',
            text: { text: 'Empório fora da cidade, Mirassol — SP' },
          },
        },
      ],
    });
  const id = new globalThis.URL(url).pathname.split('/').at(-1);
  const wrong = id === 'test_place_wrong_city';
  return globalThis.Response.json({
    id,
    displayName: {
      text:
        id === 'test_place_a'
          ? 'Empório A'
          : id === 'test_place_b'
            ? 'Empório B'
            : 'Empório fora da cidade',
    },
    formattedAddress: wrong
      ? 'Rua B, Mirassol — SP'
      : 'Rua da Comunidade, São José do Rio Preto — SP',
    types: ['store', 'point_of_interest', 'establishment'],
    businessStatus: 'OPERATIONAL',
    addressComponents: [
      {
        longText: wrong ? 'Mirassol' : 'São José do Rio Preto',
        types: ['administrative_area_level_2'],
      },
      { longText: 'São Paulo', shortText: 'SP', types: ['administrative_area_level_1'] },
      { longText: 'Brasil', shortText: 'BR', types: ['country'] },
    ],
    attributions: [],
  });
};
