import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from "@tanstack/react-query";

type ApiResponse<T> = {
  data?: T;
  error?: string;
  success: boolean;
};

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Network error" }));
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  const result: ApiResponse<T> = await response.json();

  if (!result.success) {
    throw new Error(result.error || "API request failed");
  }

  return result.data!;
}

export function useApiQuery<T>(
  key: string | (string | number)[],
  url: string,
  options?: Omit<UseQueryOptions<T, Error, T, string[]>, "queryKey" | "queryFn">,
) {
  const queryKey = Array.isArray(key) ? key.map(String) : [key];

  return useQuery({
    queryKey,
    queryFn: () => apiFetch<T>(url),
    ...options,
  });
}

export function useApiMutation<TData, TVariables = any>(
  url: string,
  method: "POST" | "PUT" | "DELETE" | "PATCH" = "POST",
  options?: {
    invalidateQueries?: string[][];
    onSuccess?: (data: TData, variables: TVariables) => void;
    onError?: (error: Error, variables: TVariables) => void;
  } & Omit<UseMutationOptions<TData, Error, TVariables>, "mutationFn">,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: TVariables) => {
      return apiFetch<TData>(url, {
        method,
        body: JSON.stringify(variables),
      });
    },
    onSuccess: (data: TData, variables: TVariables) => {
      options?.invalidateQueries?.forEach((queryKey) => {
        queryClient.invalidateQueries({ queryKey });
      });

      options?.onSuccess?.(data, variables);
    },
    onError: options?.onError,
    ...options,
  });
}

export function buildQueryKey(base: string, params?: Record<string, any>): string[] {
  if (!params) return [base];

  const paramString = Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${value}`)
    .join(",");

  return paramString ? [base, paramString] : [base];
}

export function useApiQueryWithParams<T>(
  baseKey: string,
  url: string,
  params?: Record<string, any>,
  options?: Omit<UseQueryOptions<T, Error, T, string[]>, "queryKey" | "queryFn">,
) {
  const queryKey = buildQueryKey(baseKey, params);
  const urlWithParams = params ? `${url}?${new URLSearchParams(params).toString()}` : url;

  return useQuery({
    queryKey,
    queryFn: () => apiFetch<T>(urlWithParams),
    ...options,
  });
} 