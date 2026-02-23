import { useQuery, useMutation } from "@tanstack/react-query";
import React, { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import {
  Plus, Pencil, Trash2, ChevronRight, ChevronLeft, Package, FolderOpen,
  Image as ImageIcon, X, Upload, Eye, EyeOff, GripVertical, Star, Tag as TagIcon, LogOut, ArrowRightLeft, Search
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getProductImageUrl } from "@/lib/imageUtils";
import type { Category, Product, ProductImage, ProductReview, Tag } from "@shared/types";

type View = "categories" | "products" | "edit-category" | "edit-product" | "tags" | "edit-tag";

function ProductTagSelector({ productId, allTags }: { productId: string; allTags: Tag[] }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

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
    },
    onError: () => {
      toast({ title: "Failed to update tags", variant: "destructive" });
    },
  });

  return (
    <div className="relative">
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
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isNew, setIsNew] = useState(false);
  const [adminSearchQuery, setAdminSearchQuery] = useState("");
  const [adminSearchActive, setAdminSearchActive] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");

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
            <Link href="/admin/orders">
              <Button variant="outline" size="sm" data-testid="link-orders">Orders</Button>
            </Link>
            <Link href="/admin/builder">
              <Button variant="outline" size="sm" data-testid="link-builder">Page Builder</Button>
            </Link>
            <Link href="/admin/audit-log">
              <Button variant="outline" size="sm" data-testid="link-audit-log">Audit Log</Button>
            </Link>
            <Link href="/admin/pages">
              <Button variant="outline" size="sm" data-testid="link-policy-pages">Policy Page Builders</Button>
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
                          onClick={() => {
                            const cat2 = categories?.find(c => c.id === prod.categoryId);
                            if (cat2) setSelectedCategory(cat2);
                            setIsNew(false);
                            setEditingProduct({ ...prod });
                            setView("edit-product");
                          }}
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
                onClick={() => { setSelectedCategory(cat); setCategoryFilter(""); setView("products"); }}
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

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Filter products in this category..."
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
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

        {prodsLoading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : (
          <div className="space-y-2">
            {products?.filter((p) => {
              if (!categoryFilter.trim()) return true;
              const q = categoryFilter.trim().toLowerCase();
              return p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q));
            }).map((prod) => (
              <Card key={prod.id} className="p-3" data-testid={`card-product-${prod.id}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md overflow-hidden bg-muted flex-shrink-0">
                    <img src={getProductImageUrl(prod.imageUrl, "small")} alt={prod.name} className="w-full h-full object-contain" />
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
                      {prod.sku && <span className="font-mono mr-2">{prod.sku}</span>}
                      ₹{prod.price.toLocaleString("en-IN")}
                      {prod.mrp && prod.mrp > prod.price && (
                        <span className="ml-1 line-through">₹{prod.mrp.toLocaleString("en-IN")}</span>
                      )}
                      {prod.material && <span className="ml-2">{prod.material}</span>}
                      {prod.gsm && <span className="ml-1">{prod.gsm} GSM</span>}
                    </p>
                    <div className="mt-1">
                      <ProductTagSelector productId={prod.id} allTags={allTags || []} />
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
            <Label className="flex items-center gap-1 mb-2">
              <ImageIcon className="w-4 h-4" /> Product Images
            </Label>
            <div className="flex flex-wrap gap-2">
              {editingProduct.imageUrl && (
                <label className="relative w-20 h-20 rounded-md overflow-visible bg-muted border-2 border-primary/30 cursor-pointer group" data-testid="thumbnail-main-image">
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
              {editingProduct.id && productImages?.filter(img => img.imageUrl !== editingProduct.imageUrl).map((img) => (
                <label key={img.id} className="relative w-20 h-20 rounded-md overflow-visible bg-muted cursor-pointer group" data-testid={`thumbnail-image-${img.id}`}>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      if (!e.target.files?.[0]) return;
                      const formData = new FormData();
                      formData.append("image", e.target.files[0]);
                      try {
                        const res = await fetch("/api/upload", { method: "POST", body: formData });
                        const data = await res.json();
                        if (data.url) {
                          deleteImageMutation.mutate({ productId: editingProduct.id!, imageId: img.id });
                          addImageMutation.mutate({ productId: editingProduct.id!, imageUrl: data.url });
                        }
                      } catch { toast({ title: "Upload failed", variant: "destructive" }); }
                    }}
                  />
                  <img src={getProductImageUrl(img.imageUrl, "small")} alt="" className="w-full h-full object-contain rounded-md" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-md invisible group-hover:visible">
                    <Upload className="w-4 h-4 text-white" />
                  </div>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteImageMutation.mutate({ productId: editingProduct.id!, imageId: img.id }); }}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center invisible group-hover:visible z-10"
                    data-testid={`button-delete-image-${img.id}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </label>
              ))}
              <label className="w-20 h-20 rounded-md border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center cursor-pointer hover-elevate" data-testid="button-upload-image">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) handleImageUpload(e.target.files[0]); }}
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
