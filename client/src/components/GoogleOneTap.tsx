import { useEffect, useCallback, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { X, Gift } from "lucide-react";

const DISMISSED_KEY = "google_onetap_dismissed";
const VISITED_KEY = "tl_has_visited";

interface OneTapNudgeConfig {
  enabled: boolean;
  promptDelaySeconds: number;
  title: string;
  body: string;
  buttonText: string;
}

export default function GoogleOneTap() {
  const [location, navigate] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const initialized = useRef(false);
  const [showNudge, setShowNudge] = useState(false);

  const { data: nudgeConfigData } = useQuery<{ key: string; value: OneTapNudgeConfig }>({
    queryKey: ["/api/site-config", "onetap-nudge"],
    queryFn: async () => {
      const res = await fetch("/api/site-config/onetap-nudge");
      if (!res.ok) return null;
      return res.json();
    },
  });

  const config = nudgeConfigData?.value;

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
    if (!config || !config.enabled) return;

    const hasVisitedBefore = localStorage.getItem(VISITED_KEY);
    if (!hasVisitedBefore) {
      localStorage.setItem(VISITED_KEY, "1");
      return;
    }

    let cancelled = false;

    const promptDelayMs = config.promptDelaySeconds * 1000;

    const run = () => {
      fetch("/api/auth/google-client-id")
        .then(r => r.json())
        .then(d => {
          if (cancelled || !d.clientId) return;

          setTimeout(() => {
            if (!cancelled) setShowNudge(true);
          }, promptDelayMs);

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

          setTimeout(() => {
            if (cancelled) return;
            if (!tryPrompt()) {
              const interval = setInterval(() => {
                if (cancelled) { clearInterval(interval); return; }
                if (tryPrompt()) clearInterval(interval);
              }, 300);
              setTimeout(() => clearInterval(interval), 5000);
            }
          }, promptDelayMs);
        })
        .catch(() => {});
    };

    run();

    return () => { cancelled = true; };
  }, [isLoading, isAuthenticated, location, handleCredential, config]);

  if (!showNudge || !config) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[999] w-72 bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-700/50 rounded-xl shadow-lg p-4 animate-in slide-in-from-top-2 duration-300"
      data-testid="onetap-nudge"
    >
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 shrink-0 p-1.5 rounded-full bg-amber-100 dark:bg-amber-900/40">
          <Gift className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-snug">{config.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{config.body}</p>
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
      <button
        onClick={() => {
          setShowNudge(false);
          window.dispatchEvent(new CustomEvent("show:signin-modal"));
        }}
        className="mt-3 w-full flex items-center justify-center gap-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
        data-testid="btn-onetap-signin"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        {config.buttonText}
      </button>
    </div>
  );
}
