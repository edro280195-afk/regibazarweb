# Arquitectura e Inventario — Regi Bazar

> Documento generado por análisis estático del código. **No se modificó código alguno.**
> Fecha del análisis: 2026-06-23

## Resumen ejecutivo

Regi Bazar es un sistema **single-tenant** (un solo negocio, un solo conductor) compuesto por dos repositorios:

| Capa | Ruta | Stack | Tamaño aprox. |
|---|---|---|---|
| **Backend / API** | `C:\Codigos\api\EntregasApi` | .NET 8, EF Core 8, PostgreSQL (Neon), SignalR | 20 controllers · 34 DbSets · ~37 servicios · 75 migraciones |
| **Frontend / Web** | `C:\Codigos\regibazar-web` | Angular **21.2.1** (standalone + SSR + PWA), Capacitor 8 (Android) | 34 componentes · 11 servicios |

> ⚠️ **Nota de desincronización con CLAUDE.md:** el `CLAUDE.md` describe Angular 18 y backend desplegado en Render con PostgreSQL en Render. El código real usa **Angular 21.2.1** y el connection string apunta a **Neon** (`*.neon.tech`). El frontend también incluye **SSR (Angular Universal/Express)** y **Capacitor** para empaquetar la app Android, cosa no mencionada en el contexto del proyecto.

---

## 1) Modelo de datos

### 1.1 Hallazgo central sobre "negocio / owner"

**Ninguna entidad del modelo tiene una referencia (FK, campo ni claim) a un negocio, owner o tenant.** Una búsqueda de `BusinessId`, `OwnerId`, `TenantId`, `StoreId`, `MerchantId`, `AccountId`, `OrganizationId`, `CompanyId` en todo el backend devuelve **cero coincidencias** en modelos, DTOs y servicios (solo aparece la palabra "Business" dentro de un prompt de Gemini y en comentarios de "business rules").

El sistema asume implícitamente que **toda la base de datos pertenece a un único negocio** (Regi Bazar). El "ancla" más cercana a una identidad es:

- La tabla `Users` (admins/conductores), pero **no agrupa datos por negocio** — solo autentica.
- Campos de texto sueltos como `OrderPayment.RegisteredBy` ("Admin"/"Driver"), `ChatMessage.Sender`, que son etiquetas de rol, no FKs.

> 🔑 **Implicación para multi-tenancy:** si en el futuro se quiere soportar varios negocios, habría que agregar un `BusinessId` (o equivalente) a las **raíces de agregado** marcadas abajo con 🟢, y propagarlo por las entidades hijas vía sus FKs existentes.

### 1.2 Leyenda

- **PK**: clave primaria · **FK→**: claves foráneas salientes
- **Ancla negocio**: `❌ Ninguna` en todas (no existe hoy). 🟢 = raíz de agregado candidata a recibir un `BusinessId` en una futura migración multi-tenant; 🔗 = ya cuelga de una raíz por FK, heredaría el tenant transitivamente.

### 1.3 Identidad / Usuarios

| Entidad (tabla) | PK | FK→ | Campos clave | Ancla negocio |
|---|---|---|---|---|
| **User** (`Users`) | `int Id` | — | `Email` (unique), `PasswordHash` (BCrypt), `Role` (col. `Rol`, default "Admin") | ❌ Ninguna · 🟢 raíz |

### 1.4 Clientas (identidad multi-señal)

| Entidad (tabla) | PK | FK→ | Campos clave | Ancla negocio |
|---|---|---|---|---|
| **Client** (`Clients`) | `int Id` | — | `Name` (unique), `Phone`, `FacebookProfileUrl`, `Address`, `Lat/Lng`, `Type` (Nueva/…), `Tag` (enum), `CurrentPoints`, `LifetimePoints`, `Normalized{Name,Phone,Address}` | ❌ Ninguna · 🟢 raíz |
| **ClientAlias** (`ClientAliases`) | `int Id` | `ClientId`→Client (cascade) | `Alias`, `NormalizedAlias` (unique), `Source` (enum: Manual/Merge/Import/LiveOcr/LiveAudio), `TimesSeen` | ❌ · 🔗 vía Client |
| **ClientMergeAudit** | `int Id` | (lógicas: Source/TargetClientId) | `Mode` (Manual/Auto), `Reason`, `Confidence`, `OrdersMoved`, `AliasesMoved` — auditoría de fusiones de clientas duplicadas | ❌ · 🔗 vía Client |

### 1.5 Pedidos

| Entidad (tabla) | PK | FK→ | Campos clave | Ancla negocio |
|---|---|---|---|---|
| **Order** (`Orders`) | `int Id` | `ClientId`→Client · `DeliveryRouteId`→DeliveryRoute (null) · `SalesPeriodId`→SalesPeriod (null, SetNull) | `Subtotal/ShippingCost/Total/DiscountAmount`, `AccessToken` (unique), `ExpiresAt`, `Status` (enum 0-7), `OrderType` (Delivery/PickUp/POS_Tienda), `Tags`, paquetería (`TotalPackages`, `IsFullyPacked/Loaded`). `AdvancePayment`/`PaymentMethod` están **[Obsolete]** (migrados a OrderPayment). Calculados `[NotMapped]`: `AmountPaid`, `BalanceDue` | ❌ · 🔗 vía Client |
| **OrderItem** (`OrderItems`) | `int Id` | `OrderId`→Order · `ProductId`→Product (null) | `ProductName`, `Quantity`, `UnitPrice`, `LineTotal` | ❌ · 🔗 vía Order |
| **OrderPayment** (`OrderPayments`) | `int Id` | `OrderId`→Order (cascade) · `CashRegisterSessionId`→CashRegisterSession (null, Restrict) | `Amount`, `Method` (Efectivo/Transferencia/…), `RegisteredBy` (Admin/Driver), `Date` | ❌ · 🔗 vía Order |
| **OrderPackage** (`OrderPackages`) | `Guid Id` | `OrderId`→Order (cascade) | `PackageNumber`, `QrCodeValue` (unique), `Status` (Packed/Loaded/Delivered/Returned), timestamps de tracking | ❌ · 🔗 vía Order |

