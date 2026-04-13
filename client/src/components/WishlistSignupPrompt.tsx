import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Heart, X } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  const [location, navigate] = useLocation();
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
    navigate("/signin");
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[110] flex justify-center pointer-events-none"
      data-testid="wishlist-signup-prompt"
    >
      <div className="pointer-events-auto w-full max-w-md mx-auto bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl border border-gray-100 dark:border-gray-800 animate-in slide-in-from-bottom duration-300">
        <div className="p-5 pt-4">
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-11 h-11 rounded-full bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center">
              <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <p className="font-semibold text-gray-900 dark:text-white text-sm leading-snug">
                  {config.headline}
                </p>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  data-testid="wishlist-prompt-dismiss-icon"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {itemCount > 0 && (
                <p className="text-xs text-rose-500 font-medium mb-1" data-testid="wishlist-prompt-count">
                  {itemCount} {itemCount === 1 ? "item" : "items"} saved
                </p>
              )}

              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                {config.bodyText}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <Button
              size="sm"
              className="flex-1"
              onClick={handleSignIn}
              data-testid="wishlist-prompt-signin"
            >
              {config.ctaText}
            </Button>
            <button
              type="button"
              onClick={handleDismiss}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0 px-2 py-1"
              data-testid="wishlist-prompt-maybe-later"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
