import { useState, useEffect, useRef, useCallback } from "react";
import { X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getMonthDayValue, MONTH_OPTIONS, PHONE_COUNTRY_CODES } from "@/lib/signupProfileDetails";
import { ConsentScrollGate } from "@/components/ConsentScrollGate";

export const SIGNIN_MODAL_EVENT = "show:signin-modal";

export function showSignInModal() {
  window.dispatchEvent(new CustomEvent(SIGNIN_MODAL_EVENT));
}

export default function SignInModal() {
  const { toast } = useToast();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"google" | "phone">("google");
  const [pendingCredential, setPendingCredential] = useState<string | null>(null);
  const [birthdayMonth, setBirthdayMonth] = useState("");
  const [birthdayDay, setBirthdayDay] = useState("");
  const [anniversaryMonth, setAnniversaryMonth] = useState("");
  const [anniversaryDay, setAnniversaryDay] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [phoneInput, setPhoneInput] = useState("");
  const [consentText, setConsentText] = useState("");
  const [consentScrollPrompt, setConsentScrollPrompt] = useState("Scroll to the bottom to enable agreement.");
  const [consentAgreementLabel, setConsentAgreementLabel] = useState("I agree to the consent text above.");
  const [consentConfigLoaded, setConsentConfigLoaded] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentReadToBottom, setConsentReadToBottom] = useState(false);
  const [submittingPhone, setSubmittingPhone] = useState(false);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const googleInitialized = useRef(false);

  useEffect(() => {
    fetch("/api/auth/google-client-id")
      .then(r => r.json())
      .then(d => { if (d.clientId) setGoogleClientId(d.clientId); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/site-config/signup-popup")
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        setConsentText(typeof data?.value?.consentText === "string" ? data.value.consentText : "");
        setConsentScrollPrompt(typeof data?.value?.consentScrollPrompt === "string" && data.value.consentScrollPrompt.trim() ? data.value.consentScrollPrompt : "Scroll to the bottom to enable agreement.");
        setConsentAgreementLabel(typeof data?.value?.consentAgreementLabel === "string" && data.value.consentAgreementLabel.trim() ? data.value.consentAgreementLabel : "I agree to the consent text above.");
      })
      .catch(() => setConsentText(""))
      .finally(() => setConsentConfigLoaded(true));
  }, []);

  const handleGoogleCredential = useCallback(async (response: any) => {
    if (!response.credential) return;
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/google", { credential: response.credential });
      const data = await res.json();
      if (data.needsPhone) {
        setPendingCredential(response.credential);
        setView("phone");
        return;
      }
      queryClient.setQueryData(["/api/auth/me"], data.customer);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setVisible(false);
      toast({ title: "Welcome!", description: "Signed in successfully." });
    } catch (err: any) {
      toast({ title: "Sign-in failed", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const handlePhoneSubmit = useCallback(async (e: React.FormEvent) => {
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
    if (!consentConfigLoaded) {
      toast({ title: "Preparing consent details", description: "Please wait a moment and try again.", variant: "destructive" });
      return;
    }
    if (consentText && (!consentReadToBottom || !consentChecked)) {
      toast({ title: consentReadToBottom ? "Please agree to the terms to continue" : "Please read the entire consent text to continue", variant: "destructive" });
      return;
    }
    if (!phoneInput.trim() || !pendingCredential) return;
    setSubmittingPhone(true);
    try {
      const res = await apiRequest("POST", "/api/auth/google/complete", {
        credential: pendingCredential,
        phone: phoneInput.trim(),
        countryCode,
        birthdayMonthDay: birthday.value,
        anniversaryMonthDay: anniversary.value,
        consentGiven: consentChecked,
        consentText,
        consentReadToBottom,
      });
      const data = await res.json();
      queryClient.setQueryData(["/api/auth/me"], data.customer);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setVisible(false);
      toast({ title: "Welcome!", description: "Your account has been created." });
    } catch (err: any) {
      toast({ title: "Sign-up failed", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setSubmittingPhone(false);
    }
  }, [anniversaryDay, anniversaryMonth, birthdayDay, birthdayMonth, consentChecked, consentConfigLoaded, consentReadToBottom, consentText, countryCode, phoneInput, pendingCredential, toast]);

  useEffect(() => {
    if (!visible) return;
    setLoading(false);
    setView("google");
    setPendingCredential(null);
    setBirthdayMonth("");
    setBirthdayDay("");
    setAnniversaryMonth("");
    setAnniversaryDay("");
    setCountryCode("+91");
    setPhoneInput("");
    setConsentChecked(false);
    setConsentReadToBottom(false);
    googleInitialized.current = false;
  }, [visible]);

  useEffect(() => {
    if (!visible || !googleClientId || !googleButtonRef.current || googleInitialized.current) return;

    const renderButton = () => {
      const google = (window as any).google;
      if (!google?.accounts?.id || !googleButtonRef.current) return false;

      google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredential,
      });
      google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        width: googleButtonRef.current.offsetWidth || 280,
        text: "continue_with",
      });
      googleInitialized.current = true;
      return true;
    };

    if (!renderButton()) {
      const interval = setInterval(() => {
        if (renderButton()) clearInterval(interval);
      }, 200);
      const timeout = setTimeout(() => clearInterval(interval), 5000);
      return () => { clearInterval(interval); clearTimeout(timeout); };
    }
  }, [visible, googleClientId, handleGoogleCredential]);

  useEffect(() => {
    const handleShow = () => {
      setVisible(true);
    };
    window.addEventListener(SIGNIN_MODAL_EVENT, handleShow);
    return () => window.removeEventListener(SIGNIN_MODAL_EVENT, handleShow);
  }, []);

  const handleClose = () => {
    try {
      (window as any).google?.accounts?.id?.cancel();
    } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center"
      data-testid="signin-modal-overlay"
    >
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      <div
        className="relative bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl w-full max-w-sm mx-auto p-6 shadow-xl animate-in slide-in-from-bottom duration-300"
        data-testid="signin-modal"
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          data-testid="signin-modal-close"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {view === "phone" ? (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">One last step</h3>
              <p className="text-sm text-muted-foreground mt-1">Add your phone number to complete sign-up.</p>
            </div>
            <form onSubmit={handlePhoneSubmit} className="space-y-3">
              <div>
                <div className="mb-1 flex items-center gap-1.5">
                  <label className="text-xs font-medium" htmlFor="signin-modal-birthday-month">Birthday</label>
                  <span className="text-xs text-muted-foreground">Optional</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select id="signin-modal-birthday-month" value={birthdayMonth} onChange={e => setBirthdayMonth(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" data-testid="signin-modal-birthday-month">
                    <option value="">Month</option>
                    {MONTH_OPTIONS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
                  </select>
                  <select aria-label="Birthday day" value={birthdayDay} onChange={e => setBirthdayDay(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" data-testid="signin-modal-birthday-day">
                    <option value="">Day</option>
                    {Array.from({ length: 31 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center gap-1.5">
                  <label className="text-xs font-medium" htmlFor="signin-modal-anniversary-month">Anniversary</label>
                  <span className="text-xs text-muted-foreground">Optional</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select id="signin-modal-anniversary-month" value={anniversaryMonth} onChange={e => setAnniversaryMonth(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" data-testid="signin-modal-anniversary-month">
                    <option value="">Month</option>
                    {MONTH_OPTIONS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
                  </select>
                  <select aria-label="Anniversary day" value={anniversaryDay} onChange={e => setAnniversaryDay(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" data-testid="signin-modal-anniversary-day">
                    <option value="">Day</option>
                    {Array.from({ length: 31 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" htmlFor="signin-modal-country-code">Phone number</label>
                <div className="grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)] gap-2">
                  <select id="signin-modal-country-code" value={countryCode} onChange={e => setCountryCode(e.target.value)} className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm" data-testid="signin-modal-country-code">
                    {PHONE_COUNTRY_CODES.map(({ code, label }) => <option key={code} value={code}>{label}</option>)}
                  </select>
                  <Input
                    type="tel"
                    inputMode="numeric"
                    placeholder="Local phone number"
                    value={phoneInput}
                    onChange={e => setPhoneInput(e.target.value.replace(/\D/g, ""))}
                    required
                    maxLength={15}
                    autoFocus
                    className="min-w-0 flex-1"
                    data-testid="signin-modal-phone-input"
                  />
                </div>
              </div>
              {consentText && (
                <ConsentScrollGate
                  consentText={consentText}
                  scrollPrompt={consentScrollPrompt}
                  agreementLabel={consentAgreementLabel}
                  checked={consentChecked}
                  onCheckedChange={setConsentChecked}
                  onReadToBottomChange={setConsentReadToBottom}
                  testIdPrefix="signin-modal"
                />
              )}
              <Button type="submit" className="w-full" disabled={submittingPhone || !consentConfigLoaded || !phoneInput.trim() || (!!consentText && (!consentReadToBottom || !consentChecked))} data-testid="signin-modal-phone-submit">
                {submittingPhone ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creating account…</> : "Create my account"}
              </Button>
            </form>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Sign in to TurtleLittle
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Save your wishlist and shop faster
              </p>
            </div>

            <div className="relative min-h-[44px]">
              <div
                ref={googleButtonRef}
                className="flex justify-center min-h-[44px]"
                data-testid="signin-modal-google-btn"
              />
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 rounded">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              By signing in, you agree to our{" "}
              <a href="/terms" className="underline hover:text-foreground" onClick={handleClose}>
                terms
              </a>{" "}
              and{" "}
              <a href="/privacy" className="underline hover:text-foreground" onClick={handleClose}>
                privacy policy
              </a>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
