import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ShoppingCart, Gift, Minus, Plus } from "lucide-react";
import { useCurrency } from "@/context/CurrencyContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getProductImageUrl } from "@/lib/imageUtils";
import type { Product, ProductVariantOptions, VariantSize } from "@shared/types";

type SingleAudienceConfig = { type: "single"; heading: string; nameLabel: string; nameMin?: number; nameMax?: number };
type CoupleAudienceConfig = { type: "couples"; heading: string; person1Label: string; person2Label: string; person1Prefix: string; person2Prefix: string; nameMin?: number; nameMax?: number };
type AudiencePageConfig = SingleAudienceConfig | CoupleAudienceConfig;
type ProductPageConfig = Record<string, AudiencePageConfig>;

function nameCharHint(val: string, min: number, max: number): { text: string; className: string } {
  const len = val.length;
  const left = max - len;
  if (len === 0) return { text: `${min} to ${max} characters`, className: "text-muted-foreground" };
  if (len < min) return { text: `Minimum ${min} characters · ${left} character${left !== 1 ? "s" : ""} left`, className: "text-amber-500" };
  return { text: `${left} character${left !== 1 ? "s" : ""} left`, className: "text-muted-foreground" };
}

interface QuickAddSheetProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function QuickAddSheet({ product, open, onOpenChange }: QuickAddSheetProps) {
  const { toast } = useToast();
  const { formatPrice, convertPrice } = useCurrency();
  const [personalizationName, setPersonalizationName] = useState("");
  const [gentlemanName, setGentlemanName] = useState("");
  const [ladyName, setLadyName] = useState("");
  const [showNameConfirm, setShowNameConfirm] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedSizeName, setSelectedSizeName] = useState<string | null>(null);
  const [sizeColorMap, setSizeColorMap] = useState<Record<string, string>>({});
  const { data: productPageConfigData } = useQuery<{ value: ProductPageConfig } | null>({
    queryKey: ["/api/site-config", "product-page-config"],
    queryFn: () => fetch("/api/site-config/product-page-config").then(r => r.ok ? r.json() : null),
    staleTime: 5 * 60 * 1000,
  });

  const audienceConfig = useMemo((): AudiencePageConfig | null => {
    const cfg = productPageConfigData?.value ?? null;
    if (!cfg || !product?.audience?.length) return null;
    for (const a of product.audience) {
      const c = cfg[a.toLowerCase()];
      if (c?.type === "couples") return c;
    }
    for (const a of product.audience) {
      const c = cfg[a.toLowerCase()];
      if (c?.type === "single") return c;
    }
    return null;
  }, [productPageConfigData, product?.audience]);

  const isCoupleProduct = audienceConfig?.type === "couples";
  const nameMin = audienceConfig?.nameMin;
  const nameMax = audienceConfig?.nameMax;

  const { data: variantOptions } = useQuery<ProductVariantOptions>({
    queryKey: ["/api/products", product?.id, "variant-options"],
    queryFn: async () => {
      const res = await fetch(`/api/products/${product!.id}/variant-options`);
      return res.json();
    },
    enabled: !!product?.id && open,
  });

  const hasVariantConfig = (variantOptions?.sizes?.length ?? 0) > 0;
  const showVariantSelectors = hasVariantConfig;

  const selectedSizeObj: VariantSize | undefined = variantOptions?.sizes.find(s => s.name === selectedSizeName);

  const isSizeAvailable = (_sizeName: string): boolean => true;

  const isColorAvailable = (_sizeName: string, _colorName: string): boolean => true;

  const getFirstSelectableColor = (sizeName: string): string | null => {
    const sizeObj = variantOptions?.sizes.find(s => s.name === sizeName);
    if (!sizeObj) return null;
    const first = sizeObj.colors.find(c => !c.blurOnFront && isColorAvailable(sizeName, c.name));
    return first ? first.name : null;
  };

  useEffect(() => {
    if (!showVariantSelectors || !variantOptions || selectedSizeName) return;
    const sizes = variantOptions.sizes;
    if (sizes.length > 0) {
      // Only auto-select when a size with explicit front-image exists (blurOnFront=false).
      // Products where all sizes have blurOnFront=true require the user to choose explicitly.
      const def = sizes.find(s => s.isDefault && !s.blurOnFront) || sizes.find(s => !s.blurOnFront);
      if (def) {
        setSelectedSizeName(def.name);
        const firstColor = getFirstSelectableColor(def.name);
        if (firstColor) setSizeColorMap(prev => ({ ...prev, [def.name]: firstColor }));
      }
    }
  }, [showVariantSelectors, variantOptions]);

  useEffect(() => {
    if (!open) {
      setPersonalizationName("");
      setGentlemanName("");
      setLadyName("");
      setQuantity(1);
      setSelectedSizeName(null);
      setSizeColorMap({});
    }
  }, [open]);

  const colorsForSelectedSize = (() => {
    if (!showVariantSelectors || !selectedSizeName || !selectedSizeObj) return [];
    return selectedSizeObj.colors;
  })();

  const variantSelectionIncomplete = showVariantSelectors && (() => {
    if (!variantOptions) return false;
    const selectableSizes = variantOptions.sizes.filter(s => !s.blurOnFront);
    if (selectableSizes.length === 0) return false;
    if (!selectedSizeName) return true;
    if (isCoupleProduct) {
      return selectableSizes.some(s => s.colors.filter(c => !c.blurOnFront).length > 0 && !sizeColorMap[s.name]);
    }
    return colorsForSelectedSize.filter(c => !c.blurOnFront).length > 0 && !sizeColorMap[selectedSizeName];
  })();

  const effectivePrice = (product?.price ?? 0) + (selectedSizeObj?.priceAdd ?? 0);

  const addToCartMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cart/items", {
        productId: product!.id,
        quantity,
        personalizationName: audienceConfig?.type === "couples"
          ? (gentlemanName.trim() || ladyName.trim()
            ? `${audienceConfig.person1Prefix}: ${gentlemanName.trim() || "—"} & ${audienceConfig.person2Prefix}: ${ladyName.trim() || "—"}`
            : undefined)
          : audienceConfig?.type === "single"
            ? (personalizationName.trim() || undefined)
            : undefined,
        selectedColor: isCoupleProduct
          ? (variantOptions?.sizes.filter(s => sizeColorMap[s.name]).map(s => `${s.name}: ${sizeColorMap[s.name]}`).join(" · ") || undefined)
          : (sizeColorMap[selectedSizeName ?? ""] || undefined),
        selectedSize: selectedSizeName || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({
        title: "Added to cart",
        description: `${product!.name} has been added to your cart.`,
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add item. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (!product) return null;

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="text-left">Add to Cart</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 pt-4">
          <div className="flex gap-3">
            <div className="w-20 h-20 rounded-md overflow-hidden bg-muted shrink-0">
              <img
                src={getProductImageUrl(product.imageUrl, "small")}
                alt={product.name}
                className="w-full h-full object-contain"
                data-testid="img-quickadd-product"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm leading-tight line-clamp-2" data-testid="text-quickadd-name">
                {product.name}
              </h3>
              <p className="text-lg font-bold text-primary mt-1" data-testid="text-quickadd-price">
                {formatPrice(effectivePrice)}
                {(selectedSizeObj?.priceAdd ?? 0) > 0 && (
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    (base {formatPrice(product.price)} + size)
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-primary bg-primary/5 dark:bg-primary/10 rounded-md px-3 py-2">
            <Gift className="w-4 h-4 shrink-0" />
            <span>Buy 2 Get 1 Free - discount applied at checkout</span>
          </div>

          {showVariantSelectors && (variantOptions?.sizes.length ?? 0) > 0 && (
            <div className="space-y-1.5" data-testid="section-quickadd-sizes">
              <Label className="text-sm font-medium">Size</Label>
              <div className="flex flex-wrap gap-2">
                {variantOptions!.sizes.map((size) => {
                  const available = !size.blurOnFront && isSizeAvailable(size.name);
                  const blurred = size.blurOnFront;
                  const isSelected = selectedSizeName === size.name;
                  return (
                    <button
                      key={size.name}
                      onClick={() => {
                        if (available) {
                          setSelectedSizeName(size.name);
                          if (!isCoupleProduct && !sizeColorMap[size.name]) {
                            const firstColor = getFirstSelectableColor(size.name);
                            if (firstColor) setSizeColorMap(prev => ({ ...prev, [size.name]: firstColor }));
                          }
                        }
                      }}
                      disabled={!available}
                      className={`flex items-center px-3 py-1 text-xs rounded border transition-all ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : blurred || !isSizeAvailable(size.name)
                          ? "border-muted text-muted-foreground opacity-40 cursor-not-allowed"
                          : sizeColorMap[size.name]
                          ? "border-primary/50 hover:border-primary"
                          : "border-border hover:border-primary"
                      }`}
                      data-testid={`button-quickadd-size-${size.name}`}
                    >
                      <span>{size.name}</span>
                      {size.priceAdd > 0 && (
                        <span className="ml-1 text-[10px] opacity-70">+{formatPrice(size.priceAdd)}</span>
                      )}
                      {sizeColorMap[size.name] && (() => {
                        const picked = size.colors.find(c => c.name === sizeColorMap[size.name]);
                        return picked ? (
                          picked.swatchUrl
                            ? <img src={picked.swatchUrl} alt={picked.name} className="w-5 h-5 rounded-full object-cover ring-2 ring-white ml-1.5 shrink-0" />
                            : <span className="w-5 h-5 rounded-full bg-muted ring-2 ring-white inline-block ml-1.5 shrink-0" />
                        ) : null;
                      })()}
                    </button>
                  );
                })}
              </div>
              {selectedSizeObj?.description && (
                <p className="text-muted-foreground" style={{ fontSize: `${selectedSizeObj.descriptionFontSize ?? 12}px` }}>{selectedSizeObj.description}</p>
              )}
            </div>
          )}

          {showVariantSelectors && colorsForSelectedSize.length > 0 && (
            <div className="space-y-1.5" data-testid="section-quickadd-colors">
              <Label className="text-sm font-medium">Colour</Label>
              <div className="flex flex-wrap gap-2">
                {colorsForSelectedSize.map((color) => {
                  const available = !color.blurOnFront && isColorAvailable(selectedSizeName!, color.name);
                  const blurred = color.blurOnFront;
                  const isSelected = sizeColorMap[selectedSizeName ?? ""] === color.name;
                  return (
                    <button
                      key={color.name}
                      onClick={() => { if (available) setSizeColorMap(prev => ({ ...prev, [selectedSizeName!]: color.name })); }}
                      disabled={!available}
                      className={`flex items-center gap-1.5 p-1 text-xs rounded border transition-all ${
                        isSelected
                          ? "border-primary ring-1 ring-primary"
                          : blurred || !isColorAvailable(selectedSizeName!, color.name)
                          ? "border-muted opacity-40 cursor-not-allowed"
                          : "border-border hover:border-primary"
                      }`}
                      data-testid={`button-quickadd-color-${color.name}`}
                      title={color.name}
                    >
                      {color.swatchUrl ? (
                        <img
                          src={color.swatchUrl}
                          alt={color.name}
                          className="w-12 h-12 rounded object-cover"
                        />
                      ) : (
                        <span className="w-12 h-12 rounded bg-muted border border-border inline-block" />
                      )}
                      <span className="pr-1">{color.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {audienceConfig?.type === "couples" && nameMin != null && nameMax != null ? (
            <div className="space-y-2">
              <Label className="text-sm font-medium">{audienceConfig.heading}</Label>
              <div>
                <Input
                  id="qa-gentleman-name"
                  placeholder={audienceConfig.person1Label}
                  value={gentlemanName}
                  onChange={(e) => setGentlemanName(e.target.value)}
                  maxLength={nameMax}
                  data-testid="input-quickadd-gentleman"
                />
                {(() => { const h = nameCharHint(gentlemanName, nameMin, nameMax); return <p className={`text-xs mt-1 ${h.className}`}>{h.text}</p>; })()}
              </div>
              <div>
                <Input
                  id="qa-lady-name"
                  placeholder={audienceConfig.person2Label}
                  value={ladyName}
                  onChange={(e) => setLadyName(e.target.value)}
                  maxLength={nameMax}
                  data-testid="input-quickadd-lady"
                />
                {(() => { const h = nameCharHint(ladyName, nameMin, nameMax); return <p className={`text-xs mt-1 ${h.className}`}>{h.text}</p>; })()}
              </div>
            </div>
          ) : audienceConfig?.type === "single" && nameMin != null && nameMax != null ? (
            <div className="space-y-1">
              <Label htmlFor="qa-personalization" className="text-sm font-medium">
                {audienceConfig.heading}
              </Label>
              <Input
                id="qa-personalization"
                placeholder={audienceConfig.nameLabel}
                value={personalizationName}
                onChange={(e) => setPersonalizationName(e.target.value)}
                maxLength={nameMax}
                data-testid="input-quickadd-name"
              />
              {(() => { const h = nameCharHint(personalizationName, nameMin, nameMax); return <p className={`text-xs ${h.className}`}>{h.text}</p>; })()}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-4">
            <Label className="text-sm font-medium">Quantity</Label>
            <div className="flex items-center gap-3">
              <Button
                size="icon"
                variant="outline"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                data-testid="button-quickadd-decrease"
              >
                <Minus className="w-4 h-4" />
              </Button>
              <span className="text-base font-semibold w-8 text-center" data-testid="text-quickadd-qty">
                {quantity}
              </span>
              <Button
                size="icon"
                variant="outline"
                onClick={() => setQuantity(quantity + 1)}
                data-testid="button-quickadd-increase"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={() => {
              const min = nameMin ?? 0;
              const nameInvalid = isCoupleProduct
                ? (gentlemanName.trim().length > 0 && gentlemanName.trim().length < min) || (ladyName.trim().length > 0 && ladyName.trim().length < min)
                : personalizationName.trim().length > 0 && personalizationName.trim().length < min;
              if (nameInvalid) return;
              const nameEmpty = isCoupleProduct
                ? gentlemanName.trim() === "" && ladyName.trim() === ""
                : personalizationName.trim() === "";
              if (nameEmpty) { setShowNameConfirm(true); return; }
              addToCartMutation.mutate();
            }}
            disabled={addToCartMutation.isPending || !!variantSelectionIncomplete || (() => {
              const min = nameMin ?? 0;
              return isCoupleProduct
                ? (gentlemanName.trim().length > 0 && gentlemanName.trim().length < min) || (ladyName.trim().length > 0 && ladyName.trim().length < min)
                : personalizationName.trim().length > 0 && personalizationName.trim().length < min;
            })()}
            data-testid="button-quickadd-submit"
          >
            {addToCartMutation.isPending ? (
              "Adding..."
            ) : variantSelectionIncomplete ? (
              `Select ${!selectedSizeName ? "Size" : "Colour"} to Continue`
            ) : (
              <>
                <ShoppingCart className="w-4 h-4 mr-2" />
                Add to Cart - {formatPrice(effectivePrice * quantity)}
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>

    <AlertDialog open={showNameConfirm} onOpenChange={setShowNameConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>No name added</AlertDialogTitle>
          <AlertDialogDescription>
            This product can be personalised with an embroidered name. Are you sure you want to add it to your cart without a name?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-name-confirm-cancel">Add a name</AlertDialogCancel>
          <AlertDialogAction
            data-testid="button-name-confirm-proceed"
            onClick={() => { setShowNameConfirm(false); addToCartMutation.mutate(); }}
          >
            Proceed without name
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
