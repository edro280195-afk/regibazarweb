# Plan: entrega con saldo pendiente

## Objetivo

Hacer evidente que el chofer puede marcar una entrega como realizada aunque la clienta no pague en ese momento, conservando el saldo como deuda del pedido.

## Alcance de esta etapa

- Web del chofer: presentar la opción como una decisión de entrega, no como otra forma de pago.
- Android nativo: ofrecer la misma decisión en la hoja de entrega y permitir confirmar sin crear pagos.
- Escritorio: mostrar claramente el saldo pendiente y el estado de la entrega en la vista amplia.
- API y base de datos: reutilizar el endpoint actual. Una lista de pagos vacía marca la entrega como realizada y conserva el saldo; no se requiere migración.

## Flujo

1. Mostrar el total y el saldo actual por cobrar.
2. Elegir entre registrar un pago o **Entregar con saldo pendiente**.
3. Si no hubo pago, explicar cuánto queda pendiente y que no se registrará ningún pago.
4. Confirmar la entrega.
5. Reflejar el resultado como **Entregada · saldo pendiente** con el monto exacto.

## Estados que debe cubrir el mockup

- Saldo pendiente con la opción de entrega sin pago seleccionada.
- Pago registrado, conservando el flujo actual de efectivo, transferencia y depósito.
- Confirmación de entrega sin pago y saldo conservado.
- Pedido sin saldo, donde no se solicita método de pago.

## Dirección visual

Interfaz cálida y coquette, basada en el login aprobado: fondo marfil, rosas suaves y lavanda, controles táctiles con volumen sutil y contraste legible. Primero móvil; la versión de escritorio distribuye mapa y detalle sin esconder el saldo.

## Fuera de esta etapa

La visibilidad del enlace de ruta para el chofer se trabajará después como una etapa separada, para revisar su propio mockup antes de integrarlo.
