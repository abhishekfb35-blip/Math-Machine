import { useQuery, useMutation } from "@tanstack/react-query";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "wouter";
import { THUMBNAIL_SIZES } from "@/config/thumbnails";
import {
  Plus, Pencil, Trash2, ChevronRight, ChevronLeft, Package, FolderOpen,
  Image as ImageIcon, Images, X, Upload, Eye, EyeOff, GripVertical, Star, Tag as TagIcon, ArrowRightLeft, Search,
  Loader2, Undo2, Save, Palette
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getProductImageUrl } from "@/lib/imageUtils";
import type { Category, Product, ProductImage, ProductReview, Tag, CategoryTagVariantConfig, VariantSize, VariantColor } from "@shared/types";

type View = "categories" | "products" | "edit-category" | "edit-product" | "tags" | "edit-tag";

function ProductTagSelector({ productId, categoryId, allTags }: { productId: string; categoryId: string; allTags: Tag[] }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") {
        setOpen(false);
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const { data: productTagsList, isLoading } = useQuery<Tag[]>({
    queryKey: ["/api/admin/products", productId, "tags"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/products/${productId}/tags`);
      return res.json();
    },
    enabled: true,
  });

  const currentTagIds = productTagsList?.map(t => t.id) || [];

  const toggleTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      const newIds = currentTagIds.includes(tagId)
        ? currentTagIds.filter(id => id !== tagId)
        : [...currentTagIds, tagId];
      await apiRequest("PUT", `/api/admin/products/${productId}/tags`, { tagIds: newIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products", productId, "tags"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories", categoryId, "product-tags"] });
    },
    onError: () => {
      toast({ title: "Failed to update tags", variant: "destructive" });
    },
  });

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center gap-1 flex-wrap">
        {productTagsList && productTagsList.length > 0 && productTagsList.map(tag => (
          <Badge key={tag.id} variant="secondary" className="text-[10px] no-default-hover-elevate no-default-active-elevate" data-testid={`badge-tag-${productId}-${tag.id}`}>
            {tag.name}
          </Badge>
        ))}
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setOpen(!open)}
          data-testid={`button-tags-${productId}`}
        >
          <TagIcon className="w-3.5 h-3.5" />
        </Button>
      </div>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-background border rounded-md shadow-lg p-2 min-w-[160px]" data-testid={`dropdown-tags-${productId}`}>
          <p className="text-xs font-medium text-muted-foreground mb-1.5 px-1">Tags</p>
          {allTags.length === 0 && (
            <p className="text-xs text-muted-foreground px-1 py-2">No tags created yet</p>
          )}
          {allTags.map(tag => (
            <label
              key={tag.id}
              className="flex items-center gap-2 px-1 py-1 rounded hover-elevate cursor-pointer"
              data-testid={`checkbox-tag-${productId}-${tag.id}`}
            >
              <Checkbox
                checked={currentTagIds.includes(tag.id)}
                onCheckedChange={() => toggleTagMutation.mutate(tag.id)}
                disabled={toggleTagMutation.isPending}
              />
              <span className="text-sm">{tag.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

interface PendingAdd {
  tempId: string;
  imageUrl: string;
  sortOrder: number;
}

function ProductImageManager({ productId, mainImageUrl }: { productId: string; mainImageUrl?: string }) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());
  const [pendingAdds, setPendingAdds] = useState<PendingAdd[]>([]);
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);

  const { data: images, isLoading } = useQuery<ProductImage[]>({
    queryKey: ["/api/products", productId, "images"],
    queryFn: async () => {
      const res = await fetch(`/api/products/${productId}/images`);
      return res.json();
    },
  });

  const serverIds = useMemo(() => images?.map(img => img.id) || [], [images]);
  const orderChanged = useMemo(() => {
    if (!localOrder) return false;
    const activeServerIds = serverIds.filter(id => !pendingDeletes.has(id));
    const activeLocalIds = localOrder.filter(id => !pendingDeletes.has(id));
    return JSON.stringify(activeServerIds) !== JSON.stringify(activeLocalIds);
  }, [localOrder, serverIds, pendingDeletes]);

  const hasPendingChanges = pendingDeletes.size > 0 || pendingAdds.length > 0 || orderChanged;

  const displayItems = useMemo(() => {
    const existingImages = images || [];
    const orderedExisting = localOrder
      ? localOrder.map(id => existingImages.find(img => img.id === id)).filter(Boolean) as ProductImage[]
      : existingImages;
    const mainItem = mainImageUrl ? [{
      type: "main" as const,
      id: "main",
      imageUrl: mainImageUrl,
      isDeleted: false,
    }] : [];
    return [
      ...mainItem,
      ...orderedExisting.map(img => ({
        type: "existing" as const,
        id: img.id,
        imageUrl: img.imageUrl,
        isDeleted: pendingDeletes.has(img.id),
      })),
      ...pendingAdds.map(add => ({
        type: "new" as const,
        id: add.tempId,
        imageUrl: add.imageUrl,
        isDeleted: false,
      })),
    ];
  }, [images, localOrder, pendingDeletes, pendingAdds, mainImageUrl]);

  const markForDelete = (id: string) => {
    setPendingDeletes(prev => new Set(prev).add(id));
  };

  const undoDelete = (id: string) => {
    setPendingDeletes(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const removeNewImage = (tempId: string) => {
    setPendingAdds(prev => prev.filter(a => a.tempId !== tempId));
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    let uploaded = 0;
    const baseOrder = (images?.length || 0) + pendingAdds.length;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const formData = new FormData();
        formData.append("image", file);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (data.url) {
          setPendingAdds(prev => [...prev, {
            tempId: `new-${Date.now()}-${i}`,
            imageUrl: data.url,
            sortOrder: baseOrder + uploaded,
          }]);
          uploaded++;
        }
      } catch {
        toast({ title: `Failed to upload ${file.name}`, variant: "destructive" });
      }
    }
    setUploading(false);
    if (uploaded > 0) {
      toast({ title: `${uploaded} image${uploaded > 1 ? "s" : ""} staged for save` });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    const activeItems = displayItems.filter(item => !item.isDeleted);
    const activeIndex = activeItems.findIndex((_, i) => i === index);
    if (activeIndex < 0) return;
    const newIndex = activeIndex + direction;
    if (newIndex < 0 || newIndex >= activeItems.length) return;

    const existingOnly = activeItems.filter(item => item.type === "existing");
    const existingIndex = existingOnly.findIndex(item => item.id === activeItems[activeIndex].id);
    const existingNewIndex = existingOnly.findIndex(item => item.id === activeItems[newIndex].id);

    if (existingIndex >= 0 && existingNewIndex >= 0) {
      const currentOrder = localOrder || serverIds;
      const newOrder = [...currentOrder];
      const fromIdx = newOrder.indexOf(existingOnly[existingIndex].id);
      const toIdx = newOrder.indexOf(existingOnly[existingNewIndex].id);
      if (fromIdx >= 0 && toIdx >= 0) {
        const [moved] = newOrder.splice(fromIdx, 1);
        newOrder.splice(toIdx, 0, moved);
        setLocalOrder(newOrder);
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const id of pendingDeletes) {
        await apiRequest("DELETE", `/api/admin/products/${productId}/images/${id}`);
      }
      for (const add of pendingAdds) {
        await apiRequest("POST", `/api/admin/products/${productId}/images`, {
          imageUrl: add.imageUrl,
          sortOrder: add.sortOrder,
        });
      }
      if (orderChanged && localOrder) {
        const activeOrder = localOrder.filter(id => !pendingDeletes.has(id));
        await apiRequest("PUT", `/api/admin/products/${productId}/images/reorder`, { imageIds: activeOrder });
      }
      setPendingDeletes(new Set());
      setPendingAdds([]);
      setLocalOrder(null);
      queryClient.invalidateQueries({ queryKey: ["/api/products", productId, "images"] });
      toast({ title: "Images saved" });
    } catch {
      toast({ title: "Failed to save images", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleReset = () => {
    setPendingDeletes(new Set());
    setPendingAdds([]);
    setLocalOrder(null);
  };

  const activeItems = displayItems.filter(item => !item.isDeleted);
  const deletedItems = displayItems.filter(item => item.isDeleted);

  return (
    <div className="mt-2" data-testid={`image-manager-${productId}`}>
      <div className="flex items-center gap-1 flex-wrap">
        {isLoading && <Skeleton className="w-10 h-10 rounded" />}
        {activeItems.map((item, idx) => (
          <div key={item.id} className="relative group" data-testid={`image-thumb-${item.id}`}>
            <div className={`${THUMBNAIL_SIZES.adminInline} rounded border overflow-hidden bg-muted ${item.type === "main" ? "border-2 border-primary/40" : item.type === "new" ? "ring-2 ring-green-500" : ""}`}>
              <img
                src={getProductImageUrl(item.imageUrl, "small")}
                alt=""
                className="w-full h-full object-contain"
              />
            </div>
            {item.type !== "main" && (
              <button
                onClick={() => item.type === "existing" ? markForDelete(item.id) : removeNewImage(item.id)}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                data-testid={`button-delete-image-${item.id}`}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
            {item.type === "existing" && (
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-0.5 rounded">
                {idx > 0 && activeItems[idx - 1]?.type === "existing" && (
                  <button
                    onClick={() => moveImage(idx, -1)}
                    className="text-white hover:text-blue-300 p-0"
                    data-testid={`button-move-left-${item.id}`}
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </button>
                )}
                {idx < activeItems.length - 1 && activeItems[idx + 1]?.type === "existing" && (
                  <button
                    onClick={() => moveImage(idx, 1)}
                    className="text-white hover:text-blue-300 p-0"
                    data-testid={`button-move-right-${item.id}`}
                  >
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        {deletedItems.map(item => (
          <div key={item.id} className="relative" data-testid={`image-thumb-deleted-${item.id}`}>
            <div className={`${THUMBNAIL_SIZES.adminInline} rounded border overflow-hidden bg-muted opacity-30`}>
              <img
                src={getProductImageUrl(item.imageUrl, "small")}
                alt=""
                className="w-full h-full object-contain"
              />
              <div className="absolute inset-0 bg-red-500/20" />
            </div>
            <button
              onClick={() => undoDelete(item.id)}
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center z-10"
              data-testid={`button-undo-delete-${item.id}`}
              title="Undo delete"
            >
              <Undo2 className="w-2.5 h-2.5" />
            </button>
          </div>
        ))}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          data-testid={`input-upload-images-${productId}`}
        />
        <Button
          size="sm"
          variant="outline"
          className="h-10 px-2 text-xs"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || saving}
          data-testid={`button-upload-images-${productId}`}
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        </Button>
      </div>
      {hasPendingChanges && (
        <div className="flex items-center gap-1 mt-1.5" data-testid={`image-save-controls-${productId}`}>
          <Button
            size="sm"
            variant="default"
            className="h-6 px-2 text-[10px] gap-1"
            onClick={handleSave}
            disabled={saving}
            data-testid={`button-save-images-${productId}`}
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10px] gap-1"
            onClick={handleReset}
            disabled={saving}
            data-testid={`button-reset-images-${productId}`}
          >
            <Undo2 className="w-3 h-3" />
            Reset
          </Button>
        </div>
      )}
    </div>
  );
}

type LocalSize = Omit<VariantSize, 'id'> & { localId: string; colors: LocalColor[] };
type LocalColor = Omit<VariantColor, 'id'> & { localId: string };

function makeLocalSize(overrides?: Partial<LocalSize>): LocalSize {
  return {
    localId: Math.random().toString(36).slice(2),
    name: "", description: "", descriptionFontSize: 12, priceAdd: 0, isDefault: false, blurOnFront: false, sortOrder: 0,
    colors: [],
    ...overrides,
  };
}
function makeLocalColor(overrides?: Partial<LocalColor>): LocalColor {
  return {
    localId: Math.random().toString(36).slice(2),
    name: "", swatchUrl: undefined, blurOnFront: false, sortOrder: 0,
    ...overrides,
  };
}

function VariantConfigModal({ open, onClose, categoryId, allTags }: {
  open: boolean; onClose: () => void; categoryId: string; allTags: Tag[];
}) {
  const { toast } = useToast();
  const [activeConfigTagId, setActiveConfigTagId] = useState<string>("");
  const [sizes, setSizes] = useState<LocalSize[]>([makeLocalSize()]);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  const { data: configs, isLoading: configsLoading } = useQuery<CategoryTagVariantConfig[]>({
    queryKey: ["/api/admin/categories", categoryId, "variant-configs"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/categories/${categoryId}/variant-configs`);
      return res.json();
    },
    enabled: open && !!categoryId,
  });

  const configForActiveTag = configs?.find(c => c.tagId === activeConfigTagId) ?? null;

  useEffect(() => {
    if (configForActiveTag) {
      setSizes(configForActiveTag.sizes.map(s => ({
        localId: s.id,
        name: s.name,
        description: s.description ?? "",
        descriptionFontSize: s.descriptionFontSize ?? 12,
        priceAdd: s.priceAdd,
        isDefault: s.isDefault,
        blurOnFront: s.blurOnFront,
        sortOrder: s.sortOrder,
        colors: s.colors.map(c => ({
          localId: c.id,
          name: c.name,
          swatchUrl: c.swatchUrl,
          blurOnFront: c.blurOnFront,
          sortOrder: c.sortOrder,
        })),
      })));
    } else {
      setSizes([makeLocalSize()]);
    }
  }, [activeConfigTagId, open, configs?.length]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/admin/categories/${categoryId}/variant-configs`, {
        tagId: activeConfigTagId || null,
        sizes: sizes.map((s, si) => ({
          name: s.name,
          description: s.description || undefined,
          descriptionFontSize: s.descriptionFontSize ?? 12,
          priceAdd: s.priceAdd,
          isDefault: s.isDefault,
          blurOnFront: s.blurOnFront,
          sortOrder: si,
          colors: s.colors.map((c, ci) => ({
            name: c.name,
            swatchUrl: c.swatchUrl,
            blurOnFront: c.blurOnFront,
            sortOrder: ci,
          })),
        })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories", categoryId, "variant-configs"] });
      toast({ title: "Variant config saved" });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/variant-configs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories", categoryId, "variant-configs"] });
      setSizes([makeLocalSize()]);
      toast({ title: "Config deleted" });
    },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const uploadSwatch = useCallback(async (file: File, sizeLocalId: string, colorLocalId: string) => {
    setUploading(prev => ({ ...prev, [`${sizeLocalId}-${colorLocalId}`]: true }));
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      setSizes(prev => prev.map(s => s.localId === sizeLocalId ? {
        ...s,
        colors: s.colors.map(c => c.localId === colorLocalId ? { ...c, swatchUrl: url } : c),
      } : s));
    } catch {
      toast({ title: "Swatch upload failed", variant: "destructive" });
    } finally {
      setUploading(prev => ({ ...prev, [`${sizeLocalId}-${colorLocalId}`]: false }));
    }
  }, [toast]);

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Variant Palettes</DialogTitle>
          <DialogDescription>Configure size + colour options for this category per product tag.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 items-center mb-2">
          <Label className="text-xs shrink-0">Tag:</Label>
          <Select value={activeConfigTagId} onValueChange={setActiveConfigTagId}>
            <SelectTrigger className="h-8 text-xs" data-testid="select-variant-config-tag">
              <SelectValue placeholder="Select a tag..." />
            </SelectTrigger>
            <SelectContent>
              {allTags.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {configForActiveTag && (
            <Button size="sm" variant="destructive" className="h-8 text-xs"
              onClick={() => { if (confirm("Delete this config?")) deleteMutation.mutate(configForActiveTag.id); }}
              disabled={deleteMutation.isPending}
              data-testid="button-delete-variant-config"
            >
              <Trash2 className="w-3 h-3 mr-1" /> Delete
            </Button>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          <div className="space-y-4">
            {sizes.map((size, si) => (
              <div key={size.localId} className="border rounded-md p-3 space-y-2 bg-muted/30">
                <div className="flex items-center gap-2">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Size Name</Label>
                      <Input value={size.name} onChange={e => setSizes(prev => prev.map((s, i) => i === si ? { ...s, name: e.target.value } : s))}
                        placeholder="e.g. 50x70cm" className="h-7 text-xs mt-0.5" data-testid={`input-size-name-${si}`} />
                    </div>
                    <div>
                      <Label className="text-xs">Price Add (INR)</Label>
                      <Input type="number" value={size.priceAdd}
                        onChange={e => setSizes(prev => prev.map((s, i) => i === si ? { ...s, priceAdd: parseInt(e.target.value) || 0 } : s))}
                        className="h-7 text-xs mt-0.5" data-testid={`input-size-price-${si}`} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setSizes(prev => prev.filter((_, i) => i !== si))} data-testid={`button-remove-size-${si}`}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <Label className="text-xs">Description (optional)</Label>
                    <div className="flex items-center gap-1">
                      <Label className="text-xs text-muted-foreground">Size</Label>
                      <select
                        value={size.descriptionFontSize ?? 12}
                        onChange={e => setSizes(prev => prev.map((s, i) => i === si ? { ...s, descriptionFontSize: parseInt(e.target.value) } : s))}
                        className="h-6 text-xs border border-input rounded px-1 bg-background"
                      >
                        {[10, 11, 12, 13, 14, 16, 18].map(fs => (
                          <option key={fs} value={fs}>{fs}px</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <Input value={size.description || ""} onChange={e => setSizes(prev => prev.map((s, i) => i === si ? { ...s, description: e.target.value } : s))}
                    placeholder="Optional description" className="h-7 text-xs mt-0" />
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <label className="flex items-center gap-1 text-xs cursor-pointer">
                    <Checkbox checked={size.isDefault} onCheckedChange={v => setSizes(prev => prev.map((s, i) => i === si ? { ...s, isDefault: !!v } : s))} />
                    Default
                  </label>
                  <label className="flex items-center gap-1 text-xs cursor-pointer">
                    <Checkbox checked={size.blurOnFront} onCheckedChange={v => setSizes(prev => prev.map((s, i) => i === si ? { ...s, blurOnFront: !!v } : s))} />
                    Hide (blurred in shop)
                  </label>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-medium">Colours</Label>
                    <Button size="sm" variant="outline" className="h-6 text-xs px-2"
                      onClick={() => setSizes(prev => prev.map((s, i) => i === si ? { ...s, colors: [...s.colors, makeLocalColor()] } : s))}
                      data-testid={`button-add-color-${si}`}
                    >
                      <Plus className="w-3 h-3 mr-1" /> Add
                    </Button>
                    {size.colors.length > 0 && (
                      <label className="ml-auto flex items-center gap-1 text-xs cursor-pointer text-muted-foreground">
                        <Checkbox
                          checked={size.colors.every(c => c.blurOnFront)}
                          onCheckedChange={v => setSizes(prev => prev.map((s, i) => i === si
                            ? { ...s, colors: s.colors.map(c => ({ ...c, blurOnFront: !!v })) }
                            : s))}
                          data-testid={`checkbox-hide-all-colors-${si}`}
                        />
                        Hide all
                      </label>
                    )}
                  </div>
                  {size.colors.map((color, ci) => (
                    <div key={color.localId} className="flex items-center gap-2 bg-background rounded p-1.5">
                      <div className="flex-1 grid grid-cols-2 gap-1">
                        <Input value={color.name}
                          onChange={e => setSizes(prev => prev.map((s, i) => i === si ? {
                            ...s, colors: s.colors.map((c, j) => j === ci ? { ...c, name: e.target.value } : c)
                          } : s))}
                          placeholder="Colour name" className="h-6 text-xs" data-testid={`input-color-name-${si}-${ci}`} />
                        <div className="flex items-center gap-1">
                          {color.swatchUrl ? (
                            <img src={color.swatchUrl} alt="" className="w-6 h-6 rounded-full object-cover border" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-muted border" />
                          )}
                          <label className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                            {uploading[`${size.localId}-${color.localId}`] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                            <input type="file" accept="image/*" className="hidden"
                              onChange={e => e.target.files?.[0] && uploadSwatch(e.target.files[0], size.localId, color.localId)} />
                          </label>
                          {color.swatchUrl && (
                            <button onClick={() => setSizes(prev => prev.map((s, i) => i === si ? {
                              ...s, colors: s.colors.map((c, j) => j === ci ? { ...c, swatchUrl: undefined } : c)
                            } : s))} className="text-muted-foreground hover:text-destructive">
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <label className="flex items-center gap-1 text-xs cursor-pointer shrink-0">
                        <Checkbox checked={color.blurOnFront}
                          onCheckedChange={v => setSizes(prev => prev.map((s, i) => i === si ? {
                            ...s, colors: s.colors.map((c, j) => j === ci ? { ...c, blurOnFront: !!v } : c)
                          } : s))} />
                        Hide
                      </label>
                      <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0"
                        onClick={() => setSizes(prev => prev.map((s, i) => i === si ? { ...s, colors: s.colors.filter((_, j) => j !== ci) } : s))}
                        data-testid={`button-remove-color-${si}-${ci}`}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setSizes(prev => [...prev, makeLocalSize({ sortOrder: prev.length })])}
              data-testid="button-add-size"
            >
              <Plus className="w-4 h-4 mr-1" /> Add Size
            </Button>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !activeConfigTagId} data-testid="button-save-variant-config">
            {saveMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : <><Save className="w-4 h-4 mr-1" /> Save Config</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function useAdminLogout() {
  const { toast } = useToast();
  return async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/check"] });
    toast({ title: "Logged out" });
  };
}

export default function AdminCatalog() {
  const { toast } = useToast();
  const [view, setView] = useState<View>("categories");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [editingTag, setEditingTag] = useState<Partial<Tag> | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isNew, setIsNew] = useState(false);
  const [adminSearchQuery, setAdminSearchQuery] = useState("");
  const [adminSearchActive, setAdminSearchActive] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [bulkTagDialogOpen, setBulkTagDialogOpen] = useState(false);
  const [bulkTagNewlyAdding, setBulkTagNewlyAdding] = useState<Set<string>>(new Set());
  const [bulkTagRemoving, setBulkTagRemoving] = useState<Set<string>>(new Set());
  const [bulkTagInitialFull, setBulkTagInitialFull] = useState<Set<string>>(new Set());
  const [bulkTagInitialPartial, setBulkTagInitialPartial] = useState<Set<string>>(new Set());

  type BulkImageSlot = { slotId: string; file: File | null; previewUrl: string | null; sortOrder: number };
  const [bulkImageDialogOpen, setBulkImageDialogOpen] = useState(false);
  const [bulkImageSlots, setBulkImageSlots] = useState<BulkImageSlot[]>([]);
  const [bulkImageProgress, setBulkImageProgress] = useState<string | null>(null);

  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setSelectedProductIds(new Set());
  }, [currentPage, tagFilter, categoryFilter, pageSize]);

  const [variantConfigCategoryId, setVariantConfigCategoryId] = useState<string | null>(null);
  const [reviewDialogProduct, setReviewDialogProduct] = useState<Product | null>(null);
  const [editingReview, setEditingReview] = useState<ProductReview | null>(null);
  const [showAddReviewForm, setShowAddReviewForm] = useState(false);
  const emptyReviewForm = { reviewerName: "", rating: 5, title: "", body: "", amzReviewDate: "" };
  const [reviewForm, setReviewForm] = useState(emptyReviewForm);

  const { data: categories, isLoading: catsLoading } = useQuery<Category[]>({
    queryKey: ["/api/admin/categories"],
  });

  const { data: allProducts } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const productCountByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    if (allProducts) {
      for (const p of allProducts) {
        counts[p.categoryId] = (counts[p.categoryId] || 0) + 1;
      }
    }
    return counts;
  }, [allProducts]);

  const { data: products, isLoading: prodsLoading } = useQuery<Product[]>({
    queryKey: ["/api/admin/products/category", selectedCategory?.id],
    queryFn: async () => {
      if (!selectedCategory) return [];
      const res = await fetch(`/api/admin/products/category/${selectedCategory.id}`);
      return res.json();
    },
    enabled: !!selectedCategory,
  });

  const { data: productTagMap } = useQuery<Record<string, string[]>>({
    queryKey: ["/api/admin/categories", selectedCategory?.id, "product-tags"],
    queryFn: async () => {
      if (!selectedCategory) return {};
      const res = await fetch(`/api/admin/categories/${selectedCategory.id}/product-tags`);
      return res.json();
    },
    enabled: !!selectedCategory,
  });

  const { data: searchResults, isLoading: searchLoading } = useQuery<Product[]>({
    queryKey: ["/api/admin/products/search", adminSearchQuery],
    queryFn: async () => {
      if (!adminSearchQuery.trim()) return [];
      const res = await apiRequest("GET", `/api/admin/products/search?q=${encodeURIComponent(adminSearchQuery.trim())}`);
      return res.json();
    },
    enabled: adminSearchActive && adminSearchQuery.trim().length >= 2,
  });

  const { data: productImages } = useQuery<ProductImage[]>({
    queryKey: ["/api/products", editingProduct?.id, "images"],
    queryFn: async () => {
      if (!editingProduct?.id) return [];
      const res = await fetch(`/api/products/${editingProduct.id}/images`);
      return res.json();
    },
    enabled: !!editingProduct?.id && view === "edit-product",
  });

  const { data: productReviews } = useQuery<ProductReview[]>({
    queryKey: ["/api/products", editingProduct?.id, "reviews"],
    queryFn: async () => {
      if (!editingProduct?.id) return [];
      const res = await fetch(`/api/products/${editingProduct.id}/reviews`);
      return res.json();
    },
    enabled: !!editingProduct?.id && view === "edit-product",
  });

  const { data: dialogReviews, isLoading: dialogReviewsLoading } = useQuery<ProductReview[]>({
    queryKey: ["/api/products", reviewDialogProduct?.id, "reviews"],
    queryFn: async () => {
      if (!reviewDialogProduct?.id) return [];
      const res = await fetch(`/api/products/${reviewDialogProduct.id}/reviews`);
      return res.json();
    },
    enabled: !!reviewDialogProduct?.id,
  });


  const addDialogReviewMutation = useMutation({
    mutationFn: (data: typeof emptyReviewForm) =>
      apiRequest("POST", `/api/admin/products/${reviewDialogProduct?.id}/reviews`, { ...data, verifiedPurchase: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", reviewDialogProduct?.id, "reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      setShowAddReviewForm(false);
      setReviewForm(emptyReviewForm);
      toast({ title: "Review added" });
    },
  });

  const updateDialogReviewMutation = useMutation({
    mutationFn: (data: typeof emptyReviewForm) =>
      apiRequest("PUT", `/api/admin/products/${reviewDialogProduct?.id}/reviews/${editingReview?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", reviewDialogProduct?.id, "reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      setEditingReview(null);
      setShowAddReviewForm(false);
      setReviewForm(emptyReviewForm);
      toast({ title: "Review updated" });
    },
  });

  const deleteDialogReviewMutation = useMutation({
    mutationFn: (reviewId: string) =>
      apiRequest("DELETE", `/api/admin/products/${reviewDialogProduct?.id}/reviews/${reviewId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", reviewDialogProduct?.id, "reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      toast({ title: "Review deleted" });
    },
  });

  const { data: allTags } = useQuery<Tag[]>({ queryKey: ["/api/admin/tags"] });

  const { data: productTagsList } = useQuery<Tag[]>({
    queryKey: ["/api/admin/products", editingProduct?.id, "tags"],
    queryFn: async () => {
      if (!editingProduct?.id) return [];
      const res = await fetch(`/api/admin/products/${editingProduct.id}/tags`);
      return res.json();
    },
    enabled: !!editingProduct?.id && view === "edit-product",
  });

  useEffect(() => {
    if (productTagsList) {
      setSelectedTagIds(productTagsList.map(t => t.id));
    }
  }, [productTagsList]);

  const saveCategoryMutation = useMutation({
    mutationFn: async (data: Partial<Category>) => {
      if (data.id) {
        const res = await apiRequest("PUT", `/api/admin/categories/${data.id}`, data);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/admin/categories", data);
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: isNew ? "Category created" : "Category updated" });
      setView("categories");
      setEditingCategory(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: "Category deleted" });
      setSelectedCategory(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete category", variant: "destructive" });
    },
  });

  const closeAfterSaveRef = React.useRef(false);

  const saveProductMutation = useMutation({
    mutationFn: async (data: Partial<Product>) => {
      if (data.id) {
        const res = await apiRequest("PUT", `/api/admin/products/${data.id}`, data);
        const product = await res.json();
        await apiRequest("PUT", `/api/admin/products/${data.id}/tags`, { tagIds: selectedTagIds });
        return product;
      } else {
        const res = await apiRequest("POST", "/api/admin/products", data);
        const product = await res.json();
        if (product.id && selectedTagIds.length > 0) {
          await apiRequest("PUT", `/api/admin/products/${product.id}/tags`, { tagIds: selectedTagIds });
        }
        return product;
      }
    },
    onSuccess: (product: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products/category", selectedCategory?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: isNew ? "Product created" : "Product updated" });
      if (closeAfterSaveRef.current || isNew) {
        setView("products");
        setEditingProduct(null);
      } else {
        setEditingProduct((prev: any) => prev ? { ...prev, id: product.id ?? prev.id } : prev);
      }
      closeAfterSaveRef.current = false;
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      closeAfterSaveRef.current = false;
    },
  });

  const saveTagMutation = useMutation({
    mutationFn: async (data: Partial<Tag>) => {
      if (data.id) {
        const res = await apiRequest("PUT", `/api/admin/tags/${data.id}`, data);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/admin/tags", data);
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tags"] });
      toast({ title: isNew ? "Tag created" : "Tag updated" });
      setView("tags");
      setEditingTag(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteTagMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/tags/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tags"] });
      toast({ title: "Tag deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete tag", variant: "destructive" });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products/category", selectedCategory?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Product deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete product", variant: "destructive" });
    },
  });

  const moveProductMutation = useMutation({
    mutationFn: async ({ productId, categoryId }: { productId: string; categoryId: string; categoryName: string }) => {
      await apiRequest("PUT", `/api/admin/products/${productId}`, { categoryId });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products/category", selectedCategory?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products/category", variables.categoryId] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: `Moved to ${variables.categoryName}` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to move product", variant: "destructive" });
    },
  });

  const addImageMutation = useMutation({
    mutationFn: async ({ productId, imageUrl }: { productId: string; imageUrl: string }) => {
      const res = await apiRequest("POST", `/api/admin/products/${productId}/images`, {
        imageUrl,
        sortOrder: (productImages?.length || 0),
        isPrimary: (productImages?.length || 0) === 0,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", editingProduct?.id, "images"] });
      toast({ title: "Image added" });
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: async ({ productId, imageId }: { productId: string; imageId: string }) => {
      await apiRequest("DELETE", `/api/admin/products/${productId}/images/${imageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", editingProduct?.id, "images"] });
      toast({ title: "Image removed" });
    },
  });

  const addReviewMutation = useMutation({
    mutationFn: async ({ productId, review }: { productId: string; review: any }) => {
      const res = await apiRequest("POST", `/api/admin/products/${productId}/reviews`, review);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", editingProduct?.id, "reviews"] });
      toast({ title: "Review added" });
    },
  });

  const deleteReviewMutation = useMutation({
    mutationFn: async ({ productId, reviewId }: { productId: string; reviewId: string }) => {
      await apiRequest("DELETE", `/api/admin/products/${productId}/reviews/${reviewId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", editingProduct?.id, "reviews"] });
      toast({ title: "Review removed" });
    },
  });

  const invalidateBulkTagQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/categories", selectedCategory?.id, "product-tags"] });
  };

  const resetBulkTagDialog = () => {
    setBulkTagDialogOpen(false);
    setBulkTagNewlyAdding(new Set());
    setBulkTagRemoving(new Set());
    setBulkTagInitialFull(new Set());
    setBulkTagInitialPartial(new Set());
  };

  const bulkAddTagsMutation = useMutation({
    mutationFn: async ({ productIds, tagIds }: { productIds: string[]; tagIds: string[] }) => {
      const res = await apiRequest("POST", "/api/admin/products/bulk-add-tags", { productIds, tagIds });
      return res.json() as Promise<{ updated: number }>;
    },
    onSuccess: () => { invalidateBulkTagQueries(); },
  });

  const bulkRemoveTagsMutation = useMutation({
    mutationFn: async ({ productIds, tagIds }: { productIds: string[]; tagIds: string[] }) => {
      const res = await apiRequest("POST", "/api/admin/products/bulk-remove-tags", { productIds, tagIds });
      return res.json() as Promise<{ updated: number }>;
    },
    onSuccess: () => { invalidateBulkTagQueries(); },
  });

  const handleBulkApply = async () => {
    const productIds = Array.from(selectedProductIds);
    const addTagIds = Array.from(bulkTagNewlyAdding);
    const removeTagIds = Array.from(bulkTagRemoving);

    let removeOk = false;
    let addOk = false;
    let removeFailed = false;
    let addFailed = false;

    if (removeTagIds.length > 0) {
      try {
        await bulkRemoveTagsMutation.mutateAsync({ productIds, tagIds: removeTagIds });
        removeOk = true;
      } catch {
        removeFailed = true;
      }
    }
    if (addTagIds.length > 0) {
      try {
        await bulkAddTagsMutation.mutateAsync({ productIds, tagIds: addTagIds });
        addOk = true;
      } catch {
        addFailed = true;
      }
    }

    const parts: string[] = [];
    if (addOk) parts.push(`${addTagIds.length} tag${addTagIds.length !== 1 ? "s" : ""} added`);
    if (removeOk) parts.push(`${removeTagIds.length} tag${removeTagIds.length !== 1 ? "s" : ""} removed`);
    if (addFailed) parts.push("add failed");
    if (removeFailed) parts.push("remove failed");

    const hasError = addFailed || removeFailed;
    toast({
      title: `${parts.join(", ")} for ${selectedProductIds.size} product${selectedProductIds.size !== 1 ? "s" : ""}`,
      variant: hasError ? "destructive" : "default",
    });

    if (!hasError || addOk || removeOk) resetBulkTagDialog();
  };

  const openBulkImageDialog = () => {
    setBulkImageSlots([{ slotId: `slot-${Date.now()}`, file: null, previewUrl: null, sortOrder: 0 }]);
    setBulkImageProgress(null);
    setBulkImageDialogOpen(true);
  };

  const closeBulkImageDialog = () => {
    bulkImageSlots.forEach(s => { if (s.previewUrl) URL.revokeObjectURL(s.previewUrl); });
    setBulkImageDialogOpen(false);
    setBulkImageSlots([]);
    setBulkImageProgress(null);
  };

  const addBulkImageSlot = () => {
    const maxOrder = bulkImageSlots.reduce((m, s) => Math.max(m, s.sortOrder), -1);
    setBulkImageSlots(prev => [...prev, { slotId: `slot-${Date.now()}`, file: null, previewUrl: null, sortOrder: maxOrder + 1 }]);
  };

  const removeBulkImageSlot = (slotId: string) => {
    const slot = bulkImageSlots.find(s => s.slotId === slotId);
    if (slot?.previewUrl) URL.revokeObjectURL(slot.previewUrl);
    setBulkImageSlots(prev => prev.filter(s => s.slotId !== slotId));
  };

  const handleBulkImageFileChange = (slotId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    const oldSlot = bulkImageSlots.find(s => s.slotId === slotId);
    if (oldSlot?.previewUrl) URL.revokeObjectURL(oldSlot.previewUrl);
    const previewUrl = URL.createObjectURL(file);
    setBulkImageSlots(prev => prev.map(s => s.slotId === slotId ? { ...s, file, previewUrl } : s));
  };

  const handleBulkImageSubmit = async () => {
    const filledSlots = bulkImageSlots.filter(s => s.file !== null);
    if (filledSlots.length === 0) return;
    const productIds = Array.from(selectedProductIds);
    setBulkImageProgress(`Uploading ${filledSlots.length} image${filledSlots.length !== 1 ? "s" : ""}…`);
    try {
      const imageSlots: { sortOrder: number; imageUrl: string }[] = [];
      for (const slot of filledSlots) {
        const formData = new FormData();
        formData.append("image", slot.file!);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        if (!uploadRes.ok) throw new Error(`Upload failed for position ${slot.sortOrder}`);
        const { url } = await uploadRes.json();
        imageSlots.push({ sortOrder: slot.sortOrder, imageUrl: url });
      }
      setBulkImageProgress(`Applying to ${productIds.length} product${productIds.length !== 1 ? "s" : ""}…`);
      const res = await apiRequest("POST", "/api/admin/products/bulk-upload-images", { productIds, imageSlots });
      if (!res.ok) throw new Error("Bulk apply failed");
      const { updated } = await res.json() as { updated: number };
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      productIds.forEach(id => queryClient.invalidateQueries({ queryKey: ["/api/products", id, "images"] }));
      toast({ title: `Gallery images applied to ${updated} product${updated !== 1 ? "s" : ""}` });
      closeBulkImageDialog();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed";
      toast({ title: msg, variant: "destructive" });
      setBulkImageProgress(null);
    }
  };

  const handleImageUpload = async (files: FileList) => {
    if (!editingProduct?.id) return;
    let uploaded = 0;
    for (let i = 0; i < files.length; i++) {
      const formData = new FormData();
      formData.append("image", files[i]);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (data.url) {
          addImageMutation.mutate({ productId: editingProduct.id, imageUrl: data.url });
          uploaded++;
        }
      } catch {
        toast({ title: `Failed to upload ${files[i].name}`, variant: "destructive" });
      }
    }
    if (uploaded > 0) {
      toast({ title: `${uploaded} image${uploaded > 1 ? "s" : ""} added` });
    }
  };

  const handleMainImageUpload = async (file: File) => {
    const formData = new FormData();
    formData.append("image", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) {
        setEditingProduct(prev => ({ ...prev!, imageUrl: data.url }));
        toast({ title: "Main image updated — save to apply" });
      }
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    }
  };

  const mapLegacyAudience = (val: string | null | undefined): string => {
    if (!val) return "";
    const map: Record<string, string> = { kids: "boy,girl", adults: "adult", couples: "couple" };
    return map[val] || val;
  };

  function generateSlug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  }

  // ── Category List View ──
  if (view === "categories") {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold" data-testid="text-cms-title">Content Management</h1>
            <p className="text-sm text-muted-foreground">Manage categories and products</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href="/admin">
              <Button variant="ghost" size="sm" data-testid="link-dashboard">
                <ChevronLeft className="w-4 h-4 mr-1" /> Dashboard
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setView("tags")}
              data-testid="button-tags"
            >
              <TagIcon className="w-4 h-4 mr-1" /> Tags
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setIsNew(true);
                setEditingCategory({ name: "", slug: "", description: "", imageUrl: "", sortOrder: (categories?.length || 0) + 1 });
                setView("edit-category");
              }}
              data-testid="button-add-category"
            >
              <Plus className="w-4 h-4 mr-1" /> Add Category
            </Button>
          </div>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search all products by name, SKU..."
            value={adminSearchQuery}
            onChange={(e) => {
              setAdminSearchQuery(e.target.value);
              setAdminSearchActive(e.target.value.trim().length >= 2);
            }}
            className="pl-9 pr-9"
            data-testid="input-admin-search"
          />
          {adminSearchQuery && (
            <button
              onClick={() => { setAdminSearchQuery(""); setAdminSearchActive(false); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              data-testid="button-clear-admin-search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {adminSearchActive && adminSearchQuery.trim().length >= 2 ? (
          searchLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-2">{searchResults?.length || 0} results for "{adminSearchQuery}"</p>
              {searchResults?.map((prod) => {
                const cat = categories?.find(c => c.id === prod.categoryId);
                return (
                  <Card key={prod.id} className="p-3" data-testid={`card-search-product-${prod.id}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-md overflow-hidden bg-muted flex-shrink-0">
                        <img src={getProductImageUrl(prod.imageUrl, "small")} alt={prod.name} className="w-full h-full object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-sm truncate">{prod.name}</p>
                          {!prod.active && (
                            <Badge variant="secondary" className="text-[10px] no-default-hover-elevate no-default-active-elevate">
                              <EyeOff className="w-2.5 h-2.5 mr-0.5" /> Hidden
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {prod.sku && <span className="font-mono mr-2">{prod.sku}</span>}
                          ₹{prod.price.toLocaleString("en-IN")}
                          {cat && <span className="ml-2 text-muted-foreground">in {cat.name}</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" data-testid={`button-move-search-${prod.id}`}>
                              <ArrowRightLeft className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {categories?.filter(c => c.id !== prod.categoryId).map(c => (
                              <DropdownMenuItem
                                key={c.id}
                                onClick={() => moveProductMutation.mutate({ productId: prod.id, categoryId: c.id, categoryName: c.name })}
                              >
                                {c.name}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => { window.open(`/admin/catalog/product/${prod.id}`, '_blank'); window.focus(); }}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
              {searchResults?.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No products match your search</p>
                </div>
              )}
            </div>
          )
        ) : catsLoading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
        ) : (
          <div className="space-y-2">
            {categories?.map((cat) => (
              <Card
                key={cat.id}
                className="p-3 hover-elevate cursor-pointer"
                onClick={() => { setSelectedCategory(cat); setCategoryFilter(""); setCurrentPage(1); setView("products"); }}
                data-testid={`card-category-${cat.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
                    {cat.imageUrl && (
                      <img src={getProductImageUrl(cat.imageUrl, "small")} alt={cat.name} className="w-full h-full object-contain" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate" data-testid={`text-category-name-${cat.id}`}>{cat.name}</p>
                      <Badge variant="secondary" className="text-xs" data-testid={`badge-category-count-${cat.id}`}>
                        {productCountByCategory[cat.id] || 0} items
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{cat.description}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setVariantConfigCategoryId(cat.id);
                      }}
                      title="Variant Palettes"
                      data-testid={`button-palettes-category-${cat.id}`}
                    >
                      <Palette className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsNew(false);
                        setEditingCategory({ ...cat });
                        setView("edit-category");
                      }}
                      data-testid={`button-edit-category-${cat.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete "${cat.name}" and all its products?`)) {
                          deleteCategoryMutation.mutate(cat.id);
                        }
                      }}
                      data-testid={`button-delete-category-${cat.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </Card>
            ))}
            {categories?.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <FolderOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No categories yet</p>
              </div>
            )}
          </div>
        )}
        {variantConfigCategoryId && (
          <VariantConfigModal
            open={!!variantConfigCategoryId}
            onClose={() => setVariantConfigCategoryId(null)}
            categoryId={variantConfigCategoryId}
            allTags={allTags ?? []}
          />
        )}
      </div>
    );
  }

  // ── Edit Category View ──
  if (view === "edit-category" && editingCategory) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => { setView("categories"); setEditingCategory(null); }} data-testid="button-back-categories">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Categories
        </Button>
        <h1 className="text-xl font-bold mb-4" data-testid="text-edit-category-title">
          {isNew ? "New Category" : "Edit Category"}
        </h1>

        <div className="space-y-4">
          <div>
            <Label htmlFor="cat-name">Name</Label>
            <Input
              id="cat-name"
              value={editingCategory.name || ""}
              onChange={(e) => {
                const name = e.target.value;
                setEditingCategory(prev => ({
                  ...prev!,
                  name,
                  ...(isNew ? { slug: generateSlug(name) } : {}),
                }));
              }}
              data-testid="input-category-name"
            />
          </div>
          <div>
            <Label htmlFor="cat-slug">Slug</Label>
            <Input
              id="cat-slug"
              value={editingCategory.slug || ""}
              onChange={(e) => setEditingCategory(prev => ({ ...prev!, slug: e.target.value }))}
              data-testid="input-category-slug"
            />
          </div>
          <div>
            <Label htmlFor="cat-desc">Description</Label>
            <Textarea
              id="cat-desc"
              value={editingCategory.description || ""}
              onChange={(e) => setEditingCategory(prev => ({ ...prev!, description: e.target.value }))}
              data-testid="input-category-description"
            />
          </div>
          <div>
            <Label htmlFor="cat-image">Image URL</Label>
            <Input
              id="cat-image"
              value={editingCategory.imageUrl || ""}
              onChange={(e) => setEditingCategory(prev => ({ ...prev!, imageUrl: e.target.value }))}
              placeholder="/images/products/example.jpg"
              data-testid="input-category-image"
            />
            {editingCategory.imageUrl && (
              <div className="mt-2 w-24 h-24 rounded-md overflow-hidden bg-muted">
                <img src={editingCategory.imageUrl} alt="Preview" className="w-full h-full object-contain" />
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="cat-sort">Sort Order</Label>
            <Input
              id="cat-sort"
              type="number"
              value={editingCategory.sortOrder || 0}
              onChange={(e) => setEditingCategory(prev => ({ ...prev!, sortOrder: parseInt(e.target.value) || 0 }))}
              data-testid="input-category-sort"
            />
          </div>
          <Button
            className="w-full"
            onClick={() => saveCategoryMutation.mutate(editingCategory)}
            disabled={saveCategoryMutation.isPending || !editingCategory.name || !editingCategory.slug}
            data-testid="button-save-category"
          >
            {saveCategoryMutation.isPending ? "Saving..." : isNew ? "Create Category" : "Save Changes"}
          </Button>

        </div>
      </div>
    );
  }

  // ── Products List View ──
  if (view === "products" && selectedCategory) {
    const filteredProducts = products?.filter((p) => {
      if (categoryFilter.trim()) {
        const q = categoryFilter.trim().toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !(p.sku && p.sku.toLowerCase().includes(q))) return false;
      }
      if (tagFilter !== "all") {
        const productTagIds = productTagMap?.[p.id] || [];
        if (!productTagIds.includes(tagFilter)) return false;
      }
      return true;
    }) || [];
    const totalFiltered = filteredProducts.length;
    const totalPages = pageSize === 0 ? 1 : Math.ceil(totalFiltered / pageSize);
    const safePage = Math.min(currentPage, totalPages || 1);
    const paginatedProducts = pageSize === 0 ? filteredProducts : filteredProducts.slice((safePage - 1) * pageSize, safePage * pageSize);
    const allSelected = paginatedProducts.length > 0 && paginatedProducts.every(p => selectedProductIds.has(p.id));
    const someSelected = selectedProductIds.size > 0;

    return (
      <>
      <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => { setView("categories"); setSelectedCategory(null); setSelectedProductIds(new Set()); setCategoryFilter(""); setTagFilter("all"); }} data-testid="button-back-categories-from-products">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Categories
        </Button>

        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold" data-testid="text-products-title">{selectedCategory.name}</h1>
            <p className="text-sm text-muted-foreground">
              {totalFiltered} product{totalFiltered !== 1 ? "s" : ""}
              {pageSize > 0 && totalPages > 1 && ` · page ${safePage} of ${totalPages}`}
              {someSelected && <span className="ml-2 font-medium text-foreground">· {selectedProductIds.size} selected</span>}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {someSelected && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const ids = Array.from(selectedProductIds);
                    const fullSet = new Set<string>();
                    const partialSet = new Set<string>();
                    (allTags || []).forEach(tag => {
                      const count = ids.filter(id => productTagMap?.[id]?.includes(tag.id)).length;
                      if (count === ids.length) fullSet.add(tag.id);
                      else if (count > 0) partialSet.add(tag.id);
                    });
                    setBulkTagInitialFull(fullSet);
                    setBulkTagInitialPartial(partialSet);
                    setBulkTagNewlyAdding(new Set());
                    setBulkTagRemoving(new Set());
                    setBulkTagDialogOpen(true);
                  }}
                  data-testid="button-bulk-tag"
                >
                  <TagIcon className="w-4 h-4 mr-1" />
                  Tag {selectedProductIds.size}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={openBulkImageDialog}
                  data-testid="button-bulk-upload-images"
                >
                  <Images className="w-4 h-4 mr-1" />
                  Bulk Upload Images
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={selectedProductIds.size > 15}
                  onClick={() => {
                    const ids = Array.from(selectedProductIds);
                    ids.forEach((id) => {
                      const a = document.createElement('a');
                      a.href = `/admin/catalog/product/${id}`;
                      a.target = '_blank';
                      a.rel = 'noopener';
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    });
                    window.focus();
                  }}
                  data-testid="button-bulk-edit"
                >
                  <Pencil className="w-4 h-4 mr-1" />
                  {selectedProductIds.size > 15 ? "Max 15" : `Edit ${selectedProductIds.size}`}
                </Button>
              </>
            )}
            <Button
              size="sm"
              onClick={() => {
                setIsNew(true);
                setEditingProduct({
                  name: "",
                  slug: "",
                  description: "",
                  price: 999,
                  mrp: undefined,
                  imageUrl: "/images/products/placeholder.jpg",
                  categoryId: selectedCategory.id,
                  active: true,
                  sortOrder: (products?.length || 0) + 1,
                  material: "Cotton",
                  gsm: 500,
                  dimensions: "120 x 60 cm",
                  audience: "kids",
                  productType: "towel",
                });
                setView("edit-product");
              }}
              data-testid="button-add-product"
            >
              <Plus className="w-4 h-4 mr-1" /> Add Product
            </Button>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Filter products in this category..."
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
              className="pl-9 pr-9"
              data-testid="input-category-filter"
            />
            {categoryFilter && (
              <button
                onClick={() => setCategoryFilter("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                data-testid="button-clear-category-filter"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {allTags && allTags.length > 0 && (
            <Select
              value={tagFilter}
              onValueChange={(val) => { setTagFilter(val); setCurrentPage(1); }}
              data-testid="select-tag-filter"
            >
              <SelectTrigger className="w-44 shrink-0" data-testid="trigger-tag-filter">
                <TagIcon className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="All tags" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tags</SelectItem>
                {allTags.map(tag => (
                  <SelectItem key={tag.id} value={tag.id} data-testid={`tag-filter-option-${tag.id}`}>
                    {tag.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {pageSize > 0 && totalPages > 1 && (
          <div className="flex items-center justify-end gap-1 mb-2" data-testid="pagination-controls-top">
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage(safePage - 1)}
              data-testid="button-prev-page-top"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs text-muted-foreground px-2" data-testid="text-page-info-top">
              {safePage} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage(safePage + 1)}
              data-testid="button-next-page-top"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {prodsLoading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1 py-1">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedProductIds(prev => {
                      const next = new Set(prev);
                      paginatedProducts.forEach(p => next.add(p.id));
                      return next;
                    });
                  } else {
                    setSelectedProductIds(prev => {
                      const next = new Set(prev);
                      paginatedProducts.forEach(p => next.delete(p.id));
                      return next;
                    });
                  }
                }}
                data-testid="checkbox-select-all"
              />
              <span className="text-xs text-muted-foreground">Select all on this page</span>
            </div>
            {paginatedProducts.map((prod) => (
              <Card key={prod.id} className="p-3" data-testid={`card-product-${prod.id}`}>
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selectedProductIds.has(prod.id)}
                    onCheckedChange={(checked) => {
                      setSelectedProductIds(prev => {
                        const next = new Set(prev);
                        if (checked) next.add(prod.id);
                        else next.delete(prod.id);
                        return next;
                      });
                    }}
                    data-testid={`checkbox-product-${prod.id}`}
                  />
                  <div className="w-10 h-10 rounded-md overflow-hidden bg-muted flex-shrink-0">
                    <img src={getProductImageUrl(prod.imageUrl, "small")} alt={prod.name} className="w-full h-full object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <a href={`/product/${prod.slug}`} target="_blank" rel="noopener noreferrer" className="font-medium text-sm truncate hover:underline text-foreground" data-testid={`text-product-name-${prod.id}`}>{prod.name}</a>
                      {!prod.active && (
                        <Badge variant="secondary" className="text-[10px] no-default-hover-elevate no-default-active-elevate">
                          <EyeOff className="w-2.5 h-2.5 mr-0.5" /> Hidden
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {prod.sku && <span className="font-mono mr-2">{prod.sku}</span>}
                      ₹{prod.price.toLocaleString("en-IN")}
                      {prod.mrp && prod.mrp > prod.price && (
                        <span className="ml-1 line-through">₹{prod.mrp.toLocaleString("en-IN")}</span>
                      )}
                      {prod.material && <span className="ml-2">{prod.material}</span>}
                      {prod.gsm && <span className="ml-1">{prod.gsm} GSM</span>}
                      {prod.reviewCount != null && prod.averageRating != null && (
                        <button
                          type="button"
                          className="ml-2 inline-flex items-center gap-0.5 hover:opacity-70 transition-opacity cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); setReviewDialogProduct(prod as Product); setShowAddReviewForm(false); setEditingReview(null); setReviewForm(emptyReviewForm); }}
                          data-testid={`button-reviews-${prod.id}`}
                          title="Manage reviews"
                        >
                          {[1,2,3,4,5].map(s => (
                            <Star key={s} className={`w-3 h-3 ${s <= Math.round(prod.averageRating!) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                          ))}
                          <span className="text-amber-600 font-medium ml-0.5">{prod.averageRating} ({prod.reviewCount})</span>
                        </button>
                      )}
                    </p>
                    <div className="mt-1">
                      <ProductTagSelector productId={prod.id} categoryId={selectedCategory?.id ?? ""} allTags={allTags || []} />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" data-testid={`button-move-product-${prod.id}`}>
                          <ArrowRightLeft className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {categories?.filter(c => c.id !== prod.categoryId).map(cat => (
                          <DropdownMenuItem
                            key={cat.id}
                            onClick={() => moveProductMutation.mutate({ productId: prod.id, categoryId: cat.id, categoryName: cat.name })}
                            data-testid={`option-move-${prod.id}-${cat.id}`}
                          >
                            {cat.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => { window.open(`/admin/catalog/product/${prod.id}`, '_blank'); window.focus(); }}
                      data-testid={`button-edit-product-${prod.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Delete "${prod.name}"?`)) {
                          deleteProductMutation.mutate(prod.id);
                        }
                      }}
                      data-testid={`button-delete-product-${prod.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <ProductImageManager productId={prod.id} mainImageUrl={prod.imageUrl} />
              </Card>
            ))}
            {products?.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No products in this category</p>
              </div>
            )}

            {totalFiltered > 0 && (
              <div className="flex items-center gap-2 px-1 py-1 pt-4 border-t mt-4">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedProductIds(prev => {
                        const next = new Set(prev);
                        paginatedProducts.forEach(p => next.add(p.id));
                        return next;
                      });
                    } else {
                      setSelectedProductIds(prev => {
                        const next = new Set(prev);
                        paginatedProducts.forEach(p => next.delete(p.id));
                        return next;
                      });
                    }
                  }}
                  data-testid="checkbox-select-all-bottom"
                />
                <span className="text-xs text-muted-foreground">Select all on this page</span>
              </div>
            )}

            {totalFiltered > 0 && (
              <div className="flex items-center justify-between pt-2" data-testid="pagination-controls">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Show</span>
                  <Select
                    value={pageSize === 0 ? "all" : String(pageSize)}
                    onValueChange={(val) => {
                      setPageSize(val === "all" ? 0 : Number(val));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-20 h-8 text-xs" data-testid="select-page-size">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="all">All</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">
                    of {totalFiltered} products
                  </span>
                </div>
                {pageSize > 0 && totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0"
                      disabled={safePage <= 1}
                      onClick={() => setCurrentPage(safePage - 1)}
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground px-2" data-testid="text-page-info">
                      {safePage} / {totalPages}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0"
                      disabled={safePage >= totalPages}
                      onClick={() => setCurrentPage(safePage + 1)}
                      data-testid="button-next-page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bulk Tag Dialog */}
      <Dialog open={bulkTagDialogOpen} onOpenChange={(open) => { if (!open) resetBulkTagDialog(); }}>
        <DialogContent className="max-w-sm" data-testid="dialog-bulk-tag">
          <DialogHeader>
            <DialogTitle>Manage Tags for {selectedProductIds.size} Product{selectedProductIds.size !== 1 ? "s" : ""}</DialogTitle>
            <DialogDescription>Click a tag to toggle it. Mixed tags (some products have it) go to adding on first click. Fully-present tags go to removing on first click.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-3 text-sm">
              <button
                className="text-primary underline underline-offset-2"
                onClick={() => {
                  const allTagIds = new Set((allTags || []).map(t => t.id));
                  const toAdd = new Set([...allTagIds].filter(id => !bulkTagInitialFull.has(id) && !bulkTagInitialPartial.has(id)));
                  setBulkTagNewlyAdding(toAdd);
                  setBulkTagRemoving(new Set());
                }}
                data-testid="button-bulk-tag-select-all"
              >
                Select all
              </button>
              <button
                className="text-muted-foreground underline underline-offset-2"
                onClick={() => {
                  setBulkTagRemoving(new Set([...bulkTagInitialFull, ...bulkTagInitialPartial]));
                  setBulkTagNewlyAdding(new Set());
                }}
                data-testid="button-bulk-tag-deselect-all"
              >
                Deselect all
              </button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {allTags && allTags.length > 0 ? allTags.map(tag => {
                const isRemoving = bulkTagRemoving.has(tag.id);
                const isAdding = bulkTagNewlyAdding.has(tag.id);
                const isFullPre = bulkTagInitialFull.has(tag.id) && !isRemoving;
                const isPartialPre = bulkTagInitialPartial.has(tag.id) && !isRemoving && !isAdding;
                const isChecked = isFullPre || isPartialPre || isAdding;
                const tagCount = Array.from(selectedProductIds).filter(pid => (productTagMap?.[pid] || []).includes(tag.id)).length;

                const handleClick = () => {
                  if (isAdding) {
                    setBulkTagNewlyAdding(prev => { const s = new Set(prev); s.delete(tag.id); return s; });
                  } else if (isRemoving) {
                    setBulkTagRemoving(prev => { const s = new Set(prev); s.delete(tag.id); return s; });
                  } else if (isFullPre) {
                    setBulkTagRemoving(prev => { const s = new Set(prev); s.add(tag.id); return s; });
                  } else {
                    setBulkTagNewlyAdding(prev => { const s = new Set(prev); s.add(tag.id); return s; });
                  }
                };

                return (
                  <label
                    key={tag.id}
                    className={`flex items-center gap-2 cursor-pointer py-0.5 ${isPartialPre ? "opacity-50" : ""}`}
                    data-testid={`bulk-tag-option-${tag.id}`}
                    title={isPartialPre ? "Present on some selected products" : isRemoving ? "Will be removed from all selected products" : undefined}
                    onClick={(e) => { e.preventDefault(); handleClick(); }}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => {}}
                      className="pointer-events-none"
                    />
                    <span className={`text-sm ${isRemoving ? "line-through text-red-500/70" : ""}`}>{tag.name}</span>
                    {isPartialPre && <span className="text-xs text-muted-foreground ml-auto">mixed ({tagCount}/{selectedProductIds.size})</span>}
                    {isAdding && <span className="text-xs text-green-600/80 ml-auto">{selectedProductIds.size} selected</span>}
                    {isRemoving && <span className="text-xs text-red-500/70 ml-auto">will remove</span>}
                  </label>
                );
              }) : (
                <p className="text-sm text-muted-foreground">No tags available. Create tags first.</p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={resetBulkTagDialog} data-testid="button-bulk-tag-cancel">
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={(bulkTagNewlyAdding.size === 0 && bulkTagRemoving.size === 0) || bulkAddTagsMutation.isPending || bulkRemoveTagsMutation.isPending}
                onClick={handleBulkApply}
                data-testid="button-bulk-tag-apply"
              >
                {(bulkAddTagsMutation.isPending || bulkRemoveTagsMutation.isPending) ? "Applying…" : `Apply to ${selectedProductIds.size}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Image Upload Dialog */}
      <Dialog open={bulkImageDialogOpen} onOpenChange={(open) => { if (!open) closeBulkImageDialog(); }}>
        <DialogContent className="max-w-md" data-testid="dialog-bulk-upload-images">
          <DialogHeader>
            <DialogTitle>Upload Gallery Images for {selectedProductIds.size} Product{selectedProductIds.size !== 1 ? "s" : ""}</DialogTitle>
            <DialogDescription>
              Each image slot will replace that position across all selected products. Position 1 (hero) is never changed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {bulkImageSlots.map((slot, idx) => (
              <div key={slot.slotId} className="flex items-center gap-3" data-testid={`bulk-image-slot-${idx}`}>
                <div className="text-xs font-medium text-muted-foreground w-16 shrink-0">
                  Position {slot.sortOrder + 2}
                </div>
                <label className="flex-1 cursor-pointer">
                  <div className={`flex items-center gap-2 border rounded-md px-3 py-2 text-sm hover:bg-muted/50 transition-colors ${slot.file ? "border-primary/40 bg-muted/30" : "border-dashed"}`}>
                    {slot.previewUrl ? (
                      <img src={slot.previewUrl} alt="" className="w-8 h-8 object-cover rounded" />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="truncate text-xs">{slot.file ? slot.file.name : "Click to choose image"}</span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleBulkImageFileChange(slot.slotId, e)}
                    data-testid={`input-bulk-image-slot-${idx}`}
                  />
                </label>
                {bulkImageSlots.length > 1 && (
                  <button
                    onClick={() => removeBulkImageSlot(slot.slotId)}
                    className="text-muted-foreground hover:text-destructive p-1 shrink-0"
                    data-testid={`button-remove-slot-${idx}`}
                    title="Remove slot"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}

            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={addBulkImageSlot}
              disabled={!!bulkImageProgress}
              data-testid="button-add-image-slot"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add another slot
            </Button>

            {bulkImageProgress && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="text-bulk-image-progress">
                <Loader2 className="w-4 h-4 animate-spin" />
                {bulkImageProgress}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={closeBulkImageDialog}
                disabled={!!bulkImageProgress}
                data-testid="button-bulk-image-cancel"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={bulkImageSlots.every(s => !s.file) || !!bulkImageProgress}
                onClick={handleBulkImageSubmit}
                data-testid="button-bulk-image-apply"
              >
                {bulkImageProgress ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Apply to {selectedProductIds.size} product{selectedProductIds.size !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Review Management Dialog */}
      <Dialog open={!!reviewDialogProduct} onOpenChange={(open) => { if (!open) { setReviewDialogProduct(null); setEditingReview(null); setShowAddReviewForm(false); setReviewForm(emptyReviewForm); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-base">Reviews — {reviewDialogProduct?.name}</DialogTitle>
            <DialogDescription className="text-xs">{dialogReviews?.length || 0} review{(dialogReviews?.length || 0) !== 1 ? "s" : ""}</DialogDescription>
          </DialogHeader>

          {/* Add / Edit Form */}
          {(showAddReviewForm || editingReview) && (
            <div className="border rounded-lg p-4 bg-muted/30 space-y-3 shrink-0">
              <p className="text-sm font-medium">{editingReview ? "Edit Review" : "Add Review"}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs mb-1 block">Reviewer Name *</Label>
                  <Input
                    value={reviewForm.reviewerName}
                    onChange={(e) => setReviewForm(f => ({ ...f, reviewerName: e.target.value }))}
                    placeholder="e.g. Priya S."
                    className="h-8 text-sm"
                    data-testid="input-review-name"
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Date</Label>
                  <Input
                    value={reviewForm.amzReviewDate}
                    onChange={(e) => setReviewForm(f => ({ ...f, amzReviewDate: e.target.value }))}
                    placeholder="e.g. 12 March 2025"
                    className="h-8 text-sm"
                    data-testid="input-review-date"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Rating</Label>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(s => (
                    <button key={s} type="button" onClick={() => setReviewForm(f => ({ ...f, rating: s }))}>
                      <Star className={`w-5 h-5 ${s <= reviewForm.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Title</Label>
                <Input
                  value={reviewForm.title}
                  onChange={(e) => setReviewForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Review headline"
                  className="h-8 text-sm"
                  data-testid="input-review-title"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Review Text *</Label>
                <Textarea
                  value={reviewForm.body}
                  onChange={(e) => setReviewForm(f => ({ ...f, body: e.target.value }))}
                  placeholder="What did the customer say?"
                  className="text-sm min-h-[70px]"
                  data-testid="input-review-body"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    if (!reviewForm.reviewerName.trim() || !reviewForm.body.trim()) {
                      toast({ title: "Reviewer name and review text are required", variant: "destructive" });
                      return;
                    }
                    if (editingReview) {
                      updateDialogReviewMutation.mutate(reviewForm);
                    } else {
                      addDialogReviewMutation.mutate(reviewForm);
                    }
                  }}
                  disabled={addDialogReviewMutation.isPending || updateDialogReviewMutation.isPending}
                  data-testid="button-save-review"
                >
                  {(addDialogReviewMutation.isPending || updateDialogReviewMutation.isPending) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span className="ml-1">{editingReview ? "Update" : "Add"}</span>
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowAddReviewForm(false); setEditingReview(null); setReviewForm(emptyReviewForm); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Reviews List */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-2 pr-3">
              {dialogReviewsLoading && <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>}
              {!dialogReviewsLoading && (!dialogReviews || dialogReviews.length === 0) && (
                <p className="text-sm text-muted-foreground py-4 text-center">No reviews yet</p>
              )}
              {dialogReviews?.map((review) => (
                <div key={review.id} className="border rounded-lg p-3 text-sm" data-testid={`card-dialog-review-${review.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{review.reviewerName}</span>
                        <div className="flex gap-0.5">
                          {[1,2,3,4,5].map(s => (
                            <Star key={s} className={`w-3 h-3 ${s <= review.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                          ))}
                        </div>
                        {review.amzReviewDate && <span className="text-xs text-muted-foreground">{review.amzReviewDate}</span>}
                      </div>
                      {review.title && <p className="text-xs font-medium mt-1">{review.title}</p>}
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-3">{review.body}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => {
                          setEditingReview(review);
                          setShowAddReviewForm(false);
                          setReviewForm({
                            reviewerName: review.reviewerName,
                            rating: review.rating,
                            title: review.title || "",
                            body: review.body,
                            amzReviewDate: review.amzReviewDate || "",
                          });
                        }}
                        data-testid={`button-edit-review-${review.id}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => deleteDialogReviewMutation.mutate(review.id)}
                        disabled={deleteDialogReviewMutation.isPending}
                        data-testid={`button-delete-dialog-review-${review.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Footer */}
          {!showAddReviewForm && !editingReview && (
            <div className="pt-3 border-t shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setShowAddReviewForm(true); setEditingReview(null); setReviewForm(emptyReviewForm); }}
                data-testid="button-add-new-review"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Review
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </>
    );
  }

  // ── Edit Product View ──
  if (view === "edit-product" && editingProduct) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => { setView("products"); setEditingProduct(null); }} data-testid="button-back-products">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Products
        </Button>
        <h1 className="text-xl font-bold mb-4" data-testid="text-edit-product-title">
          {isNew ? "New Product" : "Edit Product"}
        </h1>

        <div className="space-y-4">
          <div>
            <Label htmlFor="prod-name">Product Name</Label>
            <Input
              id="prod-name"
              value={editingProduct.name || ""}
              onChange={(e) => {
                const name = e.target.value;
                setEditingProduct(prev => ({
                  ...prev!,
                  name,
                  ...(isNew ? { slug: generateSlug(name) } : {}),
                }));
              }}
              data-testid="input-product-name"
            />
          </div>

          <div>
            <Label htmlFor="prod-slug">Slug</Label>
            <Input
              id="prod-slug"
              value={editingProduct.slug || ""}
              onChange={(e) => setEditingProduct(prev => ({ ...prev!, slug: e.target.value }))}
              data-testid="input-product-slug"
            />
          </div>

          <div>
            <Label htmlFor="prod-desc">Description</Label>
            <Textarea
              id="prod-desc"
              value={editingProduct.description || ""}
              onChange={(e) => setEditingProduct(prev => ({ ...prev!, description: e.target.value }))}
              data-testid="input-product-description"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="prod-price">Price (₹)</Label>
              <Input
                id="prod-price"
                type="number"
                value={editingProduct.price || ""}
                onChange={(e) => setEditingProduct(prev => ({ ...prev!, price: parseInt(e.target.value) || 0 }))}
                data-testid="input-product-price"
              />
            </div>
            <div>
              <Label htmlFor="prod-mrp">MRP (₹)</Label>
              <Input
                id="prod-mrp"
                type="number"
                value={editingProduct.mrp || ""}
                onChange={(e) => setEditingProduct(prev => ({ ...prev!, mrp: parseInt(e.target.value) || undefined }))}
                data-testid="input-product-mrp"
              />
            </div>
          </div>

          <div>
            <Label className="flex items-center gap-1 mb-2">
              <ImageIcon className="w-4 h-4" /> Product Images
            </Label>
            <div className="flex flex-wrap gap-2">
              {editingProduct.imageUrl && (
                <label className={`relative ${THUMBNAIL_SIZES.adminEditor} rounded-md overflow-visible bg-muted border-2 border-primary/30 cursor-pointer group`} data-testid="thumbnail-main-image">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { if (e.target.files?.[0]) handleMainImageUpload(e.target.files[0]); }}
                  />
                  <img src={getProductImageUrl(editingProduct.imageUrl, "small")} alt="Main" className="w-full h-full object-contain rounded-md" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-md invisible group-hover:visible">
                    <Upload className="w-4 h-4 text-white" />
                  </div>
                  <Badge className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] px-1.5 py-0 no-default-hover-elevate no-default-active-elevate">Main</Badge>
                </label>
              )}
              {editingProduct.id && productImages?.map((img) => (
                <div key={img.id} className={`relative ${THUMBNAIL_SIZES.adminEditor} rounded-md overflow-visible bg-muted group`} data-testid={`thumbnail-image-${img.id}`}>
                  <img src={getProductImageUrl(img.imageUrl, "small")} alt="" className="w-full h-full object-contain rounded-md" />
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteImageMutation.mutate({ productId: editingProduct.id!, imageId: img.id }); }}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center invisible group-hover:visible z-10"
                    data-testid={`button-delete-image-${img.id}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <label className={`${THUMBNAIL_SIZES.adminEditor} rounded-md border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center cursor-pointer hover-elevate`} data-testid="button-upload-image">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => { if (e.target.files?.length) handleImageUpload(e.target.files); }}
                />
                <Upload className="w-5 h-5 text-muted-foreground/50" />
                <span className="text-[10px] text-muted-foreground/50 mt-0.5">Add</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="prod-material">Material</Label>
              <Input
                id="prod-material"
                value={editingProduct.material || ""}
                onChange={(e) => setEditingProduct(prev => ({ ...prev!, material: e.target.value }))}
                data-testid="input-product-material"
              />
            </div>
            <div>
              <Label htmlFor="prod-gsm">GSM</Label>
              <Input
                id="prod-gsm"
                type="number"
                value={editingProduct.gsm || ""}
                onChange={(e) => setEditingProduct(prev => ({ ...prev!, gsm: parseInt(e.target.value) || undefined }))}
                data-testid="input-product-gsm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="prod-dimensions">Dimensions</Label>
              <Input
                id="prod-dimensions"
                value={editingProduct.dimensions || ""}
                onChange={(e) => setEditingProduct(prev => ({ ...prev!, dimensions: e.target.value }))}
                data-testid="input-product-dimensions"
              />
            </div>
            <div>
              <Label htmlFor="prod-color">Color</Label>
              <Input
                id="prod-color"
                value={editingProduct.color || ""}
                onChange={(e) => setEditingProduct(prev => ({ ...prev!, color: e.target.value }))}
                data-testid="input-product-color"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="prod-weight">Weight (grams)</Label>
              <Input
                id="prod-weight"
                type="number"
                value={editingProduct.weightGrams || ""}
                onChange={(e) => setEditingProduct(prev => ({ ...prev!, weightGrams: parseInt(e.target.value) || undefined }))}
                data-testid="input-product-weight"
              />
            </div>
            <div>
              <Label htmlFor="prod-items">Items in Set</Label>
              <Input
                id="prod-items"
                type="number"
                value={editingProduct.itemsInSet || 1}
                onChange={(e) => setEditingProduct(prev => ({ ...prev!, itemsInSet: parseInt(e.target.value) || 1 }))}
                data-testid="input-product-items-in-set"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="prod-quantity">Quantity in Stock</Label>
              <Input
                id="prod-quantity"
                type="number"
                min="0"
                value={editingProduct.quantity ?? 1}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val) && val >= 0) {
                    setEditingProduct(prev => ({ ...prev!, quantity: val }));
                  }
                }}
                data-testid="input-product-quantity"
              />
            </div>
            <div>
              <Label htmlFor="prod-type">Product Type</Label>
              <Select
                value={editingProduct.productType || "towel"}
                onValueChange={(v) => setEditingProduct(prev => ({ ...prev!, productType: v }))}
              >
                <SelectTrigger data-testid="select-product-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="towel">Towel</SelectItem>
                  <SelectItem value="blanket">Blanket</SelectItem>
                  <SelectItem value="bathrobe">Bathrobe</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Audience</Label>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {[
                { value: "infant", label: "Infant" },
                { value: "boy", label: "Boy" },
                { value: "girl", label: "Girl" },
                { value: "teenager", label: "Teenager" },
                { value: "adult", label: "Adult" },
                { value: "couple", label: "Couple" },
              ].map((opt) => {
                const mapped = mapLegacyAudience(editingProduct.audience);
                const audiences = mapped.split(",").map(s => s.trim()).filter(Boolean);
                const checked = audiences.includes(opt.value);
                return (
                  <div key={opt.value} className="flex items-center gap-1.5" data-testid={`audience-checkbox-${opt.value}`}>
                    <Checkbox
                      id={`audience-${opt.value}`}
                      checked={checked}
                      onCheckedChange={(isChecked) => {
                        const currentAudiences = mapLegacyAudience(editingProduct.audience).split(",").map(s => s.trim()).filter(Boolean);
                        const updated = isChecked
                          ? [...currentAudiences, opt.value]
                          : currentAudiences.filter(a => a !== opt.value);
                        setEditingProduct(prev => ({ ...prev!, audience: updated.join(",") }));
                      }}
                    />
                    <Label htmlFor={`audience-${opt.value}`} className="text-sm font-normal cursor-pointer">
                      {opt.label}
                    </Label>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <Label htmlFor="prod-sort">Sort Order</Label>
            <Input
              id="prod-sort"
              type="number"
              value={editingProduct.sortOrder || 0}
              onChange={(e) => setEditingProduct(prev => ({ ...prev!, sortOrder: parseInt(e.target.value) || 0 }))}
              data-testid="input-product-sort"
            />
          </div>

          <div>
            <Label htmlFor="prod-bullets">Bullet Points (one per line)</Label>
            <Textarea
              id="prod-bullets"
              value={(() => {
                try { return JSON.parse(editingProduct.bulletPoints || "[]").join("\n"); } catch { return editingProduct.bulletPoints || ""; }
              })()}
              onChange={(e) => {
                const lines = e.target.value.split("\n").filter(l => l.trim());
                setEditingProduct(prev => ({ ...prev!, bulletPoints: JSON.stringify(lines) }));
              }}
              rows={4}
              placeholder="Enter each bullet point on a new line"
              data-testid="input-product-bullets"
            />
          </div>

          <div>
            <Label htmlFor="prod-features">Special Features (one per line)</Label>
            <Textarea
              id="prod-features"
              value={(() => {
                try { return JSON.parse(editingProduct.specialFeatures || "[]").join("\n"); } catch { return editingProduct.specialFeatures || ""; }
              })()}
              onChange={(e) => {
                const lines = e.target.value.split("\n").filter(l => l.trim());
                setEditingProduct(prev => ({ ...prev!, specialFeatures: JSON.stringify(lines) }));
              }}
              rows={3}
              placeholder="Enter each feature on a new line"
              data-testid="input-product-features"
            />
          </div>

          <div>
            <Label htmlFor="prod-keywords">Search Keywords (one per line)</Label>
            <Textarea
              id="prod-keywords"
              value={(() => {
                try { return JSON.parse(editingProduct.searchKeywords || "[]").join("\n"); } catch { return editingProduct.searchKeywords || ""; }
              })()}
              onChange={(e) => {
                const lines = e.target.value.split("\n").filter(l => l.trim());
                setEditingProduct(prev => ({ ...prev!, searchKeywords: JSON.stringify(lines) }));
              }}
              rows={3}
              placeholder="Enter search terms like: baby towel, kids gift, cotton towel"
              data-testid="input-product-keywords"
            />
          </div>

          <div>
            <Label htmlFor="prod-asin">Amazon ASIN</Label>
            <Input
              id="prod-asin"
              value={editingProduct.amazonAsin || ""}
              onChange={(e) => setEditingProduct(prev => ({ ...prev!, amazonAsin: e.target.value }))}
              data-testid="input-product-asin"
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="prod-active"
              checked={editingProduct.active !== false}
              onCheckedChange={(checked) => setEditingProduct(prev => ({ ...prev!, active: checked }))}
              data-testid="switch-product-active"
            />
            <Label htmlFor="prod-active" className="flex items-center gap-1 text-sm">
              {editingProduct.active !== false ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              {editingProduct.active !== false ? "Active (visible in shop)" : "Hidden (not visible in shop)"}
            </Label>
          </div>

          {allTags && allTags.length > 0 && (
            <div>
              <Label className="flex items-center gap-1 mb-2">
                <TagIcon className="w-4 h-4" /> Tags
              </Label>
              <div className="space-y-2">
                {allTags.map((tag) => (
                  <div key={tag.id} className="flex items-center gap-2" data-testid={`tag-checkbox-${tag.id}`}>
                    <Checkbox
                      id={`tag-${tag.id}`}
                      checked={selectedTagIds.includes(tag.id)}
                      onCheckedChange={(checked) => {
                        setSelectedTagIds(prev =>
                          checked ? [...prev, tag.id] : prev.filter(id => id !== tag.id)
                        );
                      }}
                    />
                    <Label htmlFor={`tag-${tag.id}`} className="text-sm font-normal cursor-pointer">
                      {tag.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isNew ? (
            <Button
              className="w-full"
              onClick={() => {
                closeAfterSaveRef.current = true;
                saveProductMutation.mutate(editingProduct as any);
              }}
              disabled={saveProductMutation.isPending || !editingProduct.name || !editingProduct.slug || !editingProduct.price}
              data-testid="button-save-product"
            >
              {saveProductMutation.isPending ? "Creating..." : "Create Product"}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => {
                  closeAfterSaveRef.current = false;
                  saveProductMutation.mutate(editingProduct as any);
                }}
                disabled={saveProductMutation.isPending || !editingProduct.name || !editingProduct.slug || !editingProduct.price}
                data-testid="button-save-product"
              >
                {saveProductMutation.isPending && !closeAfterSaveRef.current ? "Saving..." : "Save"}
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  closeAfterSaveRef.current = true;
                  saveProductMutation.mutate(editingProduct as any);
                }}
                disabled={saveProductMutation.isPending || !editingProduct.name || !editingProduct.slug || !editingProduct.price}
                data-testid="button-save-close-product"
              >
                {saveProductMutation.isPending && closeAfterSaveRef.current ? "Saving..." : "Save & Close"}
              </Button>
            </div>
          )}


          {/* Reviews Section */}
          {editingProduct.id && (
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="text-sm font-semibold flex items-center gap-1">
                  <Star className="w-4 h-4" /> Customer Reviews ({productReviews?.length || 0})
                </h2>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const name = prompt("Reviewer name:");
                    if (!name) return;
                    const rating = parseInt(prompt("Rating (1-5):") || "5");
                    const title = prompt("Review title:") || "";
                    const body = prompt("Review text:") || "";
                    const date = prompt("Review date (e.g. 15 January 2025):") || "";
                    addReviewMutation.mutate({
                      productId: editingProduct.id!,
                      review: { reviewerName: name, rating, title, body, amzReviewDate: date, verifiedPurchase: true },
                    });
                  }}
                  data-testid="button-add-review"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Review
                </Button>
              </div>
              <div className="space-y-2">
                {productReviews?.map((review) => (
                  <Card key={review.id} className="p-3" data-testid={`card-review-${review.id}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium">{review.reviewerName}</p>
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map(s => (
                              <Star key={s} className={`w-3 h-3 ${s <= review.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                            ))}
                          </div>
                        </div>
                        {review.title && <p className="text-xs font-medium mt-0.5">{review.title}</p>}
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{review.body}</p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteReviewMutation.mutate({ productId: editingProduct.id!, reviewId: review.id })}
                        data-testid={`button-delete-review-${review.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Tags List View ──
  if (view === "tags") {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => setView("categories")} data-testid="button-back-from-tags">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Categories
        </Button>

        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold" data-testid="text-tags-title">Tags</h1>
            <p className="text-sm text-muted-foreground">Manage product tags</p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setIsNew(true);
              setEditingTag({ name: "", description: "" });
              setView("edit-tag");
            }}
            data-testid="button-add-tag"
          >
            <Plus className="w-4 h-4 mr-1" /> Add Tag
          </Button>
        </div>

        <div className="space-y-2">
          {allTags?.map((tag) => (
            <Card key={tag.id} className="p-3" data-testid={`card-tag-${tag.id}`}>
              <div className="flex items-center gap-3">
                <TagIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm" data-testid={`text-tag-name-${tag.id}`}>{tag.name}</p>
                  {tag.description && (
                    <p className="text-xs text-muted-foreground truncate">{tag.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setIsNew(false);
                      setEditingTag({ ...tag });
                      setView("edit-tag");
                    }}
                    data-testid={`button-edit-tag-${tag.id}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Delete tag "${tag.name}"?`)) {
                        deleteTagMutation.mutate(tag.id);
                      }
                    }}
                    data-testid={`button-delete-tag-${tag.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
          {(!allTags || allTags.length === 0) && (
            <div className="text-center py-12 text-muted-foreground">
              <TagIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No tags yet</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Edit Tag View ──
  if (view === "edit-tag" && editingTag) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => { setView("tags"); setEditingTag(null); }} data-testid="button-back-tags">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Tags
        </Button>
        <h1 className="text-xl font-bold mb-4" data-testid="text-edit-tag-title">
          {isNew ? "New Tag" : "Edit Tag"}
        </h1>

        <div className="space-y-4">
          <div>
            <Label htmlFor="tag-name">Name</Label>
            <Input
              id="tag-name"
              value={editingTag.name || ""}
              onChange={(e) => setEditingTag(prev => ({ ...prev!, name: e.target.value }))}
              data-testid="input-tag-name"
            />
          </div>
          <div>
            <Label htmlFor="tag-desc">Description</Label>
            <Textarea
              id="tag-desc"
              value={editingTag.description || ""}
              onChange={(e) => setEditingTag(prev => ({ ...prev!, description: e.target.value }))}
              data-testid="input-tag-description"
            />
          </div>
          <Button
            className="w-full"
            onClick={() => saveTagMutation.mutate(editingTag)}
            disabled={saveTagMutation.isPending || !editingTag.name}
            data-testid="button-save-tag"
          >
            {saveTagMutation.isPending ? "Saving..." : isNew ? "Create Tag" : "Save Changes"}
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
