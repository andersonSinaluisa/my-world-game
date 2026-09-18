# Environment Guidelines

> **Status:** Proposed · **Last Updated:** 2026-09-18
> **Related:** [ART_DIRECTION](ART_DIRECTION.md) · [../data/SCENE_SCHEMA.md](../data/SCENE_SCHEMA.md) · [../architecture/RENDERING.md](../architecture/RENDERING.md) · [ASSET_GUIDELINES](ASSET_GUIDELINES.md)

## 1. Composición de una escena

```
y=0     ┌────────────────────────────────────────────── techo / cielo
        │  zona alta: decoración de pared, ventanas (wallDecor)
y≈300   │
        │  zona de juego: muebles, superficies, personajes
y≈960   ├────────────────────────────────────────────── SUELO (floor.y ≈ 960)
y=1080  └────────────────────────────────────────────── zócalo / borde inferior (HUD encima)
```

- **Suelo del MVP en `y = 960`.** Los 120 px inferiores son zócalo o acera y quedan libres para el HUD. No se coloca nada interactivo por debajo de `y = 1000`.
- **Franja segura del HUD:** los 140 px superiores pueden quedar tapados por botones de la UI en teléfonos. Lo interactivo esencial va **por debajo de `y = 160`**.
- **Regla de `snapCameraX`:** al saltar a una zona, la vista de 1440 unidades centrada en `snapCameraX` tiene que incluir los elementos esenciales **y los portales** de esa zona (por ejemplo, la puerta de la calle en el salón).
- **Regla de ancho de zona:** lo esencial de una zona cabe en **1440 unidades** (vista de iPad, ver [ADR-007](../decisions/ADR-007-VIRTUAL-COORDINATES.md)). Las zonas miden 1920 en el MVP: los 480 restantes son "respiro" o decoración.

## 2. Fondos

- **Se exportan en chunks de 1920 × 1080** (máximo 2048 de ancho). Nombre: `env_{scene}_bg_{zone}_{nn}`.
- Los chunks contiguos **tienen que empalmar sin costura**. Las paredes divisorias entre habitaciones se dibujan dentro de un chunk, no en el borde.
- **Capas de parallax** (solo en exteriores, como la calle): `sky` (0,2), `far` (0,5) y `main` (1,0). En interiores, una sola capa.
- El fondo **no contiene objetos interactivos**: todo lo tocable es una entidad.

## 3. Densidad de interacción

- **Cada zona tiene al menos 3 elementos "tocables"** con respuesta: abrir, encender, generar, sentarse, etc.
- **Cada zona tiene al menos 1 contenedor o superficie** donde dejar cosas.
- Evitar objetos puramente decorativos que parezcan interactivos. Si parece tocable, tiene que hacer algo.

## 4. Muebles y props

| Tipo | Tamaño típico (unidades) | Notas |
|---|---|---|
| Objeto pequeño (fruta, juguete) | 60–120 | Hitbox con padding para llegar a ≥ 64 dp |
| Prenda suelta | 90–130 | |
| Silla | 120 × 220 | `seat.anchor` a la altura del asiento |
| Mesa | 260–360 × 180–220 | `surface` en el tablero |
| Cama | 420 × 260 | `bed.anchor` + `surface` + `coverAsset` |
| Nevera, armario | 220–260 × 420–480 | Sprite abierto y cerrado; interior con `slots` |
| Puerta (portal) | 180 × 380 | Marco en `foreground` si el personaje "entra" |

- **Pivot** en el centro inferior (la base apoyada).
- **Superficies:** se declaran como segmentos en el prefab. Hay que medirlos sobre el sprite (la línea del tablero).
- **Sprites por estado:** el mismo lienzo y el mismo pivot en todos los estados (cerrado y abierto), para evitar saltos.

## 5. Escenas del MVP

| Escena | Ancho | Zonas | Portales y spawns |
|---|---|---|---|
| `core:home` | 7680 | living, kitchen, bedroom, bathroom (1920 cada una) | `front_door` (salón → calle), spawn `default` |
| `core:street` | 5760 | frente de casa, parque pequeño, frente de tienda | `home_door`, `store_door` |
| `core:store` | 3840 | entrada, estantes, caja | `entrance` |

## 6. Checklist de una escena nueva

- [ ] JSON válido (`npm run content:validate`).
- [ ] Suelo y superficies medidos sobre el arte.
- [ ] Chunks ≤ 2048 px y sin costuras.
- [ ] Zonas probadas en aspecto 4:3 y 20:9.
- [ ] ≥ 3 interacciones por zona.
- [ ] Entidades dentro del presupuesto de [PERFORMANCE](../architecture/PERFORMANCE.md).
- [ ] Música o ambiente asignados.
