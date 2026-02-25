import { Link } from "wouter";
import { ChevronLeft, Rocket, Database, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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

export default function AdminChecks() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-24">
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <Link href="/admin/catalog">
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
    </div>
  );
}
