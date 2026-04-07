import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ShoppingBag, Sun, Moon, Grid3X3, Search, X, User, Download, LogOut, Menu, Home, Bath, Shirt, Layers } from "lucide-react";
import { usePWAInstall } from "@/components/PWAInstallPrompt";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/components/ThemeProvider";
import { useQuery } from "@tanstack/react-query";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { defaultHeader, defaultPwaInstall, type HeaderConfig, type PwaInstallConfig } from "@/lib/siteConfigDefaults";
import { useAuth } from "@/hooks/useAuth";
import CurrencySelector from "@/components/CurrencySelector";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";

const categories = [
  { label: "Towels", href: "/shop#towels", icon: Bath },
  { label: "Bathrobes", href: "/shop#bathrobes", icon: Shirt },
  { label: "Blankets", href: "/shop#blankets", icon: Layers },
];

export default function Header() {
  const { theme, toggleTheme } = useTheme();
  const [location, navigate] = useLocation();
  const config = useSiteConfig<HeaderConfig>("header", defaultHeader);
  const pwaConfig = useSiteConfig<PwaInstallConfig>("pwa-install-banner", defaultPwaInstall);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentHash, setCurrentHash] = useState(() =>
    typeof window !== "undefined" ? window.location.hash : ""
  );
  const { customer, isAuthenticated, logout } = useAuth();
  const { installable, promptInstall } = usePWAInstall();

  useEffect(() => {
    const onHashChange = () => setCurrentHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    setCurrentHash(window.location.hash);
  }, [location]);

  const { data: cart } = useQuery<{ itemCount: number }>({
    queryKey: ["/api/cart"],
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shop?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery("");
    }
  };

  const isCategoryActive = (href: string) => {
    const slug = href.split("#")[1];
    return location.startsWith("/shop") && currentHash === `#${slug}`;
  };

  const isShopActive = location.startsWith("/shop") && !categories.some(c => isCategoryActive(c.href));

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between gap-2 h-[72px] md:h-[86px]">
          <div className="flex items-center gap-2">
            {/* Mobile hamburger */}
            <Button
              size="icon"
              variant="ghost"
              className="md:hidden"
              onClick={() => setMenuOpen(true)}
              data-testid="button-menu-open"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </Button>

            <Link href="/" data-testid="link-home">
              <picture>
                <source media="(min-width: 768px)" srcSet="/images/logo-desktop.png" />
                <img
                  src="/images/logo-mobile.png"
                  alt={config.brandName}
                  className="h-[55px] md:h-[66px] w-auto cursor-pointer"
                  data-testid="img-brand-logo"
                  onError={(e) => { (e.target as HTMLImageElement).src = "/images/logo.png"; }}
                />
              </picture>
            </Link>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1" data-testid="nav-desktop">
            <Link href="/">
              <Button variant={location === "/" ? "secondary" : "ghost"} size="sm" data-testid="link-nav-home">
                Home
              </Button>
            </Link>
            <Link href="/shop">
              <Button variant={isShopActive ? "secondary" : "ghost"} size="sm" data-testid="link-nav-shop">
                <Grid3X3 className="w-4 h-4 mr-1" /> Shop
              </Button>
            </Link>
            {categories.map((cat) => (
              <a key={cat.href} href={cat.href} data-testid={`link-nav-${cat.label.toLowerCase()}`}>
                <Button
                  variant={isCategoryActive(cat.href) ? "secondary" : "ghost"}
                  size="sm"
                >
                  {cat.label}
                </Button>
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            {(installable || pwaConfig.customUrl) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (pwaConfig.customUrl?.trim()) {
                    window.open(pwaConfig.customUrl.trim(), "_blank", "noopener,noreferrer");
                  } else {
                    promptInstall();
                  }
                }}
                className="hidden md:flex gap-1 text-xs"
                data-testid="button-pwa-install"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{pwaConfig.buttonText}</span>
              </Button>
            )}

            {searchOpen ? (
              <form onSubmit={handleSearch} className="flex items-center gap-1" data-testid="form-header-search">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    autoFocus
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 w-40 sm:w-56"
                    data-testid="input-header-search"
                  />
                </div>
                <Button size="icon" variant="ghost" type="button" onClick={() => { setSearchOpen(false); setSearchQuery(""); }} data-testid="button-close-search">
                  <X className="w-4 h-4" />
                </Button>
              </form>
            ) : (
              <Button size="icon" variant="ghost" onClick={() => setSearchOpen(true)} data-testid="button-open-search">
                <Search className="w-4 h-4" />
              </Button>
            )}

            <CurrencySelector />

            <Button size="icon" variant="ghost" onClick={toggleTheme} data-testid="button-theme-toggle">
              {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </Button>

            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    data-testid="button-account"
                  >
                    <div className="w-6 h-6 md:w-5 md:h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs md:text-[10px] font-semibold shrink-0">
                      {(customer?.name || customer?.email || "U").charAt(0).toUpperCase()}
                    </div>
                    <span className="hidden md:inline text-sm">Hi, {(customer?.name || customer?.email || "User").split(" ")[0]}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => navigate("/account")} data-testid="menu-item-account">
                    <User className="w-4 h-4 mr-2" /> My Account
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => { logout(); navigate("/"); }} data-testid="menu-item-signout">
                    <LogOut className="w-4 h-4 mr-2" /> Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/signin">
                <Button
                  variant="ghost"
                  size="icon"
                  data-testid="button-signin"
                >
                  <User className="w-4 h-4" />
                </Button>
              </Link>
            )}

            <Link href="/cart">
              <Button variant="ghost" size="icon" className="relative" data-testid="button-cart">
                <ShoppingBag className="w-4 h-4" />
                {cart && cart.itemCount > 0 && (
                  <Badge
                    className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                    data-testid="badge-cart-count"
                  >
                    {cart.itemCount}
                  </Badge>
                )}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile navigation drawer */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="px-5 py-4 border-b">
            <SheetTitle className="text-left text-base font-semibold">Menu</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col py-2" data-testid="nav-mobile-drawer">
            <SheetClose asChild>
              <a
                href="/"
                onClick={(e) => { e.preventDefault(); navigate("/"); setMenuOpen(false); }}
                className={`flex items-center gap-3 w-full px-5 py-3 text-sm font-medium transition-colors hover:bg-accent ${location === "/" ? "text-primary bg-accent/50" : "text-foreground"}`}
                data-testid="drawer-link-home"
              >
                <Home className="w-4 h-4 shrink-0" />
                Home
              </a>
            </SheetClose>
            <SheetClose asChild>
              <a
                href="/shop"
                onClick={(e) => { e.preventDefault(); navigate("/shop"); setMenuOpen(false); }}
                className={`flex items-center gap-3 w-full px-5 py-3 text-sm font-medium transition-colors hover:bg-accent ${isShopActive ? "text-primary bg-accent/50" : "text-foreground"}`}
                data-testid="drawer-link-shop"
              >
                <Grid3X3 className="w-4 h-4 shrink-0" />
                All Products
              </a>
            </SheetClose>

            <div className="px-5 pt-4 pb-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Shop by Category</p>
            </div>
            {categories.map((cat) => (
              <SheetClose key={cat.href} asChild>
                <a
                  href={cat.href}
                  className={`flex items-center gap-3 w-full px-5 py-3 text-sm font-medium transition-colors hover:bg-accent ${isCategoryActive(cat.href) ? "text-primary bg-accent/50" : "text-foreground"}`}
                  data-testid={`drawer-link-${cat.label.toLowerCase()}`}
                >
                  <cat.icon className="w-4 h-4 shrink-0" />
                  {cat.label}
                </a>
              </SheetClose>
            ))}

            <div className="border-t mt-2 pt-2">
              <SheetClose asChild>
                <a
                  href={isAuthenticated ? "/account" : "/signin"}
                  onClick={(e) => { e.preventDefault(); navigate(isAuthenticated ? "/account" : "/signin"); setMenuOpen(false); }}
                  className="flex items-center gap-3 w-full px-5 py-3 text-sm font-medium transition-colors hover:bg-accent text-foreground"
                  data-testid="drawer-link-account"
                >
                  <User className="w-4 h-4 shrink-0" />
                  {isAuthenticated ? "My Account" : "Sign In"}
                </a>
              </SheetClose>
              <SheetClose asChild>
                <a
                  href="/cart"
                  onClick={(e) => { e.preventDefault(); navigate("/cart"); setMenuOpen(false); }}
                  className="flex items-center gap-3 w-full px-5 py-3 text-sm font-medium transition-colors hover:bg-accent text-foreground"
                  data-testid="drawer-link-cart"
                >
                  <ShoppingBag className="w-4 h-4 shrink-0" />
                  Cart
                  {cart && cart.itemCount > 0 && (
                    <Badge className="ml-auto h-5 min-w-5 flex items-center justify-center p-0 text-[10px]">
                      {cart.itemCount}
                    </Badge>
                  )}
                </a>
              </SheetClose>
            </div>
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
