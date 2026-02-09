import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowRight, Gift, Truck, Star, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCardNew from "@/components/ProductCardNew";
import QuickAddSheet from "@/components/QuickAddSheet";
import heroBanner from "@/assets/images/hero-banner.png";
import kidsBanner from "@/assets/images/kids-banner.png";
import couplesBanner from "@/assets/images/couples-banner.png";
import blanketsBanner from "@/assets/images/blankets-banner.png";
import type { Category, Product } from "@shared/schema";

function ProductGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
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
  const [quickAddProduct, setQuickAddProduct] = useState<Product | null>(null);

  const { data: categories, isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const isLoading = categoriesLoading || productsLoading;

  const kidsProducts = products?.filter((p) => {
    const cat = categories?.find((c) => c.id === p.categoryId);
    return cat && (cat.slug.includes("girls") || cat.slug.includes("boys")) && !cat.slug.includes("couple");
  }) || [];

  const adultProducts = products?.filter((p) => {
    const cat = categories?.find((c) => c.id === p.categoryId);
    return cat && cat.slug.includes("couple");
  }) || [];

  const blanketProducts = products?.filter((p) => {
    const cat = categories?.find((c) => c.id === p.categoryId);
    return cat && cat.slug.includes("blanket");
  }) || [];

  const featuredKids = kidsProducts.slice(0, 4);
  const featuredAdults = adultProducts.slice(0, 4);
  const featuredBlankets = blanketProducts.slice(0, 4);

  return (
    <div className="pb-20 md:pb-8">
      <section className="relative overflow-hidden" data-testid="section-hero">
        <div className="absolute inset-0">
          <img
            src={heroBanner}
            alt="Luxury embroidered towels and blankets"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 py-16 md:py-28">
          <div className="max-w-xl space-y-4">
            <Badge className="no-default-hover-elevate no-default-active-elevate bg-white/15 text-white border-white/25 backdrop-blur-sm">
              <Sparkles className="w-3 h-3 mr-1" /> Personalised Embroidery
            </Badge>
            <h1 className="text-3xl md:text-5xl font-bold leading-tight text-white" data-testid="text-hero-title">
              Luxury Towels & Blankets{" "}
              <span className="text-primary">with Your Name</span>
            </h1>
            <p className="text-white/80 md:text-lg" data-testid="text-hero-subtitle">
              Premium embroidered products for kids and couples. Hand-crafted with love.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <Link href="/shop">
                <Button size="lg" data-testid="button-shop-now">
                  Shop Now <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/shop?filter=couples">
                <Button size="lg" variant="outline" className="backdrop-blur-sm bg-white/10 text-white border-white/30" data-testid="button-shop-couples">
                  Couple Sets
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-3 gap-3">
          <Card className="flex flex-col items-center text-center gap-2 p-3 md:p-4">
            <Gift className="w-6 h-6 md:w-8 md:h-8 text-primary shrink-0" />
            <div>
              <p className="font-semibold text-xs md:text-sm" data-testid="text-offer-title">Buy 2 Get 1 Free</p>
              <p className="text-[10px] md:text-xs text-muted-foreground hidden sm:block">& so on!</p>
            </div>
          </Card>
          <Card className="flex flex-col items-center text-center gap-2 p-3 md:p-4">
            <Truck className="w-6 h-6 md:w-8 md:h-8 text-primary shrink-0" />
            <div>
              <p className="font-semibold text-xs md:text-sm">Free Shipping</p>
              <p className="text-[10px] md:text-xs text-muted-foreground hidden sm:block">All India</p>
            </div>
          </Card>
          <Card className="flex flex-col items-center text-center gap-2 p-3 md:p-4">
            <Star className="w-6 h-6 md:w-8 md:h-8 text-primary shrink-0" />
            <div>
              <p className="font-semibold text-xs md:text-sm">Premium Quality</p>
              <p className="text-[10px] md:text-xs text-muted-foreground hidden sm:block">Luxury fabric</p>
            </div>
          </Card>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-4">
        <h2 className="text-xl font-bold mb-1" data-testid="text-audience-heading">Shop by Collection</h2>
        <p className="text-sm text-muted-foreground mb-4">Find the perfect personalised gift</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Link href="/shop?filter=kids">
            <div className="relative rounded-md overflow-hidden cursor-pointer group" data-testid="card-shop-kids">
              <img
                src={kidsBanner}
                alt="Kids towels collection"
                className="w-full aspect-[4/3] object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 space-y-0.5">
                <h3 className="font-bold text-white text-base md:text-lg">For Kids</h3>
                <p className="text-xs text-white/75">Towels & Blankets</p>
              </div>
            </div>
          </Link>
          <Link href="/shop?filter=couples">
            <div className="relative rounded-md overflow-hidden cursor-pointer group" data-testid="card-shop-adults">
              <img
                src={couplesBanner}
                alt="Couple towel sets"
                className="w-full aspect-[4/3] object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 space-y-0.5">
                <h3 className="font-bold text-white text-base md:text-lg">For Couples</h3>
                <p className="text-xs text-white/75">Matching towel sets</p>
              </div>
            </div>
          </Link>
          <Link href="/shop?filter=kids" className="col-span-2 md:col-span-1">
            <div className="relative rounded-md overflow-hidden cursor-pointer group" data-testid="card-shop-blankets">
              <img
                src={blanketsBanner}
                alt="Kids blankets collection"
                className="w-full aspect-[4/3] object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 space-y-0.5">
                <h3 className="font-bold text-white text-base md:text-lg">Cozy Blankets</h3>
                <p className="text-xs text-white/75">Personalised AC blankets</p>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {isLoading ? (
        <div className="max-w-7xl mx-auto px-4 py-4 space-y-6">
          <Skeleton className="h-6 w-40" />
          <ProductGridSkeleton />
        </div>
      ) : (
        <>
          {featuredKids.length > 0 && (
            <section className="max-w-7xl mx-auto px-4 py-4 space-y-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <h2 className="text-xl font-bold" data-testid="text-kids-section">Popular for Kids</h2>
                <Link href="/shop?filter=kids">
                  <Button variant="ghost" size="sm" data-testid="link-view-all-kids">
                    View All <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {featuredKids.map((product) => (
                  <ProductCardNew key={product.id} product={product} onQuickAdd={setQuickAddProduct} />
                ))}
              </div>
            </section>
          )}

          {featuredAdults.length > 0 && (
            <section className="max-w-7xl mx-auto px-4 py-4 space-y-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <h2 className="text-xl font-bold" data-testid="text-couples-section">Couple Sets</h2>
                <Link href="/shop?filter=couples">
                  <Button variant="ghost" size="sm" data-testid="link-view-all-couples">
                    View All <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {featuredAdults.map((product) => (
                  <ProductCardNew key={product.id} product={product} onQuickAdd={setQuickAddProduct} />
                ))}
              </div>
            </section>
          )}

          {featuredBlankets.length > 0 && (
            <section className="max-w-7xl mx-auto px-4 py-4 space-y-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <h2 className="text-xl font-bold" data-testid="text-blankets-section">Cozy Blankets</h2>
                <Link href="/shop?filter=kids">
                  <Button variant="ghost" size="sm" data-testid="link-view-all-blankets">
                    View All <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {featuredBlankets.map((product) => (
                  <ProductCardNew key={product.id} product={product} onQuickAdd={setQuickAddProduct} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <QuickAddSheet
        product={quickAddProduct}
        open={!!quickAddProduct}
        onOpenChange={(open) => !open && setQuickAddProduct(null)}
      />
    </div>
  );
}
