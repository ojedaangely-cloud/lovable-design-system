import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo-borrego.jpg";

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-0 right-0 h-96 w-96 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-black/10 blur-3xl pointer-events-none" />

      <div className="max-w-xl text-center space-y-8 relative z-10 flex flex-col items-center">
        {/* Brand Logo */}
        <div className="relative h-32 w-auto max-w-[240px] overflow-hidden transform hover:scale-105 transition-transform duration-300">
          <img src={logo} alt="El Borrego Dorado Logo" className="h-full w-auto object-contain" />
        </div>

        <div className="space-y-4">
          <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-primary bg-clip-text text-transparent">
            El Borrego Dorado
          </h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Sistema administrativo premium de ventas, gastos e inventario. Todo bajo control, en tiempo real.
          </p>
        </div>

        <div className="flex gap-4 justify-center w-full max-w-xs">
          <Button asChild size="lg" className="w-full bg-primary hover:bg-primary/95 text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all duration-300 cursor-pointer">
            <Link to="/login">Entrar al Sistema</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