### 1.6 Entregas, rutas y conductor

| Entidad (tabla) | PK | FK→ | Campos clave | Ancla negocio |
|---|---|---|---|---|
| **DeliveryRoute** (`DeliveryRoutes`) | `int Id` | — | `Name`, `ScheduledDate`, `DriverToken` (unique), `Status` (Pending/Active/Completed/Canceled), `CurrentLat/Lng` + `LastLocationUpdate` (GPS en vivo) | ❌ · 🟢 raíz |
| **Delivery** (`Deliveries`) | `int Id` | `OrderId`→Order (null, 1:1) · `TandaParticipantId`→TandaParticipant (null, Restrict) · `DeliveryRouteId`→DeliveryRoute | `Kind` (Order/Tanda), `SortOrder`, `Status`, `SignatureSvg`/`SignedByName`/`SignedAt`, `ArrivedAt`. **CHECK XOR**: exactamente uno de `OrderId`/`TandaParticipantId` | ❌ · 🔗 vía Route |
| **DeliveryEvidence** (`DeliveryEvidences`) | `int Id` | `DeliveryId`→Delivery (cascade) | `ImagePath` (URL Cloudinary), `Type` (DeliveryProof/NonDeliveryProof) | ❌ · 🔗 vía Delivery |
| **DriverExpense** (`DriverExpenses`) | `int Id` | `DeliveryRouteId`→DeliveryRoute (cascade) | `Amount`, `ExpenseType` (Gasolina/…), `EvidencePath` (URL Cloudinary) | ❌ · 🔗 vía Route |
| **ChatMessage** (`ChatMessages`) | `int Id` | `DeliveryRouteId`→DeliveryRoute (null, SetNull) · `DeliveryId`→Delivery (null, cascade) | `Sender` (Admin/Driver/Client), `Text`, `Timestamp` | ❌ · 🔗 vía Route |

### 1.7 Catálogo y punto de venta (POS)

| Entidad (tabla) | PK | FK→ | Campos clave | Ancla negocio |
|---|---|---|---|---|
| **Product** (`Products`) | `int Id` | — | `SKU` (unique, = código QR), `Name`, `Price`, `Stock`, `IsActive` | ❌ · 🟢 raíz |
| **CashRegisterSession** (`CashRegisterSessions`) | `int Id` | `UserId`→User | `OpeningTime/ClosingTime`, `InitialCash`, `FinalCashExpected/Actual`, `Status` (Open/Closed). Caja del POS | ❌ · 🟢 raíz (por usuario) |

### 1.8 Proveedores, finanzas y configuración

| Entidad (tabla) | PK | FK→ | Campos clave | Ancla negocio |
|---|---|---|---|---|
| **Supplier** (`Suppliers`) | `int Id` | — | `Name`, `ContactName`, `Currency` (MXN/USD), `ExchangeRate` | ❌ · 🟢 raíz |
| **Investment** (`Investments`) | `int Id` | `SupplierId`→Supplier (cascade) · `SalesPeriodId`→SalesPeriod (null, SetNull) | `Amount`, `Date`, `Currency`, `ExchangeRate` (decimal 18,4) | ❌ · 🔗 vía Supplier |
| **SalesPeriod** (`SalesPeriods`) | `int Id` | — | `Name`, `StartDate/EndDate`, `IsActive` (indexado). Agrupa Orders + Investments por temporada | ❌ · 🟢 raíz |
| **AppSettings** (`AppSettings`) | `int Id`=1 | — | `DefaultShippingCost` (60), `LinkExpirationHours` (72). **Fila única sembrada** (Id=1) | ❌ · 🟢 config global (de hecho ES el "registro del negocio" más cercano) |

### 1.9 Tandas (ahorro/colecta por turnos) — *nomenclatura snake_case*

| Entidad (tabla) | PK | FK→ | Campos clave | Ancla negocio |
|---|---|---|---|---|
| **TandaProduct** (`products`) | `Guid Id` | — | `Name`, `BasePrice`, `IsActive` | ❌ · 🟢 raíz |
| **Tanda** (`tandas`) | `Guid Id` | `ProductId`→TandaProduct | `Name`, `TotalWeeks`, `WeeklyAmount`, `PenaltyAmount`, `StartDate`, `Status` (Draft/Active/…), `AccessToken` (link público) | ❌ · 🟢 raíz |
| **TandaParticipant** (`tanda_participants`) | `Guid Id` | `CustomerId`→Client · `TandaId`→Tanda | `AssignedTurn` (unique por tanda), `IsDelivered`, `Status` (Active/Delinquent/Completed), `Variant`, `WeeklyAmount` | ❌ · 🔗 vía Tanda |
| **TandaPayment** (`payments`) | `Guid Id` | `ParticipantId`→TandaParticipant | `WeekNumber`, `AmountPaid`, `PenaltyPaid`, `IsVerified` | ❌ · 🔗 vía Tanda |

