import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Step = "email" | "otp";

export default function SignInPage() {
  const [, navigate] = useLocation();
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
      toast({ title: "Welcome!", description: "Signed in with Google." });
      navigate("/");
    } catch (err: any) {
      toast({ title: "Sign-in failed", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [navigate, toast]);

  useEffect(() => {
    fetch("/api/auth/google-client-id")
      .then(r => r.json())
      .then(d => { if (d.clientId) setGoogleClientId(d.clientId); })
      .catch(() => {});
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

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await apiRequest("POST", "/api/auth/send-otp", { email: email.trim() });
      setStep("otp");
      toast({ title: "Code sent!", description: "Check your email for the verification code." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to send code", variant: "destructive" });
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
      toast({ title: "Welcome!", description: "You're now signed in." });
      navigate("/");
    } catch (err: any) {
      toast({ title: "Invalid code", description: "Please check and try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="max-w-md mx-auto px-4 py-12 pb-24 md:pb-12">
      <Button variant="ghost" size="sm" className="mb-6" onClick={() => navigate("/")} data-testid="button-back-home">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back
      </Button>

      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2" data-testid="text-signin-title">Sign In</h1>
        <p className="text-muted-foreground text-sm">Sign in to track orders, save your address, and checkout faster.</p>
      </div>

      {step === "email" ? (
        <Card className="p-6 space-y-6">
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email Address</label>
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                data-testid="input-signin-email"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading} data-testid="button-send-otp">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
              Send Verification Code
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

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
        </Card>
      ) : (
        <Card className="p-6 space-y-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">We sent a code to</p>
            <p className="font-medium text-sm">{email}</p>
          </div>

          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Verification Code</label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="Enter 6-digit code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                required
                autoFocus
                className="text-center text-lg tracking-widest"
                data-testid="input-otp-code"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || otp.length !== 6} data-testid="button-verify-otp">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Verify & Sign In
            </Button>
          </form>

          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" className="p-0 h-auto text-xs" onClick={() => setStep("email")} data-testid="button-change-email">
              Change email
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="p-0 h-auto text-xs"
              onClick={handleSendOtp}
              disabled={loading}
              data-testid="button-resend-otp"
            >
              Resend code
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
