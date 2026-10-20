'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { database } from '@/lib/database/server';
import { session, member, administrator } from './auth';
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
import { placeDetails, validatePlaceCity } from '@/lib/places';
import type { ActionState } from '@/lib/types';
import { returnPath } from '@/lib/return-path';
import { prepareProfilePhoto, prepareRequestPhoto } from '@/lib/request-photo';
const value = (f: FormData, k: string) => String(f.get(k) || '');
export async function logout(): Promise<void> {
  const db = await database();
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
    });
    const photo = await prepareProfilePhoto(f.get('photo'));
    check(
      await db.call('save_profile', {
        p_username: input.username,
        p_display_name: input.displayName,
        p_city_id: input.cityId,
        p_photo: photo,
        p_remove_photo: !photo && value(f, 'removePhoto') === 'true',
      }),
    );
  } catch (e) {
    const state = safeError(e);
    if (e && typeof e === 'object' && 'message' in e && e.message === 'USERNAME_TAKEN')
      return { ...state, fields: { username: [state.error || ''] } };
    return state;
  }
  revalidatePath('/', 'layout');
  if (profile) return { success: 'Perfil atualizado.' };
  redirect(returnPath(f.get('next')));
}
export async function checkUsername(
  username: string,
): Promise<'available' | 'taken' | 'invalid' | 'unknown'> {
  const parsed = profileSchema.shape.username.safeParse(username);
  if (!parsed.success) return 'invalid';
  const { db } = await session();
  const result = await db.call('username_available', { p_username: parsed.data });
  if (result.error) return 'unknown';
  return result.data ? 'available' : 'taken';
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
      await db.call('create_request_with_photo', {
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
      await db.call('edit_request_with_photo', {
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
      placeId: value(f, 'placeId'),
      comment: value(f, 'comment'),
    });
    id = input.requestId;
    const request = check(await db.from('requests').select('*').eq('id', id).single());
    if (request.requester_id === user.id) throw new Error('SELF_INDICATION');
    if (request.status !== 'OPEN') throw new Error('RESPONSES_LOCKED');
    const city = check(await db.from('cities').select('*').eq('id', request.city_id).single());
    check(await db.call('consume_api_limit', { p_bucket: 'places_details' }));
    const place = await placeDetails(input.placeId);
    validatePlaceCity(place, city);
    if (place.id !== input.placeId) throw new Error('INVALID_PLACE');
    check(
      await db.call('submit_verified_indication', {
        p_actor: user.id,
        p_request_id: id,
        p_place_id: place.id,
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
    check(await db.call('reveal_responses', { p_request_id: id }));
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
      await db.call('resolve_request', {
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
    check(await db.call('cancel_request', { p_request_id: id }));
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
      await db.call('report_content', {
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
      await db.call('admin_moderate', {
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
