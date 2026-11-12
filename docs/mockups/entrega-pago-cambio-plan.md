# Plan: cobro al momento de entregar

## Objetivo

Permitir que el chofer cierre una entrega aunque la clienta no pague en ese momento y facilitar el cálculo del cambio cuando paga en efectivo.

## Flujo propuesto

1. El chofer ve el saldo pendiente del pedido.
2. Elige efectivo, transferencia, depósito o «Sin cobrar».
3. Si elige efectivo, captura cuánto recibió. La pantalla calcula el cambio y el saldo que quedaría pendiente.
4. Al confirmar, el pedido pasa a entregado. Solo se registra como pago lo aplicado al saldo; si recibió más, el pago conserva una nota con lo recibido y el cambio entregado.
5. Si elige «Sin cobrar», se registra la entrega sin pago y el saldo queda pendiente en el historial financiero.

## Alcance técnico

- Web: vista pública de la ruta del chofer.
- API: reutilizar el endpoint de entrega existente. Ya acepta la entrega sin pagos y permite guardar notas en los pagos.
- Android: sin cambios en esta etapa.
- Base de datos: sin migración.

## Reglas

- El cambio es `máximo(0, efectivo recibido - saldo pendiente)`.
- El pago registrado es `mínimo(efectivo recibido, saldo pendiente)`.
- Si el efectivo recibido no cubre el saldo, se permite la entrega; la diferencia queda pendiente.
- Si el pedido ya no tiene saldo, se puede confirmar la entrega sin seleccionar forma de pago.
- Para tanda se conserva el flujo actual, que no cobra al entregar.
- Los controles numéricos usan teclado decimal y tipografía de 16 px o mayor para evitar zoom en iOS.

## Revisión de la propuesta

- Probar el diseño a 320–430 px, con safe area y teclado virtual.
- Confirmar que el cambio, el saldo restante y el estado «Sin cobrar» siempre se distingan del total del pedido.
- Confirmar el build de Angular y de API; no se requiere cambio de contrato ni migración.