### 1.10 Lealtad (RegiPuntos)

| Entidad (tabla) | PK | FK→ | Campos clave | Ancla negocio |
|---|---|---|---|---|
| **LoyaltyTransaction** (`LoyaltyTransactions`) | `int Id` | `ClientId`→Client (cascade) | `Points` (+gana/−gasta), `Reason`, `Date` | ❌ · 🔗 vía Client |
| **LoyaltyReward** (`LoyaltyRewards`) | `int Id` | — | `Name`, `PointsCost`, `Type` (FixedDiscount/FreeShipping/Gift), `Value`, `Icon`, `SortOrder`. **Catálogo sembrado al arranque** | ❌ · 🟢 catálogo global |

### 1.11 Sorteos (Raffles) — *snake_case*

| Entidad (tabla) | PK | FK→ | Campos clave | Ancla negocio |
|---|---|---|---|---|
| **Raffle** (`raffles`) | `Guid Id` | `PrizeProductId`→TandaProduct (null) · `TandaId`→Tanda (null) · `WinnerId`→Client (null, SetNull) | ~50 campos: reglas de elegibilidad, segmentación de clientas, premio, plantillas sociales, `Status`, `AutoDraw`, `NotificationChannel` (push/whatsapp/both) | ❌ · 🟢 raíz |
| **RaffleParticipant** (`raffle_participants`) | `Guid Id` | `RaffleId`→Raffle (cascade) · `ClientId`→Client (cascade) | unique (Raffle,Client), `QualifyingOrders`, `EntryCount`, `IsWinner`, turnos de tanda | ❌ · 🔗 vía Raffle |
| **RaffleEntry** (`raffle_entries`) | `Guid Id` | `RaffleId`→Raffle · `ClientId`→Client · `OrderId`→Order (todas cascade) | `EnteredAt` — un boleto por pedido calificado | ❌ · 🔗 vía Raffle |
| **RaffleDraw** (`raffle_draws`) | `Guid Id` | `RaffleId`→Raffle (cascade) · `WinnerId`→Client (cascade) | `DrawDate`, `SelectionMethod` (random/manual/tandaShuffle), notas | ❌ · 🔗 vía Raffle |

### 1.12 Live Capture (pipeline de IA de transmisiones en vivo)

| Entidad (tabla) | PK | FK→ | Campos clave | Ancla negocio |
|---|---|---|---|---|
| **LiveSession** (`LiveSessions`) | `int Id` | — | `FacebookUrl`, `Title`, `R2Key` (⚠️ ver §7), `Status` (Queued→…→Ready/Failed), `StatusDetail`, `LocalAudioPath`, `Transcript` | ❌ · 🟢 raíz |
| **LiveProduct** (`LiveProducts`) | `int Id` | `LiveSessionId`→LiveSession | `Keyword`, `Description`, `Price`, `AnnouncedAtSeconds` (detectado por Gemini) | ❌ · 🔗 vía LiveSession |
| **LiveSpokenOrder** (`LiveSpokenOrders`) | `int Id` | `LiveSessionId`→LiveSession | `Keyword`, `ClientNameSpoken`, `SpokenAtSeconds` — asignaciones dictadas en voz alta | ❌ · 🔗 vía LiveSession |
| **LiveCommentOrder** (`LiveCommentOrders`) | `int Id` | `LiveSessionId`→LiveSession | `Keyword`, `CommentDisplayName`, `OcrConfidence` — pedidos por comentario (vía OCR, ver nota) | ❌ · 🔗 vía LiveSession |
| **LiveCandidate** (`LiveCandidates`) | `int Id` | `LiveSessionId`→LiveSession (cascade) · `LiveProductId`→LiveProduct (null, SetNull) · `ResolvedClientId`→Client · `CreatedOrderId` | `Source` (Spoken/Comment/Both), `Status` (Pending/Confirmed/Ignored), `ProposedAliasPairJson` | ❌ · 🔗 vía LiveSession |

### 1.13 Notificaciones (tokens de dispositivo)

| Entidad (tabla) | PK | FK→ | Campos clave | Ancla negocio |
|---|---|---|---|---|
| **FcmToken** (`FcmTokens`) | `int Id` | — | `Token` (unique), `Role` (default "driver"), `DriverRouteToken`. Push nativo Android (FCM) | ❌ · 🟢 raíz |
| **PushSubscriptionModel** (`PushSubscriptions`) | `int Id` | — | `Endpoint` (unique), `P256dh`, `Auth`, `Role` (client/driver/admin), `ClientId`, `DriverRouteToken`. Web Push (VAPID) | ❌ · 🟢 raíz |

### 1.14 Diagrama de relaciones (texto)

