import { useQuery } from "@tanstack/react-query";
import AdminLogin from "@/pages/AdminLogin";

interface AdminGuardProps {
  children: React.ReactNode;
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const { data, isLoading } = useQuery<{ authenticated: boolean }>({
    queryKey: ["/api/admin/check"],
    staleTime: 5 * 60 * 1000,
  });

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
