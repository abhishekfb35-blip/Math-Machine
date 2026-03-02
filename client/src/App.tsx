import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import AnnouncementBar from "@/components/AnnouncementBar";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import GoogleOneTap from "@/components/GoogleOneTap";
import ConsentPopup from "@/components/ConsentPopup";
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
import AdminGuard from "@/components/AdminGuard";
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
      <Route path="/admin/builder" component={() => <AdminGuard><AdminBuilder /></AdminGuard>} />
      <Route path="/admin/catalog/product/:id" component={() => <AdminGuard><AdminProductEdit /></AdminGuard>} />
      <Route path="/admin/brand" component={() => <AdminGuard><AdminBrandAssets /></AdminGuard>} />
      <Route path="/admin/catalog" component={() => <AdminGuard><AdminCatalog /></AdminGuard>} />
      <Route path="/admin/audit-log" component={() => <AdminGuard><AdminAuditLog /></AdminGuard>} />
      <Route path="/admin/pages" component={() => <AdminGuard><AdminPages /></AdminGuard>} />
      <Route path="/admin/orders" component={() => <AdminGuard><AdminOrders /></AdminGuard>} />
      <Route path="/admin/export" component={() => <AdminGuard><AdminExport /></AdminGuard>} />
      <Route path="/admin/checks" component={() => <AdminGuard><AdminChecks /></AdminGuard>} />
      <Route path="/admin/deploy-check" component={() => <AdminGuard><AdminDeployCheck /></AdminGuard>} />
      <Route path="/admin/data-check" component={() => <AdminGuard><AdminDataCheck /></AdminGuard>} />
      <Route path="/admin/seo-audit" component={() => <AdminGuard><AdminSeoAudit /></AdminGuard>} />
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
        <TooltipProvider>
          <div className="min-h-screen flex flex-col">
            <AnnouncementBar />
            <Header />
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
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
    </HelmetProvider>
  );
}

export default App;
