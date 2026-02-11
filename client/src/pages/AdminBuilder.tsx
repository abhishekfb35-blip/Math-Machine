import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Save, Plus, Trash2, ArrowLeft, Megaphone, LayoutDashboard, Heart,
  Grid3X3, Package, Gift, MessageSquare, BarChart3, FileText, Settings, ImageIcon,
} from "lucide-react";
import { Link } from "wouter";
import {
  defaultAnnouncement, defaultHero, defaultHeader, defaultPromise,
  defaultCollections, defaultProductTypes, defaultPromo, defaultTestimonials,
  defaultStats, defaultFooter, defaultFeaturedSections,
  type AnnouncementConfig, type HeroConfig, type HeaderConfig,
  type PromiseConfig, type CollectionsConfig, type ProductTypesConfig,
  type PromoConfig, type TestimonialsConfig, type StatsConfig,
  type FooterConfig, type FeaturedSectionsConfig,
} from "@/lib/siteConfigDefaults";

import heroBanner from "@/assets/images/hero-banner.png";
import kidsBanner from "@/assets/images/kids-banner.png";
import couplesBanner from "@/assets/images/couples-banner.png";
import adultsBanner from "@assets/4laurel_set_s_1770763286429.jpg";
import towelsBanner from "@/assets/images/towels-collection.png";
import bathrobesBanner from "@/assets/images/bathrobes-collection.png";
import blanketsBanner from "@/assets/images/blankets-collection.png";

const defaultCollectionImages = [kidsBanner, adultsBanner, couplesBanner];
const defaultProductTypeImages = [towelsBanner, bathrobesBanner, blanketsBanner];

