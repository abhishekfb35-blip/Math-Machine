import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, CreditCard, Save, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface PaymentMethodsConfig {
  codEnabled: boolean;
}

function Toggle({
  value,
  onChange,
  testId,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        value ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"
      }`}
      data-testid={testId}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
          value ? "translate-x-[18px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}

export default function AdminPaymentMethods() {
  const { toast } = useToast();

  // null = not yet loaded from DB; undefined = DB has no record for this key
  const [config, setConfig] = useState<PaymentMethodsConfig | null>(null);
  const [everSaved, setEverSaved] = useState(false);

  const { data, isLoading } = useQuery<{ key: string; value: PaymentMethodsConfig } | null>({
    queryKey: ["/api/site-config", "payment-methods"],
    queryFn: async () => {
      const res = await fetch("/api/site-config/payment-methods");
      if (!res.ok) return null;
      return res.json();
    },
  });

  // Razorpay availability — read-only, determined by server env vars
  const { data: razorpayData } = useQuery<{ available: boolean; keyId?: string }>({
    queryKey: ["/api/razorpay/key"],
    queryFn: async () => {
      const res = await fetch("/api/razorpay/key");
      if (!res.ok) return { available: false };
      return res.json();
    },
  });

  useEffect(() => {
    if (data?.value != null) {
      setConfig(data.value);
      setEverSaved(true);
    } else if (data !== undefined) {
      // API responded but no record exists — stay null so we show "not configured" banner
      setConfig(null);
      setEverSaved(false);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (value: PaymentMethodsConfig) => {
      await apiRequest("POST", "/api/site-config/payment-methods", { value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/site-config", "payment-methods"] });
      setEverSaved(true);
      toast({ title: "Payment methods saved" });
    },
    onError: () => {
      toast({ title: "Failed to save", variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (config == null) return;
    saveMutation.mutate(config);
  };

  const initConfig = () => {
    setConfig({ codEnabled: false });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24" data-testid="page-admin-payment-methods">
      <Link href="/admin">
        <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back-dashboard">
          <ArrowLeft className="w-4 h-4 mr-2" /> Dashboard
        </Button>
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30">
          <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold" data-testid="text-payment-methods-title">
            Payment Methods
          </h1>
          <p className="text-sm text-muted-foreground">
            Control which payment options are available at checkout
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Not-yet-configured banner */}
          {!everSaved && config == null && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  Payment methods not yet configured
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  No configuration has been saved to the database. Configure and save below to take
                  effect.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 border-amber-300 dark:border-amber-700"
                  onClick={initConfig}
                  data-testid="button-init-config"
                >
                  Configure now
                </Button>
              </div>
            </div>
          )}

          {/* COD Card */}
          <Card className="p-5 space-y-4" data-testid="card-cod">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  Cash on Delivery (COD)
                  {config != null && (
                    <Badge
                      variant={config.codEnabled ? "default" : "secondary"}
                      className={
                        config.codEnabled
                          ? "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300 border-0"
                          : ""
                      }
                      data-testid="badge-cod-status"
                    >
                      {config.codEnabled ? "Enabled" : "Disabled"}
                    </Badge>
                  )}
                  {config == null && (
                    <Badge variant="outline" className="text-muted-foreground">
                      Not configured
                    </Badge>
                  )}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Allow customers to pay in cash when their order is delivered. When disabled,
                  customers must pay online at checkout.
                </p>
              </div>
              {config != null && (
                <Toggle
                  value={config.codEnabled}
                  onChange={(v) => setConfig((c) => (c ? { ...c, codEnabled: v } : c))}
                  testId="toggle-cod-enabled"
                />
              )}
            </div>
          </Card>

          <Separator />

          {/* Razorpay status — read-only, driven by server env vars */}
          <Card className="p-5 space-y-2" data-testid="card-razorpay">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  Online Payment (Razorpay)
                  <Badge
                    variant={razorpayData?.available ? "default" : "secondary"}
                    className={
                      razorpayData?.available
                        ? "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300 border-0"
                        : ""
                    }
                    data-testid="badge-razorpay-status"
                  >
                    {razorpayData?.available ? "Available" : "Not configured"}
                  </Badge>
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Razorpay availability is controlled by the{" "}
                  <code className="px-1 py-0.5 rounded bg-muted text-[11px]">RAZORPAY_KEY_ID</code>{" "}
                  and{" "}
                  <code className="px-1 py-0.5 rounded bg-muted text-[11px]">RAZORPAY_KEY_SECRET</code>{" "}
                  environment variables — not editable here.
                </p>
              </div>
            </div>
          </Card>

          {config != null && (
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              data-testid="button-save-payment-methods"
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Payment Methods
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
