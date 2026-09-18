# Game Design Document (GDD)

> **Status:** Accepted (v1) · **Last Updated:** 2026-09-18
> **Related:** [GAME_VISION](GAME_VISION.md) · [CORE_GAME_LOOP](CORE_GAME_LOOP.md) · [GAME_RULES](GAME_RULES.md) · [MVP_SCOPE](MVP_SCOPE.md) · [../architecture/ARCHITECTURE.md](../architecture/ARCHITECTURE.md)

> Este GDD **resume y enlaza**. Los detalles viven en los documentos especializados y aquí no se duplican. Se evita a propósito la complejidad innecesaria: si algo no está aquí ni en [MVP_SCOPE](MVP_SCOPE.md), no es parte del MVP.

## 1. Game overview
**MyWorld** (codename) es una casa de muñecas digital en 2D. El jugador crea personajes y juega libremente con ellos en una casa, una calle y una tienda. Arrastra personajes y objetos para que coman, duerman, se vistan, se sienten, guarden cosas y compren. **Todo lo que hace persiste.**

## 2. Genre
Sandbox / dollhouse / juego de rol libre infantil. Sin objetivos obligatorios.

## 3. Audience
De 4 a 10 años (núcleo: 5–8). Los compradores son los padres. Ver [TARGET_AUDIENCE](TARGET_AUDIENCE.md).

## 4. Platforms
iOS y Android: teléfonos y tablets. React Native + Expo. Ver [ADR-001](../decisions/ADR-001-TECH-STACK.md).

## 5. Orientation
**Horizontal (landscape)**, bloqueada. La plantilla actual de `MyWorld/app.json` está en `portrait` y se cambia en [HU-GAME-001](../stories/mvp/EPIC-001-foundation.md). Motivo: las escenas se exploran en horizontal ([ADR-007](../decisions/ADR-007-VIRTUAL-COORDINATES.md)).

## 6. Session duration
Sesiones de 5 a 20 minutos, a menudo interrumpidas. El diseño asume que **la app puede cerrarse en cualquier momento** (autosave, ver [SAVE_SYSTEM](../architecture/SAVE_SYSTEM.md)).

## 7. Core fantasy
*"Tengo mi propia casa de muñecas mágica donde todo funciona de verdad: puedo abrir la nevera, dar de comer a mi familia, acostarla, vestirla, ir de compras… y mañana todo seguirá igual."*

## 8. Core gameplay
**Tocar y arrastrar.** El jugador arrastra personajes y objetos y los suelta sobre otros. El resultado depende de las **capacidades** de cada cosa: la comida sobre una boca se come, un personaje sobre una cama se duerme. Tocar abre, enciende o genera cosas. Ver [INTERACTION_SYSTEM](../architecture/INTERACTION_SYSTEM.md).

## 9. Core loop
`EXPLORE → DISCOVER → INTERACT → CREATE STORY → CUSTOMIZE → UNLOCK → EXPLORE`. Ver [CORE_GAME_LOOP](CORE_GAME_LOOP.md).

## 10. Secondary loops
Bucle de objeto, de personaje, de compras y de decoración básica. Ver [CORE_GAME_LOOP §2](CORE_GAME_LOOP.md).

## 11. Progression
- **Sin niveles, experiencia ni progresión obligatoria.**
- La progresión es **horizontal**: más objetos (con monedas), más personajes (hasta 12) y, en el POST-MVP, más lugares (packs), recuerdos (EPIC-029) y secretos (EPIC-031).
- Las monedas se obtienen con el regalo diario y las monedas escondidas. Ver [GAME_RULES §4](GAME_RULES.md).

## 12. Characters
- Creados por el jugador, **por capas**: cuerpo, piel, ojos, boca, pelo y ropa.
- **Poses:** de pie, colgando, sentado, durmiendo, comiendo y bebiendo.
- **Expresiones** simples. **Dos manos** para sostener objetos.
- Detalle en [CHARACTER_SYSTEM](../architecture/CHARACTER_SYSTEM.md) y [CHARACTER_GUIDELINES](../design/CHARACTER_GUIDELINES.md).
- NPCs: POST-MVP (EPIC-027).

## 13. World
Una pequeña ciudad propia, sin nombre en el MVP (OQ-02). Cálida, de colores suaves y segura. Sin villanos ni conflicto. Se expande por **Content Packs** ([CONTENT_SYSTEM](../architecture/CONTENT_SYSTEM.md)).

## 14. Locations
| Ubicación | Escena | Contenido principal |
|---|---|---|
| Casa | `core:home` (4 zonas) | Salón, cocina, dormitorio, baño |
| Calle | `core:street` | Fachadas, puerta de casa, puerta de la tienda, banco, farola, buzón |
| Tienda | `core:store` | Estantes con productos, caja registradora, expositor refrigerado |

