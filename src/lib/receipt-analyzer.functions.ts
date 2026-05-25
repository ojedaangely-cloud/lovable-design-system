import { z } from "zod";

const InputSchema = z.object({
  imageBase64: z.string().min(50).max(20_000_000),
  mimeType: z.string().min(3).max(100),
});

export type ReceiptLine = { invoice: string; amount: number };

export const analyzeReceipt = async (args: { data: z.infer<typeof InputSchema> }) => {
  // Validate input
  const data = InputSchema.parse(args.data);

  // Retrieve API Key safely from either process.env, Vite import.meta.env, or window global
  const apiKey = 
    (typeof process !== "undefined" ? process.env.LOVABLE_API_KEY : undefined) ||
    (import.meta.env.VITE_LOVABLE_API_KEY as string) ||
    (typeof window !== "undefined" ? (window as any).LOVABLE_API_KEY : undefined);

  if (!apiKey) {
    return { lines: [] as ReceiptLine[], error: "LOVABLE_API_KEY no está configurada." };
  }

  const dataUrl = `data:${data.mimeType};base64,${data.imageBase64}`;

  const systemPrompt = [
    "Eres un asistente experto en lectura de recibos y facturas de restaurantes.",
    "Te enviaré la imagen de un ticket o factura. Cada línea relevante contiene dos números:",
    "el PRIMER número de cada par es el NÚMERO DE FACTURA (invoice).",
    "el SEGUNDO número de cada línea es el MONTO en dólares (amount).",
    "Debes IGNORAR palabras y líneas como: Date, Fecha, Table, Mesa, Guests, Server, Mesero, Tax, Impuesto, Total, Subtotal, Tip, Propina.",
    "Devuelve únicamente las parejas (factura, monto). No incluyas totales ni impuestos.",
  ].join(" ");

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Extrae todas las facturas y montos del recibo." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_receipt_lines",
              description: "Devuelve la lista de líneas (factura, monto) extraídas del recibo.",
              parameters: {
                type: "object",
                properties: {
                  lines: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        invoice: { type: "string", description: "Número de factura (primer número de la línea)." },
                        amount: { type: "number", description: "Monto en dólares (segundo número de la línea)." },
                      },
                      required: ["invoice", "amount"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["lines"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_receipt_lines" } },
      }),
    });

    if (res.status === 429) {
      return { lines: [] as ReceiptLine[], error: "Demasiadas solicitudes. Intenta de nuevo en unos segundos." };
    }
    if (res.status === 402) {
      return { lines: [] as ReceiptLine[], error: "Sin créditos en Lovable AI. Agrega fondos en Settings → Workspace → Usage." };
    }
    if (!res.ok) {
      const txt = await res.text();
      console.error("Lovable AI error", res.status, txt);
      return { lines: [] as ReceiptLine[], error: `Error del modelo (${res.status}).` };
    }

    const json = await res.json();
    const toolCall = json?.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr = toolCall?.function?.arguments ?? "{}";
    let parsed: { lines?: Array<{ invoice: unknown; amount: unknown }> } = {};
    try {
      parsed = JSON.parse(argsStr);
    } catch {
      return { lines: [] as ReceiptLine[], error: "Respuesta del modelo no parseable." };
    }

    const lines: ReceiptLine[] = Array.isArray(parsed.lines)
      ? parsed.lines
          .map((l) => ({
            invoice: String(l.invoice ?? "").trim(),
            amount: Number(l.amount),
          }))
          .filter((l) => l.invoice.length > 0 && Number.isFinite(l.amount) && l.amount > 0)
      : [];

    return { lines, error: null as string | null };
  } catch (err) {
    console.error("analyzeReceipt failed", err);
    return { lines: [] as ReceiptLine[], error: "No se pudo analizar la imagen." };
  }
};