```
User ──< CashRegisterSession ──< OrderPayment >── Order
                                                   │
SalesPeriod ──< Order ──< OrderItem >── Product    │
     └──────< Investment >── Supplier              │
                                                   ├──< OrderPackage
Client ──< Order ────────────────────────┐        ├──1:1 Delivery ──< DeliveryEvidence
  ├──< ClientAlias                        │        │         │
  ├──< LoyaltyTransaction                 │   DeliveryRoute ──┤──< ChatMessage
  ├──< RaffleParticipant/Entry            │         └──< DriverExpense
  └──< (Tanda)TandaParticipant ──< TandaPayment ──┐
                                                   │ (Delivery XOR: Order | TandaParticipant)
TandaProduct ──< Tanda ──< TandaParticipant       │
Raffle ──< RaffleParticipant / RaffleEntry / RaffleDraw   (Raffle → Client/Tanda/TandaProduct)
LiveSession ──< LiveProduct / LiveSpokenOrder / LiveCommentOrder / LiveCandidate ──> Client
AppSettings (singleton)   ·   LoyaltyReward (catálogo)   ·   FcmToken / PushSubscription (independientes)
```

---

## 2) Autenticación e identidad

### 2.1 Cómo funciona la identidad hoy

- **Esquema:** JWT Bearer (HMAC-SHA256). Configurado en [Program.cs](../api/EntregasApi/Program.cs#L76) con `Jwt:Issuer` = `EntregasApi`, `Jwt:Audience` = `EntregasApp`, `Jwt:Key` (secreto).
- **Emisión:** [`TokenService.GenerateJwt`](../api/EntregasApi/Services/TokenService.cs#L24) — vigencia **7 días**, sin refresh token real (a pesar de que CLAUDE.md menciona "JWT con refresh tokens", **no existe endpoint ni lógica de refresh** en el código).
- **Claims dentro del JWT:** solo `NameIdentifier` (userId), `Email`, `Name`. **El rol NO viaja como claim** — se devuelve aparte en el `LoginResponse` y el frontend lo guarda en `localStorage`.
- **Login/Registro:** [`AuthController`](../api/EntregasApi/Controllers/AuthController.cs) — `POST /api/auth/login` y `POST /api/auth/register`. Password con **BCrypt** (`BCrypt.Net-Next`).
- **Frontend:** [`AuthService`](src/app/core/services/auth.service.ts) guarda en `localStorage` (`rb_token`, `rb_name`, `rb_role`, `rb_expires`); [`authInterceptor`](src/app/core/interceptors/auth.interceptor.ts) inyecta `Authorization: Bearer` en **todas** las peticiones cuando hay token; [`authGuard`](src/app/core/guards/auth.guard.ts) protege `/admin/**`.

### 2.2 Roles

Existen **3 roles** (string en `User.Role`, default `"Admin"`), aplicados sobre todo en el **frontend** (no hay `[Authorize(Roles=…)]` extensivo en el backend):

| Rol | Restricción en `authGuard` |
|---|---|
| `Admin` | Acceso completo al panel `/admin` |
| `Driver` | Forzado a `/admin/routes` (no puede salir de ahí) |
| `Scaner` | Forzado a `/pos-mobile/home` |

### 2.3 ¿Cómo se identifica "el negocio actual"?

**No se identifica — porque no existe el concepto.** El sistema es **single-tenant por diseño**:

1. **No hay tenant en el token.** El JWT no lleva `businessId`/`tenantId`/`storeId`.
2. **No hay tenant en la base de datos.** Ninguna entidad tiene FK a un negocio (ver §1.1).
3. **El "negocio" está hardcodeado de forma implícita** en varios puntos:
   - Nombre "Regi Bazar" embebido en los prompts de Gemini ([GeminiService.cs](../api/EntregasApi/Services/GeminiService.cs)).
   - Dominio `https://regibazar.com` fijo en CORS y en `App:FrontendUrl`.
   - Depot/centro de ruta fijo en **Nuevo Laredo** (`Cami:RouteCenterLat=27.4861`, `Lng=-99.5069`) y bias de geocoding a "Nuevo Laredo, Tamaulipas".
   - **El conductor es único** (patrón de un solo conductor): se identifica por `DeliveryRoute.DriverToken`, no por un usuario con sesión.
4. El registro más parecido a "configuración del negocio" es la fila **singleton** `AppSettings (Id=1)`.

> **Conclusión:** para volverlo multi-negocio habría que (a) añadir un claim de tenant al JWT, (b) un `BusinessId` a las raíces 🟢 de §1, (c) filtros globales de query en EF (`HasQueryFilter`), y (d) parametrizar los valores hoy hardcodeados (dominio, depot, prompts).

### 2.4 Rutas públicas (sin autenticación)

Acceden por **token de recurso** en la URL, no por JWT:

| Ruta frontend | Token | Propósito |
|---|---|---|
| `/pedido/:token` | `Order.AccessToken` | Vista pública del pedido para la clienta (tracking + pago) |
| `/repartidor/:token` | `DeliveryRoute.DriverToken` | Vista del conductor (mapa + entregas) |
| `/tanda-view/:token` | `Tanda.AccessToken` | Vista pública de la tanda |
| `/live/:id` | `LiveSession.Id` | Vista pública del live |
| `/login` | — | Login del admin |

---

## 3) Estructura de la solución

### 3.1 Backend — `C:\Codigos\api\EntregasApi` (.NET 8)

```
EntregasApi/
├── Program.cs                 # Bootstrap: DI, JWT, CORS, SignalR, migración+seed al arranque
├── EntregasApi.csproj         # net8.0
├── appsettings.json           # Config de todas las integraciones (claves)
├── cami-voz-v2.json           # Credenciales Google Cloud TTS (C.A.M.I.)
├── firebase-service-account.json  # Credenciales Firebase (FCM)
├── Controllers/  (20)         # Auth, Orders, Routes, Driver, Clients, ClientResolution,
│                              #   ClientView, Loyalty, Payments(Webhook), Pos, Raffles,
│                              #   Reports, SalesPeriods, Suppliers, Tanda, PublicTanda,
│                              #   Cami, LiveCapture, Push, AdminFinancials
├── Models/  (35 archivos)     # Entidades EF (ver §1)
├── DTOs/                      # Dtos.cs, RaffleDtos.cs, TandaDtos.cs
├── Data/
│   └── AppDbContext.cs        # DbContext (34 DbSets, relaciones, seeds)
├── Services/  (~37)           # Lógica de negocio + integraciones externas (ver §4)
├── Hubs/  (5)                 # SignalR: Tracking, Delivery, Orders, Logistics, Pos
├── Middleware/                # (carpeta presente, vacía de .cs propios)
├── Migrations/  (75)          # EF Core, desde 20260217 InicialPostgres
├── uploads/evidence/          # Archivos estáticos servidos en /uploads
└── Tests/EntregasApi.Tests/   # Proyecto de pruebas (excluido de compilación del API)
```

**Paquetes NuGet clave:** `Npgsql.EntityFrameworkCore.PostgreSQL`, `Microsoft.AspNetCore.Authentication.JwtBearer`, `Microsoft.AspNetCore.SignalR.Common`, `Google.GenAI` (Gemini), `Google.Cloud.TextToSpeech.V1`, `FirebaseAdmin` (FCM), `CloudinaryDotNet`, `WebPush` (VAPID), `AWSSDK.S3` (R2, ver §7), `Tesseract` (OCR), `EPPlus` (Excel), `BCrypt.Net-Next`, `Swashbuckle` (Swagger).

### 3.2 Frontend — `C:\Codigos\regibazar-web` (Angular 21.2.1)

```
regibazar-web/
├── src/app/
│   ├── app.ts / app.config.ts / app.routes.ts   # Standalone bootstrap + rutas lazy
│   ├── core/
│   │   ├── guards/        auth.guard.ts
│   │   ├── interceptors/  auth.interceptor.ts, error.interceptor.ts
│   │   ├── services/ (11) api, auth, signalr, gps, live-capture, push-notification,
│   │   │                  pwa-update, coupon, raffle, tanda, toast
│   │   ├── models/        index.ts
│   │   └── utils/         address.util.ts, messenger.util.ts
│   ├── features/
│   │   ├── auth/login
│   │   ├── admin/         # Panel (con authGuard): layout, dashboard, orders (+capture,
│   │   │                  #   send-links, client-resolver), clients (+profile, duplicates,
│   │   │                  #   facebook-import, address-editor-v2), routes (+route-builder,
│   │   │                  #   route-optimizer, address-picker), live, raffles, tandas,
│   │   │                  #   suppliers, financials, reports, sales-periods, cami, glow-up, carina
│   │   ├── client/        order-view (/pedido), tanda-view
│   │   ├── driver/        route-view (/repartidor)
│   │   └── live/          live-view
│   └── shared/
│       ├── components/    toast, birthday-coupon
│       └── directives/
├── android/               # Proyecto Capacitor (Gradle) — app del conductor
├── capacitor.config.ts    # appId: com.regibazar.driver · appName: RegiBazar
├── public/  +  src/assets/
└── dist/regibazar-store/  # Build SSR (browser + server)
```

**Dependencias clave (frontend):** `@angular/* 21.2.1` (standalone, SSR vía `@angular/ssr` + Express, PWA vía `@angular/service-worker`), `@microsoft/signalr ^10`, `@angular/google-maps`, `@mercadopago/sdk-js`, `@capacitor/* 8` + `@capacitor-community/background-geolocation` (GPS del conductor) + `@capgo/capacitor-printer` (tickets), `chart.js` + `echarts`/`ngx-echarts` (dashboards), `gsap` + `canvas-confetti` (animación de sorteos), `qrcode`, `html2canvas`, **Tailwind CSS 4**.

---

## 4) Llamadas externas (integraciones)

> Cada integración con su **archivo**, **propósito** y **endpoint/SDK**. Las API keys viven en `appsettings.json` (sección entre paréntesis). En el repo los valores están como `"dummy"` (se inyectan en producción).

### 4.1 Gemini (Google Generative AI) — IA central / C.A.M.I.

| | |
|---|---|
| **Archivo** | [`Services/GeminiService.cs`](../api/EntregasApi/Services/GeminiService.cs) |
| **SDK / endpoint** | `Google.GenAI` v1.3.0 (cliente oficial). Modelos **`gemini-2.5-flash`** (mayoría) y **`gemini-1.5-flash`** (briefing de ruta) |
| **Config** | `Gemini:ApiKey` |
| **Propósito (7 usos)** | 1) `ParseLiveTextAsync` — carrito por voz en Live Mode · 2) `AnalyzeReportAsync` — insights de Business Intelligence · 3) `SelectOrdersForRouteAsync` — armar ruta por voz (fuzzy matching de nombres) · 4) `GetDashboardInsightAsync` · 5) `GetClientInsightAsync` · 6) `GetRouteBriefingAsync` · 7) `ParsePosVoiceAsync` — voz del POS. Todos con `ResponseMimeType=application/json` |
| **También usado en** | [`LiveCaptureService.cs`](../api/EntregasApi/Services/LiveCaptureService.cs) (`CallGeminiJsonAsync`) para detectar productos y pedidos hablados en la transcripción; y en `CamiService` (asistente IA contextual) |

