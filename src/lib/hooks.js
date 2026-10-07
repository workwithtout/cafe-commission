import { useCallback, useEffect, useRef, useState } from 'react';

/** Loads async data with loading / error / reload. */
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const alive = useRef(true);
  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fn();
      if (alive.current) setState({ data, loading: false, error: null });
    } catch (e) {
      if (alive.current) setState({ data: null, loading: false, error: e });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    alive.current = true;
    run();
    return () => { alive.current = false; };
  }, [run]);
  return { ...state, reload: run };
}

/**
 * Wraps a submit handler: blocks double-submits, surfaces errors, never reports success on failure.
 * Usage: const [submit, busy, error, clearError] = useSubmit(async () => {...})
 */
export function useSubmit(handler) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const lock = useRef(false);
  const submit = useCallback(async (...args) => {
    if (lock.current) return undefined;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      return await handler(...args);
    } catch (e) {
      setError(e.message || 'เกิดข้อผิดพลาด');
      return undefined;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }, [handler]);
  return [submit, busy, error, () => setError(null)];
}
