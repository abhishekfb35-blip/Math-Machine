import { useQuery } from "@tanstack/react-query";

interface CartOfferThresholds {
  engineThresholds: {
    retailFreeItemTrigger: number;
    retailBonusDiscountPct: number;
    wholesaleThreshold: number;
  } | null;
}

export function useOfferLabel(): string {
  const { data } = useQuery<CartOfferThresholds>({
    queryKey: ["/api/cart"],
    staleTime: 5 * 60 * 1000,
  });

  const trigger = data?.engineThresholds?.retailFreeItemTrigger ?? 3;
  return `Buy ${trigger - 1} Get 1 Free`;
}
