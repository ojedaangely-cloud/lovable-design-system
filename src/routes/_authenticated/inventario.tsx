import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/inventario")({ component: Inventario });

type Item = { id: string; name: string; unit: string; stock: number; min_stock: number; unit_cost: number };

function Inventario() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("unidad");
  const [stock, setStock] = useState("");
  const [minStock, setMinStock] = useState("");
  const [cost, setCost] = useState("");

  const load = async () => {
    const { data } = await supabase.from("inventory_items").select("*").order("name");
    if (data) setItems(data as Item[]);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!name || !user) return;
    const { error } = await supabase.from("inventory_items").insert({
      user_id: user.id, name, unit,
      stock: Number(stock || 0), min_stock: Number(minStock || 0), unit_cost: Number(cost || 0),
    });
    if (error) return toast.error(error.message);
    setName(""); setStock(""); setMinStock(""); setCost("");
    toast.success("Artículo agregado");
    load();
  };

  return (
    <div className="p-6">
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
            <TableHeader><TableRow>
              <TableHead>Nombre</TableHead><TableHead>Unidad</TableHead>
              <TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Mínimo</TableHead>
              <TableHead className="text-right">Costo</TableHead>
            </TableRow></TableHeader>
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
    </div>
  );
}