function useSaveConfig(key: string) {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (value: any) => {
      await apiRequest("POST", `/api/site-config/${key}`, { value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/site-config"] });
      toast({ title: "Saved", description: `${key} configuration updated.` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save. Please try again.", variant: "destructive" });
    },
  });
}

function SectionHeader({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <span className="font-medium">{title}</span>
    </div>
  );
}

function ImageField({ label, value, onChange, testId, fallbackImage }: { label: string; value: string; onChange: (url: string) => void; testId: string; fallbackImage?: string }) {
  const displaySrc = value || fallbackImage;
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative rounded-md overflow-hidden border bg-muted/30">
        {displaySrc ? (
          <img
            src={displaySrc}
            alt={label}
            className="w-full max-h-40 object-cover"
            data-testid={`${testId}-preview`}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="flex items-center justify-center h-32 bg-muted/20" data-testid={`${testId}-empty`}>
            <div className="text-center text-muted-foreground">
              <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-30" />
              <p className="text-xs opacity-60">No image available</p>
            </div>
          </div>
        )}
        {!value && displaySrc && (
          <div className="absolute bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm px-3 py-1.5">
            <p className="text-xs text-muted-foreground">Current default image</p>
          </div>
        )}
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste image URL to override default"
        data-testid={testId}
      />
    </div>
  );
}

function HeaderSection({ data }: { data: HeaderConfig }) {
  const [config, setConfig] = useState(data);
  const save = useSaveConfig("header");
  useEffect(() => { setConfig(data); }, [data]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Brand Name</Label>
        <Input
          value={config.brandName}
          onChange={(e) => setConfig({ ...config, brandName: e.target.value })}
          data-testid="input-header-brand"
        />
      </div>
      <Button onClick={() => save.mutate(config)} disabled={save.isPending} data-testid="button-save-header">
        <Save className="w-4 h-4 mr-2" /> {save.isPending ? "Saving..." : "Save Header"}
      </Button>
    </div>
  );
}

function AnnouncementSection({ data }: { data: AnnouncementConfig }) {
  const [config, setConfig] = useState(data);
  const save = useSaveConfig("announcement");
  useEffect(() => { setConfig(data); }, [data]);

  const updateItem = (index: number, text: string) => {
    const items = [...config.items];
    items[index] = { text };
    setConfig({ ...config, items });
  };

  const addItem = () => setConfig({ ...config, items: [...config.items, { text: "" }] });
  const removeItem = (index: number) => setConfig({ ...config, items: config.items.filter((_, i) => i !== index) });

  return (
    <div className="space-y-4">
      {config.items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={item.text}
            onChange={(e) => updateItem(i, e.target.value)}
            placeholder="Announcement text"
            data-testid={`input-announcement-${i}`}
          />
          <Button size="icon" variant="ghost" onClick={() => removeItem(i)} data-testid={`button-remove-announcement-${i}`}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" onClick={addItem} data-testid="button-add-announcement">
        <Plus className="w-4 h-4 mr-2" /> Add Announcement
      </Button>
      <div>
        <Button onClick={() => save.mutate(config)} disabled={save.isPending} data-testid="button-save-announcement">
          <Save className="w-4 h-4 mr-2" /> {save.isPending ? "Saving..." : "Save Announcements"}
        </Button>
      </div>
    </div>
  );
}

function HeroSection({ data }: { data: HeroConfig }) {
  const [config, setConfig] = useState(data);
  const save = useSaveConfig("hero");
  useEffect(() => { setConfig(data); }, [data]);

  return (
    <div className="space-y-4">
      <ImageField
        label="Hero Background Image"
        value={config.imageUrl}
        onChange={(url) => setConfig({ ...config, imageUrl: url })}
        testId="input-hero-image"
        fallbackImage={heroBanner}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Title</Label>
          <Input value={config.title} onChange={(e) => setConfig({ ...config, title: e.target.value })} data-testid="input-hero-title" />
        </div>
        <div className="space-y-2">
          <Label>Highlighted Text</Label>
          <Input value={config.titleHighlight} onChange={(e) => setConfig({ ...config, titleHighlight: e.target.value })} data-testid="input-hero-highlight" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Subtitle</Label>
        <Textarea value={config.subtitle} onChange={(e) => setConfig({ ...config, subtitle: e.target.value })} data-testid="input-hero-subtitle" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Primary Button Text</Label>
          <Input value={config.primaryButtonText} onChange={(e) => setConfig({ ...config, primaryButtonText: e.target.value })} data-testid="input-hero-primary-btn" />
        </div>
        <div className="space-y-2">
          <Label>Primary Button Link</Label>
          <Input value={config.primaryButtonLink} onChange={(e) => setConfig({ ...config, primaryButtonLink: e.target.value })} data-testid="input-hero-primary-link" />
        </div>
        <div className="space-y-2">
          <Label>Secondary Button Text</Label>
          <Input value={config.secondaryButtonText} onChange={(e) => setConfig({ ...config, secondaryButtonText: e.target.value })} data-testid="input-hero-secondary-btn" />
        </div>
        <div className="space-y-2">
          <Label>Secondary Button Link</Label>
          <Input value={config.secondaryButtonLink} onChange={(e) => setConfig({ ...config, secondaryButtonLink: e.target.value })} data-testid="input-hero-secondary-link" />
        </div>
      </div>
      <Button onClick={() => save.mutate(config)} disabled={save.isPending} data-testid="button-save-hero">
        <Save className="w-4 h-4 mr-2" /> {save.isPending ? "Saving..." : "Save Hero"}
      </Button>
    </div>
  );
}

function PromiseSection({ data }: { data: PromiseConfig }) {
  const [config, setConfig] = useState(data);
  const save = useSaveConfig("promise");
  useEffect(() => { setConfig(data); }, [data]);

  const updateCard = (index: number, field: string, value: string) => {
    const cards = [...config.cards];
    cards[index] = { ...cards[index], [field]: value };
    setConfig({ ...config, cards });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Section Label</Label>
        <Input value={config.label} onChange={(e) => setConfig({ ...config, label: e.target.value })} data-testid="input-promise-label" />
      </div>
      <div className="space-y-2">
        <Label>Heading</Label>
        <Input value={config.heading} onChange={(e) => setConfig({ ...config, heading: e.target.value })} data-testid="input-promise-heading" />
      </div>
      <div className="space-y-2">
        <Label>Subheading</Label>
        <Textarea value={config.subheading} onChange={(e) => setConfig({ ...config, subheading: e.target.value })} data-testid="input-promise-subheading" />
      </div>
      <Separator />
      <p className="text-sm font-medium text-muted-foreground">Promise Cards</p>
      {config.cards.map((card, i) => (
        <Card key={i} className="p-4 space-y-3">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={card.title} onChange={(e) => updateCard(i, "title", e.target.value)} data-testid={`input-promise-card-title-${i}`} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={card.description} onChange={(e) => updateCard(i, "description", e.target.value)} data-testid={`input-promise-card-desc-${i}`} />
          </div>
        </Card>
      ))}
      <Button onClick={() => save.mutate(config)} disabled={save.isPending} data-testid="button-save-promise">
        <Save className="w-4 h-4 mr-2" /> {save.isPending ? "Saving..." : "Save Promise Section"}
      </Button>
    </div>
  );
}

function CollectionsSection({ data }: { data: CollectionsConfig }) {
  const [config, setConfig] = useState(data);
  const save = useSaveConfig("collections");
  useEffect(() => { setConfig(data); }, [data]);

  const updateCard = (index: number, field: string, value: string) => {
    const cards = [...config.cards];
    cards[index] = { ...cards[index], [field]: value };
    setConfig({ ...config, cards });
  };

  const addCard = () => setConfig({ ...config, cards: [...config.cards, { title: "", description: "", link: "/shop", imageUrl: "" }] });
  const removeCard = (index: number) => setConfig({ ...config, cards: config.cards.filter((_, i) => i !== index) });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Section Label</Label>
          <Input value={config.label} onChange={(e) => setConfig({ ...config, label: e.target.value })} data-testid="input-collections-label" />
        </div>
        <div className="space-y-2">
          <Label>Heading</Label>
          <Input value={config.heading} onChange={(e) => setConfig({ ...config, heading: e.target.value })} data-testid="input-collections-heading" />
        </div>
      </div>
      <Separator />
      {config.cards.map((card, i) => (
        <Card key={i} className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-medium">Card {i + 1}</p>
            <Button size="icon" variant="ghost" onClick={() => removeCard(i)} data-testid={`button-remove-collection-${i}`}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          <ImageField
            label="Card Image"
            value={card.imageUrl}
            onChange={(url) => updateCard(i, "imageUrl", url)}
            testId={`input-collection-image-${i}`}
            fallbackImage={defaultCollectionImages[i]}
          />
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={card.title} onChange={(e) => updateCard(i, "title", e.target.value)} data-testid={`input-collection-title-${i}`} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={card.description} onChange={(e) => updateCard(i, "description", e.target.value)} data-testid={`input-collection-desc-${i}`} />
          </div>
          <div className="space-y-2">
            <Label>Link</Label>
            <Input value={card.link} onChange={(e) => updateCard(i, "link", e.target.value)} data-testid={`input-collection-link-${i}`} />
          </div>
        </Card>
      ))}
      <Button variant="outline" onClick={addCard} data-testid="button-add-collection">
        <Plus className="w-4 h-4 mr-2" /> Add Collection Card
      </Button>
      <div>
        <Button onClick={() => save.mutate(config)} disabled={save.isPending} data-testid="button-save-collections">
          <Save className="w-4 h-4 mr-2" /> {save.isPending ? "Saving..." : "Save Collections"}
        </Button>
      </div>
    </div>
  );
}

function ProductTypesSection({ data }: { data: ProductTypesConfig }) {
  const [config, setConfig] = useState(data);
  const save = useSaveConfig("productTypes");
  useEffect(() => { setConfig(data); }, [data]);

  const updateCard = (index: number, field: string, value: string) => {
    const cards = [...config.cards];
    cards[index] = { ...cards[index], [field]: value };
    setConfig({ ...config, cards });
  };

  const addCard = () => setConfig({ ...config, cards: [...config.cards, { title: "", description: "", link: "/shop", imageUrl: "" }] });
  const removeCard = (index: number) => setConfig({ ...config, cards: config.cards.filter((_, i) => i !== index) });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Section Label</Label>
          <Input value={config.label} onChange={(e) => setConfig({ ...config, label: e.target.value })} data-testid="input-product-types-label" />
        </div>
        <div className="space-y-2">
          <Label>Heading</Label>
          <Input value={config.heading} onChange={(e) => setConfig({ ...config, heading: e.target.value })} data-testid="input-product-types-heading" />
        </div>
      </div>
      <Separator />
      {config.cards.map((card, i) => (
        <Card key={i} className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-medium">Card {i + 1}</p>
            <Button size="icon" variant="ghost" onClick={() => removeCard(i)} data-testid={`button-remove-product-type-${i}`}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          <ImageField
            label="Card Image"
            value={card.imageUrl}
            onChange={(url) => updateCard(i, "imageUrl", url)}
            testId={`input-product-type-image-${i}`}
            fallbackImage={defaultProductTypeImages[i]}
          />
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={card.title} onChange={(e) => updateCard(i, "title", e.target.value)} data-testid={`input-product-type-title-${i}`} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={card.description} onChange={(e) => updateCard(i, "description", e.target.value)} data-testid={`input-product-type-desc-${i}`} />
          </div>
          <div className="space-y-2">
            <Label>Link</Label>
            <Input value={card.link} onChange={(e) => updateCard(i, "link", e.target.value)} data-testid={`input-product-type-link-${i}`} />
          </div>
        </Card>
      ))}
      <Button variant="outline" onClick={addCard} data-testid="button-add-product-type">
        <Plus className="w-4 h-4 mr-2" /> Add Product Type
      </Button>
      <div>
        <Button onClick={() => save.mutate(config)} disabled={save.isPending} data-testid="button-save-product-types">
          <Save className="w-4 h-4 mr-2" /> {save.isPending ? "Saving..." : "Save Product Types"}
        </Button>
      </div>
    </div>
  );
}

