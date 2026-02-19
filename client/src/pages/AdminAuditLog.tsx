import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChevronLeft, ChevronDown, ChevronRight, Clock, User, Package, FolderOpen, Tag as TagIcon, Settings, Hash, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { AuditLog } from "@shared/types";

const ENTITY_TYPE_META: Record<string, { label: string; pluralLabel: string; icon: typeof Package }> = {
  category: { label: "Category", pluralLabel: "Categories", icon: FolderOpen },
  product: { label: "Product", pluralLabel: "Products", icon: Package },
  tag: { label: "Tag", pluralLabel: "Tags", icon: TagIcon },
  "site-config": { label: "Site Config", pluralLabel: "Site Config", icon: Settings },
};

const ACTION_COLORS: Record<string, string> = {
  created: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  updated: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  deleted: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
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

type TypeSummary = { entityType: string; count: number; lastChangeAt: string | null };
type EntitySummary = { entityId: string; entityName: string | null; count: number; lastChangeAt: string | null; lastAction: string | null };

function EntityTimelineInline({ entityType, entityId }: { entityType: string; entityId: string }) {
  const { data, isLoading } = useQuery<{ logs: AuditLog[]; total: number }>({
    queryKey: ["/api/admin/audit-logs", entityType, entityId],
    refetchOnMount: "always",
    queryFn: async () => {
      const params = new URLSearchParams({ entityType, entityId, limit: "50" });
      const res = await fetch(`/api/admin/audit-logs?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const logs = data?.logs || [];

  if (isLoading) {
    return (
      <div className="pl-6 pt-2 pb-1 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading changes...
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="pl-6 pt-2 pb-1 text-xs text-muted-foreground">No changes recorded</div>
    );
  }

  return (
    <div className="mt-3 relative">
      <div className="absolute left-[11px] top-0 bottom-0 w-px bg-border" />
      <div className="space-y-2">
        {logs.map((log) => {
          const changes = formatChanges(log.changes, log.action);
          return (
            <div key={log.id} className="relative pl-7" data-testid={`card-timeline-${log.id}`}>
              <div className={`absolute left-1 top-3 w-2.5 h-2.5 rounded-full border-2 border-background ${
                log.action === "created" ? "bg-green-500" : log.action === "deleted" ? "bg-red-500" : "bg-blue-500"
              }`} />
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Badge
                    className={`no-default-hover-elevate no-default-active-elevate text-xs ${ACTION_COLORS[log.action] || ""}`}
                    data-testid={`badge-action-${log.id}`}
                  >
                    {log.action}
                  </Badge>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      <span data-testid={`text-username-${log.id}`}>{log.username}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span data-testid={`text-time-${log.id}`}>{formatDate(log.createdAt)}</span>
                    </span>
                  </div>
                </div>
                {changes.length > 0 && (
                  <div className="space-y-0.5 mt-1">
                    {changes.slice(0, 8).map((c, i) => (
                      <div key={i} className="text-xs flex items-start gap-1 flex-wrap">
                        <span className="font-medium text-muted-foreground min-w-[60px]">{c.label}:</span>
                        {c.from !== undefined && (
                          <span className="text-red-600 dark:text-red-400 line-through">{truncateValue(c.from)}</span>
                        )}
                        {c.from !== undefined && c.to !== undefined && (
                          <span className="text-muted-foreground mx-0.5">&rarr;</span>
                        )}
                        {c.to !== undefined && (
                          <span className="text-green-600 dark:text-green-400">{truncateValue(c.to)}</span>
                        )}
                      </div>
                    ))}
                    {changes.length > 8 && (
                      <p className="text-xs text-muted-foreground">+{changes.length - 8} more fields</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EntityListInline({ entityType }: { entityType: string }) {
  const [expandedEntity, setExpandedEntity] = useState<string | null>(null);

  const { data, isLoading } = useQuery<EntitySummary[]>({
    queryKey: ["/api/admin/audit-logs/entity-summary", entityType],
    refetchOnMount: "always",
    queryFn: async () => {
      const res = await fetch(`/api/admin/audit-logs/entity-summary?entityType=${entityType}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="pl-4 pt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading entities...
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="pl-4 pt-2 text-xs text-muted-foreground">No entries for this type</div>
    );
  }

  return (
    <div className="mt-2 space-y-1">
      {data.map((entity) => {
        const isExpanded = expandedEntity === entity.entityId;
        return (
          <div key={entity.entityId} data-testid={`card-entity-${entity.entityId}`}>
            <div
              className="flex items-center gap-2 p-3 rounded-md cursor-pointer hover-elevate"
              onClick={() => setExpandedEntity(isExpanded ? null : entity.entityId)}
              data-testid={`button-expand-entity-${entity.entityId}`}
            >
              {isExpanded
                ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              }
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm" data-testid={`text-entity-name-${entity.entityId}`}>
                    {entity.entityName || entity.entityId}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {entity.count} {entity.count === 1 ? "change" : "changes"}
                  </span>
                  {entity.lastAction && (
                    <Badge className={`no-default-hover-elevate no-default-active-elevate text-xs ${ACTION_COLORS[entity.lastAction] || ""}`}>
                      {entity.lastAction}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-xs opacity-50" data-testid={`text-entity-id-${entity.entityId}`}>
                    ID: {entity.entityId}
                  </span>
                  {entity.lastChangeAt && (
                    <span className="text-xs text-muted-foreground">{formatDate(entity.lastChangeAt)}</span>
                  )}
                </div>
              </div>
            </div>
            {isExpanded && (
              <div className="ml-4 mb-2">
                <EntityTimelineInline entityType={entityType} entityId={entity.entityId} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AdminAuditLog() {
  const [expandedType, setExpandedType] = useState<string | null>(null);

  const { data: typeSummary, isLoading } = useQuery<TypeSummary[]>({
    queryKey: ["/api/admin/audit-logs/type-summary"],
    refetchOnMount: "always",
    queryFn: async () => {
      const res = await fetch("/api/admin/audit-logs/type-summary", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-24" data-testid="admin-audit-log-page">
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" data-testid="text-audit-log-title">Audit Log</h1>
          <p className="text-sm text-muted-foreground">Track all admin changes</p>
        </div>
        <Link href="/admin/catalog">
          <Button variant="outline" size="sm" data-testid="link-back-catalog">
            <ChevronLeft className="w-4 h-4 mr-1" /> Catalog
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4"><Skeleton className="h-5 w-1/2 mb-2" /><Skeleton className="h-3 w-1/3" /></Card>
          ))}
        </div>
      ) : !typeSummary || typeSummary.length === 0 ? (
        <Card className="p-8 text-center">
          <Clock className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground" data-testid="text-no-logs">No audit log entries yet</p>
          <p className="text-xs text-muted-foreground mt-1">Changes made in the admin area will appear here</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {typeSummary.map((item) => {
            const meta = ENTITY_TYPE_META[item.entityType] || { label: item.entityType, pluralLabel: item.entityType, icon: Package };
            const Icon = meta.icon;
            const isExpanded = expandedType === item.entityType;
            return (
              <Card key={item.entityType} className="overflow-visible" data-testid={`card-type-${item.entityType}`}>
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover-elevate rounded-md"
                  onClick={() => setExpandedType(isExpanded ? null : item.entityType)}
                  data-testid={`button-expand-type-${item.entityType}`}
                >
                  {isExpanded
                    ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  }
                  <div className="p-2 rounded-md bg-muted">
                    <Icon className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium" data-testid={`text-type-label-${item.entityType}`}>{meta.pluralLabel}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.count} {item.count === 1 ? "change" : "changes"}
                      {item.lastChangeAt && <span> &middot; Last: {formatDate(item.lastChangeAt)}</span>}
                    </div>
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-4 pb-4">
                    <EntityListInline entityType={item.entityType} />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
