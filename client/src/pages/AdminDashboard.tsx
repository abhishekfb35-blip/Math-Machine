import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Package, ShoppingCart, Layout, FileText, Shield, History, Download, LogOut, Image, Gift, GitCompare, Globe, Users, Tag, Mail, CheckCircle2, UserCog, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

const sections = [
  {
    title: "Catalog",
    description: "Manage categories, products, and tags",
    href: "/admin/catalog",
    icon: Package,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    permission: "catalog",
  },
  {
    title: "Orders",
    description: "View and manage customer orders",
    href: "/admin/orders",
    icon: ShoppingCart,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    permission: "orders",
  },
  {
    title: "Page Builder",
    description: "Edit homepage layout and collections",
    href: "/admin/builder",
    icon: Layout,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-950/30",
    permission: "builder",
  },
  {
    title: "Policy Pages",
    description: "Edit terms, privacy, refund, and shipping pages",
    href: "/admin/pages",
    icon: FileText,
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    permission: "pages",
  },
  {
    title: "Brand Assets",
    description: "Upload and manage brand logos",
    href: "/admin/brand",
    icon: Image,
    color: "text-pink-600 dark:text-pink-400",
    bg: "bg-pink-50 dark:bg-pink-950/30",
    permission: "brand",
  },
  {
    title: "Consent & Offers",
    description: "Manage popup settings and view signups",
    href: "/admin/consent",
    icon: Gift,
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-950/30",
    permission: "consent",
  },
  {
    title: "Health Checks",
    description: "Deploy, data, and SEO audits",
    href: "/admin/checks",
    icon: Shield,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/30",
    permission: "health",
  },
  {
    title: "Audit Log",
    description: "Track all admin changes",
    href: "/admin/audit-log",
    icon: History,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    permission: "audit",
  },
  {
    title: "Export Data",
    description: "Download database exports",
    href: "/admin/export",
    icon: Download,
    color: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-50 dark:bg-cyan-950/30",
    permission: "export",
  },
  {
    title: "DB Compare",
    description: "Compare dev vs prod catalog tables",
    href: "/admin/db-compare",
    icon: GitCompare,
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-950/30",
    permission: "health",
  },
  {
    title: "International Pricing",
    description: "Manage exchange rates and multi-currency rules",
    href: "/admin/pricing",
    icon: Globe,
    color: "text-teal-600 dark:text-teal-400",
    bg: "bg-teal-50 dark:bg-teal-950/30",
    permission: "pricing",
  },
  {
    title: "Customers",
    description: "View registered users and their buying history",
    href: "/admin/customers",
    icon: Users,
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-50 dark:bg-indigo-950/30",
    permission: "customers",
  },
  {
    title: "Offers & Delivery",
    description: "Configure promotional offer tiers and domestic delivery fees",
    href: "/admin/offers",
    icon: Tag,
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    permission: "offers",
  },
];

const superAdminSections = [
  {
    title: "Admin Users",
    description: "Manage sub-admin accounts and permissions",
    href: "/admin/users",
    icon: UserCog,
    color: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-50 dark:bg-slate-950/30",
  },
  {
    title: "Security",
    description: "Rate limiting, API protection, and data cleanup",
    href: "/admin/security",
    icon: Lock,
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-950/30",
  },
];

