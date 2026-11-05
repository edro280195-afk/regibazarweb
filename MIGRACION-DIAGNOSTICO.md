# Diagnóstico de datos para migración multi-tenant — Regi Bazar

> **Propósito:** fotografiar el estado real de los datos de producción antes de migrar a una base **multi-tenant** nueva, donde **RegiBazar será el Tenant #1**.
> **Fecha:** 2026-06-23
> **Método:** conexión directa a la base de producción con **sesión PostgreSQL de SOLO LECTURA** (`SET SESSION CHARACTERISTICS … READ ONLY` vía `psycopg2.set_session(readonly=True)`). El servidor habría rechazado cualquier escritura. **No se ejecutó ningún INSERT/UPDATE/DELETE/DDL ni migración EF. Cero filas modificadas.**
> **Privacidad:** no se imprime el connection string ni secreto alguno; de los tokens vivos (AccessToken, DriverToken, QrCodeValue) solo se reportan **conteos**, nunca valores.

---

## 0. Conexión

| | |
|---|---|
| **Base de datos** | `neondb` |
| **Motor** | PostgreSQL **17.10** (Neon) |
| **Total de tablas físicas** (schema `public`, BASE TABLE) | **37** |
| **¿Es producción?** | **Sí, confirmado.** Contiene datos reales de negocio: 669 pedidos con historia continua del **18-feb-2026 al 20-jun-2026**, 319 clientas, 651 pagos, evidencias en Cloudinary. No es una base vacía ni de prueba. |

---

## 1. Esquema real vs inventario (drift)

**Resultado: cero drift estructural.** Las **36** entidades documentadas en el inventario existen físicamente. La única tabla "extra" es `__EFMigrationsHistory` (control interno de EF Core, 38 migraciones aplicadas) — esperada, no es un hallazgo. **Ninguna tabla del inventario falta.**

### Nomenclatura real (confirmada) — mezcla peligrosa

El inventario advertía mezcla de convenciones; **se confirma en la base real**:

- **28 tablas en PascalCase** (generadas por EF Core con identificadores entrecomillados): `Users`, `Clients`, `Orders`, `OrderItems`, `OrderPayments`, `OrderPackages`, `DeliveryRoutes`, `Deliveries`, `DeliveryEvidences`, `DriverExpenses`, `ChatMessages`, `Products`, `CashRegisterSessions`, `Suppliers`, `Investments`, `SalesPeriods`, `AppSettings`, `LoyaltyTransactions`, `LoyaltyRewards`, `PushSubscriptions`, `FcmTokens`, `ClientAliases`, `ClientMergeAudits`, `LiveSessions`, `LiveProducts`, `LiveSpokenOrders`, `LiveCommentOrders`, `LiveCandidates`.
- **8 tablas en snake_case** (módulos de Tandas y Sorteos): `tandas`, `tanda_participants`, `payments`, `products`, `raffles`, `raffle_participants`, `raffle_entries`, `raffle_draws`.
- Las tablas PascalCase tienen **columnas PascalCase** (`"AccessToken"`); las snake_case tienen **columnas snake_case** (`access_token`). El script de migración debe entrecomillar correctamente cada caso.

### ⚠️ Dos colisiones de nombre que pueden corromper la migración

| Nombre físico | Entidad real | Filas | NO confundir con |
|---|---|---|---|
| **`products`** (minúscula) | `TandaProduct` (catálogo de tandas) | **4** | **`Products`** (catálogo POS) — tabla distinta, **0** filas |
| **`payments`** (minúscula) | `TandaPayment` (abonos de tanda) | **255** | **`OrderPayments`** (pagos de pedidos) — tabla distinta, **651** filas |

> Un script que haga `SELECT … FROM products` pensando en el catálogo POS leería las **tandas**, y `payments` no son los pagos de pedidos. En Postgres `products` ≠ `"Products"`. **Tratar estos cuatro nombres como entidades separadas.**

---

## 2. Volumen

Conteo real de filas por tabla (mayor a menor). Total ≈ **6,030 filas de negocio** (+38 de `__EFMigrationsHistory`).

| Filas | Tabla | | Filas | Tabla |
|---:|---|---|---:|---|
| 2539 | OrderItems | | 17 | DeliveryEvidences |
| 669 | Orders | | 13 | ClientAliases |
| 651 | OrderPayments | | 13 | LiveSessions |
| 592 | LoyaltyTransactions | | 12 | Suppliers |
| 398 | Deliveries | | 7 | DriverExpenses |
| 319 | Clients | | 7 | OrderPackages |
| 255 | payments *(TandaPayment)* | | 6 | tandas |
| 235 | raffle_entries | | 4 | LoyaltyRewards |
| 78 | raffle_participants | | 4 | Users |
| 60 | tanda_participants | | 4 | products *(TandaProduct)* |
| 45 | ChatMessages | | 3 | raffle_draws |
| 41 | DeliveryRoutes | | 1 | AppSettings · CashRegisterSessions · FcmTokens · raffles |
| 29 | Investments | | 0 | **Products** *(POS)* · SalesPeriods · ClientMergeAudits |
| 25 | PushSubscriptions | | 0 | LiveProducts · LiveSpokenOrders · LiveCommentOrders · LiveCandidates |

