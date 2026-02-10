import { useQuery } from "@tanstack/react-query";

export function useSiteConfig<T>(key: string, defaultValue: T): T {
  const { data } = useQuery<Record<string, any>>({
    queryKey: ["/api/site-config"],
  });

  if (data && data[key] !== undefined) {
    return data[key] as T;
  }

  return defaultValue;
}
