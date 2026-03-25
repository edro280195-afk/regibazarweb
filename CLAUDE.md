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
