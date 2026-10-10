# ships-vue-3d

Web client for **Ships 3D**: a 3D ship editor and a multiplayer space game.
Vue 3 + TypeScript + Vite + three.js. Backend: [ships-go-3d](../ships-go-3d).

## Run

```bash
npm install
npm run dev        # https://localhost:5173 (the 2D site's port: run one at a time)
npm test           # vitest: ship model, flight model, undo history
npm run build      # type-check + production build
npm run lint
```

The API defaults to this page's host on port 3000 (`VITE_API_PORT` changes
the port, `VITE_API_URL` the whole base URL). `ssl/` is a symlink to the workspace's `../files/ssl`: the
dev server must be HTTPS because the session cookie is `Secure`.

## Layout

- `src/views/`, `src/components/` — Vue pages: home, login, register,
  profile, projects, editor, game.
- `src/api/` — typed fetch wrappers for ships-go-3d.
- `src/shared/` — the ship model (mirrors `ships-go-3d/models/project3d.go`),
  the three.js mesh builder shared by editor, thumbnails and game, and the
  single offscreen thumbnail renderer.
- `src/editor/` — the editor viewport (`Editor.ts`) and undo history. No Vue
  inside: `EditorView.vue` hosts it and draws the panels.
- `src/game/` — the game. **No Vue, no router, no app state**: only
  three.js and the DOM, so it can be embedded in a phone app's webview later.
  `Game` takes a container and options and must be `destroy()`ed. Input sits
  behind `InputSource`: `KeyboardMouseInput` (desktop) and `TouchInput`
  (phones: throttle slider, fire/roll, and a stick or tilt via `tilt.ts`),
  merged by `CombinedInput`. The host turns phone controls on with
  `options.touch` (GameView does it for a coarse pointer). The protocol (`protocol.ts`) mirrors `ships-go-3d/game/protocol.go`.

## Conventions

- Ships face **+Z** with **+Y up**. Every part is modelled in a unit cube,
  which is what lets client and server compute the same bounding radius.
- Part geometries/materials are shared caches (`shipMesh.ts`): never dispose
  them.
- Player names come from strangers: render them as text only (Vue
  interpolation, `textContent`), never `innerHTML`.
