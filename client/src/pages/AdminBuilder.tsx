import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
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
  RotateCcw, ChevronUp, ChevronDown, ChevronLeft, History, Upload, Loader2, LogOut, Smartphone, Globe,
} from "lucide-react";
import { Link } from "wouter";
import {
  defaultAnnouncement, defaultHero, defaultHeader, defaultPromise,
  defaultCollections, defaultProductTypes, defaultPromo, defaultTestimonials,
  defaultStats, defaultFooter, defaultFeaturedSections, defaultHomepageCollections,
  defaultPwaInstall, defaultSeo, defaultShopSections,
  type AnnouncementConfig, type HeroConfig, type HeaderConfig,
  type PromiseConfig, type CollectionsConfig, type ProductTypesConfig,
  type PromoConfig, type TestimonialsConfig, type StatsConfig,
  type FooterConfig, type FeaturedSectionsConfig,
  type HomepageCollectionsConfig, type HomepageCollectionSection,
  type PwaInstallConfig, type SeoConfig, type ShopSection,
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
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const displaySrc = value || fallbackImage;

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      onChange(data.url);
    } catch (err) {
      const toast = document.createElement("div");
      toast.textContent = "Image upload failed. Please try again.";
      toast.className = "fixed bottom-4 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground px-4 py-2 rounded-md text-sm z-50";
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        data-testid={`${testId}-file`}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
          e.target.value = "";
        }}
      />
      <div
        className="relative rounded-md overflow-hidden border bg-muted/30 cursor-pointer group"
        onClick={() => fileInputRef.current?.click()}
        data-testid={`${testId}-upload-area`}
      >
        {displaySrc ? (
          <img
            src={displaySrc}
            alt={label}
            className="w-full max-h-40 object-contain"
            data-testid={`${testId}-preview`}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="flex items-center justify-center h-32 bg-muted/20" data-testid={`${testId}-empty`}>
            <div className="text-center text-muted-foreground">
              <Upload className="w-8 h-8 mx-auto mb-1 opacity-30" />
              <p className="text-xs opacity-60">Click to upload image</p>
            </div>
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
          {uploading ? (
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          ) : (
            <div className="text-center text-white">
              <Upload className="w-6 h-6 mx-auto mb-1" />
              <p className="text-xs font-medium">Click to upload</p>
            </div>
          )}
        </div>
        {!value && displaySrc && (
          <div className="absolute bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm px-3 py-1.5">
            <p className="text-xs text-muted-foreground">Current default image</p>
          </div>
        )}
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Or paste image URL"
        data-testid={testId}
      />
    </div>
  );
}

