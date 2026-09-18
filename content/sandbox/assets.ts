/**
 * Render sandbox asset map (EPIC-002 manual verification).
 * Temporary: HU-GAME-068 replaces hand-written maps with `assets.generated.ts` produced from `assets.json`.
 * All files are CC0 placeholders from Kenney "Background Elements Remastered" (assets/vendor/LICENSES.md).
 * They are PNG instead of WebP (ASSET_GUIDELINES §5) because no converter is set up yet; placeholders only.
 */
export interface SandboxAsset {
  source: number;
  w: number;
  h: number;
  placeholder: true;
  license: 'CC0';
  source_url: string;
}

const KENNEY = 'https://kenney.nl/assets/background-elements-remastered';

export const SANDBOX_ASSETS: Record<string, SandboxAsset> = {
  env_sandbox_bg_grass_01: { source: require('./images/env_sandbox_bg_grass_01.png'), w: 1024, h: 1024, placeholder: true, license: 'CC0', source_url: KENNEY },
  env_sandbox_bg_forest_01: { source: require('./images/env_sandbox_bg_forest_01.png'), w: 1024, h: 1024, placeholder: true, license: 'CC0', source_url: KENNEY },
  env_sandbox_house_01: { source: require('./images/env_sandbox_house_01.png'), w: 335, h: 448, placeholder: true, license: 'CC0', source_url: KENNEY },
  env_sandbox_house_02: { source: require('./images/env_sandbox_house_02.png'), w: 562, h: 434, placeholder: true, license: 'CC0', source_url: KENNEY },
  env_sandbox_tree_01: { source: require('./images/env_sandbox_tree_01.png'), w: 188, h: 408, placeholder: true, license: 'CC0', source_url: KENNEY },
  env_sandbox_tree_02: { source: require('./images/env_sandbox_tree_02.png'), w: 212, h: 508, placeholder: true, license: 'CC0', source_url: KENNEY },
  obj_sandbox_bush_01: { source: require('./images/obj_sandbox_bush_01.png'), w: 240, h: 120, placeholder: true, license: 'CC0', source_url: KENNEY },
  obj_sandbox_bush_02: { source: require('./images/obj_sandbox_bush_02.png'), w: 117, h: 104, placeholder: true, license: 'CC0', source_url: KENNEY },
  env_sandbox_cloud_01: { source: require('./images/env_sandbox_cloud_01.png'), w: 406, h: 242, placeholder: true, license: 'CC0', source_url: KENNEY },
  env_sandbox_fence_01: { source: require('./images/env_sandbox_fence_01.png'), w: 207, h: 155, placeholder: true, license: 'CC0', source_url: KENNEY },
  env_sandbox_sun_01: { source: require('./images/env_sandbox_sun_01.png'), w: 168, h: 168, placeholder: true, license: 'CC0', source_url: KENNEY },
};
