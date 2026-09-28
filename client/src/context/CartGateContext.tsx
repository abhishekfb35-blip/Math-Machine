import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

/**
 * CartGateContext — coordinates the hard gate that blocks add-to-cart
 * for unauthenticated users after they dismiss the signup popup while
 * having at least one item in the cart.
 *
 * Consumers:
 *  - SignupPopup: registers forceShow, notifies on auth/dismiss
 *  - ProductPage / QuickAddSheet: call gateAddToCart() instead of mutate() directly
 */

interface CartGateContextValue {
  /** Wrap every add-to-cart call with this. Blocks and shows popup when gate is active. */
  gateAddToCart: (fn: () => void, quantity?: number) => void;
  /** True while the hard-gate sign-in popup owns interaction over a cart surface. */
  isGatePromptOpen: boolean;
  /** True while the shared signup popup is visible above a cart surface. */
  isSignupPopupOpen: boolean;
  /** True while at least one Quick Add sheet is open. */
  isQuickAddOpen: boolean;
  /** True while the header mini-cart drawer is open. */
  isMiniCartOpen: boolean;
  /** True when the last Quick Add sheet closed after a successful add. */
  quickAddClosedAfterAdd: boolean;
  /** Register a Quick Add sheet's visibility with the global popup coordinator. */
  setQuickAddOpen: (instanceId: string, open: boolean, closedAfterAdd?: boolean) => void;
  /** Register the header mini-cart drawer's visibility with the popup coordinator. */
  setMiniCartOpen: (open: boolean) => void;
  /** Internal — SignupPopup registers its force-show function here. */
  _registerOpen: (fn: () => void) => void;
  /** Internal — SignupPopup reports its visibility here. */
  _setSignupPopupOpen: (open: boolean) => void;
  /** Internal — SignupPopup calls this when the popup is dismissed. */
  _onDismissed: () => void;
  /** Internal — SignupPopup calls this when auth succeeds. */
  _onAuthSuccess: () => void;
}

const CartGateContext = createContext<CartGateContextValue>({
  gateAddToCart: (fn) => fn(),
  isGatePromptOpen: false,
  isSignupPopupOpen: false,
  isQuickAddOpen: false,
  isMiniCartOpen: false,
  quickAddClosedAfterAdd: false,
  setQuickAddOpen: () => {},
  setMiniCartOpen: () => {},
  _registerOpen: () => {},
  _setSignupPopupOpen: () => {},
  _onDismissed: () => {},
  _onAuthSuccess: () => {},
});

/** Used by ProductPage / QuickAddSheet */
export const useCartGate = () => {
  const {
    gateAddToCart,
    isGatePromptOpen,
    isSignupPopupOpen,
    setQuickAddOpen,
    isMiniCartOpen,
    setMiniCartOpen,
  } = useContext(CartGateContext);
  return {
    gateAddToCart,
    isGatePromptOpen,
    isSignupPopupOpen,
    setQuickAddOpen,
    isMiniCartOpen,
    setMiniCartOpen,
  };
};

/** Used internally by SignupPopup */
export const useCartGateInternal = () => useContext(CartGateContext);

export function CartGateProvider({ children }: { children: ReactNode }) {
  const [isGatePromptOpen, setIsGatePromptOpen] = useState(false);
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [isSignupPopupOpen, setIsSignupPopupOpen] = useState(false);
  const [isMiniCartOpen, setMiniCartOpen] = useState(false);
  const [quickAddState, setQuickAddState] = useState<{
    openIds: Set<string>;
    closedAfterAdd: boolean;
  }>({ openIds: new Set(), closedAfterAdd: false });
  const pendingFn = useRef<(() => void) | null>(null);
  const openPopupFn = useRef<() => void>(() => {});
  const _registerOpen = useCallback((fn: () => void) => {
    openPopupFn.current = fn;
  }, []);

  const _setSignupPopupOpen = useCallback((open: boolean) => {
    setIsSignupPopupOpen(open);
  }, []);

  const setQuickAddOpen = useCallback((
    instanceId: string,
    open: boolean,
    closedAfterAdd = false,
  ) => {
    setQuickAddState((current) => {
      const openIds = new Set(current.openIds);
      if (open) {
        openIds.add(instanceId);
        return { openIds, closedAfterAdd: false };
      }

      const wasOpen = openIds.delete(instanceId);
      if (!wasOpen) return current;
      return {
        openIds,
        closedAfterAdd: openIds.size === 0 && closedAfterAdd,
      };
    });
  }, []);

  const _onDismissed = useCallback(() => {
    setIsGatePromptOpen(false);
    pendingFn.current = null;
  }, []);

  const _onAuthSuccess = useCallback(() => {
    const fn = pendingFn.current;
    pendingFn.current = null;
    setIsGatePromptOpen(false);
    if (fn) fn();
  }, []);

  const gateAddToCart = useCallback(
    (fn: () => void, quantity = 1) => {
      if (isAuthenticated || authLoading) {
        fn();
        return;
      }

      const checkCart = async () => {
        let cart = queryClient.getQueryData<{ itemCount?: number }>(["/api/cart"]);
        if (!cart) {
          try {
            cart = await queryClient.fetchQuery<{ itemCount?: number }>({
              queryKey: ["/api/cart"],
            });
          } catch {
            // The server remains authoritative if the cart cannot be fetched here.
            fn();
            return;
          }
        }

        if ((cart.itemCount ?? 0) + quantity > 1) {
          pendingFn.current = fn;
          setIsGatePromptOpen(true);
          openPopupFn.current();
          return;
        }

        fn();
      };

      void checkCart();
    },
    [authLoading, isAuthenticated, queryClient],
  );

  return (
    <CartGateContext.Provider
      value={{
        gateAddToCart,
        isGatePromptOpen,
        isSignupPopupOpen,
        isQuickAddOpen: quickAddState.openIds.size > 0,
        isMiniCartOpen,
        quickAddClosedAfterAdd: quickAddState.closedAfterAdd,
        setQuickAddOpen,
        setMiniCartOpen,
        _registerOpen,
        _setSignupPopupOpen,
        _onDismissed,
        _onAuthSuccess,
      }}
    >
      {children}
    </CartGateContext.Provider>
  );
}
