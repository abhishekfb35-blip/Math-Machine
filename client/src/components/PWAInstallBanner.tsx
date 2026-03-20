import { useState } from "react";
import { Download, X } from "lucide-react";
import { usePWAInstall } from "@/components/PWAInstallPrompt";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { defaultPwaInstall, type PwaInstallConfig } from "@/lib/siteConfigDefaults";

const DISMISSED_KEY = "pwa_banner_dismissed";

export default function PWAInstallBanner() {
  const { installable, promptInstall } = usePWAInstall();
  const config = useSiteConfig<PwaInstallConfig>("pwa-install-banner", defaultPwaInstall);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISSED_KEY) === "1"; } catch { return false; }
  });

  const handleDismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISSED_KEY, "1"); } catch {}
  };

  const hasCustomUrl = !!config.customUrl?.trim();
  const shouldShow = !dismissed && (installable || hasCustomUrl);

  if (!shouldShow) return null;

  const handleAction = () => {
    if (hasCustomUrl) {
      window.open(config.customUrl, "_blank", "noopener,noreferrer");
    } else {
      promptInstall();
    }
  };

  return (
    <div
      className="md:hidden flex items-center gap-3 px-4 py-2.5 bg-muted/70 border-b text-sm"
      data-testid="banner-pwa-install"
    >
      <Download className="w-4 h-4 shrink-0 text-muted-foreground" />
      <p className="flex-1 text-xs text-muted-foreground leading-snug">
        {config.text}
      </p>
      <button
        onClick={handleAction}
        className="shrink-0 text-xs font-semibold text-primary hover:underline"
        data-testid="button-banner-get-app"
      >
        {config.buttonText}
      </button>
      <button
        onClick={handleDismiss}
        className="shrink-0 p-0.5 rounded hover:bg-muted"
        aria-label="Dismiss"
        data-testid="button-banner-dismiss"
      >
        <X className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}
