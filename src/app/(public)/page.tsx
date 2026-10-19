import Link from 'next/link';
import { Empty, Avatar } from '@/components/ui';
import { LandingAnalytics } from '@/components/landing-analytics';
import { configured, pilotCityId } from '@/lib/env';
import { database } from '@/lib/database/server';
export default async function Landing() {
  const db = configured() ? await database() : null;
  const pilot = pilotCityId();
  const cityResult = db
    ? await db.from('cities').select('name,state_code').eq('id', pilot).maybeSingle()
    : null;
  const cityLabel = cityResult?.data
    ? cityResult.data.name + ' — ' + cityResult.data.state_code
    : pilot === 3549805
      ? 'São José do Rio Preto — SP'
      : 'Comunidade local';
  const ranking = db ? await db.call('city_ranking', { p_city_id: pilot }) : null;
  return (
    <main id="conteudo">
      <LandingAnalytics />
      <section className="hero wrap">
        <div className="hero-copy">
          <p className="eyebrow">Conhecimento de quem vive aqui</p>
          <h1>
            Procurando algo
            <br className="desktop-break" /> na sua cidade?
            <br />
            <span>
              Pergunte para
              <br className="desktop-break" /> quem conhece.
            </span>
          </h1>
          <p className="lead">
            Publique o que você precisa encontrar, receba indicações de lugares reais e confirme
            onde encontrou.
          </p>
          <div className="hero-actions">
            <Link href="/entrar" className="button">
              Perguntar à cidade <span aria-hidden="true">↗</span>
            </Link>
            <Link href="#como-funciona" className="text-link">
              Entender como funciona ↓
            </Link>
          </div>
          <p className="hero-note">Respostas de pessoas. Descobertas de verdade.</p>
        </div>
        <div className="demo-board" aria-label="Demonstração do funcionamento">
          <div className="demo-top">
            <span>Uma pergunta abre caminhos.</span>
            <span className="eyebrow">Demonstração</span>
          </div>
          <div className="demo-question">
            <p className="eyebrow">{cityLabel}</p>
            <h2>
              Onde encontro uma
              <br />
              massa italiana específica?
            </h2>
            <div className="demo-count">
              <span className="demo-dots" aria-hidden="true">
                ● ● ●
              </span>
              <span>3 pessoas indicaram um local</span>
            </div>
          </div>
          <div className="demo-line" aria-hidden="true">
            ↓
          </div>
          <div className="demo-answer">
            <span className="status status-resolved">Encontrado</span>
            <h3>No Empório A.</h3>
            <p>
              João e Maria indicaram o mesmo lugar.
              <br />
              Os dois recebem <strong>+10 pontos.</strong>
            </p>
            <div className="demo-people">
              <span>J</span>
              <span>M</span>
              <p>Quem ajudou recebe o reconhecimento.</p>
            </div>
          </div>
          <p className="hint">Exemplo ilustrativo. A comunidade fornece as indicações.</p>
        </div>
      </section>
      <section id="como-funciona" className="how-section">
        <div className="wrap">
          <div className="section-heading">
            <p className="eyebrow">Do “onde tem?” ao “encontrei”.</p>
            <h2>
              Você pergunta.
              <br />A cidade ajuda.
            </h2>
          </div>
          <ol className="steps">
            <li>
              <span>01</span>
              <h3>Pergunte</h3>
              <p>Conte o que precisa encontrar e escolha a cidade.</p>
            </li>
            <li>
              <span>02</span>
              <h3>Receba indicações</h3>
              <p>Pessoas que conhecem a região sugerem estabelecimentos reais.</p>
            </li>
            <li>
              <span>03</span>
              <h3>Encontre</h3>
              <p>
                Abra as indicações e verifique os locais. Ao abrir, novas respostas são bloqueadas.
              </p>
            </li>
            <li>
              <span>04</span>
              <h3>Confirme</h3>
              <p>Quem indicou o lugar em que você encontrou recebe 10 pontos.</p>
            </li>
          </ol>
        </div>
      </section>
      <section className="memory wrap">
        <div>
          <p className="eyebrow">Um conhecimento que fica</p>
          <h2>
            Cada pergunta resolvida
            <br />
            abre um caminho
            <br />
            para a próxima pessoa.
          </h2>
        </div>
        <div>
          <p className="lead small">
            Uma peça difícil de achar. Um ingrediente de família. Um serviço perto de casa.
          </p>
          <p className="muted">
            As descobertas confirmadas ficam no histórico da cidade. Antes de perguntar, você pode
            encontrar o caminho que outra pessoa já percorreu.
          </p>
          <p className="hint">Uma descoberta anterior não garante disponibilidade atual.</p>
          <Link className="text-link" href="/entrar">
            Explorar minha cidade ↗
          </Link>
        </div>
      </section>
      <section className="community wrap">
        <div className="section-heading">
          <p className="eyebrow">Quem conhece, compartilha</p>
          <h2>
            Pessoas que ajudam
            <br />a cidade a encontrar.
          </h2>
          <p className="muted">{cityLabel}</p>
        </div>
        <div className="ranking-preview">
          {ranking?.data?.length ? (
            ranking.data.slice(0, 3).map((p) => (
              <div className="ranking-row" key={p.username}>
                <span className="rank-number">{p.position}</span>
                <Avatar name={p.display_name} />
                <div>
                  <strong>{p.display_name}</strong>
                  <p className="hint">@{p.username}</p>
                </div>
                <strong>
                  {p.points}
                  <span className="hint"> pontos</span>
                </strong>
              </div>
            ))
          ) : (
            <Empty headingLevel={3} title="A próxima descoberta pode começar com você.">
              O ranking aparece quando a comunidade confirma suas primeiras indicações.
            </Empty>
          )}
          <Link href="/ranking" className="text-link">
            Ver ranking da comunidade ↗
          </Link>
        </div>
      </section>
      <section className="final-cta wrap">
        <p className="eyebrow">Tem uma pergunta?</p>
        <h2>
          Talvez alguém da sua
          <br />
          cidade saiba a resposta.
        </h2>
        <Link href="/entrar" className="button">
          Fazer minha primeira pergunta ↗
        </Link>
      </section>
    </main>
  );
}
