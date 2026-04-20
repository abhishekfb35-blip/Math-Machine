import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch, useLocation } from "wouter";
import { SlidersHorizontal, Search, X, ChevronRight, ArrowLeft } from "lucide-react";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCardNew from "@/components/ProductCardNew";
import QuickAddSheet from "@/components/QuickAddSheet";
import type { Product } from "@shared/types";

type AudienceFilter = "all" | "kids" | "adults" | "couples";

const TAG_SECTIONS: { label: string; tag: string; maxShown: number }[] = [
  { label: "Kids Towels",      tag: "kids towels",      maxShown: 8 },
  { label: "Adult Towels",     tag: "adult towels",     maxShown: 8 },
  { label: "Couple Towels",    tag: "couple towels",    maxShown: 8 },
  { label: "Kids Blankets",    tag: "kids blankets",    maxShown: 8 },
  { label: "Kids Bathrobes",   tag: "kids bathrobes",   maxShown: 8 },
  { label: "Adult Bathrobes",  tag: "adult bathrobes",  maxShown: 8 },
  { label: "Couple Bathrobes", tag: "couple bathrobes", maxShown: 8 },
];

const AUDIENCE_FILTERS: { label: string; value: AudienceFilter }[] = [
  { label: "All",     value: "all"     },
  { label: "Kids",    value: "kids"    },
  { label: "Adults",  value: "adults"  },
  { label: "Couples", value: "couples" },
];

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <Skeleton className="aspect-square" />
          <div className="p-3 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </Card>
      ))}
    </div>
  );
}

