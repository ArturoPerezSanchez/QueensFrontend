# Frontend development

## Setup

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Set `VITE_GAMES_API_ORIGIN=http://127.0.0.1:8010` in `.env.local`. The Vite
proxy sends `/api/v1` requests to the separately running MindLab backend.

## Add a game

1. Add `src/games/<game>/` with `api.ts`, `game.ts`, `types.ts`, the React game
   component, the Canvas scene component, and scoped styles.
2. Put visual assets under `public/games/<game>/`.
3. Register navigation metadata, the icon, and skins in their shared registries.
4. Add the matching generator and public contract in `MindLab-Backend`.
5. Run lint and build, then inspect desktop and mobile layouts in both themes.

## Data rules

- Revealing a hint or solution invalidates timed records.
- Retry keeps the current timer; a new puzzle starts a new timed run.
- Result ids are unique per user so browser retries cannot duplicate statistics.
- Public profiles never expose email addresses.

## Validation

```powershell
npm run lint
npm run build
```

For a complete feature, also run `python -m ruff check .` and
`python -m pytest -q` from a sibling checkout of `MindLab-Backend`.
