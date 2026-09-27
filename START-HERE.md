# 🛑 START HERE: where we are

**Sunday 2026-09-27: little-worlds wave 1 is merged and waiting on the owner's review.** Branch `ballpark`.

- **All four places are merged:** W1 the Third Base Gate, W2 the main concourse, W3 Ashburn Alley and the bullpens, W4 the field-level rail.
- **The combined park:** loads clean, plays through the last out, `npm test` passes.
- **The combined summary:** [docs/notes/worlds/WAVE1.md](docs/notes/worlds/WAVE1.md). It covers what each built, the costs under exclusive, the systems to reuse, the name collisions, the flagged problems and the pictures asked for. Each builder's notes are in `docs/notes/worlds/W1.md` … `W4.md`.
- **Next:**
  - the owner reviews the park;
  - then, before wave 2, merge the three new figure systems (W1's Folk, W3's Folk, W2's Cast) into one;
  - then pick wave 2's places ([WAVES.md](docs/notes/worlds/WAVES.md) has the candidates).

  **Launch nothing until the owner says so.**

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
