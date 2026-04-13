import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Heart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { showSignInModal } from "@/components/SignInModal";

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

function getLocalCount(): number {
  try {
    const raw = localStorage.getItem("tl_wishlist");
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
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
  const [config, setConfig] = useState<WishlistPromptConfig>(DEFAULTS);

  const configRef = useRef<WishlistPromptConfig>(DEFAULTS);
  const locationRef = useRef(location);
  const isAuthenticatedRef = useRef(isAuthenticated);
  const authLoadingRef = useRef(authLoading);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const configLoadedRef = useRef(false);
  const pendingFirstAddRef = useRef(false);

  const triggerTimerRef = useRef<(() => void) | null>(null);

  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { locationRef.current = location; }, [location]);
  useEffect(() => { isAuthenticatedRef.current = isAuthenticated; }, [isAuthenticated]);
  useEffect(() => { authLoadingRef.current = authLoading; }, [authLoading]);

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
        if (pendingFirstAddRef.current) {
          pendingFirstAddRef.current = false;
          triggerTimerRef.current?.();
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

  useEffect(() => {
    const startTimer = () => {
      if (!shouldShowNow()) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      const delaySecs = Math.max(0, configRef.current.delaySeconds ?? DEFAULTS.delaySeconds);
      timerRef.current = setTimeout(() => {
        if (!shouldShowNow()) return;
        const latestCount = getLocalCount();
        if (latestCount <= 0) return;
        setItemCount(latestCount);
        setVisible(true);
      }, delaySecs * 1000);
    };

    triggerTimerRef.current = startTimer;

    const handleFirstAdd = () => {
      if (!configLoadedRef.current) {
        pendingFirstAddRef.current = true;
        return;
      }
      startTimer();
    };

    window.addEventListener("wishlist:first-add", handleFirstAdd);
    return () => {
      window.removeEventListener("wishlist:first-add", handleFirstAdd);
      if (timerRef.current) clearTimeout(timerRef.current);
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

  if (!visible) return null;

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