Ver [SCENE_SYSTEM](../architecture/SCENE_SYSTEM.md) y [ENVIRONMENT_GUIDELINES](../design/ENVIRONMENT_GUIDELINES.md).

## 15. Objects
- **46 prefabs interactivos + 15 prendas** en el MVP ([MVP_SCOPE](MVP_SCOPE.md#objetos)).
- Se definen por datos ([OBJECT_SCHEMA](../data/OBJECT_SCHEMA.md)).
- Su comportamiento sale de sus **componentes** ([ECS](../architecture/ECS.md)).

## 16. Interactions
Arrastrar · soltar sobre superficies · sostener · comer · beber · sentarse · dormir · vestir y quitar ropa · abrir y cerrar · encender y apagar · guardar y sacar · usar la mochila · generar desde dispensadores · viajar por puertas · comprar · recoger monedas. Tabla de reglas en [INTERACTION_SCHEMA §7](../data/INTERACTION_SCHEMA.md).

## 17. Inventory
- **Contenedores en el mundo:** nevera, armario, caja de juguetes, cesta, alacena y buzón.
- **Mochila global de 12 slots** para llevar cosas entre escenas.
- Ver [INVENTORY_SYSTEM](../architecture/INVENTORY_SYSTEM.md).

## 18. Economy
Moneda blanda única (monedas), sin dinero real en el MVP. Fuentes y gastos en [GAME_RULES §4](GAME_RULES.md). Monetización del producto en [MONETIZATION](MONETIZATION.md).

## 19. Customization
- **Personajes:** creador + ropa en el mundo.
- **Casa:** mover muebles y objetos libremente.
- **Paredes y suelos:** POST-MVP (EPIC-034).
- **Accesorios:** POST-MVP (HU-GAME-108).

## 20. Exploration
- Paneo horizontal con inercia y auto-scroll al arrastrar.
- Mapa de ubicaciones y zonas.
- Cada zona tiene al menos **3 cosas "tocables"** con respuesta. Regla de contenido en [ENVIRONMENT_GUIDELINES](../design/ENVIRONMENT_GUIDELINES.md).

## 21. Achievements
**No hay logros visibles en el MVP**, a propósito: los logros empujan a "completar" y chocan con el juego libre. El sustituto con identidad propia es el **Álbum de recuerdos** (POST-MVP, EPIC-029): celebra lo que el niño **hizo**, no lo que le falta.

## 22. Secrets
- **MVP (P2):** monedas escondidas (`collectible`) en lugares que invitan a curiosear: detrás de una maceta, dentro del buzón.
- **POST-MVP:** secretos con reacción (EPIC-031), como un cuadro que gira o una luz que revela algo.

## 23. Audio
- Efectos de sonido para cada interacción.
- Música tranquila por ubicación y ambiente por zona.
- Volúmenes separados.
- Ver [AUDIO_SYSTEM](../architecture/AUDIO_SYSTEM.md). Dirección sonora: suave, acústica y alegre, sin sonidos estridentes.

## 24. Accessibility
- Jugable sin leer.
- Objetivos táctiles ≥ 64 dp.
- Sin gestos complejos.
- Feedback visual **y** sonoro para cada acción.
- Contraste suficiente en la UI.
- `accessibilityLabel` en la UI.
- POST-MVP (HU-GAME-110): "reducir movimiento" y opciones para daltonismo.

Ver [UI_UX_GUIDELINES](../design/UI_UX_GUIDELINES.md).

## 25. Parental considerations
- Sin anuncios, sin chat, sin datos personales y sin red en el MVP.
- **Puerta parental** para ajustes sensibles y cualquier acción externa.
- **Reiniciar el mundo** solo con la puerta parental y con copia de seguridad.
- Ver [MONETIZATION §4](MONETIZATION.md) y [EPIC-026](../stories/mvp/EPIC-026-app-shell.md).

## 26. Save system
- Automático, offline y en SQLite, con migraciones versionadas.
- Guarda **el diff** respecto al contenido, así que las actualizaciones de contenido no rompen las partidas.
- Ver [SAVE_SYSTEM](../architecture/SAVE_SYSTEM.md) y [SAVE_SCHEMA](../data/SAVE_SCHEMA.md).

## 27. Content expansion
- **Content Packs** versionados con namespace, dependencias y validación.
- El MVP ya es un pack (`core`). Los packs futuros (Escuela, Playa, Hospital, Mascotas, Restaurante, Espacio) se añaden **sin cambiar el motor**, salvo que necesiten una capacidad nueva.
- Ver [CONTENT_SYSTEM](../architecture/CONTENT_SYSTEM.md) y [CONTENT_PACK_SCHEMA](../data/CONTENT_PACK_SCHEMA.md).
