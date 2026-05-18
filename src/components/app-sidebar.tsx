import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, ShoppingCart, Receipt, Package, Settings, HelpCircle, LogOut, ArrowRight, Gift } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo-borrego.jpg";

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Ventas", url: "/ventas", icon: ShoppingCart },
  { title: "Gastos", url: "/gastos", icon: Receipt },
  { title: "Inventario", url: "/inventario", icon: Package },
];

const generalItems = [
  { title: "Ajustes", url: "/ajustes", icon: Settings },
  { title: "Ayuda", url: "#", icon: HelpCircle },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { signOut } = useAuth();

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-sidebar">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-border/60 bg-sidebar/50 backdrop-blur-md">
        <div className="relative flex h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-primary/20 shadow-md bg-white p-0.5">
          <img src={logo} alt="El Borrego Dorado" className="h-full w-full object-contain" />
        </div>
        <div className="flex flex-col gap-0.5 truncate group-data-[collapsible=icon]:hidden">
          <span className="font-extrabold text-base leading-tight text-foreground tracking-tight">El Borrego Dorado</span>
          <span className="text-[10px] text-primary font-bold uppercase tracking-widest">Las Vegas, NV</span>
        </div>
      </div>

      <SidebarContent className="py-4 justify-between flex flex-col h-[calc(100vh-80px)]">
        <div className="space-y-6">
          {/* Main Menu */}
          <SidebarGroup className="px-3">
            <SidebarGroupLabel className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-3 mb-2">
              Menú Principal
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {menuItems.map((item) => {
                  const active = pathname === item.url;
                  return (
                    <SidebarMenuItem key={item.url} className="relative">
                      {/* Donezo Active Indicator */}
                      {active && (
                        <div className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-primary animate-fade-in" />
                      )}
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        className={`w-full transition-all duration-300 font-medium px-4 h-10 rounded-xl ${
                          active
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-accent/60 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Link to={item.url} className="flex items-center gap-3">
                          <item.icon className={`h-[18px] w-[18px] transition-transform duration-300 ${active ? "scale-110 text-primary" : "text-muted-foreground/80 group-hover:text-foreground"}`} />
                          <span className="text-sm">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* General Menu */}
          <SidebarGroup className="px-3">
            <SidebarGroupLabel className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-3 mb-2">
              Soporte y Configuración
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {generalItems.map((item) => {
                  const active = pathname === item.url;
                  return (
                    <SidebarMenuItem key={item.title} className="relative">
                      {active && (
                        <div className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-primary animate-fade-in" />
                      )}
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        className={`w-full transition-all duration-300 font-medium px-4 h-10 rounded-xl ${
                          active
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-accent/60 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Link to={item.url} className="flex items-center gap-3">
                          <item.icon className={`h-[18px] w-[18px] transition-transform duration-300 ${active ? "scale-110 text-primary" : "text-muted-foreground/80"}`} />
                          <span className="text-sm">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
                
                {/* Logout Button inside sidebar matching Donezo list */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={signOut}
                    className="w-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all duration-300 font-medium px-4 h-10 rounded-xl cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <LogOut className="h-[18px] w-[18px] text-muted-foreground/80" />
                      <span className="text-sm">Cerrar Sesión</span>
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </div>

        {/* Promo Card matching Donezo bottom app banner */}
        <div className="px-4 py-3 mt-auto group-data-[collapsible=icon]:hidden">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/95 to-black p-4 text-primary-foreground shadow-lg border border-primary/20">
            {/* Background elements */}
            <div className="absolute -right-6 -bottom-6 h-24 w-24 rounded-full bg-white/5 blur-xl pointer-events-none" />
            <div className="absolute -left-6 -top-6 h-24 w-24 rounded-full bg-primary/25 blur-xl pointer-events-none" />
            
            <div className="relative space-y-3 z-10">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 backdrop-blur-md">
                <Gift className="h-4.5 w-4.5 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-sm tracking-tight text-white leading-tight">El Borrego App</h4>
                <p className="text-[11px] text-white/80 mt-1 leading-normal">
                  Descarga nuestra app móvil para gestionar pedidos en mesa de forma rápida.
                </p>
              </div>
              <button className="flex items-center gap-1.5 text-[11px] font-bold bg-white text-black hover:bg-white/95 px-3 py-1.5 rounded-lg shadow-sm transition-all duration-300 w-full justify-center">
                <span>Obtener App</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}