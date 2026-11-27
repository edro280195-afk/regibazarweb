# Regi Bazar — Contexto del Proyecto

## Qué es
Sistema de gestión de entregas para un negocio de ventas en vivo por Facebook. Los pedidos se capturan durante transmisiones en vivo ("Live Mode"), se gestionan en un tablero Kanban, y se entregan por un solo conductor con seguimiento en tiempo real.

## Arquitectura
```
C:\Codigos\RegiBazar\
├── frontend/        → Angular 18 (standalone components)
├── backend/         → .NET Core API (C#), desplegado en Render
├── android/         → App Android de seguimiento para el conductor
└── docs/
```

## Stack específico
- **Frontend:** Angular 18, Angular CDK drag-drop, SignalR client
- **Backend:** .NET Core, Entity Framework Core, PostgreSQL, SignalR Hub
- **Android:** Foreground Service para GPS, SignalR Java client
- **Deploy:** Render (backend), Vercel o Firebase Hosting (frontend)
- **Auth:** JWT con refresh tokens

## Base de datos
- PostgreSQL en producción (Render)
- Todas las fechas en **UTC** — nunca guardes DateTime sin zona
- Entidad principal: `Order` con estados: `Pending → InRoute → Delivered / Cancelled`

## Convenciones específicas
- Los DTOs siempre terminan en `Dto` (ej. `OrderDto`, `CreateOrderDto`)
- Los servicios Angular terminan en `Service` y son `providedIn: 'root'`
- Los componentes que son "páginas" van en `/pages/`, los reutilizables en `/components/`
- El Hub de SignalR se llama `TrackingHub`
- El conductor siempre tiene ID fijo (sistema de un solo conductor)

## Diseño UI — Tema "Coquette / Girly"
- Colores principales: rosas suaves, lavanda, blanco hueso
- Tipografía: Poppins o similar, peso ligero
- Estilo: glassmorphism con tarjetas translúcidas
- Los íconos son de Lucide o Material Icons
- **Nunca uses colores corporativos azul/verde acá** — ese es el tema de PMM

## Módulos principales
- **Live Mode:** Captura de pedidos por voz durante transmisiones en vivo
- **Kanban:** Gestión visual de órdenes con drag-drop
- **RouteView (conductor):** Vista del conductor con mapa y lista de entregas
- **RouteManager (admin):** Vista de administrador para asignar y monitorear rutas
- **OrderView (cliente):** Link público para que el cliente rastree su pedido
- **C.A.M.I.:** Agente IA con Gemini 2.5 Flash para asistencia contextual

## Problemas conocidos / Decisiones tomadas
- El geocoding usa Google Maps API — el depot está configurado en Nuevo Laredo, NL (no Monterrey)
- Los enums en C# y TypeScript deben estar sincronizados manualmente
- El interceptor HTTP de Angular tiene lógica especial para rutas públicas (no inyecta JWT en `/order-view`)
- Las propiedades calculadas en entidades EF deben marcarse con `[NotMapped]`

## Comandos útiles
```bash
# Backend
dotnet run --project backend/RegiBazar.API

# Frontend
cd frontend && ng serve

# Android
# Abrir en Android Studio → Run
```

## ⚠️ Desarrollo local y seguridad (leer antes de correr algo)
- **`ng serve` apunta a la API de PRODUCCIÓN.** `src/environments/environment.ts` (el de desarrollo) usa
  `https://regibazarapi.onrender.com`; solo `ng build` (configuración `production` por defecto) usa
  `environment.prod.ts`. Todo lo que captures/borres con `ng serve` pasa en datos reales. Para trabajar contra un
  backend local, cambia `apiUrl`/`hubUrl` en `environment.ts` a `https://localhost:56164/...` (hay líneas comentadas).
- **El backend ya no trae la cadena de conexión de producción.** `appsettings.json` lleva un marcador de Postgres
  local (`regibazar_dev`). Para otra base, usa `dotnet user-secrets set "ConnectionStrings:Default" "<cadena>"`
  (el proyecto ya tiene `UserSecretsId`) o la variable de entorno `ConnectionStrings__Default`. Producción (Render)
  usa su propia variable `ConnectionStrings__Default`. **Nunca vuelvas a commitear cadenas, llaves ni contraseñas:**
  los repos son públicos. La contraseña de Neon que estuvo en el historial debe rotarse.
- **Crear usuarios:** `POST /api/auth/register` solo funciona con un token de Admin (o para el primer usuario de una
  base vacía). Los roles `Driver`/`Scaner`/`Bodega` se asignan en la columna `Users.Rol` directamente en la base.
- **Migraciones:** la migración `20260503000000_BaselineUntrackedSchema` crea lo que entró al modelo sin migración
  (tablas Tanda y dos columnas). En producción no hace nada; en una base nueva permite construir el esquema completo.
  Siempre pasa `--connection` explícito a `dotnet ef database update` para no migrar la base equivocada.
- **Los permisos por rol casi solo se aplican en el frontend** (guard de rutas). En el API únicamente Inventario y
  Etiquetas exigen rol (política `InventoryAccess`: Admin y Bodega); el resto de los controladores solo pide un token
  válido, así que un usuario `Driver` con su token puede llamar a endpoints de administración.
