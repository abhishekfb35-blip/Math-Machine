import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Save, ArrowLeft, Search, Tag } from "lucide-react";
import { Link } from "wouter";

interface PriceRow {
  id: string;
  name: string;
  sku: string;
  price: number;
  wholesalePrice: number | null;
}

type DraftMap = Record<string, number | null>;

function fmt(v: number) {
  return `₹${v.toLocaleString("en-IN")}`;
}

export default function AdminPriceSheet() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [dirty, setDirty] = useState(false);

  const { data: rows = [], isLoading } = useQuery<PriceRow[]>({
    queryKey: ["/api/admin/price-sheet"],
  });

  useEffect(() => {
    if (rows.length) {
      const init: DraftMap = {};
      rows.forEach((r) => { init[r.id] = r.wholesalePrice; });
      setDrafts(init);
      setDirty(false);
    }
  }, [rows]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = Object.entries(drafts).map(([id, wholesalePrice]) => ({ id, wholesalePrice }));
      await apiRequest("PUT", "/api/admin/price-sheet", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/price-sheet"] });
      setDirty(false);
      toast({ title: "Saved", description: "Bulk rates updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save bulk rates.", variant: "destructive" });
    },
  });

  function setDraft(id: string, val: string) {
    const parsed = val.trim() === "" ? null : parseInt(val, 10);
    if (val.trim() !== "" && (isNaN(parsed as number) || (parsed as number) <= 0)) return;
    setDrafts((prev) => ({ ...prev, [id]: parsed }));
    setDirty(true);
  }

  const filtered = rows.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.sku.toLowerCase().includes(search.toLowerCase()),
  );

  const unset = filtered.filter((r) => drafts[r.id] == null).length;
  const set = filtered.filter((r) => drafts[r.id] != null).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Bulk Price Sheet</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Set per-product bulk rates — applied automatically when a customer has {5}+ items.
              </p>
            </div>
          </div>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!dirty || saveMutation.isPending}
            data-testid="button-save"
          >
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? "Saving…" : "Save All"}
          </Button>
        </div>

        {/* Stats */}
        <div className="flex gap-4 text-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 flex items-center gap-2">
            <Tag className="w-4 h-4 text-amber-500" />
            <span className="font-semibold text-gray-800 dark:text-gray-200">{set}</span>
            <span className="text-gray-500">with bulk rate</span>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 flex items-center gap-2">
            <span className="font-semibold text-gray-400">{unset}</span>
            <span className="text-gray-500">no bulk rate set</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            className="pl-9"
            placeholder="Search by product name or SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search"
          />
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-0 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <span>Product</span>
            <span className="w-32 text-right">Selling Price</span>
            <span className="w-40 text-right pr-1">Bulk Rate</span>
          </div>

          {isLoading ? (
            <div className="px-4 py-12 text-center text-gray-400 text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-gray-400 text-sm">No products found.</div>
          ) : (
            filtered.map((row) => {
              const draft = drafts[row.id];
              const hasRate = draft != null;
              const discount = hasRate ? Math.round(((row.price - draft!) / row.price) * 100) : null;

              return (
                <div
                  key={row.id}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-0 px-4 py-3 border-b border-gray-50 dark:border-gray-800 last:border-b-0 hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors"
                  data-testid={`row-product-${row.id}`}
                >
                  {/* Name + SKU */}
                  <div className="min-w-0 pr-4">
                    <p className="font-medium text-gray-900 dark:text-gray-100 truncate text-sm">{row.name}</p>
                    <p className="text-xs text-gray-400">{row.sku}</p>
                  </div>

                  {/* Selling price */}
                  <div className="w-32 text-right">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{fmt(row.price)}</span>
                  </div>

                  {/* Bulk rate input */}
                  <div className="w-40 flex items-center justify-end gap-2 pl-3">
                    {discount != null && (
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        -{discount}%
                      </span>
                    )}
                    <Input
                      type="number"
                      min={1}
                      placeholder="—"
                      value={draft ?? ""}
                      onChange={(e) => setDraft(row.id, e.target.value)}
                      className="w-24 text-right h-8 text-sm"
                      data-testid={`input-bulk-${row.id}`}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {dirty && (
          <div className="flex justify-end">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              data-testid="button-save-bottom"
            >
              <Save className="w-4 h-4 mr-2" />
              {saveMutation.isPending ? "Saving…" : "Save All"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
