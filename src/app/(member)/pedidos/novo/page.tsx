import { TaskPage } from '@/components/workspace-layout';
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
    <TaskPage
      title="Novo pedido"
      eyebrow="Vamos perguntar"
      description="Conte o que precisa encontrar. Quem conhece a cidade pode ajudar."
      back={{ href: '/app', label: 'Voltar para a cidade' }}
      guidance={{
        title: 'Uma boa pergunta abre caminhos', items: [
          'Descreva o produto ou serviço com detalhes que ajudem a reconhecer o que você procura.',
          'Confira a cidade e acrescente o bairro ou a região, se fizer diferença.',
          'Quando encontrar, registre o resultado para reconhecer quem ajudou.',
        ]
      }}
    >
      <RequestComposer
        city={city}
        initialDescription={(params.q || '').trim().slice(0, 300)}
        draftKey={'goindica:request:v1:' + profile.id}
      />
    </TaskPage>
  );
}
