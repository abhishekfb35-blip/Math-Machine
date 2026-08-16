/**
 * SignupPopup — unified Google sign-in / phone-collection popup.
 *
 * Replaces both ConsentPopup and GoogleOneTap.
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
 *   - New user → server returns { needsPhone: true }; card switches to phone form.
 *   - Phone form sends credential + phone to /api/auth/google/complete.
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
  /** Nudge card title */
  title: string;
  /** Nudge card body text */
  body: string;
  /** Google sign-in button label */
  buttonText: string;
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
  /** Always holds the latest isAuthenticated value for use inside setTimeout closures */
  const isAuthRef = useRef(isAuthenticated);

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
    // Suppress auto-triggers for the rest of this session
    sessionStorage.setItem(DISMISSED_KEY, "1");
    // Notify CartGateContext — may activate the hard gate
    _onDismissed();
  }, [_onDismissed]);

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

  // ── Google One Tap initialisation (nudge view only) ───────────────────────
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
            // Native overlay dismissed — our card stays; user can still click the button.
            if (notification.isSkippedMoment() || notification.isDismissedMoment()) {
              // no-op
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
  if (!visible) return null;

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
        {view === "nudge" ? (
          <NudgeView
            config={config}
            onDismiss={handleDismiss}
            onSignInClick={() => {
              setVisible(false);
              window.dispatchEvent(new CustomEvent("show:signin-modal"));
            }}
          />
        ) : (
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
        )}
      </div>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function NudgeView({
  config,
  onDismiss,
  onSignInClick,
}: {
  config: SignupPopupConfig | null;
  onDismiss: () => void;
  onSignInClick: () => void;
}) {
  return (
    <div className="p-5 space-y-4">
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0 p-2 rounded-full" style={{ backgroundColor: "#edf3ea" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a7c59" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 12v10H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/>
            <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
            <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          {config?.title && (
            <p className="text-sm font-bold leading-snug" style={{ color: "#4a7c59" }}>
              {config.title}
            </p>
          )}
          {config?.body && (
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{config.body}</p>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="shrink-0 -mt-1 -mr-1 w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
          aria-label="Dismiss"
          data-testid="btn-dismiss-signup-popup"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="h-px bg-gray-100 dark:bg-zinc-700" />

      {/* Google sign-in button */}
      <button
        onClick={onSignInClick}
        className="w-full flex items-center justify-center gap-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 rounded-xl px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
        data-testid="btn-signup-popup-signin"
      >
        <GoogleIcon />
        {config?.buttonText || "Sign in with Google"}
      </button>

      <p className="text-center text-[10px] text-muted-foreground -mt-1">
        Free account · No password required
      </p>
    </div>
  );
}

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

function GoogleIcon() {
  return (
    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}
