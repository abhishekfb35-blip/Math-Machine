import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { parseImageCsv } from "@/lib/productImageCsv";
import { imageImportColumns } from "@shared/productImageImport";

type ProductId = { id: string };
type ImportResult = { updatedRows: number; updatedProducts: number };

export function ProductImageCsvImport({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [serverErrors, setServerErrors] = useState<Array<{ row: number; message: string }>>([]);
  const { data: products, isLoading: loadingProducts, isError: productLoadError } = useQuery<ProductId[]>({
    queryKey: ["/api/admin/products"],
    enabled: open,
  });
  const productIds = useMemo(() => products ? new Set(products.map(p => p.id)) : undefined, [products]);
  const preview = useMemo(() => csv === null ? null : parseImageCsv(csv, productIds), [csv, productIds]);
  const invalidCount = preview?.rows.filter(row => row.errors.length).length ?? 0;
  const canSubmit = !!products && !!preview && !preview.error && preview.rows.length > 0 && invalidCount === 0 && !saving && !reading;

  const close = () => {
    if (saving || reading) return;
    setCsv(null);
    setFileName("");
    setResult(null);
    setServerErrors([]);
    onClose();
  };

  const chooseFile = async (file?: File) => {
    setCsv(null);
    setResult(null);
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
    const blob = new Blob([`${imageImportColumns.join(",")}\nPRODUCT_ID,https://example.com/gallery-photo.jpg,2\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "product-image-urls-template.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const submit = async () => {
    if (!canSubmit || !preview) return;
    setSaving(true);
    setServerErrors([]);
    try {
      const res = await apiRequest("POST", "/api/admin/products/import-image-urls", {
        rows: preview.rows.map(row => ({
          productId: row.productId, imageUrl: row.imageUrl,
          imageSequenceNumber: Number(row.imageSequenceNumber),
        })),
      });
      const updated = await res.json() as ImportResult;
      setResult(updated);
      setCsv(null);
      setFileName("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/catalog/category"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/products"] }),
      ]);
      toast({ title: `Updated ${updated.updatedRows} image${updated.updatedRows === 1 ? "" : "s"} on ${updated.updatedProducts} product${updated.updatedProducts === 1 ? "" : "s"}` });
    } catch (error) {
      // apiRequest includes the response body in its error message.
      const message = error instanceof Error ? error.message : "Import failed";
      const json = message.slice(message.indexOf("{"));
      try {
        const details = JSON.parse(json) as { errors?: Array<{ row: number; message: string }> };
        setServerErrors(details.errors ?? []);
      } catch { /* The request did not include row-specific errors. */ }
      toast({ title: "Import failed — no images changed", description: message.slice(0, 250), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={value => { if (!value) close(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-image-csv-import">
        <DialogHeader>
          <DialogTitle>Update product gallery images from CSV</DialogTitle>
          <DialogDescription>
            One row per product and image position. Sequence 2 is the first gallery image; sequence 1 (the hero) cannot be changed. Existing positions are replaced, and empty positions are added.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground">{imageImportColumns.join(", ")}</span>
            <Button variant="outline" size="sm" onClick={downloadSample} data-testid="button-download-image-csv">
              <Download className="w-4 h-4 mr-1" /> Download sample CSV
            </Button>
          </div>
          <div>
            <label htmlFor="image-csv-file" className="text-sm font-medium">CSV file</label>
            <Input id="image-csv-file" type="file" accept=".csv,text/csv" className="mt-1" disabled={saving || reading}
              onChange={event => { void chooseFile(event.target.files?.[0]); event.target.value = ""; }}
              data-testid="input-image-csv-file" />
          </div>
          {loadingProducts && <p className="text-sm text-muted-foreground">Loading product IDs for validation…</p>}
          {productLoadError && <p className="text-sm text-destructive">Could not load products. Reopen this tool and try again.</p>}
          {reading && <p className="text-sm text-muted-foreground">Reading CSV…</p>}
          {result && <p className="text-sm font-medium text-green-700 dark:text-green-400" role="status" data-testid="image-csv-result">
            Updated {result.updatedRows} image{result.updatedRows === 1 ? "" : "s"} on {result.updatedProducts} product{result.updatedProducts === 1 ? "" : "s"}.
          </p>}
          {preview?.error && <p className="text-sm text-destructive" role="alert" data-testid="image-csv-error">{preview.error}</p>}
          {preview && !preview.error && (
            <div data-testid="image-csv-preview">
              <p className="text-sm font-medium mb-2">{fileName}: {preview.rows.length} row{preview.rows.length === 1 ? "" : "s"} · {invalidCount} invalid</p>
              <div className="max-h-72 overflow-auto rounded border">
                <table className="w-full text-xs text-left">
                  <thead className="sticky top-0 bg-muted"><tr>
                    <th className="p-2">Line</th><th className="p-2">Product ID</th><th className="p-2">Image URL</th><th className="p-2">Sequence</th><th className="p-2">Status</th>
                  </tr></thead>
                  <tbody>{preview.rows.map((row, index) => (
                    <tr key={index} className="border-t" data-testid={`image-csv-row-${index}`}>
                      <td className="p-2">{row.line}</td>
                      <td className="p-2 break-all">{row.productId}</td>
                      <td className="p-2 max-w-48 truncate" title={row.imageUrl}>{row.imageUrl}</td>
                      <td className="p-2">{row.imageSequenceNumber}</td>
                      <td className={`p-2 ${row.errors.length ? "text-destructive" : "text-green-700 dark:text-green-400"}`}>
                        {row.errors.length ? row.errors.join("; ") : "Ready"}
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}
          {serverErrors.length > 0 && <div role="alert" className="text-sm text-destructive" data-testid="image-csv-server-errors">
            {serverErrors.map((err, i) => <p key={i}>
              {err.row ? `Line ${preview?.rows[err.row - 2]?.line ?? err.row}: ` : ""}{err.message}
            </p>)}
          </div>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={close} disabled={saving || reading}>Close</Button>
            <Button onClick={submit} disabled={!canSubmit} data-testid="button-apply-image-csv">
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
              {saving ? "Applying all rows…" : "Apply image updates"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}