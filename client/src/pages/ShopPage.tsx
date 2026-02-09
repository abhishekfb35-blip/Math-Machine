import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCardNew from "@/components/ProductCardNew";
import QuickAddSheet from "@/components/QuickAddSheet";
import type { Category, Product } from "@shared/schema";

type AudienceFilter = "all" | "kids" | "adults" | "couples";

function getAudience(slug: string): AudienceFilter {
  if (slug.includes("couple")) return "couples";
  if (slug.includes("girls") || slug.includes("boys")) return "kids";
  return "adults";
}

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
  const [activeFilter, setActiveFilter] = useState<AudienceFilter>("all");
  const [quickAddProduct, setQuickAddProduct] = useState<Product | null>(null);

  const { data: categories, isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const isLoading = categoriesLoading || productsLoading;

  const filteredCategories = useMemo(() => {
    if (!categories) return [];
    if (activeFilter === "all") return categories;
    return categories.filter((c) => getAudience(c.slug) === activeFilter);
  }, [categories, activeFilter]);

  const filteredProducts = useMemo(() => {
    if (!products || !filteredCategories.length) return [];
    const catIds = new Set(filteredCategories.map((c) => c.id));
    return products.filter((p) => catIds.has(p.categoryId));
  }, [products, filteredCategories]);

  const groupedByCategory = useMemo(() => {
    return filteredCategories.map((cat) => ({
      category: cat,
      products: filteredProducts.filter((p) => p.categoryId === cat.id),
    })).filter(g => g.products.length > 0);
  }, [filteredCategories, filteredProducts]);

  return (
    <div className="pb-20 md:pb-8">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-4 py-3">
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
            <p className="text-muted-foreground">No products found for this filter.</p>
          </div>
        ) : (
          groupedByCategory.map(({ category, products: catProducts }) => (
            <section key={category.id} className="space-y-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <h2 className="text-lg font-bold" data-testid={`text-shop-section-${category.slug}`}>
                  {category.name}
                </h2>
                <span className="text-xs text-muted-foreground" data-testid={`text-count-${category.slug}`}>
                  {catProducts.length} products
                </span>
              </div>
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
          ))
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
