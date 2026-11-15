import type { AssetRef, Assets } from './level';

export interface ResolvedAsset {
  model?: string;
  texture?: string;
}

export interface ResolvedAssets {
  lander?: ResolvedAsset;
  species: Record<string, ResolvedAsset>;
}

/** Turns the asset paths of a level into URLs, relative to the level file's own URL. */
export function resolveAssets(assets: Assets | undefined, levelUrl: string): ResolvedAssets {
  const species = Object.entries(assets?.species ?? {}).map(
    ([name, ref]) => [name, resolveRef(ref, levelUrl)] as const,
  );
  return {
    lander: assets?.lander && resolveRef(assets.lander, levelUrl),
    species: Object.fromEntries(species),
  };
}

function resolveRef(ref: AssetRef, levelUrl: string): ResolvedAsset {
  const resolved: ResolvedAsset = {};
  if (ref.model !== undefined) resolved.model = new URL(ref.model, levelUrl).href;
  if (ref.texture !== undefined) resolved.texture = new URL(ref.texture, levelUrl).href;
  return resolved;
}
