import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Save, X, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Attributes, Audience, Gender, Theme, Style } from "@shared/types";
import { buildDefaultThemeGroups, type ThemeGroup, type ThemeGroupsConfig } from "@shared/themeGroups";

type AttrItem = Audience | Gender | Theme | Style;

function AttributeSection({
  title,
  items,
  endpoint,
  onMutate,
}: {
  title: string;
  items: AttrItem[];
  endpoint: string;
  onMutate: () => void;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState<AttrItem | null>(null);
  const [addingName, setAddingName] = useState("");
  const [addingSort, setAddingSort] = useState<number>(0);
  const [showAdd, setShowAdd] = useState(false);

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", endpoint, { name: addingName.trim(), sortOrder: addingSort });
    },
    onSuccess: () => {
      onMutate();
      setShowAdd(false);
      setAddingName("");
      setAddingSort(0);
      toast({ title: `${title} added` });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (item: AttrItem) => {
      await apiRequest("PUT", `${endpoint}/${item.id}`, { name: item.name, sortOrder: item.sortOrder });
    },
    onSuccess: () => {
      onMutate();
      setEditing(null);
      toast({ title: `${title} updated` });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `${endpoint}/${id}`);
    },
    onSuccess: () => {
      onMutate();
      toast({ title: `${title} deleted` });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-base">{title}</h3>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(true)} data-testid={`button-add-${title.toLowerCase().replace(/\s+/g, "-")}`}>
          <Plus className="w-3 h-3 mr-1" /> Add
        </Button>
      </div>

      {showAdd && (
        <div className="flex gap-2 mb-3 p-2 bg-muted/40 rounded">
          <div className="flex-1">
            <Label className="text-xs">Name</Label>
            <Input
              value={addingName}
              onChange={e => setAddingName(e.target.value)}
              placeholder="e.g. teenagers"
              className="h-7 text-sm"
              data-testid={`input-add-${title.toLowerCase().replace(/\s+/g, "-")}-name`}
            />
          </div>
          <div className="w-20">
            <Label className="text-xs">Sort</Label>
            <Input
              type="number"
              value={addingSort}
              onChange={e => setAddingSort(parseInt(e.target.value) || 0)}
              className="h-7 text-sm"
            />
          </div>
          <div className="flex items-end gap-1">
            <Button size="sm" onClick={() => createMutation.mutate()} disabled={!addingName.trim() || createMutation.isPending} data-testid={`button-save-${title.toLowerCase().replace(/\s+/g, "-")}`}>
              <Save className="w-3 h-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowAdd(false); setAddingName(""); }}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-1">
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-2 py-1 border-b last:border-0">
            {editing?.id === item.id ? (
              <>
                <Input
                  value={editing.name}
                  onChange={e => setEditing({ ...editing, name: e.target.value })}
                  className="h-7 text-sm flex-1"
                  data-testid={`input-edit-attr-name`}
                />
                <Input
                  type="number"
                  value={editing.sortOrder ?? 0}
                  onChange={e => setEditing({ ...editing, sortOrder: parseInt(e.target.value) || 0 })}
                  className="h-7 text-sm w-16"
                />
                <Button size="sm" onClick={() => updateMutation.mutate(editing)} disabled={updateMutation.isPending}>
                  <Save className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                  <X className="w-3 h-3" />
                </Button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm capitalize">{item.name}</span>
                <Badge variant="outline" className="text-xs">{item.sortOrder ?? 0}</Badge>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditing({ ...item })} data-testid={`button-edit-attr-${item.name}`}>
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteMutation.mutate(item.id)} data-testid={`button-delete-attr-${item.name}`}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </>
            )}
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground">No {title.toLowerCase()} yet.</p>}
      </div>
    </Card>
  );
}

