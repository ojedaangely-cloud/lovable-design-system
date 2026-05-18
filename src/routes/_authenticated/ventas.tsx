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

export const Route = createFileRoute("/_authenticated/ventas")({ component: Ventas });

type Sale = { id: string; date: string; description: string; amount: number; payment_method: string };

function Ventas() {
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("efectivo");

  const load = async () => {
    const { data } = await supabase.from("sales_entries").select("*").order("date", { ascending: false }).limit(200);
    if (data) setSales(data as Sale[]);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!amount) return;
    const { error } = await supabase.from("sales_entries").insert({
      user_id: user!.id, description: desc, amount: Number(amount), payment_method: method,
    });
    if (error) return toast.error(error.message);
    setDesc(""); setAmount("");
    toast.success("Venta registrada");
    load();
  };

  return (
    <div className="p-6">
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
    </div>
  );
}