import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch, useLocation } from "wouter";
import { SlidersHorizontal, Search, X, ChevronRight, ArrowLeft, ChevronDown, Check } from "lucide-react";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import ProductCardNew from "@/components/ProductCardNew";
import QuickAddSheet from "@/components/QuickAddSheet";
import type { Product, Attributes, Category } from "@shared/types";
import { buildDefaultThemeGroups, type ThemeGroupsConfig } from "@shared/themeGroups";
import {
  groupProductsByShopSections,
  normalizeShopSections,
  productsForShopSection,
  type ShopSection,
} from "@shared/shopSections";
import { trackEvent } from "@/lib/analytics";
import { matchesAudience, selectedAudienceIds } from "@shared/audienceFilters";
import { matchesProductSearch } from "@shared/productSearch";

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

interface GroupedThemeFilterProps {
  options: { label: string; value: string }[];
  groups: ThemeGroupsConfig;
  selected: string[];
  onChange: (values: string[]) => void;
  counts?: Record<string, number>;
}

function GroupedThemeFilter({ options, groups, selected, onChange, counts }: GroupedThemeFilterProps) {
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSelected, setMobileSelected] = useState<string[]>(selected);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const optionMap = useMemo(() => new Map(options.map(option => [option.value, option])), [options]);

  const visibleGroups = useMemo(() => {
    const configuredIds = new Set<string>();
    groups.forEach(group => group.themeIds.forEach(id => configuredIds.add(id)));
    const result = groups
      .filter(group => group.enabled)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(group => {
        const groupOptions = group.themeIds
          .map(id => {
            return optionMap.get(id);
          })
          .filter((option): option is { label: string; value: string } => Boolean(option));
        return { group, options: groupOptions };
      })
      .filter(({ options: groupOptions }) => groupOptions.length > 0);

    const unassigned = options
      .filter(option => !configuredIds.has(option.value));
    if (unassigned.length > 0) {
      result.push({
        group: {
          id: "other-themes",
          name: "Other themes",
          description: "Themes waiting to be assigned to a group",
          enabled: true,
          sortOrder: Number.MAX_SAFE_INTEGER,
          themeIds: unassigned.map(option => option.value),
        },
        options: unassigned,
      });
    }
    return result;
  }, [groups, optionMap, options]);

  const toggle = (values: string[], value: string) => {
    onChange(values.includes(value) ? values.filter(item => item !== value) : [...values, value]);
  };

  const themeLabel = selected.length === 0 ? "Themes" : `Themes (${selected.length})`;

  const toggleGroup = (id: string) => {
    setExpandedGroups(previous => ({ ...previous, [id]: !(previous[id] ?? false) }));
  };

  const groupContents = (useMobileSelection: boolean) => {
    const activeSelection = useMobileSelection ? mobileSelected : selected;
    return visibleGroups.map(({ group, options: groupOptions }) => {
      const expanded = expandedGroups[group.id] ?? false;
      return (
        <div key={group.id} className="rounded-lg border bg-background overflow-hidden">
          <button
            type="button"
            onClick={() => toggleGroup(group.id)}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
            aria-expanded={expanded}
            data-testid={`theme-group-${group.id}`}
          >
            <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`} />
            <span className="font-medium text-sm flex-1">{group.name}</span>
            <span className="text-xs text-muted-foreground">{groupOptions.length}</span>
          </button>
          {expanded && (
            <div className="border-t px-2 py-1.5 grid grid-cols-1 sm:grid-cols-2 gap-0.5">
              {groupOptions.map(option => {
                const checked = activeSelection.includes(option.value);
                const count = counts?.[option.value];
                return (
                  <button
                    type="button"
                    key={option.value}
                    onClick={() => useMobileSelection
                      ? setMobileSelected(previous => previous.includes(option.value)
                        ? previous.filter(item => item !== option.value)
                        : [...previous, option.value])
                      : toggle(selected, option.value)}
                    className={`flex items-center gap-2 min-h-10 px-2 rounded-md text-left text-sm hover:bg-muted transition-colors ${checked ? "text-primary font-medium" : ""}`}
                    aria-pressed={checked}
                    data-testid={`theme-option-${option.value}`}
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checked ? "bg-primary border-primary" : "border-input"}`}>
                      {checked && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                    </span>
                    <span className="flex-1 capitalize">{option.label}</span>
                    {count !== undefined && <span className="text-xs text-muted-foreground">{count}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
    });
  };

  const openDesktop = (open: boolean) => {
    if (open) setExpandedGroups({});
    setDesktopOpen(open);
  };

  const openMobile = (open: boolean) => {
    if (open) {
      setMobileSelected(selected);
      setExpandedGroups({});
    }
    setMobileOpen(open);
  };

  return (
    <>
      <div className="hidden sm:flex items-center gap-2">
        <span className="text-xs text-muted-foreground shrink-0 font-medium w-12">Theme</span>
        <Popover open={desktopOpen} onOpenChange={openDesktop}>
          <PopoverTrigger asChild>
            <Button
              variant={selected.length > 0 ? "default" : "outline"}
              size="sm"
              className="h-8 px-3 text-xs gap-1.5 rounded-full shrink-0"
              data-testid="dropdown-filter-theme"
            >
              {themeLabel}
              <ChevronDown className="w-3 h-3 opacity-70" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[min(42rem,calc(100vw-2rem))] p-3">
            <div className="flex items-center justify-end mb-3">
              {selected.length > 0 && (
                <button type="button" onClick={() => onChange([])} className="text-xs text-muted-foreground hover:text-foreground whitespace-nowrap">
                  Clear
                </button>
              )}
            </div>
            <div className="max-h-[25rem] overflow-y-auto grid grid-cols-2 gap-2 pr-1">
              {groupContents(false)}
            </div>
            {visibleGroups.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No themes found.</p>}
          </PopoverContent>
        </Popover>
        {selected.map(value => (
          <button
            type="button"
            key={value}
            onClick={() => onChange(selected.filter(item => item !== value))}
            className="shrink-0 flex items-center gap-1 h-7 px-2 rounded-full bg-primary/10 text-primary text-xs font-medium"
            data-testid={`selected-theme-${value}`}
          >
            {optionMap.get(value)?.label ?? value}
            <X className="w-3 h-3" />
          </button>
        ))}
      </div>

      <div className="sm:hidden">
        <Sheet open={mobileOpen} onOpenChange={openMobile}>
          <button
            type="button"
            onClick={() => openMobile(true)}
            className={`h-8 px-3 rounded-full border text-xs font-medium flex items-center gap-1.5 whitespace-nowrap ${selected.length > 0 ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input"}`}
            data-testid="filter-theme-mobile"
          >
            {themeLabel}
            <ChevronDown className="w-3 h-3 opacity-70" />
          </button>
          <SheetContent side="bottom" className="h-[min(92svh,760px)] rounded-t-2xl p-0 flex flex-col gap-0">
            <SheetHeader className="px-5 pt-5 pb-4 pr-12 border-b shrink-0 text-left">
              <SheetTitle className="text-left">Choose themes</SheetTitle>
              <SheetDescription className="text-left">Browse themes by group and select one or more.</SheetDescription>
              {mobileSelected.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMobileSelected([])}
                  className="absolute left-5 top-5 text-xs text-muted-foreground underline underline-offset-2"
                >
                  Clear
                </button>
              )}
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
              {groupContents(true)}
              {visibleGroups.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">No themes found.</p>}
            </div>
            <SheetFooter className="px-5 py-4 border-t shrink-0 flex-row gap-2">
              <Button type="button" className="flex-1" onClick={() => { onChange(mobileSelected); setMobileOpen(false); }} data-testid="button-apply-themes">
                Apply {mobileSelected.length > 0 ? `(${mobileSelected.length})` : ""}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

export default function ShopPage() {
  const searchString = useSearch();
  const [, navigate] = useLocation();

  const [activeCategory, setActiveCategory] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [activeGenders, setActiveGenders] = useState<string[]>([]);
  const [activeThemes,  setActiveThemes]  = useState<string[]>([]);
  const [activeStyles,  setActiveStyles]  = useState<string[]>([]);
  const [activeTag,     setActiveTag]     = useState<string>("");
  const [searchQuery,   setSearchQuery]   = useState<string>("");
  const [quickAddProduct, setQuickAddProduct] = useState<Product | null>(null);
  const lastTrackedSearchRef = useRef<string>("");
  const searchHydratedRef = useRef(false);

  const { data: attributes } = useQuery<Attributes>({ queryKey: ["/api/attributes"] });
  const { data: categories }  = useQuery<Category[]>({ queryKey: ["/api/categories"] });
  const { data: themeGroupsConfig } = useQuery<{ value: ThemeGroupsConfig }>({
    queryKey: ["/api/site-config", "theme-groups"],
    queryFn: () => fetch("/api/site-config/theme-groups").then(response => response.ok ? response.json() : null),
    staleTime: 0,
  });

  const categoryOptions = useMemo(() => {
    return categories ?? [];
  }, [categories]);

  const activeCategoryObj = useMemo(() => {
    if (!activeCategory) return null;
    return categoryOptions.find(c => c.name.toLowerCase() === activeCategory) ?? null;
  }, [categoryOptions, activeCategory]);

  const audienceFilters = useMemo(() => {
    const ags = attributes?.audience ?? [];
    if (ags.length === 0) return [];
    return [
      { label: "All", value: "all" },
      ...ags.map(ag => ({ label: ag.name.charAt(0).toUpperCase() + ag.name.slice(1), value: ag.id })),
    ];
  }, [attributes]);

  const genderOptions = useMemo(() => {
    return (attributes?.genders ?? []).map(g => ({
      label: g.name.charAt(0).toUpperCase() + g.name.slice(1),
      value: g.id,
    }));
  }, [attributes]);

  const themeOptions = useMemo(() => {
    return (attributes?.themes ?? []).map(t => ({
      label: t.name.charAt(0).toUpperCase() + t.name.slice(1),
      value: t.id,
    }));
  }, [attributes]);

  const styleOptions = useMemo(() => {
    return (attributes?.styles ?? []).map(s => ({
      label: s.name.charAt(0).toUpperCase() + s.name.slice(1),
      value: s.id,
    }));
  }, [attributes]);

  const themeGroups = useMemo<ThemeGroupsConfig>(() => {
    const persisted = themeGroupsConfig?.value;
    if (Array.isArray(persisted)) return persisted;
    return buildDefaultThemeGroups(attributes?.themes ?? []);
  }, [attributes, themeGroupsConfig]);

  // Read URL → state
  useEffect(() => {
    const p = new URLSearchParams(searchString);
    const cat = p.get("category") || "";
    setActiveCategory(cat);
    const f = p.get("filter") || "all";
    const validAudienceIds = selectedAudienceIds(f).filter(id =>
      audienceFilters.some(option => option.value === id),
    );
    setActiveFilter(validAudienceIds.length ? validAudienceIds.join(",") : "all");
    const g = p.get("gender");
    setActiveGenders(g ? g.split(",").filter(Boolean) : []);
    const t = p.get("theme");
    setActiveThemes(t ? t.split(",").filter(Boolean) : []);
    const s = p.get("style");
    setActiveStyles(s ? s.split(",").filter(Boolean) : []);
    setActiveTag(p.get("tag") || "");
    const query = p.get("q") || "";
    setSearchQuery(query);
    if (!searchHydratedRef.current) {
      lastTrackedSearchRef.current = query.trim();
      searchHydratedRef.current = true;
    }
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
    if (category) p.set("category", category);
    if (filter !== "all") p.set("filter", filter);
    if (genders.length) p.set("gender", genders.join(","));
    if (themes.length)  p.set("theme",  themes.join(","));
    if (styles.length)  p.set("style",  styles.join(","));
    if (tag)   p.set("tag", tag);
    if (query) p.set("q", query);
    const qs = p.toString();
    navigate(qs ? `/shop?${qs}` : "/shop", { replace: true });
  }, [navigate]);

  type FilterState = {
    category: string;
    audience: string;
    genders: string[];
    themes: string[];
    styles: string[];
    query: string;
    tag?: string;
  };

  const getFilterResultCount = (state: FilterState): number | undefined => {
    if (!products) return undefined;
    const category = categoryOptions.find(c => c.name.toLowerCase() === state.category);
    const query = state.query.trim();
    let filtered = products.filter(product => {
      if (category && product.categoryId !== category.id) return false;
      if (!matchesAudience(product.audience ?? [], state.audience)) return false;
      if (state.genders.length && !(product.genders ?? []).some(value => state.genders.includes(value))) return false;
      if (state.themes.length && !(product.themes ?? []).some(value => state.themes.includes(value))) return false;
      if (state.styles.length && !(product.styles ?? []).some(value => state.styles.includes(value))) return false;
      if (query && !matchesProductSearch(query, product)) return false;
      return true;
    });

    if (state.tag) {
      const tagLower = state.tag.toLowerCase();
      const section = shopSections.find(
        entry => (entry.tag ?? entry.label).toLowerCase() === tagLower,
      );
      if (!section) return 0;
      if (section.categories?.length) {
        const categoryIds = categoryOptions
          .filter(entry => section.categories!.includes(entry.slug))
          .map(entry => entry.id);
        if (categoryIds.length) {
          filtered = filtered.filter(product => categoryIds.includes(product.categoryId));
        }
      }
      if (section.audience?.length) {
        filtered = filtered.filter(product =>
          (product.audience ?? []).some(value => section.audience!.includes(value)),
        );
      }
      if (section.genders?.length) {
        filtered = filtered.filter(product =>
          (product.genders ?? []).some(value => section.genders!.includes(value)),
        );
      }
      if (section.themes?.length) {
        filtered = filtered.filter(product =>
          (product.themes ?? []).some(value => section.themes!.includes(value)),
        );
      }
      if (section.styles?.length) {
        filtered = filtered.filter(product =>
          (product.styles ?? []).some(value => section.styles!.includes(value)),
        );
      }
      if (section.tags?.length) {
        filtered = filtered.filter(product =>
          (product.tagNames ?? []).some(productTag =>
            section.tags!.some(sectionTag =>
              sectionTag.toLowerCase() === productTag.toLowerCase(),
            ),
          ),
        );
      }
    }

    return filtered.length;
  };

  const trackFilterApplied = (
    filterType: "category" | "audience" | "gender" | "theme" | "style" | "search" | "section",
    state: FilterState,
  ) => {
    const resultCount = getFilterResultCount(state);
    const data = {
      filter_type: filterType,
      active_filter_count:
        (state.category ? 1 : 0) +
        (state.audience !== "all" ? 1 : 0) +
        state.genders.length +
        state.themes.length +
        state.styles.length +
        (state.tag ? 1 : 0) +
        (state.query.trim() ? 1 : 0),
      ...(resultCount !== undefined ? { result_count: resultCount } : {}),
      ...(filterType === "search"
        ? { has_search: state.query.trim().length > 0, query_length: state.query.trim().length }
        : {}),
      ...(filterType === "section" ? { has_section: Boolean(state.tag) } : {}),
    };
    trackEvent("filter_applied", data);
  };

  const handleCategoryChange = (cat: string) => {
    if (cat !== activeCategory) {
      trackFilterApplied("category", {
        category: cat, audience: activeFilter, genders: activeGenders,
        themes: activeThemes, styles: activeStyles, query: searchQuery,
      });
    }
    pushURL(cat, activeFilter, activeGenders, activeThemes, activeStyles, "", searchQuery);
  };
  const handleFilterChange = (f: string) => {
    if (f !== activeFilter) {
      trackFilterApplied("audience", {
        category: activeCategory, audience: f, genders: activeGenders,
        themes: activeThemes, styles: activeStyles, query: searchQuery,
      });
    }
    pushURL(activeCategory, f, activeGenders, activeThemes, activeStyles, "", searchQuery);
  };

  const toggleGender = (g: string) => {
    const next = activeGenders.includes(g) ? activeGenders.filter(x => x !== g) : [...activeGenders, g];
    trackFilterApplied("gender", {
      category: activeCategory, audience: activeFilter, genders: next,
      themes: activeThemes, styles: activeStyles, query: searchQuery,
    });
    pushURL(activeCategory, activeFilter, next, activeThemes, activeStyles, "", searchQuery);
  };
  const setThemes = (next: string[]) => {
    if (next.length === activeThemes.length && next.every(value => activeThemes.includes(value))) return;
    trackFilterApplied("theme", {
      category: activeCategory, audience: activeFilter, genders: activeGenders,
      themes: next, styles: activeStyles, query: searchQuery,
    });
    pushURL(activeCategory, activeFilter, activeGenders, next, activeStyles, "", searchQuery);
  };
  const toggleTheme = (t: string) => {
    const next = activeThemes.includes(t) ? activeThemes.filter(x => x !== t) : [...activeThemes, t];
    setThemes(next);
  };
  const toggleStyle = (s: string) => {
    const next = activeStyles.includes(s) ? activeStyles.filter(x => x !== s) : [...activeStyles, s];
    trackFilterApplied("style", {
      category: activeCategory, audience: activeFilter, genders: activeGenders,
      themes: activeThemes, styles: next, query: searchQuery,
    });
    pushURL(activeCategory, activeFilter, activeGenders, activeThemes, next, "", searchQuery);
  };

  const handleBackToAll = () => {
    if (activeTag) {
      trackFilterApplied("section", {
        category: activeCategory,
        audience: "all",
        genders: [],
        themes: [],
        styles: [],
        query: "",
        tag: "",
      });
    }
    pushURL(activeCategory, "all", [], [], [], "", "");
  };
  const handleSearchChange  = (q: string) => {
    if (q === searchQuery) return;
    pushURL(activeCategory, activeFilter, activeGenders, activeThemes, activeStyles, q ? "" : activeTag, q);
  };
  const trackCurrentSearch = () => {
    const normalizedQuery = searchQuery.trim();
    if (normalizedQuery === lastTrackedSearchRef.current) return;
    lastTrackedSearchRef.current = normalizedQuery;
    trackFilterApplied("search", {
      category: activeCategory, audience: activeFilter, genders: activeGenders,
      themes: activeThemes, styles: activeStyles, query: normalizedQuery,
      tag: normalizedQuery ? "" : activeTag,
    });
  };
  const clearSearch = () => {
    if (!searchQuery) return;
    handleSearchChange("");
    if (lastTrackedSearchRef.current !== "") {
      lastTrackedSearchRef.current = "";
      trackFilterApplied("search", {
        category: activeCategory, audience: activeFilter, genders: activeGenders,
        themes: activeThemes, styles: activeStyles, query: "", tag: activeTag,
      });
    }
  };

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: shopSectionsConfig } = useQuery<{ value: ShopSection[] }>({
    queryKey: ["/api/site-config", "shop-sections"],
    queryFn: () => fetch("/api/site-config/shop-sections").then(r => r.ok ? r.json() : null),
    staleTime: 0,
  });
  const shopSections: ShopSection[] = useMemo(
    () => normalizeShopSections(shopSectionsConfig?.value),
    [shopSectionsConfig],
  );

  // Shared predicate: apply all attribute filters client-side (OR within each dimension)
  const attributeFilteredProducts = useMemo(() => {
    if (!products) return [];
    let result = products;
    if (activeCategoryObj) result = result.filter(p => p.categoryId === activeCategoryObj.id);
    if (activeFilter !== "all") result = result.filter(p => matchesAudience(p.audience, activeFilter));
    if (activeGenders.length)   result = result.filter(p => (p.genders ?? []).some(g => activeGenders.includes(g)));
    if (activeThemes.length)    result = result.filter(p => (p.themes  ?? []).some(t => activeThemes.includes(t)));
    if (activeStyles.length)    result = result.filter(p => (p.styles  ?? []).some(s => activeStyles.includes(s)));
    return result;
  }, [products, activeCategoryObj, activeFilter, activeGenders, activeThemes, activeStyles]);

  // Count bases: each dimension counts with all OTHER filters applied
  // Category is always active — apply it in every count base
  const countBaseAudience = useMemo(() => {
    if (!products) return [];
    let r = products;
    if (activeCategoryObj) r = r.filter(p => p.categoryId === activeCategoryObj.id);
    if (activeGenders.length) r = r.filter(p => (p.genders ?? []).some(g => activeGenders.includes(g)));
    if (activeThemes.length)  r = r.filter(p => (p.themes  ?? []).some(t => activeThemes.includes(t)));
    if (activeStyles.length)  r = r.filter(p => (p.styles  ?? []).some(s => activeStyles.includes(s)));
    return r;
  }, [products, activeCategoryObj, activeGenders, activeThemes, activeStyles]);

  const countBaseGender = useMemo(() => {
    if (!products) return [];
    let r = products;
    if (activeCategoryObj)      r = r.filter(p => p.categoryId === activeCategoryObj.id);
    if (activeFilter !== "all") r = r.filter(p => matchesAudience(p.audience, activeFilter));
    if (activeThemes.length)    r = r.filter(p => (p.themes  ?? []).some(t => activeThemes.includes(t)));
    if (activeStyles.length)    r = r.filter(p => (p.styles  ?? []).some(s => activeStyles.includes(s)));
    return r;
  }, [products, activeCategoryObj, activeFilter, activeThemes, activeStyles]);

  const countBaseTheme = useMemo(() => {
    if (!products) return [];
    let r = products;
    if (activeCategoryObj)      r = r.filter(p => p.categoryId === activeCategoryObj.id);
    if (activeFilter !== "all") r = r.filter(p => matchesAudience(p.audience, activeFilter));
    if (activeGenders.length)   r = r.filter(p => (p.genders ?? []).some(g => activeGenders.includes(g)));
    if (activeStyles.length)    r = r.filter(p => (p.styles  ?? []).some(s => activeStyles.includes(s)));
    return r;
  }, [products, activeCategoryObj, activeFilter, activeGenders, activeStyles]);

  const countBaseStyle = useMemo(() => {
    if (!products) return [];
    let r = products;
    if (activeCategoryObj)      r = r.filter(p => p.categoryId === activeCategoryObj.id);
    if (activeFilter !== "all") r = r.filter(p => matchesAudience(p.audience, activeFilter));
    if (activeGenders.length)   r = r.filter(p => (p.genders ?? []).some(g => activeGenders.includes(g)));
    if (activeThemes.length)    r = r.filter(p => (p.themes  ?? []).some(t => activeThemes.includes(t)));
    return r;
  }, [products, activeCategoryObj, activeFilter, activeGenders, activeThemes]);

  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    if (!products) return map;
    for (const cat of categoryOptions) {
      map[cat.name.toLowerCase()] = products.filter(p => p.categoryId === cat.id).length;
    }
    return map;
  }, [products, categoryOptions]);

  const audienceCounts = useMemo(() => {
    const map: Record<string, number> = { all: countBaseAudience.length };
    for (const f of audienceFilters) {
      if (f.value === "all") continue;
      map[f.value] = countBaseAudience.filter(p => (p.audience ?? []).includes(f.value)).length;
    }
    return map;
  }, [countBaseAudience, audienceFilters]);

  const genderCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const f of genderOptions) {
      map[f.value] = countBaseGender.filter(p => (p.genders ?? []).includes(f.value)).length;
    }
    return map;
  }, [countBaseGender, genderOptions]);

  const themeCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const f of themeOptions) {
      map[f.value] = countBaseTheme.filter(p => (p.themes ?? []).includes(f.value)).length;
    }
    return map;
  }, [countBaseTheme, themeOptions]);

  const styleCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const f of styleOptions) {
      map[f.value] = countBaseStyle.filter(p => (p.styles ?? []).includes(f.value)).length;
    }
    return map;
  }, [countBaseStyle, styleOptions]);

  // Products for search views
  const flatProducts = useMemo(() => {
    let result = attributeFilteredProducts;
    if (searchQuery.trim()) {
      result = result.filter(product => matchesProductSearch(searchQuery, product));
    }
    return result;
  }, [attributeFilteredProducts, searchQuery]);

  // Products for tag drill-down
  const tagProducts = useMemo(() => {
    if (!activeTag) return [];
    const tagLower = activeTag.toLowerCase();
    // Look up section by its `tag` identifier (URL key), never by product-tag values
    const section = shopSections.find(s => (s.tag ?? s.label).toLowerCase() === tagLower);
    if (section) return productsForShopSection(attributeFilteredProducts, categories ?? [], section);
    // Unknown tag key — no matching section, return empty
    return [];
  }, [attributeFilteredProducts, activeTag, shopSections, categories]);

  // Compute tag sections
  const tagSections = useMemo(() => {
    if (!products) return [];
    return groupProductsByShopSections(attributeFilteredProducts, categories ?? [], shopSections);
  }, [attributeFilteredProducts, shopSections, products, categories]);

  const hasAttributeFilters = activeFilter !== "all" || activeGenders.length > 0 || activeThemes.length > 0 || activeStyles.length > 0;

  const isAllView = !activeTag && !searchQuery.trim() && !hasAttributeFilters && !activeCategory;
  const isTagView = !!activeTag && !searchQuery.trim();

  const tagLabel = shopSections.find(s => (s.tag ?? s.label).toLowerCase() === activeTag.toLowerCase())?.label ?? activeTag;

  const handleClearGenders = () => {
    if (!activeGenders.length) return;
    trackFilterApplied("gender", {
      category: activeCategory, audience: activeFilter, genders: [],
      themes: activeThemes, styles: activeStyles, query: searchQuery,
    });
    pushURL(activeCategory, activeFilter, [], activeThemes, activeStyles, activeTag, searchQuery);
  };

  const handleClearStyles = () => {
    if (!activeStyles.length) return;
    trackFilterApplied("style", {
      category: activeCategory, audience: activeFilter, genders: activeGenders,
      themes: activeThemes, styles: [], query: searchQuery,
    });
    pushURL(activeCategory, activeFilter, activeGenders, activeThemes, [], activeTag, searchQuery);
  };

  const handleClearFilters = () => {
    const state = {
      category: activeCategory,
      audience: "all",
      genders: [],
      themes: [],
      styles: [],
      query: searchQuery,
      tag: activeTag,
    };
    if (activeFilter !== "all") trackFilterApplied("audience", state);
    if (activeGenders.length) trackFilterApplied("gender", state);
    if (activeThemes.length) trackFilterApplied("theme", state);
    if (activeStyles.length) trackFilterApplied("style", state);
    pushURL(activeCategory, "all", [], [], [], activeTag, searchQuery);
  };

  const [isScrolled, setIsScrolled] = useState(false);
  const scrollStateRef = useRef(false);
  const scrollHandoffLockUntilRef = useRef(0);
  useEffect(() => {
    const onScroll = () => {
      // Use hysteresis so the sticky bar cannot toggle back and forth while
      // its own height is changing during the filter handoff.
      const now = performance.now();
      if (now < scrollHandoffLockUntilRef.current) return;

      const nextIsScrolled = scrollStateRef.current
        ? window.scrollY > 32
        : window.scrollY > 72;
      if (nextIsScrolled === scrollStateRef.current) return;

      scrollStateRef.current = nextIsScrolled;
      // Collapsing the sticky content can briefly change scrollY because of
      // browser scroll anchoring. Ignore those layout-only events until the
      // CSS handoff has finished.
      scrollHandoffLockUntilRef.current = now + 300;
      setIsScrolled(nextIsScrolled);
    };
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
              onBlur={trackCurrentSearch}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  trackCurrentSearch();
                  e.currentTarget.blur();
                }
              }}
              className="pl-9 pr-9"
              data-testid="input-search-products"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                data-testid="button-clear-search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* One animated handoff keeps the sticky bar height stable while scrolling. */}
          <div className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-in-out ${isScrolled
            ? hasAttributeFilters
              ? "max-h-10 opacity-100"
              : "max-h-0 opacity-0 pointer-events-none"
            : "max-h-[32rem] opacity-100"}`}>
          <div
            className={`space-y-2 ${isScrolled ? "hidden" : ""}`}
            data-testid="shop-filter-controls"
          >

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
                    variant={(selectedAudienceIds(activeFilter).includes(f.value) && !activeTag && !searchQuery) ? "default" : "outline"}
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
                onClear={handleClearGenders}
                counts={genderCounts}
                testIdPrefix="filter-gender"
              />
              <GroupedThemeFilter
                options={themeOptions}
                groups={themeGroups}
                selected={activeThemes}
                onChange={setThemes}
                counts={themeCounts}
              />
              <MultiSelectDropdown
                label="Style"
                options={styleOptions}
                selected={activeStyles}
                onToggle={toggleStyle}
                onClear={handleClearStyles}
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
              <GroupedThemeFilter
                options={themeOptions}
                groups={themeGroups}
                selected={activeThemes}
                onChange={setThemes}
                counts={themeCounts}
              />
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

            {activeThemes.length > 0 && (
              <div className="sm:hidden flex items-center gap-1.5 overflow-x-auto scrollbar-none mt-2 pb-0.5" data-testid="active-theme-chips">
                {activeThemes.map(themeId => (
                  <button
                    type="button"
                    key={themeId}
                    onClick={() => setThemes(activeThemes.filter(id => id !== themeId))}
                    className="shrink-0 flex items-center gap-1 h-7 px-2.5 rounded-full bg-primary text-primary-foreground text-xs font-medium"
                    data-testid={`active-theme-chip-${themeId}`}
                  >
                    {themeOptions.find(option => option.value === themeId)?.label ?? themeId}
                    <X className="w-3 h-3" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Compact active-filter summary — appears when scrolled + filters active */}
          <div
            className={isScrolled && hasAttributeFilters ? "hidden sm:block" : "hidden"}
            data-testid="shop-active-filter-summary"
          >
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
              <SlidersHorizontal className="w-3.5 h-3.5 shrink-0 text-primary" />
              {selectedAudienceIds(activeFilter).map((audienceId, index) => (
                <button
                  key={audienceId}
                  onClick={() => {
                    const next = selectedAudienceIds(activeFilter).filter(id => id !== audienceId);
                    handleFilterChange(next.length ? next.join(",") : "all");
                  }}
                  className="shrink-0 flex items-center gap-1 h-6 px-2 rounded-full bg-primary text-primary-foreground text-xs font-medium"
                  data-testid={index === 0 ? "active-filter-audience" : `active-filter-audience-${audienceId}`}
                >
                  {audienceFilters.find(f => f.value === audienceId)?.label ?? audienceId}
                  <X className="w-3 h-3" />
                </button>
              ))}
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
                key={section.tag ?? section.label}
                data-testid={`section-${(section.tag ?? section.label).replace(/\s+/g, "-")}`}
                className={section.all.length === 0 ? "hidden" : undefined}
              >
                <div className="flex flex-col items-start gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <h2
                      className="text-base font-semibold"
                      data-testid={`text-section-${(section.tag ?? section.label).replace(/\s+/g, "-")}`}
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
                  <nav
                    className="flex flex-wrap gap-x-3 gap-y-1"
                    aria-label={`${section.label} categories`}
                  >
                    {categories?.filter(category =>
                      section.all.some(product => product.categoryId === category.id),
                    ).map(category => (
                      <a
                        key={category.id}
                        href={`/category/${encodeURIComponent(category.slug)}`}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Shop {category.name}
                      </a>
                    ))}
                  </nav>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {section.all.map(product => (
                    <ProductCardNew key={product.id} product={product} onQuickAdd={setQuickAddProduct} />
                  ))}
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
        onReopen={(product) => setQuickAddProduct(product)}
        onOpenChange={open => !open && setQuickAddProduct(null)}
      />
    </div>
  );
}
