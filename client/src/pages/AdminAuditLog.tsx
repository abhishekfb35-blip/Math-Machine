import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, Clock, User, Package, FolderOpen, Tag as TagIcon, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { AuditLog } from "@shared/types";

const ENTITY_TYPES = [
  { value: "all", label: "All Types" },
  { value: "category", label: "Categories" },
  { value: "product", label: "Products" },
  { value: "tag", label: "Tags" },
  { value: "site-config", label: "Site Config" },
];

const ACTION_COLORS: Record<string, string> = {
  created: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  updated: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  deleted: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const ENTITY_ICONS: Record<string, typeof Package> = {
  category: FolderOpen,
  product: Package,
  tag: TagIcon,
};

function formatDate(dateStr: string | Date | null) {
  if (!dateStr) return "Unknown";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatChanges(changes: string | null, action: string): { label: string; from?: string; to?: string }[] {
  if (!changes) return [];
  try {
    const parsed = JSON.parse(changes);
    if (action === "created") {
      return Object.entries(parsed)
        .filter(([_, v]) => v !== null && v !== undefined && v !== "")
        .map(([key, value]) => ({ label: key, to: String(value) }));
    }
    if (action === "deleted") {
      return Object.entries(parsed)
        .filter(([_, v]) => v !== null && v !== undefined && v !== "")
        .map(([key, value]) => ({ label: key, from: String(value) }));
    }
    if (action === "updated") {
      if (parsed.before && parsed.after) {
        return Object.entries(parsed.after)
          .filter(([_, v]) => v !== null && v !== undefined)
          .map(([key, value]) => ({
            label: key,
            from: parsed.before?.[key] != null ? String(parsed.before[key]) : undefined,
            to: String(value),
          }));
      }
      return Object.entries(parsed)
        .filter(([_, v]) => v !== null && v !== undefined)
        .map(([key, value]: [string, any]) => ({
          label: key,
          from: value?.from != null ? String(value.from) : undefined,
          to: value?.to != null ? String(value.to) : undefined,
        }));
    }
    return [];
  } catch {
    return [];
  }
}

function truncateValue(val: string, max = 80) {
  return val.length > max ? val.slice(0, max) + "..." : val;
}

const PAGE_SIZE = 20;

export default function AdminAuditLog() {
  const [entityTypeFilter, setEntityTypeFilter] = useState("all");
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery<{ logs: AuditLog[]; total: number }>({
    queryKey: ["/api/admin/audit-logs", entityTypeFilter, page],
    refetchOnMount: "always",
    queryFn: async () => {
      const params = new URLSearchParams();
      if (entityTypeFilter !== "all") params.set("entityType", entityTypeFilter);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(page * PAGE_SIZE));
      const res = await fetch(`/api/admin/audit-logs?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      return res.json();
    },
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-24" data-testid="admin-audit-log-page">
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" data-testid="text-audit-log-title">Audit Log</h1>
          <p className="text-sm text-muted-foreground">Track all admin changes</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/admin/catalog">
            <Button variant="outline" size="sm" data-testid="link-back-catalog">
              <ChevronLeft className="w-4 h-4 mr-1" /> Catalog
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={entityTypeFilter} onValueChange={(v) => { setEntityTypeFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[160px]" data-testid="select-entity-type-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ENTITY_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {total > 0 && (
          <span className="text-sm text-muted-foreground" data-testid="text-audit-count">
            {total} {total === 1 ? "entry" : "entries"}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-3 w-1/2" />
            </Card>
          ))}
        </div>
      ) : logs.length === 0 ? (
        <Card className="p-8 text-center">
          <Clock className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground" data-testid="text-no-logs">No audit log entries yet</p>
          <p className="text-xs text-muted-foreground mt-1">Changes made in the admin area will appear here</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const Icon = ENTITY_ICONS[log.entityType] || Package;
            const changes = formatChanges(log.changes, log.action);
            return (
              <Card key={log.id} className="p-4" data-testid={`card-audit-${log.id}`}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 p-1.5 rounded-md bg-muted">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge
                        className={`no-default-hover-elevate no-default-active-elevate text-xs ${ACTION_COLORS[log.action] || ""}`}
                        data-testid={`badge-action-${log.id}`}
                      >
                        {log.action}
                      </Badge>
                      <span className="font-medium text-sm" data-testid={`text-entity-name-${log.id}`}>
                        {log.entityName || log.entityId}
                      </span>
                      <Badge variant="secondary" className="text-xs capitalize">
                        {log.entityType}
                      </Badge>
                    </div>

                    {changes.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {changes.slice(0, 5).map((c, i) => (
                          <div key={i} className="text-xs flex items-start gap-1 flex-wrap">
                            <span className="font-medium text-muted-foreground min-w-[60px]">{c.label}:</span>
                            {c.from !== undefined && (
                              <span className="text-red-600 dark:text-red-400 line-through">
                                {truncateValue(c.from)}
                              </span>
                            )}
                            {c.from !== undefined && c.to !== undefined && (
                              <span className="text-muted-foreground mx-0.5">→</span>
                            )}
                            {c.to !== undefined && (
                              <span className="text-green-600 dark:text-green-400">
                                {truncateValue(c.to)}
                              </span>
                            )}
                          </div>
                        ))}
                        {changes.length > 5 && (
                          <p className="text-xs text-muted-foreground">+{changes.length - 5} more fields</p>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        <span data-testid={`text-username-${log.id}`}>{log.username}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span data-testid={`text-time-${log.id}`}>{formatDate(log.createdAt)}</span>
                      </span>
                      <span className="font-mono opacity-60" data-testid={`text-entity-id-${log.id}`}>
                        ID: {log.entityId}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
            data-testid="button-prev-page"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground" data-testid="text-page-info">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
            data-testid="button-next-page"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
