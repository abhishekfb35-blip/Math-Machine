import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  Plus, Pencil, Trash2, ChevronRight, ChevronLeft, Package, FolderOpen,
  Image as ImageIcon, X, Upload, Eye, EyeOff, GripVertical, Star, Tag as TagIcon, LogOut
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
import type { Category, Product, ProductImage, ProductReview, Tag } from "@shared/types";

type View = "categories" | "products" | "edit-category" | "edit-product" | "tags" | "edit-tag";

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
  const handleLogout = useAdminLogout();
  const [view, setView] = useState<View>("categories");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [editingTag, setEditingTag] = useState<Partial<Tag> | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [isNew, setIsNew] = useState(false);

  const { data: categories, isLoading: catsLoading } = useQuery<Category[]>({
    queryKey: ["/api/admin/categories"],
  });

  const { data: products, isLoading: prodsLoading } = useQuery<Product[]>({
    queryKey: ["/api/admin/products/category", selectedCategory?.id],
    queryFn: async () => {
      if (!selectedCategory) return [];
      const res = await fetch(`/api/admin/products/category/${selectedCategory.id}`);
      return res.json();
    },
    enabled: !!selectedCategory,
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
    mutationFn: async (id: number) => {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products/category", selectedCategory?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: isNew ? "Product created" : "Product updated" });
      setView("products");
      setEditingProduct(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
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
    mutationFn: async (id: number) => {
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
    mutationFn: async (id: number) => {
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

  const addImageMutation = useMutation({
    mutationFn: async ({ productId, imageUrl }: { productId: number; imageUrl: string }) => {
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
    mutationFn: async ({ productId, imageId }: { productId: number; imageId: number }) => {
      await apiRequest("DELETE", `/api/admin/products/${productId}/images/${imageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", editingProduct?.id, "images"] });
      toast({ title: "Image removed" });
    },
  });

  const addReviewMutation = useMutation({
    mutationFn: async ({ productId, review }: { productId: number; review: any }) => {
      const res = await apiRequest("POST", `/api/admin/products/${productId}/reviews`, review);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", editingProduct?.id, "reviews"] });
      toast({ title: "Review added" });
    },
  });

  const deleteReviewMutation = useMutation({
    mutationFn: async ({ productId, reviewId }: { productId: number; reviewId: number }) => {
      await apiRequest("DELETE", `/api/admin/products/${productId}/reviews/${reviewId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", editingProduct?.id, "reviews"] });
      toast({ title: "Review removed" });
    },
  });

  const handleImageUpload = async (file: File) => {
    const formData = new FormData();
    formData.append("image", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url && editingProduct?.id) {
        addImageMutation.mutate({ productId: editingProduct.id, imageUrl: data.url });
      }
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    }
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
            <Link href="/admin/builder">
              <Button variant="outline" size="sm" data-testid="link-builder">Page Builder</Button>
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
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4 mr-1" /> Logout
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

        {catsLoading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
        ) : (
          <div className="space-y-2">
            {categories?.map((cat) => (
              <Card
                key={cat.id}
                className="p-3 hover-elevate cursor-pointer"
                onClick={() => { setSelectedCategory(cat); setView("products"); }}
                data-testid={`card-category-${cat.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
                    {cat.imageUrl && (
                      <img src={getProductImageUrl(cat.imageUrl, "small")} alt={cat.name} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate" data-testid={`text-category-name-${cat.id}`}>{cat.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{cat.description}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
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
                <img src={editingCategory.imageUrl} alt="Preview" className="w-full h-full object-cover" />
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
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => { setView("categories"); setSelectedCategory(null); }} data-testid="button-back-categories-from-products">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Categories
        </Button>

        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold" data-testid="text-products-title">{selectedCategory.name}</h1>
            <p className="text-sm text-muted-foreground">{products?.length || 0} products</p>
          </div>
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

        {prodsLoading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : (
          <div className="space-y-2">
            {products?.map((prod) => (
              <Card key={prod.id} className="p-3" data-testid={`card-product-${prod.id}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md overflow-hidden bg-muted flex-shrink-0">
                    <img src={getProductImageUrl(prod.imageUrl, "small")} alt={prod.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-sm truncate" data-testid={`text-product-name-${prod.id}`}>{prod.name}</p>
                      {!prod.active && (
                        <Badge variant="secondary" className="text-[10px] no-default-hover-elevate no-default-active-elevate">
                          <EyeOff className="w-2.5 h-2.5 mr-0.5" /> Hidden
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      ₹{prod.price.toLocaleString("en-IN")}
                      {prod.mrp && prod.mrp > prod.price && (
                        <span className="ml-1 line-through">₹{prod.mrp.toLocaleString("en-IN")}</span>
                      )}
                      {prod.material && <span className="ml-2">{prod.material}</span>}
                      {prod.gsm && <span className="ml-1">{prod.gsm} GSM</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setIsNew(false);
                        setEditingProduct({ ...prod });
                        setView("edit-product");
                      }}
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
              </Card>
            ))}
            {products?.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No products in this category</p>
              </div>
            )}
          </div>
        )}
      </div>
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
            <Label htmlFor="prod-image">Main Image URL</Label>
            <Input
              id="prod-image"
              value={editingProduct.imageUrl || ""}
              onChange={(e) => setEditingProduct(prev => ({ ...prev!, imageUrl: e.target.value }))}
              data-testid="input-product-image"
            />
            {editingProduct.imageUrl && (
              <div className="mt-2 w-20 h-20 rounded-md overflow-hidden bg-muted">
                <img src={getProductImageUrl(editingProduct.imageUrl, "small")} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}
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
              <Label htmlFor="prod-audience">Audience</Label>
              <Select
                value={editingProduct.audience || "kids"}
                onValueChange={(v) => setEditingProduct(prev => ({ ...prev!, audience: v }))}
              >
                <SelectTrigger data-testid="select-product-audience">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kids">Kids</SelectItem>
                  <SelectItem value="adults">Adults</SelectItem>
                  <SelectItem value="couples">Couples</SelectItem>
                </SelectContent>
              </Select>
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

          <Button
            className="w-full"
            onClick={() => saveProductMutation.mutate(editingProduct as any)}
            disabled={saveProductMutation.isPending || !editingProduct.name || !editingProduct.slug || !editingProduct.price}
            data-testid="button-save-product"
          >
            {saveProductMutation.isPending ? "Saving..." : isNew ? "Create Product" : "Save Changes"}
          </Button>

          {/* Images Section */}
          {editingProduct.id && (
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="text-sm font-semibold flex items-center gap-1">
                  <ImageIcon className="w-4 h-4" /> Product Images ({productImages?.length || 0})
                </h2>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { if (e.target.files?.[0]) handleImageUpload(e.target.files[0]); }}
                    data-testid="input-upload-image"
                  />
                  <Button size="sm" variant="outline" asChild>
                    <span><Upload className="w-3.5 h-3.5 mr-1" /> Upload</span>
                  </Button>
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                {productImages?.map((img) => (
                  <div key={img.id} className="relative w-20 h-20 rounded-md overflow-hidden bg-muted group">
                    <img src={getProductImageUrl(img.imageUrl, "small")} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => deleteImageMutation.mutate({ productId: editingProduct.id!, imageId: img.id })}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center invisible group-hover:visible"
                      data-testid={`button-delete-image-${img.id}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                    {img.isPrimary && (
                      <Badge className="absolute bottom-0.5 left-0.5 text-[8px] px-1 py-0 no-default-hover-elevate no-default-active-elevate">Primary</Badge>
                    )}
                  </div>
                ))}
              </div>
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
                      review: { reviewerName: name, rating, title, body, reviewDate: date, verifiedPurchase: true },
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
