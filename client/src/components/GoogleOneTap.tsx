import { useEffect, useCallback, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { X, Gift } from "lucide-react";

const DISMISSED_KEY = "google_onetap_dismissed";
const VISITED_KEY = "tl_has_visited";

// How long to wait (ms) before showing One Tap on 2nd+ visits
const PROMPT_DELAY_MS = 4000;
// How long the incentive nudge shows before One Tap appears
const NUDGE_LEAD_MS = 800;

export default function GoogleOneTap() {
  const [location, navigate] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const initialized = useRef(false);
  const [showNudge, setShowNudge] = useState(false);

  const handleCredential = useCallback(async (response: any) => {
    if (!response.credential) return;
    try {
      const res = await apiRequest("POST", "/api/auth/google", { credential: response.credential });
      const data = await res.json();
      queryClient.setQueryData(["/api/auth/me"], data.customer);
      setShowNudge(false);
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

    const run = () => {
      fetch("/api/auth/google-client-id")
        .then(r => r.json())
        .then(d => {
          if (cancelled || !d.clientId) return;

          // Show incentive nudge slightly before One Tap appears
          setTimeout(() => {
            if (!cancelled) setShowNudge(true);
          }, PROMPT_DELAY_MS - NUDGE_LEAD_MS);

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

          // Wait PROMPT_DELAY_MS before triggering One Tap
          setTimeout(() => {
            if (cancelled) return;
            if (!tryPrompt()) {
              const interval = setInterval(() => {
                if (cancelled) { clearInterval(interval); return; }
                if (tryPrompt()) clearInterval(interval);
              }, 300);
              setTimeout(() => clearInterval(interval), 5000);
            }
          }, PROMPT_DELAY_MS);
        })
        .catch(() => {});
    };

    run();

    return () => { cancelled = true; };
  }, [isLoading, isAuthenticated, location, handleCredential]);

  if (!showNudge) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[999] max-w-[280px] bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-700/50 rounded-xl shadow-lg px-4 py-3 flex items-start gap-3 animate-in slide-in-from-top-2 duration-300"
      data-testid="onetap-nudge"
    >
      <div className="mt-0.5 shrink-0 p-1.5 rounded-full bg-amber-100 dark:bg-amber-900/40">
        <Gift className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground leading-snug">Member perks await</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
          Sign in to save your wishlist &amp; get early access to deals.
        </p>
      </div>
      <button
        onClick={() => {
          setShowNudge(false);
          sessionStorage.setItem(DISMISSED_KEY, "1");
        }}
        className="shrink-0 text-muted-foreground hover:text-foreground mt-0.5"
        aria-label="Dismiss"
        data-testid="btn-dismiss-onetap-nudge"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
