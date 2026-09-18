# Coding Guidelines

> **Status:** Accepted (v1). Se ajusta cuando exista el primer código. · **Last Updated:** 2026-09-18
> **Related:** [DEVELOPMENT_RULES](DEVELOPMENT_RULES.md) · [../architecture/ARCHITECTURE.md §3](../architecture/ARCHITECTURE.md)

## 1. TypeScript

- `strict: true` (ya activado en `MyWorld/tsconfig.json`). Alias `@/*` → `src/*`.
- **Los tipos de datos se infieren de zod:** `export const EdibleSchema = z.object({...}).strict(); export type Edible = z.infer<typeof EdibleSchema>;`
- **IDs con tipos "branded"** para no mezclarlos: `type EntityId = string & { __brand: 'EntityId' }`. Igual con `PrefabId`, `SceneId`, `AssetKey` y `AudioKey`.
- **Uniones discriminadas** para `Location`, comandos y eventos (`kind` / `type`). Usa `switch` exhaustivo con `never`.
- Prefiere `readonly` en los tipos expuestos y funciones puras en los systems.

## 2. Nombres

| Elemento | Convención | Ejemplo |
|---|---|---|
| Archivos TS | `kebab-case.ts` (sigue la plantilla existente) | `interaction-resolver.ts` |
| Componentes React | `PascalCase` en un archivo `kebab-case.tsx` | `entity-sprite.tsx` → `EntitySprite` |
| Componentes ECS (claves) | `camelCase` | `edible`, `seat`, `switchable` |
| Acciones y condiciones | `camelCase` verbo | `eat`, `toggleOpen`, `containerHasSpace` |
| Eventos | `camelCase` en pasado | `entityMoved`, `interactionRejected` |
| Comandos | `camelCase` imperativo | `dragStart`, `enterScene` |
| Tests | `*.test.ts` junto al archivo o en `src/test/` para escenarios | `eat.test.ts` |

## 3. Estructura de un system o una acción

```ts
// engine/actions/eat.ts
export const EatParams = z.object({ food: RoleRef.default('$source'), eater: RoleRef.default('$target') }).strict();

export const eatAction: ActionHandler<typeof EatParams> = {
  type: 'eat',
  params: EatParams,
  validate(ctx, p) { /* devuelve { ok } | { ok:false, reason } sin mutar */ },
  execute(ctx, p)  { /* muta vía ctx.world / systems; nada de I/O */ },
};
```

- **Sin singletons:** todo recibe `ctx` (world, content, clock, random, logger).
- **Sin I/O** en `engine/core|systems|actions|rules`.

## 4. React (UI y render)

- **Componentes de entidad memoizados**, suscritos por id: `const e = useEntity(id)`.
- **Nada de estado de juego en `useState`.** Solo estado de UI local (por ejemplo, qué pestaña del creador está abierta).
- **Animación:** SharedValues, `useDerivedValue` y props Skia enlazadas. **No** `setState` en `onUpdate` de un gesto.
- **SharedValues con `.get()` / `.set()`**, nunca `.value` (el lint del React Compiler lo rechaza, ADR-001/OQ-10).
- **Tests de componentes y hooks:** `@testing-library/react-native` v14 tiene una API asíncrona (`await render(...)`, `await act(async () => ...)`).
- **Cruce de threads** encapsulado en `engine/adapters/input`. Verifica la API de `react-native-worklets` 0.10 (`scheduleOnRN`) frente a `runOnJS` en la versión instalada.
- **React Compiler** está activado (`experiments.reactCompiler`): evita patrones que lo rompan (mutar props, leer refs durante el render).

## 5. Tests

- **Unit:** funciones puras (resolver, condiciones, merge de prefabs, serializer, migraciones).
- **Integración headless:** `createTestGame({ packs, scene, saveStore: new InMemorySaveStore(), clock: fakeClock() })` + comandos + asserts sobre el World y el guardado.
- **Fixtures de contenido de test** en `src/test/fixtures/packs/` (mini-packs), para que los tests no dependan del contenido real del pack `core`.
- **Fixtures de guardado por versión** en `src/test/fixtures/saves/v{N}.json` (HU-GAME-072).
- **Sin snapshots** de árboles React para la lógica del juego. Se permiten en componentes de UI estables.

## 6. Rendimiento en el código

- No crear objetos o arrays nuevos en selectores si nada cambió (referencias estables).
- No recorrer todas las entidades en cada evento: usa los índices (`world.index.*`) y el `RuleIndex`.
- No usar `JSON.parse`/`stringify` en caminos calientes del drag.

## 7. Comentarios y documentación

- Comenta **por qué**, no qué.
- Enlaza la HU o el ADR en las decisiones no obvias: `// ADR-009: commit only on dragEnd`.
- Los tipos públicos del motor llevan TSDoc breve.
