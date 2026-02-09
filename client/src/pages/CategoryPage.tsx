import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCard from "@/components/ProductCard";
import type { Category, Product } from "@shared/schema";

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data: category, isLoading: categoryLoading } = useQuery<Category>({
    queryKey: ["/api/categories", slug],
  });

  const { data: allProducts, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const products = allProducts?.filter((p) => category && p.categoryId === category.id) || [];
  const isLoading = categoryLoading || productsLoading;

  return (
    <div className="min-h-screen">
      <div className="bg-primary/5 dark:bg-primary/10 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2" data-testid="nav-breadcrumb">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground">{category?.name || "..."}</span>
          </div>
          {isLoading ? (
            <Skeleton className="h-10 w-64" />
          ) : (
            <>
              <h1 className="text-3xl md:text-4xl font-bold" data-testid="text-category-title">{category?.name}</h1>
              {category?.description && (
                <p className="text-muted-foreground mt-2 max-w-2xl" data-testid="text-category-description">{category.description}</p>
              )}
              <p className="text-sm text-muted-foreground mt-2" data-testid="text-product-count">{products.length} products</p>
            </>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4 mb-6">
        <Card className="p-3 bg-primary/5 dark:bg-primary/10 border-primary/20">
          <p className="text-sm font-medium text-center" data-testid="text-offer-banner">
            Buy 2 Get 1 Free, Buy 3 Get 2 Free, Buy 4 Get 3 Free & So On! Call or WhatsApp for assistance - 99900 79722
          </p>
        </Card>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-16">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
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
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg">No products found in this category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
