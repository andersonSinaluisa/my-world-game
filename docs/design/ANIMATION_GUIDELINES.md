# Animation Guidelines

> **Status:** Proposed · **Last Updated:** 2026-09-18
> **Related:** [../architecture/RENDERING.md §9](../architecture/RENDERING.md) · [../architecture/CHARACTER_SYSTEM.md](../architecture/CHARACTER_SYSTEM.md) · [UI_UX_GUIDELINES](UI_UX_GUIDELINES.md)

## 1. Filosofía

- **La animación es feedback**: cada toque tiene que obtener una respuesta visible en **≤ 100 ms**.
- Movimientos **blandos y elásticos**, a juego con el estilo "Soft Paper Toy". Nada brusco ni que asuste.
- **Barata:** tweens de transformación (escala, rotación, traslación) sobre sprites. Sin animación por frames en el P0.

## 2. Presets de tween (`TweenPresetId`)

Los usa el componente `animations` y los efectos del motor. Duraciones y curvas en valores propuestos, a ajustar en el dispositivo.

| Preset | Uso | Transformación | Duración | Curva |
|---|---|---|---|---|
| `bounce` | tap en un objeto, aparición | escala 1 → 1,12 → 0,96 → 1 | 280 ms | spring (damping 12) |
| `squash` | al caer o apoyarse | scaleY 0,85 / scaleX 1,1 → 1 | 180 ms | ease-out |
| `wiggle` | curiosidad, objeto "llama la atención" | rotación ±6° × 2 | 360 ms | ease-in-out |
| `pulse` | resaltar un destino válido durante el drag | escala 1 ↔ 1,05 en bucle | 600 ms por ciclo | sine |
| `shake` | **rechazo** (AC-REJECT-01) | traslación x ±8 × 3 | 240 ms | lineal |
| `spin` | recoger una moneda | rotación Y simulada (scaleX 1 → −1 → 1) + subir | 400 ms | ease-out |
| `lift` | al empezar un drag | escala 1,05 + sombra + subir `liftOffset` | 120 ms | ease-out |

## 3. Personajes

| Animación | Técnica |
|---|---|
| Respiración (`idle`) | scaleY 1 ↔ 1,015, 2,4 s, un reloj compartido con desfase por personaje |
| Balanceo (`dangle`) | rotación proporcional a la velocidad horizontal del drag (±12°), con retorno spring |
| Parpadeo | Cambio a `closedAsset` durante 120 ms cada 3–6 s (aleatorio). Un temporizador global que elige personajes. |
| Comer y beber | Sprite del brazo a la boca + boca `yum` + 2 "bocados" de escala en el objeto (900 ms en total) |
| Sentarse o acostarse | Snap al ancla con spring de 200 ms |

## 4. Efectos (partículas simples)

- Migas al comer, estrellitas al recoger una moneda y "puf" al aparecer un objeto del dispensador.
- **Máximo 12 partículas por efecto** y **3 efectos simultáneos**. Son sprites Skia con tween, no un sistema de partículas.
- Assets: `fx_crumbs_01`, `fx_sparkle_01`, `fx_poof_01`.

## 5. Transiciones de escena

- Fundido a color (`#FFF6E9`) de 300 ms, carga, y fundido de entrada de 300 ms.
- Si la carga supera 600 ms: un icono lúdico animado (una casita que da saltitos), sin texto.

## 6. Reglas

1. **Nunca se bloquea la entrada** por una animación de feedback. Solo se bloquea durante las transiciones de escena.
2. Las animaciones de presentación **no cambian el estado lógico**. El estado se aplica al instante y la animación lo "adorna".
3. `reduceMotion` [DESIGNED FOR LATER] (HU-GAME-110): sustituye `wiggle`/`bounce`/`shake` por fades cortos y desactiva el balanceo.
4. Todas las animaciones de alta frecuencia van en el UI thread (Reanimated/Skia). Ver [ADR-009](../decisions/ADR-009-STATE-AND-THREADING.md).
