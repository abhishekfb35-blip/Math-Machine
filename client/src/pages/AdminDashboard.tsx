import { Link, useLocation } from "wouter";
import { Package, ShoppingCart, Layout, FileText, Shield, History, Download, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";

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
];

export default function AdminDashboard() {
  const [, setLocation] = useLocation();

  const handleLogout = async () => {
    await apiRequest("POST", "/api/admin/logout");
    setLocation("/admin");
    window.location.reload();
  };

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
    </div>
  );
}
