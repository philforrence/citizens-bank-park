# 🛑 START HERE: where we are

**Sunday 2026-09-27, evening: little-worlds wave 3 is running** (the owner said "go"). Branch `ballpark`.

- **Waves 1 and 2 are merged:** seven places, one people system, the Phanatic. See [WAVE1.md](docs/notes/worlds/WAVE1.md) and [WAVE2.md](docs/notes/worlds/WAVE2.md).
- **Stage 7 is live** at https://philforrence.github.io/citizens-bank-park/
- **Wave 3,** enriching the park as a whole:
  - **S:** the soundscape;
  - **R:** the rituals and the celebration;
  - **L:** light and night;
  - **H:** a people-CPU tune-up, then Harry the K's and the left field corner.

  They share `.claude/wave3/` (local). Their branches are `worktree-agent-*`.
- **When they're all done: merge everything** (keep every entry in `places/index.js`). Then:
  1. load it clean, and profile it under exclusive;
  2. commit `.claude/wave3/CAST.md` as `docs/notes/worlds/CAST.md`;
  3. write `WAVE3.md`;
  4. show the owner.
- **If the machine slept and the builders stalled:** resume each with a message; its commits are safe on its branch.

**Hosted (2026-09-27):**
- **The repo:** https://github.com/philforrence/citizens-bank-park, public, default branch `ballpark`. `main` isn't pushed: it still has Tidewater's own deploy workflow.
- **The site:** https://philforrence.github.io/citizens-bank-park/. `.github/workflows/deploy.yml` builds every `step-N` tag as a playable stage, plus a page listing them.
- **To publish a new stage:**
  1. commit its screenshot as `docs/stages/step-N.jpg`;
  2. `git tag -a step-N -m "Title" -m "Description"`;
  3. `git push origin ballpark step-N` (three tags or fewer per push, or GitHub skips the trigger), or run `gh workflow run deploy.yml --ref ballpark`.

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
