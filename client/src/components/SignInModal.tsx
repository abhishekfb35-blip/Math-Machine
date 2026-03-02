import { useState, useEffect, useRef, useCallback } from "react";
import { X, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Step = "email" | "otp";

interface SignInModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SignInModal({ open, onClose, onSuccess }: SignInModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const googleInitialized = useRef(false);

  const handleGoogleCredential = useCallback(async (response: any) => {
    if (!response.credential) return;
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/google", { credential: response.credential });
      const data = await res.json();
      queryClient.setQueryData(["/api/auth/me"], data.customer);
      toast({ title: "Signed in!", description: "Placing your order..." });
      onSuccess();
    } catch (err: any) {
      toast({ title: "Sign-in failed", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [onSuccess, toast]);

  useEffect(() => {
    if (!open) return;
    setStep("email");
    setEmail("");
    setOtp("");
    setLoading(false);
    googleInitialized.current = false;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/auth/google-client-id")
      .then(r => r.json())
      .then(d => { if (d.clientId) setGoogleClientId(d.clientId); })
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open || !googleClientId || !googleButtonRef.current || googleInitialized.current) return;

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
        width: googleButtonRef.current.offsetWidth || 300,
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
  }, [open, googleClientId, handleGoogleCredential]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await apiRequest("POST", "/api/auth/send-otp", { email: email.trim() });
      setStep("otp");
      toast({ title: "OTP sent!", description: `Check ${email} for the verification code.` });
    } catch (err: any) {
      toast({ title: "Failed to send OTP", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) return;
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/verify-otp", { email: email.trim(), otp: otp.trim() });
      const data = await res.json();
      queryClient.setQueryData(["/api/auth/me"], data.customer);
      toast({ title: "Signed in!", description: "Placing your order..." });
      onSuccess();
    } catch (err: any) {
      toast({ title: "Invalid OTP", description: err.message || "Please check and try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" data-testid="signin-modal-overlay">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl w-full max-w-md mx-auto shadow-xl animate-in slide-in-from-bottom duration-300" data-testid="signin-modal">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10" data-testid="signin-modal-close">
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 space-y-5">
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Sign in to place your order</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Quick sign-in to complete your purchase
            </p>
          </div>

          <div ref={googleButtonRef} className="flex justify-center" data-testid="signin-modal-google" />

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
            <span className="text-xs text-gray-400 uppercase">or</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          </div>

          {step === "email" ? (
            <form onSubmit={handleSendOtp} className="space-y-3">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="pl-10"
                  required
                  autoFocus
                  data-testid="signin-modal-email"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading} data-testid="signin-modal-send-otp">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {loading ? "Sending..." : "Send OTP"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Enter the code sent to <strong>{email}</strong>
              </p>
              <Input
                type="text"
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={e => setOtp(e.target.value)}
                maxLength={6}
                required
                autoFocus
                className="text-center text-lg tracking-widest"
                data-testid="signin-modal-otp"
              />
              <Button type="submit" className="w-full" disabled={loading} data-testid="signin-modal-verify">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {loading ? "Verifying..." : "Verify & Continue"}
              </Button>
              <button type="button" onClick={() => setStep("email")} className="w-full text-center text-xs text-gray-400 hover:text-gray-600" data-testid="signin-modal-change-email">
                Use a different email
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
