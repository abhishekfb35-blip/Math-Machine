import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Shield, Trash2, RefreshCw, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface TierConfig {
  enabled: boolean;
  windowMs: number;
  max: number;
}

interface SecurityConfig {
  rateLimitConfig: {
    global: TierConfig;
    moderate: TierConfig;
    strict: TierConfig;
  };
  guestCartCleanup: {
    enabled: boolean;
    retentionDays: number;
  };
}

function msToMinutes(ms: number) {
  return Math.round(ms / 60_000);
}

function minutesToMs(m: number) {
  return m * 60_000;
}

function TierRow({
  label,
  description,
  tier,
  onChange,
}: {
  label: string;
  description: string;
  tier: TierConfig;
  onChange: (t: TierConfig) => void;
}) {
  const windowMinutes = Math.round(tier.windowMs / 60_000);

  return (
    <div className="border rounded-lg p-4 space-y-3" data-testid={`section-tier-${label.toLowerCase()}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-sm">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Switch
          checked={tier.enabled}
          onCheckedChange={(v) => onChange({ ...tier, enabled: v })}
          data-testid={`switch-tier-${label.toLowerCase()}-enabled`}
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
            data-testid={`input-tier-${label.toLowerCase()}-max`}
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
            data-testid={`input-tier-${label.toLowerCase()}-window`}
          />
        </div>
      </div>
    </div>
  );
}

export default function AdminSecurity() {
  const [saved, setSaved] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{ deleted: number } | null>(null);

  const { data, isLoading } = useQuery<SecurityConfig>({
    queryKey: ["/api/admin/security-config"],
    queryFn: async () => {
      const res = await fetch("/api/admin/security-config");
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const [config, setConfig] = useState<SecurityConfig | null>(null);

  if (data && !config) {
    setConfig(data);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!config) return;
      await apiRequest("POST", "/api/admin/security-config", config);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/security-config"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const cleanupMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/security/run-cart-cleanup", {});
      return res as unknown as { deleted: number };
    },
    onSuccess: (result) => {
      setCleanupResult(result);
      setTimeout(() => setCleanupResult(null), 5000);
    },
  });

  const currentConfig = config ?? data;

  if (isLoading || !currentConfig) {
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
            <Shield className="w-5 h-5" /> Security & Rate Limiting
          </h1>
          <p className="text-sm text-muted-foreground">Configure API rate limits and data cleanup</p>
        </div>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">API Rate Limits</CardTitle>
            <CardDescription className="text-xs">
              Control how many requests each IP address can make within a time window. Changes take effect immediately.
              Window duration changes require a server restart.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <TierRow
              label="Global"
              description="All /api/* endpoints — broad protection"
              tier={currentConfig.rateLimitConfig.global}
              onChange={(t) =>
                setConfig((c) => c ? { ...c, rateLimitConfig: { ...c.rateLimitConfig, global: t } } : c)
              }
            />
            <TierRow
              label="Moderate"
              description="Cart and wishlist mutations"
              tier={currentConfig.rateLimitConfig.moderate}
              onChange={(t) =>
                setConfig((c) => c ? { ...c, rateLimitConfig: { ...c.rateLimitConfig, moderate: t } } : c)
              }
            />
            <TierRow
              label="Strict"
              description="OTP, checkout, payment, consent, discount — sensitive actions"
              tier={currentConfig.rateLimitConfig.strict}
              onChange={(t) =>
                setConfig((c) => c ? { ...c, rateLimitConfig: { ...c.rateLimitConfig, strict: t } } : c)
              }
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
                checked={currentConfig.guestCartCleanup.enabled}
                onCheckedChange={(v) =>
                  setConfig((c) => c ? { ...c, guestCartCleanup: { ...c.guestCartCleanup, enabled: v } } : c)
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
                value={currentConfig.guestCartCleanup.retentionDays}
                onChange={(e) =>
                  setConfig((c) =>
                    c
                      ? { ...c, guestCartCleanup: { ...c.guestCartCleanup, retentionDays: parseInt(e.target.value) || 30 } }
                      : c
                  )
                }
                className="h-8 text-sm"
                data-testid="input-guest-cart-retention-days"
              />
            </div>

            <div className="flex items-center gap-3 pt-1">
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
              {cleanupResult !== null && (
                <p className="text-xs text-muted-foreground" data-testid="text-cleanup-result">
                  {cleanupResult.deleted === 0
                    ? "No guest carts to clean up."
                    : `Removed ${cleanupResult.deleted} guest cart${cleanupResult.deleted === 1 ? "" : "s"}.`}
                </p>
              )}
              {cleanupMutation.isError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Cleanup failed
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            data-testid="button-save-security-config"
          >
            {saveMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Saving…</>
            ) : saved ? (
              <><CheckCircle2 className="w-4 h-4 mr-1 text-green-500" /> Saved</>
            ) : (
              <><RefreshCw className="w-4 h-4 mr-1" /> Save & Apply</>
            )}
          </Button>
          {saveMutation.isError && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Failed to save
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
