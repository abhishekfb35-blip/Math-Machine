import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ArrowLeft, Search, ChevronLeft, ChevronRight, Edit2, X, Save, Loader2,
  ShoppingBag, Mail, Phone, MapPin, User, Calendar, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Customer, Order } from "@shared/types";

interface CustomersResponse {
  customers: Customer[];
  total: number;
  page: number;
  totalPages: number;
}

interface CustomerDetailResponse {
  customer: Customer;
  orderSummary: { orderCount: number; totalSpent: number; lastOrderAt: Date | null };
  orders: Order[];
}

interface EditForm {
  name: string;
  phone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingPincode: string;
}

function formatDate(d: Date | string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function CustomerEditDrawer({
  customerId,
  onClose,
}: {
  customerId: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<EditForm | null>(null);

  const { data, isLoading } = useQuery<CustomerDetailResponse>({
    queryKey: ["/api/admin/customers", customerId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/customers/${customerId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load customer");
      return res.json();
    },
  });

  useEffect(() => {
    if (data && !form) {
      setForm({
        name: data.customer.name ?? "",
        phone: data.customer.phone ?? "",
        shippingAddress: data.customer.shippingAddress ?? "",
        shippingCity: data.customer.shippingCity ?? "",
        shippingState: data.customer.shippingState ?? "",
        shippingPincode: data.customer.shippingPincode ?? "",
      });
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: (payload: EditForm) =>
      apiRequest("PATCH", `/api/admin/customers/${customerId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      toast({ title: "Customer updated successfully" });
      onClose();
    },
    onError: () => {
      toast({ title: "Failed to update customer", variant: "destructive" });
    },
  });

  const customer = data?.customer;
  const summary = data?.orderSummary;
  const orders = data?.orders ?? [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" data-testid="drawer-customer-edit">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-background h-full overflow-y-auto shadow-xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-background z-10">
          <h2 className="font-semibold text-base" data-testid="text-drawer-title">Customer Details</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted" data-testid="button-close-drawer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {customer && form && (
          <div className="p-4 space-y-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                {customer.avatarUrl ? (
                  <img src={customer.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <User className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="font-medium text-sm" data-testid="text-customer-name">{customer.name || "—"}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Mail className="w-3 h-3" /> {customer.email}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Joined {formatDate(customer.createdAt)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/50 rounded-lg p-3 text-center" data-testid="stat-order-count">
                <p className="text-lg font-bold">{summary?.orderCount ?? 0}</p>
                <p className="text-xs text-muted-foreground">Orders</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center" data-testid="stat-total-spent">
                <p className="text-lg font-bold">{formatCurrency(summary?.totalSpent ?? 0)}</p>
                <p className="text-xs text-muted-foreground">Total Spent</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center" data-testid="stat-last-order">
                <p className="text-sm font-bold">{formatDate(summary?.lastOrderAt ?? null)}</p>
                <p className="text-xs text-muted-foreground">Last Order</p>
              </div>
            </div>

            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Edit Information</h3>

              <div className="space-y-2">
                <label className="text-xs font-medium">Full Name</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Full name"
                  data-testid="input-customer-name"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium">Phone</label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="Phone number"
                  data-testid="input-customer-phone"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium">Address</label>
                <Input
                  value={form.shippingAddress}
                  onChange={(e) => setForm({ ...form, shippingAddress: e.target.value })}
                  placeholder="Street address"
                  data-testid="input-customer-address"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <label className="text-xs font-medium">City</label>
                  <Input
                    value={form.shippingCity}
                    onChange={(e) => setForm({ ...form, shippingCity: e.target.value })}
                    placeholder="City"
                    data-testid="input-customer-city"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">State</label>
                  <Input
                    value={form.shippingState}
                    onChange={(e) => setForm({ ...form, shippingState: e.target.value })}
                    placeholder="State"
                    data-testid="input-customer-state"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium">Pincode</label>
                <Input
                  value={form.shippingPincode}
                  onChange={(e) => setForm({ ...form, shippingPincode: e.target.value })}
                  placeholder="PIN code"
                  data-testid="input-customer-pincode"
                />
              </div>

              <Button
                className="w-full"
                onClick={() => mutation.mutate(form)}
                disabled={mutation.isPending}
                data-testid="button-save-customer"
              >
                {mutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="w-4 h-4 mr-2" /> Save Changes</>
                )}
              </Button>
            </div>

            {orders.length > 0 && (
              <div className="border rounded-lg p-4 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Order History</h3>
                <div className="space-y-2">
                  {orders
                    .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
                    .map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between text-sm py-2 border-b last:border-0"
                        data-testid={`row-order-${order.id}`}
                      >
                        <div>
                          <Link href={`/admin/orders`}>
                            <span className="font-mono text-xs text-muted-foreground hover:underline cursor-pointer">
                              #{order.id.slice(-8).toUpperCase()}
                            </span>
                          </Link>
                          <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-sm">{formatCurrency(order.total)}</p>
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0"
                            data-testid={`badge-order-status-${order.id}`}
                          >
                            {order.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminCustomers() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<CustomersResponse>({
    queryKey: ["/api/admin/customers", page, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/customers?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const customerList = data?.customers ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-24" data-testid="page-admin-customers">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin">
          <Button variant="ghost" size="sm" data-testid="button-back-admin">
            <ArrowLeft className="w-4 h-4 mr-1" /> Admin
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold" data-testid="text-page-title">Customers</h1>
          <p className="text-xs text-muted-foreground">{total} registered {total === 1 ? "user" : "users"}</p>
        </div>
      </div>

      <div className="flex gap-2 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, email, or phone…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            data-testid="input-search-customers"
          />
        </div>
        <Button onClick={handleSearch} data-testid="button-search-customers">Search</Button>
        {search && (
          <Button
            variant="ghost"
            onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }}
            data-testid="button-clear-search"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && customerList.length === 0 && (
        <div className="text-center py-16 text-muted-foreground" data-testid="text-no-customers">
          <User className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{search ? "No customers found for this search." : "No registered customers yet."}</p>
        </div>
      )}

      {!isLoading && customerList.length > 0 && (
        <div className="space-y-2">
          {customerList.map((customer) => (
            <Card
              key={customer.id}
              className="p-4 flex items-center gap-4"
              data-testid={`card-customer-${customer.id}`}
            >
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                {customer.avatarUrl ? (
                  <img src={customer.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <User className="w-4 h-4 text-muted-foreground" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate" data-testid={`text-name-${customer.id}`}>
                  {customer.name || <span className="text-muted-foreground italic">No name</span>}
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                  <span className="text-xs text-muted-foreground flex items-center gap-1" data-testid={`text-email-${customer.id}`}>
                    <Mail className="w-3 h-3" /> {customer.email}
                  </span>
                  {customer.phone && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1" data-testid={`text-phone-${customer.id}`}>
                      <Phone className="w-3 h-3" /> {customer.phone}
                    </span>
                  )}
                  {customer.shippingCity && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {customer.shippingCity}{customer.shippingState ? `, ${customer.shippingState}` : ""}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {formatDate(customer.createdAt)}
                  </p>
                  {customer.googleId && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 mt-0.5">Google</Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedId(customer.id)}
                  data-testid={`button-edit-customer-${customer.id}`}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              data-testid="button-next-page"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {selectedId && (
        <CustomerEditDrawer customerId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
