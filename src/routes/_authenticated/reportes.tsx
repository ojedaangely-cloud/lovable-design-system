import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { restaurantDb } from "@/integrations/supabase/restaurant-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Download, FileBarChart, Loader2, Calendar } from "lucide-react";
import { startOfWeek, endOfWeek, addWeeks, format, startOfYear, endOfYear } from "date-fns";
import { es } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/reportes")({
  component: ReportesPage,
});

type Sale = {
  date: string;
  amount: number;
  description: string | null;
  restaurant_branch: string | null;
  payment_method?: string | null;
};
type Expense = { date: string; amount: number; description: string | null; category: string | null };

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

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

const fmt = (n: number) => {
  const absVal = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `-$${absVal}` : `$${absVal}`;
};

function ReportesPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // States for unified lookup modal
  const [showWeeklyModal, setShowWeeklyModal] = useState(false);
  const [draftViewType, setDraftViewType] = useState<"week" | "month">("week");
  const [activeViewType, setActiveViewType] = useState<"week" | "month">("week");

  const currentMonthIdx = String(new Date().getMonth());
  const [draftMonth, setDraftMonth] = useState<string>(currentMonthIdx);
  const [activeMonth, setActiveMonth] = useState<string>(currentMonthIdx);

  const [draftWeekKey, setDraftWeekKey] = useState<string>("");
  const [activeWeekKey, setActiveWeekKey] = useState<string>("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const from = format(startOfYear(new Date(year, 0, 1)), "yyyy-MM-dd");
      const to = format(endOfYear(new Date(year, 0, 1)), "yyyy-MM-dd");
      const [{ data: s }, { data: e }] = await Promise.all([
        restaurantDb.from("sales_entries").select("date,amount,description,restaurant_branch,payment_method").gte("date", from).lte("date", to),
        restaurantDb.from("expense_entries").select("date,amount,description,category").gte("date", from).lte("date", to),
      ]);
      setSales((s || []) as Sale[]);
      setExpenses((e || []) as Expense[]);
      setLoading(false);
    })();
  }, [year]);

  // Monthly trend (rows: Cantarito, Borrego, Total Ventas, Gastos, Tips, Profit)
  const monthlyTrend = useMemo(() => {
    const borrego = Array(12).fill(0);
    const cantarito = Array(12).fill(0);
    const gastos = Array(12).fill(0);
    const tips = Array(12).fill(0);

    sales.forEach((s) => {
      if (!s.date) return;
      const parts = s.date.split("-");
      if (parts.length < 2) return;
      const m = parseInt(parts[1], 10) - 1;
      if (m < 0 || m > 11) return;

      // Count as cantarito if branch is cantarito, otherwise borrego (handles null/undefined)
      if (s.restaurant_branch === "cantarito") {
        cantarito[m] += Number(s.amount || 0);
      } else {
        borrego[m] += Number(s.amount || 0);
      }

      // Calculate tips
      if (s.description?.toLowerCase().includes("propina") || s.description?.toLowerCase().includes("tip")) {
        tips[m] += Number(s.amount || 0);
      }
    });

    expenses.forEach((e) => {
      if (!e.date) return;
      const parts = e.date.split("-");
      if (parts.length < 2) return;
      const m = parseInt(parts[1], 10) - 1;
      if (m < 0 || m > 11) return;

      gastos[m] += Number(e.amount || 0);
    });

    const totalVentas = borrego.map((v, i) => v + cantarito[i]);
    // Profit = Total Ventas - Gastos - Tips
    const profit = totalVentas.map((v, i) => v - gastos[i] - tips[i]);

    return { borrego, cantarito, totalVentas, gastos, tips, profit };
  }, [sales, expenses]);

  // Generate Wednesday-to-Tuesday weeks for the selected year
  const yearWeeks = useMemo(() => {
    const weeks: {
      label: string;
      from: Date;
      to: Date;
      key: string;
    }[] = [];

    const startOfY = startOfYear(new Date(year, 0, 1));
    const endOfY = endOfYear(new Date(year, 11, 31));

    // Find Wednesday of the week containing startOfY
    let current = startOfWeek(startOfY, { weekStartsOn: 3 });
    const today = new Date();
    const limitDate = year === today.getFullYear() ? today : endOfY;

    while (current <= limitDate) {
      const wFrom = new Date(current);
      const wTo = endOfWeek(current, { weekStartsOn: 3 });

      const label = `${format(wFrom, "dd MMM", { locale: es })} – ${format(wTo, "dd MMM yyyy", { locale: es })}`;
      const key = format(wFrom, "yyyy-MM-dd");

      weeks.push({
        label,
        from: wFrom,
        to: wTo,
        key,
      });

      current = addWeeks(current, 1);
    }

    return weeks.reverse();
  }, [year]);

  // Auto-select latest week when yearWeeks change
  useEffect(() => {
    if (yearWeeks.length > 0) {
      if (!draftWeekKey) {
        setDraftWeekKey(yearWeeks[0].key);
      }
      if (!activeWeekKey) {
        setActiveWeekKey(yearWeeks[0].key);
      }
    }
  }, [yearWeeks]);

  // Calculate metrics for the active selection (month or week)
  const activeMetrics = useMemo(() => {
    if (activeViewType === "week") {
      if (!activeWeekKey) return null;
      const week = yearWeeks.find((w) => w.key === activeWeekKey);
      if (!week) return null;

      const fromStr = format(week.from, "yyyy-MM-dd");
      const toStr = format(week.to, "yyyy-MM-dd");
      const inRange = (d: string) => d >= fromStr && d <= toStr;

      const salesInPeriod = sales.filter((s) => inRange(s.date));
      const expensesInPeriod = expenses.filter((e) => inRange(e.date));

      const ventasCantarito = salesInPeriod
        .filter((s) => s.restaurant_branch === "cantarito")
        .reduce((a, b) => a + Number(b.amount || 0), 0);

      const ventasBorrego = salesInPeriod
        .filter((s) => s.restaurant_branch !== "cantarito")
        .reduce((a, b) => a + Number(b.amount || 0), 0);

      const totalVentas = ventasBorrego + ventasCantarito;

      const tips = salesInPeriod
        .filter((s) => s.description?.toLowerCase().includes("propina") || s.description?.toLowerCase().includes("tip"))
        .reduce((a, b) => a + Number(b.amount || 0), 0);

      const ventaNeta = totalVentas - tips;
      const gastos = expensesInPeriod.reduce((a, b) => a + Number(b.amount || 0), 0);
      const profit = ventaNeta - gastos;

      return {
        viewType: "week" as const,
        key: week.key,
        label: week.label,
        from: week.from,
        to: week.to,
        ventasBorrego,
        ventasCantarito,
        totalVentas,
        tips,
        ventaNeta,
        gastos,
        profit,
        salesInPeriod,
        expensesInPeriod,
      };
    } else {
      const monthNum = Number(activeMonth);
      const monthLabel = MONTHS_FULL.find((m) => m.value === activeMonth)?.label || "";

      const salesInPeriod = sales.filter((s) => {
        if (!s.date) return false;
        const parts = s.date.split("-");
        if (parts.length < 3) return false;
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        return y === year && m === monthNum;
      });

      const expensesInPeriod = expenses.filter((e) => {
        if (!e.date) return false;
        const parts = e.date.split("-");
        if (parts.length < 3) return false;
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        return y === year && m === monthNum;
      });

      const ventasCantarito = salesInPeriod
        .filter((s) => s.restaurant_branch === "cantarito")
        .reduce((a, b) => a + Number(b.amount || 0), 0);

      const ventasBorrego = salesInPeriod
        .filter((s) => s.restaurant_branch !== "cantarito")
        .reduce((a, b) => a + Number(b.amount || 0), 0);

      const totalVentas = ventasBorrego + ventasCantarito;

      const tips = salesInPeriod
        .filter((s) => s.description?.toLowerCase().includes("propina") || s.description?.toLowerCase().includes("tip"))
        .reduce((a, b) => a + Number(b.amount || 0), 0);

      const ventaNeta = totalVentas - tips;
      const gastos = expensesInPeriod.reduce((a, b) => a + Number(b.amount || 0), 0);
      const profit = ventaNeta - gastos;

      return {
        viewType: "month" as const,
        key: activeMonth,
        label: `${monthLabel} ${year}`,
        from: new Date(year, monthNum, 1),
        to: new Date(year, monthNum + 1, 0),
        ventasBorrego,
        ventasCantarito,
        totalVentas,
        tips,
        ventaNeta,
        gastos,
        profit,
        salesInPeriod,
        expensesInPeriod,
      };
    }
  }, [activeViewType, activeWeekKey, activeMonth, yearWeeks, sales, expenses, year]);

  const handleExecuteQuery = () => {
    setActiveViewType(draftViewType);
    setActiveMonth(draftMonth);
    setActiveWeekKey(draftWeekKey);
  };

  // Download PDF report for the active period (Vertical Letter, Blue Color Theme, detailed tables)
  const downloadActivePDF = () => {
    if (!activeMetrics) return;

    const doc = new jsPDF({ orientation: "portrait", format: "letter" });
    const primaryBlue = [29, 78, 216]; // RGB for professional blue

    // Title Section
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59); // Slate 800
    const reportTitle = activeMetrics.viewType === "week" ? "Resumen de Cierre Semanal" : "Resumen de Cierre Mensual";
    doc.text(reportTitle, 14, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Período: ${activeMetrics.label}`, 14, 27);
    doc.text(`Generado: ${format(new Date(), "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}`, 14, 32);

    // 1. KPI Summary Table
    autoTable(doc, {
      startY: 38,
      head: [["Concepto", "Monto"]],
      body: [
        ["Ventas Cantarito", fmt(activeMetrics.ventasCantarito)],
        ["Ventas Borrego", fmt(activeMetrics.ventasBorrego)],
        ["Total Venta Bruta", fmt(activeMetrics.totalVentas)],
        ["Tips / Propina", fmt(activeMetrics.tips)],
        ["Venta Neta (Venta Bruta - Propinas)", fmt(activeMetrics.ventaNeta)],
        ["Gastos", fmt(activeMetrics.gastos)],
        [activeMetrics.viewType === "week" ? "Profit Neto Semanal" : "Profit Neto Mensual", fmt(activeMetrics.profit)],
      ],
      headStyles: { fillColor: primaryBlue, fontSize: 10, halign: "left" },
      columnStyles: {
        0: { fontStyle: "bold" },
        1: { halign: "right", fontStyle: "bold" }
      },
      styles: { fontSize: 9 },
      theme: "striped"
    });

    let lastY = (doc as any).lastAutoTable.finalY || 80;

    // 2. Sales details table
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("Detalle de Ventas", 14, lastY + 12);

    const salesBody = activeMetrics.salesInPeriod.map((s) => [
      s.date,
      s.restaurant_branch === "cantarito" ? "Cantarito" : "Borrego",
      s.description || "—",
      s.payment_method || "—",
      fmt(s.amount)
    ]);

    autoTable(doc, {
      startY: lastY + 16,
      head: [["Fecha", "Sucursal", "Descripción", "Método", "Monto"]],
      body: salesBody.length > 0 ? salesBody : [["—", "—", "Sin registros de venta en el período", "—", "—"]],
      headStyles: { fillColor: primaryBlue, fontSize: 9 },
      styles: { fontSize: 8 },
      columnStyles: {
        4: { halign: "right" }
      },
      theme: "striped"
    });

    lastY = (doc as any).lastAutoTable.finalY || (lastY + 30);

    // 3. Expenses details table
    if (lastY > 190) {
      doc.addPage();
      lastY = 15;
    } else {
      lastY = lastY + 12;
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("Detalle de Gastos", 14, lastY);

    const expensesBody = activeMetrics.expensesInPeriod.map((e) => [
      e.date,
      e.category || "—",
      e.description || "—",
      fmt(e.amount)
    ]);

    autoTable(doc, {
      startY: lastY + 4,
      head: [["Fecha", "Categoría", "Descripción", "Monto"]],
      body: expensesBody.length > 0 ? expensesBody : [["—", "—", "Sin registros de gasto en el período", "—"]],
      headStyles: { fillColor: primaryBlue, fontSize: 9 },
      styles: { fontSize: 8 },
      columnStyles: {
        3: { halign: "right" }
      },
      theme: "striped"
    });

    const fileLabel = activeMetrics.viewType === "week" ? `cierre-semanal-${activeMetrics.key}` : `cierre-mensual-${activeMetrics.key}`;
    doc.save(`${fileLabel}.pdf`);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
            <FileBarChart className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Reportes</h1>
            <p className="text-sm text-muted-foreground font-medium">Cuadro de tendencia anual y cierres por semana</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowWeeklyModal(true)}
            variant="outline"
            className="font-semibold text-xs h-10 rounded-xl flex items-center gap-2 border-border/80 hover:bg-accent/60"
          >
            <Calendar className="h-4 w-4 text-primary" /> Consulta
          </Button>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[120px] h-10 rounded-xl border-border bg-background font-medium text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-60 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Cargando datos…
        </div>
      ) : (
        <>
          {/* Cuadro de Tendencia - Default main view */}
          <Card className="border border-border/60 shadow-md">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 gap-2">
              <div>
                <CardTitle className="text-base font-bold">Cuadro de Tendencia Mensual · {year}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Visión mensual detallada de los ingresos, gastos y profit neto</p>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-bold text-xs">Concepto</TableHead>
                      {MONTHS.map((m) => (
                        <TableHead key={m} className="text-right font-bold text-xs">{m}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { label: "Ventas Cantarito", values: monthlyTrend.cantarito, color: "text-green-600 dark:text-green-400" },
                      { label: "Ventas Borrego", values: monthlyTrend.borrego, color: "text-green-600 dark:text-green-400" },
                      { label: "Total Ventas", values: monthlyTrend.totalVentas, bold: true },
                      { label: "Gastos", values: monthlyTrend.gastos, danger: true },
                      { label: "Tips / Propina", values: monthlyTrend.tips, color: "text-red-600 dark:text-red-400" },
                      { label: "Profit", values: monthlyTrend.profit, bold: true },
                    ].map((row) => (
                      <TableRow key={row.label} className="hover:bg-accent/20 transition-colors">
                        <TableCell className={`font-semibold text-xs whitespace-nowrap ${row.bold ? "font-bold text-sm bg-accent/10" : ""}`}>
                          {row.label}
                        </TableCell>
                        {row.values.map((v, i) => (
                          <TableCell
                            key={i}
                            className={`text-right text-xs font-medium font-mono whitespace-nowrap ${
                              row.bold ? "font-bold text-sm bg-accent/10" : ""
                            } ${row.danger ? "text-destructive font-semibold" : ""} ${
                              row.color ? row.color : ""
                            } ${
                              row.label === "Profit" ? (v >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive") : ""
                            }`}
                          >
                            {fmt(v)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Interactive details dialog */}
      <Dialog open={showWeeklyModal} onOpenChange={setShowWeeklyModal}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg rounded-2xl border border-border shadow-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/40 shrink-0">
            <DialogTitle className="text-lg font-extrabold text-foreground flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" /> Consulta
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Selecciona una semana o mes para consultar los resultados detallados de ventas y gastos.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            {/* Unified Selector: Tabs for Month vs Week */}
            <div className="flex p-1 bg-accent/40 rounded-xl border border-border/40 gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setDraftViewType("week");
                  setActiveViewType("week");
                }}
                className={cn(
                  "flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5",
                  draftViewType === "week"
                    ? "bg-background text-foreground shadow-sm border border-border/50"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
                )}
              >
                <Calendar className="h-3.5 w-3.5 text-primary" /> Ver por Semana
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraftViewType("month");
                  setActiveViewType("month");
                }}
                className={cn(
                  "flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5",
                  draftViewType === "month"
                    ? "bg-background text-foreground shadow-sm border border-border/50"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
                )}
              >
                <FileBarChart className="h-3.5 w-3.5 text-primary" /> Ver por Mes
              </button>
            </div>

            {/* Dynamic Dropdown + "Consulta" execution button */}
            <div className="flex gap-3 items-end">
              <div className="flex-1 space-y-1.5 min-w-0">
                <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">
                  {draftViewType === "month" ? "Seleccionar Mes" : "Seleccionar Semana"}
                </label>
                {draftViewType === "month" ? (
                  <Select
                    value={draftMonth}
                    onValueChange={(v) => {
                      setDraftMonth(v);
                      setActiveMonth(v);
                    }}
                  >
                    <SelectTrigger className="w-full h-11 rounded-xl border-border bg-background font-semibold text-xs focus:ring-2 focus:ring-primary/40 truncate">
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
                ) : (
                  <Select
                    value={draftWeekKey}
                    onValueChange={(v) => {
                      setDraftWeekKey(v);
                      setActiveWeekKey(v);
                    }}
                  >
                    <SelectTrigger className="w-full h-11 rounded-xl border-border bg-background font-semibold text-xs focus:ring-2 focus:ring-primary/40 truncate">
                      <SelectValue placeholder="Selecciona una semana" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 overflow-y-auto">
                      {yearWeeks.map((w) => (
                        <SelectItem key={w.key} value={w.key} className="text-xs cursor-pointer font-semibold">
                          {w.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <Button
                onClick={handleExecuteQuery}
                className="h-11 px-5 rounded-xl text-xs font-bold bg-primary hover:bg-primary/95 text-white flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-primary/10 transition-all hover:scale-[1.02] shrink-0"
              >
                Consulta
              </Button>
            </div>

            {activeMetrics ? (
              <div className="grid grid-cols-2 gap-3 mt-4 animate-fade-in">
                {/* Ventas Cantarito */}
                <div className="p-3 rounded-xl border border-border/60 bg-card hover:shadow-sm transition-shadow">
                  <div className="text-[10px] font-extrabold text-indigo-500 uppercase tracking-wider">Ventas Cantarito</div>
                  <div className="text-base font-black text-foreground mt-1 font-mono">{fmt(activeMetrics.ventasCantarito)}</div>
                </div>

                {/* Ventas Borrego */}
                <div className="p-3 rounded-xl border border-border/60 bg-card hover:shadow-sm transition-shadow">
                  <div className="text-[10px] font-extrabold text-rose-500 uppercase tracking-wider">Ventas Borrego</div>
                  <div className="text-base font-black text-foreground mt-1 font-mono">{fmt(activeMetrics.ventasBorrego)}</div>
                </div>

                {/* Total Venta Bruta */}
                <div className="col-span-2 p-3.5 rounded-xl border border-primary/20 bg-primary/5 hover:shadow-sm transition-shadow">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-extrabold text-primary uppercase tracking-wider">Venta Bruta Total</span>
                    <span className="text-[10px] font-bold text-muted-foreground">Borrego + Cantarito</span>
                  </div>
                  <div className="text-lg font-black text-foreground mt-1 font-mono">{fmt(activeMetrics.totalVentas)}</div>
                </div>

                {/* Tips / Propina */}
                <div className="p-3 rounded-xl border border-border/60 bg-card hover:shadow-sm transition-shadow">
                  <div className="text-[10px] font-extrabold text-amber-500 uppercase tracking-wider text-amber-600 dark:text-amber-400">Tips / Propina</div>
                  <div className="text-base font-black text-foreground mt-1 font-mono">{fmt(activeMetrics.tips)}</div>
                </div>

                {/* Venta Neta */}
                <div className="p-3 rounded-xl border border-border/60 bg-card hover:shadow-sm transition-shadow">
                  <div className="text-[10px] font-extrabold text-emerald-500 uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Venta Neta</div>
                  <div className="text-base font-black text-foreground mt-1 font-mono">{fmt(activeMetrics.ventaNeta)}</div>
                </div>

                {/* Gastos */}
                <div className="p-3 rounded-xl border border-border/60 bg-card hover:shadow-sm transition-shadow">
                  <div className="text-[10px] font-extrabold text-destructive uppercase tracking-wider">Gastos</div>
                  <div className="text-base font-black text-foreground mt-1 font-mono">{fmt(activeMetrics.gastos)}</div>
                </div>

                {/* Profit Neto */}
                <div className="col-span-2 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 shadow-md">
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                    {activeMetrics.viewType === "week" ? "Profit Neto Semanal" : "Profit Neto Mensual"}
                  </div>
                  <div className={`text-xl font-black mt-1 font-mono ${
                    activeMetrics.profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                  }`}>
                    {fmt(activeMetrics.profit)}
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-1.5 font-medium leading-relaxed">
                    Calculado como Venta Neta (Venta Bruta menos Propinas) menos Gastos en este período.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-muted-foreground italic font-medium">
                No hay datos disponibles para esta selección
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4 bg-accent/20 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
            <Button
              onClick={downloadActivePDF}
              disabled={!activeMetrics}
              className="w-full sm:w-auto rounded-xl text-xs font-bold bg-primary hover:bg-primary/95 text-white flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.02]"
            >
              <Download className="h-4 w-4" /> Descargar Reporte
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto rounded-xl text-xs font-bold border-border/80 hover:bg-accent/60 cursor-pointer"
              onClick={() => setShowWeeklyModal(false)}
            >
              Cerrar Consulta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}