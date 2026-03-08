import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { X, Gift, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SESSION_KEY = "consent_popup_dismissed";
const CONSENT_TYPE = "whatsapp_marketing";

const DEFAULT_HEADLINE = "Get 10% Off Your First Order";
const DEFAULT_DESCRIPTION = "Sign up for updates and get an exclusive discount code";
const DEFAULT_CONSENT_TEXT = "I agree to receive order updates and promotional messages from TurtleLittle via WhatsApp and email.";
const DEFAULT_DISCOUNT_PERCENT = 10;

const EXCLUDED_PREFIXES = ["/admin", "/signin", "/checkout", "/order"];

interface FormFieldConfig {
  name: string;
  label: string;
  type: string;
  placeholder: string;
  enabled: boolean;
  required: boolean;
  hideWhenLoggedIn: boolean;
}

const DEFAULT_FIELDS: FormFieldConfig[] = [
  { name: "firstName", label: "First Name", type: "text", placeholder: "First name", enabled: true, required: true, hideWhenLoggedIn: false },
  { name: "lastName", label: "Last Name", type: "text", placeholder: "Last name", enabled: true, required: true, hideWhenLoggedIn: false },
  { name: "email", label: "Email", type: "email", placeholder: "Email address", enabled: true, required: true, hideWhenLoggedIn: true },
  { name: "phone", label: "Phone", type: "tel", placeholder: "Phone number", enabled: true, required: false, hideWhenLoggedIn: false },
];

interface PopupSettings {
  enabled: boolean;
  headline: string;
  description: string;
  consentText: string;
  buttonText: string;
  discountPercent: number;
  fields: FormFieldConfig[];
}

export default function ConsentPopup() {
  const [location] = useLocation();
  const { customer, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [discountCode, setDiscountCode] = useState<string | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{ message: string; discountCode: string | null; discountUsed: boolean } | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({
    firstName: "", lastName: "", email: "", phone: "",
  });
  const [settings, setSettings] = useState<PopupSettings | null>(null);
  const settingsLoaded = useRef(false);
  const triggered = useRef(false);
  const dismissed = useRef(false);
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
        const savedFields = d.value?.fields;
        const mergedFields = DEFAULT_FIELDS.map(df => {
          const sf = savedFields?.find((f: FormFieldConfig) => f.name === df.name);
          return sf ? { ...df, ...sf } : df;
        });
        setSettings({
          enabled: d.value?.enabled ?? true,
          headline: d.value?.headline || DEFAULT_HEADLINE,
          description: d.value?.description || DEFAULT_DESCRIPTION,
          consentText: d.value?.consentText || DEFAULT_CONSENT_TEXT,
          buttonText: d.value?.buttonText || "",
          discountPercent: d.value?.discountPercent ?? DEFAULT_DISCOUNT_PERCENT,
          fields: mergedFields,
        });
      })
      .catch(() => {
        setSettings({
          enabled: true,
          headline: DEFAULT_HEADLINE,
          description: DEFAULT_DESCRIPTION,
          consentText: DEFAULT_CONSENT_TEXT,
          buttonText: "",
          discountPercent: DEFAULT_DISCOUNT_PERCENT,
          fields: DEFAULT_FIELDS,
        });
      });
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      dismissed.current = false;
      triggered.current = false;
      scrollCount.current = 0;
    }
  }, [isAuthenticated]);

  const shouldShow = useCallback(() => {
    if (dismissed.current) return false;
    if (sessionStorage.getItem(SESSION_KEY)) return false;
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
        sessionStorage.setItem(SESSION_KEY, "consented");
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
      setFormValues(prev => ({
        ...prev,
        firstName: nameParts[0] || "",
        lastName: nameParts.slice(1).join(" ") || "",
        email: customer.email || "",
        phone: customer.phone || "",
      }));
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
    dismissed.current = true;
    triggered.current = false;
    scrollCount.current = 0;
  };

  const fields = settings?.fields || DEFAULT_FIELDS;
  const enabledFields = fields.filter(f => f.enabled);
  const visibleFields = enabledFields.filter(f => !(f.hideWhenLoggedIn && isAuthenticated));
  const consentText = settings?.consentText || DEFAULT_CONSENT_TEXT;
  const headline = settings?.headline || DEFAULT_HEADLINE;
  const description = settings?.description || DEFAULT_DESCRIPTION;
  const discountPercent = settings?.discountPercent ?? DEFAULT_DISCOUNT_PERCENT;
  const buttonText = settings?.buttonText || `Get My ${discountPercent}% Discount`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!consentChecked) {
      toast({ title: "Please agree to the terms to continue", variant: "destructive" });
      return;
    }

    for (const field of visibleFields) {
      if (field.required && !formValues[field.name]?.trim()) {
        toast({ title: `${field.label} is required`, variant: "destructive" });
        return;
      }
    }

    const fn = formValues.firstName?.trim() || (isAuthenticated && customer?.name?.split(" ")[0]) || "";
    const ln = formValues.lastName?.trim() || (isAuthenticated && customer?.name?.split(" ").slice(1).join(" ")) || "";
    const em = formValues.email?.trim() || (isAuthenticated && customer?.email) || "";
    const emailField = enabledFields.find(f => f.name === "email");
    const emailRequired = emailField ? emailField.required : false;

    if (emailRequired && !em) {
      toast({ title: "Email is required", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/consent", {
        firstName: fn || ".",
        lastName: ln || ".",
        email: em || null,
        phone: formValues.phone?.trim() || null,
        consentType: CONSENT_TYPE,
        consentGiven: true,
        pageUrl: location,
        consentText,
      });
      const data = await res.json();

      sessionStorage.setItem(SESSION_KEY, "consented");

      if (data.alreadyExists) {
        setDuplicateInfo({
          message: data.message,
          discountCode: data.discountCode || null,
          discountUsed: !!data.discountUsed,
        });
      } else {
        setDiscountCode(data.discountCode || null);
      }
    } catch (err: any) {
      toast({ title: "Something went wrong", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const updateFormValue = (name: string, value: string) => {
    setFormValues(prev => ({ ...prev, [name]: value }));
  };

  if (!visible) return null;

  if (duplicateInfo) {
    return (
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" data-testid="consent-duplicate-overlay">
        <div className="absolute inset-0 bg-black/40" onClick={handleDismiss} />
        <div className="relative bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl w-full max-w-md mx-auto p-6 shadow-xl animate-in slide-in-from-bottom duration-300" data-testid="consent-duplicate-dialog">
          <button onClick={handleDismiss} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600" data-testid="consent-close">
            <X className="w-5 h-5" />
          </button>
          <div className="text-center space-y-4">
            <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${
              duplicateInfo.discountUsed
                ? "bg-gray-100 dark:bg-gray-800"
                : "bg-green-100 dark:bg-green-900/30"
            }`}>
              {duplicateInfo.discountUsed ? (
                <AlertCircle className="w-8 h-8 text-gray-500 dark:text-gray-400" />
              ) : (
                <Gift className="w-8 h-8 text-green-600 dark:text-green-400" />
              )}
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              {duplicateInfo.discountUsed ? "Already Claimed" : "Welcome Back!"}
            </h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm">{duplicateInfo.message}</p>
            {duplicateInfo.discountCode && !duplicateInfo.discountUsed && (
              <>
                <p className="text-gray-600 dark:text-gray-300 text-sm">Here's your existing discount code:</p>
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-3 font-mono text-lg font-bold text-green-700 dark:text-green-400 select-all" data-testid="discount-code-existing">
                  {duplicateInfo.discountCode}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Apply this code at checkout. Valid for your first order only.
                </p>
              </>
            )}
            <Button onClick={handleDismiss} className="w-full" data-testid="consent-close-button">
              {duplicateInfo.discountUsed ? "Close" : "Start Shopping"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

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

  const nameFields = visibleFields.filter(f => f.name === "firstName" || f.name === "lastName");
  const otherFields = visibleFields.filter(f => f.name !== "firstName" && f.name !== "lastName");

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
            {nameFields.length > 0 && (
              <div className={nameFields.length === 2 ? "grid grid-cols-2 gap-3" : ""}>
                {nameFields.map(field => (
                  <Input
                    key={field.name}
                    type={field.type}
                    placeholder={`${field.placeholder}${field.required ? " *" : ""}`}
                    value={formValues[field.name] || ""}
                    onChange={e => updateFormValue(field.name, e.target.value)}
                    required={field.required}
                    data-testid={`consent-${field.name}`}
                  />
                ))}
              </div>
            )}
            {otherFields.map(field => (
              <Input
                key={field.name}
                type={field.type}
                placeholder={`${field.placeholder}${field.required ? " *" : ""}`}
                value={formValues[field.name] || ""}
                onChange={e => updateFormValue(field.name, e.target.value)}
                required={field.required}
                data-testid={`consent-${field.name}`}
              />
            ))}

            <label className="flex items-start gap-2 cursor-pointer" data-testid="consent-checkbox-label">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={e => setConsentChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))] shrink-0"
                data-testid="consent-checkbox"
              />
              <span className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                {consentText}
              </span>
            </label>

            <Button
              type="submit"
              className="w-full"
              disabled={submitting || !consentChecked}
              data-testid="consent-submit"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {submitting ? "Signing up..." : buttonText}
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
