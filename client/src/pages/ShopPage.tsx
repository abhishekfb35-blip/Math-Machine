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
import type { Product, Attributes, Category } from "@shared/types";
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

// Inertial drag-to-scroll row for desktop filter chips (Theme / Style)
function FilterScrollRow({ children, showTrack = false }: { children: React.ReactNode; showTrack?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [blockClicks, setBlockClicks] = useState(false);
  const [thumb, setThumb] = useState({ left: 0, width: 100 });
  const thumbRef = useRef({ left: 0, width: 100 });
  const isDraggingRef = useRef(false);
  const dragRef = useRef({ startX: 0, lastX: 0, scrollLeft: 0, moved: 0, vel: 0 });
  const animRef = useRef<number>(0);
  const isThumbDraggingRef = useRef(false);
  const thumbDragRef = useRef({ startX: 0, startScrollLeft: 0 });

  const updateEdgesAndThumb = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
    if (showTrack) {
      const ratio = el.scrollWidth > el.clientWidth ? el.clientWidth / el.scrollWidth : 1;
      const thumbW = Math.max(ratio * 100, 15);
      const scrollable = el.scrollWidth - el.clientWidth;
      const thumbL = scrollable > 0 ? (el.scrollLeft / scrollable) * (100 - thumbW) : 0;
      thumbRef.current = { left: thumbL, width: thumbW };
      setThumb({ left: thumbL, width: thumbW });
    }
  }, [showTrack]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    updateEdgesAndThumb();
    el.addEventListener("scroll", updateEdgesAndThumb, { passive: true });
    const ro = new ResizeObserver(updateEdgesAndThumb);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", updateEdgesAndThumb); ro.disconnect(); };
  }, [updateEdgesAndThumb]);

  // Document-level listeners handle both rail drag and thumb drag
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      // Thumb drag
      if (isThumbDraggingRef.current && ref.current && trackRef.current) {
        const trackW = trackRef.current.clientWidth;
        const el = ref.current;
        const thumbPx = (thumbRef.current.width / 100) * trackW;
        const scrollable = el.scrollWidth - el.clientWidth;
        const movableTrack = trackW - thumbPx;
        if (movableTrack > 0) {
          const dx = e.clientX - thumbDragRef.current.startX;
          el.scrollLeft = thumbDragRef.current.startScrollLeft + (dx / movableTrack) * scrollable;
        }
        return;
      }
      // Rail drag
      if (!isDraggingRef.current || !ref.current) return;
      dragRef.current.vel = e.clientX - dragRef.current.lastX;
      dragRef.current.moved += Math.abs(dragRef.current.vel);
      dragRef.current.lastX = e.clientX;
      ref.current.scrollLeft = dragRef.current.scrollLeft - (e.clientX - dragRef.current.startX);
    };

    const onMouseUp = () => {
      if (isThumbDraggingRef.current) {
        isThumbDraggingRef.current = false;
        return;
      }
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);
      if (dragRef.current.moved > 5) {
        setBlockClicks(true);
        setTimeout(() => setBlockClicks(false), 160);
        let vel = -dragRef.current.vel;
        const glide = () => {
          if (!ref.current || Math.abs(vel) < 0.5) return;
          ref.current.scrollLeft += vel;
          vel *= 0.92;
          animRef.current = requestAnimationFrame(glide);
        };
        cancelAnimationFrame(animRef.current);
        animRef.current = requestAnimationFrame(glide);
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!ref.current) return;
    cancelAnimationFrame(animRef.current);
    isDraggingRef.current = true;
    setIsDragging(true);
    dragRef.current = { startX: e.clientX, lastX: e.clientX, scrollLeft: ref.current.scrollLeft, moved: 0, vel: 0 };
  };

  const handleThumbMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!ref.current) return;
    cancelAnimationFrame(animRef.current);
    isThumbDraggingRef.current = true;
    thumbDragRef.current = { startX: e.clientX, startScrollLeft: ref.current.scrollLeft };
  };

  return (
    <div className="relative flex-1 overflow-hidden">
      {!atStart && (
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-background/95 to-transparent z-10" />
      )}
      <div
        ref={ref}
        className={`flex gap-2 overflow-x-auto scrollbar-none select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
        style={{ pointerEvents: blockClicks ? "none" : undefined }}
        onMouseDown={handleMouseDown}
      >
        {children}
        <div className="shrink-0 w-8" aria-hidden />
      </div>
      {!atEnd && (
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-14 bg-gradient-to-l from-background/95 to-transparent" />
      )}
      {showTrack && thumb.width < 99 && (
        <div ref={trackRef} className="relative h-[3px] mt-2 mb-1.5 rounded-full bg-border/40 mx-0.5">
          <div
            className="absolute top-0 h-full rounded-full bg-primary/35 hover:bg-primary/55 transition-colors duration-150 cursor-grab active:cursor-grabbing"
            style={{ left: `${thumb.left}%`, width: `${thumb.width}%` }}
            onMouseDown={handleThumbMouseDown}
          />
        </div>
      )}
    </div>
  );
}

// Chips for the Gender row — static, no drag (options rarely overflow)
function StaticChipRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex gap-2 overflow-x-auto scrollbar-none">
      {children}
    </div>
  );
}

function DesktopFilterRow({ label, options, selected, onToggle, counts, draggable = true, showTrack = false }: {
  label: string;
  options: { label: string; value: string }[];
  selected: string[];
  onToggle: (v: string) => void;
  counts?: Record<string, number>;
  draggable?: boolean;
  showTrack?: boolean;
}) {
  if (options.length === 0) return null;
  const chips = options.map(opt => {
    const isSelected = selected.includes(opt.value);
    const count = counts?.[opt.value];
    return (
      <button
        key={opt.value}
        onClick={() => onToggle(opt.value)}
        className={`shrink-0 flex items-center gap-1 h-7 px-2.5 rounded-md border text-xs font-medium transition-all ${
          isSelected
            ? "bg-primary text-primary-foreground border-primary shadow-sm"
            : "bg-background text-foreground border-input hover:bg-muted"
        }`}
      >
        {isSelected && <Check className="w-3 h-3 shrink-0" />}
        <span className="capitalize">{opt.label}</span>
        {count !== undefined && (
          <span className={isSelected ? "opacity-60" : "text-muted-foreground"}>({count})</span>
        )}
      </button>
    );
  });

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground shrink-0 font-medium w-12">{label}</span>
      {draggable ? (
        <FilterScrollRow showTrack={showTrack}>{chips}</FilterScrollRow>
      ) : (
        <StaticChipRow>{chips}</StaticChipRow>
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
          className="shrink-0 h-8 px-3 text-xs gap-1.5 rounded-full"
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

  const [activeCategory, setActiveCategory] = useState<string>("towels");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [activeGenders, setActiveGenders] = useState<string[]>([]);
  const [activeThemes,  setActiveThemes]  = useState<string[]>([]);
  const [activeStyles,  setActiveStyles]  = useState<string[]>([]);
  const [activeTag,     setActiveTag]     = useState<string>("");
  const [searchQuery,   setSearchQuery]   = useState<string>("");
  const [quickAddProduct, setQuickAddProduct] = useState<Product | null>(null);

  const { data: attributes } = useQuery<Attributes>({ queryKey: ["/api/attributes"] });
  const { data: categories }  = useQuery<Category[]>({ queryKey: ["/api/categories"] });

  const CATEGORY_ORDER = ["towels", "bathrobes", "blankets"];
  const categoryOptions = useMemo(() => {
    if (!categories) return [];
    return CATEGORY_ORDER
      .map(name => categories.find(c => c.name.toLowerCase() === name))
      .filter(Boolean) as Category[];
  }, [categories]);

  const activeCategoryObj = useMemo(() => {
    return categoryOptions.find(c => c.name.toLowerCase() === activeCategory) ?? categoryOptions[0] ?? null;
  }, [categoryOptions, activeCategory]);

  const audienceFilters = useMemo(() => {
    const ags = attributes?.audience ?? [];
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
    const cat = p.get("category") || "towels";
    setActiveCategory(cat);
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
    category: string,
    filter: string,
    genders: string[],
    themes: string[],
    styles: string[],
    tag: string,
    query: string,
  ) => {
    const p = new URLSearchParams();
    if (category && category !== "towels") p.set("category", category);
    if (filter !== "all") p.set("filter", filter);
    if (genders.length) p.set("gender", genders.join(","));
    if (themes.length)  p.set("theme",  themes.join(","));
    if (styles.length)  p.set("style",  styles.join(","));
    if (tag)   p.set("tag", tag);
    if (query) p.set("q", query);
    const qs = p.toString();
    navigate(qs ? `/shop?${qs}` : "/shop", { replace: true });
  }, [navigate]);

  const handleCategoryChange = (cat: string) => pushURL(cat, activeFilter, activeGenders, activeThemes, activeStyles, "", searchQuery);
  const handleFilterChange   = (f: string)   => pushURL(activeCategory, f, activeGenders, activeThemes, activeStyles, "", searchQuery);

  const toggleGender = (g: string) => {
    const next = activeGenders.includes(g) ? activeGenders.filter(x => x !== g) : [...activeGenders, g];
    pushURL(activeCategory, activeFilter, next, activeThemes, activeStyles, "", searchQuery);
  };
  const toggleTheme = (t: string) => {
    const next = activeThemes.includes(t) ? activeThemes.filter(x => x !== t) : [...activeThemes, t];
    pushURL(activeCategory, activeFilter, activeGenders, next, activeStyles, "", searchQuery);
  };
  const toggleStyle = (s: string) => {
    const next = activeStyles.includes(s) ? activeStyles.filter(x => x !== s) : [...activeStyles, s];
    pushURL(activeCategory, activeFilter, activeGenders, activeThemes, next, "", searchQuery);
  };

  const handleTagDrillDown  = (tag: string) => pushURL(activeCategory, "all", [], [], [], tag, "");
  const handleBackToAll     = () => pushURL(activeCategory, "all", [], [], [], "", "");
  const handleSearchChange  = (q: string) => {
    pushURL(activeCategory, activeFilter, activeGenders, activeThemes, activeStyles, q ? "" : activeTag, q);
  };

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: shopSectionsConfig } = useQuery<{ value: ShopSection[] }>({
    queryKey: ["/api/site-config", "shop-sections"],
    queryFn: () => fetch("/api/site-config/shop-sections").then(r => r.ok ? r.json() : null),
    staleTime: 0,
  });
  const shopSections: ShopSection[] = useMemo(() => {
    const raw = shopSectionsConfig?.value;
    if (!Array.isArray(raw) || raw.length === 0) return [];
    return raw.map((s): ShopSection => ({
      ...s,
      audience: s.audience,
    }));
  }, [shopSectionsConfig]);

  // Shared predicate: apply all attribute filters client-side (OR within each dimension)
  const attributeFilteredProducts = useMemo(() => {
    if (!products) return [];
    let result = products;
    if (activeCategoryObj) result = result.filter(p => p.categoryId === activeCategoryObj.id);
    if (activeFilter !== "all") result = result.filter(p => (p.audience ?? []).some(a => a.toLowerCase() === activeFilter.toLowerCase()));
    if (activeGenders.length)   result = result.filter(p => (p.genders ?? []).some(g => activeGenders.includes(g.toLowerCase())));
    if (activeThemes.length)    result = result.filter(p => (p.themes  ?? []).some(t => activeThemes.includes(t.toLowerCase())));
    if (activeStyles.length)    result = result.filter(p => (p.styles  ?? []).some(s => activeStyles.includes(s.toLowerCase())));
    return result;
  }, [products, activeCategoryObj, activeFilter, activeGenders, activeThemes, activeStyles]);

  // Count bases: each dimension counts with all OTHER filters applied
  // Category is always active — apply it in every count base
  const countBaseAudience = useMemo(() => {
    if (!products) return [];
    let r = products;
    if (activeCategoryObj) r = r.filter(p => p.categoryId === activeCategoryObj.id);
    if (activeGenders.length) r = r.filter(p => (p.genders ?? []).some(g => activeGenders.includes(g.toLowerCase())));
    if (activeThemes.length)  r = r.filter(p => (p.themes  ?? []).some(t => activeThemes.includes(t.toLowerCase())));
    if (activeStyles.length)  r = r.filter(p => (p.styles  ?? []).some(s => activeStyles.includes(s.toLowerCase())));
    return r;
  }, [products, activeCategoryObj, activeGenders, activeThemes, activeStyles]);

  const countBaseGender = useMemo(() => {
    if (!products) return [];
    let r = products;
    if (activeCategoryObj)      r = r.filter(p => p.categoryId === activeCategoryObj.id);
    if (activeFilter !== "all") r = r.filter(p => (p.audience ?? []).some(a => a.toLowerCase() === activeFilter.toLowerCase()));
    if (activeThemes.length)    r = r.filter(p => (p.themes  ?? []).some(t => activeThemes.includes(t.toLowerCase())));
    if (activeStyles.length)    r = r.filter(p => (p.styles  ?? []).some(s => activeStyles.includes(s.toLowerCase())));
    return r;
  }, [products, activeCategoryObj, activeFilter, activeThemes, activeStyles]);

  const countBaseTheme = useMemo(() => {
    if (!products) return [];
    let r = products;
    if (activeCategoryObj)      r = r.filter(p => p.categoryId === activeCategoryObj.id);
    if (activeFilter !== "all") r = r.filter(p => (p.audience ?? []).some(a => a.toLowerCase() === activeFilter.toLowerCase()));
    if (activeGenders.length)   r = r.filter(p => (p.genders ?? []).some(g => activeGenders.includes(g.toLowerCase())));
    if (activeStyles.length)    r = r.filter(p => (p.styles  ?? []).some(s => activeStyles.includes(s.toLowerCase())));
    return r;
  }, [products, activeCategoryObj, activeFilter, activeGenders, activeStyles]);

  const countBaseStyle = useMemo(() => {
    if (!products) return [];
    let r = products;
    if (activeCategoryObj)      r = r.filter(p => p.categoryId === activeCategoryObj.id);
    if (activeFilter !== "all") r = r.filter(p => (p.audience ?? []).some(a => a.toLowerCase() === activeFilter.toLowerCase()));
    if (activeGenders.length)   r = r.filter(p => (p.genders ?? []).some(g => activeGenders.includes(g.toLowerCase())));
    if (activeThemes.length)    r = r.filter(p => (p.themes  ?? []).some(t => activeThemes.includes(t.toLowerCase())));
    return r;
  }, [products, activeCategoryObj, activeFilter, activeGenders, activeThemes]);

  // Count base for category chips: all other filters applied, but NOT category
  const countBaseCategory = useMemo(() => {
    if (!products) return [];
    let r = products;
    if (activeFilter !== "all") r = r.filter(p => (p.audience ?? []).some(a => a.toLowerCase() === activeFilter.toLowerCase()));
    if (activeGenders.length)   r = r.filter(p => (p.genders ?? []).some(g => activeGenders.includes(g.toLowerCase())));
    if (activeThemes.length)    r = r.filter(p => (p.themes  ?? []).some(t => activeThemes.includes(t.toLowerCase())));
    if (activeStyles.length)    r = r.filter(p => (p.styles  ?? []).some(s => activeStyles.includes(s.toLowerCase())));
    return r;
  }, [products, activeFilter, activeGenders, activeThemes, activeStyles]);

  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const cat of categoryOptions) {
      map[cat.name.toLowerCase()] = countBaseCategory.filter(p => p.categoryId === cat.id).length;
    }
    return map;
  }, [countBaseCategory, categoryOptions]);

  const audienceCounts = useMemo(() => {
    const map: Record<string, number> = { all: countBaseAudience.length };
    for (const f of audienceFilters) {
      if (f.value === "all") continue;
      map[f.value] = countBaseAudience.filter(p => (p.audience ?? []).some(a => a.toLowerCase() === f.value)).length;
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
      if (section.audience?.length) all = all.filter(p => (p.audience ?? []).some(a => section.audience!.includes(a)));
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
      .filter(s => activeFilter === "all" || (s.audience ?? []).includes(activeFilter))
      .map(s => {
        if (!s.audience?.length && !s.genders?.length && !s.themes?.length && !s.styles?.length) return { ...s, all: [], shown: [] };
        let all = attributeFilteredProducts;
        if (s.audience?.length) all = all.filter(p => (p.audience ?? []).some(a => s.audience!.includes(a)));
        if (s.genders?.length)   all = all.filter(p => (p.genders   ?? []).some(g => s.genders!.includes(g)));
        if (s.themes?.length)    all = all.filter(p => (p.themes    ?? []).some(t => s.themes!.includes(t)));
        if (s.styles?.length)    all = all.filter(p => (p.styles    ?? []).some(st => s.styles!.includes(st)));
        return { ...s, all, shown: all.slice(0, s.maxShown) };
      });
  }, [attributeFilteredProducts, shopSections, products, activeFilter]);

  const hasAttributeFilters = activeFilter !== "all" || activeGenders.length > 0 || activeThemes.length > 0 || activeStyles.length > 0;

  const isAllView = !activeTag && !searchQuery.trim() && !hasAttributeFilters;
  const isTagView = !!activeTag && !searchQuery.trim();

  const tagLabel = shopSections.find(s => s.tag.toLowerCase() === activeTag.toLowerCase())?.label ?? activeTag;

  const handleClearFilters = () => pushURL(activeCategory, "all", [], [], [], activeTag, searchQuery);

  const [isScrolled, setIsScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="pb-20 md:pb-8">
      <SEO
        title="Shop All Products"
        description="Browse our complete collection of personalised luxury towels, blankets & bathrobes. Buy 2 Get 1 Free."
        path="/shop"
      />

      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 space-y-2">

          {/* Search — always visible */}
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

          {/* Collapsible section: category + audience + all filter rows — hides on scroll */}
          <div className={`overflow-hidden transition-all duration-200 ease-in-out space-y-2 ${isScrolled ? "max-h-0 opacity-0 pointer-events-none" : "max-h-96 opacity-100"}`}>

            {/* Category chips — always one selected, no All option */}
            {categoryOptions.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
                {categoryOptions.map(cat => {
                  const key = cat.name.toLowerCase();
                  const count = categoryCounts[key];
                  const isActive = activeCategory === key || (activeCategoryObj?.id === cat.id);
                  return (
                    <Button
                      key={cat.id}
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleCategoryChange(key)}
                      className="shrink-0 capitalize"
                      data-testid={`filter-category-${key}`}
                    >
                      {cat.name}{count !== undefined ? ` (${count})` : ""}
                    </Button>
                  );
                })}
              </div>
            )}

            {/* Audience chips */}
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

            {/* MOBILE ONLY: compact dropdown pills */}
            <div className="sm:hidden flex items-center gap-2 overflow-x-auto scrollbar-none">
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

            {/* DESKTOP ONLY: scrollable discovery rails */}
            <div className="hidden sm:block space-y-1.5">
              <DesktopFilterRow label="Gender" options={genderOptions} selected={activeGenders} onToggle={toggleGender} counts={genderCounts} draggable={false} />
              <DesktopFilterRow label="Theme"  options={themeOptions}  selected={activeThemes}  onToggle={toggleTheme}  counts={themeCounts}  showTrack />
              <DesktopFilterRow label="Style"  options={styleOptions}  selected={activeStyles}  onToggle={toggleStyle}  counts={styleCounts} />
              {hasAttributeFilters && (
                <button
                  onClick={handleClearFilters}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                  data-testid="button-clear-filters"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* Compact active-filter summary — appears when scrolled + filters active */}
          <div className={`overflow-hidden transition-all duration-200 ease-in-out ${isScrolled && hasAttributeFilters ? "max-h-10 opacity-100" : "max-h-0 opacity-0 pointer-events-none"}`}>
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
              <SlidersHorizontal className="w-3.5 h-3.5 shrink-0 text-primary" />
              {activeFilter !== "all" && (
                <button
                  onClick={() => handleFilterChange("all")}
                  className="shrink-0 flex items-center gap-1 h-6 px-2 rounded-full bg-primary text-primary-foreground text-xs font-medium"
                  data-testid="active-filter-audience"
                >
                  {audienceFilters.find(f => f.value === activeFilter)?.label ?? activeFilter}
                  <X className="w-3 h-3" />
                </button>
              )}
              {activeGenders.map(g => (
                <button
                  key={g}
                  onClick={() => toggleGender(g)}
                  className="shrink-0 flex items-center gap-1 h-6 px-2 rounded-full bg-primary text-primary-foreground text-xs font-medium capitalize"
                  data-testid={`active-filter-gender-${g}`}
                >
                  {genderOptions.find(o => o.value === g)?.label ?? g}
                  <X className="w-3 h-3" />
                </button>
              ))}
              {activeThemes.map(t => (
                <button
                  key={t}
                  onClick={() => toggleTheme(t)}
                  className="shrink-0 flex items-center gap-1 h-6 px-2 rounded-full bg-primary text-primary-foreground text-xs font-medium capitalize"
                  data-testid={`active-filter-theme-${t}`}
                >
                  {themeOptions.find(o => o.value === t)?.label ?? t}
                  <X className="w-3 h-3" />
                </button>
              ))}
              {activeStyles.map(s => (
                <button
                  key={s}
                  onClick={() => toggleStyle(s)}
                  className="shrink-0 flex items-center gap-1 h-6 px-2 rounded-full bg-primary text-primary-foreground text-xs font-medium capitalize"
                  data-testid={`active-filter-style-${s}`}
                >
                  {styleOptions.find(o => o.value === s)?.label ?? s}
                  <X className="w-3 h-3" />
                </button>
              ))}
              <button
                onClick={handleClearFilters}
                className="shrink-0 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors ml-1"
                data-testid="button-clear-filters-compact"
              >
                Clear
              </button>
            </div>
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
