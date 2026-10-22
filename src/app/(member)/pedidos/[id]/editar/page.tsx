import { TaskPage } from '@/components/workspace-layout';
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
    <TaskPage
      title="Editar pedido" eyebrow="Ajuste sua pergunta"
      description="Os dados ficam bloqueados depois da primeira indicação."
      guidance={{
        title: 'Deixe sua busca mais clara', items: [
          'Revise a descrição e os detalhes do que você precisa.',
          'Confira a cidade, o bairro e a foto antes de salvar.',
          'Depois da primeira indicação, os dados do pedido ficam bloqueados.',
        ]
      }}
    >
      <RequestComposer city={city} request={request} />
    </TaskPage>
  );
}
