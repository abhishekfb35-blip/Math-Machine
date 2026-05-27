import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowRight, ChevronLeft, ChevronRight, Gift, Truck, Star, Sparkles, Heart, Scissors, Shield } from "lucide-react";
import SEO, { OrganizationJsonLd } from "@/components/SEO";
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
import type { Product } from "@shared/types";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import {
  defaultHero, defaultPromise, defaultCollections, defaultProductTypes,
  defaultPromo, defaultTestimonials, defaultStats, defaultFeaturedSections,
  defaultHomepageCollections,
  type HeroConfig, type PromiseConfig, type CollectionsConfig,
  type ProductTypesConfig, type PromoConfig, type TestimonialsConfig,
  type StatsConfig, type FeaturedSectionsConfig, type FeaturedSectionConfig,
  type HomepageCollectionsConfig, type HomepageCollectionSection,
} from "@/lib/siteConfigDefaults";

const defaultCollectionImages = [kidsBanner, adultsBanner, couplesBanner];
const defaultProductTypeImages = [towelsBanner, bathrobesBanner, blanketsBanner];
const promiseIcons = [Shield, Scissors, Heart];

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

const HOME_VISIBLE = 4;

function buildSeeAllHref(cfg: FeaturedSectionConfig): string {
  const p = new URLSearchParams();
  if (cfg.categoryFilters.length === 1) p.set("category", cfg.categoryFilters[0]);
  if (cfg.audienceFilters.length === 1) p.set("filter",   cfg.audienceFilters[0]);
  if (cfg.genderFilters.length)         p.set("gender",   cfg.genderFilters.join(","));
  if (cfg.themeFilters.length)          p.set("theme",    cfg.themeFilters.join(","));
  if (cfg.styleFilters.length)          p.set("style",    cfg.styleFilters.join(","));
  if (cfg.tagFilters.length === 1)      p.set("tag",      cfg.tagFilters[0]);
  const qs = p.toString();
  return qs ? `/shop?${qs}` : "/shop";
}

