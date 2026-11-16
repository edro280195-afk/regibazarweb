# Plan: optimización de rutas por calles con OpenRouteService + VROOM

## Objetivo

Reducir vueltas entre colonias y el tiempo de manejo cuando se arma una ruta de hasta unas 40 entregas. La ruta debe iniciar en la base, terminar en la última entrega elegida por el motor y dejar a la administradora revisar o corregir el orden antes de guardarlo.

La prioridad es reducir primero el tiempo de manejo y mostrar la distancia como indicador adicional de gasolina. La meta no es prometer una ruta matemáticamente perfecta: es pasar de costos en línea recta a una optimización que considere la red de calles y comparar sus resultados contra lo que hoy usa Regi Bazar.

## Diagnóstico del código actual

- La vista previa web llama a `POST /api/routes/preview`.
- `RouteOptimizerService.OptimizeAsync` crea una matriz Haversine, inicia con vecino más cercano y aplica 2-opt. La distancia de una calle se aproxima como distancia recta y el tiempo usa una velocidad fija de 30 km/h.
- El algoritmo heredado `OptimizeRoute` conserva una búsqueda de vecino más cercano sin 2-opt.
- El optimizador actual fija la base al inicio y deja libre el final; no calcula regreso a la base.
- Los pedidos ya guardan una fecha de entrega y un horario en texto libre (`DeliveryTime`), por ejemplo “entre 5:30 y 6:30 pm; llamar al llegar”. Ese texto no es un intervalo horario que el motor pueda interpretar con seguridad.
- El mapa de armado de ruta usa Google Maps para presentar puntos y dibujar la ruta. El backend de optimización revisado no usa Google Routes; hoy devuelve `haversine+2opt`.
- La geocodificación sí sigue usando Google en el servicio aparte. Cambiar el optimizador no quitaría por sí solo el uso de Google Maps, Places o Geocoding.
- El código Android queda fuera de esta fase.

## Candidato

Probar el endpoint de optimización alojado de OpenRouteService, que utiliza VROOM para ordenar entregas con costos de viaje por la red de calles de OpenStreetMap.

- Una sola camioneta, base fija como `start` y sin `end` para conservar el recorrido abierto.
- El costo principal será el tiempo estimado de manejo; se mostrará también la distancia total para ayudar a vigilar gasolina.
- Cada parada se enviaría como trabajo con un ID técnico; nombres, teléfonos, saldos e importes no hacen falta para calcular la ruta.
- Los horarios actuales son preferencias ajustables. En esta versión no se convertirán automáticamente de texto libre a restricciones duras de VROOM; se conservarán visibles como contexto para que la persona que arma la ruta decida si mueve una parada. Una futura optimización por ventanas horarias requiere capturar inicio y fin como datos estructurados.
- La respuesta se traduciría a los IDs y al DTO que ya entiende la API, incluyendo distancia, duración y geometría cuando esté disponible.
- La llamada saldría exclusivamente del backend de Render, usando una clave personal de ORS guardada como secreto del servicio. Nunca desde Angular ni desde Android.
- Se conserva el motor local actual como respaldo cuando ORS falle, exceda cuota o no pueda calcular una parada. La vista debe identificar claramente ese resultado como aproximado.
- La interfaz compara el resultado y permite revisar/mover paradas antes de guardarlo; la vista previa no modifica rutas ni cambia entregas ya completadas.

## Coste, cobertura y privacidad

- El plan Standard de ORS figura en 0 € y publica 500 optimizaciones al día y 40 por minuto. ORS confirma que permite uso comercial dentro del plan. El máximo público publicado es de 3 vehículos, suficiente para el modelo actual de un conductor.
- ORS necesita una clave propia y exige atribución. Sus términos atribuyen los resultados a CC-BY 4.0 y piden mostrar `© openrouteservice.org by HeiGIT | Map data © OpenStreetMap contributors`.
- La geometría se basa en OpenStreetMap. No incluye el tráfico en vivo de Google y la precisión depende de que la red de calles de Nuevo Laredo esté bien representada. Se validará en rutas reales antes de confiarle el orden sin revisión.
- Las coordenadas residenciales pueden identificar domicilios. No se enviarán a un proveedor durante esta etapa sin autorización explícita. La primera maqueta usa información ficticia y no llama a ninguna API.
- No se usará el servidor público de demostración de VROOM: su política prohíbe expresamente el uso comercial.
- El cambio de proveedor del optimizador no elimina las solicitudes de Google Maps, Places o Geocoding que existen en otras pantallas. La migración completa fuera de Google sería una fase distinta.

