import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BarChart3, ShoppingCart, CreditCard, CheckCircle2, Mail, AlertCircle, ExternalLink, Users, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { FunnelReport } from "@shared/types";

const PER_PAGE_OPTIONS = [10, 20, 50, 100];

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatCurrency(amount: number | null) {
  if (amount == null) return "—";
  return `₹${amount.toLocaleString("en-IN")}`;
}

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function getDefaultDates() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: toInputDate(from), to: toInputDate(to) };
}

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  sub?: string;
}

function StatCard({ label, value, icon: Icon, color, sub }: StatCardProps) {
  return (
    <Card className="p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </Card>
  );
}

interface FunnelStepProps {
  label: string;
  count: number;
  max: number;
  dropOffPct?: number;
}

function FunnelStep({ label, count, max, dropOffPct }: FunnelStepProps) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {count.toLocaleString()}
          {dropOffPct !== undefined && dropOffPct > 0 && (
            <span className="ml-2 text-red-500 text-xs">−{dropOffPct}%</span>
          )}
        </span>
      </div>
      <div className="h-7 w-full bg-muted rounded overflow-hidden">
        <div
          className="h-full bg-primary rounded transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{pct}% of carts with items</p>
    </div>
  );
}

export default function AdminFunnelReport() {
  const defaults = getDefaultDates();
  const [fromDate, setFromDate] = useState(defaults.from);
  const [toDate, setToDate] = useState(defaults.to);
  const [appliedFrom, setAppliedFrom] = useState(defaults.from);
  const [appliedTo, setAppliedTo] = useState(defaults.to);
  const [abPage, setAbPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const { data, isLoading, isError, refetch } = useQuery<FunnelReport>({
    queryKey: ["/api/admin/reports/funnel", appliedFrom, appliedTo],
    queryFn: async () => {
      const res = await fetch(`/api/admin/reports/funnel?from=${appliedFrom}&to=${appliedTo}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch funnel report");
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  function applyDateRange() {
    setAppliedFrom(fromDate);
    setAppliedTo(toDate);
    setAbPage(1);
  }

  const totalAbandoned = data?.abandonedCarts.length ?? 0;
  const totalAbPages = Math.max(1, Math.ceil(totalAbandoned / perPage));
  const pagedCarts = data?.abandonedCarts.slice((abPage - 1) * perPage, abPage * perPage) ?? [];

  const checkoutDropOff = data && data.cartsWithItems > 0
    ? Math.round(((data.cartsWithItems - data.checkoutStarted) / data.cartsWithItems) * 100)
    : 0;
  const paymentDropOff = data && data.checkoutStarted > 0
    ? Math.round(((data.checkoutStarted - data.paymentAttempted) / data.cartsWithItems) * 100)
    : 0;
  const orderDropOff = data && data.paymentAttempted > 0
    ? Math.round(((data.paymentAttempted - data.ordersCompleted) / data.cartsWithItems) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Admin
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5" /> Funnel Report
          </h1>
          <p className="text-sm text-muted-foreground">Customer journey from cart to order</p>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">From</label>
            <input
              type="date"
              value={fromDate}
              max={toDate}
              onChange={e => setFromDate(e.target.value)}
              data-testid="input-date-from"
              className="border rounded px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">To</label>
            <input
              type="date"
              value={toDate}
              min={fromDate}
              onChange={e => setToDate(e.target.value)}
              data-testid="input-date-to"
              className="border rounded px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <Button onClick={applyDateRange} data-testid="button-apply-date-range">
            Apply
          </Button>
          <Button variant="outline" size="icon" onClick={() => refetch()} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <p className="text-xs text-muted-foreground ml-auto">
            Showing data from <strong>{appliedFrom}</strong> to <strong>{appliedTo}</strong>
          </p>
        </div>
      </Card>

      {isLoading && (
        <div className="text-center py-12 text-muted-foreground">Loading report…</div>
      )}
      {isError && (
        <div className="text-center py-12 text-red-500">Failed to load report. Try refreshing.</div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard
              label="Carts created"
              value={data.cartsCreated.toLocaleString()}
              icon={ShoppingCart}
              color="bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
            />
            <StatCard
              label="Carts with items"
              value={data.cartsWithItems.toLocaleString()}
              icon={ShoppingCart}
              color="bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400"
            />
            <StatCard
              label="Checkout started"
              value={data.checkoutStarted.toLocaleString()}
              icon={CreditCard}
              color="bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400"
            />
            <StatCard
              label="Payment attempted"
              value={data.paymentAttempted.toLocaleString()}
              icon={CreditCard}
              color="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
            />
            <StatCard
              label="Orders placed"
              value={data.ordersCompleted.toLocaleString()}
              icon={CheckCircle2}
              color="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
              sub={`${data.conversionRate}% conversion`}
            />
            <StatCard
              label="Recovery emails sent"
              value={data.recoveryEmailsSent.toLocaleString()}
              icon={Mail}
              color="bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
            />
          </div>

          <Card className="p-5 space-y-4">
            <h2 className="font-semibold text-base">Drop-off Waterfall</h2>
            <div className="space-y-5">
              <FunnelStep
                label="Carts with items"
                count={data.cartsWithItems}
                max={data.cartsWithItems}
              />
              <FunnelStep
                label="Checkout started"
                count={data.checkoutStarted}
                max={data.cartsWithItems}
                dropOffPct={checkoutDropOff}
              />
              <FunnelStep
                label="Payment attempted"
                count={data.paymentAttempted}
                max={data.cartsWithItems}
                dropOffPct={paymentDropOff}
              />
              <FunnelStep
                label="Order placed"
                count={data.ordersCompleted}
                max={data.cartsWithItems}
                dropOffPct={orderDropOff}
              />
            </div>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-5 space-y-3">
              <h2 className="font-semibold text-base flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" /> Payment Failures
              </h2>
              {data.paymentFailuresByReason.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payment failures in this period.</p>
              ) : (
                <div className="space-y-2">
                  {data.paymentFailuresByReason.map((f, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-sm">
                      <div className="min-w-0">
                        <span className="font-medium">{f.reason || "Unknown reason"}</span>
                        {f.code && <span className="text-muted-foreground ml-1">({f.code})</span>}
                      </div>
                      <Badge variant="secondary">{f.count}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5 space-y-3">
              <h2 className="font-semibold text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-500" /> Lead Capture
              </h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-2xl font-bold">{data.leadsTotal}</p>
                  <p className="text-muted-foreground">Consent signups</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{data.registeredCustomers}</p>
                  <p className="text-muted-foreground">Registered accounts</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{data.checkoutEmailsCaptured}</p>
                  <p className="text-muted-foreground">Checkout emails</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {data.discountCodesRedeemed}
                    <span className="text-base font-normal text-muted-foreground"> / {data.discountCodesIssued}</span>
                  </p>
                  <p className="text-muted-foreground">Codes redeemed</p>
                </div>
              </div>
            </Card>
          </div>

          {data.recentFailedAttempts.length > 0 && (
            <Card className="p-5 space-y-3">
              <h2 className="font-semibold text-base">Recent Failed Payment Attempts</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-failed-attempts">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs uppercase tracking-wide">
                      <th className="text-left py-2 pr-4 font-medium">Date</th>
                      <th className="text-left py-2 pr-4 font-medium">Cart</th>
                      <th className="text-left py-2 pr-4 font-medium">Reason</th>
                      <th className="text-left py-2 pr-4 font-medium">Code</th>
                      <th className="text-right py-2 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentFailedAttempts.map(a => (
                      <tr key={a.id} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground">
                          {formatDate(a.attemptAt)}
                        </td>
                        <td className="py-2 pr-4">
                          <code className="text-xs bg-muted px-1 py-0.5 rounded">{a.cartId.slice(0, 8)}…</code>
                        </td>
                        <td className="py-2 pr-4 max-w-[200px] truncate">
                          {a.failureReason || <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="py-2 pr-4">
                          {a.failureCode ? (
                            <Badge variant="outline" className="text-xs">{a.failureCode}</Badge>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="py-2 text-right font-medium">{formatCurrency(a.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {data.abandonedCarts.length > 0 && (
            <Card className="p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-base">Abandoned Carts</h2>
                  <p className="text-xs text-muted-foreground">Carts with items that went cold (&gt;1 hour) without placing an order.</p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground text-xs">Per page:</span>
                  {PER_PAGE_OPTIONS.map(n => (
                    <button
                      key={n}
                      onClick={() => { setPerPage(n); setAbPage(1); }}
                      className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${
                        perPage === n
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-foreground"
                      }`}
                      data-testid={`btn-perpage-${n}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-abandoned-carts">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs uppercase tracking-wide">
                      <th className="text-left py-2 pr-4 font-medium">Date</th>
                      <th className="text-left py-2 pr-4 font-medium">Email</th>
                      <th className="text-left py-2 pr-4 font-medium">Drop-off stage</th>
                      <th className="text-right py-2 pr-4 font-medium">Items</th>
                      <th className="text-right py-2 pr-4 font-medium">Value</th>
                      <th className="text-left py-2 font-medium">Recovery email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedCarts.map(c => (
                      <tr key={c.cartId} className="border-b last:border-0 hover:bg-muted/40 align-top">
                        <td className="py-2.5 pr-4 whitespace-nowrap text-muted-foreground">
                          {formatDate(c.createdAt)}
                        </td>
                        <td className="py-2.5 pr-4 max-w-[180px]">
                          {c.checkoutEmail
                            ? <span className="font-mono text-xs break-all">{c.checkoutEmail}</span>
                            : <span className="text-destructive text-xs font-medium">Not captured</span>
                          }
                        </td>
                        <td className="py-2.5 pr-4 whitespace-nowrap">
                          <Badge
                            variant="outline"
                            className={
                              c.abandonmentStage === "Entered email"
                                ? "text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400"
                                : c.abandonmentStage === "Started checkout"
                                  ? "text-orange-700 border-orange-300 bg-orange-50 dark:bg-orange-950/30 dark:text-orange-400"
                                  : "text-muted-foreground"
                            }
                            data-testid={`badge-stage-${c.cartId}`}
                          >
                            {c.abandonmentStage}
                          </Badge>
                        </td>
                        <td className="py-2.5 pr-4 text-right">{c.itemCount}</td>
                        <td className="py-2.5 pr-4 text-right font-medium">{formatCurrency(c.estimatedValue)}</td>
                        <td className="py-2.5">
                          {c.recoveryEmailSent ? (
                            <Badge variant="secondary" className="text-green-700 bg-green-100 dark:bg-green-950/40 dark:text-green-400">Sent</Badge>
                          ) : (
                            <div className="space-y-0.5">
                              <Badge variant="outline" className="text-muted-foreground">Not sent</Badge>
                              {c.emailNotSentReason && (
                                <p className="text-xs text-muted-foreground max-w-[220px] leading-tight" data-testid={`text-email-reason-${c.cartId}`}>
                                  {c.emailNotSentReason}
                                </p>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalAbPages > 1 && (
                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs text-muted-foreground">
                    Showing {(abPage - 1) * perPage + 1}–{Math.min(abPage * perPage, totalAbandoned)} of {totalAbandoned}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAbPage(p => Math.max(1, p - 1))}
                      disabled={abPage === 1}
                      data-testid="btn-ab-prev"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground px-1">
                      {abPage} / {totalAbPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAbPage(p => Math.min(totalAbPages, p + 1))}
                      disabled={abPage === totalAbPages}
                      data-testid="btn-ab-next"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {data.abandonedCarts.length === 0 && data.recentFailedAttempts.length === 0 && (
            <Card className="p-6 text-center">
              <p className="text-muted-foreground text-sm">No abandoned carts or payment failures in this period.</p>
            </Card>
          )}

          <Card className="p-5">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 rounded-lg shrink-0">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <h2 className="font-semibold text-base">GA4 Analytics</h2>
                <p className="text-sm text-muted-foreground">
                  This report covers database-tracked stages (cart → order). For top-of-funnel data — visitors, traffic sources, product views, and session behaviour — use Google Analytics 4.
                </p>
                <a
                  href="https://analytics.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="link-ga4"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mt-1"
                >
                  Open GA4 Dashboard <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
