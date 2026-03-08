import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Gift, Save, Loader2, ChevronLeft, ChevronRight, Users, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { CustomerConsent } from "@shared/types";

export interface FormFieldConfig {
  name: string;
  label: string;
  type: string;
  placeholder: string;
  enabled: boolean;
  required: boolean;
  hideWhenLoggedIn: boolean;
}

const DEFAULT_FIELDS: FormFieldConfig[] = [
  { name: "firstName", label: "First Name", type: "text", placeholder: "First name", enabled: true, required: true, hideWhenLoggedIn: false },
  { name: "lastName", label: "Last Name", type: "text", placeholder: "Last name", enabled: true, required: true, hideWhenLoggedIn: false },
  { name: "email", label: "Email", type: "email", placeholder: "Email address", enabled: true, required: true, hideWhenLoggedIn: true },
  { name: "phone", label: "Phone", type: "tel", placeholder: "Phone number", enabled: true, required: false, hideWhenLoggedIn: false },
];

interface ConsentSettings {
  enabled: boolean;
  headline: string;
  description: string;
  consentText: string;
  buttonText: string;
  discountPercent: number;
  fields: FormFieldConfig[];
}

const DEFAULT_SETTINGS: ConsentSettings = {
  enabled: true,
  headline: "Get 10% Off Your First Order",
  description: "Sign up for updates and get an exclusive discount code",
  consentText: "I agree to receive order updates and promotional messages from TurtleLittle via WhatsApp and email.",
  buttonText: "",
  discountPercent: 10,
  fields: DEFAULT_FIELDS,
};

interface ConsentsResponse {
  consents: CustomerConsent[];
  total: number;
  page: number;
  totalPages: number;
}

function Toggle({ value, onChange, testId }: { value: boolean; onChange: (v: boolean) => void; testId?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        value ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"
      }`}
      data-testid={testId}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
          value ? "translate-x-[18px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
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
      const saved = configData.value;
      const mergedFields = DEFAULT_FIELDS.map(df => {
        const sf = saved.fields?.find((f: FormFieldConfig) => f.name === df.name);
        return sf ? { ...df, ...sf } : df;
      });
      setSettings({ ...DEFAULT_SETTINGS, ...saved, fields: mergedFields });
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

  const updateField = (index: number, key: keyof FormFieldConfig, value: boolean | string) => {
    setSettings(s => ({
      ...s,
      fields: s.fields.map((f, i) => {
        if (i !== index) return f;
        const updated = { ...f, [key]: value };
        if (key === "enabled" && value === false) {
          updated.required = false;
          updated.hideWhenLoggedIn = false;
        }
        return updated;
      }),
    }));
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
                <Toggle
                  value={settings.enabled}
                  onChange={v => setSettings(s => ({ ...s, enabled: v }))}
                  testId="toggle-popup-enabled"
                />
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
                <div>
                  <label className="text-sm font-medium block mb-1">Button Text</label>
                  <Input
                    value={settings.buttonText}
                    onChange={e => setSettings(s => ({ ...s, buttonText: e.target.value }))}
                    placeholder={`e.g. Get My ${settings.discountPercent}% Discount`}
                    data-testid="input-popup-button-text"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty to use default: "Get My {settings.discountPercent}% Discount"
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <ListChecks className="w-4 h-4" /> Form Fields
                </h3>
                <p className="text-xs text-muted-foreground">Choose which fields appear in the popup and whether they are required.</p>

                <div className="rounded-md border overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-form-fields">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-3 py-2 text-left font-medium">Field</th>
                        <th className="px-3 py-2 text-center font-medium w-20">Show</th>
                        <th className="px-3 py-2 text-center font-medium w-24">Required</th>
                        <th className="px-3 py-2 text-center font-medium w-32">Hide if logged in</th>
                      </tr>
                    </thead>
                    <tbody>
                      {settings.fields.map((field, i) => (
                        <tr key={field.name} className="border-b last:border-0" data-testid={`field-row-${field.name}`}>
                          <td className="px-3 py-2.5">
                            <span className="font-medium">{field.label}</span>
                            <span className="text-xs text-muted-foreground ml-2">({field.type})</span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <Toggle
                              value={field.enabled}
                              onChange={v => updateField(i, "enabled", v)}
                              testId={`toggle-field-enabled-${field.name}`}
                            />
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <div className={!field.enabled ? "opacity-40 pointer-events-none" : ""}>
                              <Toggle
                                value={field.required}
                                onChange={v => updateField(i, "required", v)}
                                testId={`toggle-field-required-${field.name}`}
                              />
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <div className={!field.enabled ? "opacity-40 pointer-events-none" : ""}>
                              <Toggle
                                value={field.hideWhenLoggedIn}
                                onChange={v => updateField(i, "hideWhenLoggedIn", v)}
                                testId={`toggle-field-hide-logged-in-${field.name}`}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
