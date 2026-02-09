import { useLocation, Link } from "wouter";
import { Home, Search, ShoppingBag, Grid3X3 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

const tabs = [
  { label: "Home", icon: Home, path: "/" },
  { label: "Shop", icon: Grid3X3, path: "/shop" },
  { label: "Cart", icon: ShoppingBag, path: "/cart" },
];

export default function BottomNav() {
  const [location] = useLocation();

  const { data: cart } = useQuery<{ itemCount: number }>({
    queryKey: ["/api/cart"],
  });

  const isActive = (path: string) => {
    if (path === "/") return location === "/";
    return location.startsWith(path);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-md md:hidden"
      data-testid="nav-bottom"
    >
      <div className="flex items-center justify-around h-16 px-2">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          return (
            <Link key={tab.path} href={tab.path}>
              <div
                role="button"
                aria-label={tab.label}
                className={`flex flex-col items-center justify-center gap-0.5 w-16 h-full relative transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
                data-testid={`tab-${tab.label.toLowerCase()}`}
              >
                <div className="relative">
                  <tab.icon className="w-5 h-5" />
                  {tab.label === "Cart" && cart && cart.itemCount > 0 && (
                    <Badge
                      className="absolute -top-2 -right-3 h-4 min-w-4 flex items-center justify-center p-0 text-[10px]"
                      data-testid="badge-cart-count-bottom"
                    >
                      {cart.itemCount}
                    </Badge>
                  )}
                </div>
                <span className="text-[10px] font-medium">{tab.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
