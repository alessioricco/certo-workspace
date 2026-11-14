# Original asset register

## M9 — 2026-11-14

All release artwork is generated from original vector-like raster recipes in `scripts/generate-assets.mjs` by OpenHands on behalf of Latticewake contributors, licensed under [MIT](LICENSE). No images, fonts or logos are imported.

| Item | Recipe/source | Runtime/output |
| --- | --- | --- |
| Favicon, 192/512px install icons, maskable 512px icon and Apple touch icon | Same 512-unit navigation-lattice mark: circular rim, cross lattice, diamond boundary and amber/ivory core; maskable version uses a 0.6 scale to stay within the safe area | Generated PNGs in `public/icons/` during `npm run build` |
| Social preview image | Original 1200×630 dark navigation field, lattice mark, lines and restrained deterministic star pattern | Generated `public/social-card.png`, referenced by Open Graph/Twitter metadata |

No external artwork, raster source, runtime request, or additional npm dependency was introduced. The generated PWA artwork is included in `dist/` and precached by the scoped service worker.


## M6 — 2026-11-11

All new art, timbres and music are original, by OpenHands on behalf of Latticewake contributors, licensed under [MIT](LICENSE). No imported recordings, images, font files, packs, melodies or new third-party assets.

| Item | Recipe/source | Runtime preparation |
| --- | --- | --- |
| Glassy shot, open, capture, pickup, ward, phase and clear tones | `src/audio/patches.ts`, `synthesize`: triangle/sine partials, short attack/decay, rising/falling pitch | Ten cached mono SFX buffers after explicit audio activation |
| Filtered noise hit/destruction/player-loss impacts | Same generator, one-pole low-pass seeded noise plus pitched body | Independent xorshift32 stream with salt `0x85ebca6b`; fixed run-seed variant, not gameplay RNG |
| Original restrained 16-bar sequence | `LEAD` / `BASS`, `leadNote` / `bassNote` / `synthesizeNote` in `src/audio/patches.ts` | 110 BPM, 4/4, 128 eighth positions, eight lead and three bass pitch buffers; no external song/codec |
| Hostile chevron and radial cyan glow | `createAtlas` in `src/render/testbed.ts` | Existing 704×304 2× atlas, unused right-hand cells; chevron preserves original shape/size |
| Static subtle scanlines | `createScanlines` in the same module | One 360×640 transparent sheet; optional and off by default |
| Localized hit/ward/capture/pickup/loss outlines and small loss shake | `src/render/feedback.ts` and renderer | 32 fixed marks; no full-screen flashing or added collision shapes |

The cache has 21 mono buffers totaling 9.17 seconds (about 1.76 MB PCM at 48 kHz; actual native sample rate varies). WebAudio needs a one-shot source per playback; sources disconnect on end/stop and voice slots cap at 24 SFX + 8 music. No asset files are emitted/downloaded. Defaults: glow/scanlines off; low effects and OS reduced motion omit decorative animation without hiding hazards, HP, warnings, shields or Echo cues. Human listening/device qualification remains M8, not an originality or performance claim here.

Historical checkpoint inventories below describe their then-current scope.

## M5 — 2026-11-11

The current original in-memory atlas is **704 × 304 pixels**, baked once at 2× logical resolution. Existing Needle/raider/star recipes are retained. New recipes live in `src/render/signature.ts` (`paintSignatureAtlas`, called by `createAtlas`). Author: OpenHands on behalf of Latticewake contributors; license: [MIT](LICENSE). No external images, fonts, audio or dependencies.

- Echo pulse: magenta ring with a hollow diamond center, visibly distinct from ordinary hostile chevrons by outline, not color alone.
- Prismatic drone: cyan kite/facet and ivory spine; independent left/right companions.
- Pickups: outlined cyan square plaques with system-font **W / F / O** glyphs for Ward, Fan and Overclock.
- Meridian Engine: segmented six-sided side emitters and larger hollow nested central gate, joined by a restrained beam; never an insect silhouette. Cached sprites plus small HP bars, steady phase-warning brackets and text labels identify exposed parts.
- Echo field: steady radius-32 circle plus lattice square. Ward: distinct rectangular outline. Respawn protection retains its earlier radius-26 ring. All gameplay cues persist under reduced motion; none flashes.

Historical checkpoint inventories below describe their then-current atlas dimensions and scope.


## M4 — 2026-11-11

The M3 448×192 atlas remains unchanged. New original shape cues are deliberately small Canvas primitives in `src/render/testbed.ts`, not imported images or complex per-frame silhouettes. Author: OpenHands on behalf of Latticewake contributors; license: [MIT](LICENSE).

