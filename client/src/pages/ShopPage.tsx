import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch, useLocation } from "wouter";
import { SlidersHorizontal, Search, X, ChevronRight, ChevronLeft, ArrowLeft, ChevronDown, Check } from "lucide-react";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

interface MultiSelectDropdownProps {
  label: string;
  options: { label: string; value: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  counts?: Record<string, number>;
  testIdPrefix: string;
}

function MultiSelectDropdown({ label, options, selected, onToggle, onClear, counts, testIdPrefix }: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  if (options.length === 0) return null;

  const isActive = selected.length > 0;
  const buttonLabel = selected.length === 0
    ? label
    : selected.length === 1
      ? (options.find(o => o.value === selected[0])?.label ?? selected[0])
      : `${label} (${selected.length})`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={isActive ? "default" : "outline"}
          size="sm"
          className="shrink-0 h-8 px-3 text-xs gap-1.5"
          data-testid={`dropdown-${testIdPrefix}`}
        >
          {buttonLabel}
          <ChevronDown className="w-3 h-3 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-2" align="start">
        <div className="max-h-64 overflow-y-auto space-y-0.5">
          {options.map(opt => {
            const checked = selected.includes(opt.value);
            const count = counts?.[opt.value];
            return (
              <button
                key={opt.value}
                onClick={() => onToggle(opt.value)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left transition-colors hover:bg-muted ${checked ? "text-primary font-medium" : ""}`}
                data-testid={`${testIdPrefix}-option-${opt.value}`}
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${checked ? "bg-primary border-primary" : "border-input"}`}>
                  {checked && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                </div>
                <span className="flex-1 capitalize">{opt.label}</span>
                {count !== undefined && (
                  <span className="text-xs text-muted-foreground">{count}</span>
                )}
              </button>
            );
          })}
        </div>
        {isActive && (
          <div className="border-t mt-2 pt-2">
            <button
              onClick={() => { onClear(); setOpen(false); }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left px-2"
              data-testid={`${testIdPrefix}-clear`}
            >
              Clear
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default function ShopPage() {
  const searchString = useSearch();
  const [, navigate] = useLocation();

  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [activeGenders, setActiveGenders] = useState<string[]>([]);
  const [activeThemes,  setActiveThemes]  = useState<string[]>([]);
  const [activeStyles,  setActiveStyles]  = useState<string[]>([]);
  const [activeTag,     setActiveTag]     = useState<string>("");
  const [searchQuery,   setSearchQuery]   = useState<string>("");
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
    return (attributes?.genders ?? []).map(g => ({
      label: g.name.charAt(0).toUpperCase() + g.name.slice(1),
      value: g.name,
    }));
  }, [attributes]);

  const themeOptions = useMemo(() => {
    return (attributes?.themes ?? []).map(t => ({
      label: t.name.charAt(0).toUpperCase() + t.name.slice(1),
      value: t.name,
    }));
  }, [attributes]);

  const styleOptions = useMemo(() => {
    return (attributes?.styles ?? []).map(s => ({
      label: s.name.charAt(0).toUpperCase() + s.name.slice(1),
      value: s.name,
    }));
  }, [attributes]);

  // Read URL → state
  useEffect(() => {
    const p = new URLSearchParams(searchString);
    const f = p.get("filter") || "all";
    setActiveFilter(audienceFilters.length > 1 && audienceFilters.some(x => x.value === f) ? f : "all");
    const g = p.get("gender");
    setActiveGenders(g ? g.split(",").filter(Boolean) : []);
    const t = p.get("theme");
    setActiveThemes(t ? t.split(",").filter(Boolean) : []);
    const s = p.get("style");
    setActiveStyles(s ? s.split(",").filter(Boolean) : []);
    setActiveTag(p.get("tag") || "");
    setSearchQuery(p.get("q") || "");
  }, [searchString, audienceFilters]);

  // Write state → URL
  const pushURL = useCallback((
    filter: string,
    genders: string[],
    themes: string[],
    styles: string[],
    tag: string,
    query: string,
  ) => {
    const p = new URLSearchParams();
    if (filter !== "all") p.set("filter", filter);
    if (genders.length) p.set("gender", genders.join(","));
    if (themes.length)  p.set("theme",  themes.join(","));
    if (styles.length)  p.set("style",  styles.join(","));
    if (tag)   p.set("tag", tag);
    if (query) p.set("q", query);
    const qs = p.toString();
    navigate(qs ? `/shop?${qs}` : "/shop", { replace: true });
  }, [navigate]);

  const handleFilterChange = (f: string) => pushURL(f, activeGenders, activeThemes, activeStyles, "", searchQuery);

  const toggleGender = (g: string) => {
    const next = activeGenders.includes(g) ? activeGenders.filter(x => x !== g) : [...activeGenders, g];
    pushURL(activeFilter, next, activeThemes, activeStyles, "", searchQuery);
  };
  const toggleTheme = (t: string) => {
    const next = activeThemes.includes(t) ? activeThemes.filter(x => x !== t) : [...activeThemes, t];
    pushURL(activeFilter, activeGenders, next, activeStyles, "", searchQuery);
  };
  const toggleStyle = (s: string) => {
    const next = activeStyles.includes(s) ? activeStyles.filter(x => x !== s) : [...activeStyles, s];
    pushURL(activeFilter, activeGenders, activeThemes, next, "", searchQuery);
  };

  const handleTagDrillDown  = (tag: string) => pushURL("all", [], [], [], tag, "");
  const handleBackToAll     = () => pushURL("all", [], [], [], "", "");
  const handleSearchChange  = (q: string) => {
    pushURL(activeFilter, activeGenders, activeThemes, activeStyles, q ? "" : activeTag, q);
  };

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: shopSectionsConfig } = useQuery<{ value: ShopSection[] }>({
    queryKey: ["/api/site-config", "shop-sections"],
    queryFn: () => fetch("/api/site-config/shop-sections").then(r => r.ok ? r.json() : null),
  });
  const shopSections: ShopSection[] = useMemo(() => {
    const raw = shopSectionsConfig?.value;
    if (!Array.isArray(raw) || raw.length === 0) return [];
    return raw.map((s): ShopSection => ({
      ...s,
      ageGroups: s.ageGroups ?? (s as typeof s & { audiences?: string[] }).audiences ?? [],
    }));
  }, [shopSectionsConfig]);

  // Shared predicate: apply all attribute filters client-side (OR within each dimension)
  const attributeFilteredProducts = useMemo(() => {
    if (!products) return [];
    let result = products;
    if (activeFilter !== "all") result = result.filter(p => (p.ageGroups ?? []).some(a => a.toLowerCase() === activeFilter.toLowerCase()));
    if (activeGenders.length)   result = result.filter(p => (p.genders ?? []).some(g => activeGenders.includes(g.toLowerCase())));
    if (activeThemes.length)    result = result.filter(p => (p.themes  ?? []).some(t => activeThemes.includes(t.toLowerCase())));
    if (activeStyles.length)    result = result.filter(p => (p.styles  ?? []).some(s => activeStyles.includes(s.toLowerCase())));
    return result;
  }, [products, activeFilter, activeGenders, activeThemes, activeStyles]);

  // Count bases: each dimension counts with all OTHER filters applied
  const countBaseAudience = useMemo(() => {
    if (!products) return [];
    let r = products;
    if (activeGenders.length) r = r.filter(p => (p.genders ?? []).some(g => activeGenders.includes(g.toLowerCase())));
    if (activeThemes.length)  r = r.filter(p => (p.themes  ?? []).some(t => activeThemes.includes(t.toLowerCase())));
    if (activeStyles.length)  r = r.filter(p => (p.styles  ?? []).some(s => activeStyles.includes(s.toLowerCase())));
    return r;
  }, [products, activeGenders, activeThemes, activeStyles]);

  const countBaseGender = useMemo(() => {
    if (!products) return [];
    let r = products;
    if (activeFilter !== "all") r = r.filter(p => (p.ageGroups ?? []).some(a => a.toLowerCase() === activeFilter.toLowerCase()));
    if (activeThemes.length)    r = r.filter(p => (p.themes  ?? []).some(t => activeThemes.includes(t.toLowerCase())));
    if (activeStyles.length)    r = r.filter(p => (p.styles  ?? []).some(s => activeStyles.includes(s.toLowerCase())));
    return r;
  }, [products, activeFilter, activeThemes, activeStyles]);

  const countBaseTheme = useMemo(() => {
    if (!products) return [];
    let r = products;
    if (activeFilter !== "all") r = r.filter(p => (p.ageGroups ?? []).some(a => a.toLowerCase() === activeFilter.toLowerCase()));
    if (activeGenders.length)   r = r.filter(p => (p.genders ?? []).some(g => activeGenders.includes(g.toLowerCase())));
    if (activeStyles.length)    r = r.filter(p => (p.styles  ?? []).some(s => activeStyles.includes(s.toLowerCase())));
    return r;
  }, [products, activeFilter, activeGenders, activeStyles]);

  const countBaseStyle = useMemo(() => {
    if (!products) return [];
    let r = products;
    if (activeFilter !== "all") r = r.filter(p => (p.ageGroups ?? []).some(a => a.toLowerCase() === activeFilter.toLowerCase()));
    if (activeGenders.length)   r = r.filter(p => (p.genders ?? []).some(g => activeGenders.includes(g.toLowerCase())));
    if (activeThemes.length)    r = r.filter(p => (p.themes  ?? []).some(t => activeThemes.includes(t.toLowerCase())));
    return r;
  }, [products, activeFilter, activeGenders, activeThemes]);

  const audienceCounts = useMemo(() => {
    const map: Record<string, number> = { all: countBaseAudience.length };
    for (const f of audienceFilters) {
      if (f.value === "all") continue;
      map[f.value] = countBaseAudience.filter(p => (p.ageGroups ?? []).some(a => a.toLowerCase() === f.value)).length;
    }
    return map;
  }, [countBaseAudience, audienceFilters]);

  const genderCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const f of genderOptions) {
      map[f.value] = countBaseGender.filter(p => (p.genders ?? []).some(g => g.toLowerCase() === f.value)).length;
    }
    return map;
  }, [countBaseGender, genderOptions]);

