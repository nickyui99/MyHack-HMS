import { useCallback, useState } from 'react';

export interface UseMutationState<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
}

/**
 * Tiny mutation helper. Wraps an async fn and tracks loading/error/result so
 * call sites don't repeat the same try/catch boilerplate.
 */
export function useMutation<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
) {
  const [state, setState] = useState<UseMutationState<TResult>>({
    data: undefined,
    loading: false,
    error: undefined,
  });

  const run = useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      setState({ data: undefined, loading: true, error: undefined });
      try {
        const data = await fn(...args);
        setState({ data, loading: false, error: undefined });
        return data;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setState({ data: undefined, loading: false, error });
        return undefined;
      }
    },
    [fn],
  );

  const reset = useCallback(() => {
    setState({ data: undefined, loading: false, error: undefined });
  }, []);

  return { ...state, run, reset };
}
