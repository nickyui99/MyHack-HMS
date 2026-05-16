import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseApiState<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
  refetch: () => Promise<void>;
}

/**
 * Generic data-fetching hook with cancellation. The fetcher is invoked once
 * on mount and whenever the dep array changes. Use `refetch()` to manually
 * re-run.
 */
export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
): UseApiState<T> {
  const [state, setState] = useState<{
    data: T | undefined;
    loading: boolean;
    error: Error | undefined;
  }>({ data: undefined, loading: true, error: undefined });

  // Track the latest call so a slow response doesn't overwrite a newer one.
  const seq = useRef(0);

  const run = useCallback(async () => {
    const mine = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    try {
      const data = await fetcher();
      if (mine !== seq.current) return;
      setState({ data, loading: false, error: undefined });
    } catch (err) {
      if (mine !== seq.current) return;
      setState({
        data: undefined,
        loading: false,
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
    return () => {
      seq.current++; // invalidate
    };
  }, [run]);

  return { ...state, refetch: run };
}
