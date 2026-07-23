# Operación de etiquetas — Regi Bazar

## Antes de imprimir por primera vez

1. En **Administración → Etiquetas**, abre cada una de las tres plantillas.
2. Sube el logo térmico o la imagen que quieras usar, ajusta el diseño y revisa
   la vista blanco y negro.
3. Publica la versión y selecciona **Usar para imprimir**. La cápsula amarilla
   “Predeterminada” confirma que ésa es la que utilizarán Inventario, Pedidos y
   Android.
4. Haz una prueba con material real. No reduzcas el QR ni el código de barras:
   son elementos operativos, no decoración.

## Perfil correcto

| Uso | Equipo | Material | Regla |
| --- | --- | --- | --- |
| Caja de bodega | NIIMBOT B1 | 50 × 50 mm | QR con la URL NFC de la caja. |
| Artículo | NIIMBOT B1 | 50 × 50 mm | Código de barras del artículo o código interno RBI. |
| Bolsa de pedido | AIYIN E40 Pro | 4 × 6 in | QR de bolsa, clienta y número de bolsa. |

## Flujo diario

- **Caja:** crea/abre la caja, imprime su etiqueta, pega el adhesivo y después
  escribe el tag NFC. Escanear QR o acercar NFC abre la misma caja.
- **Artículo:** al dar de alta una mercancía queda con un `RBI…` interno aunque
  no tenga código de fábrica. Imprime la etiqueta desde la caja; el escáner
  acepta QR y código de barras y encuentra la existencia.
- **Bolsa:** confirma la cantidad de bolsas del pedido, genera las bolsas y
  desde el pedido imprime una o todas. Cada bolsa conserva un QR propio, por lo
  que no se intercambian aunque pertenezcan a la misma clienta.

## Desde iPad/iPhone/Android

El diseño se crea en web y se usa igual desde Android. En móvil aparece una
vista previa a escala física:

- **Enviar a app de impresora:** comparte el PNG con NIIMBOT o Label Expert.
  Confirma ahí 50 × 50 mm para B1 o 4 × 6 in para E40.
- **Impresión Android:** úsala si ya agregaste la impresora Bluetooth/USB al
  sistema.

En Safari de iPhone/iPad no existe Web Bluetooth confiable para la B1. Compartir
el PNG evita una integración frágil y mantiene el diseño exacto.

## Reglas de seguridad y recuperación

- Sólo una plantilla predeterminada por tipo puede imprimir automáticamente.
- Un borrador nunca sale a producción: primero se publica.
- Si se archivó la plantilla activa y no hay reemplazo publicado, el sistema
  detiene la impresión y te pide elegir otra; nunca adivina.
- La bitácora muestra qué versión se solicitó para cada caja, artículo o bolsa.
- Si el equipo corta el borde o desplaza el diseño, calibra el rollo en la app
  del fabricante antes de modificar las medidas de la plantilla.
