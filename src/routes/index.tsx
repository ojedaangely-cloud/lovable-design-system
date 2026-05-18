import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard" });
  }, [loading, session, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="max-w-xl text-center space-y-6">
        <h1 className="text-5xl font-bold tracking-tight">Restaurante Lite</h1>
        <p className="text-muted-foreground text-lg">
          Gestiona ventas, gastos e inventario de tu restaurante en un solo lugar.
        </p>
        <div className="flex gap-3 justify-center">
          <Button asChild size="lg"><Link to="/login">Entrar</Link></Button>
        </div>
      </div>
    </div>
  );
}
