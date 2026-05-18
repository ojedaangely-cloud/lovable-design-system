import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Paperclip, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/gastos")({ component: Gastos });

type Expense = {
  id: string; date: string; category: string; description: string; amount: number; invoice_url: string | null;
};

function Gastos() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("general");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await supabase.from("expense_entries").select("*").order("date", { ascending: false }).limit(200);
    if (data) setExpenses(data as Expense[]);
  };
  useEffect(() => { load(); }, []);

  const signedUrl = async (path: string) => {
    const { data } = await supabase.storage.from("invoices").createSignedUrl(path, 60 * 5);
    return data?.signedUrl;
  };

  const openInvoice = async (path: string) => {
    const url = await signedUrl(path);
    if (url) window.open(url, "_blank");
    else toast.error("No se pudo abrir la factura");
  };

  const add = async () => {
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
      const { error } = await supabase.from("expense_entries").insert({
        user_id: user.id, description: desc, amount: Number(amount), category, invoice_url,
      });
      if (error) throw error;
      setDesc(""); setAmount(""); setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      toast.success("Gasto registrado");
      load();
    } catch (err: any) {
      toast.error(err.message ?? "Error al guardar");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6">
      <Card>
        <CardHeader><CardTitle>Gastos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-5">
            <div><Label>Descripción</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
            <div><Label>Monto</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div><Label>Categoría</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} /></div>
            <div>
              <Label>Factura</Label>
              <Input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button onClick={add} disabled={uploading} className="self-end">
              <Plus className="h-4 w-4 mr-2" />{uploading ? "Guardando..." : "Agregar"}
            </Button>
          </div>
          {file && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Paperclip className="h-3 w-3" /> {file.name}
            </p>
          )}
          <Table>
            <TableHeader><TableRow>
              <TableHead>Fecha</TableHead><TableHead>Categoría</TableHead><TableHead>Descripción</TableHead>
              <TableHead>Factura</TableHead><TableHead className="text-right">Monto</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {expenses.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{e.date}</TableCell>
                  <TableCell>{e.category}</TableCell>
                  <TableCell>{e.description}</TableCell>
                  <TableCell>
                    {e.invoice_url ? (
                      <Button variant="ghost" size="sm" onClick={() => openInvoice(e.invoice_url!)}>
                        <FileText className="h-4 w-4 mr-1" /> Ver
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">${Number(e.amount).toFixed(2)}</TableCell>
                </TableRow>
              ))}
              {expenses.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sin gastos</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}