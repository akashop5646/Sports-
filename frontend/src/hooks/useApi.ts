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

// Track in-flight requests to deduplicate concurrent fetches for the same key
const inFlightRequests = new Map<string, Promise<any>>();

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
    // Only show loading spinner if we don't have cached data
    if (showLoading && globalQueryCache.get(cacheKey) === undefined) {
      setIsLoading(true);
    }
    setError(null);

    try {
      // Deduplicate: if same request is already in-flight, reuse it
      let result: T;
      const existing = inFlightRequests.get(cacheKey);
      if (existing) {
        result = await existing;
      } else {
        const promise = queryFnRef.current();
        inFlightRequests.set(cacheKey, promise);
        try {
          result = await promise;
        } finally {
          inFlightRequests.delete(cacheKey);
        }
      }

      globalQueryCache.set(cacheKey, result);
      setData(result);
    } catch (err) {
      console.error("useQuery error fetching:", queryKey, err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [cacheKey]);

  // Stale-while-revalidate: if we have cached data, show it immediately
  // then silently refetch in the background
  useEffect(() => {
    if (enabled) {
      const hasCache = globalQueryCache.get(cacheKey) !== undefined;
      if (hasCache) {
        // Show cached data immediately, refetch silently (no loading spinner)
        setData(globalQueryCache.get(cacheKey));
        fetchData(false);
      } else {
        fetchData(true);
      }
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

  // Polling — DEFAULT IS OFF (0). Only polls if caller explicitly sets refetchInterval > 0.
  useEffect(() => {
    if (!enabled) return;
    const intervalTime = refetchInterval !== undefined ? refetchInterval : 0;
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
  onMutate,
}: {
  mutationFn: (variables: TVariables) => Promise<TData>;
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: any, variables: TVariables) => void;
  onMutate?: (variables: TVariables) => void;
}) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<any>(null);

  const mutationFnRef = useRef(mutationFn);
  mutationFnRef.current = mutationFn;

  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const onMutateRef = useRef(onMutate);
  onMutateRef.current = onMutate;

  const mutate = useCallback(
    async (variables?: TVariables) => {
      setIsPending(true);
      setError(null);

      // Call onMutate for optimistic updates before the request fires
      if (onMutateRef.current) {
        onMutateRef.current(variables as TVariables);
      }

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
