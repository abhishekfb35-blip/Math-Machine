import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Save, Plus, Trash2, ArrowLeft, FileText, Info, Shield, RefreshCcw, Truck, LogOut,
} from "lucide-react";
import { Link } from "wouter";
import {
  defaultAboutPage, defaultTermsPage, defaultPrivacyPage, defaultRefundPage, defaultShippingPage,
  type AboutPageConfig, type TermsPageConfig, type PrivacyPageConfig, type RefundPageConfig, type ShippingPageConfig,
  type PageSection,
} from "@/lib/siteConfigDefaults";

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
      <Icon className="w-4 h-4 text-primary" />
      <span className="font-medium">{title}</span>
    </div>
  );
}

function SectionsEditor({ sections, onChange }: { sections: PageSection[]; onChange: (s: PageSection[]) => void }) {
  const updateSection = (idx: number, field: keyof PageSection, value: string) => {
    const updated = [...sections];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange(updated);
  };

  const addSection = () => {
    onChange([...sections, { heading: "New Section", body: "" }]);
  };

  const removeSection = (idx: number) => {
    onChange(sections.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4">
      {sections.map((section, idx) => (
        <div key={idx} className="border rounded-md p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Section {idx + 1}</span>
            <Button variant="ghost" size="sm" onClick={() => removeSection(idx)} data-testid={`button-remove-section-${idx}`}>
              <Trash2 className="w-3.5 h-3.5 text-destructive" />
            </Button>
          </div>
          <div className="space-y-2">
            <Label>Heading</Label>
            <Input
              value={section.heading}
              onChange={(e) => updateSection(idx, "heading", e.target.value)}
              data-testid={`input-section-heading-${idx}`}
            />
          </div>
          <div className="space-y-2">
            <Label>Body</Label>
            <Textarea
              value={section.body}
              onChange={(e) => updateSection(idx, "body", e.target.value)}
              rows={5}
              className="font-mono text-xs"
              data-testid={`input-section-body-${idx}`}
            />
            <p className="text-xs text-muted-foreground">Use bullet points with "•" and numbered lists with "1." for formatting.</p>
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addSection} data-testid="button-add-section">
        <Plus className="w-3.5 h-3.5 mr-1" /> Add Section
      </Button>
    </div>
  );
}

function AboutSection({ data }: { data: AboutPageConfig }) {
  const [config, setConfig] = useState(data);
  const save = useSaveConfig("page-about");
  useEffect(() => { setConfig(data); }, [data]);

  const updateCard = (idx: number, field: "title" | "description", value: string) => {
    const cards = [...config.valueCards];
    cards[idx] = { ...cards[idx], [field]: value };
    setConfig({ ...config, valueCards: cards });
  };

  const addCard = () => {
    setConfig({ ...config, valueCards: [...config.valueCards, { title: "New Value", description: "" }] });
  };

  const removeCard = (idx: number) => {
    setConfig({ ...config, valueCards: config.valueCards.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Page Title</Label>
        <Input value={config.title} onChange={(e) => setConfig({ ...config, title: e.target.value })} data-testid="input-about-title" />
      </div>
      <div className="space-y-2">
        <Label>Introduction Paragraph</Label>
        <Textarea value={config.intro} onChange={(e) => setConfig({ ...config, intro: e.target.value })} rows={4} data-testid="input-about-intro" />
      </div>

      <div>
        <Label className="mb-3 block">Content Sections</Label>
        <SectionsEditor sections={config.sections} onChange={(s) => setConfig({ ...config, sections: s })} />
      </div>

      <div>
        <Label className="mb-3 block">Value Cards</Label>
        <div className="space-y-3">
          {config.valueCards.map((card, idx) => (
            <div key={idx} className="border rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Card {idx + 1}</span>
                <Button variant="ghost" size="sm" onClick={() => removeCard(idx)} data-testid={`button-remove-card-${idx}`}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
              <Input placeholder="Title" value={card.title} onChange={(e) => updateCard(idx, "title", e.target.value)} data-testid={`input-card-title-${idx}`} />
              <Textarea placeholder="Description" value={card.description} onChange={(e) => updateCard(idx, "description", e.target.value)} rows={2} data-testid={`input-card-desc-${idx}`} />
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addCard} data-testid="button-add-card">
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Card
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label>WhatsApp</Label>
          <Input value={config.contactWhatsapp} onChange={(e) => setConfig({ ...config, contactWhatsapp: e.target.value })} data-testid="input-about-whatsapp" />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={config.contactEmail} onChange={(e) => setConfig({ ...config, contactEmail: e.target.value })} data-testid="input-about-email" />
        </div>
        <div className="space-y-2">
          <Label>Location</Label>
          <Input value={config.contactLocation} onChange={(e) => setConfig({ ...config, contactLocation: e.target.value })} data-testid="input-about-location" />
        </div>
      </div>

      <Button onClick={() => save.mutate(config)} disabled={save.isPending} data-testid="button-save-about">
        <Save className="w-4 h-4 mr-2" /> {save.isPending ? "Saving..." : "Save About Page"}
      </Button>
    </div>
  );
}

function PolicySection({ configKey, label, data, defaultData }: { configKey: string; label: string; data: TermsPageConfig | PrivacyPageConfig | RefundPageConfig | ShippingPageConfig; defaultData: any }) {
  const [config, setConfig] = useState(data);
  const save = useSaveConfig(configKey);
  useEffect(() => { setConfig(data); }, [data]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Page Title</Label>
        <Input value={config.title} onChange={(e) => setConfig({ ...config, title: e.target.value })} data-testid={`input-${configKey}-title`} />
      </div>
      <div className="space-y-2">
        <Label>Last Updated</Label>
        <Input value={config.lastUpdated} onChange={(e) => setConfig({ ...config, lastUpdated: e.target.value })} data-testid={`input-${configKey}-updated`} />
      </div>

      <div>
        <Label className="mb-3 block">Sections</Label>
        <SectionsEditor sections={config.sections} onChange={(s) => setConfig({ ...config, sections: s })} />
      </div>

      <Button onClick={() => save.mutate(config)} disabled={save.isPending} data-testid={`button-save-${configKey}`}>
        <Save className="w-4 h-4 mr-2" /> {save.isPending ? "Saving..." : `Save ${label}`}
      </Button>
    </div>
  );
}

export default function AdminPages() {
  const { data: allConfig, isLoading } = useQuery<Record<string, any>>({
    queryKey: ["/api/site-config"],
  });

  const getConfig = <T,>(key: string, defaultVal: T): T => {
    if (allConfig && allConfig[key]) return { ...defaultVal, ...allConfig[key] } as T;
    return defaultVal;
  };

  const handleLogout = () => {
    document.cookie = "admin_session=; path=/; max-age=0";
    window.location.href = "/admin/login";
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-muted-foreground">Loading configuration...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-24" data-testid="admin-pages">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/admin">
            <Button variant="ghost" size="sm" data-testid="link-back-dashboard">
              <ArrowLeft className="w-4 h-4 mr-1" /> Admin
            </Button>
          </Link>
          <h1 className="text-2xl font-bold" data-testid="text-admin-pages-title">Policy Page Builders</h1>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout} data-testid="button-admin-logout">
          <LogOut className="w-4 h-4 mr-1" /> Logout
        </Button>
      </div>

      <p className="text-sm text-muted-foreground mb-6">Edit the content of your policy and information pages. Changes are saved independently for each page.</p>

      <Accordion type="multiple" defaultValue={[]} className="space-y-2">
        <AccordionItem value="about" className="border rounded-md px-4">
          <AccordionTrigger data-testid="accordion-about">
            <SectionHeader icon={Info} title="About Us" />
          </AccordionTrigger>
          <AccordionContent>
            <AboutSection data={getConfig("page-about", defaultAboutPage)} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="terms" className="border rounded-md px-4">
          <AccordionTrigger data-testid="accordion-terms">
            <SectionHeader icon={FileText} title="Terms & Conditions" />
          </AccordionTrigger>
          <AccordionContent>
            <PolicySection configKey="page-terms" label="Terms & Conditions" data={getConfig("page-terms", defaultTermsPage)} defaultData={defaultTermsPage} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="privacy" className="border rounded-md px-4">
          <AccordionTrigger data-testid="accordion-privacy">
            <SectionHeader icon={Shield} title="Privacy Policy" />
          </AccordionTrigger>
          <AccordionContent>
            <PolicySection configKey="page-privacy" label="Privacy Policy" data={getConfig("page-privacy", defaultPrivacyPage)} defaultData={defaultPrivacyPage} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="refund" className="border rounded-md px-4">
          <AccordionTrigger data-testid="accordion-refund">
            <SectionHeader icon={RefreshCcw} title="Refund & Cancellation Policy" />
          </AccordionTrigger>
          <AccordionContent>
            <PolicySection configKey="page-refund" label="Refund Policy" data={getConfig("page-refund", defaultRefundPage)} defaultData={defaultRefundPage} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="shipping" className="border rounded-md px-4">
          <AccordionTrigger data-testid="accordion-shipping">
            <SectionHeader icon={Truck} title="Shipping Policy" />
          </AccordionTrigger>
          <AccordionContent>
            <PolicySection configKey="page-shipping" label="Shipping Policy" data={getConfig("page-shipping", defaultShippingPage)} defaultData={defaultShippingPage} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
