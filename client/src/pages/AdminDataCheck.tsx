import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChevronLeft, Database, AlertTriangle, CheckCircle2, XCircle, Info, RefreshCw, Server, ChevronDown, ChevronRight, Key, BarChart3, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ColumnInfo {
  column: string;
  type: string;
  nullable: boolean;
}

interface StructureCheck {
  table: string;
  status: "pass" | "warn" | "fail" | "missing_table";
  expectedColumns: ColumnInfo[];
  actualColumns: ColumnInfo[];
  missingColumns: string[];
  extraColumns: string[];
  typeMismatches: { column: string; expected: string; actual: string }[];
}

interface TableCount {
  table: string;
  count: number;
  status: "pass" | "warn" | "empty";
}

interface IdFormatCheck {
  table: string;
  column: string;
  actualType: string;
  expectedType: string;
  totalRows: number;
  cuid2Count: number;
  nonCuid2Count: number;
  sampleIds: string[];
  status: "pass" | "fail" | "empty";
}

interface FkIdCheck {
  table: string;
  column: string;
  actualType: string;
  expectedType: string;
  totalRows: number;
  cuid2Count: number;
  nonCuid2Count: number;
  status: "pass" | "fail" | "empty";
}

interface DataCompletenessItem {
  field: string;
  actualType: string;
  expectedType: string;
  totalProducts: number;
  nullCount: number;
  populatedCount: number;
  status: "pass" | "warn";
}

