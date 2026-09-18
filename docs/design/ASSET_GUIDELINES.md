# Asset Guidelines

> **Status:** Accepted (v1) · **Last Updated:** 2026-09-18
> **Related:** [ART_DIRECTION](ART_DIRECTION.md) · [../data/CONTENT_PACK_SCHEMA.md §3](../data/CONTENT_PACK_SCHEMA.md) · [../architecture/RENDERING.md](../architecture/RENDERING.md) · [research/FREE_ASSETS.md](research/FREE_ASSETS.md) · [research/ASSET_MARKET_RESEARCH.md](research/ASSET_MARKET_RESEARCH.md)

## 1. Nomenclatura

```
{category}_{subcategory}_{name}[_{variant}][_{state}]
```

- Todo en minúsculas, `snake_case` y ASCII. El nombre del archivo es igual a la **clave de asset** (`AssetKey`) más la extensión.
- `variant`: **dos dígitos** `01`, `02`… o un color (`red`, `yellow`).
- `state`: `open`, `on`, `bite1`, `sit`, `sleep`…

| Prefijo | Uso | Ejemplos |
|---|---|---|
| `chr_` | Partes de personaje | `chr_body_child_torso_idle`, `chr_hair_buns_front`, `chr_eyes_round`, `chr_mouth_smile`, `chr_top_star_yellow`, `chr_top_star_yellow_sit` |
| `obj_` | Objetos pequeños (props) | `obj_food_apple_red`, `obj_food_apple_red_bite1`, `obj_toy_teddy_bear`, `obj_clothing_shirt_star_yellow` |
| `env_` | Muebles, fondos y elementos del entorno | `env_home_bg_kitchen_01`, `env_home_sofa_blue_01`, `env_home_fridge_white_open`, `env_street_lamp_on` |
| `ui_` | Interfaz | `ui_btn_map`, `ui_inventory_slot`, `ui_icon_coin`, `ui_hint_container_full` |
| `fx_` | Efectos | `fx_sparkle_01`, `fx_crumbs_01` |
| `sfx_` | Efectos de sonido | `sfx_pickup_soft_01`, `sfx_eat_crunch_02`, `sfx_reject_soft` |
| `mus_` | Música | `mus_home_calm_01` |
| `amb_` | Ambiente | `amb_kitchen_fridge_hum` |

Los packs distintos de `core` anteponen su id: `school_obj_book_red` (ver [CONTENT_PACK_SCHEMA §3](../data/CONTENT_PACK_SCHEMA.md)).

## 2. Dimensiones

- **1 px = 1 world unit** a 1× ([ADR-007](../decisions/ADR-007-VIRTUAL-COORDINATES.md)).
- **Máximo 2048 × 2048** por archivo. Los fondos van en chunks de **1920 × 1080**.
- Tamaños típicos en [ENVIRONMENT_GUIDELINES §4](ENVIRONMENT_GUIDELINES.md) y [CHARACTER_GUIDELINES §1](CHARACTER_GUIDELINES.md).
- Las dimensiones se declaran en `assets.json` (`w`, `h`) y el validador las comprueba contra el archivo.

## 3. Pivot y origen

- El pivot **no va en el archivo**: se declara en el prefab (`sprite.pivot`). Por defecto es **el centro inferior** `{x:0.5, y:1}`.
- **Regla para el artista:** el objeto "apoya" en el borde inferior del lienzo. La base del objeto toca la última fila de píxeles no transparentes, más el padding.
- **Sprites con estados** (abierto y cerrado, mordiscos): **mismo lienzo y misma posición** del objeto en todos los estados.
- **Personajes:** lienzo común por tipo de cuerpo (ver [CHARACTER_GUIDELINES §2](CHARACTER_GUIDELINES.md)).

## 4. Padding transparente

- **4 px de padding transparente** alrededor de cada sprite. Evita el sangrado de filtrado al escalar y rotar y deja espacio para la línea de contorno.
- Los fondos de chunk **no llevan padding**, porque tienen que empalmar.

## 5. Formatos y compresión

| Tipo | Formato runtime | Configuración | Notas |
|---|---|---|---|
| Sprites (objetos, personajes, UI) | **WebP con alpha** | Lossy con calidad 90 y alpha lossless; o lossless si es < 20 KB | Soportado en iOS 14+ y Android |
| Fondos | **WebP** | Lossy con calidad 82–88 | El chunk de 1920×1080 debe pesar ≤ 400 KB |
| Iconos de UI | WebP (o PNG si hay problemas de nitidez) | Lossless | Tamaños 96 / 144 / 192 px |
| **SVG** | ❌ No en runtime | Solo como **fuente** en el repositorio de arte | Rasterizar SVG en tiempo real cuesta CPU y el render no es consistente |
| **PNG** | Solo como intermedio del pipeline | — | El build final usa WebP |
| Audio | `.m4a` (AAC) | Ver [AUDIO_SYSTEM §4](../architecture/AUDIO_SYSTEM.md) | |

## 6. Spritesheets y atlas

- **MVP: imágenes sueltas.** Con culling y caché, el número de texturas por escena es manejable.
- **[DESIGNED FOR LATER]:** atlas por escena para los props pequeños, usando `drawAtlas` de Skia, **solo si** las mediciones de [PERFORMANCE](../architecture/PERFORMANCE.md) lo justifican.
  - Formato previsto: `atlas_{scene}_{nn}.webp` + un JSON de frames (`{ key: {x,y,w,h} }`).
  - Las claves de asset **no cambian**: el AssetLoader resuelve de forma transparente si una clave vive en un atlas.
- **Animación por frames** (agua, fuego): tiras horizontales `{key}_strip{N}.webp` [DESIGNED FOR LATER].

## 7. Estructura de carpetas

```
MyWorld/content/core/assets/
  images/chr/  images/obj/  images/env/  images/ui/  images/fx/
  audio/sfx/   audio/mus/   audio/amb/
assets/vendor/            # ← RAÍZ del repo: descargas CC0 de placeholder (NO se empaquetan tal cual)
```

- Los placeholders se **copian y renombran** desde `assets/vendor/` hacia `content/core/assets/`, con `placeholder: true` y `license`/`source` en `assets.json`.
- `assets/vendor/LICENSES.md` es el registro de licencias de lo descargado.

## 8. Licencias (obligatorio)

- Cada entrada de `assets.json` lleva `license` y `source`.
- **Licencias permitidas:**
  - `commissioned` (con cesión de derechos);
  - `CC0`;
  - licencias comerciales verificadas y compatibles con apps infantiles de pago.
- **Prohibido:** assets con licencias NC, ND, GPL o CC-BY-SA; assets generados por IA sin revisión legal; y assets de Freepik, Envato o Vecteezy para partes de personaje o muebles (cláusulas contra la personalización por el usuario). Ver [ASSET_MARKET_RESEARCH](research/ASSET_MARKET_RESEARCH.md).
- **Release:** cero `placeholder: true` (validador `--release`).

## 9. Checklist de entrega de un asset

- [ ] Nombre y clave correctos.
- [ ] Dimensiones ≤ límites, con padding de 4 px (excepto los fondos).
- [ ] Base del objeto en el borde inferior; estados alineados.
- [ ] WebP exportado con la calidad indicada.
- [ ] Registrado en `assets.json` con `w`, `h`, `license` y `source`.
- [ ] Probado en el dispositivo a 1×.
