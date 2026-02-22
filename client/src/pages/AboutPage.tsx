import { Link } from "wouter";
import { ChevronLeft, Heart, Sparkles, Shield, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { defaultAboutPage, type AboutPageConfig } from "@/lib/siteConfigDefaults";

const iconMap = [Sparkles, Heart, Shield, Truck];

export default function AboutPage() {
  const config = useSiteConfig<AboutPageConfig>("page-about", defaultAboutPage);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-24" data-testid="about-page">
      <Link href="/">
        <Button variant="ghost" size="sm" className="mb-4" data-testid="link-back-home">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Home
        </Button>
      </Link>

      <h1 className="text-2xl font-bold mb-6" data-testid="text-about-title">{config.title}</h1>

      <div className="space-y-8">
        <section>
          <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">{config.intro}</p>
        </section>

        {config.sections.map((section, idx) => (
          <section key={idx}>
            <h2 className="text-lg font-semibold mb-3">{section.heading}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">{section.body}</p>
          </section>
        ))}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {config.valueCards.map((card, idx) => {
            const Icon = iconMap[idx % iconMap.length];
            return (
              <Card key={idx} className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Icon className="w-5 h-5 text-primary" />
                  <h3 className="font-medium text-sm">{card.title}</h3>
                </div>
                <p className="text-xs text-muted-foreground">{card.description}</p>
              </Card>
            );
          })}
        </div>

        <section>
          <h2 className="text-lg font-semibold mb-3">Get in Touch</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Have a question or need help choosing the perfect gift? We'd love to hear from you! Reach out via WhatsApp at{" "}
            <a href={`https://wa.me/${config.contactWhatsapp.replace(/[^0-9]/g, "")}`} className="underline">{config.contactWhatsapp}</a> or email us at{" "}
            <a href={`mailto:${config.contactEmail}`} className="underline">{config.contactEmail}</a>. We're based in {config.contactLocation}.
          </p>
        </section>
      </div>
    </div>
  );
}
