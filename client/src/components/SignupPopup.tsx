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
  event.stopPropagation();
}

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "a[href]",
  "iframe:not([tabindex='-1'])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      !element.hasAttribute("hidden") &&
      element.getAttribute("aria-hidden") !== "true",
  );
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

type PhoneValidationField = "phone" | "birthday" | "anniversary" | "consent" | "completion";

interface PhoneValidationMessage {
  id: number;
  field: PhoneValidationField;
  title: string;
  description?: string;
}

const PHONE_VALIDATION_TARGETS: Record<PhoneValidationField, string> = {
  phone: '[data-testid="input-signup-phone"]',
  birthday: '[data-testid="select-signup-birthday-month"]',
  anniversary: '[data-testid="select-signup-anniversary-month"]',
  consent: '[data-testid="signup-consent-text"]',
  completion: '[data-testid="input-signup-phone"]',
};

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
  const [phoneValidation, setPhoneValidation] = useState<PhoneValidationMessage | null>(null);

  const pendingCredential = useRef<string | null>(null);
  const sessionTimerSet = useRef(false);
  const cartTriggered = useRef(false);
  const cartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reshowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAuthRef = useRef(isAuthenticated);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const gsiInitialized = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const phoneValidationDialogRef = useRef<HTMLDivElement>(null);
  const phoneValidationIdRef = useRef(0);
  const touchGestureRef = useRef<"dialog" | "consent" | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const openPopupRef = useRef<(nextView?: "nudge" | "phone") => void>(() => {});

  const showPhoneValidation = useCallback((
    field: PhoneValidationField,
    title: string,
    description?: string,
  ) => {
    phoneValidationIdRef.current += 1;
    setPhoneValidation({
      id: phoneValidationIdRef.current,
      field,
      title,
      description,
    });
  }, []);

  const clearPhoneValidationFor = useCallback((field: PhoneValidationField) => {
    setPhoneValidation((current) =>
      current && (
        current.field === field ||
        (current.field === "completion" && field === "phone")
      )
        ? null
        : current,
    );
  }, []);

  const handleConsentCheckedChange = useCallback((checked: boolean) => {
    setConsentChecked(checked);
    clearPhoneValidationFor("consent");
  }, [clearPhoneValidationFor]);

  const handleConsentReadToBottomChange = useCallback((readToBottom: boolean) => {
    setConsentReadToBottom(readToBottom);
    if (readToBottom) clearPhoneValidationFor("consent");
  }, [clearPhoneValidationFor]);

  useEffect(() => {
    if (!phoneValidation || !visible || view !== "phone") return;
    const frame = requestAnimationFrame(() => phoneValidationDialogRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [phoneValidation, visible, view]);

  const dismissPhoneValidation = useCallback(() => {
    if (!phoneValidation) return;
    const targetSelector = PHONE_VALIDATION_TARGETS[phoneValidation.field];
    setPhoneValidation(null);
    requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>(targetSelector)?.focus();
    });
  }, [phoneValidation]);

  useEffect(() => {
    if (!visible) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const isConsentScrollTarget = (target: EventTarget | null) => {
      const consentRegion = dialog.querySelector<HTMLElement>(
        '[data-testid="signup-consent-text"]',
      );
      return Boolean(
        consentRegion &&
        target instanceof Node &&
        consentRegion.contains(target),
      );
    };
    const handleTouchStart = (event: TouchEvent) => {
      touchGestureRef.current = isConsentScrollTarget(event.target)
        ? "consent"
        : "dialog";
    };
    const handleTouchMove = (event: TouchEvent) => {
      if (touchGestureRef.current !== "consent") {
        event.preventDefault();
      }
    };
    const handleTouchEnd = () => {
      touchGestureRef.current = null;
    };
    const handleWheel = (event: WheelEvent) => {
      if (!isConsentScrollTarget(event.target)) {
        event.preventDefault();
      }
    };

    dialog.addEventListener("touchstart", handleTouchStart, { passive: true });
    dialog.addEventListener("touchmove", handleTouchMove, { passive: false });
    dialog.addEventListener("touchend", handleTouchEnd);
    dialog.addEventListener("touchcancel", handleTouchEnd);
    dialog.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      dialog.removeEventListener("touchstart", handleTouchStart);
      dialog.removeEventListener("touchmove", handleTouchMove);
      dialog.removeEventListener("touchend", handleTouchEnd);
      dialog.removeEventListener("touchcancel", handleTouchEnd);
      dialog.removeEventListener("wheel", handleWheel);
      touchGestureRef.current = null;
    };
  }, [visible]);

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
      setPhoneValidation(null);
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
  const openPopup = useCallback((nextView: "nudge" | "phone" = "nudge") => {
    if (!canShow()) return;
    const activeElement = document.activeElement;
    restoreFocusRef.current = activeElement instanceof HTMLElement ? activeElement : null;
    gsiInitialized.current = false; // allow re-render of button on next open
    setPhoneValidation(null);
    setView(nextView);
    setVisible(true);
  }, [canShow]);

  useEffect(() => {
    openPopupRef.current = openPopup;
  }, [openPopup]);

  const forceShow = useCallback(() => openPopup("nudge"), [openPopup]);

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
      if (!isAuthRef.current) openPopupRef.current("nudge");
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
        if (!isAuthRef.current) openPopupRef.current("nudge");
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
    setBirthdayMonth("");
    setBirthdayDay("");
    setAnniversaryMonth("");
    setAnniversaryDay("");
    setCountryCode("+91");
    setPhoneInput("");
    setConsentChecked(false);
    setConsentReadToBottom(false);
    setPhoneValidation(null);
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

  // Move focus into the active view and return it to the element that opened
  // the popup when it closes.
  useEffect(() => {
    if (visible) return;
    const element = restoreFocusRef.current;
    if (!element) return;

    restoreFocusRef.current = null;
    const frame = requestAnimationFrame(() => {
      if (element.isConnected && !element.hasAttribute("disabled")) {
        element.focus();
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const frame = requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusableElements = getFocusableElements(dialog);
      if (!dialog.contains(document.activeElement)) {
        (focusableElements[0] ?? dialog).focus();
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [visible, view]);

  const handleFocusTrap = useCallback(
    (event: {
      key: string;
      shiftKey: boolean;
      preventDefault: () => void;
      stopPropagation: () => void;
    }) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (phoneValidation) {
          dismissPhoneValidation();
        } else {
          handleDismiss();
        }
        return;
      }
      if (event.key !== "Tab") return;

      const dialog = phoneValidationDialogRef.current ?? dialogRef.current;
      if (!dialog) return;

      const focusableElements = getFocusableElements(dialog);
      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const activeElement = document.activeElement;
      const currentIndex = focusableElements.indexOf(activeElement as HTMLElement);
      if (
        currentIndex === -1 ||
        (event.shiftKey && currentIndex === 0) ||
        (!event.shiftKey && currentIndex === focusableElements.length - 1)
      ) {
        event.preventDefault();
        const nextIndex = event.shiftKey
          ? focusableElements.length - 1
          : 0;
        focusableElements[nextIndex].focus();
      }
    },
    [dismissPhoneValidation, handleDismiss, phoneValidation],
  );

  useEffect(() => {
    if (!visible) return;
    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      handleFocusTrap(event);
    };
    document.addEventListener("keydown", handleDocumentKeyDown, true);
    return () => document.removeEventListener("keydown", handleDocumentKeyDown, true);
  }, [visible, handleFocusTrap]);

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
          setPhoneValidation(null);
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
      showPhoneValidation("birthday", birthday.error);
      return;
    }
    const anniversary = getMonthDayValue(anniversaryMonth, anniversaryDay, "Anniversary");
    if (anniversary.error) {
      showPhoneValidation("anniversary", anniversary.error);
      return;
    }
    if (config?.phoneRequired !== false && !phoneInput.trim()) {
      showPhoneValidation("phone", "Phone number is required");
      return;
    }
    if (config?.consentText && (!consentReadToBottom || !consentChecked)) {
      showPhoneValidation(
        "consent",
        consentReadToBottom
          ? "Please agree to the terms to continue"
          : "Please read the entire consent text to continue",
      );
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
      setPhoneValidation(null);
      setVisible(false);
      toast({ title: "Welcome!", description: "Your account has been created." });
    } catch (err: any) {
      showPhoneValidation(
        "completion",
        "Unable to create your account",
        err.message || "Please review your details and try again.",
      );
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
        className="fixed inset-0 z-[998] touch-pan-y sm:touch-auto bg-black/20 backdrop-blur-[1px]"
        onPointerDown={blockSignupBackdropInteraction}
        onTouchStart={blockSignupBackdropInteraction}
        onTouchMove={blockSignupBackdropInteraction}
        onClick={blockSignupBackdropInteraction}
        aria-hidden="true"
        data-testid="signup-popup-backdrop"
      />

      <div
        className="tl-popup-card fixed top-1/2 left-1/2 right-auto -translate-x-1/2 -translate-y-1/2 z-[999] w-72 max-w-[calc(100vw-2rem)] bg-background border border-primary/20 border-t-4 border-t-primary rounded-2xl overflow-hidden"
        style={{ boxShadow: "0 8px 28px 0 color-mix(in srgb, hsl(var(--primary)) 18%, transparent), 0 2px 8px 0 rgba(0,0,0,0.08)" }}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="signup-popup-title"
        aria-describedby={
          view === "nudge"
            ? config?.subtitleText
              ? "signup-popup-description"
              : undefined
            : config?.phoneSubtitleText
              ? "signup-popup-description"
              : undefined
        }
        tabIndex={-1}
        data-testid="signup-popup"
      >
        <div className="p-5">
          {view === "nudge" ? (
            /* ── Nudge view: incentive + "Continue with Google" button ── */
            <>
              <div className="flex items-start justify-between mb-3">
                <div
                  id="signup-popup-title"
                  className="text-sm font-semibold text-foreground leading-snug"
                  dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(config?.incentiveText || "Sign in to TurtleLittle") }}
                />
                <button
                  onClick={handleDismiss}
                  className="shrink-0 -mt-0.5 -mr-1 w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                  aria-label="Dismiss"
                  data-testid="btn-dismiss-nudge"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {config?.subtitleText && (
                <div
                  className="text-xs text-muted-foreground mb-4 leading-relaxed"
                  id="signup-popup-description"
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
                   <p id="signup-popup-title" className="text-sm font-bold text-foreground leading-snug">
                    {name ? `Welcome, ${name}!` : "One last step"}
                  </p>
                  {config?.phoneSubtitleText && (
                    <p
                       id="signup-popup-description"
                       className="text-xs text-muted-foreground mt-1"
                      dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(config.phoneSubtitleText) }}
                    />
                  )}
                </div>
                <button
                  onClick={handleDismiss}
                  className="shrink-0 -mt-1 -mr-1 w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                  aria-label="Dismiss"
                  data-testid="btn-dismiss-phone-form"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <form onSubmit={handlePhoneSubmit} noValidate className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium" htmlFor="signup-phone-country-code">Phone number</label>
                  <div className="grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)] gap-2">
                    <select
                      id="signup-phone-country-code"
                      value={countryCode}
                      onChange={(e) => {
                        setCountryCode(e.target.value);
                        clearPhoneValidationFor("phone");
                      }}
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
                      onChange={(e) => {
                        setPhoneInput(e.target.value.replace(/\D/g, ""));
                        clearPhoneValidationFor("phone");
                      }}
                      required={config?.phoneRequired !== false}
                      maxLength={15}
                      className="min-w-0 flex-1"
                      aria-invalid={phoneValidation?.field === "phone" || phoneValidation?.field === "completion"}
                      aria-describedby={
                        phoneValidation?.field === "phone" || phoneValidation?.field === "completion"
                          ? "signup-phone-validation-message"
                          : undefined
                      }
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
                      onChange={(e) => {
                        setBirthdayMonth(e.target.value);
                        clearPhoneValidationFor("birthday");
                      }}
                      className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                      aria-invalid={phoneValidation?.field === "birthday"}
                      aria-describedby={phoneValidation?.field === "birthday" ? "signup-phone-validation-message" : undefined}
                      data-testid="select-signup-birthday-month"
                    >
                      <option value="">Month</option>
                      {MONTH_OPTIONS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
                    </select>
                    <select
                      aria-label="Birthday day"
                      value={birthdayDay}
                      onChange={(e) => {
                        setBirthdayDay(e.target.value);
                        clearPhoneValidationFor("birthday");
                      }}
                      className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                      aria-invalid={phoneValidation?.field === "birthday"}
                      aria-describedby={phoneValidation?.field === "birthday" ? "signup-phone-validation-message" : undefined}
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
                      onChange={(e) => {
                        setAnniversaryMonth(e.target.value);
                        clearPhoneValidationFor("anniversary");
                      }}
                      className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                      aria-invalid={phoneValidation?.field === "anniversary"}
                      aria-describedby={phoneValidation?.field === "anniversary" ? "signup-phone-validation-message" : undefined}
                      data-testid="select-signup-anniversary-month"
                    >
                      <option value="">Month</option>
                      {MONTH_OPTIONS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
                    </select>
                    <select
                      aria-label="Anniversary day"
                      value={anniversaryDay}
                      onChange={(e) => {
                        setAnniversaryDay(e.target.value);
                        clearPhoneValidationFor("anniversary");
                      }}
                      className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                      aria-invalid={phoneValidation?.field === "anniversary"}
                      aria-describedby={phoneValidation?.field === "anniversary" ? "signup-phone-validation-message" : undefined}
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
                    onCheckedChange={handleConsentCheckedChange}
                    onReadToBottomChange={handleConsentReadToBottomChange}
                    testIdPrefix="signup"
                    scrollRegionClassName="touch-pan-y overscroll-contain"
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

      {phoneValidation && view === "phone" && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/25 p-4 backdrop-blur-[1px]"
          data-testid="signup-phone-validation-overlay"
        >
          <div
            ref={phoneValidationDialogRef}
            id="signup-phone-validation-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-live="assertive"
            aria-atomic="true"
            aria-labelledby="signup-phone-validation-title"
            aria-describedby={
              phoneValidation.description
                ? "signup-phone-validation-description"
                : undefined
            }
            tabIndex={0}
            onClick={() => phoneValidationDialogRef.current?.focus()}
            className="flex w-full max-w-xs cursor-pointer items-start gap-3 rounded-xl border border-destructive/40 bg-destructive px-4 py-3 text-destructive-foreground shadow-2xl outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2"
            data-testid="signup-phone-validation-message"
          >
            <div className="min-w-0 flex-1">
              <p id="signup-phone-validation-title" className="text-sm font-semibold">
                {phoneValidation.title}
              </p>
              {phoneValidation.description && (
                <p
                  id="signup-phone-validation-description"
                  className="mt-0.5 break-words text-xs opacity-90"
                >
                  {phoneValidation.description}
                </p>
              )}
            </div>
            <button
              type="button"
              aria-label="Dismiss validation message"
              className="shrink-0 rounded p-1 text-destructive-foreground/80 hover:bg-white/15 hover:text-destructive-foreground focus:outline-none focus:ring-2 focus:ring-white"
              onClick={(event) => {
                event.stopPropagation();
                dismissPhoneValidation();
              }}
              data-testid="btn-dismiss-signup-phone-validation"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
