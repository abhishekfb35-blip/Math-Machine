import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Save, ArrowLeft, Tag, Truck, MessageSquare, Info, Plus, Trash2, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import type { DeliveryTier } from "@/lib/siteConfigDefaults";

interface CartEngineConfig {
  wholesaleThreshold: number;
  retailFreeItemTrigger: number;
  retailBonusDiscountPct: number;
}

interface CartBanners {
  state1to2: string;
  state3: string;
  state4: string;
  state5plus: string;
}

const emptyBanners: CartBanners = {
  state1to2: "",
  state3: "",
  state4: "",
  state5plus: "",
};

function useSaveConfig(key: string) {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (value: any) => {
      await apiRequest("POST", `/api/site-config/${key}`, { value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/site-config"] });
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

function resolveBanner(count: number, banners: CartBanners, config: CartEngineConfig): string {
  if (count >= config.wholesaleThreshold) return banners.state5plus;
  if (count >= config.retailFreeItemTrigger + 1) return banners.state4;
  if (count >= config.retailFreeItemTrigger) return banners.state3;
  return banners.state1to2;
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
  const [banners, setBanners] = useState<CartBanners>(emptyBanners);
  const [deliveryTiers, setDeliveryTiers] = useState<DeliveryTier[]>([]);
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
      const rawBanners = allConfig["cart-banners"];
      if (rawBanners && typeof rawBanners === "object") {
        setBanners({ ...emptyBanners, ...rawBanners });
      }
      const rawDelivery = allConfig["delivery-tiers"];
      if (Array.isArray(rawDelivery)) {
        setDeliveryTiers(rawDelivery);
      }
      setConfigLoaded(true);
    }
  }, [allConfig, configLoaded]);

  const saveEngine = useSaveConfig("cart-engine-config");
  const saveBanners = useSaveConfig("cart-banners");
  const saveDelivery = useSaveConfig("delivery-tiers");

  const updateEngineDraft = (field: keyof CartEngineConfig, raw: string) => {
    const v = parseInt(raw, 10);
    if (isNaN(v)) return;
    setEngineDraft(prev => ({ ...prev, [field]: v }));
  };

  const updateBanner = (field: keyof CartBanners, value: string) => {
    setBanners(prev => ({ ...prev, [field]: value }));
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

  const BANNER_MAX = 200;
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
            <MessageSquare className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold">Cart Banners</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Message shown above the checkout button for each cart state. Leave blank for no banner. Requires engine config to be saved first.
          </p>

          <div className="space-y-4">
            {[
              { field: "state1to2" as const, label: "1–2 items banner", placeholder: "e.g. Add one more item to unlock a free one!" },
              { field: "state3" as const, label: `${engineDraft.retailFreeItemTrigger} items banner (free item applied)`, placeholder: "e.g. Your cheapest item is free!" },
              { field: "state4" as const, label: `${engineDraft.retailFreeItemTrigger + 1} items banner (free item + bonus)`, placeholder: `e.g. 1 free item + ${engineDraft.retailBonusDiscountPct}% off the next cheapest!` },
              { field: "state5plus" as const, label: `${engineDraft.wholesaleThreshold}+ items banner (wholesale mode)`, placeholder: "e.g. Wholesale prices applied to your order!" },
            ].map(({ field, label, placeholder }) => (
              <div key={field} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>{label}</Label>
                  <span className={`text-xs ${banners[field].length > BANNER_MAX ? "text-destructive" : "text-muted-foreground"}`}>
                    {banners[field].length}/{BANNER_MAX}
                  </span>
                </div>
                <Textarea
                  value={banners[field]}
                  onChange={(e) => updateBanner(field, e.target.value)}
                  placeholder={placeholder}
                  rows={2}
                  maxLength={BANNER_MAX}
                  data-testid={`input-banner-${field}`}
                />
              </div>
            ))}
          </div>

          <Button
            onClick={() => saveBanners.mutate(banners)}
            disabled={saveBanners.isPending}
            data-testid="button-save-banners"
          >
            <Save className="w-4 h-4 mr-2" /> {saveBanners.isPending ? "Saving..." : "Save Cart Banners"}
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
                    <th className="text-left py-2 pr-4">Delivery</th>
                    <th className="text-left py-2">Banner</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {previewCounts.map((count) => {
                    const mode = pricingModeLabel(count, engineDraft);
                    const delivery = computeDeliveryFee(count, deliveryTiers);
                    const banner = resolveBanner(count, banners, engineDraft);
                    return (
                      <tr key={count} data-testid={`preview-row-${count}`}>
                        <td className="py-2 pr-4 font-medium">{count === 5 ? "5+" : count}</td>
                        <td className="py-2 pr-4 text-muted-foreground">{mode}</td>
                        <td className="py-2 pr-4">{delivery === 0 ? <span className="text-primary">Free</span> : `₹${delivery}`}</td>
                        <td className="py-2 max-w-xs">
                          {banner
                            ? <span className="text-primary text-xs">{banner}</span>
                            : <span className="text-muted-foreground/40 text-xs italic">No banner</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
