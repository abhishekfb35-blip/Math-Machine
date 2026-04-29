import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { THUMBNAIL_SIZES } from "@/config/thumbnails";
import {
  ChevronLeft, ChevronRight, Image as ImageIcon, X, Upload, Eye, EyeOff, Star, Tag as TagIcon, Plus, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getProductImageUrl } from "@/lib/imageUtils";
import type { Product, ProductImage, ProductReview, Tag, TagType, ProductVariantOptions } from "@shared/types";

const AGE_GROUP_OPTIONS = ["infant", "kids", "teens", "adults"] as const;
const THEME_OPTIONS = ["animals", "florals", "nature", "abstract", "geometric", "traditional", "sports", "pop-culture"] as const;
const STYLE_OPTIONS = ["minimal", "initials", "monogram", "typographic", "illustrative", "floral-frame", "bold-graphic"] as const;

function toggleCsvValue(csv: string | null | undefined, value: string): string {
  const vals = (csv ?? "").split(",").map(v => v.trim()).filter(Boolean);
  if (vals.includes(value)) return vals.filter(v => v !== value).join(",");
  return [...vals, value].join(",");
}
function parseCsv(csv: string | null | undefined): string[] {
  return (csv ?? "").split(",").map(v => v.trim()).filter(Boolean);
}

