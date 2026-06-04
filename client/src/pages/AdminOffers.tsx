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
import { Save, ArrowLeft, Tag, Truck, MessageSquare, Info, Plus, Trash2 } from "lucide-react";
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

const defaultEngineConfig: CartEngineConfig = {
  wholesaleThreshold: 5,
  retailFreeItemTrigger: 3,
  retailBonusDiscountPct: 30,
};

const defaultBanners: CartBanners = {
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

function resolveBanner(count: number, banners: CartBanners, threshold: number): string {
  if (count >= threshold) return banners.state5plus;
  if (count >= 4) return banners.state4;
  if (count >= 3) return banners.state3;
  return banners.state1to2;
}

export default function AdminOffers() {
  const { data: allConfig } = useQuery<Record<string, any>>({
    queryKey: ["/api/site-config"],
  });

  const [engineConfig, setEngineConfig] = useState<CartEngineConfig>(defaultEngineConfig);
  const [banners, setBanners] = useState<CartBanners>(defaultBanners);
  const [deliveryTiers, setDeliveryTiers] = useState<DeliveryTier[]>([]);
  const [previewCount, setPreviewCount] = useState(3);

  useEffect(() => {
    if (allConfig) {
      const rawEngine = allConfig["cart-engine-config"];
      if (rawEngine && typeof rawEngine.wholesaleThreshold === "number") {
        setEngineConfig(rawEngine);
      }
      const rawBanners = allConfig["cart-banners"];
      if (rawBanners && typeof rawBanners === "object") {
        setBanners({ ...defaultBanners, ...rawBanners });
      }
      const rawDelivery = allConfig["delivery-tiers"];
      if (Array.isArray(rawDelivery)) {
        setDeliveryTiers(rawDelivery);
      }
    }
  }, [allConfig]);

  const saveEngine = useSaveConfig("cart-engine-config");
  const saveBanners = useSaveConfig("cart-banners");
  const saveDelivery = useSaveConfig("delivery-tiers");

  const updateEngine = (field: keyof CartEngineConfig, value: number) => {
    setEngineConfig(prev => ({ ...prev, [field]: value }));
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

  const previewDelivery = computeDeliveryFee(previewCount, deliveryTiers);
  const previewBanner = resolveBanner(previewCount, banners, engineConfig.wholesaleThreshold);

  const isWholesale = previewCount >= engineConfig.wholesaleThreshold;
  const isRetailFree = previewCount === engineConfig.retailFreeItemTrigger;
  const isRetailBonus = previewCount === engineConfig.retailFreeItemTrigger + 1;

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
          <p className="text-sm text-muted-foreground">
            Controls how discounts are applied. If these values have not been saved yet, no discount runs at all.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <Label>Wholesale Threshold (items)</Label>
              <Input
                type="number"
                min={2}
                value={engineConfig.wholesaleThreshold}
                onChange={(e) => updateEngine("wholesaleThreshold", parseInt(e.target.value) || 5)}
                data-testid="input-wholesale-threshold"
              />
              <p className="text-xs text-muted-foreground">
                Carts at or above this count switch to wholesale mode. Products are charged at their wholesale price (set per-product in the catalog).
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Retail Free-Item Trigger (items)</Label>
              <Input
                type="number"
                min={2}
                value={engineConfig.retailFreeItemTrigger}
                onChange={(e) => updateEngine("retailFreeItemTrigger", parseInt(e.target.value) || 3)}
                data-testid="input-retail-free-trigger"
              />
              <p className="text-xs text-muted-foreground">
                At exactly this count, the cheapest item in the cart becomes free.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Bonus Discount at Trigger+1 (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={engineConfig.retailBonusDiscountPct}
                onChange={(e) => updateEngine("retailBonusDiscountPct", parseInt(e.target.value) || 0)}
                data-testid="input-retail-bonus-pct"
              />
              <p className="text-xs text-muted-foreground">
                At trigger+1 items: cheapest is free AND the next cheapest gets this % off.
              </p>
            </div>
          </div>

          <div className="bg-muted/50 rounded-md px-4 py-3 text-sm space-y-1">
            <p><span className="font-medium">1–{engineConfig.retailFreeItemTrigger - 1} items:</span> No discount.</p>
            <p><span className="font-medium">{engineConfig.retailFreeItemTrigger} items:</span> Cheapest item free.</p>
            <p><span className="font-medium">{engineConfig.retailFreeItemTrigger + 1} items:</span> Cheapest item free + {engineConfig.retailBonusDiscountPct}% off next cheapest.</p>
            <p><span className="font-medium">{engineConfig.wholesaleThreshold}+ items:</span> Wholesale mode — each product charged at its wholesale price (if set).</p>
          </div>

          <Button
            onClick={() => saveEngine.mutate(engineConfig)}
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
            Set the message shown above the checkout button for each cart state. Leave blank to show no banner for that state.
          </p>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>1–{engineConfig.retailFreeItemTrigger - 1} items banner</Label>
              <Textarea
                value={banners.state1to2}
                onChange={(e) => updateBanner("state1to2", e.target.value)}
                placeholder="e.g. Add one more to unlock Buy 2 Get 1 Free!"
                rows={2}
                data-testid="input-banner-1to2"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{engineConfig.retailFreeItemTrigger} items banner (free item applied)</Label>
              <Textarea
                value={banners.state3}
                onChange={(e) => updateBanner("state3", e.target.value)}
                placeholder="e.g. Your cheapest item is free!"
                rows={2}
                data-testid="input-banner-3"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{engineConfig.retailFreeItemTrigger + 1} items banner (free item + bonus discount)</Label>
              <Textarea
                value={banners.state4}
                onChange={(e) => updateBanner("state4", e.target.value)}
                placeholder={`e.g. 1 free item + ${engineConfig.retailBonusDiscountPct}% off the next cheapest!`}
                rows={2}
                data-testid="input-banner-4"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{engineConfig.wholesaleThreshold}+ items banner (wholesale mode)</Label>
              <Textarea
                value={banners.state5plus}
                onChange={(e) => updateBanner("state5plus", e.target.value)}
                placeholder="e.g. Wholesale prices applied to your order!"
                rows={2}
                data-testid="input-banner-5plus"
              />
            </div>
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
            See what pricing mode and banner apply at a given cart size.
          </p>
          <div className="flex items-center gap-4">
            <Label className="shrink-0">Cart size (items)</Label>
            <Input
              type="number"
              min={1}
              max={50}
              className="w-28"
              value={previewCount}
              onChange={(e) => setPreviewCount(Math.max(1, parseInt(e.target.value) || 1))}
              data-testid="input-preview-count"
            />
          </div>
          <Separator />
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pricing mode</span>
              <span className="font-medium">
                {isWholesale ? "Wholesale" : isRetailFree || isRetailBonus ? "Retail (discount active)" : "Retail (no discount)"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivery fee</span>
              <span className="font-medium">{previewDelivery === 0 ? "Free" : `₹${previewDelivery}`}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground shrink-0">Banner text</span>
              <span className="font-medium text-right max-w-xs">
                {previewBanner || <span className="text-muted-foreground italic">No banner</span>}
              </span>
            </div>
          </div>
          {previewBanner && (
            <div className="bg-primary/10 border border-primary/20 rounded-md px-4 py-2 text-sm text-primary font-medium" data-testid="preview-banner">
              {previewBanner}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
