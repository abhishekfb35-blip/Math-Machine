import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import SEO, { BreadcrumbJsonLd } from "@/components/SEO";
import ProductCardNew from "@/components/ProductCardNew";
import QuickAddSheet from "@/components/QuickAddSheet";
import { Button } from "@/components/ui/button";
import { getGiftIdeaGroups } from "@shared/giftIdeas";
import type { Product } from "@shared/types";

const pageDescription =
  "Explore personalised towels and blankets with princess, superhero, animal and cartoon-character themes—thoughtful return gift ideas for children's parties.";

export default function ReturnGiftsPage() {
  const [quickAddProduct, setQuickAddProduct] = useState<Product | null>(null);
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const groups = getGiftIdeaGroups(products);

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 pb-20 md:pb-12 space-y-8" data-testid="page-return-gifts">
      <SEO
        title="Themed Return Gift Ideas for Kids"
        description={pageDescription}
        path="/return-gifts"
        noindex={groups.length === 0}
        jsonLd={BreadcrumbJsonLd([
          { name: "Home", url: "/" },
          { name: "Themed Return Gift Ideas", url: "/return-gifts" },
        ])}
      />

      <header className="max-w-3xl space-y-3">
        <p className="text-sm font-medium text-primary">Personalised gift ideas</p>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Themed Return Gift Ideas for Kids</h1>
        <p className="text-muted-foreground leading-relaxed">{pageDescription}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Browse individual product ideas for children's parties. These are themed gift suggestions, not
          pre-bundled return-gift packs. Check each product page for personalisation options and details.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Add 5 or more products to unlock wholesale bulk-rate pricing across your cart
        </p>
      </header>

      {groups.length ? (
        <div className="space-y-10">
          {groups.map((group) => (
            <section key={group.id} className="space-y-4" data-testid={`section-gift-theme-${group.id}`}>
              <div>
                <h2 className="text-xl md:text-2xl font-semibold">{group.title}</h2>
                <p className="text-sm text-muted-foreground mt-1">{group.description}</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {group.products.map((product) => (
                  <ProductCardNew
                    key={product.id}
                    product={product}
                    onQuickAdd={setQuickAddProduct}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <section className="rounded-xl border p-6 space-y-3">
          <h2 className="text-lg font-semibold">No themed products are available right now</h2>
          <p className="text-sm text-muted-foreground">Browse the full shop for the current product selection.</p>
          <Button asChild><Link href="/shop">Browse all products</Link></Button>
        </section>
      )}

      <section className="border-t pt-6 space-y-4 max-w-3xl">
        <h2 className="text-xl font-semibold">Questions about themed gift ideas</h2>
        <div className="space-y-4">
          <article>
            <h3 className="font-medium">Can I choose a theme for a children's party?</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Browse the princess, superhero, animal, cartoon-character and unicorn designs currently shown above.
              Product availability can change.
            </p>
          </article>
          <article>
            <h3 className="font-medium">Can these products be personalised with a name?</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Many products offer name embroidery. Check the options on each product page before ordering.
            </p>
          </article>
          <article>
            <h3 className="font-medium">Are these sold as return-gift packs?</h3>
            <p className="text-sm text-muted-foreground mt-1">
              This page shows individual product ideas, not pre-bundled packs. Confirm quantities and timing with
              customer support before placing an event order.
            </p>
          </article>
        </div>
      </section>

      <QuickAddSheet
        product={quickAddProduct}
        open={!!quickAddProduct}
        onReopen={(product) => setQuickAddProduct(product)}
        onOpenChange={(open) => !open && setQuickAddProduct(null)}
      />
    </main>
  );
}
