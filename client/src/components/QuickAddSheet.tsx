import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ShoppingCart, Gift, Minus, Plus } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getProductImageUrl } from "@/lib/imageUtils";
import type { Product, CategoryVariantOptions, ProductVariant } from "@shared/types";

interface QuickAddSheetProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function QuickAddSheet({ product, open, onOpenChange }: QuickAddSheetProps) {
  const { toast } = useToast();
  const [personalizationName, setPersonalizationName] = useState("");
  const [gentlemanName, setGentlemanName] = useState("");
  const [ladyName, setLadyName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const isCoupleProduct = product?.audience === "couples";

  const { data: variantOptions } = useQuery<CategoryVariantOptions>({
    queryKey: ["/api/categories", product?.categoryId, "variant-options"],
    queryFn: async () => {
      const res = await fetch(`/api/categories/${product!.categoryId}/variant-options`);
      return res.json();
    },
    enabled: !!product?.categoryId && open,
  });

  const { data: productVariants } = useQuery<ProductVariant[]>({
    queryKey: ["/api/products", product?.id, "variants"],
    queryFn: async () => {
      const res = await fetch(`/api/products/${product!.id}/variants`);
      return res.json();
    },
    enabled: !!product?.id && open,
  });

  const hasProductVariants = productVariants !== undefined && productVariants.length > 0;
  const hasCategoryPalette = (variantOptions?.sizes.filter(s => !s.hideFromFront).length ?? 0) > 0
    || (variantOptions?.colors.filter(c => !c.hideFromFront).length ?? 0) > 0;
  const isTowelProduct = product?.productType === "towel";
  const showVariantSelectors = isTowelProduct && hasCategoryPalette && hasProductVariants;

  const getFirstAvailableColor = (sizeValue: string): string | null => {
    const productColorNamesForSize = new Set(
      (productVariants || []).filter(v => v.size === sizeValue && v.available).map(v => v.color)
    );
    const first = (variantOptions?.colors || []).find(
      c => !c.hideFromFront && !c.blurOnFront && productColorNamesForSize.has(c.name)
    );
    return first ? first.name : null;
  };

  useEffect(() => {
    if (!showVariantSelectors || !variantOptions || !productVariants || selectedSize) return;
    const visible = variantOptions.sizes.filter(s => !s.hideFromFront && !s.blurOnFront);
    const available = visible.filter(s =>
      (productVariants || []).some(v => v.size === s.value && v.available)
    );
    if (available.length > 0) {
      const def = available.find(s => s.isDefault) || available[0];
      setSelectedSize(def.value);
      setSelectedColor(getFirstAvailableColor(def.value));
    }
  }, [showVariantSelectors, variantOptions, productVariants]);

  useEffect(() => {
    if (!open) {
      setPersonalizationName("");
      setGentlemanName("");
      setLadyName("");
      setQuantity(1);
      setSelectedSize(null);
      setSelectedColor(null);
    }
  }, [open]);

  const visibleSizes = showVariantSelectors
    ? (variantOptions?.sizes || []).filter(s => !s.hideFromFront)
    : [];

  const colorsForSelectedSize = (() => {
    if (!showVariantSelectors || !selectedSize) return [];
    const availableColorNamesForSize = new Set(
      (productVariants || []).filter(v => v.size === selectedSize && v.available).map(v => v.color)
    );
    return (variantOptions?.colors || []).filter(
      c => !c.hideFromFront && availableColorNamesForSize.has(c.name)
    );
  })();

  const variantSelectionIncomplete = showVariantSelectors && (
    (visibleSizes.length > 0 && !selectedSize) ||
    (colorsForSelectedSize.length > 0 && !selectedColor)
  );

  const isSizeSelectable = (sizeValue: string): boolean => {
    const sizeInPalette = variantOptions?.sizes.find(s => s.value === sizeValue);
    if (!sizeInPalette || sizeInPalette.blurOnFront) return false;
    return (productVariants || []).some(v => v.size === sizeValue && v.available);
  };

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
        selectedColor: selectedColor || undefined,
        selectedSize: selectedSize || undefined,
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
                ₹{product.price.toLocaleString("en-IN")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-primary bg-primary/5 dark:bg-primary/10 rounded-md px-3 py-2">
            <Gift className="w-4 h-4 shrink-0" />
            <span>Buy 2 Get 1 Free - discount applied at checkout</span>
          </div>

          {showVariantSelectors && visibleSizes.length > 0 && (
            <div className="space-y-1.5" data-testid="section-quickadd-sizes">
              <Label className="text-sm font-medium">Size</Label>
              <div className="flex flex-wrap gap-2">
                {visibleSizes.map((size) => {
                  const selectable = isSizeSelectable(size.value);
                  const isSelected = selectedSize === size.value;
                  const isBlur = size.blurOnFront;
                  return (
                    <button
                      key={size.value}
                      onClick={() => {
                        if (selectable) {
                          setSelectedSize(size.value);
                          const availableColorsForNewSize = new Set(
                            (productVariants || []).filter(v => v.size === size.value && v.available).map(v => v.color)
                          );
                          if (!selectedColor || !availableColorsForNewSize.has(selectedColor)) {
                            setSelectedColor(getFirstAvailableColor(size.value));
                          }
                        }
                      }}
                      disabled={!selectable || isBlur}
                      className={`px-3 py-1 text-xs rounded border transition-all ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : isBlur || !selectable
                          ? "border-muted text-muted-foreground opacity-40 cursor-not-allowed"
                          : "border-border hover:border-primary"
                      }`}
                      data-testid={`button-quickadd-size-${size.value}`}
                    >
                      {size.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {showVariantSelectors && colorsForSelectedSize.length > 0 && (
            <div className="space-y-1.5" data-testid="section-quickadd-colors">
              <Label className="text-sm font-medium">Colour</Label>
              <Select
                value={selectedColor ?? ""}
                onValueChange={(val) => setSelectedColor(val || null)}
                data-testid="select-quickadd-color"
              >
                <SelectTrigger className="w-full" data-testid="trigger-quickadd-color">
                  {selectedColor ? (
                    <span className="flex items-center gap-2">
                      <span className="inline-block w-4 h-4 rounded-full border border-border" style={{ backgroundColor: colorsForSelectedSize.find(c => c.name === selectedColor)?.hexCode }} />
                      {selectedColor}
                    </span>
                  ) : (
                    <SelectValue placeholder="Select a colour" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {colorsForSelectedSize.map((color) => (
                    <SelectItem key={color.name} value={color.name} disabled={color.blurOnFront} data-testid={`option-quickadd-color-${color.name}`}>
                      <span className={`flex items-center gap-2 ${color.blurOnFront ? "opacity-40" : ""}`}>
                        <span className="inline-block w-4 h-4 rounded-full border border-border shrink-0" style={{ backgroundColor: color.hexCode }} />
                        {color.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              `Select ${!selectedSize ? "Size" : "Colour"} to Continue`
            ) : (
              <>
                <ShoppingCart className="w-4 h-4 mr-2" />
                Add to Cart - ₹{(product.price * quantity).toLocaleString("en-IN")}
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
