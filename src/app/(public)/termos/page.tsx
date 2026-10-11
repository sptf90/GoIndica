import Link from 'next/link';
export const metadata = { title: 'Termos de uso', alternates: { canonical: '/termos' } };
export default function Terms() {
  return (
    <main id="conteudo" className="legal-page wrap">
      <p className="eyebrow">Atualizado em 10 de outubro de 2026</p>
      <h1>Termos de uso</h1>
      <p>
        O GoIndica conecta pessoas que procuram algo a pessoas que conhecem estabelecimentos na
        cidade. As indicações vêm da comunidade. O serviço não vende produtos, intermedeia
        pagamentos nem garante estoque, preços ou disponibilidade.
      </p>
      <h2>Participação</h2>
      <p>
        Use uma conta própria, forneça informações adequadas e publique somente conteúdo relevante.
        Não publique dados pessoais de terceiros, conteúdo ilícito, spam ou confirmações combinadas
        para manipular o ranking.
      </p>
      <h2>Indicações e resultados</h2>
      <p>
        Cada pessoa pode indicar um estabelecimento por pedido de outra pessoa. Ao abrir as
        indicações, o autor encerra o recebimento de novas respostas. A confirmação do resultado é
        definitiva. Cada indicação elegível do local confirmado gera 10 pontos sem valor financeiro.
        Os demais resultados não geram nem retiram pontos.
      </p>
      <h2>Moderação</h2>
      <p>
        Conteúdo pode ser denunciado e removido. A administração pode bloquear contas por abuso e
        registrar suas ações para auditoria. Uma indicação não confirmada não é automaticamente
        considerada incorreta.
      </p>
      <h2>Google Maps</h2>
      <p>
        Os dados dos estabelecimentos são fornecidos pelo Google Maps. Ao usar essas
        funcionalidades, aplicam-se também os{' '}
        <a
          href="https://maps.google.com/help/terms_maps/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Termos de Serviço do Google Maps
        </a>{' '}
        e a{' '}
        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
          Política de Privacidade do Google
        </a>
        .
      </p>
      <h2>Descobertas históricas</h2>
      <p>
        Um resultado registra onde algo foi encontrado em uma data. A disponibilidade pode ter
        mudado. Verifique diretamente com o estabelecimento antes de se deslocar.
      </p>
      <p>
        Use “Encontrei aqui também” somente se encontrou o mesmo item no estabelecimento confirmado.
        Essa reconfirmação registra uma nova experiência com data própria e não gera pontos. Envie
        fotos que você possa compartilhar para identificar o item, sem dados pessoais de terceiros.
      </p>
      <Link href="/privacidade" className="text-link">
        Ler a política de privacidade
      </Link>
    </main>
  );
}
