import { Link } from "wouter";
import { Heart } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useWishlist } from "@/hooks/useWishlist";
import ProductCardNew from "@/components/ProductCardNew";
import QuickAddSheet from "@/components/QuickAddSheet";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import type { Product } from "@shared/types";
import SEO from "@/components/SEO";

export default function WishlistPage() {
  const { wishlistIds, toggle } = useWishlist();
  const [quickAddProduct, setQuickAddProduct] = useState<Product | null>(null);

  const { data: allProducts = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const wishlisted = allProducts.filter(p => wishlistIds.has(p.id));

  return (
    <>
      <SEO
        title="My Wishlist | TurtleLittle"
        description="Your saved products on TurtleLittle"
      />
      <div className="max-w-5xl mx-auto px-4 py-8 pb-28" data-testid="page-wishlist">
        <div className="flex items-center gap-3 mb-6">
          <Heart className="w-5 h-5 text-primary fill-primary" />
          <h1 className="text-2xl font-bold">My Wishlist</h1>
          {wishlisted.length > 0 && (
            <span className="text-sm text-muted-foreground">({wishlisted.length} item{wishlisted.length !== 1 ? "s" : ""})</span>
          )}
        </div>

        {wishlisted.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center" data-testid="wishlist-empty">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Heart className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-lg">Nothing saved yet</p>
              <p className="text-sm text-muted-foreground mt-1">Tap the heart on any product to save it here</p>
            </div>
            <Link href="/shop">
              <Button data-testid="button-go-shop">Browse products</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3" data-testid="wishlist-grid">
            {wishlisted.map(product => (
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
        onOpenChange={(open) => { if (!open) setQuickAddProduct(null); }}
      />
    </>
  );
}
