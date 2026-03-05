import { useState, useEffect, useRef, useCallback } from "react";
import { X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface SignInModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SignInModal({ open, onClose, onSuccess }: SignInModalProps) {
  const { toast } = useToast();
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

          {loading && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          )}

          <div ref={googleButtonRef} className="flex justify-center" data-testid="signin-modal-google" />

          <p className="text-xs text-center text-gray-400 dark:text-gray-500">
            By signing in, you agree to our terms of service and privacy policy.
          </p>
        </div>
      </div>
    </div>
  );
}
