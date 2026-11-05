# Plan: insertar entregas en una ruta sin cambiar el orden acordado

## Objetivo

Al agregar uno o más pedidos, bolsas o tandas a una ruta existente, la persona operadora elige en qué punto van. El API inserta la selección después de una parada existente (o al principio si la ruta aún no tiene paradas) y conserva el orden relativo de todas las entregas que ya estaban en la ruta.

## Flujo

1. Desde una ruta existente, abrir **Agregar a la ruta** y seleccionar pedidos, bolsas consolidadas o tandas como hoy.
2. Continuar a **Elegir ubicación**. No se envía nada todavía.
3. Revisar el mapa de las paradas actuales y sus direcciones. Cada parada elegible también aparece en una lista accesible; seleccionar el pin o su tarjeta destaca el mismo punto.
4. Elegir **Primera parada** o **Después de [nombre/parada]**. La vista previa refleja dónde quedará la nueva entrega respecto a la ruta actual.
5. Confirmar. Si se eligieron varias entregas, se insertan juntas en el orden de selección.

## Reglas

- Agregar a una ruta existente nunca llama al optimizador ni reordena las entregas existentes.
- El punto de inserción se identifica por una entrega de esa misma ruta. `0` representa explícitamente el inicio; las altas a rutas existentes deben enviar una posición elegida.
- Al insertar después de una entrega de bolsa consolidada, el API usa el final de esa bolsa física. Nunca intercala otro pedido entre sus integrantes.
- Los pedidos de una bolsa seleccionada se insertan como bloque, uno por cada pedido fuente, con sus dueñas, artículos, pagos e historial originales.
- Las tandas y las bolsas mantienen la continuidad de sus paradas físicas. Las selecciones múltiples se encadenan después de la entrega insertada anterior para respetar el orden que eligió el operador.
- El API verifica que la parada de referencia pertenezca a la ruta solicitada y que la entrega que se agrega siga disponible.
- El flujo de creación de rutas nuevas y la acción manual **Optimizar ruta** conservan su comportamiento actual.

## Experiencia visual

- Mobile-first real: en móvil el mapa aparece arriba de la lista de direcciones, con botones grandes y scroll vertical; en escritorio el mapa y la lista pueden verse al mismo tiempo.
- Lenguaje visual del login: Cute Tactile 3D + Soft Neumorphism, rosas, lavanda, marfil, jerarquía cálida y estados seleccionados claros.
- La tarjeta seleccionada indica “Insertar después de…” y la nueva parada se distingue en el mapa y en la vista previa.
- Mostrar destino y clienta/grupo en cada parada para elegir rápido sin confundir direcciones.
- En bolsas, mantener visible el total por dueña y su saldo individual, además del agregado de la bolsa.
- El mockup es ilustrativo: el mapa de producción usará las coordenadas reales disponibles.

## Alcance técnico

- Web: agregar un segundo paso al modal actual de agregar pedidos/tandas; exponer mapa y lista de paradas existentes; enviar el identificador de la referencia junto con cada alta. El atajo desde el detalle de tandas abre este mismo selector con la tanda ya elegida.
- API: insertar pedidos/bloques en el lugar solicitado, desplazar `SortOrder` de forma segura y no ejecutar `OptimizeRouteInternal` en altas a rutas existentes.
- Mantener la acción de optimización explícita, el flujo de nueva ruta, el contrato de Android y los datos fuente de cada pedido. No integrar cambios en Android.
- No se anticipa una migración: se reutiliza `Delivery.SortOrder`.

## Validación de entrega

- Revisar mockup en tamaños de teléfono y escritorio antes de integrar.
- Compilar Angular y API después de la integración.
- Confirmar en el diff que altas a rutas existentes no invocan el optimizador y que Android no cambió.
