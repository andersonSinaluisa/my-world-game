# MyWorld (app)

Juego móvil 2D sandbox / casa de muñecas (Expo SDK 57 + React Native + Skia).

**La documentación del proyecto está en [`../docs`](../docs/README.md).** Agentes de IA: empezad por [`../docs/ai/AI_CONTEXT.md`](../docs/ai/AI_CONTEXT.md).

## Comandos

```bash
npm install
npx expo start          # requiere development build (Skia y expo-sqlite son nativos)
npm test                # Jest: proyectos "engine" (Node) y "app" (jest-expo)
npm run typecheck       # tsc --noEmit
npm run lint            # expo lint (incluye reglas de capas de ARCHITECTURE §6)
```

## Estructura

Ver [ARCHITECTURE §3](../docs/architecture/ARCHITECTURE.md).

- `src/engine/`: motor. `core|components|systems|scene|persistence…` son TS puro, sin React/RN/Skia/Expo. `adapters/` contiene render (Skia), input (gestos), audio y sqlite.
- `src/game/`: GameFacade, contexto React y hooks. Es el único puente entre la UI y el motor.
- `src/app/`: rutas expo-router. `src/ui/`: componentes de UI.
- `src/test/`: harness headless (ver [src/test/README.md](src/test/README.md)).
- `content/`: Content Packs. `content/sandbox/` es la escena temporal de verificación del render (EPIC-002).

En desarrollo, la pantalla de título enlaza al **Render sandbox**: rejilla de 1080 unidades, capas, paneo con inercia, saltos de cámara y presets de animación.
