import { useState } from "react";
import { Link } from "wouter";
import { ChevronLeft, GitCompare, CheckCircle2, XCircle, AlertTriangle, RefreshCw, ChevronDown, ChevronRight, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";

interface IdTableDiff {
  devCount: number;
  prodCount: number;
  onlyInDev: string[];
  onlyInProd: string[];
  fieldMismatches: { id: string; field: string; dev: unknown; prod: unknown }[];
}

interface ContentTableDiff {
  devCount: number;
  prodCount: number;
  onlyInDev: string[];
  onlyInProd: string[];
}

interface ProductDiff extends IdTableDiff {
  onlySkuInDev: string[];
  onlySkuInProd: string[];
  skuNameMismatches: { sku: string; devName: string; prodName: string }[];
}

interface CompareResult {
  checkedAt: string;
  prodUrl: string;
  categories: IdTableDiff;
  products: ProductDiff;
  tags: IdTableDiff;
  productTags: ContentTableDiff;
  productImages: IdTableDiff;
  productReviews: IdTableDiff;
}

function statusIcon(ok: boolean) {
  return ok
    ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
    : <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
}

function isIdTableClean(d: IdTableDiff) {
  return d.devCount === d.prodCount && d.onlyInDev.length === 0 && d.onlyInProd.length === 0 && d.fieldMismatches.length === 0;
}

function isContentTableClean(d: ContentTableDiff) {
  return d.devCount === d.prodCount && d.onlyInDev.length === 0 && d.onlyInProd.length === 0;
}

function isProductClean(d: ProductDiff) {
  return isIdTableClean(d) && d.onlySkuInDev.length === 0 && d.onlySkuInProd.length === 0 && d.skuNameMismatches.length === 0;
}

function CollapsibleList({ label, items, color }: { label: string; items: string[]; color: string }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  const slug = label.replace(/\s+/g, "-").toLowerCase();
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        data-testid={`button-collapse-${slug}`}
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {label} ({items.length})
      </button>
      {open && (
        <div className={`mt-1 p-2 rounded text-xs font-mono max-h-48 overflow-y-auto ${color}`}>
          {items.map((item, i) => <div key={i}>{item}</div>)}
        </div>
      )}
    </div>
  );
}

