import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Gift, Save, Loader2, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { CustomerConsent } from "@shared/types";

interface ConsentSettings {
  enabled: boolean;
  headline: string;
  description: string;
  consentText: string;
  discountPercent: number;
}

const DEFAULT_SETTINGS: ConsentSettings = {
  enabled: true,
  headline: "Get 10% Off Your First Order",
  description: "Sign up for updates and get an exclusive discount code",
  consentText: "I agree to receive order updates and promotional messages from TurtleLittle via WhatsApp and email.",
  discountPercent: 10,
};

interface ConsentsResponse {
  consents: CustomerConsent[];
  total: number;
  page: number;
  totalPages: number;
}

export default function AdminConsent() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [settings, setSettings] = useState<ConsentSettings>(DEFAULT_SETTINGS);

  const { data: configData, isLoading: configLoading } = useQuery<{ key: string; value: ConsentSettings }>({
    queryKey: ["/api/site-config", "consent-popup"],
    queryFn: async () => {
      const res = await fetch("/api/site-config/consent-popup");
      if (!res.ok) return null;
      return res.json();
    },
  });

  useEffect(() => {
    if (configData?.value) {
      setSettings({ ...DEFAULT_SETTINGS, ...configData.value });
    }
  }, [configData]);

  const { data: consentsData, isLoading: consentsLoading } = useQuery<ConsentsResponse>({
    queryKey: ["/api/admin/consents", page],
    queryFn: async () => {
      const res = await fetch(`/api/admin/consents?page=${page}&limit=20`);
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: ConsentSettings) => {
      await apiRequest("POST", "/api/site-config/consent-popup", { value: data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/site-config", "consent-popup"] });
      toast({ title: "Settings saved" });
    },
    onError: () => {
      toast({ title: "Failed to save", variant: "destructive" });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(settings);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-24" data-testid="page-admin-consent">
      <Link href="/admin">
        <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back-dashboard">
          <ArrowLeft className="w-4 h-4 mr-2" /> Dashboard
        </Button>
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-lg bg-green-50 dark:bg-green-950/30">
          <Gift className="w-5 h-5 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold" data-testid="text-consent-title">Consent & Offers</h1>
          <p className="text-sm text-muted-foreground">Manage popup settings and view signups</p>
        </div>
      </div>

      <div className="space-y-6">
        <Card className="p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Gift className="w-4 h-4" /> Popup Settings
          </h2>

          {configLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium w-20 shrink-0">Enabled</label>
                <button
                  type="button"
                  onClick={() => setSettings(s => ({ ...s, enabled: !s.enabled }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.enabled ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"
                  }`}
                  data-testid="toggle-popup-enabled"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <span className="text-sm text-muted-foreground">
                  {settings.enabled ? "Popup is active" : "Popup is hidden"}
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium block mb-1">Headline</label>
                  <Input
                    value={settings.headline}
                    onChange={e => setSettings(s => ({ ...s, headline: e.target.value }))}
                    placeholder="e.g. Get 10% Off Your First Order"
                    data-testid="input-popup-headline"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Description</label>
                  <Input
                    value={settings.description}
                    onChange={e => setSettings(s => ({ ...s, description: e.target.value }))}
                    placeholder="e.g. Sign up for updates..."
                    data-testid="input-popup-description"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Consent Text</label>
                  <textarea
                    value={settings.consentText}
                    onChange={e => setSettings(s => ({ ...s, consentText: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-y"
                    placeholder="Legal consent wording..."
                    data-testid="input-popup-consent-text"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Discount Percentage</label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={settings.discountPercent}
                    onChange={e => setSettings(s => ({ ...s, discountPercent: parseInt(e.target.value) || 0 }))}
                    className="w-32"
                    data-testid="input-popup-discount"
                  />
                </div>
              </div>

              <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-settings">
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Save Settings
              </Button>
            </>
          )}
        </Card>

        <Separator />

        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <Users className="w-4 h-4" /> Signups
              {consentsData && (
                <Badge variant="secondary" className="ml-1" data-testid="badge-total-signups">
                  {consentsData.total}
                </Badge>
              )}
            </h2>
          </div>

          {consentsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : !consentsData?.consents?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">No signups yet</p>
          ) : (
            <>
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full text-sm" data-testid="table-consents">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium">Name</th>
                      <th className="pb-2 font-medium">Email</th>
                      <th className="pb-2 font-medium">Phone</th>
                      <th className="pb-2 font-medium">Discount Code</th>
                      <th className="pb-2 font-medium">Used</th>
                      <th className="pb-2 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consentsData.consents.map((c) => (
                      <tr key={c.id} className="border-b last:border-0" data-testid={`row-consent-${c.id}`}>
                        <td className="py-2 pr-3 whitespace-nowrap">{c.firstName} {c.lastName}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{c.email}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{c.phone || "—"}</td>
                        <td className="py-2 pr-3 font-mono text-xs">{c.discountCode || "—"}</td>
                        <td className="py-2 pr-3">
                          {c.discountCode ? (
                            <Badge variant={c.discountUsed ? "default" : "secondary"} className="text-xs">
                              {c.discountUsed ? "Yes" : "No"}
                            </Badge>
                          ) : "—"}
                        </td>
                        <td className="py-2 text-muted-foreground whitespace-nowrap">
                          {c.consentedAt ? new Date(c.consentedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {consentsData.totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-muted-foreground">
                    Page {consentsData.page} of {consentsData.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage(p => p - 1)}
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= consentsData.totalPages}
                      onClick={() => setPage(p => p + 1)}
                      data-testid="button-next-page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
