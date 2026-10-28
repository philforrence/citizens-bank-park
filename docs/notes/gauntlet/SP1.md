# SP1: the speed track (gauntlet round 1)

Branch `worktree-agent-a2fe1c22cb1802c68`, off `ballpark`, with FP1, FY2 and FI2 merged in as they landed. The goal: win back frame time, without cutting detail, so the fixers' detail has room under the 30 fps floor (33.3 ms at 1280 × 800).

## What the GPU is doing

The GPU is an Apple M2: tile-based, with hidden surface removal (HSR). That one fact explains most of what I found.

- **A hidden pixel is nearly free, but a hidden triangle costs as much as a visible one.** Every vertex is shaded and binned before the tiles are rasterized.
  - The opaque pass was mostly geometry: at half the internal resolution, TV high's opaque only fell from 17.7 to 13.7 ms.
  - In TV high the crowd was 4.4M of 6.8M triangles; 3M of those were near-level fans. The players were 1.14M more, in one draw.
  - From the 3B concourse, 5.8M crowd triangles and the players were drawn behind a wall.
- **A `discard` anywhere in a shader turns HSR off for everything drawn with it.** Every surface behind another gets shaded.
  - That is what made FI2's lounge cost ~9 ms for 16k triangles.

How I measured: one desk job under exclusive about every 20 minutes, `__qa.profile( { frames: 90, warm: 30 } )`, 1280 × 800, the full park.
- Where a change can be switched at runtime, its A/B is in the same page: occlusion off, the players' bounds off, the seats non-indexed, the players' slots unpacked.
- To find the costs, things were hidden one at a time: each top material through `material.visible`, each place through its group, Under.js's parts through their materials. The scripts are in the scratchpad (`breakdown.js`, `ab.js`, `ab2.js`, `places.js`).

## The changes

### 1. Occlusion culling (12bae01)

