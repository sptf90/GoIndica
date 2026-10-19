'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { member, administrator } from './auth';
import { operationalError } from '@/lib/observability';
import { check, safeError } from '@/lib/errors';
import { uuid, cityId, emailSchema, newPasswordSchema } from '@/lib/validation/schemas';
import type { ActionState } from '@/lib/types';
const value = (f: FormData, name: string) => String(f.get(name) || '');
const note = z.string().trim().min(10, 'Descreva o motivo com pelo menos 10 caracteres.').max(500);
export async function interest(_s: ActionState, f: FormData): Promise<ActionState> {
  const { db } = await member();
  try {
    const id = uuid.parse(value(f, 'requestId'));
    const kind = z.enum(['saved', 'following']).parse(value(f, 'kind'));
    const enabled = value(f, 'enabled') === 'true';
    check(
      await db.call('set_request_interest', {
        p_request_id: id,
        ...(kind === 'saved' ? { p_saved: enabled } : { p_following: enabled }),
      }),
    );
    revalidatePath('/', 'layout');
    return {
      success: enabled
        ? kind === 'saved'
          ? 'Pedido salvo.'
          : 'Você está acompanhando este pedido.'
        : 'Preferência atualizada.',
    };
  } catch (e) {
    return safeError(e);
  }
}
export async function preferences(_s: ActionState, f: FormData): Promise<ActionState> {
  const { db } = await member();
  try {
    check(
      await db.call('save_preferences', { p_email_reminders: f.get('emailReminders') === 'on' }),
    );
    revalidatePath('/preferencias');
    return { success: 'Preferências salvas.' };
  } catch (e) {
    return safeError(e);
  }
}
export async function followCity(_s: ActionState, f: FormData): Promise<ActionState> {
  const { db } = await member();
  try {
    check(
      await db.call('set_followed_city', {
        p_city_id: cityId.parse(value(f, 'cityId')),
        p_following: value(f, 'follow') === 'true',
      }),
    );
    revalidatePath('/', 'layout');
    return { success: 'Cidades atualizadas.' };
  } catch (e) {
    return safeError(e);
  }
}
export async function readNotifications(_s: ActionState, f: FormData): Promise<ActionState> {
  const { db } = await member();
  try {
    check(
      await db.call(
        'mark_notifications_read',
        value(f, 'id') ? { p_id: uuid.parse(value(f, 'id')) } : {},
      ),
    );
    revalidatePath('/', 'layout');
    return { success: 'Notificações marcadas como lidas.' };
  } catch (e) {
    return safeError(e);
  }
}
export async function requestSupport(_s: ActionState, f: FormData): Promise<ActionState> {
  const { db } = await member();
  try {
    check(
      await db.call('request_support', {
        p_kind: z.enum(['CLOSE_ACCOUNT', 'DATA_HELP']).parse(value(f, 'kind')),
        p_reason: note.parse(value(f, 'reason')),
      }),
    );
    revalidatePath('/conta');
    return { success: 'Solicitação enviada. Acompanhe a resposta nesta página.' };
  } catch (e) {
    return safeError(e);
  }
}
export async function reviewSupport(_s: ActionState, f: FormData): Promise<ActionState> {
  const { db } = await administrator();
  try {
    const id = uuid.parse(value(f, 'id')),
      decision = z.enum(['COMPLETED', 'DECLINED', 'CLOSE']).parse(value(f, 'decision')),
      explanation = note.parse(value(f, 'note'));
    if (decision === 'CLOSE') {
      check(await db.call('prepare_account_closure', { p_id: id }));
      check(await db.call('complete_account_closure', { p_id: id, p_note: explanation }));
    } else
      check(
        await db.call('admin_review_support', {
          p_id: id,
          p_decision: decision,
          p_note: explanation,
        }),
      );
    revalidatePath('/', 'layout');
    return { success: 'Decisão registrada.' };
  } catch (e) {
    return safeError(e);
  }
}
async function verifyPassword(
  db: Awaited<ReturnType<typeof member>>['db'],
  user: Awaited<ReturnType<typeof member>>['user'],
  f: FormData,
) {
  if (user.app_metadata.providers?.includes('email')) {
    const password = z
      .string()
      .min(1, 'Informe sua senha atual.')
      .max(128)
      .parse(value(f, 'currentPassword'));
    const result = await db.auth.signInWithPassword({ email: user.email!, password });
    if (result.error) {
      if (result.error.code === 'invalid_credentials') throw new Error('CURRENT_PASSWORD_INVALID');
      operationalError('account.reauthenticate', result.error);
      throw new Error('SERVICE_UNAVAILABLE');
    }
  }
}
export async function changeEmail(_s: ActionState, f: FormData): Promise<ActionState> {
  const { db, user } = await member();
  try {
    const { email } = emailSchema.parse({ email: value(f, 'email') });
    await verifyPassword(db, user, f);
    check(await db.auth.updateUser({ email }));
    return {
      success:
        'Confirme o novo endereço pelo link enviado. Você também receberá um aviso no e-mail atual.',
    };
  } catch (e) {
    return safeError(e);
  }
}
export async function changePassword(_s: ActionState, f: FormData): Promise<ActionState> {
  const { db, user } = await member();
  try {
    const { password } = newPasswordSchema.parse({
      password: value(f, 'password'),
      passwordConfirmation: value(f, 'passwordConfirmation'),
    });
    await verifyPassword(db, user, f);
    check(await db.auth.updateUser({ password }));
    return { success: 'Senha atualizada.' };
  } catch (e) {
    return safeError(e);
  }
}
