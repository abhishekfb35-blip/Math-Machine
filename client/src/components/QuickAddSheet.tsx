import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ShoppingCart, Gift, Minus, Plus } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getProductImageUrl } from "@/lib/imageUtils";
import type { Product } from "@shared/types";

interface QuickAddSheetProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function QuickAddSheet({ product, open, onOpenChange }: QuickAddSheetProps) {
  const { toast } = useToast();
  const [personalizationName, setPersonalizationName] = useState("");
  const [quantity, setQuantity] = useState(1);

  const addToCartMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cart/items", {
        productId: product!.id,
        quantity,
        personalizationName: personalizationName.trim() || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({
        title: "Added to cart",
        description: `${product!.name} has been added to your cart.`,
      });
      setPersonalizationName("");
      setQuantity(1);
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
