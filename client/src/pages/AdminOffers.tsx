import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Save, Plus, Trash2, ArrowLeft, Tag, Truck, Info } from "lucide-react";
import { Link } from "wouter";
import {
  defaultOfferTiers, defaultDeliveryTiers,
  type OfferTier, type DeliveryTier,
} from "@/lib/siteConfigDefaults";

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

function getConfig<T>(allConfig: Record<string, any> | undefined, key: string, fallback: T): T {
  if (!allConfig || !(key in allConfig)) return fallback;
  return allConfig[key] as T;
}

function computeNumFree(totalItems: number, tiers: OfferTier[]): number {
  const activeTiers = tiers.filter(t => t.enabled && t.buyCount > 0 && t.freeCount > 0);
  if (activeTiers.length === 0 || totalItems <= 0) return 0;
  const dp = new Array<number>(totalItems + 1).fill(0);
  for (let n = 1; n <= totalItems; n++) {
    for (const tier of activeTiers) {
      const groupSize = tier.buyCount + tier.freeCount;
      if (n >= groupSize) {
        const candidate = dp[n - groupSize] + tier.freeCount;
        if (candidate > dp[n]) dp[n] = candidate;
      }
    }
  }
  return dp[totalItems];
}

function computeDeliveryFee(itemCount: number, tiers: DeliveryTier[]): number {
  for (const tier of tiers) {
    if (itemCount >= tier.minItems && itemCount <= tier.maxItems) return tier.fee;
  }
  return 0;
}

export default function AdminOffers() {
  const { data: allConfig } = useQuery<Record<string, any>>({
    queryKey: ["/api/site-config"],
  });

  const [offerTiers, setOfferTiers] = useState<OfferTier[]>(defaultOfferTiers);
  const [deliveryTiers, setDeliveryTiers] = useState<DeliveryTier[]>(defaultDeliveryTiers);
  const [previewCount, setPreviewCount] = useState(3);

  useEffect(() => {
    if (allConfig) {
      setOfferTiers(getConfig(allConfig, "offer-tiers", defaultOfferTiers));
      setDeliveryTiers(getConfig(allConfig, "delivery-tiers", defaultDeliveryTiers));
    }
  }, [allConfig]);

  const saveOffers = useSaveConfig("offer-tiers");
  const saveDelivery = useSaveConfig("delivery-tiers");

  const updateOfferTier = (index: number, field: keyof OfferTier, value: any) => {
    const updated = [...offerTiers];
    updated[index] = { ...updated[index], [field]: value };
    setOfferTiers(updated);
  };

  const addOfferTier = () => {
    setOfferTiers([...offerTiers, { label: "Buy N Get M Free", buyCount: 2, freeCount: 1, enabled: true }]);
  };

  const removeOfferTier = (index: number) => {
    setOfferTiers(offerTiers.filter((_, i) => i !== index));
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

  const previewFree = computeNumFree(previewCount, offerTiers);
  const previewDelivery = computeDeliveryFee(previewCount, deliveryTiers);
  const paidCount = previewCount - previewFree;

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
            <p className="text-xs text-muted-foreground">Configure promotional offers and domestic delivery fees</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        <Card className="p-6 space-y-6">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold">Offer Tiers</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Define buy-get-free offers. The system automatically picks the best combination for each cart.
            Cheapest items are always discounted first. Products can be mixed across all categories.
          </p>

          <div className="space-y-4">
            {offerTiers.map((tier, i) => (
              <Card key={i} className="p-4 space-y-4 border-dashed" data-testid={`card-offer-tier-${i}`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={tier.enabled}
                      onCheckedChange={(v) => updateOfferTier(i, "enabled", v)}
                      data-testid={`switch-offer-enabled-${i}`}
                    />
                    <span className={`text-sm font-medium ${!tier.enabled ? "text-muted-foreground line-through" : ""}`}>
                      {tier.label || `Tier ${i + 1}`}
                    </span>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeOfferTier(i)}
                    data-testid={`button-remove-offer-tier-${i}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label>Label</Label>
                    <Input
                      value={tier.label}
                      onChange={(e) => updateOfferTier(i, "label", e.target.value)}
                      placeholder="Buy 2 Get 1 Free"
                      data-testid={`input-offer-label-${i}`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Buy Count</Label>
                    <Input
                      type="number"
                      min={1}
                      value={tier.buyCount}
                      onChange={(e) => updateOfferTier(i, "buyCount", parseInt(e.target.value) || 1)}
                      data-testid={`input-offer-buy-${i}`}
                    />
                    <p className="text-xs text-muted-foreground">Items customer pays for</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Free Count</Label>
                    <Input
                      type="number"
                      min={1}
                      value={tier.freeCount}
                      onChange={(e) => updateOfferTier(i, "freeCount", parseInt(e.target.value) || 1)}
                      data-testid={`input-offer-free-${i}`}
                    />
                    <p className="text-xs text-muted-foreground">Items given free</p>
                  </div>
                </div>
                {tier.enabled && tier.buyCount > 0 && tier.freeCount > 0 && (
                  <p className="text-xs text-primary bg-primary/5 rounded-md px-3 py-1.5">
                    Customer orders {tier.buyCount + tier.freeCount} → pays for {tier.buyCount}, gets {tier.freeCount} free
                  </p>
                )}
              </Card>
            ))}
          </div>

          <Button variant="outline" onClick={addOfferTier} data-testid="button-add-offer-tier">
            <Plus className="w-4 h-4 mr-2" /> Add Offer Tier
          </Button>

          <div>
            <Button
              onClick={() => saveOffers.mutate(offerTiers)}
              disabled={saveOffers.isPending}
              data-testid="button-save-offer-tiers"
            >
              <Save className="w-4 h-4 mr-2" /> {saveOffers.isPending ? "Saving..." : "Save Offer Tiers"}
            </Button>
          </div>
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
            See how the current settings apply to a cart of N items.
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
              <span className="text-muted-foreground">Items in cart</span>
              <span className="font-medium">{previewCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Items free</span>
              <span className="font-medium text-primary">{previewFree}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Items customer pays for</span>
              <span className="font-medium">{paidCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivery fee</span>
              <span className="font-medium">{previewDelivery === 0 ? "Free" : `₹${previewDelivery}`}</span>
            </div>
          </div>
          {previewFree > 0 && (
            <p className="text-xs text-primary bg-primary/5 rounded-md px-3 py-1.5">
              With {previewCount} items, customer gets {previewFree} item{previewFree > 1 ? "s" : ""} free
              {previewDelivery > 0 ? ` + ₹${previewDelivery} delivery` : " + free delivery"}.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