function ThemeGroupsSection({ themes, onMutate }: { themes: Theme[]; onMutate: () => void }) {
  const { toast } = useToast();
  const { data: savedConfig, isLoading } = useQuery<{ value: ThemeGroupsConfig }>({
    queryKey: ["/api/site-config", "theme-groups"],
    queryFn: () => fetch("/api/site-config/theme-groups").then(async response => {
      if (!response.ok) return { value: buildDefaultThemeGroups(themes) };
      return response.json();
    }),
    staleTime: 0,
  });
  const fallbackGroups = useMemo(() => buildDefaultThemeGroups(themes), [themes]);
  const initialGroups = useMemo(
    () => Array.isArray(savedConfig?.value) ? savedConfig.value : fallbackGroups,
    [fallbackGroups, savedConfig],
  );
  const [draft, setDraft] = useState<ThemeGroupsConfig>(initialGroups);

  useEffect(() => {
    setDraft(initialGroups);
  }, [initialGroups]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/site-config/theme-groups", { value: draft });
    },
    onSuccess: () => {
      onMutate();
      queryClient.invalidateQueries({ queryKey: ["/api/site-config", "theme-groups"] });
      toast({ title: "Theme groups saved" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateGroup = (id: string, changes: Partial<ThemeGroup>) => {
    setDraft(groups => groups.map(group => group.id === id ? { ...group, ...changes } : group));
  };

  const moveGroup = (index: number, direction: -1 | 1) => {
    const reordered = draft.slice().sort((a, b) => a.sortOrder - b.sortOrder);
    const target = index + direction;
    if (target < 0 || target >= reordered.length) return;
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setDraft(reordered.map((group, sortOrder) => ({ ...group, sortOrder })));
  };

  const assignTheme = (themeId: string, groupId: string) => {
    setDraft(groups => groups.map(group => ({
      ...group,
      themeIds: group.id === groupId
        ? [...new Set([...group.themeIds, themeId])]
        : group.themeIds.filter(id => id !== themeId),
    })));
  };

  const groupedThemeIds = new Set(draft.flatMap(group => group.themeIds));
  const unassignedThemes = themes.filter(theme => !groupedThemeIds.has(theme.id));

  return (
    <Card className="p-4 md:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-base">Theme Groups</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Organize the Shop theme filters without changing theme names, IDs, or product assignments.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => saveMutation.mutate()}
          disabled={isLoading || saveMutation.isPending || unassignedThemes.length > 0}
          data-testid="button-save-theme-groups"
        >
          <Save className="w-3 h-3 mr-1" /> Save groups
        </Button>
      </div>

      <div className="space-y-3">
        {draft
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((group, index) => {
            const groupThemes = group.themeIds
              .map(id => themes.find(theme => theme.id === id))
              .filter((theme): theme is Theme => Boolean(theme));
            return (
              <div key={group.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      disabled={index === 0}
                      onClick={() => moveGroup(index, -1)}
                      aria-label={`Move ${group.name} up`}
                      data-testid={`button-move-theme-group-up-${group.id}`}
                    >
                      <ChevronUp className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      disabled={index === draft.length - 1}
                      onClick={() => moveGroup(index, 1)}
                      aria-label={`Move ${group.name} down`}
                      data-testid={`button-move-theme-group-down-${group.id}`}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </div>
                  <Input
                    value={group.name}
                    onChange={event => updateGroup(group.id, { name: event.target.value })}
                    className="h-8 text-sm flex-1 min-w-44"
                    aria-label={`Name for ${group.name}`}
                    data-testid={`input-theme-group-name-${group.id}`}
                  />
                  <Input
                    type="number"
                    value={group.sortOrder}
                    onChange={event => updateGroup(group.id, { sortOrder: Number(event.target.value) || 0 })}
                    className="h-8 text-sm w-20"
                    aria-label={`Sort order for ${group.name}`}
                  />
                  <label className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={group.enabled}
                      onChange={event => updateGroup(group.id, { enabled: event.target.checked })}
                      className="accent-primary"
                    />
                    Visible to shoppers
                  </label>
                </div>
                <p className="text-xs text-muted-foreground mt-2 mb-2">{group.description}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {groupThemes.map(theme => (
                    <label key={theme.id} className="flex items-center gap-2 text-sm rounded-md bg-muted/40 px-2 py-1.5">
                      <span className="flex-1 capitalize">{theme.name}</span>
                      <select
                        value={group.id}
                        onChange={event => assignTheme(theme.id, event.target.value)}
                        className="h-7 max-w-40 rounded border bg-background px-2 text-xs"
                        aria-label={`Group for ${theme.name}`}
                        data-testid={`select-theme-group-${theme.id}`}
                      >
                        {draft.slice().sort((a, b) => a.sortOrder - b.sortOrder).map(option => (
                          <option key={option.id} value={option.id}>{option.name}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                  {groupThemes.length === 0 && (
                    <p className="text-xs text-muted-foreground py-1">No themes assigned.</p>
                  )}
                </div>
              </div>
            );
          })}
      </div>

      {unassignedThemes.length > 0 && (
        <div className="mt-3 rounded-lg border border-dashed p-3">
          <p className="text-sm font-medium">Unassigned themes</p>
          <p className="text-xs text-muted-foreground mt-1 mb-2">Assign these themes before saving so every theme has one primary group.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {unassignedThemes.map(theme => (
              <label key={theme.id} className="flex items-center gap-2 text-sm rounded-md bg-muted/40 px-2 py-1.5">
                <span className="flex-1 capitalize">{theme.name}</span>
                <select
                  defaultValue=""
                  onChange={event => assignTheme(theme.id, event.target.value)}
                  className="h-7 max-w-40 rounded border bg-background px-2 text-xs"
                  aria-label={`Group for ${theme.name}`}
                  data-testid={`select-unassigned-theme-group-${theme.id}`}
                >
                  <option value="" disabled>Choose group</option>
                  {draft.slice().sort((a, b) => a.sortOrder - b.sortOrder).map(option => (
                    <option key={option.id} value={option.id}>{option.name}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

export default function AdminAttributes() {
  const { data: attributes, refetch } = useQuery<Attributes>({
    queryKey: ["/api/admin/attributes"],
    queryFn: async () => {
      const res = await fetch("/api/admin/attributes");
      return res.json();
    },
  });

  const onMutate = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["/api/attributes"] });
  };

  const sections = [
    { title: "Audience", items: attributes?.audience ?? [], endpoint: "/api/admin/attributes/audience" },
    { title: "Genders", items: attributes?.genders ?? [], endpoint: "/api/admin/attributes/genders" },
    { title: "Themes", items: attributes?.themes ?? [], endpoint: "/api/admin/attributes/themes" },
    { title: "Styles", items: attributes?.styles ?? [], endpoint: "/api/admin/attributes/styles" },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Product Attributes</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage audience, genders, themes, and styles used to classify products. Changes here reflect everywhere with zero hardcoding.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map(s => (
          <AttributeSection
            key={s.title}
            title={s.title}
            items={s.items}
            endpoint={s.endpoint}
            onMutate={onMutate}
          />
        ))}
        <ThemeGroupsSection themes={attributes?.themes ?? []} onMutate={onMutate} />
      </div>
    </div>
  );
}
