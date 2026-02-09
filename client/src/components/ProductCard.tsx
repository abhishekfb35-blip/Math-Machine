import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import type { Product } from "@shared/schema";

export default function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/product/${product.slug}`}>
      <Card className="group cursor-pointer hover-elevate overflow-visible" data-testid={`card-product-${product.id}`}>
        <div className="aspect-square overflow-hidden rounded-t-md">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            data-testid={`img-product-${product.id}`}
          />
        </div>
        <div className="p-3 space-y-1">
          <h3 className="text-sm font-medium leading-tight line-clamp-2" data-testid={`text-product-name-${product.id}`}>
            {product.name}
          </h3>
          <p className="text-sm font-semibold text-primary" data-testid={`text-product-price-${product.id}`}>
            ₹{product.price.toLocaleString("en-IN")}
          </p>
        </div>
      </Card>
    </Link>
  );
}
