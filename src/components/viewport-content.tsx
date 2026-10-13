import type { ReactNode } from 'react';

// The document owns scrolling, including browser history and keyboard focus.
export function ViewportContent({ children }: { children: ReactNode }) {
  return <div className="app-content">{children}</div>;
}
