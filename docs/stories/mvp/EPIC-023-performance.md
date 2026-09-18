# EPIC-023 — Performance

> **Status:** Draft · **Last Updated:** 2026-09-18 · **Fase:** 1
> **Docs:** [PERFORMANCE](../../architecture/PERFORMANCE.md) · [RENDERING §10](../../architecture/RENDERING.md) · [SAVE_SYSTEM §3](../../architecture/SAVE_SYSTEM.md) · [SCENE_SYSTEM §4](../../architecture/SCENE_SYSTEM.md) · [ADR-009](../../decisions/ADR-009-STATE-AND-THREADING.md)

## Objetivo del epic
Medir, no suponer: un overlay de desarrollo y un procedimiento de medición en release que permitan comprobar en los dispositivos de referencia los presupuestos target/warning/critical de [PERFORMANCE §2](../../architecture/PERFORMANCE.md#presupuestos), y que cada HU que afecte al render, al input o a la carga anote su resultado.

## Historias
- [HU-GAME-071 — Overlay de rendimiento y verificación de presupuestos](#hu-game-071--overlay-de-rendimiento-y-verificación-de-presupuestos)

---

## HU-GAME-071 — Overlay de rendimiento y verificación de presupuestos

> **Status:** Draft
> **Epic:** EPIC-023 · **Fase:** 1 · **Alcance:** MVP P1
> **Last Updated:** 2026-09-18

### Epic
EPIC-023 — Performance

### Prioridad
Must · P1

### Historia
Como **desarrollador**
quiero **un overlay con FPS, entidades, memoria de texturas y tiempos de transición y guardado**
para **verificar en dispositivos reales que el juego cumple sus presupuestos antes de cerrar cada HU**.

### Contexto
[PERFORMANCE §3](../../architecture/PERFORMANCE.md) define qué se mide y cómo; [RENDERING §10](../../architecture/RENDERING.md) lista las métricas del render. Los dispositivos de referencia están en [PERFORMANCE §1](../../architecture/PERFORMANCE.md#dispositivos) (Android bajo ~3 GB, clase Snapdragon 680 / Helio G85; iOS bajo iPhone 11 / iPad 9.ª gen.).

### Reglas de negocio
- **RN-1:** Métricas del overlay: FPS del UI thread (`useFrameCallback` de Reanimated, media de deltas), FPS del JS thread (`requestAnimationFrame`), entidades montadas (tras culling) y cargadas, memoria estimada de texturas (suma de `w × h × 4` en caché), tiempo de la última transición y del último flush.
- **RN-2:** Cada métrica se colorea según su umbral:

| Métrica | Target | Warning | Critical |
|---|---|---|---|
| FPS UI thread | 60 | < 55 media 10 s | < 45 |
| FPS JS thread | ≥ 50 | < 40 | < 25 |
| Respuesta del drop | ≤ 50 ms | > 100 ms | > 200 ms |
| Memoria de texturas | ≤ 150 MB | > 200 MB | > 280 MB |
| Entidades renderizadas | ≤ 120 | > 180 | > 250 |
| Entidades cargadas | ≤ 300 | > 450 | > 600 |
| Transición entre escenas | ≤ 1,0 s | > 1,5 s | > 2,5 s |
| Autosave (flush) | ≤ 20 ms | > 50 ms | > 100 ms |

- **RN-3:** Visible solo en `__DEV__` o con un flag de build (propuesta: variable de entorno en la build interna de QA). **Nunca** accesible en la build que va a las tiendas ni por un gesto que un niño pueda descubrir.
- **RN-4:** El overlay no debe costar más de 1 fps en el UI thread: se actualiza a 2 Hz (propuesta) y no provoca re-renders por frame del mundo.
- **RN-5:** Las mediciones de hito se hacen **en release** (`expo run:android --variant release`), completando con Android Studio Profiler / Xcode Instruments para la RAM total (target ≤ 350 MB, warning > 450, critical > 600).
- **RN-6:** Escenario de estrés de referencia: Home con 12 personajes en el salón, 60 objetos visibles, arrastrar un objeto de punta a punta con auto-scroll y mantenerlo 30 s.
- **RN-7:** El resultado de cada medición se anota en la HU afectada (DoD §4) con dispositivo, build, fecha y valores.
- **RN-8:** Arranque en frío hasta Title interactivo (target ≤ 3 s) y Title → escena jugable (≤ 1,5 s) se miden con marcas de tiempo registradas por el overlay (propuesta).

### Criterios de aceptación
```gherkin
Scenario: el overlay muestra las métricas
  Given una build de desarrollo con el overlay activado
  When el jugador está en "core:home"
  Then el overlay muestra FPS UI, FPS JS, entidades montadas y cargadas, memoria de texturas, última transición y último flush

Scenario: colores por umbral
  Given una métrica de flush de 60 ms
  When el overlay la muestra
  Then aparece con el color de "warning"

Scenario: registro de la última transición
  Given el overlay activo
  When el jugador cruza una puerta
  Then el valor "última transición" se actualiza con la duración medida de la transición

Scenario: fuera de la build de tiendas
  Given una build release sin el flag de QA
  When se inspecciona el árbol de UI
  Then el overlay no existe

@performance @manual
Scenario: escenario de estrés en el Android de referencia
  Given una build release de QA en el Android de referencia
  When se ejecuta el escenario de estrés de PERFORMANCE §3 durante 30 s
  Then el UI thread mantiene ≥ 55 fps de media, las entidades renderizadas son ≤ 120 y la memoria de texturas ≤ 150 MB
  And los valores se anotan en esta HU
```
Incluye: AC-PERF-01. Ver [../ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md).

### Casos límite
- Pantallas de 120 Hz: el objetivo sigue siendo ≥ 60 fps; el overlay muestra el valor real.
- Estimación de memoria de texturas distinta de la real: se contrasta con el profiler nativo en cada hito.
- Build de dev con números deformados: los resultados de dev no cierran una HU.

### Dependencias
- HU-GAME-006: renderizar entidades por capas y orden z.

### Consideraciones técnicas
- UI del overlay en `ui/` (RN View encima de la Canvas); las métricas llegan por el GameFacade y por SharedValues. Sin dependencias nuevas.
- Atlas con `drawAtlas`: [DESIGNED FOR LATER], solo si las mediciones lo exigen.
- [NEEDED NOW].

### Assets necesarios
- Ninguno (texto monoespaciado del sistema, solo para desarrolladores).

### Definition of Done
Aplica el [DoD global](../DEFINITION_OF_DONE.md). Específico de esta HU:
- [ ] implementación del overlay y del flag de QA
- [ ] pruebas unitarias del cálculo de medias y umbrales
- [ ] rendimiento: primera medición del escenario de estrés en Android e iOS de referencia anotada
- [ ] documentación: procedimiento de medición reproducible
