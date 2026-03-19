import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { THUMBNAIL_SIZES } from "@/config/thumbnails";
import {
  ChevronLeft, Image as ImageIcon, X, Upload, Eye, EyeOff, Star, Tag as TagIcon, Plus, Trash2,
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
import type { Product, ProductImage, ProductReview, Tag, ProductVariantOptions, ColorOption, SizeOption, ProductVariant } from "@shared/types";

const mapLegacyAudience = (val: string | null | undefined): string => {
  if (!val) return "";
  const map: Record<string, string> = { kids: "boy,girl", adults: "adult", couples: "couple" };
  return map[val] || val;
};

export default function AdminProductEdit() {
  const { toast } = useToast();
  const [, params] = useRoute("/admin/catalog/product/:id");
  const [, navigate] = useLocation();
  const productId = params?.id;

  const [product, setProduct] = useState<Partial<Product> | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [paletteColors, setPaletteColors] = useState<ColorOption[]>([]);
  const [paletteSizes, setPaletteSizes] = useState<SizeOption[]>([]);
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

  useEffect(() => {
    if (productTagsList) {
      setSelectedTagIds(productTagsList.map(t => t.id));
    }
  }, [productTagsList]);

  const { data: variantOptions, refetch: refetchVariantOptions } = useQuery<ProductVariantOptions>({
    queryKey: ["/api/admin/products", productId, "variant-options"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/products/${productId}/variant-options`);
      return res.json();
    },
    enabled: !!productId,
  });

  useEffect(() => {
    if (variantOptions) {
      setPaletteColors(variantOptions.colors || []);
      setPaletteSizes(variantOptions.sizes || []);
    }
  }, [variantOptions]);

  const savePaletteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/admin/products/${productId}/variant-options`, {
        colors: paletteColors,
        sizes: paletteSizes,
      });
    },
    onSuccess: () => {
      refetchVariantOptions();
      queryClient.invalidateQueries({ queryKey: ["/api/products", productId, "variant-options"] });
      toast({ title: "Palette saved" });
    },
    onError: () => {
      toast({ title: "Error saving palette", variant: "destructive" });
    },
  });

  const { data: productVariants, refetch: refetchVariants } = useQuery<ProductVariant[]>({
    queryKey: ["/api/admin/products", productId, "variants"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/products/${productId}/variants`);
      return res.json();
    },
    enabled: !!productId,
  });

  const saveVariantsMutation = useMutation({
    mutationFn: async (variants: { color: string; size: string; available: boolean }[]) => {
      await apiRequest("PUT", `/api/admin/products/${productId}/variants`, { variants });
    },
    onSuccess: () => {
      refetchVariants();
      toast({ title: "Variants saved" });
    },
    onError: () => {
      toast({ title: "Error saving variants", variant: "destructive" });
    },
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
            {productImages?.map((img) => (
              <div key={img.id} className={`relative ${THUMBNAIL_SIZES.adminEditor} rounded-md overflow-visible bg-muted group`} data-testid={`thumbnail-image-${img.id}`}>
                <img src={getProductImageUrl(img.imageUrl, "small")} alt="" className="w-full h-full object-contain rounded-md" />
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteImageMutation.mutate({ imageId: img.id }); }}
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
              const mapped = mapLegacyAudience(product.audience);
              const audiences = mapped.split(",").map(s => s.trim()).filter(Boolean);
              const checked = audiences.includes(opt.value);
              return (
                <div key={opt.value} className="flex items-center gap-1.5" data-testid={`audience-checkbox-${opt.value}`}>
                  <Checkbox
                    id={`audience-${opt.value}`}
                    checked={checked}
                    onCheckedChange={(isChecked) => {
                      const currentAudiences = mapLegacyAudience(product.audience).split(",").map(s => s.trim()).filter(Boolean);
                      const updated = isChecked
                        ? [...currentAudiences, opt.value]
                        : currentAudiences.filter(a => a !== opt.value);
                      setProduct(prev => ({ ...prev!, audience: updated.join(",") }));
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

        {product.productType === "towel" && (
          <div className="border rounded-lg p-4 space-y-4" data-testid="section-palette-editor">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Variant Palette (Colours &amp; Sizes)</h3>
              <Button
                size="sm"
                onClick={() => savePaletteMutation.mutate()}
                disabled={savePaletteMutation.isPending}
                data-testid="button-save-palette"
              >
                {savePaletteMutation.isPending ? "Saving..." : "Save Palette"}
              </Button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Colours</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPaletteColors(prev => [...prev, { name: "", hexCode: "#ffffff", blurOnFront: false, hideFromFront: false }])}
                  data-testid="button-add-palette-color"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Colour
                </Button>
              </div>
              {paletteColors.length === 0 && (
                <p className="text-xs text-muted-foreground">No colours configured.</p>
              )}
              {paletteColors.map((color, idx) => (
                <div key={idx} className="flex items-center gap-2 flex-wrap" data-testid={`palette-color-row-${idx}`}>
                  <input
                    type="color"
                    value={color.hexCode}
                    onChange={(e) => setPaletteColors(prev => prev.map((c, i) => i === idx ? { ...c, hexCode: e.target.value } : c))}
                    className="w-8 h-8 rounded cursor-pointer border border-border p-0"
                    data-testid={`input-palette-color-hex-${idx}`}
                  />
                  <Input
                    value={color.name}
                    onChange={(e) => setPaletteColors(prev => prev.map((c, i) => i === idx ? { ...c, name: e.target.value } : c))}
                    placeholder="Colour name (e.g. White)"
                    className="flex-1 min-w-[100px]"
                    data-testid={`input-palette-color-name-${idx}`}
                  />
                  <label className="flex items-center gap-1 text-xs cursor-pointer">
                    <Checkbox
                      checked={color.blurOnFront}
                      onCheckedChange={(v) => setPaletteColors(prev => prev.map((c, i) => i === idx ? { ...c, blurOnFront: !!v } : c))}
                      data-testid={`checkbox-palette-color-blur-${idx}`}
                    />
                    Blur
                  </label>
                  <label className="flex items-center gap-1 text-xs cursor-pointer">
                    <Checkbox
                      checked={color.hideFromFront}
                      onCheckedChange={(v) => setPaletteColors(prev => prev.map((c, i) => i === idx ? { ...c, hideFromFront: !!v } : c))}
                      data-testid={`checkbox-palette-color-hide-${idx}`}
                    />
                    Hide
                  </label>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setPaletteColors(prev => prev.filter((_, i) => i !== idx))}
                    data-testid={`button-delete-palette-color-${idx}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-3 border-t pt-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Sizes</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPaletteSizes(prev => [...prev, { name: "", value: "", isDefault: false, blurOnFront: false, hideFromFront: false }])}
                  data-testid="button-add-palette-size"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Size
                </Button>
              </div>
              {paletteSizes.length === 0 && (
                <p className="text-xs text-muted-foreground">No sizes configured.</p>
              )}
              {paletteSizes.map((size, idx) => (
                <div key={idx} className="border rounded-md p-3 space-y-2" data-testid={`palette-size-row-${idx}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Input
                      value={size.name}
                      onChange={(e) => setPaletteSizes(prev => prev.map((s, i) => i === idx ? { ...s, name: e.target.value } : s))}
                      placeholder="Display name (e.g. Small)"
                      className="flex-1 min-w-[90px]"
                      data-testid={`input-palette-size-name-${idx}`}
                    />
                    <Input
                      value={size.value}
                      onChange={(e) => setPaletteSizes(prev => prev.map((s, i) => i === idx ? { ...s, value: e.target.value } : s))}
                      placeholder="Value (e.g. S)"
                      className="w-20"
                      data-testid={`input-palette-size-value-${idx}`}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setPaletteSizes(prev => prev.filter((_, i) => i !== idx))}
                      data-testid={`button-delete-palette-size-${idx}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <Input
                    value={size.description || ""}
                    onChange={(e) => setPaletteSizes(prev => prev.map((s, i) => i === idx ? { ...s, description: e.target.value } : s))}
                    placeholder="Description (e.g. 120 × 60 cm)"
                    className="text-xs"
                    data-testid={`input-palette-size-description-${idx}`}
                  />
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1 text-xs cursor-pointer">
                      <Checkbox
                        checked={size.isDefault}
                        onCheckedChange={(v) => setPaletteSizes(prev => prev.map((s, i) => i === idx ? { ...s, isDefault: !!v } : s))}
                        data-testid={`checkbox-palette-size-default-${idx}`}
                      />
                      Default
                    </label>
                    <label className="flex items-center gap-1 text-xs cursor-pointer">
                      <Checkbox
                        checked={size.blurOnFront}
                        onCheckedChange={(v) => setPaletteSizes(prev => prev.map((s, i) => i === idx ? { ...s, blurOnFront: !!v } : s))}
                        data-testid={`checkbox-palette-size-blur-${idx}`}
                      />
                      Blur
                    </label>
                    <label className="flex items-center gap-1 text-xs cursor-pointer">
                      <Checkbox
                        checked={size.hideFromFront}
                        onCheckedChange={(v) => setPaletteSizes(prev => prev.map((s, i) => i === idx ? { ...s, hideFromFront: !!v } : s))}
                        data-testid={`checkbox-palette-size-hide-${idx}`}
                      />
                      Hide
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {variantOptions && (variantOptions.sizes.length > 0 || variantOptions.colors.length > 0) && (
          <div className="border rounded-lg p-4 space-y-3" data-testid="section-product-variants">
            <h3 className="text-sm font-semibold">Variant Availability (Color × Size)</h3>
            {variantOptions.sizes.length === 0 || variantOptions.colors.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Configure both colours and sizes for this product's palette above to enable the variant grid.
              </p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Check combos available for this product. Unchecked = unavailable (shown greyed out to customers).
                </p>
                <div className="overflow-x-auto">
                  <table className="text-xs w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="text-left p-1 font-medium text-muted-foreground min-w-[80px]">Size \ Colour</th>
                        {variantOptions.colors.map(c => (
                          <th key={c.name} className="p-1 text-center font-medium min-w-[70px]">
                            <div className="flex flex-col items-center gap-1">
                              <span
                                className="w-5 h-5 rounded-full border border-border inline-block"
                                style={{ backgroundColor: c.hexCode }}
                                title={c.name}
                              />
                              <span className="text-[10px] text-muted-foreground leading-tight">{c.name}</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {variantOptions.sizes.map(size => (
                        <tr key={size.value} className="border-t border-border/50">
                          <td className="p-1 font-medium">{size.name}</td>
                          {variantOptions.colors.map(color => {
                            const existing = productVariants?.find(
                              v => v.color === color.name && v.size === size.value
                            );
                            const isAvailable = existing ? existing.available : false;
                            return (
                              <td key={color.name} className="p-1 text-center">
                                <Checkbox
                                  checked={isAvailable}
                                  onCheckedChange={(checked) => {
                                    const current = productVariants ? [...productVariants] : [];
                                    const idx = current.findIndex(
                                      v => v.color === color.name && v.size === size.value
                                    );
                                    const newVariant = {
                                      id: existing?.id || `${productId}-${color.name}-${size.value}`,
                                      productId: productId!,
                                      color: color.name,
                                      size: size.value,
                                      available: !!checked,
                                    };
                                    let updated: ProductVariant[];
                                    if (idx >= 0) {
                                      updated = [...current.slice(0, idx), newVariant, ...current.slice(idx + 1)];
                                    } else {
                                      updated = [...current, newVariant];
                                    }
                                    saveVariantsMutation.mutate(
                                      updated.map(v => ({ color: v.color, size: v.size, available: v.available }))
                                    );
                                  }}
                                  data-testid={`variant-checkbox-${color.name}-${size.value}`}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
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
