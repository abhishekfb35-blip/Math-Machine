import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Shield, Trash2, RefreshCw, CheckCircle2, AlertCircle, Loader2, Lock,
  Users, Activity, Bell, BarChart3,
} from "lucide-react";

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

interface AlertConfig {
  alertEmail: string;
  alertThreshold: number;
  alertCooldownMinutes: number;
}

interface SecurityConfig {
  rateLimitConfig: RateLimitConfig;
  guestCartCleanup: GuestCartCleanup;
  alertConfig: AlertConfig;
}

interface SecurityReport {
  liveSessions: { admin: number; customer: number };
  totalBlocks24h: number;
  totalBlocks7d: number;
  byTier24h: Record<string, number>;
  byCategory24h: Record<string, number>;
  hourlyBuckets: Array<{ hour: string; tier: string; category: string; count: number }>;
}

function minutesToMs(m: number) { return m * 60_000; }

function TierCard({
  label, description, tier, onChange, onSave, isSaving, saved, testId,
}: {
  label: string; description: string; tier: TierConfig;
  onChange: (t: TierConfig) => void; onSave: () => void;
  isSaving: boolean; saved: boolean; testId: string;
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
            type="number" min={1} value={tier.max}
            onChange={(e) => onChange({ ...tier, max: parseInt(e.target.value) || 1 })}
            className="h-8 text-sm" data-testid={`input-tier-${testId}-max`}
          />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Window (minutes)</Label>
          <Input
            type="number" min={1} value={windowMinutes}
            onChange={(e) => onChange({ ...tier, windowMs: minutesToMs(parseInt(e.target.value) || 1) })}
            className="h-8 text-sm" data-testid={`input-tier-${testId}-window`}
          />
        </div>
      </div>
      <Button size="sm" onClick={onSave} disabled={isSaving} data-testid={`button-save-tier-${testId}`}>
        {isSaving ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Saving…</>
          : saved ? <><CheckCircle2 className="w-4 h-4 mr-1 text-green-500" /> Saved</>
          : <><Shield className="w-4 h-4 mr-1" /> Save {label} Limit</>}
      </Button>
    </div>
  );
}

