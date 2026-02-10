import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowRight, Gift, Truck, Star, Sparkles, Heart, Scissors, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import ProductCardNew from "@/components/ProductCardNew";
import QuickAddSheet from "@/components/QuickAddSheet";
import heroBanner from "@/assets/images/hero-banner.png";
import kidsBanner from "@/assets/images/kids-banner.png";
import couplesBanner from "@/assets/images/couples-banner.png";
import adultsBanner from "@assets/4laurel_set_s_1770763286429.jpg";
import towelsBanner from "@/assets/images/towels-collection.png";
import bathrobesBanner from "@/assets/images/bathrobes-collection.png";
import blanketsBanner from "@/assets/images/blankets-collection.png";
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

const testimonials = [
  { name: "Priya M.", location: "Mumbai", text: "The embroidery quality is stunning! My daughter loves her personalised Elsa towel. Perfect birthday gift.", rating: 5 },
  { name: "Rahul K.", location: "Delhi", text: "Ordered the couple towel set for our anniversary. The quality is premium and the embroidery is beautiful.", rating: 5 },
  { name: "Ananya S.", location: "Bangalore", text: "Buy 2 Get 1 Free is such a great deal. Got blankets for all three kids. Super soft fabric!", rating: 5 },
  { name: "Neha G.", location: "Pune", text: "Fast delivery and amazing packaging. The personalised touch makes it so special. Will order again!", rating: 5 },
];

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
    <div className="pb-20 md:pb-0">
      <section className="relative overflow-hidden" data-testid="section-hero">
        <div className="absolute inset-0">
          <img
            src={heroBanner}
            alt="Luxury embroidered towels and blankets"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/50 to-black/25" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 py-20 md:py-32">
          <div className="max-w-xl space-y-5">
            <Badge className="no-default-hover-elevate no-default-active-elevate bg-white/15 text-white border-white/25 backdrop-blur-sm">
              <Sparkles className="w-3 h-3 mr-1" /> Personalised Embroidery
            </Badge>
            <h1 className="text-3xl md:text-5xl font-bold leading-tight text-white" data-testid="text-hero-title">
              Luxury Towels & Blankets{" "}
              <span className="text-emerald-300">with Your Name</span>
            </h1>
            <p className="text-white/80 md:text-lg leading-relaxed" data-testid="text-hero-subtitle">
              Premium quality embroidered products, personalised with love. The perfect gift for your little ones and loved ones.
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

      <section className="max-w-7xl mx-auto px-4 py-10 md:py-14" data-testid="section-promise">
        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">The Turtle Little Promise</p>
          <h2 className="text-xl md:text-2xl font-bold" data-testid="text-promise-heading">
            Crafted with Care, Personalised with Love
          </h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-lg mx-auto leading-relaxed">
            Every product is made from premium fabrics and meticulously embroidered to create something truly special.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          <div className="text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-sm">Premium Fabric</h3>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
              Only the finest quality cotton and fabrics are selected for our towels and blankets, ensuring lasting softness and comfort.
            </p>
          </div>
          <div className="text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <Scissors className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-sm">Hand Embroidered</h3>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
              Each design is carefully embroidered with precision and artistry. Your child's name is stitched into every piece with meticulous detail.
            </p>
          </div>
          <div className="text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <Heart className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-sm">Made with Love</h3>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
              From Disney princesses to superheroes, every design is chosen to delight. The perfect personalised gift for every occasion.
            </p>
          </div>
        </div>
      </section>

      <Separator className="max-w-7xl mx-auto" />

      <section className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Collections</p>
          <h2 className="text-xl md:text-2xl font-bold" data-testid="text-audience-heading">Shop by Collection</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/shop?filter=kids">
            <div className="group" data-testid="card-shop-kids">
              <div className="relative rounded-md overflow-hidden">
                <img
                  src={kidsBanner}
                  alt="Kids towels collection"
                  className="w-full aspect-[4/3] object-cover transition-opacity duration-300 group-hover:opacity-90"
                />
              </div>
              <div className="mt-3 space-y-1 px-1">
                <h3 className="font-bold text-base" data-testid="text-collection-kids">For Kids</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Make bath time their favourite time. Our kids' collection features Disney princesses, superheroes, unicorns and more — all embroidered with your child's name. Towels and blankets they'll never want to let go of.
                </p>
              </div>
            </div>
          </Link>
          <Link href="/shop?filter=adults">
            <div className="group" data-testid="card-shop-adults">
              <div className="relative rounded-md overflow-hidden">
                <img
                  src={adultsBanner}
                  alt="Adults towels collection"
                  className="w-full aspect-[4/3] object-cover transition-opacity duration-300 group-hover:opacity-90"
                />
              </div>
              <div className="mt-3 space-y-1 px-1">
                <h3 className="font-bold text-base" data-testid="text-collection-adults">For Adults</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Elevate your everyday essentials. Our adults' range features elegant monograms, laurel crests and classic initials — personalised towels and blankets that bring a touch of luxury to your home.
                </p>
              </div>
            </div>
          </Link>
          <Link href="/shop?filter=couples">
            <div className="group" data-testid="card-shop-couples">
              <div className="relative rounded-md overflow-hidden">
                <img
                  src={couplesBanner}
                  alt="Couple towel sets"
                  className="w-full aspect-[4/3] object-cover transition-opacity duration-300 group-hover:opacity-90"
                />
              </div>
              <div className="mt-3 space-y-1 px-1">
                <h3 className="font-bold text-base" data-testid="text-collection-couples">For Couples</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  The perfect his & hers gift. Our couple towel sets come with matching embroidered designs — from King & Queen crowns to Mr. Right & Mrs. Always Right. Ideal for weddings, anniversaries and housewarmings.
                </p>
              </div>
            </div>
          </Link>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Products</p>
          <h2 className="text-xl md:text-2xl font-bold" data-testid="text-product-type-heading">Shop by Product</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/shop">
            <div className="group" data-testid="card-product-towels">
              <div className="relative rounded-md overflow-hidden">
                <img
                  src={towelsBanner}
                  alt="Personalised towels"
                  className="w-full aspect-[4/3] object-cover transition-opacity duration-300 group-hover:opacity-90"
                />
              </div>
              <div className="mt-3 space-y-1 px-1">
                <h3 className="font-bold text-base" data-testid="text-product-towels">Towels</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Wrap yourself in luxury. Our 550 GSM zero-twist cotton towels are soft, absorbent and beautifully embroidered with your name or initials. Available for kids and adults in a range of fun and elegant designs.
                </p>
              </div>
            </div>
          </Link>
          <Link href="/shop">
            <div className="group" data-testid="card-product-bathrobes">
              <div className="relative rounded-md overflow-hidden">
                <img
                  src={bathrobesBanner}
                  alt="Personalised bathrobes"
                  className="w-full aspect-[4/3] object-cover transition-opacity duration-300 group-hover:opacity-90"
                />
              </div>
              <div className="mt-3 space-y-1 px-1">
                <h3 className="font-bold text-base" data-testid="text-product-bathrobes">Bathrobes</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Step out of the shower in style. Our plush terry cotton bathrobes are personalised with custom embroidery, making every day feel like a spa day. Perfect as a gift or a treat for yourself.
                </p>
              </div>
            </div>
          </Link>
          <Link href="/shop">
            <div className="group" data-testid="card-product-blankets">
              <div className="relative rounded-md overflow-hidden">
                <img
                  src={blanketsBanner}
                  alt="Personalised blankets"
                  className="w-full aspect-[4/3] object-cover transition-opacity duration-300 group-hover:opacity-90"
                />
              </div>
              <div className="mt-3 space-y-1 px-1">
                <h3 className="font-bold text-base" data-testid="text-product-blankets">Blankets</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Snuggle up with a blanket made just for you. Our ultra-soft AC blankets come with beautiful embroidered names and fun designs — loved by kids and perfect for gifting on birthdays and special occasions.
                </p>
              </div>
            </div>
          </Link>
        </div>
      </section>

      <Separator className="max-w-7xl mx-auto" />

      {isLoading ? (
        <div className="max-w-7xl mx-auto px-4 py-4 space-y-6">
          <Skeleton className="h-6 w-40" />
          <ProductGridSkeleton />
        </div>
      ) : (
        <>
          {featuredKids.length > 0 && (
            <section className="max-w-7xl mx-auto px-4 py-6 space-y-2">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-xl font-bold" data-testid="text-kids-section">Popular for Kids</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Disney princesses, superheroes & more</p>
                </div>
                <Link href="/shop?filter=kids">
                  <Button variant="ghost" size="sm" data-testid="link-view-all-kids">
                    See All <ArrowRight className="w-4 h-4 ml-1" />
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

          <section className="bg-primary/5 py-8 my-4">
            <div className="max-w-7xl mx-auto px-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Gift className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold">Buy 2 Get 1 Free</h3>
              </div>
              <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                Mix and match across all products. Add 3 or more items to your cart and the cheapest ones are free!
              </p>
              <Link href="/shop">
                <Button className="mt-4" data-testid="button-promo-shop">
                  Start Shopping <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </section>

          {featuredAdults.length > 0 && (
            <section className="max-w-7xl mx-auto px-4 py-6 space-y-2">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-xl font-bold" data-testid="text-couples-section">Couple Sets</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Elegant matching towel sets for two</p>
                </div>
                <Link href="/shop?filter=couples">
                  <Button variant="ghost" size="sm" data-testid="link-view-all-couples">
                    See All <ArrowRight className="w-4 h-4 ml-1" />
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
            <section className="max-w-7xl mx-auto px-4 py-6 space-y-2">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-xl font-bold" data-testid="text-blankets-section">Cozy Blankets</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Soft personalised AC blankets for kids</p>
                </div>
                <Link href="/shop?filter=kids">
                  <Button variant="ghost" size="sm" data-testid="link-view-all-blankets">
                    See All <ArrowRight className="w-4 h-4 ml-1" />
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

      <Separator className="max-w-7xl mx-auto" />

      <section className="max-w-7xl mx-auto px-4 py-10" data-testid="section-testimonials">
        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">What Our Customers Say</p>
          <h2 className="text-xl md:text-2xl font-bold">Loved by Parents & Couples</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {testimonials.map((t, i) => (
            <Card key={i} className="p-4 space-y-3" data-testid={`card-testimonial-${i}`}>
              <div className="flex items-center gap-0.5">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">"{t.text}"</p>
              <div>
                <p className="text-sm font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.location}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-primary/5 py-10 mb-2">
        <div className="max-w-7xl mx-auto px-4 text-center space-y-2">
          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
            <div>
              <p className="text-2xl md:text-3xl font-bold text-primary" data-testid="text-stat-products">58+</p>
              <p className="text-xs text-muted-foreground">Products</p>
            </div>
            <div>
              <p className="text-2xl md:text-3xl font-bold text-primary" data-testid="text-stat-designs">5</p>
              <p className="text-xs text-muted-foreground">Collections</p>
            </div>
            <div>
              <p className="text-2xl md:text-3xl font-bold text-primary" data-testid="text-stat-delivery">All India</p>
              <p className="text-xs text-muted-foreground">Free Delivery</p>
            </div>
          </div>
        </div>
      </section>

      <QuickAddSheet
        product={quickAddProduct}
        open={!!quickAddProduct}
        onOpenChange={(open) => !open && setQuickAddProduct(null)}
      />
    </div>
  );
}
