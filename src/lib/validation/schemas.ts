import { z } from 'zod';
import { isValidCnpj, normalizeCnpj } from '@/lib/cnpj';
export const uuid = z.uuid('Identificador inválido.');
export const cityId = z.coerce.number().int().positive('Selecione uma cidade.');
export const emailSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email('Informe um e-mail válido.'),
});
export const emailLoginSchema = emailSchema.extend({
  password: z.string().min(1, 'Informe sua senha.').max(128, 'Use até 128 caracteres.'),
});
export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(12, 'Use uma senha com pelo menos 12 caracteres.')
      .max(128, 'Use até 128 caracteres.'),
    passwordConfirmation: z.string().max(128),
  })
  .refine((input) => input.password === input.passwordConfirmation, {
    message: 'As senhas precisam ser iguais.',
    path: ['passwordConfirmation'],
  });
export const emailSignupSchema = emailSchema
  .extend(newPasswordSchema.shape)
  .refine((input) => input.password === input.passwordConfirmation, {
    message: 'As senhas precisam ser iguais.',
    path: ['passwordConfirmation'],
  });
export const companyNameSchema = z
  .string()
  .trim()
  .min(2, 'Informe o nome de apresentação.')
  .max(80, 'Use até 80 caracteres.');
export const companySignupSchema = emailSchema
  .extend(newPasswordSchema.shape)
  .extend({
    cnpj: z
      .string()
      .transform(normalizeCnpj)
      .refine(isValidCnpj, 'Confira o CNPJ: os dígitos verificadores não conferem.'),
    displayName: companyNameSchema,
    declaration: z.literal('on', {
      error: 'Confirme que você representa este estabelecimento.',
    }),
  })
  .refine((input) => input.password === input.passwordConfirmation, {
    message: 'As senhas precisam ser iguais.',
    path: ['passwordConfirmation'],
  });
export const requestSchema = z.object({
  description: z
    .string()
    .trim()
    .min(3, 'Escreva pelo menos 3 caracteres.')
    .max(300, 'Use até 300 caracteres.'),
  cityId,
  neighborhood: z.string().trim().max(100).optional().default(''),
});
export const profileSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z][a-z0-9_]{2,23}$/, 'Use 3 a 24 letras, números ou _. Comece com uma letra.'),
  displayName: z.string().trim().min(2, 'Informe seu nome.').max(60),
  cityId,
});
export const indicationSchema = z.object({
  requestId: uuid,
  placeId: uuid,
  comment: z.string().trim().max(300).default(''),
});
export const resolutionSchema = z
  .object({
    requestId: uuid,
    type: z.enum(['INDICATED_PLACE', 'OTHER_PLACE', 'NOT_FOUND']),
    placeId: uuid.nullable().default(null),
  })
  .refine((v) => (v.type === 'INDICATED_PLACE' ? v.placeId !== null : v.placeId === null), {
    message: 'Selecione um dos locais indicados.',
  });
export const reportSchema = z.object({
  targetType: z.enum(['REQUEST', 'INDICATION']),
  targetId: uuid,
  reason: z.string().trim().min(10, 'Descreva o motivo com pelo menos 10 caracteres.').max(500),
});
export const adminSchema = z.object({
  action: z.enum([
    'BLOCK_USER',
    'UNBLOCK_USER',
    'HIDE_REQUEST',
    'HIDE_INDICATION',
    'REVIEW_REPORT',
  ]),
  targetId: uuid,
});
const googlePlaceId = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[A-Za-z0-9_-]+$/);
export const googleSelectionSchema = z.object({
  googlePlaceId,
  cityId,
  sessionToken: z.uuid(),
});
export const searchSchema = z.object({
  input: z.string().trim().min(3).max(120),
  cityId,
  sessionToken: z.uuid(),
});
export function normalizeCity(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export const placeSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do estabelecimento.').max(160),
  address: z.string().trim().min(5, 'Informe o endereço completo.').max(300),
  cityId,
});
