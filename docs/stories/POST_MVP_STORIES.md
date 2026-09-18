# Historias POST-MVP y FUTURE

> **Status:** Draft (formato breve) · **Last Updated:** 2026-09-18
> **Related:** [EPICS](EPICS.md) · [BACKLOG](BACKLOG.md) · [../product/ROADMAP.md](../product/ROADMAP.md)

Estas HU están **identificadas pero no refinadas**. No cumplen el [DoR](DEFINITION_OF_READY.md). Antes de desarrollarlas hay que expandirlas al formato completo de [_TEMPLATE_HU.md](_TEMPLATE_HU.md) y moverlas a su archivo de epic.

## POST-MVP (HU-GAME-100 a HU-GAME-199)

| ID | Título | Epic | Fase | Historia (resumen) | Notas y dependencias técnicas |
|---|---|---|---|---|---|
| HU-GAME-100 | Aleatorizar personaje | EPIC-005 | 3 | Como jugador quiero un botón de "dado" para crear un personaje sorpresa | Solo UI + `random` inyectado |
| HU-GAME-101 | Arrastre multitáctil | EPIC-007 | 3 | Como jugadores (dos niños) queremos arrastrar objetos distintos a la vez | Varios DragProxy; revisa [ADR-009](../decisions/ADR-009-STATE-AND-THREADING.md) |
| HU-GAME-102 | Combinar objetos (recetas) | EPIC-030 | 3 | Como jugador quiero juntar dos objetos y descubrir uno nuevo (pan + queso = sándwich) | Componente `combinable`, acción `combine`, trigger `combine` y un ADR nuevo |
| HU-GAME-103 | Álbum de recuerdos | EPIC-029 | 3 | Como jugador quiero ver un álbum con los momentos especiales de mis personajes | `memoryTrigger`, acción `emit`, almacenamiento de recuerdos (nueva tabla o saveVersion++), ilustraciones |
| HU-GAME-104 | Mascota básica | EPIC-028 | 4 | Como jugador quiero adoptar una mascota que come, duerme y me sigue | Componente `pet`, un tick de baja frecuencia (revisa ADR-003) y arte |
| HU-GAME-105 | NPC tendero | EPIC-027 | 3 | Como jugador quiero que en la tienda haya alguien que me salude y "cobre" | `npcBehavior`, animaciones de idle y saludo |
| HU-GAME-106 | Rutinas simples de NPC | EPIC-027 | 3 | Como jugador quiero que los vecinos hagan cosas en la calle | Requiere un tick, sin pathfinding complejo |
| HU-GAME-107 | Cambiar papel tapiz y suelo | EPIC-034 | 3 | Como jugador quiero cambiar el color o el dibujo de las paredes de cada habitación | Estado por zona en el guardado y capas de fondo intercambiables |
| HU-GAME-108 | Accesorios (sombreros, gafas) | EPIC-011 | 3 | Como jugador quiero ponerle gorros y gafas a mis personajes | WearSlots `head` y `face`, capa `accessories` |
| HU-GAME-109 | Zoom con pinch | EPIC-002 | 3 | Como jugador quiero acercar la cámara para ver detalles | Escala adicional de la cámara, ya prevista en el árbol de render |
| HU-GAME-110 | Accesibilidad avanzada | EPIC-022 | 3 | Como jugador o adulto quiero reducir el movimiento, un modo para daltonismo y un modo zurdo | `settings.reduceMotion`, `leftHanded` |
| HU-GAME-111 | Secretos con reacción | EPIC-031 | 3 | Como jugador quiero descubrir sorpresas escondidas (un cuadro que gira) | Componente `secret` |
| HU-GAME-112 | Negocio del jugador | EPIC-032 | 6 | Como jugador quiero montar mi puesto y vender a los vecinos | Depende de NPCs y de la economía |
| HU-GAME-113 | Pack Escuela | EPIC-021 | 5 | Como jugador quiero ir a la escuela desde la calle | **Test de la arquitectura:** cero cambios en `engine/`. Extensiones de escena. |
| HU-GAME-114 | Descarga de Content Packs | EPIC-021 | 7 | Como adulto quiero descargar packs nuevos sin actualizar la app | Distribución, checksum y firma; [BACKEND_FUTURE](../architecture/BACKEND_FUTURE.md) |
| HU-GAME-115 | Compra de packs (IAP) con puerta parental | EPIC-021/026 | 7 | Como adulto quiero comprar un pack de forma segura y restaurarlo | `entitlement`, recibos y [MONETIZATION](../product/MONETIZATION.md) |
| HU-GAME-116 | Objetos colgables en la pared | EPIC-034 | 3 | Como jugador quiero colgar cuadros y estantes en las paredes | Superficies verticales o "wall slots", capa `wallDecor` |
| HU-GAME-117 | Analytics con privacidad | EPIC-025 | 7 | Como equipo queremos métricas agregadas y anónimas con opt-in parental | ADR sobre el proveedor; kids-safe |
| HU-GAME-118 | Varios slots o perfiles | EPIC-015 | 3 | Como familia queremos un mundo por hijo | `slot_id` ya previsto |
| HU-GAME-119 | Assets @2x para tablets | EPIC-002 | 3 | Como jugador en tablet quiero ver el juego nítido | AssetLoader con variantes |
| HU-GAME-120 | Comer lo que se sostiene (tap) | EPIC-012 | 3 | Como jugador quiero tocar la comida que tiene mi personaje en la mano para que la coma | Regla `tap` con la condición "held by" (condición nueva) |
| HU-GAME-122 | Eliminar un personaje | EPIC-005 | 3 | Como jugador quiero borrar un personaje que ya no quiero | Confirmación clara (¿puerta parental?). Lo que sostenía y vestía cae a la escena o va al armario. Hasta entonces, el tope de 12 se gestiona editando. Ver OQ-09. |
| HU-GAME-121 | Sofá de varias plazas | EPIC-013 | 3 | Como jugador quiero sentar a varios personajes en el sofá | `seat.anchors[]` |

## FUTURE (HU-GAME-200 a HU-GAME-299)

| ID | Título | Epic | Resumen |
|---|---|---|---|
| HU-GAME-200 | Viajes entre ciudades | — | Autobús o tren a otras ciudades (packs) con una mini-experiencia de viaje |
| HU-GAME-201 | Cloud save | EPIC-033 | Copia de seguridad y restauración en la nube con cuenta de adulto |
| HU-GAME-202 | Multi-dispositivo familiar | EPIC-033 | Sincronización entre dispositivos del hogar |
| HU-GAME-203 | Mundo vivo con hora real | — | Día y noche según el reloj, plantas que crecen, cartas en el buzón |
| HU-GAME-204 | Packs Playa, Hospital, Restaurante y Espacio | EPIC-021 | Content Packs temáticos |
| HU-GAME-205 | Grabar historias | — | Captura local de escenas o vídeo para ver en familia (sin compartir en redes) |
| HU-GAME-206 | Narración por voz | EPIC-022 | Voces para la UI y accesibilidad para niños con dificultades visuales |
