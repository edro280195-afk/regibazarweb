# Operación diaria de Mi Bodega

## Identificación de cajas

Cada caja tiene un código visible, por ejemplo `B-01`, y dos formas de abrirla:

- **NFC:** la etiqueta NTAG215 guarda la URL segura de la caja.
- **QR imprimible:** se genera desde Inventario > caja > **Ver QR imprimible**. Es un respaldo si un teléfono no puede leer NFC o la etiqueta se daña.

El NFC y el QR sólo contienen un identificador; las existencias siguen protegidas por el inicio de sesión.

## Registrar mercancía

1. Abre o escanea la caja destino.
2. Pulsa **Agregar artículo**.
3. Escribe el nombre o escanea el código del artículo desde el botón de cámara.
4. Indica variante, cantidad y una nota si aplica.

La cámara Android acepta QR y códigos lineales de artículo. Si escanea el QR de una caja, abre esa caja; si escanea un código de barras, busca en qué cajas existe ese artículo.

## Conteo físico

1. Abre una caja y pulsa **Conteo físico**.
2. Captura la cantidad que realmente está en cada renglón, incluso si es cero.
3. Guarda el conteo.

El sistema conserva la sesión y sólo registra movimientos para las diferencias. Nunca borra el historial anterior.

## Acceso Bodega

El rol `Bodega` puede entrar exclusivamente a Inventario. El backend también aplica esa restricción, por lo que no basta con ocultar menús en la web.

## Regla de operación

Las transferencias siempre se registran desde una caja hacia otra; no se ajustan dos cajas manualmente para representar el mismo movimiento. Así la bitácora sigue cuadrando.
