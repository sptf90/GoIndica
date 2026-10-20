'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { configured } from '@/lib/env';
import { database } from '@/lib/database/server';
import { pool, transaction } from '@/lib/database/pool';
import { rate } from '@/lib/database/rate';
import { hashToken } from '@/lib/auth/crypto';
import { authError } from '@/lib/auth-errors';
import { safeError } from '@/lib/errors';
import { isValidCnpj, normalizeCnpj, presentationName } from '@/lib/cnpj';
import {
  cnpjTaken,
  isActive,
  lookupCnpj,
  updateCompanyData,
  updateCompanyName,
  type CnpjData,
} from '@/lib/company';
import {
  companyNameSchema,
  companySignupSchema,
  newPasswordSchema,
} from '@/lib/validation/schemas';
import type { ActionState } from '@/lib/types';
import { company } from './auth';

export interface CompanySummary {
  legalName: string;
  tradeName: string | null;
  registrationStatus: string | null;
  city: string | null;
  branch: 'MATRIZ' | 'FILIAL' | null;
  suggestedName: string;
}
export type CompanyLookupResult =
  | { status: 'invalid' | 'taken' | 'not_found' | 'unavailable' | 'limited' }
  | { status: 'found' | 'inactive'; company: CompanySummary };
const value = (form: FormData, key: string) => String(form.get(key) || '');
const confirmation =
  'Enviamos um link de confirmação para o e-mail informado. Abra-o para acessar o painel da empresa. Se o e-mail já tiver uma conta, entre com sua senha.';

async function limited(bucket: string, max: number) {
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  try {
    await transaction((db) => rate(db, hashToken(ip), bucket, max, 900));
    return false;
  } catch {
    return true;
  }
}
async function summary(data: CnpjData): Promise<CompanySummary> {
  let city: string | null = null;
  if (data.cityId) {
    const [row] = (
      await pool().execute<import('mysql2').RowDataPacket[]>(
        'SELECT name,state_code FROM cities WHERE id=?',
        [data.cityId],
      )
    )[0];
    if (row) city = `${row.name} — ${row.state_code}`;
  }
  return {
    legalName: data.legalName,
    tradeName: data.tradeName,
    registrationStatus: data.registrationStatus,
    city,
    branch: data.branch,
    suggestedName: presentationName(data.legalName, data.tradeName),
  };
}
export async function lookupCompany(input: string): Promise<CompanyLookupResult> {
  if (!configured()) return { status: 'unavailable' };
  const cnpj = normalizeCnpj(input);
  if (!isValidCnpj(cnpj)) return { status: 'invalid' };
  if (await limited('cnpj_lookup', 30)) return { status: 'limited' };
  if (await cnpjTaken(cnpj)) return { status: 'taken' };
  const result = await lookupCnpj(cnpj);
  if (result.status !== 'found') return { status: result.status };
  return {
    status: isActive(result.data) ? 'found' : 'inactive',
    company: await summary(result.data),
  };
}
export async function signupCompany(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    if (!configured()) throw new Error('CONFIGURATION_REQUIRED');
    const input = companySignupSchema.parse({
      email: value(form, 'email'),
      password: value(form, 'password'),
      passwordConfirmation: value(form, 'passwordConfirmation'),
      cnpj: value(form, 'cnpj'),
      displayName: value(form, 'displayName'),
      declaration: form.get('declaration') || undefined,
    });
    if (await cnpjTaken(input.cnpj)) throw new Error('CNPJ_TAKEN');
    const lookup = await lookupCnpj(input.cnpj);
    if (lookup.status === 'not_found') throw new Error('CNPJ_NOT_FOUND');
    if (lookup.status === 'unavailable') throw new Error('CNPJ_LOOKUP_UNAVAILABLE');
    if (!isActive(lookup.data)) throw new Error('CNPJ_INACTIVE');
    const db = await database();
    const { error } = await db.auth.signUp({
      email: input.email,
      password: input.password,
      next: '/empresa',
      company: {
        cnpj: input.cnpj,
        displayName: input.displayName,
        legalName: lookup.data.legalName,
        data: lookup.data,
      },
    });
    if (error) throw error;
    return { success: confirmation };
  } catch (error) {
    const state = authError(error);
    const message =
      error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
    if (/^CNPJ_/.test(message)) return { ...state, fields: { cnpj: [state.error || ''] } };
    return state;
  }
}
export async function saveCompanyName(_state: ActionState, form: FormData): Promise<ActionState> {
  const { user } = await company();
  try {
    await updateCompanyName(user.id, companyNameSchema.parse(value(form, 'displayName')));
  } catch (error) {
    return safeError(error);
  }
  revalidatePath('/empresa');
  return { success: 'Nome de apresentação atualizado.' };
}
export async function refreshCompanyData(): Promise<ActionState> {
  const { user, company: current } = await company();
  try {
    await transaction((db) => rate(db, user.id, 'cnpj_refresh', 3, 3600));
    const result = await lookupCnpj(current.cnpj, true);
    if (result.status === 'unavailable')
      return {
        error: 'Não conseguimos consultar a Receita Federal agora. Tente novamente mais tarde.',
      };
    if (result.status === 'not_found')
      return { error: 'A Receita Federal não retornou dados para este CNPJ.' };
    await updateCompanyData(user.id, result.data);
  } catch (error) {
    return safeError(error);
  }
  revalidatePath('/empresa');
  return { success: 'Dados atualizados com a Receita Federal.' };
}
export async function changeCompanyPassword(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { db, user } = await company();
  try {
    const { password } = newPasswordSchema.parse({
      password: value(form, 'password'),
      passwordConfirmation: value(form, 'passwordConfirmation'),
    });
    const current = z
      .string()
      .min(1, 'Informe sua senha atual.')
      .max(128)
      .parse(value(form, 'currentPassword'));
    const check = await db.auth.signInWithPassword({ email: user.email, password: current });
    if (check.error) {
      if (check.error.code === 'invalid_credentials') throw new Error('CURRENT_PASSWORD_INVALID');
      return authError(check.error);
    }
    const { error } = await db.auth.updateUser({ password });
    if (error) return authError(error);
    return { success: 'Senha atualizada.' };
  } catch (error) {
    return safeError(error);
  }
}
