import { useState } from "react";
import { Link } from "wouter";
import { ChevronLeft, Rocket, Database, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";

const checks = [
  {
    title: "Deploy Check",
    description: "Code health, build verification, and route availability",
    href: "/admin/deploy-check",
    icon: Rocket,
    testId: "card-deploy-check",
  },
  {
    title: "Data Check",
    description: "Database schema and data integrity validation",
    href: "/admin/data-check",
    icon: Database,
    testId: "card-data-check",
  },
  {
    title: "SEO Audit",
    description: "SEO readiness score and comprehensive audit",
    href: "/admin/seo-audit",
    icon: Search,
    testId: "card-seo-audit",
  },
];

interface CleanupResult {
  deleted: number;
  filenames: string[];
}

export default function AdminChecks() {
  const [cleanupPending, setCleanupPending] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);
  const [cleanupError, setCleanupError] = useState<string | null>(null);

  async function handleCleanupSwatches() {
    setCleanupPending(true);
    setCleanupResult(null);
    setCleanupError(null);
    try {
      const res = await apiRequest("POST", "/api/admin/cleanup-swatches");
      const data = await res.json();
      setCleanupResult({ deleted: data.deleted, filenames: data.filenames ?? [] });
    } catch (err: any) {
      setCleanupError(err?.message ?? "Failed to clean up swatch files");
    } finally {
      setCleanupPending(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-24">
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <Link href="/admin">
          <Button variant="ghost" size="icon" data-testid="button-back-catalog">
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold" data-testid="text-checks-title">Health Checks</h1>
          <p className="text-sm text-muted-foreground">Run diagnostics and audits</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {checks.map((check) => (
          <Link key={check.href} href={check.href}>
            <Card
              className="p-5 hover-elevate cursor-pointer flex flex-col gap-3"
              data-testid={check.testId}
            >
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-muted p-2">
                  <check.icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <h2 className="font-semibold" data-testid={`text-${check.testId}-title`}>{check.title}</h2>
              </div>
              <p className="text-sm text-muted-foreground" data-testid={`text-${check.testId}-desc`}>
                {check.description}
              </p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="text-base font-semibold mb-3" data-testid="text-actions-title">Maintenance Actions</h2>
        <Card className="p-5 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-muted p-2">
                <Trash2 className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-sm">Clean Up Orphaned Swatches</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Scans the swatch images folder and removes any files not referenced in the database.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={cleanupPending}
              onClick={handleCleanupSwatches}
              data-testid="button-cleanup-swatches"
            >
              {cleanupPending ? "Cleaning…" : "Run Cleanup"}
            </Button>
          </div>

          {cleanupResult !== null && (
            <div className="border-t pt-3 flex flex-col gap-2" data-testid="div-cleanup-result">
              <div className="flex items-center gap-2">
                <Badge variant={cleanupResult.deleted === 0 ? "secondary" : "destructive"} data-testid="badge-cleanup-count">
                  {cleanupResult.deleted} file{cleanupResult.deleted !== 1 ? "s" : ""} deleted
                </Badge>
                {cleanupResult.deleted === 0 && (
                  <span className="text-xs text-muted-foreground" data-testid="text-cleanup-none">No orphaned swatch files found.</span>
                )}
              </div>
              {cleanupResult.filenames.length > 0 && (
                <ul className="text-xs text-muted-foreground space-y-0.5" data-testid="list-cleanup-filenames">
                  {cleanupResult.filenames.map((name) => (
                    <li key={name} data-testid={`item-cleanup-file-${name}`} className="font-mono">
                      {name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {cleanupError && (
            <div className="border-t pt-3">
              <p className="text-xs text-destructive" data-testid="text-cleanup-error">{cleanupError}</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
