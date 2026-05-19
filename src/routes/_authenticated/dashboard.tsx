import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

type Sale = { amount: number; date: string; description: string; payment_method: string };
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
        supabase.from("sales_entries").select("amount,date,description,payment_method"),
        supabase.from("expense_entries").select("amount,date,description,category"),
        supabase.from("inventory_items").select("name,stock,min_stock,unit"),
      ]);
      setSales((s.data ?? []) as Sale[]);
      setExpenses((e.data ?? []) as Expense[]);
      setInventory((i.data ?? []) as Inv[]);
      setLoading(false);
    })();
  }, []);

  const totalSales = sales.reduce((a, b) => a + Number(b.amount || 0), 0);
  const totalExpenses = expenses.reduce((a, b) => a + Number(b.amount || 0), 0);
  const profit = totalSales - totalExpenses;
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
  const todaySales = sales
    .filter((s) => s.date === todayIso)
    .reduce((a, b) => a + Number(b.amount || 0), 0);
  const monthSales = sales
    .filter((s) => s.date?.startsWith(monthPrefix))
    .reduce((a, b) => a + Number(b.amount || 0), 0);
  const monthExpenses = expenses
    .filter((e) => e.date?.startsWith(monthPrefix))
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
          <Button asChild className="bg-primary hover:bg-primary/95 text-white font-semibold">
            <Link to="/ventas" className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> Registrar Venta
            </Link>
          </Button>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground">Cargando datos...</p>
      )}

      {/* KPI Cards - all real */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-black text-white border-none shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-white/80">
              Ventas Totales
            </CardTitle>
            <ArrowUpRight className="h-4 w-4 text-white/70" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-3xl font-extrabold tracking-tight">${fmt(totalSales)}</div>
            <p className="text-[11px] text-white/70 font-medium">
              Hoy: ${fmt(todaySales)} · Mes: ${fmt(monthSales)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Gastos Totales
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-3xl font-extrabold tracking-tight">${fmt(totalExpenses)}</div>
            <p className="text-[11px] text-muted-foreground font-medium">
              Mes actual: ${fmt(monthExpenses)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Ganancia Neta
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div
              className={`text-3xl font-extrabold tracking-tight ${
                profit < 0 ? "text-red-500" : ""
              }`}
            >
              ${fmt(profit)}
            </div>
            <p className="text-[11px] text-muted-foreground font-medium">
              Margen real: {totalSales > 0 ? `${margin.toFixed(1)}%` : "—"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Stock Bajo
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-3xl font-extrabold tracking-tight">{lowStock.length}</div>
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
          {/* Sales chart - last 7 days, real data */}
          <Card className="border border-border/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-base font-bold">Ventas últimos 7 días</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Total del período: ${fmt(last7.reduce((a, b) => a + b.value, 0))}
                </p>
              </div>
              <Badge variant="outline" className="font-bold">
                {chartHasData ? "Datos reales" : "Sin ventas"}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] w-full">
                {chartHasData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={last7} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <XAxis dataKey="name" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(128,128,128,0.05)" }} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={45}>
                        {last7.map((_, index) => (
                          <Cell key={index} fill="oklch(0.55 0.22 24)" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-sm text-muted-foreground gap-2">
                    <Info className="h-5 w-5" />
                    <span>No hay ventas en los últimos 7 días.</span>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/ventas">Registrar la primera venta</Link>
                    </Button>
                  </div>
                )}
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
