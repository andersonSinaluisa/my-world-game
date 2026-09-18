# Character Schema

> **Status:** Accepted (v1, formatVersion 1) · **Last Updated:** 2026-09-18
> **Related ADR:** [ADR-003](../decisions/ADR-003-ECS.md)
> **Related Epic:** EPIC-004, EPIC-005, EPIC-011
> **Related HU:** HU-GAME-013 a HU-GAME-023, HU-GAME-039 a HU-GAME-041
> **Sistema:** [CHARACTER_SYSTEM](../architecture/CHARACTER_SYSTEM.md)

Un personaje es una **entidad** más: tiene `transform`, `hitbox`, `draggable` y además los componentes de personaje.

Hay dos piezas de datos distintas:
1. **Catálogo de partes**: contenido de solo lectura en el pack. Define qué opciones existen.
2. **Componentes del personaje**: datos del jugador que se guardan. Define qué eligió.

## 1. Catálogo de partes (contenido)

```
content/<pack>/characters/parts.json
```

```ts
interface CharacterPartsCatalog {
  bodyTypes: { id: BodyTypeId; name: I18nKey; icon: AssetKey; height: number /* world units */; layers: PoseLayerSet }[];
  skinTones: { id: SkinToneId; color: string /* #RRGGBB */ }[];
  eyes: { id: EyesId; icon: AssetKey; asset: AssetKey; closedAsset?: AssetKey }[];
  mouths: { id: MouthId; icon: AssetKey; asset: AssetKey; byExpression?: Partial<Record<ExpressionId, AssetKey>> }[];
  hairStyles: { id: HairId; icon: AssetKey; back?: AssetKey; front: AssetKey; byBodyType?: Partial<Record<BodyTypeId, { back?: AssetKey; front: AssetKey }>> }[];
  hairColors: { id: HairColorId; color: string }[];
  starterClothes: PrefabId[];                                   // prefabs `wearable` disponibles en el creador
  defaults: { bodyType: BodyTypeId; skinTone: SkinToneId; eyes: EyesId; mouth: MouthId; hairStyle: HairId; hairColor: HairColorId; outfit: Partial<Record<WearSlot, PrefabId>> };
}

// Sprites de cuerpo por pose. Se pintan en escala de grises y se tiñen con skinTone (ver CHARACTER_SYSTEM §4)
type PoseLayerSet = Record<PoseId, Partial<Record<CharacterLayer, AssetKey>>>;
```

**Extensiones v1 (implementadas en HU-GAME-013/022):**

```ts
// en bodyTypes[]:
faceOffset?: { x: number; y: number };   // las partes de cara (ojos, boca y pelo sin byBodyType) se dibujan sobre el
                                         // lienzo del PRIMER tipo de cuerpo; el resto de cuerpos las desplaza este offset.
                                         // Así ojos y bocas no necesitan una variante por cuerpo (propuesta aceptada).
// en skinTones[], eyes[], mouths[], hairStyles[], hairColors[]:
name?: I18nKey;                          // etiqueta de accesibilidad del creador
// en el catálogo:
colorTags?: string[];                    // paleta de colores de marco de personaje (HU-GAME-022 R3)
```

El validador de contenido comprueba: assets referenciados, ids únicos por lista (`duplicatePartId`), `defaults` existentes (`unknownPart`), `byBodyType` con cuerpos existentes, y que cada prenda de `starterClothes` y de `defaults.outfit` tenga `wearable` (`notWearable`), el slot correcto (`invalidWearable`) y sprites para **todos** los tipos de cuerpo (`missingBodyVariant`, error).

**Cantidades objetivo del MVP** (ver [MVP_SCOPE](../product/MVP_SCOPE.md)):
- 2 tipos de cuerpo: `child` y `adult`.
- 8 tonos de piel.
- 6 ojos y 6 bocas.
- 8 peinados.
- 8 colores de pelo.
- Ropa de inicio: 6 prendas superiores, 5 inferiores y 4 pares de zapatos.

## 2. Componentes del personaje (datos del jugador)

### `character`
```ts
{
  isNpc: boolean;              // false para los creados por el jugador
  nickname?: string;           // opcional, máx. 12 caracteres, solo local (ver GAME_RULES: privacidad)
  createdAt: string;           // ISO-8601
  colorTag?: string;           // color del marco en la lista de personajes
}
```

### `appearance`
```ts
{
  bodyType: BodyTypeId;
  skinTone: SkinToneId;
  eyes: EyesId;
  mouth: MouthId;
  hairStyle: HairId;
  hairColor: HairColorId;
  // [DESIGNED FOR LATER] eyebrows, nose, cheeks, eyeColor, freckles, glasses, accessories[]
}
```

### `outfit`
```ts
Partial<Record<WearSlot, EntityId>>   // ÍNDICE DERIVADO de las entidades con location {kind:'worn', characterId}
```
> `outfit` **no se persiste**. Se reconstruye desde las locations (ver [ECS §4](../architecture/ECS.md)). Está documentado aquí porque los selectores y la UI lo leen.

### `holder`
```ts
{ hands: ('left' | 'right')[] }       // manos disponibles; lo sostenido se deriva de las locations 'held'
```

