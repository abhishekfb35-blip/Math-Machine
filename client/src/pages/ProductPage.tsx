import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { ChevronRight, ShoppingCart, Gift, Check, Star, Ruler, Weight, Layers, Droplets, Palette, Package, Search, PenLine } from "lucide-react";
import SEO, { ProductJsonLd, BreadcrumbJsonLd } from "@/components/SEO";
import ImageZoomDialog from "@/components/ImageZoomDialog";
import { THUMBNAIL_SIZES } from "@/config/thumbnails";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import ProductCardNew from "@/components/ProductCardNew";
import QuickAddSheet from "@/components/QuickAddSheet";
import { getProductImageUrl } from "@/lib/imageUtils";
import type { Product, Category, ProductImage, ProductReview, ProductVariantOptions } from "@shared/types";
import { useCurrency } from "@/context/CurrencyContext";
import { useAuth } from "@/hooks/useAuth";
import ShareButton from "@/components/ShareButton";

const REVIEWS_PER_PAGE = 10;

const NAME_MIN = 3;
const NAME_MAX = 11;

function nameCharHint(val: string): { text: string; className: string } {
  const len = val.length;
  const left = NAME_MAX - len;
  if (len === 0) return { text: `${NAME_MIN} to ${NAME_MAX} characters`, className: "text-muted-foreground" };
  if (len < NAME_MIN) return { text: `Minimum ${NAME_MIN} characters · ${left} character${left !== 1 ? "s" : ""} left`, className: "text-amber-500" };
  return { text: `${left} character${left !== 1 ? "s" : ""} left`, className: "text-muted-foreground" };
}

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { formatPrice } = useCurrency();
  const { customer, isAuthenticated } = useAuth();
  const [personalizationName, setPersonalizationName] = useState("");
  const [gentlemanName, setGentlemanName] = useState("");
  const [ladyName, setLadyName] = useState("");
  const [showNameConfirm, setShowNameConfirm] = useState(false);
  const [quickAddProduct, setQuickAddProduct] = useState<Product | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [zoomDialogOpen, setZoomDialogOpen] = useState(false);
  const [visibleReviews, setVisibleReviews] = useState(REVIEWS_PER_PAGE);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [reviewHoverRating, setReviewHoverRating] = useState(0);

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

  const { data: variantOptions } = useQuery<ProductVariantOptions>({
    queryKey: ["/api/products", product?.id, "variant-options"],
    queryFn: async () => {
      const res = await fetch(`/api/products/${product!.id}/variant-options`);
      return res.json();
    },
    enabled: !!product?.id,
  });

  const { data: myReview } = useQuery<ProductReview | null>({
    queryKey: ["/api/products", product?.id, "my-review"],
    queryFn: async () => {
      const res = await fetch(`/api/products/${product!.id}/my-review`, {
        credentials: "include",
      });
      if (res.status === 404 || res.status === 401) return null;
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!product?.id && isAuthenticated,
  });

  const submitReviewMutation = useMutation({
    mutationFn: async (data: { rating: number; title: string; body: string }) => {
      const res = await apiRequest("POST", `/api/products/${product!.id}/reviews`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", product?.id, "reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products", product?.id, "my-review"] });
      setReviewDialogOpen(false);
      toast({ title: myReview ? "Review updated" : "Review submitted", description: "Thank you for sharing your experience!" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message || "Failed to submit review. Please try again.", variant: "destructive" });
    },
  });

  const category = categories?.find((c) => c.id === product?.categoryId);

  const relatedProducts = allProducts
    ?.filter((p) => p.categoryId === product?.categoryId && p.id !== product?.id)
    .slice(0, 4) || [];

  const hasVariantConfig = (variantOptions?.sizes.length ?? 0) > 0;
  const showVariantSelectors = hasVariantConfig;

  const selectedSizeObj = variantOptions?.sizes.find(s => s.name === selectedSize);

  const isSizeAvailable = (_sizeName: string): boolean => true;

  const isColorAvailable = (_sizeName: string, _colorName: string): boolean => true;

  const colorsForSelectedSize = (() => {
    if (!showVariantSelectors || !selectedSize || !selectedSizeObj) return [];
    return selectedSizeObj.colors;
  })();

  const variantSelectionIncomplete = showVariantSelectors && (
    ((variantOptions?.sizes.length ?? 0) > 0 && !selectedSize) ||
    (colorsForSelectedSize.filter(c => !c.blurOnFront).length > 0 && !selectedColor)
  );

  const getFirstSelectableColor = (sizeName: string): string | null => {
    const sizeObj = variantOptions?.sizes.find(s => s.name === sizeName);
    if (!sizeObj) return null;
    const first = sizeObj.colors.find(c => !c.blurOnFront && isColorAvailable(sizeName, c.name));
    return first ? first.name : null;
  };

  useEffect(() => {
    if (!showVariantSelectors || !variantOptions) return;
    const sizes = variantOptions.sizes;
    const isKidsBathrobe = product?.productType === "bathrobe" && product?.audience === "kids";
    if (sizes.length > 0 && !selectedSize && !isKidsBathrobe) {
      const def = sizes.find(s => s.isDefault && !s.blurOnFront) || sizes.find(s => !s.blurOnFront) || sizes[0];
      setSelectedSize(def.name);
      setSelectedColor(getFirstSelectableColor(def.name));
    }
  }, [showVariantSelectors, variantOptions]);

  const openReviewDialog = () => {
    if (myReview) {
      setReviewRating(myReview.rating);
      setReviewTitle(myReview.title || "");
      setReviewBody(myReview.body);
    } else {
      setReviewRating(5);
      setReviewTitle("");
      setReviewBody("");
    }
    setReviewHoverRating(0);
    setReviewDialogOpen(true);
  };

  const handleSubmitReview = () => {
    if (reviewBody.trim().length < 10) {
      toast({ title: "Review too short", description: "Please write at least 10 characters.", variant: "destructive" });
      return;
    }
    submitReviewMutation.mutate({ rating: reviewRating, title: reviewTitle.trim(), body: reviewBody.trim() });
  };

  const handleSizeSelect = (sizeName: string) => {
    setSelectedSize(sizeName);
    const currentColorStillAvailable = selectedColor && isColorAvailable(sizeName, selectedColor);
    if (!currentColorStillAvailable) {
      setSelectedColor(getFirstSelectableColor(sizeName));
    }
  };

  const addToCartMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cart/items", {
        productId: product!.id,
        quantity: 1,
        personalizationName: product!.tagNames?.some((t) => t.toLowerCase().includes("couple"))
          ? (gentlemanName.trim() || ladyName.trim()
            ? `His: ${gentlemanName.trim() || "—"} & Hers: ${ladyName.trim() || "—"}`
            : undefined)
          : (personalizationName.trim() || undefined),
        selectedColor: selectedColor || undefined,
        selectedSize: selectedSize || undefined,
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

  const effectivePriceAdd = selectedSizeObj?.priceAdd ?? 0;
  const effectiveSellingPrice = (product?.price ?? 0) + effectivePriceAdd;
  const effectiveMrp = (product?.mrp ?? 0) + effectivePriceAdd;
  const discountPercent = product?.mrp && effectiveMrp > effectiveSellingPrice
    ? Math.round(((effectiveMrp - effectiveSellingPrice) / effectiveMrp) * 100)
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
              <div className="flex items-start justify-between gap-2">
                <h1 className="text-xl md:text-2xl font-bold" data-testid="text-product-name">{product.name}</h1>
                <ShareButton
                  url={`https://turtlelittle.com/product/${slug}`}
                  title={product.name}
                  text={`Check out ${product.name} on TurtleLittle — personalised luxury embroidered towels & blankets!`}
                  className="shrink-0 mt-0.5"
                />
              </div>

              <div className="flex items-baseline gap-2 mt-2">
                <p className="text-2xl font-bold text-primary" data-testid="text-product-price">
                  {formatPrice((product.price) + (selectedSizeObj?.priceAdd ?? 0))}
                </p>
                {product.mrp && effectiveMrp > effectiveSellingPrice && (
                  <p className="text-base text-muted-foreground line-through" data-testid="text-product-mrp">
                    {formatPrice(effectiveMrp)}
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

            {showVariantSelectors && (variantOptions?.sizes.length ?? 0) > 0 && (
              <div className="space-y-2" data-testid="section-size-selector">
                <Label className="text-sm font-semibold">Size</Label>
                <div className="flex flex-wrap gap-2">
                  {variantOptions!.sizes.map((size) => {
                    const available = !size.blurOnFront && isSizeAvailable(size.name);
                    const blurred = size.blurOnFront;
                    const isSelected = selectedSize === size.name;
                    return (
                      <button
                        key={size.name}
                        onClick={() => { if (available) handleSizeSelect(size.name); }}
                        disabled={!available}
                        className={`px-3 py-1.5 text-sm rounded-md border transition-all flex flex-col items-center ${
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : blurred || !isSizeAvailable(size.name)
                            ? "border-muted text-muted-foreground opacity-40 cursor-not-allowed"
                            : "border-border hover:border-primary"
                        }`}
                        data-testid={`button-size-${size.name}`}
                      >
                        <span>{size.name}</span>
                        {size.description && (
                          <span className={`leading-tight ${isSelected ? "text-primary-foreground/70" : "text-muted-foreground"}`} style={{ fontSize: `${size.descriptionFontSize ?? 12}px` }}>
                            {size.description}
                          </span>
                        )}
                        {(size.priceAdd ?? 0) > 0 && (
                          <span className={`text-[10px] leading-tight ${isSelected ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                            +{formatPrice(size.priceAdd)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {showVariantSelectors && colorsForSelectedSize.length > 0 && (
              <div className="space-y-2" data-testid="section-color-selector">
                <Label className="text-sm font-semibold">Colour</Label>
                <div className="flex flex-wrap gap-2">
                  {colorsForSelectedSize.map((color) => {
                    const available = !color.blurOnFront && isColorAvailable(selectedSize!, color.name);
                    const blurred = color.blurOnFront;
                    const isSelected = selectedColor === color.name;
                    return (
                      <button
                        key={color.name}
                        onClick={() => { if (available) setSelectedColor(color.name); }}
                        disabled={!available}
                        className={`flex items-center gap-1.5 p-1.5 rounded border transition-all ${
                          isSelected ? "border-primary ring-1 ring-primary"
                          : blurred || !isColorAvailable(selectedSize!, color.name) ? "border-muted opacity-40 cursor-not-allowed"
                          : "border-border hover:border-primary"
                        }`}
                        data-testid={`button-color-${color.name}`}
                        title={color.name}
                      >
                        {color.swatchUrl ? (
                          <img src={color.swatchUrl} alt={color.name} className="w-8 h-8 rounded object-cover" />
                        ) : (
                          <span className="w-8 h-8 rounded bg-muted border border-border inline-block" />
                        )}
                        <span className="text-xs pr-1">{color.name}</span>
                      </button>
                    );
                  })}
                </div>
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

            {product.tagNames?.some((t) => t.toLowerCase().includes("couple")) ? (
              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  Personalise with Names
                </Label>
                <div className="space-y-2">
                  <div>
                    <Input
                      id="gentleman-name"
                      placeholder="Name of Gentleman"
                      value={gentlemanName}
                      onChange={(e) => setGentlemanName(e.target.value)}
                      maxLength={NAME_MAX}
                      data-testid="input-gentleman-name"
                    />
                    {(() => { const h = nameCharHint(gentlemanName); return <p className={`text-xs mt-1 ${h.className}`}>{h.text}</p>; })()}
                  </div>
                  <div>
                    <Input
                      id="lady-name"
                      placeholder="Name of Lady"
                      value={ladyName}
                      onChange={(e) => setLadyName(e.target.value)}
                      maxLength={NAME_MAX}
                      data-testid="input-lady-name"
                    />
                    {(() => { const h = nameCharHint(ladyName); return <p className={`text-xs mt-1 ${h.className}`}>{h.text}</p>; })()}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Both names will be embroidered on the set
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <Label htmlFor="personalization" className="text-sm font-medium">
                  Personalise with a Name
                </Label>
                <Input
                  id="personalization"
                  placeholder="Enter name to embroider"
                  value={personalizationName}
                  onChange={(e) => setPersonalizationName(e.target.value)}
                  maxLength={NAME_MAX}
                  data-testid="input-personalization-name"
                />
                {(() => { const h = nameCharHint(personalizationName); return <p className={`text-xs ${h.className}`}>{h.text}</p>; })()}
              </div>
            )}

            <Button
              className="w-full"
              size="lg"
              onClick={() => {
                const isCoupleProduct = product?.tagNames?.some((t) => t.toLowerCase().includes("couple")) ?? false;
                const nameInvalid = isCoupleProduct
                  ? (gentlemanName.trim().length > 0 && gentlemanName.trim().length < NAME_MIN) || (ladyName.trim().length > 0 && ladyName.trim().length < NAME_MIN)
                  : personalizationName.trim().length > 0 && personalizationName.trim().length < NAME_MIN;
                if (nameInvalid) return;
                const nameEmpty = isCoupleProduct
                  ? gentlemanName.trim() === "" && ladyName.trim() === ""
                  : personalizationName.trim() === "";
                if (nameEmpty) { setShowNameConfirm(true); return; }
                addToCartMutation.mutate();
              }}
              disabled={addToCartMutation.isPending || !!variantSelectionIncomplete || (() => {
                const isCoupleProduct = product?.tagNames?.some((t) => t.toLowerCase().includes("couple")) ?? false;
                return isCoupleProduct
                  ? (gentlemanName.trim().length > 0 && gentlemanName.trim().length < NAME_MIN) || (ladyName.trim().length > 0 && ladyName.trim().length < NAME_MIN)
                  : personalizationName.trim().length > 0 && personalizationName.trim().length < NAME_MIN;
              })()}
              data-testid="button-add-to-cart"
            >
              {addToCartMutation.isPending ? (
                "Adding..."
              ) : variantSelectionIncomplete ? (
                `Select ${!selectedSize ? "Size" : "Colour"} to Continue`
              ) : (
                <>
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Add to Cart - {formatPrice(product.price + (selectedSizeObj?.priceAdd ?? 0))}
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
                <span className="text-[10px] text-muted-foreground">Buy 2 Get 1 Free</span>
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
            {productReviews.slice(0, visibleReviews).map((review) => (
              <Card key={review.id} className="p-4" data-testid={`card-review-${review.id}`}>
                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                      {review.reviewerName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{review.reviewerName}</p>
                      {review.amzReviewDate && (
                        <p className="text-xs text-muted-foreground">{review.amzReviewDate}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-3.5 h-3.5 ${star <= review.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                      />
                    ))}
                  </div>
                </div>
                {review.title && (
                  <p className="text-sm font-semibold mb-1">{review.title}</p>
                )}
                <p className="text-sm text-muted-foreground">{review.body}</p>
                {review.verifiedPurchase && (
                  <Badge variant="secondary" className="mt-2 text-[10px] no-default-hover-elevate no-default-active-elevate">
                    <Check className="w-2.5 h-2.5 mr-1" /> Verified Purchase
                  </Badge>
                )}
              </Card>
            ))}
          </div>

          {visibleReviews < productReviews.length && (
            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={() => setVisibleReviews(prev => prev + REVIEWS_PER_PAGE)}
              data-testid="button-load-more-reviews"
            >
              Load More Reviews
            </Button>
          )}
        </div>
      )}

      {isAuthenticated && product && (
        <div className="max-w-7xl mx-auto px-4 py-6 border-t" data-testid="section-write-review">
          <h2 className="text-base font-semibold mb-0.5">Review this product</h2>
          <p className="text-sm text-muted-foreground mb-3">Share your thoughts with other customers</p>
          <Button
            variant="outline"
            onClick={openReviewDialog}
            data-testid="button-write-review"
          >
            <PenLine className="w-4 h-4 mr-2" />
            {myReview ? "Edit your review" : "Write a product review"}
          </Button>
        </div>
      )}

      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-review">
          <DialogHeader>
            <DialogTitle>{myReview ? "Edit your review" : "Write a review"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-sm font-medium mb-1">Reviewing as <span className="text-primary">{customer?.name || customer?.email}</span></p>
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Rating <span className="text-destructive">*</span></Label>
              <div className="flex items-center gap-1" data-testid="star-rating-selector">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    onMouseEnter={() => setReviewHoverRating(star)}
                    onMouseLeave={() => setReviewHoverRating(0)}
                    className="p-0.5 transition-transform hover:scale-110"
                    data-testid={`button-star-${star}`}
                  >
                    <Star
                      className={`w-7 h-7 transition-colors ${
                        star <= (reviewHoverRating || reviewRating)
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground/30"
                      }`}
                    />
                  </button>
                ))}
                <span className="text-sm text-muted-foreground ml-1">
                  {["", "Poor", "Fair", "Good", "Very Good", "Excellent"][reviewHoverRating || reviewRating]}
                </span>
              </div>
            </div>
            <div>
              <Label htmlFor="review-title" className="text-sm font-medium mb-1 block">Title <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                id="review-title"
                placeholder="Summarize your experience"
                value={reviewTitle}
                onChange={(e) => setReviewTitle(e.target.value)}
                maxLength={200}
                data-testid="input-review-title"
              />
            </div>
            <div>
              <Label htmlFor="review-body" className="text-sm font-medium mb-1 block">Review <span className="text-destructive">*</span></Label>
              <Textarea
                id="review-body"
                placeholder="What did you like or dislike? How was the quality?"
                value={reviewBody}
                onChange={(e) => setReviewBody(e.target.value)}
                rows={4}
                maxLength={2000}
                data-testid="input-review-body"
              />
              <p className="text-xs text-muted-foreground mt-1">{reviewBody.length}/2000 characters (min 10)</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)} data-testid="button-cancel-review">Cancel</Button>
            <Button
              onClick={handleSubmitReview}
              disabled={submitReviewMutation.isPending || reviewBody.trim().length < 10}
              data-testid="button-submit-review"
            >
              {submitReviewMutation.isPending ? "Submitting..." : myReview ? "Update Review" : "Submit Review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {relatedProducts.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 py-6 border-t">
          <h2 className="text-lg font-bold mb-4">You might also like</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {relatedProducts.map((relProd) => (
              <ProductCardNew
                key={relProd.id}
                product={relProd}
                onQuickAdd={(p) => setQuickAddProduct(p)}
              />
            ))}
          </div>
        </div>
      )}

      <QuickAddSheet
        product={quickAddProduct}
        open={!!quickAddProduct}
        onOpenChange={(open) => { if (!open) setQuickAddProduct(null); }}
      />

      <AlertDialog open={showNameConfirm} onOpenChange={setShowNameConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>No name added</AlertDialogTitle>
            <AlertDialogDescription>
              This product can be personalised with an embroidered name. Are you sure you want to add it to your cart without a name?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-name-confirm-cancel">Add a name</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-name-confirm-proceed"
              onClick={() => { setShowNameConfirm(false); addToCartMutation.mutate(); }}
            >
              Proceed without name
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
