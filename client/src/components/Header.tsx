import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ShoppingBag, Sun, Moon, Grid3X3, Search, X, User, Download, LogOut, Menu, Home, Tag, ArrowRight, Minus, Plus, Trash2 } from "lucide-react";
import { usePWAInstall } from "@/components/PWAInstallPrompt";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "@/components/ThemeProvider";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { defaultHeader, defaultPwaInstall, defaultSeo, type HeaderConfig, type PwaInstallConfig, type SeoConfig } from "@/lib/siteConfigDefaults";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/context/CurrencyContext";
import CurrencySelector from "@/components/CurrencySelector";
import ShareButton from "@/components/ShareButton";
import { getProductImageUrl } from "@/lib/imageUtils";
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
import NudgeCard from "@/components/NudgeCard";

interface MiniCartItem {
  id: string;
  quantity: number;
  personalizationName?: string | null;
  selectedColor?: string | null;
  selectedSize?: string | null;
  effectivePrice?: number;
  originalEffectivePrice?: number;
  isFreeItem?: boolean;
  bonusDiscountPct?: number;
  product: { name: string; slug: string; imageUrl: string; price: number } | null;
}

interface MiniCartData {
  itemCount: number;
  items: MiniCartItem[];
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  engineThresholds: {
    retailFreeItemTrigger: number;
    retailBonusDiscountPct: number;
    wholesaleThreshold: number;
  } | null;
}


