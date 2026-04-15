import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "./useAuth";
import { apiRequest } from "@/lib/queryClient";

const LS_KEY = "tl_wishlist";

function getLocalIds(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setLocalIds(ids: string[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(ids));
  } catch {}
}

export function useWishlist() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const synced = useRef(false);
  const prevAuthenticated = useRef<boolean | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      const local = getLocalIds();
      setWishlistIds(new Set(local));
      prevAuthenticated.current = false;
      synced.current = false;
      return;
    }

    const wasGuest = prevAuthenticated.current === false;
    prevAuthenticated.current = true;

    const load = async () => {
      try {
        if (wasGuest && !synced.current) {
          const guestIds = getLocalIds();
          if (guestIds.length > 0) {
            const res = await apiRequest("POST", "/api/wishlist/sync", { productIds: guestIds });
            const data = await res.json();
            setWishlistIds(new Set(data.productIds ?? []));
            localStorage.removeItem(LS_KEY);
            synced.current = true;
            return;
          }
          localStorage.removeItem(LS_KEY);
        }
        const res = await fetch("/api/wishlist");
        if (res.ok) {
          const data = await res.json();
          setWishlistIds(new Set(data.productIds ?? []));
        }
      } catch {}
      synced.current = true;
    };

    load();
  }, [isAuthenticated, authLoading]);

  const toggle = useCallback(async (productId: string) => {
    const currently = wishlistIds.has(productId);

    if (!isAuthenticated) {
      const next = new Set(wishlistIds);
      if (currently) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      setWishlistIds(next);
      setLocalIds([...next]);
      if (!currently) {
        window.dispatchEvent(new CustomEvent("wishlist:item-added"));
      }
      return;
    }

    setWishlistIds(prev => {
      const next = new Set(prev);
      if (currently) next.delete(productId);
      else next.add(productId);
      return next;
    });

    try {
      if (currently) {
        await apiRequest("DELETE", `/api/wishlist/${productId}`);
      } else {
        await apiRequest("POST", "/api/wishlist", { productId });
      }
    } catch {
      setWishlistIds(prev => {
        const next = new Set(prev);
        if (currently) next.add(productId);
        else next.delete(productId);
        return next;
      });
    }
  }, [isAuthenticated, wishlistIds]);

  return {
    wishlistIds,
    isWishlisted: (productId: string) => wishlistIds.has(productId),
    toggle,
    count: wishlistIds.size,
  };
}