function PromoSection({ data }: { data: PromoConfig }) {
  const [config, setConfig] = useState(data);
  const save = useSaveConfig("promo");
  useEffect(() => { setConfig(data); }, [data]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Title</Label>
        <Input value={config.title} onChange={(e) => setConfig({ ...config, title: e.target.value })} data-testid="input-promo-title" />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea value={config.description} onChange={(e) => setConfig({ ...config, description: e.target.value })} data-testid="input-promo-desc" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Button Text</Label>
          <Input value={config.buttonText} onChange={(e) => setConfig({ ...config, buttonText: e.target.value })} data-testid="input-promo-btn-text" />
        </div>
        <div className="space-y-2">
          <Label>Button Link</Label>
          <Input value={config.buttonLink} onChange={(e) => setConfig({ ...config, buttonLink: e.target.value })} data-testid="input-promo-btn-link" />
        </div>
      </div>
      <Button onClick={() => save.mutate(config)} disabled={save.isPending} data-testid="button-save-promo">
        <Save className="w-4 h-4 mr-2" /> {save.isPending ? "Saving..." : "Save Promo"}
      </Button>
    </div>
  );
}

function TestimonialsSection({ data }: { data: TestimonialsConfig }) {
  const [config, setConfig] = useState(data);
  const save = useSaveConfig("testimonials");
  useEffect(() => { setConfig(data); }, [data]);

  const updateItem = (index: number, field: string, value: string | number) => {
    const items = [...config.items];
    items[index] = { ...items[index], [field]: value };
    setConfig({ ...config, items });
  };

  const addItem = () => setConfig({ ...config, items: [...config.items, { name: "", location: "", text: "", rating: 5 }] });
  const removeItem = (index: number) => setConfig({ ...config, items: config.items.filter((_, i) => i !== index) });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Section Label</Label>
          <Input value={config.label} onChange={(e) => setConfig({ ...config, label: e.target.value })} data-testid="input-testimonials-label" />
        </div>
        <div className="space-y-2">
          <Label>Heading</Label>
          <Input value={config.heading} onChange={(e) => setConfig({ ...config, heading: e.target.value })} data-testid="input-testimonials-heading" />
        </div>
      </div>
      <Separator />
      {config.items.map((item, i) => (
        <Card key={i} className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-medium">Testimonial {i + 1}</p>
            <Button size="icon" variant="ghost" onClick={() => removeItem(i)} data-testid={`button-remove-testimonial-${i}`}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={item.name} onChange={(e) => updateItem(i, "name", e.target.value)} data-testid={`input-testimonial-name-${i}`} />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input value={item.location} onChange={(e) => updateItem(i, "location", e.target.value)} data-testid={`input-testimonial-location-${i}`} />
            </div>
            <div className="space-y-2">
              <Label>Rating (1-5)</Label>
              <Input type="number" min={1} max={5} value={item.rating} onChange={(e) => updateItem(i, "rating", parseInt(e.target.value) || 5)} data-testid={`input-testimonial-rating-${i}`} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Review Text</Label>
            <Textarea value={item.text} onChange={(e) => updateItem(i, "text", e.target.value)} data-testid={`input-testimonial-text-${i}`} />
          </div>
        </Card>
      ))}
      <Button variant="outline" onClick={addItem} data-testid="button-add-testimonial">
        <Plus className="w-4 h-4 mr-2" /> Add Testimonial
      </Button>
      <div>
        <Button onClick={() => save.mutate(config)} disabled={save.isPending} data-testid="button-save-testimonials">
          <Save className="w-4 h-4 mr-2" /> {save.isPending ? "Saving..." : "Save Testimonials"}
        </Button>
      </div>
    </div>
  );
}

