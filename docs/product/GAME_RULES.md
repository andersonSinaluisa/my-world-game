# Game Rules

> **Status:** Accepted (v1) · **Last Updated:** 2026-09-18
> **Related:** [GAME_DESIGN_DOCUMENT](GAME_DESIGN_DOCUMENT.md) · [../architecture/INTERACTION_SYSTEM.md](../architecture/INTERACTION_SYSTEM.md) · [../data/INTERACTION_SCHEMA.md](../data/INTERACTION_SCHEMA.md)

Son las reglas **de diseño** del juego, en lenguaje de producto. Su implementación técnica está en los documentos de arquitectura. Si una regla de aquí y un documento técnico se contradicen, **se resuelve con un ADR**, sin cambiar ninguno en silencio.

## 1. Reglas fundamentales

| # | Regla | Razón |
|---|---|---|
| R1 | **No se puede perder.** No existen estados de fallo, game over ni castigos. | Seguridad emocional (Safe play) |
| R2 | **Nada se destruye por accidente.** Un objeto solo desaparece si se consume (comer o beber) o si se vende o compra de forma explícita. Todo lo demás cae a una superficie o al suelo. | Confianza |
| R3 | **Todo persiste.** Posición, estado, contenido de contenedores, ropa, poses persistentes, monedas y ajustes. | Diferenciador D1 |
| R4 | **Sin texto obligatorio.** Toda la información de juego es visual o sonora. | Público que no lee |
| R5 | **Rechazos amables.** Una interacción no válida produce un "shake" + sonido suave, y el objeto se apoya cerca. | R1 |
| R6 | **Sin necesidades que decaen.** Los personajes no tienen hambre ni sueño medibles; comer y dormir son **juego**, no obligación. | Sin ansiedad |
| R7 | **Todo lugar del MVP es accesible desde el principio.** | Libertad |

## 2. Objetos

- Un objeto **arrastrable** se puede llevar a cualquier parte de la escena actual. Para llevarlo a otra escena, un personaje lo tiene que sostener, o debe ir en la mochila.
- Al soltarlo, **cae a la superficie más alta que haya por debajo** del dedo, o al suelo. No hay física de rebotes ni vuelcos.
- Los **muebles** solo se apoyan en el suelo (`floorOnly`).
- **Contenedores:**
  - para meter o sacar cosas, el contenedor tiene que estar abierto;
  - cada uno tiene capacidad y tipos aceptados (la nevera acepta comida y bebida; el armario, ropa);
  - cerrado, su contenido no se ve ni se toca.
- **La comida se come por mordiscos** (1–3 según el objeto). Al terminar queda un resto (el corazón de la manzana) o desaparece.
- **Las bebidas se beben por sorbos.** Al terminar queda el envase vacío.
- **Dispensadores** (frutero): al tocarlos generan un objeto, con un máximo de 3 vivos a la vez por dispensador (ajustable por contenido).

## 3. Personajes

- **Máximo 12 personajes** creados en el MVP.
- **Se mueven arrastrándolos.** No caminan solos en el MVP.
- **Sostienen hasta 2 objetos**, uno por mano.
- **Se sientan** si se sueltan sobre un asiento libre y **duermen** si se sueltan sobre una cama libre.
- **Comen o beben** si se les suelta comida o bebida en la cara o la boca.
- **Se visten** si se les suelta ropa sobre el cuerpo. La prenda anterior del mismo tipo cae a sus pies.
- **Viajan a otra escena** si se sueltan sobre una puerta. Lo que sostienen viaja con ellos.

## 4. Economía (Fase 2)

- **Moneda única:** monedas del juego. **No se compran con dinero real en el MVP.**
- **Fuentes:**
  - monedas iniciales: propuesta **50**;
  - regalo diario: propuesta **10/día**, sin acumular días perdidos para que no haya presión;
  - monedas escondidas (P2): propuesta **5 cada una**, recogibles una sola vez.
- **Gasto:** comprar objetos en la tienda. Los precios van de **2 a 30 monedas** (propuesta; se equilibra con pruebas).
- **Cómo se compra:** se lleva el producto a la **caja registradora**.
  - Si alcanzan las monedas → se compra.
  - Si no → rechazo amable y el producto vuelve a su estante.
- **Un producto sin comprar no puede salir de la tienda.**
- **Después de comprar:** la tienda **repone** al instante una copia del producto en su lugar de exposición (`purchasable.restock`, ver [ENTITY_SCHEMA §5.14](../data/ENTITY_SCHEMA.md)). Stock infinito en el MVP.
- **Balance:** la economía nunca bloquea la diversión básica. Todo el contenido de la casa inicial es gratis.

## 5. Privacidad y seguridad (reglas de producto)

- **Sin cuentas ni login** en el MVP.
- **Sin datos personales:** el apodo del personaje es opcional, solo local y de máximo 12 caracteres.
- **Sin conexión de red obligatoria.** En el MVP la app **no hace llamadas de red de juego**.
- **Puerta parental** para: **toda la pantalla de ajustes** (volumen, idioma, reiniciar el mundo, créditos), enlaces externos y compras reales futuras. El niño controla el volumen con los botones físicos del dispositivo.
- **Sin publicidad** en el MVP.
