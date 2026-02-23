import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import type { Customer } from "@shared/types";

export function useAuth() {
  const { data: customer, isLoading } = useQuery<Customer | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  return {
    customer: customer ?? null,
    isLoading,
    isAuthenticated: !!customer,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
