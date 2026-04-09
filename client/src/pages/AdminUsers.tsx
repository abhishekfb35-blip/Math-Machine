import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Plus, Pencil, UserX, UserCheck, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const ALL_PERMISSIONS = [
  { id: "catalog", label: "Catalog" },
  { id: "orders", label: "Orders" },
  { id: "builder", label: "Page Builder" },
  { id: "pages", label: "Policy Pages" },
  { id: "brand", label: "Brand Assets" },
  { id: "customers", label: "Customers" },
  { id: "consent", label: "Consent & Offers" },
  { id: "pricing", label: "International Pricing" },
  { id: "offers", label: "Offers & Delivery" },
  { id: "seo", label: "SEO" },
  { id: "export", label: "Export Data" },
  { id: "health", label: "Health Checks" },
  { id: "audit", label: "Audit Log" },
];

interface AdminUser {
  id: string;
  username: string;
  permissions: string[];
  isActive: boolean;
  createdAt: string | null;
}

interface UserFormState {
  username: string;
  password: string;
  permissions: string[];
  isActive: boolean;
}

const defaultForm: UserFormState = {
  username: "",
  password: "",
  permissions: [],
  isActive: true,
};

export default function AdminUsers() {
  const { toast } = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [form, setForm] = useState<UserFormState>(defaultForm);

  const { data: users = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
  });

  const createMutation = useMutation({
    mutationFn: (data: { username: string; password: string; permissions: string[]; isActive: boolean }) =>
      apiRequest("POST", "/api/admin/users", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setSheetOpen(false);
      toast({ title: "User created successfully" });
    },
    onError: async (err: any) => {
      const msg = err?.message || "Failed to create user";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ password: string; permissions: string[]; isActive: boolean }> }) =>
      apiRequest("PATCH", `/api/admin/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setSheetOpen(false);
      toast({ title: "User updated successfully" });
    },
    onError: async (err: any) => {
      const msg = err?.message || "Failed to update user";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest("PATCH", `/api/admin/users/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: async (err: any) => {
      const msg = err?.message || "Failed to update user";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  function openCreate() {
    setEditingUser(null);
    setForm(defaultForm);
    setSheetOpen(true);
  }

  function openEdit(user: AdminUser) {
    setEditingUser(user);
    setForm({
      username: user.username,
      password: "",
      permissions: [...user.permissions],
      isActive: user.isActive,
    });
    setSheetOpen(true);
  }

  function togglePermission(permId: string) {
    setForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permId)
        ? prev.permissions.filter(p => p !== permId)
        : [...prev.permissions, permId],
    }));
  }

  function handleSave() {
    if (editingUser) {
      const data: Partial<{ password: string; permissions: string[]; isActive: boolean }> = {
        permissions: form.permissions,
        isActive: form.isActive,
      };
      if (form.password.trim()) {
        data.password = form.password.trim();
      }
      updateMutation.mutate({ id: editingUser.id, data });
    } else {
      if (!form.username.trim()) {
        toast({ title: "Username is required", variant: "destructive" });
        return;
      }
      if (form.password.length < 8) {
        toast({ title: "Password must be at least 8 characters", variant: "destructive" });
        return;
      }
      createMutation.mutate({
        username: form.username.trim(),
        password: form.password,
        permissions: form.permissions,
        isActive: form.isActive,
      });
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-24" data-testid="page-admin-users">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Admin Users</h1>
          <p className="text-sm text-muted-foreground">Manage sub-admin accounts and permissions</p>
        </div>
        <Button onClick={openCreate} size="sm" data-testid="button-create-user">
          <Plus className="w-4 h-4 mr-1" /> New User
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">Loading…</div>
      ) : users.length === 0 ? (
        <Card className="p-8 text-center">
          <Shield className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No sub-admin users yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Click "New User" to create the first one.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {users.map(user => (
            <Card key={user.id} className="p-4" data-testid={`card-user-${user.id}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm" data-testid={`text-username-${user.id}`}>{user.username}</span>
                    <Badge variant={user.isActive ? "default" : "secondary"} className="text-xs" data-testid={`badge-status-${user.id}`}>
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {user.permissions.length === 0 ? (
                      <span className="text-xs text-muted-foreground">No permissions assigned</span>
                    ) : (
                      user.permissions.map(p => (
                        <Badge key={p} variant="outline" className="text-xs" data-testid={`badge-perm-${user.id}-${p}`}>
                          {ALL_PERMISSIONS.find(x => x.id === p)?.label ?? p}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(user)}
                    data-testid={`button-edit-user-${user.id}`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleActiveMutation.mutate({ id: user.id, isActive: !user.isActive })}
                    data-testid={`button-toggle-active-${user.id}`}
                    title={user.isActive ? "Deactivate user" : "Activate user"}
                  >
                    {user.isActive
                      ? <UserX className="w-3.5 h-3.5 text-destructive" />
                      : <UserCheck className="w-3.5 h-3.5 text-green-600" />
                    }
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-5">
            <SheetTitle>{editingUser ? `Edit — ${editingUser.username}` : "Create Admin User"}</SheetTitle>
          </SheetHeader>

          <div className="space-y-5">
            <div>
              <Label htmlFor="username" className="text-sm mb-1.5 block">Username</Label>
              <Input
                id="username"
                value={form.username}
                onChange={e => setForm(prev => ({ ...prev, username: e.target.value }))}
                disabled={!!editingUser}
                placeholder="e.g. catalog_manager"
                data-testid="input-username"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-sm mb-1.5 block">
                {editingUser ? "New Password (leave blank to keep current)" : "Password"}
              </Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
                placeholder={editingUser ? "Leave blank to keep current" : "Min 8 characters"}
                data-testid="input-password"
              />
            </div>

            <div>
              <Label className="text-sm mb-2 block">Permissions</Label>
              <div className="grid grid-cols-1 gap-2.5">
                {ALL_PERMISSIONS.map(perm => (
                  <div key={perm.id} className="flex items-center gap-2.5">
                    <Checkbox
                      id={`perm-${perm.id}`}
                      checked={form.permissions.includes(perm.id)}
                      onCheckedChange={() => togglePermission(perm.id)}
                      data-testid={`checkbox-perm-${perm.id}`}
                    />
                    <Label htmlFor={`perm-${perm.id}`} className="text-sm cursor-pointer font-normal">
                      {perm.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {editingUser && (
              <div className="flex items-center gap-2.5">
                <Checkbox
                  id="is-active"
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm(prev => ({ ...prev, isActive: !!checked }))}
                  data-testid="checkbox-is-active"
                />
                <Label htmlFor="is-active" className="text-sm cursor-pointer font-normal">Account Active</Label>
              </div>
            )}
          </div>

          <SheetFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => setSheetOpen(false)}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isPending}
              data-testid="button-save-user"
            >
              {isPending ? "Saving…" : editingUser ? "Save Changes" : "Create User"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
