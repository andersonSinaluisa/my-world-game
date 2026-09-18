# Harness headless

Ejecuta el motor en Node, sin emulador ([HU-GAME-002](../../../docs/stories/mvp/EPIC-001-foundation.md)).

## Uso

```ts
import { createTestGame } from '@/test/create-test-game';
import { entity, p } from '@/test/builders';
import { TEST_ROOM, testRoomEntities } from '@/test/fixtures/test-pack';

const game = createTestGame({ scene: TEST_ROOM, entities: testRoomEntities() });
game.world.create(entity('test:room/cup', { at: p(900, 960), components: { draggable: {} } }));
game.dispatch({ type: 'cameraSettled', cameraX: 1234, viewportW: 2338 });
game.advance(1000);          // mueve el reloj falso (y dispara sus timers)
game.events;                 // todos los eventos publicados, en orden
await game.saveStore.loadEntities('main');
```

| Pieza | Qué hace |
|---|---|
| `createTestGame(options)` | Motor determinista: reloj falso en `2026-01-01T00:00:00Z`, random con semilla fija, `InMemorySaveStore` y logger que registra. Por defecto `dev: true` (los invariantes lanzan); con `dev: false` se prueba el comportamiento de producción. |
| `FakeClock` | `now()`, `advance(ms)`, `setTimeout`/`clearTimeout` en tiempo falso. **Nunca uses timers reales.** |
| `InMemorySaveStore` | Mismo contrato que el adaptador SQLite: filas serializadas en JSON, `writeBatch` atómico, `backup()`/`restoreBackup()` y contadores `writeBatchCount`/`rowsWritten`. |
| `entity(id, overrides)` | Crea un `EntityInit` válido (en la escena `test:room` y con `transform`). |
| `fixtures/test-pack.ts` | Pack de prueba `test`: escena `test:room` de 3840×1080, suelo en y=960 y una entidad por capacidad. No depende del pack `core`. |

## Proyectos de Jest

- `engine`: `src/engine/**`, `src/test/**` y `scripts/**`. Se ejecuta en **Node sin preset de RN**: importar `react-native` en el motor hace fallar la suite (barrera del invariante 1 de ARCHITECTURE §6).
- `app`: `src/game/**`, `src/ui/**` y `src/app/**`, con el preset `jest-expo` y `@testing-library/react-native` v14 (API **asíncrona**: `await render(...)`, `await act(async () => ...)`).
