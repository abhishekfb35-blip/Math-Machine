/**
 * SignupPopup — Google One Tap sign-in + phone-collection popup.
 *
 * Trigger logic:
 *   1. Session timer: fires after config.delaySeconds for every unauthenticated guest.
 *   2. Soft cart trigger: fires config.cartAddDelaySeconds after the first add-to-cart.
 *      The cart add goes through normally; only the popup follows.
 *   3. Hard cart gate (via CartGateContext): after the popup is dismissed with cart
 *      activity, every subsequent add-to-cart is blocked until the user signs in.
 *
 * Sign-in flow:
 *   - Google One Tap native overlay fires; credential sent to /api/auth/google.
 *   - Existing user → silent login, popup closes.
 *   - New user → server returns { needsPhone: true }; phone-collection card appears.
 *   - Phone form sends credential + phone to /api/auth/google/complete.
 *
 * Dismiss behaviour:
 *   - No sessionStorage suppression. On dismiss, a reshow timer fires after
 *     reshowIntervalSeconds (or delaySeconds as fallback), then the popup re-appears.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCartGateInternal } from "@/context/CartGateContext";
import { X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const EXCLUDED_PREFIXES = ["/admin", "/signin", "/checkout", "/order"];

interface SignupPopupConfig {
  enabled: boolean;
  delaySeconds: number;
  cartAddDelaySeconds: number;
  reshowIntervalSeconds: number;
  incentiveText: string;
  consentText: string;
}

interface GoogleUserData {
  firstName: string;
  lastName: string;
  email: string;
}

export default function SignupPopup() {
  const [location] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const { _registerOpen, _onDismissed, _onAuthSuccess } = useCartGateInternal();

  const [visible, setVisible] = useState(false);
  const [view, setView] = useState<"nudge" | "phone">("nudge");
  const [phoneInput, setPhoneInput] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleUserData, setGoogleUserData] = useState<GoogleUserData | null>(null);
  const [config, setConfig] = useState<SignupPopupConfig | null>(null);

  const pendingCredential = useRef<string | null>(null);
  const sessionTimerSet = useRef(false);
  const cartTriggered = useRef(false);
  const cartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reshowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAuthRef = useRef(isAuthenticated);
  const handleDismissRef = useRef<() => void>(() => {});

  // ── Config fetch ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/site-config/signup-popup")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.value) {
          const { enabled, delaySeconds, cartAddDelaySeconds, reshowIntervalSeconds, incentiveText, consentText } = d.value;
          setConfig({ enabled, delaySeconds, cartAddDelaySeconds, reshowIntervalSeconds, incentiveText, consentText });
        }
      })
      .catch(() => {});
  }, []);

  // Keep isAuthRef current
  useEffect(() => {
    isAuthRef.current = isAuthenticated;
  }, [isAuthenticated]);

  // ── Auth-success cleanup ──────────────────────────────────────────────────
  useEffect(() => {
    if (isAuthenticated) {
      setVisible(false);
      setView("nudge");
      setPhoneInput("");
      setConsentChecked(false);
      pendingCredential.current = null;
      setGoogleUserData(null);
      if (reshowTimerRef.current) { clearTimeout(reshowTimerRef.current); reshowTimerRef.current = null; }
      _onAuthSuccess();
    }
  }, [isAuthenticated, _onAuthSuccess]);

  // ── Eligibility ───────────────────────────────────────────────────────────
  const canShow = useCallback(() => {
    if (!config?.enabled) return false;
    if (isAuthRef.current) return false;
    if (EXCLUDED_PREFIXES.some((p) => location.startsWith(p))) return false;
    return true;
  }, [location, config]);

  // ── forceShow (used by CartGate hard gate) ────────────────────────────────
  const forceShow = useCallback(() => {
    if (!canShow()) return;
    setView("nudge");
    setVisible(true);
  }, [canShow]);

  useEffect(() => {
    _registerOpen(forceShow);
  }, [_registerOpen, forceShow]);

  // ── Session-start timer ───────────────────────────────────────────────────
  useEffect(() => {
    if (sessionTimerSet.current) return;
    if (authLoading || !config) return;
    if (isAuthenticated || !config.enabled) return;

    sessionTimerSet.current = true;
    const delay = Math.max(0, config.delaySeconds ?? 15) * 1000;

    const timer = setTimeout(() => {
      if (!isAuthRef.current && canShow()) {
        setView("nudge");
        setVisible(true);
      }
    }, delay);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated, config]);

  // ── Soft cart-add trigger ─────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => {
      if (cartTriggered.current || isAuthRef.current || !config?.enabled) return;
      cartTriggered.current = true;
      const delay = Math.max(0, config.cartAddDelaySeconds ?? 2) * 1000;
      cartTimerRef.current = setTimeout(() => {
        if (!isAuthRef.current && canShow()) {
          setView("nudge");
          setVisible(true);
        }
      }, delay);
    };

    window.addEventListener("cart:item-added-for-popup", handler);
    return () => {
      window.removeEventListener("cart:item-added-for-popup", handler);
      if (cartTimerRef.current) clearTimeout(cartTimerRef.current);
    };
  }, [config, canShow]);

  // ── Dismiss ───────────────────────────────────────────────────────────────
  const handleDismiss = useCallback(() => {
    setVisible(false);
    setView("nudge");
    setPhoneInput("");
    setConsentChecked(false);
    pendingCredential.current = null;
    setGoogleUserData(null);

    _onDismissed();

    // Reshow after reshowIntervalSeconds — 0 means disabled (don't re-show).
    if (reshowTimerRef.current) clearTimeout(reshowTimerRef.current);
    const interval = config?.reshowIntervalSeconds ?? 0;
    if (interval > 0) {
      reshowTimerRef.current = setTimeout(() => {
        if (!isAuthRef.current && canShow()) {
          setView("nudge");
          setVisible(true);
        }
      }, interval * 1000);
    }
  }, [_onDismissed, config, canShow]);

  // Keep ref current so One Tap effect can call it without re-initialising
  useEffect(() => { handleDismissRef.current = handleDismiss; }, [handleDismiss]);

  // ── Google credential callback ────────────────────────────────────────────
  const handleCredential = useCallback(
    async (response: { credential?: string }) => {
      if (!response.credential) return;
      try {
        const res = await apiRequest("POST", "/api/auth/google", {
          credential: response.credential,
        });
        const data = await res.json();

        if (data.needsPhone) {
          pendingCredential.current = response.credential;
          setGoogleUserData(data.googleData);
          setView("phone");
        } else {
          queryClient.setQueryData(["/api/auth/me"], data.customer);
          setVisible(false);
          toast({ title: "Welcome back!", description: "Signed in with Google." });
        }
      } catch (err: any) {
        toast({
          title: "Sign-in failed",
          description: err.message || "Please try again.",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  // ── Google One Tap initialisation ─────────────────────────────────────────
  useEffect(() => {
    if (!visible || view !== "nudge") return;
    let cancelled = false;

    fetch("/api/auth/google-client-id")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.clientId) return;

        const tryInit = (): boolean => {
          const google = (window as any).google;
          if (!google?.accounts?.id) return false;
          google.accounts.id.initialize({
            client_id: d.clientId,
            callback: handleCredential,
            cancel_on_tap_outside: true,
          });
          google.accounts.id.prompt((notification: any) => {
            // Only treat the moment as abandonment when the user genuinely
            // walked away — NOT when they selected an account (credential_returned),
            // which fires as a dismissed moment before the credential callback runs.
            const reason = notification.getDismissedReason?.() ?? "";
            const credentialReturned = reason === "credential_returned";
            if (credentialReturned) return; // credential callback handles this path

            const skipped = notification.isSkippedMoment?.() ?? false;
            const dismissed = notification.isDismissedMoment?.() ?? false;
            const notDisplayed = notification.isNotDisplayedMoment?.() ?? false;
            if (skipped || dismissed || notDisplayed) {
              handleDismissRef.current();
            }
          });
          return true;
        };

        if (!tryInit()) {
          const iv = setInterval(() => {
            if (cancelled) { clearInterval(iv); return; }
            if (tryInit()) clearInterval(iv);
          }, 300);
          setTimeout(() => clearInterval(iv), 5000);
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [visible, view, handleCredential]);

  // ── Phone form submit ─────────────────────────────────────────────────────
  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneInput.trim()) {
      toast({ title: "Phone number is required", variant: "destructive" });
      return;
    }
    if (config?.consentText && !consentChecked) {
      toast({ title: "Please agree to the terms to continue", variant: "destructive" });
      return;
    }
    if (!pendingCredential.current) return;

    setSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/auth/google/complete", {
        credential: pendingCredential.current,
        phone: phoneInput.trim(),
        consentGiven: consentChecked,
        consentText: config?.consentText ?? "",
      });
      const data = await res.json();
      queryClient.setQueryData(["/api/auth/me"], data.customer);
      setVisible(false);
      toast({ title: "Welcome!", description: "Your account has been created." });
    } catch (err: any) {
      toast({
        title: "Something went wrong",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  // "nudge" view: invisible — One Tap native overlay fires.
  // "phone" view: phone-collection card.
  if (!visible || view === "nudge") return null;

  const name = googleUserData
    ? [googleUserData.firstName, googleUserData.lastName].filter(Boolean).join(" ")
    : "";

  return (
    <>
      <style>{`
        @keyframes tl-popup-in {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .tl-popup-card { animation: tl-popup-in 220ms ease-out forwards; }
      `}</style>

      <div
        className="tl-popup-card fixed top-4 right-4 z-[999] w-72 max-w-[calc(100vw-2rem)] bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-700 rounded-2xl overflow-hidden"
        style={{ boxShadow: "0 4px 24px 0 rgba(0,0,0,0.08), 0 1px 4px 0 rgba(0,0,0,0.04)" }}
        data-testid="signup-popup"
      >
        <div className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white leading-snug">
                {name ? `Welcome, ${name}!` : "One last step"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Add your phone number to complete sign-up.
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="shrink-0 -mt-1 -mr-1 w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
              aria-label="Dismiss"
              data-testid="btn-dismiss-phone-form"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <form onSubmit={handlePhoneSubmit} className="space-y-3">
            <Input
              type="tel"
              placeholder="Phone number"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              required
              autoFocus
              data-testid="input-signup-phone"
            />

            {config?.incentiveText && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {config.incentiveText}
              </p>
            )}

            {config?.consentText && (
              <label className="flex items-start gap-2 cursor-pointer" data-testid="signup-consent-label">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))] shrink-0"
                  data-testid="signup-consent-checkbox"
                />
                <span className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  {config.consentText}
                </span>
              </label>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={submitting || (!!config?.consentText && !consentChecked)}
              data-testid="btn-signup-phone-submit"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creating account…</>
              ) : (
                "Create my account"
              )}
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
