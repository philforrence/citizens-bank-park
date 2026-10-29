# FX4, step 11 round 1: the seated crowd (hands, arms, mouths, faces, posture, towels, prints)

Fixer FX4, 2026-10-29, branch `worktree-agent-a5a9c930653fd7a34` (off `ballpark` at 077ef2c). One file changed: `src/ballpark/Crowd.js`, in "FX4" blocks.

**The owner:** "continual improvements in realism ... grounded in photos"; "nothing is too small".

## The shots

All in the main checkout, `.claude/gauntlet/s11/r1/FX4/`; full park (no `only=`), 1280 × 800, the replay's clock. **No console errors in any job.**

- **The before:** CR1's own shots (`.claude/gauntlet/s11/r1/CR1/j1`, `j2`, `j3`) are on this branch's code (`ballpark` at 609f71e and 077ef2c differ only in the log). My first job, **`b0/`**, re-shot the ones I lean on at 1280 × 800 (`F14`, `F05`, `F09`, `R3`, SC1's `s21`) with the stats.
- **`a1/`:** the first pass. **`a2/`:** the last job, on the final code: every after shot by CR1's names, TV center (`T1-tv-center`) and the 400s seat (`S0-400s-seat`, `look [[0,34.69,58.92],[0,0,-30],60]`, play 60) with the stats.
- **Crops** (ffmpeg) in `crops/`:
  - `b0-f14-hands.png` against `a1-f14-hands.png` (the hands);
  - `k8-mouth-before-after.png` (an open mouth, CR1's `j2/K8` against `a2/K8`);
  - `l1-towels-before-after.png` (the arms over a section, `j2/L1` against `a2/L1`);
  - `a2-k3.png`, `a2-k8-faces.png`, `a2-k4.png`, `a1-k8-faces.png`.
- **The generator:** `/private/tmp/claude-501/-Users-phillipforrence-citizens-bank-park/4f4e82b4-ef9f-4fa0-a3f9-d023a05012fe/scratchpad/fx4/mkjob.mjs` (CR1's page helpers and framings by the same names: `node mkjob.mjs <tag> <shot,shot>`). `geo.mjs` beside it builds the five levels in Node and counts them.
- **References:** Getty 83486358 and 83486360 (the rail at the last out), 112874141 (strike three from the plate), 112874578 (the towels), 83457911 and brownwall 2981780425 (the rain), as CR1 listed them in `.claude/ref/gauntlet/people11/SOURCES.md`. Nothing new downloaded.
- **Some framings found a different fan.** `CP.findWho` picks the nearest fan who passes a test, and with the arms' new ways and the glasses' new rate it can land on someone else or behind an arm. `K2` frames a raised arm now, `K7` a different man in glasses; `K2b` is a second woman's framing.

## What I did, ticket by ticket

### 1. CR1-2 + SC1-2, hands and raised arms: done

**The hand** (`fanGeometry`'s `hand()`) is laid along the wrist's segment in every pose, in the frame the tubes' rings use: x across, y along, z the back of the hand, so the palm faces -z.
- **Close:** a palm (wider over the knuckles than at the wrist, its front shut), the thumb from the palm's side by the wrist, the index finger, and the other three as one block (its gaps painted, the little finger's side shorter). Each finger is three rings of four (the knuckle, the middle joint, short of the tip) and a tip. 48 vertices a hand; the mitten was 17.
- **Near** (FOX's backdrop, SC1's raised arms a few rows off): a palm, one block of four fingers and a stub of a thumb. 27 a hand; it was 9.
- **What each vertex keeps:**
  - its finger in `aInfo.z` (1 the thumb, 2 the index, 3 the block, 4 near's block; 0 the palm);
  - its joint in `aInfo.w` (0 the knuckle, 1 the middle joint, 2 the tip);
  - where it is across the block in `aInfo.y` (for the gaps).
- **It's laid in its resting curl** (`HAND_REST`: the fingers loosely curled, the thumb a third of the way across). So the shaders turn the fingers only for a raised hand, one at the face, or the left one round a cup or a camera; at rest the hands cost only their vertices.

**The hand's shapes** (`cwVertex`, the FX4 block after FC4's normals):
- `cwHand( k )` gives the index's curl at its knuckle and middle joint, and the block's; `cwThumb( k )` how far the thumb has come across the palm.
- The shapes: 0 a fist, 1 the index up ("number one"), 2 open, 3 a grip (a towel's corner, the cup), 4 at rest, 5 at the face (clapping, praying).
- The shape is mixed from the rest's to his raised shape by `aU`, then to the face's by `aF`. Each finger turns about its middle joint (where the rest left it), then about its knuckle; the thumb turns about its root (`cwTurn`).
- Near, "number one" narrows the block of four to the index's width and keeps it straight.

**The arms' ways** (`ARM_VARS`, `cwArmVar`):
- 0 straight up (as it was); 1 the elbow out and bent, the fist up (a fist pump, and the towel swung); 2 out toward the field (pointing); 3 the hands together over the head.
- The upper arm, the forearm and the hand are each turned onto the variant about their joint, as far as the arm is up. The far levels' arm (one tube from the shoulder to the wrist) turns as a whole.
- The bones keep STAND_UP's lengths from the same shoulder.
- **The towel's spin follows the right hand** wherever its arm is; it was pinned to where the straight arm's hand had been.

**Who does what** (the kernel):
- **The game's moments:** each fan his own arms and hands, from his seed:
  - each arm 30% straight, 40% bent, 30% out at the field; 14% put both hands over the head;
  - each hand a fist 40%, the index 25%, open 30%, a grip 5%;
  - about a third put up only the right arm.
- **The celebration:** a new pair with each act (FS1's `cyc`):
  - both arms up (16% over the head, 25% one arm only);
  - the towel swung from a bent arm, in a grip;
  - the fist pumped, bent or pointing out;
  - the turn's arm pointing with the index;
  - the head's, the camera's and the clap's acts no variant, the hands open;
  - in a hug the arm round the neighbour as it was, its hand open.
- **Held straight** for a sign over the head and an umbrella. The left arm is left alone while it holds a cup or a camera (the prop sits at the hand's joint).
- **Packed in `r4.w` bits 16-23:** the two arms' ways and the two hands' shapes, 2 bits each (float32 holds 24 bits exactly).

**Gloves** (the crowd's own 30%): black, charcoal and grey knit, navy, the odd red, brown leather with its sheen. Bare hands have the knuckles and the fingers' ends redder with the cold, and the block's gaps shaded.

**Before and after:**
- `b0/F14-29-k3-hands` against `a2/F14` (crops `b0-f14-hands.png`, `a1-f14-hands.png`): skin-coloured blocks become hands, fists, an index up, open hands seen from behind.
- `K8`: gloved fists, a bent arm.
- SC1's `s21`: the arms ended in pencil points; now hands and black gloves.
- `L1`: the arms over a section at every angle, where `j2/L1` was a field of the same straight pole.
- **Against Getty 83486358:** the fingers up, the open hands and the gloves read now. Still short of it: no knuckles' detail, no spread fingers, every thumb the same length.

### 2. CR1-3, the open mouth's inside: done (the paint and the vertex stage, no rebuild)

- **The mark on the inner faces too** (the vertex pre-step):
  - As the jaw drops, the head's vertices in the mouth's region whose own normal turns up, down or back into the head take the inside's mark (`d.z` -1.9).
  - It's the face's normal before the jaw (`v.normal`). The first pass (`a1/`) used the blended normal, and the dropped jaw had turned the lower lip's inner face forward, so it missed.
  - Before, the mark was on only a few of the bag's vertices at these levels: the lower lip's inner face and the mouth's floor showed lit and pale, and the inner rims at the corners caught the light (CR1's "fangs").
- **The paint** (the close and near mouth):
  - dark from the inner rims in (the mark's edge earlier and sharper);
  - the upper teeth a narrow ivory band right under the upper lip, between the canines (`ax < 0.1`), darker in the mouth's shade and toward the sides;
  - the tongue a dark red, low in the opening;
  - the inside's specular cut to 15% (the teeth keep a little), its roughness up.
- **The women's lips are their own:** a rose, a berry, or bare.
- **Before and after:** CR1's `j1/F09`, `j2/K3`, `K8` against `a2/` (`k8-mouth-before-after.png`, `a2-k3.png`).
  - The cavity is dark, and the fangs and the white crescent are gone.
  - At 400 triangles the dropped lower lip still shows as a pale wedge under the dark (it is the lip, and its few vertices make it a wedge).
- **FX1's note** (the coordinator's): the builder's `mouthIn` flags only the front of the cavity. I didn't rebuild `fanHead.js`: a rebuild rewrites every face's data, and the MakeHuman cache is in FF3's worktree. The vertex-stage mark does that job at run time. If the Cast's near figure (1,200 triangles) still shows a pale mouth, marking the whole bag in `build-fanhead.mjs` is the deeper fix, and the Cast's paint (not my file) would want the same teeth and specular change.

### 3. CR1-4, one shared face paint: done

- **Brows:** his own, from his seed. It was one straight 7 mm bar, black on dark hair.
  - From the head by the nose to a tail over the eye's corner.
  - An arch of his own (the women's higher and thinner), his own lift, thicker at the head and tapering.
  - Broken into hairs slanting out.
  - A shade off his hair's colour; the fair and the grey fainter.
- **Glasses:** five 2008 styles.
  - A narrow metal rectangle (silver or gunmetal), rimless (the bridge, the hinges, a glint at the lenses' edge), a black plastic rectangle, an old man's gold oval, and wraparound sunglasses pushed up on a bare head.
  - Thin; the arms painted back to the ears, so a profile shows them; the lenses glossy.
  - **The rate** (`randomFan`): 11% of adults, 35% of the old, 5% of kids. It was 20%, 55% and 8% (24% of the crowd). `r()` is still called once, so the rest of the crowd is who it was.
- **The hairline:** soft over a few millimetres and broken strand by strand.
  - The jitter fades where a pixel is wider than a strand.
  - The temples recede his own way on two men in three, a widow's peak on one in eight, the old's higher; a grain across the hair.
  - The women's cuts and the ponytail use the same jittered edge, and so does the nape from behind (CR1-8).
- **Before and after:** `K7` (a round black wire frame becomes a thin rectangle), `K8`, `F14`.

### 4. CR1-11, expressions that fit the moment: done, within the three expressions there are, and the paint

- **A frown is new:** the brows drawn down and together, a crease between them, in the paint. It's packed in `r3.z` bits 14-17. The lids' narrowing rides in the blink's 4 bits (the larger of the blink and the squint).
- **The celebration:** each act its own face, by the act's hash. It was `smile ≥ 0.55` for everyone, and the jaw down on four fans in five at once.
  - A shout 30% (the jaw down, the eyes screwed up, the brows down), a laugh 25%, a closed grin 15%, an O of disbelief 10%, overcome 8%, blank 12%.
  - Blank behind a camera; laughing in a hug.
  - More grins and talk as it goes on, and a half-open smile between acts.
- **The 27th's rain** is grim: smiles cut by 92% (a run brings some back), one in twelve still smiling. The brows are down, and the lids narrowed into the rain.
- **Tension** (two strikes, two outs, late): no smile, the brows together, three fans in ten shouting now and then.
- **The Rays' few** at the celebration: their faces set.
- **Before and after:** `K8` (the row at 3 m, K + 75: one jaw-dropped grin across the row becomes shouts, grins and closed mouths), `E1` (the last pitch), `F03`, `R1`, `R2` (the rain: `a2/R2`'s hooded woman squints, her lids narrowed; her mouth's resting line, the head's own, still reads a little like a smile, `crops/a2-r2-k4.png`).
- **Not done:** new MakeHuman units (a pucker for the O, the brows down in the geometry). They need `build-fanhead.mjs` and a fourth expression record.

### 5. CR1-10, who they are: partly (the paint; the head shapes not rebuilt)

- **Done, the women:** the brows thinner and arched, a darker lash line (mascara and liner; the men's lighter), lip colour by her seed.
- **Done, the old:** the folds from the nose to the mouth's corners, crow's feet, the lines across the brow, bags under the eyes, the skin a little ruddier and blotchier. A third as much for some of the older adults.
- **The girl with stubble (K4): not fixed.** It isn't the beard's stubble shading, which needs `! female`. `a2/K4` (`crops/a2-r2-k4.png`, right) still has the dark round the mouth and the jaw. My guess is the 400-triangle head's long triangles from the lips to the chin, in shade under the top light on a darker skin, with the mouth's mark at their inner ends. It wants a look at those triangles (FF1's offline viewer, `view.mjs`), or the close-level head swap (CR1-17).
- **Not done:**
  - the female and old macros' own shapes in `build-fanhead.mjs` (a rebuild of every face), so the women's heavier jaws and the heavy men's lean faces stay;
  - a ponytail out of the back of a cap.

### 6. CR1-8 and CR1-9, from your seat: partly

- **Done:**
  - the hairline and the nape broken (3);
  - under a hood the neck is in the hood (its cloth, or the skin through the clear film);
  - the hood's lowest part (the MakeHuman head's neck) drapes out and down to the collar, instead of ending in a step over bare neck;
  - the hood's opening stands proud of the face in a rolled hem, with the hood's own shade on the face inside the rim. It was a mask set flush in a bag.
- **Not done:** the long hair's ragged mesh ends (`P.hair`), the knit hat's rim, the ponchos' sleeves (one cone from the shoulders with the arms inside).

### 7. CR1-19, seated: done

- **How he sits goes with his hands** (the kernel): hands clasped between the knees lean forward 0.2-0.38 rad (elbows on the knees), arms folded sit back a little, one in seven slouches. The rain's hunch is as it was (with more folded arms in the rain).
- **The forearms on the lap**, each their own way: FW1's turn now runs for the lap's hands too (`cwVertex`). The hands are back by the hips or out on the knees, the forearms sloped. Not the left hand while it holds a cup.
- **Before and after:** `R3`, `R4` (a row seen along its length: level forearms and brick hands).
- **Not done:** a hand on a neighbour's shoulder outside the celebration's hugs; legs crossed.

### 8. CR1-18, the towels: partly

- **Close up, 5 × 5 points** (it was 3 × 3): the cloth sags at its loose end under the turn, a wave runs down it from the fist, and its loose corners curl in. Near keeps 3 × 3, with the same sag.
- **Terry:** soft folds in its shading, and the loops' fine grain (faded with the pixel's size).
- **Before and after:** `K8`, `L1`. It's softer and it hangs, but at 3-6 m a twirled towel still reads as a sheet more than as terry. The normals don't follow the deformed cloth (they would need the neighbours' positions), and that's the next step.

### 9. CR1-7, the torsos: partly

- **Done, the prints**, from the Cast's chest prints in the atlas the crowd already binds (`cwAtlas`, cells 64 on). Close and near only.
  - The home whites: the red script across the chest.
  - Half the red and grey sweatshirts, hoodies and tees: the white script (18%), PHILLIES (9%), 2008 NATIONAL LEAGUE CHAMPIONS (13%), the 2008 World Series (8%, gold on red), RED OCTOBER or EAGLES (5%).
  - It shows through a clear poncho; a coloured poncho has none.
  - Faded to a faint tint where a pixel spans a stroke (FW6's way).
  - Seen in `a2/K8` (PHILLIES, RED OCTOBER, the script on the whites) and `a2/K3`.
- **Not done:** folds (FY3's fold normals), the shoulders from behind (the arms' balls), the jackets' small chest logos.

### 10. CR1-17, the close heads at arm's length: not done

A sixth level with the 1,200-triangle head for the nearest chunks is the fix. It adds ~400 blended vertices a fan in those chunks and a level to `lod()`, and I ran out of time to do it safely. Skin detail (pores, a stubble grain, cold redness by the night) is not done either.

## The counts

`JSON.stringify( __app.engine.meshRenderer.stats )`, full park, 1280 × 800, read in each shot's js after 6 frames (`b0` → `a2`):

| View | Before (`b0`) | After (`a2`) |
|---|---|---|
| The 400s seat behind home (play 60; close 672, near 1,648 fans) | 1,124 draws, 6,217,144 triangles, 783 pipelines | 1,124 draws, 6,329,176 triangles (+1.8%), 783 pipelines |
| TV center (play 60; near 5,634 fans) | 497 draws, 3,697,855 triangles | 497 draws, 3,736,361 triangles (+1.0%) |
| F14's view, strike three + 5.5 s (close 1,720, near 3,735) | 499 draws, 4,520,863 triangles | 499 draws, 4,712,688 triangles (+4.2%) |

**Per figure** (`geo.mjs`, vertices / triangles):
- the close level: 684 / 1,100 → 766 / 1,220 (the hands +62 vertices, the towel +16);
- the near level: 199 / 270 → 239 / 320 (the hands +36);
- middle, far and distant unchanged.

No draws, pipelines, materials or buffers were added.

## The frame rate

Not profiled (the coordinator does).

- **Vertex stage:**
  - **Geometry:** +62 vertices a close fan, +36 a near fan. Every vertex runs `cwVertex` (twice on these levels, for the motion vectors), so this is the main cost: in the 400s seat ~42k + 59k more vertices; at TV center ~203k more (the near level's hands).
  - **The finger curl** (a frame from the arm's joints, two sin/cos, ~40 ALU) runs only for hands that are raised, at the face or round a cup. At rest the curl is baked into the geometry.
  - **The arms' variants** (four joints and three `cwTurn`s) run only for raised arms with a variant on.
  - **The mouth's mark:** four smoothsteps a head vertex on the close and near levels.
- **Kernel:** a few hashes and selects a fan for the arms, hands and faces (two `cwRand4`s).
- **Fragment:**
  - the brows, the lash line, the old's lines and the glasses' rounded rectangle: a few dozen ALU on the close and near heads' pixels;
  - the hairline's noise on every head pixel at every level (two sin products);
  - the chest print: one atlas sample on the trunk's front pixels, close and near only;
  - the towel's terry: a normal tilt and a few sins.
- **CPU:** none per frame.
- **Where to watch:**
  - **TV center** (the near level's hands: +18% vertices on that level).
  - **The 400s seat** (it was 27.1 ms).
  - **If TV center moves, cut the near hand back:** drop the thumb's stub and the block's middle ring (`hand( s, false )`). That's ~15 vertices a hand back.
  - **If the 400s seat moves,** the hairline's noise can be gated to the close and near levels (`#if CROWD_LOD <= 1`).

## For the merger

- **One file: `src/ballpark/Crowd.js`.** Every change is in an "FX4" block. The parts:
  - `ARM_VARS`, `HAND_REST` and the `THUMB_*` constants after `POSES`;
  - `hand()` in `fanGeometry`, replacing the hand tube;
  - the towel's grid;
  - in the kernel: the arms', hands' and faces' choices, the posture by the hands, the expressions' block, and the `r4.w` and `r3.z` packing;
  - in `crowdModule`: `cwArmVar`, `cwHand`, `cwThumb`;
  - in `cwVertex`: the curl and the variants after FC4's normals (`vid` is now declared there, before FW1's block), FW1's lap turn now for the lap's hands too, the towel's hand, the hood's hem and drape;
  - the vertex pre-step's mouth mark;
  - in the surface: the hands, the chest prints, the hooded neck, the brows, lashes and the old's lines, the mouth, the glasses, the hairline, the hood's inner shade, the towel's terry;
  - `randomFan`'s glasses rate.
- **Per-fan data layout: unchanged.** I used only spare bits:
  - `r4.w` bits 16-23 (the arms' ways and the hands' shapes);
  - `r3.z` bits 14-17 (the frown). Anything that reads the mouth from `r3.z` must still mask `& 63u`.
  - `POSE_N` is still 5, so FX2's block reading a fan's stand weight from `cwPoseBuf[ fan * 10 ].x` is unaffected.
- **FX1's pompom blocks:** I didn't touch the pompom's geometry, its vertex block or its paint. My edits near them are the hood's (`cwVertex`) and the hair's (the surface, before the cap): separate hunks.
- **The hand's `aInfo` changed meaning:** z is the finger, w the joint, y across the block (it was t, a, b round a tube). Nothing else reads a hand's `aInfo` but FW1's lap turn and FC4's normals, and both still work.
- **Not touched:** `FanHead.js`, `tools/build-fanhead.mjs`, `game/data/fanHead.js`, `places/Cast.js`, `People.js`.
- **Tests:** `npm test` passes. `node test/continuity.mjs`: duration 3785.503, start hash 801248349.

## Noticed elsewhere

- **The Cast's mouths** (`places/Cast.js`, the same FF2 paint) will have the same pale floor and bright teeth as the crowd's had. They want the same treatment (the inner mark by the face's normal, the narrow teeth, the cut specular). Not my file.
- **The cold-cheek blush** (FF1's) reads as two round pink spots on pale faces at 1-2 m (`a1/F14`'s capped man).
- **The 400-triangle head's lower lip,** dropped open, is a pale wedge (the mesh). The close-level head swap (CR1-17) would fix it with the rest.
