# FY4, round 4: every player his own face

Fixer FY4, 2026-10-28, branch `worktree-agent-a2f44f4ec5ed3a53d` (off `ballpark` at 4f2576e, FY3 merged).

**The ticket:** FY3 found that every man on the field had the same MakeHuman face; only his skin, beard, eyes and jaw's width differed.

## The shots

All in the main checkout, `.claude/gauntlet/r4/FY4/`; full park, 1280 × 800; no console errors in any job.

**The jobs** (each job's json sits beside its folder):
- `b0/`: the before, on this branch's base. It also has the roster probes, `R-roster-*`. Their js runs before the seek, so each probe lists who was on the field at the previous shot's time.
- `a1/`, `a2/` and `a3/`: the passes. `final/` and `final2/` were on intermediate code.
- **`final3/` is the last job, on the final code:**
  - the TV views (T00/T01 at the last pitch, G-close, the walk-ups, the celebration, the TV high camera);
  - every face, from in front (`F<n>`) and three-quarter (`Q<n>`);
  - the busts `B01`-`B04`.

**The generator:** `/private/tmp/claude-501/-Users-phillipforrence-Documents-HomeKit/4f4e82b4-ef9f-4fa0-a3f9-d023a05012fe/scratchpad/fy4/mkjob.mjs`. It frames faces with FY3's `__fy3face`: the camera 3.2 m in front of a man's face at 7°.

**Before / after sheets** (face crops, before over after; `sheet.mjs` in the same scratchpad folder builds them):
- `v1.jpg`: Lidge, Utley, Howard, Rollins, Hamels, Upton; `b0` against `final3`.
- `u1.jpg` and `u2.jpg`: Lidge, Utley, Howard, Rollins, Werth, Feliz; then three-quarter Lidge and Howard, Burrell, Hamels, Longoria, Upton; `b0` against `a3`.
- `t3.jpg`: Manuel, Lopes, Pena, Jenkins and the busts.
- `bust.jpg`: Lidge's bust, FY3's against mine, and Manuel.
- `tv.jpg`: the TV close-up at 523.9 and the walk-up at 3093.3, before beside after.
- `mid.jpg`: the walk-up at 1415.2 and the TV high camera, before beside after.

**Watch the numbering:** from F21 on, `b0/`'s face numbering differs from the later jobs' (some men weren't there at `b0`'s seeks). Compare F01-F20 directly.

**The men found, and where:**
- **3478.2:** Lidge, Ruiz, Hinske, Utley, Howard, Rollins, Werth, Feliz, Victorino, the umpires, the Rays' base coaches.
- **523.9:** Burrell, Hamels.
- **3178.2:** Price, Crawford, Longoria, Upton, Bartlett, Navarro, Iwamura.
- **1720.9:** Pena.
- **3600 (the celebration):** Jenkins, `r:manuel`, `r:lopes`, `r:dubee`.

**Balfour** isn't on the field at any seek I tried.

## What I did

### 1. Per-player face shape: done (`Looks.js`, `Players.js`, `Rig.js`)

**Looks.js (an FY4 block after FY3's, and four marked lines in `look()`):**
- **Sixteen numbers per look, -1 to 1,** with 0 being the base mesh. `FACE_KEYS` has twelve (the `FACES` table); `FACE_MORE` has four (the `MORE` table):
  - `jawL`: the lower face's length;
  - `chin`: its jut; `chinW`: its breadth;
  - `cheek`: the cheekbones; `full`: the cheeks' flesh, and the face's breadth from the temples to the jaw;
  - `brow`: the ridge over the eyes;
  - `noseL`: the nose's length and how far it stands out; `noseW`: its breadth at the wings; `bridge`;
  - `eyes`: their spacing; `deep`: deep-set eyes;
  - `ears`: their size and how far they stand off;
  - `neck`: its thickness;
  - `lips`: fuller; `mouthW`: wider;
  - `gonion`: the jaw's angle flared.
- **`FACE_PACK`** is the packing order.
- **`head`:** the head's own size, about 1. Howard 1.045, Hinske 1.04, Manuel 1.05, Rollins 0.97, Hamels 0.98, and so on. Where the notes give none, it comes from the face's flesh and neck.
- **Written faces:**
  - the twenty the brief named, plus Madson, Baldelli, Kazmir, Aybar and F. Perez;
  - the six umpires, Manuel, Maddon, Lopes, Smith, Hendrick, Foley, Moyer and Hickey.
- **What they're from:** the 2008 Getty and FOX close-ups in `.claude/ref/rituals/` and `.claude/ref/gauntlet/play/`, and the men's well-known looks.
  - **The photos:** Upton 83484235 (a long, lean face, a wide nose, high cheekbones); Manuel 83483743 (heavy, with a big fleshy nose, jowls and big ears); Lidge 83485858; Feliz 83483794; Balfour 83485159; Hamels 83486314.
  - Lidge: the long face, jutting chin, deep-set eyes and thin lips.
  - Ruiz: broad and round, a wide nose.
  - Utley: angular, high cheekbones over hollow cheeks, a heavy brow, a flared jaw.
  - Howard: a big, round head and face.
  - Rollins: narrow, with high cheekbones and his ears, a small head.
  - Werth: long, with a long nose.
  - Hamels: narrow and fine.
  - Navarro: round.
  - Longoria and Burrell: a square jaw and a heavy brow.
  - Upton and Price: long and lean.
  - Iwamura: a flat bridge and wide cheekbones.
  - Manuel: big and heavy, with a big nose and ears.
- **The jaw's width** (the look's `jaw`) was set for ten men who had none.
- **Everyone else** gets a face from his seed, ±0.6. The ball girls' faces are softer.
  - The unnamed coaches (Mackanin, Dubee, ...) share the Director's seed (`hash( '' )`), so their faces mix in a hash of their id.

**Players.js:**
- **`packFace`:** the sixteen numbers in six bits each, four to a float. Each is 0 to 62, and 31 is exactly the base face; the floats hold whole numbers under 2^24, exact in an f32.
- **The slot's fifth info vec4:** `K` is now 5.
- **The vertex stage** (an FY4 block just before the skinning) shapes the bind pose:
  - each number moves its own region of the face, with smoothstep weights from the mesh's landmarks (probed from `data/body.js`);
  - each moves by a few millimetres up to about 1.5 cm: 17 mm for the lower face's length, 10 mm for the chin, 8 mm for the cheekbones and cheeks, ±7% for the face's breadth, ±32% for the nose's standing-out and wings, 3.5 mm for the lips, ±15% for the mouth's width, 3-3.5 mm for the eyes' depth and spacing, 6 mm for the jaw's angle, ±20% for the ears.
- **Age's own,** from the look's `age`, smoothstepped from 0.45: jowls along the jaw, fullness under the chin, a longer nose and bigger ears. That covers the umpires (0.6-0.8), the coaches and Manuel (1.0). A heavy face (`full`) has the fullness under the chin too.
- **The neck:**
  - thicker for everyone (+6%), more for the big men;
  - the head 7-10 mm lower on it, the neck taking up the drop (FY3's "the neck reads long from the front");
  - the pieces bound to the head bone (the cap, the helmet and flaps, the mask, the catcher's cap, the hood, the glasses) and the eyes drop with it.
- **Ears under a batting helmet** grow at 40% strength, so they stay inside the flaps.
- **The face's paint stays on its vertices:** `vLocal` is now `lp3 - fd`, the unshaped position. FY3's brows, lids, lips, beards, stubble, the hairline and the collar line are all drawn from `vLocal`, so they follow the shaped face.
- **Not shaped:** the Phanatic, and everything below the collar.

**Rig.js:**
- `solvePose` takes `headSize` (default 1), multiplied into the head bone's scale `hk`.
- Players.js passes `p.look.head`. Props.js (the Phanatic) and the rig's own calls keep 1.

**Before / after:**
- `b0/F01`-`F20` and `Q01`-`Q20` against `final3/`'s.
- The sheets `v1.jpg`, `u1.jpg` and `u2.jpg`.

**Honest verdict:**
- **What's better:** the men now differ in face shape and head size. Lidge's long face and chin, Utley's broad jaw over hollow cheeks, Howard's big round head, Rollins' small narrow one, Upton's long face, Longoria's and Burrell's square jaws, and Manuel's heavy, big-eared face all read in the 7° close-ups. Howard and Rollins also differ in the TV's close-ups.
- **What's left:** the shaping is a deformation of one face, so they are still recognisably related.
  - The eyes' shape and lids, and the forehead, are the base mesh's.
  - The face's normals are the unshaped ones: a slightly wrong shade on the moved regions, invisible at these sizes.
  - Truly distinct faces would want MakeHuman's own face targets (`tools/build-body.mjs` loads targets) baked as a few blend shapes. That's a build-body change, and it re-runs the LOD tool.

### 2. The umpires, managers and coaches: done (in the same mechanism)

- **The six umpires** have their own faces, plus age's jowls, fullness under the chin, nose and ears, and three bigger heads.
- **Manuel** has his own face and head (`final3/F26-manuel`, and `t3.jpg`).
- **Maddon, Lopes, Smith, Hendrick, Foley, Moyer and Hickey** have their own.
- **The unnamed coaches** get seeded faces that differ from one another.

### 3. Before and after, and the far figures: done

- **The sheets** are above.
- **The mid and far figures:**
  - the walk-ups at 1415.2 and 3093.3;
  - the TV high camera (`T02-high-last-pitch`);
  - the pitcher close-up at 523.9 (`mid.jpg`, `tv.jpg`).

  They look the same at their distances. The shaping runs on their vertices too (one material), but it's sub-pixel there; the head's size shows a little in the close-ups, as it should.

## The counts

`JSON.stringify( __app.engine.meshRenderer.stats )`, full park, 1280 × 800:

| View | Before (`b0`) | After (`final3`) |
|---|---|---|
| TV center, the last pitch (3480.9; read by `T01`) | 491 draws, 3,502,902 triangles, 768 pipelines | 491 draws, 3,502,902 triangles, 768 pipelines |
| The pitcher close-up from high first (3178.2) | 490 draws, 3,496,322 triangles, 768 pipelines | 490 draws, 3,467,292 triangles, 768 pipelines (`final2`) |

Draws, pipelines and triangles are unchanged; no geometry was added. The 3178.2 numbers vary by the crowd's and the weather's noise between loads.

## The frame rate

- **Geometry, draws, materials:** none added. `data/body.js` and the build tools are untouched, so the LOD tool didn't need re-running.
- **Vertex stage:** the player vertices above the collar (about 4,400 of the near body's 11,400, fewer in the mid and far levels) pay:
  - one more storage read;
  - sixteen unpacks;
  - about twenty-five smoothstep weights and a few multiply-adds.

  The vertices below the collar skip it with one compare.
- **Fragment stage:** no change.
- **CPU:** one more `info.set` per player per frame, and one multiply in `solvePose`.
- **Where to watch:** nowhere in particular. The heaviest case is the celebration's pile, with ~40 men near, and it's a few hundred thousand ALU ops a frame.

## For the merger

**Files** (all in FY4 blocks or marked lines):
- `src/ballpark/game/Looks.js`: the FY4 block after FY3's (`FACE_KEYS`, `FACE_MORE`, `FACE_PACK`, `FACES`, `MORE`, `HEAD`, `seededFace`, `headOf`, `keySeed`), and four marked lines in `look()`.
- `src/ballpark/game/Players.js`:
  - `K` 4 → 5;
  - the `info.set` of the shape;
  - `packFace`, and `packLook`'s `shape`;
  - the imports (`BONES`, `FACE_PACK`);
  - `solvePose`'s `p.look.head`;
  - the vertex block;
  - `o.vLocal = lp3 - fd`.
- `src/ballpark/game/Rig.js`: `solvePose`'s `headSize` (two marked lines).

**Things to keep in mind:**
- **`K` is 5.** Any code that indexes `plInfo` must use `${ K }u`. Every read in Players.js does.
- **`vLocal` is the unshaped position for the face only** (`fd` is zero elsewhere). Anything new in the surface stage that wants the shaped face must add the shape back.
- **A look built outside Looks.js** (Pens.js spreads `lookFor( null, seed )`) has a seeded `face` and `head`. A look without `face` packs 31s, which is exactly the base face.
- **Tests:** `test/players-shader.mjs` passes (under the lock), and `npm test` passes.

## Left, and noticed

- **Distinct eyes, lids and foreheads** want MakeHuman's face targets as blend shapes (see above).
- **Balfour's** face isn't shot (he isn't on the field at my seeks); his numbers are written.
- **The face's normals** aren't updated for the shaping. A cheap fix would be a finite-difference normal from the same weights; untested.
- **The unnamed coaches** still share one skin and hair (the Director passes `hash( '' )`). It's a one-line fix in Looks.js' seeded path, left alone so as not to change everyone's seeded looks this late.
