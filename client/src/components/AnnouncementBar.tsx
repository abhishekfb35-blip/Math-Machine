import { Gift, Truck, Sparkles } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { defaultAnnouncement, type AnnouncementConfig } from "@/lib/siteConfigDefaults";
import { useOfferLabel } from "@/hooks/useOfferLabel";

const icons = [Gift, Truck, Sparkles];
const OFFER_PATTERN = /Buy \d+ Get 1 Free/i;

export default function AnnouncementBar() {
  const config = useSiteConfig<AnnouncementConfig>("announcement", defaultAnnouncement);
  const offerLabel = useOfferLabel();

  const items = config.items.map((item) => ({
    ...item,
    text: item.text.replace(OFFER_PATTERN, offerLabel),
  }));

  return (
    <div className="bg-primary text-primary-foreground overflow-hidden" data-testid="bar-announcement">
      <div className="animate-marquee whitespace-nowrap py-1.5 flex items-center gap-12">
        {[...items, ...items, ...items].map((item, i) => {
          const Icon = icons[i % icons.length];
          return (
            <span key={i} className="inline-flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
              <Icon className="w-3 h-3 shrink-0" />
              {item.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}
