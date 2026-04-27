import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Heart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { showSignInModal } from "@/components/SignInModal";
import { getProductImageUrl } from "@/lib/imageUtils";

interface WishlistProduct {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  galleryImages: string[];
}

const SESSION_KEY = "tl_wishlist_prompt_dismissed";
const CONFIG_KEY = "wishlist-signup-prompt";

const EXCLUDED_PREFIXES = ["/admin", "/signin", "/checkout", "/order"];

interface WishlistPromptConfig {
  enabled: boolean;
  delaySeconds: number;
  headline: string;
  bodyText: string;
  ctaText: string;
}

const DEFAULTS: WishlistPromptConfig = {
  enabled: true,
  delaySeconds: 5,
  headline: "Don't lose your picks!",
  bodyText: "Create a free account to save your wishlist and pick up right where you left off.",
  ctaText: "Save my wishlist",
};

function getLocalIds(): string[] {
  try {
    const raw = localStorage.getItem("tl_wishlist");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getLocalCount(): number {
  return getLocalIds().length;
}

function isDismissed(): boolean {
  try {
    return !!sessionStorage.getItem(SESSION_KEY);
  } catch {
    return false;
  }
}

export default function WishlistSignupPrompt() {
  const [location] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [visible, setVisible] = useState(false);
  const [itemCount, setItemCount] = useState(0);
  const [products, setProducts] = useState<WishlistProduct[]>([]);
  const [previewProduct, setPreviewProduct] = useState<WishlistProduct | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [config, setConfig] = useState<WishlistPromptConfig>(DEFAULTS);

  const configRef = useRef<WishlistPromptConfig>(DEFAULTS);
  const locationRef = useRef(location);
  const isAuthenticatedRef = useRef(isAuthenticated);
  const authLoadingRef = useRef(authLoading);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const configLoadedRef = useRef(false);
  const pendingItemAddRef = useRef(false);
  const sessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerTimerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const handler = () => {
      try { sessionStorage.removeItem(SESSION_KEY); } catch {}
      setVisible(false);
      setTimeout(() => {
        const count = getLocalCount();
        if (count > 0) {
          void fetchProductsAndShow(count);
        } else {
          setItemCount(0);
          setProducts([]);
          setPreviewProduct(null);
          setVisible(true);
        }
      }, 80);
    };
    window.addEventListener("wishlist:force-preview", handler);
    return () => window.removeEventListener("wishlist:force-preview", handler);
  }, []);

  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { locationRef.current = location; }, [location]);
  useEffect(() => { isAuthenticatedRef.current = isAuthenticated; }, [isAuthenticated]);
  useEffect(() => { authLoadingRef.current = authLoading; }, [authLoading]);

  useEffect(() => {
    if (previewProduct) setPreviewImage(previewProduct.imageUrl);
  }, [previewProduct]);

  useEffect(() => {
    fetch(`/api/site-config/${CONFIG_KEY}`)
      .then(r => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(d => {
        if (d?.value) {
          const merged: WishlistPromptConfig = { ...DEFAULTS, ...d.value };
          merged.delaySeconds = Math.max(0, Number.isFinite(merged.delaySeconds) ? merged.delaySeconds : DEFAULTS.delaySeconds);
          setConfig(merged);
          configRef.current = merged;
        }
      })
      .catch(() => {})
      .finally(() => {
        configLoadedRef.current = true;
        if (pendingItemAddRef.current) {
          pendingItemAddRef.current = false;
          triggerTimerRef.current?.();
        }
        if (getLocalCount() > 0) {
          sessionTimerRef.current = setTimeout(() => {
            if (!shouldShowNow()) return;
            const count = getLocalCount();
            if (count <= 0) return;
            void fetchProductsAndShow(count);
          }, 20 * 1000);
        }
      });
  }, []);

  const shouldShowNow = () => {
    if (isDismissed()) return false;
    if (isAuthenticatedRef.current) return false;
    if (authLoadingRef.current) return false;
    if (EXCLUDED_PREFIXES.some(p => locationRef.current.startsWith(p))) return false;
    if (!configRef.current.enabled) return false;
    return true;
  };

  const fetchProductsAndShow = async (count: number) => {
    setItemCount(count);
    try {
      const ids = getLocalIds();
      if (ids.length > 0) {
        const res = await fetch("/api/products/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
        if (res.ok) {
          const data: WishlistProduct[] = await res.json();
          setProducts(data);
        }
      }
    } catch {}
    setVisible(true);
  };

  useEffect(() => {
    const startTimer = () => {
      if (!shouldShowNow()) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      const delaySecs = Math.max(0, configRef.current.delaySeconds ?? DEFAULTS.delaySeconds);
      timerRef.current = setTimeout(() => {
        if (!shouldShowNow()) return;
        const latestCount = getLocalCount();
        if (latestCount <= 0) return;
        void fetchProductsAndShow(latestCount);
      }, delaySecs * 1000);
    };

    triggerTimerRef.current = startTimer;

    const handleItemAdd = () => {
      if (!configLoadedRef.current) {
        pendingItemAddRef.current = true;
        return;
      }
      startTimer();
    };

    window.addEventListener("wishlist:item-added", handleItemAdd);

    return () => {
      window.removeEventListener("wishlist:item-added", handleItemAdd);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
    };
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    try {
      sessionStorage.setItem(SESSION_KEY, "dismissed");
    } catch {}
  };

  const handleSignIn = () => {
    handleDismiss();
    showSignInModal();
  };

  const handleRowInteract = (p: WishlistProduct) => {
    setPreviewProduct(prev => (prev?.id === p.id ? prev : p));
  };

  if (!visible) return null;

  const allPreviewUrls = previewProduct
    ? [previewProduct.imageUrl, ...previewProduct.galleryImages]
        .filter((u): u is string => !!u)
        .filter((u, i, arr) => arr.indexOf(u) === i)
        .slice(0, 6)
    : [];

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center"
      data-testid="wishlist-signup-prompt"
    >
      <div className="absolute inset-0 bg-black/40" onClick={handleDismiss} />

      <div className="relative bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl w-full max-w-md mx-auto p-6 shadow-xl animate-in slide-in-from-bottom duration-300">
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          data-testid="wishlist-prompt-dismiss-icon"
          aria-label="Dismiss"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center">
            <Heart className="w-8 h-8 text-rose-500 fill-rose-500" />
          </div>

          <div className="space-y-1">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              {config.headline}
            </h3>
            {itemCount > 0 && (
              <p className="text-sm font-medium text-rose-500" data-testid="wishlist-prompt-count">
                You have {itemCount} {itemCount === 1 ? "item" : "items"} saved
              </p>
            )}
          </div>

          {/* Inline image preview — shown when a row is hovered/tapped */}
          {previewProduct && (
            <div className="space-y-2 animate-in fade-in duration-200" data-testid="wishlist-prompt-preview">
              <div className="w-full aspect-square max-h-48 overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <img
                  src={getProductImageUrl(previewImage ?? previewProduct.imageUrl ?? "", "large")}
                  alt={previewProduct.name}
                  className="w-full h-full object-contain"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              </div>

              {previewProduct.galleryImages.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin justify-center">
                  {allPreviewUrls.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPreviewImage(url)}
                      className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-colors ${
                        (previewImage ?? previewProduct.imageUrl) === url
                          ? "border-rose-400"
                          : "border-transparent hover:border-gray-300 dark:hover:border-gray-600"
                      }`}
                      data-testid={`wishlist-preview-thumb-${i}`}
                    >
                      <img
                        src={getProductImageUrl(url, "small")}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    </button>
                  ))}
                </div>
              )}

              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 text-left line-clamp-1">
                {previewProduct.name}
              </p>
            </div>
          )}

          {/* Scrollable product list */}
          {products.length > 0 && (
            <div className="max-h-40 overflow-y-auto space-y-1 text-left pr-1 scrollbar-thin" data-testid="wishlist-prompt-products">
              {products.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onMouseEnter={() => handleRowInteract(p)}
                  onClick={() => handleRowInteract(p)}
                  className={`flex items-center gap-3 w-full text-left rounded-lg px-1 py-0.5 transition-colors ${
                    previewProduct?.id === p.id
                      ? "bg-rose-50 dark:bg-rose-900/20"
                      : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  }`}
                  data-testid={`wishlist-prompt-product-${p.id}`}
                >
                  <div className="relative w-10 h-10 flex-shrink-0">
                    <div className="w-10 h-10 rounded-md bg-gray-100 dark:bg-gray-800 absolute inset-0" />
                    {p.imageUrl && (
                      <img
                        src={getProductImageUrl(p.imageUrl, "small")}
                        alt={p.name}
                        className="w-10 h-10 rounded-md object-cover absolute inset-0"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    )}
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 leading-tight">
                    {p.name}
                  </span>
                </button>
              ))}
            </div>
          )}

          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            {config.bodyText}
          </p>

          <Button
            className="w-full"
            onClick={handleSignIn}
            data-testid="wishlist-prompt-signin"
          >
            {config.ctaText}
          </Button>

          <button
            type="button"
            onClick={handleDismiss}
            className="w-full text-center text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 py-1 transition-colors"
            data-testid="wishlist-prompt-maybe-later"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
