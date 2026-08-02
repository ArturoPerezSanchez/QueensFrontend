# Asset skin system

## Contract

`src/features/skins/skins.ts` is the catalog and source of truth. A
definition contains:

- identity and player-facing copy;
- one or more preview assets for the configuration screen;
- game-specific asset roles;
- an unlock rule (`starter` or an achievement id).

The asset map is keyed by game so TypeScript rejects a Queens skin without its
marker or a Tango skin without both symbols. Components call `useGameSkin()`
and consume roles only. They must never check `skin.id` or embed a skin asset
path.

## File layout

```text
public/games/<game-id>/
  skins/
    <skin-id>/
      marker.webp
      preview.webp
```

Names describe roles rather than appearance. Use optimized PNG or WebP files
for raster sprites, SVG for vectors, and either SVG or a raster image with at
least 1024 pixels on its shortest side for Zip route artwork. Transparent gameplay sprites should normally be 384 pixels
or smaller. Do not bake labels into artwork, and record every third-party asset
in [assets.md](assets.md).

## Renderer rules

1. React owns rules, state, timers, controls, and accessibility semantics.
2. `CanvasBoard` owns the PixiJS lifecycle, metrics HUD, and normalized mouse/touch input.
3. Each game Canvas module composes geometry from stable asset roles.
4. The skin supplies replaceable visual material; renderers never inspect ids.
5. CSS tokens only maintain contrast and recognizable interaction states.
6. A color override alone is not exposed as a separate skin.

Current asset roles are:

- Queens: placement marker.
- Tango: two symbols and their accessible labels.
- Lights: off/on bulb sprites.
- Tracks: track-junction sprite and an optional animated flow-particle sprite
  with data-driven size, spacing, speed, drift, flicker, and blend settings.
- Zip: optional reveal image sampled continuously inside the route stroke.
- Mine Islands: flag and hazard sprites, with optional clue tiles, failure
  states, status faces, and counter digits for complete visual packs.
- MiniChess: piece-set root and file format.

## Zip route artwork

The PixiJS scene scales one image proportionally to cover the complete board and masks it with
the visited route. Every segment therefore reveals the pixels at its exact
position in the source image while unvisited portions of each cell keep the
normal board surface. Rounded caps and joins make the reveal continuous through
endpoints and corners without generating size-specific files. On completion,
the mask expands outward from the route until the complete image fills the
board; reduced-motion preferences skip directly to the final frame.

## Add and validate

1. Add optimized assets under the owning game's `skins/<skin-id>/` directory.
2. Register the definition and preview in `GAME_SKINS`.
3. Add only the contrast tokens needed for legibility in light and dark themes.
4. Assign an achievement id when the pack should be locked.
5. Run `npm run lint` and `npm run build`.
6. Inspect the selector and active game at desktop and mobile sizes in both
   themes. Verify missing-image requests, focus visibility, long labels, and
   reduced motion.
