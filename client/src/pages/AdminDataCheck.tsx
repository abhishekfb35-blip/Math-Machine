import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChevronLeft, Database, AlertTriangle, CheckCircle2, XCircle, Info, RefreshCw, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface StructureCheck {
  table: string;
  status: "pass" | "warn" | "fail" | "missing_table";
  missingColumns: string[];
  extraColumns: string[];
  typeMismatches: { column: string; expected: string; actual: string }[];
}

interface TableCount {
  table: string;
  count: number;
  status: "pass" | "warn" | "empty";
}

interface DataCheckResponse {
  environment: string;
  timestamp: string;
  overallStatus: "pass" | "warn" | "fail";
  structureChecks: StructureCheck[];
  tableCounts: TableCount[];
  integrityIssues: string[];
  siteConfig: {
    existingKeys: string[];
    missingConfigKeys: string[];
  };
}

function StatusIcon({ status }: { status: string }) {
  if (status === "pass") return <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />;
  if (status === "warn") return <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 shrink-0" />;
  return <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "pass") return <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Pass</Badge>;
  if (status === "warn") return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">Warning</Badge>;
  if (status === "empty") return <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Empty</Badge>;
  if (status === "missing_table") return <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Missing Table</Badge>;
  return <Badge variant="destructive">Fail</Badge>;
}

