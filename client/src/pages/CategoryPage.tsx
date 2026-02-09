import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCardNew from "@/components/ProductCardNew";
import QuickAddSheet from "@/components/QuickAddSheet";
import type { Category, Product } from "@shared/schema";

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

  return (
    <div className="pb-20 md:pb-8">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center gap-1 text-sm text-muted-foreground" data-testid="nav-breadcrumb">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <ChevronRight className="w-3 h-3" />
          <Link href="/shop" className="hover:text-foreground transition-colors">Shop</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground">{category?.name || "..."}</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-2">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
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
