'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { database } from '@/lib/database/server';
import { appUrl, configured } from '@/lib/env';
import {
  emailLoginSchema,
  emailSignupSchema,
  emailSchema,
  newPasswordSchema,
} from '@/lib/validation/schemas';
import { authError } from '@/lib/auth-errors';
import type { ActionState } from '@/lib/types';
import { returnPath } from '@/lib/return-path';

const confirmation =
  'Confira seu e-mail para confirmar o cadastro. Se já tem uma conta, entre com sua senha.';
const recovery =
  'Se houver uma conta com esse e-mail, você receberá um link para definir uma nova senha.';
const value = (form: FormData, key: string) => String(form.get(key) || '');

export async function loginWithEmail(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    if (!configured()) throw new Error('CONFIGURATION_REQUIRED');
    const input = emailLoginSchema.parse({
      email: value(form, 'email'),
      password: value(form, 'password'),
    });
    const db = await database();
    const { data, error } = await db.auth.signInWithPassword(input);
    if (error) return authError(error);
    if (!data.user || !data.session) return { error: 'Não foi possível entrar. Tente novamente.' };
    await db.call('log_login');
  } catch (error) {
    return authError(error);
  }
  revalidatePath('/', 'layout');
  redirect(returnPath(form.get('next')));
}

export async function signupWithEmail(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    if (!configured()) throw new Error('CONFIGURATION_REQUIRED');
    const input = emailSignupSchema.parse({
      email: value(form, 'email'),
      password: value(form, 'password'),
      passwordConfirmation: value(form, 'passwordConfirmation'),
    });
    const db = await database();
    const next = returnPath(form.get('next'));
    const { data, error } = await db.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo:
          appUrl() +
          '/auth/callback' +
          (next === '/app' ? '' : '?next=' + encodeURIComponent(next)),
      },
    });
    if (error) {
      if (error.code === 'user_already_exists' || error.code === 'email_exists')
        return { success: confirmation };
      return authError(error);
    }
    // Local email confirmation is required before creating an access session.
    if (!data.session) return { success: confirmation };
    await db.call('log_login');
  } catch (error) {
    return authError(error);
  }
  revalidatePath('/', 'layout');
  redirect(returnPath(form.get('next')));
}

export async function requestPasswordReset(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    if (!configured()) throw new Error('CONFIGURATION_REQUIRED');
    const { email } = emailSchema.parse({ email: value(form, 'email') });
    const db = await database();
    const { error } = await db.auth.resetPasswordForEmail(email, {
      redirectTo: appUrl() + '/auth/callback?destino=senha',
    });
    if (error) return authError(error);
    return { success: recovery };
  } catch (error) {
    return authError(error);
  }
}

export async function updatePassword(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    if (!configured()) throw new Error('CONFIGURATION_REQUIRED');
    const input = newPasswordSchema.parse({
      password: value(form, 'password'),
      passwordConfirmation: value(form, 'passwordConfirmation'),
    });
    const db = await database();
    const {
      data: { user },
      error: sessionError,
    } = await db.auth.getUser();
    if (sessionError || !user)
      return { error: 'O acesso expirou. Solicite outro link de recuperação.' };
    const { error } = await db.auth.updateUser({ password: input.password });
    if (error) return authError(error);
    await db.auth.signOut();
  } catch (error) {
    return authError(error);
  }
  revalidatePath('/', 'layout');
  redirect('/entrar?motivo=senha_atualizada');
}
