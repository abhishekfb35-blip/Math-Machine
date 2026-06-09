import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Trash2, Minus, Plus, ShoppingBag, ArrowRight, Gift, Tag } from "lucide-react";
import SEO from "@/components/SEO";
import NudgeCard from "@/components/NudgeCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getProductImageUrl } from "@/lib/imageUtils";
import { useCurrency } from "@/context/CurrencyContext";
import type { Product, CartItem } from "@shared/types";

interface CartItemWithProduct extends CartItem {
  product: Product | null;
  effectivePrice?: number;
  originalEffectivePrice?: number;
  isFreeItem?: boolean;
  bonusDiscountPct?: number;
}

interface CartData {
  id: string;
  items: CartItemWithProduct[];
  itemCount: number;
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  engineThresholds: {
    retailFreeItemTrigger: number;
    retailBonusDiscountPct: number;
    wholesaleThreshold: number;
  } | null;
}

function CartItemRow({ item, onRemove, onUpdateQty, formatPrice }: {
  item: CartItemWithProduct;
  onRemove: () => void;
  onUpdateQty: (qty: number) => void;
  formatPrice: (n: number) => string;
}) {
  if (!item.product) return null;

  const originalPrice = item.originalEffectivePrice ?? item.product.price;
  const effective = item.effectivePrice ?? item.product.price;

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
        <div className="flex items-start gap-1.5 flex-wrap">
          <Link href={`/product/${item.product.slug}`}>
            <h3 className="text-sm font-medium leading-tight line-clamp-2 hover:text-primary transition-colors cursor-pointer" data-testid={`text-cart-item-name-${item.id}`}>
              {item.product.name}
            </h3>
          </Link>
          {item.isFreeItem && (
            <span className="text-[10px] font-extrabold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full uppercase tracking-wide shrink-0">Free Gift</span>
          )}
        </div>
        {(item.selectedSize || item.selectedColor) && (
          item.selectedColor?.includes(" · ") ? (
            <div className="space-y-0.5" data-testid={`text-variant-${item.id}`}>
              {item.selectedColor.split(" · ").map((line, i) => (
                <p key={i} className="text-xs text-muted-foreground">{line}</p>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground" data-testid={`text-variant-${item.id}`}>
              {[item.selectedSize, item.selectedColor].filter(Boolean).join(" · ")}
            </p>
          )
        )}
        {item.personalizationName && (
          item.personalizationName.includes(" & ") ? (
            <div className="space-y-0.5" data-testid={`text-personalization-${item.id}`}>
              {item.personalizationName.split(" & ").map((line, i) => (
                <p key={i} className="text-xs text-muted-foreground">{line}</p>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground" data-testid={`text-personalization-${item.id}`}>
              Embroidered: {item.personalizationName}
            </p>
          )
        )}

        {item.isFreeItem ? (
          <p className="text-sm font-bold text-green-600" data-testid={`text-cart-item-price-${item.id}`}>FREE</p>
        ) : (
          <p className="text-sm font-bold text-primary" data-testid={`text-cart-item-price-${item.id}`}>
            {formatPrice(effective * item.quantity)}
          </p>
        )}

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
  const { formatPrice, currency } = useCurrency();
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
      <div className="max-w-3xl mx-auto px-4 py-16 space-y-6 pb-24 md:pb-16">
        <div className="text-center space-y-4">
          <ShoppingBag className="w-16 h-16 mx-auto text-muted-foreground" />
          <h1 className="text-2xl font-bold" data-testid="text-empty-cart">Your cart is empty</h1>
          <p className="text-muted-foreground">Add some personalised towels and blankets!</p>
          <Link href="/shop">
            <Button data-testid="button-continue-shopping">Start Shopping</Button>
          </Link>
        </div>
        {cart?.engineThresholds && (
          <NudgeCard
            itemCount={0}
            engineThresholds={cart.engineThresholds}
            showTeaser
          />
        )}
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
              formatPrice={formatPrice}
            />
          ))}
        </Card>

        {cart && cart.discount > 0 && (
          <Card className="p-3 bg-primary/5 dark:bg-primary/10 border-primary/20">
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-primary shrink-0" />
              <p className="text-sm font-medium" data-testid="text-discount-applied">
                You saved {formatPrice(cart.discount)}!
              </p>
            </div>
          </Card>
        )}

        {cart && cart.engineThresholds && (
          <NudgeCard
            itemCount={cart.itemCount}
            engineThresholds={cart.engineThresholds}
          />
        )}

        <Card className="p-4 space-y-3">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Subtotal</span>
              <span data-testid="text-subtotal">{cart ? formatPrice(cart.subtotal) : "—"}</span>
            </div>
            {cart && cart.discount > 0 && (() => {
              const hasFree = items.some(i => i.isFreeItem);
              const bonusPct = items.find(i => i.bonusDiscountPct && i.bonusDiscountPct > 0)?.bonusDiscountPct;
              const discountLabel = hasFree
                ? `Buy ${cart.engineThresholds?.retailFreeItemTrigger ?? 2} Get 1 Free`
                : bonusPct
                  ? `${bonusPct}% Discount`
                  : "Discount";
              return (
                <div className="flex justify-between gap-4 text-green-600">
                  <span>{discountLabel}</span>
                  <span data-testid="text-discount">−{formatPrice(cart.discount)}</span>
                </div>
              );
            })()}
            <div className="flex justify-between gap-4 text-muted-foreground">
              <span>Delivery</span>
              {cart && cart.shippingFee > 0 ? (
                <span data-testid="text-shipping-fee">{formatPrice(cart.shippingFee)}</span>
              ) : (
                <span className="text-primary font-medium" data-testid="text-shipping-free">Free Delivery</span>
              )}
            </div>
            <Separator />
            <div className="flex justify-between gap-4 font-semibold text-lg">
              <span>Total</span>
              <span data-testid="text-total">{cart ? formatPrice(cart.total) : "—"}</span>
            </div>
            {currency !== "INR" && (
              <p className="text-xs text-muted-foreground text-right">Charged in {currency} at current exchange rate.</p>
            )}
          </div>

          <Link href="/checkout">
            <Button className="w-full" size="lg" data-testid="button-checkout">
              Checkout <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}
