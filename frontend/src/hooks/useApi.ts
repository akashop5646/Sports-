import { useState, useEffect, useCallback, useRef } from "react";

// Pub-sub client for query invalidation
class QueryEventManager {
  listeners = new Set<(key: string[]) => void>();

  subscribe(listener: (key: string[]) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(key: string[]) {
    this.listeners.forEach((listener) => listener(key));
  }
}

const queryEvents = new QueryEventManager();

const globalQueryCache = new Map<string, any>();

export function clearQueryCache() {
  globalQueryCache.clear();
}

export function useQuery<T = any>({
  queryKey,
  queryFn,
  enabled = true,
  refetchInterval,
}: {
  queryKey: any[];
  queryFn: () => Promise<T>;
  enabled?: boolean;
  refetchInterval?: number;
}) {
  const cacheKey = JSON.stringify(queryKey);
  const cachedData = globalQueryCache.get(cacheKey);

  const [data, setData] = useState<T | undefined>(cachedData);
  const [isLoading, setIsLoading] = useState(enabled && cachedData === undefined);
  const [error, setError] = useState<any>(null);

  const queryFnRef = useRef(queryFn);
  queryFnRef.current = queryFn;

  const fetchData = useCallback(async (showLoading = true) => {
    // Only show loading if we don't have cached data
    if (showLoading && globalQueryCache.get(cacheKey) === undefined) {
      setIsLoading(true);
    }
    setError(null);
    try {
      const result = await queryFnRef.current();
      globalQueryCache.set(cacheKey, result);
      setData(result);
    } catch (err) {
      console.error("useQuery error fetching:", queryKey, err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [cacheKey]);

  // Run query on mount or key changes
  useEffect(() => {
    if (enabled) {
      const hasCache = globalQueryCache.get(cacheKey) !== undefined;
      fetchData(!hasCache);
    } else {
      setIsLoading(false);
    }
  }, [enabled, cacheKey, fetchData]);

  // Subscribe to query invalidations
  useEffect(() => {
    return queryEvents.subscribe((invalidatedKey) => {
      // If the invalidated key is a sub-prefix of our queryKey, refetch
      const isMatch = invalidatedKey.every((part, idx) => queryKey[idx] === part);
      if (isMatch && enabled) {
        fetchData(false);
      }
    });
  }, [enabled, cacheKey, fetchData]);

  // Realtime polling
  useEffect(() => {
    if (!enabled) return;
    const intervalTime = refetchInterval !== undefined ? refetchInterval : 3000;
    if (intervalTime <= 0) return;

    const interval = setInterval(() => {
      fetchData(false);
    }, intervalTime);

    return () => clearInterval(interval);
  }, [enabled, refetchInterval, fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch: () => fetchData(true),
  };
}

export function useMutation<TData = any, TVariables = any>({
  mutationFn,
  onSuccess,
  onError,
}: {
  mutationFn: (variables: TVariables) => Promise<TData>;
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: any, variables: TVariables) => void;
}) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<any>(null);

  const mutationFnRef = useRef(mutationFn);
  mutationFnRef.current = mutationFn;

  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const mutate = useCallback(
    async (variables?: TVariables) => {
      setIsPending(true);
      setError(null);
      try {
        const result = await mutationFnRef.current(variables as TVariables);
        if (onSuccessRef.current) {
          onSuccessRef.current(result, variables as TVariables);
        }
        return result;
      } catch (err) {
        setError(err);
        if (onErrorRef.current) {
          onErrorRef.current(err, variables as TVariables);
        }
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    []
  );

  return {
    mutate,
    mutateAsync: mutate,
    isPending,
    error,
  };
}

export class QueryClient {
  invalidateQueries({ queryKey }: { queryKey: string[] }) {
    queryEvents.emit(queryKey);
  }
}

const defaultQueryClient = new QueryClient();

export function useQueryClient() {
  return defaultQueryClient;
}

// Dummy provider to keep context wrapper happy
export function QueryClientProvider({ children }: { children: React.ReactNode; client?: any }) {
  return children;
}
