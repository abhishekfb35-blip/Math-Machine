import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, DollarSign, Save, Trash2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface CategoryAudiencePricing {
  id: string;
  categoryId: string;
  audienceId: string;
  wholesalePrice: number;
}

interface PricingData {
  pricing: CategoryAudiencePricing[];
  counts: Array<{ categoryId: string; audienceId: string; count: number }>;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Audience {
  id: string;
  name: string;
  sortOrder: number | null;
}

export default function AdminBestRates() {
  const { toast } = useToast();

  const { data: pricingData, isLoading: loadingPricing } = useQuery<PricingData>({
    queryKey: ["/api/admin/category-pricing"],
  });

  const { data: categories, isLoading: loadingCats } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: attributes, isLoading: loadingAttrs } = useQuery<{ audience: Audience[] }>({
    queryKey: ["/api/attributes"],
  });

  const saveMutation = useMutation({
    mutationFn: (rows: Array<{ categoryId: string; audienceId: string; wholesalePrice: number }>) =>
      apiRequest("PUT", "/api/admin/category-pricing", rows),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/category-pricing"] });
    },
    onError: () => {
      toast({ title: "Failed to save", description: "Could not save the price.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ categoryId, audienceId }: { categoryId: string; audienceId: string }) =>
      apiRequest("DELETE", `/api/admin/category-pricing/${categoryId}/${audienceId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/category-pricing"] });
    },
    onError: () => {
      toast({ title: "Failed to clear", description: "Could not clear the price.", variant: "destructive" });
    },
  });

  const isLoading = loadingPricing || loadingCats || loadingAttrs;

  const audiences = attributes?.audience ?? [];
  const cats = categories ?? [];
  const pricingList = pricingData?.pricing ?? [];
  const counts = pricingData?.counts ?? [];

  const pricingMap = new Map(pricingList.map(p => [`${p.categoryId}:${p.audienceId}`, p.wholesalePrice]));
  const countsMap = new Map(counts.map(c => [`${c.categoryId}:${c.audienceId}`, c.count]));

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="h-8 bg-muted animate-pulse rounded w-48 mb-6" />
        <div className="h-64 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin">
          <Button variant="ghost" size="sm" data-testid="button-back-admin">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Admin
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            Best Rates
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Set wholesale prices per category and audience. When the cart reaches the wholesale threshold, each item uses the price from the matching cell.
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" data-testid="button-info">
              <Info className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-sm">
            If a product belongs to a category and audience combination with a price set here, that wholesale price is used when the cart hits the wholesale threshold. If no price is set for a cell, items in that category/audience are charged at their regular retail price with no wholesale discount.
          </TooltipContent>
        </Tooltip>
      </div>

      {audiences.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No audiences configured yet. Add audiences under{" "}
            <Link href="/admin/attributes" className="underline text-foreground">Attributes</Link>{" "}
            first.
          </CardContent>
        </Card>
      )}

      {cats.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No categories found.
          </CardContent>
        </Card>
      )}

      {cats.length > 0 && audiences.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Price Matrix</CardTitle>
            <CardDescription>
              Prices are in INR (₹). Click a cell to edit, then press Enter or click away to save. The badge shows how many active products map to that cell.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-48 min-w-[12rem]">
                    Category
                  </th>
                  {audiences.map(aud => (
                    <th
                      key={aud.id}
                      className="text-center px-3 py-3 font-medium min-w-[9rem]"
                      data-testid={`th-audience-${aud.id}`}
                    >
                      {aud.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cats.map((cat, rowIdx) => (
                  <tr
                    key={cat.id}
                    className={rowIdx % 2 === 0 ? "bg-background" : "bg-muted/20"}
                    data-testid={`row-category-${cat.id}`}
                  >
                    <td className="px-4 py-3 font-medium border-r">{cat.name}</td>
                    {audiences.map(aud => (
                      <PriceCell
                        key={aud.id}
                        categoryId={cat.id}
                        audienceId={aud.id}
                        currentPrice={pricingMap.get(`${cat.id}:${aud.id}`) ?? null}
                        productCount={countsMap.get(`${cat.id}:${aud.id}`) ?? 0}
                        onSave={(price) => saveMutation.mutate([{ categoryId: cat.id, audienceId: aud.id, wholesalePrice: price }])}
                        onClear={() => deleteMutation.mutate({ categoryId: cat.id, audienceId: aud.id })}
                        saving={saveMutation.isPending}
                      />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface PriceCellProps {
  categoryId: string;
  audienceId: string;
  currentPrice: number | null;
  productCount: number;
  onSave: (price: number) => void;
  onClear: () => void;
  saving: boolean;
}

function PriceCell({ categoryId, audienceId, currentPrice, productCount, onSave, onClear, saving }: PriceCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setDraft(currentPrice !== null ? String(currentPrice) : "");
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commit = () => {
    const parsed = parseInt(draft, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed !== currentPrice) {
      onSave(parsed);
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") setEditing(false);
  };

  return (
    <td
      className="px-3 py-2 text-center align-middle"
      data-testid={`cell-${categoryId}-${audienceId}`}
    >
      <div className="flex flex-col items-center gap-1">
        {editing ? (
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground text-xs">₹</span>
            <Input
              ref={inputRef}
              type="number"
              min={0}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={handleKeyDown}
              className="h-7 w-24 text-sm text-center px-1"
              data-testid={`input-price-${categoryId}-${audienceId}`}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={startEdit}
            disabled={saving}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium transition-colors w-full justify-center
              ${currentPrice !== null
                ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                : "text-muted-foreground hover:bg-muted/60"
              }`}
            data-testid={`button-edit-price-${categoryId}-${audienceId}`}
          >
            {currentPrice !== null ? (
              <>
                <span className="text-xs opacity-60">₹</span>
                {currentPrice.toLocaleString("en-IN")}
              </>
            ) : (
              <span className="text-xs">— set price</span>
            )}
          </button>
        )}
        <div className="flex items-center gap-1">
          {productCount > 0 && (
            <Badge
              variant="outline"
              className="text-xs px-1.5 py-0 font-normal text-muted-foreground"
              data-testid={`badge-count-${categoryId}-${audienceId}`}
            >
              {productCount} product{productCount !== 1 ? "s" : ""}
            </Badge>
          )}
          {currentPrice !== null && !editing && (
            <button
              type="button"
              title="Clear price"
              onClick={onClear}
              disabled={saving}
              className="text-muted-foreground hover:text-destructive transition-colors"
              data-testid={`button-clear-price-${categoryId}-${audienceId}`}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </td>
  );
}
