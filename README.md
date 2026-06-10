# CITYWORLD-01 (Three.js + Vite)

Interactive procedural 3D city simulator with orbit camera, road-graph traffic, pedestrians, traffic lights, CV-style overlays, and a 2-minute day/night cycle.

## Run locally

```bash
npm install
npm run dev
```

Open the localhost URL shown by Vite.

## Controls

- Left drag: orbit
- Right or middle drag: pan
- Wheel: smooth zoom
- `W/A/S/D`: pan
- `Q/E`: rotate
- `Space`: pause
- `D`: toggle detection overlay + HUD
- `T`: fast-forward time
- `R`: regenerate city layout
- `F`: arm follow mode, then click a car mesh
- `Esc`: release follow mode

## Build and preview

```bash
npm run build
npm run preview
```

## GitHub Pages config

- `vite.config.js` uses `base: /traffic/` from `package.json` name.
- If your repo name is not `traffic`, update `package.json` name to match your repo.

## Deploy automation

Push to `main` to trigger [.github/workflows/deploy.yml](.github/workflows/deploy.yml), which:

1. Installs dependencies
2. Builds the Vite app
3. Uploads `dist`
4. Deploys to GitHub Pages

## Pages URL format

`https://<your-github-username>.github.io/<your-repo-name>/`
