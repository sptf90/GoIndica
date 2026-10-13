import Link from 'next/link';
import { member } from '@/server/auth';
import { check } from '@/lib/errors';
import { RequestComposer } from '@/components/request-composer';
export const metadata = { title: 'Novo pedido' };
export default async function NewRequest({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; q?: string }>;
}) {
  const { db, profile } = await member();
  const params = await searchParams;
  const id = Number(params.city) || profile.home_city_id;
  const found = await db.from('cities').select('*').eq('id', id).maybeSingle();
  const city =
    found.data ||
    check(await db.from('cities').select('*').eq('id', profile.home_city_id).single());
  return (
    <div className="form-page">
      <Link href="/app" className="back-link">
        ← Voltar para a cidade
      </Link>
      <p className="eyebrow">Vamos perguntar</p>
      <h1>Novo pedido</h1>
      <p className="muted">Conte o que precisa encontrar. Quem conhece a cidade pode ajudar.</p>
      <RequestComposer
        city={city}
        initialDescription={(params.q || '').trim().slice(0, 300)}
        draftKey={'goindica:request:v1:' + profile.id}
      />
    </div>
  );
}