function FeaturedSection({ products, title, subtitle, link, testIdPrefix, onQuickAdd }: {
  products: Product[];
  title: string;
  subtitle: string;
  link: string;
  testIdPrefix: string;
  onQuickAdd: (p: Product) => void;
}) {
  const [offset, setOffset] = useState(0);
  const canLeft = offset > 0;
  const canRight = offset + HOME_VISIBLE < products.length;
  const visible = products.slice(offset, offset + HOME_VISIBLE);

  return (
    <section className="max-w-7xl mx-auto py-6 space-y-2">
      <div className="flex items-center justify-between gap-4 flex-wrap px-4">
        <div>
          <h2 className="text-xl font-bold" data-testid={`text-${testIdPrefix}-section`}>{title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <Link href={link}>
          <Button variant="ghost" data-testid={`link-view-all-${testIdPrefix}`}>
            See All <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </div>

      {/* Mobile: horizontal scroll — cards are 40vw wide so ~2 fit with a clear peek of the 3rd */}
      <div className="sm:hidden overflow-x-auto scrollbar-none px-4 pb-1">
        <div className="flex gap-3" style={{ width: "max-content" }}>
          {products.map(product => (
            <div key={product.id} className="w-[40vw] shrink-0">
              <ProductCardNew product={product} onQuickAdd={onQuickAdd} />
            </div>
          ))}
        </div>
      </div>

      {/* Tablet and up: prev/next buttons with 4-up grid */}
      <div className="hidden sm:flex items-center gap-2 px-4">
        <Button
          variant="outline" size="icon"
          className="shrink-0 h-9 w-9"
          disabled={!canLeft}
          onClick={() => setOffset(o => Math.max(0, o - 1))}
          data-testid={`button-${testIdPrefix}-prev`}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex gap-3 flex-1 min-w-0">
          {visible.map(product => (
            <div key={product.id} className="flex-1 min-w-0">
              <ProductCardNew product={product} onQuickAdd={onQuickAdd} />
            </div>
          ))}
        </div>
        <Button
          variant="outline" size="icon"
          className="shrink-0 h-9 w-9"
          disabled={!canRight}
          onClick={() => setOffset(o => Math.min(products.length - HOME_VISIBLE, o + 1))}
          data-testid={`button-${testIdPrefix}-next`}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </section>
  );
}

export default function Home() {
  const [quickAddProduct, setQuickAddProduct] = useState<Product | null>(null);

  const hero = useSiteConfig<HeroConfig>("hero", defaultHero);
  const promise = useSiteConfig<PromiseConfig>("promise", defaultPromise);
  const promo = useSiteConfig<PromoConfig>("promo", defaultPromo);
  const testimonials = useSiteConfig<TestimonialsConfig>("testimonials", defaultTestimonials);
  const stats = useSiteConfig<StatsConfig>("stats", defaultStats);
  const featured = useSiteConfig<FeaturedSectionsConfig>("featuredSections", defaultFeaturedSections);

  const { data: allSiteConfig } = useQuery<Record<string, any>>({
    queryKey: ["/api/site-config"],
  });

  const homepageCollections: HomepageCollectionSection[] = (() => {
    if (allSiteConfig?.["homepageCollections"]?.sections) {
      return allSiteConfig["homepageCollections"].sections;
    }
    const sections: HomepageCollectionSection[] = [];
    const savedCollections = allSiteConfig?.["collections"];
    if (savedCollections) {
      sections.push({ id: "collections", label: savedCollections.label || "Collections", heading: savedCollections.heading || "Shop by Collection", cards: savedCollections.cards || [] });
    } else {
      sections.push(defaultHomepageCollections.sections[0]);
    }
    const savedProductTypes = allSiteConfig?.["productTypes"];
    if (savedProductTypes) {
      sections.push({ id: "productTypes", label: savedProductTypes.label || "Products", heading: savedProductTypes.heading || "Shop by Product", cards: savedProductTypes.cards || [] });
    } else {
      sections.push(defaultHomepageCollections.sections[1]);
    }
    return sections;
  })();

  const { data: homeCollections, isLoading: collectionsLoading } = useQuery<{
    kids: Product[];
    couples: Product[];
    blankets: Product[];
    bathrobes: Product[];
  }>({
    queryKey: ["/api/home/collections"],
    staleTime: 12 * 60 * 60 * 1000,
  });

  const isLoading = collectionsLoading;

  const featuredKids = homeCollections?.kids ?? [];
  const featuredAdults = homeCollections?.couples ?? [];
  const featuredBlankets = homeCollections?.blankets ?? [];
  const featuredBathrobes = homeCollections?.bathrobes ?? [];

  return (
    <div className="pb-20 md:pb-0">
      <SEO path="/" jsonLd={OrganizationJsonLd()} />
      <section className="relative overflow-hidden" data-testid="section-hero">
        <div className="absolute inset-0">
          <img
            src={hero.imageUrl || heroBanner}
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
              {hero.title}{" "}
              <span className="text-emerald-300">{hero.titleHighlight}</span>
            </h1>
            <p className="text-white/80 md:text-lg leading-relaxed" data-testid="text-hero-subtitle">
              {hero.subtitle}
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <Link href={hero.primaryButtonLink}>
                <Button size="lg" data-testid="button-shop-now">
                  {hero.primaryButtonText} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href={hero.secondaryButtonLink}>
                <Button size="lg" variant="outline" className="backdrop-blur-sm bg-white/10 text-white border-white/30" data-testid="button-shop-couples">
                  {hero.secondaryButtonText}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-10 md:py-14" data-testid="section-promise">
        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">{promise.label}</p>
          <h2 className="text-xl md:text-2xl font-bold" data-testid="text-promise-heading">
            {promise.heading}
          </h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-lg mx-auto leading-relaxed">
            {promise.subheading}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {promise.cards.map((card, i) => {
            const Icon = promiseIcons[i] || Shield;
            return (
              <div key={i} className="text-center space-y-3">
                <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-base">{card.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                  {card.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <Separator className="max-w-7xl mx-auto" />

      {homepageCollections.map((section, si) => (
        <section key={section.id || si} className="max-w-7xl mx-auto px-4 py-8" data-testid={`section-collection-${si}`}>
          <div className="text-center mb-6">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">{section.label}</p>
            <h2 className="text-xl md:text-2xl font-bold" data-testid={`text-collection-heading-${si}`}>{section.heading}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {section.cards.map((card, ci) => (
              <Link key={ci} href={card.link}>
                <div className="group" data-testid={`card-collection-${si}-${ci}`}>
                  <div className="relative rounded-md overflow-hidden">
                    <img
                      src={card.imageUrl || (si === 0 ? defaultCollectionImages[ci] : si === 1 ? defaultProductTypeImages[ci] : undefined) || kidsBanner}
                      alt={card.title}
                      className="w-full aspect-[4/3] object-contain transition-opacity duration-300 group-hover:opacity-90"
                    />
                  </div>
                  <div className="mt-3 space-y-1 px-1">
                    <h3 className="font-bold text-base" data-testid={`text-collection-title-${si}-${ci}`}>{card.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {card.description}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <Separator className="max-w-7xl mx-auto" />

      {isLoading ? (
        <div className="max-w-7xl mx-auto px-4 py-4 space-y-6">
          <Skeleton className="h-6 w-40" />
          <ProductGridSkeleton />
        </div>
      ) : (
        <>
          {featuredKids.length > 0 && (
            <FeaturedSection
              products={featuredKids}
              title={featured.kids.title}
              subtitle={featured.kids.subtitle}
              link={buildSeeAllHref(featured.kids)}
              testIdPrefix="kids"
              onQuickAdd={setQuickAddProduct}
            />
          )}

          <section className="bg-primary/5 py-8 my-4">
            <div className="max-w-7xl mx-auto px-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Gift className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold">{promo.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                {promo.description}
              </p>
              <Link href={promo.buttonLink}>
                <Button className="mt-4" data-testid="button-promo-shop">
                  {promo.buttonText} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </section>

          {featuredAdults.length > 0 && (
            <FeaturedSection
              products={featuredAdults}
              title={featured.couples.title}
              subtitle={featured.couples.subtitle}
              link={buildSeeAllHref(featured.couples)}
              testIdPrefix="couples"
              onQuickAdd={setQuickAddProduct}
            />
          )}

          {featuredBlankets.length > 0 && (
            <FeaturedSection
              products={featuredBlankets}
              title={featured.blankets.title}
              subtitle={featured.blankets.subtitle}
              link={buildSeeAllHref(featured.blankets)}
              testIdPrefix="blankets"
              onQuickAdd={setQuickAddProduct}
            />
          )}

          {featuredBathrobes.length > 0 && (
            <FeaturedSection
              products={featuredBathrobes}
              title={featured.bathrobes?.title || "Luxury Bathrobes"}
              subtitle={featured.bathrobes?.subtitle || "Premium personalised cotton bathrobes"}
              link={buildSeeAllHref(featured.bathrobes ?? defaultFeaturedSections.bathrobes)}
              testIdPrefix="bathrobes"
              onQuickAdd={setQuickAddProduct}
            />
          )}
        </>
      )}

      <Separator className="max-w-7xl mx-auto" />

      <section className="max-w-7xl mx-auto px-4 py-10" data-testid="section-testimonials">
        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">{testimonials.label}</p>
          <h2 className="text-xl md:text-2xl font-bold">{testimonials.heading}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {testimonials.items.map((t, i) => (
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
            {stats.items.map((stat, i) => (
              <div key={i}>
                <p className="text-2xl md:text-3xl font-bold text-primary" data-testid={`text-stat-${i}`}>{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
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
