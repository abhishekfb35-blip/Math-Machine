import { useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const DISMISSED_KEY = "google_onetap_dismissed";
const VISITED_KEY = "tl_has_visited";

export default function GoogleOneTap() {
  const [location, navigate] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const initialized = useRef(false);

  const handleCredential = useCallback(async (response: any) => {
    if (!response.credential) return;
    try {
      const res = await apiRequest("POST", "/api/auth/google", { credential: response.credential });
      const data = await res.json();
      queryClient.setQueryData(["/api/auth/me"], data.customer);
      toast({ title: "Welcome!", description: "Signed in with Google." });
      navigate("/");
    } catch (err: any) {
      toast({ title: "Sign-in failed", description: err.message || "Please try again.", variant: "destructive" });
    }
  }, [navigate, toast]);

  useEffect(() => {
    if (isLoading || isAuthenticated) return;
    if (location.startsWith("/admin") || location === "/signin") return;
    if (sessionStorage.getItem(DISMISSED_KEY)) return;
    if (initialized.current) return;

    const hasVisitedBefore = localStorage.getItem(VISITED_KEY);
    if (!hasVisitedBefore) {
      localStorage.setItem(VISITED_KEY, "1");
      return;
    }

    let cancelled = false;

    fetch("/api/auth/google-client-id")
      .then(r => r.json())
      .then(d => {
        if (cancelled || !d.clientId) return;

        const tryPrompt = () => {
          const google = (window as any).google;
          if (!google?.accounts?.id) return false;

          google.accounts.id.initialize({
            client_id: d.clientId,
            callback: handleCredential,
            cancel_on_tap_outside: true,
          });
          google.accounts.id.prompt((notification: any) => {
            if (notification.isSkippedMoment() || notification.isDismissedMoment()) {
              sessionStorage.setItem(DISMISSED_KEY, "1");
            }
          });
          initialized.current = true;
          return true;
        };

        if (!tryPrompt()) {
          const interval = setInterval(() => {
            if (cancelled) { clearInterval(interval); return; }
            if (tryPrompt()) clearInterval(interval);
          }, 300);
          setTimeout(() => clearInterval(interval), 5000);
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [isLoading, isAuthenticated, location, handleCredential]);

  return null;
}
