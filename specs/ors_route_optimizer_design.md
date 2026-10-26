# Integración: selector de motor de rutas ORS

## Requisitos

- Mientras se arma una ruta, la operadora puede activar OpenRouteService/VROOM o regresar al optimizador local actual.
- Al cambiar el selector, la vista previa recalcula el orden y muestra el motor que realmente respondió.
- Si ORS no tiene clave, falla, excede la cuota o deja paradas sin asignar, el API usa el optimizador local y lo informa; nunca se pierde una entrega por una respuesta parcial.
- La ruta guardada conserva el orden confirmado en la vista previa.
- Google Maps continúa mostrando el mapa y la geocodificación existente no cambia. El código actual no tiene un optimizador Google Routes funcional: el orden se calcula localmente.
- Android queda pendiente.

## Frontend

- Añadir a `RouteBuilderComponent` un switch accesible y táctil para “Optimización por calles (ORS)” frente a “Motor local de respaldo”.
- El estado inicial solicita ORS; el servidor decide si está disponible y responde con la fuente real.
- El switch solo recalcula la vista previa. Las métricas, avisos y atribución dependen del proveedor realmente usado.
- Mostrar que Google Maps sigue dibujando el mapa y que el switch solo cambia el orden de visita.
- Enviar un booleano `useRoadOptimizer` en `POST /api/routes/preview`; no enviar nombres, teléfonos, saldos ni direcciones al proveedor ORS.

## API

- Mantener el algoritmo local en `RouteOptimizerService` como modo apagado y fallback.
- Extender `PreviewRouteRequest` para aceptar `UseRoadOptimizer` opcional.
- Cuando se solicita ORS, enviar al endpoint oficial `https://api.heigit.org/vroom/v0` únicamente las coordenadas con ID técnico y el origen fijo; se omite `end` para conservar el final abierto.
- Solicitar geometría, tiempo y distancia. Verificar que cada trabajo con coordenadas aparezca exactamente una vez y que ninguno quede sin asignar.
- Al no haber configuración, ante error HTTP/JSON, cuota agotada o solución incompleta, regresar el orden local con fuente `haversine-fallback` y mensaje visible.
- Guardar el secreto como `OpenRouteService__ApiKey` en el entorno del API. La clave no llega al navegador.
- No alterar la optimización automática de C.A.M.I. ni otros caminos en esta primera integración.

## Seguridad y privacidad

- El controlador de rutas ya requiere JWT; se conserva esa autorización.
- Validar límites y coordenadas antes de una llamada externa.
- El servicio procesa solo paradas elegidas por la operadora y transmite únicamente coordenadas.
- Los logs no registran coordenadas, direcciones, datos de clientas ni API keys.
- Timeout corto y fallback local sin guardar cambios.

## Criterios de aceptación

- Switch encendido usa ORS cuando existe clave y el proveedor entrega todas las paradas.
- Switch apagado no invoca ORS y usa `haversine+2opt`.
- Una falla de ORS devuelve una vista previa utilizable, señala el fallback y conserva las paradas.
- Se mantiene el mapa de Google, la edición manual y la confirmación existente.
- El guardado conserva el orden revisado; no vuelve a calcularlo.
- No se modifican Android ni Google Maps/Geocoding.

## Configuración para despliegue

- Variable de entorno Render: `OpenRouteService__ApiKey`.
- Endpoint de optimización ORS: `POST https://api.heigit.org/vroom/v0`.
- El repositorio no contiene una clave de ORS y la integración no hará llamadas reales hasta configurar el secreto.