function SeoSection({ data }: { data: SeoConfig }) {
  const [config, setConfig] = useState(data);
  const save = useSaveConfig("seo");
  useEffect(() => { setConfig(data); }, [data]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Brand Name</Label>
          <Input
            value={config.brandName}
            onChange={(e) => setConfig({ ...config, brandName: e.target.value })}
            placeholder="TurtleLittle"
            data-testid="input-seo-brand-name"
          />
        </div>
        <div className="space-y-2">
          <Label>Tagline</Label>
          <Input
            value={config.tagline}
            onChange={(e) => setConfig({ ...config, tagline: e.target.value })}
            placeholder="Personalised Luxury Towels & Blankets"
            data-testid="input-seo-tagline"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Site URL</Label>
        <Input
          value={config.siteUrl}
          onChange={(e) => setConfig({ ...config, siteUrl: e.target.value })}
          placeholder="https://turtlelittle.com"
          data-testid="input-seo-site-url"
        />
      </div>
      <div className="space-y-2">
        <Label>Default Meta Description</Label>
        <Textarea
          value={config.metaDescription}
          onChange={(e) => setConfig({ ...config, metaDescription: e.target.value })}
          placeholder="Short description shown in Google search results and social previews"
          rows={3}
          data-testid="input-seo-meta-description"
        />
        <p className="text-xs text-muted-foreground">{config.metaDescription.length}/160 chars — Google typically shows up to 160</p>
      </div>
      <div className="space-y-2">
        <Label>Share Image (OG Image)</Label>
        <p className="text-xs text-muted-foreground">
          This image appears when someone shares your site link on WhatsApp, Twitter, LinkedIn, iMessage, etc.
          Recommended size: <strong>1200 × 630 px</strong> (landscape).
        </p>
        <ImageField
          label="Share Image"
          value={config.ogImageUrl}
          onChange={(url) => setConfig({ ...config, ogImageUrl: url })}
          testId="seo-og-image"
        />
      </div>
      <Button onClick={() => save.mutate(config)} disabled={save.isPending} data-testid="button-save-seo">
        <Save className="w-4 h-4 mr-2" /> {save.isPending ? "Saving..." : "Save Site Identity"}
      </Button>
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

function DynamicCollectionsSection({ data }: { data: HomepageCollectionsConfig }) {
  const [config, setConfig] = useState(data);
  const save = useSaveConfig("homepageCollections");
  useEffect(() => { setConfig(data); }, [data]);

  const generateId = () => `section_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const updateSection = (sectionIndex: number, field: string, value: string) => {
    const sections = [...config.sections];
    sections[sectionIndex] = { ...sections[sectionIndex], [field]: value };
    setConfig({ ...config, sections });
  };

  const updateCard = (sectionIndex: number, cardIndex: number, field: string, value: string) => {
    const sections = [...config.sections];
    const cards = [...sections[sectionIndex].cards];
    cards[cardIndex] = { ...cards[cardIndex], [field]: value };
    sections[sectionIndex] = { ...sections[sectionIndex], cards };
    setConfig({ ...config, sections });
  };

  const addCard = (sectionIndex: number) => {
    const sections = [...config.sections];
    sections[sectionIndex] = {
      ...sections[sectionIndex],
      cards: [...sections[sectionIndex].cards, { title: "", description: "", link: "/shop", imageUrl: "" }],
    };
    setConfig({ ...config, sections });
  };

  const removeCard = (sectionIndex: number, cardIndex: number) => {
    const sections = [...config.sections];
    sections[sectionIndex] = {
      ...sections[sectionIndex],
      cards: sections[sectionIndex].cards.filter((_, i) => i !== cardIndex),
    };
    setConfig({ ...config, sections });
  };

  const addSection = () => {
    setConfig({
      ...config,
      sections: [
        ...config.sections,
        { id: generateId(), label: "", heading: "New Collection", cards: [] },
      ],
    });
  };

  const removeSection = (index: number) => {
    const removed = config.sections[index];
    const deletedHistory = [removed, ...config.deletedHistory].slice(0, 3);
    setConfig({
      ...config,
      sections: config.sections.filter((_, i) => i !== index),
      deletedHistory,
    });
  };

  const restoreSection = (historyIndex: number) => {
    const restored = config.deletedHistory[historyIndex];
    setConfig({
      ...config,
      sections: [...config.sections, { ...restored, id: generateId() }],
      deletedHistory: config.deletedHistory.filter((_, i) => i !== historyIndex),
    });
  };

  const moveSection = (index: number, direction: "up" | "down") => {
    const sections = [...config.sections];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= sections.length) return;
    [sections[index], sections[swapIndex]] = [sections[swapIndex], sections[index]];
    setConfig({ ...config, sections });
  };

  return (
    <div className="space-y-4">
      {config.sections.map((section, si) => (
        <Card key={section.id} className="p-4 space-y-4" data-testid={`card-section-${si}`}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="font-semibold text-sm">{section.heading || `Section ${si + 1}`}</h3>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" onClick={() => moveSection(si, "up")} disabled={si === 0} data-testid={`button-move-section-up-${si}`}>
                <ChevronUp className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => moveSection(si, "down")} disabled={si === config.sections.length - 1} data-testid={`button-move-section-down-${si}`}>
                <ChevronDown className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => removeSection(si)} data-testid={`button-remove-section-${si}`}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Section Label</Label>
              <Input value={section.label} onChange={(e) => updateSection(si, "label", e.target.value)} data-testid={`input-section-label-${si}`} />
            </div>
            <div className="space-y-2">
              <Label>Section Heading</Label>
              <Input value={section.heading} onChange={(e) => updateSection(si, "heading", e.target.value)} data-testid={`input-section-heading-${si}`} />
            </div>
          </div>
          <Separator />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cards ({section.cards.length})</p>
          {section.cards.map((card, ci) => (
            <Card key={ci} className="p-3 space-y-3 bg-muted/30 border-dashed">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm text-muted-foreground">Card {ci + 1}</p>
                <Button size="icon" variant="ghost" onClick={() => removeCard(si, ci)} data-testid={`button-remove-card-${si}-${ci}`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <ImageField
                label="Card Image"
                value={card.imageUrl}
                onChange={(url) => updateCard(si, ci, "imageUrl", url)}
                testId={`input-card-image-${si}-${ci}`}
                fallbackImage={si === 0 ? defaultCollectionImages[ci] : si === 1 ? defaultProductTypeImages[ci] : undefined}
              />
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={card.title} onChange={(e) => updateCard(si, ci, "title", e.target.value)} data-testid={`input-card-title-${si}-${ci}`} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={card.description} onChange={(e) => updateCard(si, ci, "description", e.target.value)} data-testid={`input-card-desc-${si}-${ci}`} />
              </div>
              <div className="space-y-2">
                <Label>Link</Label>
                <Input value={card.link} onChange={(e) => updateCard(si, ci, "link", e.target.value)} data-testid={`input-card-link-${si}-${ci}`} />
              </div>
            </Card>
          ))}
          <Button variant="outline" size="sm" onClick={() => addCard(si)} data-testid={`button-add-card-${si}`}>
            <Plus className="w-4 h-4 mr-2" /> Add Card
          </Button>
        </Card>
      ))}

      <Button variant="outline" onClick={addSection} data-testid="button-add-section">
        <Plus className="w-4 h-4 mr-2" /> Add New Collection Section
      </Button>

      {config.deletedHistory.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">Recently Deleted ({config.deletedHistory.length})</p>
          </div>
          {config.deletedHistory.map((section, hi) => (
            <Card key={hi} className="p-3 bg-muted/20 border-dashed" data-testid={`card-deleted-section-${hi}`}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <p className="text-sm font-medium">{section.heading}</p>
                  <p className="text-xs text-muted-foreground">{section.cards.length} card{section.cards.length !== 1 ? "s" : ""}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => restoreSection(hi)} data-testid={`button-restore-section-${hi}`}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Restore
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div>
        <Button onClick={() => save.mutate(config)} disabled={save.isPending} data-testid="button-save-homepage-collections">
          <Save className="w-4 h-4 mr-2" /> {save.isPending ? "Saving..." : "Save All Collections"}
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

  const updateSection = (section: "kids" | "couples" | "blankets" | "bathrobes", field: string, value: string) => {
    setConfig({ ...config, [section]: { ...config[section], [field]: value } });
  };

  return (
    <div className="space-y-4">
      {(["kids", "couples", "blankets", "bathrobes"] as const).map((section) => {
        const sectionData = config[section] || { title: "", subtitle: "", link: "" };
        return (
          <Card key={section} className="p-4 space-y-3">
            <p className="text-sm font-medium capitalize">{section} Section</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={sectionData.title} onChange={(e) => updateSection(section, "title", e.target.value)} data-testid={`input-featured-${section}-title`} />
              </div>
              <div className="space-y-2">
                <Label>Subtitle</Label>
                <Input value={sectionData.subtitle} onChange={(e) => updateSection(section, "subtitle", e.target.value)} data-testid={`input-featured-${section}-subtitle`} />
              </div>
              <div className="space-y-2">
                <Label>Link</Label>
                <Input value={sectionData.link} onChange={(e) => updateSection(section, "link", e.target.value)} data-testid={`input-featured-${section}-link`} />
              </div>
            </div>
          </Card>
        );
      })}
      <Button onClick={() => save.mutate(config)} disabled={save.isPending} data-testid="button-save-featured">
        <Save className="w-4 h-4 mr-2" /> {save.isPending ? "Saving..." : "Save Featured Sections"}
      </Button>
    </div>
  );
}

function InstallBannerSection({ data }: { data: PwaInstallConfig }) {
  const [config, setConfig] = useState(data);
  const save = useSaveConfig("pwa-install-banner");
  useEffect(() => { setConfig(data); }, [data]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Banner Text</Label>
        <Input
          value={config.text}
          onChange={(e) => setConfig({ ...config, text: e.target.value })}
          placeholder="Add to your home screen for the best experience"
          data-testid="input-pwa-text"
        />
        <p className="text-xs text-muted-foreground">The short description shown in the banner on mobile devices.</p>
      </div>
      <div className="space-y-2">
        <Label>Button Label</Label>
        <Input
          value={config.buttonText}
          onChange={(e) => setConfig({ ...config, buttonText: e.target.value })}
          placeholder="Get the App"
          data-testid="input-pwa-button-text"
        />
        <p className="text-xs text-muted-foreground">The CTA button text on the mobile banner and in the desktop header.</p>
      </div>
      <div className="space-y-2">
        <Label>Custom Install URL <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <Input
          value={config.customUrl}
          onChange={(e) => setConfig({ ...config, customUrl: e.target.value })}
          placeholder="https://play.google.com/store/apps/..."
          data-testid="input-pwa-custom-url"
        />
        <p className="text-xs text-muted-foreground">
          If set, the button opens this URL (e.g. Play Store, App Store, or a "how to install" page). Also makes the banner visible on iOS.
          Leave empty to use the browser's native install prompt on Android/Chrome.
        </p>
      </div>
      <Button onClick={() => save.mutate(config)} disabled={save.isPending} data-testid="button-save-pwa-banner">
        <Save className="w-4 h-4 mr-2" /> {save.isPending ? "Saving..." : "Save Install Banner"}
      </Button>
    </div>
  );
}

function ShopSectionsEditor({ data }: { data: ShopSection[] }) {
  const [sections, setSections] = useState<ShopSection[]>(data);
  const save = useSaveConfig("shop-sections");

  const move = (index: number, dir: "up" | "down") => {
    const next = [...sections];
    const swap = dir === "up" ? index - 1 : index + 1;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    setSections(next);
  };

  const update = (index: number, field: keyof ShopSection, value: string | number | boolean) => {
    const next = [...sections];
    next[index] = { ...next[index], [field]: value };
    setSections(next);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Control which tag-based sections appear on the Shop page, in what order, and how many products each shows.
      </p>
      {sections.map((s, i) => (
        <Card key={i} className="p-4 space-y-3" data-testid={`card-shop-section-${i}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Switch
                checked={s.enabled}
                onCheckedChange={(v) => update(i, "enabled", v)}
                data-testid={`switch-shop-section-enabled-${i}`}
              />
              <span className="text-sm font-medium">{s.label || `Section ${i + 1}`}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" onClick={() => move(i, "up")} disabled={i === 0} data-testid={`button-shop-section-up-${i}`}>
                <ChevronUp className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => move(i, "down")} disabled={i === sections.length - 1} data-testid={`button-shop-section-down-${i}`}>
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Display Label</Label>
              <Input
                value={s.label}
                onChange={(e) => update(i, "label", e.target.value)}
                placeholder="e.g. Kids Towels"
                data-testid={`input-shop-section-label-${i}`}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tag (read-only)</Label>
              <Input value={s.tag} readOnly className="bg-muted/40 text-muted-foreground cursor-not-allowed" data-testid={`input-shop-section-tag-${i}`} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Max Products Shown</Label>
              <Input
                type="number"
                min={1}
                max={24}
                value={s.maxShown}
                onChange={(e) => update(i, "maxShown", Math.max(1, parseInt(e.target.value) || 1))}
                data-testid={`input-shop-section-max-${i}`}
              />
            </div>
          </div>
        </Card>
      ))}
      <Button onClick={() => save.mutate(sections)} disabled={save.isPending} data-testid="button-save-shop-sections">
        <Save className="w-4 h-4 mr-2" /> {save.isPending ? "Saving..." : "Save Shop Sections"}
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

  const getShopSections = (): ShopSection[] => {
    const raw = allConfig?.["shop-sections"];
    if (Array.isArray(raw) && raw.length > 0) return raw as ShopSection[];
    return defaultShopSections;
  };

  const getHomepageCollections = (): HomepageCollectionsConfig => {
    if (allConfig && allConfig["homepageCollections"]) {
      return { ...defaultHomepageCollections, ...allConfig["homepageCollections"] } as HomepageCollectionsConfig;
    }
    const sections: HomepageCollectionSection[] = [];
    const savedCollections = allConfig?.["collections"];
    const savedProductTypes = allConfig?.["productTypes"];
    if (savedCollections) {
      sections.push({ id: "collections", label: savedCollections.label || "Collections", heading: savedCollections.heading || "Shop by Collection", cards: savedCollections.cards || [] });
    } else {
      sections.push(defaultHomepageCollections.sections[0]);
    }
    if (savedProductTypes) {
      sections.push({ id: "productTypes", label: savedProductTypes.label || "Products", heading: savedProductTypes.heading || "Shop by Product", cards: savedProductTypes.cards || [] });
    } else {
      sections.push(defaultHomepageCollections.sections[1]);
    }
    return { sections, deletedHistory: [] };
  };

  return (
    <div className="pb-20 md:pb-0">
      <div className="bg-muted/50 border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
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
            <div className="flex gap-2 flex-wrap">
              <Link href="/admin">
                <Button variant="ghost" size="sm" data-testid="link-dashboard">
                  <ChevronLeft className="w-4 h-4 mr-1" /> Dashboard
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await fetch("/api/admin/logout", { method: "POST" });
                  queryClient.invalidateQueries({ queryKey: ["/api/admin/check"] });
                }}
                data-testid="button-logout"
              >
                <LogOut className="w-4 h-4 mr-1" /> Logout
              </Button>
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

            <AccordionItem value="seo" className="border rounded-md px-4">
              <AccordionTrigger data-testid="accordion-seo">
                <SectionHeader icon={Globe} title="Site Identity & SEO" />
              </AccordionTrigger>
              <AccordionContent>
                <SeoSection data={getConfig("seo", defaultSeo)} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="pwa-install-banner" className="border rounded-md px-4">
              <AccordionTrigger data-testid="accordion-pwa-install-banner">
                <SectionHeader icon={Smartphone} title="Install Banner" />
              </AccordionTrigger>
              <AccordionContent>
                <InstallBannerSection data={getConfig("pwa-install-banner", defaultPwaInstall)} />
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

            <AccordionItem value="homepageCollections" className="border rounded-md px-4">
              <AccordionTrigger data-testid="accordion-collections">
                <SectionHeader icon={Grid3X3} title="Homepage Collections" />
              </AccordionTrigger>
              <AccordionContent>
                <DynamicCollectionsSection data={getHomepageCollections()} />
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

            <AccordionItem value="shopSections" className="border rounded-md px-4">
              <AccordionTrigger data-testid="accordion-shop-sections">
                <SectionHeader icon={Package} title="Shop Page Sections" />
              </AccordionTrigger>
              <AccordionContent>
                <ShopSectionsEditor data={getShopSections()} />
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
