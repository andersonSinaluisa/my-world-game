# Definition of Done (DoD), global

> **Status:** Accepted · **Last Updated:** 2026-09-18
> **Related:** [DEFINITION_OF_READY](DEFINITION_OF_READY.md) · [../ai/DEVELOPMENT_RULES.md](../ai/DEVELOPMENT_RULES.md) · [../architecture/PERFORMANCE.md](../architecture/PERFORMANCE.md)

Una HU está **Done** solo si cumple todo lo que aplique. Cada HU puede **añadir** criterios propios, pero nunca quitar los globales.

## 1. Implementación
- [ ] Se cumplen **todos** los criterios de aceptación de la HU.
- [ ] Respeta las reglas de dependencia de capas ([ARCHITECTURE §2](../architecture/ARCHITECTURE.md)). `engine/core|systems|actions|rules|content` no importan React, RN, Skia ni Expo.
- [ ] No hay lógica específica por objeto ni por escena (nada de `if prefabId === …`).
- [ ] No hay coordenadas ni contenido hardcodeados en el código. Todo sale de `content/`.
- [ ] TypeScript `strict` sin errores, `expo lint` sin errores y sin `any` nuevos injustificados.
- [ ] Sin dependencias nuevas sin justificar en la HU o en un ADR.

## 2. Pruebas
- [ ] **Unit tests** de la lógica nueva (systems, actions, conditions, serializers).
- [ ] **Integration tests** en el harness headless ([HU-GAME-002](mvp/EPIC-001-foundation.md)) para cada escenario Given/When/Then automatizable.
- [ ] Los escenarios que dependen del dispositivo (gestos, render, rendimiento) tienen una **verificación manual documentada** en la HU: pasos y resultado.
- [ ] La suite completa pasa (`npm test`) y `npm run content:validate` pasa.
- [ ] **Sin regresiones:** los tests existentes siguen verdes y los fixtures de guardado de versiones anteriores siguen cargando (HU-GAME-072).

## 3. Móvil (Android e iOS)
- [ ] Probado en **Android** (dispositivo físico o emulador de gama media-baja de referencia; ver [PERFORMANCE](../architecture/PERFORMANCE.md#dispositivos)).
- [ ] Probado en **iOS** (dispositivo o simulador).
- [ ] Probado en **landscape**, con notch y safe areas y con un aspecto de tablet (4:3).
- [ ] Sin warnings nuevos en la consola en modo dev.

## 4. Rendimiento
- [ ] No empeora los presupuestos "target" de [PERFORMANCE](../architecture/PERFORMANCE.md#presupuestos). Si la HU afecta al render, al input o a la carga, se mide con el overlay (HU-GAME-071) y se anota el resultado en la HU.
- [ ] No hay re-renders de React por frame durante el drag ni el paneo.

## 5. Persistencia (cuando aplica)
- [ ] El estado nuevo sobrevive a:
  1. cambiar de escena y volver;
  2. mandar la app a background y matarla;
  3. reiniciar el dispositivo.
- [ ] Si cambia el formato persistido: se incrementa `saveVersion`, hay una migración y un fixture de test.

## 6. Accesibilidad e infancia
- [ ] Los objetivos táctiles nuevos cumplen: botones de juego ≥ 64 dp, UI de ajustes para adultos ≥ 48 dp y objetos del mundo ≥ 44 dp efectivos (ver [INPUT_SYSTEM §8](../architecture/INPUT_SYSTEM.md)).
- [ ] La funcionalidad se entiende **sin leer**: iconos, animación y sonido.
- [ ] Los elementos de UI nuevos tienen `accessibilityLabel` (i18n).
- [ ] Nada de fallos "castigadores": los rechazos son amables (shake + sonido suave).
- [ ] No hay enlaces externos, compras ni datos personales sin la puerta parental.

## 7. Documentación
- [ ] Si cambió la arquitectura, un schema o una convención, se actualizó el documento correspondiente y su `Last Updated`.
- [ ] La HU queda marcada como Done en [BACKLOG](BACKLOG.md), y [TRACEABILITY](../TRACEABILITY.md) está actualizada si cambiaron los sistemas o los tests.
- [ ] Las decisiones nuevas tienen su ADR.