### 4.2 Google Maps — Geocoding

| | |
|---|---|
| **Archivo** | [`Services/GeocodingService.cs`](../api/EntregasApi/Services/GeocodingService.cs) |
| **Endpoint** | `GET https://maps.googleapis.com/maps/api/geocode/json` (params `region=mx&language=es`) |
| **Config** | `Google:GeocodingApiKey` |
| **Propósito** | Convertir direcciones de clientas a lat/lng. **Bias fijo a "Nuevo Laredo, Tamaulipas, México"** si la dirección no lo incluye |

### 4.3 Google Maps — Routes API v2 (optimización de rutas)

| | |
|---|---|
| **Archivo** | [`Services/RouteOptimizerService.cs`](../api/EntregasApi/Services/RouteOptimizerService.cs) |
| **Endpoints** | `POST https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix` (matriz de distancias/tiempos reales, hasta ~600 elementos) · `POST https://routes.googleapis.com/directions/v2:computeRoutes` (polyline, hasta 25 waypoints) |
| **Config** | `Google:RoutesApiKey` |
| **Propósito** | Ordenar las paradas de una ruta de entrega minimizando distancia/tiempo. **Fallback heurístico** (vecino más cercano) si no hay API key |
| **Frontend** | También se consume Google Maps JS vía `@angular/google-maps` en route-builder / route-view |

