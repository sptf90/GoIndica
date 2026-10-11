'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { member } from './auth';
import { check, safeError } from '@/lib/errors';
import { uuid, cityId } from '@/lib/validation/schemas';
import type { ActionState } from '@/lib/types';

export async function wanted(_state: ActionState, form: FormData): Promise<ActionState> {
  const { db } = await member();
  try {
    const id = uuid.parse(form.get('requestId'));
    const enabled = z.enum(['true', 'false']).parse(form.get('wanted')) === 'true';
    check(await db.rpc('set_request_wanted', { p_request_id: id, p_wanted: enabled }));
    revalidatePath('/', 'layout');
    return {
      success: enabled
        ? 'Você também procura este item e acompanhará o resultado.'
        : 'Interesse removido. Você ainda pode acompanhar o pedido.',
    };
  } catch (error) {
    return safeError(error);
  }
}

export async function reconfirm(_state: ActionState, form: FormData): Promise<ActionState> {
  const { db } = await member();
  try {
    const id = uuid.parse(form.get('requestId'));
    check(await db.rpc('reconfirm_discovery', { p_request_id: id }));
    revalidatePath('/', 'layout');
    return { success: 'Sua descoberta foi registrada. Obrigado por atualizar o histórico!' };
  } catch (error) {
    return safeError(error);
  }
}

export async function addTopicAlert(_state: ActionState, form: FormData): Promise<ActionState> {
  const { db } = await member();
  try {
    const term = z
      .string()
      .trim()
      .min(3, 'Escreva pelo menos 3 caracteres.')
      .max(80, 'Use até 80 caracteres.')
      .parse(form.get('term'));
    check(
      await db.rpc('add_topic_alert', {
        p_city_id: cityId.parse(form.get('cityId')),
        p_term: term,
      }),
    );
    revalidatePath('/preferencias');
    return {
      success: 'Alerta criado. Novos pedidos relacionados aparecerão nas suas notificações.',
    };
  } catch (error) {
    return safeError(error);
  }
}

export async function removeTopicAlert(_state: ActionState, form: FormData): Promise<ActionState> {
  const { db } = await member();
  try {
    check(await db.rpc('remove_topic_alert', { p_id: uuid.parse(form.get('id')) }));
    revalidatePath('/preferencias');
    return { success: 'Alerta removido.' };
  } catch (error) {
    return safeError(error);
  }
}
