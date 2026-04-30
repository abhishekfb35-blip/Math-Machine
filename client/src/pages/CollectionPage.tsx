import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link, useSearch, useLocation } from "wouter";
import { ChevronRight, ChevronLeft, ArrowLeft, SlidersHorizontal } from "lucide-react";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCardNew from "@/components/ProductCardNew";
import QuickAddSheet from "@/components/QuickAddSheet";
import towelsImg from "@/assets/images/towels-collection.png";
import blanketsImg from "@/assets/images/blankets-collection.png";
import bathrobesImg from "@/assets/images/bathrobes-collection.png";
import type { Category, Product, Attributes } from "@shared/types";

// URL-path display metadata — keyed by route segment, not by attribute value.
// "couples" is a marketing URL with no matching DB age group.
// Age group routes (kids/adults/teens/infant) derive their display text here;
// unknown routes fall back to a generic label.
const audienceLabels: Record<string, string> = {
  couples: "For Couples",
};

const audienceDescriptions: Record<string, string> = {
  couples: "Matching sets perfect for weddings, anniversaries & gifting",
};

interface ProductTypeConfig {
  type: string;
  label: string;
  image: string;
  description: string;
}

const productTypeConfigs: Record<string, ProductTypeConfig> = {
  towel: { type: "towel", label: "Towels", image: towelsImg, description: "Soft, absorbent & beautifully embroidered" },
  blanket: { type: "blanket", label: "Blankets", image: blanketsImg, description: "Ultra-soft personalised AC blankets" },
  bathrobe: { type: "bathrobe", label: "Bathrobes", image: bathrobesImg, description: "Plush terry cotton, spa-day comfort" },
};



const PRODUCTS_PER_ROW = 10;

function ScrollableProductRow({
  products,
  title,
  totalCount,
  categorySlug,
  onQuickAdd,
}: {
  products: Product[];
  title: string;
  totalCount: number;
  categorySlug: string;
  onQuickAdd: (product: Product) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, []);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollAmount = el.clientWidth * 0.75;
    el.scrollBy({ left: direction === "left" ? -scrollAmount : scrollAmount, behavior: "smooth" });
    setTimeout(checkScroll, 400);
  };

  const showSeeAll = totalCount > PRODUCTS_PER_ROW;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h3 className="text-sm md:text-base font-semibold" data-testid={`text-row-title-${categorySlug}`}>
            {title}
          </h3>
          <Badge variant="secondary" className="text-[10px] no-default-hover-elevate no-default-active-elevate">
            {totalCount}
          </Badge>
        </div>
        {showSeeAll && (
          <Link href={`/category/${categorySlug}`}>
            <span
              className="text-xs font-medium text-primary flex items-center gap-0.5 cursor-pointer"
              data-testid={`link-seeall-${categorySlug}`}
            >
              See All <ChevronRight className="w-3 h-3" />
            </span>
          </Link>
        )}
      </div>
      <div className="relative group/scroll">
        {canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-background/90 backdrop-blur-sm border rounded-full p-1.5 shadow-sm hidden md:flex items-center justify-center"
            aria-label="Scroll left"
            data-testid={`button-scroll-left-${categorySlug}`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-3 overflow-x-auto scrollbar-none pb-1 snap-x snap-mandatory"
          data-testid={`scroll-row-${categorySlug}`}
        >
          {products.map((product) => (
            <div key={product.id} className="w-[42vw] sm:w-[30vw] md:w-[22vw] lg:w-[18vw] shrink-0 snap-start">
              <ProductCardNew product={product} onQuickAdd={onQuickAdd} />
            </div>
          ))}
        </div>
        {canScrollRight && (
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-background/90 backdrop-blur-sm border rounded-full p-1.5 shadow-sm hidden md:flex items-center justify-center"
            aria-label="Scroll right"
            data-testid={`button-scroll-right-${categorySlug}`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function ProductTypeSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="shrink-0 w-[140px] md:w-[200px] overflow-hidden">
          <Skeleton className="h-24 md:h-32" />
          <div className="p-2 space-y-1">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        </Card>
      ))}
    </div>
  );
}

function ProductRowSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-5 w-40" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="shrink-0 w-[42vw] sm:w-[30vw] md:w-[22vw] lg:w-[18vw] overflow-hidden">
            <Skeleton className="aspect-square" />
            <div className="p-3 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

interface FilterRowProps {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
  testIdPrefix: string;
  counts?: Record<string, number>;
}

function FilterRow({ options, value, onChange, testIdPrefix, counts }: FilterRowProps) {
  if (options.length === 0) return null;
  return (
    <>
      {options.map((f) => {
        const count = counts?.[f.value];
        return (
          <Button
            key={f.value}
            variant={value === f.value ? "default" : "outline"}
            size="sm"
            onClick={() => onChange(f.value)}
            className="shrink-0"
            data-testid={`${testIdPrefix}-${f.value}`}
          >
            {f.label}{count !== undefined ? ` (${count})` : ""}
          </Button>
        );
      })}
    </>
  );
}

export default function CollectionPage() {
  const params = useParams<{ audience: string }>();
  const searchString = useSearch();
  const [, navigate] = useLocation();

  // Use the raw URL param as-is. Invalid routes render empty product lists (no hardcoded fallback).
  const audience: string = params.audience || "";
  // Display strings derived from audience route segment.
  // Explicit entries exist only for "couples" (marketing URL). DB-backed age-group routes
  // (kids/adults/teens/infant) have their display text computed dynamically — no hardcoding.
  const audienceLabel = audienceLabels[audience] ?? (audience ? `For ${audience.charAt(0).toUpperCase() + audience.slice(1)}` : "Collection");
  const audienceDesc  = audienceDescriptions[audience] ?? "";
  const [quickAddProduct, setQuickAddProduct] = useState<Product | null>(null);

  const [genderFilter, setGenderFilter] = useState<string>("all");
  const [themeFilter,  setThemeFilter]  = useState<string>("all");
  const [styleFilter,  setStyleFilter]  = useState<string>("all");

  const { data: categories, isLoading: catLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: products, isLoading: prodLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: attributes } = useQuery<Attributes>({
    queryKey: ["/api/attributes"],
  });

  // Age group chips — navigate to different collection routes
  const ageGroupOptions = useMemo(() => {
    const ags = attributes?.ageGroups ?? [];
    return ags.map(ag => ({
      label: ag.name.charAt(0).toUpperCase() + ag.name.slice(1),
      value: ag.name.toLowerCase(),
    }));
  }, [attributes]);

  // Build filter option lists from attributes
  const genderOptions = useMemo(() => {
    const dbGenders = attributes?.genders ?? [];
    if (dbGenders.length === 0) return [];
    return [
      { label: "All", value: "all" },
      ...dbGenders.map(g => ({ label: g.name.charAt(0).toUpperCase() + g.name.slice(1), value: g.name })),
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

  // Sync URL → state
  useEffect(() => {
    const p = new URLSearchParams(searchString);
    setGenderFilter(p.get("gender") || "all");
    setThemeFilter(p.get("theme")  || "all");
    setStyleFilter(p.get("style")  || "all");
  }, [searchString]);

  // Write state → URL
  const pushURL = useCallback((gender: string, theme: string, style: string) => {
    const p = new URLSearchParams();
    if (gender !== "all") p.set("gender", gender);
    if (theme  !== "all") p.set("theme", theme);
    if (style  !== "all") p.set("style", style);
    const qs = p.toString();
    navigate(qs ? `/collection/${audience}?${qs}` : `/collection/${audience}`, { replace: true });
  }, [navigate, audience]);

  const handleGenderChange  = (g: string) => pushURL(g, themeFilter, styleFilter);
  const handleThemeChange   = (t: string) => pushURL(genderFilter, t, styleFilter);
  const handleStyleChange   = (s: string) => pushURL(genderFilter, themeFilter, s);
  const handleClearFilters  = () => pushURL("all", "all", "all");

  const isLoading = catLoading || prodLoading;

  // Base audience products before attribute filters (audience dimension only)
  const baseAudienceProducts = useMemo(() => {
    if (!products) return [];
    if (audience === "couples") return [...products];
    const audienceLower = audience.toLowerCase();
    const dbAgeGroupNames = (attributes?.ageGroups ?? []).map(ag => ag.name.toLowerCase());
    if (!dbAgeGroupNames.includes(audienceLower)) return [];
    return products.filter((p) => (p.ageGroups ?? []).some(ag => ag.toLowerCase() === audienceLower));
  }, [products, attributes, audience]);

  const audienceProducts = useMemo(() => {
    let filtered = baseAudienceProducts;
    if (genderFilter !== "all") filtered = filtered.filter((p) => (p.genders ?? []).some(g => g.toLowerCase() === genderFilter.toLowerCase()));
    if (themeFilter  !== "all") filtered = filtered.filter((p) => (p.themes  ?? []).some(t => t.toLowerCase() === themeFilter.toLowerCase()));
    if (styleFilter  !== "all") filtered = filtered.filter((p) => (p.styles  ?? []).some(s => s.toLowerCase() === styleFilter.toLowerCase()));
    return filtered;
  }, [baseAudienceProducts, genderFilter, themeFilter, styleFilter]);

  // Base sets for counting each filter dimension (all other filters applied)
  const countBaseGender = useMemo(() => {
    let r = baseAudienceProducts;
    if (themeFilter !== "all") r = r.filter(p => (p.themes ?? []).some(t => t.toLowerCase() === themeFilter.toLowerCase()));
    if (styleFilter !== "all") r = r.filter(p => (p.styles ?? []).some(s => s.toLowerCase() === styleFilter.toLowerCase()));
    return r;
  }, [baseAudienceProducts, themeFilter, styleFilter]);

  const countBaseTheme = useMemo(() => {
    let r = baseAudienceProducts;
    if (genderFilter !== "all") r = r.filter(p => (p.genders ?? []).some(g => g.toLowerCase() === genderFilter.toLowerCase()));
    if (styleFilter  !== "all") r = r.filter(p => (p.styles  ?? []).some(s => s.toLowerCase() === styleFilter.toLowerCase()));
    return r;
  }, [baseAudienceProducts, genderFilter, styleFilter]);

  const countBaseStyle = useMemo(() => {
    let r = baseAudienceProducts;
    if (genderFilter !== "all") r = r.filter(p => (p.genders ?? []).some(g => g.toLowerCase() === genderFilter.toLowerCase()));
    if (themeFilter  !== "all") r = r.filter(p => (p.themes  ?? []).some(t => t.toLowerCase() === themeFilter.toLowerCase()));
    return r;
  }, [baseAudienceProducts, genderFilter, themeFilter]);

  const genderCounts = useMemo(() => {
    const map: Record<string, number> = { all: countBaseGender.length };
    for (const f of genderOptions) {
      if (f.value === "all") continue;
      map[f.value] = countBaseGender.filter(p => (p.genders ?? []).some(g => g.toLowerCase() === f.value.toLowerCase())).length;
    }
    return map;
  }, [countBaseGender, genderOptions]);

  const themeCounts = useMemo(() => {
    const map: Record<string, number> = { all: countBaseTheme.length };
    for (const f of themeOptions) {
      if (f.value === "all") continue;
      map[f.value] = countBaseTheme.filter(p => (p.themes ?? []).some(t => t.toLowerCase() === f.value.toLowerCase())).length;
    }
    return map;
  }, [countBaseTheme, themeOptions]);

  const styleCounts = useMemo(() => {
    const map: Record<string, number> = { all: countBaseStyle.length };
    for (const f of styleOptions) {
      if (f.value === "all") continue;
      map[f.value] = countBaseStyle.filter(p => (p.styles ?? []).some(s => s.toLowerCase() === f.value.toLowerCase())).length;
    }
    return map;
  }, [countBaseStyle, styleOptions]);

  // Age group chips: count products for each age group with current attribute filters applied
  const ageGroupCounts = useMemo(() => {
    if (!products) return {} as Record<string, number>;
    const map: Record<string, number> = {};
    for (const f of ageGroupOptions) {
      let r = products.filter(p => (p.ageGroups ?? []).some(a => a.toLowerCase() === f.value.toLowerCase()));
      if (genderFilter !== "all") r = r.filter(p => (p.genders ?? []).some(g => g.toLowerCase() === genderFilter.toLowerCase()));
      if (themeFilter  !== "all") r = r.filter(p => (p.themes  ?? []).some(t => t.toLowerCase() === themeFilter.toLowerCase()));
      if (styleFilter  !== "all") r = r.filter(p => (p.styles  ?? []).some(s => s.toLowerCase() === styleFilter.toLowerCase()));
      map[f.value] = r.length;
    }
    return map;
  }, [products, ageGroupOptions, genderFilter, themeFilter, styleFilter]);

  const productTypeSections = useMemo(() => {
    const categoryOrder = ["towels", "blankets", "bathrobes"];
    const typeConfigMap: Record<string, ProductTypeConfig> = {
      towels: productTypeConfigs["towel"],
      blankets: productTypeConfigs["blanket"],
      bathrobes: productTypeConfigs["bathrobe"],
    };

    return categoryOrder
      .map((slug) => {
        const cat = categories?.find((c) => c.slug === slug);
        if (!cat) return null;
        const catProducts = audienceProducts.filter((p) => p.categoryId === cat.id);
        if (catProducts.length === 0) return null;
        return {
          type: slug,
          config: typeConfigMap[slug] || productTypeConfigs["towel"],
          categories: [cat],
          products: catProducts,
        };
      })
      .filter(Boolean) as { type: string; config: ProductTypeConfig; categories: Category[]; products: Product[] }[];
  }, [audienceProducts, categories]);

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const scrollToSection = (type: string) => {
    const el = sectionRefs.current[type];
    if (el) {
      const headerOffset = 80;
      const top = el.getBoundingClientRect().top + window.scrollY - headerOffset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  const hasFilters = genderFilter !== "all" || themeFilter !== "all" || styleFilter !== "all";

  return (
    <div className="pb-20 md:pb-8">
      <SEO
        title={audienceLabel}
        path={`/collection/${audience}`}
      />
      <div className="max-w-7xl mx-auto px-4 py-4 space-y-6">
        <div className="space-y-1">
          <Link href="/shop">
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground cursor-pointer" data-testid="link-back-shop">
              <ArrowLeft className="w-3 h-3" /> Back to Shop
            </span>
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold" data-testid="text-collection-title">
            {audienceLabel}
          </h1>
          <p className="text-sm text-muted-foreground" data-testid="text-collection-desc">
            {audienceDesc}
          </p>
        </div>

        <div className="space-y-2">
          {ageGroupOptions.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
              <SlidersHorizontal className={`w-4 h-4 shrink-0 ${hasFilters ? "text-primary" : "text-muted-foreground"}`} />
              {ageGroupOptions.map(f => {
                const count = ageGroupCounts[f.value];
                return (
                  <Button
                    key={f.value}
                    variant={audience === f.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      const p = new URLSearchParams();
                      if (genderFilter !== "all") p.set("gender", genderFilter);
                      if (themeFilter  !== "all") p.set("theme", themeFilter);
                      if (styleFilter  !== "all") p.set("style", styleFilter);
                      const qs = p.toString();
                      navigate(qs ? `/collection/${f.value}?${qs}` : `/collection/${f.value}`);
                    }}
                    className="shrink-0"
                    data-testid={`filter-agegroup-${f.value}`}
                  >
                    {f.label}{count !== undefined ? ` (${count})` : ""}
                  </Button>
                );
              })}
            </div>
          )}
          {genderOptions.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
              <span className="text-xs text-muted-foreground shrink-0 font-medium">Gender</span>
              <FilterRow
                options={genderOptions}
                value={genderFilter}
                onChange={handleGenderChange}
                testIdPrefix="filter-gender"
                counts={genderCounts}
              />
            </div>
          )}
          {themeOptions.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
              <span className="text-xs text-muted-foreground shrink-0 font-medium">Theme</span>
              <FilterRow
                options={themeOptions}
                value={themeFilter}
                onChange={handleThemeChange}
                testIdPrefix="filter-theme"
                counts={themeCounts}
              />
            </div>
          )}
          {styleOptions.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
              <span className="text-xs text-muted-foreground shrink-0 font-medium">Style</span>
              <FilterRow
                options={styleOptions}
                value={styleFilter}
                onChange={handleStyleChange}
                testIdPrefix="filter-style"
                counts={styleCounts}
              />
            </div>
          )}
          {hasFilters && (
            <div className="flex">
              <button
                onClick={handleClearFilters}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                data-testid="button-clear-filters"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        {isLoading ? (
          <>
            <ProductTypeSkeleton />
            <ProductRowSkeleton />
            <ProductRowSkeleton />
          </>
        ) : productTypeSections.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">No products found in this collection.</p>
          </div>
        ) : (
          <>
            <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
              {productTypeSections.map((section) => (
                <button
                  key={section.type}
                  onClick={() => scrollToSection(section.type)}
                  className="shrink-0 text-left group/card"
                  data-testid={`card-type-${section.type}`}
                >
                  <Card className="overflow-hidden w-[140px] md:w-[200px] hover-elevate">
                    <div className="relative h-24 md:h-32 overflow-hidden">
                      <img
                        src={section.config.image}
                        alt={section.config.label}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      <div className="absolute bottom-0 left-0 p-2">
                        <span className="text-sm md:text-base font-bold text-white">{section.config.label}</span>
                      </div>
                    </div>
                    <div className="p-2 space-y-0.5">
                      <p className="text-[10px] md:text-xs text-muted-foreground leading-tight line-clamp-2">
                        {section.config.description}
                      </p>
                      <p className="text-[10px] text-muted-foreground/70">{section.products.length} products</p>
                    </div>
                  </Card>
                </button>
              ))}
            </div>

            <div className="space-y-8">
              {productTypeSections.map((section) => (
                <section
                  key={section.type}
                  ref={(el) => { sectionRefs.current[section.type] = el; }}
                  className="space-y-5"
                  data-testid={`section-${section.type}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-6 w-1 rounded-full bg-primary" />
                    <h2 className="text-lg md:text-xl font-bold" data-testid={`text-section-heading-${section.type}`}>
                      {audienceLabel.replace(/^For /, "")}{" "}{section.config.label}
                    </h2>
                    <Badge variant="outline" className="text-[10px] no-default-hover-elevate no-default-active-elevate">
                      {section.products.length}
                    </Badge>
                  </div>

                  {section.categories.map((cat) => {
                    const catProducts = section.products.filter((p) => p.categoryId === cat.id);
                    if (catProducts.length === 0) return null;
                    const displayProducts = catProducts.slice(0, PRODUCTS_PER_ROW);
                    const showSubHeading = section.categories.length > 1;

                    return (
                      <div key={cat.id}>
                        {showSubHeading && (
                          <ScrollableProductRow
                            products={displayProducts}
                            title={cat.name}
                            totalCount={catProducts.length}
                            categorySlug={cat.slug}
                            onQuickAdd={setQuickAddProduct}
                          />
                        )}
                        {!showSubHeading && (
                          <ScrollableProductRow
                            products={displayProducts}
                            title=""
                            totalCount={catProducts.length}
                            categorySlug={cat.slug}
                            onQuickAdd={setQuickAddProduct}
                          />
                        )}
                      </div>
                    );
                  })}
                </section>
              ))}
            </div>
          </>
        )}
      </div>

      <QuickAddSheet
        product={quickAddProduct}
        open={!!quickAddProduct}
        onOpenChange={(open) => !open && setQuickAddProduct(null)}
      />
    </div>
  );
}
