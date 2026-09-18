# UI/UX Guidelines

> **Status:** Proposed · **Last Updated:** 2026-09-18
> **Related:** [TARGET_AUDIENCE](../product/TARGET_AUDIENCE.md) · [ANIMATION_GUIDELINES](ANIMATION_GUIDELINES.md) · [../architecture/INPUT_SYSTEM.md](../architecture/INPUT_SYSTEM.md)
> **Related Epic:** EPIC-022, EPIC-026, EPIC-005, EPIC-010

## 1. Principios

1. **Sin leer:** iconos + animación + sonido. El texto solo aparece en la zona de adultos.
2. **Grande y generoso:**
   - botones de juego ≥ **64 dp** (recomendado 72 dp);
   - UI de adultos ≥ **48 dp**;
   - separación entre botones ≥ 12 dp.
3. **Pocos botones en pantalla:** el mundo es la interfaz. El HUD es mínimo y está en las esquinas.
4. **Respuesta inmediata:** cada toque produce una animación y un sonido en ≤ 100 ms.
5. **Sin castigo:** no hay mensajes de error. Los rechazos son amables (shake + sonido suave).
6. **Nada inesperado:** ningún toque accidental saca al niño del juego ni abre nada externo.

## 2. Layout del HUD (Play)

```
┌──────────────────────────────────────────────────────────────┐
│ [🗺 Mapa]                                   [🪙 35] [⚙ Adulto] │   ← esquinas superiores (safe area)
│                                                              │
│                        MUNDO (Skia)                           │
│                                                              │
│ [👤 Personajes]                                  [🎒 Mochila] │   ← esquinas inferiores
└──────────────────────────────────────────────────────────────┘
```

| Elemento | Posición | Función | HU |
|---|---|---|---|
| Mapa | Arriba a la izquierda | Ubicaciones y zonas de la casa | HU-GAME-051 |
| Monedero | Arriba a la derecha | Muestra las monedas (solo lectura) | HU-GAME-065 |
| Ajustes (adulto) | Arriba a la derecha, pequeño | Abre la **puerta parental** → ajustes | HU-GAME-074/075 |
| Personajes | Abajo a la izquierda | Lista o creador. Arrastrar un retrato coloca o trae al personaje. | HU-GAME-022/023 |
| Mochila | Abajo a la derecha | Drop target + bandeja de 12 slots | HU-GAME-037/038 |

- Todos respetan las **safe areas** (notch, barras de gestos).
- El HUD usa Views de RN, no Skia (ver [RENDERING §1](../architecture/RENDERING.md)).
- **Mientras se arrastra**, el HUD se atenúa (opacidad 0,6), excepto la mochila, que se resalta como destino.

## 3. Pantallas

| Pantalla | Contenido | Notas |
|---|---|---|
| **Title** | Botón grande "Jugar" (icono de play), animación del mundo detrás y el acceso para adultos pequeño | Si no hay personajes, "Jugar" lleva al creador (HU-GAME-073) |
| **Creator** | Vista previa grande del personaje, pestañas con iconos (cuerpo, piel, cara, pelo y ropa), rejilla de opciones y ✔ para terminar | Cambios en vivo. Sin texto. |
| **Play** | Mundo + HUD | — |
| **Settings (adultos)** | Volumen de música y de efectos, silencio, idioma, reiniciar el mundo y créditos/licencias | Solo tras la puerta parental. Tiene texto. |

## 4. Puerta parental (HU-GAME-074)

- **Requisito:** debe ser trivial para un adulto y **difícil de adivinar para un niño que no lee**.
- **Decisión (propuesta aceptada en HU-GAME-074):**
  1. Mantener pulsado el botón de adulto durante **3 s**.
  2. Resolver una **multiplicación de un número de dos cifras por uno de una cifra** (por ejemplo "12 × 3"), escribiendo el resultado con un **teclado numérico**.
  - Sin opción múltiple: con tres opciones, un niño acierta 1 de cada 3 veces al azar. Sin voz.
  - Los números cambian en cada intento.
- **Tras 3 fallos:** bloqueo de 30 s, con una animación neutra.
- **La puerta se cierra** tras 60 s de inactividad dentro de la zona de adultos.
- **Protege:** ajustes, reinicio del mundo, enlaces externos y compras futuras.

## 5. Texto e idiomas

- Idiomas del MVP: **español e inglés** (`locales/es.json`, `locales/en.json`).
- **Una sola fuente de textos:** los de la UI de la app (`ui.*`) y los del contenido (`object.*`, `scene.*`…) viven en `content/<pack>/locales/*.json`. Se leen con `ContentRegistry.t(key, locale)` y el hook `useT()` de `game/`.
- **Idioma por defecto:** `es` si el idioma del dispositivo es español; en cualquier otro caso, `en`. Se detecta con `expo-localization` (dependencia justificada, se instala en HU-GAME-075). Se puede cambiar en ajustes.
- **Fuente:** redondeada y legible (propuesta: *Fredoka* o *Baloo 2*, ambas con licencia OFL). Se carga con `expo-font`.
- Todo elemento de UI tiene `accessibilityLabel` traducido, aunque visualmente no muestre texto.

## 6. Accesibilidad (MVP)

| Requisito | Criterio |
|---|---|
| Objetivos táctiles | Botones del HUD y el creador ≥ 64 dp · ajustes (adultos) ≥ 48 dp · objetos del mundo ≥ 44 dp efectivos (ampliación automática del hit testing, [INPUT_SYSTEM §8](../architecture/INPUT_SYSTEM.md)) |
| Contraste | Iconos y texto de UI ≥ 4.5:1 sobre su fondo |
| Color | Nunca como única señal: hay que combinarlo con forma o icono |
| Sonido | Siempre acompañado de feedback visual, para que se pueda jugar en silencio |
| Lectores de pantalla | `accessibilityLabel`/`Role` en la UI de RN. El mundo Skia no es navegable por lector en el MVP (limitación aceptada; revisar en POST-MVP). |

POST-MVP (HU-GAME-110): reducir movimiento, modo para daltonismo, modo zurdo (HUD espejado) y narración por voz.
