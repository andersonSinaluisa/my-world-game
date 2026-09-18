# ADR-010 — Tinte de piel y pelo con ColorMatrix

> **Status:** Proposed (pendiente de validar en dispositivo con el arte final) · **Last Updated:** 2026-09-19
> **Related:** [CHARACTER_SYSTEM §4](../architecture/CHARACTER_SYSTEM.md) · HU-GAME-013 · HU-GAME-018 · HU-GAME-020

## Contexto

La piel y el pelo se dibujan en escala de grises y se tiñen en runtime, para que 8 tonos × N partes cuesten N sprites y no 8N ([CHARACTER_SYSTEM §4](../architecture/CHARACTER_SYSTEM.md)). La HU-GAME-013 pide decidir la técnica en un spike: `ColorMatrix` o `BlendMode.Multiply`.

## Decisión

Se usa un **`ColorMatrix` de Skia por capa**, con la matriz de multiplicación:

```
[r 0 0 0 0,
 0 g 0 0 0,
 0 0 b 0 0,
 0 0 0 1 0]      // r, g, b = color del tono / 255
```

- Multiplica el gris del sprite por el color del tono y **no toca el alfa**, así que las zonas transparentes siguen transparentes. `BlendMode.Multiply` con un color opaco sí altera el alfa del resultado y obliga a enmascarar la capa.
- Es un filtro por `Image`: no hace falta un `saveLayer` ni un shader propio ([RENDERING §8](../architecture/RENDERING.md)).
- La matriz se calcula en JS una vez por tono (`tintMatrix`, pura y con tests) y se memoiza por capa.
- El sombreado del arte en gris se conserva: un gris al 75 % da el tono al 75 %.

## Consecuencias

- El arte de piel y pelo se pinta **claro** (cerca del blanco) con sombras en gris medio. Los contornos oscuros se oscurecen con el tono, lo cual es aceptable.
- Tonos muy claros sobre gris (rubio, blanco) funcionan si el gris base es claro. Si con el arte final el resultado no convence, el **plan B** sigue siendo el de CHARACTER_SYSTEM §4: sprites pre-coloreados.
- **Pendiente para pasar a Accepted:** captura en Android de gama baja e iOS con los 8 tonos y los 8 colores de pelo sobre el arte de producción, revisada por arte (DoD de HU-GAME-013 y HU-GAME-020).
