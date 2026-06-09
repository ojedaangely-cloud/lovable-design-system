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
import { Shield, ShieldAlert, UserPlus, Trash2, Mail, Info, Star, Edit, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/ajustes")({ component: Ajustes });

type UserItem = {
  name: string;
  email: string;
  role: "admin" | "manager" | "employee";
};

const DEFAULT_USERS: UserItem[] = [
  { name: "Kandy Caceres", email: "kandycacerescomanca@gmail.com", role: "employee" },
  { name: "Lisneyis Gómez Iglesia", email: "lilyiglesia63@gmail.com", role: "employee" },
  { name: "Maria Toledo", email: "mariatoledo07@gmail.com", role: "employee" },
  { name: "María Duque", email: "mariatoledod07@gmail.com", role: "employee" },
  { name: "Nacary Rojas", email: "nacarymarquez0@gmail.com", role: "employee" },
  { name: "Dorismar Rojas", email: "nacaryrojas26@gmail.com", role: "employee" },
  { name: "Angely Ojeda", email: "ojedaangely@gmail.com", role: "admin" },
  { name: "Sarita Caceres", email: "saritacaceres2015@gmail.com", role: "employee" }
];

function Ajustes() {
  const { user, role: currentRole } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);

  // Form states - Add
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "manager" | "employee">("employee");

  // Form states - Edit
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<"admin" | "manager" | "employee">("employee");

  const isAdmin = currentRole === "admin";

  const syncOverrides = (updatedList: UserItem[]) => {
    if (typeof window !== "undefined") {
      const overrides: Record<string, string> = {};
      updatedList.forEach((u) => {
        overrides[u.email.toLowerCase().trim()] = u.role;
      });
      localStorage.setItem("borrego_role_overrides", JSON.stringify(overrides));
    }
  };

  const loadUsers = () => {
    if (typeof window !== "undefined") {
      let list: UserItem[] = [];
      const stored = localStorage.getItem("borrego_users_list");
      if (stored) {
        try {
          list = JSON.parse(stored);
        } catch (e) {
          console.error("Error parsing borrego_users_list", e);
        }
      }

      if (list.length === 0 || list.some((u) => u.email.includes("mayoreo.biz"))) {
        list = [...DEFAULT_USERS];
      }

      // Ensure the logged-in user is in the list
      if (user && user.email) {
        const emailLower = user.email.toLowerCase().trim();
        const exists = list.some((u) => u.email.toLowerCase().trim() === emailLower);
        if (!exists) {
          const namePart = user.email.split("@")[0];
          const newU: UserItem = {
            name: user.user_metadata?.full_name || (namePart.charAt(0).toUpperCase() + namePart.slice(1)),
            email: user.email,
            role: currentRole === "pending" ? "employee" : currentRole,
          };
          list.push(newU);
        }
      }

      setUsers(list);
      // Sync overrides to localStorage
      syncOverrides(list);
      localStorage.setItem("borrego_users_list", JSON.stringify(list));
    }
  };

  useEffect(() => {
    loadUsers();
  }, [user, currentRole]);

  const handleAddUser = () => {
    if (!newName.trim()) return toast.error("Por favor ingresa el nombre.");
    if (!newEmail.trim()) return toast.error("Por favor ingresa el correo electrónico.");
    
    const emailToAssign = newEmail.toLowerCase().trim();
    const exists = users.some((u) => u.email.toLowerCase().trim() === emailToAssign);
    if (exists) {
      return toast.error("Ya existe un usuario registrado con este correo electrónico.");
    }

    const updated = [
      ...users,
      {
        name: newName.trim(),
        email: emailToAssign,
        role: newRole,
      },
    ];

    setUsers(updated);
    localStorage.setItem("borrego_users_list", JSON.stringify(updated));
    syncOverrides(updated);

    toast.success(`Usuario ${newName} agregado con éxito.`);
    setNewName("");
    setNewEmail("");
    setNewRole("employee");
    setIsAddOpen(false);

    // If adding itself, reload page
    if (user?.email?.toLowerCase().trim() === emailToAssign) {
      toast.info("Actualizando tu sesión con tu nuevo rol...");
      setTimeout(() => window.location.reload(), 1500);
    }
  };

  const handleEditClick = (u: UserItem) => {
    // Prevent modification of main admin ojedaangely@gmail.com unless the current user IS ojedaangely@gmail.com
    if (u.email.toLowerCase().trim() === "ojedaangely@gmail.com" && user?.email?.toLowerCase().trim() !== "ojedaangely@gmail.com") {
      return toast.error("El Administrador Principal está protegido y no puede ser modificado por otros administradores.");
    }

    setEditingUser(u);
    setEditName(u.name);
    setEditRole(u.role);
    setIsEditOpen(true);
  };

  const handleUpdateUser = () => {
    if (!editingUser) return;
    if (!editName.trim()) return toast.error("Por favor ingresa el nombre.");

    // Prevent main admin from losing admin role
    if (editingUser.email.toLowerCase().trim() === "ojedaangely@gmail.com" && editRole !== "admin") {
      return toast.error("No se puede cambiar el rol del Administrador Principal.");
    }

    const updated = users.map((u) => {
      if (u.email.toLowerCase().trim() === editingUser.email.toLowerCase().trim()) {
        return {
          ...u,
          name: editName.trim(),
          role: editRole,
        };
      }
      return u;
    });

    setUsers(updated);
    localStorage.setItem("borrego_users_list", JSON.stringify(updated));
    syncOverrides(updated);

    toast.success("Usuario actualizado correctamente.");
    setIsEditOpen(false);
    setEditingUser(null);

    // Proactively reload page to apply changes to current session if modifying self
    if (user?.email?.toLowerCase().trim() === editingUser.email.toLowerCase().trim()) {
      toast.info("Actualizando tu sesión con tu nuevo rol...");
      setTimeout(() => window.location.reload(), 1500);
    }
  };

  const handleDeleteUser = (u: UserItem) => {
    const emailLower = u.email.toLowerCase().trim();
    if (emailLower === "ojedaangely@gmail.com") {
      return toast.warning("El Administrador Principal no puede ser eliminado del sistema.");
    }

    const confirmDelete = window.confirm(`¿Estás seguro de que deseas eliminar al usuario ${u.name} (${u.email})?`);
    if (!confirmDelete) return;

    const updated = users.filter((usr) => usr.email.toLowerCase().trim() !== emailLower);

    setUsers(updated);
    localStorage.setItem("borrego_users_list", JSON.stringify(updated));
    syncOverrides(updated);

    toast.success(`Se eliminó al usuario ${u.name}`);

    if (user?.email?.toLowerCase().trim() === emailLower) {
      setTimeout(() => window.location.reload(), 1500);
    }
  };

  const getRoleLabel = (r: "admin" | "manager" | "employee") => {
    if (r === "admin") return "Administrador";
    if (r === "manager") return "Gerente";
    return "Empleado";
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o correo..."
                className="pl-9 rounded-xl border-border/80"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button
              onClick={() => setIsAddOpen(true)}
              className="bg-primary hover:bg-primary/95 text-white font-bold rounded-xl shadow-md cursor-pointer shrink-0"
            >
              <UserPlus className="h-4 w-4 mr-2" /> Agregar Usuario
            </Button>
          </div>

          {/* User Directory Table Card */}
          <Card className="border border-border/60 shadow-sm bg-card overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-sm font-extrabold uppercase tracking-wider text-foreground">
                Directorio de Usuarios
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto w-full">
              <Table>
                <TableHeader className="bg-accent/30">
                  <TableRow>
                    <TableHead className="font-bold text-xs">Nombre</TableHead>
                    <TableHead className="font-bold text-xs">Email</TableHead>
                    <TableHead className="font-bold text-xs">Rol Asignado</TableHead>
                    <TableHead className="font-bold text-xs text-center w-28">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => {
                    const isPrincipalAdmin = u.email.toLowerCase().trim() === "ojedaangely@gmail.com";
                    return (
                      <TableRow
                        key={u.email}
                        className={`transition-colors ${
                          isPrincipalAdmin
                            ? "bg-primary/5 hover:bg-primary/5 font-medium"
                            : "hover:bg-accent/30"
                        }`}
                      >
                        <TableCell className="text-xs font-bold text-foreground">
                          {u.name}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {u.email}
                        </TableCell>
                        <TableCell className="text-xs">
                          {isPrincipalAdmin ? (
                            <Badge className="bg-primary text-white text-[9px] uppercase tracking-wider font-extrabold">
                              Administrador Principal
                            </Badge>
                          ) : (
                            <Badge
                              variant={
                                u.role === "admin"
                                  ? "default"
                                  : u.role === "manager"
                                  ? "secondary"
                                  : "outline"
                              }
                              className="text-[10px] uppercase font-bold"
                            >
                              {getRoleLabel(u.role)}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {isPrincipalAdmin ? (
                            <span className="text-[10px] text-muted-foreground italic font-medium">
                              Protegido
                            </span>
                          ) : (
                            <div className="flex justify-center items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg cursor-pointer transition-colors"
                                onClick={() => handleEditClick(u)}
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer transition-colors"
                                onClick={() => handleDeleteUser(u)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {filteredUsers.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-xs py-6 text-muted-foreground italic font-medium"
                      >
                        No se encontraron usuarios coincidentes.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Add User Dialog */}
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogContent className="sm:max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle className="font-extrabold text-lg">Agregar Nuevo Usuario</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Registra un nuevo usuario asignándole su nivel de acceso inicial.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="addName">Nombre Completo</Label>
                  <Input
                    id="addName"
                    placeholder="Ej. Juan Pérez"
                    value={newName}
                    className="rounded-xl border-border/80"
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="addEmail">Correo Electrónico</Label>
                  <Input
                    id="addEmail"
                    type="email"
                    placeholder="ejemplo@borrego.com"
                    value={newEmail}
                    className="rounded-xl border-border/80"
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="addRole">Rol de Acceso</Label>
                  <select
                    id="addRole"
                    value={newRole}
                    className="flex h-10 w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-sm focus:outline-none"
                    onChange={(e) => setNewRole(e.target.value as any)}
                  >
                    <option value="employee">Empleado (Solo ver nómina/horas)</option>
                    <option value="manager">Gerente (Ver todo, editar propios)</option>
                    <option value="admin">Administrador (Control total)</option>
                  </select>
                </div>
              </div>
              <DialogFooter className="sm:justify-end gap-2">
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setIsAddOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleAddUser}
                  className="bg-primary hover:bg-primary/95 text-white font-bold rounded-xl"
                >
                  Guardar Usuario
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit User Dialog */}
          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogContent className="sm:max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle className="font-extrabold text-lg">Editar Usuario</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Modifica los datos y nivel de acceso del usuario seleccionado.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="editName">Nombre Completo</Label>
                  <Input
                    id="editName"
                    placeholder="Ej. Juan Pérez"
                    value={editName}
                    className="rounded-xl border-border/80"
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="editEmail">Correo Electrónico</Label>
                  <Input
                    id="editEmail"
                    type="email"
                    value={editingUser?.email || ""}
                    disabled
                    className="rounded-xl bg-accent/40 text-muted-foreground border-border/60"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="editRole">Rol de Acceso</Label>
                  <select
                    id="editRole"
                    value={editRole}
                    className="flex h-10 w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-sm focus:outline-none"
                    onChange={(e) => setEditRole(e.target.value as any)}
                  >
                    <option value="employee">Empleado (Solo ver nómina/horas)</option>
                    <option value="manager">Gerente (Ver todo, editar propios)</option>
                    <option value="admin">Administrador (Control total)</option>
                  </select>
                </div>
              </div>
              <DialogFooter className="sm:justify-end gap-2">
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    setIsEditOpen(false);
                    setEditingUser(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleUpdateUser}
                  className="bg-primary hover:bg-primary/95 text-white font-bold rounded-xl"
                >
                  Guardar Cambios
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}
