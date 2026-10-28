# FF1, step 10: the fans get the players' facial structure

Fixer FF1, 2026-10-28, branch `worktree-agent-aa8dea31c6c1fa67e` (off `ballpark` at 8c156d0).

**The owner:** "can we give the people in the stands the facial structures of real people like the players on the field?"

## The shots

All in the main checkout, `.claude/gauntlet/s10/FF1/`, full park (no `only=`), 1280 × 800, the replay's clock, no console errors in any job.

- **`b0/`** is the before, on this branch's base. **`a2/`** is the after, on the final code. `a1/` was the first pass (no eyeballs yet).
- The same shots, by name, in each:
  - **The Cast at arm's length:** a lineup of seven of my own (FW6's way, every other troupe left out) on the 3B concourse by 129 on the 29th. An old man with glasses, a young woman with long hair, a black man with a goatee, a kid in a cap, a man of Asian descent, an old woman in a knit hat, a heavy man with a full beard round a bald crown. `L1-line-front` (it also shows the seats behind the rail), the portraits `L2`-`L5`, a three-quarter `L6`, a profile `L7`, and by day `D1`.
  - **The seated crowd's close level, from in front** (CP's `CP.fan` / `CP.fanAt`): `C1-seats-3b-front` (2.3 m), `C2-seats-3b-close` (1.25 m), `C3-seats-1b-bare-34`, `C4-seats-1b-cap`, and by day `D2`.
  - **The Diamond Club rows behind home:** from the field (`C5-home-front`, the Cast's near and middle figures and the crowd), and on TV (`T1-tv-center`).
  - **The far levels:** TV high (`T2-tv-high`), the 400s seat (`S0`), the 3B concourse (`W1`).
- **The job generator:** `/private/tmp/claude-501/-Users-phillipforrence-citizens-bank-park/4f4e82b4-ef9f-4fa0-a3f9-d023a05012fe/scratchpad/ff1/mkjob.mjs` (the jobs and their output beside it).
- **An offline look at the heads, with no GPU:** `view.mjs` in the same folder, a small software rasterizer. It shows the three levels from three sides with the paint, and nine people's faces. The sheets are `heads1.png` to `heads4.png` there (`heads4.png` is the final).
- **References:**
  - Getty 83893023 (Oct 27 2008, `.claude/ref/gauntlet/people/crop-83893023-caps.png`): faces at arm's length under caps and hoods, the brows and sockets in shade, the jowls, the broad and narrow noses, long faces and round ones.
  - ronniebruce 2987487127 / 2988345036 (Oct 29 2008, `.claude/ref/gauntlet/seats/`): the 3B upper deck's crowd.

## What I did

### 1. The fan head from MakeHuman: done (`tools/build-fanhead.mjs` → `src/ballpark/game/data/fanHead.js`)

**The mesh:**
- The players' MakeHuman base mesh (the same CC0 files `build-body.mjs` fetches into `tools/body/.cache`), cut a little under the chin (y 5.98 dm).
- The eyeballs' fronts (MakeHuman's eye helpers) are kept in the lids. The lids' opening alone was a hollow, and in the desk's first pass (`a1/`) the eyes read as slits in its shade.
- 4,314 vertices, 8,572 triangles before the levels.

