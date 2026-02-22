import { Link } from "wouter";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-24" data-testid="terms-page">
      <Link href="/">
        <Button variant="ghost" size="sm" className="mb-4" data-testid="link-back-home">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Home
        </Button>
      </Link>

      <h1 className="text-2xl font-bold mb-6" data-testid="text-terms-title">Terms & Conditions</h1>
      <p className="text-sm text-muted-foreground mb-6">Last updated: February 2026</p>

      <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
        <section>
          <h2 className="text-lg font-semibold mb-2">1. Introduction</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Welcome to TurtleLittle ("we," "our," or "us"). These Terms & Conditions govern your use of our website turtlelittle.com and the purchase of our products. By accessing our website or placing an order, you agree to be bound by these terms. Please read them carefully before using our services.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">2. Products & Personalisation</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            TurtleLittle offers personalised embroidered towels, blankets, and bathrobes. All personalisation details (names, initials, designs) provided by the customer must be accurate. We are not responsible for errors in personalisation caused by incorrect information provided by the customer. Due to the personalised nature of our products, please double-check all details before confirming your order.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">3. Pricing & Payment</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            All prices are listed in Indian Rupees (INR) and are inclusive of applicable taxes unless stated otherwise. We reserve the right to change prices at any time without prior notice. Payment must be completed at the time of placing an order through our accepted payment methods. We use secure, industry-standard payment processing to protect your financial information.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">4. Orders & Confirmation</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Once you place an order, you will receive an order confirmation. This confirmation does not guarantee acceptance of your order. We reserve the right to cancel or refuse any order for reasons including product availability, pricing errors, or suspected fraudulent activity. In such cases, you will be notified and any payment made will be refunded.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">5. Shipping & Delivery</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We aim to dispatch all orders within 3-5 business days after order confirmation. Delivery timelines depend on your location and the shipping partner. Please refer to our <Link href="/shipping" className="underline">Shipping Policy</Link> for detailed information on delivery timelines and charges.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">6. Returns & Refunds</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Due to the personalised nature of our products, returns and exchanges are accepted only in cases of manufacturing defects or incorrect items delivered. Please refer to our <Link href="/refund-policy" className="underline">Refund & Cancellation Policy</Link> for complete details on the return process and eligibility.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">7. Intellectual Property</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            All content on turtlelittle.com, including text, images, logos, designs, and graphics, is the property of TurtleLittle and is protected by applicable intellectual property laws. You may not reproduce, distribute, or use any content from our website without our prior written permission.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">8. Limitation of Liability</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            TurtleLittle shall not be liable for any indirect, incidental, or consequential damages arising from the use of our website or products. Our total liability shall not exceed the amount paid by you for the specific product in question.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">9. Governing Law</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            These terms shall be governed by and construed in accordance with the laws of India. Any disputes arising from these terms shall be subject to the exclusive jurisdiction of the courts in New Delhi, India.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">10. Contact Us</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            If you have any questions about these Terms & Conditions, please reach out to us at{" "}
            <a href="mailto:hello@turtlelittle.com" className="underline">hello@turtlelittle.com</a> or call us at{" "}
            <a href="tel:+919990079722" className="underline">+91 99900 79722</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
