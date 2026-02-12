import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCardNew from "@/components/ProductCardNew";
import QuickAddSheet from "@/components/QuickAddSheet";
import kidsBanner from "@/assets/images/kids-banner.png";
import couplesBanner from "@/assets/images/couples-banner.png";
import blanketsBanner from "@/assets/images/blankets-banner.png";
import type { Category, Product } from "@shared/types";

const categoryBanners: Record<string, string> = {
  "girls-towels": kidsBanner,
  "boys-towels": kidsBanner,
  "couple-towels": couplesBanner,
  "boys-blankets": blanketsBanner,
  "girls-blankets": blanketsBanner,
};

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const [quickAddProduct, setQuickAddProduct] = useState<Product | null>(null);

  const { data: category, isLoading: categoryLoading } = useQuery<Category>({
    queryKey: ["/api/categories", slug],
  });

  const { data: allProducts, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const products = allProducts?.filter((p) => category && p.categoryId === category.id) || [];
  const isLoading = categoryLoading || productsLoading;
  const bannerImage = slug ? categoryBanners[slug] : undefined;

  return (
    <div className="pb-20 md:pb-8">
      {bannerImage && (
        <div className="relative overflow-hidden" data-testid="banner-category">
          <img
            src={bannerImage}
            alt={category?.name || "Category"}
            className="w-full h-36 md:h-52 object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 max-w-7xl mx-auto px-4 pb-4 space-y-1">
            <div className="flex items-center gap-1 text-xs text-white/70" data-testid="nav-breadcrumb">
              <Link href="/" className="hover:text-white transition-colors">Home</Link>
              <ChevronRight className="w-3 h-3" />
              <Link href="/shop" className="hover:text-white transition-colors">Shop</Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-white">{category?.name || "..."}</span>
            </div>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-white" data-testid="text-category-title">{category?.name}</h1>
                {!isLoading && (
                  <p className="text-sm text-white/70" data-testid="text-product-count">
                    {products.length} products
                  </p>
                )}
              </div>
              <Badge className="no-default-hover-elevate no-default-active-elevate bg-white/15 text-white border-white/25 backdrop-blur-sm">
                Buy 2 Get 1 Free
              </Badge>
            </div>
          </div>
        </div>
      )}

      {!bannerImage && (
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center gap-1 text-sm text-muted-foreground" data-testid="nav-breadcrumb">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/shop" className="hover:text-foreground transition-colors">Shop</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground">{category?.name || "..."}</span>
          </div>
          <div className="flex items-center justify-between gap-4 flex-wrap mt-2 mb-4">
            <div>
              <h1 className="text-xl font-bold" data-testid="text-category-title">{category?.name}</h1>
              {!isLoading && (
                <p className="text-sm text-muted-foreground" data-testid="text-product-count">
                  {products.length} products
                </p>
              )}
            </div>
            <Badge className="no-default-hover-elevate no-default-active-elevate bg-primary/10 text-primary border-primary/20">
              Buy 2 Get 1 Free
            </Badge>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-4">
        {isLoading ? (
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
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {products.map((product) => (
              <ProductCardNew
                key={product.id}
                product={product}
                onQuickAdd={setQuickAddProduct}
              />
            ))}
          </div>
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
