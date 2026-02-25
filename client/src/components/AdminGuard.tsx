import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";
import AdminLogin from "@/pages/AdminLogin";

interface AdminGuardProps {
  children: React.ReactNode;
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const [location, setLocation] = useLocation();
  const { data, isLoading } = useQuery<{ authenticated: boolean }>({
    queryKey: ["/api/admin/check"],
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!isLoading && !data?.authenticated && location !== "/admin" && location !== "/admin/login") {
      setLocation("/admin", { replace: true });
    }
  }, [isLoading, data?.authenticated, location, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!data?.authenticated) {
    return <AdminLogin />;
  }

  return <>{children}</>;
}
