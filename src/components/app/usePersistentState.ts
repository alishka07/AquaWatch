import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

export function usePersistentState<T>(
  key: string,
  initial: T,
  validate?: (value: unknown) => value is T,
): [T, Dispatch<SetStateAction<T>>, boolean] {
  const [value, setValue] = useState(initial);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (!validate || validate(parsed)) setValue(parsed as T);
      }
    } catch {
      /* Private browsing or an old cache: use the initial state. */
    }
    setReady(true);
    // Storage is read once per key, never over a user's current edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      window.dispatchEvent(new Event("aquawatch-storage-error"));
    }
  }, [key, value, ready]);
  return [value, setValue, ready];
}
