# Character Guidelines

> **Status:** Proposed · **Last Updated:** 2026-09-18
> **Related:** [ART_DIRECTION](ART_DIRECTION.md) · [../architecture/CHARACTER_SYSTEM.md](../architecture/CHARACTER_SYSTEM.md) · [../data/CHARACTER_SCHEMA.md](../data/CHARACTER_SCHEMA.md) · [ASSET_GUIDELINES](ASSET_GUIDELINES.md)

## 1. Proporciones

| Tipo de cuerpo | Altura (world units) | Cabeza : cuerpo | Notas |
|---|---|---|---|
| `child` | 300 | 1 : 1,8 | Cabeza grande y piernas cortas |
| `adult` | 420 | 1 : 2,5 | Más alto, misma cabeza (reutiliza partes de la cara) |

- **Las partes de la cara (ojos, boca) son las mismas** para los dos cuerpos. Cambia la posición del ancla, no el sprite. Así se reduce el arte a la mitad.
- Ancho aproximado: `child` 150, `adult` 170.

## 2. Lienzo y pivot

- Todas las capas de un tipo de cuerpo se exportan en **el mismo lienzo**. Propuesta: `child` 320×340 y `adult` 340×460.
- El **pivot** va en el **centro inferior**, entre los pies.
- Se exportan con el lienzo completo, sin recortar, para que se superpongan sin offsets. El peso extra de alpha es aceptable porque WebP comprime bien las zonas transparentes.
- Anclas por pose (`handAnchors`, `mouthAnchor`) medidas en px del lienzo respecto al pivot, y registradas en `parts.json`.

## 3. Capas y orden

Ver el orden normativo en [CHARACTER_SCHEMA §3](../data/CHARACTER_SCHEMA.md). Para el artista:

- **Brazos separados del torso**, para poder sostener objetos delante del cuerpo.
- **Pelo en dos capas** (`hairBack` detrás del cuerpo y `hairFront` delante de la cara), para peinados largos y flequillos.
- **Ropa por capas coincidentes** con el cuerpo: torso, brazos izquierdo y derecho, piernas y pies.

## 4. Tintes

- **Piel y pelo:** se pintan en **escala de grises con valores medios** (el tono base alrededor del 70–75 % de luminosidad, las sombras un 15 % más oscuras) para que el tinte multiplicativo dé colores limpios.
- **Contorno de piel y pelo:** también en gris; se tiñe junto con el relleno, así que queda "del color del relleno más oscuro" de forma automática.
- **Ropa:** a color final, sin tinte en el MVP.

## 5. Poses (por tipo de cuerpo)

| Pose | Capas que cambian | Notas |
|---|---|---|
| `idle` | todas (base) | De frente, brazos relajados |
| `dangle` | piernas (colgando) y brazos (levantados ligeramente) | Se reutilizan la cabeza y el torso |
| `sit` | piernas (flexionadas de frente) y torso (opcional) | El pivot se mantiene; el ancla del asiento coloca al personaje |
| `sleep` | cuerpo completo acostado (rotado 90°, con arte propio) | La manta de la cama cubre las piernas |
| `eat` / `drink` | brazo derecho hacia la boca | La boca usa la expresión `yum` |

**Ropa por pose:** las prendas necesitan variante en `sit` (pantalón flexionado) y en `sleep` (solo la parte visible sobre la manta). Si falta una variante, se usa la de `idle` y el validador emite una **advertencia**.

## 6. Expresiones

Cada expresión se resuelve con **boca + ojos**. No hay caras completas por expresión.

| Expresión | Ojos | Boca |
|---|---|---|
| `neutral` | abiertos | la elegida por el jugador |
| `happy` | abiertos (curvados, opcional) | sonrisa amplia |
| `surprised` | abiertos | "o" |
| `sleepy` | cerrados (`closedAsset`) | pequeña |
| `yum` | cerrados felices | masticando |
| `curious` | abiertos | ladeada |

Todas las bocas (6) deben tener sus variantes por expresión, **o** usar las bocas genéricas por expresión del catálogo. Propuesta para el MVP: **bocas genéricas por expresión**, y la boca elegida por el jugador solo para `neutral`.

## 7. Diversidad e inclusión

- 8 tonos de piel que cubren el rango de claros a oscuros, **validados en el dispositivo** para garantizar el contraste del contorno.
- Peinados diversos: rizado, afro, trenzas, liso, corto, moños, rapado y coletas.
- Nada de rasgos estereotipados. La ropa no está ligada al género: toda prenda es seleccionable para cualquier personaje.

## 8. Checklist de entrega por pieza

- [ ] Lienzo y pivot correctos.
- [ ] Nombre según [ASSET_GUIDELINES](ASSET_GUIDELINES.md) (`chr_…`).
- [ ] Probado superpuesto con el resto de capas en las 6 poses.
- [ ] Legible a 1× en un teléfono de 6".
- [ ] Fuente vectorial o PSD entregada al repositorio de arte.
