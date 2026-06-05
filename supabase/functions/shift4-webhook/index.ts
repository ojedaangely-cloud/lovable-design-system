Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await req.json();
    console.log("📨 Evento:", body.type);

    if (body.type === 'charge.succeeded' || body.type === 'CHARGE_SUCCEEDED') {
      console.log("💰 VENTA REGISTRADA - ID:", body.data.id);

      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

      const insertUrl = `${supabaseUrl}/rest/v1/sales_transactions`;

      const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };

      const venta = {
        id: generateUUID(),
        transaction_date: new Date().toISOString().split('T')[0],
        transaction_type: 'venta_shift4',
        description: `Pago de ${(body.data.amount / 100).toFixed(2)} ${body.data.currency}`,
        amount: body.data.amount / 100,
        payment_method: body.data.payment_method_type || 'tarjeta',
        restaurant_branch: 'principal',
        created_at: new Date().toISOString(),
        original_id: body.data.id  // ✅ Ahora es TEXT, funciona
      };

      console.log("📝 Monto:", venta.amount, venta.currency);
      console.log("📝 ID Shift4:", venta.original_id);

      const response = await fetch(insertUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Accept-Profile': 'restaurant_borrego',
          'Content-Profile': 'restaurant_borrego',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(venta)
      });

      console.log("📡 Status:", response.status);

      if (!response.ok) {
        const error = await response.text();
        console.error("❌ Error DB:", error);
      } else {
        console.log("✅ VENTA GUARDADA EXITOSAMENTE");
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });

  } catch (error) {
    console.error("❌ Error:", error.message);
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  }
});