import type { ReactNode } from 'react';

/** Main mobile chat layout. Behaviour stays in the typed child components/hooks. */
export function Chat({ children, inert = false }: { children: ReactNode; inert?: boolean }) {
  return <div id="app" inert={inert ? true : undefined} aria-hidden={inert || undefined}>{children}</div>;
}
