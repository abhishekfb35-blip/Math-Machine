import { Link } from "wouter";
import { Plus, Star, Heart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getProductImageUrl } from "@/lib/imageUtils";
import { useCurrency } from "@/context/CurrencyContext";
import { useWishlist } from "@/hooks/useWishlist";
import type { Product } from "@shared/types";

interface ProductCardNewProps {
  product: Product;
  onQuickAdd: (product: Product) => void;
}

export default function ProductCardNew({ product, onQuickAdd }: ProductCardNewProps) {
  const { formatPrice } = useCurrency();
  const { isWishlisted, toggle } = useWishlist();
  const wishlisted = isWishlisted(product.id);

  return (
    <Card
      className="group overflow-visible relative"
      data-testid={`card-product-${product.id}`}
    >
      <Link href={`/product/${product.slug}`}>
        <div className="aspect-square overflow-hidden rounded-t-md cursor-pointer relative bg-muted">
          <img
            src={getProductImageUrl(product.imageUrl, "medium")}
            alt={product.name}
            className="w-full h-full object-contain transition-opacity duration-300 group-hover:opacity-90"
            loading="lazy"
            data-testid={`img-product-${product.id}`}
          />
          <Badge
            className="absolute top-2 left-2 text-[10px] px-1.5 py-0.5 bg-primary text-primary-foreground no-default-hover-elevate no-default-active-elevate"
            data-testid={`badge-offer-${product.id}`}
          >
            Buy 2 Get 1 Free
          </Badge>
        </div>
      </Link>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle(product.id);
        }}
        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 dark:bg-gray-900/90 shadow flex items-center justify-center transition-transform hover:scale-110"
        data-testid={`button-wishlist-${product.id}`}
        aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
      >
        <Heart
          className={`w-3.5 h-3.5 transition-colors ${wishlisted ? "fill-rose-500 text-rose-500" : "text-muted-foreground"}`}
        />
      </button>
      <div className="p-3 space-y-1.5">
        <Link href={`/product/${product.slug}`}>
          <h3
            className="text-xs md:text-sm font-medium leading-tight line-clamp-2 cursor-pointer hover:text-primary transition-colors"
            data-testid={`text-product-name-${product.id}`}
          >
            {product.name}
          </h3>
        </Link>
        {product.averageRating != null && product.reviewCount != null && (
          <div
            className="flex items-center gap-0.5"
            data-testid={`rating-${product.id}`}
          >
            {[1,2,3,4,5].map(s => (
              <Star
                key={s}
                className={`w-3 h-3 ${s <= Math.round(product.averageRating!) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
              />
            ))}
            <span className="text-[10px] text-muted-foreground ml-1" data-testid={`review-count-${product.id}`}>
              {product.averageRating} ({product.reviewCount})
            </span>
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold" data-testid={`text-product-price-${product.id}`}>
            {formatPrice(product.price)}
          </p>
          <Button
            size="icon"
            variant="outline"
            className="shrink-0"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onQuickAdd(product);
            }}
            data-testid={`button-quickadd-${product.id}`}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
