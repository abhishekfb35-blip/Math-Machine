import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Package, ShoppingCart, Layout, FileText, Shield, History, Download, LogOut, Image, Gift, GitCompare, Globe, Users, Tag, Mail, CheckCircle2 } from "lucide-react";
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
  },
  {
    title: "Orders",
    description: "View and manage customer orders",
    href: "/admin/orders",
    icon: ShoppingCart,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
  },
  {
    title: "Page Builder",
    description: "Edit homepage layout and collections",
    href: "/admin/builder",
    icon: Layout,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-950/30",
  },
  {
    title: "Policy Pages",
    description: "Edit terms, privacy, refund, and shipping pages",
    href: "/admin/pages",
    icon: FileText,
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/30",
  },
  {
    title: "Brand Assets",
    description: "Upload and manage brand logos",
    href: "/admin/brand",
    icon: Image,
    color: "text-pink-600 dark:text-pink-400",
    bg: "bg-pink-50 dark:bg-pink-950/30",
  },
  {
    title: "Consent & Offers",
    description: "Manage popup settings and view signups",
    href: "/admin/consent",
    icon: Gift,
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-950/30",
  },
  {
    title: "Health Checks",
    description: "Deploy, data, and SEO audits",
    href: "/admin/checks",
    icon: Shield,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/30",
  },
  {
    title: "Audit Log",
    description: "Track all admin changes",
    href: "/admin/audit-log",
    icon: History,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30",
  },
  {
    title: "Export Data",
    description: "Download database exports",
    href: "/admin/export",
    icon: Download,
    color: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-50 dark:bg-cyan-950/30",
  },
  {
    title: "DB Compare",
    description: "Compare dev vs prod catalog tables",
    href: "/admin/db-compare",
    icon: GitCompare,
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-950/30",
  },
  {
    title: "International Pricing",
    description: "Manage exchange rates and multi-currency rules",
    href: "/admin/pricing",
    icon: Globe,
    color: "text-teal-600 dark:text-teal-400",
    bg: "bg-teal-50 dark:bg-teal-950/30",
  },
  {
    title: "Customers",
    description: "View registered users and their buying history",
    href: "/admin/customers",
    icon: Users,
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-50 dark:bg-indigo-950/30",
  },
  {
    title: "Offers & Delivery",
    description: "Configure promotional offer tiers and domestic delivery fees",
    href: "/admin/offers",
    icon: Tag,
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/30",
  },
];

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const [bccInput, setBccInput] = useState("");
  const [bccSaved, setBccSaved] = useState(false);

  const handleLogout = async () => {
    await apiRequest("POST", "/api/admin/logout");
    setLocation("/admin");
    window.location.reload();
  };

  useQuery({
    queryKey: ["/api/site-config/notification-bcc-email"],
    queryFn: async () => {
      const res = await fetch("/api/site-config/notification-bcc-email");
      if (!res.ok) return null;
      const data = await res.json();
      const val = typeof data.value === "string" ? data.value : "";
      setBccInput(val);
      return val;
    },
  });

  const saveBcc = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/site-config/notification-bcc-email", { value: bccInput.trim() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/site-config/notification-bcc-email"] });
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
        {sections.map((section) => (
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
          <h2 className="font-semibold text-sm">Email Monitoring</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          All outgoing emails (order confirmations, status updates, welcome coupons) will be BCC'd to this address. OTP emails are excluded. Separate multiple addresses with commas.
        </p>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="monitor@example.com"
            value={bccInput}
            onChange={e => { setBccInput(e.target.value); setBccSaved(false); }}
            onKeyDown={e => e.key === "Enter" && saveBcc.mutate()}
            className="text-sm font-mono"
            data-testid="input-bcc-email"
          />
          <Button
            onClick={() => saveBcc.mutate()}
            disabled={saveBcc.isPending}
            variant="outline"
            data-testid="button-save-bcc-email"
          >
            {bccSaved
              ? <><CheckCircle2 className="w-4 h-4 mr-1 text-green-500" /> Saved</>
              : saveBcc.isPending ? "Saving…" : "Save"
            }
          </Button>
        </div>
        {bccInput.trim() === "" && (
          <p className="text-xs text-muted-foreground mt-2">No monitoring address set — emails go only to the recipient.</p>
        )}
      </div>
    </div>
  );
}
