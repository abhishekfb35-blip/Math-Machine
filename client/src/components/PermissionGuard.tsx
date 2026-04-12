import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";

interface PermissionGuardProps {
  permission: string;
  children: React.ReactNode;
}

export default function PermissionGuard({ permission, children }: PermissionGuardProps) {
  const [, setLocation] = useLocation();
  const { data, isLoading } = useQuery<{ authenticated: boolean; isSuperAdmin: boolean; permissions: string[] }>({
    queryKey: ["/api/admin/check"],
    staleTime: 5 * 60 * 1000,
  });

  const hasAccess = data?.authenticated && (data?.isSuperAdmin || data?.permissions?.includes(permission));

  useEffect(() => {
    if (!isLoading) {
      if (!data?.authenticated) {
        setLocation("/admin", { replace: true });
      } else if (!hasAccess) {
        setLocation("/admin", { replace: true });
      }
    }
  }, [isLoading, data?.authenticated, hasAccess, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!hasAccess) {
    return null;
  }

  return <>{children}</>;
}