function StatBox({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="border rounded-lg p-3 text-center">
      <p className={`text-2xl font-bold ${color ?? ""}`}>{value}</p>
      <p className="text-xs font-medium mt-0.5">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default function AdminSecurity() {
  const [savedTier, setSavedTier] = useState<"global" | "moderate" | "strict" | null>(null);
  const [cleanupSaved, setCleanupSaved] = useState(false);
  const [alertSaved, setAlertSaved] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{ deleted: number } | null>(null);

  const { data, isLoading } = useQuery<SecurityConfig>({
    queryKey: ["/api/admin/security-config"],
    queryFn: async () => {
      const res = await fetch("/api/admin/security-config");
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const { data: report, isLoading: reportLoading, refetch: refetchReport } = useQuery<SecurityReport>({
    queryKey: ["/api/admin/security-report"],
    queryFn: async () => {
      const res = await fetch("/api/admin/security-report");
      if (!res.ok) throw new Error("Failed to load report");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const [rateLimitConfig, setRateLimitConfig] = useState<RateLimitConfig | null>(null);
  const [guestCartCleanup, setGuestCartCleanup] = useState<GuestCartCleanup | null>(null);
  const [alertConfig, setAlertConfig] = useState<AlertConfig | null>(null);

  useEffect(() => {
    if (data && !rateLimitConfig) {
      setRateLimitConfig(data.rateLimitConfig);
      setGuestCartCleanup(data.guestCartCleanup);
      setAlertConfig(data.alertConfig);
    }
  }, [data]);

  const saveRateLimitMutation = useMutation({
    mutationFn: async () => {
      if (!rateLimitConfig) return;
      await apiRequest("POST", "/api/admin/security-config", { rateLimitConfig });
    },
    onSuccess: (_, _vars, ctx) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/security-config"] });
    },
  });

  function saveTier(tier: "global" | "moderate" | "strict") {
    saveRateLimitMutation.mutate(undefined, {
      onSuccess: () => {
        setSavedTier(tier);
        setTimeout(() => setSavedTier(null), 3000);
      },
    });
  }

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

  const saveAlertMutation = useMutation({
    mutationFn: async () => {
      if (!alertConfig) return;
      await apiRequest("POST", "/api/admin/security-config", { alertConfig });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/security-config"] });
      setAlertSaved(true);
      setTimeout(() => setAlertSaved(false), 3000);
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

  if (isLoading || !rateLimitConfig || !guestCartCleanup || !alertConfig) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 flex items-center justify-center min-h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const tierColors: Record<string, string> = {
    global: "text-blue-600",
    moderate: "text-amber-600",
    strict: "text-red-600",
  };

  const catLabels: Record<string, string> = {
    otp: "OTP / Auth",
    checkout: "Checkout / Payment",
    cart: "Cart",
    consent: "Consent / Discount",
    other: "Other",
  };

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
          <p className="text-sm text-muted-foreground">Configure API rate limits, alerts, and data cleanup</p>
        </div>
      </div>

      <div className="space-y-6">

        {/* Live Report */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" /> Security Report
                </CardTitle>
                <CardDescription className="text-xs">Live snapshot and 24-hour block history. Refreshes every 30 s.</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => refetchReport()} disabled={reportLoading} data-testid="button-refresh-report">
                <RefreshCw className={`w-4 h-4 ${reportLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {reportLoading && !report ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : report ? (
              <>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> Active Sessions
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <StatBox label="Admin sessions" value={report.liveSessions.admin} color="text-primary" />
                    <StatBox label="Customer sessions" value={report.liveSessions.customer} color="text-primary" />
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5" /> Rate-Limit Blocks
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <StatBox
                      label="Blocks last 24 h"
                      value={report.totalBlocks24h}
                      color={report.totalBlocks24h > 100 ? "text-red-600" : report.totalBlocks24h > 20 ? "text-amber-600" : ""}
                    />
                    <StatBox label="Blocks last 7 days" value={report.totalBlocks7d} />
                  </div>
                </div>

                {Object.keys(report.byTier24h).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">By Tier (24 h)</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(report.byTier24h).map(([tier, cnt]) => (
                        <Badge key={tier} variant="outline" className={`text-xs ${tierColors[tier] ?? ""}`}>
                          {tier}: {cnt}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {Object.keys(report.byCategory24h).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">By Endpoint (24 h)</p>
                    <div className="space-y-1.5">
                      {Object.entries(report.byCategory24h)
                        .sort((a, b) => b[1] - a[1])
                        .map(([cat, cnt]) => (
                          <div key={cat} className="flex items-center gap-2 text-sm">
                            <span className="w-32 text-xs text-muted-foreground flex-shrink-0">{catLabels[cat] ?? cat}</span>
                            <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-primary h-full rounded-full"
                                style={{ width: `${Math.min(100, (cnt / (report.totalBlocks24h || 1)) * 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium w-8 text-right">{cnt}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {report.totalBlocks24h === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">No blocks recorded in the last 24 hours.</p>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-2">Report not available</p>
            )}
          </CardContent>
        </Card>

        {/* Attack Alert Config */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="w-4 h-4" /> Attack Alert Email
            </CardTitle>
            <CardDescription className="text-xs">
              Get an email when the number of rate-limit blocks in a 5-minute window exceeds your threshold.
              Leave email blank to disable alerts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs mb-1 block">Alert email address</Label>
              <Input
                type="email"
                placeholder="admin@example.com"
                value={alertConfig.alertEmail}
                onChange={(e) => setAlertConfig((c) => c ? { ...c, alertEmail: e.target.value } : c)}
                className="h-8 text-sm"
                data-testid="input-alert-email"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">Block threshold (per 5 min)</Label>
                <Input
                  type="number" min={1} max={10000}
                  value={alertConfig.alertThreshold}
                  onChange={(e) => setAlertConfig((c) => c ? { ...c, alertThreshold: parseInt(e.target.value) || 50 } : c)}
                  className="h-8 text-sm"
                  data-testid="input-alert-threshold"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Cooldown (minutes)</Label>
                <Input
                  type="number" min={1} max={1440}
                  value={alertConfig.alertCooldownMinutes}
                  onChange={(e) => setAlertConfig((c) => c ? { ...c, alertCooldownMinutes: parseInt(e.target.value) || 60 } : c)}
                  className="h-8 text-sm"
                  data-testid="input-alert-cooldown"
                />
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => saveAlertMutation.mutate()}
              disabled={saveAlertMutation.isPending}
              data-testid="button-save-alert-config"
            >
              {saveAlertMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Saving…</>
              ) : alertSaved ? (
                <><CheckCircle2 className="w-4 h-4 mr-1 text-green-500" /> Saved</>
              ) : (
                <><Bell className="w-4 h-4 mr-1" /> Save Alert Settings</>
              )}
            </Button>
            {saveAlertMutation.isError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Failed to save alert settings
              </p>
            )}
          </CardContent>
        </Card>

        {/* Rate Limits */}
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
              label="Global" description="All /api/* endpoints — broad protection"
              testId="global" tier={rateLimitConfig.global}
              onChange={(t) => setRateLimitConfig((c) => c ? { ...c, global: t } : c)}
              onSave={() => saveTier("global")}
              isSaving={saveRateLimitMutation.isPending && savedTier === null}
              saved={savedTier === "global"}
            />
            <TierCard
              label="Moderate" description="Cart mutations, wishlist writes, and review submissions"
              testId="moderate" tier={rateLimitConfig.moderate}
              onChange={(t) => setRateLimitConfig((c) => c ? { ...c, moderate: t } : c)}
              onSave={() => saveTier("moderate")}
              isSaving={saveRateLimitMutation.isPending && savedTier === null}
              saved={savedTier === "moderate"}
            />
            <TierCard
              label="Strict" description="OTP, checkout, payment, consent, discount — sensitive actions"
              testId="strict" tier={rateLimitConfig.strict}
              onChange={(t) => setRateLimitConfig((c) => c ? { ...c, strict: t } : c)}
              onSave={() => saveTier("strict")}
              isSaving={saveRateLimitMutation.isPending && savedTier === null}
              saved={savedTier === "strict"}
            />
          </CardContent>
        </Card>

        {/* Guest Cart Cleanup */}
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
                onCheckedChange={(v) => setGuestCartCleanup((c) => c ? { ...c, enabled: v } : c)}
                data-testid="switch-guest-cart-cleanup-enabled"
              />
            </div>
            <div className="max-w-[160px]">
              <Label className="text-xs mb-1 block">Retention period (days)</Label>
              <Input
                type="number" min={1} max={365}
                value={guestCartCleanup.retentionDays}
                onChange={(e) => setGuestCartCleanup((c) => c ? { ...c, retentionDays: parseInt(e.target.value) || 30 } : c)}
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
                variant="outline" size="sm"
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
