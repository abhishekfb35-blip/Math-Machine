import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { useState } from "react";
import { ChevronRight, ShoppingCart, Gift, Check, ArrowLeft } from "lucide-react";
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
import type { Product, Category } from "@shared/schema";

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [personalizationName, setPersonalizationName] = useState("");
  const [quickAddProduct, setQuickAddProduct] = useState<Product | null>(null);

  const { data: product, isLoading: productLoading } = useQuery<Product>({
    queryKey: ["/api/products", slug],
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: allProducts } = useQuery<Product[]>({
    queryKey: ["/api/products"],
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
        personalizationName: personalizationName.trim() || undefined,
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
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center gap-1 text-sm text-muted-foreground" data-testid="nav-breadcrumb">
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
          <div className="relative aspect-square overflow-hidden rounded-md bg-muted">
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover"
              data-testid="img-product-detail"
            />
            <Badge
              className="absolute top-3 left-3 no-default-hover-elevate no-default-active-elevate bg-primary text-primary-foreground"
              data-testid="badge-offer-detail"
            >
              <Gift className="w-3 h-3 mr-1" /> Buy 2 Get 1 Free
            </Badge>
          </div>

          <div className="space-y-5">
            <div>
              {category && (
                <p className="text-xs text-muted-foreground mb-1" data-testid="text-product-category">
                  {category.name}
                </p>
              )}
              <h1 className="text-xl md:text-2xl font-bold" data-testid="text-product-name">{product.name}</h1>
              <p className="text-2xl font-bold text-primary mt-1" data-testid="text-product-price">
                ₹{product.price.toLocaleString("en-IN")}
              </p>
            </div>

            {product.description && (
              <p className="text-sm text-muted-foreground" data-testid="text-product-description">{product.description}</p>
            )}

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
                <span className="text-[10px] text-muted-foreground">Embroidered</span>
              </div>
              <div className="flex flex-col items-center gap-1 p-2 rounded-md bg-muted/50">
                <Check className="w-4 h-4 text-primary" />
                <span className="text-[10px] text-muted-foreground">Free Shipping</span>
              </div>
            </div>
          </div>
        </div>
      </div>

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
