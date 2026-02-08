import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type InsertHistory } from "@shared/routes";

// GET /api/history
export function useHistory() {
  return useQuery({
    queryKey: [api.history.list.path],
    queryFn: async () => {
      const res = await fetch(api.history.list.path, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch history');
      return api.history.list.responses[200].parse(await res.json());
    },
  });
}

// POST /api/history
export function useCreateHistory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertHistory) => {
      const validated = api.history.create.input.parse(data);
      const res = await fetch(api.history.create.path, {
        method: api.history.create.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error('Failed to save calculation');
      return api.history.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.history.list.path] });
    },
  });
}

// DELETE /api/history
export function useClearHistory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(api.history.clear.path, { 
        method: api.history.clear.method,
        credentials: "include" 
      });
      if (!res.ok) throw new Error('Failed to clear history');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.history.list.path] });
    },
  });
}
