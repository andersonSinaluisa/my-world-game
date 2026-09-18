# Backend (futuro)

> **Status:** Proposed. **[NOT NEEDED YET]**: no se implementa nada de esto en el MVP. · **Last Updated:** 2026-09-18
> **Related ADR:** [ADR-005](../decisions/ADR-005-OFFLINE-FIRST.md) (lo actualizará un ADR futuro)
> **Related Epic:** EPIC-033 · **Related HU:** HU-GAME-201, HU-GAME-202, HU-GAME-114, HU-GAME-117

Este documento existe para que las decisiones de hoy **no cierren puertas**. **No** es un plan de implementación.

## 1. Stack previsto

- **API:** .NET 8 (ASP.NET Core Minimal APIs o controladores). Stateless y contenedorizada.
- **Base de datos:** PostgreSQL.
- **Almacenamiento de packs:** almacenamiento de objetos con CDN, con paquetes firmados.
- **Autenticación:** **cuenta de adulto** (padre, madre o tutor). Los perfiles de niño cuelgan de esa cuenta. **El niño nunca inicia sesión ni introduce datos.**

## 2. Casos de uso previstos

| Caso | Descripción | HU |
|---|---|---|
| Cloud save | Copia de seguridad y restauración de `GameSave` | HU-GAME-201 |
| Multi-dispositivo familiar | La misma partida en la tablet y en el móvil | HU-GAME-202 |
| Catálogo de packs | Lista de packs, versiones y URLs de descarga firmadas | HU-GAME-114 |
| Validación de compras | Verificación de recibos de App Store y Google Play para los entitlements | HU-GAME-115 |
| Analytics agregados | Eventos anónimos con opt-in parental | HU-GAME-117 |

## 3. Modelo de datos esbozado (PostgreSQL)

```sql
-- solo boceto; se definirá con un ADR
account(id uuid pk, email_hash, created_at, country, consent_version)
profile(id uuid pk, account_id fk, display_icon, created_at)            -- sin nombre real
save_slot(id uuid pk, profile_id fk, save_version int, content_versions jsonb, player jsonb, updated_at)
save_entity(slot_id fk, entity_id text, data jsonb, updated_at, deleted bool, pk(slot_id, entity_id))
entitlement(account_id fk, product_id text, platform, receipt_hash, granted_at)
pack_release(pack_id text, version text, format_version int, url text, sha256 text, signature text, published_at)
```

Refleja el esquema local ([SAVE_SCHEMA](../data/SAVE_SCHEMA.md)) **a propósito**: la sincronización se hace entidad por entidad.

## 4. Sincronización (borrador)

- **Push:** entidades sucias desde el último sync, `updated_at` y `deleted`.
- **Pull:** cambios del servidor desde el cursor. Conflicto por entidad: **last-writer-wins** con `updated_at`.
- **Monedero:** se reconcilia con un **registro de transacciones** (nunca last-writer-wins sobre el saldo), para no perder ni duplicar monedas.
- `saveVersion`: el servidor guarda la versión del formato. Un cliente antiguo no escribe sobre una partida de un formato más nuevo.

## 5. Contrato de API esbozado

```
POST /v1/auth/parent/login            (adulto)
GET  /v1/profiles
GET  /v1/profiles/{id}/save?since=cursor
POST /v1/profiles/{id}/save/changes
GET  /v1/packs                         (catálogo)
POST /v1/entitlements/verify           (recibos)
```

## 6. Qué decisiones actuales lo facilitan

- IDs ULID (`rt_…`) únicos entre dispositivos.
- `GameSave` es un modelo lógico serializable completo.
- `updated_at` por entidad en `entity_state`.
- `slot_id` en todas las tablas.
- Packs con `version`, `formatVersion`, `checksum` y `entitlement`.
- El motor no depende de dónde viene el contenido: el registry abstrae el origen.

## 7. Qué NO decidir todavía

- Proveedor de hosting, IdP y estrategia de despliegue.
- Si la sincronización es en tiempo real o periódica.
- Precios y catálogo.
