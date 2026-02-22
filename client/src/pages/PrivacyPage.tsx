import { Link } from "wouter";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-24" data-testid="privacy-page">
      <Link href="/">
        <Button variant="ghost" size="sm" className="mb-4" data-testid="link-back-home">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Home
        </Button>
      </Link>

      <h1 className="text-2xl font-bold mb-6" data-testid="text-privacy-title">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-6">Last updated: February 2026</p>

      <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
        <section>
          <h2 className="text-lg font-semibold mb-2">1. Introduction</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            TurtleLittle ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, store, and protect your personal information when you visit turtlelittle.com or purchase our products.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">2. Information We Collect</h2>
          <p className="text-sm leading-relaxed text-muted-foreground mb-2">We collect the following types of information:</p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
            <li><strong>Personal Information:</strong> Name, email address, phone number, shipping address, and billing address when you place an order.</li>
            <li><strong>Personalisation Details:</strong> Names and initials you provide for embroidery on our products.</li>
            <li><strong>Payment Information:</strong> Payment details are processed securely through our payment gateway partners and are not stored on our servers.</li>
            <li><strong>Usage Data:</strong> Browser type, pages visited, time spent on pages, and other analytics data to improve our website experience.</li>
            <li><strong>Cookies:</strong> We use cookies to maintain your cart, remember preferences, and improve your browsing experience.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">3. How We Use Your Information</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
            <li>To process and fulfill your orders, including personalisation and delivery.</li>
            <li>To communicate with you about your orders, including shipping updates via WhatsApp or phone.</li>
            <li>To improve our website, products, and customer service.</li>
            <li>To send promotional communications (only with your consent, and you can opt out at any time).</li>
            <li>To prevent fraud and ensure the security of transactions.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">4. Information Sharing</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We do not sell, trade, or rent your personal information to third parties. We may share your information only with:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground mt-2">
            <li><strong>Shipping Partners:</strong> To deliver your orders.</li>
            <li><strong>Payment Processors:</strong> To process your payments securely.</li>
            <li><strong>Legal Requirements:</strong> When required by law or to protect our rights.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">5. Cookies</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Our website uses cookies to enhance your experience. Cookies help us remember your cart items and preferences. You can manage or disable cookies through your browser settings, though some features of the website may not function properly without them.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">6. Data Security</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We implement industry-standard security measures to protect your personal information, including SSL encryption for all data transmission. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">7. Data Retention</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We retain your personal information for as long as necessary to fulfill the purposes outlined in this policy, including order fulfillment, customer support, and legal obligations. You may request deletion of your data by contacting us.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">8. Your Rights</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">You have the right to:</p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground mt-2">
            <li>Access the personal information we hold about you.</li>
            <li>Request correction of inaccurate information.</li>
            <li>Request deletion of your personal data.</li>
            <li>Opt out of promotional communications at any time.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">9. Changes to This Policy</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated date. We encourage you to review this policy periodically.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">10. Contact Us</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            For any privacy-related questions or requests, please contact us at{" "}
            <a href="mailto:hello@turtlelittle.com" className="underline">hello@turtlelittle.com</a> or call us at{" "}
            <a href="tel:+919990079722" className="underline">+91 99900 79722</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
