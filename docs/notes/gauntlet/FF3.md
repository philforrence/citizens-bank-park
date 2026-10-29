# FF3, step 10: the players share the fans' face targets; their expressions; the fans' open items

Fixer FF3, 2026-10-28, branch `worktree-agent-ada9ecd6ff9629da8` (off `ballpark` at 20a4182, FF2 merged). Wound down early at the coordinator's call.

**The owner:** "give the people in the stands the facial structures of real people like the players on the field." The fans had MakeHuman's real targets (FF1, FF2); the players had one base face bent by FY4's sixteen hand-set numbers. Now both draw from MakeHuman's own targets.

## The shots

All in the main checkout, `.claude/gauntlet/s10/FF3/`; full park (no `only=`), 1280 × 800.

- **The before** is FY4's last job, `.claude/gauntlet/r4/FY4/final3/` (the players' code hasn't changed since; FF1/FF2 touched only the fans).
- **`a1/`:** FY4's framings on this branch (the same names: `F<n>` faces from in front, `Q<n>` three-quarter, `B01`, the TV views `T00`-`T02`, `G-close-*`, `W-walkup-3093.3`, `C-cel-158`). No console errors. Its eight strike-three shots (`X*`) didn't run: a job-script bug (a missing `;` before the shot's IIFE), fixed in `a2`.
- **`a2/`:** the last job, on the final code: Lidge and Howard from in front (`F01`, `F05`), Lidge's shout 1.2 and 1.6 s after strike three (`X1`, `X2`), Howard in the pile (`X4`, +9 s), Rollins at the celebration (`X7`, +120 s); FF2's fan framings (`S0` the 400s seat's stats, `X3` the lineup shouting, `C2` the seats at 1.25 m, `E2` the celebration's seats at 3 m), and the celebration from TV high with its stats (`K1`).
- **The sheet:** `s1.jpg` (FY4 final3 over `a1`: Lidge, Ruiz, Utley, Howard, Rollins, Werth), built by `sheet.mjs`.
- **The generators** are in the scratchpad's `ff3/` (`/private/tmp/claude-501/-Users-phillipforrence-citizens-bank-park/4f4e82b4-ef9f-4fa0-a3f9-d023a05012fe/scratchpad/ff3/`): `mkjob.mjs` (a1), `mk2.py` (a2), `sheet.mjs`, and `pview.mjs`, a software rasterizer of the players' heads with their targets and expressions (no GPU). `p1.png` is its first sheet.
- **References:** Getty 83485858 (Lidge's shout at the last out: the jaw dropped fully, the eyes screwed up), and the 2008-10-29 set in `.claude/ref/rituals/` listed in `Looks.js`' FF3 block.

## 1. The players share the fans' face targets: done (the fits by eye, partly checked)

**`tools/build-body.mjs` (an FF3 block) → `game/data/body.js` `BODY.head`:**
- **The head:** the body's 4,598 vertices above the collar, and the eyeballs. The targets fade to nothing at the collar, where the jersey takes over.
- **The blend shapes, 115,** MakeHuman's own, as FF1 used them for the fans, but per modifier rather than as a PCA:
  - the face's modifiers, each end separately (the nose ×13, the mouth and lips ×7, the chin and jaw ×7, the cheeks ×4, the eyes and lids ×7, the brows ×3, the forehead ×3, the ears ×4, the neck ×3, the head's fat);
  - the seven head shapes (oval, round, square, rectangular, triangular, inverted triangular, diamond);
  - the macros' share of the face, against the body's own mix: African and Asian (each against the European face), old, heavy, light, and a woman's face (for the ball girls). Each macro's own shift and scale are taken out (they move the whole head by up to 12 cm with the body's proportions), as FF1 did for each fan.
- **Left out:** the head's scales, the back of the skull and the forehead's nubian bulge. They're under the cap and the helmet, which are built on the base's skull, and the head's size is already the look's `head`.
- **Stored** int8 against each shape's own largest move, sparse where a shape moves under half the head; moves under 0.1 mm are dropped. 61k entries.
- **The expressions** (FF2's units, mixed by the body's own shares, at full strength): open (with the brows up), smile (the cheeks up into the lids), blink. Their normals' change comes from the whole body's triangles. Stored at the 1,955 vertices they move.
- **The mouth's inside** (the bag the base mesh's lips curl into, which the open jaw shows) is found by FF2's test and flagged 2 in `BODY.flag`: 305 vertices.
- **`body.js` is 968 KB (was 518 KB).** `build-body-lod.mjs` was re-run: the same 3,800 and 9,000 triangles. The mouth's flag locks its rim, so a few vertices differ.

**`game/Faces.js` (new):**
- **`bakeFace( mh )`** works out a man's face once, when he comes on: his weights on the shapes, then the normals again from the moved head's own triangles (about 1 ms).
- It returns one vec4u per head vertex: the move and the normal's change, as halves.
- `exprRecords()` gives the expressions' records; `headOf()` maps a body vertex to its head vertex.

**`game/Looks.js` (an FF3 block):** every look gets `mh`, its MakeHuman weights.
- **FY4's sixteen numbers** come across as the modifiers that do what they did, each a little short of MakeHuman's caricature: the lower face's length as the chin's height, the cheeks' flesh as their volume and the head's fat, the bridge as the nose's hump and Greek line, and so on.
- **The macros:** the face's mix from the skin (`ETH_OF`), age from the look's `age` (0 is 22, 1 is Manuel's 64), weight from `girth` and `belly`, and old men's eye bags, lobes and double chin.
- **The photo fits on top (`FF3_MH`)** for the 25 named men, the six umpires, Manuel, Maddon, the base coaches, Moyer, Hickey and the ball girls:
  - each man's mix: Ruiz, Feliz, Pena, Navarro and Aybar as Latin; Victorino Hawaiian (Asian and Polynesian); Iwamura's epicanthic fold;
  - the head shape;
  - the eyes' fold and size, the nose's curve, hump and volume, the mouth's set.

  They are by eye, from the Getty set and the men's well-known looks.
- **Everyone else** (seeded) gets FY4's seeded numbers, mapped the same way, plus his skin's mix, age and build.

**`game/Rig.js`:**
- **`aField` is now 3 wide.** Its z is the vertex's head vertex: -1 off the head, +65536 on the middle and far figures. It's not an attribute of its own because the draw already has WebGPU's 8 vertex buffers (a ninth failed `test/players-shader.mjs`).
- **`PART.mouth = 36`** for the mouth's inside.

**`game/Players.js`:**
- **`playerFaces` storage:** 96 slots × 4,598 vec4u, 7 MB of GPU memory. A slot's face is written once when a man is added (`_faceDirty`, written in `update()`), with a small cache by face.
- **The vertex stage:**
  - one read a head vertex adds his face on every figure: near, middle and far. His identity is baked; the middle and far figures don't blend per vertex.
  - **FY4's fifteen face-shaping numbers are retired** (their ~25 smoothsteps a head vertex are gone). Its neck thickening and head drop are kept (the `neck` number).
  - The skinning and `vNrm` use his own face's normal. `vLocal` stays the unshaped position, so FY3's paint (brows, lids, lips, beards) stays on its vertices.

**Before and after** (`s1.jpg`, FY4 `final3` over `a1`):
- **What's better:**
  - Howard and Rollins have broader noses and fuller lips from the African targets (FY4 only stretched the European base).
  - Lidge's chin is longer and his goatee now sits on it.
  - The faces differ more around the eyes and the nose.
- **What's left:**
  - The difference is modest at FY4's 7° framing, and the men are still recognisably kin. The paint (FY3's brows, lids, lips, beards) is shared, and the skull under the cap is the base's.
  - **The fits are by eye and need a pass against the photos, man by man.** `pview.mjs` renders them without the GPU.

## 2. The players' expressions: partly (the shout's jaw doesn't show on the GPU yet)

- **`Players.js` `expression()`** sets the slot's three expression weights each frame and packs them into the slot's first vec4's spare `.y`:
  - **The blink:** every 2.5-6 s on his own clock, with the lids' own rest a little down.
  - **Chewing:** for 40% of the men (not the umpires), the jaw working a few millimetres, for 2008's sunflower seeds and gum.
  - **From strike three** (`Director.champsAt`, read through `__app.director`; Director.js and Celebration.js untouched):
    - the Phillies shout in bursts with a grin through the pile, then smile and laugh on through the celebration;
    - **Lidge**, for the first 4.5 s: the mouth wide, the eyes screwed up (Getty 83485858);
    - the Rays' faces set; the crew smiles.
- **The near figure** (over 480 px) blends them in the vertex stage: the move and the normal's change, from `playerExpressions` (2 vec4u a head vertex), only while the slot has one on. **The middle and far figures don't** (the coordinator's call); a mouth can pop open as a man crosses 480 px.
- **The mouth's inside** is painted in FY3's face block:
  - the lips' inner faces wet and red, then dark; the upper teeth a band under the upper lip, the lower ones over it; the tongue's back below;
  - only as far as the mouth is open, so a shut mouth shows no rim;
  - the vertex stage marks it through `vField.y = -2` (the part can't be interpolated across the lips' rim).
- **`a1` showed** a pale rim between dark outlines on every closed mouth (the mark's soft edge). That's fixed (gated by the opening and a tighter edge); check it in `a2/F01`, `F05`.
- **On the GPU (`a2`):**
  - **Lidge 1.2 s after strike three** (`a2/X1`, `X2`): the slot's weights read back right (open 1, smile 0.15, lids 0.6: `ex` 10036991 in the job's result), and his lids look shut. **But his jaw isn't visibly dropped.**
  - The same records on the CPU (`pview.mjs`, `p2.png`, `EX=1,0.15,0.6`) open his mouth wide (the jaw 3.7 cm).
  - So something on the GPU path doesn't take the open move. It isn't found yet; it's the first thing to debug (the near figure's FF3 block in `Players.js`, `plExpr`).
  - `X4` (Howard, the pile) framed his shoulder, not his face.
  - No console errors; harmless as it is.

## 3. The fans' open items: partly done

- **The inside of the open mouth: done.**
  - `build-fanhead.mjs` keeps the deepest mouth vertex in the middle above and below the lips' line at every level, and one each side on the near and middle levels.
  - The marked inside is now 47 vertices at 1,200 triangles, 11 at 400 and 6 at 90 (the 90-triangle level had none). The levels keep their counts: 1,200 / 398 / 90 triangles, 613 / 210 / 52 vertices.
- **The 90-triangle head's painted mouth: done.** The crowd's near level (`CROWD_LOD == 1`) paints the open mouth from the mark, as the close level does (no teeth: they're under a pixel). It was the old growing ellipse.
- **The chin against a zipped collar: not done** (wound down).
- **FF2's cost, won back (the coordinator's ask):**
  - FF2's lids' rest kept every close fan's expression weights on, so the two expression records were read for every close-level head vertex every frame.
  - The rest's move now rides in the first record's two spare halves. The ears' fold flag was redundant, because the fold is zero off the ears.
  - `fhBlend( i, cA, cB, ex, rest )` reads the expressions' records only while a fan is cheering, smiling, shouting or blinking. Most of the close fans most of the time read one record fewer per pair.
  - What it gives up: the lids' normal change at rest (the move is kept). The Cast passes `rest = 0` and is unchanged.

## The counts

`JSON.stringify( __app.engine.meshRenderer.stats )`, full park, 1280 × 800:

| View | Before | After |
|---|---|---|
| TV center, the last pitch (3480.9; `T01`) | 491 draws, 3,502,902 triangles, 768 pipelines (FY4 `final3`) | 491 draws, 3,542,744 triangles, 769 pipelines (`a1`) |
| The pitcher close-up from high first (`G-close-523.9`) | | 443 draws, 3,618,313 triangles (`a1`) |
| The 400s seat behind home (play 60; close 668, near 1,645 fans) | 1,118 draws, 6,167,660 triangles, 769 pipelines (FF2 `a4`) | 1,118 draws, 6,171,877 triangles, 769 pipelines (`a2/S0`) |
| The celebration, TV high (3605) | | 831 draws, 4,015,544 triangles, 769 pipelines (`a2/K1`) |

- **Draws and pipelines are unchanged.** The triangle counts move with the crowd's and the weather's noise (FY4's own note).
- **The 400s seat and the celebration's timings** have to come from the coordinator's exclusive profile: I don't profile.
- **The fans on the GPU** (`a2/E2` against FF2's `a4/E2`, the celebration's seats at 3 m): open mouths dark inside, the smiles, no errors.

## The frame rate

- **The players' near figure:**
  - FY4's ~25 smoothsteps and sixteen unpacks a head vertex are gone; one vec4u read, three unpacks and a normalize are added.
  - The expressions add two reads and ~20 multiply-adds a head vertex, on the near figure only (over 480 px: the close-ups).
- **The middle and far figures:** one read a head vertex (1,175 and 540 head vertices), against FY4's shaping. Cheaper than before.
- **CPU:**
  - about 1 ms per man when he comes on (cached by face) and a 73 KB buffer write;
  - each frame, `expression()` per player: a few multiplies.
- **The crowd:** fewer reads at the close level (above). The near level's paint is a few more smoothsteps on its mouth.
- **Memory and load:**
  - `playerFaces` is 7 MB of GPU memory;
  - `body.js` +450 KB (decoded once).

  If the load matters, the expressions' records could be int8 (−50 KB), and the sparse indices delta-coded.
- **Where to watch:**
  - the TV close-ups during the celebration (several near figures with expressions on);
  - the 400s seat (it should be a little cheaper).

## For the merger

**Files:**
- `tools/build-body.mjs` (an FF3 block, the flag, the `head` export);
- `src/ballpark/game/data/body.js`, `bodyLod.js` (generated: `node tools/build-body.mjs` then `node tools/build-body-lod.mjs`);
- `src/ballpark/game/Faces.js` (new);
- `src/ballpark/game/Looks.js` (an FF3 block; `o.id` and `o.mh` in `look()`);
- `src/ballpark/game/Rig.js` (`PART.mouth`, `aField` 3 wide, the import of `headOf`);
- `src/ballpark/game/Players.js` (the FF3 blocks; FY4's vertex block cut to the neck and the drop);
- `tools/build-fanhead.mjs`, `src/ballpark/game/data/fanHead.js` (generated: `node tools/build-fanhead.mjs`; it needs FF2's cache of MakeHuman targets in `tools/body/.cache`; I copied FF2's worktree's);
- `src/ballpark/FanHead.js` (`fhBlend`'s fifth argument);
- `src/ballpark/Crowd.js` (the close level's rest; the near level's mouth);
- `src/ballpark/places/Cast.js` (one call).

**Things to keep in mind:**
- **`aField` is vec3 now.** Anything that builds a players' geometry must push three numbers a vertex.
- **The players' draw is at WebGPU's 8 vertex buffers.** No more attributes without packing.
- **`plInfo[ slot * K ].y`** is the packed expression (a byte each: open, smile, blink). It was 0.
- **`fanHead.js`' records changed meaning:** record 0's spare halves are the blink's move, and the ear-fold flag is gone. `fhBlend` takes a fifth argument (`rest`; 0 for none).
- **`npm test` passes.** `node test/continuity.mjs`: duration 3785.503, start hash 801248349. `test/players-shader.mjs` passes under the lock.
- **`body.js` grew** from 518 KB to 968 KB.

## Left, and noticed

- **The players:** the fits need a man-by-man pass against the photos (`pview.mjs` is quick for that). Also left:
  - the expressions on the middle figure (a pop at 480 px);
  - real teeth (MakeHuman's teeth and tongue helpers exist; the lower teeth even move with `mouth-open`);
  - the ears under a batting helmet (FY4 scaled them to 40%; the targets don't know the role).
- **The fans:** the chin against a zipped collar when the jaw opens.