function StatsSection({ data }: { data: StatsConfig }) {
  const [config, setConfig] = useState(data);
  const save = useSaveConfig("stats");
  useEffect(() => { setConfig(data); }, [data]);

  const updateItem = (index: number, field: string, value: string) => {
    const items = [...config.items];
    items[index] = { ...items[index], [field]: value };
    setConfig({ ...config, items });
  };

  const addItem = () => setConfig({ ...config, items: [...config.items, { value: "", label: "" }] });
  const removeItem = (index: number) => setConfig({ ...config, items: config.items.filter((_, i) => i !== index) });

  return (
    <div className="space-y-4">
      {config.items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={item.value}
            onChange={(e) => updateItem(i, "value", e.target.value)}
            placeholder="Value (e.g. 58+)"
            className="flex-1"
            data-testid={`input-stat-value-${i}`}
          />
          <Input
            value={item.label}
            onChange={(e) => updateItem(i, "label", e.target.value)}
            placeholder="Label (e.g. Products)"
            className="flex-1"
            data-testid={`input-stat-label-${i}`}
          />
          <Button size="icon" variant="ghost" onClick={() => removeItem(i)} data-testid={`button-remove-stat-${i}`}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" onClick={addItem} data-testid="button-add-stat">
        <Plus className="w-4 h-4 mr-2" /> Add Stat
      </Button>
      <div>
        <Button onClick={() => save.mutate(config)} disabled={save.isPending} data-testid="button-save-stats">
          <Save className="w-4 h-4 mr-2" /> {save.isPending ? "Saving..." : "Save Stats"}
        </Button>
      </div>
    </div>
  );
}

function FooterSection({ data }: { data: FooterConfig }) {
  const [config, setConfig] = useState(data);
  const save = useSaveConfig("footer");
  useEffect(() => { setConfig(data); }, [data]);

  const updateLink = (index: number, field: string, value: string) => {
    const links = [...config.shopLinks];
    links[index] = { ...links[index], [field]: value };
    setConfig({ ...config, shopLinks: links });
  };

  const addLink = () => setConfig({ ...config, shopLinks: [...config.shopLinks, { label: "", href: "/shop" }] });
  const removeLink = (index: number) => setConfig({ ...config, shopLinks: config.shopLinks.filter((_, i) => i !== index) });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Brand Name</Label>
        <Input value={config.brandName} onChange={(e) => setConfig({ ...config, brandName: e.target.value })} data-testid="input-footer-brand" />
      </div>
      <div className="space-y-2">
        <Label>Brand Story</Label>
        <Textarea value={config.brandStory} onChange={(e) => setConfig({ ...config, brandStory: e.target.value })} data-testid="input-footer-story" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>WhatsApp URL</Label>
          <Input value={config.whatsappUrl} onChange={(e) => setConfig({ ...config, whatsappUrl: e.target.value })} data-testid="input-footer-whatsapp" />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={config.email} onChange={(e) => setConfig({ ...config, email: e.target.value })} data-testid="input-footer-email" />
        </div>
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input value={config.phone} onChange={(e) => setConfig({ ...config, phone: e.target.value })} data-testid="input-footer-phone" />
        </div>
        <div className="space-y-2">
          <Label>Address</Label>
          <Input value={config.address} onChange={(e) => setConfig({ ...config, address: e.target.value })} data-testid="input-footer-address" />
        </div>
      </div>
      <Separator />
      <p className="text-sm font-medium text-muted-foreground">Shop Links</p>
      {config.shopLinks.map((link, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={link.label}
            onChange={(e) => updateLink(i, "label", e.target.value)}
            placeholder="Label"
            className="flex-1"
            data-testid={`input-footer-link-label-${i}`}
          />
          <Input
            value={link.href}
            onChange={(e) => updateLink(i, "href", e.target.value)}
            placeholder="URL"
            className="flex-1"
            data-testid={`input-footer-link-href-${i}`}
          />
          <Button size="icon" variant="ghost" onClick={() => removeLink(i)} data-testid={`button-remove-footer-link-${i}`}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" onClick={addLink} data-testid="button-add-footer-link">
        <Plus className="w-4 h-4 mr-2" /> Add Link
      </Button>
      <div>
        <Button onClick={() => save.mutate(config)} disabled={save.isPending} data-testid="button-save-footer">
          <Save className="w-4 h-4 mr-2" /> {save.isPending ? "Saving..." : "Save Footer"}
        </Button>
      </div>
    </div>
  );
}

function FeaturedSectionsEditor({ data }: { data: FeaturedSectionsConfig }) {
  const [config, setConfig] = useState(data);
  const save = useSaveConfig("featuredSections");
  useEffect(() => { setConfig(data); }, [data]);

  const updateSection = (section: "kids" | "couples" | "blankets", field: string, value: string) => {
    setConfig({ ...config, [section]: { ...config[section], [field]: value } });
  };

  return (
    <div className="space-y-4">
      {(["kids", "couples", "blankets"] as const).map((section) => (
        <Card key={section} className="p-4 space-y-3">
          <p className="text-sm font-medium capitalize">{section} Section</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={config[section].title} onChange={(e) => updateSection(section, "title", e.target.value)} data-testid={`input-featured-${section}-title`} />
            </div>
            <div className="space-y-2">
              <Label>Subtitle</Label>
              <Input value={config[section].subtitle} onChange={(e) => updateSection(section, "subtitle", e.target.value)} data-testid={`input-featured-${section}-subtitle`} />
            </div>
            <div className="space-y-2">
              <Label>Link</Label>
              <Input value={config[section].link} onChange={(e) => updateSection(section, "link", e.target.value)} data-testid={`input-featured-${section}-link`} />
            </div>
          </div>
        </Card>
      ))}
      <Button onClick={() => save.mutate(config)} disabled={save.isPending} data-testid="button-save-featured">
        <Save className="w-4 h-4 mr-2" /> {save.isPending ? "Saving..." : "Save Featured Sections"}
      </Button>
    </div>
  );
}

export default function AdminBuilder() {
  const { data: allConfig, isLoading } = useQuery<Record<string, any>>({
    queryKey: ["/api/site-config"],
  });

  const getConfig = <T,>(key: string, defaultVal: T): T => {
    if (allConfig && allConfig[key]) return { ...defaultVal, ...allConfig[key] } as T;
    return defaultVal;
  };

  return (
    <div className="pb-20 md:pb-0">
      <div className="bg-muted/50 border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back-home">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2" data-testid="text-builder-title">
                <Settings className="w-5 h-5" /> Site Builder
              </h1>
              <p className="text-sm text-muted-foreground">Configure your homepage content, header, and footer</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading configuration...</div>
        ) : (
          <Accordion type="multiple" defaultValue={["header"]} className="space-y-2">
            <AccordionItem value="header" className="border rounded-md px-4">
              <AccordionTrigger data-testid="accordion-header">
                <SectionHeader icon={LayoutDashboard} title="Header" />
              </AccordionTrigger>
              <AccordionContent>
                <HeaderSection data={getConfig("header", defaultHeader)} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="announcement" className="border rounded-md px-4">
              <AccordionTrigger data-testid="accordion-announcement">
                <SectionHeader icon={Megaphone} title="Announcement Bar" />
              </AccordionTrigger>
              <AccordionContent>
                <AnnouncementSection data={getConfig("announcement", defaultAnnouncement)} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="hero" className="border rounded-md px-4">
              <AccordionTrigger data-testid="accordion-hero">
                <SectionHeader icon={LayoutDashboard} title="Hero Banner" />
              </AccordionTrigger>
              <AccordionContent>
                <HeroSection data={getConfig("hero", defaultHero)} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="promise" className="border rounded-md px-4">
              <AccordionTrigger data-testid="accordion-promise">
                <SectionHeader icon={Heart} title="Brand Promise" />
              </AccordionTrigger>
              <AccordionContent>
                <PromiseSection data={getConfig("promise", defaultPromise)} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="collections" className="border rounded-md px-4">
              <AccordionTrigger data-testid="accordion-collections">
                <SectionHeader icon={Grid3X3} title="Shop by Collection" />
              </AccordionTrigger>
              <AccordionContent>
                <CollectionsSection data={getConfig("collections", defaultCollections)} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="productTypes" className="border rounded-md px-4">
              <AccordionTrigger data-testid="accordion-product-types">
                <SectionHeader icon={Package} title="Shop by Product" />
              </AccordionTrigger>
              <AccordionContent>
                <ProductTypesSection data={getConfig("productTypes", defaultProductTypes)} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="featured" className="border rounded-md px-4">
              <AccordionTrigger data-testid="accordion-featured">
                <SectionHeader icon={Grid3X3} title="Featured Product Sections" />
              </AccordionTrigger>
              <AccordionContent>
                <FeaturedSectionsEditor data={getConfig("featuredSections", defaultFeaturedSections)} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="promo" className="border rounded-md px-4">
              <AccordionTrigger data-testid="accordion-promo">
                <SectionHeader icon={Gift} title="Promo Banner" />
              </AccordionTrigger>
              <AccordionContent>
                <PromoSection data={getConfig("promo", defaultPromo)} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="testimonials" className="border rounded-md px-4">
              <AccordionTrigger data-testid="accordion-testimonials">
                <SectionHeader icon={MessageSquare} title="Testimonials" />
              </AccordionTrigger>
              <AccordionContent>
                <TestimonialsSection data={getConfig("testimonials", defaultTestimonials)} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="stats" className="border rounded-md px-4">
              <AccordionTrigger data-testid="accordion-stats">
                <SectionHeader icon={BarChart3} title="Stats Bar" />
              </AccordionTrigger>
              <AccordionContent>
                <StatsSection data={getConfig("stats", defaultStats)} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="footer" className="border rounded-md px-4">
              <AccordionTrigger data-testid="accordion-footer">
                <SectionHeader icon={FileText} title="Footer" />
              </AccordionTrigger>
              <AccordionContent>
                <FooterSection data={getConfig("footer", defaultFooter)} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </div>
    </div>
  );
}
