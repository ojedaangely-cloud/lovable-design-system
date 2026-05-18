import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Package } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const [totals, setTotals] = useState({ sales: 0, expenses: 0, low: 0 });

  useEffect(() => {
    (async () => {
      const [s, e, i] = await Promise.all([
        supabase.from("sales_entries").select("amount"),
        supabase.from("expense_entries").select("amount"),
        supabase.from("inventory_items").select("stock,min_stock"),
      ]);
      const sales = (s.data ?? []).reduce((a, b: any) => a + Number(b.amount), 0);
      const expenses = (e.data ?? []).reduce((a, b: any) => a + Number(b.amount), 0);
      const low = (i.data ?? []).filter((x: any) => Number(x.stock) <= Number(x.min_stock)).length;
      setTotals({ sales, expenses, low });
    })();
  }, []);

  const profit = totals.sales - totals.expenses;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-sm text-muted-foreground">Resumen general del negocio</p>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Stat icon={<TrendingUp className="h-4 w-4 text-green-600" />} label="Ventas totales" value={`$${totals.sales.toFixed(2)}`} />
        <Stat icon={<TrendingDown className="h-4 w-4 text-red-600" />} label="Gastos totales" value={`$${totals.expenses.toFixed(2)}`} />
        <Stat icon={<DollarSign className="h-4 w-4" />} label="Ganancia" value={`$${profit.toFixed(2)}`} />
        <Stat icon={<Package className="h-4 w-4" />} label="Stock bajo" value={`${totals.low} items`} />
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent><div className="text-2xl font-bold">{value}</div></CardContent>
    </Card>
  );
}