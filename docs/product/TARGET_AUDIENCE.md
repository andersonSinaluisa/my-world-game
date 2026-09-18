# Target Audience

> **Status:** Accepted (v1) · **Last Updated:** 2026-09-18
> **Related:** [GAME_VISION](GAME_VISION.md) · [../design/UI_UX_GUIDELINES.md](../design/UI_UX_GUIDELINES.md) · [MONETIZATION](MONETIZATION.md)

## 1. Segmentos

| Segmento | Edad | Rol | Necesidades clave |
|---|---|---|---|
| **Primario** | 5–8 años | Jugador | Tocar y ver reacción al instante, historias propias, personajes "suyos", ningún texto imprescindible |
| **Secundario** | 4 años | Jugador | Motricidad fina limitada: objetivos grandes, sin gestos complejos, sin fracaso |
| **Terciario** | 9–10 años | Jugador | Más contenido, más personalización, sensación de colección y de "mi casa" |
| **Comprador y guardián** | Adultos | Padre, madre o tutor | Seguridad, nada de anuncios ni de compras accidentales, privacidad, valor claro del precio |

## 2. Capacidades y limitaciones a considerar

| Área | Implicación de diseño |
|---|---|
| **Lectura** | No se asume que lean. Toda la UI esencial usa iconos, animación y sonido. El texto solo aparece en la zona para adultos (ajustes). |
| **Motricidad** | Botones ≥ 64 dp; objetos del mundo ≥ 44 dp efectivos. Hitboxes con padding. Nada de doble tap ni gestos de dos dedos obligatorios. El drag empieza sin long press ([INPUT_SYSTEM](../architecture/INPUT_SYSTEM.md)). |
| **Atención** | Respuesta inmediata (< 100 ms) a cada toque. Transiciones ≤ 1 s. |
| **Frustración** | Sin estados de fallo. Los rechazos son amables y el objeto nunca "desaparece" por error. |
| **Juego compartido** | Niños que juegan en pareja o con hermanos en una tablet. Multitouch [DESIGNED FOR LATER]. |
| **Dispositivos** | Tablets baratas y móviles heredados de los padres. Ver [PERFORMANCE](../architecture/PERFORMANCE.md#dispositivos). |
| **Sesiones** | 5–20 minutos, a menudo interrumpidas. Guardado automático constante. |

## 3. Personas

- **Sofía, 6 años.** Todavía no lee con fluidez. Juega en la tablet familiar después del colegio. Le encanta "hacer que la familia cene y se vaya a dormir". Necesita que las cosas respondan al tocarlas y que la ropa se ponga soltándola encima.
- **Mateo, 9 años.** Crea muchos personajes y organiza la casa a su gusto. Quiere comprar cosas nuevas y descubrir secretos. Se aburre si no hay nada que descubrir.
- **Laura, 38 años, madre.** Quiere un juego sin anuncios ni sorpresas en la factura, que no pida datos y que su hija pueda usar sola. Valora poder reiniciar el mundo o ajustar el volumen sin que la niña lo haga por error.

## 4. Plataformas y contexto

- iOS y Android, **orientación horizontal (landscape)**.
- Teléfonos y tablets. El diseño se valida en el aspecto 4:3 (tablet) y en los aspectos de teléfono moderno (~20:9).
- **Funciona sin conexión** en todo momento.
- Idiomas del MVP: **español e inglés**. La UI casi no tiene texto, así que traducir cuesta poco.

## 5. Consideraciones regulatorias (resumen)

Aplican el programa Families de Google Play, la Kids Category de Apple, COPPA (EE. UU.) y el RGPD en su parte de menores (UE). Ver [MONETIZATION §4](MONETIZATION.md) para las implicaciones concretas.