function TagSectionsSkeleton() {
  return (
    <div className="space-y-8">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 4 }).map((_, j) => (
              <Card key={j} className="shrink-0 w-44 overflow-hidden">
                <Skeleton className="aspect-square" />
                <div className="p-2 space-y-2">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ShopPage() {
  const searchString = useSearch();
  const [, navigate] = useLocation();

  const [activeFilter, setActiveFilter] = useState<AudienceFilter>("all");
  const [activeTag,    setActiveTag]    = useState<string>("");
  const [searchQuery,  setSearchQuery]  = useState<string>("");
  const [quickAddProduct, setQuickAddProduct] = useState<Product | null>(null);

  // Read URL → state
  useEffect(() => {
    const p = new URLSearchParams(searchString);
    const f = (p.get("filter") as AudienceFilter) || "all";
    setActiveFilter(AUDIENCE_FILTERS.some(x => x.value === f) ? f : "all");
    const t = p.get("tag") || "";
    setActiveTag(t);
    const q = p.get("q") || "";
    setSearchQuery(q);
  }, [searchString]);

  // Write state → URL
  const pushURL = useCallback((filter: AudienceFilter, tag: string, query: string) => {
    const p = new URLSearchParams();
    if (filter !== "all") p.set("filter", filter);
    if (tag)   p.set("tag", tag);
    if (query) p.set("q", query);
    const qs = p.toString();
    navigate(qs ? `/shop?${qs}` : "/shop", { replace: true });
  }, [navigate]);

  const handleFilterChange = (f: AudienceFilter) => pushURL(f, "", searchQuery);
  const handleTagDrillDown = (tag: string)        => pushURL("all", tag, "");
  const handleBackToAll    = ()                   => pushURL("all", "", "");
  const handleSearchChange = (q: string) => {
    pushURL(activeFilter, q ? "" : activeTag, q);
  };

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  // Products for audience-filtered / search views
  const flatProducts = useMemo(() => {
    if (!products) return [];
    let result = products;
    if (activeFilter !== "all") {
      const kw: Record<string, string> = { kids: "kids", adults: "adult", couples: "couple" };
      const keyword = kw[activeFilter] || activeFilter;
      result = result.filter(p => p.tagNames?.some(t => t.toLowerCase().includes(keyword)));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.sku         && p.sku.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q))
      );
    }
    return result;
  }, [products, activeFilter, searchQuery]);

  // Products for tag drill-down
  const tagProducts = useMemo(() => {
    if (!products || !activeTag) return [];
    const tagLower = activeTag.toLowerCase();
    return products.filter(p => p.tagNames?.some(t => t.toLowerCase() === tagLower));
  }, [products, activeTag]);

  // Compute tag sections (all + shown slice)
  const tagSections = useMemo(() => {
    if (!products) return [];
    return TAG_SECTIONS.map(s => {
      const tagLower = s.tag.toLowerCase();
      const all = products.filter(p => p.tagNames?.some(t => t.toLowerCase() === tagLower));
      return { ...s, all, shown: all.slice(0, s.maxShown) };
    });
  }, [products]);

  const isAllView = activeFilter === "all" && !activeTag && !searchQuery.trim();
  const isTagView = !!activeTag && !searchQuery.trim();

  const tagLabel = TAG_SECTIONS.find(s => s.tag.toLowerCase() === activeTag.toLowerCase())?.label ?? activeTag;

  return (
    <div className="pb-20 md:pb-8">
      <SEO
        title="Shop All Products"
        description="Browse our complete collection of personalised luxury towels, blankets & bathrobes. Buy 2 Get 1 Free."
        path="/shop"
      />

      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search products by name, SKU..."
              value={searchQuery}
              onChange={e => handleSearchChange(e.target.value)}
              className="pl-9 pr-9"
              data-testid="input-search-products"
            />
            {searchQuery && (
              <button
                onClick={() => handleSearchChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                data-testid="button-clear-search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            <SlidersHorizontal className="w-4 h-4 shrink-0 text-muted-foreground" />
            {AUDIENCE_FILTERS.map(f => (
              <Button
                key={f.value}
                variant={(activeFilter === f.value && !activeTag && !searchQuery) ? "default" : "outline"}
                size="sm"
                onClick={() => handleFilterChange(f.value)}
                className="shrink-0"
                data-testid={`filter-${f.value}`}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4">
        {isLoading ? (
          isAllView ? <TagSectionsSkeleton /> : <GridSkeleton />
        ) : isAllView ? (
          <div className="space-y-8">
            {tagSections.every(s => s.all.length === 0) ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground">No products found.</p>
              </div>
            ) : tagSections.map(section => (
              <section
                key={section.tag}
                data-testid={`section-${section.tag.replace(/\s+/g, "-")}`}
                className={section.all.length === 0 ? "hidden" : undefined}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h2
                      className="text-base font-semibold"
                      data-testid={`text-section-${section.tag.replace(/\s+/g, "-")}`}
                    >
                      {section.label}
                    </h2>
                    <Badge
                      variant="secondary"
                      className="text-xs no-default-hover-elevate no-default-active-elevate"
                    >
                      {section.all.length}
                    </Badge>
                  </div>
                  {section.all.length > section.maxShown && (
                    <button
                      onClick={() => handleTagDrillDown(section.tag)}
                      className="flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
                      data-testid={`link-see-all-${section.tag.replace(/\s+/g, "-")}`}
                    >
                      See all {section.all.length}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex gap-3 overflow-x-auto scrollbar-none -mx-4 px-4 pb-2">
                  {section.shown.map(product => (
                    <div key={product.id} className="shrink-0 w-44 sm:w-52">
                      <ProductCardNew product={product} onQuickAdd={setQuickAddProduct} />
                    </div>
                  ))}

                  {section.all.length > section.maxShown && (
                    <div className="shrink-0 w-28 flex items-center justify-center">
                      <button
                        onClick={() => handleTagDrillDown(section.tag)}
                        className="flex flex-col items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
                        data-testid={`card-see-more-${section.tag.replace(/\s+/g, "-")}`}
                      >
                        <div className="w-11 h-11 rounded-full border-2 border-current flex items-center justify-center">
                          <ChevronRight className="w-4.5 h-4.5" />
                        </div>
                        <span className="text-xs font-medium text-center leading-tight">
                          +{section.all.length - section.maxShown} more
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </section>
            ))}
          </div>
        ) : isTagView ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <button
                onClick={handleBackToAll}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                data-testid="button-back-to-all"
              >
                <ArrowLeft className="w-4 h-4" />
                All
              </button>
              <h2 className="text-base font-semibold" data-testid="text-tag-view-heading">
                {tagLabel} — {tagProducts.length} products
              </h2>
            </div>

            {tagProducts.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground">No products found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {tagProducts.map(product => (
                  <ProductCardNew key={product.id} product={product} onQuickAdd={setQuickAddProduct} />
                ))}
              </div>
            )}
          </div>
        ) : (
          flatProducts.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground">
                {searchQuery.trim()
                  ? `No products found for "${searchQuery}"`
                  : "No products found for this filter."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {flatProducts.map(product => (
                <ProductCardNew key={product.id} product={product} onQuickAdd={setQuickAddProduct} />
              ))}
            </div>
          )
        )}
      </div>

      <QuickAddSheet
        product={quickAddProduct}
        open={!!quickAddProduct}
        onOpenChange={open => !open && setQuickAddProduct(null)}
      />
    </div>
  );
}
