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
- **Bolsa:** al confirmar la cantidad de bolsas del pedido (en el alta, en la
  tarjeta del Kanban o antes de mandarlo a ruta) se crean las bolsas con su QR;
  desde el pedido, en **Logística y Etiquetas**, imprime una o todas. Cada bolsa
  conserva un QR propio, por lo que no se intercambian aunque pertenezcan a la
  misma clienta. Las bolsas con QR son la fuente de verdad: el número del pedido
  siempre coincide con ellas y nunca se borran solas.

## Impresión directa desde Android

En **Administración → Etiquetas**, busca y selecciona una impresora compatible.
La app recuerda esa selección en el teléfono. Al imprimir, usa la conexión BLE
directa si el equipo seleccionado corresponde al formato de la plantilla:

- **NIIMBOT B1:** etiquetas de 50 × 50 mm, enviadas mediante el protocolo B1.
  El diseño se adapta al cabezal útil de 384 puntos (48 mm a 203 DPI).
- **AIYIN E40 Pro:** etiquetas de 4 × 6 in, enviadas como bitmap TSPL comprimido
  por el servicio BLE FFF0 y la característica FFF2.

La primera conexión pide permisos Bluetooth. Si una etiqueta usa otro formato
que el equipo seleccionado, Android abre el flujo de impresión del sistema en
lugar de enviar un trabajo incompatible. Generar bolsas desde el pedido sólo
las imprime automáticamente cuando está seleccionada una E40 para ese formato.

El evento de bitácora confirma que la app completó el envío del trabajo; no
confirma que el papel haya salido físicamente. En iPhone/iPad se conserva la
vista previa y el flujo de compartir PNG con la app del fabricante.

## Reglas de seguridad y recuperación

- Sólo una plantilla predeterminada por tipo puede imprimir automáticamente.
- Un borrador nunca sale a producción: primero se publica.
- Si se archivó la plantilla activa y no hay reemplazo publicado, el sistema
  detiene la impresión y te pide elegir otra; nunca adivina.
- La bitácora muestra qué versión se solicitó para cada caja, artículo o bolsa.
- Si el equipo corta el borde o desplaza el diseño, calibra el rollo en la app
  del fabricante antes de modificar las medidas de la plantilla.

## Hallazgos de ingeniería inversa

REA inspeccionó Label Expert 2.1.2 (`in.kahub.labelexpert`, base APK SHA-256 `f329d7923fbe9e7b3daab259f266f59701734607a47c820e7729fba4e4ff4b0d`). Sus recursos describen cabezales de 203/300 DPI, ESC/TSPL/CPCL y los modos de imagen original, blanco y negro y tramado. La pantalla confirma accesos a crear etiquetas, importar Excel, imprimir PDF/imagen y escanear QR. No se configuró una impresora ni se imprimió desde esa app.

La app oficial NIIMBOT inspeccionada fue la versión 6.6.9 (`com.gengcon.android.jccloudprinter`, base APK SHA-256 `4eb83cafcea38c3f2731e0d7098bfd00715957b7da668d34a2dc76c937903a8a`). La app usa Flutter; su `libapp.so` está empaquetado como Dart AOT y no se recuperó su lógica de impresión. El protocolo B1 se implementó a partir del cliente abierto `@slastra/nblib` 0.3.0 (MIT), cuyo autor registra impresión física validada en B1. Para E40, el repo Nenis Flutter aporta el builder TSPL modo 3 y el transporte BLE FFF0/FFF2.

La impresión directa en Regi reutiliza esos protocolos, sin copiar código ni recursos de las apps de fabricante. Compatibilidad de artefactos y evidencia REA, con límites, está en `C:\Users\eduardo.rdz\.codex\skills\rea-evidence-memory\references\niimbot-2026-10-17.md` y el expediente de Label Expert del mismo directorio.