function OverallStatusBanner({ status }: { status: string }) {
  if (status === "pass") {
    return (
      <div className="flex items-center gap-3 p-4 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800" data-testid="status-overall">
        <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400 shrink-0" />
        <div>
          <p className="font-semibold text-green-800 dark:text-green-300">All Checks Passed</p>
          <p className="text-sm text-green-700 dark:text-green-400">Database structure and data are healthy.</p>
        </div>
      </div>
    );
  }
  if (status === "warn") {
    return (
      <div className="flex items-center gap-3 p-4 rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800" data-testid="status-overall">
        <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400 shrink-0" />
        <div>
          <p className="font-semibold text-yellow-800 dark:text-yellow-300">Warnings Found</p>
          <p className="text-sm text-yellow-700 dark:text-yellow-400">Some issues need attention. Review details below.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 p-4 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800" data-testid="status-overall">
      <XCircle className="w-6 h-6 text-red-600 dark:text-red-400 shrink-0" />
      <div>
        <p className="font-semibold text-red-800 dark:text-red-300">Issues Detected</p>
        <p className="text-sm text-red-700 dark:text-red-400">Critical schema or data problems found. Immediate action required.</p>
      </div>
    </div>
  );
}

export default function AdminDataCheck() {
  const { data, isLoading, refetch, isFetching, isError, error } = useQuery<DataCheckResponse>({
    queryKey: ["/api/admin/data-check"],
    staleTime: 0,
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-24">
      <div className="flex items-center justify-between gap-2 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/admin/catalog">
            <Button variant="ghost" size="icon" data-testid="button-back-catalog">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold" data-testid="text-data-check-title">Database Health Check</h1>
            <p className="text-sm text-muted-foreground">Schema structure and data integrity</p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
          data-testid="button-refresh"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 mb-6" data-testid="banner-instruction">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 dark:text-blue-300">
          Open this page on both dev (localhost) and production (turtlelittle.com) after publishing to compare side by side.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-6 animate-pulse">
              <div className="h-5 bg-muted rounded w-1/3 mb-3" />
              <div className="h-4 bg-muted rounded w-2/3 mb-2" />
              <div className="h-4 bg-muted rounded w-1/2" />
            </Card>
          ))}
        </div>
      ) : data ? (
        <div className="space-y-6">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="outline" className="gap-1.5" data-testid="badge-environment">
              <Server className="w-3.5 h-3.5" />
              {data.environment}
            </Badge>
            <span className="text-xs text-muted-foreground" data-testid="text-timestamp">
              Checked: {new Date(data.timestamp).toLocaleString()}
            </span>
          </div>

          <OverallStatusBanner status={data.overallStatus} />

          <Card className="p-6" data-testid="section-schema">
            <div className="flex items-center gap-2 mb-4">
              <Database className="w-5 h-5 text-muted-foreground" />
              <h2 className="font-semibold text-lg">Schema Structure</h2>
              <Badge variant="secondary" className="ml-auto">
                {data.structureChecks.filter(c => c.status === "pass").length}/{data.structureChecks.length} tables OK
              </Badge>
            </div>

            <div className="space-y-3">
              {data.structureChecks.map((check) => (
                <div key={check.table} className="border rounded-md p-3" data-testid={`schema-table-${check.table}`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <StatusIcon status={check.status} />
                      <span className="font-medium font-mono text-sm">{check.table}</span>
                    </div>
                    <StatusBadge status={check.status} />
                  </div>

                  {check.missingColumns.length > 0 && (
                    <div className="mt-2 pl-6">
                      <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Missing columns:</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {check.missingColumns.map((col) => (
                          <Badge key={col} variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs font-mono">
                            {col}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {check.extraColumns.length > 0 && (
                    <div className="mt-2 pl-6">
                      <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400 mb-1">Extra columns (not in schema):</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {check.extraColumns.map((col) => (
                          <Badge key={col} variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs font-mono">
                            {col}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {check.typeMismatches.length > 0 && (
                    <div className="mt-2 pl-6">
                      <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Type mismatches:</p>
                      <div className="space-y-1">
                        {check.typeMismatches.map((m) => (
                          <p key={m.column} className="text-xs font-mono text-red-600 dark:text-red-400">
                            {m.column}: expected <span className="font-semibold">{m.expected}</span>, got <span className="font-semibold">{m.actual}</span>
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6" data-testid="section-row-counts">
            <h2 className="font-semibold text-lg mb-4">Table Row Counts</h2>
            <div className="space-y-2">
              {data.tableCounts.map((tc) => (
                <div key={tc.table} className="flex items-center justify-between gap-2 py-2 border-b last:border-b-0" data-testid={`row-count-${tc.table}`}>
                  <div className="flex items-center gap-2">
                    <StatusIcon status={tc.status} />
                    <span className="font-mono text-sm">{tc.table}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium tabular-nums" data-testid={`text-count-${tc.table}`}>
                      {tc.count === -1 ? "Error" : tc.count.toLocaleString()}
                    </span>
                    {tc.status !== "pass" && <StatusBadge status={tc.status} />}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6" data-testid="section-integrity">
            <h2 className="font-semibold text-lg mb-4">Data Integrity</h2>
            {data.integrityIssues.length === 0 ? (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400" data-testid="text-no-integrity-issues">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm">No integrity issues found.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {data.integrityIssues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 rounded-md bg-red-50 dark:bg-red-900/20" data-testid={`integrity-issue-${i}`}>
                    <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700 dark:text-red-400">{issue}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6" data-testid="section-site-config">
            <h2 className="font-semibold text-lg mb-4">Site Configuration</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Existing config keys:</p>
                <div className="flex gap-1.5 flex-wrap">
                  {data.siteConfig.existingKeys.length === 0 ? (
                    <span className="text-sm text-muted-foreground">None</span>
                  ) : (
                    data.siteConfig.existingKeys.map((key) => (
                      <Badge key={key} variant="secondary" className="font-mono text-xs" data-testid={`config-key-${key}`}>
                        {key}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
              {data.siteConfig.missingConfigKeys.length > 0 ? (
                <div>
                  <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-2">Missing expected keys:</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {data.siteConfig.missingConfigKeys.map((key) => (
                      <Badge key={key} variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 font-mono text-xs" data-testid={`config-missing-${key}`}>
                        {key}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400" data-testid="text-config-complete">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-sm">All expected config keys present.</span>
                </div>
              )}
            </div>
          </Card>
        </div>
      ) : isError ? (
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <XCircle className="w-6 h-6 text-red-600 dark:text-red-400 shrink-0" />
            <div>
              <p className="font-semibold text-red-800 dark:text-red-300">Failed to load database check</p>
              <p className="text-sm text-muted-foreground mt-1">{(error as Error)?.message || "An unexpected error occurred. You may need to log in to the admin panel first."}</p>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}