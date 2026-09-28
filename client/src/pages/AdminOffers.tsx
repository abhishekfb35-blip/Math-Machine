import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Save, ArrowLeft, Tag, Truck, Info, Plus, Trash2, AlertCircle, Eye, Banknote, RotateCcw } from "lucide-react";
import { Link } from "wouter";
import type { DeliveryTier } from "@/lib/siteConfigDefaults";
import NudgeCard from "@/components/NudgeCard";
import {
  DEFAULT_NUDGE_CUE_COLORS,
  normalizeNudgeCueColors,
  type NudgeCueColors,
} from "@/lib/nudgeCueColors";

interface CartEngineConfig {
  wholesaleThreshold: number;
  retailFreeItemTrigger: number;
  retailBonusDiscountPct: number;
}

function useSaveConfig(key: string) {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (value: any) => {
      await apiRequest("POST", `/api/site-config/${key}`, { value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/site-config"] });
      queryClient.invalidateQueries({ queryKey: [`/api/site-config/${key}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/site-config", key] });
      toast({ title: "Saved", description: "Configuration updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save. Please try again.", variant: "destructive" });
    },
  });
}

function computeDeliveryFee(itemCount: number, tiers: DeliveryTier[]): number {
  for (const tier of tiers) {
    if (itemCount >= tier.minItems && itemCount <= tier.maxItems) return tier.fee;
  }
  return 0;
}

function pricingModeLabel(count: number, config: CartEngineConfig): string {
  if (count >= config.wholesaleThreshold) return "Wholesale mode";
  if (count === config.retailFreeItemTrigger + 1) return `Retail — cheapest free + ${config.retailBonusDiscountPct}% off next`;
  if (count === config.retailFreeItemTrigger) return "Retail — cheapest item free";
  return "Retail — no discount";
}

export default function AdminOffers() {
  const { data: allConfig, isLoading: configLoading } = useQuery<Record<string, any>>({
    queryKey: ["/api/site-config"],
  });

  const [engineConfig, setEngineConfig] = useState<CartEngineConfig | null>(null);
  const [engineDraft, setEngineDraft] = useState<CartEngineConfig>({
    wholesaleThreshold: 5,
    retailFreeItemTrigger: 3,
    retailBonusDiscountPct: 30,
  });
  const [deliveryTiers, setDeliveryTiers] = useState<DeliveryTier[]>([]);
  const [codEnabled, setCodEnabled] = useState(true);
  const [nudgeCueColors, setNudgeCueColors] = useState<NudgeCueColors>(DEFAULT_NUDGE_CUE_COLORS);
  const [savedNudgeCueColors, setSavedNudgeCueColors] = useState<NudgeCueColors>(DEFAULT_NUDGE_CUE_COLORS);
  const [configLoaded, setConfigLoaded] = useState(false);

  useEffect(() => {
    if (allConfig && !configLoaded) {
      const rawEngine = allConfig["cart-engine-config"];
      if (
        rawEngine &&
        typeof rawEngine.wholesaleThreshold === "number" &&
        typeof rawEngine.retailFreeItemTrigger === "number" &&
        typeof rawEngine.retailBonusDiscountPct === "number"
      ) {
        setEngineConfig(rawEngine);
        setEngineDraft(rawEngine);
      }
      const rawDelivery = allConfig["delivery-tiers"];
      if (Array.isArray(rawDelivery)) {
        setDeliveryTiers(rawDelivery);
      }
      const rawPayment = allConfig["payment-methods"];
      if (rawPayment && typeof rawPayment.codEnabled === "boolean") {
        setCodEnabled(rawPayment.codEnabled);
      }
      const rawNudgeCueColors = normalizeNudgeCueColors(allConfig["nudge-cue-colors"]);
      setNudgeCueColors(rawNudgeCueColors);
      setSavedNudgeCueColors(rawNudgeCueColors);
      setConfigLoaded(true);
    }
  }, [allConfig, configLoaded]);

  const saveEngine = useSaveConfig("cart-engine-config");
  const saveDelivery = useSaveConfig("delivery-tiers");
  const savePaymentMethods = useSaveConfig("payment-methods");
  const saveNudgeCueColors = useSaveConfig("nudge-cue-colors");

  const updateEngineDraft = (field: keyof CartEngineConfig, raw: string) => {
    const v = parseInt(raw, 10);
    if (isNaN(v)) return;
    setEngineDraft(prev => ({ ...prev, [field]: v }));
  };

  const updateDeliveryTier = (index: number, field: keyof DeliveryTier, value: number) => {
    const updated = [...deliveryTiers];
    updated[index] = { ...updated[index], [field]: value };
    setDeliveryTiers(updated);
  };

  const addDeliveryTier = () => {
    setDeliveryTiers([...deliveryTiers, { minItems: 1, maxItems: 5, fee: 0 }]);
  };

  const removeDeliveryTier = (index: number) => {
    setDeliveryTiers(deliveryTiers.filter((_, i) => i !== index));
  };

  const previewCounts = [1, 2, 3, 4, 5];

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/admin">
            <Button variant="ghost" size="icon" data-testid="button-back-to-admin">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-semibold">Offers & Delivery</h1>
            <p className="text-xs text-muted-foreground">Configure the cart pricing engine, banners, and delivery fees</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">

        <Card className="p-6 space-y-6">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold">Cart Engine Config</h2>
          </div>

          {!engineConfig && !configLoading && (
            <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>No cart engine config saved yet. No discounts or banners will apply until you save this section.</p>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            Controls how discounts are applied. Until saved, no discounts or banners run at all.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <Label>Wholesale Threshold (items)</Label>
              <Input
                type="number"
                min={2}
                value={engineDraft.wholesaleThreshold}
                onChange={(e) => updateEngineDraft("wholesaleThreshold", e.target.value)}
                data-testid="input-wholesale-threshold"
              />
              <p className="text-xs text-muted-foreground">
                Carts at or above this count switch to wholesale mode. Products charged at their wholesale price (set per-product in catalog).
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Retail Free-Item Trigger (items)</Label>
              <Input
                type="number"
                min={2}
                value={engineDraft.retailFreeItemTrigger}
                onChange={(e) => updateEngineDraft("retailFreeItemTrigger", e.target.value)}
                data-testid="input-retail-free-trigger"
              />
              <p className="text-xs text-muted-foreground">
                At exactly this count, the cheapest item becomes free.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Bonus Discount at Trigger+1 (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={engineDraft.retailBonusDiscountPct}
                onChange={(e) => updateEngineDraft("retailBonusDiscountPct", e.target.value)}
                data-testid="input-retail-bonus-pct"
              />
              <p className="text-xs text-muted-foreground">
                At trigger+1 items: cheapest is free AND next cheapest gets this % off.
              </p>
            </div>
          </div>

          <Button
            onClick={() => {
              saveEngine.mutate(engineDraft);
              setEngineConfig(engineDraft);
            }}
            disabled={saveEngine.isPending}
            data-testid="button-save-engine-config"
          >
            <Save className="w-4 h-4 mr-2" /> {saveEngine.isPending ? "Saving..." : "Save Cart Engine Config"}
          </Button>
        </Card>

        <Card className="p-6 space-y-6">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold">Domestic Delivery Fees</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Set delivery charges (in INR) by item count. Customers outside these ranges get free delivery.
            International orders are always free.
          </p>

          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-4 px-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Min Items</p>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Max Items</p>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fee (₹)</p>
            </div>
            {deliveryTiers.length === 0 && (
              <p className="text-sm text-muted-foreground italic px-1">No tiers configured — all domestic delivery is free.</p>
            )}
            {deliveryTiers.map((tier, i) => (
              <div key={i} className="grid grid-cols-3 gap-4 items-center" data-testid={`row-delivery-tier-${i}`}>
                <Input
                  type="number"
                  min={1}
                  value={tier.minItems}
                  onChange={(e) => updateDeliveryTier(i, "minItems", parseInt(e.target.value) || 1)}
                  data-testid={`input-delivery-min-${i}`}
                />
                <Input
                  type="number"
                  min={1}
                  value={tier.maxItems}
                  onChange={(e) => updateDeliveryTier(i, "maxItems", parseInt(e.target.value) || 1)}
                  data-testid={`input-delivery-max-${i}`}
                />
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    value={tier.fee}
                    onChange={(e) => updateDeliveryTier(i, "fee", parseInt(e.target.value) || 0)}
                    data-testid={`input-delivery-fee-${i}`}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeDeliveryTier(i)}
                    data-testid={`button-remove-delivery-tier-${i}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Button variant="outline" onClick={addDeliveryTier} data-testid="button-add-delivery-tier">
            <Plus className="w-4 h-4 mr-2" /> Add Delivery Tier
          </Button>

          <div>
            <Button
              onClick={() => {
                const sorted = [...deliveryTiers].sort((a, b) => a.minItems - b.minItems);
                setDeliveryTiers(sorted);
                saveDelivery.mutate(sorted);
              }}
              disabled={saveDelivery.isPending}
              data-testid="button-save-delivery-tiers"
            >
              <Save className="w-4 h-4 mr-2" /> {saveDelivery.isPending ? "Saving..." : "Save Delivery Fees"}
            </Button>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold">Payment Methods</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Control which payment options shoppers can use at checkout. Razorpay is always available when configured.
          </p>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Cash on Delivery</p>
              <p className="text-xs text-muted-foreground">
                {codEnabled ? "Enabled — shoppers can pay on delivery (INR only)" : "Disabled — COD is hidden from checkout"}
              </p>
            </div>
            <Switch
              checked={codEnabled}
              onCheckedChange={(checked) => {
                setCodEnabled(checked);
                savePaymentMethods.mutate({ codEnabled: checked });
              }}
              disabled={savePaymentMethods.isPending}
              data-testid="switch-cod-enabled"
            />
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold">Live Preview</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            How the current settings apply at each cart size. Based on the values above (save to confirm).
          </p>

          {!engineConfig ? (
            <p className="text-sm text-muted-foreground italic">Save engine config first to see a preview.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground uppercase tracking-wider border-b">
                    <th className="text-left py-2 pr-4">Items</th>
                    <th className="text-left py-2 pr-4">Pricing Mode</th>
                    <th className="text-left py-2">Delivery</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {previewCounts.map((count) => {
                    const mode = pricingModeLabel(count, engineDraft);
                    const delivery = computeDeliveryFee(count, deliveryTiers);
                    return (
                      <tr key={count} data-testid={`preview-row-${count}`}>
                        <td className="py-2 pr-4 font-medium">{count === 5 ? "5+" : count}</td>
                        <td className="py-2 pr-4 text-muted-foreground">{mode}</td>
                        <td className="py-2">{delivery === 0 ? <span className="text-primary">Free</span> : `₹${delivery}`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <NudgeCardPreview
          engineDraft={engineDraft}
          engineConfig={engineConfig}
          configLoading={configLoading}
          nudgeCueColors={nudgeCueColors}
          savedNudgeCueColors={savedNudgeCueColors}
          onNudgeCueColorsChange={setNudgeCueColors}
          onSaveNudgeCueColors={() =>
            saveNudgeCueColors.mutate(nudgeCueColors, {
              onSuccess: () => setSavedNudgeCueColors(nudgeCueColors),
            })
          }
          isSavingNudgeCueColors={saveNudgeCueColors.isPending}
        />
      </div>
    </div>
  );
}

interface NudgeCardPreviewProps {
  engineDraft: CartEngineConfig;
  engineConfig: CartEngineConfig | null;
  configLoading: boolean;
  nudgeCueColors: NudgeCueColors;
  savedNudgeCueColors: NudgeCueColors;
  onNudgeCueColorsChange: (colors: NudgeCueColors) => void;
  onSaveNudgeCueColors: () => void;
  isSavingNudgeCueColors: boolean;
}

function NudgeCueColorControl({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={label}
          className="h-10 w-14 cursor-pointer p-1"
          data-testid={id}
        />
        <Input
          type="text"
          value={value.toUpperCase()}
          onChange={(event) => {
            if (/^#[0-9a-f]{6}$/i.test(event.target.value)) onChange(event.target.value);
          }}
          aria-label={`${label} hex value`}
          pattern="#[0-9a-fA-F]{6}"
          maxLength={7}
          className="font-mono uppercase"
          data-testid={`${id}-hex`}
        />
      </div>
    </div>
  );
}

function NudgeCardPreview({
  engineDraft,
  engineConfig,
  configLoading,
  nudgeCueColors,
  savedNudgeCueColors,
  onNudgeCueColorsChange,
  onSaveNudgeCueColors,
  isSavingNudgeCueColors,
}: NudgeCardPreviewProps) {
  const [replayKey, setReplayKey] = useState(0);

  if (configLoading) {
    return (
      <Card className="p-6 space-y-4" data-testid="nudge-card-preview-section">
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-primary" />
          <h2 className="text-base font-semibold">NudgeCard State Preview</h2>
        </div>
        <p className="text-sm text-muted-foreground italic">Loading config…</p>
      </Card>
    );
  }

  const isUnsaved =
    !engineConfig ||
    engineDraft.wholesaleThreshold !== engineConfig.wholesaleThreshold ||
    engineDraft.retailFreeItemTrigger !== engineConfig.retailFreeItemTrigger ||
    engineDraft.retailBonusDiscountPct !== engineConfig.retailBonusDiscountPct ||
    JSON.stringify(nudgeCueColors) !== JSON.stringify(savedNudgeCueColors);

  const { retailFreeItemTrigger: trigger, wholesaleThreshold: wholesale, retailBonusDiscountPct: bonusPct } = engineDraft;

  const thresholds = {
    retailFreeItemTrigger: trigger,
    retailBonusDiscountPct: bonusPct,
    wholesaleThreshold: wholesale,
  };

  const preTriggerCount = Math.max(2, trigger - 1);

  const states: { label: string; sublabel: string; itemCount: number; testId: string }[] = [
    {
      label: "1 item added",
      sublabel: "First impression",
      itemCount: 1,
      testId: "nudge-preview-state1",
    },
    {
      label: "Pre-trigger",
      sublabel: `${preTriggerCount} item${preTriggerCount === 1 ? "" : "s"} in cart`,
      itemCount: preTriggerCount,
      testId: "nudge-preview-pre-trigger",
    },
    {
      label: "FREE earned",
      sublabel: `${trigger} items — cheapest item free`,
      itemCount: trigger,
      testId: "nudge-preview-free-earned",
    },
    {
      label: "FREE + Bonus",
      sublabel: `${trigger + 1} items — free + ${bonusPct}% off`,
      itemCount: trigger + 1,
      testId: "nudge-preview-free-bonus",
    },
    {
      label: "Wholesale",
      sublabel: `${wholesale}+ items — wholesale pricing`,
      itemCount: wholesale,
      testId: "nudge-preview-wholesale",
    },
  ];

  return (
    <Card className="p-6 space-y-6" data-testid="nudge-card-preview-section">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-primary" />
          <h2 className="text-base font-semibold">NudgeCard State Preview</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setReplayKey((key) => key + 1)}
            data-testid="button-replay-nudge-preview"
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Replay animation
          </Button>
          {isUnsaved && (
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-300 dark:border-amber-700"
              data-testid="nudge-preview-unsaved-badge"
            >
              Draft · unsaved
            </span>
          )}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Adjust the next-stage pulse and Stage 5 halo independently for light and dark themes. The preview updates live; color changes do not affect animation timing or reward stages.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" data-testid="nudge-cue-color-controls">
        {(["light", "dark"] as const).map((theme) => (
          <section key={theme} className="space-y-4 rounded-lg border p-4">
            <h3 className="text-sm font-semibold capitalize">{theme} theme</h3>
            <div className="grid grid-cols-1 gap-4">
              <NudgeCueColorControl
                id={`input-nudge-color-${theme}-pulse`}
                label="Next-stage pulse"
                value={nudgeCueColors[theme].pulse}
                onChange={(pulse) =>
                  onNudgeCueColorsChange({
                    ...nudgeCueColors,
                    [theme]: { ...nudgeCueColors[theme], pulse },
                  })
                }
              />
              <NudgeCueColorControl
                id={`input-nudge-color-${theme}-halo`}
                label="Stage 5 halo"
                value={nudgeCueColors[theme].halo}
                onChange={(halo) =>
                  onNudgeCueColorsChange({
                    ...nudgeCueColors,
                    [theme]: { ...nudgeCueColors[theme], halo },
                  })
                }
              />
            </div>
          </section>
        ))}
      </div>

      <Button
        type="button"
        onClick={onSaveNudgeCueColors}
        disabled={isSavingNudgeCueColors || JSON.stringify(nudgeCueColors) === JSON.stringify(savedNudgeCueColors)}
        data-testid="button-save-nudge-colors"
      >
        <Save className="mr-2 h-4 w-4" />
        {isSavingNudgeCueColors ? "Saving..." : "Save cue colors"}
      </Button>

      <div
        key={`nudge-preview-replay-${replayKey}`}
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
        data-testid="nudge-preview-grid"
        data-replay-key={replayKey}
      >
        {states.map(({ label, sublabel, itemCount, testId }) => (
          <div key={testId} className="space-y-2" data-testid={testId}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{label}</span>
              <span className="text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5">{sublabel}</span>
            </div>
            <NudgeCard
              itemCount={itemCount}
              engineThresholds={thresholds}
              cueColors={nudgeCueColors}
              compact
            />
          </div>
        ))}
      </div>
    </Card>
  );
}
