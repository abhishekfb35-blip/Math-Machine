import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChevronLeft, Download, Database, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface TableCounts {
  tables: Record<string, number>;
}

function downloadFile(url: string, fallbackName: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = fallbackName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export default function AdminExport() {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState<string | null>(null);

  const { data, isLoading } = useQuery<TableCounts>({
    queryKey: ["/api/admin/export/tables"],
  });

  const handleDownloadSQL = async () => {
    setDownloading("sql");
    try {
      const res = await fetch("/api/admin/export/sql", { credentials: "include" });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const disposition = res.headers.get("Content-Disposition");
      const filename = disposition?.match(/filename="(.+)"/)?.[1] || "turtlelittle_backup.sql";
      downloadFile(url, filename);
      URL.revokeObjectURL(url);
      toast({ title: "Download started", description: "Full database backup is downloading." });
    } catch {
      toast({ title: "Download failed", description: "Could not export database.", variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadCSV = async (table: string) => {
    setDownloading(table);
    try {
      const res = await fetch(`/api/admin/export/csv/${table}`, { credentials: "include" });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const disposition = res.headers.get("Content-Disposition");
      const filename = disposition?.match(/filename="(.+)"/)?.[1] || `${table}.csv`;
      downloadFile(url, filename);
      URL.revokeObjectURL(url);
      toast({ title: "Download started", description: `${table} data is downloading.` });
    } catch {
      toast({ title: "Download failed", description: `Could not export ${table}.`, variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  const tableMeta: Record<string, { label: string; description: string }> = {
    categories: { label: "Categories", description: "Product categories" },
    products: { label: "Products", description: "All product listings" },
    tags: { label: "Tags", description: "Product tags" },
    product_tags: { label: "Product Tags", description: "Product-tag associations" },
    product_images: { label: "Product Images", description: "Image references for products" },
    product_reviews: { label: "Product Reviews", description: "Customer reviews" },
    orders: { label: "Orders", description: "Customer orders" },
    order_items: { label: "Order Items", description: "Items within orders" },
    carts: { label: "Carts", description: "Shopping cart sessions" },
    cart_items: { label: "Cart Items", description: "Items in carts" },
    site_config: { label: "Site Config", description: "Site-wide settings" },
    audit_logs: { label: "Audit Logs", description: "Admin activity log" },
  };

  const totalRows = data ? Object.values(data.tables).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
      <div className="flex items-center justify-between gap-2 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/admin">
            <Button variant="ghost" size="icon" data-testid="button-back-dashboard">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold" data-testid="text-export-title">Data Export</h1>
            <p className="text-sm text-muted-foreground">Download your database</p>
          </div>
        </div>
      </div>

      <Card className="p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <Database className="w-8 h-8 text-primary mt-0.5" />
            <div>
              <h2 className="font-semibold text-lg">Full Database Backup</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Download the entire database as a SQL file. This includes all tables, data, and structure — 
                everything you need to restore your store.
              </p>
              {data && (
                <p className="text-xs text-muted-foreground mt-2">
                  {Object.keys(data.tables).length} tables, {totalRows.toLocaleString()} total rows
                </p>
              )}
            </div>
          </div>
          <Button
            onClick={handleDownloadSQL}
            disabled={downloading === "sql"}
            data-testid="button-download-sql"
          >
            {downloading === "sql" ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Download SQL
          </Button>
        </div>
      </Card>

      <h2 className="font-semibold text-lg mb-3">Individual Tables (CSV)</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Download individual tables as CSV spreadsheet files.
      </p>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="h-5 bg-muted rounded w-1/3 mb-2" />
              <div className="h-4 bg-muted rounded w-2/3" />
            </Card>
          ))}
        </div>
      ) : data ? (
        <div className="space-y-2">
          {Object.entries(data.tables).map(([table, count]) => {
            const meta = tableMeta[table] || { label: table, description: "" };
            return (
              <Card key={table} className="p-4" data-testid={`card-table-${table}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileSpreadsheet className="w-5 h-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{meta.label}</span>
                        <Badge variant="secondary" className="text-xs">
                          {count.toLocaleString()} {count === 1 ? "row" : "rows"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{meta.description}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadCSV(table)}
                    disabled={downloading === table || count === 0}
                    data-testid={`button-download-${table}`}
                  >
                    {downloading === table ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
