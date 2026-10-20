import Link from 'next/link';
import { Brand } from '@/components/ui';
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="public-header">
        <div className="wrap">
          <Brand />
          <nav aria-label="Navegação principal">
            <Link className="desktop-link" href="/#como-funciona">
              Como funciona
            </Link>
            <Link className="desktop-link" href="/ranking">
              Ranking
            </Link>
            <Link className="text-link" href="/entrar">
              Entrar
            </Link>
            <Link className="button header-cta" href="/entrar">
              Começar agora
            </Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="public-footer wrap">
        <Brand />
        <p>O conhecimento da cidade, compartilhado.</p>
        <nav aria-label="Informações legais">
          <Link href="/cadastro?tipo=empresa">Para empresas</Link>
          <Link href="/privacidade">Privacidade</Link>
          <Link href="/termos">Termos de uso</Link>
        </nav>
      </footer>
    </>
  );
}
