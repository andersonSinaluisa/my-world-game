# MVP Scope

> **Status:** Accepted (v1) · **Last Updated:** 2026-09-18
> **Related:** [GAME_VISION](GAME_VISION.md) · [ROADMAP](ROADMAP.md) · [../stories/BACKLOG.md](../stories/BACKLOG.md) · [../stories/EPICS.md](../stories/EPICS.md)

## 1. Definición

**El MVP = las Fases 0, 1 y 2 del [ROADMAP](ROADMAP.md).**

Es un juego **offline** y en **landscape** para iOS y Android con tres ubicaciones: **Casa**, **Calle** y **Tienda**. En él, un niño puede:
- crear personajes;
- llevarlos por la casa;
- vestirlos, sentarlos y acostarlos;
- darles de comer y de beber;
- abrir muebles, guardar y sacar objetos, y llevarlos en la mochila;
- ir a la tienda a comprar cosas con monedas del juego.

**Todo lo que deja en un sitio sigue ahí cuando vuelve.**

## 2. Qué incluye

### Ubicaciones y escenas

| Ubicación | Escena | Zonas | Ancho (world units) |
|---|---|---|---|
| Casa | `core:home` | salón, cocina, dormitorio, baño | 7680 |
| Calle | `core:street` | acera con casa, tienda y parque pequeño | 5760 |
| Tienda | `core:store` | entrada, estantes, caja | 3840 |

### Personajes

- **Creador de personajes** con: cuerpo (2 tipos: niño, adulto), piel (8 tonos), ojos (6), boca (6), peinado (8), color de pelo (8) y ropa inicial (camiseta, pantalón y zapatos).
- **Hasta 12 personajes.**
- **Poses:** de pie, colgando (mientras se arrastra), sentado, durmiendo, comiendo y bebiendo.
- **Expresiones:** neutral, feliz, sorprendido, dormido, "ñam" y curioso.

### Interacciones

Arrastrar · recoger (sostener en la mano) · soltar · abrir · cerrar · comer · beber · sentarse · dormir · vestirse · quitarse ropa · encender/apagar · guardar en un contenedor · guardar en la mochila · comprar · viajar por puertas.

### <a id="objetos"></a>Objetos: 46 prefabs interactivos + 15 prendas

| Zona | Prefabs (capacidades) |
|---|---|
| **Salón (10)** | sofá (`seat`, 1 plaza en MVP; varias plazas [DESIGNED FOR LATER]), sillón (`seat`), mesa de centro (`surface`), TV (`switchable`), lámpara de pie (`switchable`), caja de juguetes (`container`+`openable`, acepta `toy`), osito (`toy`), pelota (`toy`), libro (`toy`), maceta (`decor`, arrastrable) |
| **Cocina (14)** | nevera (`container`+`openable`, acepta `food`/`drink`), mesa redonda (`surface`), silla (`seat`), cocina/fogón (`switchable`), alacena (`container`), frutero (`spawner`: manzana), manzana (`edible`, 3 mordiscos → corazón de manzana), plátano (`edible`), sándwich (`edible`), porción de pastel (`edible`), galleta (`edible`, 1 mordisco), cartón de leche (`drinkable`), vaso de jugo (`drinkable` → vaso vacío), vaso vacío (`misc`) |
| **Dormitorio (7)** | cama (`bed`+`surface`, manta delante), armario (`container`, acepta `clothing`), mesita de noche (`surface`), lámpara de mesa (`switchable`), almohada (`toy`/`decor`), despertador (`decor`), bloques de juguete (`toy`) |
| **Baño (7)** | inodoro (`seat`), bañera (`seat`), lavabo (`switchable`: grifo), toalla (arrastrable), cepillo de dientes (arrastrable), patito de goma (`toy`), cesta de ropa (`container`, acepta `clothing`) |
| **Calle (5)** | puerta de casa (`portal`), puerta de tienda (`portal`), banco (`seat`), farola (`switchable`), buzón (`container`) |
| **Tienda (3 + productos)** | estantería (`surface`), caja registradora (tag `checkout`), expositor refrigerado (`container`). Los **productos** son instancias de prefabs existentes (comida, juguetes, ropa) con `purchasable`. |
| **Otros** | corazón de manzana y cartón de leche vacío (resultados de `onFinish`), moneda escondida (`collectible`, P2) |
| **Ropa (15)** | 6 superiores, 5 inferiores, 4 zapatos (`wearable`). **Todas** están disponibles en el creador (`starterClothes`). El **armario** (capacidad 12) empieza con 8 prendas; la tienda vende instancias adicionales. |

El recuento cumple el requisito de **entre 30 y 50 objetos interactivos**. La ropa se cuenta aparte.

### Sistemas

Guardado automático offline (SQLite) · audio (efectos, música y volumen) · mochila (12 slots) · monedero y compras · mapa de ubicaciones · puerta parental · ajustes · idiomas ES y EN.

## 3. Qué NO incluye el MVP

| Fuera del MVP | Dónde va |
|---|---|
| NPCs con comportamiento | Fase 3 (EPIC-027) |
| Mascotas | Fase 4 (EPIC-028) |
| Combinar objetos (recetas) | Fase 3 (EPIC-030) |
| Álbum de recuerdos | Fase 3 (EPIC-029) |
| Secretos elaborados | Fase 3 (EPIC-031). En el MVP solo hay monedas escondidas (P2). |
| Decorar paredes y suelos | Fase 3 (EPIC-034) |
| Accesorios (sombreros, gafas) | Fase 3 (HU-GAME-108) |
| Zoom con dos dedos, multitouch | POST-MVP |
| Packs descargables, compras reales (IAP) | Fase 7 |
| Cuentas, nube, multijugador, chat | Fase 8 / nunca (chat) |
| Analytics remotos | POST-MVP, con una política de privacidad infantil (ver [MONETIZATION](MONETIZATION.md)) |
| Tablets con assets @2x | POST-MVP (el MVP funciona en tablet, pero escalado) |

## 4. Criterios de salida del MVP

1. Las 75 HU del MVP están en **Done** (o las P2 están recortadas de forma explícita en [BACKLOG](../stories/BACKLOG.md)).
2. Se cumplen los presupuestos "target" de [PERFORMANCE](../architecture/PERFORMANCE.md) en los dispositivos de referencia.
3. **Cero** assets `placeholder` en la build de release.
4. Prueba con **al menos 5 niños** del público objetivo: pueden jugar 10 minutos sin ayuda para leer.
5. Revisión de cumplimiento para la Kids Category (Apple) y Families (Google). Ver [MONETIZATION](MONETIZATION.md).
