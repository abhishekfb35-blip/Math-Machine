import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useRef, useEffect } from "react";
import { trackEvent, trackMetaPurchase, trackPurchase } from "@/lib/analytics";
import { getMetaCatalogTrackingIdentity } from "@shared/metaCatalogIds";
import { CheckCircle, Package, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrency } from "@/context/CurrencyContext";
import type { Order, OrderItem } from "@shared/types";

interface OrderWithItems extends Order {
  items: OrderItem[];
}

export default function OrderConfirmation() {
  const { id } = useParams<{ id: string }>();
  const { formatPrice } = useCurrency();

  const { data: order, isLoading } = useQuery<OrderWithItems>({
    queryKey: ["/api/orders", id],
  });

  const analyticsPurchaseTrackedRef = useRef(false);
  const metaPurchaseTrackedOrderIdsRef = useRef(new Set<string>());
  useEffect(() => {
    if (!order) return;
    const items = order.items.map((item) => {
      const metaIdentity = getMetaCatalogTrackingIdentity(
        item.productId,
        item.selectedSize,
        item.selectedColor,
      );
      return {
        id: item.productId,
        name: item.productName,
        price: item.productPrice,
        quantity: item.quantity,
        metaId: metaIdentity.id,
        metaContentType: metaIdentity.contentType,
      };
    });
    const currency = order.currency ?? "INR";

    if (!analyticsPurchaseTrackedRef.current) {
      analyticsPurchaseTrackedRef.current = true;
      const purchaseTracked = trackPurchase(order.id, order.total, items, currency);
      if (purchaseTracked) {
        const paymentMethod =
          order.paymentStatus === "cod"
            ? "cod"
            : order.paymentStatus === "paid" || order.paymentId || order.razorpayOrderId
              ? "online"
              : "other";
        trackEvent("order_completed", {
          value: order.total,
          currency,
          item_count: order.items.reduce((count, item) => count + item.quantity, 0),
          payment_method: paymentMethod,
        });
      }
    }

    const status = order.status?.toLowerCase();
    const isConfirmed = ["confirmed", "processing", "shipped", "delivered"].includes(status ?? "");
    if (isConfirmed && !metaPurchaseTrackedOrderIdsRef.current.has(order.id)) {
      if (trackMetaPurchase(order.id, order.total, items, currency)) {
        metaPurchaseTrackedOrderIdsRef.current.add(order.id);
      }
    }
  }, [order]);

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-16 w-16 rounded-full mx-auto" />
        <Skeleton className="h-8 w-64 mx-auto" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-bold">Order not found</h1>
        <Link href="/">
          <Button>Back to Home</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-8">
      <div className="text-center space-y-4 mb-8">
        <CheckCircle className="w-16 h-16 text-primary mx-auto" />
        <h1 className="text-2xl md:text-3xl font-bold" data-testid="text-order-confirmed">Order Confirmed!</h1>
        <p className="text-muted-foreground" data-testid="text-order-id">Order #{order.id}</p>
        <p className="text-sm text-muted-foreground">
          Thank you for your order. We will contact you via WhatsApp or phone for order updates.
        </p>
      </div>

      <div className="space-y-4">
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold flex items-center gap-2">
            <Package className="w-4 h-4" /> Order Items
          </h2>
          <div className="space-y-3">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between gap-4 text-sm" data-testid={`order-item-${item.id}`}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{item.productName}</p>
                  {(item.selectedSize || item.selectedColor) && (
                    item.selectedColor?.includes(" · ") ? (
                      <div className="space-y-0.5">
                        {item.selectedColor.split(" · ").map((line, i) => (
                          <p key={i} className="text-xs text-muted-foreground">{line}</p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">{[item.selectedSize, item.selectedColor].filter(Boolean).join(" · ")}</p>
                    )
                  )}
                  {item.personalizationName && (
                    item.personalizationName.includes(" & ") ? (
                      <div className="space-y-0.5">
                        {item.personalizationName.split(" & ").map((line, i) => (
                          <p key={i} className="text-xs text-muted-foreground">{line}</p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Name: {item.personalizationName}</p>
                    )
                  )}
                  {item.isFree && (
                    <span className="text-xs text-primary font-medium">FREE (Offer applied)</span>
                  )}
                </div>
                <p className={`shrink-0 ${item.isFree ? "line-through text-muted-foreground" : ""}`}>
                  {formatPrice(item.productPrice)}
                </p>
              </div>
            ))}
          </div>
          <Separator />
          <div className="space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatPrice(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between gap-4 text-primary">
                <span>Discount</span>
                <span>-{formatPrice(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between gap-4 text-muted-foreground">
              <span>Shipping</span>
              {order.shippingFee > 0
                ? <span>{formatPrice(order.shippingFee)}</span>
                : <span className="text-primary font-medium">Free</span>}
            </div>
            <Separator />
            <div className="flex justify-between gap-4 font-semibold text-base">
              <span>Total</span>
              <span data-testid="text-order-total">{formatPrice(order.total)}</span>
            </div>
            {order.currency && order.currency !== "INR" && (
              <p className="text-xs text-muted-foreground text-right">Charged in {order.currency} at time of order</p>
            )}
          </div>
        </Card>

        <Card className="p-4 space-y-2 text-sm">
          <h2 className="font-semibold">Shipping Details</h2>
          <p>{order.customerName}</p>
          <p>{order.shippingAddress}</p>
          <p>{order.shippingCity}, {order.shippingState} - {order.shippingPincode}</p>
          <p>Phone: {order.customerPhone}</p>
          <p>Email: {order.customerEmail}</p>
          {order.notes && <p className="text-muted-foreground">Notes: {order.notes}</p>}
          <Separator />
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Payment</span>
            <span className="font-medium" data-testid="text-payment-status">
              {order.paymentStatus === "paid" ? "Paid Online" : order.paymentStatus === "cod" ? "Cash on Delivery" : order.paymentStatus}
            </span>
          </div>
        </Card>

        <div className="text-center pt-4">
          <Link href="/">
            <Button size="lg" data-testid="button-continue-shopping">
              Continue Shopping <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
