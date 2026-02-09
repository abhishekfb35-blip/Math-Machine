import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { ArrowLeft, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { checkoutSchema, type CheckoutInput } from "@shared/routes";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import type { Product, CartItem } from "@shared/schema";

interface CartData {
  id: number;
  items: (CartItem & { product: Product | null })[];
  itemCount: number;
  subtotal: number;
  discount: number;
  total: number;
}

export default function CheckoutPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: cart, isLoading } = useQuery<CartData>({
    queryKey: ["/api/cart"],
  });

  const form = useForm<CheckoutInput>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      shippingAddress: "",
      shippingCity: "",
      shippingState: "",
      shippingPincode: "",
      notes: "",
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (data: CheckoutInput) => {
      const res = await apiRequest("POST", "/api/checkout", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      navigate(`/order/${data.orderId}`);
    },
    onError: () => {
      toast({
        title: "Checkout failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-bold">Your cart is empty</h1>
        <Link href="/">
          <Button>Continue Shopping</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/cart">
        <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back-to-cart">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Cart
        </Button>
      </Link>

      <h1 className="text-2xl font-bold mb-6" data-testid="text-checkout-title">Checkout</h1>

      <div className="grid md:grid-cols-5 gap-8">
        <div className="md:col-span-3">
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => checkoutMutation.mutate(data))} className="space-y-4">
              <Card className="p-4 space-y-4">
                <h2 className="font-semibold">Contact Information</h2>
                <FormField
                  control={form.control}
                  name="customerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Your full name" {...field} data-testid="input-customer-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="customerEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="your@email.com" {...field} data-testid="input-customer-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="customerPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="10-digit phone number" {...field} data-testid="input-customer-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </Card>

              <Card className="p-4 space-y-4">
                <h2 className="font-semibold">Shipping Address</h2>
                <FormField
                  control={form.control}
                  name="shippingAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input placeholder="House no., street, area" {...field} data-testid="input-shipping-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="shippingCity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="City" {...field} data-testid="input-shipping-city" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="shippingState"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          <Input placeholder="State" {...field} data-testid="input-shipping-state" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="shippingPincode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pincode</FormLabel>
                        <FormControl>
                          <Input placeholder="6-digit pincode" maxLength={6} {...field} data-testid="input-shipping-pincode" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </Card>

              <Card className="p-4 space-y-4">
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order Notes (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Any special instructions..." {...field} data-testid="input-notes" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Card>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={checkoutMutation.isPending}
                data-testid="button-place-order"
              >
                {checkoutMutation.isPending ? "Placing Order..." : `Place Order - ₹${cart.total.toLocaleString("en-IN")}`}
              </Button>
            </form>
          </Form>
        </div>

        <div className="md:col-span-2 space-y-4">
          <Card className="p-4 space-y-3">
            <h2 className="font-semibold">Order Summary</h2>
            <div className="space-y-3">
              {cart.items.filter(i => i.product).map((item) => (
                <div key={item.id} className="flex gap-3" data-testid={`checkout-item-${item.id}`}>
                  <div className="w-12 h-12 rounded overflow-hidden bg-muted shrink-0">
                    <img src={item.product!.imageUrl} alt={item.product!.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium line-clamp-1">{item.product!.name}</p>
                    {item.personalizationName && (
                      <p className="text-xs text-muted-foreground">Name: {item.personalizationName}</p>
                    )}
                    <p className="text-xs text-muted-foreground">Qty: {item.quantity} x ₹{item.product!.price.toLocaleString("en-IN")}</p>
                  </div>
                </div>
              ))}
            </div>
            <Separator />
            <div className="space-y-1 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Subtotal</span>
                <span>₹{cart.subtotal.toLocaleString("en-IN")}</span>
              </div>
              {cart.discount > 0 && (
                <div className="flex justify-between gap-4 text-primary">
                  <span>Discount</span>
                  <span>-₹{cart.discount.toLocaleString("en-IN")}</span>
                </div>
              )}
              <div className="flex justify-between gap-4 text-muted-foreground">
                <span>Shipping</span>
                <span className="text-primary font-medium">Free</span>
              </div>
              <Separator />
              <div className="flex justify-between gap-4 font-semibold text-base">
                <span>Total</span>
                <span data-testid="text-checkout-total">₹{cart.total.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </Card>

          {cart.discount > 0 && (
            <Card className="p-3 bg-primary/5 dark:bg-primary/10 border-primary/20">
              <div className="flex items-center gap-2">
                <Gift className="w-4 h-4 text-primary shrink-0" />
                <p className="text-xs font-medium">You saved ₹{cart.discount.toLocaleString("en-IN")} with our offer!</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