export default function AdminDashboard() {
  const [, setLocation] = useLocation();

  const { data: authData } = useQuery<{ authenticated: boolean; isSuperAdmin: boolean; permissions: string[] }>({
    queryKey: ["/api/admin/check"],
    staleTime: 5 * 60 * 1000,
  });
  const BCC_TYPES = [
    { key: "order-placed",    label: "New order placed",           hint: "Customer confirmation + admin alert" },
    { key: "order-confirmed", label: "Order confirmed",            hint: "Crafting starts email" },
    { key: "order-shipped",   label: "Order shipped",              hint: "" },
    { key: "order-delivered", label: "Order delivered",            hint: "" },
    { key: "order-cancelled", label: "Order cancelled",            hint: "" },
    { key: "welcome-coupon",  label: "Welcome coupon",             hint: "Consent popup opt-in email" },
    { key: "abandoned-cart",  label: "Abandoned cart",             hint: "2-hour recovery nudge for logged-in customers" },
  ] as const;

  type BccTypeKey = typeof BCC_TYPES[number]["key"];

  const [bccInput, setBccInput] = useState("");
  const [bccTypes, setBccTypes] = useState<Record<BccTypeKey, boolean>>({
    "order-placed": false,
    "order-confirmed": false,
    "order-shipped": false,
    "order-delivered": false,
    "order-cancelled": false,
    "welcome-coupon": false,
    "abandoned-cart": false,
  });
  const [bccSaved, setBccSaved] = useState(false);

  const handleLogout = async () => {
    await apiRequest("POST", "/api/admin/logout");
    setLocation("/admin");
    window.location.reload();
  };

  useQuery({
    queryKey: ["/api/site-config/notification-bcc-config"],
    queryFn: async () => {
      const res = await fetch("/api/site-config/notification-bcc-config");
      if (!res.ok) return null;
      const data = await res.json();
      const raw = (typeof data.value === "string" ? data.value : "").replace(/^"|"$/g, "").trim();
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as { email?: string; types?: Record<string, boolean> };
        setBccInput(parsed.email ?? "");
        if (parsed.types) {
          setBccTypes(prev => ({ ...prev, ...parsed.types } as Record<BccTypeKey, boolean>));
        }
      } catch { /* ignore malformed */ }
      return raw;
    },
  });

  const anyTypeChecked = Object.values(bccTypes).some(Boolean);
  const bccError = bccInput.trim() !== "" && !anyTypeChecked
    ? "Select at least one email type to monitor."
    : null;

  const saveBcc = useMutation({
    mutationFn: async () => {
      if (bccError) return;
      const payload = JSON.stringify({ email: bccInput.trim(), types: bccTypes });
      await apiRequest("POST", "/api/site-config/notification-bcc-config", { value: payload });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/site-config/notification-bcc-config"] });
      setBccSaved(true);
      setTimeout(() => setBccSaved(false), 3000);
    },
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-24" data-testid="page-admin-dashboard">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your store</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="button-logout">
          <LogOut className="w-4 h-4 mr-1" /> Logout
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...sections.filter(s => authData?.isSuperAdmin || (authData?.permissions ?? []).includes(s.permission)), ...(authData?.isSuperAdmin ? superAdminSections : [])].map((section) => (
          <Link key={section.href} href={section.href}>
            <Card
              className="p-5 cursor-pointer hover:shadow-md transition-shadow h-full"
              data-testid={`card-admin-${section.title.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-lg ${section.bg} shrink-0`}>
                  <section.icon className={`w-5 h-5 ${section.color}`} />
                </div>
                <div>
                  <h2 className="font-semibold text-sm">{section.title}</h2>
                  <p className="text-xs text-muted-foreground mt-1">{section.description}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-8 border rounded-lg p-5" data-testid="section-email-monitoring">
        <div className="flex items-center gap-2 mb-1">
          <Mail className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Email Monitoring (BCC)</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Enter a monitoring address and choose which email types to watch. Matching emails will be silently BCC'd. OTP codes are always excluded.
        </p>

        <div className="flex gap-2 mb-5">
          <Input
            type="text"
            placeholder="monitor@example.com"
            value={bccInput}
            onChange={e => { setBccInput(e.target.value); setBccSaved(false); }}
            className="text-sm font-mono"
            data-testid="input-bcc-email"
          />
          <Button
            onClick={() => saveBcc.mutate()}
            disabled={saveBcc.isPending || !!bccError}
            variant="outline"
            data-testid="button-save-bcc-email"
          >
            {bccSaved
              ? <><CheckCircle2 className="w-4 h-4 mr-1 text-green-500" /> Saved</>
              : saveBcc.isPending ? "Saving…" : "Save"
            }
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {BCC_TYPES.map(({ key, label, hint }) => (
            <label
              key={key}
              className="flex items-start gap-2.5 cursor-pointer select-none group"
              data-testid={`label-bcc-type-${key}`}
            >
              <input
                type="checkbox"
                checked={bccTypes[key]}
                onChange={e => { setBccTypes(prev => ({ ...prev, [key]: e.target.checked })); setBccSaved(false); }}
                className="mt-0.5 h-4 w-4 rounded border border-input accent-foreground cursor-pointer"
                data-testid={`checkbox-bcc-type-${key}`}
              />
              <span className="text-sm leading-tight">
                {label}
                {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
              </span>
            </label>
          ))}
        </div>

        {bccError && (
          <p className="text-xs text-destructive mt-3" data-testid="text-bcc-error">{bccError}</p>
        )}
        {!bccError && bccInput.trim() === "" && (
          <p className="text-xs text-muted-foreground mt-3">No monitoring address set — BCC will not be sent regardless of the selections above.</p>
        )}
      </div>
    </div>
  );
}
