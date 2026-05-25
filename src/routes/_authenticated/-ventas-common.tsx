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
import { Plus, Edit2, Trash2, Calendar, Filter, FileText, CheckCircle2, Lock, ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { UploadReceiptDialog } from "@/components/upload-receipt-dialog";

export type Sale = {
  id: string;
  date: string;
  description: string;
  amount: number;
  payment_method: string;
  restaurant_branch?: string | null;
  user_id: string;
};

export function VentasCommon({ branchTitle, branchKey, tableName, loadAll }: { branchTitle: string; branchKey?: string; tableName?: "sales_entries" | "sales_entries_cantarito"; loadAll?: boolean }) {
  const { user, role } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("efectivo");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const [filterMode, setFilterMode] = useState<"all" | "daily" | "weekly" | "monthly" | "yearly" | "range">("all");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editMethod, setEditMethod] = useState("");
  const [editDate, setEditDate] = useState("");
  const [hasBranchColumn, setHasBranchColumn] = useState(true);

  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isEmployee = role === "employee";

  const load = async () => {
    const table = (tableName ?? "sales_entries") as "sales_entries" | "sales_entries_cantarito";
    const query = supabase.from(table).select("*").order("date", { ascending: false }).limit(200);

    let response;

    try {
      response = loadAll || !branchKey
        ? await query
        : hasBranchColumn
        ? branchKey === "borrego"
          ? await query.or(`restaurant_branch.ilike.${branchKey},restaurant_branch.is.null,restaurant_branch.eq.`)
          : await query.ilike("restaurant_branch", branchKey)
        : await query;

      if (response.error) {
        throw response.error;
      }
    } catch (error: any) {
      if (typeof error?.message === "string" && error.message.includes("restaurant_branch")) {
        setHasBranchColumn(false);
        response = await query;
      } else {
        console.error("Error cargando ventas:", error);
        return;
      }
    }

    if (response.data) {
      const rows = response.data as Sale[];
      if (branchKey && table === "sales_entries") {
        setSales(
          rows.filter((row) => {
            const branchValue = row.restaurant_branch?.toLowerCase() || "";
            return branchValue === branchKey.toLowerCase() || branchValue === "" || row.restaurant_branch == null;
          }),
        );
      } else {
        setSales(rows);
      }
    }
  };

  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (isEmployee) return toast.error("Tu rol no permite agregar ventas.");
    if (!amount || !user) return;

    const payload: Record<string, unknown> = {
      user_id: user.id,
      description: desc,
      amount: Number(amount),
      payment_method: method,
      date: date,
    };

    if (branchKey && hasBranchColumn) {
      payload.restaurant_branch = branchKey;
    }

    const table = (tableName ?? "sales_entries") as "sales_entries" | "sales_entries_cantarito";
    let { error } = await supabase.from(table).insert(payload as any);

    if (error && typeof error.message === "string" && error.message.includes("restaurant_branch")) {
      setHasBranchColumn(false);
      const { error: retryError } = await supabase.from(table).insert({
        user_id: user.id,
        description: desc,
        amount: Number(amount),
        payment_method: method,
        date: date,
      } as any);
      error = retryError;
    }

    if (error) return toast.error(error.message);
    setDesc("");
    setAmount("");
    setDate(new Date().toISOString().split("T")[0]);
    toast.success("Venta registrada con éxito");
    load();
  };

  const deleteSale = async (id: string) => {
    if (isEmployee) return toast.error("No tienes permisos para eliminar registros.");
    const confirmDelete = window.confirm("¿Estás seguro de que deseas eliminar esta venta?");
    if (!confirmDelete) return;

    const table = (tableName ?? "sales_entries") as "sales_entries" | "sales_entries_cantarito";
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Venta eliminada");
    load();
  };

  const startEdit = (s: Sale) => {
    setEditingSale(s);
    setEditDesc(s.description);
    setEditAmount(s.amount.toString());
    setEditMethod(s.payment_method);
    setEditDate(s.date);
  };

  const updateSale = async () => {
    if (isEmployee) return;
    if (!editingSale || !editAmount) return;

    const activeTable = (tableName ?? "sales_entries") as "sales_entries" | "sales_entries_cantarito";
    const { error } = await supabase
      .from(activeTable)
      .update({
        description: editDesc,
        amount: Number(editAmount),
        payment_method: editMethod,
        date: editDate,
      })
      .eq("id", editingSale.id);

    if (error) return toast.error(error.message);
    toast.success("Venta actualizada");
    setEditingSale(null);
    load();
  };

  const filteredSales = sales.filter((s) => {
    if (!s.date) return true;

    const sDateParts = s.date.split("-");
    const sDate = new Date(Number(sDateParts[0]), Number(sDateParts[1]) - 1, Number(sDateParts[2]));
    sDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (filterMode === "daily") {
      return sDate.getTime() === today.getTime();
    }

    if (filterMode === "weekly") {
      const oneWeekAgo = new Date(today);
      oneWeekAgo.setDate(today.getDate() - 7);
      return sDate >= oneWeekAgo && sDate <= today;
    }

    if (filterMode === "monthly") {
      return sDate.getFullYear() === today.getFullYear() && sDate.getMonth() === today.getMonth();
    }

    if (filterMode === "yearly") {
      return sDate.getFullYear() === today.getFullYear();
    }

    if (filterMode === "range") {
      const startParts = startDate.split("-");
      const start = new Date(Number(startParts[0]), Number(startParts[1]) - 1, Number(startParts[2]));
      start.setHours(0, 0, 0, 0);

      const endParts = endDate.split("-");
      const end = new Date(Number(endParts[0]), Number(endParts[1]) - 1, Number(endParts[2]));
      end.setHours(23, 59, 59, 999);

      return sDate >= start && sDate <= end;
    }

    return true;
  });

  const periodTotal = filteredSales.reduce((sum, s) => sum + Number(s.amount), 0);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Ventas {branchTitle}</h1>
        <p className="text-sm text-muted-foreground">Registros independientes para la sucursal {branchTitle}.</p>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 shadow-sm relative overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-primary">
              Ventas del Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">
              ${periodTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">
              Calculado en base al filtro seleccionado ({filteredSales.length} transacciones)
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-4 items-start">
        {isEmployee ? (
          <Card className="lg:col-span-1 border border-border/60 bg-accent/10 p-6 text-center rounded-2xl shadow-sm">
            <ShieldAlert className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-bold text-sm text-foreground">Acceso de Empleado</h3>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Tu cuenta tiene asignados permisos de <strong>Solo Lectura</strong>. No tienes autorización para registrar nuevas ventas.
            </p>
          </Card>
        ) : (
          <Card className="lg:col-span-1 border border-border/80 shadow-sm">
            <CardHeader className="border-b border-border/60 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" /> Registrar Venta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="dateInput">Fecha</Label>
                <Input
                  id="dateInput"
                  type="date"
                  value={date}
                  className="rounded-xl border-border/80 text-sm"
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="descInput">Descripción / Plato</Label>
                <Input
                  id="descInput"
                  placeholder="Ej. Tacos de Barbacoa"
                  value={desc}
                  className="rounded-xl border-border/80 text-sm"
                  onChange={(e) => setDesc(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="amountInput">Monto ($)</Label>
                <Input
                  id="amountInput"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  className="rounded-xl border-border/80 text-sm"
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="methodInput">Método de Pago</Label>
                <select
                  id="methodInput"
                  value={method}
                  className="flex h-10 w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-sm focus-visible:outline-none"
                  onChange={(e) => setMethod(e.target.value)}
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="zelle">Zelle / Pago Móvil</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <Button onClick={add} className="w-full bg-primary hover:bg-primary/95 text-white font-bold rounded-xl shadow-md cursor-pointer pt-2">
                <Plus className="h-4 w-4 mr-2 shrink-0" /> Registrar Venta
              </Button>
              <UploadReceiptDialog userId={user?.id} restaurantBranch={branchKey} tableName={tableName} onSaved={load} />
            </CardContent>
          </Card>
        )}

        <div className="lg:col-span-3 space-y-4 w-full min-w-0">
          <Card className="border border-border/60 shadow-sm bg-card p-4">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                  <Filter className="h-3.5 w-3.5 text-primary" /> Filtros de Período / Año
                </span>
                <Badge variant="outline" className="border-primary/20 text-primary font-semibold text-[10px] uppercase">
                  {role}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[
                  { mode: "all", label: "Todo" },
                  { mode: "daily", label: "Diario" },
                  { mode: "weekly", label: "Semanal" },
                  { mode: "monthly", label: "Mensual" },
                  { mode: "yearly", label: "Anual" },
                  { mode: "range", label: "Rango de Fechas" },
                ].map((btn) => {
                  const active = filterMode === btn.mode;
                  return (
                    <Button
                      key={btn.mode}
                      size="sm"
                      variant={active ? "default" : "outline"}
                      className={`font-semibold rounded-xl text-xs px-3 h-8 cursor-pointer transition-all duration-300 ${
                        active
                          ? "bg-primary text-white shadow-sm"
                          : "border-border hover:bg-accent/60 hover:text-foreground text-muted-foreground"
                      }`}
                      onClick={() => setFilterMode(btn.mode as any)}
                    >
                      {btn.label}
                    </Button>
                  );
                })}
              </div>

              {filterMode === "range" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-2xl bg-accent/40 border border-border/50 animate-fade-in">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">Desde</Label>
                    <Input
                      type="date"
                      value={startDate}
                      className="h-9 rounded-lg bg-background border-border/85"
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">Hasta</Label>
                    <Input
                      type="date"
                      value={endDate}
                      className="h-9 rounded-lg bg-background border-border/85"
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card className="border border-border/60 shadow-sm bg-card overflow-hidden w-full">
            <div className="overflow-x-auto w-full -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
              <Table className="min-w-[600px] sm:min-w-0 w-full">
                <TableHeader className="bg-accent/30">
                  <TableRow>
                        <TableHead className="font-bold text-xs">Fecha</TableHead>
                    <TableHead className="font-bold text-xs">Descripción</TableHead>
                    <TableHead className="font-bold text-xs">Sucursal</TableHead>
                    <TableHead className="font-bold text-xs">Método</TableHead>
                    <TableHead className="font-bold text-xs text-right">Monto</TableHead>
                    <TableHead className="font-bold text-xs text-center w-28">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map((s) => {
                    const canManage = isAdmin || (isManager && s.user_id === user?.id);
                    return (
                      <TableRow key={s.id} className="hover:bg-accent/30 transition-colors">
                        <TableCell className="text-xs font-semibold font-mono whitespace-nowrap">{s.date}</TableCell>
                        <TableCell className="text-xs font-medium text-foreground max-w-[200px] truncate">{s.description}</TableCell>
                        <TableCell className="text-xs font-medium text-foreground capitalize">{tableName === "sales_entries_cantarito" ? branchTitle : s.restaurant_branch ?? "Sin sucursal"}</TableCell>
                        <TableCell className="text-xs font-medium capitalize">
                          <Badge variant="outline" className="border-border text-foreground font-semibold px-2 py-0.5 text-[10px]">
                            {s.payment_method}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-extrabold text-right font-mono whitespace-nowrap">
                          ${Number(s.amount).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {canManage ? (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg cursor-pointer transition-colors"
                                  onClick={() => startEdit(s)}
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer transition-colors"
                                  onClick={() => deleteSale(s.id)}
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
                  {filteredSales.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-xs py-8 text-muted-foreground italic font-medium">
                        No se encontraron ventas para este período
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={!!editingSale} onOpenChange={(open) => !open && setEditingSale(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl border border-border shadow-2xl p-6 mx-4">
          <DialogHeader className="pb-3 border-b border-border/40">
            <DialogTitle className="text-lg font-extrabold text-foreground flex items-center gap-2">
              <Edit2 className="h-4 w-4 text-primary" /> Editar Registro de Venta
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Modifica los campos necesarios para corregir esta transacción.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="editDate">Fecha</Label>
              <Input
                id="editDate"
                type="date"
                value={editDate}
                className="rounded-xl border-border/80"
                onChange={(e) => setEditDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="editDesc">Descripción / Plato</Label>
              <Input
                id="editDesc"
                value={editDesc}
                className="rounded-xl border-border/80"
                onChange={(e) => setEditDesc(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="editAmount">Monto ($)</Label>
              <Input
                id="editAmount"
                type="number"
                step="0.01"
                value={editAmount}
                className="rounded-xl border-border/80"
                onChange={(e) => setEditAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="editMethod">Método de Pago</Label>
              <select
                id="editMethod"
                value={editMethod}
                className="flex h-10 w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-sm focus-visible:outline-none"
                onChange={(e) => setEditMethod(e.target.value)}
              >
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="zelle">Zelle / Pago Móvil</option>
                <option value="otro">Otro</option>
              </select>
            </div>
          </div>
          <DialogFooter className="flex gap-2 sm:justify-end border-t border-border/40 pt-4">
            <Button
              variant="outline"
              className="rounded-xl text-xs font-semibold cursor-pointer border-border"
              onClick={() => setEditingSale(null)}
            >
              Cancelar
            </Button>
            <Button
              className="bg-primary hover:bg-primary/95 text-white font-bold rounded-xl text-xs px-4 cursor-pointer"
              onClick={updateSale}
            >
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
