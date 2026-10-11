import { apiMember } from '@/server/api-auth';
import { uuid } from '@/lib/validation/schemas';
import { check } from '@/lib/errors';
import { apiError } from '@/lib/http';
import { appUrl } from '@/lib/env';
import { renderShareCard } from '@/lib/share-card';

export async function GET(request: Request) {
  try {
    const auth = await apiMember();
    if (!auth) throw new Error('AUTH_REQUIRED');
    const id = uuid.parse(new URL(request.url).searchParams.get('id'));
    const result = await auth.db
      .from('requests')
      .select('description,city_id,status,hidden_at')
      .eq('id', id)
      .maybeSingle();
    if (result.error) throw result.error;
    if (!result.data || result.data.hidden_at) throw new Error('NOT_ALLOWED');
    check(await auth.db.rpc('consume_share_card_limit'));
    const city = check(
      await auth.db.from('cities').select('name,state_code').eq('id', result.data.city_id).single(),
    );
    const image = await renderShareCard({
      description: result.data.description,
      city: city.name + ' — ' + city.state_code,
      url: appUrl() + '/pedidos/' + id,
      resolved: result.data.status === 'RESOLVED',
    });
    image.headers.set(
      'Content-Disposition',
      'attachment; filename="goindica-pedido-' + id + '.png"',
    );
    return image;
  } catch (error) {
    return apiError(error, 'request.share-card');
  }
}
