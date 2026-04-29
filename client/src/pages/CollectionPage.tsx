import { useState, useMemo, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
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
import type { Category, Product } from "@shared/types";

type Audience = "kids" | "adults" | "couples";
type GenderFilter = "all" | "boys" | "girls" | "unisex";

const audienceLabels: Record<Audience, string> = {
  kids: "For Kids",
  adults: "For Adults",
  couples: "For Couples",
};

const audienceDescriptions: Record<Audience, string> = {
  kids: "Personalised towels, blankets & bathrobes your little ones will love",
  adults: "Elegant personalised essentials for everyday luxury",
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


const genderFilters: { label: string; value: GenderFilter }[] = [
  { label: "All", value: "all" },
  { label: "Boys", value: "boys" },
  { label: "Girls", value: "girls" },
  { label: "Unisex", value: "unisex" },
];

const boysKeywords = [
  "boy", "boys", "superhero", "spider", "batman", "avenger", "iron man", "captain america",
  "car ", "cars", "racing", "truck", "dinosaur", "dino", "dragon", "monster", "pirate",
  "football", "cricket", "soccer", "sports", "bike", "cycle", "rocket", "space",
  "shark", "crocodile", "lion", "tiger", "robot", "ninja", "army", "soldier",
  "king crown", "mr ", "mr.", "his", "men", "man", "gentleman",
];

const girlsKeywords = [
  "girl", "girls", "princess", "fairy", "unicorn", "pony", "ballerina", "ballet",
  "butterfly", "flower", "floral", "mermaid", "barbie", "doll", "kitty", "hello kitty",
  "rainbow", "heart", "tiara", "crown queen", "queen crown",
  "ladies", "women", "mrs", "her ", "she ", "lady",
];

function detectGender(product: Product): GenderFilter {
  const name = product.name.toLowerCase();
  const slug = product.slug.toLowerCase();
  const text = `${name} ${slug}`;

  const isBoys = boysKeywords.some((kw) => text.includes(kw));
  const isGirls = girlsKeywords.some((kw) => text.includes(kw));

  if (isBoys && !isGirls) return "boys";
  if (isGirls && !isBoys) return "girls";
  return "unisex";
}

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

const validAudiences: Audience[] = ["kids", "adults", "couples"];

export default function CollectionPage() {
  const params = useParams<{ audience: string }>();
  const rawAudience = params.audience || "kids";
  const audience: Audience = validAudiences.includes(rawAudience as Audience) ? (rawAudience as Audience) : "kids";
  const [quickAddProduct, setQuickAddProduct] = useState<Product | null>(null);
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");

  const { data: categories, isLoading: catLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: products, isLoading: prodLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const isLoading = catLoading || prodLoading;

  const audienceProducts = useMemo(() => {
    if (!products) return [];
    const ageGroupValue = audience === "couples" ? "adults" : audience;
    let filtered = products.filter((p) => {
      return (p.ageGroups ?? []).includes(ageGroupValue);
    });
    if (genderFilter !== "all") {
      filtered = filtered.filter((p) => detectGender(p) === genderFilter);
    }
    return filtered;
  }, [products, audience, genderFilter]);

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

  return (
    <div className="pb-20 md:pb-8">
      <SEO
        title={`${audienceLabels[audience] || "Collection"}`}
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
            {audienceLabels[audience] || "Collection"}
          </h1>
          <p className="text-sm text-muted-foreground" data-testid="text-collection-desc">
            {audienceDescriptions[audience] || ""}
          </p>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          <SlidersHorizontal className="w-4 h-4 shrink-0 text-muted-foreground" />
          {genderFilters.map((f) => (
            <Button
              key={f.value}
              variant={genderFilter === f.value ? "default" : "outline"}
              size="sm"
              onClick={() => setGenderFilter(f.value)}
              className="shrink-0"
              data-testid={`filter-gender-${f.value}`}
            >
              {f.label}
            </Button>
          ))}
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
                      {audience === "kids" ? "Kids " : audience === "adults" ? "Adult " : "Couple "}{section.config.label}
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
