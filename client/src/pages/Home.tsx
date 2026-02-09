import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowRight, Star, Truck, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCard from "@/components/ProductCard";
import type { Category, Product } from "@shared/schema";

function CategorySection({ category, products }: { category: Category; products: Product[] }) {
  const featured = products.slice(0, 4);
  if (featured.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-2xl font-bold" data-testid={`text-section-title-${category.slug}`}>{category.name}</h2>
        <Link href={`/category/${category.slug}`}>
          <Button variant="outline" size="sm" data-testid={`link-view-all-${category.slug}`}>
            View All <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {featured.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
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

export default function Home() {
  const { data: categories, isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const isLoading = categoriesLoading || productsLoading;

  return (
    <div className="min-h-screen">
      <section className="relative bg-primary/5 dark:bg-primary/10 py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 text-center space-y-6">
          <h1 className="text-4xl md:text-6xl font-bold leading-tight" data-testid="text-hero-title">
            Personalised Luxury{" "}
            <span className="text-primary">Towels & Blankets</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto" data-testid="text-hero-subtitle">
            Premium embroidered towels and blankets with your name. Hand-crafted with love, delivered to your doorstep.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link href="/category/girls-towels">
              <Button size="lg" data-testid="button-shop-girls">Shop Girls</Button>
            </Link>
            <Link href="/category/boys-towels">
              <Button size="lg" variant="outline" data-testid="button-shop-boys">Shop Boys</Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="flex items-center gap-3 p-4">
            <Gift className="w-8 h-8 text-primary shrink-0" />
            <div>
              <p className="font-semibold text-sm" data-testid="text-offer-title">Buy 2 Get 1 Free</p>
              <p className="text-xs text-muted-foreground">Order 3, pay for only 2 & so on!</p>
            </div>
          </Card>
          <Card className="flex items-center gap-3 p-4">
            <Truck className="w-8 h-8 text-primary shrink-0" />
            <div>
              <p className="font-semibold text-sm">Free Shipping</p>
              <p className="text-xs text-muted-foreground">Across India on all orders</p>
            </div>
          </Card>
          <Card className="flex items-center gap-3 p-4">
            <Star className="w-8 h-8 text-primary shrink-0" />
            <div>
              <p className="font-semibold text-sm">Premium Quality</p>
              <p className="text-xs text-muted-foreground">100% luxury embroidered fabric</p>
            </div>
          </Card>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 pb-16 space-y-12">
        {isLoading ? (
          <>
            <div className="space-y-4">
              <Skeleton className="h-8 w-48" />
              <ProductGridSkeleton />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-8 w-48" />
              <ProductGridSkeleton />
            </div>
          </>
        ) : (
          categories?.map((category) => {
            const categoryProducts = products?.filter((p) => p.categoryId === category.id) || [];
            return <CategorySection key={category.id} category={category} products={categoryProducts} />;
          })
        )}
      </div>
    </div>
  );
}
