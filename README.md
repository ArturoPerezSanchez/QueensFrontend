# Logic Games Frontend

A single Vite/React frontend for the full puzzle suite: Queens, Tango, Lights, Tracks, and Zip.

Queens keeps its existing logo and deployment shape, while the other games live as isolated modules under `src/games/*`.

## Routes

The app uses hash routes so the static Vite deployment does not need extra SPA fallback rewrites:

```text
#/queens
#/tango
#/lights
#/tracks
#/zip
```

## API Integration

The frontend calls same-origin API paths:

```text
/api/queens
/api/tango
/api/lights
/api/tracks
/api/zip
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
```

Each game module owns its component, fetch client, pure game helpers, types, and scoped stylesheet.
