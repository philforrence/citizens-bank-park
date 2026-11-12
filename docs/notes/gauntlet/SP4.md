# SP4: the speed track, step 12 round 1

Branch `worktree-agent-a1e062b292aa8d7ad`, off `ballpark` at step 12's plan (159da9d). The goal: the real 400s seat at 26 ms or better (28.9 on step 11) and left field at 24 or better (28.0), nothing visibly different, then the next biggest cost in any standard view. The coordinator stopped the round early (the usage limit at ~09:40), so this is what got done by 09:20.

How I measured:
- Exclusive desk jobs at 1280 × 800, the full park, in `.claude/gauntlet/perf/`: `sp4-a` (where the time goes, step 11's code), `sp4-b` (the A/Bs and the diagnostics), `sp4-f` (the standard views at the end, and the Escalator's A/B).
- Every A/B in one page, interleaved three times, **every changed pipeline compiled before it was timed** (`GPU.pipelinesReady()`, SP3's lesson).
- The machine was warm all morning (TAAU 1.9 in the first shot of `sp4-a`, 2.0-3.3 in `sp4-b`, against 1.8-1.9 when it's steady). The differences between interleaved pairs held. The absolute numbers are a little high.
- Looks: ordinary PNG jobs (`sp4-b`'s triplets, `sp4-e`), diffed with a small PNG reader in the scratchpad (`sp4/png.mjs`): each change against the same state shot twice.
- Scripts: the scratchpad's `sp4/` (`helper.js`: tally, A/B, breakdown; `mkjob.mjs`, `shots-*.mjs`, `show.py`, `diff.py`, `png.mjs`).

## The changes

### 1. Each fan at his own level near a level's edge (fd0f686)

**The cause.** A crowd piece (120 fans) took its level from its nearest point, and a piece's rows run a long way round the bowl. From the 400s seat (`sp4-b`, fans at each level, by piece → by fan):

| Level | By piece | By fan |
|---|---|---|
| Close (1,340 triangles, the pose run twice) | 672 fans, 1.8-59.8 m | 408 fans, 1.8-9.5 m |
| Near (320) | 1,648 | 863 |
| Middle (124) | 7,197 | 8,246 |

From TV high, the close level went from 1,419 fans (out to 51 m) to 258 (out to 14 m). TV center has no close level (the long lens), and its near level went from 5,634 fans to 3,589.

**The change:**
- `MeshRenderer`: an instanced mesh may carry `instanceRanges` (a `Uint32Array` of first, count pairs) and `instanceRangeCount`. It's then drawn as one draw per run, with `firstInstance`. WGSL's `instance_index` includes `firstInstance`, so the crowd's fan index (`draw.params.y + instance`) is right.
- `Crowd.lod()`: a piece at the close or near level whose farthest point is over that level's edge goes through `_split()`. Each fan is measured as lod() measures a piece (his own sphere about his seat). Those within the edge are drawn at the level, the rest at the next one, as runs (the pieces are in rows, so a run is a row's stretch).
- Nobody is drawn coarser than the thresholds ask for. A fan in a close piece who's past the near edge too stays at near.
- `crowd.fanLod = false` brings back the old way, for an A/B.

**Same page, by piece → by fan** (`sp4-b`, opaque / GPU ms):

| View | Saved |
|---|---|
| 400s seat | **1.45 / 1.71** |
| Left field | 1.28 / 1.07 |
| TV high | 1.04 / 0.71 |
| TV center | 0.41 / 0.83 |

**Looks** (`sp4-b`'s `p-*-off / on / off2` PNGs): by fan differs from by piece no more than by piece from itself. Mean |d| over the near rows: the 400s 1.47 against 1.75; TV high 0.69 against 0.70; TV center 1.79 against 1.80. In the crops of the 400s rows 7-20 m off, the differences are the hair's and the knit's temporal grain and the fans' sway, as between two shots of one state.

**Draws:** a split piece is one draw per run, a few dozen more in all.

### 2. The crowd's arm and hand shapes as uniform arrays (40a944c)

`cwArmVar` (the raised arms' four ways, FX4), `cwHand` and `cwThumb` built their tables as function-scope arrays: six arrays of vec3s and two more, in each vertex's registers, indexed by a runtime value. They're called on every finger vertex several times over (close and near, twice for the motion vectors), and on every raised arm's and towel's vertex at every level. They're now the crowd material's uniform arrays `cwArmJ` and `cwHandK` (`ARM_U`, `HAND_U`), the same values as the literals, rounded as `f3` rounds them.

**Same page, uniform → register arrays** (`sp4-b`, opaque / GPU ms; pairs in brackets):

| View | Cost of the register arrays |
|---|---|
| 400s seat | **+1.78** / +2.59 (+1.4, +2.8, +1.2) |
| TV center | +1.08 / +1.39 (+1.3, +0.9, +1.0) |
| Left field | +0.38 / −0.18 (noise) |
| TV high | +0.12 / +0.33 (noise) |

**Looks:** the same numbers. `sp4-e`'s 400s PNGs, old against new: mean |d| 3.61 against the noise floor's 4.79 (new against new, later).

### 3. Left field's Kit palette as a uniform array (ae68a60)

The left field corner's Kit material covers everything the Kit builds: Harry's, the Porch, Monty's, the ramp, the plaza, and FX3's back bars with their ~700 bottles. It built its 68-entry palette (albedo, roughness and metalness, glow) as three function-scope arrays in every pixel and indexed them there. This is SP1's find in `inside/Kit.js`, here. It's now one uniform array `lfPal`, the same values rounded as the literals were.

**Same page, uniform → register arrays** (`sp4-b`, opaque / GPU ms):

| View | Cost of the register arrays |
|---|---|
| Left field | **+5.28 / +4.81** (23.1, 24.2, 22.7 → 28.3, 28.5, 28.9) |
| Harry's upstairs looking out | +2.77 / +3.90 |
| 400s seat | +0.14 / +0.20 (noise) |

In `sp4-a` (step 11's code), hiding the Kit's mesh was −5.0 ms in left field and −2.5 upstairs: the biggest single cost in left field. The back bars use the Kit's material, so their bottles' pixels got cheaper too.

**Looks:** the same numbers. `sp4-e`, old against new: left field mean |d| 1.06 (noise floor 1.83), upstairs 1.29 (1.17).

## Tried and dropped: the Escalator's palette as a uniform array

The same pattern in `leftfield/Escalator.js` (`lf-escalator`, `lf-plaza-fittings`, 12 entries). In `sp4-f`, uniform → register arrays was +0.08 opaque ms in left field and +0.15 upstairs: noise. Its meshes are small. Not committed.

## Tried and dropped: the Kit in culled pieces (step 10's lead)

The Kit is one mesh with the whole corner's bounds (51k triangles), so it's drawn in every view: in TV center, all 51k of them, out of the frame. I split it by its triangles' centres (a k-d split to under 4,000 triangles or 4 m: 21 pieces, each with its own bounds, culled and occlusion-tested on its own). In TV center only one piece of 2k triangles was left.

But it saved nothing (`sp4-b`, one mesh → pieces, opaque ms):
- 400s +0.66 (pairs +1.1, +0.6, +0.4);
- TV center +0.63 (noise);
- left field +0.21;
- upstairs +0.37.

Out of the frame, the Kit's triangles are cut before any pixel is shaded, so they cost almost nothing. What it cost in every view was its pixels' palette (change 3). The pieces add 21 draws and up to 21 occlusion queries. Not kept: one mesh, as it was.

## FX3's +137k triangles in TV center

There aren't any. Under the lock, the same moment (play 20, TV center), one frame's triangles by pass, object and material:
- pre-FX3 (7a3a818, FX4 merged): 2,856,140;
- step 11 (159da9d): 2,863,246.

That's **+7,106 (+0.25%)**:
- the Kit +2,482 (the ramp's fixtures, the elevator's fronts, the sign, the neon backs);
- the concourse's props +2,268 in the opaque pass and +2,268 in the shadow (the stands' backs).

That's what FX3's notes predicted (about 3k and 2.5k). FX3's j1 and j4 were separate unlocked runs. The rest of the +137k was what that moment drew in each: the players' and the cast's levels, and the shadow cascades, which aren't all drawn every frame.

Worth knowing: the Kit's 51k triangles are drawn in TV center although none is in the frame (above: cheap now).

## Where the time goes now

`sp4-a`, step 11's code, the 400s seat (opaque ~23.7 ms with the machine warm), each material hidden in turn, compiled first:

| Hidden | ms |
|---|---|
| The crowd's close level (900k triangles) | −4.1 to −4.4 (now ~1.5 less, change 1) |
| The far and distant levels (1.75M) | −6.0 (−3.6 distant, −2.4 far) |
| The Cast | −2.2 |
| The seats | −2.0 |
| The middle level | −1.1 |
| The near level | −1.1 |

Left field: the Kit −5.0 (change 3), the far and distant levels −6.3, the Cast −2.0, the back bars −1.7, the cars −1.4 (noisy). Upstairs: the distant level −6.4, the Kit −2.5, the Cast −1.9, the seats −1.5.

**The far crowd, taken apart** (`sp4-b`, diagnostic defines on the far and distant levels only, not committed):
- a flat surface (his shirt's colour, nothing else): **−2.2 ms** in the 400s, −1.9 upstairs;
- no pose (every vertex at its sitting place, no `cwVertex`): **−2.5 ms** in the 400s, −2.5 upstairs.

SP3 measured the pose at −0.7 for the same levels before FX4. FX4 gave the far levels' arms their four ways and the towel the hand's place. A SIMD group of 32 vertices spans every part of a fan, so every branch (the arm's turns, the lap, the towel, the head, the lean) runs for every group.

## What I'd do next

In order of win per risk:

1. **The far crowd's pose, per fan in the compute pass (~2.5 ms in the 400s and upstairs).** Most of what `cwVertex` works out per vertex is the fan's, not the vertex's: the head's turn and nod (four cos/sin of `r4.z` and `r1.w`), the raised arm's joints and its two rotations (`cwArmVar( av ) − cwArmVar( 0 )`, the normalizes), the towel's hand, the lap's rotation. Work them out once per fan in the kernel and store them beside the pose (`POSE_N`). Then each vertex is a few mixes and one rotation. It's the same maths, so nothing changes on screen.
2. **The far crowd's surface (~2 ms).** At the far levels a pixel still runs the hair's grain and hairline noise (six sines) and other patterns that `hfine` or `fwidth` fade to nothing there. Skip them with a branch where the fade is 0. That's exact.
3. **The other function-scope palette arrays**, the same pattern as the Kit's, which was 5 ms in left field. They're in other fixers' files, so I didn't touch them:
   - `Concourse.js:212`;
   - `ConcourseSteel.js:35` (FK1's this round);
   - `Concourse3BProps.js:226`;
   - `concourse1b/Prints.js:628`;
   - `home/Build.js:86`;
   - `FanHead.js:228-239`, `fhCoefs()`: not per fan as it looks. The Cast calls it for **every head vertex** of its near and middle figures (`Cast.js:1730`). That's four register arrays (`ETH` 8, `WT` 4, `LA` and `LB` 8 vec4s each), then a loop of 8 with four hashes each, all for numbers that are the figure's. Work them out once per figure (the Cast's look buffer), or at least make the arrays uniform. This goes in the Cast bundle; the Cast is ~2 ms in the 400s.
   
   Each is a uniform array with the same values. Measure each: the Kit's was per pixel over a whole corner.
4. **The close level is still 408 fans in the 400s** (547k triangles, the pose twice). SP3's lead on the second `cwVertex` (the motion vectors) stands.
5. **The cars** (`gate3b/Cars.js`): 161k triangles drawn in every view, because `frustumCulled = false` and the bounding sphere (260 m) contains every camera. In left field, hiding the sedans read −1.4 ms (noisy). Per-street bounds, or `occlusionBox`, would let them cull behind the stands.
6. SP3's leads 1-4 (the figures, a speck level, the banks' light per fan, the moon's shadow) all still stand.

## The numbers at the end

The standard views on this branch (`sp4-f`, exclusive, 09:10, TAAU 1.87-2.01), with two references:
- **step 11 as published** (`s11-final`, 10-29, steady, TAAU 1.78-1.93);
- **this morning's start** (`s12-start`, the same code as step 11, TAAU 1.88-2.47: warm, and slower all round).

Wall / opaque ms:

| View | Step 11 (10-29) | Today's start | **SP4** |
|---|---|---|---|
| **Left field, Harry's** | 27.95 / 21.67 | 31.97 | **22.66** / 15.42 |
| **400s seat** | 28.92 / 22.23 | 38.21 | **28.84** / 21.18 |
| Harry's upstairs looking out | 23.78 / 16.71 | 32.78 | 23.82 / 15.46 |
| TV center | 20.11 / 12.51 | 23.22 | 22.22 / 13.26 |
| TV high | 21.82 / 14.12 | 23.34 | 20.24 / 13.02 |
| TV follow | 16.04 / 9.17 | 17.04 | 16.23 / 9.25 |
| 3B concourse | 16.98 / 9.78 | 18.39 | 16.51 / 9.43 |
| 3B field seat (the lounge) | 15.25 / 7.80 | 16.23 | 13.88 / 6.50 |
| Upper seat behind home | 18.62 / 11.14 | 19.56 | 16.91 / 9.97 |
| Rain TV high | 21.84 / 13.86 | 23.71 | 21.16 / 12.87 |
| A real 3B field seat | 21.83 / 15.27 | 24.36 | 21.11 / 13.87 |
| 3B plaza | 17.80 / 10.10 | 20.72 | 19.02 / 10.51 |
| Celebration TV high | 21.23 / 14.41 | 25.70 | 21.32 / 14.04 |
| Celebration TV center | 21.57 / 14.50 | 26.55 | 21.71 / 14.12 |

- **Left field made its target:** 22.7 ms against 24. Every view is 34 fps or better, and the worst is the 400s at 28.8 ms.
- **The 400s didn't, in this run.** Its opaque pass is 1.05 ms under step 11's, against the 3.2 ms the same-page A/Bs give (changes 1 and 2). The upstairs view is the same: 1.25 under, against the Kit's 2.8.
- **Runs on different days don't compare well.** This morning's start is slower than step 11 in every view, those this branch can't touch included (the 3B concourse +1.4). This run is faster than this morning's in all of them.
- So the A/Bs above are the like-for-like numbers. The standard views' play moments also differ from the A/Bs' held frames.
- **For the coordinator:** run `perf.sh` on `ballpark` and on this branch back to back, on a cool machine. If the 400s is still over 26, A/B `__app.bowl.crowd.fanLod = false` under play.
- **TV center** (22.2 against 20.1 on 10-29, 23.2 this morning) is the one view to watch. Its A/Bs say both crowd changes help there (−0.4 and −1.1 opaque), but it has the most split pieces: a long lens puts the near level's edge across many of them.
- No console errors.

## What the merger must know

- **Files:**
  - `src/engine/render/MeshRenderer.js`: `drawItems()` draws `instanceRanges` (one marked block);
  - `src/ballpark/Crowd.js`: `lod()` and `_split()`, `fanLod`; the uniform arrays `cwArmJ` / `cwHandK` (`ARM_U`, `HAND_U`) and the three functions that read them. Vertex and LOD path only: the look is FX4's;
  - `src/ballpark/places/leftfield/Kit.js`: the palette uniform `lfPal`.
  - Every block is marked `---- SP4`. No other fixer's files were touched. `LeftField.js` and `Escalator.js` are unchanged in the end (both tries were dropped).
- **`instanceRanges` is general.** Any instanced mesh can set it. The ranges are absolute instance indices, and a shader that indexes per-instance storage by `instance_index` gets the absolute index. Leave `instanceRangeCount` at 0 to draw everything. The crowd resets it every frame in `lod()`.
- **Anything that walks a crowd piece's levels** (`ch.lods`) should know two levels can be visible at once now, each with its ranges.
- `npm test` passes; `node test/continuity.mjs`: start hash 801248349, duration 3785.503.
