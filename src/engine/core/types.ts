/**
 * Identifier aliases (ENTITY_SCHEMA §1-§2).
 * Brands are optional so plain strings from JSON content stay assignable; they document intent.
 */
export type EntityId = string & { readonly __brand?: 'EntityId' };
export type PrefabId = string & { readonly __brand?: 'PrefabId' };
export type SceneId = string & { readonly __brand?: 'SceneId' };
export type AssetKey = string & { readonly __brand?: 'AssetKey' };
export type AudioKey = string & { readonly __brand?: 'AudioKey' };
export type StateId = string;

export const CONTENT_ID_PATTERN = /^[a-z0-9_]+:[a-z0-9_]+$/;

/** Point in world units (ADR-007: scene height = 1080, origin top-left, y down). */
export interface WorldPoint {
  x: number;
  y: number;
}
