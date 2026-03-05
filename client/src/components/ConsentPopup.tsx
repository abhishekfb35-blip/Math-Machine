import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { X, Gift, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STORAGE_KEY = "consent_popup_completed";
const CONSENT_TYPE = "whatsapp_marketing";

const DEFAULT_HEADLINE = "Get 10% Off Your First Order";
const DEFAULT_DESCRIPTION = "Sign up for updates and get an exclusive discount code";
const DEFAULT_CONSENT_TEXT = "I agree to receive order updates and promotional messages from TurtleLittle via WhatsApp and email.";
const DEFAULT_DISCOUNT_PERCENT = 10;

const EXCLUDED_PREFIXES = ["/admin", "/signin", "/checkout", "/order"];

interface PopupSettings {
  enabled: boolean;
  headline: string;
  description: string;
  consentText: string;
  discountPercent: number;
}

export default function ConsentPopup() {
  const [location] = useLocation();
  const { customer, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [discountCode, setDiscountCode] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [settings, setSettings] = useState<PopupSettings | null>(null);
  const settingsLoaded = useRef(false);
  const triggered = useRef(false);
  const scrollCount = useRef(0);

  useEffect(() => {
    if (settingsLoaded.current) return;
    settingsLoaded.current = true;
    fetch("/api/site-config/consent-popup")
      .then(r => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(d => {
        setSettings({
          enabled: d.value?.enabled ?? true,
          headline: d.value?.headline || DEFAULT_HEADLINE,
          description: d.value?.description || DEFAULT_DESCRIPTION,
          consentText: d.value?.consentText || DEFAULT_CONSENT_TEXT,
          discountPercent: d.value?.discountPercent ?? DEFAULT_DISCOUNT_PERCENT,
        });
      })
      .catch(() => {
        setSettings({
          enabled: true,
          headline: DEFAULT_HEADLINE,
          description: DEFAULT_DESCRIPTION,
          consentText: DEFAULT_CONSENT_TEXT,
          discountPercent: DEFAULT_DISCOUNT_PERCENT,
        });
      });
  }, []);

  const shouldShow = useCallback(() => {
    if (localStorage.getItem(STORAGE_KEY)) return false;
    if (EXCLUDED_PREFIXES.some(p => location.startsWith(p))) return false;
    if (settings && !settings.enabled) return false;
    return true;
  }, [location, settings]);

  const checkAlreadyConsented = useCallback(async () => {
    try {
      const params = new URLSearchParams({ consentType: CONSENT_TYPE });
      if (isAuthenticated && customer?.email) {
        params.set("email", customer.email);
      }
      const res = await fetch(`/api/consent/check?${params}`);
      const data = await res.json();
      if (data.consented) {
        localStorage.setItem(STORAGE_KEY, "1");
        return true;
      }
    } catch {}
    return false;
  }, [isAuthenticated, customer]);

  const triggerPopup = useCallback(async () => {
    if (triggered.current) return;
    if (!shouldShow()) return;
    triggered.current = true;

    const alreadyDone = await checkAlreadyConsented();
    if (alreadyDone) return;

    if (isAuthenticated && customer) {
      const nameParts = (customer.name || "").split(" ");
      setFirstName(nameParts[0] || "");
      setLastName(nameParts.slice(1).join(" ") || "");
      setEmail(customer.email);
      setPhone(customer.phone || "");
    }

    setVisible(true);
  }, [shouldShow, checkAlreadyConsented, isAuthenticated, customer]);

  useEffect(() => {
    if (authLoading || !settings) return;
    if (!shouldShow()) return;

    const timer = setTimeout(() => {
      triggerPopup();
    }, 5000);

    const handleScroll = () => {
      scrollCount.current += 1;
      if (scrollCount.current >= 2) {
        triggerPopup();
      }
    };

    window.addEventListener("wheel", handleScroll, { passive: true });
    window.addEventListener("touchmove", handleScroll, { passive: true });

    return () => {
      clearTimeout(timer);
      window.removeEventListener("wheel", handleScroll);
      window.removeEventListener("touchmove", handleScroll);
    };
  }, [authLoading, settings, shouldShow, triggerPopup]);

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, "1");
  };

  const consentText = settings?.consentText || DEFAULT_CONSENT_TEXT;
  const headline = settings?.headline || DEFAULT_HEADLINE;
  const description = settings?.description || DEFAULT_DESCRIPTION;
  const discountPercent = settings?.discountPercent ?? DEFAULT_DISCOUNT_PERCENT;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fn = firstName.trim() || (isAuthenticated && customer?.name?.split(" ")[0]) || "";
    const ln = lastName.trim() || (isAuthenticated && customer?.name?.split(" ").slice(1).join(" ")) || "";
    const em = email.trim() || (isAuthenticated && customer?.email) || "";
    if (!fn || !em) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/consent", {
        firstName: fn,
        lastName: ln || ".",
        email: em,
        phone: phone.trim() || null,
        consentType: CONSENT_TYPE,
        consentGiven: true,
        pageUrl: location,
        consentText,
      });
      const data = await res.json();
      localStorage.setItem(STORAGE_KEY, "1");
      setDiscountCode(data.discountCode || null);
    } catch (err: any) {
      toast({ title: "Something went wrong", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  if (discountCode) {
    return (
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" data-testid="consent-success-overlay">
        <div className="absolute inset-0 bg-black/40" onClick={handleDismiss} />
        <div className="relative bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl w-full max-w-md mx-auto p-6 shadow-xl animate-in slide-in-from-bottom duration-300" data-testid="consent-success-dialog">
          <button onClick={handleDismiss} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600" data-testid="consent-close">
            <X className="w-5 h-5" />
          </button>
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <Gift className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">You're all set!</h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm">Here's your one-time {discountPercent}% discount code:</p>
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-3 font-mono text-lg font-bold text-green-700 dark:text-green-400 select-all" data-testid="discount-code">
              {discountCode}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Apply this code at checkout. Valid for your first order only.
            </p>
            <Button onClick={handleDismiss} className="w-full" data-testid="consent-done-button">
              Start Shopping
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" data-testid="consent-overlay">
      <div className="absolute inset-0 bg-black/40" onClick={handleDismiss} />
      <div className="relative bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl w-full max-w-md mx-auto shadow-xl animate-in slide-in-from-bottom duration-300" data-testid="consent-dialog">
        <button onClick={handleDismiss} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10" data-testid="consent-dismiss">
          <X className="w-5 h-5" />
        </button>

        <div className="p-6">
          <div className="text-center mb-4">
            <div className="mx-auto w-14 h-14 bg-[hsl(var(--primary)/.1)] rounded-full flex items-center justify-center mb-3">
              <Gift className="w-7 h-7 text-[hsl(var(--primary))]" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{headline}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {!isAuthenticated && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="First name *"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    required
                    data-testid="consent-first-name"
                  />
                  <Input
                    placeholder="Last name *"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    required
                    data-testid="consent-last-name"
                  />
                </div>
                <Input
                  type="email"
                  placeholder="Email address *"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  data-testid="consent-email"
                />
              </>
            )}
            <Input
              type="tel"
              placeholder="Phone number (optional)"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              data-testid="consent-phone"
            />

            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              {consentText}
            </p>

            <Button
              type="submit"
              className="w-full"
              disabled={submitting}
              data-testid="consent-submit"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {submitting ? "Signing up..." : `Get My ${discountPercent}% Discount`}
            </Button>

            <button
              type="button"
              onClick={handleDismiss}
              className="w-full text-center text-xs text-gray-400 hover:text-gray-600 py-1"
              data-testid="consent-no-thanks"
            >
              No thanks
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
