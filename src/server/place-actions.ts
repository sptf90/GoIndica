'use server';
import { revalidatePath } from 'next/cache';
import { administrator } from './auth';
import { transaction, rows } from '@/lib/database/pool';
import { log } from '@/lib/database/operations';
import { placeSchema, uuid, normalizeCity } from '@/lib/validation/schemas';
import { safeError } from '@/lib/errors';
import type { ActionState } from '@/lib/types';
export async function updatePlace(_state: ActionState, form: FormData): Promise<ActionState> {
  const { user } = await administrator();
  try {
    const id = uuid.parse(form.get('placeId'));
    const input = placeSchema
      .pick({ name: true, address: true })
      .parse({ name: form.get('name'), address: form.get('address') });
    await transaction(async (db) => {
      const [account] = await rows<{ is_admin: boolean; blocked: boolean }>(
        db,
        'SELECT is_admin,blocked FROM accounts WHERE id=? FOR UPDATE',
        [user.id],
      );
      if (!account?.is_admin || account.blocked) throw new Error('NOT_ALLOWED');
      const [place] = await rows(db, 'SELECT id FROM places WHERE id=? FOR UPDATE', [id]);
      if (!place) throw new Error('INVALID_PLACE');
      await db.execute(
        'UPDATE places SET name=?,address=?,normalized_name=?,last_verified_at=UTC_TIMESTAMP(3) WHERE id=?',
        [input.name, input.address, normalizeCity(input.name), id],
      );
      await log(db, user.id, 'PLACE_UPDATED', 'PLACE', id);
    });
    revalidatePath('/', 'layout');
    return { success: 'Estabelecimento atualizado.' };
  } catch (error) {
    return safeError(error);
  }
}
