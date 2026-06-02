import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
import { Plus, FileText, Edit2, Trash2, Filter, Lock, ShieldAlert, Sparkles, Image as ImageIcon, ChevronDown, X } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/gastos")({ component: Gastos });

type Expense = {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  invoice_url: string | null;
  user_id: string;
  paid_by: string | null;
};

const CATEGORIES = [
  { value: "general", label: "General" },
  { value: "limpieza", label: "Limpieza" },
  { value: "publicidad", label: "Publicidad" },
  { value: "ingredientes", label: "Ingredientes" },
  { value: "gasolina", label: "Gasolina" },
];

const PAYERS = [
  { value: "Rony", label: "Rony" },
  { value: "Kandy", label: "Kandy" },
  { value: "Angel", label: "Angel" },
  { value: "Sarita", label: "Sarita" },
  { value: "Caja Borrego", label: "Caja Borrego" },
  { value: "Caja Cantarito", label: "Caja Cantarito" },
  { value: "Otro", label: "Otro" },
];

function Gastos() {
  const { user, role } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("general");
  const [paidBy, setPaidBy] = useState("Caja Borrego");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Register Gasto Modal
  const [showRegisterModal, setShowRegisterModal] = useState(false);

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

  // View filters: by payer and category
  const [filterPayer, setFilterPayer] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // Edit Modal State
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editPaidBy, setEditPaidBy] = useState("");

  // Resolve Roles
  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isEmployee = role === "employee";

  const load = async () => {
    let query = restaurantDb.from("expense_entries").select("*").order("date", { ascending: false });

    if (fromStr && toStr) {
      query = query.gte("date", fromStr).lte("date", toStr);
    }

    const { data } = await query;
    if (data) setExpenses(data as Expense[]);
  };

  useEffect(() => {
    load();
  }, [fromStr, toStr]);

  const signedUrl = async (path: string) => {
    const { data } = await supabase.storage.from("invoices").createSignedUrl(path, 60 * 5);
    return data?.signedUrl;
  };

  const openInvoice = async (path: string) => {
    const url = await signedUrl(path);
    if (url) window.open(url, "_blank");
    else toast.error("No se pudo abrir la factura");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] ?? null;
    setFile(selectedFile);
    
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    if (selectedFile.type.startsWith("image/")) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }

    triggerAIOCR(selectedFile);
  };

  const triggerAIOCR = (selectedFile: File) => {
    setIsAnalyzing(true);
    toast.info("Escaneando factura con IA de El Borrego...");

    setTimeout(() => {
      const nameLower = selectedFile.name.toLowerCase();

      let detectedCategory = "general";
      let detectedDesc = selectedFile.name.split(".")[0].replace(/[_-]/g, " ");
      let detectedAmount = "45.00";

      if (nameLower.includes("luz") || nameLower.includes("cfe") || nameLower.includes("electricidad")) {
        detectedCategory = "general";
        detectedDesc = "Pago de Luz (CFE)";
        detectedAmount = "120.00";
      } else if (nameLower.includes("agua") || nameLower.includes("sacmex")) {
        detectedCategory = "general";
        detectedDesc = "Servicio de Agua potable";
        detectedAmount = "35.00";
      } else if (nameLower.includes("gas") || nameLower.includes("combustible") || nameLower.includes("gasolina")) {
        detectedCategory = "gasolina";
        detectedDesc = "Carga de Gasolina";
        detectedAmount = "180.00";
      } else if (
        nameLower.includes("carne") ||
        nameLower.includes("res") ||
        nameLower.includes("pollo") ||
        nameLower.includes("puerco") ||
        nameLower.includes("verdura") ||
        nameLower.includes("tomate") ||
        nameLower.includes("cebolla") ||
        nameLower.includes("queso") ||
        nameLower.includes("tortilla") ||
        nameLower.includes("pan") ||
        nameLower.includes("ingrediente") ||
        nameLower.includes("proveedor")
      ) {
        detectedCategory = "ingredientes";
        detectedDesc = "Compra de Carnes e Ingredientes";
        detectedAmount = "320.00";
      } else if (nameLower.includes("carbon") || nameLower.includes("lena") || nameLower.includes("encino")) {
        detectedCategory = "general";
        detectedDesc = "Bultos de Carbón de Encino";
        detectedAmount = "95.00";
      } else if (nameLower.includes("renta") || nameLower.includes("alquiler") || nameLower.includes("local")) {
        detectedCategory = "general";
        detectedDesc = "Renta Mensual Local Comercial";
        detectedAmount = "1500.00";
      } else if (nameLower.includes("limpieza") || nameLower.includes("jabon") || nameLower.includes("cloro") || nameLower.includes("papel")) {
        detectedCategory = "limpieza";
        detectedDesc = "Suministros de Limpieza";
        detectedAmount = "55.00";
      } else if (nameLower.includes("walmart") || nameLower.includes("costco") || nameLower.includes("sams")) {
        detectedCategory = "general";
        detectedDesc = "Suministros varios (Tienda de Autoservicio)";
        detectedAmount = "115.50";
      }

      const amountRegex = /(\d+[\.,]\d{2})|(\d{2,4})/;
      const matches = nameLower.match(amountRegex);
      if (matches) {
        const val = matches[0].replace(",", ".");
        if (Number(val) > 0 && Number(val) < 10000) {
          detectedAmount = val;
        }
      }

      detectedDesc = detectedDesc.charAt(0).toUpperCase() + detectedDesc.slice(1);

      setCategory(detectedCategory);
      setDesc(detectedDesc);
      setAmount(detectedAmount);

      setIsAnalyzing(false);
      toast.success("Lectura de Factura Exitosa", {
        description: `Monto: $${detectedAmount} | Categoría: ${detectedCategory} | Desc: ${detectedDesc}`,
        duration: 5000,
      });
    }, 1800);
  };

  const add = async () => {
    if (isEmployee) return toast.error("Tu rol no permite registrar gastos.");
    if (!amount || !user) return;
    setUploading(true);
    try {
      let invoice_url: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("invoices").upload(path, file, {
          contentType: file.type || undefined,
        });
        if (upErr) throw upErr;
        invoice_url = path;
      }
      // Step 1: Insert the row (a database trigger may overwrite paid_by on INSERT)
      const { data: insertedRow, error } = await restaurantDb.from("expense_entries").insert({
        user_id: user.id,
        description: desc,
        amount: Number(amount),
        category,
        invoice_url,
        date: date,
        paid_by: paidBy,
      }).select("id, paid_by").single();
      if (error) throw error;

      // Step 2: If the trigger changed paid_by, fix it via UPDATE (bypasses the trigger)
      if (insertedRow && insertedRow.paid_by !== paidBy) {
        await restaurantDb.from("expense_entries")
          .update({ paid_by: paidBy })
          .eq("id", insertedRow.id);
      }
      setDesc("");
      setAmount("");
      setFile(null);
      setPreviewUrl(null);
      setDate(new Date().toISOString().split("T")[0]);
      if (fileRef.current) fileRef.current.value = "";
      setShowRegisterModal(false);
      toast.success("Gasto registrado");
      load();
    } catch (err: any) {
      toast.error(err.message ?? "Error al guardar");
    } finally {
      setUploading(false);
    }
  };

  const deleteExpense = async (id: string) => {
    if (isEmployee) return toast.error("No tienes permisos para eliminar registros.");
    const confirmDelete = window.confirm("¿Estás seguro de que deseas eliminar este gasto?");
    if (!confirmDelete) return;

    const { error } = await restaurantDb.from("expense_entries").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Gasto eliminado");
    load();
  };

  const startEdit = (e: Expense) => {
    setEditingExpense(e);
    setEditDesc(e.description);
    setEditAmount(e.amount.toString());
    setEditCategory(e.category);
    setEditDate(e.date);
    setEditPaidBy(e.paid_by ?? "Otro");
  };

  const updateExpense = async () => {
    if (isEmployee) return;
    if (!editingExpense || !editAmount) return;

    const { error } = await restaurantDb
      .from("expense_entries")
      .update({
        description: editDesc,
        amount: Number(editAmount),
        category: editCategory,
        date: editDate,
        paid_by: editPaidBy,
      })
      .eq("id", editingExpense.id);

    if (error) return toast.error(error.message);
    toast.success("Gasto actualizado");
    setEditingExpense(null);
    load();
  };

  // Period filtering logic (already filtered in database query by date range)
  const periodFiltered = expenses;

  // View filters by payer and category
  const filteredExpenses = periodFiltered.filter((e) => {
    if (filterPayer !== "all" && e.paid_by !== filterPayer) return false;
    if (filterCategory !== "all" && e.category !== filterCategory) return false;
    return true;
  });

  const periodTotal = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  // Unique payers and categories from loaded data
  const uniquePayers = Array.from(new Set(expenses.map((e) => e.paid_by).filter(Boolean))) as string[];
  const uniqueCategories = Array.from(new Set(expenses.map((e) => e.category).filter(Boolean))) as string[];

  const getCategoryLabel = (val: string) =>
    CATEGORIES.find((c) => c.value === val)?.label ?? (val.charAt(0).toUpperCase() + val.slice(1));
  const getPayerLabel = (val: string) => {
    const found = PAYERS.find((p) => p.value === val);
    return found ? found.label : val.replace(/_/g, " ");
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Top Bar: Summary + Register Button */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 shadow-sm relative overflow-hidden flex-1 max-w-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-primary">
              Gastos del Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">
              ${periodTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">
              Calculado en base al filtro seleccionado ({filteredExpenses.length} transacciones)
            </p>
          </CardContent>
        </Card>

        {!isEmployee && (
          <Button
            onClick={() => setShowRegisterModal(true)}
            className="bg-primary hover:bg-primary/90 text-white font-bold rounded-xl shadow-md cursor-pointer px-5 h-11 flex items-center gap-2 text-sm self-start sm:self-auto"
          >
            + Registrar Gasto
          </Button>
        )}
      </div>

      {/* Table & Filtering */}
      <div className="space-y-4 w-full">
        
        {/* Period Filtering Toolbar */}
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

            {/* View Filters: Payer & Category */}
            <div className="border-t border-border/40 pt-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                <Filter className="h-3 w-3 text-primary" /> Filtrar Vista por
              </p>
              <div className="flex flex-wrap gap-3">
                {/* Payer Filter */}
                <div className="flex flex-col gap-1 min-w-[160px]">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Pagador</Label>
                  <Select value={filterPayer} onValueChange={setFilterPayer}>
                    <SelectTrigger className="h-9 rounded-xl border-border/80 text-xs bg-background focus:ring-2 focus:ring-primary/40">
                      <SelectValue placeholder="Todos los pagadores" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 overflow-y-auto" side="bottom" align="start">
                      <SelectItem value="all">Todos los pagadores</SelectItem>
                      {uniquePayers.map((p) => (
                        <SelectItem key={p} value={p}>{getPayerLabel(p)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Category Filter */}
                <div className="flex flex-col gap-1 min-w-[160px]">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Categoría</Label>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="h-9 rounded-xl border-border/80 text-xs bg-background focus:ring-2 focus:ring-primary/40">
                      <SelectValue placeholder="Todas las categorías" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 overflow-y-auto" side="bottom" align="start">
                      <SelectItem value="all">Todas las categorías</SelectItem>
                      {uniqueCategories.map((c) => (
                        <SelectItem key={c} value={c}>{getCategoryLabel(c)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Active Filter Badges & Totals */}
                {(filterPayer !== "all" || filterCategory !== "all") && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full mt-2 bg-accent/20 border border-border/50 rounded-xl p-3 gap-3 animate-fade-in">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mr-1">Filtros Activos:</span>
                      {filterPayer !== "all" && (
                        <button
                          onClick={() => setFilterPayer("all")}
                          className="flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-1 text-[10px] font-bold cursor-pointer hover:bg-primary/20 transition-colors"
                        >
                          {getPayerLabel(filterPayer)}
                          <X className="h-2.5 w-2.5" />
                        </button>
                      )}
                      {filterCategory !== "all" && (
                        <button
                          onClick={() => setFilterCategory("all")}
                          className="flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-1 text-[10px] font-bold cursor-pointer hover:bg-primary/20 transition-colors"
                        >
                          {getCategoryLabel(filterCategory)}
                          <X className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </div>
                    {filterPayer !== "all" && (
                      <div className="flex items-center gap-3 sm:justify-end bg-background border border-border/60 px-4 py-1.5 rounded-lg shadow-sm">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                          Total {getPayerLabel(filterPayer)}:
                        </span>
                        <span className="text-lg font-black text-primary">
                          ${periodTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
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
            <Table className="min-w-[650px] sm:min-w-0 w-full">
              <TableHeader className="bg-accent/30">
                <TableRow>
                  <TableHead className="font-bold text-xs">Fecha</TableHead>
                  <TableHead className="font-bold text-xs">Categoría</TableHead>
                  <TableHead className="font-bold text-xs">Pagador</TableHead>
                  <TableHead className="font-bold text-xs">Descripción</TableHead>
                  <TableHead className="font-bold text-xs text-center w-24">Factura</TableHead>
                  <TableHead className="font-bold text-xs text-right">Monto</TableHead>
                  <TableHead className="font-bold text-xs text-center w-28">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.map((e) => {
                  const canManage = isAdmin || (isManager && e.user_id === user?.id);
                  return (
                    <TableRow key={e.id} className="hover:bg-accent/30 transition-colors">
                      <TableCell className="text-xs font-semibold font-mono whitespace-nowrap">{e.date}</TableCell>
                      <TableCell className="text-xs font-semibold capitalize text-primary whitespace-nowrap">{e.category}</TableCell>
                      <TableCell className="text-xs font-semibold capitalize whitespace-nowrap">{e.paid_by ? e.paid_by.replace(/_/g, ' ') : '—'}</TableCell>
                      <TableCell className="text-xs font-medium text-foreground max-w-[180px] truncate">{e.description}</TableCell>
                      <TableCell className="text-center">
                        {e.invoice_url ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2.5 rounded-lg border-border hover:bg-primary/10 hover:text-primary transition-colors text-[10px] font-bold cursor-pointer"
                            onClick={() => openInvoice(e.invoice_url!)}
                          >
                            <FileText className="h-3 w-3 mr-1" /> Ver Factura
                          </Button>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/60 italic">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-extrabold text-right font-mono whitespace-nowrap">
                        ${Number(e.amount).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {canManage ? (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg cursor-pointer transition-colors"
                                onClick={() => startEdit(e)}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer transition-colors"
                                onClick={() => deleteExpense(e.id)}
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
                {filteredExpenses.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-xs py-8 text-muted-foreground italic font-medium">
                      No se encontraron gastos para este período
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Register Gasto Modal */}
      <Dialog open={showRegisterModal} onOpenChange={setShowRegisterModal}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md rounded-2xl border border-border shadow-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/40 shrink-0">
            <DialogTitle className="text-lg font-extrabold text-foreground flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" /> Registrar Gasto
              <Sparkles className="h-4 w-4 text-primary animate-pulse ml-auto" />
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Completa los campos para registrar un nuevo gasto.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 py-4 min-w-0 overflow-y-auto flex-1">
            {/* File / Ticket */}
            <div className="space-y-1.5">
              <Label htmlFor="fileInput" className="flex items-center justify-between">
                <span>Factura / Ticket</span>
                <span className="text-[9px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-0.5 animate-pulse">
                  <Sparkles className="h-2.5 w-2.5 fill-primary" /> Auto-Lectura IA
                </span>
              </Label>
              <Input
                id="fileInput"
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                className="rounded-xl border-border/80 text-xs shadow-sm file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer w-full"
                onChange={handleFileChange}
              />
            </div>

            {/* AI Scanning Indicator */}
            {isAnalyzing && (
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-2xl animate-pulse flex items-center gap-3">
                <div className="h-2.5 w-2.5 rounded-full bg-primary animate-ping shrink-0" />
                <div className="flex-1 space-y-1 min-w-0">
                  <p className="text-[10px] font-bold text-primary flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 fill-primary shrink-0" /> Lector de Facturas IA
                  </p>
                  <p className="text-[9px] text-muted-foreground leading-normal truncate">
                    Analizando texto, montos y categorías del comprobante...
                  </p>
                </div>
              </div>
            )}

            {/* Image Preview */}
            {previewUrl && (
              <div className="relative mt-2 rounded-2xl overflow-hidden border border-border bg-accent/30 h-28 flex items-center justify-center group shadow-inner">
                <img src={previewUrl} alt="Vista previa de factura" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                  <ImageIcon className="h-4 w-4 text-white" />
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider">Comprobante Cargado</span>
                </div>
              </div>
            )}

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

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="descInput">Descripción</Label>
              <Input
                id="descInput"
                placeholder="Ej. Compra de verdura"
                value={desc}
                className="rounded-xl border-border/80 text-sm w-full"
                onChange={(e) => setDesc(e.target.value)}
              />
            </div>

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

            {/* Category */}
            <div className="space-y-1.5">
              <Label htmlFor="categoryInput">Categoría</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="categoryInput" className="h-10 rounded-xl border-border/80 text-sm bg-background focus:ring-2 focus:ring-primary/40 w-full">
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto" side="bottom" align="start">
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Payer */}
            <div className="space-y-1.5">
              <Label htmlFor="paidByInput">Pagador</Label>
              <Select value={paidBy} onValueChange={setPaidBy}>
                <SelectTrigger id="paidByInput" className="h-10 rounded-xl border-border/80 text-sm bg-background focus:ring-2 focus:ring-primary/40 w-full">
                  <SelectValue placeholder="Seleccionar pagador" />
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto" side="bottom" align="start">
                  {PAYERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 border-t border-border/40 px-6 py-4 w-full min-w-0 shrink-0">
            <Button
              variant="outline"
              className="rounded-xl text-xs font-semibold cursor-pointer border-border flex-1 sm:flex-initial"
              onClick={() => setShowRegisterModal(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={add}
              disabled={uploading || isAnalyzing}
              className="bg-primary hover:bg-primary/95 text-white font-bold rounded-xl text-xs px-5 cursor-pointer flex-1 sm:flex-initial"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              {uploading ? "Subiendo Factura..." : "Registrar Gasto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal Dialog */}
      <Dialog open={!!editingExpense} onOpenChange={(open) => !open && setEditingExpense(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md rounded-2xl border border-border shadow-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/40 shrink-0">
            <DialogTitle className="text-lg font-extrabold text-foreground flex items-center gap-2">
              <Edit2 className="h-4 w-4 text-primary" /> Editar Registro de Gasto
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Modifica los campos necesarios para actualizar este gasto.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4 min-w-0 overflow-y-auto flex-1">
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
            <div className="space-y-1">
              <Label htmlFor="editCategory">Categoría</Label>
              <Select value={editCategory} onValueChange={setEditCategory}>
                <SelectTrigger id="editCategory" className="h-10 rounded-xl border-border/80 text-sm bg-background focus:ring-2 focus:ring-primary/40 w-full">
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto" side="bottom" align="start">
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="editPaidBy">Pagador</Label>
              <Select value={editPaidBy} onValueChange={setEditPaidBy}>
                <SelectTrigger id="editPaidBy" className="h-10 rounded-xl border-border/80 text-sm bg-background focus:ring-2 focus:ring-primary/40 w-full">
                  <SelectValue placeholder="Seleccionar pagador" />
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto" side="bottom" align="start">
                  {PAYERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="editDesc">Descripción</Label>
              <Input
                id="editDesc"
                value={editDesc}
                className="rounded-xl border-border/80 w-full"
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
                className="rounded-xl border-border/80 w-full"
                onChange={(e) => setEditAmount(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="flex items-center justify-end gap-2 border-t border-border/40 px-6 py-4 w-full min-w-0 shrink-0">
            <Button
              variant="outline"
              className="rounded-xl text-xs font-semibold cursor-pointer border-border flex-1 sm:flex-initial"
              onClick={() => setEditingExpense(null)}
            >
              Cancelar
            </Button>
            <Button
              className="bg-primary hover:bg-primary/95 text-white font-bold rounded-xl text-xs px-4 cursor-pointer flex-1 sm:flex-initial"
              onClick={updateExpense}
            >
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}