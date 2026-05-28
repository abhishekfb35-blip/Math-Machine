import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ChevronLeft, Save } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { Attributes } from "@shared/types";

type SingleAudienceConfig = {
  type: "single";
  heading: string;
  nameLabel: string;
  nameMin?: number;
  nameMax?: number;
};

type CoupleAudienceConfig = {
  type: "couples";
  heading: string;
  person1Label: string;
  person2Label: string;
  person1Prefix: string;
  person2Prefix: string;
  nameMin?: number;
  nameMax?: number;
};

export type AudiencePageConfig = SingleAudienceConfig | CoupleAudienceConfig;
export type ProductPageConfig = Record<string, AudiencePageConfig>;

export default function AdminProductPageConfig() {
  const { toast } = useToast();

  const { data: attributes } = useQuery<Attributes>({ queryKey: ["/api/attributes"] });

  const { data: configData } = useQuery<{ value: ProductPageConfig } | null>({
    queryKey: ["/api/site-config", "product-page-config"],
    queryFn: () => fetch("/api/site-config/product-page-config").then(r => r.ok ? r.json() : null),
    staleTime: 0,
  });

  const [config, setConfig] = useState<ProductPageConfig>({});

  useEffect(() => {
    if (configData?.value) setConfig(configData.value);
  }, [configData]);

  const audiences = attributes?.audience ?? [];

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/site-config/product-page-config", { value: config }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/site-config", "product-page-config"] });
      toast({ title: "Saved", description: "Product page config updated." });
    },
    onError: () => toast({ title: "Error", description: "Failed to save.", variant: "destructive" }),
  });

  const setAudienceType = (slug: string, type: "none" | "single" | "couples") => {
    if (type === "none") {
      setConfig(prev => { const n = { ...prev }; delete n[slug]; return n; });
      return;
    }
    if (type === "single") {
      setConfig(prev => ({
        ...prev,
        [slug]: { type: "single", heading: "", nameLabel: "", nameMin: 3, nameMax: 11 } as SingleAudienceConfig,
      }));
    } else {
      setConfig(prev => ({
        ...prev,
        [slug]: { type: "couples", heading: "", person1Label: "", person2Label: "", person1Prefix: "", person2Prefix: "", nameMin: 3, nameMax: 11 } as CoupleAudienceConfig,
      }));
    }
  };

  const updateField = (slug: string, field: string, value: string) => {
    setConfig(prev => ({
      ...prev,
      [slug]: { ...prev[slug], [field]: value } as AudiencePageConfig,
    }));
  };

  const updateNumericField = (slug: string, field: string, value: number) => {
    setConfig(prev => ({
      ...prev,
      [slug]: { ...prev[slug], [field]: value } as AudiencePageConfig,
    }));
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin">
          <Button variant="ghost" size="icon" data-testid="button-back-admin">
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold" data-testid="text-page-title">Product Page Config</h1>
          <p className="text-sm text-muted-foreground">Configure personalisation fields shown per audience type</p>
        </div>
      </div>

      <div className="space-y-4">
        {audiences.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No audience types found. Add them via Attributes first.
          </p>
        )}

        {audiences.map(aud => {
          const slug = aud.name.toLowerCase();
          const cfg = config[slug];

          return (
            <Card key={aud.id} className="p-4 space-y-4" data-testid={`card-audience-${slug}`}>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold capitalize">{aud.name}</h2>
                <Select
                  value={cfg?.type ?? "none"}
                  onValueChange={v => setAudienceType(slug, v as "none" | "single" | "couples")}
                >
                  <SelectTrigger className="w-48" data-testid={`select-type-${slug}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No personalisation</SelectItem>
                    <SelectItem value="single">Single name</SelectItem>
                    <SelectItem value="couples">Couple — two names</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {cfg && (
                <div className="grid gap-3 pt-3 border-t">
                  {cfg.type === "single" && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Section heading</Label>
                      <Input
                        value={cfg.heading}
                        onChange={e => updateField(slug, "heading", e.target.value)}
                        placeholder="e.g. Personalise with a Name"
                        data-testid={`input-heading-${slug}`}
                      />
                    </div>
                  )}

                  <div className="flex gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Min characters per name</Label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        step={1}
                        value={cfg.nameMin ?? 3}
                        onChange={e => updateNumericField(slug, "nameMin", Math.max(1, Math.min(10, Number(e.target.value) || 3)))}
                        className="w-24"
                        data-testid={`input-namemin-${slug}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Max characters per name</Label>
                      <Input
                        type="number"
                        min={1}
                        max={30}
                        step={1}
                        value={cfg.nameMax ?? 11}
                        onChange={e => updateNumericField(slug, "nameMax", Math.max(1, Math.min(30, Number(e.target.value) || 11)))}
                        className="w-24"
                        data-testid={`input-namemax-${slug}`}
                      />
                    </div>
                  </div>

                  {cfg.type === "single" && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Name field placeholder</Label>
                      <Input
                        value={cfg.nameLabel}
                        onChange={e => updateField(slug, "nameLabel", e.target.value)}
                        placeholder="e.g. Enter name to embroider"
                        data-testid={`input-namelabel-${slug}`}
                      />
                    </div>
                  )}

                  {cfg.type === "couples" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Person 1 field label</Label>
                        <Input
                          value={cfg.person1Label}
                          onChange={e => updateField(slug, "person1Label", e.target.value)}
                          placeholder="e.g. Gentleman"
                          data-testid={`input-p1label-${slug}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Person 2 field label</Label>
                        <Input
                          value={cfg.person2Label}
                          onChange={e => updateField(slug, "person2Label", e.target.value)}
                          placeholder="e.g. Lady"
                          data-testid={`input-p2label-${slug}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Person 1 field title</Label>
                        <Input
                          value={cfg.person1Prefix}
                          onChange={e => updateField(slug, "person1Prefix", e.target.value)}
                          placeholder="e.g. His Name"
                          data-testid={`input-p1prefix-${slug}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Person 2 field title</Label>
                        <Input
                          value={cfg.person2Prefix}
                          onChange={e => updateField(slug, "person2Prefix", e.target.value)}
                          placeholder="e.g. Her Name"
                          data-testid={`input-p2prefix-${slug}`}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {audiences.length > 0 && (
        <div className="mt-6 flex justify-end">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            data-testid="button-save-config"
          >
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? "Saving…" : "Save config"}
          </Button>
        </div>
      )}
    </div>
  );
}
