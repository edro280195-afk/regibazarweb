# Prompt para mañana — Sprint de Mejoras Regibazar Web

Copia y pega esto como tu primer mensaje:

---

Hola, hoy vamos a implementar 6 mejoras en mi proyecto Angular de Regibazar Web (`c:\Codigos\regibazar-web`). El plan completo está en el archivo de implementation_plan de esta conversación, pero aquí te resume lo que necesito:

## Features a implementar (en este orden)

### 1. 🗑️ Quitar Loyalty / RegiPuntos
Eliminar todo el código muerto de Loyalty/RegiPuntos:
- Borrar interfaces `LoyaltyAccount` y `PointTransaction` de `models.ts`
- Borrar métodos mock `getLoyaltyAccount()` y `getPointTransactions()` de `api.service.ts`
- Limpiar imports y signals de loyalty en `client-profile.component.ts` (quitar sección de RegiPuntos del template y llamadas en `loadData()`)
- Limpiar bloque comentado de loyalty en `order-view.component.ts`

### 2. 🤖 Mejorar AI Assistant (Gegi Assistant)
El AI Assistant actualmente usa if/else con respuestas hardcodeadas. Mejorarlo para que use datos reales:
- Cargar `api.getOrders()` y `api.getClients()` al iniciar para tener contexto real
- Mejorar `generateResponse()` para responder con datos calculados reales:
  - "ventas hoy/semana/mes" → calcular sumas filtradas por fecha desde orders reales
  - "pedido de [nombre]" → buscar en orders reales y mostrar status, total, items
  - "mejor clienta" → encontrar clienta con más compras o mayor gasto total desde clients reales
  - "pedidos pendientes" → contar orders con status Pending/InRoute
  - "cuántos pedidos" → dar conteos por status
  - "buscar [término]" → buscar en orders y clients por nombre
- Agregar más comandos útiles: "resumen del día", "alertas" (pedidos pospuestos próximos), "envíos vs pickup"
- Mejorar las sugerencias rápidas con botones dinámicos según el contexto actual
- Conservar el estilo Coquette y la personalidad "Gegi" 💅

### 3. 🔍 Búsqueda Global
Crear un componente de búsqueda global en el header (top-bar):
- Nuevo componente standalone `global-search.component.ts` en `features/admin/components/layout/`
- Input con debounce (300ms), dropdown con resultados agrupados (Pedidos, Clientas)
- Busca en `api.getOrders()` por `clientName`/`id` y en `api.getClients()` por `name`/`phone`
- Click en resultado navega a `/admin/orders/:id` o `/admin/clients/:id`
- Escape cierra dropdown. Max 5 resultados por categoría
- Agregar el componente en el `top-bar` del `admin-layout.component.ts`
- Estilo Coquette: usar CSS variables existentes (`--pink-*`, `--bg-*`, `--shadow-*`, `--border-soft`)

### 4. 📅 Posponer desde Calendario
En `delivery-calendar.component.ts`:
- Agregar botón "📅 Posponer" en cada `order-item` del panel de detalles del día
- Mini-modal con date picker + input de motivo
- Al confirmar: llamar `api.updateOrderStatus(id, { status: 'Postponed', postponedAt, postponedNote })`
- Actualizar lista local y mostrar toast

### 5. 👤 Perfil de Clienta Mejorado
En `client-profile.component.ts`:
- Agregar KPIs: Total gastado, # Pedidos, Ticket promedio, Fecha última compra
- Agregar historial de pedidos: lista scrolleable con status, fecha, total, items — click navega a `/admin/orders/:id`
- Badge visual "🌱 Nueva" o "💎 Frecuente" según `clientType`
- Usar computed signals para calcular métricas desde las órdenes cargadas

### 6. 📱 PWA / Instalable
Hacer la app instalable:
- Ejecutar `ng add @angular/pwa` o crear manualmente `manifest.webmanifest` + `ngsw-config.json`
- Theme color: `#ec4899`, background: `#fff5f7`, nombre: "Regi Bazar"
- Agregar meta tags iOS en `index.html`

## Notas importantes
- La app es Angular 19 standalone con signals
- Tema "Coquette" — usa variables CSS de `styles.scss` (`--pink-600`, `--bg-card`, `--font-display`, etc.)
- Todas las interfaces están en `src/app/shared/models/models.ts`
- API service en `src/app/core/services/api.service.ts`
- Hacer `ng build --configuration=development` después de cada feature para verificar

¡Empecemos con la Feature 1!

---