function FieldMismatches({ mismatches }: { mismatches: IdTableDiff["fieldMismatches"] }) {
  const [open, setOpen] = useState(false);
  if (!mismatches || mismatches.length === 0) return null;
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        data-testid="button-collapse-field-mismatches"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        Field mismatches ({mismatches.length})
      </button>
      {open && (
        <div className="mt-1 rounded border text-xs max-h-64 overflow-y-auto">
          <table className="w-full">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="text-left p-1.5 font-medium">ID</th>
                <th className="text-left p-1.5 font-medium">Field</th>
                <th className="text-left p-1.5 font-medium">Dev</th>
                <th className="text-left p-1.5 font-medium">Prod</th>
              </tr>
            </thead>
            <tbody>
              {mismatches.map((m, i) => (
                <tr key={i} className="border-t">
                  <td className="p-1.5 font-mono text-muted-foreground truncate max-w-[120px]">{m.id}</td>
                  <td className="p-1.5 font-semibold">{m.field}</td>
                  <td className="p-1.5 text-blue-700 dark:text-blue-400 break-all">{String(m.dev ?? "–")}</td>
                  <td className="p-1.5 text-orange-700 dark:text-orange-400 break-all">{String(m.prod ?? "–")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SkuNameMismatches({ mismatches }: { mismatches: ProductDiff["skuNameMismatches"] }) {
  const [open, setOpen] = useState(false);
  if (mismatches.length === 0) return null;
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        data-testid="button-collapse-sku-name-mismatches"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        Same SKU, different name ({mismatches.length})
      </button>
      {open && (
        <div className="mt-1 rounded border text-xs max-h-64 overflow-y-auto">
          <table className="w-full">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="text-left p-1.5 font-medium">SKU</th>
                <th className="text-left p-1.5 font-medium">Dev name</th>
                <th className="text-left p-1.5 font-medium">Prod name</th>
              </tr>
            </thead>
            <tbody>
              {mismatches.map((m, i) => (
                <tr key={i} className="border-t">
                  <td className="p-1.5 font-mono">{m.sku}</td>
                  <td className="p-1.5 text-blue-700 dark:text-blue-400">{m.devName}</td>
                  <td className="p-1.5 text-orange-700 dark:text-orange-400">{m.prodName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SectionShell({ title, clean, devCount, prodCount, children }: {
  title: string; clean: boolean; devCount: number; prodCount: number; children?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${clean
        ? "border-green-200 dark:border-green-900 bg-green-50/40 dark:bg-green-950/20"
        : "border-red-200 dark:border-red-900 bg-red-50/40 dark:bg-red-950/20"}`}
      data-testid={`section-table-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {statusIcon(clean)}
          <span className="font-semibold text-sm">{title}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="text-blue-700 dark:text-blue-400 font-mono">dev: {devCount}</span>
          <span className="text-orange-700 dark:text-orange-400 font-mono">prod: {prodCount}</span>
          {devCount !== prodCount && <Badge variant="destructive" className="text-xs">count mismatch</Badge>}
        </div>
      </div>
      {!clean && <div className="mt-3 space-y-1">{children}</div>}
    </div>
  );
}

interface ReseedResult {
  success: boolean;
  message: string;
  counts: {
    categories: number;
    products: number;
    tags: number;
    productTags: number;
    productImages: number;
    productReviews: number;
  };
}

export default function AdminDbCompare() {
  const [prodUrl, setProdUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reseeding, setReseeding] = useState(false);
  const [reseedError, setReseedError] = useState<string | null>(null);
  const [reseedResult, setReseedResult] = useState<ReseedResult | null>(null);

  async function runCompare(keepReseedBanner = false) {
    if (!prodUrl.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    if (!keepReseedBanner) {
      setReseedResult(null);
      setReseedError(null);
    }
    try {
      const res = await apiRequest("POST", "/api/admin/db-compare", { prodUrl: prodUrl.trim() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Compare failed");
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function forceReseed() {
    if (!prodUrl.trim()) return;
    setReseeding(true);
    setReseedError(null);
    setReseedResult(null);
    try {
      const res = await apiRequest("POST", "/api/admin/catalog/force-reseed", { prodUrl: prodUrl.trim() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Re-seed failed");
      setReseedResult(data);
      // Auto-refresh the comparison after a successful re-seed (keep the success banner visible)
      await runCompare(true);
    } catch (e: any) {
      setReseedError(e.message);
    } finally {
      setReseeding(false);
    }
  }

  const allClean = result
    ? isProductClean(result.products) &&
      isIdTableClean(result.categories) &&
      isIdTableClean(result.tags) &&
      isContentTableClean(result.productTags) &&
      isIdTableClean(result.productImages) &&
      isIdTableClean(result.productReviews)
    : null;

  const canReseed = !!prodUrl.trim() && result !== null && allClean === false;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-24" data-testid="page-admin-db-compare">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin">
          <Button variant="ghost" size="sm" data-testid="button-back-admin">
            <ChevronLeft className="w-4 h-4 mr-1" /> Admin
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <GitCompare className="w-5 h-5" /> Dev vs Prod Catalog Compare
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Enter your production URL to compare catalog tables
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <Input
          placeholder="https://your-app.replit.app"
          value={prodUrl}
          onChange={e => setProdUrl(e.target.value)}
          onKeyDown={e => e.key === "Enter" && runCompare()}
          className="font-mono text-sm"
          data-testid="input-prod-url"
        />
        <Button onClick={runCompare} disabled={loading || reseeding || !prodUrl.trim()} data-testid="button-run-compare">
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Compare"}
        </Button>
        {canReseed && (
          <Button
            variant="destructive"
            onClick={forceReseed}
            disabled={reseeding || loading}
            title="Overwrite prod catalog with dev seed data"
            data-testid="button-force-reseed"
          >
            {reseeding
              ? <RefreshCw className="w-4 h-4 animate-spin" />
              : <><UploadCloud className="w-4 h-4 mr-1.5" />Sync to Prod</>}
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400 mb-4" data-testid="text-compare-error">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {reseedError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400 mb-4" data-testid="text-reseed-error">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          Re-seed failed: {reseedError}
        </div>
      )}

      {reseedResult && (
        <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/30 p-3 text-sm text-green-700 dark:text-green-400 mb-4" data-testid="text-reseed-success">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            {reseedResult.message} —{" "}
            {reseedResult.counts.products} products, {reseedResult.counts.categories} categories, {reseedResult.counts.tags} tags
          </span>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground">
              Compared against <span className="font-mono">{result.prodUrl}</span> at {new Date(result.checkedAt).toLocaleTimeString()}
            </p>
            {allClean !== null && (
              <Badge variant={allClean ? "default" : "destructive"} className="text-xs" data-testid="badge-overall-status">
                {allClean ? "✓ All tables match" : "✗ Differences found"}
              </Badge>
            )}
          </div>

          {/* Categories — ID-based */}
          <SectionShell title="Categories" clean={isIdTableClean(result.categories)} devCount={result.categories.devCount} prodCount={result.categories.prodCount}>
            <CollapsibleList label="IDs only in dev"  items={result.categories.onlyInDev}  color="bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300" />
            <CollapsibleList label="IDs only in prod" items={result.categories.onlyInProd} color="bg-orange-50 dark:bg-orange-950/30 text-orange-800 dark:text-orange-300" />
            <FieldMismatches mismatches={result.categories.fieldMismatches} />
          </SectionShell>

          {/* Products — ID-based + SKU cross-check */}
          <SectionShell title="Products" clean={isProductClean(result.products)} devCount={result.products.devCount} prodCount={result.products.prodCount}>
            <CollapsibleList label="IDs only in dev"   items={result.products.onlyInDev}   color="bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300" />
            <CollapsibleList label="IDs only in prod"  items={result.products.onlyInProd}  color="bg-orange-50 dark:bg-orange-950/30 text-orange-800 dark:text-orange-300" />
            <CollapsibleList label="SKUs only in dev"  items={result.products.onlySkuInDev}  color="bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300" />
            <CollapsibleList label="SKUs only in prod" items={result.products.onlySkuInProd} color="bg-orange-50 dark:bg-orange-950/30 text-orange-800 dark:text-orange-300" />
            <FieldMismatches mismatches={result.products.fieldMismatches} />
            <SkuNameMismatches mismatches={result.products.skuNameMismatches} />
          </SectionShell>

          {/* Tags — ID-based */}
          <SectionShell title="Tags" clean={isIdTableClean(result.tags)} devCount={result.tags.devCount} prodCount={result.tags.prodCount}>
            <CollapsibleList label="IDs only in dev"  items={result.tags.onlyInDev}  color="bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300" />
            <CollapsibleList label="IDs only in prod" items={result.tags.onlyInProd} color="bg-orange-50 dark:bg-orange-950/30 text-orange-800 dark:text-orange-300" />
            <FieldMismatches mismatches={result.tags.fieldMismatches} />
          </SectionShell>

          {/* Product Tags — content-based (product_id + tag_id) */}
          <SectionShell title="Product Tags" clean={isContentTableClean(result.productTags)} devCount={result.productTags.devCount} prodCount={result.productTags.prodCount}>
            <CollapsibleList label="Links only in dev"  items={result.productTags.onlyInDev}  color="bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300" />
            <CollapsibleList label="Links only in prod" items={result.productTags.onlyInProd} color="bg-orange-50 dark:bg-orange-950/30 text-orange-800 dark:text-orange-300" />
          </SectionShell>

          {/* Product Images — ID-based (synced by migration) */}
          <SectionShell title="Product Images" clean={isIdTableClean(result.productImages)} devCount={result.productImages.devCount} prodCount={result.productImages.prodCount}>
            <CollapsibleList label="IDs only in dev"  items={result.productImages.onlyInDev}  color="bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300" />
            <CollapsibleList label="IDs only in prod" items={result.productImages.onlyInProd} color="bg-orange-50 dark:bg-orange-950/30 text-orange-800 dark:text-orange-300" />
            <FieldMismatches mismatches={result.productImages.fieldMismatches} />
          </SectionShell>

          {/* Product Reviews — ID-based (synced by migration) */}
          <SectionShell title="Product Reviews" clean={isIdTableClean(result.productReviews)} devCount={result.productReviews.devCount} prodCount={result.productReviews.prodCount}>
            <CollapsibleList label="IDs only in dev"  items={result.productReviews.onlyInDev}  color="bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300" />
            <CollapsibleList label="IDs only in prod" items={result.productReviews.onlyInProd} color="bg-orange-50 dark:bg-orange-950/30 text-orange-800 dark:text-orange-300" />
            <FieldMismatches mismatches={result.productReviews.fieldMismatches} />
          </SectionShell>
        </div>
      )}
    </div>
  );
}
