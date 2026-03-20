import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ShoppingCart, Gift, Minus, Plus } from "lucide-react";
import { useCurrency } from "@/context/CurrencyContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getProductImageUrl } from "@/lib/imageUtils";
import type { Product, ProductVariantOptions, ProductVariant, VariantSize } from "@shared/types";

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
  const [quantity, setQuantity] = useState(1);
  const [selectedSizeName, setSelectedSizeName] = useState<string | null>(null);
  const [selectedColorName, setSelectedColorName] = useState<string | null>(null);
  const isCoupleProduct = product?.audience === "couples";

  const { data: variantOptions } = useQuery<ProductVariantOptions>({
    queryKey: ["/api/products", product?.id, "variant-options"],
    queryFn: async () => {
      const res = await fetch(`/api/products/${product!.id}/variant-options`);
      return res.json();
    },
    enabled: !!product?.id && open,
  });

  const { data: productVariants } = useQuery<ProductVariant[]>({
    queryKey: ["/api/products", product?.id, "variants"],
    queryFn: async () => {
      const res = await fetch(`/api/products/${product!.id}/variants`);
      return res.json();
    },
    enabled: !!product?.id && open,
  });

  const hasVariantConfig = (variantOptions?.sizes?.length ?? 0) > 0;
  const isTowelProduct = product?.productType === "towel";
  const showVariantSelectors = isTowelProduct && hasVariantConfig;

  const selectedSizeObj: VariantSize | undefined = variantOptions?.sizes.find(s => s.name === selectedSizeName);

  const isSizeAvailable = (sizeName: string): boolean => {
    if (!productVariants || productVariants.length === 0) return true;
    return productVariants.some(v => v.size === sizeName && v.available);
  };

  const isColorAvailable = (sizeName: string, colorName: string): boolean => {
    if (!productVariants || productVariants.length === 0) return true;
    return productVariants.some(v => v.size === sizeName && v.color === colorName && v.available);
  };

  const getFirstSelectableColor = (sizeName: string): string | null => {
    const sizeObj = variantOptions?.sizes.find(s => s.name === sizeName);
    if (!sizeObj) return null;
    const first = sizeObj.colors.find(c => !c.blurOnFront && isColorAvailable(sizeName, c.name));
    return first ? first.name : null;
  };

  useEffect(() => {
    if (!showVariantSelectors || !variantOptions || selectedSizeName) return;
    const visible = variantOptions.sizes.filter(s => !s.blurOnFront);
    if (visible.length > 0) {
      const def = visible.find(s => s.isDefault) || visible[0];
      setSelectedSizeName(def.name);
      setSelectedColorName(getFirstSelectableColor(def.name));
    }
  }, [showVariantSelectors, variantOptions]);

  useEffect(() => {
    if (!open) {
      setPersonalizationName("");
      setGentlemanName("");
      setLadyName("");
      setQuantity(1);
      setSelectedSizeName(null);
      setSelectedColorName(null);
    }
  }, [open]);

  const colorsForSelectedSize = (() => {
    if (!showVariantSelectors || !selectedSizeName || !selectedSizeObj) return [];
    return selectedSizeObj.colors.filter(c => !c.blurOnFront);
  })();

  const variantSelectionIncomplete = showVariantSelectors && (
    ((variantOptions?.sizes.length ?? 0) > 0 && !selectedSizeName) ||
    (colorsForSelectedSize.length > 0 && !selectedColorName)
  );

  const effectivePrice = (product?.price ?? 0) + (selectedSizeObj?.priceAdd ?? 0);

  const addToCartMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cart/items", {
        productId: product!.id,
        quantity,
        personalizationName: isCoupleProduct
          ? (gentlemanName.trim() || ladyName.trim()
            ? `His: ${gentlemanName.trim() || "—"} & Hers: ${ladyName.trim() || "—"}`
            : undefined)
          : (personalizationName.trim() || undefined),
        selectedColor: selectedColorName || undefined,
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
                {variantOptions!.sizes.filter(s => !s.blurOnFront).map((size) => {
                  const available = isSizeAvailable(size.name);
                  const isSelected = selectedSizeName === size.name;
                  return (
                    <button
                      key={size.name}
                      onClick={() => {
                        if (available) {
                          setSelectedSizeName(size.name);
                          const currentColorStillAvailable = selectedColorName && isColorAvailable(size.name, selectedColorName);
                          if (!currentColorStillAvailable) {
                            setSelectedColorName(getFirstSelectableColor(size.name));
                          }
                        }
                      }}
                      disabled={!available}
                      className={`px-3 py-1 text-xs rounded border transition-all ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : !available
                          ? "border-muted text-muted-foreground opacity-40 cursor-not-allowed"
                          : "border-border hover:border-primary"
                      }`}
                      data-testid={`button-quickadd-size-${size.name}`}
                    >
                      {size.name}
                      {size.priceAdd > 0 && (
                        <span className="ml-1 text-[10px] opacity-70">+{formatPrice(size.priceAdd)}</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {selectedSizeObj?.description && (
                <p className="text-xs text-muted-foreground">{selectedSizeObj.description}</p>
              )}
            </div>
          )}

          {showVariantSelectors && colorsForSelectedSize.length > 0 && (
            <div className="space-y-1.5" data-testid="section-quickadd-colors">
              <Label className="text-sm font-medium">Colour</Label>
              <div className="flex flex-wrap gap-2">
                {colorsForSelectedSize.map((color) => {
                  const available = isColorAvailable(selectedSizeName!, color.name);
                  const isSelected = selectedColorName === color.name;
                  return (
                    <button
                      key={color.name}
                      onClick={() => { if (available) setSelectedColorName(color.name); }}
                      disabled={!available}
                      className={`flex items-center gap-1.5 p-1 text-xs rounded border transition-all ${
                        isSelected
                          ? "border-primary ring-1 ring-primary"
                          : !available
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
                          className="w-8 h-8 rounded object-cover"
                        />
                      ) : (
                        <span className="w-8 h-8 rounded bg-muted border border-border inline-block" />
                      )}
                      <span className="pr-1">{color.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {isCoupleProduct ? (
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Personalise with Names
              </Label>
              <Input
                id="qa-gentleman-name"
                placeholder="Name of Gentleman"
                value={gentlemanName}
                onChange={(e) => setGentlemanName(e.target.value)}
                maxLength={30}
                data-testid="input-quickadd-gentleman"
              />
              <Input
                id="qa-lady-name"
                placeholder="Name of Lady"
                value={ladyName}
                onChange={(e) => setLadyName(e.target.value)}
                maxLength={30}
                data-testid="input-quickadd-lady"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="qa-personalization" className="text-sm font-medium">
                Personalise with a Name
              </Label>
              <Input
                id="qa-personalization"
                placeholder="Enter name to embroider (optional)"
                value={personalizationName}
                onChange={(e) => setPersonalizationName(e.target.value)}
                maxLength={30}
                data-testid="input-quickadd-name"
              />
            </div>
          )}

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
            onClick={() => addToCartMutation.mutate()}
            disabled={addToCartMutation.isPending || !!variantSelectionIncomplete}
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
  );
}
