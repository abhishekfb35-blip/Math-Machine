import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Plus, Pencil, Trash2, Check, X, GripVertical, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Occasion } from "@shared/types";

function parseCsv(val: string | null | undefined): string[] {
  if (!val) return [];
  return val.split(",").map(v => v.trim()).filter(Boolean);
}

function toggleCsvValue(current: string | null | undefined, value: string): string {
  const arr = parseCsv(current);
  return arr.includes(value) ? arr.filter(v => v !== value).join(",") : [...arr, value].join(",");
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

interface TagWeight {
  tagName: string;
  weight: number;
}

function tagsToRows(record: Record<string, number> | null | undefined): TagWeight[] {
  if (!record) return [];
  return Object.entries(record).map(([tagName, weight]) => ({ tagName, weight }));
}

function rowsToRecord(rows: TagWeight[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    if (row.tagName.trim()) out[row.tagName.trim()] = Number(row.weight) || 0;
  }
  return out;
}

interface FormState {
  name: string;
  slug: string;
  description: string;
  active: boolean;
  sortOrder: number;
  preferredThemes: string;
  preferredStyles: string;
  boostRows: TagWeight[];
  penaltyRows: TagWeight[];
}

const emptyForm: FormState = {
  name: "",
  slug: "",
  description: "",
  active: true,
  sortOrder: 0,
  preferredThemes: "",
  preferredStyles: "",
  boostRows: [],
  penaltyRows: [],
};

function occasionToForm(o: Occasion): FormState {
  return {
    name: o.name,
    slug: o.slug,
    description: o.description ?? "",
    active: o.active ?? true,
    sortOrder: o.sortOrder ?? 0,
    preferredThemes: o.preferredThemes ?? "",
    preferredStyles: o.preferredStyles ?? "",
    boostRows: tagsToRows(o.boostTags),
    penaltyRows: tagsToRows(o.penaltyTags),
  };
}

function TagWeightEditor({ rows, onChange, label }: { rows: TagWeight[]; onChange: (r: TagWeight[]) => void; label: string }) {
  const addRow = () => onChange([...rows, { tagName: "", weight: 1 }]);
  const removeRow = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: keyof TagWeight, value: string | number) => {
    const next = [...rows];
    next[i] = { ...next[i], [field]: field === "weight" ? Number(value) : value };
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
        <Button type="button" variant="ghost" size="sm" onClick={addRow} data-testid={`button-add-${label.toLowerCase().replace(/\s+/g, "-")}`}>
          <Plus className="w-3 h-3 mr-1" /> Add Tag
        </Button>
      </div>
      {rows.length === 0 && (
        <p className="text-xs text-muted-foreground italic">No tags configured. Click Add Tag to add one.</p>
      )}
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              placeholder="tag name (e.g. best_seller)"
              value={row.tagName}
              onChange={e => updateRow(i, "tagName", e.target.value)}
              className="flex-1 h-8 text-sm"
              data-testid={`input-tag-name-${i}`}
            />
            <Input
              type="number"
              placeholder="weight"
              value={row.weight}
              onChange={e => updateRow(i, "weight", e.target.value)}
              className="w-20 h-8 text-sm"
              data-testid={`input-tag-weight-${i}`}
            />
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={() => removeRow(i)}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function OccasionForm({
  initial,
  onSave,
  onCancel,
  isSaving,
}: {
  initial: FormState;
  onSave: (form: FormState) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const [slugManual, setSlugManual] = useState(false);

  const { data: attributes } = useQuery<{ themes: { id: string; name: string }[]; styles: { id: string; name: string }[] }>({
    queryKey: ["/api/attributes"],
  });
  const themeOptions = attributes?.themes?.map(t => t.name) ?? [];
  const styleOptions = attributes?.styles?.map(s => s.name) ?? [];

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleNameChange = (name: string) => {
    setForm(prev => ({
      ...prev,
      name,
      slug: slugManual ? prev.slug : slugify(name),
    }));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="occ-name">Name *</Label>
          <Input
            id="occ-name"
            value={form.name}
            onChange={e => handleNameChange(e.target.value)}
            placeholder="e.g. Baby Shower"
            data-testid="input-occasion-name"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="occ-slug">Slug *</Label>
          <Input
            id="occ-slug"
            value={form.slug}
            onChange={e => { setSlugManual(true); set("slug", e.target.value); }}
            placeholder="e.g. baby-shower"
            data-testid="input-occasion-slug"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="occ-desc">Description</Label>
        <Textarea
          id="occ-desc"
          value={form.description}
          onChange={e => set("description", e.target.value)}
          placeholder="Short description of this occasion..."
          rows={2}
          data-testid="input-occasion-description"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="occ-sort">Sort Order</Label>
          <Input
            id="occ-sort"
            type="number"
            value={form.sortOrder}
            onChange={e => set("sortOrder", Number(e.target.value))}
            className="w-24"
            data-testid="input-occasion-sort-order"
          />
        </div>
        <div className="flex items-center gap-2 pt-6">
          <Switch
            checked={form.active}
            onCheckedChange={v => set("active", v)}
            data-testid="switch-occasion-active"
          />
          <Label>Active</Label>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Preferred Themes</Label>
        <div className="flex flex-wrap gap-3">
          {themeOptions.map(opt => (
            <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
              <Checkbox
                checked={parseCsv(form.preferredThemes).includes(opt)}
                onCheckedChange={() => set("preferredThemes", toggleCsvValue(form.preferredThemes, opt))}
                data-testid={`checkbox-theme-${opt}`}
              />
              <span className="text-sm capitalize">{opt}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Preferred Styles</Label>
        <div className="flex flex-wrap gap-3">
          {styleOptions.map(opt => (
            <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
              <Checkbox
                checked={parseCsv(form.preferredStyles).includes(opt)}
                onCheckedChange={() => set("preferredStyles", toggleCsvValue(form.preferredStyles, opt))}
                data-testid={`checkbox-style-${opt}`}
              />
              <span className="text-sm capitalize">{opt}</span>
            </label>
          ))}
        </div>
      </div>

      <TagWeightEditor label="Boost Tags" rows={form.boostRows} onChange={rows => set("boostRows", rows)} />
      <TagWeightEditor label="Penalty Tags" rows={form.penaltyRows} onChange={rows => set("penaltyRows", rows)} />

      <div className="flex gap-2 pt-2">
        <Button
          type="button"
          onClick={() => onSave(form)}
          disabled={isSaving || !form.name.trim() || !form.slug.trim()}
          data-testid="button-save-occasion"
        >
          <Check className="w-4 h-4 mr-1" />
          {isSaving ? "Saving…" : "Save Occasion"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel-occasion">
          <X className="w-4 h-4 mr-1" /> Cancel
        </Button>
      </div>
    </div>
  );
}

export default function AdminOccasions() {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: occasions = [], isLoading } = useQuery<Occasion[]>({
    queryKey: ["/api/admin/occasions"],
  });

  const createMutation = useMutation({
    mutationFn: (form: FormState) => apiRequest("POST", "/api/admin/occasions", {
      name: form.name,
      slug: form.slug,
      description: form.description || null,
      active: form.active,
      sortOrder: form.sortOrder,
      preferredThemes: form.preferredThemes || null,
      preferredStyles: form.preferredStyles || null,
      boostTags: rowsToRecord(form.boostRows),
      penaltyTags: rowsToRecord(form.penaltyRows),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/occasions"] });
      setShowCreate(false);
      toast({ title: "Occasion created" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to create", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, form }: { id: string; form: FormState }) => apiRequest("PATCH", `/api/admin/occasions/${id}`, {
      name: form.name,
      slug: form.slug,
      description: form.description || null,
      active: form.active,
      sortOrder: form.sortOrder,
      preferredThemes: form.preferredThemes || null,
      preferredStyles: form.preferredStyles || null,
      boostTags: rowsToRecord(form.boostRows),
      penaltyTags: rowsToRecord(form.penaltyRows),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/occasions"] });
      setEditingId(null);
      toast({ title: "Occasion updated" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/occasions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/occasions"] });
      toast({ title: "Occasion deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
    },
  });

  const toggleActive = (occ: Occasion) => {
    updateMutation.mutate({ id: occ.id, form: { ...occasionToForm(occ), active: !occ.active } });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/admin">
            <Button variant="ghost" size="icon" data-testid="button-back-admin">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold" data-testid="text-page-title">Occasions</h1>
            <p className="text-sm text-muted-foreground">Configure merchandising occasions for product curation</p>
          </div>
        </div>

        {showCreate ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">New Occasion</CardTitle>
            </CardHeader>
            <CardContent>
              <OccasionForm
                initial={emptyForm}
                onSave={form => createMutation.mutate(form)}
                onCancel={() => setShowCreate(false)}
                isSaving={createMutation.isPending}
              />
            </CardContent>
          </Card>
        ) : (
          <Button onClick={() => setShowCreate(true)} data-testid="button-new-occasion">
            <Plus className="w-4 h-4 mr-1" /> New Occasion
          </Button>
        )}

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Loading occasions…</div>
        ) : occasions.length === 0 && !showCreate ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No occasions yet. Click <strong>New Occasion</strong> to create one.
          </div>
        ) : (
          <div className="space-y-3">
            {occasions.map(occ => (
              <Card key={occ.id} data-testid={`card-occasion-${occ.id}`}>
                <CardContent className="p-4">
                  {editingId === occ.id ? (
                    <OccasionForm
                      initial={occasionToForm(occ)}
                      onSave={form => updateMutation.mutate({ id: occ.id, form })}
                      onCancel={() => setEditingId(null)}
                      isSaving={updateMutation.isPending}
                    />
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-start gap-3">
                        <GripVertical className="w-4 h-4 text-muted-foreground mt-1 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm" data-testid={`text-occasion-name-${occ.id}`}>{occ.name}</span>
                            <Badge variant="outline" className="text-[10px] font-mono no-default-hover-elevate no-default-active-elevate">
                              /{occ.slug}
                            </Badge>
                            <Badge
                              variant={occ.active ? "default" : "secondary"}
                              className="text-[10px] no-default-hover-elevate no-default-active-elevate cursor-pointer"
                              onClick={() => toggleActive(occ)}
                              data-testid={`badge-active-${occ.id}`}
                            >
                              {occ.active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          {occ.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{occ.description}</p>
                          )}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {parseCsv(occ.preferredThemes).map(t => (
                              <Badge key={t} variant="outline" className="text-[9px] capitalize no-default-hover-elevate no-default-active-elevate">{t}</Badge>
                            ))}
                            {parseCsv(occ.preferredStyles).map(s => (
                              <Badge key={s} variant="secondary" className="text-[9px] capitalize no-default-hover-elevate no-default-active-elevate">{s}</Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setExpandedId(expandedId === occ.id ? null : occ.id)}
                            data-testid={`button-expand-${occ.id}`}
                          >
                            {expandedId === occ.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setEditingId(occ.id)}
                            data-testid={`button-edit-${occ.id}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm(`Delete occasion "${occ.name}"?`)) {
                                deleteMutation.mutate(occ.id);
                              }
                            }}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-${occ.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      {expandedId === occ.id && (
                        <div className="pl-7 space-y-2 border-t pt-2 mt-1">
                          {Object.keys(occ.boostTags ?? {}).length > 0 && (
                            <div>
                              <p className="text-[10px] font-medium uppercase text-muted-foreground tracking-wide mb-1">Boost Tags</p>
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(occ.boostTags ?? {}).map(([tag, w]) => (
                                  <Badge key={tag} variant="default" className="text-[10px] no-default-hover-elevate no-default-active-elevate">
                                    {tag}: +{w}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {Object.keys(occ.penaltyTags ?? {}).length > 0 && (
                            <div>
                              <p className="text-[10px] font-medium uppercase text-muted-foreground tracking-wide mb-1">Penalty Tags</p>
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(occ.penaltyTags ?? {}).map(([tag, w]) => (
                                  <Badge key={tag} variant="destructive" className="text-[10px] no-default-hover-elevate no-default-active-elevate">
                                    {tag}: -{Math.abs(w)}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {Object.keys(occ.boostTags ?? {}).length === 0 && Object.keys(occ.penaltyTags ?? {}).length === 0 && (
                            <p className="text-xs text-muted-foreground italic">No boost or penalty tags configured.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
