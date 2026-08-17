/**
 * SignupPopup — Google One Tap sign-in + phone-collection popup.
 *
 * Trigger logic:
 *   1. Session-start timer: fires after config.delaySeconds for every unauthenticated
 *      visitor, every session (no first/return-visit gate).
 *   2. Soft cart trigger: fires config.cartAddDelaySeconds after the user's first
 *      add-to-cart event. The item goes through normally; the popup just follows.
 *   3. Hard cart gate (via CartGateContext): if the popup was dismissed after at
 *      least one item was added, every subsequent add-to-cart is blocked until
 *      the user signs in or registers.
 *
 * Sign-in flow:
 *   - Google One Tap native overlay fires; credential sent to /api/auth/google.
 *   - Existing user → silent login, popup closes.
 *   - New user → server returns { needsPhone: true }; phone-collection card appears.
 *   - Phone form sends credential + phone to /api/auth/google/complete.
 *
 * No custom nudge card is rendered. The "nudge" view is invisible — it only
 * triggers the native One Tap overlay. Dismissing One Tap activates the reshow
 * timer and the cart hard-gate just like dismissing the old card did.
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


/** sessionStorage key — suppresses auto-triggers after dismissal */
const DISMISSED_KEY = "signup_popup_dismissed";
const EXCLUDED_PREFIXES = ["/admin", "/signin", "/checkout", "/order"];

interface SignupPopupConfig {
  enabled: boolean;
  /** Seconds after session start before auto-showing (default 15) */
  delaySeconds: number;
  /** Seconds after first cart add before auto-showing (default 2) */
  cartAddDelaySeconds: number;
  /**
   * Seconds after dismissal before the popup re-shows automatically.
   * 0 = disabled (popup stays gone for the session after one dismissal).
   */
  reshowIntervalSeconds: number;
  /** Shown below the phone input in the phone form */
  incentiveText: string;
  /** Consent statement / T&C shown below incentive */
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
  /** Always holds the latest isAuthenticated value for use inside setTimeout closures */
  const isAuthRef = useRef(isAuthenticated);
  /** Always holds the latest handleDismiss — lets the One Tap effect call it without re-running */
  const handleDismissRef = useRef<() => void>(() => {});

  // ── Config fetch ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/site-config/signup-popup")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.value) setConfig(d.value); })
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

  // ── Eligibility helpers ───────────────────────────────────────────────────
  /** Auto-triggers (timer, cart soft) respect the session dismissal key. */
  const canAutoTrigger = useCallback(() => {
    if (isAuthRef.current) return false;
    if (sessionStorage.getItem(DISMISSED_KEY)) return false;
    if (EXCLUDED_PREFIXES.some((p) => location.startsWith(p))) return false;
    return true;
  }, [location]);

  /** Hard gate bypasses the session key — cart adds must always be gatable. */
  const canForceShow = useCallback(() => {
    if (isAuthRef.current) return false;
    if (EXCLUDED_PREFIXES.some((p) => location.startsWith(p))) return false;
    return true;
  }, [location]);

  const autoShow = useCallback(() => {
    if (!canAutoTrigger()) return;
    setView("nudge");
    setVisible(true);
  }, [canAutoTrigger]);

  const forceShow = useCallback(() => {
    if (!canForceShow()) return;
    setView("nudge");
    setVisible(true);
  }, [canForceShow]);

  // Register forceShow with CartGateContext so the hard gate can open the popup
  useEffect(() => {
    _registerOpen(forceShow);
  }, [_registerOpen, forceShow]);

  // ── Session-start timer trigger ───────────────────────────────────────────
  useEffect(() => {
    if (sessionTimerSet.current) return;
    if (authLoading || !config) return;
    if (isAuthenticated || !config.enabled) return;
    if (sessionStorage.getItem(DISMISSED_KEY)) return;

    sessionTimerSet.current = true;
    const delay = Math.max(0, (config.delaySeconds ?? 15)) * 1000;

    const timer = setTimeout(() => {
      if (!sessionStorage.getItem(DISMISSED_KEY) && !isAuthRef.current) {
        setView("nudge");
        setVisible(true);
      }
    }, delay);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated, config]);