export default function AdminProductEdit() {
  const { toast } = useToast();
  const [, params] = useRoute("/admin/catalog/product/:id");
  const [, navigate] = useLocation();
  const productId = params?.id;

  const [product, setProduct] = useState<Partial<Product> | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const closeAfterSaveRef = useRef(false);

  const { data: fetchedProduct, isLoading } = useQuery<Product>({
    queryKey: ["/api/admin/products", productId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/products/${productId}`);
      if (!res.ok) throw new Error("Product not found");
      return res.json();
    },
    enabled: !!productId,
  });

  useEffect(() => {
    if (fetchedProduct && !product) {
      setProduct({ ...fetchedProduct });
    }
  }, [fetchedProduct]);

  const { data: productImages } = useQuery<ProductImage[]>({
    queryKey: ["/api/products", productId, "images"],
    queryFn: async () => {
      const res = await fetch(`/api/products/${productId}/images`);
      return res.json();
    },
    enabled: !!productId,
  });

  const { data: productReviews } = useQuery<ProductReview[]>({
    queryKey: ["/api/products", productId, "reviews"],
    queryFn: async () => {
      const res = await fetch(`/api/products/${productId}/reviews`);
      return res.json();
    },
    enabled: !!productId,
  });

  const { data: productTagsList } = useQuery<Tag[]>({
    queryKey: ["/api/admin/products", productId, "tags"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/products/${productId}/tags`);
      return res.json();
    },
    enabled: !!productId,
  });

  const { data: allTags } = useQuery<Tag[]>({
    queryKey: ["/api/admin/tags"],
  });

  const { data: allTagTypes } = useQuery<TagType[]>({
    queryKey: ["/api/admin/tag-types"],
  });

  useEffect(() => {
    if (productTagsList) {
      setSelectedTagIds(productTagsList.map(t => t.id));
    }
  }, [productTagsList]);

  const { data: variantOptions } = useQuery<ProductVariantOptions>({
    queryKey: ["/api/admin/products", productId, "variant-options"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/products/${productId}/variant-options`);
      return res.json();
    },
    enabled: !!productId,
  });


  const saveProductMutation = useMutation({
    mutationFn: async (data: Partial<Product>) => {
      const res = await apiRequest("PUT", `/api/admin/products/${data.id}`, data);
      const updated = await res.json();
      await apiRequest("PUT", `/api/admin/products/${data.id}/tags`, { tagIds: selectedTagIds });
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products", productId] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Product updated" });
      if (closeAfterSaveRef.current) {
        window.close();
        navigate("/admin/catalog");
      }
      closeAfterSaveRef.current = false;
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      closeAfterSaveRef.current = false;
    },
  });

  const addImageMutation = useMutation({
    mutationFn: async ({ imageUrl }: { imageUrl: string }) => {
      const res = await apiRequest("POST", `/api/admin/products/${productId}/images`, {
        imageUrl,
        sortOrder: (productImages?.length || 0),
        isPrimary: (productImages?.length || 0) === 0,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", productId, "images"] });
      toast({ title: "Image added" });
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: async ({ imageId }: { imageId: string }) => {
      await apiRequest("DELETE", `/api/admin/products/${productId}/images/${imageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", productId, "images"] });
      toast({ title: "Image removed" });
    },
  });

  const reorderImagesMutation = useMutation({
    mutationFn: async (imageIds: string[]) => {
      await apiRequest("PUT", `/api/admin/products/${productId}/images/reorder`, { imageIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", productId, "images"] });
    },
  });

  const [localImages, setLocalImages] = useState<ProductImage[]>([]);
  useEffect(() => {
    if (productImages) setLocalImages([...productImages].sort((a, b) => a.sortOrder - b.sortOrder));
  }, [productImages]);

  const moveGalleryImage = (idx: number, direction: -1 | 1) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= localImages.length) return;
    const updated = [...localImages];
    [updated[idx], updated[targetIdx]] = [updated[targetIdx], updated[idx]];
    setLocalImages(updated);
    reorderImagesMutation.mutate(updated.map(i => i.id));
  };

  const addReviewMutation = useMutation({
    mutationFn: async ({ review }: { review: any }) => {
      const res = await apiRequest("POST", `/api/admin/products/${productId}/reviews`, review);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", productId, "reviews"] });
      toast({ title: "Review added" });
    },
  });

  const deleteReviewMutation = useMutation({
    mutationFn: async ({ reviewId }: { reviewId: string }) => {
      await apiRequest("DELETE", `/api/admin/products/${productId}/reviews/${reviewId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", productId, "reviews"] });
      toast({ title: "Review removed" });
    },
  });

  const handleImageUpload = async (files: FileList) => {
    let uploaded = 0;
    for (let i = 0; i < files.length; i++) {
      const formData = new FormData();
      formData.append("image", files[i]);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (data.url) {
          addImageMutation.mutate({ imageUrl: data.url });
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
        setProduct(prev => ({ ...prev!, imageUrl: data.url }));
        toast({ title: "Main image updated — save to apply" });
      }
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    }
  };

  if (isLoading || !product) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
        <Skeleton className="h-8 w-48 mb-4" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24" data-testid="page-admin-product-edit">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" onClick={() => { window.close(); navigate("/admin/catalog"); }} data-testid="button-close-tab">
          <ChevronLeft className="w-4 h-4 mr-1" /> Close
        </Button>
        <span className="text-xs text-muted-foreground">({product.sku || product.id})</span>
      </div>
      <h1 className="text-xl font-bold mb-4" data-testid="text-edit-product-title">
        Edit: {product.name}
      </h1>

      <div className="space-y-4">
        <div>
          <Label htmlFor="prod-name">Product Name</Label>
          <Input
            id="prod-name"
            value={product.name || ""}
            onChange={(e) => setProduct(prev => ({ ...prev!, name: e.target.value }))}
            data-testid="input-product-name"
          />
        </div>

        <div>
          <Label htmlFor="prod-slug">Slug</Label>
          <Input
            id="prod-slug"
            value={product.slug || ""}
            onChange={(e) => setProduct(prev => ({ ...prev!, slug: e.target.value }))}
            data-testid="input-product-slug"
          />
        </div>

        <div>
          <Label htmlFor="prod-desc">Description</Label>
          <Textarea
            id="prod-desc"
            value={product.description || ""}
            onChange={(e) => setProduct(prev => ({ ...prev!, description: e.target.value }))}
            data-testid="input-product-description"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="prod-price">Price (₹)</Label>
            <Input
              id="prod-price"
              type="number"
              value={product.price || ""}
              onChange={(e) => setProduct(prev => ({ ...prev!, price: parseInt(e.target.value) || 0 }))}
              data-testid="input-product-price"
            />
          </div>
          <div>
            <Label htmlFor="prod-mrp">MRP (₹)</Label>
            <Input
              id="prod-mrp"
              type="number"
              value={product.mrp || ""}
              onChange={(e) => setProduct(prev => ({ ...prev!, mrp: parseInt(e.target.value) || undefined }))}
              data-testid="input-product-mrp"
            />
          </div>
        </div>

        <div>
          <Label className="flex items-center gap-1 mb-2">
            <ImageIcon className="w-4 h-4" /> Product Images
          </Label>
          <div className="flex flex-wrap gap-2">
            {product.imageUrl && (
              <label className={`relative ${THUMBNAIL_SIZES.adminEditor} rounded-md overflow-visible bg-muted border-2 border-primary/30 cursor-pointer group`} data-testid="thumbnail-main-image">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) handleMainImageUpload(e.target.files[0]); }}
                />
                <img src={getProductImageUrl(product.imageUrl, "small")} alt="Main" className="w-full h-full object-contain rounded-md" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-md invisible group-hover:visible">
                  <Upload className="w-4 h-4 text-white" />
                </div>
                <Badge className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] px-1.5 py-0 no-default-hover-elevate no-default-active-elevate">Main</Badge>
              </label>
            )}
            {localImages.map((img, idx) => (
              <div key={img.id} className={`relative ${THUMBNAIL_SIZES.adminEditor} rounded-md overflow-visible bg-muted group`} data-testid={`thumbnail-image-${img.id}`}>
                <img src={getProductImageUrl(img.imageUrl, "small")} alt="" className="w-full h-full object-contain rounded-md" />
                {/* arrow reorder overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 rounded-md z-10">
                  {idx > 0 && (
                    <button onClick={() => moveGalleryImage(idx, -1)} className="text-white hover:text-blue-300 p-0" data-testid={`button-move-left-${img.id}`}>
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                  )}
                  {idx < localImages.length - 1 && (
                    <button onClick={() => moveGalleryImage(idx, 1)} className="text-white hover:text-blue-300 p-0" data-testid={`button-move-right-${img.id}`}>
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  )}
                </div>
                {/* delete button — above arrow overlay */}
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteImageMutation.mutate({ imageId: img.id }); }}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20"
                  data-testid={`button-delete-image-${img.id}`}
                >
                  <X className="w-3 h-3" />
                </button>
                <Badge className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] px-1.5 py-0 no-default-hover-elevate no-default-active-elevate">{idx + 2}</Badge>
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
              value={product.material || ""}
              onChange={(e) => setProduct(prev => ({ ...prev!, material: e.target.value }))}
              data-testid="input-product-material"
            />
          </div>
          <div>
            <Label htmlFor="prod-gsm">GSM</Label>
            <Input
              id="prod-gsm"
              type="number"
              value={product.gsm || ""}
              onChange={(e) => setProduct(prev => ({ ...prev!, gsm: parseInt(e.target.value) || undefined }))}
              data-testid="input-product-gsm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="prod-dimensions">Dimensions</Label>
            <Input
              id="prod-dimensions"
              value={product.dimensions || ""}
              onChange={(e) => setProduct(prev => ({ ...prev!, dimensions: e.target.value }))}
              data-testid="input-product-dimensions"
            />
          </div>
          <div>
            <Label htmlFor="prod-color">Color</Label>
            <Input
              id="prod-color"
              value={product.color || ""}
              onChange={(e) => setProduct(prev => ({ ...prev!, color: e.target.value }))}
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
              value={product.weightGrams || ""}
              onChange={(e) => setProduct(prev => ({ ...prev!, weightGrams: parseInt(e.target.value) || undefined }))}
              data-testid="input-product-weight"
            />
          </div>
          <div>
            <Label htmlFor="prod-items">Items in Set</Label>
            <Input
              id="prod-items"
              type="number"
              value={product.itemsInSet || 1}
              onChange={(e) => setProduct(prev => ({ ...prev!, itemsInSet: parseInt(e.target.value) || 1 }))}
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
              value={product.quantity ?? 1}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (!isNaN(val) && val >= 0) {
                  setProduct(prev => ({ ...prev!, quantity: val }));
                }
              }}
              data-testid="input-product-quantity"
            />
          </div>
          <div>
            <Label htmlFor="prod-type">Product Type</Label>
            <Select
              value={product.productType || "towel"}
              onValueChange={(v) => setProduct(prev => ({ ...prev!, productType: v }))}
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="mb-1.5 block">Age Group</Label>
            <div className="flex flex-wrap gap-x-3 gap-y-1.5">
              {AGE_GROUP_OPTIONS.map(opt => (
                <div key={opt} className="flex items-center gap-1.5">
                  <Checkbox
                    id={`age-${opt}`}
                    checked={parseCsv(product.ageGroup).includes(opt)}
                    onCheckedChange={() => setProduct(prev => ({ ...prev!, ageGroup: toggleCsvValue(prev?.ageGroup, opt) }))}
                    data-testid={`checkbox-age-${opt}`}
                  />
                  <Label htmlFor={`age-${opt}`} className="text-sm font-normal cursor-pointer capitalize">{opt}</Label>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="prod-gender">Gender</Label>
            <Select
              value={product.gender || "unisex"}
              onValueChange={(v) => setProduct(prev => ({ ...prev!, gender: v }))}
            >
              <SelectTrigger id="prod-gender" data-testid="select-gender">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="unisex">Unisex</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="mb-1.5 block">Themes</Label>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5">
            {THEME_OPTIONS.map(opt => (
              <div key={opt} className="flex items-center gap-1.5">
                <Checkbox
                  id={`theme-${opt}`}
                  checked={parseCsv(product.themes).includes(opt)}
                  onCheckedChange={() => setProduct(prev => ({ ...prev!, themes: toggleCsvValue(prev?.themes, opt) }))}
                  data-testid={`checkbox-theme-${opt}`}
                />
                <Label htmlFor={`theme-${opt}`} className="text-sm font-normal cursor-pointer">{opt}</Label>
              </div>
            ))}
          </div>
        </div>

        <div>
          <Label className="mb-1.5 block">Styles</Label>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5">
            {STYLE_OPTIONS.map(opt => (
              <div key={opt} className="flex items-center gap-1.5">
                <Checkbox
                  id={`style-${opt}`}
                  checked={parseCsv(product.styles).includes(opt)}
                  onCheckedChange={() => setProduct(prev => ({ ...prev!, styles: toggleCsvValue(prev?.styles, opt) }))}
                  data-testid={`checkbox-style-${opt}`}
                />
                <Label htmlFor={`style-${opt}`} className="text-sm font-normal cursor-pointer">{opt}</Label>
              </div>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="prod-sort">Sort Order</Label>
          <Input
            id="prod-sort"
            type="number"
            value={product.sortOrder || 0}
            onChange={(e) => setProduct(prev => ({ ...prev!, sortOrder: parseInt(e.target.value) || 0 }))}
            data-testid="input-product-sort"
          />
        </div>

        <div>
          <Label htmlFor="prod-bullets">Bullet Points (one per line)</Label>
          <Textarea
            id="prod-bullets"
            value={(() => {
              try { return JSON.parse(product.bulletPoints || "[]").join("\n"); } catch { return product.bulletPoints || ""; }
            })()}
            onChange={(e) => {
              const lines = e.target.value.split("\n").filter(l => l.trim());
              setProduct(prev => ({ ...prev!, bulletPoints: JSON.stringify(lines) }));
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
              try { return JSON.parse(product.specialFeatures || "[]").join("\n"); } catch { return product.specialFeatures || ""; }
            })()}
            onChange={(e) => {
              const lines = e.target.value.split("\n").filter(l => l.trim());
              setProduct(prev => ({ ...prev!, specialFeatures: JSON.stringify(lines) }));
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
              try { return JSON.parse(product.searchKeywords || "[]").join("\n"); } catch { return product.searchKeywords || ""; }
            })()}
            onChange={(e) => {
              const lines = e.target.value.split("\n").filter(l => l.trim());
              setProduct(prev => ({ ...prev!, searchKeywords: JSON.stringify(lines) }));
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
            value={product.amazonAsin || ""}
            onChange={(e) => setProduct(prev => ({ ...prev!, amazonAsin: e.target.value }))}
            data-testid="input-product-asin"
          />
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="prod-active"
            checked={product.active !== false}
            onCheckedChange={(checked) => setProduct(prev => ({ ...prev!, active: checked }))}
            data-testid="switch-product-active"
          />
          <Label htmlFor="prod-active" className="flex items-center gap-1 text-sm">
            {product.active !== false ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            {product.active !== false ? "Active (visible in shop)" : "Hidden (not visible in shop)"}
          </Label>
        </div>

        {allTags && allTags.length > 0 && (
          <div>
            <Label className="flex items-center gap-1 mb-2">
              <TagIcon className="w-4 h-4" /> Tags
            </Label>
            <div className="space-y-3">
              {(allTagTypes && allTagTypes.length > 0 ? allTagTypes : [{ id: null, name: "Untyped", slug: "", description: null, sortOrder: 0 }]).map((tagType) => {
                const tagsForType = allTags.filter(t => t.tagTypeId === tagType.id);
                if (tagsForType.length === 0) return null;
                return (
                  <div key={tagType.id ?? "untyped"}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{tagType.name}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                      {tagsForType.map((tag) => (
                        <div key={tag.id} className="flex items-center gap-1.5" data-testid={`tag-checkbox-${tag.id}`}>
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
                );
              })}
              {allTags.filter(t => !allTagTypes?.some(tt => tt.id === t.tagTypeId)).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Untyped</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                    {allTags.filter(t => !allTagTypes?.some(tt => tt.id === t.tagTypeId)).map((tag) => (
                      <div key={tag.id} className="flex items-center gap-1.5" data-testid={`tag-checkbox-${tag.id}`}>
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
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            className="flex-1"
            variant="outline"
            onClick={() => {
              closeAfterSaveRef.current = false;
              saveProductMutation.mutate(product as any);
            }}
            disabled={saveProductMutation.isPending || !product.name || !product.slug || !product.price}
            data-testid="button-save-product"
          >
            {saveProductMutation.isPending && !closeAfterSaveRef.current ? "Saving..." : "Save"}
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              closeAfterSaveRef.current = true;
              saveProductMutation.mutate(product as any);
            }}
            disabled={saveProductMutation.isPending || !product.name || !product.slug || !product.price}
            data-testid="button-save-close-product"
          >
            {saveProductMutation.isPending && closeAfterSaveRef.current ? "Saving..." : "Save & Close"}
          </Button>
        </div>

        {productId && (
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
                      onClick={() => deleteReviewMutation.mutate({ reviewId: review.id })}
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
