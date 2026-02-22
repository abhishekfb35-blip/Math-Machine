import { Link } from "wouter";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function RefundPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-24" data-testid="refund-policy-page">
      <Link href="/">
        <Button variant="ghost" size="sm" className="mb-4" data-testid="link-back-home">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Home
        </Button>
      </Link>

      <h1 className="text-2xl font-bold mb-6" data-testid="text-refund-title">Refund & Cancellation Policy</h1>
      <p className="text-sm text-muted-foreground mb-6">Last updated: February 2026</p>

      <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
        <section>
          <h2 className="text-lg font-semibold mb-2">1. Personalised Products</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Since all TurtleLittle products are personalised with custom embroidery (names, initials, or specific designs), they are made-to-order and cannot be resold. Therefore, we do not accept returns or exchanges for change of mind, incorrect personalisation details provided by the customer, or size/colour preferences after the order has been placed.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">2. Eligible Returns</h2>
          <p className="text-sm leading-relaxed text-muted-foreground mb-2">We accept returns and provide replacements or refunds only in the following cases:</p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
            <li><strong>Manufacturing Defects:</strong> If the product has a defect in the fabric, stitching, or embroidery quality.</li>
            <li><strong>Wrong Item:</strong> If you receive a product different from what you ordered.</li>
            <li><strong>Damaged in Transit:</strong> If the product arrives damaged due to shipping.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">3. How to Request a Return</h2>
          <p className="text-sm leading-relaxed text-muted-foreground mb-2">To initiate a return, please follow these steps:</p>
          <ol className="list-decimal pl-5 space-y-1 text-sm text-muted-foreground">
            <li>Contact us within <strong>48 hours</strong> of receiving your order via WhatsApp at <a href="https://wa.me/919990079722" className="underline">+91 99900 79722</a> or email at <a href="mailto:hello@turtlelittle.com" className="underline">hello@turtlelittle.com</a>.</li>
            <li>Share clear photographs of the product showing the defect or issue.</li>
            <li>Include your order number and a brief description of the problem.</li>
            <li>Our team will review your request and respond within 24-48 hours.</li>
          </ol>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">4. Refund Process</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Once your return request is approved, we will offer you the choice of a replacement product or a full refund. Refunds will be processed to the original payment method within 7-10 business days. For Cash on Delivery (COD) orders, refunds will be processed via bank transfer — we will collect your bank details securely.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">5. Order Cancellation</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            You may cancel your order within <strong>2 hours</strong> of placing it by contacting us via WhatsApp or email. After this window, your order may already be in production and cannot be cancelled. For cancelled orders where payment was already made, a full refund will be processed within 7-10 business days.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">6. Non-Returnable Items</h2>
          <p className="text-sm leading-relaxed text-muted-foreground mb-2">The following are not eligible for returns:</p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
            <li>Products that have been used, washed, or altered after delivery.</li>
            <li>Products returned without prior approval from our team.</li>
            <li>Products where the issue is due to incorrect personalisation details provided by the customer.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">7. Contact Us</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            For any questions about returns, refunds, or cancellations, please reach out to us at{" "}
            <a href="mailto:hello@turtlelittle.com" className="underline">hello@turtlelittle.com</a> or WhatsApp us at{" "}
            <a href="https://wa.me/919990079722" className="underline">+91 99900 79722</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
