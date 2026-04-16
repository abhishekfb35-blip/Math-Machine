import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw, CheckCircle, AlertCircle, Clock, ChevronDown, ChevronUp, X } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface PricingRuleRow {
  id: string;
  currency: string;
  symbol: string;
  displayName: string | null;
  markupPercent: number;
  roundingRule: string;
  enabled: boolean;
  rate: number | null;
  rateUpdatedAt: string | null;
}

interface RateStatus {
  fetchedToday: boolean;
  isFresh: boolean;
  lastFetchedAt: string | null;
  lastFetchDateStr: string | null;
  lastFetchError: string | null;
  nextRefreshAt: string | null;
  syncIntervalHours: number;
}

interface PricingData {
  rules: PricingRuleRow[];
  status: RateStatus;
}

function formatTs(ts: string | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function RuleRow({ rule, onSaved }: { rule: PricingRuleRow; onSaved: () => void }) {
  const { toast } = useToast();
  const [markup, setMarkup] = useState(String(rule.markupPercent ?? 0));
  const [rounding, setRounding] = useState(rule.roundingRule ?? "nearest");
  const [enabled, setEnabled] = useState(rule.enabled);
  const [dirty, setDirty] = useState(false);

  const mutation = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/admin/pricing-rules/${rule.currency}`, {
      markupPercent: parseFloat(markup) || 0,
      roundingRule: rounding,
      enabled,
    }),
    onSuccess: () => {
      toast({ title: "Saved", description: `${rule.currency} pricing rule updated.` });
      setDirty(false);
      onSaved();
    },
    onError: () => toast({ title: "Error", description: "Failed to save.", variant: "destructive" }),
  });

  const change = (fn: () => void) => { fn(); setDirty(true); };

  return (
    <tr className="border-b last:border-0">
      <td className="py-3 pr-4">
        <div className="font-semibold text-sm">{rule.currency}</div>
        <div className="text-xs text-muted-foreground">{rule.displayName}</div>
      </td>
      <td className="py-3 pr-4 text-sm">
        {rule.rate != null ? (
          <div>
            <div className="font-mono text-xs">{rule.rate.toFixed(6)}</div>
            <div className="text-xs text-muted-foreground">{formatTs(rule.rateUpdatedAt)}</div>
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">No rate</span>
        )}
      </td>
      <td className="py-3 pr-4">
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            min="0"
            max="99"
            step="0.01"
            value={markup}
            onChange={e => change(() => setMarkup(e.target.value))}
            className="w-20 h-8 text-sm"
            data-testid={`input-markup-${rule.currency}`}
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
      </td>
      <td className="py-3 pr-4">
        <Select value={rounding} onValueChange={v => change(() => setRounding(v))}>
          <SelectTrigger className="h-8 text-sm w-36" data-testid={`select-rounding-${rule.currency}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="nearest">Nearest (0.01)</SelectItem>
            <SelectItem value="up99">Charm (.99)</SelectItem>
            <SelectItem value="up">Ceiling</SelectItem>
          </SelectContent>
        </Select>
      </td>
      <td className="py-3 pr-4">
        <Switch
          checked={enabled}
          onCheckedChange={v => change(() => setEnabled(v))}
          data-testid={`switch-enabled-${rule.currency}`}
        />
      </td>
      <td className="py-3">
        <Button
          size="sm"
          disabled={!dirty || mutation.isPending}
          onClick={() => mutation.mutate()}
          data-testid={`button-save-${rule.currency}`}
        >
          {mutation.isPending ? "Saving..." : "Save"}
        </Button>
      </td>
    </tr>
  );
}

