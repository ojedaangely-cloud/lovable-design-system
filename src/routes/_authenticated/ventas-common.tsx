import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { restaurantDb } from "@/integrations/supabase/restaurant-client";
import { useAuth } from "@/hooks/use-auth";
import { useViewFilter } from "@/hooks/use-view-filter";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Calendar, Filter, FileText, CheckCircle2, Lock, ShieldAlert, X, ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UploadReceiptDialog } from "@/components/upload-receipt-dialog";

export type Sale = {
  id: string;
  date: string;
  description: string;
  amount: number;
  payment_method: string;
  restaurant_branch?: string | null;
  user_id?: string | null;
  transaction_type?: string;
};

const MONTHS_FULL = [
  { value: "0", label: "Enero" },
  { value: "1", label: "Febrero" },
  { value: "2", label: "Marzo" },
  { value: "3", label: "Abril" },
  { value: "4", label: "Mayo" },
  { value: "5", label: "Junio" },
  { value: "6", label: "Julio" },
  { value: "7", label: "Agosto" },
  { value: "8", label: "Septiembre" },
  { value: "9", label: "Octubre" },
  { value: "10", label: "Noviembre" },
  { value: "11", label: "Diciembre" }
];

const YEARS = ["2025", "2026", "2027"];

export function VentasCommon({ branchTitle, branchKey }: { branchTitle: string; branchKey?: string }) {
  const { user, role } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  
  // Registration form states
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [desc, setDesc] = useState("Cierre");
  const [customDesc, setCustomDesc] = useState("");
  const [isCustomDesc, setIsCustomDesc] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("efectivo");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  // Integrated filter states from hook
  const {
    fromStr,
    toStr,
    draftFilterType,
    draftWeek,
    draftMonth,
    draftYear,
    draftRangeStart,
    draftRangeEnd,
    setDraftFilterType,
    setDraftWeek,
    setDraftMonth,
    setDraftYear,
    setDraftRangeStart,
    setDraftRangeEnd,
    applyFilter,
    availableWeeks,
  } = useViewFilter();

  // View filters states: payment method and transaction type
  const [filterMethod, setFilterMethod] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  // Editing states
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editDesc, setEditDesc] = useState("Cierre");
  const [editCustomDesc, setEditCustomDesc] = useState("");
  const [editIsCustomDesc, setEditIsCustomDesc] = useState(false);
  const [editAmount, setEditAmount] = useState("");
  const [editMethod, setEditMethod] = useState("");
  const [editDate, setEditDate] = useState("");

  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isEmployee = role === "employee";

  const load = async () => {
    let query = restaurantDb.from("sales_entries").select("*").order("date", { ascending: false });

    if (fromStr && toStr) {
      query = query.gte("date", fromStr).lte("date", toStr);
    }

    let response;
    if (branchKey === "borrego") {
      // Include legacy records with NULL branch (assumed to be Borrego)
      response = await query.or(`restaurant_branch.eq.${branchKey},restaurant_branch.is.null`);
    } else if (branchKey) {
      response = await query.eq("restaurant_branch", branchKey);
    } else {
      response = await query;
    }

    let combinedSales: Sale[] = [];

    if (response.error) {
      console.error("Error cargando ventas:", response.error);
    } else if (response.data) {
      combinedSales = (response.data as any[]).map((s) => ({
        id: s.id,
        date: s.date,
        description: s.description,
        amount: Number(s.amount),
        payment_method: s.payment_method,
        restaurant_branch: s.restaurant_branch,
        user_id: s.user_id,
        transaction_type: s.description,
      }));
    }

    // Load sales_transactions if branchKey is "borrego" or not set
    if (branchKey === "borrego" || !branchKey) {
      let transQuery = restaurantDb
        .from("sales_transactions")
        .select("*")
        .eq("transaction_type", "venta_shift4")
        .order("transaction_date", { ascending: false });

      if (fromStr && toStr) {
        transQuery = transQuery.gte("transaction_date", fromStr).lte("transaction_date", toStr);
      }

      const transResponse = await transQuery;
      if (transResponse.error) {
        console.error("Error cargando sales_transactions:", transResponse.error);
      } else if (transResponse.data) {
        const mappedTrans = (transResponse.data as any[]).map((t) => ({
          id: t.id,
          date: t.transaction_date,
          description: t.description || "Venta Shift4",
          amount: Number(t.amount),
          payment_method: t.payment_method || "tarjeta",
          restaurant_branch: t.restaurant_branch === "principal" ? "borrego" : t.restaurant_branch,
          user_id: null,
          transaction_type: "venta_shift4",
        }));
        combinedSales = [...combinedSales, ...mappedTrans];
      }
    }

    combinedSales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setSales(combinedSales);
  };

  useEffect(() => {
    load();
  }, [fromStr, toStr]);

  const add = async () => {
    if (isEmployee) return toast.error("Tu rol no permite agregar ventas.");
    if (!amount || !user) return;

    const finalDesc = isCustomDesc ? customDesc : desc;
    if (!finalDesc) return toast.error("Por favor ingresa una descripción.");

    const { error } = await restaurantDb.from("sales_entries").insert({
      user_id: user.id,
      description: finalDesc,
      amount: Number(amount),
      payment_method: method,
      date: date,
      restaurant_branch: branchKey,
    });
    if (error) return toast.error(error.message);
    
    // Reset states
    setDesc("Cierre");
    setCustomDesc("");
    setIsCustomDesc(false);
    setAmount("");
    setDate(new Date().toISOString().split("T")[0]);
    setShowRegisterModal(false);
    toast.success("Venta registrada con éxito");
    load();
  };

  const deleteSale = async (id: string) => {
    if (isEmployee) return toast.error("No tienes permisos para eliminar registros.");
    const confirmDelete = window.confirm("¿Estás seguro de que deseas eliminar esta venta?");
    if (!confirmDelete) return;

    const { error } = await restaurantDb.from("sales_entries").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Venta eliminada");
    load();
  };

  const startEdit = (s: Sale) => {
    setEditingSale(s);
    setEditAmount(s.amount.toString());
    setEditMethod(s.payment_method);
    setEditDate(s.date);

    const stdTypesLower = ["cierre", "tips - propina", "efectivo recibo"];
    const descLower = (s.description || "").toLowerCase();
    if (stdTypesLower.includes(descLower)) {
      if (descLower === "cierre") setEditDesc("Cierre");
      else if (descLower === "tips - propina") setEditDesc("Tips - propina");
      else if (descLower === "efectivo recibo") setEditDesc("Efectivo recibo");
      
      setEditIsCustomDesc(false);
      setEditCustomDesc("");
    } else {
      setEditDesc("");
      setEditIsCustomDesc(true);
      setEditCustomDesc(s.description);
    }
  };

  const updateSale = async () => {
    if (isEmployee) return;
    if (!editingSale || !editAmount) return;

    const finalDesc = editIsCustomDesc ? editCustomDesc : editDesc;
    if (!finalDesc) return toast.error("Por favor ingresa una descripción.");

    const { error } = await restaurantDb
      .from("sales_entries")
      .update({
        description: finalDesc,
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

  // Period filtering logic (already filtered in database query by date range)
  const periodFiltered = sales;

  // View filters: payment method and transaction type
  const filteredSales = periodFiltered.filter((s) => {
    // 1. Filter by payment method
    if (filterMethod !== "all" && s.payment_method !== filterMethod) return false;

    // 2. Filter by transaction type
    if (filterType !== "all") {
      const type = s.transaction_type || s.description;
      if (filterType === "otro") {
        const stdTypesLower = ["cierre", "tips - propina", "efectivo recibo", "venta_shift4"];
        if (type && stdTypesLower.includes(type.toLowerCase())) return false;
      } else {
        if (!type || type.toLowerCase() !== filterType.toLowerCase()) return false;
      }
    }

    return true;
  });

  const periodTotal = filteredSales.reduce((sum, s) => sum + Number(s.amount), 0);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold">Ventas {branchTitle}</h1>
          <p className="text-sm text-muted-foreground">Registros independientes para la sucursal {branchTitle}.</p>
        </div>

        {!isEmployee && (
          <Button
            onClick={() => setShowRegisterModal(true)}
            className="bg-primary hover:bg-primary/90 text-white font-bold rounded-xl shadow-md cursor-pointer px-5 h-11 flex items-center gap-2 text-sm self-start sm:self-auto"
          >
            + Registrar Venta
          </Button>
        )}
      </div>

      {/* KPI Sales Cards */}
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

      {/* Table & Filtering: Full width */}
      <div className="space-y-4 w-full">
        {/* Filtering Toolbar */}
        <Card className="border border-border/60 shadow-sm bg-card p-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-primary" /> Consulta y Rango de Fechas
              </span>
              <Badge variant="outline" className="border-primary/20 text-primary font-semibold text-[10px] uppercase">
                {format(new Date(fromStr + "T00:00:00"), "dd MMM", { locale: es })} – {format(new Date(toStr + "T00:00:00"), "dd MMM yyyy", { locale: es })}
              </Badge>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              {/* Option Selector */}
              <div className="flex flex-col gap-1.5 min-w-[120px]">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Tipo de Filtro</Label>
                <Select
                  value={draftFilterType}
                  onValueChange={(val: any) => setDraftFilterType(val)}
                >
                  <SelectTrigger className="h-10 rounded-xl border-border/80 text-xs bg-background focus:ring-2 focus:ring-primary/40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semana" className="text-xs cursor-pointer font-semibold">Semana</SelectItem>
                    <SelectItem value="mes" className="text-xs cursor-pointer font-semibold">Mes</SelectItem>
                    <SelectItem value="ano" className="text-xs cursor-pointer font-semibold">Año</SelectItem>
                    <SelectItem value="rango" className="text-xs cursor-pointer font-semibold">Rango de Fechas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Dynamic Selectors */}
              {draftFilterType === "semana" && (
                <div className="flex flex-col gap-1.5 min-w-[200px] flex-1 sm:flex-initial animate-fade-in">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Seleccionar Semana (Mié - Mar)</Label>
                  <Select
                    value={draftWeek}
                    onValueChange={setDraftWeek}
                  >
                    <SelectTrigger className="h-10 rounded-xl border-border/80 text-xs bg-background focus:ring-2 focus:ring-primary/40 truncate">
                      <SelectValue placeholder="Selecciona una semana" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 overflow-y-auto">
                      {availableWeeks.map((w) => (
                        <SelectItem key={w.key} value={w.key} className="text-xs cursor-pointer font-semibold">
                          {w.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {draftFilterType === "mes" && (
                <>
                  <div className="flex flex-col gap-1.5 min-w-[140px] flex-1 sm:flex-initial animate-fade-in">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Mes</Label>
                    <Select
                      value={draftMonth}
                      onValueChange={setDraftMonth}
                    >
                      <SelectTrigger className="h-10 rounded-xl border-border/80 text-xs bg-background focus:ring-2 focus:ring-primary/40">
                        <SelectValue placeholder="Selecciona un mes" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 overflow-y-auto">
                        {MONTHS_FULL.map((m) => (
                          <SelectItem key={m.value} value={m.value} className="text-xs cursor-pointer font-semibold">
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5 min-w-[100px] flex-1 sm:flex-initial animate-fade-in">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Año</Label>
                    <Select
                      value={draftYear}
                      onValueChange={setDraftYear}
                    >
                      <SelectTrigger className="h-10 rounded-xl border-border/80 text-xs bg-background focus:ring-2 focus:ring-primary/40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {YEARS.map((y) => (
                          <SelectItem key={y} value={y} className="text-xs cursor-pointer font-semibold">{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {draftFilterType === "ano" && (
                <div className="flex flex-col gap-1.5 min-w-[100px] flex-1 sm:flex-initial animate-fade-in">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Año</Label>
                  <Select
                    value={draftYear}
                    onValueChange={setDraftYear}
                  >
                    <SelectTrigger className="h-10 rounded-xl border-border/80 text-xs bg-background focus:ring-2 focus:ring-primary/40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {YEARS.map((y) => (
                        <SelectItem key={y} value={y} className="text-xs cursor-pointer font-semibold">{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {draftFilterType === "rango" && (
                <div className="flex flex-wrap gap-3 flex-1 sm:flex-initial items-end animate-fade-in">
                  <div className="flex flex-col gap-1.5 min-w-[130px] flex-1">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Desde</Label>
                    <Input
                      type="date"
                      value={draftRangeStart}
                      className="h-10 rounded-xl bg-background border-border/80 text-xs"
                      onChange={(e) => setDraftRangeStart(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 min-w-[130px] flex-1">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Hasta</Label>
                    <Input
                      type="date"
                      value={draftRangeEnd}
                      className="h-10 rounded-xl bg-background border-border/80 text-xs"
                      onChange={(e) => setDraftRangeEnd(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Consultar Action Button */}
              <Button
                onClick={applyFilter}
                className="h-10 px-5 rounded-xl text-xs font-bold bg-primary hover:bg-primary/95 text-white flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-primary/10 transition-all hover:scale-[1.02] ml-auto shrink-0"
              >
                Consultar
              </Button>
            </div>

            {/* View Filters: Payment Method & Transaction Type */}
            <div className="border-t border-border/40 pt-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                <Filter className="h-3 w-3 text-primary" /> Filtrar Vista por
              </p>
              <div className="flex flex-wrap gap-3">
                {/* Method Filter */}
                <div className="flex flex-col gap-1 min-w-[160px]">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Método de Pago</Label>
                  <Select value={filterMethod} onValueChange={setFilterMethod}>
                    <SelectTrigger className="h-9 rounded-xl border-border/80 text-xs bg-background focus:ring-2 focus:ring-primary/40">
                      <SelectValue placeholder="Todos los métodos" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 overflow-y-auto" side="bottom" align="start">
                      <SelectItem value="all">Todos los métodos</SelectItem>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="tarjeta">Tarjeta</SelectItem>
                      <SelectItem value="zelle">Zelle / Pago Móvil</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Type Filter */}
                <div className="flex flex-col gap-1 min-w-[160px]">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Tipo de Transacción</Label>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="h-9 rounded-xl border-border/80 text-xs bg-background focus:ring-2 focus:ring-primary/40">
                      <SelectValue placeholder="Todos los tipos" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 overflow-y-auto" side="bottom" align="start">
                      <SelectItem value="all">Todos los tipos</SelectItem>
                      <SelectItem value="Cierre">Cierre</SelectItem>
                      <SelectItem value="Tips - propina">Tips - propina</SelectItem>
                      <SelectItem value="Efectivo recibo">Efectivo recibo</SelectItem>
                      <SelectItem value="venta_shift4">Venta Shift4</SelectItem>
                      <SelectItem value="otro">Otros personalizados</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Active Filter Badges */}
                {(filterMethod !== "all" || filterType !== "all") && (
                  <div className="flex items-end gap-2 flex-wrap">
                    {filterMethod !== "all" && (
                      <button
                        onClick={() => setFilterMethod("all")}
                        className="flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-1 text-[10px] font-bold cursor-pointer hover:bg-primary/20 transition-colors"
                      >
                        {filterMethod}
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                    {filterType !== "all" && (
                      <button
                        onClick={() => setFilterType("all")}
                        className="flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-1 text-[10px] font-bold cursor-pointer hover:bg-primary/20 transition-colors"
                      >
                        {filterType === "otro" ? "Personalizado" : (filterType === "venta_shift4" ? "Venta Shift4" : filterType)}
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Table Card */}
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
                      <TableCell className="text-xs font-medium text-foreground capitalize">{s.restaurant_branch ?? "Sin sucursal"}</TableCell>
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
                          {s.transaction_type === "venta_shift4" ? (
                            <span className="text-[10px] text-primary/70 bg-primary/5 border border-primary/20 rounded-full px-2.5 py-1 font-bold flex items-center justify-center gap-1.5 shadow-sm">
                              <Lock className="h-3 w-3 text-primary/60 shrink-0" />
                              <span>Shift4</span>
                            </span>
                          ) : canManage ? (
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

      {/* Register Sale Modal Dialog */}
      <Dialog open={showRegisterModal} onOpenChange={setShowRegisterModal}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md rounded-2xl border border-border shadow-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/40 shrink-0">
            <DialogTitle className="text-lg font-extrabold text-foreground flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" /> Registrar Venta
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Ingresa los datos correspondientes para registrar una venta en {branchTitle}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 py-4 min-w-0 overflow-y-auto flex-1">
            {/* Date */}
            <div className="space-y-1.5">
              <Label htmlFor="dateInput">Fecha</Label>
              <Input
                id="dateInput"
                type="date"
                value={date}
                className="rounded-xl border-border/80 text-sm w-full"
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            {/* Tipo de Transacción */}
            <div className="space-y-1.5">
              <Label htmlFor="typeInput">Tipo de Transacción</Label>
              <Select
                value={isCustomDesc ? "otro" : desc}
                onValueChange={(val) => {
                  if (val === "otro") {
                    setIsCustomDesc(true);
                    setDesc("");
                  } else {
                    setIsCustomDesc(false);
                    setDesc(val);
                  }
                }}
              >
                <SelectTrigger id="typeInput" className="h-10 rounded-xl border-border/80 text-sm bg-background focus:ring-2 focus:ring-primary/40 w-full">
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto" side="bottom" align="start">
                  <SelectItem value="Cierre">Cierre</SelectItem>
                  <SelectItem value="Tips - propina">Tips - propina</SelectItem>
                  <SelectItem value="Efectivo recibo">Efectivo recibo</SelectItem>
                  <SelectItem value="otro">Otro (Escribir...)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Description Text Input */}
            {isCustomDesc && (
              <div className="space-y-1.5 animate-fade-in">
                <Label htmlFor="customDescInput">Descripción / Plato Personalizado</Label>
                <Input
                  id="customDescInput"
                  placeholder="Ej. Tacos de Barbacoa"
                  value={customDesc}
                  className="rounded-xl border-border/80 text-sm w-full"
                  onChange={(e) => {
                    setCustomDesc(e.target.value);
                    setDesc(e.target.value);
                  }}
                />
              </div>
            )}

            {/* Amount */}
            <div className="space-y-1.5">
              <Label htmlFor="amountInput">Monto ($)</Label>
              <Input
                id="amountInput"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                className="rounded-xl border-border/80 text-sm w-full"
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            {/* Payment Method */}
            <div className="space-y-1.5">
              <Label htmlFor="methodInput">Método de Pago</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger id="methodInput" className="h-10 rounded-xl border-border/80 text-sm bg-background focus:ring-2 focus:ring-primary/40 w-full">
                  <SelectValue placeholder="Seleccionar método" />
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto" side="bottom" align="start">
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="tarjeta">Tarjeta</SelectItem>
                  <SelectItem value="zelle">Zelle / Pago Móvil</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex flex-col gap-3 border-t border-border/40 px-6 py-4 w-full min-w-0 shrink-0">
            <UploadReceiptDialog userId={user?.id} restaurantBranch={branchKey} onSaved={() => {
              setShowRegisterModal(false);
              load();
            }} />
            <div className="flex items-center justify-end gap-2 w-full">
              <Button
                variant="outline"
                className="rounded-xl text-xs font-semibold cursor-pointer border-border flex-1 sm:flex-initial"
                onClick={() => setShowRegisterModal(false)}
              >
                Cancelar
              </Button>
              <Button onClick={add} className="bg-primary hover:bg-primary/95 text-white font-bold rounded-xl text-xs px-5 cursor-pointer flex-1 sm:flex-initial">
                Registrar Venta
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Sale Modal Dialog */}
      <Dialog open={!!editingSale} onOpenChange={(open) => !open && setEditingSale(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md rounded-2xl border border-border shadow-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/40 shrink-0">
            <DialogTitle className="text-lg font-extrabold text-foreground flex items-center gap-2">
              <Edit2 className="h-4 w-4 text-primary" /> Editar Registro de Venta
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Modifica los campos necesarios para corregir esta transacción.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 py-4 min-w-0 overflow-y-auto flex-1">
            {/* Date */}
            <div className="space-y-1">
              <Label htmlFor="editDate">Fecha</Label>
              <Input
                id="editDate"
                type="date"
                value={editDate}
                className="rounded-xl border-border/80 w-full"
                onChange={(e) => setEditDate(e.target.value)}
              />
            </div>

            {/* Tipo de Transacción */}
            <div className="space-y-1.5">
              <Label htmlFor="editTypeInput">Tipo de Transacción</Label>
              <Select
                value={editIsCustomDesc ? "otro" : editDesc}
                onValueChange={(val) => {
                  if (val === "otro") {
                    setEditIsCustomDesc(true);
                    setEditDesc("");
                  } else {
                    setEditIsCustomDesc(false);
                    setEditDesc(val);
                  }
                }}
              >
                <SelectTrigger id="editTypeInput" className="h-10 rounded-xl border-border/80 text-sm bg-background focus:ring-2 focus:ring-primary/40 w-full">
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto" side="bottom" align="start">
                  <SelectItem value="Cierre">Cierre</SelectItem>
                  <SelectItem value="Tips - propina">Tips - propina</SelectItem>
                  <SelectItem value="Efectivo recibo">Efectivo recibo</SelectItem>
                  <SelectItem value="otro">Otro (Escribir...)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Description Text Input */}
            {editIsCustomDesc && (
              <div className="space-y-1.5 animate-fade-in">
                <Label htmlFor="editCustomDescInput">Descripción / Plato Personalizado</Label>
                <Input
                  id="editCustomDescInput"
                  value={editCustomDesc}
                  className="rounded-xl border-border/80 text-sm w-full"
                  onChange={(e) => {
                    setEditCustomDesc(e.target.value);
                    setEditDesc(e.target.value);
                  }}
                />
              </div>
            )}

            {/* Amount */}
            <div className="space-y-1">
              <Label htmlFor="editAmount">Monto ($)</Label>
              <Input
                id="editAmount"
                type="number"
                step="0.01"
                value={editAmount}
                className="rounded-xl border-border/80 w-full"
                onChange={(e) => setEditAmount(e.target.value)}
              />
            </div>

            {/* Payment Method */}
            <div className="space-y-1.5">
              <Label htmlFor="editMethodInput">Método de Pago</Label>
              <Select value={editMethod} onValueChange={setEditMethod}>
                <SelectTrigger id="editMethodInput" className="h-10 rounded-xl border-border/80 text-sm bg-background focus:ring-2 focus:ring-primary/40 w-full">
                  <SelectValue placeholder="Seleccionar método" />
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto" side="bottom" align="start">
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="tarjeta">Tarjeta</SelectItem>
                  <SelectItem value="zelle">Zelle / Pago Móvil</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 border-t border-border/40 px-6 py-4 w-full min-w-0 shrink-0">
            <Button
              variant="outline"
              className="rounded-xl text-xs font-semibold cursor-pointer border-border flex-1 sm:flex-initial"
              onClick={() => setEditingSale(null)}
            >
              Cancelar
            </Button>
            <Button
              className="bg-primary hover:bg-primary/95 text-white font-bold rounded-xl text-xs px-4 cursor-pointer flex-1 sm:flex-initial"
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
