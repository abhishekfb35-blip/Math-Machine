import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { CurrencyProvider } from "@/context/CurrencyContext";
import { WishlistProvider } from "@/context/WishlistContext";
import AnnouncementBar from "@/components/AnnouncementBar";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import GoogleOneTap from "@/components/GoogleOneTap";
import ConsentPopup from "@/components/ConsentPopup";
import WishlistSignupPrompt from "@/components/WishlistSignupPrompt";
import SignInModal from "@/components/SignInModal";
import PWAInstallBanner from "@/components/PWAInstallBanner";
import Home from "@/pages/Home";
import ShopPage from "@/pages/ShopPage";
import CategoryPage from "@/pages/CategoryPage";
import ProductPage from "@/pages/ProductPage";
import CartPage from "@/pages/CartPage";
import CheckoutPage from "@/pages/CheckoutPage";
import OrderConfirmation from "@/pages/OrderConfirmation";
import CollectionPage from "@/pages/CollectionPage";
import AdminBuilder from "@/pages/AdminBuilder";
import AdminCatalog from "@/pages/AdminCatalog";
import AdminAuditLog from "@/pages/AdminAuditLog";
import AdminPages from "@/pages/AdminPages";
import AdminOrders from "@/pages/AdminOrders";
import AdminExport from "@/pages/AdminExport";
import AdminChecks from "@/pages/AdminChecks";
import AdminDataCheck from "@/pages/AdminDataCheck";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminProductEdit from "@/pages/AdminProductEdit";
import AdminDeployCheck from "@/pages/AdminDeployCheck";
import AdminSeoAudit from "@/pages/AdminSeoAudit";
import AdminBrandAssets from "@/pages/AdminBrandAssets";
import AdminConsent from "@/pages/AdminConsent";
import AdminDbCompare from "@/pages/AdminDbCompare";
import AdminPricing from "@/pages/AdminPricing";
import AdminCustomers from "@/pages/AdminCustomers";
import AdminOffers from "@/pages/AdminOffers";
import AdminOccasions from "@/pages/AdminOccasions";
import AdminAttributes from "@/pages/AdminAttributes";
import AdminColorSwatches from "@/pages/AdminColorSwatches";
import AdminTags from "@/pages/AdminTags";
import AdminUsers from "@/pages/AdminUsers";
import AdminSecurity from "@/pages/AdminSecurity";
import AdminProductPageConfig from "@/pages/AdminProductPageConfig";
import WishlistPage from "@/pages/WishlistPage";
import AdminGuard from "@/components/AdminGuard";
import SuperAdminGuard from "@/components/SuperAdminGuard";
import PermissionGuard from "@/components/PermissionGuard";
import SignInPage from "@/pages/SignInPage";
import AccountPage from "@/pages/AccountPage";
import TermsPage from "@/pages/TermsPage";
import PrivacyPage from "@/pages/PrivacyPage";
import RefundPolicyPage from "@/pages/RefundPolicyPage";
import AboutPage from "@/pages/AboutPage";
import ShippingPolicyPage from "@/pages/ShippingPolicyPage";
import NotFound from "@/pages/not-found";

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/shop" component={ShopPage} />
      <Route path="/collection/:audience" component={CollectionPage} />
      <Route path="/category/:slug" component={CategoryPage} />
      <Route path="/product/:slug" component={ProductPage} />
      <Route path="/cart" component={CartPage} />
      <Route path="/checkout" component={CheckoutPage} />
      <Route path="/order/:id" component={OrderConfirmation} />
      <Route path="/signin" component={SignInPage} />
      <Route path="/account" component={AccountPage} />
      <Route path="/admin" component={() => <AdminGuard><AdminDashboard /></AdminGuard>} />
      <Route path="/admin/login" component={() => <AdminGuard><AdminDashboard /></AdminGuard>} />
      <Route path="/admin/builder" component={() => <PermissionGuard permission="builder"><AdminBuilder /></PermissionGuard>} />
      <Route path="/admin/catalog/product/:id" component={() => <PermissionGuard permission="catalog"><AdminProductEdit /></PermissionGuard>} />
      <Route path="/admin/brand" component={() => <PermissionGuard permission="brand"><AdminBrandAssets /></PermissionGuard>} />
      <Route path="/admin/catalog" component={() => <PermissionGuard permission="catalog"><AdminCatalog /></PermissionGuard>} />
      <Route path="/admin/audit-log" component={() => <PermissionGuard permission="audit"><AdminAuditLog /></PermissionGuard>} />
      <Route path="/admin/pages" component={() => <PermissionGuard permission="pages"><AdminPages /></PermissionGuard>} />
      <Route path="/admin/orders" component={() => <PermissionGuard permission="orders"><AdminOrders /></PermissionGuard>} />
      <Route path="/admin/export" component={() => <PermissionGuard permission="export"><AdminExport /></PermissionGuard>} />
      <Route path="/admin/checks" component={() => <PermissionGuard permission="health"><AdminChecks /></PermissionGuard>} />
      <Route path="/admin/deploy-check" component={() => <PermissionGuard permission="health"><AdminDeployCheck /></PermissionGuard>} />
      <Route path="/admin/data-check" component={() => <PermissionGuard permission="health"><AdminDataCheck /></PermissionGuard>} />
      <Route path="/admin/db-compare" component={() => <PermissionGuard permission="health"><AdminDbCompare /></PermissionGuard>} />
      <Route path="/admin/seo-audit" component={() => <PermissionGuard permission="seo"><AdminSeoAudit /></PermissionGuard>} />
      <Route path="/admin/consent" component={() => <PermissionGuard permission="consent"><AdminConsent /></PermissionGuard>} />
      <Route path="/admin/pricing" component={() => <PermissionGuard permission="pricing"><AdminPricing /></PermissionGuard>} />
      <Route path="/admin/customers" component={() => <PermissionGuard permission="customers"><AdminCustomers /></PermissionGuard>} />
      <Route path="/admin/offers" component={() => <PermissionGuard permission="offers"><AdminOffers /></PermissionGuard>} />
      <Route path="/admin/occasions" component={() => <PermissionGuard permission="catalog"><AdminOccasions /></PermissionGuard>} />
      <Route path="/admin/attributes" component={() => <PermissionGuard permission="catalog"><AdminAttributes /></PermissionGuard>} />
      <Route path="/admin/color-swatches" component={() => <PermissionGuard permission="catalog"><AdminColorSwatches /></PermissionGuard>} />
      <Route path="/admin/tags" component={() => <PermissionGuard permission="catalog"><AdminTags /></PermissionGuard>} />
      <Route path="/admin/users" component={() => <SuperAdminGuard><AdminUsers /></SuperAdminGuard>} />
      <Route path="/admin/security" component={() => <SuperAdminGuard><AdminSecurity /></SuperAdminGuard>} />
      <Route path="/admin/product-page" component={() => <PermissionGuard permission="builder"><AdminProductPageConfig /></PermissionGuard>} />
      <Route path="/wishlist" component={WishlistPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/refund-policy" component={RefundPolicyPage} />
      <Route path="/about" component={AboutPage} />
      <Route path="/shipping" component={ShippingPolicyPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <HelmetProvider>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <CurrencyProvider>
        <WishlistProvider>
        <TooltipProvider>
          <div className="min-h-screen flex flex-col">
            <AnnouncementBar />
            <Header />
            <PWAInstallBanner />
            <ScrollToTop />
            <main className="flex-1">
              <Router />
            </main>
            <Footer />
          </div>
          <BottomNav />
          <WhatsAppButton />
          <GoogleOneTap />
          <ConsentPopup />
          <WishlistSignupPrompt />
          <SignInModal />
          <Toaster />
        </TooltipProvider>
        </WishlistProvider>
        </CurrencyProvider>
      </QueryClientProvider>
    </ThemeProvider>
    </HelmetProvider>
  );
}

export default App;
