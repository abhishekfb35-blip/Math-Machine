import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  showSignInModal,
  SIGNIN_MODAL_DISMISSED_EVENT,
} from "@/components/SignupPopup";

const SIGNIN_PAGE_REQUEST_ID = "signin-page";

function getSafeDestination(location: string) {
  const query = location.includes("?") ? location.slice(location.indexOf("?") + 1) : "";
  const next = new URLSearchParams(query).get("next");
  return next?.startsWith("/") && !next.startsWith("//") ? next : "/account";
}

export default function SignInPage() {
  const [location, navigate] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) {
      navigate(getSafeDestination(location), { replace: true });
      return;
    }
    const frame = requestAnimationFrame(() => {
      showSignInModal({ requestId: SIGNIN_PAGE_REQUEST_ID });
    });
    return () => cancelAnimationFrame(frame);
  }, [isAuthenticated, isLoading, location, navigate]);

  useEffect(() => {
    const handleSignInDismissed = (event: Event) => {
      const requestId = (
        event as CustomEvent<{ requestId?: string }>
      ).detail?.requestId;
      if (requestId === SIGNIN_PAGE_REQUEST_ID) {
        navigate("/", { replace: true });
      }
    };
    window.addEventListener(SIGNIN_MODAL_DISMISSED_EVENT, handleSignInDismissed);
    return () => {
      window.removeEventListener(SIGNIN_MODAL_DISMISSED_EVENT, handleSignInDismissed);
    };
  }, [navigate]);

  return (
    <div
      className="flex min-h-[40vh] items-center justify-center"
      aria-label="Opening sign in"
      data-testid="signin-launcher"
    >
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}