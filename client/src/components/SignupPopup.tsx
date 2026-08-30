/**
 * SignupPopup — Custom sign-in popup with a "Continue with Google" card.
 *
 * Trigger logic:
 *   1. Session timer: fires after config.delaySeconds for every unauthenticated guest.
 *   2. Soft cart trigger: fires config.cartAddDelaySeconds after the first add-to-cart.
 *      The cart add goes through normally; only the popup follows.
 *   3. Hard cart gate (via CartGateContext): after the popup is dismissed with cart
 *      activity, every subsequent add-to-cart is blocked until the user signs in.
 *
 * Sign-in flow (no Google One Tap — fully custom card):
 *   1. Popup shows a visible card with incentive text + "Continue with Google" button.
 *   2. User clicks → GSI calls handleCredential with the JWT credential.
 *   3. Credential sent to /api/auth/google:
 *      - Existing user → update auth cache, close popup.
 *      - New user (needsPhone:true) → switch card to phone-collection view.
 *   4. Phone form → /api/auth/google/complete → update cache, close.
 *
 * Dismiss behaviour:
 *   - Dismiss X arms the cart hard gate and starts the reshow timer.
 *   - reshowIntervalSeconds = 0 means "never reshow after dismiss".
 */

import { useState, useEffect, useCallback, useRef, type SyntheticEvent } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCartGateInternal } from "@/context/CartGateContext";
import { X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { sanitizeRichTextHtml } from "@/components/RichTextEditor";
import { ConsentScrollGate } from "@/components/ConsentScrollGate";
import { getMonthDayValue, MONTH_OPTIONS, PHONE_COUNTRY_CODES } from "@/lib/signupProfileDetails";

const EXCLUDED_PREFIXES = ["/admin", "/signin", "/checkout", "/order"];

function blockSignupBackdropInteraction(event: SyntheticEvent<HTMLDivElement>) {
  event.preventDefault();
  event.stopPropagation();
}

interface SignupPopupConfig {
  enabled: boolean;
  delaySeconds: number;
  cartAddDelaySeconds: number;
  reshowIntervalSeconds: number;
  incentiveText: string;
  subtitleText: string;
  phoneSubtitleText: string;
  phoneRequired: boolean;
  consentText: string;
  consentScrollPrompt: string;
  consentAgreementLabel: string;
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
  const [birthdayMonth, setBirthdayMonth] = useState("");
  const [birthdayDay, setBirthdayDay] = useState("");
  const [anniversaryMonth, setAnniversaryMonth] = useState("");
  const [anniversaryDay, setAnniversaryDay] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [phoneInput, setPhoneInput] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentReadToBottom, setConsentReadToBottom] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleUserData, setGoogleUserData] = useState<GoogleUserData | null>(null);
  const [config, setConfig] = useState<SignupPopupConfig | null>(null);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);

  const pendingCredential = useRef<string | null>(null);
  const sessionTimerSet = useRef(false);
  const cartTriggered = useRef(false);
  const cartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reshowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAuthRef = useRef(isAuthenticated);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const gsiInitialized = useRef(false);

  // ── Config fetch ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/site-config/signup-popup")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.value) {
          const { enabled, delaySeconds, cartAddDelaySeconds, reshowIntervalSeconds, incentiveText, subtitleText, phoneSubtitleText, phoneRequired, consentText, consentScrollPrompt, consentAgreementLabel } =
            d.value;
          setConfig({ enabled, delaySeconds, cartAddDelaySeconds, reshowIntervalSeconds, incentiveText, subtitleText: subtitleText ?? "Save your wishlist, track orders, and check out faster.", phoneSubtitleText: phoneSubtitleText ?? "Add your phone number to complete sign-up.", phoneRequired: phoneRequired !== false, consentText, consentScrollPrompt: consentScrollPrompt ?? "Scroll to the bottom to enable agreement.", consentAgreementLabel: consentAgreementLabel ?? "I agree to the consent text above." });
        }
      })
      .catch(() => {});
  }, []);

  // ── Google client ID fetch (once) ─────────────────────────────────────────
  useEffect(() => {
    fetch("/api/auth/google-client-id")
      .then((r) => r.json())
      .then((d) => { if (d.clientId) setGoogleClientId(d.clientId); })
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
      setBirthdayMonth("");
      setBirthdayDay("");
      setAnniversaryMonth("");
      setAnniversaryDay("");
      setCountryCode("+91");
      setPhoneInput("");
      setConsentChecked(false);
      setConsentReadToBottom(false);
      pendingCredential.current = null;
      setGoogleUserData(null);
      gsiInitialized.current = false;
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
    gsiInitialized.current = false; // allow re-render of button on next open
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
        gsiInitialized.current = false;
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
          gsiInitialized.current = false;
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
    setBirthdayMonth("");
    setBirthdayDay("");
    setAnniversaryMonth("");
    setAnniversaryDay("");
    setCountryCode("+91");
    setPhoneInput("");
    setConsentChecked(false);
    setConsentReadToBottom(false);
    pendingCredential.current = null;
    setGoogleUserData(null);
    gsiInitialized.current = false;

    _onDismissed();

    // Reshow after reshowIntervalSeconds — 0 means disabled (don't re-show).
    if (reshowTimerRef.current) clearTimeout(reshowTimerRef.current);
    const interval = config?.reshowIntervalSeconds ?? 0;
    if (interval > 0) {
      reshowTimerRef.current = setTimeout(() => {
        if (!isAuthRef.current && canShow()) {
          gsiInitialized.current = false;
          setView("nudge");
          setVisible(true);
        }
      }, interval * 1000);
    }
  }, [_onDismissed, config, canShow]);

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

  // ── GSI rendered button (replaces One Tap) ────────────────────────────────
  // Initialises whenever the nudge card becomes visible. Uses the same
  // renderButton pattern as SignInModal — no prompt(), no One Tap overlay.
  useEffect(() => {
    if (!visible || view !== "nudge") return;
    if (!googleClientId || !googleButtonRef.current) return;
    if (gsiInitialized.current) return;

    const tryRender = (): boolean => {
      const google = (window as any).google;
      if (!google?.accounts?.id || !googleButtonRef.current) return false;

      google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleCredential,
      });
      google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        width: googleButtonRef.current.offsetWidth || 240,
      });
      gsiInitialized.current = true;
      return true;
    };

    if (!tryRender()) {
      const iv = setInterval(() => {
        if (tryRender()) clearInterval(iv);
      }, 200);
      const timeout = setTimeout(() => clearInterval(iv), 5000);
      return () => { clearInterval(iv); clearTimeout(timeout); };
    }
  }, [visible, view, googleClientId, handleCredential]);

  // ── Phone form submit ─────────────────────────────────────────────────────
  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const birthday = getMonthDayValue(birthdayMonth, birthdayDay, "Birthday");
    if (birthday.error) {
      toast({ title: birthday.error, variant: "destructive" });
      return;
    }
    const anniversary = getMonthDayValue(anniversaryMonth, anniversaryDay, "Anniversary");
    if (anniversary.error) {
      toast({ title: anniversary.error, variant: "destructive" });
      return;
    }
    if (config?.phoneRequired !== false && !phoneInput.trim()) {
      toast({ title: "Phone number is required", variant: "destructive" });
      return;
    }
    if (config?.consentText && (!consentReadToBottom || !consentChecked)) {
      toast({ title: consentReadToBottom ? "Please agree to the terms to continue" : "Please read the entire consent text to continue", variant: "destructive" });
      return;
    }
    if (!pendingCredential.current) return;

    setSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/auth/google/complete", {
        credential: pendingCredential.current,
        phone: phoneInput.trim(),
        countryCode,
        birthdayMonthDay: birthday.value,
        anniversaryMonthDay: anniversary.value,
        consentGiven: consentChecked,
        consentText: config?.consentText ?? "",
        consentReadToBottom,
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

  const name = googleUserData
    ? [googleUserData.firstName, googleUserData.lastName].filter(Boolean).join(" ")
    : "";

  return (
    <>
      <style>{`
        @keyframes tl-popup-in {
          from { opacity: 0; translate: 0 -10px; }
          to   { opacity: 1; translate: 0 0; }
        }
        .tl-popup-card { animation: tl-popup-in 220ms ease-out forwards; }
      `}</style>

      <div
        className="fixed inset-0 z-[998] touch-none sm:touch-auto bg-black/20 backdrop-blur-[1px]"
        onPointerDown={blockSignupBackdropInteraction}
        onTouchStart={blockSignupBackdropInteraction}
        onTouchMove={blockSignupBackdropInteraction}
        onClick={blockSignupBackdropInteraction}
        aria-hidden="true"
        data-testid="signup-popup-backdrop"
      />

      <div
        className="tl-popup-card fixed top-[6.5rem] right-4 md:top-1/2 md:left-1/2 md:right-auto md:-translate-x-1/2 md:-translate-y-1/2 z-[999] w-72 max-w-[calc(100vw-2rem)] bg-background border border-primary/20 border-t-4 border-t-primary rounded-2xl overflow-hidden"
        style={{ boxShadow: "0 8px 28px 0 color-mix(in srgb, hsl(var(--primary)) 18%, transparent), 0 2px 8px 0 rgba(0,0,0,0.08)" }}
        data-testid="signup-popup"
      >
        <div className="p-5">
          {view === "nudge" ? (
            /* ── Nudge view: incentive + "Continue with Google" button ── */
            <>
              <div className="flex items-start justify-between mb-3">
                <div
                  className="text-sm font-semibold text-foreground leading-snug"
                  dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(config?.incentiveText || "Sign in to TurtleLittle") }}
                />
                <button
                  onClick={handleDismiss}
                  className="shrink-0 -mt-0.5 -mr-1 w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                  aria-label="Dismiss"
                  data-testid="btn-dismiss-nudge"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {config?.subtitleText && (
                <div
                  className="text-xs text-muted-foreground mb-4 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(config.subtitleText) }}
                />
              )}

              {/* GSI rendered button mounts here */}
              <div
                ref={googleButtonRef}
                className="flex justify-center min-h-[44px] rounded-xl border border-primary/20 bg-primary/[0.04] p-2 shadow-sm"
                data-testid="signup-popup-google-btn"
              />
              <div
                className="h-3 shrink-0"
                aria-hidden="true"
                data-testid="signup-popup-google-footer"
              />
            </>
          ) : (
            /* ── Phone view: collect phone before creating account ── */
            <>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm font-bold text-foreground leading-snug">
                    {name ? `Welcome, ${name}!` : "One last step"}
                  </p>
                  {config?.phoneSubtitleText && (
                    <p
                      className="text-xs text-muted-foreground mt-1"
                      dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(config.phoneSubtitleText) }}
                    />
                  )}
                </div>
                <button
                  onClick={handleDismiss}
                  className="shrink-0 -mt-1 -mr-1 w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                  aria-label="Dismiss"
                  data-testid="btn-dismiss-phone-form"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <form onSubmit={handlePhoneSubmit} className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium" htmlFor="signup-phone-country-code">Phone number</label>
                  <div className="grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)] gap-2">
                    <select
                      id="signup-phone-country-code"
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm"
                      data-testid="select-signup-phone-country-code"
                    >
                      {PHONE_COUNTRY_CODES.map(({ code, label }) => <option key={code} value={code}>{label}</option>)}
                    </select>
                    <Input
                      type="tel"
                      inputMode="numeric"
                      placeholder="Phone number"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, ""))}
                      required={config?.phoneRequired !== false}
                      maxLength={15}
                      className="min-w-0 flex-1"
                      data-testid="input-signup-phone"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex items-center gap-1.5">
                    <label className="text-xs font-medium" htmlFor="signup-birthday-month">Birthday</label>
                    <span className="text-xs text-muted-foreground">Optional</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      id="signup-birthday-month"
                      value={birthdayMonth}
                      onChange={(e) => setBirthdayMonth(e.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                      data-testid="select-signup-birthday-month"
                    >
                      <option value="">Month</option>
                      {MONTH_OPTIONS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
                    </select>
                    <select
                      aria-label="Birthday day"
                      value={birthdayDay}
                      onChange={(e) => setBirthdayDay(e.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                      data-testid="select-signup-birthday-day"
                    >
                      <option value="">Day</option>
                      {Array.from({ length: 31 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex items-center gap-1.5">
                    <label className="text-xs font-medium" htmlFor="signup-anniversary-month">Anniversary</label>
                    <span className="text-xs text-muted-foreground">Optional</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      id="signup-anniversary-month"
                      value={anniversaryMonth}
                      onChange={(e) => setAnniversaryMonth(e.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                      data-testid="select-signup-anniversary-month"
                    >
                      <option value="">Month</option>
                      {MONTH_OPTIONS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
                    </select>
                    <select
                      aria-label="Anniversary day"
                      value={anniversaryDay}
                      onChange={(e) => setAnniversaryDay(e.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                      data-testid="select-signup-anniversary-day"
                    >
                      <option value="">Day</option>
                      {Array.from({ length: 31 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
                    </select>
                  </div>
                </div>

                {config?.consentText && (
                  <ConsentScrollGate
                    consentText={config.consentText}
                    scrollPrompt={config.consentScrollPrompt}
                    agreementLabel={config.consentAgreementLabel}
                    checked={consentChecked}
                    onCheckedChange={setConsentChecked}
                    onReadToBottomChange={setConsentReadToBottom}
                    testIdPrefix="signup"
                  />
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={submitting || (!!config?.consentText && (!consentReadToBottom || !consentChecked))}
                  data-testid="btn-signup-phone-submit"
                >
                  {submitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creating account…</>
                  ) : (
                    "Create my account"
                  )}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  );
}
