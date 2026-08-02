# Frontend architecture

MindLab is delivered from two independent repositories:

- `MindLab-Frontend`: static React application and all visual assets.
- `MindLab-Backend`: versioned FastAPI contract, persistence, and puzzle engines.

The browser communicates with the API exclusively through `/api/v1`. The
frontend can therefore be deployed as static files and scaled independently of
the API.

## Module boundaries

- `app`: application composition, navigation, and route selection.
- `features`: cross-game workflows such as accounts, profiles, leaderboards,
  settings, and skin selection.
- `games`: game-specific state, validation, Canvas scene composition, and
  scoped styles.
- `shared`: stable primitives that do not depend on a feature or game,
  including the PixiJS board host and normalized input adapter.
- `styles`: design tokens and the common game frame.

Imports crossing one of these boundaries use the `@/` alias. Relative imports
are reserved for files inside the same module.

## Rendering boundary

React owns application state, timers, responsive layout, and accessibility.
Playable boards render through `src/shared/canvas/CanvasBoard.tsx`, which owns
the PixiJS lifecycle, normalized pointer and wheel input, the metrics HUD, and
the semantic button overlay used by keyboard and screen-reader users.

Each game composes its scene without coupling puzzle rules to rendering. Boards
that need motion use the optional fixed-rate Canvas overlay, keeping animation
independent from the static PixiJS scene.

## Assets and skins

Every game owns `public/games/<game-id>/`. Brand files live in `public/brand/`.
Skins are typed asset packs registered in `src/features/skins/skins.ts`. Games
consume stable roles such as symbols, markers, piece sets, or reveal images and
never branch on a skin id.

Achievement rules will grant registered skin ids. Rendering remains independent
from progression, so new skins can replace assets without modifying game logic.