- Steady left/right brackets and downward chevron mark the 36-tick dive warning.
- Small ivory down-chevrons distinguish hostile shots from the long amber player shots, without relying on color alone.
- A steady 26-unit-radius ring marks respawn protection; it never flashes.
- Tally/respawn text uses the existing system font. All hazard/protection cues persist under reduced motion.

Authored shallow/hook/sweep/return recipes in `src/game/attacks.ts` are original quantized gameplay paths. No audio, external assets, icons or dependencies were added. Earlier checkpoint inventories below are historical.


## M3 — 2026-11-10

The current atlas is **448 × 192 pixels**, baked once at 2× logical resolution. Existing Needle/shot/star recipes are retained. All three enemies have normal/damaged cached variants. Rendering uses image blits and small HP rectangles, not reconstructed vector silhouettes each frame.

| Item | Author/source | Recipe/location | License |
| --- | --- | --- | --- |
| Shardlet, two notched split-diamond facets | OpenHands on behalf of Latticewake contributors; original geometric recipe | `src/render/testbed.ts`, `createAtlas` | [MIT](LICENSE) |
| Spindle, rotating three-prong tuning instrument | OpenHands on behalf of Latticewake contributors; original geometric recipe | `src/render/testbed.ts`, `createAtlas` | [MIT](LICENSE) |
| Bellframe, hollow angular arch and inner core | OpenHands on behalf of Latticewake contributors; original geometric recipe | `src/render/testbed.ts`, `createAtlas` | [MIT](LICENSE) |
| Bright damaged variants, filled/missing HP pips and radial explosion fragments | Original recipes/code; no imported assets | `src/render/testbed.ts`, `src/game/particles.ts` | [MIT](LICENSE) |

Silhouettes, HP pips and the menu's HP/score legend distinguish roles without relying on color alone. Reduced motion freezes cosmetic rotation/parallax and hides fragments, not gameplay entry/sway or hit feedback. No M3 enemy attacks or audio were introduced at this checkpoint; M6 audio and M9 icons/social art are recorded in their later sections. The inventories below describe earlier checkpoints, not current atlas dimensions or missing-enemy status.


## M2 — 2026-11-10

The diagnostic probe is replaced by the original Needle craft and shots. The grid/compass remain cached. A **160 × 96 pixel** in-memory atlas is baked once at boot (2× logical recipe resolution); every gameplay sprite/star is a `drawImage` blit. No per-frame sprite paths or imported images.

| Item | Author/source | Recipe/location | License |
| --- | --- | --- | --- |
| Needle faceted craft, pale central spine, amber engine | OpenHands on behalf of Latticewake contributors; original geometric recipe | `src/render/testbed.ts`, `createAtlas` | [MIT](LICENSE) |
| Amber/ivory player shot and muted blue star texel | OpenHands on behalf of Latticewake contributors; original recipe | `src/render/testbed.ts`, `createAtlas` | [MIT](LICENSE) |
| 72-star, three-layer seeded parallax layout | Original code; no asset files | `src/render/starfield.ts`; visual-only xorshift32 salt `0x9e3779b9` | [MIT](LICENSE) |

OS reduced motion freezes decorative scroll and lateral parallax, not ship/shot movement. No enemy art, audio, icons or third-party assets were added. The following M0-B/M1 inventory is historical; its interpolation marker is no longer rendered.

## M0-B / M1 — 2026-11-10

No gameplay sprites, atlas, music, sound effects, icons, manifest, or social images exist at this checkpoint. The original grid, compass diamond, and rectangular interpolation probe are diagnostic art, not gameplay sprites. The grid is prepared once on an in-memory canvas and blitted each frame.

| Item | Author/source | Recipe/location | License |
| --- | --- | --- | --- |
| Foundation shell layout, palette, blank canvas | Latticewake contributors; created for this project | `index.html`, `src/styles/main.css`, `src/app.ts` | [MIT](LICENSE) |
| Diagnostic grid, compass diamond, interpolation marker | Latticewake contributors; original geometric recipes | `src/render/testbed.ts` (`createGrid`, `TestbedRenderer.draw`); no imported asset files | [MIT](LICENSE) |
| UI typography | Device/system fonts selected by CSS | `ui-sans-serif, system-ui, sans-serif`; no font files downloaded or redistributed | Device-supplied; not a bundled asset |

No outside asset packs, commercial-game designs, external fonts, recordings, or runtime CDN resources are used. The favicon is an empty data URL until original icons are created in M9. Future original procedural artwork/audio must be recorded here with its source recipe and generator before being accepted. Third-party development tooling is recorded separately in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md); test-browser binaries are not game assets and are not distributed.
