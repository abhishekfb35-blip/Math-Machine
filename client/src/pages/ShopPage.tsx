import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { SlidersHorizontal, Search, X } from "lucide-react";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCardNew from "@/components/ProductCardNew";
import QuickAddSheet from "@/components/QuickAddSheet";
import kidsBanner from "@/assets/images/kids-banner.png";
import couplesBanner from "@/assets/images/couples-banner.png";
import blanketsBanner from "@/assets/images/blankets-banner.png";
import type { Category, Product } from "@shared/types";

type AudienceFilter = "all" | "kids" | "adults" | "couples";

const categoryBanners: Record<string, { image: string; label: string; description: string }> = {
  "towels": { image: kidsBanner, label: "Towels", description: "Personalised embroidered luxury towels for everyone" },
  "bathrobes": { image: couplesBanner, label: "Bathrobes", description: "Plush personalised bathrobes for all ages" },
  "blankets": { image: blanketsBanner, label: "Blankets", description: "Soft personalised AC blankets for kids" },
};

const filters: { label: string; value: AudienceFilter }[] = [
  { label: "All", value: "all" },
  { label: "Kids", value: "kids" },
  { label: "Adults", value: "adults" },
  { label: "Couples", value: "couples" },
];

function ProductGridSkeleton() {
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

export default function ShopPage() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const initialFilter = (params.get("filter") as AudienceFilter) || "all";

  const initialSearch = params.get("q") || "";
  const [activeFilter, setActiveFilter] = useState<AudienceFilter>(initialFilter);
  const [quickAddProduct, setQuickAddProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState(initialSearch);

  useEffect(() => {
    const p = new URLSearchParams(searchString);
    const f = p.get("filter") as AudienceFilter;
    if (f && filters.some(fl => fl.value === f)) {
      setActiveFilter(f);
    }
    const q = p.get("q");
    if (q) {
      setSearchQuery(q);
      setActiveFilter("all");
    }
  }, [searchString]);

  const { data: categories, isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const isLoading = categoriesLoading || productsLoading;

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    let result = products;
    if (activeFilter !== "all") {
      const audienceMap: Record<string, string[]> = {
        kids: ["kids"],
        adults: ["adults"],
        couples: ["couples"],
      };
      const audiences = audienceMap[activeFilter] || [];
      result = result.filter((p) => audiences.includes(p.audience || "kids"));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q))
      );
    }
    return result;
  }, [products, activeFilter, searchQuery]);

  const groupedByCategory = useMemo(() => {
    if (!categories) return [];
    return categories.map((cat) => ({
      category: cat,
      products: filteredProducts.filter((p) => p.categoryId === cat.id),
    })).filter(g => g.products.length > 0);
  }, [categories, filteredProducts]);

  return (
    <div className="pb-20 md:pb-8">
      <SEO title="Shop All Products" description="Browse our complete collection of personalised luxury towels, blankets & bathrobes. Buy 2 Get 1 Free." path="/shop" />
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search products by name, SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
              data-testid="input-search-products"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                data-testid="button-clear-search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            <SlidersHorizontal className="w-4 h-4 shrink-0 text-muted-foreground" />
            {filters.map((f) => (
              <Button
                key={f.value}
                variant={activeFilter === f.value ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter(f.value)}
                className="shrink-0"
                data-testid={`filter-${f.value}`}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4 space-y-8">
        {isLoading ? (
          <ProductGridSkeleton />
        ) : groupedByCategory.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">
              {searchQuery.trim() ? `No products found for "${searchQuery}"` : "No products found for this filter."}
            </p>
          </div>
        ) : (
          groupedByCategory.map(({ category, products: catProducts }) => {
            const banner = categoryBanners[category.slug];
            return (
              <section key={category.id} className="space-y-3">
                {banner && (
                  <div className="relative rounded-md overflow-hidden" data-testid={`banner-${category.slug}`}>
                    <img
                      src={banner.image}
                      alt={category.name}
                      className="w-full h-28 md:h-40 object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
                    <div className="absolute bottom-0 left-0 p-4 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg md:text-xl font-bold text-white" data-testid={`text-shop-section-${category.slug}`}>
                          {category.name}
                        </h2>
                        <Badge className="no-default-hover-elevate no-default-active-elevate bg-white/20 text-white border-white/30 text-xs" data-testid={`badge-count-${category.slug}`}>
                          {catProducts.length} items
                        </Badge>
                      </div>
                      <p className="text-xs text-white/70">{banner.description}</p>
                    </div>
                  </div>
                )}
                {!banner && (
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <h2 className="text-lg font-bold" data-testid={`text-shop-section-${category.slug}`}>
                      {category.name}
                    </h2>
                    <span className="text-xs text-muted-foreground" data-testid={`text-count-${category.slug}`}>
                      {catProducts.length} products
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {catProducts.map((product) => (
                    <ProductCardNew
                      key={product.id}
                      product={product}
                      onQuickAdd={setQuickAddProduct}
                    />
                  ))}
                </div>
              </section>
            );
          })
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
