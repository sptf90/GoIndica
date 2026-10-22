'use client';
import { MainContent } from '@/components/main-content';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <MainContent className="wrap error-page">
      <h1>Não foi possível carregar esta página.</h1>
      <p className="muted">
        Tente novamente em instantes. Suas confirmações já registradas continuam salvas.
      </p>
      <button className="button" onClick={reset}>
        Tentar novamente
      </button>
    </MainContent>
  );
}
