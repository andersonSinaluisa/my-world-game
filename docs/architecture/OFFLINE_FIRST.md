# Offline-First

> **Status:** Accepted (v1) · **Last Updated:** 2026-09-18
> **Related ADR:** [ADR-005](../decisions/ADR-005-OFFLINE-FIRST.md), [ADR-006](../decisions/ADR-006-SQLITE.md)
> **Related Epic:** EPIC-015, EPIC-021

## 1. Definición

**El MVP funciona al 100 % sin conexión, y en el MVP no hace ninguna llamada de red de juego.**

- Todo el contenido (el pack `core`) va dentro del binario.
- Todo el estado vive en SQLite en el dispositivo.
- No hay cuentas, servidores ni sincronización.

## 2. Por qué

- El público juega en tablets sin datos móviles, en coches, en viajes.
- Hay menos superficie regulatoria (niños) y menos costes de operación.
- Cero latencia de red en el bucle de juego.

## 3. Reglas

| Regla | Detalle |
|---|---|
| Sin dependencias de red en el arranque | Nada bloquea el arranque esperando la red |
| Sin SDKs que hagan red | Ni analytics, ni crash reporting remoto, ni anuncios en el MVP. Si se quiere crash reporting, requiere un ADR y un proveedor compatible con apps infantiles (OQ-04). |
| El dispositivo es la fuente de verdad | En el MVP no hay otra |
| El reloj del dispositivo no es de fiar | El regalo diario usa la fecha local y admite que el niño "adelante la hora". Es aceptable: la economía es blanda y no hay dinero real. |

## 4. Preparado para después [DESIGNED FOR LATER]

| Futuro | Qué ya está previsto |
|---|---|
| Packs descargables | `PackManifest.distribution`, `checksum` y `entitlement`. El registry admite packs en el filesystem (ver [CONTENT_SYSTEM §5](CONTENT_SYSTEM.md)). La descarga es opcional y el juego base nunca la requiere. |
| Cloud save | `GameSave` como modelo lógico completo y serializable. Hay IDs estables (ULID) que no colisionan entre dispositivos, `updatedAt` en cada entidad y `slot_id`. Ver [BACKEND_FUTURE](BACKEND_FUTURE.md). |
| Sincronización | Estrategia prevista: **last-writer-wins por entidad** usando `updated_at`, más la fusión del monedero por eventos, que se decide con un ADR cuando llegue el momento. |

## 5. Qué hacer si una funcionalidad futura requiere red

1. La funcionalidad debe **degradar con elegancia** sin red: ocultarse o poner la acción en cola, **nunca** mostrar un error al niño.
2. Cualquier acción de red iniciada por el usuario que salga de la app o cueste dinero pasa por la **puerta parental**.
3. Escribir un ADR que actualice [ADR-005](../decisions/ADR-005-OFFLINE-FIRST.md).
