import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { parseProductCreateCsv } from "@/lib/productCreateCsv";
import { productCreateColumns } from "@shared/productCreateImport";
import type { Category } from "@shared/types";

type ExistingProduct = { sku: string | null; slug: string };

const sample: Record<string, string> = {
  sku: "NEW-SKU-001", name: "Sample Cotton Towel", slug: "sample-cotton-towel",
  price: "999", category_id: "REPLACE_WITH_CATEGORY_ID",
  description: "Soft cotton towel", mrp: "1299", hero_image_url: "https://example.com/towel.jpg",
  color: "White", material: "100% cotton", gsm: "500", dimensions: "120 x 60 cm",
  weight_grams: "350", items_in_set: "1", special_features: "Machine washable",
  bullet_points: "Soft, absorbent cotton\nEasy to wash", search_keywords: "cotton towel",
  product_type: "towel", active: "true", sort_order: "0",
};
function quoteCsv(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function ProductCreateCsvImport({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<number | null>(null);
  const [serverErrors, setServerErrors] = useState<Array<{ row: number; message: string }>>([]);
  const categoriesQuery = useQuery<Category[]>({ queryKey: ["/api/admin/categories"], enabled: open });
  const productsQuery = useQuery<ExistingProduct[]>({ queryKey: ["/api/admin/products"], enabled: open });
  const categoryIds = useMemo(() =>
    categoriesQuery.data ? new Set(categoriesQuery.data.map(category => category.id)) : undefined,
    [categoriesQuery.data]);
  const preview = useMemo(() => csv === null ? null :
    parseProductCreateCsv(csv, categoryIds, productsQuery.data),
    [csv, categoryIds, productsQuery.data]);
  const invalidCount = preview?.rows.filter(row => row.errors.length).length ?? 0;
  const canSubmit = !!categoriesQuery.data && !!productsQuery.data && !!preview &&
    !preview.error && preview.rows.length > 0 && invalidCount === 0 && !saving && !reading;

  const close = () => {
    if (saving || reading) return;
    setCsv(null);
    setFileName("");
    setCreated(null);
    setServerErrors([]);
    onClose();
  };

  const chooseFile = async (file?: File) => {
    setCsv(null);
    setCreated(null);
    setServerErrors([]);
    setFileName(file?.name ?? "");
    if (!file) return;
    if (file.size > 2_000_000) {
      toast({ title: "CSV is too large", description: "Choose a file smaller than 2 MB.", variant: "destructive" });
      return;
    }
    setReading(true);
    try {
      setCsv(await file.text());
    } catch {
      toast({ title: "Unable to read CSV", variant: "destructive" });
    } finally {
      setReading(false);
    }
  };

  const downloadSample = () => {
    const text = `${productCreateColumns.join(",")}\r\n${productCreateColumns.map(column => quoteCsv(sample[column] ?? "")).join(",")}\r\n`;
    const url = URL.createObjectURL(new Blob(["\uFEFF", text], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "new-products-template.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const submit = async () => {
    if (!canSubmit || !preview) return;
    setSaving(true);
    setServerErrors([]);
    try {
      const response = await apiRequest("POST", "/api/admin/products/import-new", {
        rows: preview.rows.map(row => row.product),
      });
      const result = await response.json() as { createdProducts: number };
      setCreated(result.createdProducts);
      setCsv(null);
      setFileName("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/catalog/category"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/products/search"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/products"] }),
      ]);
      toast({ title: `Created ${result.createdProducts} product${result.createdProducts === 1 ? "" : "s"}` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed";
      try {
        const details = JSON.parse(message.slice(message.indexOf("{"))) as { errors?: Array<{ row: number; message: string }> };
        setServerErrors(details.errors ?? []);
      } catch { /* No row-specific errors. */ }
      toast({ title: "Import failed — no products created", description: message.slice(0, 250), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={value => { if (!value) close(); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" data-testid="dialog-product-create-csv">
        <DialogHeader>
          <DialogTitle>Upload new products via CSV</DialogTitle>
          <DialogDescription>
            Creates new products only. Required: sku, name, slug, price, category_id. Leave material or gsm blank for
            defaults of 100% cotton and 500. Use separate lines inside a quoted bullet_points cell for multiple points.
            Existing SKUs or slugs are rejected; no products are created if any row fails.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Use an existing category ID. Gallery images can be added with the separate image CSV tool.</span>
            <Button variant="outline" size="sm" onClick={downloadSample} data-testid="button-download-product-csv">
              <Download className="w-4 h-4 mr-1" /> Download sample CSV
            </Button>
          </div>
          {categoriesQuery.data && <div className="text-xs text-muted-foreground" data-testid="product-create-category-help">
            Category IDs: {categoriesQuery.data.map(category => `${category.name} (${category.id})`).join(" · ") || "No categories available"}
          </div>}
          <div>
            <label htmlFor="product-create-csv-file" className="text-sm font-medium">CSV file</label>
            <Input id="product-create-csv-file" type="file" accept=".csv,text/csv" className="mt-1"
              disabled={reading || saving}
              onChange={event => { void chooseFile(event.target.files?.[0]); event.target.value = ""; }}
              data-testid="input-product-create-csv" />
          </div>
          {(categoriesQuery.isLoading || productsQuery.isLoading) &&
            <p className="text-sm text-muted-foreground">Loading catalog for validation…</p>}
          {(categoriesQuery.isError || productsQuery.isError) &&
            <p className="text-sm text-destructive" role="alert">Could not load the catalog. Reopen this tool and try again.</p>}
          {reading && <p className="text-sm text-muted-foreground">Reading CSV…</p>}
          {created !== null && <p className="text-sm font-medium text-green-700 dark:text-green-400"
            role="status" data-testid="product-create-result">
            Created {created} product{created === 1 ? "" : "s"}.
          </p>}
          {preview?.error && <p className="text-sm text-destructive" role="alert" data-testid="product-create-csv-error">{preview.error}</p>}
          {preview && !preview.error && <div data-testid="product-create-preview">
            <p className="text-sm font-medium mb-2">{fileName}: {preview.rows.length} row{preview.rows.length === 1 ? "" : "s"} · {invalidCount} invalid</p>
            <div className="max-h-80 overflow-auto rounded border">
              <table className="w-max min-w-full text-xs text-left">
                <thead className="sticky top-0 bg-muted"><tr>
                  <th className="p-2">Line</th>
                  {preview.headers.map(header => <th key={header} className="p-2 whitespace-nowrap">{header}</th>)}
                  {!preview.headers.includes("material") && <th className="p-2">material (default)</th>}
                  {!preview.headers.includes("gsm") && <th className="p-2">gsm (default)</th>}
                  <th className="p-2">Status</th>
                </tr></thead>
                <tbody>{preview.rows.map((row, index) => <tr key={index} className="border-t" data-testid={`product-create-row-${index}`}>
                  <td className="p-2">{row.line}</td>
                  {preview.headers.map(header => <td key={header} className="p-2 max-w-56 whitespace-pre-line break-words" title={row.values[header]}>
                    {header === "bullet_points" ? (row.product?.bulletPoints ??
                      row.values[header]?.split(/\r\n|\n|\r/).map(point => point.trim()).filter(Boolean) ?? []
                    ).map((point, i) => <span key={i} className="block">• {point}</span>) :
                      header === "material" ? row.product?.material ?? row.values[header] :
                      header === "gsm" ? row.product?.gsm ?? row.values[header] :
                      row.values[header]}
                  </td>)}
                  {!preview.headers.includes("material") && <td className="p-2">{row.product?.material ?? "100% cotton"}</td>}
                  {!preview.headers.includes("gsm") && <td className="p-2">{row.product?.gsm ?? 500}</td>}
                  <td className={`p-2 min-w-48 ${row.errors.length ? "text-destructive" : "text-green-700 dark:text-green-400"}`}>
                    {row.errors.length ? row.errors.join("; ") : "Ready"}
                  </td>
                </tr>)}</tbody>
              </table>
            </div>
          </div>}
          {serverErrors.length > 0 && <div role="alert" className="text-sm text-destructive" data-testid="product-create-server-errors">
            {serverErrors.map((error, index) => <p key={index}>
              {error.row ? `Line ${preview?.rows[error.row - 2]?.line ?? error.row}: ` : ""}{error.message}
            </p>)}
          </div>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={close} disabled={saving || reading}>Close</Button>
            <Button onClick={submit} disabled={!canSubmit} data-testid="button-apply-product-create-csv">
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
              {saving ? "Creating all products…" : "Create products"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}