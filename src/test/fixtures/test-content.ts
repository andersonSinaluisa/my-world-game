import type { RawPack } from "@/engine/content/raw-pack";

/**
 * In-memory `test` pack (HU-GAME-002 R6) used by scene, interaction and save tests.
 * Deliberately independent from the real `core` pack. Returns a fresh deep copy each call,
 * so tests can mutate it to build invalid variants.
 */
const img = (w: number, h: number, file: string) => ({
  file: `assets/images/${file}.webp`,
  w,
  h,
});

const base = {
  manifest: {
    file: "manifest.json",
    data: {
      id: "test",
      name: "pack.test.name",
      version: "1.0.0",
      formatVersion: 1,
      provides: { scenes: ["room", "hall"] },
      newGame: {
        sceneId: "test:room",
        spawnId: "default",
        coins: 50,
        dailyGiftCoins: 10,
        unlocks: [],
        inventoryCapacity: 12,
      },
      idAliases: { "test:old_ball": "test:ball" },
      removedIds: ["test:retired_toy"],
      distribution: "bundled",
    },
  },
  assets: {
    file: "assets.json",
    data: {
      images: {
        test_env_bg_room_01: img(1920, 1080, "test_env_bg_room_01"),
        test_env_bg_room_02: img(1920, 1080, "test_env_bg_room_02"),
        test_obj_ball: img(80, 80, "test_obj_ball"),
        test_obj_brush: img(60, 60, "test_obj_brush"),
        test_env_table: img(240, 180, "test_env_table"),
        test_env_box: img(200, 160, "test_env_box"),
        test_env_box_open: img(200, 160, "test_env_box_open"),
        test_env_box_painted: img(200, 160, "test_env_box_painted"),
        test_env_lamp_off: img(80, 300, "test_env_lamp_off"),
        test_env_lamp_on: img(80, 300, "test_env_lamp_on"),
        test_env_plant: img(120, 200, "test_env_plant"),
        test_env_chair: img(120, 220, "test_env_chair"),
        test_obj_teddy: img(90, 90, "test_obj_teddy"),
      },
      audio: {},
    },
  },
  prefabs: [
    {
      file: "prefabs/toy/ball.json",
      data: {
        id: "ball",
        category: "toy",
        tags: ["toy"],
        components: {
          sprite: { asset: "test_obj_ball", layer: "props" },
          hitbox: { shape: { type: "circle", x: 0, y: -40, r: 40 } },
          draggable: {},
          animations: { drop: "squash" },
        },
        metadata: { name: "object.ball.name" },
      },
    },
    {
      file: "prefabs/toy/teddy.json",
      data: {
        id: "teddy",
        category: "toy",
        tags: ["toy"],
        components: {
          sprite: { asset: "test_obj_teddy", layer: "props" },
          hitbox: { shape: { type: "rect", x: -45, y: -90, w: 90, h: 90 } },
          draggable: {},
          animations: { tap: "wiggle" },
        },
        metadata: { name: "object.teddy.name" },
      },
    },
    {
      file: "prefabs/tool/brush.json",
      data: {
        id: "brush",
        category: "tool",
        tags: ["brush"],
        components: {
          sprite: { asset: "test_obj_brush", layer: "props" },
          hitbox: { shape: { type: "rect", x: -30, y: -60, w: 60, h: 60 } },
          draggable: {},
        },
        metadata: { name: "object.brush.name" },
      },
    },
    {
      file: "prefabs/furniture/table.json",
      data: {
        id: "table",
        category: "furniture",
        tags: ["furniture"],
        components: {
          sprite: { asset: "test_env_table", layer: "furniture" },
          hitbox: { shape: { type: "rect", x: -120, y: -180, w: 240, h: 180 } },
          draggable: { mode: "floorOnly" },
          surface: { segments: [{ x1: -120, x2: 120, y: -180 }] },
        },
        metadata: { name: "object.table.name" },
      },
    },
    {
      file: "prefabs/furniture/chair.json",
      data: {
        id: "chair",
        category: "furniture",
        tags: ["furniture"],
        components: {
          sprite: { asset: "test_env_chair", layer: "furniture" },
          hitbox: { shape: { type: "rect", x: -60, y: -220, w: 120, h: 220 } },
          draggable: { mode: "floorOnly" },
        },
        metadata: { name: "object.chair.name" },
      },
    },
    {
      file: "prefabs/container/box.json",
      data: {
        id: "box",
        category: "container",
        tags: ["furniture"],
        components: {
          sprite: {
            asset: "test_env_box",
            layer: "furniture",
            byState: {
              open: "test_env_box_open",
              painted: "test_env_box_painted",
            },
          },
          hitbox: {
            shape: { type: "rect", x: -100, y: -160, w: 200, h: 160 },
            zones: {
              front: { type: "rect", x: -100, y: -120, w: 200, h: 120 },
              lid: { type: "rect", x: -50, y: -160, w: 100, h: 40 },
            },
          },
          states: { current: "closed", values: ["closed", "open", "painted"] },
          openable: { openState: "open", closedState: "closed" },
          container: {
            capacity: 6,
            accepts: ["food", "drink"],
            slots: [0, 1, 2, 3, 4, 5].map((i) => ({ x: -75 + i * 30, y: -60 })),
          },
        },
        metadata: { name: "object.box.name" },
      },
    },
    {
      file: "prefabs/decor/lamp.json",
      data: {
        id: "lamp",
        category: "decor",
        tags: ["furniture", "light"],
        components: {
          sprite: {
            asset: "test_env_lamp_off",
            layer: "furniture",
            byState: { on: "test_env_lamp_on" },
          },
          hitbox: { shape: { type: "rect", x: -40, y: -300, w: 80, h: 300 } },
          states: { current: "off", values: ["off", "on"] },
          switchable: { onState: "on", offState: "off" },
        },
        metadata: { name: "object.lamp.name" },
      },
    },
    {
      file: "prefabs/decor/plant.json",
      data: {
        id: "plant",
        category: "decor",
        tags: ["decor"],
        components: {
          sprite: { asset: "test_env_plant", layer: "foreground" },
          hitbox: { shape: { type: "rect", x: -60, y: -200, w: 120, h: 200 } },
        },
        metadata: { name: "object.plant.name" },
      },
    },
  ],
  scenes: [
    {
      file: "scenes/room.json",
      data: {
        id: "room",
        name: "scene.room.name",
        location: "room",
        size: { width: 3840, height: 1080 },
        background: {
          layers: [
            {
              id: "walls",
              chunks: [
                { asset: "test_env_bg_room_01", x: 0, width: 1920 },
                { asset: "test_env_bg_room_02", x: 1920, width: 1920 },
              ],
            },
          ],
        },
        floor: [{ y: 960 }],
        zones: [
          { id: "left", name: "zone.left.name", x1: 0, x2: 1920 },
          { id: "right", name: "zone.right.name", x1: 1920, x2: 3840 },
        ],
        spawnPoints: [
          { id: "default", x: 700, y: 960 },
          { id: "door", x: 500, y: 960 },
        ],
        entities: [
          { localId: "ball", prefabId: "ball", transform: { x: 1000, y: 960 } },
          {
            localId: "table",
            prefabId: "table",
            transform: { x: 2600, y: 960 },
          },
          { localId: "box", prefabId: "box", transform: { x: 2000, y: 960 } },
          {
            localId: "box_ball",
            prefabId: "ball",
            inContainer: { localId: "box", slot: 0 },
          },
          { localId: "lamp", prefabId: "lamp", transform: { x: 3200, y: 960 } },
          {
            localId: "rug",
            inline: {
              components: {
                sprite: { asset: "test_env_plant", layer: "background" },
              },
              tags: ["decor"],
            },
            transform: { x: 300, y: 960 },
          },
        ],
      },
    },
    {
      file: "scenes/hall.json",
      data: {
        id: "hall",
        name: "scene.hall.name",
        location: "hall",
        size: { width: 1920, height: 1080 },
        background: {
          layers: [
            {
              id: "walls",
              chunks: [{ asset: "test_env_bg_room_01", x: 0, width: 1920 }],
            },
          ],
        },
        floor: [{ y: 960 }],
        spawnPoints: [
          { id: "default", x: 300, y: 960 },
          { id: "door", x: 500, y: 960 },
        ],
        entities: [
          {
            localId: "chair",
            prefabId: "chair",
            transform: { x: 900, y: 960 },
          },
        ],
      },
    },
  ],
  rules: [
    {
      file: "interactions/test.rules.json",
      data: [
        {
          id: "paint_open_box",
          trigger: "drop",
          source: { has: ["draggable"], tags: ["brush"] },
          target: { has: ["openable"] },
          conditions: [{ type: "isOpen", of: "$target" }],
          actions: [{ type: "setState", entity: "$target", state: "painted" }],
          priority: 70,
        },
        {
          id: "tag_box",
          trigger: "drop",
          source: { has: ["draggable"] },
          target: { has: ["openable"] },
          actions: [{ type: "cycleState", entity: "$target" }],
          priority: 10,
        },
        {
          id: "hit_zone_lid",
          trigger: "drop",
          source: { has: ["draggable"], tags: ["brush"] },
          target: { has: ["openable"], zone: "lid" },
          actions: [{ type: "setState", entity: "$target", state: "open" }],
          priority: 70,
        },
        {
          id: "tap_cycle",
          trigger: "tap",
          target: { has: ["switchable"] },
          actions: [{ type: "cycleState" }],
          priority: 10,
        },
      ],
    },
  ],
  locales: {
    es: {
      file: "locales/es.json",
      data: {
        "pack.test.name": "Prueba",
        "scene.room.name": "Cuarto",
        "scene.hall.name": "Pasillo",
        "zone.left.name": "Izquierda",
        "zone.right.name": "Derecha",
        "object.ball.name": "Pelota",
        "object.teddy.name": "Osito",
        "object.brush.name": "Pincel",
        "object.table.name": "Mesa",
        "object.chair.name": "Silla",
        "object.box.name": "Caja",
        "object.lamp.name": "Lámpara",
        "object.plant.name": "Planta",
        "ui.play.label": "Jugar",
      },
    },
    en: {
      file: "locales/en.json",
      data: {
        "pack.test.name": "Test",
        "scene.room.name": "Room",
        "scene.hall.name": "Hall",
        "zone.left.name": "Left",
        "zone.right.name": "Right",
        "object.ball.name": "Ball",
        "object.teddy.name": "Teddy",
        "object.brush.name": "Brush",
        "object.table.name": "Table",
        "object.chair.name": "Chair",
        "object.box.name": "Box",
        "object.lamp.name": "Lamp",
        "object.plant.name": "Plant",
        "ui.play.label": "Play",
      },
    },
  },
};

export function testPack(): RawPack {
  return JSON.parse(JSON.stringify(base)) as RawPack;
}

/** Helpers to reach into the raw pack in tests. */
export const prefabData = (pack: RawPack, id: string) =>
  pack.prefabs.find((p) => (p.data as { id: string }).id === id)!
    .data as Record<string, unknown> & {
    components: Record<string, unknown>;
  };
export const sceneData = (pack: RawPack, id: string) =>
  pack.scenes.find((s) => (s.data as { id: string }).id === id)!.data as Record<
    string,
    unknown
  > & {
    entities: Record<string, unknown>[];
  };
