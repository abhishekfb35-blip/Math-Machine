import { Link } from "wouter";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ShippingPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-24" data-testid="shipping-policy-page">
      <Link href="/">
        <Button variant="ghost" size="sm" className="mb-4" data-testid="link-back-home">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Home
        </Button>
      </Link>

      <h1 className="text-2xl font-bold mb-6" data-testid="text-shipping-title">Shipping Policy</h1>
      <p className="text-sm text-muted-foreground mb-6">Last updated: February 2026</p>

      <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
        <section>
          <h2 className="text-lg font-semibold mb-2">1. Processing Time</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Since all TurtleLittle products are personalised with custom embroidery, each item is made-to-order. Orders typically take <strong>3-5 business days</strong> to process and prepare for dispatch. During festive seasons or high-demand periods, processing may take slightly longer.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">2. Delivery Timeline</h2>
          <p className="text-sm leading-relaxed text-muted-foreground mb-2">
            After dispatch, estimated delivery times are:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
            <li><strong>Metro Cities</strong> (Delhi, Mumbai, Bangalore, Chennai, Kolkata, Hyderabad): 2-4 business days</li>
            <li><strong>Other Cities & Towns:</strong> 4-7 business days</li>
            <li><strong>Remote Areas:</strong> 7-10 business days</li>
          </ul>
          <p className="text-sm leading-relaxed text-muted-foreground mt-2">
            Please note that delivery timelines are estimates and may vary based on the shipping partner and your location. You will receive a shipping confirmation with tracking details once your order is dispatched.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">3. Shipping Charges</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We offer <strong>free shipping</strong> across India on all orders. No minimum order value is required. We want the joy of receiving a personalised TurtleLittle product to begin the moment you place your order.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">4. Shipping Partners</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We work with reputable logistics partners to ensure safe and timely delivery of your orders. All products are carefully packaged to protect the embroidery and fabric during transit.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">5. Order Tracking</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Once your order is dispatched, you will receive a tracking number via WhatsApp or email. You can use this to track the real-time status of your delivery. If you haven't received tracking details within 5 business days of placing your order, please contact us.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">6. Delivery Issues</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            If your order has not arrived within the estimated delivery timeline, or if you receive a damaged package, please contact us immediately via WhatsApp at{" "}
            <a href="https://wa.me/919990079722" className="underline">+91 99900 79722</a> or email at{" "}
            <a href="mailto:hello@turtlelittle.com" className="underline">hello@turtlelittle.com</a>. We will work with the shipping partner to resolve the issue as quickly as possible.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">7. Incorrect Address</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Please ensure that the shipping address provided at checkout is accurate and complete. TurtleLittle is not responsible for delays or non-delivery caused by incorrect or incomplete addresses. If you need to change your shipping address after placing an order, contact us within 2 hours of placing the order.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">8. Contact Us</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            For any shipping-related queries, please reach out to us at{" "}
            <a href="mailto:hello@turtlelittle.com" className="underline">hello@turtlelittle.com</a> or WhatsApp us at{" "}
            <a href="https://wa.me/919990079722" className="underline">+91 99900 79722</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
