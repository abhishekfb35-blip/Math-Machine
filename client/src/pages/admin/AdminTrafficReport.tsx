import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Activity, Globe, Users, ShoppingCart, AlertTriangle, RefreshCw, MonitorSmartphone, MapPin, Clock, TrendingUp, Download, Settings2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { TrafficReport, TrafficIpRow } from "@shared/types";

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function getDefaultDates(period: "daily" | "weekly") {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (period === "weekly" ? 7 : 1));
  return { from: toInputDate(from), to: toInputDate(to) };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function truncateUA(ua: string | null): string {
  if (!ua) return "—";
  if (ua.includes("Mozilla")) {
    const m = ua.match(/(Chrome|Firefox|Safari|Edge|OPR|Googlebot|python-requests|curl|Go-http)[\/ ]?([\d.]+)?/i);
    if (m) return m[1] + (m[2] ? ` ${m[2].split(".")[0]}` : "");
  }
  return ua.slice(0, 40);
}

function ActivityBadge({ level, isAnomaly }: { level: TrafficIpRow["activityLevel"]; isAnomaly: boolean }) {
  if (isAnomaly || level === "high") {
    return (
      <Badge variant="destructive" className="gap-1 text-xs" data-testid="badge-anomaly">
        <AlertTriangle className="h-3 w-3" /> High ping
      </Badge>
    );
  }
  if (level === "elevated") {
    return (
      <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 text-xs">
        Elevated
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground text-xs">Normal</Badge>
  );
}

interface SummaryCardProps {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  warn?: boolean;
}

function SummaryCard({ label, value, icon: Icon, color, warn }: SummaryCardProps) {
  return (
    <Card className={`p-4 flex items-start gap-3 ${warn ? "border-destructive/50 bg-destructive/5" : ""}`}>
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </Card>
  );
}

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadTrafficCsv(rows: TrafficIpRow[], from: string, to: string) {
  const headers = ["IP", "Country", "City", "Requests", "Activity Level", "Is Anomaly", "First Seen", "Last Seen", "Top Paths", "User Agent"];
  const lines = rows.map(row => [
    row.ip,
    row.country ?? "",
    row.city ?? "",
    String(row.requestCount),
    row.activityLevel,
    row.isAnomaly ? "Yes" : "No",
    row.firstSeen,
    row.lastSeen,
    row.topPaths.join(" | "),
    row.userAgentSummary ?? "",
  ].map(escapeCsvField).join(","));

  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `traffic-report-${from}-to-${to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminTrafficReport() {
  const { toast } = useToast();
  const [period, setPeriod] = useState<"daily" | "weekly" | "custom">("daily");
  const defaults = getDefaultDates("daily");
  const [fromDate, setFromDate] = useState(defaults.from);
  const [toDate, setToDate] = useState(defaults.to);
  const [appliedFrom, setAppliedFrom] = useState<string | null>(null);
  const [appliedTo, setAppliedTo] = useState<string | null>(null);
  const [appliedPeriod, setAppliedPeriod] = useState<"daily" | "weekly">("daily");
  const [sortBy, setSortBy] = useState<"count" | "lastSeen">("count");
  const [retentionInput, setRetentionInput] = useState<string>("10");

  const { data: secConfig } = useQuery<{ trafficLogRetentionDays: number }>({
    queryKey: ["/api/admin/security-config"],
    queryFn: async () => {
      const res = await fetch("/api/admin/security-config", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 60_000,
    select: (d) => {
      setRetentionInput(String(d.trafficLogRetentionDays ?? 10));
      return d;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (days: number) => {
      const res = await apiRequest("POST", "/api/admin/security-config", { trafficLogRetentionDays: days });
      if (!res.ok) throw new Error("Failed to save");
    },
    onSuccess: () => toast({ title: "Retention saved", description: `Traffic logs will be kept for ${retentionInput} days.` }),
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  const purgeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/security/run-traffic-cleanup", {});
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (d: { retentionDays: number }) =>
      toast({ title: "Purge complete", description: `Logs older than ${d.retentionDays} days removed.` }),
    onError: () => toast({ title: "Purge failed", variant: "destructive" }),
  });

  function buildUrl() {
    if (period === "custom" && appliedFrom && appliedTo) {
      return `/api/admin/reports/traffic?from=${appliedFrom}&to=${appliedTo}`;
    }
    return `/api/admin/reports/traffic?period=${period === "custom" ? appliedPeriod : period}`;
  }

  const { data, isLoading, isError, refetch } = useQuery<TrafficReport>({
    queryKey: ["/api/admin/reports/traffic", period, appliedFrom, appliedTo, appliedPeriod],
    queryFn: async () => {
      const res = await fetch(buildUrl(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch traffic report");
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  function applyPeriod(p: "daily" | "weekly") {
    setPeriod(p);
    setAppliedFrom(null);
    setAppliedTo(null);
    setAppliedPeriod(p);
  }

  function applyCustomRange() {
    setPeriod("custom");
    setAppliedFrom(fromDate);
    setAppliedTo(toDate);
  }

  const anomalyCount = data?.ipRows.filter(r => r.isAnomaly).length ?? 0;

  const sortedIpRows = data?.ipRows ? [...data.ipRows].sort((a, b) => {
    if (sortBy === "count") return b.requestCount - a.requestCount;
    return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
  }) : [];

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Admin
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Activity className="h-5 w-5" /> Traffic Security Report
          </h1>
          <p className="text-sm text-muted-foreground">IP activity, locations, anomaly detection</p>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex rounded-md border overflow-hidden">
            <button
              onClick={() => applyPeriod("daily")}
              data-testid="button-period-daily"
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${period === "daily" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              Daily
            </button>
            <button
              onClick={() => applyPeriod("weekly")}
              data-testid="button-period-weekly"
              className={`px-4 py-1.5 text-sm font-medium border-l transition-colors ${period === "weekly" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              Weekly
            </button>
          </div>

          <div className="flex items-end gap-2 border rounded-md px-3 py-1.5">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">From</p>
              <input
                type="date"
                value={fromDate}
                max={toDate}
                onChange={e => { setFromDate(e.target.value); setPeriod("custom"); }}
                data-testid="input-traffic-from"
                className="text-sm bg-transparent focus:outline-none"
              />
            </div>
            <span className="text-muted-foreground text-sm">—</span>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">To</p>
              <input
                type="date"
                value={toDate}
                min={fromDate}
                onChange={e => { setToDate(e.target.value); setPeriod("custom"); }}
                data-testid="input-traffic-to"
                className="text-sm bg-transparent focus:outline-none"
              />
            </div>
            <Button size="sm" variant="secondary" onClick={applyCustomRange} data-testid="button-apply-custom">
              Apply
            </Button>
          </div>

          <Button variant="outline" size="icon" onClick={() => refetch()} title="Refresh" data-testid="button-refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      {isLoading && <div className="text-center py-12 text-muted-foreground">Loading report…</div>}
      {isError && <div className="text-center py-12 text-red-500">Failed to load report. Try refreshing.</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard
              label="Total API Requests"
              value={data.totalRequests}
              icon={Activity}
              color="bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
            />
            <SummaryCard
              label="Unique IPs"
              value={data.uniqueIps}
              icon={Globe}
              color="bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400"
            />
            <SummaryCard
              label="Unique Sessions"
              value={data.uniqueSessions}
              icon={Users}
              color="bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400"
            />
            <SummaryCard
              label="Abandoned Carts"
              value={data.abandonedCartCount}
              icon={ShoppingCart}
              color="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
            />
          </div>

          {anomalyCount > 0 && (
            <Card className="p-4 border-destructive/50 bg-destructive/5 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <p className="text-sm font-medium text-destructive">
                {anomalyCount} IP{anomalyCount > 1 ? "s" : ""} flagged with unusually high request volume — scroll down for details.
              </p>
            </Card>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-5 space-y-3">
              <h2 className="font-semibold text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Top Endpoints
              </h2>
              {data.topPaths.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data in this period.</p>
              ) : (
                <div className="space-y-2">
                  {data.topPaths.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="text-xs text-muted-foreground tabular-nums w-4">{i + 1}.</span>
                      <code className="flex-1 text-xs bg-muted px-1.5 py-0.5 rounded truncate">{p.path}</code>
                      <Badge variant="secondary" className="text-xs tabular-nums">{p.count.toLocaleString()}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5 space-y-3">
              <h2 className="font-semibold text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" /> Period Summary
              </h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Period</dt>
                  <dd className="font-medium">{fmtDate(data.from)} → {fmtDate(data.to)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Avg requests / IP</dt>
                  <dd className="font-medium">
                    {data.uniqueIps > 0 ? Math.round(data.totalRequests / data.uniqueIps).toLocaleString() : "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Flagged IPs</dt>
                  <dd className={`font-medium ${anomalyCount > 0 ? "text-destructive" : ""}`}>
                    {anomalyCount}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Elevated IPs</dt>
                  <dd className="font-medium text-amber-600 dark:text-amber-400">
                    {data.ipRows.filter(r => r.activityLevel === "elevated").length}
                  </dd>
                </div>
              </dl>
            </Card>
          </div>

          {data.ipRows.length > 0 && (
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="font-semibold text-base flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" /> IP Activity Table
                  <Badge variant="secondary">{data.ipRows.length}</Badge>
                </h2>
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Sort:</span>
                    <button
                      onClick={() => setSortBy("count")}
                      className={`px-2 py-0.5 rounded text-xs font-medium ${sortBy === "count" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
                      data-testid="button-sort-count"
                    >
                      Requests
                    </button>
                    <button
                      onClick={() => setSortBy("lastSeen")}
                      className={`px-2 py-0.5 rounded text-xs font-medium ${sortBy === "lastSeen" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
                      data-testid="button-sort-lastseen"
                    >
                      Last Seen
                    </button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => downloadTrafficCsv(sortedIpRows, data.from.slice(0, 10), data.to.slice(0, 10))}
                    data-testid="button-download-csv"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download CSV
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-ip-activity">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs uppercase tracking-wide">
                      <th className="text-left py-2 pr-3 font-medium">IP Address</th>
                      <th className="text-left py-2 pr-3 font-medium">Location</th>
                      <th className="text-right py-2 pr-3 font-medium">Requests</th>
                      <th className="text-center py-2 pr-3 font-medium">Activity</th>
                      <th className="text-left py-2 pr-3 font-medium">Top Paths</th>
                      <th className="text-left py-2 pr-3 font-medium">Client</th>
                      <th className="text-left py-2 pr-3 font-medium">First Seen</th>
                      <th className="text-left py-2 font-medium">Last Seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedIpRows.map(row => (
                      <tr
                        key={row.ip}
                        className={`border-b last:border-0 hover:bg-muted/40 align-top ${row.isAnomaly ? "bg-destructive/5" : ""}`}
                        data-testid={`row-ip-${row.ip}`}
                      >
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-1.5">
                            {row.isAnomaly && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                            <code className="text-xs font-mono">{row.ip}</code>
                          </div>
                        </td>
                        <td className="py-2.5 pr-3">
                          {row.country ? (
                            <div className="flex items-center gap-1 text-xs">
                              <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span>{row.city ? `${row.city}, ` : ""}{row.country}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-3 text-right font-medium tabular-nums">
                          {row.requestCount.toLocaleString()}
                        </td>
                        <td className="py-2.5 pr-3 text-center">
                          <ActivityBadge level={row.activityLevel} isAnomaly={row.isAnomaly} />
                        </td>
                        <td className="py-2.5 pr-3 max-w-[200px]">
                          <div className="space-y-0.5">
                            {row.topPaths.length > 0 ? row.topPaths.map((p, i) => (
                              <code key={i} className="block text-xs text-muted-foreground truncate">{p}</code>
                            )) : <span className="text-muted-foreground text-xs">—</span>}
                          </div>
                        </td>
                        <td className="py-2.5 pr-3 max-w-[140px]">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MonitorSmartphone className="h-3 w-3 shrink-0" />
                            <span className="truncate">{truncateUA(row.userAgentSummary)}</span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-3 whitespace-nowrap">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3 shrink-0" />
                            {fmtDate(row.firstSeen)}
                          </div>
                        </td>
                        <td className="py-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3 shrink-0" />
                            {fmtDate(row.lastSeen)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {data.ipRows.length === 0 && (
            <Card className="p-8 text-center">
              <Activity className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium">No traffic data yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Requests are logged automatically — data will appear here after the first API calls in this period.
              </p>
            </Card>
          )}
        </>
      )}

      {/* ── Retention settings ─────────────────────────────────────────── */}
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-muted rounded-lg shrink-0">
            <Settings2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-base">Log Retention</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Traffic logs older than this are deleted automatically every night.
            </p>
            <div className="flex flex-wrap items-end gap-3 mt-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Keep logs for (days)</label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={retentionInput}
                  onChange={e => setRetentionInput(e.target.value)}
                  className="w-28"
                  data-testid="input-traffic-retention-days"
                />
              </div>
              <Button
                onClick={() => {
                  const days = parseInt(retentionInput, 10);
                  if (!days || days < 1 || days > 365) {
                    toast({ title: "Enter a value between 1 and 365", variant: "destructive" });
                    return;
                  }
                  saveMutation.mutate(days);
                }}
                disabled={saveMutation.isPending}
                data-testid="btn-save-traffic-retention"
              >
                {saveMutation.isPending ? "Saving…" : "Save"}
              </Button>
              <Button
                variant="outline"
                onClick={() => purgeMutation.mutate()}
                disabled={purgeMutation.isPending}
                data-testid="btn-purge-traffic-logs"
              >
                {purgeMutation.isPending ? "Purging…" : "Purge now"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Current setting: <strong>{secConfig?.trafficLogRetentionDays ?? 10} days</strong>.
              "Purge now" deletes all logs older than the saved value immediately.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
