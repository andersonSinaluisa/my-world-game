# Audio System

> **Status:** Accepted (v1) · **Last Updated:** 2026-09-18
> **Related ADR:** [ADR-001](../decisions/ADR-001-TECH-STACK.md)
> **Related Epic:** EPIC-016
> **Related HU:** HU-GAME-056, HU-GAME-057, HU-GAME-058

## 1. Enfoque

- El audio es **una consecuencia de los eventos**. El motor no "reproduce" nada: emite eventos, y el `AudioService` (adapter con `expo-audio`) decide qué sonido corresponde.
- **Librería:** `expo-audio`, la API de audio actual de Expo. Ver [ADR-001](../decisions/ADR-001-TECH-STACK.md). Hay que verificar su API concreta en la versión del SDK instalado (Expo SDK 57) antes de implementar.

## 2. Mapeo de eventos a sonidos

| Evento del motor | Sonido | Fuente de la clave |
|---|---|---|
| `entityMoved` (scene → held/drag start) | `pickup` | `sounds.pickup` de la entidad → fallback `sfx_pickup_default` |
| Drop con `place` | `drop` | `sounds.drop` → `sfx_drop_default` |
| `interactionPerformed` (acción X) | Según la acción: `eat`, `drink`, `open`, `close`, `toggle`, `spawn`… | `sounds[<acción>]` de la entidad principal de la acción → fallback por tipo de acción |
| `interactionRejected` | `sfx_reject_soft` | global |
| `walletChanged` (+) | `sfx_coin` | global |
| `sceneLoaded` / cambio de zona | música o ambiente | `zone.audio` → `scene.audio` |
| Botones de UI | `sfx_ui_tap` | global |

**Las claves de fallback** viven en `content/core/assets.json` como sonidos globales. El motor solo conoce los **nombres de rol** (`pickup`, `drop`…), no los archivos.

## 3. Reglas

- **Polifonía:** máximo **6 efectos simultáneos**. Si llega uno nuevo del mismo tipo antes de 80 ms, se descarta. Así se evita la "ametralladora" de sonidos al soltar muchos objetos.
- **Variación:** cada efecto admite **variantes** (`sfx_drop_soft_01..03`) y se elige una al azar. Además, se varía el pitch ±5 % [DESIGNED FOR LATER] si la API lo permite sin coste.
- **Música:**
  - Una pista en bucle por escena o zona.
  - **Crossfade** de 800 ms al cambiar de zona o de escena.
  - Si la zona nueva tiene la misma pista, no se reinicia.
- **Volúmenes:** `settings.musicVolume` y `settings.sfxVolume` (0..1), y `muted` global. Se aplican de inmediato.
- **Ciclo de vida:**
  - En background, la música se pausa y los efectos se cortan. Al volver se reanuda.
  - **No** se usa audio en background, ni sesión de audio que interrumpa la música del usuario, más allá de la categoría "ambient" o "mix with others".
  - ⚠️ Verificar la opción equivalente en `expo-audio`.
- **Precarga:** al entrar en una escena se precargan sus efectos (≤ 30; ver [PERFORMANCE](PERFORMANCE.md)). Los globales (UI, rechazo, moneda) están siempre cargados.

## 4. Formatos

- **Efectos de sonido:** `.m4a` (AAC), mono, 44.1 kHz, 96–128 kbps, ≤ 1,5 s y normalizados a −16 LUFS integrados aproximadamente.
- **Música y ambiente:** `.m4a` (AAC), estéreo, 128–160 kbps, en bucle sin cortes. Hay que exportar con cuidado de que no haya silencio de encoder: probar el loop en el dispositivo.
- **Convenciones de nombre:** ver [ASSET_GUIDELINES](../design/ASSET_GUIDELINES.md).

## 5. Qué NO se hace ahora

- [NOT NEEDED YET] Audio posicional o paneo estéreo según la x.
- [NOT NEEDED YET] Voces o narración (sí conviene considerarlas para accesibilidad en el futuro; ver [UI_UX_GUIDELINES](../design/UI_UX_GUIDELINES.md)).
- [DESIGNED FOR LATER] Música adaptativa (capas según la actividad).
