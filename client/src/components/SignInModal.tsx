import { useState, useEffect, useRef, useCallback } from "react";
import { X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export const SIGNIN_MODAL_EVENT = "show:signin-modal";

export function showSignInModal() {
  window.dispatchEvent(new CustomEvent(SIGNIN_MODAL_EVENT));
}

export default function SignInModal() {
  const { toast } = useToast();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const googleInitialized = useRef(false);

  useEffect(() => {
    fetch("/api/auth/google-client-id")
      .then(r => r.json())
      .then(d => { if (d.clientId) setGoogleClientId(d.clientId); })
      .catch(() => {});
  }, []);

  const handleGoogleCredential = useCallback(async (response: any) => {
    if (!response.credential) return;
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/google", { credential: response.credential });
      const data = await res.json();
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

  useEffect(() => {
    if (!visible) return;
    setLoading(false);
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
      </div>
    </div>
  );
}