interface SampleData {
  products: { id: string; slug: string; sku: string | null }[];
  categories: { id: string; slug: string; name: string }[];
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
  idFormatChecks?: IdFormatCheck[];
  fkIdChecks?: FkIdCheck[];
  dataCompleteness?: DataCompletenessItem[];
  sampleData?: SampleData;
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

function SchemaStructureList({ checks }: { checks: StructureCheck[] }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (table: string) => {
    setExpanded(prev => ({ ...prev, [table]: !prev[table] }));
  };

  return (
    <div className="space-y-3">
      {checks.map((check) => {
        const isOpen = expanded[check.table] || false;
        const colCount = check.actualColumns?.length || 0;
        const expectedCount = check.expectedColumns?.length || 0;

        return (
          <div key={check.table} className="border rounded-md" data-testid={`schema-table-${check.table}`}>
            <button
              onClick={() => toggle(check.table)}
              className="w-full flex items-center justify-between gap-2 p-3 hover:bg-muted/50 transition-colors text-left"
              data-testid={`button-expand-${check.table}`}
            >
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                <StatusIcon status={check.status} />
                <span className="font-medium font-mono text-sm">{check.table}</span>
                <span className="text-xs text-muted-foreground">({colCount} col{colCount !== 1 ? "s" : ""})</span>
              </div>
              <StatusBadge status={check.status} />
            </button>

            {check.missingColumns.length > 0 && (
              <div className="px-3 pb-2 pl-12">
                <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Missing columns:</p>
                <div className="flex gap-1.5 flex-wrap">
                  {check.missingColumns.map((col) => (
                    <Badge key={col} variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs font-mono">{col}</Badge>
                  ))}
                </div>
              </div>
            )}

            {check.extraColumns.length > 0 && (
              <div className="px-3 pb-2 pl-12">
                <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400 mb-1">Extra columns (not in schema):</p>
                <div className="flex gap-1.5 flex-wrap">
                  {check.extraColumns.map((col) => (
                    <Badge key={col} variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs font-mono">{col}</Badge>
                  ))}
                </div>
              </div>
            )}

            {check.typeMismatches.length > 0 && (
              <div className="px-3 pb-2 pl-12">
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

            {isOpen && check.actualColumns && check.actualColumns.length > 0 && (
              <div className="border-t px-3 py-3 bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Actual: {colCount} columns | Expected: {expectedCount} columns
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-1.5 pr-4 font-medium text-muted-foreground">Column</th>
                        <th className="text-left py-1.5 pr-4 font-medium text-muted-foreground">Type</th>
                        <th className="text-left py-1.5 font-medium text-muted-foreground">Nullable</th>
                        <th className="text-left py-1.5 font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {check.actualColumns.map((col) => {
                        const isExtra = check.extraColumns.includes(col.column);
                        const mismatch = check.typeMismatches.find(m => m.column === col.column);

                        let rowClass = "";
                        let statusLabel = "OK";
                        if (isExtra) {
                          rowClass = "bg-yellow-50 dark:bg-yellow-900/10";
                          statusLabel = "Extra";
                        } else if (mismatch) {
                          rowClass = "bg-red-50 dark:bg-red-900/10";
                          statusLabel = "Type mismatch";
                        }

                        return (
                          <tr key={col.column} className={`border-b last:border-b-0 ${rowClass}`}>
                            <td className="py-1.5 pr-4 font-mono">{col.column}</td>
                            <td className="py-1.5 pr-4 font-mono text-muted-foreground">
                              {col.type}
                              {mismatch && (
                                <span className="text-red-600 dark:text-red-400 ml-1">(expected: {mismatch.expected})</span>
                              )}
                            </td>
                            <td className="py-1.5 text-muted-foreground">{col.nullable ? "Yes" : "No"}</td>
                            <td className="py-1.5">
                              {statusLabel === "OK" && <span className="text-green-600 dark:text-green-400">OK</span>}
                              {statusLabel === "Extra" && <span className="text-yellow-600 dark:text-yellow-400">Extra</span>}
                              {statusLabel === "Type mismatch" && <span className="text-red-600 dark:text-red-400">Mismatch</span>}
                            </td>
                          </tr>
                        );
                      })}
                      {check.missingColumns.map((col) => {
                        const expectedCol = check.expectedColumns?.find(e => e.column === col);
                        return (
                          <tr key={col} className="border-b last:border-b-0 bg-red-50 dark:bg-red-900/10">
                            <td className="py-1.5 pr-4 font-mono text-red-600 dark:text-red-400">{col}</td>
                            <td className="py-1.5 pr-4 font-mono text-red-600 dark:text-red-400">{expectedCol?.type || "?"}</td>
                            <td className="py-1.5 text-red-600 dark:text-red-400">{expectedCol?.nullable ? "Yes" : "No"}</td>
                            <td className="py-1.5"><span className="text-red-600 dark:text-red-400 font-medium">Missing</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}
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
          <Link href="/admin">
            <Button variant="ghost" size="icon" data-testid="button-back-catalog">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold" data-testid="text-data-check-title">Database Health Check</h1>
            <p className="text-sm text-muted-foreground">Schema structure, ID formats, and data integrity</p>
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

          {data.idFormatChecks && data.idFormatChecks.length > 0 && (
            <Card className="p-6" data-testid="section-id-format">
              <div className="flex items-center gap-2 mb-4">
                <Key className="w-5 h-5 text-muted-foreground" />
                <h2 className="font-semibold text-lg">ID Format (Primary Keys)</h2>
                <Badge variant="secondary" className="ml-auto">
                  {data.idFormatChecks.filter(c => c.status === "pass").length}/{data.idFormatChecks.filter(c => c.status !== "empty").length} CUID2
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-3">All IDs should be CUID2 format (24+ lowercase alphanumeric characters). Non-CUID2 IDs indicate a data mismatch.</p>
              <div className="space-y-2">
                {data.idFormatChecks.map((check) => {
                  const typeMismatch = check.actualType !== check.expectedType;
                  return (
                  <div key={check.table} className="border rounded-md p-3" data-testid={`id-format-${check.table}`}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <StatusIcon status={check.status} />
                        <span className="font-mono text-sm font-medium">{check.table}<span className="text-muted-foreground">.{check.column || "id"}</span></span>
                        <span className="text-xs text-muted-foreground">({check.totalRows} rows)</span>
                      </div>
                      <StatusBadge status={check.status} />
                    </div>
                    {check.status !== "empty" && (
                      <>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mb-2">
                          <span>
                            Column type: <code className={`px-1 py-0.5 rounded text-[11px] ${typeMismatch ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-medium" : "bg-muted"}`}>{check.actualType}</code>
                            {typeMismatch && (
                              <span className="text-red-600 dark:text-red-400 ml-1">(expected: <code className="px-1 py-0.5 rounded text-[11px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">{check.expectedType}</code>)</span>
                            )}
                          </span>
                          <span className="text-green-600 dark:text-green-400">CUID2: {check.cuid2Count}</span>
                          {check.nonCuid2Count > 0 && (
                            <span className="text-red-600 dark:text-red-400 font-medium">{check.nonCuid2Count} of {check.totalRows} rows mismatched</span>
                          )}
                        </div>
                        {check.sampleIds.length > 0 && (
                          <div className="text-xs text-muted-foreground">
                            <span className="font-medium">Sample values: </span>
                            {check.sampleIds.map((id, i) => (
                              <span key={i}>
                                <code className={`px-1 py-0.5 rounded text-[11px] ${/^[a-z0-9]{24,}$/.test(id) ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"}`}>{id}</code>
                                {i < check.sampleIds.length - 1 && " "}
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  );
                })}
              </div>
            </Card>
          )}

          {data.fkIdChecks && data.fkIdChecks.length > 0 && (
            <Card className="p-6" data-testid="section-fk-format">
              <div className="flex items-center gap-2 mb-4">
                <Key className="w-5 h-5 text-muted-foreground" />
                <h2 className="font-semibold text-lg">ID Format (Foreign Keys)</h2>
                <Badge variant="secondary" className="ml-auto">
                  {data.fkIdChecks.filter(c => c.status === "pass").length}/{data.fkIdChecks.filter(c => c.status !== "empty").length} CUID2
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Foreign key references should also be CUID2 format to match primary keys.</p>
              <div className="space-y-2">
                {data.fkIdChecks.map((check) => {
                  const typeMismatch = check.actualType !== check.expectedType;
                  return (
                  <div key={`${check.table}-${check.column}`} className="border rounded-md p-3" data-testid={`fk-format-${check.table}-${check.column}`}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <StatusIcon status={check.status} />
                        <span className="font-mono text-sm font-medium">{check.table}<span className="text-muted-foreground">.{check.column}</span></span>
                      </div>
                      <StatusBadge status={check.status} />
                    </div>
                    {check.status !== "empty" && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-1">
                        <span>
                          Column type: <code className={`px-1 py-0.5 rounded text-[11px] ${typeMismatch ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-medium" : "bg-muted"}`}>{check.actualType}</code>
                          {typeMismatch && (
                            <span className="text-red-600 dark:text-red-400 ml-1">(expected: <code className="px-1 py-0.5 rounded text-[11px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">{check.expectedType}</code>)</span>
                          )}
                        </span>
                        <span className="text-green-600 dark:text-green-400">CUID2: {check.cuid2Count}</span>
                        {check.nonCuid2Count > 0 && (
                          <span className="text-red-600 dark:text-red-400 font-medium">{check.nonCuid2Count} of {check.totalRows} rows mismatched</span>
                        )}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </Card>
          )}

          <Card className="p-6" data-testid="section-schema">
            <div className="flex items-center gap-2 mb-4">
              <Database className="w-5 h-5 text-muted-foreground" />
              <h2 className="font-semibold text-lg">Schema Structure</h2>
              <Badge variant="secondary" className="ml-auto">
                {data.structureChecks.filter(c => c.status === "pass").length}/{data.structureChecks.length} tables OK
              </Badge>
            </div>

            <SchemaStructureList checks={data.structureChecks} />
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

          {data.dataCompleteness && data.dataCompleteness.length > 0 && (
            <Card className="p-6" data-testid="section-completeness">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-muted-foreground" />
                <h2 className="font-semibold text-lg">Product Data Completeness</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Checks column data types and null/empty values in important product fields.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Column</th>
                      <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Type</th>
                      <th className="text-right py-2 pr-4 font-medium text-muted-foreground">Populated</th>
                      <th className="text-right py-2 pr-4 font-medium text-muted-foreground">Null/Empty</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.dataCompleteness.map((item) => {
                      const typeMismatch = item.actualType && item.expectedType && item.actualType !== item.expectedType;
                      return (
                      <tr key={item.field} className={`border-b last:border-b-0 ${item.status === "warn" || typeMismatch ? "bg-yellow-50 dark:bg-yellow-900/10" : ""}`} data-testid={`completeness-${item.field}`}>
                        <td className="py-2 pr-4 font-mono text-sm">products.{item.field}</td>
                        <td className="py-2 pr-4 text-sm">
                          <code className={`px-1 py-0.5 rounded text-[11px] ${typeMismatch ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-medium" : "bg-muted"}`}>{item.actualType || "?"}</code>
                          {typeMismatch && (
                            <span className="text-red-600 dark:text-red-400 text-xs ml-1">(expected: <code className="px-1 py-0.5 rounded text-[11px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">{item.expectedType}</code>)</span>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">{item.populatedCount}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">
                          {item.nullCount > 0 ? (
                            <span className="text-yellow-600 dark:text-yellow-400 font-medium">{item.nullCount} of {item.totalProducts}</span>
                          ) : (
                            <span className="text-green-600 dark:text-green-400">0</span>
                          )}
                        </td>
                        <td className="py-2 text-right">
                          <StatusIcon status={typeMismatch ? "fail" : item.status} />
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

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

          {data.sampleData && (
            <Card className="p-6" data-testid="section-sample-data">
              <div className="flex items-center gap-2 mb-4">
                <Eye className="w-5 h-5 text-muted-foreground" />
                <h2 className="font-semibold text-lg">Sample Data (for comparison)</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-4">Compare these values between dev and production to verify IDs and data match.</p>

              {data.sampleData.categories.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium mb-2">Categories</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-1.5 pr-4 font-medium text-muted-foreground">Slug</th>
                          <th className="text-left py-1.5 pr-4 font-medium text-muted-foreground">ID</th>
                          <th className="text-left py-1.5 font-medium text-muted-foreground">Name</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.sampleData.categories.map((cat) => (
                          <tr key={cat.slug} className="border-b last:border-b-0" data-testid={`sample-cat-${cat.slug}`}>
                            <td className="py-1.5 pr-4 font-mono">{cat.slug}</td>
                            <td className="py-1.5 pr-4">
                              <code className={`px-1 py-0.5 rounded text-[11px] ${/^[a-z0-9]{24,}$/.test(cat.id) ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"}`}>{cat.id}</code>
                            </td>
                            <td className="py-1.5">{cat.name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {data.sampleData.products.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-2">Products</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-1.5 pr-4 font-medium text-muted-foreground">Slug</th>
                          <th className="text-left py-1.5 pr-4 font-medium text-muted-foreground">ID</th>
                          <th className="text-left py-1.5 font-medium text-muted-foreground">SKU</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.sampleData.products.map((prod) => (
                          <tr key={prod.slug} className="border-b last:border-b-0" data-testid={`sample-prod-${prod.slug}`}>
                            <td className="py-1.5 pr-4 font-mono">{prod.slug}</td>
                            <td className="py-1.5 pr-4">
                              <code className={`px-1 py-0.5 rounded text-[11px] ${/^[a-z0-9]{24,}$/.test(prod.id) ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"}`}>{prod.id}</code>
                            </td>
                            <td className="py-1.5">
                              {prod.sku ? (
                                <code className="px-1 py-0.5 rounded text-[11px] bg-muted">{prod.sku}</code>
                              ) : (
                                <span className="text-red-500 dark:text-red-400 text-[11px] font-medium">null</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </Card>
          )}

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