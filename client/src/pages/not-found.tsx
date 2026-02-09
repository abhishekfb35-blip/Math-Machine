import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center space-y-4 pb-24 md:pb-20">
      <SearchX className="w-12 h-12 text-muted-foreground" />
      <h1 className="text-2xl font-bold">Page Not Found</h1>
      <p className="text-sm text-muted-foreground max-w-sm">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link href="/">
        <Button data-testid="button-go-home">Go Home</Button>
      </Link>
    </div>
  );
}
