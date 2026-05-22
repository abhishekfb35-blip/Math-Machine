import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Attributes, Audience, Gender, Theme, Style } from "@shared/types";

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
      </div>
    </div>
  );
}
