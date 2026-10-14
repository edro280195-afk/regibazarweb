# Plan: agregar una bolsa consolidada a una ruta

## Objetivo

Permitir que la dueña elija una bolsa completa desde el constructor de rutas y que la ruta use el domicilio principal, manteniendo los artículos, saldos y pagos de cada pedido fuente por separado.

## Flujo propuesto

1. El constructor muestra la bolsa como una sola candidata, con sus clientas, pedidos, domicilio principal, total y saldo agregado.
2. Seleccionar la bolsa la agrega completa; no se permite enviar solo el pedido de una de las clientas.
3. El optimizador calcula una sola ubicación para la bolsa.
4. El API crea una entrega estándar por pedido fuente, con sorteo consecutivo en esa ubicación. Cada entrega conserva artículos, clienta y saldo originales.
5. La vista web del chofer muestra cada pedido fuente como entrega normal, identifica la bolsa y repite el domicilio principal.
6. La app Android sin cambios recibe las mismas entregas estándar de siempre. Verá una tarjeta por pedido fuente en el mismo domicilio, sin un nuevo tipo de parada que pudiera romper su lectura actual.
7. Al agregar una bolsa a una ruta activa se incluyen todos sus pedidos o ninguno. La optimización mantiene juntos los pedidos de la bolsa.

## Reglas y protecciones

- La ruta no acepta una parte de una bolsa consolidada.
- Si algún pedido fuente ya está en otra ruta, cancelado, entregado, es pickup, no tiene sus bolsas confirmadas o tiene bolsas cargadas en otra ruta, no se agrega la bolsa.
- El domicilio y las coordenadas de la parada salen del snapshot de la clienta principal.
- Las entregas, pagos, historial, RegiPuntos y saldos siguen asociados a cada pedido fuente.
- El API conserva el contrato de entregas `Order` existente. No se crea un tipo `Consolidation` ni se modifica Android.

## Alcance técnico

- Web: constructor de rutas, vista previa de ruta y detalle de ruta.
- API: validación y expansión atómica del grupo, optimización por una sola ubicación, prioridad agrupada al reordenar y dirección principal al mapear entregas.
- Base de datos: reutilizar `OrderConsolidation`, `OrderConsolidationId` y el snapshot de domicilio existentes; no requiere migración.
- Android: sin cambios de código o paquete. La pantalla de Android seguirá mostrando cada pedido fuente como una tarjeta normal en el mismo domicilio.

## Revisión de la propuesta

- Confirmar visualmente una sola candidata y un pin, con los totales por clienta visibles.
- Revisar el estado con datos de 320–430 px y escritorio.
- Confirmar los builds de Angular y API. No se requiere migración de base de datos.
