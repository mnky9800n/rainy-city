# Rainy City

A Create React App single-page app that renders an isometric rainy city on 2D
canvas layers, with Mac OS 9 chrome over the top. Deployed to rainy-city.com
from `main` by `.github/workflows/deploy.yml`.

## Things that will bite you

- **Tailwind is not installed.** `src/index.css` opens with `@tailwind`
  directives, but there is no `tailwindcss` dependency and no config, so those
  directives compile to nothing and every Tailwind class in the codebase is
  dead. Style with `os9-` classes and inline `style={{}}` objects.
- **There is no router.** Screens are conditional renders off `App.jsx` state.
  A page that needs its own URL goes in `public/` as static HTML (see
  `public/publishing/`), which CRA copies to `build/` verbatim.
- **`public/` is not reachable from `src/`, and vice versa.** Static pages under
  `public/` can't use the webpack-bundled `src/index.css` or `src/fonts/` —
  that's why the fonts are mirrored into `public/fonts/`.
- **`"homepage": "."`**, so code in `src/` references assets relatively
  (`"./rain.mp3"`). `buildings.js` is the exception: it uses root-absolute
  `/textures/...`, which only works because the site is served at a domain root.
- **Never read, print, or commit `openaikey` or `.apikey`.** Both are
  gitignored. `.apikey` is a `name=value` line, not a bare key.

## Adding a landmark building

A landmark is a named, one-of-a-kind building with a popup and a catalog entry.
**Adding one is never just dropping in a sprite** — a sprite with nothing else
wired up will silently fail to appear, or appear with no name. Every step below
is required.

### 1. Generate the sprite

```bash
./create-sprite "<what the building looks like>"
```

`create-sprite` bakes in the conventions: transparent background, PNG,
1024x1024, and the isometric style shared by the other landmarks. Pass only the
subject. Output lands in the repo root as `YYYYMMDD-HHMMSS-out.png`, which is
gitignored.

`./create` and `./edit` are the raw wrappers; use `./edit <file> "<change>"` to
iterate on a generation you nearly like.

The art has to satisfy the slicer (`loadAndSliceSpritesheet`, `buildings.js`),
which finds the alpha bounding box, scales it to fit, centres it horizontally
and **bottom-aligns** it:

- The background must be genuinely transparent, not painted white or grey.
- The building's base must be the lowest opaque pixel. Anything below it —
  a cast shadow, a stray plinth — lifts the building off its tiles.
- The base must be as wide as the widest part of the sprite. If a tree or a
  canopy overhangs the footprint, the building lands undersized.
- If the design includes a plaza or ground slab, that slab **is** the footprint:
  draw it as an isometric diamond spanning the full width.

Move the accepted PNG to `public/textures/buildings/<key>.png`.

### 2. Register the type — `src/city/buildings.js`

```js
<key>: {
  singleton: true,          // one per city; canPlaceBuilding reads this flag
  footprint: [w, h],        // in tiles
  spriteWidth: w * 64,      // MUST be footprint width x tileWidth (64)
  spriteHeight: <px>,       // footprint height x 32, plus the building's height
  color: "#rrggbb",         // procedural placeholder fill
  fullSpriteHitTest: true,  // click anywhere on the sprite, not just its tiles
  popupContent: { title, description, linkUrl, linkText },
},
```

`spriteWidth` is not a free choice. A footprint `[4,4]` is 256px wide in
isometric, so the sprite must be 256 wide or the building won't line up with its
tiles. Keep `spriteHeight` close to the sprite's actual content height —
`fullSpriteHitTest` makes the whole rectangle clickable, so slack becomes dead
clickable space above the roof.

`popupContent` is the **single source of truth** for the name and description.
Do not retype either anywhere else; the Buildings explorer derives them.

### 3. Load the sprite — same file, `loadBuildingSpritesheets()`

Three mechanical edits: add a `loadAndSliceSpritesheet(...)` call to the
`Promise.all` array, add the variable to the destructuring above it, and add the
key to the `filtered` object below. Then add it to the return of
`generateAllBuildingSprites()`.

### 4. Place it in the city — same file, `autoFillBuildings()`

```js
placeLandmarkNearCenter("<key>", offsetX, offsetY);
```

Landmarks are placed before the seeded fill, so they always win their spot.
Offsets spread them out; the existing four sit at the centre and on three
diagonals. Adding one shifts the surrounding houses and shops, which is
expected.

### 5. Offer it in the build menu — `src/App.jsx`

Add an `<option value="<key>">Name (WxH)</option>` to the `os9-select` under
Debug Tools → Place Buildings.

### 6. Add it to the Buildings explorer — `src/data/buildingCatalog.js`

Append `{ key: "<key>", image: "/textures/buildings/<key>.png" }` to `ENTRIES`.
Nothing else: the title, description and link come from `popupContent`. Use the
root-absolute `/textures/...` form so the browser reuses the sprite the city has
already downloaded.

### 7. Verify before you call it done

- It appears on load, on its tiles, with the plaza or base aligned.
- Debug Tools → Place Buildings draws it **every** time, not intermittently.
  Intermittent means the variant bug is back (see below).
- Placing a second one is refused.
- Clicking it opens the popup with the right name and a working link.
- It appears as a row in the Buildings explorer with a sensible thumbnail.

### Optional: night lights

`BeaconLayer.jsx` opts types in by name; a type it doesn't know is skipped
harmlessly. To add lights, clone one of the `public/*-beacon-tool.html` pages
(change `SPRITE_W`/`SPRITE_H` and the `img.src`), open it, click the lit points,
paste the emitted JSON into `BeaconLayer.jsx` as a new constant, and add a
branch beside the existing ones.

## Adding a character

Characters are simpler — they exist only in the explorer, not in the city.

1. Put the image in `public/characters/`. Downscale it first
   (`sips -Z 512 in.jpg --out public/characters/name.jpg`); these render at
   64px and full-size photos are megabytes each.
2. Add an entry to `src/data/characterCatalog.js`.
3. **Set `objectPosition` by looking at the image.** Thumbnails are square and
   `object-fit: cover`, so a centred crop cuts the heads off full-body shots.
   Full-body portraits generally want `"50% 0%"`; landscape images crop
   horizontally instead.

## Bugs worth not reintroducing

- **Landmark sprite sheets hold one building, not nine.** `CityContext`'s
  `placeBuilding` rolls a random variant 0-8 for ordinary buildings; landmarks
  must get variant 0, keyed off `singleton`. Getting this wrong makes a building
  occupy its tiles, stay clickable, and draw nothing.
- **Don't let one missing asset kill everything.** `loadAndSliceSpritesheet`
  resolves empty on error rather than rejecting, because `Promise.all` turned a
  single 404 into a blank city. Whale loading learned the same lesson: an
  external asset with no `onError` handler failed silently for months.
- **Don't hotlink assets.** Fonts and the whale model were both loaded from
  third-party CDNs and both broke when the files moved. Self-host in `public/`.
- **UI over water swallows clicks.** `WhaleLayer` listens on `window`, so
  anything rendered above the city must stop click propagation.
  `DraggableWindow` does this already — build on it rather than hand-rolling a
  window.
