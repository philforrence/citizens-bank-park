# 🛑 START HERE: where we are

**Sunday 2026-09-27, night: little-worlds wave 3 is merged** (wound down early: the owner was low on compute). Branch `ballpark`.

- **Waves 1–3 are merged:** ten places, one people system, the Phanatic, the park's soundscape, the night's rituals and celebration, light and night, and Harry the K's.
  - The combined park loads clean in about 13 s and plays through the trophy.
  - The summaries are [WAVE1.md](docs/notes/worlds/WAVE1.md), [WAVE2.md](docs/notes/worlds/WAVE2.md) and [WAVE3.md](docs/notes/worlds/WAVE3.md). WAVE3.md has what each builder would do next.
- **The site** still shows stage 7. To publish this as stage 8, see "Hosted" below.
- **Next, when there's compute:**
  - listen to the soundscape and trim it;
  - the loose ends in WAVE3.md;
  - then the rest of the scouted places: the right field corner and the Pavilion, the upper deck, the club and suites, photographic surfaces.

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
