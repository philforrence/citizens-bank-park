# Little worlds: brief (shared by the place builders)

**The project:** `~/citizens-bank-park`, a browser (WebGPU) Citizens Bank Park on October 27 and 29, 2008: Game 5 of the World Series, Rays at Phillies.
- **The 27th:** 47 °F and a cold, driving rain, until the game was suspended in the 6th.
- **The 29th:** cold, windy and dry, and the Phillies won their first title since 1980.
- **The crowd:** a sold-out 45,940, in red.

You walk in through the Third Base Gate and watch the replay, with TV cameras, the radio call and the crowd.

## What the owner asked for, in their words

> "choose like 3 or 4 places in the park and just enhance the amount of stuff there, find pictures, and make creative but incredibly grounded choices. Introduce characters and interactions and really make that little place feel ridiculously detailed"

> "add more and more 'texture' to everything through a) evidence b) common sense c) creative choices where there's uncertainty (must be plausible and not glaring) ... be creative, nothing is too small. Feel free to create your own little world there with unique people (all Phillies fans) faces, and different stories ... make them more faceted textured and realistic in all the ways, be creative! but stay true to the feel of this ultra realistic moment."

> "don't make fidelity and textured sacrifices, I LOOOOVE the details"

## Your job: one place, built out in depth

You own **one place** (your prompt names it). Make it feel like you're standing there on that night: the things, the people, what they're doing and saying with their hands, the wear, the weather on everything.

Aim for about **15 major changes**. Each is a real, visible improvement with many small touches inside it. Depth beats breadth: stay in your place and fill it.

Choose by:
1. **Evidence.** Photos and descriptions from 2008, from October 2008 if you can find them (Game 5 on the 27th and 29th, and the Series), and at least from that season.
   - Search the web: Flickr, Wikimedia Commons, news photo galleries, ballpark guides, the Inquirer and Daily News, fan blogs, YouTube stills of the FOX broadcast.
   - Save every reference you use in `/Users/phillipforrence/citizens-bank-park/.claude/ref/<your place>/`. It's local, gitignored and permanent, so the next round has it. List what you found and where in your notes.
   - If you can't find what you need, say so in your report: the owner offered to supply pictures.
2. **Common sense.** What a real ballpark has in that spot on a cold, wet World Series night.
3. **Grounded invention**, where the record is silent. Plausible, never glaring, true to the moment.
   - **Invent people.** Name them in comments, and let their story show in what they wear, carry and do. All Phillies fans, except the odd brave Rays fan:
     - a family on their first World Series;
     - the guy who's been to every home game since the Vet;
     - a vendor on his 30th season;
     - a couple sharing a poncho;
     - a kid with his glove.
   - **Give them interactions that play out over time:**
     - a vendor handing over a cheesesteak and making change;
     - an usher checking a ticket and pointing the way;
     - a dad hoisting his kid to see over the rail;
     - a photographer changing lenses;
     - a security guard waving someone through.
   - **Tie them to the night.** The replay's timeline is `__app.director`: its `t`, `segments` and `segmentAt( t )`, the innings, the outs, and the rain on the 27th until the suspension (after the top of the 6th). Then the resumption on the 29th, the last out, and the celebration.

## How you work

- **Your worktree.** You're in your own git worktree, a branch off `ballpark`. Commit after each change with a descriptive message in the repo's style (`git log`), ending with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Your files.** Build your place in your own module, `src/ballpark/places/<Place>.js`, and register it in `src/ballpark/places/index.js`: one import and one `[ 'name', Class ]` entry. That file's header says what the constructor gets and when `update()` runs. Your place's name is also its scope for `?only=`.
- **Shared files.** If you must change a shared file (People.js for a new role, outfit or pose; Field.js, Bowl.js or Exterior.js to fix something in your place), keep it additive and small, in one clearly marked block. Don't reformat or move code you don't own; the coordinator merges four branches. Don't touch:
  - `Crowd.js`: the coordinator is optimizing it now. If you need something from the seated crowd, ask in your report.
  - `tools/gpu/`.
- **Rendering: read [docs/GPU.md](../../GPU.md) first.**
  - Take every shot through the render desk (`node tools/gpu/desk.mjs shoot job.json`). Never open a browser or start a dev server yourself: the desk serves your worktree.
  - Scope your builds to your place (`only=<your place>,<the parts you need>`, plus `focus=` round it).
  - Check on the CPU first. Take one render batch per ~20 minutes at most, with all of its shots in that one job.
  - Don't profile: the coordinator measures the GPU cost.
  - Judge light and look on the full park now and then (scoped pages have no stands, so no stand shadows).
- **Performance.** Your place should cost at most ~1 ms of GPU in a typical view that shows it.
  - Instance repeats (InstancedMesh).
  - Merge static geometry: static meshes are merged by material automatically (`geo.batchStatic`) unless instanced or dynamic.
  - Use LOD for anything detailed that's seen from afar.
  - Draw canvas textures once, as atlases when there are many.
  - Keep small parts from casting shadows.
  - In your first and last desk jobs, record the counts with `"js": "JSON.stringify( __app.engine.meshRenderer.stats )"`. Put the before and after in your notes.
- **Match the code.**
  - Tabs, and spaces inside parentheses.
  - Prose comments that say why.
  - `standard()` materials with WGSL surface snippets, and `canvasTexture()` for drawn textures.
  - `Quads`, `beam()` and `box()` to merge geometry.
  - Night emissive with `frame.night`, and wet with `frame.wet`.
  - The field frame is in `field.group`: x and z in metres from the back tip of home plate, −z toward center field, +x toward first base, y up from the field. Street and main-concourse level is ~7 m (`LEVELS.mainConcourse`).
- **People.** Use the figure systems already in the park. Their round-1 notes are in `docs/notes/round1/` (T2: the crowd, T7: the players).
  - `People.js`: instanced standing and walking figures with roles, outfits and poses (stand, walk, reach). It's the natural home for staff, vendors and visitors. Add roles, outfits or poses there in a marked block.
  - `game/Players.js`: the detailed skinned rig, with faces and builds per person, and motions in `Motions.js`. Use it for a featured character seen up close.
  - `Crowd.js`: the seated fans. Don't edit it.
- **Tools** (2026-09-27):
  - **Blender 5.2 LTS** is installed and runs headless: `node tools/blender/run.mjs script.py -- args`. Script the modelling and export glTF. Bake with Cycles on the CPU; pass `--gpu` only for a GPU render, and it takes the lock. Engine side, `src/engine/loaders/GLTF.js` loads glTF (so far it has only loaded Tidewater's characters, so a static-mesh adapter may be needed).
  - **Image generation:** `node tools/imagegen/gen.mjs` (Gemini "Nano Banana"). Use it only for generic materials, decals, interiors and invented people, never for real signage, logos or people, and log every image in CREDITS.md. Until billing is enabled on the key it returns a quota error; then fall back to CC0 photo scans (Poly Haven, ambientCG) or canvas textures.
- **Don't break the game.** After your last change:
  - load your worktree's full park cleanly, with no console errors;
  - take a day shot, a night shot and a rain shot of your place, plus one TV shot, in one desk job.

## When you finish

Write `docs/notes/worlds/<KEY>.md` in your worktree and commit it on your branch. It should cover:
- your changes: what each one is, why, and whether it came from evidence (with sources) or invention;
- the people you invented and their stories;
- your screenshots (their paths);
- the draw and triangle counts, before and after;
- anything unfinished;
- anything you noticed in other areas that looks wrong.

Your final reply gives:
- the branch name;
- the change titles;
- the shared files you touched;
- anything the merger must know;
- pictures you'd like the owner to supply.
