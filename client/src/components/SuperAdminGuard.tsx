import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";

interface SuperAdminGuardProps {
  children: React.ReactNode;
}

export default function SuperAdminGuard({ children }: SuperAdminGuardProps) {
  const [, setLocation] = useLocation();
  const { data, isLoading } = useQuery<{ authenticated: boolean; isSuperAdmin: boolean; permissions: string[] }>({
    queryKey: ["/api/admin/check"],
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!isLoading) {
      if (!data?.authenticated) {
        setLocation("/admin", { replace: true });
      } else if (!data?.isSuperAdmin) {
        setLocation("/admin", { replace: true });
      }
    }
  }, [isLoading, data?.authenticated, data?.isSuperAdmin, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!data?.authenticated || !data?.isSuperAdmin) {
    return null;
  }

  return <>{children}</>;
}
