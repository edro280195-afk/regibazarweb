# Notas de API para Payment Manager

El Payment Manager front-end ya está conectado al endpoint existente:

```
PATCH /orders/:id/status
Body: { "status": "Delivered" }
```

## Lo que necesita funcionar en tu API (backend)

### Endpoint existente confirmado
- `PATCH /api/orders/:id/status` — Ya lo tienes en `ApiService.updateOrderStatus()`
- Debe aceptar `{ status: "Delivered" }` y actualizar el campo `Status` de la orden
- Debe devolver la orden actualizada como `OrderSummary`

### Sin tablas nuevas
- **No hay tabla de pagos** — el cobro se refleja como cambio de estatus a `Delivered`
- Los campos `paymentStatus`, `amountPaid`, `amountDue`, `payments` del modelo `OrderSummary` **no se usan** en la lógica real. Si tu API no los devuelve, no importa

### Flujo
1. Admin abre `/admin/payments`
2. Ve pedidos `Pending` / `InRoute` como "Por Cobrar"
3. Da clic en "Confirmar Cobro" → selecciona método de pago → confirma
4. Front-end llama `PATCH /orders/:id/status { status: "Delivered" }`
5. El pedido se mueve a "Cobrados" en la lista

> **Nota:** El método de pago seleccionado (Efectivo, Transfer, OXXO, Tarjeta) actualmente no se envía al backend. Si quieres registrarlo, agrega un campo `paymentMethod` al body del PATCH.
