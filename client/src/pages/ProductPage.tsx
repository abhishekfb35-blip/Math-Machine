import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { useState } from "react";
import { ChevronRight, ShoppingCart, Gift, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Product, Category } from "@shared/schema";

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [personalizationName, setPersonalizationName] = useState("");

  const { data: product, isLoading: productLoading } = useQuery<Product>({
    queryKey: ["/api/products", slug],
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const category = categories?.find((c) => c.id === product?.categoryId);

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
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-8">
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
        <Link href="/">
          <Button data-testid="button-back-home">Back to Home</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center gap-1 text-sm text-muted-foreground" data-testid="nav-breadcrumb">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <ChevronRight className="w-3 h-3" />
          {category && (
            <>
              <Link href={`/category/${category.slug}`} className="hover:text-foreground transition-colors">
                {category.name}
              </Link>
              <ChevronRight className="w-3 h-3" />
            </>
          )}
          <span className="text-foreground line-clamp-1">{product.name}</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-16">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="aspect-square overflow-hidden rounded-md bg-muted">
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover"
              data-testid="img-product-detail"
            />
          </div>

          <div className="space-y-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold" data-testid="text-product-name">{product.name}</h1>
              <p className="text-3xl font-bold text-primary mt-2" data-testid="text-product-price">
                ₹{product.price.toLocaleString("en-IN")}
              </p>
            </div>

            {product.description && (
              <p className="text-muted-foreground" data-testid="text-product-description">{product.description}</p>
            )}

            <Card className="p-4 bg-primary/5 dark:bg-primary/10 border-primary/20 space-y-2">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-primary shrink-0" />
                <p className="text-sm font-medium" data-testid="text-offer-info">Buy 2 Get 1 Free, Buy 3 Get 2 Free & So On!</p>
              </div>
              <p className="text-xs text-muted-foreground ml-7">Discount applied automatically at checkout</p>
            </Card>

            <div className="space-y-2">
              <Label htmlFor="personalization" className="text-sm font-medium">
                Personalise with a Name (Embroidered)
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
                This name will be embroidered on the product. Max 30 characters.
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
                  Add to Cart
                </>
              )}
            </Button>

            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" />
                <span>Premium quality luxury fabric</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" />
                <span>Professional embroidery</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" />
                <span>Free shipping across India</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
