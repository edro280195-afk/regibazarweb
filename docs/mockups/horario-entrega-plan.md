# Plan: reprogramar una entrega por fecha y horario

## Objetivo

Guardar el nuevo momento acordado cuando una clienta solicita mover su entrega, y hacer visible ese acuerdo a quien prepara la ruta, al chofer en la web y a la clienta en su enlace.

## Flujo propuesto

1. Desde el detalle del pedido, la dueña elige fecha y hora exactas o la fecha junto con una ventana flexible.
2. El dato se guarda como hora UTC, preservando la hora local elegida.
3. La ventana acordada se guarda en el campo existente `DeliveryTime`.
4. El resumen del pedido, la vista web del chofer y el enlace de seguimiento muestran la cita y la ventana.
5. Si se restablece la fecha automática, la hora flexible se puede borrar sin perder instrucciones generales del domicilio.

## Alcance técnico

- Web: edición desde el detalle del pedido, tarjeta del pedido, vista web del chofer y enlace público de la clienta.
- API: conservar la hora local al calcular vencimiento; incluir fecha y ventana en los DTOs; no borrar una ventana cuando otros cambios omiten ese campo.
- Base de datos: reutilizar `ScheduledDeliveryDate` y `DeliveryTime`; no requiere migración.
- Android: no se modifica en esta etapa.

## Reglas

- La fecha/hora exacta se transmite como ISO con zona y el servidor la guarda en UTC.
- La hora flexible es texto breve, por ejemplo «entre 5:30 y 6:30 pm, llamar al llegar».
- El vencimiento del enlace sigue calculándose por fecha local y conserva la regla actual de dos días.
- Una ventana vacía borra solo la ventana, no las instrucciones generales de entrega.
- Los datos de pedidos previos sin ventana siguen apareciendo como antes.

## Revisión de la propuesta

- Revisar el flujo primero a 320–430 px y después en escritorio.
- Mostrar claramente fecha, hora exacta y ventana, cuando existan.
- Confirmar builds de Angular y API. No se requiere una migración de base de datos.
