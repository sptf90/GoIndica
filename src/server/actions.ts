'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { supabase } from '@/lib/supabase/server';
import { serviceClient } from '@/lib/supabase/admin';
import { session, member, administrator } from './auth';
import { appUrl, configured, googleLoginEnabled } from '@/lib/env';
import {
  requestSchema,
  profileSchema,
  indicationSchema,
  resolutionSchema,
  reportSchema,
  adminSchema,
  uuid,
} from '@/lib/validation/schemas';
import { check, safeError } from '@/lib/errors';
import { placeDetails, validatePlaceCity } from '@/lib/google/places';
import type { ActionState } from '@/lib/types';
import { returnPath } from '@/lib/return-path';
import { prepareRequestPhoto } from '@/lib/request-photo';
const value = (f: FormData, k: string) => String(f.get(k) || '');
export async function login(f: FormData): Promise<void> {
  if (!configured()) redirect('/entrar?motivo=configuracao');
  if (!googleLoginEnabled()) redirect('/entrar');
  const db = await supabase();
  const next = returnPath(f.get('next'));
  const result = await db.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo:
        appUrl() + '/auth/callback' + (next === '/app' ? '' : '?next=' + encodeURIComponent(next)),
    },
  });
  if (result.error || !result.data.url) redirect('/entrar?motivo=falha');
  redirect(result.data.url);
}
export async function logout(): Promise<void> {
  const db = await supabase();
  await db.auth.signOut();
  redirect('/');
}
export async function saveProfile(_state: ActionState, f: FormData): Promise<ActionState> {
  const { db, profile } = await session();
  try {
    const input = profileSchema.parse({
      username: value(f, 'username'),
      displayName: value(f, 'displayName'),
      cityId: value(f, 'cityId'),
      useGooglePhoto: f.get('useGooglePhoto') === 'on',
    });
    check(
      await db.rpc('save_profile', {
        p_username: input.username,
        p_display_name: input.displayName,
        p_city_id: input.cityId,
        p_use_google_photo: input.useGooglePhoto,
      }),
    );
  } catch (e) {
    return safeError(e);
  }
  revalidatePath('/', 'layout');
  if (profile) return { success: 'Perfil atualizado.' };
  redirect(returnPath(f.get('next')));
}
export async function createRequest(_state: ActionState, f: FormData): Promise<ActionState> {
  const { db } = await member();
  let id: string;
  try {
    const input = requestSchema.parse({
      description: value(f, 'description'),
      cityId: value(f, 'cityId'),
      neighborhood: value(f, 'neighborhood'),
    });
    id = check(
      await db.rpc('create_request_with_photo', {
        p_description: input.description,
        p_city_id: input.cityId,
        p_neighborhood: input.neighborhood,
        p_photo: await prepareRequestPhoto(f.get('photo')),
      }),
    );
  } catch (e) {
    return safeError(e);
  }
  revalidatePath('/app');
  return { success: 'Pedido publicado.', redirectTo: '/pedidos/' + id };
}
export async function editRequest(_state: ActionState, f: FormData): Promise<ActionState> {
  const { db } = await member();
  let id: string;
  try {
    id = uuid.parse(value(f, 'requestId'));
    const input = requestSchema.parse({
      description: value(f, 'description'),
      cityId: value(f, 'cityId'),
      neighborhood: value(f, 'neighborhood'),
    });
    check(
      await db.rpc('edit_request_with_photo', {
        p_request_id: id,
        p_description: input.description,
        p_city_id: input.cityId,
        p_neighborhood: input.neighborhood,
        p_photo: await prepareRequestPhoto(f.get('photo')),
        p_remove_photo: value(f, 'removePhoto') === 'true',
      }),
    );
  } catch (e) {
    return safeError(e);
  }
  revalidatePath('/pedidos/' + id);
  redirect('/pedidos/' + id);
}
export async function indicate(_state: ActionState, f: FormData): Promise<ActionState> {
  const { db, user } = await member();
  let id: string;
  try {
    const input = indicationSchema.parse({
      requestId: value(f, 'requestId'),
      googlePlaceId: value(f, 'googlePlaceId'),
      comment: value(f, 'comment'),
      sessionToken: value(f, 'sessionToken') || undefined,
    });
    id = input.requestId;
    const request = check(await db.from('requests').select('*').eq('id', id).single());
    if (request.requester_id === user.id) throw new Error('SELF_INDICATION');
    if (request.status !== 'OPEN') throw new Error('RESPONSES_LOCKED');
    const city = check(await db.from('cities').select('*').eq('id', request.city_id).single());
    check(await db.rpc('consume_api_limit', { p_bucket: 'places_details' }));
    const place = await placeDetails(input.googlePlaceId, input.sessionToken);
    validatePlaceCity(place, city);
    if (place.id !== input.googlePlaceId) throw new Error('INVALID_PLACE');
    check(
      await serviceClient().rpc('submit_verified_indication', {
        p_actor: user.id,
        p_request_id: id,
        p_google_place_id: place.id,
        p_verified_city_id: city.id,
        p_comment: input.comment,
      }),
    );
  } catch (e) {
    return safeError(e);
  }
  revalidatePath('/pedidos/' + id);
  redirect('/pedidos/' + id + '?enviado=1');
}
export async function reveal(_state: ActionState, f: FormData): Promise<ActionState> {
  const { db } = await member();
  try {
    const id = uuid.parse(value(f, 'requestId'));
    check(await db.rpc('reveal_responses', { p_request_id: id }));
    revalidatePath('/pedidos/' + id);
    return { success: 'Indicações abertas. Novas respostas estão bloqueadas.' };
  } catch (e) {
    return safeError(e);
  }
}
export async function resolve(_state: ActionState, f: FormData): Promise<ActionState> {
  const { db } = await member();
  try {
    const input = resolutionSchema.parse({
      requestId: value(f, 'requestId'),
      type: value(f, 'type'),
      placeId: value(f, 'placeId') || null,
    });
    check(
      await db.rpc('resolve_request', {
        p_request_id: input.requestId,
        p_type: input.type,
        p_place_id: input.placeId,
      }),
    );
    revalidatePath('/', 'layout');
    return {
      success:
        input.type === 'INDICATED_PLACE'
          ? 'Resultado confirmado. Quem indicou este local recebeu 10 pontos.'
          : 'Resultado registrado. Nenhum ponto foi distribuído.',
    };
  } catch (e) {
    return safeError(e);
  }
}
export async function cancel(_state: ActionState, f: FormData): Promise<ActionState> {
  const { db } = await member();
  try {
    const id = uuid.parse(value(f, 'requestId'));
    check(await db.rpc('cancel_request', { p_request_id: id }));
    revalidatePath('/pedidos/' + id);
    return { success: 'Solicitação cancelada.' };
  } catch (e) {
    return safeError(e);
  }
}
export async function report(_state: ActionState, f: FormData): Promise<ActionState> {
  const { db } = await member();
  try {
    const input = reportSchema.parse({
      targetType: value(f, 'targetType'),
      targetId: value(f, 'targetId'),
      reason: value(f, 'reason'),
    });
    check(
      await db.rpc('report_content', {
        p_target_type: input.targetType,
        p_target_id: input.targetId,
        p_reason: input.reason,
      }),
    );
    return { success: 'Denúncia registrada para revisão.' };
  } catch (e) {
    return safeError(e);
  }
}
export async function moderate(_state: ActionState, f: FormData): Promise<ActionState> {
  const { db } = await administrator();
  try {
    const input = adminSchema.parse({ action: value(f, 'action'), targetId: value(f, 'targetId') });
    check(
      await db.rpc('admin_moderate', {
        p_action: input.action,
        p_target_id: input.targetId,
        p_note: value(f, 'note') || 'Revisão administrativa registrada',
      }),
    );
    revalidatePath('/', 'layout');
    return { success: 'Ação registrada.' };
  } catch (e) {
    return safeError(e);
  }
}
