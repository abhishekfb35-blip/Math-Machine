import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch, useLocation } from "wouter";
import { SlidersHorizontal, Search, X, ChevronRight, ChevronLeft, ArrowLeft } from "lucide-react";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCardNew from "@/components/ProductCardNew";
import QuickAddSheet from "@/components/QuickAddSheet";
import type { Product, Attributes } from "@shared/types";
import type { ShopSection } from "@/lib/siteConfigDefaults";

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

function ScrollRow({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", update); ro.disconnect(); };
  }, [update]);

  const scroll = (dir: "left" | "right") => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -320 : 320, behavior: "smooth" });
  };

  return (
    <div className="relative">
      {canLeft && (
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-background/90 border shadow-md flex items-center justify-center hover:bg-muted transition-colors"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}
      <div
        ref={ref}
        className="flex gap-3 overflow-x-auto scrollbar-none -mx-4 px-4 pb-2"
      >
        {children}
      </div>
      {canRight && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-background/90 border shadow-md flex items-center justify-center hover:bg-muted transition-colors"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

interface FilterRowProps {
  label: string;
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
  testIdPrefix: string;
}

function FilterRow({ label, options, value, onChange, testIdPrefix }: FilterRowProps) {
  if (options.length === 0) return null;
  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
      <span className="text-xs text-muted-foreground shrink-0 font-medium">{label}</span>
      {options.map(f => (
        <Button
          key={f.value}
          variant={value === f.value ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(f.value)}
          className="shrink-0 h-7 px-2.5 text-xs"
          data-testid={`${testIdPrefix}-${f.value}`}
        >
          {f.label}
        </Button>
      ))}
    </div>
  );
}

export default function ShopPage() {
  const searchString = useSearch();
  const [, navigate] = useLocation();

  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [activeGender, setActiveGender] = useState<string>("all");
  const [activeTheme,  setActiveTheme]  = useState<string>("all");
  const [activeStyle,  setActiveStyle]  = useState<string>("all");
  const [activeTag,    setActiveTag]    = useState<string>("");
  const [searchQuery,  setSearchQuery]  = useState<string>("");
  const [quickAddProduct, setQuickAddProduct] = useState<Product | null>(null);

  const { data: attributes } = useQuery<Attributes>({ queryKey: ["/api/attributes"] });

  const audienceFilters = useMemo(() => {
    const ags = attributes?.ageGroups ?? [];
    if (ags.length === 0) return [];
    return [
      { label: "All", value: "all" },
      ...ags.map(ag => ({ label: ag.name.charAt(0).toUpperCase() + ag.name.slice(1), value: ag.name })),
    ];
  }, [attributes]);

  const genderOptions = useMemo(() => {
    const gs = attributes?.genders ?? [];
    if (gs.length === 0) return [];
    return [
      { label: "All", value: "all" },
      ...gs.map(g => ({ label: g.name.charAt(0).toUpperCase() + g.name.slice(1), value: g.name })),
    ];
  }, [attributes]);

  const themeOptions = useMemo(() => {
    const ts = attributes?.themes ?? [];
    if (ts.length === 0) return [];
    return [
      { label: "All", value: "all" },
      ...ts.map(t => ({ label: t.name.charAt(0).toUpperCase() + t.name.slice(1), value: t.name })),
    ];
  }, [attributes]);

  const styleOptions = useMemo(() => {
    const ss = attributes?.styles ?? [];
    if (ss.length === 0) return [];
    return [
      { label: "All", value: "all" },
      ...ss.map(s => ({ label: s.name.charAt(0).toUpperCase() + s.name.slice(1), value: s.name })),
    ];
  }, [attributes]);

  // Read URL → state
  useEffect(() => {
    const p = new URLSearchParams(searchString);
    const f = p.get("filter") || "all";
    setActiveFilter(audienceFilters.length > 1 && audienceFilters.some(x => x.value === f) ? f : "all");
    setActiveGender(p.get("gender") || "all");
    setActiveTheme(p.get("theme") || "all");
    setActiveStyle(p.get("style") || "all");
    setActiveTag(p.get("tag") || "");
    setSearchQuery(p.get("q") || "");
  }, [searchString, audienceFilters]);

  // Write state → URL
  const pushURL = useCallback((
    filter: string,
    gender: string,
    theme: string,
    style: string,
    tag: string,
    query: string,
  ) => {
    const p = new URLSearchParams();
    if (filter !== "all") p.set("filter", filter);
    if (gender !== "all") p.set("gender", gender);
    if (theme  !== "all") p.set("theme", theme);
    if (style  !== "all") p.set("style", style);
    if (tag)   p.set("tag", tag);
    if (query) p.set("q", query);
    const qs = p.toString();
    navigate(qs ? `/shop?${qs}` : "/shop", { replace: true });
  }, [navigate]);

  const handleFilterChange  = (f: string) => pushURL(f, activeGender, activeTheme, activeStyle, "", searchQuery);
  const handleGenderChange  = (g: string) => pushURL(activeFilter, g, activeTheme, activeStyle, "", searchQuery);
  const handleThemeChange   = (t: string) => pushURL(activeFilter, activeGender, t, activeStyle, "", searchQuery);
  const handleStyleChange   = (s: string) => pushURL(activeFilter, activeGender, activeTheme, s, "", searchQuery);
  const handleTagDrillDown  = (tag: string) => pushURL("all", "all", "all", "all", tag, "");
  const handleBackToAll     = () => pushURL("all", "all", "all", "all", "", "");
  const handleSearchChange  = (q: string) => {
    pushURL(activeFilter, activeGender, activeTheme, activeStyle, q ? "" : activeTag, q);
  };

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: shopSectionsConfig } = useQuery<{ value: ShopSection[] }>({
    queryKey: ["/api/site-config", "shop-sections"],
    queryFn: () => fetch("/api/site-config/shop-sections").then(r => r.ok ? r.json() : null),
  });
  const shopSections: ShopSection[] = Array.isArray(shopSectionsConfig?.value)
    ? shopSectionsConfig.value
    : [];

  // Shared predicate: apply all attribute filters client-side
  const attributeFilteredProducts = useMemo(() => {
    if (!products) return [];
    let result = products;
    if (activeFilter !== "all") result = result.filter(p => (p.ageGroups ?? []).some(a => a.toLowerCase() === activeFilter.toLowerCase()));
    if (activeGender !== "all") result = result.filter(p => (p.genders   ?? []).some(g => g.toLowerCase() === activeGender.toLowerCase()));
    if (activeTheme  !== "all") result = result.filter(p => (p.themes    ?? []).some(t => t.toLowerCase() === activeTheme.toLowerCase()));
    if (activeStyle  !== "all") result = result.filter(p => (p.styles    ?? []).some(s => s.toLowerCase() === activeStyle.toLowerCase()));
    return result;
  }, [products, activeFilter, activeGender, activeTheme, activeStyle]);

  // Products for search views
  const flatProducts = useMemo(() => {
    let result = attributeFilteredProducts;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.sku         && p.sku.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q))
      );
    }
    return result;
  }, [attributeFilteredProducts, searchQuery]);

  // Products for tag drill-down (still respects attribute filters)
  const tagProducts = useMemo(() => {
    if (!activeTag) return [];
    const tagLower = activeTag.toLowerCase();
    return attributeFilteredProducts.filter(p => p.tagNames?.some(t => t.toLowerCase() === tagLower));
  }, [attributeFilteredProducts, activeTag]);

  // Compute tag sections filtered by all active attributes
  const tagSections = useMemo(() => {
    if (!products) return [];
    return shopSections
      .filter(s => s.enabled)
      .filter(s => activeFilter === "all" || (s.audiences ?? []).includes(activeFilter))
      .map(s => {
        const tagLower = s.tag.toLowerCase();
        const all = attributeFilteredProducts.filter(p => p.tagNames?.some(t => t.toLowerCase() === tagLower));
        return { ...s, all, shown: all.slice(0, s.maxShown) };
      });
  }, [attributeFilteredProducts, shopSections, products, activeFilter]);

  const isAllView = !activeTag && !searchQuery.trim();
  const isTagView = !!activeTag && !searchQuery.trim();

  const tagLabel = shopSections.find(s => s.tag.toLowerCase() === activeTag.toLowerCase())?.label ?? activeTag;

  const hasAttributeFilters = activeGender !== "all" || activeTheme !== "all" || activeStyle !== "all";

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
            <SlidersHorizontal className={`w-4 h-4 shrink-0 ${hasAttributeFilters ? "text-primary" : "text-muted-foreground"}`} />
            {audienceFilters.map(f => (
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
          <FilterRow
            label="Gender"
            options={genderOptions}
            value={activeGender}
            onChange={handleGenderChange}
            testIdPrefix="filter-gender"
          />
          <FilterRow
            label="Theme"
            options={themeOptions}
            value={activeTheme}
            onChange={handleThemeChange}
            testIdPrefix="filter-theme"
          />
          <FilterRow
            label="Style"
            options={styleOptions}
            value={activeStyle}
            onChange={handleStyleChange}
            testIdPrefix="filter-style"
          />
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

                <ScrollRow>
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
                </ScrollRow>
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