export default function AdminPricing() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showRates, setShowRates] = useState(false);
  const [errorDismissed, setErrorDismissed] = useState(false);

  const { data, isLoading, error } = useQuery<PricingData>({
    queryKey: ["/api/admin/pricing-rules"],
  });

  const refreshMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/pricing-rules/refresh-rates", {}),
    onSuccess: () => {
      toast({ title: "Rates refreshed", description: "Exchange rates updated from frankfurter.app." });
      qc.invalidateQueries({ queryKey: ["/api/admin/pricing-rules"] });
      setErrorDismissed(false);
    },
    onError: () => toast({ title: "Refresh failed", description: "Could not fetch latest rates.", variant: "destructive" }),
  });

  const status = data?.status;
  const showError = status?.lastFetchError && !errorDismissed;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-24" data-testid="page-admin-pricing">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin">
          <Button variant="ghost" size="sm" data-testid="button-back-admin">
            <ArrowLeft className="w-4 h-4 mr-1" /> Dashboard
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-pricing-title">International Pricing</h1>
          <p className="text-sm text-muted-foreground">Manage exchange rates and currency pricing rules</p>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Exchange Rate Status</CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
              data-testid="button-refresh-rates"
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
              {refreshMutation.isPending ? "Refreshing..." : "Refresh Now"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : error ? (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="w-4 h-4" /> Failed to load status
            </div>
          ) : (
            <div className="space-y-3">
              {showError && (
                <div className="flex items-start justify-between gap-2 p-2.5 rounded-md bg-destructive/10 text-destructive text-xs" data-testid="banner-rate-error">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>Last error: {status!.lastFetchError}</span>
                  </div>
                  <button
                    onClick={() => setErrorDismissed(true)}
                    className="shrink-0 opacity-70 hover:opacity-100"
                    data-testid="button-dismiss-error"
                    aria-label="Dismiss error"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Rates Freshness</div>
                  <div className="flex items-center gap-1.5">
                    {status?.lastFetchedAt == null ? (
                      <>
                        <AlertCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground">Never fetched</span>
                      </>
                    ) : (status?.isFresh ?? status?.fetchedToday) ? (
                      <>
                        <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        <span className="text-green-600 dark:text-green-400">Fresh</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="text-amber-600">Stale</span>
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Rate Date</div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="font-mono text-xs">{status?.lastFetchDateStr ?? "—"}</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Next Refresh</div>
                  <span className="text-xs">{formatTs(status?.nextRefreshAt ?? null)}</span>
                  {status?.syncIntervalHours != null && (
                    <div className="text-xs text-muted-foreground mt-0.5">every {status.syncIntervalHours}h</div>
                  )}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Currencies</div>
                  <div className="flex gap-2">
                    <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400">
                      {data?.rules?.filter(r => r.enabled).length ?? 0} on
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {data?.rules?.filter(r => !r.enabled).length ?? 0} off
                    </Badge>
                  </div>
                </div>
              </div>

              {data?.rules && data.rules.length > 0 && (
                <div>
                  <button
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
                    onClick={() => setShowRates(v => !v)}
                    data-testid="button-toggle-rates"
                  >
                    {showRates ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    {showRates ? "Hide rates" : "Show current rates"}
                  </button>
                  {showRates && (
                    <div className="mt-2 overflow-x-auto rounded-md border" data-testid="table-current-rates">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b bg-muted/40 text-muted-foreground">
                            <th className="py-2 px-3 text-left font-medium">Currency</th>
                            <th className="py-2 px-3 text-left font-medium">Name</th>
                            <th className="py-2 px-3 text-left font-medium">Rate from ₹1</th>
                            <th className="py-2 px-3 text-left font-medium">Status</th>
                            <th className="py-2 px-3 text-left font-medium">Updated</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.rules.map(r => (
                            <tr key={r.currency} className="border-b last:border-0">
                              <td className="py-2 px-3 font-mono font-semibold">{r.currency}</td>
                              <td className="py-2 px-3 text-muted-foreground">{r.displayName ?? r.currency}</td>
                              <td className="py-2 px-3 font-mono">
                                {r.rate != null ? r.rate.toFixed(6) : <span className="text-muted-foreground">—</span>}
                              </td>
                              <td className="py-2 px-3">
                                {r.enabled ? (
                                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400">Enabled</Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs">Disabled</Badge>
                                )}
                              </td>
                              <td className="py-2 px-3 text-muted-foreground">{formatTs(r.rateUpdatedAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Currency Pricing Rules</CardTitle>
          <p className="text-sm text-muted-foreground">
            Set per-currency markup % and rounding. Rates auto-refresh every {data?.status?.syncIntervalHours ?? 24}h from frankfurter.app (AED pegged to USD). Override with EXCHANGE_RATE_SYNC_INTERVAL_HOURS env var.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading rules...</div>
          ) : error ? (
            <div className="text-sm text-destructive">Failed to load rules.</div>
          ) : !data?.rules?.length ? (
            <div className="text-sm text-muted-foreground">No pricing rules found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-pricing-rules">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="pb-2 pr-4 text-left font-medium">Currency</th>
                    <th className="pb-2 pr-4 text-left font-medium">Rate from ₹1</th>
                    <th className="pb-2 pr-4 text-left font-medium">Markup</th>
                    <th className="pb-2 pr-4 text-left font-medium">Rounding</th>
                    <th className="pb-2 pr-4 text-left font-medium">Enabled</th>
                    <th className="pb-2 text-left font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.rules.map(rule => (
                    <RuleRow
                      key={rule.currency}
                      rule={rule}
                      onSaved={() => qc.invalidateQueries({ queryKey: ["/api/admin/pricing-rules"] })}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
