import type { ReactNode } from 'react';

/** Main mobile chat layout. Behaviour stays in the typed child components/hooks. */
export function Chat({ children }: { children: ReactNode }) {
  return <div id="app">{children}</div>;
}
