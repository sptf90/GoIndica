import Link from 'next/link';
import { Icon } from '@/components/icon';
import { member } from '@/server/auth';

export const metadata = { title: 'GoIndica' };

export default async function HomeActions() {
  const { profile } = await member();
  return (
    <div className="mvp-home">
      <section className="mvp-home-hero">
        <p className="eyebrow">GoIndica</p>
        <h1>Como você quer participar agora?</h1>
        <p className="muted">
          Três caminhos. Sem feed público na entrada — você escolhe pedir, indicar ou acompanhar
          o que já enviou.
        </p>
        {profile?.home_city_id ? (
          <p className="hint mvp-home-city">
            <Icon name="pin" size={16} /> Cidade do perfil usada como padrão nos fluxos.
          </p>
        ) : null}
      </section>
      <nav className="mvp-home-actions" aria-label="Ações principais">
        <Link className="mvp-home-action" href="/pedir">
          <span className="mvp-home-action-icon" aria-hidden="true">
            <Icon name="search" size={28} />
          </span>
          <strong>Pedir uma indicação</strong>
        </Link>
        <Link className="mvp-home-action" href="/fazer">
          <span className="mvp-home-action-icon" aria-hidden="true">
            <Icon name="message" size={28} />
          </span>
          <strong>Fazer uma indicação</strong>
        </Link>
        <Link className="mvp-home-action" href="/minhas-indicacoes">
          <span className="mvp-home-action-icon" aria-hidden="true">
            <Icon name="bookmark" size={28} />
          </span>
          <strong>Minhas indicações</strong>
        </Link>
      </nav>
    </div>
  );
}
