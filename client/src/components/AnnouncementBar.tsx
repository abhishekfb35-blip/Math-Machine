import { Gift, Truck, Sparkles } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { defaultAnnouncement, type AnnouncementConfig } from "@/lib/siteConfigDefaults";

const icons = [Gift, Truck, Sparkles];

export default function AnnouncementBar() {
  const config = useSiteConfig<AnnouncementConfig>("announcement", defaultAnnouncement);

  return (
    <div className="bg-primary text-primary-foreground overflow-hidden" data-testid="bar-announcement">
      <div className="animate-marquee whitespace-nowrap py-1.5 flex items-center gap-12">
        {[...config.items, ...config.items, ...config.items].map((item, i) => {
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
