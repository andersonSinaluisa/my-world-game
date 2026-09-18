# Monetization

> **Status:** Proposed. La decisión final es la pregunta abierta **OQ-03**. · **Last Updated:** 2026-09-18
> **Related:** [GAME_VISION](GAME_VISION.md) · [TARGET_AUDIENCE](TARGET_AUDIENCE.md) · [ROADMAP](ROADMAP.md) · [../architecture/CONTENT_SYSTEM.md](../architecture/CONTENT_SYSTEM.md)

## 1. Principios

1. **Nunca monetizar la frustración.** Nada de temporizadores, energía ni paywalls a mitad de una acción.
2. **Nunca dirigirse al niño para comprar.** Las compras con dinero real, solo detrás de la **puerta parental** y en una zona para adultos.
3. **Sin anuncios de terceros.** En apps infantiles son un riesgo regulatorio y reputacional, y rompen la experiencia.
4. **Valor claro para el adulto:** el padre o la madre sabe qué compra (un pack con N lugares y objetos).

## 2. Modelos evaluados

| Modelo | Pros | Contras | Encaje |
|---|---|---|---|
| **A. Freemium por packs** (base gratis + packs de pago) | Probado en el género. Baja barrera de entrada. Encaja con la arquitectura de Content Packs. | Hay que diseñar la base gratuita para que sea generosa sin canibalizar | ⭐ **Recomendado** |
| B. Premium (pago único) | Simple. Cumplimiento sencillo. | Barrera alta en Android y en LATAM. Sin ingresos recurrentes para nuevo contenido. | Posible en iOS |
| C. Suscripción familiar | Ingresos recurrentes | Complejidad, rechazo de los padres y más exigencias de las tiendas | Futuro, solo si hay mucho contenido |
| D. Anuncios | — | Incompatible con los principios y con Families/Kids Category | ❌ Descartado |
| E. Monedas del juego por dinero real | — | Presión de compra dirigida a niños | ❌ Descartado |

## 3. Propuesta (A)

- **Gratis:** Casa, Calle y Tienda completas (el MVP). La economía de monedas blandas **nunca** se vende por dinero real.
- **De pago (Fase 7):** Content Packs (Escuela, Playa, Hospital, Mascotas…) como compras únicas no consumibles, restaurables y con puerta parental.
- **MVP:** **sin ninguna monetización**. Se valida primero la diversión y la retención.

## 4. Cumplimiento para niños (checklist)

| Requisito | Implicación |
|---|---|
| Google Play Families Policy | Declarar público infantil. SDKs certificados para familias o ningún SDK de terceros. Sin anuncios personalizados. |
| Apple Kids Category | Sin publicidad de terceros ni analytics de terceros que identifiquen. Puerta parental para enlaces externos y compras. |
| COPPA (EE. UU.) y RGPD de menores (UE) | No recoger datos personales sin consentimiento verificable. El MVP no recoge **ninguno**. |
| Analytics (POST-MVP, EPIC-025) | Solo agregados, anónimos, sin identificadores de dispositivo publicitarios, con opt-in parental, y con proveedor propio o "kids-safe". |

> **Esto no es asesoría legal.** Antes de publicar, revisarlo con asesoría especializada en apps infantiles.

## 5. Impacto técnico ya previsto

- `PackManifest.entitlement` ([CONTENT_PACK_SCHEMA](../data/CONTENT_PACK_SCHEMA.md)) [DESIGNED FOR LATER].
- Puerta parental reutilizable (HU-GAME-074) [NEEDED NOW].
- Sin SDKs de terceros en el MVP [NEEDED NOW]: cualquier dependencia nueva que haga red requiere un ADR.
