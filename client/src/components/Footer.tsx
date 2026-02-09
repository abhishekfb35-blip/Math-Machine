import { Link } from "wouter";
import { MessageCircle, Mail, Phone, MapPin } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-foreground text-background pb-20 md:pb-0" data-testid="section-footer">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2 space-y-3">
            <h3 className="text-lg font-bold" data-testid="text-footer-brand">Turtle Little</h3>
            <p className="text-sm opacity-70 max-w-sm leading-relaxed">
              Premium personalised towels and blankets, embroidered with love.
              Each product is crafted with the finest fabrics and meticulous attention to detail,
              making every piece a thoughtful gift.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <a
                href="https://wa.me/919990079722"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm opacity-70 transition-opacity"
                data-testid="link-footer-whatsapp"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </a>
              <a
                href="mailto:hello@turtlelittle.com"
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
              <Link href="/shop?filter=kids" className="text-sm opacity-70" data-testid="link-footer-kids">
                Kids Collection
              </Link>
              <Link href="/shop?filter=couples" className="text-sm opacity-70" data-testid="link-footer-couples">
                Couple Sets
              </Link>
              <Link href="/shop" className="text-sm opacity-70" data-testid="link-footer-all">
                All Products
              </Link>
              <Link href="/cart" className="text-sm opacity-70" data-testid="link-footer-cart">
                My Cart
              </Link>
            </nav>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wider opacity-50">Contact</h4>
            <div className="flex flex-col gap-2">
              <a
                href="tel:+919990079722"
                className="inline-flex items-center gap-2 text-sm opacity-70 transition-opacity"
                data-testid="link-footer-phone"
              >
                <Phone className="w-3.5 h-3.5 shrink-0" />
                +91 99900 79722
              </a>
              <a
                href="mailto:hello@turtlelittle.com"
                className="inline-flex items-center gap-2 text-sm opacity-70 transition-opacity"
                data-testid="link-footer-email-contact"
              >
                <Mail className="w-3.5 h-3.5 shrink-0" />
                hello@turtlelittle.com
              </a>
              <span className="inline-flex items-start gap-2 text-sm opacity-70">
                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                New Delhi, India
              </span>
            </div>
          </div>
        </div>

        <div className="border-t border-background/10 mt-8 pt-6 text-center">
          <p className="text-xs opacity-50" data-testid="text-footer-copyright">
            &copy; {new Date().getFullYear()} Turtle Little. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