### 4.4 Cloudinary — almacenamiento de imágenes

| | |
|---|---|
| **Archivo** | [`Services/CloudinaryService.cs`](../api/EntregasApi/Services/CloudinaryService.cs) (SDK `CloudinaryDotNet`) |
| **Config** | `Cloudinary:CloudName / ApiKey / ApiSecret` |
| **Propósito** | Subir fotos. Usado en [`DriverController.cs`](../api/EntregasApi/Controllers/DriverController.cs): evidencia de entrega (folder `evidence`) y comprobantes de gasto del chofer (folder `expenses`). Devuelve la `SecureUrl`. (Ver convención de nombres en §7) |

### 4.5 Facebook / Messenger

| | |
|---|---|
| **Archivos** | [`Services/FacebookLinkHelper.cs`](../api/EntregasApi/Services/FacebookLinkHelper.cs) (backend) · [`core/utils/messenger.util.ts`](src/app/core/utils/messenger.util.ts) (frontend) |
| **Endpoint** | **Ninguna API de Facebook.** No hay Graph API ni envío automatizado de mensajes |
| **Propósito** | Validar/normalizar referencias de Facebook (URL de perfil, `m.me`, `messenger.com/t`, `profile.php?id=`, `/people/`, username o ID) y **construir links directos `https://m.me/{usuario}`**. Usado en `ClientsController` (importación masiva de Facebooks) |
| **Flujo de mensajería** | Messenger **no permite pre-rellenar texto** (a diferencia de WhatsApp). El frontend copia el mensaje al portapapeles y abre el chat `m.me`; la clienta pega. Confirmado: **comunicación 100% por Messenger, nunca WhatsApp** |
| **Descarga de video** | Facebook también interviene en Live Capture: `yt-dlp` descarga el audio de URLs `facebook.com`/`fb.watch` (ver §4.6) |

### 4.6 Integraciones adicionales (relevantes)

