import { useCallback, useEffect, useRef, useState } from 'react';

export function readLocalJson<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value == null ? fallback : JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function writeLocalJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing and full stores can reject writes; the app stays usable in memory.
  }
}

export function removeLocalValue(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore unavailable localStorage.
  }
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