### `pose`
```ts
{
  current: PoseId;          // 'idle' | 'dangle' | 'sit' | 'sleep' | 'eat' | 'drink'
  seatId?: EntityId;        // si está sentado o dormido
  returnTo?: PoseId;        // pose a la que vuelve tras una pose temporal (eat/drink)
}
```
Poses **persistentes**: `idle`, `sit` y `sleep`, que se guardan. Poses **temporales**: `dangle`, `eat` y `drink`, que no se guardan; al cargar la partida el personaje vuelve a `returnTo` o a `idle`.

### `expression`
```ts
{ current: ExpressionId; untilMs?: number }   // 'neutral' | 'happy' | 'surprised' | 'sleepy' | 'yum' | 'curious'
```
No se persiste: al cargar, todos los personajes empiezan con la expresión `neutral`.

## 3. Capas del personaje (`CharacterLayer`)

Orden de dibujo, de atrás hacia adelante. Es **fijo** y lo define el motor.

| # | Capa | Origen | Teñido |
|---|---|---|---|
| 0 | `shadow` | Motor (elipse) | — |
| 1 | `hairBack` | `hairStyles[].back` | hairColor |
| 2 | `legs` | `bodyTypes[].layers[pose].legs` | skinTone |
| 3 | `bottomClothes` | `wearable.layers.bottomClothes` | — |
| 4 | `shoes` | `wearable.layers.shoes` | — |
| 5 | `torso` | `bodyTypes[].layers[pose].torso` | skinTone |
| 6 | `torsoClothes` | `wearable.layers.torsoClothes` | — |
| 7 | `armL` | body | skinTone |
| 8 | `armClothesL` | wearable | — |
| 9 | `heldL` | sprite del objeto sostenido (mano izquierda) | — |
| 10 | `armR` | body | skinTone |
| 11 | `armClothesR` | wearable | — |
| 12 | `heldR` | objeto sostenido (mano derecha) | — |
| 13 | `head` | body | skinTone |
| 14 | `eyes` | `eyes[].asset` / `closedAsset` | — |
| 15 | `mouth` | `mouths[].asset` / `byExpression` | — |
| 16 | `hairFront` | `hairStyles[].front` | hairColor |
| 17 | `accessories` | [DESIGNED FOR LATER] | — |

- Todas las capas de un tipo de cuerpo comparten **el mismo lienzo y el mismo pivot**: centro inferior, entre los pies. Eso permite superponerlas sin offsets.
- Las **manos** tienen un punto de anclaje por pose (`handAnchors`) en el catálogo, para colocar el objeto sostenido.

```ts
// en bodyTypes[]: 
handAnchors: Record<PoseId, { left: { x: number; y: number }; right: { x: number; y: number } }>;
mouthAnchor: Record<PoseId, { x: number; y: number }>;     // para la animación de comer
```

## 4. Hitbox estándar de un personaje

La genera el motor a partir de `bodyTypes[].height`. No se define por personaje.

| Zona | Uso |
|---|---|
| `head` | comer y beber (junto con `mouth`) |
| `mouth` | comer y beber (prioridad) |
| `handL`, `handR` | sostener |
| `body` | vestir, sostener (fallback), arrastrar |
| `torso`, `legs`, `feet` | bandas verticales dentro de `body`: vestir por slot y **quitar ropa** con pulsación larga (`unwear_clothes`): `torso`→`top`, `legs`→`bottom`, `feet`→`shoes`. Propuesta: `torso` desde los hombros hasta la cintura, `legs` desde la cintura hasta los tobillos, `feet` el 12 % inferior. |

Proporciones implementadas (`characterHitbox`, con `h = height`): `body` = rect de ancho `0,44 h` y alto `h`; `head` = 38 % superior (ancho `0,34 h`); `mouth` = `0,14 h × 0,08 h` a `0,71 h`; `handL`/`handR` = círculos de radio `0,09 h` en `handAnchors.idle`; `torso` = 62 %→36 %, `legs` = 36 %→12 %, `feet` = 12 %→0. Padding 0.

Además del hitbox, el motor da al personaje un **`sprite` derivado** (capa `characters`, asset de su torso idle) que nunca se dibuja tal cual: sirve para el orden de render (`z = transform.y`), el culling y la pertenencia a la escena. El renderer dibuja la pila de capas. Ni el `sprite` ni el `hitbox` ni la `expression` se guardan.

## 5. Ejemplo de personaje guardado

```json
{
  "id": "rt_01J8Z7Q3M4N5P6R7S8T9V0W1X2",
  "tags": ["character"],
  "location": { "kind": "scene", "sceneId": "core:home" },
  "components": {
    "transform": { "x": 1210, "y": 960 },
    "draggable": {},
    "character": { "isNpc": false, "createdAt": "2026-09-18T15:02:11Z", "colorTag": "#FFB5C2" },
    "appearance": { "bodyType": "child", "skinTone": "skin_04", "eyes": "eyes_round", "mouth": "mouth_smile", "hairStyle": "hair_buns", "hairColor": "hair_berry" },
    "holder": { "hands": ["left", "right"] },
    "pose": { "current": "sit", "seatId": "core:home/sofa" }
  }
}
```

Las prendas vestidas se guardan como **entidades propias** con `location: { kind: "worn", characterId: "rt_01J8…", slot: "top" }`.

## 6. Límites

- Personajes creados por el jugador: **máximo 12** en el MVP. El motivo es el rendimiento: el caso peor es tener todos en la misma escena (ver [PERFORMANCE](../architecture/PERFORMANCE.md)).
- `nickname` es opcional. En el MVP **no se muestra fuera del dispositivo** ni se envía a ningún servidor.
