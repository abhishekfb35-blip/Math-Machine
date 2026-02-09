import { Gift, Truck, Sparkles } from "lucide-react";

const announcements = [
  { icon: Gift, text: "Buy 2 Get 1 Free on all products" },
  { icon: Truck, text: "Free shipping across India" },
  { icon: Sparkles, text: "Personalised embroidery on every product" },
];

export default function AnnouncementBar() {
  return (
    <div className="bg-primary text-primary-foreground overflow-hidden" data-testid="bar-announcement">
      <div className="animate-marquee whitespace-nowrap py-1.5 flex items-center gap-12">
        {[...announcements, ...announcements, ...announcements].map((item, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
            <item.icon className="w-3 h-3 shrink-0" />
            {item.text}
          </span>
        ))}
      </div>
    </div>
  );
}
