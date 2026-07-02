import { Link } from "wouter";
import { ArrowLeft, Download, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const assets = [
  {
    file: "banner_hero.png",
    title: "Main Store Hero Banner",
    use: "Store homepage hero",
    tag: "Banner",
    tagColor: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    desc: "Luxury spa bathroom with monogrammed towels — use as the top banner on your Amazon Store homepage.",
  },
  {
    file: "banner_kids.png",
    title: "Kids Category Banner",
    use: "Kids section header",
    tag: "Banner",
    tagColor: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    desc: "Colourful hooded towels in superhero, princess, and animal designs — use as the banner for the Kids section.",
  },
  {
    file: "banner_adults.png",
    title: "Adults & Couples Category Banner",
    use: "Adults section header",
    tag: "Banner",
    tagColor: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    desc: "Matching monogram 'A' & 'B' bathrobes in an elegant layout — use as the banner for the Adults & Couples section.",
  },
  {
    file: "product_kids_towel.png",
    title: "Kids Hooded Towel — Lion Design",
    use: "Product listing image",
    tag: "Product Image",
    tagColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    desc: "Lion hooded towel laid flat with bath toys — use as a product or lifestyle image in kids towel listings.",
  },
  {
    file: "product_couple_bathrobe.png",
    title: "Couple Monogram Bathrobes",
    use: "Product listing image",
    tag: "Product Image",
    tagColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    desc: "Matching 'M' & 'S' monogram bathrobes — use as a product or lifestyle image in couple bathrobe listings.",
  },
];

export default function AdminAmazonAssets() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/admin">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </Button>
          </Link>
        </div>

        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-orange-100 dark:bg-orange-900/30">
            <Store className="w-6 h-6 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Amazon Store Assets</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              AI-generated banners and product images for your TurtleLittle Amazon storefront.
            </p>
          </div>
        </div>

        <div className="grid gap-5">
          {assets.map((asset) => (
            <Card key={asset.file} className="overflow-hidden">
              <div className="flex flex-col sm:flex-row">
                <div className="sm:w-64 shrink-0 bg-muted/40 flex items-center justify-center p-3">
                  <img
                    src={`/amazon-store/${asset.file}`}
                    alt={asset.title}
                    className="rounded object-cover w-full max-h-44 sm:max-h-36"
                    data-testid={`img-amazon-asset-${asset.file}`}
                  />
                </div>
                <div className="flex flex-col justify-between gap-3 p-5 flex-1">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-base">{asset.title}</h2>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${asset.tagColor}`}>
                        {asset.tag}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{asset.desc}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <a
                      href={`/amazon-store/${asset.file}`}
                      download={asset.file}
                      data-testid={`link-download-${asset.file}`}
                    >
                      <Button size="sm" variant="outline" className="gap-1.5">
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </Button>
                    </a>
                    <span className="text-xs text-muted-foreground">Use for: {asset.use}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <p className="text-xs text-muted-foreground text-center pb-4">
          More images can be generated as you expand your store — contact your developer to add categories, seasonal banners, or individual product shots.
        </p>
      </div>
    </div>
  );
}
