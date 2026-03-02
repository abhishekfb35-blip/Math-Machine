import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Upload, Loader2, Monitor, Smartphone, Globe, PanelBottom } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface BrandLogos {
  desktop: string | null;
  mobile: string | null;
  favicon: string | null;
  footer: string | null;
}

const SLOTS = [
  {
    key: "desktop",
    label: "Desktop Header Logo",
    description: "Shown in the header on laptop and desktop screens",
    icon: Monitor,
    previewClass: "max-h-20",
  },
  {
    key: "mobile",
    label: "Mobile Header Logo",
    description: "Shown in the header on phones and small screens",
    icon: Smartphone,
    previewClass: "max-h-16",
  },
  {
    key: "favicon",
    label: "Favicon & PWA Icon",
    description: "Browser tab icon and PWA app icon. Auto-generates all sizes.",
    icon: Globe,
    previewClass: "max-h-16",
  },
  {
    key: "footer",
    label: "Footer Logo",
    description: "Shown at the bottom of every page",
    icon: PanelBottom,
    previewClass: "max-h-20",
  },
];

function LogoSlot({
  slot,
  currentUrl,
  onUploaded,
}: {
  slot: (typeof SLOTS)[number];
  currentUrl: string | null;
  onUploaded: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("slot", slot.key);
      const res = await fetch("/api/admin/brand-logo", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      toast({ title: "Logo updated", description: `${slot.label} has been updated.` });
      onUploaded();
    } catch {
      toast({ title: "Upload failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="p-5" data-testid={`card-brand-${slot.key}`}>
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 rounded-lg bg-muted shrink-0">
          <slot.icon className="w-5 h-5 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-semibold text-sm">{slot.label}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{slot.description}</p>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        data-testid={`input-brand-${slot.key}`}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
          e.target.value = "";
        }}
      />

      <div
        className="relative rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors cursor-pointer flex items-center justify-center min-h-[120px] bg-muted/20"
        onClick={() => !uploading && fileRef.current?.click()}
        data-testid={`upload-area-brand-${slot.key}`}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-xs">Uploading...</span>
          </div>
        ) : currentUrl ? (
          <div className="p-4 flex flex-col items-center gap-2">
            <img
              src={currentUrl}
              alt={slot.label}
              className={`${slot.previewClass} w-auto object-contain`}
              data-testid={`img-brand-${slot.key}`}
            />
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Upload className="w-3 h-3" /> Click to replace
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground p-4">
            <Upload className="w-8 h-8" />
            <span className="text-xs">Click to upload</span>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function AdminBrandAssets() {
  const queryClient = useQueryClient();
  const { data: logos, isLoading } = useQuery<BrandLogos>({
    queryKey: ["/api/admin/brand-logos"],
  });

  const handleUploaded = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/brand-logos"] });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-24" data-testid="page-admin-brand">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin">
          <Button variant="ghost" size="icon" data-testid="button-back-dashboard">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold" data-testid="text-brand-title">Brand Assets</h1>
          <p className="text-sm text-muted-foreground">Upload and manage your brand logos</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {SLOTS.map((slot) => (
            <LogoSlot
              key={slot.key}
              slot={slot}
              currentUrl={logos?.[slot.key as keyof BrandLogos] ?? null}
              onUploaded={handleUploaded}
            />
          ))}
        </div>
      )}
    </div>
  );
}
