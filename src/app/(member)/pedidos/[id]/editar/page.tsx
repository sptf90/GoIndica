import { notFound, redirect } from 'next/navigation';
import { member } from '@/server/auth';
import { uuid } from '@/lib/validation/schemas';
import { check } from '@/lib/errors';
import { RequestComposer } from '@/components/request-composer';
export const metadata = { title: 'Editar pedido' };
export default async function Edit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const { db, user } = await member();
  const request = check(await db.from('requests').select('*').eq('id', id).single());
  if (
    request.requester_id !== user.id ||
    request.status !== 'OPEN' ||
    request.indication_count > 0 ||
    !check(await db.call('request_editable', { p_request_id: id }))
  )
    redirect('/pedidos/' + id);
  const city = check(await db.from('cities').select('*').eq('id', request.city_id).single());
  return (
    <div className="form-page">
      <h1>Editar pedido</h1>
      <p className="muted">Os dados ficam bloqueados depois da primeira indicação.</p>
      <RequestComposer city={city} request={request} />
    </div>
  );
}
