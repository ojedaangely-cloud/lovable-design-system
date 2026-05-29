import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Shield, ShieldAlert, UserPlus, Trash2, Mail, Info, Star } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ajustes")({ component: Ajustes });

type RoleOverride = {
  email: string;
  role: "admin" | "manager" | "employee";
};

function Ajustes() {
  const { user, role: currentRole } = useAuth();
  const [emailInput, setEmailInput] = useState("");
  const [selectedRole, setSelectedRole] = useState<"admin" | "manager" | "employee">("employee");
  const [overrides, setOverrides] = useState<RoleOverride[]>([]);

  // Fetch overrides from LocalStorage
  const loadOverrides = () => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("borrego_role_overrides");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const list: RoleOverride[] = Object.keys(parsed).map((email) => ({
            email,
            role: parsed[email],
          }));
          setOverrides(list);
        } catch (e) {
          console.error("Error parsing role overrides", e);
        }
      } else {
        setOverrides([]);
      }
    }
  };

  useEffect(() => {
    loadOverrides();
  }, []);

  const isAdmin = currentRole === "admin";

  const handleAssignRole = () => {
    if (!emailInput.trim()) return toast.error("Por favor ingresa un correo electrónico.");
    const emailToAssign = emailInput.toLowerCase().trim();

    if (emailToAssign === "ojedaangely@gmail.com") {
      return toast.warning("ojedaangely@gmail.com ya es Administrador Principal y no se puede modificar.");
    }

    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("borrego_role_overrides");
      const parsed = stored ? JSON.parse(stored) : {};
      
      parsed[emailToAssign] = selectedRole;
      localStorage.setItem("borrego_role_overrides", JSON.stringify(parsed));
      
      toast.success(`Rol asignado con éxito a ${emailToAssign}`);
      setEmailInput("");
      loadOverrides();
      
      // Proactively reload page to apply changes to current session if self-assigning
      if (user?.email?.toLowerCase().trim() === emailToAssign) {
        toast.info("Actualizando tu sesión con tu nuevo rol...");
        setTimeout(() => window.location.reload(), 1500);
      }
    }
  };

  const handleDeleteOverride = (emailToDelete: string) => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("borrego_role_overrides");
      if (stored) {
        const parsed = JSON.parse(stored);
        delete parsed[emailToDelete];
        localStorage.setItem("borrego_role_overrides", JSON.stringify(parsed));
        toast.success(`Se eliminó la asignación personalizada para ${emailToDelete}`);
        loadOverrides();
        
        if (user?.email?.toLowerCase().trim() === emailToDelete) {
          setTimeout(() => window.location.reload(), 1500);
        }
      }
    }
  };

  const getRoleLabel = (r: "admin" | "manager" | "employee" | "pending") => {
    if (r === "admin") return "Administrador";
    if (r === "manager") return "Gerente";
    if (r === "pending") return "Pendiente de Aprobación";
    return "Empleado";
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
      
      {/* Settings Header */}
      <div className="flex flex-col gap-1.5 border-b border-border/40 pb-4">
        <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" /> Ajustes y Control de Acceso
        </h1>
        <p className="text-xs text-muted-foreground">
          Gestiona los niveles de seguridad, permisos de roles y configuraciones globales de El Borrego Dorado.
        </p>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
        
        {/* Left Side: General Profile Status */}
        <div className="md:col-span-1 space-y-4">
          <Card className="border border-border/80 bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground">
                Tu Nivel de Acceso
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 bg-accent/40 p-3 rounded-2xl border border-border/60">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-black text-foreground">
                    {getRoleLabel(currentRole)}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                    {user?.email}
                  </span>
                </div>
              </div>

              {/* Informative text about Roles */}
              <div className="text-xs text-muted-foreground space-y-2 leading-relaxed bg-accent/20 p-3 rounded-2xl border border-border/40">
                <p className="font-semibold text-foreground flex items-center gap-1">
                  <Info className="h-3.5 w-3.5 text-primary" /> Guía de Privilegios:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-[11px]">
                  <li><strong>Administrador:</strong> Control absoluto. Puede ver, registrar, editar y eliminar todo el historial.</li>
                  <li><strong>Gerente:</strong> Visión completa. Registra datos, pero solo edita o elimina sus propios registros.</li>
                  <li><strong>Empleado:</strong> Permisos de Solo Lectura. Únicamente puede consultar.</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Hardcoded Primary Admin Notice */}
          <Card className="border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent relative overflow-hidden shadow-sm">
            <div className="absolute right-0 top-0 p-4 opacity-10">
              <Star className="h-12 w-12 text-primary" />
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5 fill-primary" /> Administrador Principal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-xs font-bold text-foreground">ojedaangely@gmail.com</div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Este correo electrónico está configurado como el **Administrador Principal** del sistema. Cuenta con permisos totales y permanentes no editables.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Role Assignment Panel */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Main Role Assign Section */}
          {!isAdmin ? (
            <Card className="border border-border/80 bg-accent/5 p-6 text-center rounded-2xl shadow-sm">
              <ShieldAlert className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-bounce" />
              <h3 className="font-extrabold text-sm text-foreground uppercase tracking-wider">
                Panel Restringido
              </h3>
              <p className="text-xs text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
                La asignación y modificación de roles administrativos es de uso exclusivo para los usuarios con nivel de **Administrador**. Tu perfil actual no cuenta con estas facultades.
              </p>
            </Card>
          ) : (
            <>
              {/* Assignment Form */}
              <Card className="border border-border/80 shadow-sm bg-card">
                <CardHeader className="border-b border-border/60 pb-4">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <UserPlus className="h-4.5 w-4.5 text-primary" /> Asignación de Roles
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Modifica o asigna privilegios personalizados ingresando el correo electrónico del empleado.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="emailInput">Email del Usuario</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="emailInput"
                          placeholder="ejemplo@borrego.com"
                          value={emailInput}
                          className="pl-9 rounded-xl border-border/80"
                          onChange={(e) => setEmailInput(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="roleSelect">Rol a Asignar</Label>
                      <select
                        id="roleSelect"
                        value={selectedRole}
                        className="flex h-10 w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-sm focus:outline-none"
                        onChange={(e) => setSelectedRole(e.target.value as any)}
                      >
                        <option value="employee">Empleado (Solo ver)</option>
                        <option value="manager">Gerente (Ver todo, editar propios)</option>
                        <option value="admin">Administrador (Control total)</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button onClick={handleAssignRole} className="bg-primary hover:bg-primary/95 text-white font-bold rounded-xl shadow-md cursor-pointer pt-2">
                      <UserPlus className="h-4 w-4 mr-2" /> Asignar Rol Administrativo
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Overrides Table */}
              <Card className="border border-border/60 shadow-sm bg-card overflow-hidden">
                <CardHeader className="pb-3 border-b border-border/40">
                  <CardTitle className="text-sm font-extrabold uppercase tracking-wider text-foreground">
                    Lista de Asignaciones Personalizadas
                  </CardTitle>
                </CardHeader>
                <div className="overflow-x-auto w-full">
                  <Table>
                    <TableHeader className="bg-accent/30">
                      <TableRow>
                        <TableHead className="font-bold text-xs">Correo Electrónico</TableHead>
                        <TableHead className="font-bold text-xs">Rol Asignado</TableHead>
                        <TableHead className="font-bold text-xs text-center w-28">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Hardcoded Primary Admin Row for visual reference */}
                      <TableRow className="bg-primary/5 hover:bg-primary/5">
                        <TableCell className="text-xs font-semibold text-foreground font-mono">
                          ojedaangely@gmail.com
                        </TableCell>
                        <TableCell className="text-xs font-bold text-primary">
                          <Badge className="bg-primary text-white text-[9px] uppercase tracking-wider font-extrabold">
                            Administrador Principal
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-[10px] text-muted-foreground italic font-medium">
                          Protegido
                        </TableCell>
                      </TableRow>

                      {overrides.map((ov) => (
                        <TableRow key={ov.email} className="hover:bg-accent/30 transition-colors">
                          <TableCell className="text-xs font-semibold text-foreground font-mono">
                            {ov.email}
                          </TableCell>
                          <TableCell className="text-xs font-semibold">
                            <Badge variant={ov.role === "admin" ? "default" : ov.role === "manager" ? "secondary" : "outline"} className="text-[10px] uppercase font-bold">
                              {getRoleLabel(ov.role)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer transition-colors"
                              onClick={() => handleDeleteOverride(ov.email)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      
                      {overrides.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-xs py-6 text-muted-foreground italic font-medium">
                            No hay asignaciones personalizadas de LocalStorage.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
