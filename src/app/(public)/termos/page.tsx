import Link from 'next/link';
export const metadata = { title: 'Termos de uso', alternates: { canonical: '/termos' } };
export default function Terms() {
  return (
    <main id="conteudo" className="legal-page wrap">
      <p className="eyebrow">Atualizado em 14 de outubro de 2026</p>
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
      <h2>Cadastro de estabelecimentos</h2>
      <p>
        Nomes e endereços dos estabelecimentos são cadastrados pela comunidade. Informe dados
        corretos e escolha a cidade correspondente. Esses registros não têm validação automática por
        um serviço de mapas. Dados incorretos podem ser denunciados à administração.
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
