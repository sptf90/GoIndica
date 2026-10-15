import { test, expect } from 'vitest';
import {
  requestSchema,
  profileSchema,
  resolutionSchema,
  indicationSchema,
} from '@/lib/validation/schemas';
import { safeError } from '@/lib/errors';
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