**The levels:** quadric-error half-edge collapses. A vertex merged into a neighbour never moves, so each level is a subset of the finest one's vertices and shares its blend shapes.
- **Mirrored pairs** are collapsed together, so a face stays symmetric.
- **Each face's plane counts the same,** not by its area. MakeHuman's mesh is finest where the face has its detail; area weights made the nose and the lips the first to go (`heads1.png`: the 400-triangle nose ran down into the lip like a snout).
- **The face weighs ×6, the back of the skull ×0.6.**
- **Landmarks are locked:** 43 of them (the nose's tip, underside, wings and nostrils, the lips and their corners, the chin, the eyes' corners and lids, the brows). The last level lets them go. Twelve points round the skull are kept even there; its top went to a point.
- **The three levels:**
  - **near:** 1,200 triangles, 613 vertices (the Cast's near figure);
  - **mid:** 398 triangles, 210 vertices (the Cast's middle figure and the seats' close level);
  - **far:** 90 triangles, 52 vertices (the seats' near level, FOX's backdrop).

**Fitted to the egg:**
- The skull above the brows is fitted inside the egg the caps' crowns, the knit hats and the hoods are built on (`Crowd.js` HEAD_R). The fit's scale is 0.955.
- The chin is held to 1.16 of the egg's height under its centre. A real head's chin is ~4 cm lower than the egg's was, and the figures' necks were made for the egg. As it is, the head sits ~1.5 cm higher on its neck than a bare fit would put it.

**The blend shapes:** MakeHuman's own targets, as blend shapes.
- **1,500 people** are drawn as the 2008 crowd was (`Crowd.js` `randomFan`'s mix): 40% women, 6% kids, 7% teens, 15% old, the skin palette's mix with the likely ethnicity under each skin, slim to heavy.
- **Each is made the way MakeHuman makes a person:**
  - its 18 macro corner targets (african / asian / caucasian × male / female × child / young / old), mixed multilinearly as MakeHuman mixes them;
  - the universal weight targets;
  - 58 face modifiers, each a little either way (nose ×13, mouth ×7, chin and jaw ×7, cheeks ×4, eyes ×7, brows ×3, forehead ×4, ears ×4, the head's proportions ×6, the neck ×3);
  - 7 head shapes (oval, round, square, ...).
- **Each one's own size and place are taken out.** The shaders size the heads (a kid's), and the PCA should hold shape.
- **Principal components** (weighted toward the face): **8 hold 78% of how those faces differ.** At one standard deviation they move up to 6-12 mm.
- **The base is the crowd's mean face.**

**A fan's weights:**
- A linear fit `A` from who he is (female, kid, old, his skin's African and Asian shares, his weight), about the features' means `FM`.
- Plus his own share of the rest, `L` (the Cholesky of what the features don't explain: ~80% of the spread) times 8 normal draws from his seed.
- `A` reads as it should: female and Asian and African each load strongly on their own components (e.g. Asian -2.0 on the 8th, African -1.9 on the 7th, female -1.0 / +1.1 on the 1st and 3rd).

**The normals' change** per component per level (central differences) is stored too, so a face *shades* as its own shape, not the base face's.

**The paint's frame:**
- Each vertex carries where it lies on the egg the face paint was drawn for, so FY3/FW4/FW6's paint (eyes, brows, lips, beards, glasses, hairlines, the cap's band, the knit's edge, the hood's opening) lands on the modelled features.
- It's warped from MakeHuman's landmarks: the eyes to d.y 0.1 and x 0.34, the brows 0.3, under the nose -0.24, the mouth -0.45, the chin -0.85.
- It rides with the vertex as the blend shapes move it (FY4's way: "the face's paint stays on its vertices").
- The eyeballs are marked in it (d.z -3) for the paint.

**The ears' fold:** how far each ear vertex moves to lie on the egg, for a hood, a knit hat or long hair.

**The data:** `fanHead.js`, 151 KB.
- Per level: positions (int16, 0.1 mm), normals (int8), the index.
- Per vertex, 7 × vec4u records (halves): the paint's frame and the fold, the 8 shapes' x, y, z, and their normals' x, y, z.

### 2. On the fans: done (`FanHead.js`, `Crowd.js`, `places/Cast.js`)

**`src/ballpark/FanHead.js` (new):**
- decodes the levels;
- one storage buffer of every level's records (`fhRec`, 870 vertices, 97 KB);
- `fanHeadModule` (WGSL): `fhBlend` (a vertex moved by the weights: 7 reads, ~50 multiply-adds), `fhUnpack` (the crowd's packed weights), `fhCoefs` (the Cast's, from who he is and his seed);
- JS `faceFeatures` / `faceWeights` / `packFace`.

**The seated crowd (`Crowd.js`, FF1 blocks):**
- **The close level** has the 400-triangle head and **the near level** (FOX's backdrop) the 90-triangle one, instead of the egg and its nose. The middle, far and distant levels are unchanged.
- **Each fan's 8 weights** are worked out once on the CPU when the stands are seated (`_seat()` → `faceOf()`), from his ids (female, age, skin, build, seed). They're packed 4 bits each into `cwIds.w`, which was unused.
- **The blend runs once in the material's vertex code, before both `cwVertex` calls** (this frame's pose and last frame's, for the motion vectors), so the head's shape costs one pass, not two.
- **`cwVertex` takes the vertex's paint frame and ear fold** (`paint`, `fold`):
  - the ears fold flat under a hood, a knit hat or long hair;
  - the hood's opening, the knit's edge and the cap's crown shaping read the paint's frame; the geometry they move is the real head;
  - `vLocal` is the paint's.
- **FW1's per-face width and length** are skipped on the MakeHuman head: the blend shapes do it.
- **The eyeballs** are white under the lids, with an iris round the painted pupil: brown, or hazel or blue for some fair fans.
- **No beard, goatee or stubble down the neck.** The egg ended at the chin; this head has a neck under it.

**The Cast (`places/Cast.js`, FF1 blocks):**
- **The near figure** has the 1,200-triangle head and **the middle one** the 400. Their own nose and ears replace FW4's sculpted egg, its nose patch and its ear shells; `headFine` is kept, unused. The far and distant figures are unchanged.
- **`aInfo` is a vec3:** the bone, the part, and the head vertex's record.
- **The weights are worked out in the vertex stage** from the look (seed, female, age, skin, build: `fhCoefs`). Only the near and middle figures' head vertices pay.
- **The ears fold flat** under a hood (a poncho's, up), a knit hat, earmuffs, the motor helmet, or long hair. FW4's ear shells were folded away in the same cases.
- **The paint's frame:**
  - it is `qFace`, and `d` for the hood, the knit and the police cap;
  - FW4's per-face jaw, length, nose and female-brow shaping is skipped on it;
  - a kid's paint is right now: the egg's was scaled about the neck, so its d was off.
- **The eyeballs and the beards** are as the crowd's.

### 3. Before and after: done

**The Cast** (`b0/` against `a2/`):
- `L5-face-6`: the egg with a painted beard becomes a real skull, brow ridge, cheekbones, nose, jaw and ears.
- `L2-faces-01`, `L3-faces-23`, `L1-line-front`, `D1-faces-day`.
- `C5-home-front`: the Diamond Club's near and middle figures.

**The seats** (`b0/` against `a2/`): `C2-seats-3b-close`, `C1`, `C3`, `C4`, `D2`. Each fan has his own face (the goatee fan, the knit hat, the glasses, the hood).

**Against Getty 83893023:**
- **Closer:** the faces have the brow over the sockets, the nose's bridge and wings, cheekbones, the jaw's angle and chin, real ears. They differ in shape as the photo's do: long and round, broad and narrow noses, heavier and finer jaws.
- **Still short of it:**
  - no expressions (the mouths open only in the paint);
  - no jowls beyond what the old and heavy targets give;
  - the skin is FY3's paint without its hair-by-hair detail.

**The far levels look the same:** `T2-tv-high`, `S0-400s-stats`, `W1-concourse3b-stats` (their geometry is untouched).

**TV center** (`T1`): the 123 middle Cast figures behind the plate now have the 400-triangle head. At FOX's ~40-60 px a head, the structure shows a little in the light; the backdrop reads as before.

## The counts

`JSON.stringify( __app.engine.meshRenderer.stats )` with `__cast.stats` and the crowd's level counts, 1280 × 800, full park, read in each shot's own js after 6 frames (`b0` → `a2`):

| View | Before | After |
|---|---|---|
| The 400s seat behind home (play 60; close 668, near 1,645 fans) | 1,118 draws, 6,102,586 triangles | 1,118 draws, 6,167,660 |
| The 3B concourse (play 60) | 813, 3,226,903 | 813, 3,238,395 |
| The lineup (7 near Cast figures; close 1,747, near 3,145 fans behind) | 469, 2,147,447 | 469, 2,179,735 |
| The seats behind home from the field (C5) | 564, 4,920,505 | 564, 5,059,447 |
| TV center (play 20; near 5,434 fans, 123 middle Cast) | 497, 3,578,506 | 497, 3,593,272 |
| TV high (play 60) | 792, 3,742,367 | 792, 3,778,709 |

Pipelines are 769 throughout: no new material or pipeline.

**Per figure** (vertices / triangles):
- the crowd's close level 677 / 1,028 → 684 / 1,100;
- its near level 199 / 246 → 199 / 270;
- middle, far and distant unchanged;
- the Cast's near figure 4,748 / 6,265 → 4,579 / 6,105 (lighter);
- its middle figure 3,338 / 3,794 → 3,272 / 3,772;
- far and distant unchanged.

## The frame rate

Not profiled (the coordinator does).

**Geometry** is about the same:
- +72 triangles a close fan, +24 a near fan;
- the Cast's fine figures are lighter;
- the views' totals are within +1-3%.

**Vertex stage:** what's new is the blend on the head's vertices only, close and near levels and the Cast's near and middle figures:
- 7 vec4u reads from a 97 KB buffer every fan shares (it stays in cache), 12 `unpack2x16float`s and ~50 multiply-adds a vertex;
- in the crowd, once a vertex (before both pose calls), not twice;
- in the Cast, plus `fhCoefs` (~34 hashes and ~50 multiply-adds), on 1,200 / 400-triangle heads for the few near and the ~123 middle figures.

**The heaviest cases:**
- TV center's near level: 5,434 fans × 52 head vertices = 280k blended vertices;
- the 400s seat: 668 close × 210 + 1,645 near × 52 = 225k.

**Fragment stage:** the eyeball's few ALU; the beards' cutoff, one smoothstep.

**CPU:** once, at seating, ~45k fans × 8 weights (a few ms at load).

**Where to watch:** the 400s seat (it was 25.4 ms as published) and TV center. If either moves, the near level's blend can be cut to its first four shapes (they hold 60% of the variance) by zeroing `cB` in `Crowd.js` under `CROWD_LOD == 1`: one line.

## For the merger

**Files:**
- **new:**
  - `tools/build-fanhead.mjs`;
  - `src/ballpark/game/data/fanHead.js` (generated: re-run `node tools/build-fanhead.mjs`; it fetches ~175 MakeHuman target files into `tools/body/.cache` the first time);
  - `src/ballpark/FanHead.js`.
- **`src/ballpark/Crowd.js`:**
  - the import;
  - `LODS`' `mh` field;
  - the head in `fanGeometry` (the egg and nose skipped when `MH`);
  - `cwVertex`'s two new parameters and its head branch (`mh`, `dl`, `local = dl`);
  - the material's module, `fhRec` storage and vertex pre-step (`pos0`, `stp0`, `nrm0`, `nrm0s`: `call()` now passes those);
  - `faceOf()` and its line in `_seat()` (`ids[ f * 4 + 3 ]`);
  - the eyeball and the beards' `noNeck` in the surface.
- **`src/ballpark/places/Cast.js`:**
  - the import;
  - `vert()`'s `fh`, and `mhHead()` in `figureGeometry` (`headFine` unused);
  - `aInfo` as `vec3f` (and the geometry's 3-wide attribute);
  - the material's module and `fhRec` storage;
  - the vertex block before the head's dressing (`fhi`, `fhPaint`), `var d` / `qFace`, the FW4 block's `&& fhi == 0u`;
  - the eyeball and the beards' `noNeck` in the surface.
- **`CREDITS.md`:** a MakeHuman section (the players' body had none either).
- **Not touched:** `Players.js`, `Rig.js`, `Looks.js`, `home/Dress.js`.

**Things to keep in mind:**
- **`cwIds.w` is now each fan's packed face** (it was 0). `_writeIds` and `vacate` only touch `.z`; anything else that rewrites the ids must keep it.
- **`cwVertex` has two more parameters** (`paint`, `fold`; zero for the egg levels). Anything new that calls it must pass them.
- **A Cast geometry built outside `figureGeometry`** must have a 3-wide `aInfo` (the third 0).
- **For the players, later:** their body is the same base mesh, so these targets (or this PCA, on `body.js`'s head vertices, which are the same base indices) could replace or add to FY4's 16 hand-made face numbers in `Players.js`. That's a `build-body.mjs` change, and `build-body-lod.mjs` re-runs after it. Not done, as asked.
- **The continuity is kept:** `node test/continuity.mjs` prints duration 3785.503 and start hash 801248349. `npm test` passes.

## Left, and noticed

- **The Cast's blink** squashes the painted white but not the lids: an eyeball stays white through a blink.
- **The 90-triangle head** (the crowd's near level) is coarse up close: its mouth is a diamond (`heads4.png`). It's only drawn at 15-40 px, where it reads, but a fan forced to it at arm's length would show it.
- **The chin is ~1.5 cm lower than the egg's.** A fan nodding down (rain, a hood) can bring it into a zipped collar; real chins do touch it.
- **No expressions:** the mouth opens only in the paint. MakeHuman's expression targets (`targets/expression/`) could add an open jaw as one more blend shape, for the cheering.
- **People.js's throng** and **RailFigures / FieldFigures** still have their own heads (not in my files).
