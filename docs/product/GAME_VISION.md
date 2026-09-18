# Game Vision

> **Status:** Accepted (v1) · **Last Updated:** 2026-09-18
> **Nombre de trabajo:** **MyWorld** (codename; el nombre comercial es la pregunta abierta OQ-02)
> **Related:** [GAME_DESIGN_DOCUMENT](GAME_DESIGN_DOCUMENT.md) · [TARGET_AUDIENCE](TARGET_AUDIENCE.md) · [CORE_GAME_LOOP](CORE_GAME_LOOP.md) · [MVP_SCOPE](MVP_SCOPE.md) · [ROADMAP](ROADMAP.md)

## 1. Problema: qué experiencia queremos ofrecer

Los niños de 4 a 10 años juegan a inventar historias con muñecos, casas de muñecas y juguetes. En el móvil, la mayoría de juegos infantiles son de estos tipos:

- **Guiados:** niveles, objetivos, puntuaciones. El juego decide qué pasa.
- **Llenos de fricción:** anuncios, temporizadores, tiendas agresivas, textos que el niño no puede leer.
- **Frágiles:** lo que el niño construyó se pierde, o el juego "resetea" la escena.

**Queremos ofrecer una casa de muñecas digital viva.** Un lugar seguro donde el niño es el director de sus propias historias, todo responde al tacto de forma divertida y **lo que deja en un sitio sigue ahí cuando vuelve**.

## 2. Propuesta

**MyWorld** es un sandbox 2D para móvil sin objetivos obligatorios. El jugador:
- crea personajes y los viste;
- los lleva por una casa, una calle y una tienda, que se amplían después con más lugares;
- interactúa con cada objeto: comer, dormir, abrir, guardar, comprar, encender;
- **inventa historias** con todo eso.

**Filosofía:** `PLAY → EXPLORE → INTERACT → CREATE STORIES → CUSTOMIZE → DISCOVER`

## 3. Principios

| Principio | Qué significa en la práctica | Qué descarta |
|---|---|---|
| **Freedom** (libertad) | Cualquier objeto va a cualquier sitio que tenga sentido físico. No hay orden obligatorio. | Tutoriales bloqueantes, historia lineal, "misiones" obligatorias |
| **Creativity** (creatividad) | Las herramientas (personajes, ropa, objetos) sirven para contar historias propias | Soluciones "correctas", puntuaciones |
| **Exploration** (exploración) | Cada lugar recompensa la curiosidad: cajones que se abren, cosas que se encienden | Lugares vacíos o decorativos sin interacción |
| **Discovery** (descubrimiento) | Pequeñas sorpresas por descubrir: interacciones inesperadas, secretos | Mostrar todo en un menú |
| **Customization** (personalización) | Personajes y espacios propios que el niño reconoce como suyos | Personajes fijos |
| **Safe play** (juego seguro) | Nada de chat, anuncios, datos personales ni enlaces sin control parental. No hay forma de "perder". | Presión de compra, castigos, contenido social abierto |

## 4. Diferenciadores (identidad propia, no un clon)

Hay elementos que son **del género** y todos los juegos de este tipo tienen: casa, personajes, arrastrar objetos. **No son diferenciadores.** Los que siguen sí lo son. Algunos entran en el MVP y otros se diseñan ahora para después.

| # | Diferenciador | Idea | Alcance |
|---|---|---|---|
| D1 | **Mundo que recuerda** | La persistencia total es un valor de marca: el objeto que dejaste en la cama sigue ahí, la manzana mordida sigue mordida, tu personaje sigue dormido en el sofá. | **MVP** (EPIC-015) |
| D2 | **Estilo visual propio "juguete de papel suave"** | Contorno de color (no negro), formas de frijol, texturas de papel sutiles y una paleta pastel con acentos vivos. Ver [ART_DIRECTION](../design/ART_DIRECTION.md). | **MVP** |
| D3 | **Álbum de recuerdos** | El juego captura automáticamente "momentos": la primera vez que alguien comió pastel o durmió en la cama nueva. Quedan en un álbum ilustrado que el niño hojea. Es narrativa emergente sin texto. | **POST-MVP** (EPIC-029) |
| D4 | **Objetos combinables** | Pan + queso = sándwich; pintura + lienzo = cuadro. Recetas descubribles sin menú. | **POST-MVP** (EPIC-030) |
| D5 | **Pequeños secretos** | Un cuadro que se mueve y esconde una moneda; un ratón que asoma si apagas la luz. Descubrimiento sin guía. | MVP mínimo (monedas escondidas, P2) → **POST-MVP** (EPIC-031) |
| D6 | **Negocios del jugador** | El niño monta un puesto de limonada o una tienda de ropa, pone precios y los personajes "compran". Economía creativa, no extractiva. | **POST-MVP** (EPIC-032, Fase 6) |
| D7 | **Mascotas con personalidad simple** | Siguen a su dueño, duermen en su cama y reaccionan a la comida. | **POST-MVP** (EPIC-028, Fase 4) |
| D8 | **Viajes entre ciudades** | Un autobús o un tren lleva a otras ciudades (playa, montaña) como Content Packs. El viaje en sí es una mini-experiencia. | **FUTURE** |
| D9 | **Mundo persistente vivo** | Plantas que crecen en tiempo real, la luz cambia con la hora del dispositivo, el buzón recibe "cartas" ilustradas. | **FUTURE** |

## 5. Alcance por horizonte

### MVP
Fases 0 a 2. Ver [MVP_SCOPE](MVP_SCOPE.md).
- Casa (4 habitaciones), calle y tienda.
- Creador de personajes.
- Interacciones base: arrastrar, sostener, soltar, abrir, cerrar, comer, beber, sentarse, dormir, vestirse y encender.
- Contenedores y mochila.
- Monedas y compras.
- Guardado total offline.
- Audio.
- Puerta parental.
- Estilo propio.

### POST-MVP
Fases 3 a 7:
- Expansión del personaje (accesorios, más partes).
- NPCs.
- Álbum de recuerdos.
- Combinables.
- Secretos.
- Decoración de paredes y suelos.
- Mascotas.
- Escuela (el primer pack).
- Negocios del jugador.
- Packs descargables.
- Accesibilidad avanzada.
- Analytics con privacidad.

### FUTURE
Fase 8 y más allá:
- Guardado en la nube (.NET 8 + PostgreSQL).
- Perfiles familiares.
- Viajes entre ciudades.
- Mundo vivo con hora real.
- Packs Playa, Hospital, Restaurante y Espacio.
- Modo "historia grabada" (captura local de escenas).

## 6. Qué NO será nunca este juego

- **No habrá chat ni contenido generado por usuarios compartido** entre desconocidos.
- **No habrá anuncios de terceros** dirigidos a niños.
- **No habrá mecánicas de ansiedad:** barras de hambre que castigan, temporizadores de "vuelve o pierdes" ni loot boxes.
- **No habrá copias** de personajes, mapas, nombres, interfaces ni assets de Toca Boca World, Avatar World, Game World ni otros títulos.

## 7. Métrica de éxito del MVP (cualitativa)

Un niño de 5 a 8 años juega **10 minutos o más sin ayuda y sin leer**, inventa al menos una "historia" que puede contar ("la niña comió pastel y se fue a dormir") y **quiere volver** para ver que sus cosas siguen donde las dejó.
