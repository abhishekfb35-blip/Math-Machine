import { Link } from "wouter";
import { Building2, ChevronLeft, Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { businessDetails, publicInfoMetadata } from "@shared/discoverability";

const {
  registeredAddress: businessAddress,
  supportEmail,
  supportPhone,
  telephone,
  whatsappUrl,
} = businessDetails;

export default function ContactPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-24" data-testid="contact-page">
      <SEO {...publicInfoMetadata.contact} path="/contact" />

      <Link href="/">
        <Button variant="ghost" size="sm" className="mb-4" data-testid="link-back-home">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Home
        </Button>
      </Link>

      <h1 className="text-2xl font-bold mb-2" data-testid="text-contact-title">Contact Us</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Have a question about a product, personalisation, delivery, or an existing order? Our customer support team is here to help.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <h2 className="font-semibold mb-1">Email support</h2>
              <a className="text-sm text-muted-foreground underline break-all" href={`mailto:${supportEmail}`}>
                {supportEmail}
              </a>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start gap-3">
            <Phone className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <h2 className="font-semibold mb-1">Telephone</h2>
              <a className="text-sm text-muted-foreground underline" href={`tel:${telephone}`}>
                {supportPhone}
              </a>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start gap-3">
            <MessageCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <h2 className="font-semibold mb-1">WhatsApp</h2>
              <a className="text-sm text-muted-foreground underline" href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                Message {supportPhone}
              </a>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <h2 className="font-semibold mb-1">Support hours</h2>
              <p className="text-sm text-muted-foreground">Monday to Saturday, 10:00 AM to 6:00 PM IST</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-5 mt-4 space-y-5">
        <div className="flex items-start gap-3">
          <Building2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div>
            <h2 className="font-semibold mb-1">Business details</h2>
            <p className="text-sm text-muted-foreground">
              TurtleLittle is owned and operated by <strong className="text-foreground">{businessDetails.legalName}</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <MapPin className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div>
            <h2 className="font-semibold mb-1">Registered address</h2>
            <address className="text-sm text-muted-foreground not-italic">{businessAddress}</address>
          </div>
        </div>
      </Card>
    </div>
  );
}