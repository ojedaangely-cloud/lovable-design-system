import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReceiptText, Loader2, FileSpreadsheet, Save, Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { analyzeReceipt, type ReceiptLine } from "@/lib/receipt-analyzer.functions";

type Row = { id: string; invoice: string; amount: string };

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [meta, base64 = ""] = result.split(",");
      const mimeType = meta.match(/data:(.*?);base64/)?.[1] || file.type || "image/jpeg";
      resolve({ base64, mimeType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function UploadReceiptDialog({
  userId,
  disabled,
  onSaved,
  restaurantBranch,
}: {
  userId: string | undefined;
  disabled?: boolean;
  restaurantBranch?: string;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [preview, setPreview] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const reset = () => {
    setPreview(null);
    setRows([]);
    setDate(new Date().toISOString().split("T")[0]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("La imagen es muy grande (máx. 8MB).");
      return;
    }
    setAnalyzing(true);
    try {
      const { base64, mimeType } = await fileToBase64(file);
      setPreview(`data:${mimeType};base64,${base64}`);
      const result = await analyzeReceipt({ data: { imageBase64: base64, mimeType } });
      if (result.error) {
        toast.error(result.error);
      }
      const lines: ReceiptLine[] = result.lines || [];
      if (lines.length === 0) {
        toast.info("No se detectaron líneas. Puedes agregarlas manualmente.");
      } else {
        toast.success(`Se detectaron ${lines.length} líneas.`);
      }
      setRows(lines.map((l) => ({ id: uid(), invoice: l.invoice, amount: String(l.amount) })));
    } catch (err) {
      console.error(err);
      toast.error("No se pudo procesar la imagen.");
    } finally {
      setAnalyzing(false);
    }
  };

  const updateRow = (id: string, key: "invoice" | "amount", value: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  };

  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));
  const addRow = () => setRows((prev) => [...prev, { id: uid(), invoice: "", amount: "" }]);

  const totalRows = rows.length;
  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  const exportXlsx = () => {
    if (rows.length === 0) return toast.error("No hay datos para exportar.");
    const data = rows.map((r) => ({
      Fecha: date,
      "Número de Factura": r.invoice,
      "Monto ($)": Number(r.amount) || 0,
      "Método de Pago": "efectivo",
    }));
    data.push({
      Fecha: "",
      "Número de Factura": "TOTAL",
      "Monto ($)": total,
      "Método de Pago": "",
    } as never);
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Efectivo");
    XLSX.writeFile(wb, `efectivo-${date}.xlsx`);
  };

  const saveAll = async () => {
    if (!userId) return toast.error("Sesión no encontrada.");
    const valid = rows
      .map((r) => ({ invoice: r.invoice.trim(), amount: Number(r.amount) }))
      .filter((r) => r.invoice.length > 0 && Number.isFinite(r.amount) && r.amount > 0);
    if (valid.length === 0) return toast.error("No hay líneas válidas para guardar.");
    setSaving(true);
    const payload = valid.map((r) => ({
      user_id: userId,
      date,
      description: `Factura ${r.invoice}`,
      amount: r.amount,
      payment_method: "efectivo",
      ...(restaurantBranch ? { restaurant_branch: restaurantBranch } : {}),
    }));
    const { error } = await supabase.from("sales_entries").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`${valid.length} ventas en efectivo registradas para ${date}.`);
    onSaved();
    setOpen(false);
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className="w-full rounded-xl border-primary/30 text-primary font-bold cursor-pointer hover:bg-primary/5"
        >
          <ReceiptText className="h-4 w-4 mr-2 shrink-0" />
          Subir recibo de efectivo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl rounded-2xl border border-border shadow-2xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/40">
          <DialogTitle className="text-lg font-extrabold flex items-center gap-2">
            <ReceiptText className="h-4 w-4 text-primary" /> Subir recibo de efectivo
          </DialogTitle>
          <DialogDescription className="text-xs">
            Sube una foto del ticket. La IA extraerá número de factura y monto. Se registrará como
            efectivo del día seleccionado.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Fecha de registro</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Imagen del recibo</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={onFileChange}
                disabled={analyzing}
                className="rounded-xl cursor-pointer"
              />
            </div>
          </div>

          {preview && (
            <div className="flex items-start gap-4">
              <img
                src={preview}
                alt="Vista previa recibo"
                className="h-32 w-auto rounded-xl border border-border/60 object-contain bg-accent/20"
              />
              {analyzing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Analizando con IA...
                </div>
              )}
            </div>
          )}

          <div className="border border-border/60 rounded-xl overflow-hidden">
            <Table>
              <TableHeader className="bg-accent/30">
                <TableRow>
                  <TableHead className="text-xs font-bold">Nº Factura</TableHead>
                  <TableHead className="text-xs font-bold text-right">Monto ($)</TableHead>
                  <TableHead className="text-xs font-bold text-center w-16">—</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Input
                        value={r.invoice}
                        onChange={(e) => updateRow(r.id, "invoice", e.target.value)}
                        className="h-8 rounded-lg text-xs font-mono"
                        placeholder="Ej. 1042"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        step="0.01"
                        value={r.amount}
                        onChange={(e) => updateRow(r.id, "amount", e.target.value)}
                        className="h-8 rounded-lg text-xs text-right font-mono"
                        placeholder="0.00"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive cursor-pointer"
                        onClick={() => removeRow(r.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-xs py-6 text-muted-foreground italic">
                      Sube un recibo o agrega filas manualmente.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-xs">
            <Button
              size="sm"
              variant="outline"
              onClick={addRow}
              className="rounded-lg cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Agregar fila
            </Button>
            <div className="font-bold">
              {totalRows} líneas · Total:{" "}
              <span className="text-primary text-base font-extrabold">
                ${total.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/40 flex flex-wrap gap-2 sm:justify-between">
          <Button
            variant="outline"
            onClick={exportXlsx}
            disabled={rows.length === 0}
            className="rounded-xl text-xs font-semibold cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Exportar Excel
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
                reset();
              }}
              className="rounded-xl text-xs font-semibold cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              onClick={saveAll}
              disabled={saving || rows.length === 0}
              className="rounded-xl text-xs font-bold bg-primary hover:bg-primary/95 text-white cursor-pointer"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Guardar como efectivo
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}