  // ── Soft cart-add trigger ─────────────────────────────────────────────────
  // ProductPage/QuickAddSheet dispatch "cart:item-added-for-popup" on each
  // successful add. We fire the soft popup only once per session.
  useEffect(() => {
    const handler = () => {
      if (cartTriggered.current || isAuthRef.current || !config) return;
      cartTriggered.current = true;
      const delay = Math.max(0, (config.cartAddDelaySeconds ?? 2)) * 1000;
      cartTimerRef.current = setTimeout(() => {
        if (!sessionStorage.getItem(DISMISSED_KEY) && !isAuthRef.current) {
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
  }, [config]);

  // ── Dismiss ───────────────────────────────────────────────────────────────
  const handleDismiss = useCallback(() => {
    setVisible(false);
    setView("nudge");
    setPhoneInput("");
    setConsentChecked(false);
    pendingCredential.current = null;
    setGoogleUserData(null);
    // Suppress auto-triggers until the reshow timer fires (or forever if disabled)
    sessionStorage.setItem(DISMISSED_KEY, "1");
    // Notify CartGateContext — may activate the hard gate
    _onDismissed();

    // Reshow timer: if configured, clear the dismissed flag after the interval
    // and re-attempt autoShow — loops each dismissal until user authenticates.
    if (reshowTimerRef.current) clearTimeout(reshowTimerRef.current);
    const interval = config?.reshowIntervalSeconds ?? 0;
    if (interval > 0) {
      reshowTimerRef.current = setTimeout(() => {
        if (isAuthRef.current) return;
        sessionStorage.removeItem(DISMISSED_KEY);
        // autoShow checks canAutoTrigger (which re-reads the cleared key)
        setView("nudge");
        setVisible(true);
      }, interval * 1000);
    }
  }, [_onDismissed, config]);

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
          // New user — switch to phone form
          pendingCredential.current = response.credential;
          setGoogleUserData(data.googleData);
          setView("phone");
        } else {
          // Existing user — logged in
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

  // Keep handleDismissRef current so the One Tap callback can call it without
  // being listed as an effect dependency (avoids re-initialising One Tap on every dismiss).
  useEffect(() => { handleDismissRef.current = handleDismiss; }, [handleDismiss]);

  // ── Google One Tap initialisation (fires when nudge view is active) ───────
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
            // Treat every non-display outcome the same as dismissing:
            // activates the reshow timer and cleans up state.
            if (
              notification.isNotDisplayedMoment() ||
              notification.isSkippedMoment() ||
              notification.isDismissedMoment()
            ) {
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
    if (!consentChecked) {
      toast({ title: "Please agree to the terms to continue", variant: "destructive" });
      return;
    }
    if (!pendingCredential.current) return;

    setSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/auth/google/complete", {
        credential: pendingCredential.current,
        phone: phoneInput.trim(),
        consentGiven: true,
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
  // "nudge" view = invisible; only the native One Tap overlay fires.
  // "phone" view = phone-collection card shown after Google sign-in for new users.
  if (!visible || view === "nudge") return null;

  return (
    <>
      <style>{`
        @keyframes tl-signup-in {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .tl-signup-card { animation: tl-signup-in 220ms ease-out forwards; }
      `}</style>

      <div
        className="tl-signup-card fixed top-4 right-4 z-[999] w-72 max-w-[calc(100vw-2rem)] bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-700 rounded-2xl overflow-hidden"
        style={{ boxShadow: "0 4px 24px 0 rgba(0,0,0,0.08), 0 1px 4px 0 rgba(0,0,0,0.04)" }}
        data-testid="signup-popup"
      >
        <PhoneView
          googleUserData={googleUserData}
          phoneInput={phoneInput}
          onPhoneChange={setPhoneInput}
          consentChecked={consentChecked}
          onConsentChange={setConsentChecked}
          incentiveText={config?.incentiveText ?? ""}
          consentText={config?.consentText ?? ""}
          submitting={submitting}
          onSubmit={handlePhoneSubmit}
          onDismiss={handleDismiss}
        />
      </div>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PhoneView({
  googleUserData,
  phoneInput,
  onPhoneChange,
  consentChecked,
  onConsentChange,
  incentiveText,
  consentText,
  submitting,
  onSubmit,
  onDismiss,
}: {
  googleUserData: GoogleUserData | null;
  phoneInput: string;
  onPhoneChange: (v: string) => void;
  consentChecked: boolean;
  onConsentChange: (v: boolean) => void;
  incentiveText: string;
  consentText: string;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onDismiss: () => void;
}) {
  const name = googleUserData
    ? [googleUserData.firstName, googleUserData.lastName].filter(Boolean).join(" ")
    : "";

  return (
    <div className="p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm font-bold text-gray-900 dark:text-white leading-snug">
            {name ? `Welcome, ${name}!` : "One last step"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Add your phone number to complete sign-up.</p>
        </div>
        <button
          onClick={onDismiss}
          className="shrink-0 -mt-1 -mr-1 w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
          aria-label="Dismiss"
          data-testid="btn-dismiss-phone-form"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <Input
          type="tel"
          placeholder="Phone number"
          value={phoneInput}
          onChange={(e) => onPhoneChange(e.target.value)}
          required
          autoFocus
          data-testid="input-signup-phone"
        />

        {incentiveText && (
          <p className="text-xs text-muted-foreground leading-relaxed">{incentiveText}</p>
        )}

        {consentText && (
          <label className="flex items-start gap-2 cursor-pointer" data-testid="signup-consent-label">
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => onConsentChange(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))] shrink-0"
              data-testid="signup-consent-checkbox"
            />
            <span className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              {consentText}
            </span>
          </label>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={submitting || (!!consentText && !consentChecked)}
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
  );
}

