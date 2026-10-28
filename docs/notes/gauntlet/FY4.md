# FY4, round 4: every player his own face

Fixer FY4, 2026-10-28, branch `worktree-agent-a2f44f4ec5ed3a53d` (off `ballpark` at 4f2576e, FY3 merged). One hour, a hard stop at 18:30.

**The ticket:** FY3 found that every man on the field had the same MakeHuman face; only his skin, beard, eyes and jaw's width differed.

## The shots

All in the main checkout, `.claude/gauntlet/r4/FY4/`; full park, 1280 × 800; no console errors in any job.

**The jobs** (each job's json sits beside its folder):
- `b0/`: the before, on this branch's base.
- `a1/` and `a2/`: the two passes.
- `final/`: the last job, on the final code. It has the same faces as `b0/`, the TV views, and the busts `B01`-`B04`.

**The generator:** `/private/tmp/claude-501/-Users-phillipforrence-Documents-HomeKit/4f4e82b4-ef9f-4fa0-a3f9-d023a05012fe/scratchpad/fy4/mkjob.mjs`. It frames faces with FY3's `__fy3face`: the camera 3.2 m in front of a man's face at 7°.
- **Faces:** `F<n>-<who>` is from in front; `Q<n>-<who>-34` is three-quarter.
- **Before / after sheets** (face crops, before over after) are in the same scratchpad folder:
  - `t1.jpg`: Lidge, Ruiz, Utley, Howard, Rollins, Werth.
  - `t2.jpg`: Hamels, Price, Navarro, Longoria, Upton, the plate umpire.
  - `t3.jpg`: Manuel, Lopes, Pena, Jenkins, Lidge's bust, the umpire's bust.
  - `mid.jpg`: the walk-up at 1415.2 and the TV high camera, before beside after.
- **Watch the numbering:** `b0/`'s face numbering from F21 on differs from `final/`'s (some men weren't there at `b0`'s seeks). Compare F01-F20 directly.

**The men found, and where:**
- **3478.2:** Lidge, Ruiz, Hinske, Utley, Howard, Rollins, Werth, Feliz, Victorino, the umpires, the Rays' base coaches.
- **523.9:** Burrell, Hamels.
- **3178.2:** Price, Crawford, Longoria, Upton, Bartlett, Navarro, Iwamura.
- **1720.9:** Pena.
- **3600 (the celebration):** Jenkins, `r:manuel`, `r:lopes`, `r:dubee`.

**Balfour** isn't on the field at any seek I tried.

## What I did

### 1. Per-player face shape: done (`Looks.js`, `Players.js`)

**Looks.js (an FY4 block after FY3's):**
- **`FACE_KEYS`:** twelve numbers per look, -1 to 1, with 0 being the base mesh:
  - `jawL`: the lower face's length;
  - `chin`: its jut; `chinW`: its breadth;
  - `cheek`: the cheekbones; `full`: the cheeks' flesh, and the face's breadth from the temples to the jaw;
  - `brow`;
  - `noseL`: the nose's length and how far it stands out; `noseW`: its breadth at the wings; `bridge`;
  - `eyes`: their spacing;
  - `ears`: their size and how far they stand off;
  - `neck`: its thickness.
- **Written faces:**
  - the twenty the brief named, plus Madson, Baldelli, Kazmir, Aybar, Iwamura and F. Perez;
  - the six umpires, Manuel, Maddon, Lopes, Smith, Hendrick, Foley, Moyer and Hickey.
- **What they're from:** the 2008 Getty and FOX close-ups in `.claude/ref/rituals/` and `.claude/ref/gauntlet/play/` (Lidge, Feliz, Upton, Balfour, Hamels, Burrell, Bartlett, Ruiz), and the men's well-known looks.
  - Lidge: the long face, jutting chin and deep-set eyes.
  - Ruiz: broad and round, a wide nose.
  - Utley: angular, high cheekbones, a heavy brow.
  - Howard: big and round.
  - Rollins: narrow, with high cheekbones and his ears.
  - Werth: long, with a long nose.
  - Hamels: narrow and fine.
  - Navarro: round.
  - Longoria: a square jaw and heavy brow.
  - Upton and Price: long and lean.
  - Iwamura: a flat bridge and wide cheekbones.
  - Manuel: big and heavy, with a big nose and ears.
- **The jaw's width** (the look's `jaw`) was set for ten men who had none: Hinske, Navarro, Victorino, Crawford, Upton, Bartlett, Price, Balfour, Iwamura and Jenkins.
- **Everyone else** gets a face from his seed, ±0.6. The ball girls' faces are softer.
  - The unnamed coaches (Mackanin, Dubee, ...) share the Director's seed (`hash( '' )`), so their faces also mix in a hash of their id. Their skin and hair are still the shared seed's, as before.

**Players.js:**
- **`packFace`:** the twelve numbers, a byte each, three to a float (whole numbers under 2^24, exact in an f32).
- **The slot's fifth info vec4:** `K` is now 5.
- **The vertex stage** (an FY4 block before the skinning) shapes the bind pose:
  - each number moves its own region of the face, with smoothstep weights from the mesh's landmarks (probed from `data/body.js`);
  - each moves by a few millimetres: up to 17 mm for the lower face's length, 10 mm for the chin, 8 mm for the cheekbones and cheeks, ±7% for the face's breadth, ±32% for the nose's standing-out and wings, 3.5 mm for the eyes, ±20% for the ears.
- **Age's own,** from the look's `age`, smoothstepped from 0.45: jowls along the jaw, a longer nose and bigger ears. That covers the umpires (0.6-0.8), the coaches and Manuel (1.0).
- **The neck:**
  - thicker for everyone (+6%), more for the big men (`neck`: Howard, Hinske, Burrell, Navarro, the umpires, Manuel);
  - the head 7-10 mm lower on it, the neck taking up the drop (FY3's "the neck reads long from the front");
  - the pieces bound to the head bone (the cap, the helmet and flaps, the mask, the glasses) and the eyes drop with it.
- **Ears under a batting helmet** grow at 40% strength, so they stay inside the flaps.
- **The face's paint stays on its vertices:** `vLocal` is now `lp3 - fd`, the unshaped position. FY3's brows, lids, lips, beards, stubble, the hairline and the collar line are all drawn from `vLocal`, so they follow the shaped face.
- **Not shaped:** the Phanatic, and everything below the collar.

**Before / after:**
- `b0/F01`-`F20` and `Q01`-`Q20` against `final/`'s.
- The sheets `t1.jpg` and `t2.jpg`.

**Honest verdict:**
- **What's better:** the men now differ in face shape. Lidge's long face and chin, Utley's broad jaw over hollow cheeks, Howard's breadth, Rollins' and Upton's narrow faces, Longoria's square jaw and Manuel's heavy, big-eared face all read in the 7° close-ups.
- **What's left:** the shaping is a deformation of one face, so they are still recognisably related.
  - The eyes' shape, the lids, the lips' shape and the forehead are the base mesh's.
  - The face's normals are the unshaped ones: a slightly wrong shade on the moved regions, invisible at these sizes.
  - Truly distinct faces would want MakeHuman's own face targets (`tools/build-body.mjs` loads targets) baked as a few blend shapes. That's a build-body change, and it re-runs the LOD tool.

### 2. The umpires, managers and coaches: done (in the same mechanism)

- **The six umpires** have their own faces, plus age's jowls, nose and ears.
- **Manuel** has his own face (`final/F26-manuel`).
- **Maddon, Lopes, Smith, Hendrick, Foley, Moyer and Hickey** have their own.
- **The unnamed coaches** get seeded faces that differ from one another.

### 3. Before and after, and the far figures: done

- **The sheets** are above.
- **The mid and far figures:**
  - the walk-up at 1415.2 (`b0/` against `final/W-walkup-1415.2`);
  - the TV high camera (`T02-high-last-pitch`).
  - They look the same at their distances (`mid.jpg`). The shaping runs on their vertices too (one material), but it's sub-pixel there.

## The counts

`JSON.stringify( __app.engine.meshRenderer.stats )`, full park, 1280 × 800, the TV center at the last pitch (3480.9; read by `T01`):

| | draws | triangles | pipelines |
|---|---|---|---|
| Before (`b0`) | 491 | 3,502,902 | 768 |
| After (`final`) | 491 | 3,475,812 | 768 |

**Draws and pipelines** are unchanged. The triangles differ by the crowd's and the weather's noise between loads; no geometry was added.

## The frame rate

- **Geometry, draws, materials:** none added. `data/body.js` and the build tools are untouched, so the LOD tool didn't need re-running.
- **Vertex stage:** the player vertices above the collar (about 4,400 of the near body's 11,400, fewer in the mid and far levels) pay:
  - one more storage read;
  - four unpacks;
  - about twenty smoothstep weights and a few multiply-adds.

  The vertices below the collar skip it with one compare.
- **Fragment stage:** no change.
- **CPU:** one more `info.set` per player per frame.
- **Where to watch:** nowhere in particular. The heaviest case is the celebration's pile, with ~40 men near, and it's a few hundred thousand ALU ops a frame.

## For the merger

**Files** (all in FY4 blocks):
- `src/ballpark/game/Looks.js`: the FY4 block after FY3's, and two marked lines in `look()`.
- `src/ballpark/game/Players.js`:
  - `K` 4 → 5;
  - the `info.set` of the shape;
  - `packFace`, and `packLook`'s `shape`;
  - the imports (`BONES`, `FACE_KEYS`);
  - the vertex block;
  - `o.vLocal = lp3 - fd`.

**Things to keep in mind:**
- **`K` is 5.** Any code that indexes `plInfo` must use `${ K }u`. Every read in Players.js does.
- **`vLocal` is the unshaped position for the face only** (`fd` is zero elsewhere). Anything new in the surface stage that wants the shaped face must add the shape back.
- **A look built outside Looks.js** (Pens.js spreads `lookFor( null, seed )`) has a seeded `face`. A look without `face` packs zeros, which is the base face.
- **Tests:** `test/players-shader.mjs` passes (under the lock), and `npm test` passes.

## Left, and noticed

- **Distinct eyes, lids, lips and foreheads** want MakeHuman's face targets as blend shapes (see above).
- **Balfour's and Jenkins's** faces at the plate weren't shot (they aren't on the field at my seeks); their numbers are written.
- **The face's normals** aren't updated for the shaping. A cheap fix would be a finite-difference normal from the same weights; untested.
- **The unnamed coaches** still share one skin and hair (the Director passes `hash( '' )`). It's a one-line fix in Looks.js' seeded path, left alone so as not to change everyone's seeded looks this late.
