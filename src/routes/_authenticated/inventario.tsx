import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, ShieldAlert, Package, AlertTriangle, CheckCircle2, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/inventario")({ component: Inventario });

type Item = {
  id: string;
  name: string;
  unit: string;
  stock: number;
  min_stock: number;
  unit_cost: number;
  user_id: string;
};

function Inventario() {
  const { user, role } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("unidad");
  const [stock, setStock] = useState("");
  const [minStock, setMinStock] = useState("");
  const [cost, setCost] = useState("");

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editName, setEditName] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editStock, setEditStock] = useState("");
  const [editMinStock, setEditMinStock] = useState("");
  const [editCost, setEditCost] = useState("");

  // Resolve Roles
  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isEmployee = role === "employee";

  const load = async () => {
    const { data } = await supabase.from("inventory_items").select("*").order("name");
    if (data) setItems(data as Item[]);
  };

  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (isEmployee) return toast.error("Tu rol no permite agregar artículos.");
    if (!name || !user) return;
    const { error } = await supabase.from("inventory_items").insert({
      user_id: user.id,
      name,
      unit,
      stock: Number(stock || 0),
      min_stock: Number(minStock || 0),
      unit_cost: Number(cost || 0),
    });
    if (error) return toast.error(error.message);
    setName("");
    setStock("");
    setMinStock("");
    setCost("");
    setUnit("unidad");
    toast.success("Artículo agregado al inventario");
    load();
  };

  const deleteItem = async (id: string) => {
    if (isEmployee) return toast.error("No tienes permisos para eliminar registros.");
    const confirmDelete = window.confirm("¿Estás seguro de que deseas eliminar este artículo?");
    if (!confirmDelete) return;

    const { error } = await supabase.from("inventory_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Artículo eliminado");
    load();
  };

  const startEdit = (i: Item) => {
    setEditingItem(i);
    setEditName(i.name);
    setEditUnit(i.unit);
    setEditStock(i.stock.toString());
    setEditMinStock(i.min_stock.toString());
    setEditCost(i.unit_cost.toString());
  };

  const updateItem = async () => {
    if (isEmployee) return;
    if (!editingItem || !editName) return;

    const { error } = await supabase
      .from("inventory_items")
      .update({
        name: editName,
        unit: editUnit,
        stock: Number(editStock || 0),
        min_stock: Number(editMinStock || 0),
        unit_cost: Number(editCost || 0),
      })
      .eq("id", editingItem.id);

    if (error) return toast.error(error.message);
    toast.success("Artículo actualizado");
    setEditingItem(null);
    load();
  };

  const totalItemsCount = items.length;
  const lowStockItemsCount = items.filter((i) => Number(i.stock) <= Number(i.min_stock)).length;
  const totalValue = items.reduce((sum, i) => sum + Number(i.stock) * Number(i.unit_cost), 0);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Inventory Summary Cards */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Card className="border border-border/60 shadow-sm relative overflow-hidden bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Package className="h-4 w-4 text-primary" /> Total de Artículos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">{totalItemsCount}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">
              Productos registrados en el catálogo
            </p>
          </CardContent>
        </Card>

        <Card className={`border shadow-sm relative overflow-hidden bg-card ${lowStockItemsCount > 0 ? "border-red-500/20 bg-red-500/5" : "border-border/60"}`}>
          <CardHeader className="pb-2">
            <CardTitle className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${lowStockItemsCount > 0 ? "text-red-500" : "text-muted-foreground"}`}>
              <AlertTriangle className="h-4 w-4" /> Stock Crítico / Bajo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-black ${lowStockItemsCount > 0 ? "text-red-500" : "text-foreground"}`}>
              {lowStockItemsCount}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">
              Artículos por debajo del stock mínimo establecido
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/60 shadow-sm relative overflow-hidden bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Valor Total de Inventario
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">
              ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">
              Calculado como Stock × Costo Unitario
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-4 items-start">
        
        {/* Form Container: Left Side */}
        {isEmployee ? (
          <Card className="lg:col-span-1 border border-border/60 bg-accent/10 p-6 text-center rounded-2xl shadow-sm">
            <ShieldAlert className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-bold text-sm text-foreground">Acceso de Empleado</h3>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Tu cuenta tiene asignados permisos de <strong>Solo Lectura</strong>. No tienes autorización para agregar artículos al inventario.
            </p>
          </Card>
        ) : (
          <Card className="lg:col-span-1 border border-border/80 shadow-sm bg-card">
            <CardHeader className="border-b border-border/60 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" /> Agregar Artículo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="nameInput">Nombre del Producto</Label>
                <Input
                  id="nameInput"
                  placeholder="Ej. Carbón de encino"
                  value={name}
                  className="rounded-xl border-border/80 text-sm"
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="unitInput">Unidad de Medida</Label>
                <Input
                  id="unitInput"
                  placeholder="Ej. kg, bulto, litro, pieza"
                  value={unit}
                  className="rounded-xl border-border/80 text-sm"
                  onChange={(e) => setUnit(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stockInput">Stock Actual</Label>
                <Input
                  id="stockInput"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={stock}
                  className="rounded-xl border-border/80 text-sm"
                  onChange={(e) => setStock(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="minStockInput">Stock Mínimo Alerta</Label>
                <Input
                  id="minStockInput"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={minStock}
                  className="rounded-xl border-border/80 text-sm"
                  onChange={(e) => setMinStock(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="costInput">Costo Unitario ($)</Label>
                <Input
                  id="costInput"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={cost}
                  className="rounded-xl border-border/80 text-sm"
                  onChange={(e) => setCost(e.target.value)}
                />
              </div>
              <Button
                onClick={add}
                className="w-full bg-primary hover:bg-primary/95 text-white font-bold rounded-xl shadow-md cursor-pointer pt-2"
              >
                <Plus className="h-4 w-4 mr-2 shrink-0" />
                Agregar Artículo
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Table: Right Side */}
        <div className="lg:col-span-3 space-y-4 w-full min-w-0">
          <Card className="border border-border/60 shadow-sm bg-card overflow-hidden w-full">
            <div className="overflow-x-auto w-full -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
              <Table className="min-w-[650px] sm:min-w-0 w-full">
                <TableHeader className="bg-accent/30">
                  <TableRow>
                    <TableHead className="font-bold text-xs">Nombre</TableHead>
                    <TableHead className="font-bold text-xs">Unidad</TableHead>
                    <TableHead className="font-bold text-xs text-right">Stock</TableHead>
                    <TableHead className="font-bold text-xs text-right">Mínimo</TableHead>
                    <TableHead className="font-bold text-xs text-right">Costo Unitario</TableHead>
                    <TableHead className="font-bold text-xs text-center w-28">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((i) => {
                    const low = Number(i.stock) <= Number(i.min_stock);
                    const canManage = isAdmin || (isManager && i.user_id === user?.id);
                    return (
                      <TableRow
                        key={i.id}
                        className={`hover:bg-accent/30 transition-colors ${
                          low ? "bg-red-500/5 hover:bg-red-500/10" : ""
                        }`}
                      >
                        <TableCell className="text-xs font-semibold text-foreground flex items-center gap-2 max-w-[160px] truncate">
                          {i.name}
                          {low && (
                            <Badge variant="destructive" className="px-1.5 py-0 text-[8px] uppercase tracking-wider font-extrabold bg-red-600 text-white animate-pulse">
                              Bajo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-medium text-muted-foreground capitalize">{i.unit}</TableCell>
                        <TableCell className={`text-xs font-extrabold text-right font-mono ${low ? "text-red-500" : "text-foreground"}`}>
                          {Number(i.stock)}
                        </TableCell>
                        <TableCell className="text-xs font-medium text-right font-mono text-muted-foreground">
                          {Number(i.min_stock)}
                        </TableCell>
                        <TableCell className="text-xs font-extrabold text-right font-mono text-foreground">
                          ${Number(i.unit_cost).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {canManage ? (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg cursor-pointer transition-colors"
                                  onClick={() => startEdit(i)}
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer transition-colors"
                                  onClick={() => deleteItem(i.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            ) : (
                              <span className="text-[10px] text-muted-foreground/60 italic font-medium flex items-center justify-center gap-1.5">
                                <Lock className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                                <span>Solo ver</span>
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-xs py-8 text-muted-foreground italic font-medium">
                        No se encontraron artículos en el inventario
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>

      {/* Edit Item Modal */}
      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md rounded-2xl border border-border shadow-2xl p-6">
          <DialogHeader className="pb-3 border-b border-border/40">
            <DialogTitle className="text-lg font-extrabold text-foreground flex items-center gap-2">
              <Edit2 className="h-4 w-4 text-primary" /> Editar Artículo de Inventario
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Modifica las propiedades del producto y presiona guardar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="editName">Nombre del Producto</Label>
              <Input
                id="editName"
                value={editName}
                className="rounded-xl border-border/80 text-sm"
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="editUnit">Unidad de Medida</Label>
              <Input
                id="editUnit"
                value={editUnit}
                className="rounded-xl border-border/80 text-sm"
                onChange={(e) => setEditUnit(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="editStock">Stock Actual</Label>
              <Input
                id="editStock"
                type="number"
                step="0.01"
                value={editStock}
                className="rounded-xl border-border/80 text-sm"
                onChange={(e) => setEditStock(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="editMinStock">Stock Mínimo</Label>
              <Input
                id="editMinStock"
                type="number"
                step="0.01"
                value={editMinStock}
                className="rounded-xl border-border/80 text-sm"
                onChange={(e) => setEditMinStock(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="editCost">Costo Unitario ($)</Label>
              <Input
                id="editCost"
                type="number"
                step="0.01"
                value={editCost}
                className="rounded-xl border-border/80 text-sm"
                onChange={(e) => setEditCost(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="flex items-center justify-end gap-2 border-t border-border/40 pt-4 w-full">
            <Button
              variant="outline"
              className="rounded-xl text-xs font-semibold cursor-pointer border-border flex-1 sm:flex-initial"
              onClick={() => setEditingItem(null)}
            >
              Cancelar
            </Button>
            <Button
              className="bg-primary hover:bg-primary/95 text-white font-bold rounded-xl text-xs px-4 cursor-pointer flex-1 sm:flex-initial"
              onClick={updateItem}
            >
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}