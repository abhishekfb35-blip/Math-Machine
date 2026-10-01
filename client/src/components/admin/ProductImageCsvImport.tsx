import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { parseImageCsv } from "@/lib/productImageCsv";
import { imageImportColumns } from "@shared/productImageImport";
import {
  maxProductImageFolderFiles,
  previewProductImageFolder,
} from "@shared/productImageFolderImport";

type ProductId = { id: string };
type ImportResult = { addedRows: number; addedProducts: number };

async function refreshImportedImages(productIds: string[]) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["/api/admin/catalog/category"] }),
    queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] }),
    queryClient.invalidateQueries({ queryKey: ["/api/products"] }),
    ...productIds.map(productId => queryClient.invalidateQueries({ queryKey: ["/api/products", productId, "images"] })),
  ]);
}

export function ProductImageCsvImport({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [folderMode, setFolderMode] = useState(false);
  const [folderFiles, setFolderFiles] = useState<File[]>([]);
  const [folderSequenceNumber, setFolderSequenceNumber] = useState("2");
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
  const folderPreview = useMemo(() => folderFiles.length === 0 ? null : previewProductImageFolder(
    folderFiles.map(file => ({ name: file.name, size: file.size })),
    productIds,
    folderSequenceNumber,
  ), [folderFiles, productIds, folderSequenceNumber]);
  const invalidCsvCount = preview?.rows.filter(row => row.errors.length).length ?? 0;
  const invalidFolderCount = folderPreview?.rows.filter(row => row.errors.length).length ?? 0;
  const canSubmitCsv = !!products && !!preview && !preview.error && preview.rows.length > 0 && invalidCsvCount === 0 && !saving && !reading;
  const canSubmitFolder = !!products && !!folderPreview && folderFiles.length > 0
    && folderPreview.errors.length === 0 && invalidFolderCount === 0 && !saving && !reading;
  const canSubmit = folderMode ? canSubmitFolder : canSubmitCsv;

  const close = () => {
    if (saving || reading) return;
    setCsv(null);
    setFileName("");
    setFolderMode(false);
    setFolderFiles([]);
    setFolderSequenceNumber("2");
    setResult(null);
    setServerErrors([]);
    if (folderInputRef.current) folderInputRef.current.value = "";
    onClose();
  };

  const toggleFolderMode = (enabled: boolean) => {
    setFolderMode(enabled);
    setCsv(null);
    setFileName("");
    setFolderFiles([]);
    setResult(null);
    setServerErrors([]);
    if (folderInputRef.current) folderInputRef.current.value = "";
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

  const chooseFolder = (files?: FileList | null) => {
    setFolderFiles(files ? Array.from(files) : []);
    setResult(null);
    setServerErrors([]);
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
    if (folderMode) {
      await submitFolder();
      return;
    }
    if (!canSubmitCsv || !preview) return;
    setSaving(true);
    setServerErrors([]);
    try {
      const importedProductIds = [...new Set(preview.rows.map(row => row.productId))];
      const res = await apiRequest("POST", "/api/admin/products/import-image-urls", {
        rows: preview.rows.map(row => ({
          productId: row.productId, imageUrl: row.imageUrl,
          imageSequenceNumber: Number(row.imageSequenceNumber),
        })),
      });
      const added = await res.json() as ImportResult;
      setResult(added);
      setCsv(null);
      setFileName("");
      await refreshImportedImages(importedProductIds);
      toast({ title: `Added ${added.addedRows} image${added.addedRows === 1 ? "" : "s"} to ${added.addedProducts} product${added.addedProducts === 1 ? "" : "s"}` });
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

  const submitFolder = async () => {
    if (!canSubmitFolder) return;
    setSaving(true);
    setServerErrors([]);
    try {
      const importedProductIds = [...new Set(folderPreview!.rows.map(row => row.productId))];
      const formData = new FormData();
      folderFiles.forEach(file => formData.append("images", file, file.name));
      formData.append("imageSequenceNumber", folderSequenceNumber);
      const response = await fetch("/api/admin/products/import-image-files", { method: "POST", body: formData });
      const payload = await response.json().catch(() => ({})) as ImportResult & {
        message?: string;
        errors?: Array<{ row: number; message: string }>;
      };
      if (!response.ok) {
        setServerErrors(payload.errors ?? []);
        throw new Error(payload.message ?? "Folder import failed");
      }
      setResult(payload);
      setFolderFiles([]);
      if (folderInputRef.current) folderInputRef.current.value = "";
      await refreshImportedImages(importedProductIds);
      toast({ title: `Added ${payload.addedRows} image${payload.addedRows === 1 ? "" : "s"} to ${payload.addedProducts} product${payload.addedProducts === 1 ? "" : "s"}` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Folder import failed";
      toast({ title: "Import failed — no images changed", description: message.slice(0, 250), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={value => { if (!value) close(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-image-csv-import">
        <DialogHeader>
          <DialogTitle>Add images to product galleries</DialogTitle>
          <DialogDescription>
            Sequence 2 is the first gallery image; sequence 1 (the hero) cannot be changed. Existing positions are never overwritten.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Checkbox checked={folderMode} onCheckedChange={value => toggleFolderMode(value === true)}
              data-testid="checkbox-image-folder-mode" />
            Add images from a local folder instead of a CSV
          </label>
          {folderMode ? (
            <div className="space-y-4">
              <div>
                <label htmlFor="image-folder-files" className="text-sm font-medium">Image folder</label>
                <Input id="image-folder-files" ref={node => {
                  folderInputRef.current = node;
                  node?.setAttribute("webkitdirectory", "");
                  node?.setAttribute("directory", "");
                }} type="file" multiple
                  accept=".jpg,.jpeg,.png,.gif,.webp,image/jpeg,image/png,image/gif,image/webp"
                  className="mt-1" disabled={saving || reading}
                  onChange={event => { chooseFolder(event.target.files); event.target.value = ""; }}
                  data-testid="input-image-folder" />
                <p className="mt-1 text-xs text-muted-foreground">
                  Select a folder containing files named with their product ID, such as product-id.jpg. Up to {maxProductImageFolderFiles} images; each must be 5 MB or smaller.
                </p>
              </div>
              <div>
                <label htmlFor="image-folder-sequence" className="text-sm font-medium">Image sequence number</label>
                <Input id="image-folder-sequence" type="number" min={2} max={2147483647} step={1}
                  value={folderSequenceNumber} onChange={event => setFolderSequenceNumber(event.target.value)}
                  disabled={saving} className="mt-1 max-w-48" data-testid="input-image-folder-sequence" />
                <p className="mt-1 text-xs text-muted-foreground">This sequence applies to every selected image. Sequence 2 is the first gallery image.</p>
              </div>
              {folderPreview && (
                <div data-testid="image-folder-preview">
                  <p className="text-sm font-medium mb-2">
                    {folderFiles.length} file{folderFiles.length === 1 ? "" : "s"} · sequence {folderSequenceNumber} · {invalidFolderCount} invalid
                  </p>
                  {folderPreview.errors.map((error, index) => (
                    <p key={index} className="text-sm text-destructive" role="alert">{error}</p>
                  ))}
                  <div className="max-h-72 overflow-auto rounded border mt-2">
                    <table className="w-full text-xs text-left">
                      <thead className="sticky top-0 bg-muted"><tr>
                        <th className="p-2">File</th><th className="p-2">Product ID</th><th className="p-2">Target sequence</th><th className="p-2">Status</th>
                      </tr></thead>
                      <tbody>{folderPreview.rows.map((row, index) => (
                        <tr key={`${row.name}-${index}`} className="border-t" data-testid={`image-folder-row-${index}`}>
                          <td className="p-2 break-all">{row.name}</td>
                          <td className="p-2 break-all">{row.productId || "—"}</td>
                          <td className="p-2">{folderSequenceNumber || "—"}</td>
                          <td className={`p-2 ${row.errors.length ? "text-destructive" : "text-green-700 dark:text-green-400"}`}>
                            {row.errors.length ? row.errors.join("; ") : "Ready"}
                          </td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              )}
              {serverErrors.length > 0 && <div role="alert" className="text-sm text-destructive" data-testid="image-folder-server-errors">
                {serverErrors.map((error, index) => {
                  const file = error.row > 0 ? folderFiles[error.row - 2]?.name : undefined;
                  return <p key={index}>{file ? `${file}: ` : ""}{error.message}</p>;
                })}
              </div>}
            </div>
          ) : (
            <>
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
            </>
          )}
          {loadingProducts && <p className="text-sm text-muted-foreground">Loading product IDs for validation…</p>}
          {productLoadError && <p className="text-sm text-destructive">Could not load products. Reopen this tool and try again.</p>}
          {reading && <p className="text-sm text-muted-foreground">Reading CSV…</p>}
          {result && <p className="text-sm font-medium text-green-700 dark:text-green-400" role="status" data-testid="image-csv-result">
            Added {result.addedRows} image{result.addedRows === 1 ? "" : "s"} to {result.addedProducts} product{result.addedProducts === 1 ? "" : "s"}.
          </p>}
          {!folderMode && preview?.error && <p className="text-sm text-destructive" role="alert" data-testid="image-csv-error">{preview.error}</p>}
          {!folderMode && preview && !preview.error && (
            <div data-testid="image-csv-preview">
              <p className="text-sm font-medium mb-2">{fileName}: {preview.rows.length} row{preview.rows.length === 1 ? "" : "s"} · {invalidCsvCount} invalid</p>
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
          {!folderMode && serverErrors.length > 0 && <div role="alert" className="text-sm text-destructive" data-testid="image-csv-server-errors">
            {serverErrors.map((err, i) => <p key={i}>
              {err.row ? `Line ${preview?.rows[err.row - 2]?.line ?? err.row}: ` : ""}{err.message}
            </p>)}
          </div>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={close} disabled={saving || reading}>Close</Button>
            <Button onClick={submit} disabled={!canSubmit} data-testid={folderMode ? "button-apply-image-folder" : "button-apply-image-csv"}>
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
              {saving ? "Adding images…" : "Add images"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}