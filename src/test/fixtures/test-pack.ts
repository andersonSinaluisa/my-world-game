import type { EntityInit } from '@/engine/core/entity';
import type { ActiveSceneInfo } from '@/engine/scene/scene-types';

import { entity } from '../builders';

/**
 * Test pack `test` (HU-GAME-002 R6). Independent from the real `core` pack so tests don't break
 * when content changes. Asset keys are fictitious and resolved by TEST_ASSET_SIZES.
 */
export const TEST_ROOM: ActiveSceneInfo = {
  id: 'test:room',
  size: { width: 3840, height: 1080 },
  background: {
    layers: [
      {
        id: 'walls',
        chunks: [
          { asset: 'test_env_bg_room_01', x: 0, width: 1920 },
          { asset: 'test_env_bg_room_02', x: 1920, width: 1920 },
        ],
      },
    ],
  },
};

export const TEST_FLOOR_Y = 960;
export const TEST_SPAWN_DEFAULT = { x: 700, y: TEST_FLOOR_Y };

export const TEST_ASSET_SIZES: Record<string, { w: number; h: number }> = {
  test_env_bg_room_01: { w: 1920, h: 1080 },
  test_env_bg_room_02: { w: 1920, h: 1080 },
  test_obj_ball: { w: 80, h: 80 },
  test_obj_apple: { w: 70, h: 80 },
  test_env_table: { w: 320, h: 200 },
  test_env_box: { w: 200, h: 160 },
  test_env_box_open: { w: 200, h: 160 },
  test_env_lamp_off: { w: 80, h: 300 },
  test_env_lamp_on: { w: 80, h: 300 },
  test_chr_placeholder: { w: 150, h: 300 },
};

/** One entity per capability (draggable, surface, openable, switchable, character-like). */
export const testRoomEntities = (): EntityInit[] => [
  entity('test:room/ball', {
    at: { x: 400, y: TEST_FLOOR_Y },
    tags: ['toy'],
    components: {
      sprite: { asset: 'test_obj_ball', layer: 'props' },
      hitbox: { shape: { type: 'circle', x: 0, y: -40, r: 40 } },
      draggable: {},
      animations: { drop: 'squash' },
    },
  }),
  entity('test:room/table', {
    at: { x: 1200, y: TEST_FLOOR_Y },
    tags: ['furniture'],
    components: {
      sprite: { asset: 'test_env_table', layer: 'furniture' },
      hitbox: { shape: { type: 'rect', x: -160, y: -200, w: 320, h: 200 } },
      surface: { segments: [{ x1: -150, x2: 150, y: -190 }] },
      draggable: { mode: 'floorOnly' },
    },
  }),
  entity('test:room/box', {
    at: { x: 2000, y: TEST_FLOOR_Y },
    tags: ['furniture'],
    components: {
      sprite: { asset: 'test_env_box', layer: 'furniture', byState: { open: 'test_env_box_open' } },
      hitbox: { shape: { type: 'rect', x: -100, y: -160, w: 200, h: 160 } },
      states: { current: 'closed', values: ['closed', 'open'] },
      openable: { openState: 'open', closedState: 'closed' },
    },
  }),
  entity('test:room/lamp', {
    at: { x: 2600, y: TEST_FLOOR_Y },
    tags: ['furniture', 'light'],
    components: {
      sprite: { asset: 'test_env_lamp_off', layer: 'furniture', byState: { on: 'test_env_lamp_on' } },
      hitbox: { shape: { type: 'rect', x: -40, y: -300, w: 80, h: 300 } },
      states: { current: 'off', values: ['off', 'on'] },
      switchable: { onState: 'on', offState: 'off' },
    },
  }),
  entity('test:room/character', {
    at: TEST_SPAWN_DEFAULT,
    tags: ['character'],
    components: {
      sprite: { asset: 'test_chr_placeholder', layer: 'characters' },
      hitbox: {
        shape: { type: 'rect', x: -75, y: -300, w: 150, h: 300 },
        zones: { mouth: { type: 'circle', x: 0, y: -230, r: 20 } },
      },
      draggable: {},
    },
  }),
];
