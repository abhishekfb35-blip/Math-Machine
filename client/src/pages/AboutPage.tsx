import { Link } from "wouter";
import { ChevronLeft, Heart, Sparkles, Shield, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-24" data-testid="about-page">
      <Link href="/">
        <Button variant="ghost" size="sm" className="mb-4" data-testid="link-back-home">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Home
        </Button>
      </Link>

      <h1 className="text-2xl font-bold mb-6" data-testid="text-about-title">About TurtleLittle</h1>

      <div className="space-y-8">
        <section>
          <p className="text-sm leading-relaxed text-muted-foreground">
            TurtleLittle was born from a simple idea: that everyday essentials like towels, blankets, and bathrobes can be something truly special when made personal. We believe in the magic of seeing your own name beautifully embroidered on a premium product — it transforms something ordinary into a cherished keepsake.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">What We Do</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We specialise in personalised, embroidered luxury towels, blankets, and bathrobes for kids, adults, and couples. Every product is crafted using premium fabrics — our towels are made from 550 GSM zero-twist cotton that's incredibly soft and absorbent. Each item is embroidered with care, featuring your chosen name, initials, or design.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Our Collections</h2>
          <p className="text-sm leading-relaxed text-muted-foreground mb-3">
            From Disney princesses and superheroes for kids to elegant monograms for adults and matching "King & Queen" sets for couples — we have something for everyone. Our products make perfect gifts for birthdays, baby showers, weddings, anniversaries, housewarmings, and every celebration in between.
          </p>
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h3 className="font-medium text-sm">Handcrafted Quality</h3>
            </div>
            <p className="text-xs text-muted-foreground">Every piece is individually embroidered with precision and care, ensuring a premium finish.</p>
          </Card>

          <Card className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-primary" />
              <h3 className="font-medium text-sm">Made with Love</h3>
            </div>
            <p className="text-xs text-muted-foreground">We put our heart into every product, because we know it's going to be loved by someone special.</p>
          </Card>

          <Card className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <h3 className="font-medium text-sm">Premium Fabrics</h3>
            </div>
            <p className="text-xs text-muted-foreground">550 GSM zero-twist cotton towels and ultra-soft blankets — only the best materials make it into our products.</p>
          </Card>

          <Card className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" />
              <h3 className="font-medium text-sm">All-India Delivery</h3>
            </div>
            <p className="text-xs text-muted-foreground">We deliver across India so you can send a personalised gift to anyone, anywhere.</p>
          </Card>
        </div>

        <section>
          <h2 className="text-lg font-semibold mb-3">Our Promise</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            At TurtleLittle, we're committed to delivering products that exceed your expectations. Every towel, blanket, and bathrobe is made to be soft, durable, and beautifully personalised. If you're ever not satisfied with the quality of your product, we'll make it right — that's our promise to you.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Get in Touch</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Have a question or need help choosing the perfect gift? We'd love to hear from you! Reach out via WhatsApp at{" "}
            <a href="https://wa.me/919990079722" className="underline">+91 99900 79722</a> or email us at{" "}
            <a href="mailto:hello@turtlelittle.com" className="underline">hello@turtlelittle.com</a>. We're based in New Delhi, India.
          </p>
        </section>
      </div>
    </div>
  );
}
