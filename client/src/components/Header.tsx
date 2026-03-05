import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ShoppingBag, Sun, Moon, Grid3X3, Search, X, User, Download, LogOut } from "lucide-react";
import { usePWAInstall } from "@/components/PWAInstallPrompt";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/components/ThemeProvider";
import { useQuery } from "@tanstack/react-query";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { defaultHeader, type HeaderConfig } from "@/lib/siteConfigDefaults";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Header() {
  const { theme, toggleTheme } = useTheme();
  const [location, navigate] = useLocation();
  const config = useSiteConfig<HeaderConfig>("header", defaultHeader);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const { customer, isAuthenticated, logout } = useAuth();
  const { installable, promptInstall } = usePWAInstall();

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

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between gap-2 h-[72px] md:h-[86px]">
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

          <nav className="hidden md:flex items-center gap-1" data-testid="nav-desktop">
            <Link href="/">
              <Button variant={location === "/" ? "secondary" : "ghost"} size="sm" data-testid="link-nav-home">
                Home
              </Button>
            </Link>
            <Link href="/shop">
              <Button variant={location.startsWith("/shop") ? "secondary" : "ghost"} size="sm" data-testid="link-nav-shop">
                <Grid3X3 className="w-4 h-4 mr-1" /> Shop
              </Button>
            </Link>
          </nav>

          <div className="flex items-center gap-1">
            {installable && (
              <Button
                variant="outline"
                size="sm"
                onClick={promptInstall}
                className="gap-1 text-xs"
                data-testid="button-pwa-install"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install</span>
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

            <Button size="icon" variant="ghost" onClick={toggleTheme} data-testid="button-theme-toggle">
              {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </Button>

            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden"
                    data-testid="button-account"
                  >
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
                      {(customer?.name || customer?.email || "U").charAt(0).toUpperCase()}
                    </div>
                  </Button>
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
            ) : null}
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hidden md:inline-flex gap-1.5"
                    data-testid="button-account-desktop"
                  >
                    <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-semibold shrink-0">
                      {(customer?.name || customer?.email || "U").charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm">Hi, {(customer?.name || customer?.email || "User").split(" ")[0]}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => navigate("/account")} data-testid="menu-item-account-desktop">
                    <User className="w-4 h-4 mr-2" /> My Account
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => { logout(); navigate("/"); }} data-testid="menu-item-signout-desktop">
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
    </header>
  );
}
