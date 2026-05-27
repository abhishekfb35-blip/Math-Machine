import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChevronLeft, Plus, Pencil, Trash2, Loader2, Save, X, Upload, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ColorSwatch } from "@shared/types";

export default function AdminColorSwatches() {
  const { toast } = useToast();
  const [newName, setNewName] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newPreview, setNewPreview] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editPreview, setEditPreview] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const { data: swatches, isLoading } = useQuery<ColorSwatch[]>({
    queryKey: ["/api/admin/color-swatches"],
  });

  async function uploadSwatchFile(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("image", file);
    const res = await fetch("/api/upload-swatch", { method: "POST", body: formData });
    if (!res.ok) throw new Error("Upload failed");
    const { url } = await res.json();
    return url;
  }

  const addMutation = useMutation({
    mutationFn: async () => {
      let swatchUrl: string | null = null;
      if (newFile) swatchUrl = await uploadSwatchFile(newFile);
      await apiRequest("POST", "/api/admin/color-swatches", { name: newName.trim(), swatchUrl });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/color-swatches"] });
      setNewName("");
      setNewFile(null);
      setNewPreview(null);
      setFileInputKey(k => k + 1);
      toast({ title: "Colour added" });
    },
    onError: () => toast({ title: "Failed to add colour", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (id: string) => {
      let swatchUrl: string | undefined = undefined;
      if (editFile) swatchUrl = await uploadSwatchFile(editFile);
      const body: Record<string, unknown> = { name: editName.trim() };
      if (swatchUrl !== undefined) body.swatchUrl = swatchUrl;
      await apiRequest("PATCH", `/api/admin/color-swatches/${id}`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/color-swatches"] });
      setEditingId(null);
      setEditFile(null);
      setEditPreview(null);
      toast({ title: "Colour updated" });
    },
    onError: () => toast({ title: "Failed to update colour", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/color-swatches/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/color-swatches"] });
      toast({ title: "Colour removed" });
    },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  function handleNewFile(file: File) {
    setNewFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setNewPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  function handleEditFile(file: File) {
    setEditFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setEditPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  function startEdit(sw: ColorSwatch) {
    setEditingId(sw.id);
    setEditName(sw.name);
    setEditFile(null);
    setEditPreview(sw.swatchUrl ?? null);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
      <Button variant="ghost" size="sm" className="mb-4" asChild>
        <Link href="/admin">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Dashboard
        </Link>
      </Button>

      <div className="flex items-center gap-3 mb-6">
        <Palette className="w-6 h-6 text-violet-500" />
        <div>
          <h1 className="text-xl font-bold" data-testid="text-page-title">Colour Swatch Repository</h1>
          <p className="text-sm text-muted-foreground">Global colour palette used across all category variant configs.</p>
        </div>
      </div>

      {/* Add new swatch */}
      <Card className="p-4 mb-6">
        <h2 className="text-sm font-semibold mb-3">Add Colour</h2>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-40">
            <Label className="text-xs mb-1 block">Name</Label>
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Blush Pink"
              className="h-8 text-sm"
              data-testid="input-new-swatch-name"
            />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Swatch Image</Label>
            <div className="flex items-center gap-2">
              {newPreview ? (
                <img src={newPreview} alt="" className="w-8 h-8 rounded-full object-cover border" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-muted border flex items-center justify-center">
                  <Palette className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
              <label className="cursor-pointer text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 border rounded px-2 h-8">
                <Upload className="w-3 h-3" /> Upload
                <input key={fileInputKey} type="file" accept="image/*" className="hidden"
                  onChange={e => e.target.files?.[0] && handleNewFile(e.target.files[0])} />
              </label>
              {newPreview && (
                <button onClick={() => { setNewFile(null); setNewPreview(null); setFileInputKey(k => k + 1); }} className="text-muted-foreground hover:text-destructive">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <Button
            onClick={() => addMutation.mutate()}
            disabled={addMutation.isPending || !newName.trim()}
            className="h-8 text-sm"
            data-testid="button-add-swatch"
          >
            {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
            Add
          </Button>
        </div>
      </Card>

      {/* Swatch list */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : swatches?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Palette className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No colours yet — add your first one above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {swatches?.map(sw => (
            <Card key={sw.id} className="p-3" data-testid={`card-swatch-${sw.id}`}>
              {editingId === sw.id ? (
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    {editPreview ? (
                      <img src={editPreview} alt="" className="w-8 h-8 rounded-full object-cover border" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-muted border" />
                    )}
                    <label className="cursor-pointer text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 border rounded px-2 h-8">
                      <Upload className="w-3 h-3" /> Replace
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => e.target.files?.[0] && handleEditFile(e.target.files[0])} />
                    </label>
                  </div>
                  <Input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="h-8 text-sm flex-1 min-w-32"
                    data-testid={`input-edit-swatch-name-${sw.id}`}
                  />
                  <Button size="sm" className="h-8" onClick={() => updateMutation.mutate(sw.id)} disabled={updateMutation.isPending || !editName.trim()} data-testid={`button-save-swatch-${sw.id}`}>
                    {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => { setEditingId(null); setEditFile(null); setEditPreview(null); }}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  {sw.swatchUrl ? (
                    <img src={sw.swatchUrl} alt={sw.name} className="w-8 h-8 rounded-full object-cover border shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-muted border shrink-0 flex items-center justify-center">
                      <span className="text-xs font-bold text-muted-foreground">{sw.name.slice(0, 2)}</span>
                    </div>
                  )}
                  <span className="flex-1 text-sm font-medium" data-testid={`text-swatch-name-${sw.id}`}>{sw.name}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(sw)} data-testid={`button-edit-swatch-${sw.id}`}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7"
                    onClick={() => { if (confirm(`Remove "${sw.name}"?`)) deleteMutation.mutate(sw.id); }}
                    data-testid={`button-delete-swatch-${sw.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
