# 🛑 START HERE: where we left off

**Paused: Sunday 2026-09-27 afternoon, on branch `ballpark`, while little-worlds wave 1 merged.** The owner disconnected.

## Where things stand

**Little worlds, wave 1** ([docs/notes/worlds/WAVES.md](docs/notes/worlds/WAVES.md)): four builders, one place each.
- **Merged into `ballpark`, loads clean:**
  - W4: the field-level rail;
  - W3: Ashburn Alley and the bullpens;
  - W1: the Third Base Gate and its plaza.
- **W2, the main concourse (home to third), was told to wind down.** Its branch is `worktree-agent-a325dfc3c8aaab891`, 22+ commits.
  - If it isn't merged yet (check `git log ballpark --oneline | grep "Merge W2"`), merge it next.
  - Resolve `src/ballpark/places/index.js` by keeping every entry.
  - Load it through the desk and check it: the builder fixed a crash at the last out just before the stop.
- **Each builder's notes** are in `docs/notes/worlds/W1.md` … `W4.md`, on their branches and now merged. They cover the evidence, the invented characters, the costs, the problems flagged elsewhere, and the pictures the owner could supply.

**Next, when we reconnect:**
1. Finish merging W2.
2. Profile the combined park under the lock's exclusive mode; each place has a ~1 ms budget.
3. Take a review set of each place: day, night and rain, 1280×800, the gate near first pitch.
4. Write `docs/notes/worlds/WAVE1.md`: what each place built and which systems to reuse. There are now **two** new figure systems, W1's `gate3b/Folk` and W3's `alley/Folk.js`, plus People.js; they want merging into one.
5. **Show the owner the combined park.** Launch no next wave until they've reviewed it.

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
