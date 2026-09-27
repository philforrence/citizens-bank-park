# Rendering on the shared GPU

The GPU on this machine is shared with other sessions and projects (paintingwalk renders here too). Every render goes through one queue, so nobody draws while someone else is measuring and loads don't crawl.

## For agents: take shots through the render desk

Never launch a browser yourself. Write a job and hand it to the desk:

```sh
node tools/gpu/desk.mjs shoot job.json     # or inline JSON, or - for stdin
```

It waits its turn and prints a result: the image paths, load time, build times and any console errors. It exits 1 if the page failed or logged errors. Read the images with the Read tool.

```json
{
  "owner": "T3 concourse",
  "params": "only=concourse,people&hour=21",
  "shots": [
    { "name": "stand-3b", "look": [ [ -40, 9, 60 ], [ -30, 8, 40 ], 55 ] },
    { "name": "tv", "camera": "center", "play": 57 }
  ]
}
```

- **root:** defaults to the git root you run from, so a worktree's own code is served. The desk runs a Vite server for it, and you don't start one.
- **params:** the page's query. `still` is always added.
- **Each shot** can set:
  - `hour`;
  - `seek` (the replay at t seconds) or `play` (at play N);
  - `camera` (`center`, `high`, `follow`) or `look`;
  - `js`, run first; its value comes back in the result;
  - `frames`, rendered before the shot (default 32);
  - `format` (`jpg`, the default, or `png`).
- **look:** eye, target and fov in the field frame: x and z in metres from home plate, −z toward center field, y above the field.
- **size:** defaults to 800 × 500. Use 1280 × 800 only for review sets.
- **out:** defaults to `<root>/.claude/qa/desk/`.

`node tools/gpu/desk.mjs status` shows the queue, the warm pages and the dev servers.

## Build only what you're working on

- **`only=part,part`** builds and draws just those parts:
  - `field`, `bowl`, `crowd`;
  - `exterior`, `surroundings`, `complex`;
  - `landmarks`, `details`, `fascia`;
  - `concourse`, `people`, `players`.

  See `src/ballpark/Scope.js`. The game's timeline, weather and boards run either way.
- **`focus=x,z,r`** drops every mesh wholly outside a circle of the field before the batching. It works best on things built in pieces: crowd chunks and small props. It can't cut into one big mesh.
- **A scoped page loads in about 2.5 s** against about 5 s for the whole park, and each frame is cheaper.
- **Scoped shots are for geometry, layout and detail.** Without the stands there are no stand shadows, and the pit around the field shows black. **Judge light and look on the full park.**

## The rules

1. **CPU first.** Before any render:
   - `node --check` the files you changed;
   - `npm test`;
   - run what you can in Node: the Director's timeline, the game logic;
   - canvas textures on a plain 2D canvas.
2. **One render batch every ~20 minutes at most**, with all of that batch's shots in one job.
3. **Scope it.** Use `only=` / `focus=` unless you're judging light or the whole scene.
4. **Small shots.** 800 × 500 JPEG unless it's a review set.
5. **Never** pass `--disable-frame-rate-limit` or `--disable-gpu-vsync` to Chrome, and never leave a page with a running render loop.
6. **Don't profile.** The coordinator profiles, once per wave, with `"exclusive": true` (the lock's `--exclusive`), which waits until nothing else is rendering.
7. **At most 4 agents at a time.**

## Underneath

- **`tools/gpu/lock.mjs`** is the machine-wide lock:
  - the lock lives at `/tmp/gpu-render.lock`, and waiters queue in `/tmp/gpu-render.queue`;
  - every take and release is logged to `/tmp/gpu-render.log`;
  - the desk takes it for each job;
  - anything else that renders wraps itself: `node tools/gpu/lock.mjs run --owner "cbp <who>" -- <cmd>`.

  Our owners start with `cbp`. paintingwalk runs its own implementation of the same protocol, and its owners start with `paintingwalk:`. If the paths, file formats or stale rules change, tell them.
- **Ports.** Ours are 5189 (the dev server) and 5300–5399 (the desk's Vite servers). paintingwalk uses 5500–5599.
- **The desk:**
  - it keeps at most 2 warm pages, and a job on unchanged code reuses one (about 0.5 s);
  - an edit to the tree reloads the page on the next job, and Vite's hot reload is off in the desk's pages;
  - it closes its browser after 10 minutes idle, or at once when someone else holds the lock exclusively.
- **`?still` and `window.__qa`** (`src/ballpark/QA.js`) work by hand too. Open `/?still` and the page draws nothing until `await __qa.still()`.
