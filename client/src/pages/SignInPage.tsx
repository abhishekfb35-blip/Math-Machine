import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getMonthDayValue, MONTH_OPTIONS, PHONE_COUNTRY_CODES } from "@/lib/signupProfileDetails";
import { ConsentScrollGate } from "@/components/ConsentScrollGate";

export default function SignInPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
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
      toast({ title: "Welcome!", description: "Signed in with Google." });
      navigate("/");
    } catch (err: any) {
      toast({ title: "Sign-in failed", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [navigate, toast]);

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
      toast({ title: "Welcome!", description: "Your account has been created." });
      navigate("/");
    } catch (err: any) {
      toast({ title: "Sign-up failed", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setSubmittingPhone(false);
    }
  }, [anniversaryDay, anniversaryMonth, birthdayDay, birthdayMonth, consentChecked, consentConfigLoaded, consentReadToBottom, consentText, countryCode, phoneInput, pendingCredential, navigate, toast]);

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

  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current || googleInitialized.current) return;

    const renderButton = () => {
      const google = (window as any).google;
      if (!google?.accounts?.id || !googleButtonRef.current) return;

      google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredential,
      });
      google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        width: googleButtonRef.current.offsetWidth || 320,
        text: "continue_with",
      });
      googleInitialized.current = true;
    };

    if ((window as any).google?.accounts?.id) {
      renderButton();
    } else {
      const interval = setInterval(() => {
        if ((window as any).google?.accounts?.id) {
          clearInterval(interval);
          renderButton();
        }
      }, 200);
      return () => clearInterval(interval);
    }
  }, [googleClientId, handleGoogleCredential]);

  return (
    <div className="max-w-md mx-auto px-4 py-12 pb-24 md:pb-12">
      <Button variant="ghost" size="sm" className="mb-6" onClick={() => navigate("/")} data-testid="button-back-home">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back
      </Button>

      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2" data-testid="text-signin-title">
          {view === "phone" ? "One last step" : "Sign In"}
        </h1>
        <p className="text-muted-foreground text-sm">
          {view === "phone"
            ? "Add your phone number to complete your account."
            : "Sign in to track orders, save your address, and checkout faster."}
        </p>
      </div>

      <Card className="p-6 space-y-4">
        {view === "phone" ? (
          <form onSubmit={handlePhoneSubmit} className="space-y-3">
            <div>
              <div className="mb-1 flex items-center gap-1.5">
                <label className="text-xs font-medium" htmlFor="signin-page-birthday-month">Birthday</label>
                <span className="text-xs text-muted-foreground">Optional</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select id="signin-page-birthday-month" value={birthdayMonth} onChange={e => setBirthdayMonth(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" data-testid="signin-page-birthday-month">
                  <option value="">Month</option>
                  {MONTH_OPTIONS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
                </select>
                <select aria-label="Birthday day" value={birthdayDay} onChange={e => setBirthdayDay(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" data-testid="signin-page-birthday-day">
                  <option value="">Day</option>
                  {Array.from({ length: 31 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
                </select>
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center gap-1.5">
                <label className="text-xs font-medium" htmlFor="signin-page-anniversary-month">Anniversary</label>
                <span className="text-xs text-muted-foreground">Optional</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select id="signin-page-anniversary-month" value={anniversaryMonth} onChange={e => setAnniversaryMonth(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" data-testid="signin-page-anniversary-month">
                  <option value="">Month</option>
                  {MONTH_OPTIONS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
                </select>
                <select aria-label="Anniversary day" value={anniversaryDay} onChange={e => setAnniversaryDay(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" data-testid="signin-page-anniversary-day">
                  <option value="">Day</option>
                  {Array.from({ length: 31 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" htmlFor="signin-page-country-code">Phone number</label>
              <div className="grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)] gap-2">
                <select id="signin-page-country-code" value={countryCode} onChange={e => setCountryCode(e.target.value)} className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm" data-testid="signin-page-country-code">
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
                  data-testid="signin-page-phone-input"
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
                testIdPrefix="signin-page"
              />
            )}
            <Button type="submit" className="w-full" disabled={submittingPhone || !consentConfigLoaded || !phoneInput.trim() || (!!consentText && (!consentReadToBottom || !consentChecked))} data-testid="signin-page-phone-submit">
              {submittingPhone ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creating account…</> : "Create my account"}
            </Button>
          </form>
        ) : (
          <>
            {loading && (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {googleClientId ? (
              <div ref={googleButtonRef} className="flex justify-center" data-testid="button-google-signin" />
            ) : (
              <Button variant="outline" className="w-full" disabled data-testid="button-google-signin">
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </Button>
            )}

            <p className="text-xs text-center text-muted-foreground">
              By signing in, you agree to our terms of service and privacy policy.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
