# FF2, step 10: the fans' faces read as people (expressions, the eyes, the shading)

Critic and fixer FF2, 2026-10-28, branch `worktree-agent-a9a904643e709eb74` (off `ballpark` at afdf73d, FF1 merged).

**The owner:** "give the people in the stands the facial structures of real people like the players on the field." FF1 gave them the structure; this makes them move and look like people at a ballgame.

## The critique

`.claude/step10/FF2-critique.md`, nine findings worst first. It's in this worktree (`.claude/worktrees/agent-a9a904643e709eb74/.claude/step10/`): the harness kept this agent's writes inside its worktree, so copy it to the main checkout's `.claude/step10/`.

1. **FF2-1 (glaring):** an open mouth was a black disc painted on a shut face (the old man's "moustache", the women's black-lipstick O's, the celebration's doll faces).
2. **FF2-2:** cheering with a blank face: no smile, no squint, the brows level.
3. **FF2-3:** the close level's 400-triangle head shaded in facets.
4. **FF2-4:** nobody in the seats blinked; the Cast's blink left the eyes open.
5. **FF2-5:** the stare: every eye a full white almond.
6. **FF2-6 to FF2-9:** subtler. The lids and the eyeball in polygons at 1 m; the flat lip line; the chin on the collar (true to the photos); FOX's center field camera (fine).

## The shots

All in the main checkout, `.claude/gauntlet/s10/FF2/`: full park, 1280 × 800, the replay's clock.

- **`b0/`:** the before, on afdf73d. 26 shots:
  - FF1's lineup and seat framings;
  - the lineup with expressions set (`X1`-`X4`: mouth 1, blink 1, ...);
  - strike three and the celebration (`E1`-`E3`), the last pitch (`E4`), God Bless America (`E5`), the 27th's rain (`E6`);
  - 3-10 m (`M1`, `M2`, `C5`);
  - FOX center (`T1`, `T3`, `T4`), by day (`D2`).
- **`a1/`:** a WGSL name clash; the frames are black. Don't use it.
- **`a2/`, `a3/`:** the passes.
- **`a4/`:** the last job, on the final code (`S0`, `X3`, `X4`, `E1`, `E2`, `C2`, `T1`).
- **No console errors** in `a2`-`a4`.
- **The generator:** `/private/tmp/claude-501/-Users-phillipforrence-citizens-bank-park/4f4e82b4-ef9f-4fa0-a3f9-d023a05012fe/scratchpad/ff2/mkjob.mjs`. The jobs and their output sit beside it.
- **An offline look:** `view.mjs` there (FF1's software rasterizer, extended) draws the levels with the expressions. The sheets are `h1.png` to `h3.png`.
- **References:**
  - Getty 83893023 (Oct 27 2008, `.claude/ref/gauntlet/people/crop-83893023-caps.png`): the singers' jaws dropped, the laughing woman's cheeks up and eyes narrowed, the lids half down.
  - ronniebruce 2987487127 (Oct 29 2008, the pile).

## What I did

### 1. Expressions from MakeHuman's own units: done (FF2-1, FF2-2, FF2-4, FF2-5)

**`tools/build-fanhead.mjs`:**
- **MakeHuman's expression units** (`targets/expression/units/{african,asian,caucasian}/*.target`, CC0, fetched into `tools/body/.cache` as before), each mixed over the three faces by the crowd's own shares:
  - **open:** `mouth-open`, plus 0.55 × `eyebrows-*-up` (a shout, a cheer, a song), at 0.85 of its full scream;
  - **smile:** `mouth-corner-puller`, plus 0.35 × `mouth-upward-retraction` and 0.7 × `eye-*-slit` (the cheeks up into the lids);
  - **blink:** `eye-left/right-closure`.
- **Their largest moves:** 31.5, 15.5 and 9.7 mm.
- **They're stored per vertex** as two more vec4u records (the move and the normal's change, as halves). `REC` is now 9 (`FAN_HEAD.REC`); the data is 190 KB.
- **The mouth's inside.** The base mesh has no slit: the lips curl into a shallow bag. Its vertices are found (behind the face's front by more than 3 mm, or the lips' inner faces turned up or down), and their paint's d.z is set to -1.9, a mark the shaders read.
  - The mark is kept only where a level's own triangles stay inside the mouth. At 400 triangles, a marked vertex joined to the chin darkened a mask round the open mouth (`a3/E1`).
  - The far (90-triangle) level has no mark.

