import { optionalEnv } from '@/lib/env';
import Link from 'next/link';
export const metadata = { title: 'Privacidade', alternates: { canonical: '/privacidade' } };
export default function Privacy() {
  const address = optionalEnv('NEXT_PUBLIC_SUPPORT_EMAIL');
  const contact = address && !address.endsWith('@example.com') ? address : null;
  return (
    <main id="conteudo" className="legal-page wrap">
      <p className="eyebrow">Atualizado em 16 de outubro de 2026</p>
      <h1>Privacidade</h1>
      <p>
        Sua conta usa e-mail e senha. A aplicação e o banco são hospedados na Hostinger. Guardamos
        somente um hash da senha, e o e-mail da conta não é mostrado publicamente.
      </p>
      <h2>Dados usados pelo serviço</h2>
      <p>
        Seu nome de exibição, nome de usuário e cidade principal compõem seu perfil. Pedidos,
        indicações, resoluções e recompensas são registrados para oferecer o serviço e manter a
        integridade da pontuação.
      </p>
      <p>
        Antes da revelação, os locais indicados por outras pessoas ficam privados. Depois da
        resolução, o local confirmado pode ser consultado como descoberta histórica. A administração
        pode consultar denúncias e logs de ações para moderação.
      </p>
      <p>
        Fotos opcionais dos pedidos ficam disponíveis para pessoas autenticadas que possam consultar
        o pedido. Processamos as imagens para reduzir seu tamanho e remover metadados. As fotos
        fazem parte da exportação dos seus dados e são apagadas no encerramento da conta.
      </p>
      <h2>Fornecedores e cookies</h2>
      <p>
        A Hostinger hospeda a aplicação, o banco de dados e o envio de e-mails. Cookies essenciais
        mantêm sua sessão. Contamos visitas e ações de forma agregada, sem ferramentas de
        publicidade. Para limitar abuso, usamos identificadores técnicos derivados do endereço IP e
        do e-mail, sem registrar esses valores brutos nos contadores temporários.
      </p>
      <p>
        Ao buscar um estabelecimento, enviamos o texto digitado, a cidade do pedido e um token
        temporário de sessão ao Google Maps Platform para obter sugestões e validar o local. Não
        enviamos seu e-mail ou senha nessa consulta. O identificador do estabelecimento é guardado;
        os nomes e endereços do Google são consultados sem armazenamento permanente. Consulte também
        a <a href="https://policies.google.com/privacy">Política de Privacidade do Google</a>.
      </p>
      <h2>Preferências, lembretes e dados no dispositivo</h2>
      <p>
        Notificações internas avisam sobre indicações e resultados. Lembretes por e-mail só são
        enviados quando você ativa essa preferência; a Hostinger entrega essas mensagens. Você pode
        desativá-los em Preferências. Os sinais de utilidade das descobertas são associados à sua
        conta para evitar avaliações repetidas.
      </p>
      <p>
        Rascunhos são salvos neste navegador por até sete dias, separados por conta, com opção de
        apagar. O aplicativo instalável guarda apenas uma página neutra para falta de conexão, sem
        salvar páginas autenticadas ou respostas privadas.
      </p>
      <p>
        Alertas por assunto e a lista de pedidos que você também procura são privados. O pedido
        mostra apenas o total de pessoas interessadas. Reconfirmações registram que você encontrou o
        mesmo item no local histórico; mostramos o total e a data mais recente, sem listar as
        pessoas. Você pode remover alertas em Preferências. Ao baixar e compartilhar um card, você
        divulga o texto do pedido, a cidade e o link; o card não inclui respostas privadas.
      </p>
      <h2>Seus direitos</h2>
      <p>
        Em Minha conta você pode exportar seus dados, alterar credenciais e solicitar o
        encerramento. Também pode alterar seu perfil na aplicação e solicitar acesso, correção,
        anonimização ou exclusão dos seus dados ao responsável pelo serviço. Registros necessários à
        integridade do histórico podem ser conservados conforme a legislação aplicável, sem divulgar
        dados pessoais desnecessários.
      </p>
      {contact ? (
        <p>
          Contato: <a href={'mailto:' + contact}>{contact}</a>.
        </p>
      ) : (
        <p>
          O canal de contato do responsável pelo serviço será informado antes da abertura ao
          público.
        </p>
      )}
      <Link href="/" className="text-link">
        Voltar ao início
      </Link>
    </main>
  );
}
