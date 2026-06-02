import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { restaurantDb } from "@/integrations/supabase/restaurant-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileBarChart, Loader2 } from "lucide-react";
import { startOfWeek, endOfWeek, addWeeks, format, startOfYear, endOfYear } from "date-fns";
import { es } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/_authenticated/reportes")({
  component: ReportesPage,
});

type Sale = { date: string; amount: number; restaurant_branch: string | null };
type Expense = { date: string; amount: number };

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function ReportesPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const from = format(startOfYear(new Date(year, 0, 1)), "yyyy-MM-dd");
      const to = format(endOfYear(new Date(year, 0, 1)), "yyyy-MM-dd");
      const [{ data: s }, { data: e }] = await Promise.all([
        restaurantDb.from("sales_entries").select("date,amount,restaurant_branch").gte("date", from).lte("date", to),
        restaurantDb.from("expense_entries").select("date,amount").gte("date", from).lte("date", to),
      ]);
      setSales((s || []) as Sale[]);
      setExpenses((e || []) as Expense[]);
      setLoading(false);
    })();
  }, [year]);

  // Weekly closing for the last 12 weeks
  const weeklyRows = useMemo(() => {
    const today = new Date();
    const rows: {
      label: string;
      from: Date;
      to: Date;
      ventasBorrego: number;
      ventasCantarito: number;
      gastos: number;
    }[] = [];
    for (let i = 11; i >= 0; i--) {
      const ref = addWeeks(today, -i);
      const wFrom = startOfWeek(ref, { weekStartsOn: 1 });
      const wTo = endOfWeek(ref, { weekStartsOn: 1 });
      const fromStr = format(wFrom, "yyyy-MM-dd");
      const toStr = format(wTo, "yyyy-MM-dd");
      const inRange = (d: string) => d >= fromStr && d <= toStr;
      const ventasBorrego = sales
        .filter((s) => inRange(s.date) && s.restaurant_branch === "borrego")
        .reduce((a, b) => a + Number(b.amount || 0), 0);
      const ventasCantarito = sales
        .filter((s) => inRange(s.date) && s.restaurant_branch === "cantarito")
        .reduce((a, b) => a + Number(b.amount || 0), 0);
      const gastos = expenses.filter((e) => inRange(e.date)).reduce((a, b) => a + Number(b.amount || 0), 0);
      rows.push({
        label: `${format(wFrom, "dd MMM", { locale: es })} – ${format(wTo, "dd MMM", { locale: es })}`,
        from: wFrom,
        to: wTo,
        ventasBorrego,
        ventasCantarito,
        gastos,
      });
    }
    return rows;
  }, [sales, expenses]);

  // Monthly trend (rows: Borrego, Cantarito, Total Ventas, Gastos, Diferencia)
  const monthlyTrend = useMemo(() => {
    const borrego = Array(12).fill(0);
    const cantarito = Array(12).fill(0);
    const gastos = Array(12).fill(0);
    sales.forEach((s) => {
      const m = new Date(s.date + "T00:00:00").getMonth();
      if (s.restaurant_branch === "borrego") borrego[m] += Number(s.amount || 0);
      else if (s.restaurant_branch === "cantarito") cantarito[m] += Number(s.amount || 0);
    });
    expenses.forEach((e) => {
      const m = new Date(e.date + "T00:00:00").getMonth();
      gastos[m] += Number(e.amount || 0);
    });
    const totalVentas = borrego.map((v, i) => v + cantarito[i]);
    const diferencia = totalVentas.map((v, i) => v - gastos[i]);
    return { borrego, cantarito, gastos, totalVentas, diferencia };
  }, [sales, expenses]);

  const downloadPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text("Reporte – El Borrego Dorado / Cantarito", 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generado: ${format(new Date(), "PPP", { locale: es })}  ·  Año: ${year}`, 14, 22);

    // Cierre semanal
    autoTable(doc, {
      startY: 28,
      head: [["Semana", "Ventas Borrego", "Ventas Cantarito", "Total Ventas", "Gastos", "Diferencia"]],
      body: weeklyRows.map((r) => {
        const total = r.ventasBorrego + r.ventasCantarito;
        return [r.label, fmt(r.ventasBorrego), fmt(r.ventasCantarito), fmt(total), fmt(r.gastos), fmt(total - r.gastos)];
      }),
      headStyles: { fillColor: [180, 80, 66] },
      styles: { fontSize: 8 },
      didDrawPage: (data) => {
        doc.setFontSize(11);
        doc.text("Cierre Semanal", 14, data.settings.startY - 2);
      },
    });

    // Trend table
    const lastY = (doc as any).lastAutoTable.finalY || 80;
    doc.setFontSize(11);
    doc.text("Cuadro de Tendencia (mensual)", 14, lastY + 10);
    autoTable(doc, {
      startY: lastY + 14,
      head: [["Concepto", ...MONTHS]],
      body: [
        ["Ventas Borrego", ...monthlyTrend.borrego.map(fmt)],
        ["Ventas Cantarito", ...monthlyTrend.cantarito.map(fmt)],
        ["Total Ventas", ...monthlyTrend.totalVentas.map(fmt)],
        ["Gastos", ...monthlyTrend.gastos.map(fmt)],
        ["Diferencia", ...monthlyTrend.diferencia.map(fmt)],
      ],
      headStyles: { fillColor: [180, 80, 66] },
      styles: { fontSize: 7 },
    });

    doc.save(`reporte-borrego-${year}.pdf`);
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
            <p className="text-sm text-muted-foreground">Cierre semanal y tendencia anual</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[120px]">
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
          <Button onClick={downloadPDF} className="gap-2">
            <Download className="h-4 w-4" /> Descargar PDF
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-60 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Cargando datos…
        </div>
      ) : (
        <>
          {/* Cierre Semanal */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cierre Semanal · Últimas 12 semanas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Semana</TableHead>
                      <TableHead className="text-right">Ventas Borrego</TableHead>
                      <TableHead className="text-right">Ventas Cantarito</TableHead>
                      <TableHead className="text-right">Total Ventas</TableHead>
                      <TableHead className="text-right">Gastos</TableHead>
                      <TableHead className="text-right">Diferencia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weeklyRows.map((r) => {
                      const total = r.ventasBorrego + r.ventasCantarito;
                      const diff = total - r.gastos;
                      return (
                        <TableRow key={r.label}>
                          <TableCell className="font-medium">{r.label}</TableCell>
                          <TableCell className="text-right">{fmt(r.ventasBorrego)}</TableCell>
                          <TableCell className="text-right">{fmt(r.ventasCantarito)}</TableCell>
                          <TableCell className="text-right font-semibold">{fmt(total)}</TableCell>
                          <TableCell className="text-right text-destructive">{fmt(r.gastos)}</TableCell>
                          <TableCell className={`text-right font-bold ${diff >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                            {fmt(diff)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Cuadro de Tendencia */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cuadro de Tendencia · {year}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Concepto</TableHead>
                      {MONTHS.map((m) => (
                        <TableHead key={m} className="text-right">{m}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { label: "Ventas Borrego", values: monthlyTrend.borrego },
                      { label: "Ventas Cantarito", values: monthlyTrend.cantarito },
                      { label: "Total Ventas", values: monthlyTrend.totalVentas, bold: true },
                      { label: "Gastos", values: monthlyTrend.gastos, danger: true },
                      { label: "Diferencia", values: monthlyTrend.diferencia, bold: true },
                    ].map((row) => (
                      <TableRow key={row.label}>
                        <TableCell className="font-medium">{row.label}</TableCell>
                        {row.values.map((v, i) => (
                          <TableCell
                            key={i}
                            className={`text-right text-xs ${row.bold ? "font-bold" : ""} ${
                              row.danger ? "text-destructive" : ""
                            } ${row.label === "Diferencia" ? (v >= 0 ? "text-emerald-600" : "text-destructive") : ""}`}
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
    </div>
  );
}