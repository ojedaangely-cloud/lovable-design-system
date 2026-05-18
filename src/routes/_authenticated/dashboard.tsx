import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { LogOut, Plus, TrendingUp, TrendingDown, Package } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type Sale = { id: string; date: string; description: string; amount: number; payment_method: string };
type Expense = { id: string; date: string; category: string; description: string; amount: number };
type Item = { id: string; name: string; unit: string; stock: number; min_stock: number; unit_cost: number };

function Dashboard() {
  const { user, signOut } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  const load = async () => {
    const [s, e, i] = await Promise.all([
      supabase.from("sales_entries").select("*").order("date", { ascending: false }).limit(100),
      supabase.from("expense_entries").select("*").order("date", { ascending: false }).limit(100),
      supabase.from("inventory_items").select("*").order("name"),
    ]);
    if (s.data) setSales(s.data as Sale[]);
    if (e.data) setExpenses(e.data as Expense[]);
    if (i.data) setItems(i.data as Item[]);
  };

  useEffect(() => { load(); }, []);

  const totalSales = sales.reduce((a, b) => a + Number(b.amount), 0);
  const totalExpenses = expenses.reduce((a, b) => a + Number(b.amount), 0);
  const profit = totalSales - totalExpenses;
  const lowStock = items.filter((i) => Number(i.stock) <= Number(i.min_stock)).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between py-4 px-4">
          <div>
            <h1 className="text-xl font-semibold">Restaurante Lite</h1>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" /> Salir
          </Button>
        </div>
      </header>

      <main className="container mx-auto p-4 space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Ventas" value={`$${totalSales.toFixed(2)}`} />
          <StatCard icon={<TrendingDown className="h-4 w-4" />} label="Gastos" value={`$${totalExpenses.toFixed(2)}`} />
          <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Ganancia" value={`$${profit.toFixed(2)}`} />
          <StatCard icon={<Package className="h-4 w-4" />} label="Stock bajo" value={`${lowStock} items`} />
        </div>

        <Tabs defaultValue="sales">
          <TabsList>
            <TabsTrigger value="sales">Ventas</TabsTrigger>
            <TabsTrigger value="expenses">Gastos</TabsTrigger>
            <TabsTrigger value="inventory">Inventario</TabsTrigger>
          </TabsList>

          <TabsContent value="sales">
            <SalesPanel sales={sales} userId={user!.id} onChange={load} />
          </TabsContent>
          <TabsContent value="expenses">
            <ExpensesPanel expenses={expenses} userId={user!.id} onChange={load} />
          </TabsContent>
          <TabsContent value="inventory">
            <InventoryPanel items={items} userId={user!.id} onChange={load} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function SalesPanel({ sales, userId, onChange }: { sales: Sale[]; userId: string; onChange: () => void }) {
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("efectivo");

  const add = async () => {
    if (!amount) return;
    const { error } = await supabase.from("sales_entries").insert({
      user_id: userId, description: desc, amount: Number(amount), payment_method: method,
    });
    if (error) return toast.error(error.message);
    setDesc(""); setAmount("");
    toast.success("Venta registrada");
    onChange();
  };

  return (
    <Card>
      <CardHeader><CardTitle>Ventas</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div><Label>Descripción</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
          <div><Label>Monto</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div><Label>Método</Label><Input value={method} onChange={(e) => setMethod(e.target.value)} /></div>
          <Button onClick={add} className="self-end"><Plus className="h-4 w-4 mr-2" />Agregar</Button>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Descripción</TableHead><TableHead>Método</TableHead><TableHead className="text-right">Monto</TableHead></TableRow></TableHeader>
          <TableBody>
            {sales.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.date}</TableCell>
                <TableCell>{s.description}</TableCell>
                <TableCell>{s.payment_method}</TableCell>
                <TableCell className="text-right">${Number(s.amount).toFixed(2)}</TableCell>
              </TableRow>
            ))}
            {sales.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sin ventas</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ExpensesPanel({ expenses, userId, onChange }: { expenses: Expense[]; userId: string; onChange: () => void }) {
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("general");

  const add = async () => {
    if (!amount) return;
    const { error } = await supabase.from("expense_entries").insert({
      user_id: userId, description: desc, amount: Number(amount), category,
    });
    if (error) return toast.error(error.message);
    setDesc(""); setAmount("");
    toast.success("Gasto registrado");
    onChange();
  };

  return (
    <Card>
      <CardHeader><CardTitle>Gastos</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div><Label>Descripción</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
          <div><Label>Monto</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div><Label>Categoría</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} /></div>
          <Button onClick={add} className="self-end"><Plus className="h-4 w-4 mr-2" />Agregar</Button>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Categoría</TableHead><TableHead>Descripción</TableHead><TableHead className="text-right">Monto</TableHead></TableRow></TableHeader>
          <TableBody>
            {expenses.map((e) => (
              <TableRow key={e.id}>
                <TableCell>{e.date}</TableCell>
                <TableCell>{e.category}</TableCell>
                <TableCell>{e.description}</TableCell>
                <TableCell className="text-right">${Number(e.amount).toFixed(2)}</TableCell>
              </TableRow>
            ))}
            {expenses.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sin gastos</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function InventoryPanel({ items, userId, onChange }: { items: Item[]; userId: string; onChange: () => void }) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("unidad");
  const [stock, setStock] = useState("");
  const [minStock, setMinStock] = useState("");
  const [cost, setCost] = useState("");

  const add = async () => {
    if (!name) return;
    const { error } = await supabase.from("inventory_items").insert({
      user_id: userId, name, unit,
      stock: Number(stock || 0), min_stock: Number(minStock || 0), unit_cost: Number(cost || 0),
    });
    if (error) return toast.error(error.message);
    setName(""); setStock(""); setMinStock(""); setCost("");
    toast.success("Artículo agregado");
    onChange();
  };

  return (
    <Card>
      <CardHeader><CardTitle>Inventario</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-6">
          <div><Label>Nombre</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Unidad</Label><Input value={unit} onChange={(e) => setUnit(e.target.value)} /></div>
          <div><Label>Stock</Label><Input type="number" step="0.01" value={stock} onChange={(e) => setStock(e.target.value)} /></div>
          <div><Label>Mín.</Label><Input type="number" step="0.01" value={minStock} onChange={(e) => setMinStock(e.target.value)} /></div>
          <div><Label>Costo</Label><Input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} /></div>
          <Button onClick={add} className="self-end"><Plus className="h-4 w-4 mr-2" />Agregar</Button>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Unidad</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Mínimo</TableHead><TableHead className="text-right">Costo</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.map((i) => {
              const low = Number(i.stock) <= Number(i.min_stock);
              return (
                <TableRow key={i.id} className={low ? "bg-destructive/5" : ""}>
                  <TableCell>{i.name}</TableCell>
                  <TableCell>{i.unit}</TableCell>
                  <TableCell className="text-right">{Number(i.stock)}</TableCell>
                  <TableCell className="text-right">{Number(i.min_stock)}</TableCell>
                  <TableCell className="text-right">${Number(i.unit_cost).toFixed(2)}</TableCell>
                </TableRow>
              );
            })}
            {items.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sin artículos</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}