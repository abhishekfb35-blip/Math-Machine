import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";

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
  gateAddToCart: (fn: () => void) => void;
  /** Internal — SignupPopup registers its force-show function here. */
  _registerOpen: (fn: () => void) => void;
  /** Internal — SignupPopup calls this when the popup is dismissed. */
  _onDismissed: () => void;
  /** Internal — SignupPopup calls this when auth succeeds. */
  _onAuthSuccess: () => void;
}

const CartGateContext = createContext<CartGateContextValue>({
  gateAddToCart: (fn) => fn(),
  _registerOpen: () => {},
  _onDismissed: () => {},
  _onAuthSuccess: () => {},
});

/** Used by ProductPage / QuickAddSheet */
export const useCartGate = () => {
  const { gateAddToCart } = useContext(CartGateContext);
  return { gateAddToCart };
};

/** Used internally by SignupPopup */
export const useCartGateInternal = () => useContext(CartGateContext);

export function CartGateProvider({ children }: { children: ReactNode }) {
  const [gateActive, setGateActive] = useState(false);
  const pendingFn = useRef<(() => void) | null>(null);
  const openPopupFn = useRef<() => void>(() => {});
  const hasCartActivity = useRef(false);

  const _registerOpen = useCallback((fn: () => void) => {
    openPopupFn.current = fn;
  }, []);

  const _onDismissed = useCallback(() => {
    // Only activate the hard gate when the user has already added something to cart.
    if (hasCartActivity.current) {
      setGateActive(true);
    }
    pendingFn.current = null;
  }, []);

  const _onAuthSuccess = useCallback(() => {
    const fn = pendingFn.current;
    pendingFn.current = null;
    setGateActive(false);
    hasCartActivity.current = false;
    if (fn) fn();
  }, []);

  const gateAddToCart = useCallback(
    (fn: () => void) => {
      if (gateActive) {
        pendingFn.current = fn;
        openPopupFn.current();
      } else {
        fn();
        hasCartActivity.current = true;
      }
    },
    [gateActive],
  );

  return (
    <CartGateContext.Provider value={{ gateAddToCart, _registerOpen, _onDismissed, _onAuthSuccess }}>
      {children}
    </CartGateContext.Provider>
  );
}
