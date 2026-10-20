import { test, expect } from 'vitest';
import {
  requestSchema,
  profileSchema,
  resolutionSchema,
  indicationSchema,
} from '@/lib/validation/schemas';
import { safeError } from '@/lib/errors';
import { reputationLabel } from '@/lib/reputation';
import { profilePhotoUrl, profileUrl } from '@/lib/profile-links';
test('valida comprimentos, cidade e username', () => {
  expect(requestSchema.safeParse({ description: 'a'.repeat(301), cityId: 3549805 }).success).toBe(
    false,
  );
  expect(requestSchema.safeParse({ description: 'Farinha', cityId: 'cidade solta' }).success).toBe(
    false,
  );
  expect(
    profileSchema.safeParse({
      username: 'Nome com espaço',
      displayName: 'Pessoa',
      cityId: 3549805,
    }).success,
  ).toBe(false);
  expect(
    profileSchema.parse({ username: ' Ana_Silva ', displayName: ' Ana ', cityId: '3549805' }),
  ).toEqual({ username: 'ana_silva', displayName: 'Ana', cityId: 3549805 });
  expect(
    profileSchema.safeParse({ username: 'ana_silva', displayName: 'A', cityId: 3549805 }).success,
  ).toBe(false);
});
test('nome de usuário em uso tem mensagem própria', () => {
  expect(safeError({ message: 'USERNAME_TAKEN' }).error).toBe(
    'Este nome de usuário já está em uso. Escolha outro.',
  );
  expect(safeError({ message: 'SERVICE_UNAVAILABLE', code: '23505' }).error).not.toContain(
    'usuário',
  );
});
test('reputação provisória expõe só o selo, sem números', () => {
  expect(reputationLabel(0)).toBe('Sem selo ainda');
  expect(reputationLabel(1)).toBe('Primeira indicação confirmada');
  expect(reputationLabel(10)).toBe('Ajuda frequente');
  expect(reputationLabel(50)).toBe('Referência da comunidade');
  for (const n of [0, 3, 12, 80]) expect(reputationLabel(n)).not.toMatch(/\d/);
});
test('links de perfil sempre carregam a origem autorizada', () => {
  const request = '6c73d927-e9ba-4a97-b8e1-4bc41cb7bc16';
  expect(profileUrl('ana', { request })).toBe('/perfil/ana?pedido=' + request);
  expect(profileUrl('ana', { rankingCity: 3549805 })).toBe('/perfil/ana?ranking=3549805');
  expect(profilePhotoUrl({ id: request, photo_updated_at: null })).toBeUndefined();
  expect(
    profilePhotoUrl(
      { id: request, photo_updated_at: '2026-10-20T10:00:00.000Z' },
      { rankingCity: 3549805 },
    ),
  ).toBe(`/api/profile-photo?ranking=3549805&id=${request}&v=${Date.parse('2026-10-20T10:00:00.000Z')}`);
});
test('resolução vincula local somente à opção encontrada nas indicações', () => {
  const id = '6c73d927-e9ba-4a97-b8e1-4bc41cb7bc16';
  expect(
    resolutionSchema.safeParse({ requestId: id, type: 'OTHER_PLACE', placeId: id }).success,
  ).toBe(false);
  expect(
    resolutionSchema.safeParse({ requestId: id, type: 'INDICATED_PLACE', placeId: null }).success,
  ).toBe(false);
  expect(resolutionSchema.safeParse({ requestId: id, type: 'NOT_FOUND' }).success).toBe(true);
});
test('local exige ID verificável e descarta nome, cidade e coordenadas enviados pelo cliente', () => {
  const requestId = '6c73d927-e9ba-4a97-b8e1-4bc41cb7bc16';
  expect(
    indicationSchema.parse({
      requestId,
      placeId: requestId,
      cityId: 'outra',
      name: 'Nome forjado',
      latitude: 0,
    }),
  ).toEqual({ requestId, placeId: requestId, comment: '' });
  expect(indicationSchema.safeParse({ requestId, placeId: '../../malicious' }).success).toBe(
    false,
  );
});
test('erros não expõem SQL, secrets ou emails', () => {
  expect(
    safeError({ message: 'database password secret@example.com', code: 'XX000' }).error,
  ).not.toContain('secret');
  expect(safeError({ message: 'RESPONSES_LOCKED' }).error).toContain('não são mais aceitas');
});
