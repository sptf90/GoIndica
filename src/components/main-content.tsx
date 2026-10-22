'use client';

import { createContext, useContext, type ReactNode } from 'react';

const InsideMain = createContext(false);

// Route fallbacks can render either inside a shell or directly under the root layout.
export function MainContent({ children, className }: { children?: ReactNode; className: string }) {
  const nested = useContext(InsideMain);
  if (nested) return <div className={className}>{children}</div>;
  return (
    <main id="conteudo" className={className} tabIndex={-1}>
      <InsideMain value={true}>{children}</InsideMain>
    </main>
  );
}
