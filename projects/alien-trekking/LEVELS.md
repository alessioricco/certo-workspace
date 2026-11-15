# Writing worlds

A world ("level") is one JSON file. The game engine never changes for a new
world: the file says what the planet is like, what the player must do there,
and which models to show. A world can live in `levels/` or at any URL.

## Where a world lives

- **In the project:** put the file in `levels/`, for example `levels/my-world.json`,
  and add an entry to `levels/index.json`:

  ```json
  [
    { "id": "verdant-g", "file": "verdant-g.json" },
    { "id": "my-world", "file": "my-world.json" }
  ]
  ```

  The title screen lists the entries of this file. Open the world at
  `?level=my-world` (the id) or `?level=my-world.json` (the file name).
- **At a URL:** host the JSON file anywhere (see [Publishing a world at a URL](#publishing-a-world-at-a-url)).
  Open it with `?level=https://example.com/worlds/my-world.json`, or paste the
  URL into the field on the title screen. It does not need to be in `index.json`.

A world that fails validation is not played: the page lists the problems instead.

## The file

```json
{
  "id": "verdant-g",
  "name": "Verdant",
  "seed": 42,
  "star": { "class": "G" },
  "planet": {
    "massEarths": 1.0,
    "radiusEarths": 1.0,
    "orbitAU": 1.0,
    "albedo": 0.3,
    "dayLengthHours": 24,
    "atmosphere": { "pressureAtm": 1.0, "oxygenFraction": 0.21 }
  },
  "objectives": [
    { "kind": "scan-species", "count": 5 },
    { "kind": "reach-landmark", "name": "the tall spire" }
  ],
  "assets": {}
}
```

Every field is listed below. Numbers outside their range, missing fields, and
unknown values are all errors.

### Fields

| Field | Type | Range or allowed values | Meaning |
| --- | --- | --- | --- |
| `id` | text | not empty | The world's name in the index and in saved progress. Keep it unique among the worlds you list. |
| `name` | text | not empty | The name shown on the title screen, the briefing and the survey report. |
| `seed` | integer | 0 to 4294967295 | Shapes the terrain, the landmarks, and the plants and animals. The same seed always gives the same world. |
| `star.class` | text | `M`, `K`, `G`, `F` or `A` | The star's class (see the table below). |
| `planet.massEarths` | number | 0.1 to 10 | Planet mass, in Earth masses. Sets the surface gravity. |
| `planet.radiusEarths` | number | 0.3 to 3 | Planet radius, in Earth radii. Together with the mass, sets the gravity. |
| `planet.orbitAU` | number | 0.01 to 100 | Distance from the star, in astronomical units. Sets the surface temperature. |
| `planet.albedo` | number | 0 to 1 | Fraction of starlight the planet reflects. A brighter planet is colder. |
| `planet.dayLengthHours` | number | 0.1 to 10000 | Length of a day, in hours. The sky runs in real time: one world hour is 10 seconds. |
| `planet.atmosphere.pressureAtm` | number | 0 to 10 | Surface air pressure, in atmospheres. |
| `planet.atmosphere.oxygenFraction` | number | 0 to 1 | Share of oxygen in the air. The air is breathable when the oxygen partial pressure (pressure × fraction) is 0.16 to 0.5 atm. Below that the air is too thin, above it toxic, and the suit's oxygen tank drains. |
| `objectives` | list | see below; may be `[]` | What the player must do. A world with no objectives has no survey report. |
| `assets` | object | optional; see below | Models and textures for the lander and named species. Omit it or use `{}`. |

### Objectives

`objectives` is a list. Each entry has a `kind`, and the kinds take these fields:

| `kind` | Fields | Done when |
| --- | --- | --- |
| `scan-species` | `count`: whole number, 1 to 7 | The player has logged `count` species with right-click (plants, animals and predators, seven in every world). |
| `reach-landmark` | `name`: text, not empty | The player walks within 12 m of the landmark. |
| `return-to-lander` | none | The player goes more than 60 m from the lander, then comes back within the lander's 6 m circle. |

The three kinds are the only ones. Any other `kind` is an error.

**Landmarks.** Each `reach-landmark` objective places one landmark, named by its
`name`. The engine chooses its shape (a spire, an arch or a pillar), its
bearing from the lander and its height from the seed and the objective's
position in the list. Landmarks stand 120 to 300 m from the lander, on the
terrain. The name is only a label: `"the tall spire"` gets a spire here, but
the name does not force the shape.

**Progress.** Progress is kept per world in the browser's `localStorage`, under
the key `alien-trekking:progress:<id>`. It holds the species logged, the
landmarks reached and whether the trek back was made. Clearing the browser's
site data resets it. Changing a world's `id` starts its progress afresh.

**Survey report.** When every objective is done, the report opens in the
game: the planet's facts, the objectives and the species logged. Press R to
open or close it. The briefing before the game shows the same objectives.

### Assets

`assets` is optional. It can hold a `lander` and a `species` map:

```json
"assets": {
  "lander": { "model": "assets/lander.glb", "texture": "assets/hull.png" },
  "species": {
    "Vorox": { "model": "https://cdn.example.org/models/vorox.glb" }
  }
}
```

| Field | Type | Meaning |
| --- | --- | --- |
| `lander` | object | The landed craft. Replaces the generated lander. |
| `lander.model` | text, optional | A glTF (`.gltf`) or binary glTF (`.glb`) file, by path or URL. |
| `lander.texture` | text, optional | An image (PNG or JPEG), by path or URL. Used as the colour map on the model or generated geometry. |
| `species` | object | Plants, animals and predators, keyed by their generated name. |
| `species.<name>` | object | The same `model` and `texture` fields as the lander. Each asset must specify at least one. |

- **Paths** are relative to the level file: `"assets/lander.glb"` in
  `levels/my-world.json` means `levels/assets/lander.glb`. A full `https://` URL
  is used as it is.
- **Species names** are generated from the seed and shown in the survey log.
  A name that matches no species in the world is noted in the briefing and the
  asset is not used.
- **Sizes.** A species model is scaled to the height of the generated species
  it replaces, and stands on the ground facing `+z`. The lander is scaled to
  3.8 m. Texture-only assets use generated geometry; missing UVs are projected.
- **Animation.** A modelled or textured animal keeps its movement across the
  land, but its head does not lower to graze or lean in a warning.
- **Fallback.** If a requested model or texture cannot be loaded, the generated
  version is used. The briefing lists a note under "Assets", and the same note
  shows in the objectives panel during play.

## Star classes

| Class | Temperature (K) | Luminosity (Sun = 1) |
| --- | --- | --- |
| M | 3200 | 0.04 |
| K | 4500 | 0.35 |
| G | 5778 | 1.0 |
| F | 6500 | 2.5 |
| A | 9000 | 20 |

These are main-sequence values, approximate. The star's temperature sets the
colour of its light and of the sky, and the plants' colours follow it: a red
dwarf (M) gives a reddish light and dark plants.

## Publishing a world at a URL

1. Write the world as a file, such as `my-world.json`, and check it against
   the table above. Put any models and textures next to it.
2. Host the file, and every asset, on a web server you control or on any
   static host (GitHub Pages, for example).
3. Allow the game to read the files from another web address. The game fetches
   the world and its assets with `fetch`, so when the game and the files are on
   different origins, the server must send the header
   `Access-Control-Allow-Origin: *` (or the game's origin) for each file.
4. Open the game with the world's address:

   ```text
   http://localhost:5173/?level=https://example.com/worlds/my-world.json
   ```

   or with the game's own address and the URL pasted into the field on the
   title screen. The game page can itself be hosted anywhere the built site
   (`npm run build`, the `dist/` folder) is served.

Relative asset paths work on the server too: they resolve against the URL of
the world file.

## A complete example

```json
{
  "id": "ridge-k",
  "name": "Ridge",
  "seed": 2024,
  "star": { "class": "K" },
  "planet": {
    "massEarths": 1.4,
    "radiusEarths": 1.1,
    "orbitAU": 0.6,
    "albedo": 0.25,
    "dayLengthHours": 36,
    "atmosphere": { "pressureAtm": 1.3, "oxygenFraction": 0.18 }
  },
  "objectives": [
    { "kind": "scan-species", "count": 4 },
    { "kind": "reach-landmark", "name": "the stone arch" },
    { "kind": "return-to-lander" }
  ],
  "assets": {
    "lander": { "model": "assets/lander.glb" }
  }
}
```

## Checking a world

- `npm test` loads and validates every world listed in `levels/index.json`.
- Open the world in the browser. A problem with the file is shown on the page
  with its path, for example `planet.massEarths must be between 0.1 and 10 (got 25)`.
