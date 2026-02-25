import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChevronLeft, RefreshCw, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, XCircle, Info, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { queryClient } from "@/lib/queryClient";

interface AuditIssue {
  severity: "error" | "warning" | "info";
  message: string;
  entity?: string;
  entitySku?: string;
}

interface AuditCategory {
  name: string;
  score: number;
  passed: number;
  total: number;
  issues: AuditIssue[];
}

interface SeoAuditResult {
  overallScore: number;
  totalIssues: { errors: number; warnings: number; info: number };
  categories: AuditCategory[];
  summary: {
    activeProducts: number;
    inactiveProducts: number;
    totalCategories: number;
    sitemapUrls: number;
  };
  timestamp: string;
}

function ScoreRing({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "text-green-500" : score >= 50 ? "text-yellow-500" : "text-red-500";
  const strokeColor = score >= 80 ? "stroke-green-500" : score >= 50 ? "stroke-yellow-500" : "stroke-red-500";

  return (
    <div className="relative w-36 h-36 mx-auto" data-testid="display-overall-score">
      <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/20" />
        <circle
          cx="60" cy="60" r={radius} fill="none" strokeWidth="8" strokeLinecap="round"
          className={strokeColor}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold ${color}`}>{score}</span>
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

function SeverityIcon({ severity }: { severity: "error" | "warning" | "info" }) {
  if (severity === "error") return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
  if (severity === "warning") return <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />;
  return <Info className="w-4 h-4 text-blue-500 shrink-0" />;
}

function CategorySection({ category }: { category: AuditCategory }) {
  const [expanded, setExpanded] = useState(false);
  const color = category.score >= 80 ? "text-green-600 dark:text-green-400" : category.score >= 50 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400";
  const bgColor = category.score >= 80 ? "bg-green-50 dark:bg-green-950/30" : category.score >= 50 ? "bg-yellow-50 dark:bg-yellow-950/30" : "bg-red-50 dark:bg-red-950/30";
  const errors = category.issues.filter(i => i.severity === "error").length;
  const warnings = category.issues.filter(i => i.severity === "warning").length;
  const infos = category.issues.filter(i => i.severity === "info").length;

  return (
    <Card className="overflow-hidden" data-testid={`card-seo-category-${category.name.toLowerCase().replace(/\s+/g, "-")}`}>
      <button
        className="w-full p-4 flex items-center gap-3 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
        data-testid={`button-toggle-${category.name.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${bgColor}`}>
          <span className={`text-lg font-bold ${color}`}>{category.score}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">{category.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {category.passed}/{category.total} passed
          </div>
        </div>
        <div className="flex items-center gap-2">
          {errors > 0 && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{errors}</Badge>}
          {warnings > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-yellow-500 text-yellow-600 dark:text-yellow-400">{warnings}</Badge>}
          {infos > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-400 text-blue-500">{infos}</Badge>}
          {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && category.issues.length > 0 && (
        <div className="border-t px-4 py-3 space-y-2 max-h-80 overflow-y-auto" data-testid={`list-issues-${category.name.toLowerCase().replace(/\s+/g, "-")}`}>
          {category.issues.map((issue, idx) => (
            <div key={idx} className="flex items-start gap-2 text-sm py-1.5 border-b border-border/40 last:border-0">
              <SeverityIcon severity={issue.severity} />
              <div className="min-w-0 flex-1">
                {issue.entity && <span className="font-medium text-xs text-muted-foreground block truncate">{issue.entity}</span>}
                <span className="text-foreground/80">{issue.message}</span>
                {issue.entitySku && (
                  <span className="block mt-0.5 text-[11px] font-mono font-semibold text-foreground/60" data-testid={`text-entity-sku-${idx}`}>
                    SKU: {issue.entitySku}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {expanded && category.issues.length === 0 && (
        <div className="border-t px-4 py-4 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <CheckCircle2 className="w-4 h-4" /> All checks passed
        </div>
      )}
    </Card>
  );
}

export default function AdminSeoAudit() {
  const { data, isLoading, isFetching } = useQuery<SeoAuditResult>({
    queryKey: ["/api/admin/seo-audit"],
    staleTime: 60_000,
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/seo-audit"] });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-24" data-testid="page-admin-seo-audit">
      <div className="flex items-center justify-between gap-2 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/admin/checks">
            <Button variant="ghost" size="icon" data-testid="button-back-checks">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold" data-testid="text-seo-audit-title">SEO Audit</h1>
            <p className="text-sm text-muted-foreground">Search engine readiness report</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching} data-testid="button-refresh-seo">
          <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Search className="w-10 h-10 text-muted-foreground animate-pulse" />
          <p className="text-muted-foreground text-sm">Running SEO audit...</p>
        </div>
      )}

      {data && (
        <div className="space-y-6">
          <Card className="p-6" data-testid="card-seo-overview">
            <ScoreRing score={data.overallScore} />
            <div className="text-center mt-3">
              <p className="text-sm text-muted-foreground">
                {data.overallScore >= 80 ? "Great SEO health" : data.overallScore >= 50 ? "Needs improvement" : "Critical issues found"}
              </p>
            </div>
            <div className="flex justify-center gap-4 mt-4 text-xs">
              {data.totalIssues.errors > 0 && (
                <span className="flex items-center gap-1 text-red-600 dark:text-red-400" data-testid="text-total-errors">
                  <XCircle className="w-3.5 h-3.5" /> {data.totalIssues.errors} errors
                </span>
              )}
              {data.totalIssues.warnings > 0 && (
                <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400" data-testid="text-total-warnings">
                  <AlertTriangle className="w-3.5 h-3.5" /> {data.totalIssues.warnings} warnings
                </span>
              )}
              {data.totalIssues.info > 0 && (
                <span className="flex items-center gap-1 text-blue-500" data-testid="text-total-info">
                  <Info className="w-3.5 h-3.5" /> {data.totalIssues.info} info
                </span>
              )}
            </div>
          </Card>

          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap" data-testid="display-summary-stats">
            <span>{data.summary.activeProducts} active products</span>
            <span className="text-muted-foreground/40">|</span>
            <span>{data.summary.totalCategories} categories</span>
            <span className="text-muted-foreground/40">|</span>
            <span>~{data.summary.sitemapUrls} sitemap URLs</span>
            {data.summary.inactiveProducts > 0 && (
              <>
                <span className="text-muted-foreground/40">|</span>
                <span>{data.summary.inactiveProducts} inactive</span>
              </>
            )}
          </div>

          <div className="space-y-3" data-testid="list-seo-categories">
            {data.categories.map((cat) => (
              <CategorySection key={cat.name} category={cat} />
            ))}
          </div>

          <p className="text-[11px] text-muted-foreground text-center">
            Last checked: {new Date(data.timestamp).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}
