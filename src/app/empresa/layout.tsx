import { Brand } from '@/components/ui';
import { logout } from '@/server/actions';
import { MainContent } from '@/components/main-content';
export const metadata = { robots: { index: false, follow: false } };
export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="onboarding-shell company-shell">
      <header className="public-header">
        <div className="wrap">
          <Brand href="/empresa" />
          <form action={logout}>
            <button className="text-link">Sair</button>
          </form>
        </div>
      </header>
      <MainContent className="app-main wrap">
        {children}
      </MainContent>
    </div>
  );
}
