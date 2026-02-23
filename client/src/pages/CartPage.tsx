import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Trash2, Minus, Plus, ShoppingBag, ArrowRight, Gift } from "lucide-react";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getProductImageUrl } from "@/lib/imageUtils";
import type { Product, CartItem } from "@shared/types";

interface CartItemWithProduct extends CartItem {
  product: Product | null;
}

interface CartData {
  id: string;
  items: CartItemWithProduct[];
  itemCount: number;
  subtotal: number;
  discount: number;
  total: number;
}

function CartItemRow({ item, onRemove, onUpdateQty }: {
  item: CartItemWithProduct;
  onRemove: () => void;
  onUpdateQty: (qty: number) => void;
}) {
  if (!item.product) return null;

  return (
    <div className="flex gap-3 py-3" data-testid={`cart-item-${item.id}`}>
      <Link href={`/product/${item.product.slug}`}>
        <div className="w-20 h-20 rounded-md overflow-hidden bg-muted shrink-0 cursor-pointer">
          <img
            src={getProductImageUrl(item.product.imageUrl, "small")}
            alt={item.product.name}
            className="w-full h-full object-contain"
            data-testid={`img-cart-item-${item.id}`}
          />
        </div>
      </Link>
      <div className="flex-1 min-w-0 space-y-1">
        <Link href={`/product/${item.product.slug}`}>
          <h3 className="text-sm font-medium leading-tight line-clamp-2 hover:text-primary transition-colors cursor-pointer" data-testid={`text-cart-item-name-${item.id}`}>
            {item.product.name}
          </h3>
        </Link>
        {item.personalizationName && (
          <p className="text-xs text-muted-foreground" data-testid={`text-personalization-${item.id}`}>
            Embroidered: {item.personalizationName}
          </p>
        )}
        <p className="text-sm font-bold text-primary" data-testid={`text-cart-item-price-${item.id}`}>
          ₹{item.product.price.toLocaleString("en-IN")}
        </p>
        <div className="flex items-center gap-2 pt-1">
          <Button
            size="icon"
            variant="outline"
            onClick={() => onUpdateQty(Math.max(0, item.quantity - 1))}
            data-testid={`button-decrease-qty-${item.id}`}
          >
            <Minus className="w-3 h-3" />
          </Button>
          <span className="text-sm font-semibold w-6 text-center" data-testid={`text-qty-${item.id}`}>{item.quantity}</span>
          <Button
            size="icon"
            variant="outline"
            onClick={() => onUpdateQty(item.quantity + 1)}
            data-testid={`button-increase-qty-${item.id}`}
          >
            <Plus className="w-3 h-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="ml-auto text-destructive"
            onClick={onRemove}
            data-testid={`button-remove-item-${item.id}`}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CartPage() {
  const { data: cart, isLoading } = useQuery<CartData>({
    queryKey: ["/api/cart"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      if (quantity === 0) {
        await apiRequest("DELETE", `/api/cart/items/${id}`);
      } else {
        await apiRequest("PATCH", `/api/cart/items/${id}`, { quantity });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/cart/items/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="w-20 h-20 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const items = cart?.items.filter((i) => i.product) || [];

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4 pb-24 md:pb-16">
        <ShoppingBag className="w-16 h-16 mx-auto text-muted-foreground" />
        <h1 className="text-2xl font-bold" data-testid="text-empty-cart">Your cart is empty</h1>
        <p className="text-muted-foreground">Add some personalised towels and blankets!</p>
        <Link href="/shop">
          <Button data-testid="button-continue-shopping">Start Shopping</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-8">
      <SEO title="Shopping Cart" noindex={true} path="/cart" />
      <h1 className="text-xl font-bold mb-4" data-testid="text-cart-title">
        Cart ({cart?.itemCount || 0})
      </h1>

      <div className="space-y-4">
        <Card className="p-4 divide-y">
          {items.map((item) => (
            <CartItemRow
              key={item.id}
              item={item}
              onRemove={() => removeMutation.mutate(item.id)}
              onUpdateQty={(qty) => updateMutation.mutate({ id: item.id, quantity: qty })}
            />
          ))}
        </Card>

        {cart && cart.discount > 0 && (
          <Card className="p-3 bg-primary/5 dark:bg-primary/10 border-primary/20">
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-primary shrink-0" />
              <p className="text-sm font-medium" data-testid="text-discount-applied">
                You saved ₹{cart.discount.toLocaleString("en-IN")}!
              </p>
            </div>
          </Card>
        )}

        <Card className="p-4 space-y-3">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Subtotal</span>
              <span data-testid="text-subtotal">₹{cart?.subtotal.toLocaleString("en-IN")}</span>
            </div>
            {cart && cart.discount > 0 && (
              <div className="flex justify-between gap-4 text-primary">
                <span>Discount</span>
                <span data-testid="text-discount">-₹{cart.discount.toLocaleString("en-IN")}</span>
              </div>
            )}
            <div className="flex justify-between gap-4 text-muted-foreground">
              <span>Shipping</span>
              <span className="text-primary font-medium">Free</span>
            </div>
            <Separator />
            <div className="flex justify-between gap-4 font-semibold text-lg">
              <span>Total</span>
              <span data-testid="text-total">₹{cart?.total.toLocaleString("en-IN")}</span>
            </div>
          </div>

          <Link href="/checkout">
            <Button className="w-full" size="lg" data-testid="button-checkout">
              Checkout <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </Card>

        {cart && cart.itemCount < 3 && (
          <Card className="p-3 text-sm text-muted-foreground">
            <p>Add {3 - cart.itemCount} more item{3 - cart.itemCount > 1 ? "s" : ""} to unlock Buy 2 Get 1 Free!</p>
          </Card>
        )}
      </div>
    </div>
  );
}