| Servicio | Archivo | Endpoint / SDK | Config | Propósito |
|---|---|---|---|---|
| **OpenAI Whisper** | [`LiveCaptureService.cs`](../api/EntregasApi/Services/LiveCaptureService.cs#L584) | `POST https://api.openai.com/v1/audio/transcriptions` (modelo `whisper-1`, `verbose_json`) | `OpenAI:ApiKey` | Transcribir el audio del live por chunks |
| **ElevenLabs TTS** | [`ElevenLabsTtsService.cs`](../api/EntregasApi/Services/ElevenLabsTtsService.cs) | `POST https://api.elevenlabs.io/v1/text-to-speech/{voiceId}` (modelo `eleven_multilingual_v2`) | `ElevenLabs:ApiKey/VoiceId/ModelId` | Voz principal de C.A.M.I. (con caché 24h en memoria) |
| **Google Cloud TTS** | [`GoogleTtsService.cs`](../api/EntregasApi/Services/GoogleTtsService.cs) | SDK `Google.Cloud.TextToSpeech.V1`, voz `es-US-Chirp3-HD-Kore` | `Cami:TtsVoice/Pitch/Speed` + cred. `cami-voz-v2.json` / env `GOOGLE_CREDENTIALS_JSON` | **Fallback** de TTS si ElevenLabs falla |
| **Firebase Cloud Messaging** | [`FcmService.cs`](../api/EntregasApi/Services/FcmService.cs) | SDK `FirebaseAdmin` (multicast ≤500 tokens) | `Firebase:ServiceAccountPath` | Push **nativo Android** (conductor). Canal `regibazar_channel`, color `#FF0072` |
| **Web Push (VAPID)** | [`PushNotificationService.cs`](../api/EntregasApi/Services/PushNotificationService.cs) | SDK `WebPush` | `VapidDetails:Subject/PublicKey/PrivateKey` | Push **web/PWA** (clientas y admins) |
| **Mercado Pago** | [`ClientViewController.cs`](../api/EntregasApi/Controllers/ClientViewController.cs), [`PublicTandaController.cs`](../api/EntregasApi/Controllers/PublicTandaController.cs), [`PaymentsWebhookController.cs`](../api/EntregasApi/Controllers/PaymentsWebhookController.cs) | `POST https://api.mercadopago.com/v1/payments` (crear) · `GET .../v1/payments/{id}` (webhook) | `MercadoPago:AccessToken/PublicKey` | Cobro en línea de pedidos y tandas + confirmación por webhook. Frontend usa `@mercadopago/sdk-js` |
| **yt-dlp** (proceso externo) | `LiveCaptureService.cs` | binario `yt-dlp` / `python -m yt_dlp` | `LiveCapture:YtDlpPath/YtDlpPythonPath` | Descargar `bestaudio` de Facebook/YouTube |
| **ffmpeg** (proceso externo) | `LiveCaptureService.cs` | binario `ffmpeg` | `LiveCapture:FfmpegPath` | Segmentar audio en chunks y recortar clips de 5s por candidato |

---

## 5) SignalR — Hubs, grupos y conexiones

### 5.1 Hubs registrados ([Program.cs](../api/EntregasApi/Program.cs#L298))

| Hub | Ruta | Archivo |
|---|---|---|
| `DeliveryHub` | `/hubs/delivery` | [DeliveryHub.cs](../api/EntregasApi/Hubs/DeliveryHub.cs) |
| `TrackingHub` | `/hubs/tracking` | [TrackingHub.cs](../api/EntregasApi/Hubs/TrackingHub.cs) |
| `OrderHub` | `/hubs/orders` | [OrdersHub.cs](../api/EntregasApi/Hubs/OrdersHub.cs) |
| `LogisticsHub` | `/hubs/logistics` | [LogisticsHub.cs](../api/EntregasApi/Hubs/LogisticsHub.cs) |
| `PosHub` | `/hubs/pos` | [PosHub.cs](../api/EntregasApi/Hubs/PosHub.cs) |

**Autenticación de SignalR:** el JWT se pasa por **query string** `?access_token=…`; [Program.cs](../api/EntregasApi/Program.cs#L93) lo lee en `OnMessageReceived` solo para paths que empiezan con `/hubs`. CORS permite `AllowCredentials` para los orígenes de `regibazar.com`, `localhost:4200` y `capacitor://localhost`.

### 5.2 Grupos y cómo se agrupan las conexiones

Las conexiones se agrupan llamando métodos `Join…` del hub. Convenciones de nombre de grupo:

| Grupo | Formado por | Quién se une | Para qué |
|---|---|---|---|
| `Admins` | literal | Panel admin (`JoinAdminGroup` en Delivery/Tracking/Order/Logistics) | Recibir ubicación del chofer, updates de pedidos |
| `Route_{driverToken}` | token de la ruta | Conductor y admin (`JoinRoute`/`JoinRouteGroup`) | Eventos de una ruta concreta. *Ojo: LogisticsHub usa `Route_{routeId}` (id), Delivery usa `Route_{driverToken}` (token)* |
| `Tracking_{driverToken}` | token de la ruta | Clientas que abren `/pedido/:token` (DeliveryHub.`JoinOrder` los une automáticamente si su pedido tiene ruta) | Recibir la **ubicación GPS en vivo** del repartidor |
| `Order_{accessToken}` / `order_{accessToken}` | `Order.AccessToken` | Clienta + admin | Updates del pedido y saludo de C.A.M.I. *Inconsistencia: DeliveryHub usa `Order_` (mayúscula); TrackingHub y OrderHub usan `order_` (minúscula)* |
| `order_{orderId}` | `Order.Id` (int) | POS (`PosHub.JoinOrderGroup`) | Sincronizar un ticket de POS entre dispositivos |
| `PosNodriza` | literal | Pantalla "nodriza" del POS (`JoinNodrizaGroup`) | Difundir ventas a la pantalla principal de caja |

### 5.3 Eventos representativos

- **GPS del conductor:** `DeliveryHub.ReportLocation(driverToken, lat, lng)` → emite `ReceiveLocation` al grupo `Admins` y `LocationUpdate` al grupo `Tracking_{driverToken}`.
- **Salida en ruta:** `DriverController` envía `DeliveryUpdate` (InTransit) y, en background, `CamiGreeting` (mensaje + audio TTS) al grupo `Order_{accessToken}`.
- **Chat:** `DeliveryHub.SendMessage(groupName, message)` → `ReceiveMessage`.

> El cliente Angular usa `@microsoft/signalr ^10` en [`core/services/signalr.service.ts`](src/app/core/services/signalr.service.ts).

---

## 6) Jobs en background / schedulers

**No existe ningún scheduler ni framework de jobs** (no hay Hangfire, Quartz, `IHostedService`, `BackgroundService`, `PeriodicTimer` ni cron). El trabajo asíncrono se hace de dos formas:

### 6.1 Trabajo al arranque ([Program.cs](../api/EntregasApi/Program.cs#L196), una sola vez por despliegue)

Dentro de un scope al iniciar la app:
1. **`db.Database.MigrateAsync()`** — aplica migraciones EF pendientes automáticamente.
2. **Backfill de normalización de clientas** — rellena `NormalizedName/Phone/Address` de `Client` creados antes de la migración de fuzzy-matching (idempotente: solo filas con `NormalizedName` vacío).
3. **Migración de abonos legacy** — mueve `Order.AdvancePayment` (obsoleto) a `OrderPayments` (idempotente: deja `AdvancePayment=0`).
4. **Seed del catálogo RegiPuntos** — inserta 4 `LoyaltyReward` si la tabla está vacía.

### 6.2 Tareas "fire-and-forget" (`Task.Run`, sin cola ni persistencia)

| Ubicación | Qué hace | Riesgo |
|---|---|---|
| [`LiveCaptureService.ImportAsync`](../api/EntregasApi/Services/LiveCaptureService.cs#L55) | Lanza **todo el pipeline de Live Capture** en segundo plano (descarga yt-dlp → segmentar ffmpeg → transcribir Whisper por chunks → detectar productos/pedidos con Gemini → construir candidatos). Crea su propio scope DI. El progreso se refleja en `LiveSession.Status/StatusDetail` (el frontend lo consulta por polling) | Si el proceso se reinicia, la sesión queda colgada en su último estado (no hay reintentos ni cola durable) |
| [`DriverController` (~L243)](../api/EntregasApi/Controllers/DriverController.cs#L243) | Genera el **saludo proactivo de C.A.M.I.** (texto + audio TTS) al marcar una entrega "en tránsito" y lo emite por SignalR. No bloquea la respuesta HTTP | Errores se tragan silenciosamente (`catch {}`) |

> **Observación:** al ser `Task.Run` sin durabilidad, estas tareas se pierden si el contenedor se reinicia a mitad. Para Live Capture (que puede tardar minutos) sería el primer candidato a migrar a un `BackgroundService` con cola o a un worker externo.

---

## 7) Storage — organización de archivos

### 7.1 Cloudinary (imágenes en producción)

[`CloudinaryService.UploadAsync(stream, fileName, folder)`](../api/EntregasApi/Services/CloudinaryService.cs):

- **Carpeta:** `regibazar/{folder}` — con `Folder` raíz fijo `regibazar/`.
- **`PublicId`:** `{nombreArchivoSinExtensión}_{GuidN}` (GUID de 32 hex sin guiones) → evita colisiones, `Overwrite=false`.
- **Transformación:** `quality=auto`, `fetch_format=auto` (optimización automática).
- **Devuelve:** `SecureUrl` (https), que se guarda en la entidad (`DeliveryEvidence.ImagePath`, `DriverExpense.EvidencePath`).

**Carpetas en uso (2):**

| Folder Cloudinary | Origen | Entidad destino |
|---|---|---|
| `regibazar/evidence` | Foto de evidencia de entrega/no-entrega (DriverController) | `DeliveryEvidence.ImagePath` |
| `regibazar/expenses` | Comprobante de gasto del chofer (gasolina, etc.) | `DriverExpense.EvidencePath` |

### 7.2 Almacenamiento local del servidor

- **`/uploads` (con `/uploads/evidence`):** servido como archivos estáticos vía `PhysicalFileProvider` ([Program.cs](../api/EntregasApi/Program.cs#L277)). Coexiste con Cloudinary (parece ser el mecanismo legacy/local de evidencias antes de mover a Cloudinary).
- **`/tmp` (efímero, Live Capture):** `yt-dlp` descarga a `/tmp/live_{sessionId}.{ext}`; ffmpeg genera chunks `/tmp/live_{sessionId}_chunk_%03d.mp3`. El audio fuente **no se borra** (se guarda su ruta en `LiveSession.LocalAudioPath`) para poder recortar clips de 5 s por candidato; los chunks sí se borran tras transcribir.

### 7.3 Cloudflare R2 — declarado pero **no implementado**

- Config `CloudflareR2:{AccountId, AccessKeyId, SecretAccessKey, BucketName, VideoPrefix="live-videos"}` y el paquete `AWSSDK.S3` **están presentes**, y el modelo `LiveSession` tiene un campo `R2Key`.
- **Sin embargo, ningún código usa R2 / S3 actualmente:** `R2Key` nunca se asigna y no hay llamadas `PutObject`/`IAmazonS3`. El pipeline guarda el audio en `/tmp` local, no en R2.
- **Conclusión:** infraestructura **preparada/planeada** (probablemente para persistir los videos/audios de los lives), pero **inactiva** en la versión actual.

---

## Apéndice — Discrepancias detectadas con la documentación existente

Útiles si se va a actualizar `CLAUDE.md`:

1. **Angular 21.2.1**, no 18 (y con SSR + PWA + Capacitor, no solo SPA).
2. **Base de datos en Neon** (`*.neon.tech`), el connection string no apunta a Render.
3. **No hay refresh tokens** pese a que CLAUDE.md los menciona; el JWT dura 7 días fijos.
4. **El rol no viaja en el JWT** (claims solo userId/email/name); el control de roles es de frontend.
5. **TTS principal es ElevenLabs**, con Google Cloud TTS solo como fallback (CLAUDE.md no menciona ElevenLabs).
6. **Transcripción con OpenAI Whisper** (no es un servicio de Google).
7. El interceptor HTTP de Angular **inyecta el JWT en todas las rutas** por igual; la "lógica especial para rutas públicas (`/order-view`)" descrita en CLAUDE.md no está en `auth.interceptor.ts` (las vistas públicas simplemente usan endpoints que no exigen el header).
8. Nomenclatura de tablas **inconsistente**: la mayoría en PascalCase (`Orders`, `Clients`) pero Tandas y Raffles en snake_case (`tandas`, `raffle_entries`) — y `TandaProduct` mapea a una tabla llamada `products` distinta de `Products` (catálogo POS).
