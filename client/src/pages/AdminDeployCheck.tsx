import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChevronLeft, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Clock, FileCode, FolderOpen, Route, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { queryClient } from "@/lib/queryClient";

interface DeployCheckResult {
  buildExists: boolean;
  buildTimestamp: string | null;
  buildAgeMinutes: number | null;
  sourceNewerThanBuild: boolean;
  newestSourceFile: string | null;
  newestSourceTimestamp: string | null;
  routeChecks: { route: string; found: boolean }[];
  staticFileChecks: { file: string; exists: boolean; size?: number }[];
  overallStatus: "pass" | "warn" | "fail";
  issues: string[];
}

function StatusIcon({ status }: { status: "pass" | "warn" | "fail" }) {
  if (status === "pass") return <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />;
  if (status === "warn") return <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />;
  return <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />;
}

function PassFail({ pass }: { pass: boolean }) {
  if (pass) {
    return (
      <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
        Pass
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
      Fail
    </Badge>
  );
}

function formatAge(minutes: number | null): string {
  if (minutes === null) return "Unknown";
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h ago`;
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return "N/A";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatSize(bytes?: number): string {
  if (bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdminDeployCheck() {
  const { data, isLoading, isFetching, isError, error } = useQuery<DeployCheckResult>({
    queryKey: ["/api/admin/deploy-check"],
    staleTime: 0,
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/deploy-check"] });
  };

  const routePassed = data ? data.routeChecks.filter(r => r.found).length : 0;
  const routeTotal = data ? data.routeChecks.length : 0;
  const filesPassed = data ? data.staticFileChecks.filter(f => f.exists).length : 0;
  const filesTotal = data ? data.staticFileChecks.length : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
      <div className="flex items-center justify-between gap-2 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/admin/checks">
            <Button variant="ghost" size="icon" data-testid="button-back-catalog">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold" data-testid="text-deploy-check-title">Code Health Check</h1>
            <p className="text-sm text-muted-foreground">Verify build integrity after every publish</p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={isFetching}
          data-testid="button-refresh-deploy-check"
        >
          {isFetching ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      <Card className="p-4 mb-6 flex items-start gap-3">
        <Info className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-sm text-muted-foreground" data-testid="text-deploy-check-instructions">
          Run this check after every publish to verify the build is complete. It verifies the production bundle contains all critical routes, static files are present, and the build is up to date with source code.
        </p>
      </Card>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-6 animate-pulse">
              <div className="h-5 bg-muted rounded w-1/3 mb-3" />
              <div className="h-4 bg-muted rounded w-2/3 mb-2" />
              <div className="h-4 bg-muted rounded w-1/2" />
            </Card>
          ))}
        </div>
      ) : data ? (
        <div className="space-y-4">
          <Card className="p-6" data-testid="card-overall-status">
            <div className="flex items-center gap-3 mb-4">
              <StatusIcon status={data.overallStatus} />
              <h2 className="font-semibold text-lg">
                Overall Status:{" "}
                <span
                  className={
                    data.overallStatus === "pass"
                      ? "text-green-600 dark:text-green-400"
                      : data.overallStatus === "warn"
                        ? "text-yellow-600 dark:text-yellow-400"
                        : "text-red-600 dark:text-red-400"
                  }
                  data-testid="text-overall-status"
                >
                  {data.overallStatus.toUpperCase()}
                </span>
              </h2>
            </div>
            {data.issues.length > 0 && (
              <div className="space-y-1">
                {data.issues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
                    <span className="text-muted-foreground" data-testid={`text-issue-${i}`}>{issue}</span>
                  </div>
                ))}
              </div>
            )}
            {data.issues.length === 0 && (
              <p className="text-sm text-muted-foreground">All checks passed. Build is healthy.</p>
            )}
          </Card>

          <Card className="p-6" data-testid="card-build-status">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-muted-foreground" />
              <h2 className="font-semibold text-lg">Build Status</h2>
            </div>
            {!data.buildExists ? (
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <XCircle className="w-4 h-4" />
                <span>Production bundle not found. Run npm run build.</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Build Timestamp</p>
                    <p className="text-sm font-medium" data-testid="text-build-timestamp">{formatTimestamp(data.buildTimestamp)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Build Age</p>
                    <p className="text-sm font-medium" data-testid="text-build-age">{formatAge(data.buildAgeMinutes)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Newest Source File</p>
                    <p className="text-sm font-medium font-mono break-all" data-testid="text-newest-source">{data.newestSourceFile || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Source Modified</p>
                    <p className="text-sm font-medium" data-testid="text-source-timestamp">{formatTimestamp(data.newestSourceTimestamp)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  {data.sourceNewerThanBuild ? (
                    <>
                      <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                      <span className="text-sm text-yellow-600 dark:text-yellow-400 font-medium" data-testid="text-rebuild-status">
                        Rebuild needed — source is newer than build
                      </span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm text-green-600 dark:text-green-400 font-medium" data-testid="text-rebuild-status">
                        Build is up to date
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}
          </Card>

          <Card className="p-6" data-testid="card-route-checks">
            <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Route className="w-5 h-5 text-muted-foreground" />
                <h2 className="font-semibold text-lg">Route Verification</h2>
              </div>
              <Badge variant="secondary" data-testid="text-route-summary">
                {routePassed}/{routeTotal} passed
              </Badge>
            </div>
            <div className="space-y-2">
              {data.routeChecks.map((check, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 py-2 border-b last:border-b-0"
                  data-testid={`row-route-${i}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileCode className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-mono truncate">{check.route}</span>
                  </div>
                  <PassFail pass={check.found} />
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6" data-testid="card-static-files">
            <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-muted-foreground" />
                <h2 className="font-semibold text-lg">Static Files</h2>
              </div>
              <Badge variant="secondary" data-testid="text-files-summary">
                {filesPassed}/{filesTotal} present
              </Badge>
            </div>
            <div className="space-y-2">
              {data.staticFileChecks.map((check, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 py-2 border-b last:border-b-0"
                  data-testid={`row-file-${i}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FolderOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-mono truncate">{check.file}</span>
                    {check.size !== undefined && (
                      <span className="text-xs text-muted-foreground">({formatSize(check.size)})</span>
                    )}
                  </div>
                  <PassFail pass={check.exists} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : isError ? (
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <XCircle className="w-6 h-6 text-red-600 dark:text-red-400 shrink-0" />
            <div>
              <p className="font-semibold text-red-800 dark:text-red-300">Failed to load deploy check</p>
              <p className="text-sm text-muted-foreground mt-1">{(error as Error)?.message || "An unexpected error occurred. You may need to log in to the admin panel first."}</p>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
