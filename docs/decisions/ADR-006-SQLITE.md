# ADR-006 — Persistencia con expo-sqlite: una fila por entidad y un diff sobre el contenido

**Status:** Accepted · **Date:** 2026-09-18 · **Related:** [SAVE_SYSTEM](../architecture/SAVE_SYSTEM.md), [SAVE_SCHEMA](../data/SAVE_SCHEMA.md)

## Context
Hay que persistir todo el estado del mundo de forma automática, incremental y robusta ante cierres abruptos. El formato tiene que poder migrar entre versiones y soportar actualizaciones de contenido.

## Decision
- **`expo-sqlite`** (API async + transacciones) detrás de un puerto `SaveStore`. El motor no conoce SQL.
- **Modelo físico:**
  - `save_slot` (datos del jugador en JSON);
  - `entity_state` (**una fila por entidad modificada o creada**, con el `data` en JSON validado con zod);
  - `entity_removed`.
- **Modelo lógico de diff:** estado = contenido definido ⊕ cambios guardados. Solo se persisten los componentes de estado del jugador (ver SAVE_SCHEMA §2).
- **Tres versiones:** `PRAGMA user_version` (tablas), `saveVersion` (formato de datos) y `contentVersions` (packs). Las migraciones son puras y tienen tests con fixtures.
- **Autosave** con debounce de 1 s (máximo 5 s) y flush inmediato en background, cambio de escena o cambio de monedas.

## Alternatives
| Alternativa | Por qué no |
|---|---|
| AsyncStorage / MMKV con un blob JSON único | Reescribir todo el mundo en cada cambio, sin transacciones multi-clave y con más riesgo de corrupción total. MMKV no es transaccional para este uso. |
| Esquema relacional por componente (tablas `transform`, `edible`…) | Rígido frente a la evolución del contenido, con muchas migraciones SQL y sin beneficio de consulta real |
| Guardar el mundo completo (sin diff) | Las actualizaciones de contenido (arte, hitbox, objetos nuevos) no llegarían a las partidas existentes |
| WatermelonDB, Realm | Dependencias pesadas, pensadas para sincronización y consultas complejas que no necesitamos todavía |

## Consequences
- ✅ Escrituras pequeñas y transaccionales, y carga por escena con índice.
- ✅ Las actualizaciones de contenido se reflejan automáticamente en las partidas.
- ⚠️ La carga requiere fusionar contenido y diff: está cubierto por tests.
- ⚠️ El JSON en SQLite se valida al leer: un fallo de validación de una entidad no debe tumbar la carga (se descarta y se registra).

## Risks
- Migraciones incorrectas que corrompen partidas. Mitigación: backup con `VACUUM INTO` antes de migrar, fixtures por versión (HU-GAME-072) y no abrir nunca un guardado de una versión futura.

## Revisit when
- Cloud sync (Fase 8), perfiles múltiples, o un rendimiento de flush por encima de 50 ms en el dispositivo de referencia.
