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
  Users, Activity, Bell, BarChart3, UserPlus, AlertTriangle, Clock,
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

interface CleanupEntry {
  timestamp: string;
  deleted: number;
}

interface SecurityReport {
  liveSessions: { admin: number; customer: number };
  newSignups7d: number;
  failedLogins: { lastHour: number; last24h: number };
  lastCleanup: CleanupEntry | null;
  cleanupHistory: CleanupEntry[];
  totalBlocks24h: number;
  totalBlocksWindow: number;
  byTier24h: Record<string, number>;
  byCategory24h: Record<string, number>;
  byTierWindow: Record<string, number>;
  dailyBreakdown: Array<{ date: string; global?: number; moderate?: number; strict?: number }>;
  days: number;
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

function StatBox({ label, value, sub, color, icon }: {
  label: string; value: string | number; sub?: string; color?: string; icon?: React.ReactNode;
}) {
  return (
    <div className="border rounded-lg p-3 text-center">
      {icon && <div className="flex justify-center mb-1 text-muted-foreground">{icon}</div>}
      <p className={`text-2xl font-bold ${color ?? ""}`}>{value}</p>
      <p className="text-xs font-medium mt-0.5">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const catLabels: Record<string, string> = {
  otp: "OTP / Auth",
  checkout: "Checkout / Payment",
  cart: "Cart",
  consent: "Consent / Discount",
  other: "Other",
};

const tierColors: Record<string, string> = {
  global: "text-blue-600",
  moderate: "text-amber-600",
  strict: "text-red-600",
};

export default function AdminSecurity() {
  const [savedTier, setSavedTier] = useState<"global" | "moderate" | "strict" | null>(null);
  const [cleanupSaved, setCleanupSaved] = useState(false);
  const [alertSaved, setAlertSaved] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{ deleted: number } | null>(null);
  const [historyDays, setHistoryDays] = useState<7 | 30>(7);

  const { data, isLoading } = useQuery<SecurityConfig>({
    queryKey: ["/api/admin/security-config"],
    queryFn: async () => {
      const res = await fetch("/api/admin/security-config");
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const { data: report, isLoading: reportLoading, refetch: refetchReport } = useQuery<SecurityReport>({
    queryKey: ["/api/admin/security-report", historyDays],
    queryFn: async () => {
      const res = await fetch(`/api/admin/security-report?days=${historyDays}`);
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
  });

  function saveTier(tier: "global" | "moderate" | "strict") {
    saveRateLimitMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/security-config"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/security-report", historyDays] });
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

  const allTiers = ["global", "moderate", "strict"];

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

        {/* Security Report */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" /> Security Report
                </CardTitle>
                <CardDescription className="text-xs">Live snapshot + block history. Refreshes every 30 s.</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => refetchReport()} disabled={reportLoading} data-testid="button-refresh-report">
                <RefreshCw className={`w-4 h-4 ${reportLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {reportLoading && !report ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : report ? (
              <>
                {/* Live Snapshot */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> Live Snapshot
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <StatBox
                      label="Admin sessions"
                      value={report.liveSessions.admin}
                      icon={<Shield className="w-3.5 h-3.5" />}
                      color="text-primary"
                    />
                    <StatBox
                      label="Customer sessions"
                      value={report.liveSessions.customer}
                      icon={<Users className="w-3.5 h-3.5" />}
                      color="text-primary"
                    />
                    <StatBox
                      label="New signups (7d)"
                      value={report.newSignups7d}
                      icon={<UserPlus className="w-3.5 h-3.5" />}
                    />
                    <StatBox
                      label="Failed logins (1h)"
                      value={report.failedLogins.lastHour}
                      icon={<AlertTriangle className="w-3.5 h-3.5" />}
                      color={report.failedLogins.lastHour > 5 ? "text-red-600" : report.failedLogins.lastHour > 0 ? "text-amber-600" : ""}
                    />
                    <StatBox
                      label="Failed logins (24h)"
                      value={report.failedLogins.last24h}
                      icon={<AlertTriangle className="w-3.5 h-3.5" />}
                      color={report.failedLogins.last24h > 20 ? "text-red-600" : ""}
                    />
                    <StatBox
                      label="Last cleanup"
                      value={report.lastCleanup ? `${report.lastCleanup.deleted} carts` : "Never"}
                      sub={report.lastCleanup ? formatRelativeTime(report.lastCleanup.timestamp) : undefined}
                      icon={<Clock className="w-3.5 h-3.5" />}
                    />
                  </div>
                </div>

                {/* Blocks 24h summary */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5" /> Rate-Limit Blocks (24 h)
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <StatBox
                      label="Total blocks (24 h)"
                      value={report.totalBlocks24h}
                      color={report.totalBlocks24h > 100 ? "text-red-600" : report.totalBlocks24h > 20 ? "text-amber-600" : ""}
                    />
                    <StatBox label={`Total blocks (${report.days}d)`} value={report.totalBlocksWindow} />
                  </div>

                  {Object.keys(report.byTier24h).length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {Object.entries(report.byTier24h).map(([tier, cnt]) => (
                        <Badge key={tier} variant="outline" className={`text-xs ${tierColors[tier] ?? ""}`}>
                          {tier}: {cnt}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {Object.keys(report.byCategory24h).length > 0 && (
                    <div className="space-y-1.5 mt-3">
                      {Object.entries(report.byCategory24h)
                        .sort((a, b) => b[1] - a[1])
                        .map(([cat, cnt]) => (
                          <div key={cat} className="flex items-center gap-2 text-sm">
                            <span className="w-36 text-xs text-muted-foreground flex-shrink-0">{catLabels[cat] ?? cat}</span>
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
                  )}

                  {report.totalBlocks24h === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">No blocks in the last 24 hours.</p>
                  )}
                </div>

                {/* Block History Table */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                      <BarChart3 className="w-3.5 h-3.5" /> Block History
                    </p>
                    <div className="flex gap-1">
                      <Button
                        variant={historyDays === 7 ? "default" : "outline"}
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={() => setHistoryDays(7)}
                        data-testid="button-history-7d"
                      >
                        7d
                      </Button>
                      <Button
                        variant={historyDays === 30 ? "default" : "outline"}
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={() => setHistoryDays(30)}
                        data-testid="button-history-30d"
                      >
                        30d
                      </Button>
                    </div>
                  </div>

                  {report.dailyBreakdown.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-1.5 pr-3 font-semibold text-muted-foreground">Date</th>
                            {allTiers.map(t => (
                              <th key={t} className={`text-right py-1.5 px-2 font-semibold ${tierColors[t] ?? ""}`}>
                                {t.charAt(0).toUpperCase() + t.slice(1)}
                              </th>
                            ))}
                            <th className="text-right py-1.5 pl-2 font-semibold text-muted-foreground">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.dailyBreakdown.slice().reverse().map(row => {
                            const rowTotal = allTiers.reduce((s, t) => s + (row[t as keyof typeof row] as number ?? 0), 0);
                            return (
                              <tr key={row.date} className="border-b border-border/50 hover:bg-muted/30">
                                <td className="py-1.5 pr-3 text-muted-foreground">{row.date}</td>
                                {allTiers.map(t => (
                                  <td key={t} className={`py-1.5 px-2 text-right ${(row[t as keyof typeof row] ?? 0) > 0 ? tierColors[t] ?? "" : "text-muted-foreground"}`}>
                                    {(row[t as keyof typeof row] as number ?? 0) || "—"}
                                  </td>
                                ))}
                                <td className="py-1.5 pl-2 text-right font-medium">{rowTotal || "—"}</td>
                              </tr>
                            );
                          })}
                          {/* Summary row */}
                          <tr className="bg-muted/40 font-semibold">
                            <td className="py-1.5 pr-3">Total</td>
                            {allTiers.map(t => (
                              <td key={t} className={`py-1.5 px-2 text-right ${tierColors[t] ?? ""}`}>
                                {report.byTierWindow[t] ?? "—"}
                              </td>
                            ))}
                            <td className="py-1.5 pl-2 text-right">{report.totalBlocksWindow || "—"}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-3">No block data for this period.</p>
                  )}
                </div>

                {/* Cleanup History */}
                {report.cleanupHistory.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                      <Trash2 className="w-3.5 h-3.5" /> Recent Cleanup Runs
                    </p>
                    <div className="space-y-1">
                      {report.cleanupHistory.slice().reverse().map((entry, i) => (
                        <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-0">
                          <span className="text-muted-foreground">{formatRelativeTime(entry.timestamp)}</span>
                          <span className={entry.deleted > 0 ? "text-amber-600 font-medium" : "text-muted-foreground"}>
                            {entry.deleted > 0 ? `${entry.deleted} cart${entry.deleted === 1 ? "" : "s"} removed` : "Nothing to remove"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
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
              Get an email when rate-limit blocks in a 5-minute window exceed your threshold.
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
            <Button size="sm" onClick={() => saveAlertMutation.mutate()} disabled={saveAlertMutation.isPending} data-testid="button-save-alert-config">
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
              Control how many requests each IP can make within a time window.
              Changes take effect immediately. Each tier can be saved independently.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <TierCard
              label="Global" description="All /api/* endpoints — broad protection"
              testId="global" tier={rateLimitConfig.global}
              onChange={(t) => setRateLimitConfig((c) => c ? { ...c, global: t } : c)}
              onSave={() => saveTier("global")}
              isSaving={saveRateLimitMutation.isPending}
              saved={savedTier === "global"}
            />
            <TierCard
              label="Moderate" description="Cart mutations, wishlist writes, and review submissions"
              testId="moderate" tier={rateLimitConfig.moderate}
              onChange={(t) => setRateLimitConfig((c) => c ? { ...c, moderate: t } : c)}
              onSave={() => saveTier("moderate")}
              isSaving={saveRateLimitMutation.isPending}
              saved={savedTier === "moderate"}
            />
            <TierCard
              label="Strict" description="OTP, checkout, payment, consent, discount — sensitive actions"
              testId="strict" tier={rateLimitConfig.strict}
              onChange={(t) => setRateLimitConfig((c) => c ? { ...c, strict: t } : c)}
              onSave={() => saveTier("strict")}
              isSaving={saveRateLimitMutation.isPending}
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
