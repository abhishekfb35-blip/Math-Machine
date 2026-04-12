import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { User, Package, MapPin, LogOut, ChevronRight, Loader2, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/context/CurrencyContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Order, OrderItem } from "@shared/types";

interface OrderWithItems extends Order {
  items: OrderItem[];
}

export default function AccountPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { customer, isLoading, isAuthenticated, logout } = useAuth();
  const { formatPrice } = useCurrency();
  const [tab, setTab] = useState<"profile" | "orders">("profile");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (customer) {
      setName(customer.name || "");
      setPhone(customer.phone || "");
      setAddress(customer.shippingAddress || "");
      setCity(customer.shippingCity || "");
      setState(customer.shippingState || "");
      setPincode(customer.shippingPincode || "");
    }
  }, [customer]);

  const { data: orders, isLoading: ordersLoading } = useQuery<OrderWithItems[]>({
    queryKey: ["/api/auth/orders"],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/signin");
    }
  }, [isLoading, isAuthenticated, navigate]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiRequest("PATCH", "/api/auth/profile", {
        name, phone, shippingAddress: address, shippingCity: city, shippingState: state, shippingPincode: pincode,
      });
      const updated = await res.json();
      queryClient.setQueryData(["/api/auth/me"], updated);
      toast({ title: "Profile saved" });
    } catch (err: any) {
      toast({ title: "Error", description: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!customer) return null;

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    shipped: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    delivered: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" data-testid="text-account-title">My Account</h1>
          <p className="text-sm text-muted-foreground">{customer.email}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="button-logout">
          <LogOut className="w-4 h-4 mr-2" /> Sign Out
        </Button>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        <Button
          variant={tab === "profile" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("profile")}
          data-testid="button-tab-profile"
        >
          <User className="w-4 h-4 mr-1" /> Profile
        </Button>
        <Button
          variant={tab === "orders" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("orders")}
          data-testid="button-tab-orders"
        >
          <Package className="w-4 h-4 mr-1" /> Orders
        </Button>
        <Link href="/wishlist">
          <Button variant="outline" size="sm" data-testid="button-go-wishlist">
            <Heart className="w-4 h-4 mr-1" /> Wishlist
          </Button>
        </Link>
      </div>

      {tab === "profile" ? (
        <Card className="p-5">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" data-testid="input-profile-name" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit phone number" data-testid="input-profile-phone" />
            </div>

            <Separator />
            <div className="flex items-center gap-2 text-sm font-medium">
              <MapPin className="w-4 h-4" /> Saved Address
            </div>

            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House no., street, area" data-testid="input-profile-address" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" data-testid="input-profile-city" />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="State" data-testid="input-profile-state" />
              </div>
              <div className="space-y-2">
                <Label>Pincode</Label>
                <Input value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="Pincode" maxLength={6} data-testid="input-profile-pincode" />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={saving} data-testid="button-save-profile">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Profile
            </Button>
          </form>
        </Card>
      ) : (
        <div className="space-y-3">
          {ordersLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
          ) : !orders || orders.length === 0 ? (
            <Card className="p-8 text-center">
              <Package className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium mb-1">No orders yet</p>
              <p className="text-sm text-muted-foreground mb-4">When you place an order, it'll show up here.</p>
              <Link href="/shop">
                <Button size="sm">Start Shopping</Button>
              </Link>
            </Card>
          ) : (
            orders.map((order) => (
              <Link key={order.id} href={`/order/${order.id}`}>
                <Card className="p-4 cursor-pointer hover:bg-muted/50 transition-colors" data-testid={`order-card-${order.id}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">#{order.id.slice(-8).toUpperCase()}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[order.status] || "bg-muted"}`}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{order.items.length} item{order.items.length !== 1 ? "s" : ""}</span>
                    <span className="font-medium text-foreground">{formatPrice(order.total)}</span>
                  </div>
                  {order.createdAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  )}
                </Card>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
