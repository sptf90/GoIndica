import Link from 'next/link';
import { PageHeading } from '@/components/page-heading';
import { member } from '@/server/auth';
import { check } from '@/lib/errors';
import { RequestCard } from '@/components/request-card';
import { Empty } from '@/components/ui';
import { citiesFor } from '@/server/queries';

export const metadata = { title: 'Pedir uma indicação' };

export default async function PedirPage() {
  const { db, user } = await member();
  const requests = check(
    await db
      .from('requests')
      .select('*')
      .eq('requester_id', user.id)
      .order('created_at', { ascending: false })
      .order('id')
      .range(0, 19),
  );
  const cities = await citiesFor(requests);
  return (
    <div className="collection-page">
      <PageHeading
        title="Pedir uma indicação"
        eyebrow="Meus pedidos"
        description="Publique o que você procura e acompanhe somente os seus pedidos — sem contador de respostas."
        action={
          <Link href="/pedidos/novo" className="button">
            Novo pedido
          </Link>
        }
      />
      {requests.length ? (
        <div className="request-list">
          {requests.map((r, index) => (
            <RequestCard key={r.id} index={index} request={r} city={cities.get(r.city_id)} />
          ))}
        </div>
      ) : (
        <Empty title="Você ainda não pediu nenhuma indicação.">
          <p>Comece descrevendo o que procura na sua cidade.</p>
          <Link href="/pedidos/novo" className="text-link">
            Criar pedido ↗
          </Link>
        </Empty>
      )}
      <p className="hint">
        <Link href="/atividades?tab=requests">Ver histórico completo em atividades ↗</Link>
      </p>
    </div>
  );
}
