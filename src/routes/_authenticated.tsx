import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Search, Mail, Bell, User as UserIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { session, user, loading, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/login", replace: true });
    } else if (!loading && session) {
      if ((role === "pending" || role === "employee") && location.pathname !== "/nomina") {
        navigate({ to: "/nomina", replace: true });
      }
    }
  }, [loading, session, navigate, role, location.pathname]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground text-sm font-medium">
        <div className="flex flex-col items-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Cargando sistema...</span>
        </div>
      </div>
    );
  }

  // Get user initials and display name
  const emailName = user?.email ? user.email.split("@")[0] : "Usuario";
  const displayName = user?.user_metadata?.full_name || emailName.charAt(0).toUpperCase() + emailName.slice(1);
  const initials = displayName.substring(0, 2).toUpperCase();

  // Resolve role dynamically
  const displayRole = role === "admin" ? "Administrador" : role === "manager" ? "Gerente" : "Empleado";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background/95 text-foreground selection:bg-primary/20">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Donezo-style Premium Top Header */}
          <header className="h-20 flex items-center justify-between border-b border-border/60 px-4 md:px-6 gap-4 bg-background/50 backdrop-blur-md sticky top-0 z-50">
            {/* Left Header Section: Sidebar Toggle & Donezo Search Bar */}
            <div className="flex items-center gap-3 md:gap-4 flex-1 max-w-md">
              <SidebarTrigger className="h-9 w-9 border border-border/80 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer shrink-0" />
              
              {/* Dynamic Mobile Brand Tag */}
              <div className="md:hidden font-black text-xs uppercase tracking-wider text-foreground flex items-center gap-1.5 shrink-0 bg-accent/40 px-2.5 py-1.5 rounded-lg border border-border/60">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                <span>El Borrego</span>
              </div>
              
              <div className="relative w-full hidden md:block group">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[16px] w-[16px] text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  type="text"
                  placeholder="Buscar mesa, venta, plato o stock..."
                  className="w-full h-10 pl-10 pr-12 rounded-xl bg-accent/40 border border-border/80 focus:border-primary/50 focus:bg-background/80 focus:ring-2 focus:ring-primary/10 transition-all duration-300 text-sm outline-none placeholder:text-muted-foreground/70"
                />
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-5 select-none items-center gap-0.5 rounded border border-border/60 bg-background px-1.5 font-mono text-[10px] font-bold text-muted-foreground shadow-sm">
                  <span className="text-[9px]">⌘</span>F
                </kbd>
              </div>
            </div>
 
            {/* Right Header Section: Quick Tools & Detailed User Profile */}
            <div className="flex items-center gap-3 md:gap-5">
              {/* Messages Icon with Badge - Hidden on extra-small mobile to preserve space */}
              <button className="relative h-10 w-10 hidden xs:flex items-center justify-center rounded-xl border border-border/60 hover:bg-accent/60 transition-all duration-300 text-muted-foreground hover:text-foreground cursor-pointer shrink-0">
                <Mail className="h-[18px] w-[18px]" />
                <span className="absolute top-2 right-2.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background animate-pulse" />
              </button>
 
              {/* Notification Bell Icon with Badge */}
              <button className="relative h-10 w-10 flex items-center justify-center rounded-xl border border-border/60 hover:bg-accent/60 transition-all duration-300 text-muted-foreground hover:text-foreground cursor-pointer shrink-0">
                <Bell className="h-[18px] w-[18px]" />
                <span className="absolute top-2 right-2.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
              </button>
 
              {/* Visual Separator */}
              <div className="h-6 w-px bg-border/80 hidden sm:block shrink-0" />
 
              {/* Detailed Profile Block matching Totok Michael */}
              <div className="flex items-center gap-2.5 md:gap-3">
                <Avatar className="h-10 w-10 border border-primary/20 shadow-sm rounded-xl shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs rounded-xl">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col text-left hidden sm:flex gap-0.5 max-w-[150px]">
                  <span className="text-xs font-bold text-foreground leading-none truncate">
                    {displayName}
                  </span>
                  <span className="text-[9px] font-bold text-primary uppercase tracking-wider leading-none mt-0.5">
                    {displayRole}
                  </span>
                </div>
              </div>
            </div>
          </header>
          
          <main className="flex-1 overflow-auto bg-background/50">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}