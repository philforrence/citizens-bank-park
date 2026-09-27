# 🛑 START HERE: where we are

**Sunday 2026-09-27: little-worlds wave 2 is running** (launched after the owner's go-ahead). Branch `ballpark`.

- **Wave 1** (the gate, the concourse, the Alley, the rail) is merged; see [docs/notes/worlds/WAVE1.md](docs/notes/worlds/WAVE1.md).
- **Wave 2**, chosen by the scouting in [SCOUT.md](docs/notes/worlds/SCOUT.md):
  - **P0:** one people system (onto Cast.js), the budget fixed, the name collisions renamed;
  - **A:** the Phillie Phanatic;
  - **B:** behind home plate, the TV backdrop;
  - **C:** the 1B concourse and the First Base Gate.
- **The builders' branches** are `worktree-agent-*`. They share live notes and one cast register in `.claude/wave2/` (local).
- **When they're all done: merge everything** (keep every entry in `places/index.js`). Then:
  1. load it clean, and profile it under exclusive;
  2. commit `.claude/wave2/CAST.md` as `docs/notes/worlds/CAST.md`;
  3. write `WAVE2.md`;
  4. show the owner.

  The owner reviews before any wave 3.

**Done today:**
- **Decisions:** section 7 of the plan was answered (recorded there).
- **The GPU is solved:**
  - a machine-wide lock, shared with the paintingwalk project;
  - `?still` render on demand;
  - scoped builds (`?only=` / `?focus=`);
  - the render desk (`tools/gpu/desk.mjs`).

  See [docs/GPU.md](docs/GPU.md).
- **Speed** ([docs/PLAN.md](docs/PLAN.md) section 2, status):
  - the crowd rewritten as a compute pass: TV high 29.6 → 22.3 ms, TV center 22.7 → 17.4;
  - an old id-rounding bug fixed.
- **Tools:**
  - Blender 5.2 LTS installed (`tools/blender/run.mjs`);
  - CC0 photo textures (`tools/textures/fetch.mjs`, `imageTexture()`);
  - Gemini image generation (`tools/imagegen/gen.mjs`). **It needs billing enabled on the key's Google project:** its free tier has no image quota. The key lives in `~/.config/citizens-bank-park/`, never in the repo.
- **Research:** spiderbench (the Blender and image-generation Spider-Man clone) in [docs/notes/research/spiderbench.md](docs/notes/research/spiderbench.md). The owner approved the recommendations: CC0 photo surfaces, photo-matched critic shots, scripted Blender for fan bodies later.
- **The seven missing 2008 season lines** added; Elliot Johnson's number fixed (#43).

## Running things

- Nothing should be rendering.
- The render desk (`node tools/gpu/desk.mjs status`) exits by itself after 30 min idle.
- To look: `npm run dev`, then http://127.0.0.1:5189/. Press C for the TV cameras and F for the free camera; add `?hour=21` for night.
