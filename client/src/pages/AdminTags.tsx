import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Save, X, ChevronDown, ChevronRight, Tag as TagIcon, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { TagType, Tag } from "@shared/types";

type TagWithCount = Tag & { productCount: number };

function slugify(str: string) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function TagTypeForm({
  initial,
  onSave,
  onCancel,
  isPending,
}: {
  initial: Partial<TagType>;
  onSave: (data: Partial<TagType>) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(initial.name ?? "");
  const [slug, setSlug] = useState(initial.slug ?? "");
  const [description, setDescription] = useState(initial.description ?? "");
  const [sortOrder, setSortOrder] = useState<number>(initial.sortOrder ?? 0);
  const [slugEdited, setSlugEdited] = useState(!!initial.slug);

  function handleNameChange(v: string) {
    setName(v);
    if (!slugEdited) setSlug(slugify(v));
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Name *</Label>
          <Input
            value={name}
            onChange={e => handleNameChange(e.target.value)}
            placeholder="e.g. Occasion Fit"
            className="h-8 text-sm mt-0.5"
            data-testid="input-tagtype-name"
          />
        </div>
        <div>
          <Label className="text-xs">Slug *</Label>
          <Input
            value={slug}
            onChange={e => { setSlug(e.target.value); setSlugEdited(true); }}
            placeholder="e.g. occasion-fit"
            className="h-8 text-sm mt-0.5 font-mono"
            data-testid="input-tagtype-slug"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <Label className="text-xs">Description</Label>
          <Input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Optional description"
            className="h-8 text-sm mt-0.5"
            data-testid="input-tagtype-description"
          />
        </div>
        <div>
          <Label className="text-xs">Sort Order</Label>
          <Input
            type="number"
            value={sortOrder}
            onChange={e => setSortOrder(parseInt(e.target.value) || 0)}
            className="h-8 text-sm mt-0.5"
            data-testid="input-tagtype-sort"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button
          size="sm"
          variant="ghost"
          onClick={onCancel}
          data-testid="button-cancel-tagtype"
        >
          <X className="w-3.5 h-3.5 mr-1" /> Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => onSave({ name: name.trim(), slug: slug.trim(), description: description.trim() || null, sortOrder })}
          disabled={!name.trim() || !slug.trim() || isPending}
          data-testid="button-save-tagtype"
        >
          <Save className="w-3.5 h-3.5 mr-1" /> Save
        </Button>
      </div>
    </div>
  );
}

