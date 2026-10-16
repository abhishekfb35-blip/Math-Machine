import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

/**
 * CartGateContext coordinates cart surfaces with the promotional signup popup.
 *
 * Consumers:
 *  - SignupPopup: reports its visibility
 *  - ProductPage / QuickAddSheet: call gateAddToCart() instead of mutate() directly
 */

interface CartGateContextValue {
  /** Compatibility wrapper; guests may add items without a signup gate. */
  gateAddToCart: (fn: () => void, quantity?: number) => void;
  /** Retained for compatibility; guest cart actions are never signup-gated. */
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
  /** Internal — SignupPopup reports its visibility here. */
  _setSignupPopupOpen: (open: boolean) => void;
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
  _setSignupPopupOpen: () => {},
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
  const isGatePromptOpen = false;
  const [isSignupPopupOpen, setIsSignupPopupOpen] = useState(false);
  const [isMiniCartOpen, setMiniCartOpen] = useState(false);
  const [quickAddState, setQuickAddState] = useState<{
    openIds: Set<string>;
    closedAfterAdd: boolean;
  }>({ openIds: new Set(), closedAfterAdd: false });
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

  const gateAddToCart = useCallback((fn: () => void) => fn(), []);

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
        _setSignupPopupOpen,
      }}
    >
      {children}
    </CartGateContext.Provider>
  );
}
