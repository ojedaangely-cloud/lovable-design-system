import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  ArrowUpRight,
  Plus,
  Info,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-black/95 text-white p-3 rounded-xl border border-primary/20 shadow-2xl">
        <p className="text-xs text-muted-foreground font-semibold">{label}</p>
        <p className="text-base font-extrabold text-primary mt-0.5">
          ${Number(payload[0].value).toFixed(2)}
        </p>
      </div>
    );
  }
  return null;
};

const fmt = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Sale = {
  amount: number;
  date: string;
  description: string;
  payment_method: string;
  restaurant_branch?: string | null;
};
type Expense = { amount: number; date: string; description: string; category: string };
type Inv = { name: string; stock: number; min_stock: number; unit: string };

function Dashboard() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [inventory, setInventory] = useState<Inv[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [s, e, i] = await Promise.all([
        supabase.from("sales_entries").select("amount,date,description,payment_method,restaurant_branch"),
        supabase.from("expense_entries").select("amount,date,description,category"),
        supabase.from("inventory_items").select("name,stock,min_stock,unit"),
      ]);
      setSales((s.data ?? []) as Sale[]);
      setExpenses((e.data ?? []) as Expense[]);
      setInventory((i.data ?? []) as Inv[]);
      setLoading(false);
    })();
  }, []);

  const salesBorrego = sales.filter((s) => s.restaurant_branch === "borrego" || !s.restaurant_branch);
  const salesCantarito = sales.filter((s) => s.restaurant_branch === "cantarito");

  const totalSalesBorrego = salesBorrego.reduce((a, b) => a + Number(b.amount || 0), 0);
  const totalSalesCantarito = salesCantarito.reduce((a, b) => a + Number(b.amount || 0), 0);
  const totalSales = totalSalesBorrego + totalSalesCantarito;
  const pctBorrego = totalSales > 0 ? (totalSalesBorrego / totalSales) * 100 : 0;
  const pctCantarito = totalSales > 0 ? (totalSalesCantarito / totalSales) * 100 : 0;

  const totalExpenses = expenses.reduce((a, b) => a + Number(b.amount || 0), 0);

  // Tips / Propina: Sum of sales with "propina" or "tip" in description
  const tipsPropina = sales
    .filter((s) => s.description?.toLowerCase().includes("propina") || s.description?.toLowerCase().includes("tip"))
    .reduce((a, b) => a + Number(b.amount || 0), 0);

  // Ganancia Neta = suma de las dos empresas - Gastos totales - Tips Propina
  const profit = totalSales - totalExpenses - tipsPropina;
  const margin = totalSales > 0 ? (profit / totalSales) * 100 : 0;
  const lowStock = inventory.filter((x) => Number(x.stock) <= Number(x.min_stock));

  // Last 7 days sales chart (real data only)
  const today = new Date();
  const last7: { name: string; date: string; value: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    last7.push({
      name: d.toLocaleDateString("es-ES", { weekday: "short" }),
      date: iso,
      value: 0,
    });
  }
  sales.forEach((s) => {
    const slot = last7.find((d) => d.date === s.date);
    if (slot) slot.value += Number(s.amount || 0);
  });
  const chartHasData = last7.some((d) => d.value > 0);

  // Sales today / this month
  const todayIso = today.toISOString().slice(0, 10);
  const monthPrefix = todayIso.slice(0, 7);

  const todaySalesBorrego = salesBorrego
    .filter((s) => s.date === todayIso)
    .reduce((a, b) => a + Number(b.amount || 0), 0);
  const todaySalesCantarito = salesCantarito
    .filter((s) => s.date === todayIso)
    .reduce((a, b) => a + Number(b.amount || 0), 0);
  const todaySales = todaySalesBorrego + todaySalesCantarito;

  const monthSalesBorrego = salesBorrego
    .filter((s) => s.date?.startsWith(monthPrefix))
    .reduce((a, b) => a + Number(b.amount || 0), 0);
  const monthSalesCantarito = salesCantarito
    .filter((s) => s.date?.startsWith(monthPrefix))
    .reduce((a, b) => a + Number(b.amount || 0), 0);
  const monthSales = monthSalesBorrego + monthSalesCantarito;

  const monthExpenses = expenses
    .filter((e) => e.date?.startsWith(monthPrefix))
    .reduce((a, b) => a + Number(b.amount || 0), 0);

  const monthTips = sales
    .filter((s) => s.date?.startsWith(monthPrefix) && (s.description?.toLowerCase().includes("propina") || s.description?.toLowerCase().includes("tip")))
    .reduce((a, b) => a + Number(b.amount || 0), 0);

  // Payment method breakdown (real)
  const byMethod = sales.reduce<Record<string, number>>((acc, s) => {
    const k = s.payment_method || "otro";
    acc[k] = (acc[k] || 0) + Number(s.amount || 0);
    return acc;
  }, {});
  const methodEntries = Object.entries(byMethod).sort((a, b) => b[1] - a[1]);

  // Recent sales
  const recentSales = [...sales]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 5);

  // Recent expenses
  const recentExpenses = [...expenses]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 5);

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Indicadores reales basados en los datos registrados. Sin datos = cero.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline" className="font-semibold">
            <Link to="/gastos">Registrar Gasto</Link>
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-primary hover:bg-primary/95 text-white font-semibold flex items-center gap-2 cursor-pointer">
                <Plus className="h-4 w-4" /> Registrar Venta
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl border border-border shadow-lg" side="bottom">
              <DropdownMenuItem asChild className="cursor-pointer font-medium focus:bg-primary/10 focus:text-primary">
                <Link to="/ventas">El Borrego</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer font-medium focus:bg-primary/10 focus:text-primary">
                <Link to="/ventas-cantarito">Cantarito Taquería</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground">Cargando datos...</p>
      )}

      {/* KPI Cards - all real */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {/* Ventas Borrego */}
        <Card className="bg-card border border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Ventas Borrego
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-primary shrink-0" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-black tracking-tight text-foreground">${fmt(totalSalesBorrego)}</div>
            <p className="text-[11px] text-muted-foreground font-medium">
              Hoy: ${fmt(todaySalesBorrego)} · Mes: ${fmt(monthSalesBorrego)}
            </p>
          </CardContent>
        </Card>

        {/* Ventas Cantarito */}
        <Card className="bg-card border border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Ventas Cantarito
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-indigo-500 shrink-0" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-black tracking-tight text-foreground">${fmt(totalSalesCantarito)}</div>
            <p className="text-[11px] text-muted-foreground font-medium">
              Hoy: ${fmt(todaySalesCantarito)} · Mes: ${fmt(monthSalesCantarito)}
            </p>
          </CardContent>
        </Card>

        {/* Ventas Totales */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-black text-white border-none shadow-xl sm:col-span-2 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-white/80">
              Ventas Totales
            </CardTitle>
            <ArrowUpRight className="h-4 w-4 text-white/70 shrink-0" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-black tracking-tight">${fmt(totalSales)}</div>
            <p className="text-[11px] text-white/70 font-medium">
              Hoy: ${fmt(todaySales)} · Mes: ${fmt(monthSales)}
            </p>
          </CardContent>
        </Card>

        {/* Gastos Totales */}
        <Card className="bg-card border border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Gastos Totales
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-black tracking-tight text-foreground">${fmt(totalExpenses)}</div>
            <p className="text-[11px] text-muted-foreground font-medium">
              Mes actual: ${fmt(monthExpenses)}
            </p>
          </CardContent>
        </Card>

        {/* Tips / Propina */}
        <Card className="bg-card border border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Tips / Propina
            </CardTitle>
            <DollarSign className="h-4 w-4 text-amber-500 shrink-0" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-black tracking-tight text-foreground">${fmt(tipsPropina)}</div>
            <p className="text-[11px] text-muted-foreground font-medium">
              Mes actual: ${fmt(monthTips)}
            </p>
          </CardContent>
        </Card>

        {/* Ganancia Neta */}
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 shadow-md relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Ganancia Neta
            </CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className={`text-2xl font-black tracking-tight ${profit < 0 ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}`}>
              ${fmt(profit)}
            </div>
            <p className="text-[11px] text-muted-foreground font-medium">
              Margen real: {totalSales > 0 ? `${margin.toFixed(1)}%` : "—"}
            </p>
          </CardContent>
        </Card>

        {/* Stock Bajo */}
        <Card className="bg-card border border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Stock Bajo
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-black tracking-tight text-foreground">{lowStock.length}</div>
            <p className="text-[11px] text-muted-foreground font-medium">
              {inventory.length === 0
                ? "Sin inventario registrado"
                : lowStock.length > 0
                ? "Requiere reposición"
                : "Inventario óptimo"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Sales distribution gauge */}
          <Card className="border border-border/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base font-bold">Distribución de Ventas</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Proporción de ingresos por sucursal
                </p>
              </div>
              <Badge variant="outline" className="font-bold border-red-500/20 text-red-600 bg-red-500/5 dark:text-red-400 dark:bg-red-950/20">
                Ventas Totales: ${fmt(totalSales)}
              </Badge>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-8 py-2">
                {/* Left: Gauge */}
                <div className="relative w-[220px] h-[130px] flex items-center justify-center">
                  <svg viewBox="0 0 200 160" className="w-full h-full overflow-visible">
                    <defs>
                      {/* Red gradient for progress */}
                      <linearGradient id="redGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#f43f5e" />
                        <stop offset="50%" stopColor="#e11d48" />
                        <stop offset="100%" stopColor="#9f1239" />
                      </linearGradient>
                      
                      {/* Pattern for unfilled/striped part */}
                      <pattern id="stripes" width="10" height="10" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                        <line x1="0" y1="0" x2="0" y2="10" stroke="currentColor" className="text-muted/40" strokeWidth="3" />
                      </pattern>
                    </defs>

                    {/* Base track background to give a soft base color to stripes */}
                    <path
                      d="M 30.72 140 A 80 80 0 1 1 169.28 140"
                      fill="none"
                      stroke="currentColor"
                      className="text-muted/10"
                      strokeWidth="18"
                      strokeLinecap="round"
                    />

                    {/* Background track (striped) */}
                    <path
                      d="M 30.72 140 A 80 80 0 1 1 169.28 140"
                      fill="none"
                      stroke="url(#stripes)"
                      strokeWidth="18"
                      strokeLinecap="round"
                    />

                    {/* Progress track (red gradient) */}
                    {totalSales > 0 && (
                      <path
                        d="M 30.72 140 A 80 80 0 1 1 169.28 140"
                        fill="none"
                        stroke="url(#redGradient)"
                        strokeWidth="18"
                        strokeLinecap="round"
                        strokeDasharray="335.1"
                        strokeDashoffset={335.1 - (335.1 * pctBorrego) / 100}
                        className="transition-all duration-1000 ease-out"
                      />
                    )}
                  </svg>

                  {/* Center Text inside gauge */}
                  <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center justify-center text-center">
                    <span className="text-3xl font-black tracking-tight text-foreground">
                      {totalSales > 0 ? `${pctBorrego.toFixed(0)}%` : "0%"}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">
                      El Borrego
                    </span>
                  </div>
                </div>

                {/* Right: Detailed breakdown */}
                <div className="flex-1 w-full space-y-3">
                  {/* El Borrego */}
                  <div className="p-3 rounded-xl border border-border bg-card shadow-sm hover:border-red-500/20 transition-all">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                        <span className="font-bold text-sm text-foreground">El Borrego Dorado</span>
                      </div>
                      <span className="font-extrabold text-sm text-foreground">${fmt(totalSalesBorrego)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Hoy: ${fmt(todaySalesBorrego)}</span>
                      <span className="font-semibold text-rose-600 dark:text-rose-400">
                        {totalSales > 0 ? `${pctBorrego.toFixed(1)}%` : "0.0%"}
                      </span>
                    </div>
                  </div>

                  {/* Cantarito Taqueria */}
                  <div className="p-3 rounded-xl border border-border bg-card shadow-sm hover:border-border/80 transition-all">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/45 shrink-0" />
                        <span className="font-bold text-sm text-foreground">Cantarito Taquería</span>
                      </div>
                      <span className="font-extrabold text-sm text-foreground">${fmt(totalSalesCantarito)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Hoy: ${fmt(todaySalesCantarito)}</span>
                      <span className="font-semibold">
                        {totalSales > 0 ? `${pctCantarito.toFixed(1)}%` : "0.0%"}
                      </span>
                    </div>
                  </div>

                  {/* Insight message */}
                  <p className="text-[11px] text-muted-foreground flex items-start gap-1.5 bg-accent/25 p-2 rounded-lg border border-accent/10">
                    <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <span>
                      {pctBorrego === 100 
                        ? "El Borrego Dorado representa la totalidad de las ventas registradas." 
                        : pctBorrego > 0 
                          ? `El Borrego Dorado lidera con el ${pctBorrego.toFixed(1)}% frente al ${pctCantarito.toFixed(1)}% de Cantarito.` 
                          : "Aún no hay ventas registradas en el sistema."
                      }
                    </span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent sales - real */}
          <Card className="border border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">Ventas recientes</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {sales.length === 0 ? "Sin ventas registradas" : `${sales.length} ventas en total`}
              </p>
            </CardHeader>
            <CardContent>
              {recentSales.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No hay ventas registradas todavía.
                </p>
              ) : (
                <div className="space-y-3">
                  {recentSales.map((s, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-background/50"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-sm truncate">
                          {s.description || "Venta sin descripción"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {s.date} · {s.payment_method}
                        </p>
                      </div>
                      <span className="font-extrabold text-sm">${fmt(Number(s.amount))}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Payment methods - real */}
          <Card className="border border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">Métodos de pago</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Distribución real de cobros
              </p>
            </CardHeader>
            <CardContent>
              {methodEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Sin datos disponibles.
                </p>
              ) : (
                <div className="space-y-3">
                  {methodEntries.map(([method, amount]) => {
                    const pct = totalSales > 0 ? (amount / totalSales) * 100 : 0;
                    return (
                      <div key={method}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="font-semibold capitalize">{method}</span>
                          <span className="font-bold">${fmt(amount)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-accent overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {pct.toFixed(1)}%
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Low stock - real */}
          <Card className="border border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">Inventario bajo</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Artículos en o bajo el mínimo
              </p>
            </CardHeader>
            <CardContent>
              {inventory.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Sin inventario registrado.
                </p>
              ) : lowStock.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Todo el inventario está sobre el mínimo.
                </p>
              ) : (
                <div className="space-y-2">
                  {lowStock.slice(0, 6).map((it, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 rounded-lg bg-red-500/5 border border-red-500/15"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-sm truncate">{it.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Mínimo: {it.min_stock} {it.unit}
                        </p>
                      </div>
                      <Badge className="bg-red-500/10 text-red-500 border-none">
                        {it.stock} {it.unit}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent expenses - real */}
          <Card className="border border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">Gastos recientes</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {expenses.length === 0
                  ? "Sin gastos registrados"
                  : `${expenses.length} gastos en total`}
              </p>
            </CardHeader>
            <CardContent>
              {recentExpenses.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No hay gastos registrados.
                </p>
              ) : (
                <div className="space-y-2">
                  {recentExpenses.map((e, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 rounded-lg border border-border/50"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-sm truncate">
                          {e.description || e.category}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {e.date} · {e.category}
                        </p>
                      </div>
                      <span className="font-bold text-sm">${fmt(Number(e.amount))}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
