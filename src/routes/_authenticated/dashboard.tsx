import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { restaurantDb } from "@/integrations/supabase/restaurant-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
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
  CalendarIcon,
  ChevronDown,
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

function getMonthStartEnd() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  return { start, end: today };
}

function Dashboard() {
  const { start: defaultStart, end: defaultEnd } = getMonthStartEnd();
  const [dateFrom, setDateFrom] = useState<Date>(defaultStart);
  const [dateTo, setDateTo] = useState<Date>(defaultEnd);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [inventory, setInventory] = useState<Inv[]>([]);
  const [loading, setLoading] = useState(true);

  const fromStr = useMemo(() => format(dateFrom, "yyyy-MM-dd"), [dateFrom]);
  const toStr = useMemo(() => format(dateTo, "yyyy-MM-dd"), [dateTo]);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const [s, e, i] = await Promise.all([
        restaurantDb
          .from("sales_entries")
          .select("amount,date,description,payment_method,restaurant_branch")
          .gte("date", fromStr)
          .lte("date", toStr),
        restaurantDb
          .from("expense_entries")
          .select("amount,date,description,category")
          .gte("date", fromStr)
          .lte("date", toStr),
        restaurantDb.from("inventory_items").select("name,stock,min_stock,unit"),
      ]);
      setSales((s.data ?? []) as Sale[]);
      setExpenses((e.data ?? []) as Expense[]);
      setInventory((i.data ?? []) as Inv[]);
      setLoading(false);
    })();
  }, [fromStr, toStr]);

  const salesBorrego = sales.filter((s) => s.restaurant_branch === "borrego" || !s.restaurant_branch);
  const salesCantarito = sales.filter((s) => s.restaurant_branch === "cantarito");

  const totalSalesBorrego = salesBorrego.reduce((a, b) => a + Number(b.amount || 0), 0);
  const totalSalesCantarito = salesCantarito.reduce((a, b) => a + Number(b.amount || 0), 0);
  const totalSales = totalSalesBorrego + totalSalesCantarito;
  const pctBorrego = totalSales > 0 ? (totalSalesBorrego / totalSales) * 100 : 0;
  const pctCantarito = totalSales > 0 ? (totalSalesCantarito / totalSales) * 100 : 0;

  const totalExpenses = expenses.reduce((a, b) => a + Number(b.amount || 0), 0);

  const tipsPropina = sales
    .filter((s) => s.description?.toLowerCase().includes("propina") || s.description?.toLowerCase().includes("tip"))
    .reduce((a, b) => a + Number(b.amount || 0), 0);

  const profit = totalSales - totalExpenses - tipsPropina;
  const margin = totalSales > 0 ? (profit / totalSales) * 100 : 0;
  const lowStock = inventory.filter((x) => Number(x.stock) <= Number(x.min_stock));

  const chartData = useMemo(() => {
    const data: { name: string; date: string; value: number }[] = [];
    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 31) {
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const iso = format(d, "yyyy-MM-dd");
        data.push({
          name: format(d, "dd MMM", { locale: es }),
          date: iso,
          value: 0,
        });
      }
    } else {
      const months = new Map<string, { name: string; date: string; value: number }>();
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const monthKey = format(d, "yyyy-MM");
        if (!months.has(monthKey)) {
          months.set(monthKey, {
            name: format(d, "MMM yyyy", { locale: es }),
            date: monthKey,
            value: 0,
          });
        }
      }
      data.push(...Array.from(months.values()));
    }

    sales.forEach((s) => {
      if (diffDays <= 31) {
        const slot = data.find((d) => d.date === s.date);
        if (slot) slot.value += Number(s.amount || 0);
      } else {
        const monthKey = s.date?.slice(0, 7);
        const slot = data.find((d) => d.date === monthKey);
        if (slot) slot.value += Number(s.amount || 0);
      }
    });
    return data;
  }, [sales, dateFrom, dateTo]);

  const chartHasData = chartData.some((d) => d.value > 0);

  const todayIso = format(new Date(), "yyyy-MM-dd");
  const todayInRange = todayIso >= fromStr && todayIso <= toStr;
  const todaySalesBorrego = todayInRange
    ? salesBorrego.filter((s) => s.date === todayIso).reduce((a, b) => a + Number(b.amount || 0), 0)
    : 0;
  const todaySalesCantarito = todayInRange
    ? salesCantarito.filter((s) => s.date === todayIso).reduce((a, b) => a + Number(b.amount || 0), 0)
    : 0;
  const todaySales = todaySalesBorrego + todaySalesCantarito;

  const monthPrefix = format(new Date(), "yyyy-MM");
  const currentMonthInRange = fromStr <= monthPrefix + "-31" && toStr >= monthPrefix + "-01";

  const monthSalesBorrego = currentMonthInRange
    ? salesBorrego.filter((s) => s.date?.startsWith(monthPrefix)).reduce((a, b) => a + Number(b.amount || 0), 0)
    : 0;
  const monthSalesCantarito = currentMonthInRange
    ? salesCantarito.filter((s) => s.date?.startsWith(monthPrefix)).reduce((a, b) => a + Number(b.amount || 0), 0)
    : 0;
  const monthSales = monthSalesBorrego + monthSalesCantarito;

  const monthExpenses = currentMonthInRange
    ? expenses.filter((e) => e.date?.startsWith(monthPrefix)).reduce((a, b) => a + Number(b.amount || 0), 0)
    : 0;

  const monthTips = currentMonthInRange
    ? sales
        .filter((s) => s.date?.startsWith(monthPrefix) && (s.description?.toLowerCase().includes("propina") || s.description?.toLowerCase().includes("tip")))
        .reduce((a, b) => a + Number(b.amount || 0), 0)
    : 0;

  const byMethod = sales.reduce<Record<string, number>>((acc, s) => {
    const k = s.payment_method || "otro";
    acc[k] = (acc[k] || 0) + Number(s.amount || 0);
    return acc;
  }, {});
  const methodEntries = Object.entries(byMethod).sort((a, b) => b[1] - a[1]);

  const recentSales = [...sales]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 5);

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
          {/* Date Range Filter */}
          <div className="flex items-center gap-2 bg-card border border-border rounded-lg p-1.5 shadow-sm">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    "justify-start text-left font-normal h-9 px-3 text-sm",
                    !dateFrom && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                  {dateFrom ? format(dateFrom, "dd MMM yyyy", { locale: es }) : "Desde"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFrom}
                  onSelect={(d) => d && setDateFrom(d)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground text-sm">—</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    "justify-start text-left font-normal h-9 px-3 text-sm",
                    !dateTo && "text-muted-foreground"
                  )}
                >
                  {dateTo ? format(dateTo, "dd MMM yyyy", { locale: es }) : "Hasta"}
                  <ChevronDown className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={dateTo}
                  onSelect={(d) => d && setDateTo(d)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

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

      {/* Date range indicator */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="font-medium">
          {format(dateFrom, "dd MMM yyyy", { locale: es })} — {format(dateTo, "dd MMM yyyy", { locale: es })}
        </Badge>
        {loading && (
          <span className="text-sm text-muted-foreground">Cargando datos...</span>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
          <Card className="border border-border/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base font-bold">
                  Ventas {chartData.length > 31 ? "por mes" : "diarias"}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {chartData.length > 31
                    ? "Agrupado por mes"
                    : `Del ${format(dateFrom, "dd MMM", { locale: es })} al ${format(dateTo, "dd MMM", { locale: es })}`}
                </p>
              </div>
              <Badge variant="outline" className="font-bold border-primary/20 text-primary bg-primary/5">
                Total: ${fmt(totalSales)}
              </Badge>
            </CardHeader>
            <CardContent className="pt-4">
              {chartHasData ? (
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: "currentColor" }}
                        className="text-muted-foreground"
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "currentColor" }}
                        className="text-muted-foreground"
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `$${Number(v).toFixed(0)}`}
                        width={50}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={40}>
                        {chartData.map((_, i) => (
                          <Cell key={i} fill="#0d631b" className="opacity-90 hover:opacity-100 transition-opacity" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-12 text-center">
                  No hay ventas en el rango seleccionado.
                </p>
              )}
            </CardContent>
          </Card>

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
                <div className="relative w-[220px] h-[130px] flex items-center justify-center">
                  <svg viewBox="0 0 200 160" className="w-full h-full overflow-visible">
                    <defs>
                      <linearGradient id="redGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#f43f5e" />
                        <stop offset="50%" stopColor="#e11d48" />
                        <stop offset="100%" stopColor="#9f1239" />
                      </linearGradient>
                      <pattern id="stripes" width="10" height="10" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                        <line x1="0" y1="0" x2="0" y2="10" stroke="currentColor" className="text-muted/40" strokeWidth="3" />
                      </pattern>
                    </defs>
                    <path
                      d="M 30.72 140 A 80 80 0 1 1 169.28 140"
                      fill="none"
                      stroke="currentColor"
                      className="text-muted/10"
                      strokeWidth="18"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 30.72 140 A 80 80 0 1 1 169.28 140"
                      fill="none"
                      stroke="url(#stripes)"
                      strokeWidth="18"
                      strokeLinecap="round"
                    />
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
                  <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center justify-center text-center">
                    <span className="text-3xl font-black tracking-tight text-foreground">
                      {totalSales > 0 ? `${pctBorrego.toFixed(0)}%` : "0%"}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">
                      El Borrego
                    </span>
                  </div>
                </div>
                <div className="flex-1 w-full space-y-3">
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

          <Card className="border border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">Ventas recientes</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {sales.length === 0 ? "Sin ventas registradas" : `${sales.length} ventas en el rango`}
              </p>
            </CardHeader>
            <CardContent>
              {recentSales.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No hay ventas registradas en el rango seleccionado.
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

          <Card className="border border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">Gastos recientes</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {expenses.length === 0
                  ? "Sin gastos registrados"
                  : `${expenses.length} gastos en el rango`}
              </p>
            </CardHeader>
            <CardContent>
              {recentExpenses.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No hay gastos registrados en el rango seleccionado.
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
