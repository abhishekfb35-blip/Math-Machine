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

export default function WishlistSignupPrompt() {
  const [location, navigate] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [visible, setVisible] = useState(false);
  const [itemCount, setItemCount] = useState(0);
  const [config, setConfig] = useState<WishlistPromptConfig>(DEFAULTS);
  const configLoaded = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (configLoaded.current) return;
    configLoaded.current = true;
    fetch(`/api/site-config/${CONFIG_KEY}`)
      .then(r => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(d => {
        if (d?.value) {
          setConfig({ ...DEFAULTS, ...d.value });
        }
      })
      .catch(() => {});
  }, []);

  const isDismissed = () => !!sessionStorage.getItem(SESSION_KEY);

  const shouldShow = () => {
    if (isDismissed()) return false;
    if (isAuthenticated) return false;
    if (EXCLUDED_PREFIXES.some(p => location.startsWith(p))) return false;
    if (!config.enabled) return false;
    return true;
  };

  useEffect(() => {
    if (authLoading) return;

    const handleFirstAdd = () => {
      if (!shouldShow()) return;
      const count = getLocalCount();
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (!shouldShow()) return;
        setItemCount(getLocalCount() || count + 1);
        setVisible(true);
      }, (config.delaySeconds ?? DEFAULTS.delaySeconds) * 1000);
    };

    window.addEventListener("wishlist:first-add", handleFirstAdd);
    return () => {
      window.removeEventListener("wishlist:first-add", handleFirstAdd);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [authLoading, isAuthenticated, location, config]);

  const handleDismiss = () => {
    setVisible(false);
    sessionStorage.setItem(SESSION_KEY, "dismissed");
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
      <div
        className="pointer-events-auto w-full max-w-md mx-auto bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl border border-gray-100 dark:border-gray-800 animate-in slide-in-from-bottom duration-300 pb-safe"
      >
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
                <p className="text-xs text-rose-500 font-medium mb-1">
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
