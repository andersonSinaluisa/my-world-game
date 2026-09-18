# Art Direction

> **Status:** Proposed. Hay que validarla con un ilustrador antes de la Fase 1. · **Last Updated:** 2026-09-18
> **Related:** [CHARACTER_GUIDELINES](CHARACTER_GUIDELINES.md) · [ENVIRONMENT_GUIDELINES](ENVIRONMENT_GUIDELINES.md) · [ASSET_GUIDELINES](ASSET_GUIDELINES.md) · [research/ASSET_MARKET_RESEARCH.md](research/ASSET_MARKET_RESEARCH.md)

## 1. Nombre del estilo: "Soft Paper Toy"

Un mundo que parece hecho de **juguetes de papel y fieltro**: formas blandas, contornos de color y una textura táctil sutil. Tiene que resultar cálido, tranquilo y "tocable".

### Pilares

| Pilar | Descripción | Evitar |
|---|---|---|
| **Formas de frijol** | Siluetas redondeadas, sin esquinas duras. Los muebles tienen radios generosos. | Ángulos agudos, perspectiva exagerada |
| **Contorno de color** | Línea de 4–6 px (a 1×) en un **tono más oscuro del relleno**, nunca negro puro | Contorno negro uniforme (estilo cartoon genérico) o sin contorno (estilo flat de Toca) |
| **Sombreado mínimo** | 1 tono de sombra + 1 brillo opcional. Sombra hacia abajo a la derecha, luz arriba a la izquierda. | Degradados complejos, render 3D, realismo |
| **Textura de papel** | Grano muy sutil (2–4 % de opacidad) en los fondos grandes | Texturas ruidosas en los objetos pequeños, que ensucian la lectura |
| **Paleta pastel con acentos** | Bases pastel y un acento saturado por objeto para que se lea en pantalla | Todo pastel (se pierde el contraste) o todo neón |
| **Vista frontal** | Habitaciones de frente (corte de casa de muñecas). Los objetos van de frente o en un 3/4 muy leve. | Isométrico, cenital, perspectiva fuerte |

## 2. Diferenciación frente a juegos del género

| Juego de referencia (NO copiar) | Rasgo del referente | Nuestro rasgo |
|---|---|---|
| Toca Boca World | Formas flat sin contorno, colores planos saturados, narices muy estilizadas | Contorno de color, textura de papel, sombreado de 1 tono |
| Avatar World / Pazu | Ojos grandes y brillantes de influencia anime, acabado brillante | Ojos pequeños ovalados con un brillo, mejillas rosadas y acabado mate |
| Game World | (Referencia conceptual del usuario) | Identidad propia definida aquí |

> **Regla:** no usar referencias visuales directas de esos juegos en los briefs de arte. Los moodboards se construyen con juguetes físicos, libros ilustrados infantiles y papel recortado.

## 3. Paleta base (propuesta)

| Rol | Nombre | Hex |
|---|---|---|
| Fondo cálido | Crema | `#FFF6E9` |
| Pared A | Melocotón suave | `#FFD9C2` |
| Pared B | Menta | `#CDEFE3` |
| Pared C | Lavanda | `#E3DAF7` |
| Suelo madera | Miel | `#E8B97E` |
| Acento 1 | Coral | `#FF6F61` |
| Acento 2 | Amarillo sol | `#FFC93C` |
| Acento 3 | Azul cielo | `#4FB3F6` |
| Acento 4 | Verde hoja | `#5CC689` |
| Acento 5 | Frambuesa | `#E8467C` |
| Texto y UI oscuro | Ciruela | `#3E2C4A` |
| Contorno genérico | Ciruela 70 % | `#5B4668` |

- Los contornos de cada objeto se calculan como el color de relleno oscurecido entre un 35 y un 45 % (en HSL, bajando la luminosidad).
- Los tonos de piel (8) y los colores de pelo (8) se definen en `content/core/characters/parts.json` y se validan con este documento (ver [CHARACTER_GUIDELINES](CHARACTER_GUIDELINES.md)).

## 4. Luz y hora del día

- **MVP:** iluminación única de día.
- **POST-MVP:** variaciones de noche mediante overlays de tinte (lámparas `switchable` que "iluminan" con un halo aditivo sencillo).

## 5. Placeholders y arte final

- En las Fases 0–1 se permiten **placeholders CC0** (Kenney, Glitch; ver [FREE_ASSETS](research/FREE_ASSETS.md)) marcados con `placeholder: true`.
- **El arte final se encarga** a un ilustrador con cesión total de derechos. Ver la recomendación en [ASSET_MARKET_RESEARCH](research/ASSET_MARKET_RESEARCH.md).
- **Una release no puede contener placeholders** (lo comprueba el validador `--release`).

## 6. Entregables de arte para aprobar esta dirección

1. Moodboard (sin capturas de juegos competidores).
2. Hoja de estilo: 1 personaje niño + 1 adulto, 5 objetos (manzana, silla, nevera, camiseta, lámpara) y 1 fondo de habitación.
3. Prueba en el dispositivo: legibilidad a 1× en un teléfono de 6" y en un iPad.
4. Prueba de tinte de piel y pelo (spike, [CHARACTER_SYSTEM §4](../architecture/CHARACTER_SYSTEM.md)).