**`src/ballpark/FanHead.js`:** `fhBlend( i, cA, cB, ex )` takes the expressions' weights (`ex`: open, smile, lids shut). `fhExpr` reads the two records only when any weight is on.

**The seated crowd (`Crowd.js`, FF2 blocks):**
- **The compute pass works out each fan's face:**
  - a smile when they cheer (`M.y`, the Rays' `A3.y`), his own size of it;
  - from strike three, everyone's (not the Rays' fans);
  - less in the rain, none in God Bless America;
  - a blink every 2.8-6 s on his own clock.
- **It packs them with the mouth's opening into `r3.z`:** the mouth in 6 bits, the smile and the blink in 4 each. The surface decodes the mouth from it.
- **The vertex pre-step** (close and near levels) reads them.
  - **Close up,** the lids get their own rest: 0.1-0.32 of a blink, +0.12 for the old, eased by the smile (FF2-5's stare).
  - **Near** (FOX's backdrop, the 90-triangle head) only the mouth and the smile move. The lids are a pixel there.
- **The close level's paint:**
  - **The mouth:** the lips keep their size and colour. Inside the mark it goes dark as the mouth opens, with a narrow band of the upper teeth under the upper lip.
  - **The eyes:** the white and the pupil are painted on the eyeball alone. The lids are skin, with a little shade at their rims, and close over it.
  - The near and egg levels keep the old paint.

**The Cast (`places/Cast.js`, FF2 blocks):**
- **The near and middle figures' heads** take:
  - the mouth from the act's `a.mouth`;
  - a smile with it, by his own nature (plus a faint one at rest for some, half for the old);
  - the lids' own rest, and the act's `a.blink`, which now closes the lids over the eyeball.
- **`vPart` carries 128 for a MakeHuman head** (the fragment masks it: `part = vPart & 127u`, `mhF`). On those heads the mouth and the eyes are painted as the crowd's close level.

### 2. The shading: done (FF2-3, partly FF2-6)

- **The near and middle levels shade with the full head's normals** (8,572 triangles) at their own vertices, not their own decimated ones.
- **The same goes for the components' and the expressions' normal changes:**
  - the mean face and the components are spread to the full head's other vertices by inverse distance from the six nearest kept ones;
  - the expressions are known on the full head.
- **The far level keeps its own normals.** The full head's pinwheeled round its nose at 90 triangles.
- **Result** (`a2/C2-seats-3b-close` against `b0/`): the cheeks and the jaw are smooth. The jaw's outline is still the 400-triangle silhouette.

### Before and after

- **`X1`** (the Cast, near): the young woman's blink now shuts her lids. The old man's open mouth is a dropped jaw (it was a painted moustache).
- **`X3`:** the bald man shouting: the jaw dropped and the chin longer, the lips parted.
- **`E2`** (strike three + 9 s, 3 m): open mouths, smiles, the lids narrowed; it was a row of blank faces with black O's.
- **`E3`:** the Diamond Club rows open-mouthed and smiling at the celebration.
- **`C2`:** a faint smile, the lids at rest, smooth shading.
- **Against Getty 83893023:** the open jaws and the smiles' raised cheeks now read; most eyes are half-lidded, as in the photo.

## Partly, and not done

- **The open mouth's inside on the middle level** (the seats' close level, the Cast's middle figure) is mostly unmarked: it's dark only round the middle of the lips, and the floor of the mouth shows as pale skin.
  - On the Cast's near figure (1,200 triangles) the floor of the mouth is still lit skin-coloured (`a4/X3`). It reads as a pale tongue.
  - A better fix: a few interior vertices kept at each level (locked like the landmarks), or the mouth's floor marked by its normal.
- **The chin on the collar (FF2-8):** not changed. The open jaw drops the chin about 3 cm, and at the celebration it can touch a zipped collar. That's true to life, but a hood's or a scarf's geometry may show it.
- **The 90-triangle head's mouth** opens with the jaw, but its paint is the old growing ellipse.
- **The players sharing the fans' blend shapes** (task 3): not started.

## The counts

`JSON.stringify( __app.engine.meshRenderer.stats )`, full park, 1280 × 800:

| View | Before (`b0`) | After (`a4`) |
|---|---|---|
| The 400s seat behind home (play 60; close 668, near 1,645 fans) | 1,118 draws, 6,167,660 triangles, 769 pipelines | 1,118 draws, 6,167,660 triangles, 769 pipelines |
| TV center (play 20; near 5,434 fans, 123 middle Cast) | 497 draws, 3,589,748 triangles | 497 draws, 3,596,072 triangles (124 Cast) |

No geometry, draws or pipelines were added.

## The frame rate

Not profiled (the coordinator does).

**Vertex stage, the head's vertices only:**
- **The crowd's close level:** one more pose read (`r3`), plus the two expression records. The lids' rest keeps them on, so close up they're always read: 668 × 210 vertices in the 400s view.
- **The crowd's near level:** the pose read always. The two records only while a fan's mouth is open or he's smiling (the cheers): up to 5,434 × 52 vertices at TV center during the celebration.
- **The Cast's near and middle figures:** two records (the lids' rest), plus three `fract`s.

**Compute pass:** about 15 more ALU per fan.

**Fragment:** a few smoothsteps on the close level's head.

**CPU:** none per frame. The build is about 6 s offline.

**Where to watch:** the TV center view at the celebration, and the 400s seat. If either moves, close the lids' rest only on the Cast's near figure and drop it on the crowd's close level (one `#if` in `Crowd.js`). Then the records are read only while a fan is cheering.

## For the merger

**Files:**
- `tools/build-fanhead.mjs`: FF2 blocks, plus the per-level normals and records;
- `src/ballpark/game/data/fanHead.js` (generated: `node tools/build-fanhead.mjs`; it fetches 36 expression targets the first time);
- `src/ballpark/FanHead.js`;
- `src/ballpark/Crowd.js`:
  - the kernel's `faceQ` / `r3.z`;
  - the vertex pre-step;
  - the surface's mouth and eyes;
- `src/ballpark/places/Cast.js`:
  - the vertex FF2 block;
  - `vPart`'s 128;
  - the surface's mouth and eyes.

**Things to keep in mind:**
- **`cwPoseBuf` `r3.z` is now packed:** the mouth in bits 0-5 (/63), the smile in 6-9 (/15), the blink in 10-13 (/15). Anything else that reads the mouth from `r3.z` must decode it: `f32( u32( r3.z + 0.5 ) & 63u ) / 63.0`.
- **`fhBlend` takes a fourth argument** (`vec3f` expressions; zero for none).
- **The Cast's `vPart` has bit 7 set on MakeHuman heads.** Fragment code must mask it with `& 127u` (done for the one read).
- **The fan head's records are 9 vec4u a vertex** (`FAN_HEAD.REC`).
- **`CREDITS.md`'s MakeHuman section** (FF1's) covers the expression targets too: they're the same CC0 release. Not edited.
- **Tests:** `npm test` passes. `node test/continuity.mjs` prints duration 3785.503 and start hash 801248349.

## Noticed elsewhere

- **The hair:** the grey-haired man's hair (`L2`) is a helmet with a hard band at the hairline; the women's bangs are a flat block (FW1's paint).
- **People.js's throng, RailFigures and FieldFigures** still have their own heads (FF1 noted it).