export default function Header() {
  const { theme, toggleTheme } = useTheme();
  const [location, navigate] = useLocation();
  const config = useSiteConfig<HeaderConfig>("header", defaultHeader);
  const pwaConfig = useSiteConfig<PwaInstallConfig>("pwa-install-banner", defaultPwaInstall);
  const seoConfig = useSiteConfig<SeoConfig>("seo", defaultSeo);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [miniCartOpen, setMiniCartOpen] = useState(false);
  const { customer, isAuthenticated, logout } = useAuth();
  const { installable, promptInstall } = usePWAInstall();
  const { formatPrice } = useCurrency();

  const { data: cart } = useQuery<MiniCartData>({
    queryKey: ["/api/cart"],
  });

  const cartMutation = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      if (quantity === 0) {
        await apiRequest("DELETE", `/api/cart/items/${id}`);
      } else {
        await apiRequest("PATCH", `/api/cart/items/${id}`, { quantity });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/cart"] }),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shop?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery("");
    }
  };

  const isShopActive = location.startsWith("/shop");

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

            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={() => setMiniCartOpen(true)}
              data-testid="button-cart"
              aria-label="Open cart"
            >
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
          </div>
        </div>
      </div>

      {/* Mini-cart sidebar */}
      <Sheet open={miniCartOpen} onOpenChange={setMiniCartOpen}>
        <SheetContent side="right" className="w-80 sm:w-96 flex flex-col p-0">
          <SheetHeader className="px-5 py-4 border-b shrink-0">
            <SheetTitle className="text-left text-base font-semibold flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              Your Cart {cart && cart.itemCount > 0 && `(${cart.itemCount})`}
            </SheetTitle>
          </SheetHeader>

          {!cart || cart.itemCount === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <ShoppingBag className="w-12 h-12 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Your cart is empty</p>
              <SheetClose asChild>
                <Link href="/shop">
                  <Button size="sm" data-testid="button-mini-cart-shop">Start Shopping</Button>
                </Link>
              </SheetClose>
              {cart?.engineThresholds && (
                <div className="w-full mt-1" data-testid="mini-cart-teaser">
                  <NudgeCard
                    itemCount={0}
                    engineThresholds={cart.engineThresholds}
                    compact
                    showTeaser
                  />
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-5 py-3 space-y-0 divide-y">
                {cart.items.filter(i => i.product).map((item) => (
                  <div key={item.id} className="py-3 flex gap-3" data-testid={`mini-cart-item-${item.id}`}>
                    <SheetClose asChild>
                      <Link href={`/product/${item.product!.slug}`}>
                        <div className="w-14 h-14 rounded-md overflow-hidden bg-muted shrink-0 cursor-pointer">
                          <img
                            src={getProductImageUrl(item.product!.imageUrl, "small")}
                            alt={item.product!.name}
                            className="w-full h-full object-contain"
                          />
                        </div>
                      </Link>
                    </SheetClose>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-start gap-1.5 flex-wrap">
                        <SheetClose asChild>
                          <Link href={`/product/${item.product!.slug}`}>
                            <p className="text-sm font-medium leading-tight line-clamp-2 hover:text-primary transition-colors cursor-pointer">
                              {item.product!.name}
                            </p>
                          </Link>
                        </SheetClose>
                        {item.isFreeItem && (
                          <span className="text-[9px] font-extrabold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full uppercase tracking-wide shrink-0">Free Gift</span>
                        )}
                      </div>
                      {(item.selectedSize || item.selectedColor) && (
                        <p className="text-xs text-muted-foreground">
                          {[item.selectedSize, item.selectedColor].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {item.personalizationName && (
                        <p className="text-xs text-muted-foreground">Embroidered: {item.personalizationName}</p>
                      )}
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <Button
                          size="icon"
                          variant="outline"
                          className="w-6 h-6"
                          onClick={() => cartMutation.mutate({ id: item.id, quantity: Math.max(0, item.quantity - 1) })}
                          disabled={cartMutation.isPending}
                          data-testid={`button-mini-decrease-qty-${item.id}`}
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </Button>
                        <span className="text-xs font-semibold w-5 text-center" data-testid={`text-mini-qty-${item.id}`}>{item.quantity}</span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="w-6 h-6"
                          onClick={() => cartMutation.mutate({ id: item.id, quantity: item.quantity + 1 })}
                          disabled={cartMutation.isPending}
                          data-testid={`button-mini-increase-qty-${item.id}`}
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="w-6 h-6 ml-auto text-destructive"
                          onClick={() => cartMutation.mutate({ id: item.id, quantity: 0 })}
                          disabled={cartMutation.isPending}
                          data-testid={`button-mini-remove-item-${item.id}`}
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </Button>
                      </div>
                      {item.isFreeItem ? (
                        <p className="text-sm font-bold text-green-600" data-testid={`text-mini-price-${item.id}`}>FREE</p>
                      ) : (
                        <p className="text-sm font-semibold text-primary" data-testid={`text-mini-price-${item.id}`}>
                          {formatPrice((item.effectivePrice ?? item.product!.price) * item.quantity)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {cart.engineThresholds && (
                <div className="mx-5 mb-3" data-testid="mini-cart-banner">
                  <NudgeCard
                    itemCount={cart.itemCount}
                    engineThresholds={cart.engineThresholds}
                    compact
                  />
                </div>
              )}

              <div className="px-5 pb-5 space-y-3 shrink-0">
                <Separator />
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Subtotal</span>
                    <span data-testid="mini-cart-subtotal">{formatPrice(cart.subtotal)}</span>
                  </div>
                  {cart.discount > 0 && (() => {
                    const hasFree = cart.items.some(i => i.isFreeItem);
                    const bonusPct = cart.items.find(i => i.bonusDiscountPct && i.bonusDiscountPct > 0)?.bonusDiscountPct;
                    const label = hasFree
                      ? `Buy ${cart.engineThresholds?.retailFreeItemTrigger ?? 2} Get 1 Free`
                      : bonusPct
                        ? `${bonusPct}% Discount`
                        : "Discount";
                    return (
                      <div className="flex justify-between text-sm text-green-600 font-medium">
                        <span>{label}</span>
                        <span data-testid="mini-cart-saving">−{formatPrice(cart.discount)}</span>
                      </div>
                    );
                  })()}
                  {cart.shippingFee > 0 && (
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Delivery</span>
                      <span>{formatPrice(cart.shippingFee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-semibold">
                    <span>Total</span>
                    <span data-testid="mini-cart-total">{formatPrice(cart.total)}</span>
                  </div>
                </div>
                <SheetClose asChild>
                  <Link href="/cart">
                    <Button className="w-full" data-testid="button-mini-cart-view-cart">
                      View Cart <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link href="/checkout">
                    <Button variant="outline" className="w-full" data-testid="button-mini-cart-checkout">
                      Checkout
                    </Button>
                  </Link>
                </SheetClose>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

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
              <ShareButton
                variant="row"
                url={seoConfig.siteUrl || "https://turtlelittle.com"}
                title={`${seoConfig.brandName} — ${seoConfig.tagline}`}
                text={seoConfig.metaDescription}
              />
            </div>
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