## Etapas

1. **Plan (completado):** dejar documentado el flujo actual, el candidato, límites, privacidad y cómo aceptar o descartar la alternativa.
2. **Mockup (entregado para revisión):** mostrar el orden propuesto en mapa y lista, el tiempo primero y la distancia junto a él, horarios como preferencias editables, advertencias de paradas sin coordenadas y el origen del cálculo. El layout prioriza móvil y escala a escritorio. Toda métrica ilustrativa está marcada como ficticia.
3. **Integración web:** agregar un switch persistente para alternar ORS y el motor Haversine que usa hoy el sistema. ORS se usa solo cuando el switch está encendido y la clave está configurada; si falla, se conserva el cálculo local y se avisa. El orden confirmado en la vista previa también se conserva al crear o recomponer una ruta. Google Maps sigue como mapa y la geocodificación Google queda intacta; no hay un proveedor Google Routes implementado en el código actual.
4. **Validación controlada:** primero usar ubicaciones sintéticas. Después, si se autoriza expresamente, comparar contra rutas históricas seleccionadas sin nombres ni datos financieros. Revisar visualmente el orden y contrastar distancia/tiempo estimados con recorridos observados. No activar una sustitución automática hasta que el resultado local sea convincente.
5. **Android:** pendiente, como se acordó; no se toca en esta fase.

## Criterios para considerar viable la integración

- La ruta comienza exactamente en la base configurada y termina en una parada, sin regreso salvo que la operación lo pida.
- Con 40 paradas geocodificadas, la API responde con un orden completo y sin repetir ni perder IDs.
- Las paradas sin coordenadas quedan señaladas y no se confunden con una ruta calculada por calles.
- Si ORS no responde, la vista previa informa que usó el respaldo aproximado; nunca presenta esa respuesta como optimización por calles.
- El proceso de vista previa no guarda la ruta ni altera entregas completadas.
- El operador ve proveedor, tiempo y distancia estimados, y puede revisar el orden antes de confirmar.
- La comparación con datos reales se hace solo después de autorizar el envío de coordenadas de domicilios al proveedor.

## Dependencias y asuntos abiertos

- No hay `ORS_API_KEY` configurada en el entorno local. Antes de integrar el llamado real se necesitará una clave Standard creada por el titular y cargada en Render como secreto.
- La URL vigente de optimización es `https://api.heigit.org/vroom/v0`; la clave se lee en el API desde `OpenRouteService:ApiKey` (`OpenRouteService__ApiKey` en Render).
- Para v1, un horario pedido es una preferencia ajustable; la hora está guardada como texto libre, así que no debe tratarse como una cita exacta por el algoritmo.
- La comparación prioriza tiempo y presenta distancia al lado.
- Decidir si la segunda fase para eliminar por completo Google incluye mapa, autocompletado de direcciones y geocodificación; no está incluida en este plan del motor de rutas.

## Referencias oficiales

- [Servicio de optimización de ORS](https://openrouteservice.org/dev/)
- [Planes y cuotas de ORS](https://staging.openrouteservice.org/plans/)
- [Restricciones de la API ORS](https://openrouteservice.org/restrictions/)
- [Confirmación de uso comercial del plan Standard](https://ask.openrouteservice.org/t/free-plan-in-an-app-with-a-paid-tier-license-cc-by-sa-4-0-personal-data-and-attribution-questions/8079)
- [Términos, atribución y licencia de resultados ORS](https://staging.openrouteservice.org/terms-of-service/)
- [VROOM: inicio fijo y fin abierto](https://github.com/VROOM-Project/vroom/blob/master/docs/API.md)
- [Política del servidor demo de VROOM](https://github.com/VROOM-Project/vroom/wiki/Demo-server)