function TagForm({
  initial,
  tagTypes,
  defaultTypeId,
  onSave,
  onCancel,
  isPending,
}: {
  initial: Partial<TagWithCount>;
  tagTypes: TagType[];
  defaultTypeId?: string | null;
  onSave: (data: Partial<Tag>) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(initial.name ?? "");
  const [description, setDescription] = useState(initial.description ?? "");
  const [tagTypeId, setTagTypeId] = useState<string>(initial.tagTypeId ?? defaultTypeId ?? "__none__");
  const [sortOrder, setSortOrder] = useState<number>(initial.sortOrder ?? 0);

  return (
    <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Tag Name *</Label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. best_seller"
            className="h-8 text-sm mt-0.5"
            data-testid="input-tag-name"
          />
        </div>
        <div>
          <Label className="text-xs">Type</Label>
          <Select value={tagTypeId} onValueChange={setTagTypeId}>
            <SelectTrigger className="h-8 text-sm mt-0.5" data-testid="select-tag-type">
              <SelectValue placeholder="Select type…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Untyped —</SelectItem>
              {tagTypes.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <Label className="text-xs">Description</Label>
          <Input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Optional description"
            className="h-8 text-sm mt-0.5"
            data-testid="input-tag-description"
          />
        </div>
        <div>
          <Label className="text-xs">Sort Order</Label>
          <Input
            type="number"
            value={sortOrder}
            onChange={e => setSortOrder(parseInt(e.target.value) || 0)}
            className="h-8 text-sm mt-0.5"
            data-testid="input-tag-sort"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" onClick={onCancel} data-testid="button-cancel-tag">
          <X className="w-3.5 h-3.5 mr-1" /> Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => onSave({
            name: name.trim(),
            description: description.trim() || null,
            tagTypeId: tagTypeId === "__none__" ? null : tagTypeId,
            sortOrder,
          })}
          disabled={!name.trim() || isPending}
          data-testid="button-save-tag"
        >
          <Save className="w-3.5 h-3.5 mr-1" /> Save
        </Button>
      </div>
    </div>
  );
}

function TagRow({
  tag,
  tagTypes,
  onEdit,
  onDelete,
}: {
  tag: TagWithCount;
  tagTypes: TagType[];
  onEdit: (tag: TagWithCount) => void;
  onDelete: (tag: TagWithCount) => void;
}) {
  return (
    <div
      className="flex items-center gap-2 py-2 border-b last:border-0 group"
      data-testid={`row-tag-${tag.id}`}
    >
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium" data-testid={`text-tag-name-${tag.id}`}>{tag.name}</span>
        {tag.description && (
          <span className="text-xs text-muted-foreground ml-2">{tag.description}</span>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Badge variant="outline" className="text-xs" data-testid={`badge-tag-count-${tag.id}`}>
          {tag.productCount} product{tag.productCount !== 1 ? "s" : ""}
        </Badge>
        <Badge variant="secondary" className="text-xs hidden sm:inline-flex">sort {tag.sortOrder ?? 0}</Badge>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onEdit(tag)}
          data-testid={`button-edit-tag-${tag.id}`}
        >
          <Pencil className="w-3 h-3" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onDelete(tag)}
          data-testid={`button-delete-tag-${tag.id}`}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

function TagTypeSection({
  tagType,
  tags,
  allTagTypes,
  onRefresh,
}: {
  tagType: TagType | null;
  tags: TagWithCount[];
  allTagTypes: TagType[];
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(true);
  const [showAddTag, setShowAddTag] = useState(false);
  const [editingTag, setEditingTag] = useState<TagWithCount | null>(null);
  const [deleteTagTarget, setDeleteTagTarget] = useState<TagWithCount | null>(null);

  const isUntyped = tagType === null;

  const createTagMutation = useMutation({
    mutationFn: async (data: Partial<Tag>) => {
      const res = await apiRequest("POST", "/api/admin/tags", data);
      return res.json();
    },
    onSuccess: () => {
      onRefresh();
      setShowAddTag(false);
      toast({ title: "Tag created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message || "Failed to create tag", variant: "destructive" }),
  });

  const updateTagMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Tag> }) => {
      const res = await apiRequest("PUT", `/api/admin/tags/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      onRefresh();
      setEditingTag(null);
      toast({ title: "Tag updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message || "Failed to update tag", variant: "destructive" }),
  });

  const deleteTagMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/tags/${id}`);
    },
    onSuccess: () => {
      onRefresh();
      setDeleteTagTarget(null);
      toast({ title: "Tag deleted" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message || "Failed to delete tag", variant: "destructive" }),
  });

  const sectionId = tagType?.id ?? "untyped";
  const sectionName = tagType?.name ?? "Untyped";

  return (
    <>
      <Card className="overflow-hidden" data-testid={`section-tagtype-${sectionId}`}>
        <div
          className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors select-none"
          onClick={() => setOpen(o => !o)}
          data-testid={`header-tagtype-${sectionId}`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {open ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
            <span className="font-semibold text-sm truncate">{sectionName}</span>
            {tagType?.slug && (
              <span className="text-xs text-muted-foreground font-mono hidden sm:inline">/{tagType.slug}</span>
            )}
            {tagType?.description && (
              <span className="text-xs text-muted-foreground truncate hidden md:inline">— {tagType.description}</span>
            )}
            <Badge variant="outline" className="text-xs ml-1 shrink-0">
              {tags.length} tag{tags.length !== 1 ? "s" : ""}
            </Badge>
          </div>
          {!isUntyped && (
            <div className="flex items-center gap-1 ml-2 shrink-0" onClick={e => e.stopPropagation()}>
              <EditTagTypeButton tagType={tagType!} onRefresh={onRefresh} />
              <DeleteTagTypeButton tagType={tagType!} tagCount={tags.length} onRefresh={onRefresh} />
            </div>
          )}
        </div>

        {open && (
          <div className="px-4 pb-3 border-t">
            {tags.length === 0 && !showAddTag && (
              <p className="text-xs text-muted-foreground py-3">No tags in this type yet.</p>
            )}
            <div className="divide-y divide-border/50">
              {tags.map(tag => (
                editingTag?.id === tag.id ? (
                  <div key={tag.id} className="py-2">
                    <TagForm
                      initial={editingTag}
                      tagTypes={allTagTypes}
                      onSave={data => updateTagMutation.mutate({ id: tag.id, data })}
                      onCancel={() => setEditingTag(null)}
                      isPending={updateTagMutation.isPending}
                    />
                  </div>
                ) : (
                  <TagRow
                    key={tag.id}
                    tag={tag}
                    tagTypes={allTagTypes}
                    onEdit={t => { setEditingTag(t); setShowAddTag(false); }}
                    onDelete={t => setDeleteTagTarget(t)}
                  />
                )
              ))}
            </div>

            {showAddTag ? (
              <div className="mt-2">
                <TagForm
                  initial={{}}
                  tagTypes={allTagTypes}
                  defaultTypeId={tagType?.id ?? null}
                  onSave={data => createTagMutation.mutate(data)}
                  onCancel={() => setShowAddTag(false)}
                  isPending={createTagMutation.isPending}
                />
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="mt-2 h-7 text-xs"
                onClick={() => { setShowAddTag(true); setEditingTag(null); }}
                data-testid={`button-add-tag-${sectionId}`}
              >
                <Plus className="w-3 h-3 mr-1" /> Add Tag
              </Button>
            )}
          </div>
        )}
      </Card>

      <AlertDialog open={!!deleteTagTarget} onOpenChange={open => { if (!open) setDeleteTagTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tag "{deleteTagTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTagTarget && deleteTagTarget.productCount > 0 ? (
                <>
                  This tag is assigned to <strong>{deleteTagTarget.productCount} product{deleteTagTarget.productCount !== 1 ? "s" : ""}</strong>. Deleting it will remove those assignments permanently.
                </>
              ) : (
                "This tag has no product assignments. It will be permanently deleted."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-tag">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTagTarget && deleteTagMutation.mutate(deleteTagTarget.id)}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete-tag"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function EditTagTypeButton({ tagType, onRefresh }: { tagType: TagType; onRefresh: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<TagType>) => {
      const res = await apiRequest("PUT", `/api/admin/tag-types/${tagType.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      onRefresh();
      setOpen(false);
      toast({ title: "Tag type updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message || "Failed to update tag type", variant: "destructive" }),
  });

  if (!open) {
    return (
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        onClick={() => setOpen(true)}
        data-testid={`button-edit-tagtype-${tagType.id}`}
      >
        <Pencil className="w-3.5 h-3.5" />
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setOpen(false)}>
      <div className="bg-background rounded-xl shadow-xl p-5 w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold mb-4">Edit Tag Type</h3>
        <TagTypeForm
          initial={tagType}
          onSave={data => updateMutation.mutate(data)}
          onCancel={() => setOpen(false)}
          isPending={updateMutation.isPending}
        />
      </div>
    </div>
  );
}

function DeleteTagTypeButton({ tagType, tagCount, onRefresh }: { tagType: TagType; tagCount: number; onRefresh: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/admin/tag-types/${tagType.id}`);
    },
    onSuccess: () => {
      onRefresh();
      setOpen(false);
      toast({ title: `Tag type "${tagType.name}" deleted` });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message || "Failed to delete tag type", variant: "destructive" }),
  });

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 text-destructive"
        onClick={() => setOpen(true)}
        data-testid={`button-delete-tagtype-${tagType.id}`}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tag type "{tagType.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {tagCount > 0 ? (
                <>
                  This type has <strong>{tagCount} tag{tagCount !== 1 ? "s" : ""}</strong>. Those tags will <strong>not</strong> be deleted — they will become untyped and remain available. Only the type itself is removed.
                </>
              ) : (
                "This tag type has no tags. It will be permanently deleted."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-tagtype">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete-tagtype"
            >
              Delete Type
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function AdminTags() {
  const { toast } = useToast();
  const [showAddType, setShowAddType] = useState(false);

  const { data: tagTypes = [], refetch: refetchTypes } = useQuery<TagType[]>({
    queryKey: ["/api/admin/tag-types"],
  });

  const { data: allTags = [], refetch: refetchTags } = useQuery<TagWithCount[]>({
    queryKey: ["/api/admin/tags"],
  });

  function onRefresh() {
    refetchTypes();
    refetchTags();
    queryClient.invalidateQueries({ queryKey: ["/api/admin/tags"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/tag-types"] });
  }

  const createTypeMutation = useMutation({
    mutationFn: async (data: Partial<TagType>) => {
      const res = await apiRequest("POST", "/api/admin/tag-types", data);
      return res.json();
    },
    onSuccess: () => {
      onRefresh();
      setShowAddType(false);
      toast({ title: "Tag type created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message || "Failed to create tag type", variant: "destructive" }),
  });

  const tagsByType = tagTypes.map(tt => ({
    tagType: tt,
    tags: allTags.filter(t => t.tagTypeId === tt.id),
  }));

  const untypedTags = allTags.filter(t => t.tagTypeId === null);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto pb-24" data-testid="page-admin-tags">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/admin">
          <Button variant="ghost" size="sm" className="text-muted-foreground h-8 px-2" data-testid="button-back-admin">
            <ArrowLeft className="w-4 h-4 mr-1" /> Admin
          </Button>
        </Link>
      </div>

      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Tags & Tag Types</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage internal merchandising tags and organise them into types. Tags are not user-visible — they power the occasions engine and product curation.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowAddType(v => !v)}
          data-testid="button-add-tagtype"
          className="shrink-0"
        >
          <Plus className="w-4 h-4 mr-1" />
          New Type
        </Button>
      </div>

      {showAddType && (
        <Card className="p-4 mb-4 border-dashed" data-testid="form-add-tagtype">
          <h3 className="text-sm font-semibold mb-3">New Tag Type</h3>
          <TagTypeForm
            initial={{}}
            onSave={data => createTypeMutation.mutate(data)}
            onCancel={() => setShowAddType(false)}
            isPending={createTypeMutation.isPending}
          />
        </Card>
      )}

      <div className="space-y-3">
        {tagsByType.map(({ tagType, tags }) => (
          <TagTypeSection
            key={tagType.id}
            tagType={tagType}
            tags={tags}
            allTagTypes={tagTypes}
            onRefresh={onRefresh}
          />
        ))}

        {(untypedTags.length > 0 || tagTypes.length === 0) && (
          <TagTypeSection
            key="untyped"
            tagType={null}
            tags={untypedTags}
            allTagTypes={tagTypes}
            onRefresh={onRefresh}
          />
        )}
      </div>

      {tagTypes.length === 0 && allTags.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <TagIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No tag types yet. Click "New Type" to get started.</p>
        </div>
      )}
    </div>
  );
}
