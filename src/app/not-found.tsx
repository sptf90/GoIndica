import Link from 'next/link';
import { MainContent } from '@/components/main-content';
export default function NotFound() {
  return (
    <MainContent className="wrap error-page">
      <p className="eyebrow">Este caminho não está disponível</p>
      <h1>Pedido ou página não encontrado.</h1>
      <p className="muted">O conteúdo pode ter sido removido ou o endereço está incorreto.</p>
      <Link href="/app" className="button">
        Voltar para a cidade
      </Link>
    </MainContent>
  );
}
