import { useState, useEffect, useCallback, useRef } from "react";

interface RequestState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

function useRequest<T>(
  requestFn: () => Promise<T>,
  deps: React.DependencyList = []
): RequestState<T> & { refresh: () => void } {
  const [state, setState] = useState<RequestState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const mountedRef = useRef(true);

  const run = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await requestFn();
      if (mountedRef.current) setState({ data, loading: false, error: null });
    } catch (err) {
      if (mountedRef.current)
        setState({ data: null, loading: false, error: err as Error });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    run();
    return () => { mountedRef.current = false; };
  }, [run]);

  return { ...state, refresh: run };
}

export default useRequest;
