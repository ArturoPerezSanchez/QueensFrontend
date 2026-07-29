# MindLab Frontend

A single Vite/React frontend for MindLab's logic puzzle suite: Queens, Tango, Lights, Tracks, Zip, Mine Islands, and MiniChess.

Queens keeps its existing logo and deployment shape, while the other games live as isolated modules under `src/games/*`.

## Routes

The app uses hash routes so the static Vite deployment does not need extra SPA fallback rewrites:

```text
#/queens
#/tango
#/lights
#/tracks
#/zip
#/mine-islands
#/mini-chess
```

## API Integration

The frontend calls same-origin API paths:

```text
/api/queens
/api/tango
/api/lights
/api/tracks
/api/zip
/api/mine-islands
/api/mini-chess
```

In local development, Vite proxies those paths to `VITE_GAMES_API_ORIGIN`.
If the variable is not set, it defaults to `https://api.arturops.com`.

For local testing against the consolidated API:

```bash
VITE_GAMES_API_ORIGIN=http://127.0.0.1:8010 npm run dev
```

On Windows PowerShell:

```powershell
$env:VITE_GAMES_API_ORIGIN="http://127.0.0.1:8010"; npm run dev
```

`vercel.json` rewrites each `/api/<game>` path to the deployed API domain.

## Local Development

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

## Project Structure

```text
src/
  App.tsx             Suite router and shared game navigation
  main.tsx            React entry point
  styles.css          Global suite shell styles
  useTheme.ts         Shared light/dark theme hook
  games/
    queens/
    tango/
    lights/
    tracks/
    zip/
    mine-islands/
    mini-chess/
```

Each game module owns its component, fetch client, pure game helpers, types, and scoped stylesheet.

MiniChess mixes mate-in-1, mate-in-2, and mate-in-3 positions across standard
8x8 and Gardner 5x5 boards. It supports both click-to-move and desktop
drag-and-drop controls. The API supplies validated per-ply positions and legal
destinations so both board geometries use the same interaction model. Piece-art
and puzzle-source details are documented in
`public/games/mini-chess/ATTRIBUTION.md`.