**Rango histórico de `Orders.CreatedAt`:** `2026-02-18 05:34 UTC` → `2026-06-20 18:06 UTC` (~4 meses de operación continua).

**Notas de volumen relevantes para la migración:**
- **Tablas vacías (0 filas):** `Products` (POS nunca usado), `SalesPeriods` (no se usan periodos), `ClientMergeAudits`, y **todo el detalle de Live Capture** (`LiveProducts`, `LiveSpokenOrders`, `LiveCommentOrders`, `LiveCandidates`) — hay 13 `LiveSessions` importadas pero **sin candidatos persistidos**. Estas tablas pueden migrarse como vacías (o incluso omitirse en el Tenant #1 hasta que se usen).
- El grueso del valor está en la cadena **Clients → Orders → OrderItems/OrderPayments/Deliveries** y en **LoyaltyTransactions** (RegiPuntos).

---

## 3. Integridad de tokens (CRÍTICO — links vivos en Messenger)

Conteos sobre columnas únicas (sin mostrar valores). **Resultado: todo limpio. Ningún bloqueador.**

| Columna única | Total | NULL/vacíos | Valores duplicados | Filas en duplicados | Estado |
|---|---:|---:|---:|---:|---|
| `Orders.AccessToken` | 669 | **0** | **0** | 0 | ✅ íntegro |
| `DeliveryRoutes.DriverToken` | 41 | **0** | **0** | 0 | ✅ íntegro |
| `tandas.access_token` | 6 | **0** | **0** | 0 | ✅ íntegro |
| `OrderPackages.QrCodeValue` | 7 | **0** | **0** | 0 | ✅ íntegro |
| `Products.SKU` | 0 | 0 | 0 | 0 | ✅ (tabla vacía) |
| `Clients.Name` (unique en modelo) | 319 | **0** | **0** | 0 | ✅ íntegro |

> **No hay un solo token nulo ni duplicado.** Los enlaces públicos vivos (`/pedido/:token`, `/repartidor/:token`, `/tanda-view/:token`) y los QR de paquetes son **100% únicos y poblados**: se pueden preservar tal cual en el Tenant #1 sin romper constraints ni links que las clientas ya tengan en sus chats de Messenger.

---

## 4. Identidad (User → Account + Membership)

| Métrica | Valor |
|---|---|
| Total `Users` | **4** |
| Distribución por `Rol` | **Admin: 1** · **Driver: 1** · **Scaner: 2** |
| `Email` NULL o vacío | **0** |
| `Email` duplicado (case-insensitive) | **0** |

> Los 4 usuarios tienen **email único y poblado** → cada uno puede convertirse limpiamente en una **Account** con login por email único en el modelo nuevo. El único `Admin` es el dueño del negocio (será el owner del Tenant #1); `Driver` y `Scaner` se vuelven memberships con rol acotado. **Sin bloqueadores de identidad.**

---

## 5. Configuración singleton

`AppSettings` tiene exactamente **1 fila** (Id=1). Estos valores **no son secretos** y serán la configuración inicial del **Tenant #1**:

| Campo | Valor |
|---|---|
| `DefaultShippingCost` | **60.00** (MXN, costo de envío por defecto) |
| `LinkExpirationHours` | **72** (horas de vigencia del link público del pedido) |

---

## 6. Almacenamiento: Cloudinary vs local (gotcha de evidencias)

| Columna | Total | Vacíos | `https://` (Cloudinary) | Rutas **locales** |
|---|---:|---:|---:|---:|
| `DeliveryEvidences.ImagePath` | 17 | 0 | **14** | **⚠️ 3** |
| `DriverExpenses.EvidencePath` | 7 | **7** | 0 | 0 |

**Ejemplos (rutas de fotos, no secretos):**
- Cloudinary (OK): `https://res.cloudinary.com/dwajeow88/image/upload/.../regibazar/evidence/evidence_970b0e…jpg`
- **Local (riesgo):** `evidence/118_24918e…jpg`, `evidence/168_780d5e…jpg`, `evidence/190_9ace71…jpg`

> **⚠️ Riesgo:** las **3 evidencias con ruta local** apuntan a la carpeta `uploads/evidence` que sirve el backend actual. El sistema nuevo **no servirá esa carpeta**, por lo que esas 3 fotos quedarían **rotas (404)**. Son evidencias de entregas reales (pedidos 118, 168, 190).
> `DriverExpenses.EvidencePath` está **100% vacío** (ninguna foto de gasto registrada) → sin riesgo ahí.

---

## 7. Huérfanos (integridad referencial)

Filas hijas cuyo FK (no nulo) apunta a un padre inexistente. **Resultado: cero huérfanos en todos los pares.**

| Relación hijo → padre | Huérfanos |
|---|---:|
| OrderItems → Orders | **0** |
| OrderPayments → Orders | **0** |
| Orders → Clients | **0** |
| Deliveries → DeliveryRoutes | **0** |
| OrderPackages → Orders | **0** |
| ClientAliases → Clients | **0** |
| tanda_participants → tandas | **0** |
| raffle_participants → raffles | **0** |
| LiveProducts → LiveSessions | **0** |

> Integridad referencial **perfecta**. El orden de copia padres→hijos no encontrará referencias rotas. **Sin bloqueadores de integridad.**

---

## 8. Cobertura de teléfono (flujo "reclamar perfil")

| Señal de identidad en `Clients` (total **319**) | Con dato | % |
|---|---:|---:|
| `Phone` poblado | **15** | **4%** |
| `NormalizedPhone` poblado | 15 | 4% |
| `FacebookProfileUrl` poblado | **0** | **0%** |
| Teléfono **o** Facebook | 15 | 4% |
| **Sin ninguna señal de contacto (solo nombre)** | **304** | **95%** |
| Con ≥1 alias registrado | 12 | 4% |

> **⚠️ Hallazgo fuerte:** el flujo "reclamar perfil" basado en **teléfono será muy débil** — solo el **4%** de las clientas tiene teléfono y **ninguna** tiene URL de Facebook capturada (el campo existe pero nunca se llenó). El **95% solo tiene nombre**.
> La buena noticia: `Clients.Name` es **único y sin duplicados** (§3), así que el nombre **es** un identificador viable para el enlace, aunque frágil ante errores de tipeo. Para fortalecer el flujo conviene una campaña de captura de teléfono antes o durante el corte, y apoyarse en los 12 registros con alias.

---

## 9. ⚠️ Resumen de riesgos para la migración

Consolidado de todos los hallazgos. **No se detectó ningún bloqueador duro** (nada que rompa constraints únicos ni integridad referencial); los riesgos son operativos/de calidad de datos.

| # | Hallazgo | Severidad | Corrección sugerida |
|---|---|---|---|
| 1 | **3 evidencias con ruta local** (`DeliveryEvidences.ImagePath` = `evidence/…`, pedidos 118/168/190) que el sistema nuevo no servirá | **[ADVERTENCIA]** | Antes del corte: subir esas 3 imágenes de `uploads/evidence` a Cloudinary y reescribir `ImagePath` a la URL `https://`; o copiar la carpeta `uploads/` al nuevo host. Si las fotos físicas ya no existen, aceptar la pérdida documentada. |
| 2 | **95% de clientas sin señal de contacto** (4% teléfono, 0% Facebook); flujo "reclamar perfil" por teléfono casi inservible | **[ADVERTENCIA]** | Usar `Clients.Name` (único) + los 12 alias como clave de enlace; planear captura de teléfono/Facebook. No depender del teléfono como identificador primario. |
| 3 | **Colisión de nombres** `products`≠`Products` (4 vs 0 filas) y `payments`≠`OrderPayments` (255 vs 651 filas) | **[ADVERTENCIA]** | En el ETL tratar los 4 nombres como entidades separadas y respetar mayúsculas/comillas. Mapear explícitamente `products`→TandaProduct y `payments`→TandaPayment. |
| 4 | **Nomenclatura mixta** PascalCase vs snake_case (tablas y columnas) | **[ADVERTENCIA]** | El script de extracción debe entrecomillar identificadores por tabla; no asumir un solo estilo. Buena oportunidad para **normalizar a snake_case** en el esquema multi-tenant nuevo. |
| 5 | **Tablas vacías**: `Products` (POS), `SalesPeriods`, todo el detalle de Live Capture (`LiveProducts/SpokenOrders/CommentOrders/Candidates`) | **[INFO]** | Migrar como vacías u omitir en el Tenant #1 hasta que se usen. `LiveSessions` (13) puede migrarse o archivarse: no tiene hijos. |
| 6 | Tokens únicos: **0 nulos / 0 duplicados** en AccessToken, DriverToken, access_token, QrCodeValue, Name | **[OK — sin acción]** | Preservar los tokens tal cual para no romper links vivos de Messenger. |
| 7 | Integridad referencial: **0 huérfanos** en los 9 pares revisados | **[OK — sin acción]** | Copiar en orden padres→hijos con tranquilidad. |
| 8 | Identidad: **4 users, emails únicos y poblados** | **[OK — sin acción]** | Convertir a Accounts (1 owner Admin + memberships Driver/Scaner) directamente. |

### Veredicto

La base de producción está **sana y lista para migrar**: tokens íntegros, integridad referencial perfecta, identidad limpia. Las dos acciones a resolver **antes del corte** son operativas: **(1)** rescatar las 3 evidencias locales a Cloudinary y **(2)** asumir que el enlace identidad-global ↔ registro-local se hará por **nombre** (no por teléfono), reforzándolo con captura de contacto. El resto son cuidados de nomenclatura en el script de ETL.