  const themeCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const f of themeOptions) {
      map[f.value] = countBaseTheme.filter(p => (p.themes ?? []).some(t => t.toLowerCase() === f.value)).length;
    }
    return map;
  }, [countBaseTheme, themeOptions]);

  const styleCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const f of styleOptions) {
      map[f.value] = countBaseStyle.filter(p => (p.styles ?? []).some(s => s.toLowerCase() === f.value)).length;
    }
    return map;
  }, [countBaseStyle, styleOptions]);

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

  // Products for tag drill-down
  const tagProducts = useMemo(() => {
    if (!activeTag) return [];
    const section = shopSections.find(s => s.tag.toLowerCase() === activeTag.toLowerCase());
    if (section) {
      let all = attributeFilteredProducts;
      if (section.ageGroups?.length) all = all.filter(p => (p.ageGroups ?? []).some(a => section.ageGroups!.includes(a)));
      if (section.genders?.length)   all = all.filter(p => (p.genders   ?? []).some(g => section.genders!.includes(g)));
      if (section.themes?.length)    all = all.filter(p => (p.themes    ?? []).some(t => section.themes!.includes(t)));
      if (section.styles?.length)    all = all.filter(p => (p.styles    ?? []).some(st => section.styles!.includes(st)));
      return all;
    }
    const tagLower = activeTag.toLowerCase();
    return attributeFilteredProducts.filter(p => p.tagNames?.some(t => t.toLowerCase() === tagLower));
  }, [attributeFilteredProducts, activeTag, shopSections]);

  // Compute tag sections
  const tagSections = useMemo(() => {
    if (!products) return [];
    return shopSections
      .filter(s => s.enabled)
      .filter(s => activeFilter === "all" || (s.ageGroups ?? []).includes(activeFilter))
      .map(s => {
        let all = attributeFilteredProducts;
        if (s.ageGroups?.length) all = all.filter(p => (p.ageGroups ?? []).some(a => s.ageGroups!.includes(a)));
        if (s.genders?.length)   all = all.filter(p => (p.genders   ?? []).some(g => s.genders!.includes(g)));
        if (s.themes?.length)    all = all.filter(p => (p.themes    ?? []).some(t => s.themes!.includes(t)));
        if (s.styles?.length)    all = all.filter(p => (p.styles    ?? []).some(st => s.styles!.includes(st)));
        return { ...s, all, shown: all.slice(0, s.maxShown) };
      });
  }, [attributeFilteredProducts, shopSections, products, activeFilter]);

  const isAllView = !activeTag && !searchQuery.trim();
  const isTagView = !!activeTag && !searchQuery.trim();

  const tagLabel = shopSections.find(s => s.tag.toLowerCase() === activeTag.toLowerCase())?.label ?? activeTag;

  const hasAttributeFilters = activeFilter !== "all" || activeGenders.length > 0 || activeThemes.length > 0 || activeStyles.length > 0;

  const handleClearFilters = () => pushURL("all", [], [], [], activeTag, searchQuery);

  return (
    <div className="pb-20 md:pb-8">
      <SEO
        title="Shop All Products"
        description="Browse our complete collection of personalised luxury towels, blankets & bathrobes. Buy 2 Get 1 Free."
        path="/shop"
      />

      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 space-y-2">
          {/* Row 1: Search */}
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

          {/* Row 2: Audience chips */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            <SlidersHorizontal className={`w-4 h-4 shrink-0 ${hasAttributeFilters ? "text-primary" : "text-muted-foreground"}`} />
            {audienceFilters.map(f => {
              const count = audienceCounts[f.value];
              return (
                <Button
                  key={f.value}
                  variant={(activeFilter === f.value && !activeTag && !searchQuery) ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleFilterChange(f.value)}
                  className="shrink-0"
                  data-testid={`filter-${f.value}`}
                >
                  {f.label}{count !== undefined ? ` (${count})` : ""}
                </Button>
              );
            })}
          </div>

          {/* Row 3: Multi-select dropdowns for Gender / Theme / Style */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            <MultiSelectDropdown
              label="Gender"
              options={genderOptions}
              selected={activeGenders}
              onToggle={toggleGender}
              onClear={() => pushURL(activeFilter, [], activeThemes, activeStyles, activeTag, searchQuery)}
              counts={genderCounts}
              testIdPrefix="filter-gender"
            />
            <MultiSelectDropdown
              label="Theme"
              options={themeOptions}
              selected={activeThemes}
              onToggle={toggleTheme}
              onClear={() => pushURL(activeFilter, activeGenders, [], activeStyles, activeTag, searchQuery)}
              counts={themeCounts}
              testIdPrefix="filter-theme"
            />
            <MultiSelectDropdown
              label="Style"
              options={styleOptions}
              selected={activeStyles}
              onToggle={toggleStyle}
              onClear={() => pushURL(activeFilter, activeGenders, activeThemes, [], activeTag, searchQuery)}
              counts={styleCounts}
              testIdPrefix="filter-style"
            />
            {hasAttributeFilters && (
              <button
                onClick={handleClearFilters}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors shrink-0 ml-1"
                data-testid="button-clear-filters"
              >
                Clear all
              </button>
            )}
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
                      View all {section.all.length}
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
