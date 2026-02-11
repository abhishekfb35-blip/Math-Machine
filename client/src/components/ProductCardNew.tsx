import { Link } from "wouter";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getProductImageUrl } from "@/lib/imageUtils";
import type { Product } from "@shared/schema";

interface ProductCardNewProps {
  product: Product;
  onQuickAdd: (product: Product) => void;
}

export default function ProductCardNew({ product, onQuickAdd }: ProductCardNewProps) {
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
            className="w-full h-full object-cover transition-opacity duration-300 group-hover:opacity-90"
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
      <div className="p-3 space-y-1.5">
        <Link href={`/product/${product.slug}`}>
          <h3
            className="text-xs md:text-sm font-medium leading-tight line-clamp-2 cursor-pointer hover:text-primary transition-colors"
            data-testid={`text-product-name-${product.id}`}
          >
            {product.name}
          </h3>
        </Link>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold" data-testid={`text-product-price-${product.id}`}>
            ₹{product.price.toLocaleString("en-IN")}
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
