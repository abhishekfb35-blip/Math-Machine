import { Link, useLocation } from "wouter";
import { ShoppingCart, Menu, X, Sun, Moon, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/components/ThemeProvider";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { Category } from "@shared/schema";

export default function Header() {
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [location] = useLocation();

  const { data: cart } = useQuery<{ itemCount: number }>({
    queryKey: ["/api/cart"],
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between gap-4 h-16">
          <Link href="/" data-testid="link-home">
            <div className="flex items-center gap-2 cursor-pointer">
              <span className="text-xl font-bold text-primary" data-testid="text-brand-name">Turtle Little</span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1" data-testid="nav-desktop">
            <Link href="/">
              <Button variant={location === "/" ? "secondary" : "ghost"} size="sm" data-testid="link-nav-home">
                Home
              </Button>
            </Link>
            {categories?.map((cat) => (
              <Link key={cat.id} href={`/category/${cat.slug}`}>
                <Button
                  variant={location === `/category/${cat.slug}` ? "secondary" : "ghost"}
                  size="sm"
                  data-testid={`link-nav-category-${cat.slug}`}
                >
                  {cat.name}
                </Button>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={toggleTheme} data-testid="button-theme-toggle">
              {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </Button>

            <Link href="/cart">
              <Button variant="ghost" size="icon" className="relative" data-testid="button-cart">
                <ShoppingCart className="w-4 h-4" />
                {cart && cart.itemCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs" data-testid="badge-cart-count">
                    {cart.itemCount}
                  </Badge>
                )}
              </Button>
            </Link>

            <a href="https://wa.me/919990079722" target="_blank" rel="noopener noreferrer" className="hidden md:block">
              <Button variant="ghost" size="icon" data-testid="button-whatsapp-header">
                <Phone className="w-4 h-4" />
              </Button>
            </a>

            <Button
              size="icon"
              variant="ghost"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="button-mobile-menu"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t bg-background" data-testid="nav-mobile">
          <div className="px-4 py-3 space-y-1">
            <Link href="/" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="ghost" className="w-full justify-start" data-testid="link-mobile-home">
                Home
              </Button>
            </Link>
            {categories?.map((cat) => (
              <Link key={cat.id} href={`/category/${cat.slug}`} onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start" data-testid={`link-mobile-category-${cat.slug}`}>
                  {cat.name}
                </Button>
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