New engine file: `engine/render/Occlusion.js`, used by `MeshRenderer` when a pass asks with `occlusion: true` (the scene renderer's opaque pass does).

How it works:
- The big objects get a hardware occlusion query: 2,500+ triangles, which means the crowd's pieces, the seat chunks, the players and the cars.
- At the end of the opaque pass, their boxes are drawn against the finished depth: no colour, no depth write, the frame's own jittered projection. Boxes are inflated by 0.3 m, or 1.2 m for instanced meshes (fans stand up and raise their arms beyond their seated bounds).
- An object whose box showed no pixel is skipped in the next frames, and its box is still tested every frame.

It errs on the side of drawing. An object is drawn when:
- it has no result yet, or its result is more than 6 frames old;
- the camera jumped (2.5 m or 12° in a frame, or frames weren't consecutive);
- the camera is in its box, or within 1 m of it;
- its bounds aren't trusted (`frustumCulled = false` without an `occlusionBox`).

The cost: an object coming out from behind a wall appears a frame or two late. At walking speed that's only the sliver that has just come into view.

Checks, all identical apart from what moves (walkers, rain, fans' animation):
- the standard views with occlusion on and off, as PNG pairs, diffed;
- a walk out of the concourse and down the upper deck in 3-frame steps.

Switches:
- `?noOcclusion`, or `meshRenderer.occlusionEnabled = false`, turns it off;
- `meshRenderer.stats.occluded` counts what it dropped;
- per object: `occlusion = false`, `occlusionBox` (a local Box3), `occlusionMargin`.

**The players' bounds** (`BallparkApp._playerBounds()`, a marked SP1 block, called after `players.update()`). The players' instanced mesh had no bounds (`frustumCulled = false`), so it was drawn into every shadow cascade and behind every wall. It now gets a box round the visible players every frame.

Same page, occlusion off → on (wall / opaque ms), before FP1:

| View | Off | On |
|---|---|---|
| 3B concourse | 26.35 / 14.96 | 22.11 / 10.95 |
| 3B seat (under the stands) | 23.10 / 11.84 | 19.90 / 8.54 |
| Upper home | 26.34 / 14.67 | 22.04 / 11.34 |
| Left field | 29.06 / 16.02 | 27.65 / 15.59 |
| TV center | 21.91 / 10.21 | 20.14 / 9.22 |
| TV follow | 20.85 / 10.66 | 19.30 / 9.48 |
| TV high | 24.47 / 12.91 | 24.36 / 12.58 |

After FP1 the 3B concourse went 28.59 → 22.31 and upper home 31.48 → 24.70.

### 2. The stands' chunks by section (f361e95, then ace2dab after FP1)

- **Before:** `Stands.js` cut the seats and fans into runs of 1,500 in the order they were laid. A run straddled two or three sections, 25 to 82 m in radius. The crowd picks its level of detail per chunk by the chunk's nearest point, so TV high drew 3M triangles of near-level fans.
- **Now:** the seats go by whole sections, with neighbours merged up to 900 seats. The crowd cuts each chunk into even pieces of rows, at most 360: FP1's `PIECE`, made even (400 is two of 200, not 360 and 40).
- **Measured:** before FP1, with occlusion off in both:

| View | Opaque before (ms) | Opaque after (ms) |
|---|---|---|
| TV high | 17.79 | 12.89 |
| TV center | 13.16 | 10.21 |
| TV follow | 14.97 | 10.66 |
| 3B concourse | 17.50 | 14.98 |
| 3B seat | 15.19 | 11.80 |
| Upper home | 18.27 | 14.68 |
| Left field | 17.87 | 16.01 |

- **Side effect:** the fans' dress is drawn per chunk, so who sits where is reshuffled. The mix is the same.

### 3. Box culling for the instanced pieces (ace2dab)

`MeshRenderer._inFrustum`, after the sphere test, also tests the world box of objects that have one: an `occlusionBox`, or an instanced mesh's `boundingBox` (the seat chunks, the crowd's pieces, the players).
- Their spheres reach far past them. The players' was a slab 120 m across, so its sphere put a million triangles into every shadow cascade.
- TV high's cascades: 1.27 → 0.80 ms. The players' shadows are as they were.

### 4. The local lights (ace2dab, b6e04fe), both exact

- The Beer–Lambert water term (three `exp` per light per pixel) now runs only where the light's path is under water. On dry land it was `exp( 0 )`.
- A surface turned away from a light no longer evaluates its BRDF (it was multiplied by zero).
- Left field's local-light cost went 3.7 → 3.45 ms.

### 5. The players' visible slots packed (b6e04fe)

- **Before:** `Players.js` drew every slot up to the last visible one. The hidden ones (a runner who scored, a reliever who sat down) were collapsed to a point but still cost 32,500 triangles each: 32 drawn for 24 seen in most views.
- **Now:** everyone's draw takes its slot from `aSlot`, as FY2's costume draw does, with the visible slots packed at the front.
- **Measured:** same page, unpacked → packed, opaque (shadow) ms:

| View | Unpacked | Packed |
|---|---|---|
| TV high | 15.24 (0.86) | 14.62 (0.76) |
| TV follow | 9.95 (1.34) | 9.17 (1.00) |
| Rain TV high | 15.29 | 14.30 |
| Upper home | 13.81 | 12.36 |
| 3B seat | 10.43 | 9.83 |

### 6. The insides' material (a62a3a7)

From the standard "3B field seat" view, which is now inside FI2's Diamond Club lounge under the stands, the walls fill the screen. Hiding the `under-inside` material saved 8.86 ms of an 18.86 ms opaque pass, for 16k triangles. Two causes, both in `places/inside/Kit.js` `insideMaterial`:

- **The palette:** it was built as two function-scope arrays of 58 in every pixel and indexed there. It is now one uniform array (`mat.inPal`).
- **The netting's `discard`:** it was compiled into the one shared material, so HSR was off for every room. The discard is now compiled only with `net: true`, which `Under.js` gives the cages' mesh alone.

The suites and the club use the same material and gain the same way. The images are unchanged:
- the lounge matches the coordinator's after-FI2 shot;
- the cages' netting is still cut away (`.claude/qa/sp1/u1/`).

| View | Wall / opaque before (ms) | After (ms) |
|---|---|---|
| 3B field seat (in the lounge) | 32.09 / 19.71 | 18.84 / 8.11 |
| Batting cages (new view) | n/a | 20.12 / 8.85 |

### Tried and dropped

- **A far seat (4 triangles for 12):** no measurable change (12.89 / 12.91 ms opaque in TV high), so it wasn't kept.
- **Indexing the seats (`geo.js` `indexed()`: 24 vertices a seat, not 36):** −0.25 to −0.55 ms in the walking views. Not applied, because `seatGeometry` is FW1's now. It's a one-line change for them (see below).

## The numbers

Wall ms per frame, exclusive, 1280 × 800.

- "Step 8" is my first job on this branch, the same tree as the coordinator's after-FY1.
- "Coordinator" is the coordinator's run on `ballpark` after FI2 (`after-fi2.out`), without SP1.
- "SP1 final" is this branch after FI2 (job m4).

| View | Step 8 | Coordinator after FI2 | SP1 final | GPU | Opaque |
|---|---|---|---|---|---|
| TV center, the 27th | 24.83 | 21.21 | **21.09** | 17.72 | 10.02 |
| TV high, the 29th | 29.12 | 25.87 | **25.75** | 21.70 | 14.98 |
| TV follow | 25.83 | 20.29 | **18.98** | 15.99 | 9.25 |
| 3B concourse walk | 29.55 | 24.05 | **22.59** | 18.36 | 11.69 |
| 3B field seat (the lounge) | 27.19 | 32.98 | **18.84** | 15.29 | 8.11 |
| Upper seat behind home | 30.10 | 25.23 | **24.94** | 20.12 | 13.22 |
| Left field, Harry's | 30.84 | 30.78 | **30.18** | 25.53 | 18.70 |
| Rain TV high | 30.22 | 27.31 | **26.46** | 22.02 | 14.66 |
| A real 3B field seat | n/a | 25.72 | **24.77** | 20.73 | 13.82 |
| Batting cages | n/a | n/a | **20.12** | 16.66 | 8.85 |

The coordinator's after-FI2 column already includes most of what FP1 itself won. Against the views as they stood before each merge, these changes took off:
- FP1: 2.6 to 8.5 ms;
- FY2: 0.5 to 2.5 ms;
- FI2: 14 ms under the stands.

The worst view is now left field, at 30.2 ms.

## What the merger must know

**Files** (the engine is mine; everything else is a small, marked SP1 block):
- `src/engine/render/Occlusion.js` (new), `MeshRenderer.js`, `SceneRenderer.js`;
- `src/materials/LocalLights.js`;
- `src/ballpark/BallparkApp.js`: the SP1 block `_playerBounds()` and one call after `players.update()`;
- `Stands.js`: the chunk loop;
- `Crowd.js`: `addChunk`'s even pieces;
- `game/Players.js`: `aSlot` on everyone's draw;
- `geo.js`: `indexed()`;
- `places/inside/Kit.js` and `places/Under.js`.

**Overlaps with the new owners.** These were committed before ownership moved:
- FW1: `Crowd.js` `addChunk`, and `Stands.js`'s chunk loop (not `seatGeometry`).
- FB2: `Players.js`, the `drawSlots` / `slotted` lines, and `_playerBounds` in `BallparkApp.js` (not the cameras).

**Occlusion and new objects.**
- A new big object is culled automatically if its bounds are honest.
- One drawn with `frustumCulled = false` (the throng, the Cast, rail figures, people driven by storage buffers) is never culled unless it sets an `occlusionBox`.
- One whose vertex shader moves it beyond its bounds should set `occlusionMargin`, or `occlusion = false`.

**The standard "3B field seat" view** (eye −25, 3, 25) sits under the stands, now inside the lounge. It was under the stands' treads before FI2. The coordinator's `seat-3b-field-real` is the real seat.

**Desk shots:** a shot's `js` runs before its frames, so `meshRenderer.stats` returned from `js` is the previous view's (FI2 noted it too).

**Two quirks seen in passing:**
- From under the stands (before FI2) fans' hands and feet poke through the treads' undersides.
- The CPU side has 700–850 draws, and wall − GPU is 4–5 ms in every view.

## Next: wins in the other fixers' files (not done, numbers measured)

1. **A players LOD (FB2, after its body changes).** Each player is 32,500 triangles (18.5k vertices), 0.7–1.1M a frame. They cost 1.8–2.4 ms of opaque plus ~0.4 ms of shadow in every view, and 2.0 ms in left field where they're ~20 px tall.
   - A decimated body (4–6k triangles) for players under ~60 px tall would work as a second slotted draw.
   - `aSlot` and the packing are in place: give the far draw its own `aSlot` list.
   - That would save ~1.5 ms in the TV views.
2. **A distant crowd level (FW1).** In left field the far level is 1.1–2.0M triangles and 5.1 ms.
   - A fifth level for fans under ~8 px tall (`d` > ~60 in `Crowd.lod()`, about 30–40 triangles), plus the lean and head-turn trigonometry worked out once per fan in the compute pass rather than per vertex, should take 2–3 ms off left field. That is the view nearest the floor now.
3. **Indexed seats (FW1):** `return indexed( g )` at the end of `seatGeometry()` (`geo.js` has it). −0.25 to −0.55 ms in the walking views.
4. **The Cast (FW1):** 1.2–1.9 ms in the walking views (upper home: 380k triangles, 1.95 ms). It draws with `frustumCulled = false`, so occlusion can't drop it. An `occlusionBox` per LOD draw, or per troupe, would let it.
5. **The local lights at night** cost 2–3.5 ms (left field 3.45). Each lit pixel runs the full BRDF for the six banks and up to six lamps. Two options:
   - a per-tile light list, so a pixel only loops over the lamps that reach its tile;
   - the cheap (Lambert) path for the far crowd levels' materials.
6. **TAAU is 1.9 ms in every view.** Most of it is nine `taauLockLuma()` (two `pow` each) per output pixel; that luma could come once per input pixel from the beauty pass.
7. **Other HSR breakers:** `ConcourseSteel.js:306` and `Concourse.js:1183` (a stand's sign) discard in their main materials. They're small (0.1–0.2 ms), but the same fix applies: split the cut-out parts into their own material.
