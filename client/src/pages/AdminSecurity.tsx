import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Shield, Trash2, RefreshCw, CheckCircle2, AlertCircle, Loader2, Lock } from "lucide-react";

interface TierConfig {
  enabled: boolean;
  windowMs: number;
  max: number;
}

interface RateLimitConfig {
  global: TierConfig;
  moderate: TierConfig;
  strict: TierConfig;
}

interface GuestCartCleanup {
  enabled: boolean;
  retentionDays: number;
}

interface SecurityConfig {
  rateLimitConfig: RateLimitConfig;
  guestCartCleanup: GuestCartCleanup;
}

function minutesToMs(m: number) {
  return m * 60_000;
}

function TierCard({
  label,
  description,
  tier,
  onChange,
  onSave,
  isSaving,
  saved,
  testId,
}: {
  label: string;
  description: string;
  tier: TierConfig;
  onChange: (t: TierConfig) => void;
  onSave: () => void;
  isSaving: boolean;
  saved: boolean;
  testId: string;
}) {
  const windowMinutes = Math.round(tier.windowMs / 60_000);

  return (
    <div className="border rounded-lg p-4 space-y-3" data-testid={`section-tier-${testId}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-sm">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Switch
          checked={tier.enabled}
          onCheckedChange={(v) => onChange({ ...tier, enabled: v })}
          data-testid={`switch-tier-${testId}-enabled`}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs mb-1 block">Max requests</Label>
          <Input
            type="number"
            min={1}
            value={tier.max}
            onChange={(e) => onChange({ ...tier, max: parseInt(e.target.value) || 1 })}
            className="h-8 text-sm"
            data-testid={`input-tier-${testId}-max`}
          />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Window (minutes)</Label>
          <Input
            type="number"
            min={1}
            value={windowMinutes}
            onChange={(e) => onChange({ ...tier, windowMs: minutesToMs(parseInt(e.target.value) || 1) })}
            className="h-8 text-sm"
            data-testid={`input-tier-${testId}-window`}
          />
        </div>
      </div>
      <Button
        size="sm"
        onClick={onSave}
        disabled={isSaving}
        data-testid={`button-save-tier-${testId}`}
      >
        {isSaving ? (
          <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Saving…</>
        ) : saved ? (
          <><CheckCircle2 className="w-4 h-4 mr-1 text-green-500" /> Saved</>
        ) : (
          <><Shield className="w-4 h-4 mr-1" /> Save {label} Limit</>
        )}
      </Button>
    </div>
  );
}

export default function AdminSecurity() {
  const [savedTier, setSavedTier] = useState<"global" | "moderate" | "strict" | null>(null);
  const [cleanupSaved, setCleanupSaved] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{ deleted: number } | null>(null);

  const { data, isLoading } = useQuery<SecurityConfig>({
    queryKey: ["/api/admin/security-config"],
    queryFn: async () => {
      const res = await fetch("/api/admin/security-config");
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const [rateLimitConfig, setRateLimitConfig] = useState<RateLimitConfig | null>(null);
  const [guestCartCleanup, setGuestCartCleanup] = useState<GuestCartCleanup | null>(null);

  useEffect(() => {
    if (data && !rateLimitConfig) {
      setRateLimitConfig(data.rateLimitConfig);
      setGuestCartCleanup(data.guestCartCleanup);
    }
  }, [data]);

  const saveGlobalMutation = useMutation({
    mutationFn: async () => {
      if (!rateLimitConfig) return;
      await apiRequest("POST", "/api/admin/security-config", { rateLimitConfig });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/security-config"] });
      setSavedTier("global");
      setTimeout(() => setSavedTier(null), 3000);
    },
  });

  const saveModerateMutation = useMutation({
    mutationFn: async () => {
      if (!rateLimitConfig) return;
      await apiRequest("POST", "/api/admin/security-config", { rateLimitConfig });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/security-config"] });
      setSavedTier("moderate");
      setTimeout(() => setSavedTier(null), 3000);
    },
  });

  const saveStrictMutation = useMutation({
    mutationFn: async () => {
      if (!rateLimitConfig) return;
      await apiRequest("POST", "/api/admin/security-config", { rateLimitConfig });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/security-config"] });
      setSavedTier("strict");
      setTimeout(() => setSavedTier(null), 3000);
    },
  });

  const saveCleanupMutation = useMutation({
    mutationFn: async () => {
      if (!guestCartCleanup) return;
      await apiRequest("POST", "/api/admin/security-config", { guestCartCleanup });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/security-config"] });
      setCleanupSaved(true);
      setTimeout(() => setCleanupSaved(false), 3000);
    },
  });

  const cleanupMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/security/run-cart-cleanup", {});
      return res.json() as Promise<{ deleted: number }>;
    },
    onSuccess: (result) => {
      setCleanupResult(result);
      setTimeout(() => setCleanupResult(null), 5000);
    },
  });

  if (isLoading || !rateLimitConfig || !guestCartCleanup) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 flex items-center justify-center min-h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-24" data-testid="page-admin-security">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin">
          <Button variant="ghost" size="sm" data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-1" /> Dashboard
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Lock className="w-5 h-5" /> Security & Rate Limiting
          </h1>
          <p className="text-sm text-muted-foreground">Configure API rate limits and data cleanup</p>
        </div>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">API Rate Limits</CardTitle>
            <CardDescription className="text-xs">
              Control how many requests each IP address can make within a time window.
              All changes take effect immediately after saving. Each tier can be saved independently.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <TierCard
              label="Global"
              description="All /api/* endpoints — broad protection"
              testId="global"
              tier={rateLimitConfig.global}
              onChange={(t) => setRateLimitConfig((c) => c ? { ...c, global: t } : c)}
              onSave={() => saveGlobalMutation.mutate()}
              isSaving={saveGlobalMutation.isPending}
              saved={savedTier === "global"}
            />
            <TierCard
              label="Moderate"
              description="Cart mutations, wishlist writes, and review submissions"
              testId="moderate"
              tier={rateLimitConfig.moderate}
              onChange={(t) => setRateLimitConfig((c) => c ? { ...c, moderate: t } : c)}
              onSave={() => saveModerateMutation.mutate()}
              isSaving={saveModerateMutation.isPending}
              saved={savedTier === "moderate"}
            />
            <TierCard
              label="Strict"
              description="OTP, checkout, payment, consent, discount — sensitive actions"
              testId="strict"
              tier={rateLimitConfig.strict}
              onChange={(t) => setRateLimitConfig((c) => c ? { ...c, strict: t } : c)}
              onSave={() => saveStrictMutation.mutate()}
              isSaving={saveStrictMutation.isPending}
              saved={savedTier === "strict"}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Guest Cart Cleanup</CardTitle>
            <CardDescription className="text-xs">
              Automatically remove abandoned guest carts (no customer linked) older than the specified number of days.
              Runs once per day. You can also trigger it manually below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Enable automatic cleanup</p>
                <p className="text-xs text-muted-foreground">Runs daily in the background</p>
              </div>
              <Switch
                checked={guestCartCleanup.enabled}
                onCheckedChange={(v) =>
                  setGuestCartCleanup((c) => c ? { ...c, enabled: v } : c)
                }
                data-testid="switch-guest-cart-cleanup-enabled"
              />
            </div>
            <div className="max-w-[160px]">
              <Label className="text-xs mb-1 block">Retention period (days)</Label>
              <Input
                type="number"
                min={1}
                max={365}
                value={guestCartCleanup.retentionDays}
                onChange={(e) =>
                  setGuestCartCleanup((c) => c ? { ...c, retentionDays: parseInt(e.target.value) || 30 } : c)
                }
                className="h-8 text-sm"
                data-testid="input-guest-cart-retention-days"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="sm"
                onClick={() => saveCleanupMutation.mutate()}
                disabled={saveCleanupMutation.isPending}
                data-testid="button-save-cleanup-config"
              >
                {saveCleanupMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Saving…</>
                ) : cleanupSaved ? (
                  <><CheckCircle2 className="w-4 h-4 mr-1 text-green-500" /> Saved</>
                ) : (
                  <><RefreshCw className="w-4 h-4 mr-1" /> Save Cleanup Config</>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => cleanupMutation.mutate()}
                disabled={cleanupMutation.isPending}
                data-testid="button-run-cart-cleanup"
              >
                {cleanupMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Running…</>
                ) : (
                  <><Trash2 className="w-4 h-4 mr-1" /> Run Cleanup Now</>
                )}
              </Button>
            </div>

            {cleanupResult !== null && (
              <p className="text-xs text-muted-foreground" data-testid="text-cleanup-result">
                {cleanupResult.deleted === 0
                  ? "No guest carts to clean up."
                  : `Removed ${cleanupResult.deleted} guest cart${cleanupResult.deleted === 1 ? "" : "s"}.`}
              </p>
            )}
            {cleanupMutation.isError && (
              <p className="text-xs text-destructive flex items-center gap-1" data-testid="text-cleanup-error">
                <AlertCircle className="w-3 h-3" /> Cleanup failed
              </p>
            )}
            {saveCleanupMutation.isError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Failed to save cleanup config
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
