import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ChevronLeft, Search, Package, Truck, CheckCircle, XCircle, Clock,
  MapPin, Phone, Mail, User, StickyNote, ChevronRight, Loader2, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Order, OrderItem } from "@shared/types";

interface OrderWithItems extends Order {
  items: OrderItem[];
}

interface OrderListResponse {
  orders: Order[];
  total: number;
  limit: number;
  offset: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", icon: Clock },
  confirmed: { label: "Confirmed", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", icon: CheckCircle },
  processing: { label: "Processing", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400", icon: Package },
  shipped: { label: "Shipped", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400", icon: Truck },
  delivered: { label: "Delivered", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", icon: XCircle },
};

const STATUSES = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

function formatDate(dateStr: string | Date | null): string {
  if (!dateStr) return "Unknown";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatRelativeDate(dateStr: string | Date | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = config.icon;
  return (
    <Badge className={`${config.color} border-0 gap-1 no-default-hover-elevate no-default-active-elevate`} data-testid={`badge-status-${status}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
}

function OrderDetailView({ orderId, onBack }: { orderId: string; onBack: () => void }) {
  const { toast } = useToast();
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");

  const { data: order, isLoading } = useQuery<OrderWithItems>({
    queryKey: ["/api/admin/orders", orderId],
  });

  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      await apiRequest("PATCH", `/api/admin/orders/${orderId}/status`, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders", orderId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      toast({ title: "Status updated" });
    },
    onError: () => {
      toast({ title: "Failed to update status", variant: "destructive" });
    },
  });

  const notesMutation = useMutation({
    mutationFn: async (notes: string) => {
      await apiRequest("PATCH", `/api/admin/orders/${orderId}/notes`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders", orderId] });
      setEditingNotes(false);
      toast({ title: "Notes saved" });
    },
    onError: () => {
      toast({ title: "Failed to save notes", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-orders">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Orders
        </Button>
        <p className="text-muted-foreground mt-4">Order not found.</p>
      </div>
    );
  }

  const shortId = order.id.slice(-8).toUpperCase();

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-orders">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold" data-testid="text-order-id">Order #{shortId}</h1>
            <p className="text-sm text-muted-foreground">{formatDate(order.createdAt)}</p>
          </div>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
            <User className="w-4 h-4" /> Customer Details
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-muted-foreground" />
              <span data-testid="text-customer-name">{order.customerName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-muted-foreground" />
              <a href={`mailto:${order.customerEmail}`} className="text-blue-600 dark:text-blue-400 hover:underline" data-testid="text-customer-email">{order.customerEmail}</a>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-muted-foreground" />
              <a href={`tel:${order.customerPhone}`} className="text-blue-600 dark:text-blue-400 hover:underline" data-testid="text-customer-phone">{order.customerPhone}</a>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
            <MapPin className="w-4 h-4" /> Shipping Address
          </h3>
          <p className="text-sm leading-relaxed" data-testid="text-shipping-address">
            {order.shippingAddress}<br />
            {order.shippingCity}, {order.shippingState} - {order.shippingPincode}
          </p>
        </Card>
      </div>

      <Card className="p-4 mt-4">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
          <Package className="w-4 h-4" /> Order Items
        </h3>
        <div className="divide-y">
          {order.items.map((item, idx) => (
            <div key={item.id || idx} className="flex items-center justify-between py-3 gap-2" data-testid={`row-order-item-${idx}`}>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate" data-testid={`text-item-name-${idx}`}>{item.productName}</p>
                {(item.selectedSize || item.selectedColor) && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {[item.selectedSize, item.selectedColor].filter(Boolean).join(" · ")}
                  </p>
                )}
                {item.personalizationName && (
                  <p className="text-xs text-muted-foreground mt-0.5">Personalisation: <strong>{item.personalizationName}</strong></p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-muted-foreground">x{item.quantity}</span>
                {item.isFree ? (
                  <div className="text-right">
                    <span className="text-xs line-through text-muted-foreground">{formatCurrency(item.productPrice)}</span>
                    <span className="ml-1 text-xs font-semibold text-green-600">FREE</span>
                  </div>
                ) : (
                  <span className="text-sm font-medium" data-testid={`text-item-price-${idx}`}>{formatCurrency(item.productPrice)}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t pt-3 mt-2 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(order.subtotal)}</span>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Discount (Buy 2 Get 1 Free)</span>
              <span>-{formatCurrency(order.discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Shipping</span>
            <span className="text-green-600 font-medium">FREE</span>
          </div>
          <div className="flex justify-between font-bold text-base pt-2 border-t">
            <span>Total</span>
            <span data-testid="text-order-total">{formatCurrency(order.total)}</span>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 mt-4">
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-3">Update Status</h3>
          <Select
            value={order.status}
            onValueChange={(val) => statusMutation.mutate(val)}
            disabled={statusMutation.isPending}
          >
            <SelectTrigger data-testid="select-order-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map(s => (
                <SelectItem key={s} value={s} data-testid={`option-status-${s}`}>
                  {STATUS_CONFIG[s]?.label || s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {statusMutation.isPending && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Updating...
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Changing to Shipped, Delivered, or Cancelled will notify the customer by email.
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-1.5">
              <StickyNote className="w-4 h-4" /> Internal Notes
            </h3>
            {!editingNotes && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setNotesValue(order.notes || ""); setEditingNotes(true); }}
                data-testid="button-edit-notes"
              >
                Edit
              </Button>
            )}
          </div>
          {editingNotes ? (
            <div className="space-y-2">
              <Textarea
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                placeholder="Add internal notes about this order..."
                rows={3}
                data-testid="input-notes"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => notesMutation.mutate(notesValue)} disabled={notesMutation.isPending} data-testid="button-save-notes">
                  {notesMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                  Save
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditingNotes(false)} data-testid="button-cancel-notes">Cancel</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground whitespace-pre-line" data-testid="text-notes">
              {order.notes || "No notes added."}
            </p>
          )}
        </Card>
      </div>

      <Card className="p-4 mt-4">
        <h3 className="font-semibold text-sm mb-2">Payment Info</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className="text-muted-foreground">Payment Status</span>
          <span className="capitalize">{order.paymentStatus || "Pending"}</span>
          {order.paymentId && (
            <>
              <span className="text-muted-foreground">Payment ID</span>
              <span className="font-mono text-xs">{order.paymentId}</span>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

export default function AdminOrders() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const PAGE_SIZE = 20;
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(0);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchQuery]);

  const queryParams = new URLSearchParams();
  if (statusFilter !== "all") queryParams.set("status", statusFilter);
  if (debouncedSearch) queryParams.set("search", debouncedSearch);
  queryParams.set("limit", String(PAGE_SIZE));
  queryParams.set("offset", String(page * PAGE_SIZE));

  const { data, isLoading, isFetching } = useQuery<OrderListResponse>({
    queryKey: ["/api/admin/orders", statusFilter, debouncedSearch, page],
    queryFn: async () => {
      const res = await fetch(`/api/admin/orders?${queryParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load orders");
      return res.json();
    },
  });

  if (selectedOrderId) {
    return <OrderDetailView orderId={selectedOrderId} onBack={() => setSelectedOrderId(null)} />;
  }

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;
  const statusCounts: Record<string, number> = {};

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Link href="/admin">
            <Button variant="ghost" size="sm" data-testid="button-back-dashboard">
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold" data-testid="text-orders-title">Order Management</h1>
            <p className="text-sm text-muted-foreground">
              {data ? `${data.total} order${data.total !== 1 ? "s" : ""}` : "Loading..."}
            </p>
          </div>
        </div>
        {isFetching && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, phone, or order ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-order-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(0); }}>
          <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUSES.map(s => (
              <SelectItem key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : !data || data.orders.length === 0 ? (
        <Card className="p-8 text-center">
          <Package className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground" data-testid="text-no-orders">
            {debouncedSearch || statusFilter !== "all" ? "No orders match your filters." : "No orders yet."}
          </p>
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            {data.orders.map((order) => {
              const shortId = order.id.slice(-8).toUpperCase();
              return (
                <Card
                  key={order.id}
                  className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => setSelectedOrderId(order.id)}
                  data-testid={`card-order-${order.id}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm" data-testid={`text-order-short-id-${order.id}`}>#{shortId}</span>
                        <StatusBadge status={order.status} />
                      </div>
                      <p className="text-sm text-muted-foreground truncate" data-testid={`text-order-customer-${order.id}`}>
                        {order.customerName} — {order.customerEmail}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatRelativeDate(order.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-sm" data-testid={`text-order-total-${order.id}`}>{formatCurrency(order.total)}</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                data-testid="button-prev-page"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Previous
              </Button>
              <span className="text-sm text-muted-foreground" data-testid="text-page-info">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
                data-testid="button-next-page"
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
