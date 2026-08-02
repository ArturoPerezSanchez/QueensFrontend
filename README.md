# MindLab Frontend

React, TypeScript, Vite, and PixiJS client for the MindLab logic-game suite.
The API is maintained independently in
[MindLab-Backend](https://github.com/ArturoPerezSanchez/MindLab-Backend).

## Local development

Requirements: Node.js 20 or newer.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

The application is available at <http://127.0.0.1:5173>. Set
`VITE_GAMES_API_ORIGIN=http://127.0.0.1:8010` in `.env.local` when the API is
running locally. Vite proxies the versioned `/api/v1` contract to that origin.

## Validation

```powershell
npm run lint
npm run build
```

The same commands run in GitHub Actions for every push and pull request.

## Structure

```text
src/app/       Application shell and routing
src/features/  Account, auth, leaderboard, profile, settings, and skins
src/games/     Self-contained game modules
src/shared/    API paths, Canvas primitives, metadata, and reusable icons
src/styles/    Global design system, game frame, and skin tokens
public/brand/  Product assets
public/games/  Assets grouped by game and skin
docs/          Frontend architecture and contribution guides
```

Use `@/` imports across module boundaries and relative imports inside a game or
feature. Every playable board uses the shared Canvas host while navigation,
forms, profiles, and leaderboards remain semantic DOM interfaces.

See [Architecture](docs/architecture.md),
[Development](docs/development.md), [Skins](docs/skins.md), and
[Third-party assets](docs/assets.md).
