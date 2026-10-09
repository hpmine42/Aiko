import { useCallback, useEffect, useRef, useState } from 'react';
import { LEGACY_LS, LS } from '../utils/config';

export function readLocalJson<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value == null ? fallback : JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function writeLocalJson(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Private browsing and full stores can reject writes; the app stays usable in memory.
    return false;
  }
}

export function removeLocalValue(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore unavailable localStorage.
  }
}

export type StoredDataKey = keyof typeof LS;

export function readVersionedLocalJson<T>(key: StoredDataKey, fallback: T): T {
  const current = readLocalJson<unknown>(LS[key], null);
  return (current == null ? readLocalJson<unknown>(LEGACY_LS[key], fallback) : current) as T;
}

export function writeVersionedLocalJson(key: StoredDataKey, value: unknown): boolean {
  const saved = writeLocalJson(LS[key], value);
  if (saved) removeLocalValue(LEGACY_LS[key]);
  return saved;
}

export function removeVersionedLocalValue(key: StoredDataKey): void {
  removeLocalValue(LS[key]);
  removeLocalValue(LEGACY_LS[key]);
}

export function useLocalStorageState<T>(
  key: string,
  initial: () => T,
  serialize: (value: T) => unknown = (value) => value,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const initialRef = useRef(initial);
  const [value, setValue] = useState<T>(() => initialRef.current());

  useEffect(() => {
    writeLocalJson(key, serialize(value));
  }, [key, serialize, value]);

  return [value, setValue];
}

export function useLatest<T>(value: T): React.MutableRefObject<T> {
  const ref = useRef(value);
  useEffect(() => { ref.current = value; }, [value]);
  return ref;
}

export function useStableCallback<Args extends unknown[], Result>(
  callback: (...args: Args) => Result,
): (...args: Args) => Result {
  const callbackRef = useLatest(callback);
  return useCallback((...args: Args) => callbackRef.current(...args), [callbackRef]);
}
