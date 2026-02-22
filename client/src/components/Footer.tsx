import { Link } from "wouter";
import { MessageCircle, Mail, Phone, MapPin } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { defaultFooter, type FooterConfig } from "@/lib/siteConfigDefaults";

export default function Footer() {
  const config = useSiteConfig<FooterConfig>("footer", defaultFooter);

  return (
    <footer className="bg-foreground text-background pb-20 md:pb-0" data-testid="section-footer">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2 space-y-3">
            <h3 className="text-lg font-bold" data-testid="text-footer-brand">{config.brandName}</h3>
            <p className="text-sm opacity-70 max-w-sm leading-relaxed">
              {config.brandStory}
            </p>
            <div className="flex items-center gap-3 pt-2">
              <a
                href={config.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm opacity-70 transition-opacity"
                data-testid="link-footer-whatsapp"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </a>
              <a
                href={`mailto:${config.email}`}
                className="inline-flex items-center gap-1.5 text-sm opacity-70 transition-opacity"
                data-testid="link-footer-email"
              >
                <Mail className="w-4 h-4" />
                Email
              </a>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wider opacity-50">Shop</h4>
            <nav className="flex flex-col gap-2">
              {config.shopLinks.map((link, i) => (
                <Link key={i} href={link.href} className="text-sm opacity-70" data-testid={`link-footer-shop-${i}`}>
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wider opacity-50">Contact</h4>
            <div className="flex flex-col gap-2">
              <a
                href={`tel:${config.phone.replace(/\s/g, "")}`}
                className="inline-flex items-center gap-2 text-sm opacity-70 transition-opacity"
                data-testid="link-footer-phone"
              >
                <Phone className="w-3.5 h-3.5 shrink-0" />
                {config.phone}
              </a>
              <a
                href={`mailto:${config.email}`}
                className="inline-flex items-center gap-2 text-sm opacity-70 transition-opacity"
                data-testid="link-footer-email-contact"
              >
                <Mail className="w-3.5 h-3.5 shrink-0" />
                {config.email}
              </a>
              <span className="inline-flex items-start gap-2 text-sm opacity-70">
                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {config.address}
              </span>
            </div>
          </div>
        </div>

        <div className="border-t border-background/10 mt-8 pt-6 flex flex-col items-center gap-4">
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <Link href="/about" className="text-xs opacity-70 hover:opacity-100 transition-opacity" data-testid="link-footer-about">
              About Us
            </Link>
            <Link href="/terms" className="text-xs opacity-70 hover:opacity-100 transition-opacity" data-testid="link-footer-terms">
              Terms & Conditions
            </Link>
            <Link href="/privacy" className="text-xs opacity-70 hover:opacity-100 transition-opacity" data-testid="link-footer-privacy">
              Privacy Policy
            </Link>
            <Link href="/refund-policy" className="text-xs opacity-70 hover:opacity-100 transition-opacity" data-testid="link-footer-refund">
              Refund Policy
            </Link>
            <Link href="/shipping" className="text-xs opacity-70 hover:opacity-100 transition-opacity" data-testid="link-footer-shipping">
              Shipping Policy
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/admin/catalog" className="text-xs opacity-30 hover:opacity-60 transition-opacity" data-testid="link-footer-admin-catalog">
              Admin Catalog
            </Link>
            <Link href="/admin/builder" className="text-xs opacity-30 hover:opacity-60 transition-opacity" data-testid="link-footer-admin-builder">
              Page Builder
            </Link>
          </div>
          <p className="text-xs opacity-50" data-testid="text-footer-copyright">
            &copy; {new Date().getFullYear()} {config.brandName}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
