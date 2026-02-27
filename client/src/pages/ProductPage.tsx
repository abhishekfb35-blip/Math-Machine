import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { useState, useCallback } from "react";
import { ChevronRight, ShoppingCart, Gift, Check, Star, Ruler, Weight, Layers, Droplets, Palette, Package, Search } from "lucide-react";
import SEO, { ProductJsonLd, BreadcrumbJsonLd } from "@/components/SEO";
import ImageZoomDialog from "@/components/ImageZoomDialog";
import { THUMBNAIL_SIZES } from "@/config/thumbnails";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import ProductCardNew from "@/components/ProductCardNew";
import QuickAddSheet from "@/components/QuickAddSheet";
import { getProductImageUrl } from "@/lib/imageUtils";
import type { Product, Category, ProductImage, ProductReview } from "@shared/types";

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [personalizationName, setPersonalizationName] = useState("");
  const [gentlemanName, setGentlemanName] = useState("");
  const [ladyName, setLadyName] = useState("");
  const [quickAddProduct, setQuickAddProduct] = useState<Product | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [zoomDialogOpen, setZoomDialogOpen] = useState(false);

  const { data: product, isLoading: productLoading } = useQuery<Product>({
    queryKey: ["/api/products", slug],
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: allProducts } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: productImages } = useQuery<ProductImage[]>({
    queryKey: ["/api/products", product?.id, "images"],
    queryFn: async () => {
      if (!product?.id) return [];
      const res = await fetch(`/api/products/${product.id}/images`);
      return res.json();
    },
    enabled: !!product?.id,
  });

  const { data: productReviews } = useQuery<ProductReview[]>({
    queryKey: ["/api/products", product?.id, "reviews"],
    queryFn: async () => {
      if (!product?.id) return [];
      const res = await fetch(`/api/products/${product.id}/reviews`);
      return res.json();
    },
    enabled: !!product?.id,
  });

  const category = categories?.find((c) => c.id === product?.categoryId);

  const relatedProducts = allProducts
    ?.filter((p) => p.categoryId === product?.categoryId && p.id !== product?.id)
    .slice(0, 4) || [];

  const addToCartMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cart/items", {
        productId: product!.id,
        quantity: 1,
        personalizationName: product!.audience === "couples"
          ? (gentlemanName.trim() || ladyName.trim()
            ? `His: ${gentlemanName.trim() || "—"} & Hers: ${ladyName.trim() || "—"}`
            : undefined)
          : (personalizationName.trim() || undefined),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({
        title: "Added to cart",
        description: `${product!.name} has been added to your cart.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add item to cart. Please try again.",
        variant: "destructive",
      });
    },
  });

  const bulletPoints: string[] = product?.bulletPoints ? (() => {
    try { return JSON.parse(product.bulletPoints); } catch { return []; }
  })() : [];

  const specialFeatures: string[] = product?.specialFeatures ? (() => {
    try { return JSON.parse(product.specialFeatures); } catch { return []; }
  })() : [];

  const discountPercent = product?.mrp && product.mrp > product.price
    ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
    : 0;

  const images = product ? (() => {
    const mainImage = { id: 0, productId: product.id, imageUrl: product.imageUrl, sortOrder: 0, isPrimary: true };
    if (productImages && productImages.length > 0) {
      return [mainImage, ...productImages.filter(img => img.imageUrl !== product.imageUrl)];
    }
    return [mainImage];
  })() : [];

  const currentImage = images[selectedImageIndex] || images[0];

  if (productLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="aspect-square rounded-md" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Product not found</h1>
        <Link href="/shop">
          <Button data-testid="button-back-shop">Back to Shop</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-20 md:pb-8">
      {product && (
        <SEO
          title={product.name}
          description={(product.description || "").substring(0, 160)}
          path={`/product/${slug}`}
          type="product"
          image={product.imageUrl ? `https://turtlelittle.com${product.imageUrl}` : undefined}
          jsonLd={[
            ProductJsonLd({
              name: product.name,
              description: product.description || "",
              price: product.price,
              mrp: product.mrp || product.price,
              imageUrl: product.imageUrl,
              slug: product.slug,
              sku: product.sku || "",
              availability: true,
            }),
            BreadcrumbJsonLd([
              { name: "Home", url: "/" },
              { name: "Shop", url: "/shop" },
              { name: product.name, url: `/product/${slug}` },
            ]),
          ]}
        />
      )}
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap" data-testid="nav-breadcrumb">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <ChevronRight className="w-3 h-3" />
          <Link href="/shop" className="hover:text-foreground transition-colors">Shop</Link>
          {category && (
            <>
              <ChevronRight className="w-3 h-3" />
              <Link href={`/category/${category.slug}`} className="hover:text-foreground transition-colors">
                {category.name}
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="grid md:grid-cols-2 gap-6">

          <div className="space-y-3">
            <div
              className="relative aspect-square overflow-hidden rounded-md bg-muted cursor-zoom-in group"
              onClick={() => setZoomDialogOpen(true)}
              data-testid="button-open-zoom"
            >
              <img
                src={getProductImageUrl(currentImage?.imageUrl || product.imageUrl, "large")}
                alt={product.name}
                className="w-full h-full object-contain"
                data-testid="img-product-detail"
              />
              <Badge
                className="absolute top-3 left-3 no-default-hover-elevate no-default-active-elevate bg-primary text-primary-foreground"
                data-testid="badge-offer-detail"
              >
                <Gift className="w-3 h-3 mr-1" /> Buy 2 Get 1 Free
              </Badge>
              {discountPercent > 0 && (
                <Badge
                  className="absolute top-3 right-3 no-default-hover-elevate no-default-active-elevate bg-destructive text-destructive-foreground"
                  data-testid="badge-discount"
                >
                  {discountPercent}% OFF
                </Badge>
              )}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur-sm rounded-md px-3 py-1.5 flex items-center gap-1.5 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <Search className="w-3 h-3" />
                Click to see full view
              </div>
            </div>

            <ImageZoomDialog
              open={zoomDialogOpen}
              onOpenChange={setZoomDialogOpen}
              images={images}
              initialIndex={selectedImageIndex}
              productName={product.name}
            />

            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1" data-testid="image-thumbnails">
                {images.map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`flex-shrink-0 ${THUMBNAIL_SIZES.productGallery} rounded-md overflow-hidden border-2 transition-colors ${
                      idx === selectedImageIndex ? "border-primary" : "border-transparent"
                    }`}
                    data-testid={`button-thumbnail-${idx}`}
                  >
                    <img
                      src={getProductImageUrl(img.imageUrl, "small")}
                      alt={`${product.name} view ${idx + 1}`}
                      className="w-full h-full object-contain"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div>
              {category && (
                <p className="text-xs text-muted-foreground mb-1" data-testid="text-product-category">
                  {category.name}
                </p>
              )}
              <h1 className="text-xl md:text-2xl font-bold" data-testid="text-product-name">{product.name}</h1>

              <div className="flex items-baseline gap-2 mt-2">
                <p className="text-2xl font-bold text-primary" data-testid="text-product-price">
                  ₹{product.price.toLocaleString("en-IN")}
                </p>
                {product.mrp && product.mrp > product.price && (
                  <p className="text-base text-muted-foreground line-through" data-testid="text-product-mrp">
                    ₹{product.mrp.toLocaleString("en-IN")}
                  </p>
                )}
                {discountPercent > 0 && (
                  <span className="text-sm font-medium text-green-600 dark:text-green-400" data-testid="text-discount-percent">
                    {discountPercent}% off
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Inclusive of all taxes</p>

              {productReviews && productReviews.length > 0 && (
                <div className="flex items-center gap-1.5 mt-2">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const avg = productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length;
                      return (
                        <Star
                          key={star}
                          className={`w-3.5 h-3.5 ${star <= Math.round(avg) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                        />
                      );
                    })}
                  </div>
                  <span className="text-sm text-muted-foreground" data-testid="text-review-count">
                    {(productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length).toFixed(1)} ({productReviews.length} reviews)
                  </span>
                </div>
              )}
            </div>

            {bulletPoints.length > 0 && (
              <div className="space-y-2" data-testid="section-bullet-points">
                <h3 className="text-sm font-semibold">About this item</h3>
                <ul className="space-y-1.5">
                  {bulletPoints.map((bp, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="w-3.5 h-3.5 mt-0.5 text-primary flex-shrink-0" />
                      <span>{bp}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(product.material || product.gsm || product.dimensions || product.color) && (
              <div className="space-y-2" data-testid="section-specifications">
                <h3 className="text-sm font-semibold">Specifications</h3>
                <div className="grid grid-cols-2 gap-2">
                  {product.material && (
                    <div className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/50">
                      <Layers className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground">Material</p>
                        <p className="font-medium text-xs" data-testid="text-spec-material">{product.material}</p>
                      </div>
                    </div>
                  )}
                  {product.gsm && (
                    <div className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/50">
                      <Droplets className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground">GSM</p>
                        <p className="font-medium text-xs" data-testid="text-spec-gsm">{product.gsm}</p>
                      </div>
                    </div>
                  )}
                  {product.dimensions && (
                    <div className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/50">
                      <Ruler className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground">Dimensions</p>
                        <p className="font-medium text-xs" data-testid="text-spec-dimensions">{product.dimensions}</p>
                      </div>
                    </div>
                  )}
                  {product.color && (
                    <div className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/50">
                      <Palette className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground">Colour</p>
                        <p className="font-medium text-xs" data-testid="text-spec-color">{product.color}</p>
                      </div>
                    </div>
                  )}
                  {product.weightGrams && (
                    <div className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/50">
                      <Weight className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground">Weight</p>
                        <p className="font-medium text-xs" data-testid="text-spec-weight">{product.weightGrams}g</p>
                      </div>
                    </div>
                  )}
                  {product.itemsInSet && product.itemsInSet > 1 && (
                    <div className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/50">
                      <Package className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground">Items in Set</p>
                        <p className="font-medium text-xs" data-testid="text-spec-items">{product.itemsInSet}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {specialFeatures.length > 0 && (
              <div className="flex flex-wrap gap-1.5" data-testid="section-features">
                {specialFeatures.map((feat, i) => (
                  <Badge key={i} variant="secondary" className="text-xs no-default-hover-elevate no-default-active-elevate" data-testid={`badge-feature-${i}`}>
                    {feat}
                  </Badge>
                ))}
              </div>
            )}

            {product.audience === "couples" ? (
              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  Personalise with Names
                </Label>
                <div className="space-y-2">
                  <Input
                    id="gentleman-name"
                    placeholder="Name of Gentleman"
                    value={gentlemanName}
                    onChange={(e) => setGentlemanName(e.target.value)}
                    maxLength={30}
                    data-testid="input-gentleman-name"
                  />
                  <Input
                    id="lady-name"
                    placeholder="Name of Lady"
                    value={ladyName}
                    onChange={(e) => setLadyName(e.target.value)}
                    maxLength={30}
                    data-testid="input-lady-name"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Both names will be embroidered on the set
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="personalization" className="text-sm font-medium">
                  Personalise with a Name
                </Label>
                <Input
                  id="personalization"
                  placeholder="Enter name to embroider"
                  value={personalizationName}
                  onChange={(e) => setPersonalizationName(e.target.value)}
                  maxLength={30}
                  data-testid="input-personalization-name"
                />
                <p className="text-xs text-muted-foreground">
                  This name will be embroidered on the product
                </p>
              </div>
            )}

            <Button
              className="w-full"
              size="lg"
              onClick={() => addToCartMutation.mutate()}
              disabled={addToCartMutation.isPending}
              data-testid="button-add-to-cart"
            >
              {addToCartMutation.isPending ? (
                "Adding..."
              ) : (
                <>
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Add to Cart - ₹{product.price.toLocaleString("en-IN")}
                </>
              )}
            </Button>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="flex flex-col items-center gap-1 p-2 rounded-md bg-muted/50">
                <Check className="w-4 h-4 text-primary" />
                <span className="text-[10px] text-muted-foreground">Premium Fabric</span>
              </div>
              <div className="flex flex-col items-center gap-1 p-2 rounded-md bg-muted/50">
                <Check className="w-4 h-4 text-primary" />
                <span className="text-[10px] text-muted-foreground">Hand Embroidered</span>
              </div>
              <div className="flex flex-col items-center gap-1 p-2 rounded-md bg-muted/50">
                <Check className="w-4 h-4 text-primary" />
                <span className="text-[10px] text-muted-foreground">Free Shipping</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {productReviews && productReviews.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 py-6 border-t" data-testid="section-reviews">
          <h2 className="text-lg font-bold mb-1" data-testid="text-reviews-title">Customer Reviews</h2>
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => {
                const avg = productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length;
                return (
                  <Star
                    key={star}
                    className={`w-4 h-4 ${star <= Math.round(avg) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                  />
                );
              })}
            </div>
            <span className="text-sm font-medium">
              {(productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length).toFixed(1)} out of 5
            </span>
            <span className="text-sm text-muted-foreground">({productReviews.length} reviews)</span>
          </div>

          <div className="space-y-4">
            {productReviews.map((review) => (
              <Card key={review.id} className="p-4" data-testid={`card-review-${review.id}`}>
                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                      {review.reviewerName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium" data-testid={`text-reviewer-name-${review.id}`}>{review.reviewerName}</p>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-3 h-3 ${star <= review.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {review.verifiedPurchase && (
                      <Badge variant="secondary" className="text-[10px] no-default-hover-elevate no-default-active-elevate" data-testid={`badge-verified-${review.id}`}>
                        Verified Purchase
                      </Badge>
                    )}
                    {review.amzReviewDate && (
                      <span className="text-xs text-muted-foreground" data-testid={`text-review-date-${review.id}`}>{review.amzReviewDate}</span>
                    )}
                  </div>
                </div>
                {review.title && (
                  <p className="text-sm font-semibold mb-1" data-testid={`text-review-title-${review.id}`}>{review.title}</p>
                )}
                <p className="text-sm text-muted-foreground" data-testid={`text-review-body-${review.id}`}>{review.body}</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {relatedProducts.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 py-6 border-t">
          <h2 className="text-lg font-bold mb-3" data-testid="text-related-title">You May Also Like</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {relatedProducts.map((p) => (
              <ProductCardNew key={p.id} product={p} onQuickAdd={setQuickAddProduct} />
            ))}
          </div>
        </div>
      )}

      <QuickAddSheet
        product={quickAddProduct}
        open={!!quickAddProduct}
        onOpenChange={(open) => !open && setQuickAddProduct(null)}
      />
    </div>
  );
}
