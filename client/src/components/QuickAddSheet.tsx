import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ShoppingCart, Gift, Minus, Plus } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  useEffect(() => {
    if (!variantOptions || selectedSize) return;
    const visible = variantOptions.sizes.filter(s => !s.hideFromFront);
    if (visible.length > 0) {
      const def = visible.find(s => s.isDefault) || visible[0];
      setSelectedSize(def.value);
    }
  }, [variantOptions]);

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

  const visibleSizes = variantOptions?.sizes.filter(s => !s.hideFromFront) || [];
  const visibleColors = variantOptions?.colors.filter(c => !c.hideFromFront) || [];

  const isColorAvailable = (colorName: string, sizeValue: string | null): boolean => {
    if (!productVariants || productVariants.length === 0) return true;
    if (!sizeValue) return false;
    const variant = productVariants.find(v => v.color === colorName && v.size === sizeValue);
    return variant ? variant.available : false;
  };

  const isSizeAvailable = (sizeValue: string): boolean => {
    if (!productVariants || productVariants.length === 0) return true;
    return productVariants.some(v => v.size === sizeValue && v.available);
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

          {visibleSizes.length > 0 && (
            <div className="space-y-1.5" data-testid="section-quickadd-sizes">
              <Label className="text-sm font-medium">Size</Label>
              <div className="flex flex-wrap gap-2">
                {visibleSizes.map((size) => {
                  const available = isSizeAvailable(size.value);
                  const isSelected = selectedSize === size.value;
                  return (
                    <button
                      key={size.value}
                      onClick={() => {
                        setSelectedSize(size.value);
                        setSelectedColor(null);
                      }}
                      disabled={!available && !size.blurOnFront}
                      className={`px-3 py-1 text-xs rounded border transition-all ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : size.blurOnFront || !available
                          ? "border-muted text-muted-foreground opacity-50 cursor-not-allowed"
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

          {visibleColors.length > 0 && (
            <div className="space-y-1.5" data-testid="section-quickadd-colors">
              <Label className="text-sm font-medium">
                Colour{selectedColor ? `: ${selectedColor}` : ""}
              </Label>
              <div className="flex flex-wrap gap-2">
                {visibleColors.map((color) => {
                  const available = isColorAvailable(color.name, selectedSize);
                  const isSelected = selectedColor === color.name;
                  return (
                    <button
                      key={color.name}
                      onClick={() => {
                        if (!available && !color.blurOnFront) return;
                        setSelectedColor(color.name);
                      }}
                      title={color.name}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                        isSelected
                          ? "border-primary scale-110 shadow-md"
                          : color.blurOnFront || !available
                          ? "border-muted opacity-40 cursor-not-allowed"
                          : "border-transparent hover:border-primary/50"
                      }`}
                      style={{ backgroundColor: color.hexCode }}
                      data-testid={`button-quickadd-color-${color.name}`}
                    />
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
            disabled={addToCartMutation.isPending}
            data-testid="button-quickadd-submit"
          >
            {addToCartMutation.isPending ? (
              "Adding..."
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
