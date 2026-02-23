import { Link } from "wouter";
import { ChevronLeft } from "lucide-react";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { defaultShippingPage, type ShippingPageConfig } from "@/lib/siteConfigDefaults";

function renderBody(body: string) {
  const lines = body.split("\n");
  const elements: (JSX.Element | null)[] = [];
  let listItems: string[] = [];
  let listType: "bullet" | "numbered" | null = null;
  let paragraphLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length > 0) {
      const text = paragraphLines.join("\n");
      elements.push(
        <p key={`p-${elements.length}`} className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">{text}</p>
      );
      paragraphLines = [];
    }
  };

  const flushList = () => {
    if (listItems.length > 0) {
      if (listType === "numbered") {
        elements.push(
          <ol key={`ol-${elements.length}`} className="list-decimal pl-5 space-y-1 text-sm text-muted-foreground mt-2">
            {listItems.map((item, i) => <li key={i}>{item}</li>)}
          </ol>
        );
      } else {
        elements.push(
          <ul key={`ul-${elements.length}`} className="list-disc pl-5 space-y-1 text-sm text-muted-foreground mt-2">
            {listItems.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        );
      }
      listItems = [];
      listType = null;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("•") || trimmed.startsWith("- ")) {
      flushParagraph();
      if (listType !== "bullet") flushList();
      listType = "bullet";
      listItems.push(trimmed.replace(/^[•\-]\s*/, ""));
    } else if (/^\d+\.\s/.test(trimmed)) {
      flushParagraph();
      if (listType !== "numbered") flushList();
      listType = "numbered";
      listItems.push(trimmed.replace(/^\d+\.\s*/, ""));
    } else {
      flushList();
      paragraphLines.push(line);
    }
  }
  flushList();
  flushParagraph();
  return elements;
}

export default function ShippingPolicyPage() {
  const config = useSiteConfig<ShippingPageConfig>("page-shipping", defaultShippingPage);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-24" data-testid="shipping-policy-page">
      <SEO title="Shipping Policy" path="/shipping" />
      <Link href="/">
        <Button variant="ghost" size="sm" className="mb-4" data-testid="link-back-home">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Home
        </Button>
      </Link>

      <h1 className="text-2xl font-bold mb-6" data-testid="text-shipping-title">{config.title}</h1>
      <p className="text-sm text-muted-foreground mb-6">Last updated: {config.lastUpdated}</p>

      <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
        {config.sections.map((section, idx) => (
          <section key={idx}>
            <h2 className="text-lg font-semibold mb-2">{section.heading}</h2>
            {renderBody(section.body)}
          </section>
        ))}
      </div>
    </div>
  );
}
