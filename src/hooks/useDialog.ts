import { useCallback, useRef, useState } from 'react';
import type { DialogOptions } from '../components/Dialog';

export function useDialog() {
  const [options, setOptions] = useState<DialogOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((next: DialogOptions): Promise<boolean> => {
    resolver.current?.(false);
    setOptions(next);
    return new Promise((resolve) => { resolver.current = resolve; });
  }, []);

  const result = useCallback((value: boolean) => {
    setOptions(null);
    resolver.current?.(value);
    resolver.current = null;
  }, []);

  return { options, confirm, result };
}
