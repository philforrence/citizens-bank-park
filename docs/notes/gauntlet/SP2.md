# SP2: the speed track, round 2

Branch `worktree-agent-a6292aff4cb835be3`, off `ballpark` at 80bc07d (SP1 merged, before FP2). The coordinator merged all six commits into `ballpark` as they landed (ec464f6: the first four; beec155: the last two); the branch was then fast-forwarded to `ballpark` (8301984) for the last job and these notes. The goal, as SP1's: win back frame time without cutting detail, so the fixers have room under the 30 fps floor (33.3 ms at 1280 × 800).

How I measured:
- Exclusive desk jobs, the standard views, `__qa.profile( { frames: 90, warm: 30 } )`: `.claude/gauntlet/perf/sp2-a` (before anything), `sp2-b`, `sp2-c`, `sp2-d` (last).
- For each change that can be switched at runtime, an A/B in the same page (40-45 frames each), and PNG shot pairs, diffed (`pngdiff.mjs`) and cropped side by side (`crop.mjs`).
- The scripts are in the scratchpad's `sp2/`: `diag.js` (job a), `ab.js` (b), `abc.js` (c), `abd.js` (d), `busy.js`.
- Two shots of the same state differ by animation alone (the crowd, the rain, the walkers): 0.5-1.6 mean, 0.001-3.5% of pixels over 8 levels, by view. Every pair below is within that.

## What costs the time (job a, before)

Same page, things switched off one at a time (opaque ms unless said):

| View | All | Lamps off (banks only) | Every local light off | Players hidden |
|---|---|---|---|---|
| TV high | 18.70 | 18.38 | 16.23 | 16.14 (shadow 0.65 → 0.33) |
| Left field | 19.68 | 18.93 | 16.11 | 17.64 (shadow 0.69 → 0.32) |
| Rain TV high | 18.71 | 18.45 | 16.23 | 16.36 |
| TV center | 11.83 | 11.55 | 10.00 | 9.36 (shadow 0.86 → 0.24) |

- **The local lights are the eight light banks, not the lamps.** The picked twelve are the eight banks (range 380 m, every pixel of the park), the board's light and three concourse domes. The banks cost 1.5-2.8 ms of opaque, the lamps 0.3-0.75. A per-tile list would only cull the lamps, which already stop at their range test; the banks reach every tile. So I didn't build one (see the lights, below, and what's next).
- **The players** cost 2-2.6 ms of opaque and 0.3-0.6 of shadow in every view with the field in it, and on screen they're 8-46 px tall in TV high, rain TV high and left field (12-1092 px in TV center, through FOX's long lens).

## The changes

### 1. The players' far figure (69ae0f7, 5fd3808)

- `tools/build-body-lod.mjs` simplifies the MakeHuman body (`data/body.js`) by quadric-error half-edge collapses (Garland & Heckbert): a vertex is merged into a neighbour and never moves, so the far body is an index list into the body's own vertices (`data/bodyLod.js`). The skinning, the uniform's layout (aField) and the vertex shader's shaping are the same. Open edges and the eyes' rim are kept; a collapse that folds a triangle or breaks the manifold is refused; crossing the arm's or leg's start costs extra.
  - 22,756 → 3,800 triangles. Distance from the full body: mean 1.2 mm, p99 5.5 mm, max 32 mm (a fingertip).
- `Rig.js` `buildPlayerGeometry( { lod: true } )`: that body, the rigid pieces at half their segments, no Phanatic (his costume keeps its own draw): **7,900 triangles and 5,300 vertices against 31,560 and 17,750.**
- `Players.js`: a second slotted draw (`players.far`, a child of `players.mesh`, SP1's `aSlot`), and `lodSplit( camera, height )` each frame (from `BallparkApp._playerBounds`, the SP1 block), which puts a player under 128 px tall (of the view's 800) in it, with an 8% margin so nobody flickers. The draws share the near draw's bounds.
- The threshold went 64 → 128 px after the shot pairs: the far figure forced onto TV center's pitcher and catcher (250-400 px) is still hard to tell from the full one.
- Same page (job c), all near → far figure, opaque / shadow ms:

| View | All near | Far figure |
|---|---|---|
| TV center | 11.87 / 0.97 | 11.89 / 0.98 (all over 128 px: no change) |
| TV high | 18.80 / 0.66 | 17.20 / 0.39 |
| TV follow | 10.26 / 1.15 | 9.15 / 0.76 (under 64 px: 9.88 / 1.02) |
| 3B concourse | 11.67 / 0.68 | 10.25 / 0.41 |
| Lounge seat | 9.05 / 1.04 | 7.57 / 0.48 |
| Upper home | 13.84 / 0.73 | 12.34 / 0.46 |
| Left field | 19.28 / 0.62 | 17.76 / 0.37 |
| Rain TV high | 18.97 / 0.55 | 17.47 / 0.49 |
| Real 3B seat | 15.39 / 1.02 | 13.81 / 0.49 |
| 3B plaza | 11.91 / 0.61 | 10.71 / 0.45 |

  - The players are drawn from the concourse and the lounge too: their box (the whole field) shows through an opening, so the occlusion culling keeps all 24. The far figure takes 1.4 ms off there as well.
- Shots (`sp2-b`, `sp2-c`): TV high's batter and umpire at 3x, TV follow's pitcher, first base umpire and coach at 4x: no difference to the eye. TV center (all near) is unchanged.

### 1b. The players' middle figure (4dc0238)

- The tool also writes `BODY_MID`: the body to 9,000 triangles (mean error 0.3 mm, max 2.6 mm: under a pixel at 480 px).
- `buildPlayerGeometry( { lod: 'mid' } )`: that body with the pieces whole, no Phanatic: 17,800 triangles and 10,900 vertices.
- A third slotted draw (`players.mid`) for players from 128 to 480 px tall (`MID_PX`), the same margins. FOX's long lens from center field has most of its players there: 18 of 22 in TV center.
- Same page (job d), no middle figure → middle figure, opaque / shadow ms: TV center 11.82 / 0.86 → 10.99 / 0.61; TV follow 9.17 / 0.74 → 8.88 / 0.66.
- Shots (`sp2-d`, `pair-tvcenter60-*`): the pitcher, catcher and umpire at 200-300 px, side by side: no difference to the eye.

So a player is drawn from three figures: full over 480 px (the close-ups), middle from 128 to 480, far under 128. `players.lodPx` / `players.midPx` move the thresholds; `__app._noPlayerLod = true` draws everyone full.

### 2. The local lights' loop (793e96c)

The same light, with less per light:
- what's the same for every light is worked out once (the view's half of GGX's visibility term, the sheen's exponent and scale); the material's colours scale the sums after the loop;
- the CPU inverts what the loop divided by (`localLights.inv`: 1 / range², the spot's 1 / (cos inner − cos outer));
- N·L before the spot; the water's absorption only below the sea's level; one division for the falloff and one for GGX's D × V (there were four).

Measured: **0-0.15 ms.** The lights' cost (all on − lights off) went 2.47 → 2.27 ms in TV high and 3.57 → 3.32 in left field between jobs a and b, but in the same page (job c, the old loop compiled alongside behind a uniform) the difference is within ±0.15 ms. So the per-light arithmetic isn't what costs: see what's next. I kept it: it's exact (pairs within noise) and no slower.

### 3. What cuts holes drawn last in the opaque layer (a791bb4)

`MeshRenderer.collect()` sorts the opaque items whose material has an alpha test or a `discard` (`cuts()`, once per material version) after the rest: Apple's order for its tile GPUs (opaque, alpha-tested, blended). A discard makes the hidden surface removal resolve what's under it; drawn last, that's only what's visible. `meshRenderer.cutLast = false` restores the old order.

This is the brief's "small discards" item done for every material at once. ConcourseSteel's pickets and Concourse's signs already had their own materials (`rail-pickets`, `concession-signs`), so there was nothing to split there; what the split was for (keeping the discard from costing the rest) is what drawing them last does.

Same page (job c), material order → cut last, opaque ms: TV high 17.44 → 17.20, TV follow 9.27 → 9.15, 3B concourse 10.74 → 10.25, upper home 12.56 → 12.34, left field 18.00 → 17.76, rain TV high 17.63 → 17.47, real 3B seat 14.18 → 13.81, 3B plaza 10.91 → 10.71, TV center no change. Left field pair within noise.

### 4. TAAU: the lock luma once per pixel (361e291)

FSR2's lock luma (a tone map, a cube root and a sixth root) was worked out for nine taps per output pixel. The beauty pass now writes it once into its alpha (which nothing else reads), from the same function and exposure (`TAAU_LUMA_WGSL`); `smaataa` still computes it in the resolve. `post.params.lockLuma = 0` for the old path.

**TAAU 1.93 → 1.82 ms** across the ten views (a → b). In the same page the A/B is ~0.02 ms: the resolve is bound by its 27 texture reads, not by the luma. The pair is within noise.

### 5. The scene's copies only for their readers (1376d71)

`SceneRenderer` copied the opaque colour (8 MB) and made a half-float copy of the opaque depth (a full-screen pass) every frame, for the ocean's water. The ballpark reads neither: its post chain reads only the depth copy.
- The half-float depth is now made once something asks for it (the `opaqueDepthHalf` getter: App.js's water still does).
- The colour copy is skipped where the app says nobody samples it (`sceneRenderer.copyColor = false`, one marked line in BallparkApp).
- The depth pass measured **0.19-0.27 ms in every view** (job a, its own timestamp); the copy isn't timed.

### 6. The 400s behind home, after FW3 (b55f493, bd71a80)

The coordinator's new view (`seat-400s-home-real`, a real seat in the 400s that sees the whole bowl) was 35.7 ms after FW3: over the floor. What it costs (job e, same page, opaque ms of 23.97; GPU 31.2):

| Hidden | Opaque saved | What's there |
|---|---|---|
| The seated crowd | **12.9** | 4.17M triangles: far 2.01M (116 pieces), near 1.41M (8 pieces round the seat), mid 0.74M |
| The local lights | 4.0 | the eight banks over the whole bowl |
| The seats | 2.2 | 0.49M triangles |
| The sun's shadows (sampling) | 2.2 | |
| The Cast | 1.9 | 737 people under 32 px (the distant figure, 386 triangles each) and 36 far: 0.33M triangles |
| The players | 0.6 | all far |
| Every piece one level coarser (not kept: a look change) | 3.3 | 1.16M triangles fewer |

**The crowd's distant level** (b55f493). A fifth level in `Crowd.js` for fans under ~8 px tall (`crowd.distant = 60`, lod()'s d: half the screen's height in metres at the piece's nearest point): the far one's shapes on three sides, a 4 × 2 head, **55 triangles and 58 vertices a fan against 72 and 69.** Same page (job f), none → distant: the 400s 23.88 / 30.80 → 23.22 / 29.46 opaque / GPU ms (72 of 116 far pieces distant); left field 18.20 / 24.55 → 17.68 / 24.09 (101 of 130); TV high no change (1 piece). The far stands at 3x look the same (`sp2-f/pair-400s-*`): the differences are the fans' sway and the camera flashes, as between two shots of one state.

**The crowd in pieces of 120 fans, not 360** (bd71a80). A piece takes its level from its nearest fan, so a piece of 360 (a dozen rows of a section) went at the near level for its front rows' sake, back rows and all. From the 400s seat the eight pieces round you were 1.4M triangles of near-level fans; from FOX's high home camera the lower deck's pieces were near or mid all the way back. In pieces of 120 every fan is still drawn at the level its own size asks for or a finer one: nobody is coarser than the thresholds say. 384 pieces, not ~150; ~170 more draws (they don't cost the wall: the draw test below).

Not switchable at runtime, so measured across two exclusive jobs, the same 40-frame profile (opaque / GPU / wall ms):

| View | Pieces of 360 (job f) | Pieces of 120 (job g) | Triangles |
|---|---|---|---|
| The 400s behind home | 23.22 / 29.46 / 35.14 | **20.54 / 26.60 / 32.34** | 6.79M → 5.84M |
| TV high | 17.50 / 24.46 / 30.36 | **12.80 / 19.29 / 23.64** | 5.44M → 3.61M |
| Left field | 17.68 / 24.09 / 29.32 | 16.98 / 23.92 / 28.79 | 5.50M → 5.31M |

The 400s PNG against the 360-fan pieces at 2x (the lower deck, the fans round the seat): the same. TV high's JPG: the same.

This is the biggest single win of the round, and it was a constant: FP1's `PIECE` was made for culling (each piece culled on its own), and SP1 evened it; its level of detail was never tuned.

## The numbers

**After FW3, on `ballpark` with everything** (job g, the standard views it had; the coordinator's after-FW3 run had SP2's first six commits but not the crowd's two). Wall / GPU / opaque ms:

| View | Coordinator after FW3 | SP2 last (g) |
|---|---|---|
| The 400s behind home | 35.74 / 30.15 / 23.84 | **31.94** / 26.60 / 20.55 |
| TV high, the 29th | 29.08 / 24.00 / 17.61 | **23.34** / 19.06 / 12.84 |
| Rain TV high, the 27th | 29.83 / 24.74 / 17.68 | **23.98** / 19.76 / 12.81 |
| Celebration, TV high (120 s) | 29.02 / 24.00 / 17.59 | **23.65** / 19.64 / 13.36 |
| Left field, Harry's | 30.92 / 25.51 / 18.54 | **29.06** / 23.33 / 16.97 |
| TV center, the 27th | 22.89 / 18.78 / 11.33 | **21.02** / 17.56 / 10.33 |
| Upper seat behind home | 22.46 / 17.63 / 11.08 | **20.63** / 15.96 / 9.66 |

Every view is under the floor; **left field (29.1) is now the tightest, then the 400s (31.9).**

**Before FW3, the first six commits** (from the branch's base). Exclusive, 1280 × 800, the standard job. "Before" is job a (this branch's base, 80bc07d: the same tree as the coordinator's after-FW2 plus SP1's last merge). "After" is job d, everything in. Wall / GPU / opaque ms; the last column is the GPU's saving.

| View | Before (a) | After the first four (b) | After all (d) | GPU saved |
|---|---|---|---|---|
| TV center, the 27th | 23.57 / 19.49 / 11.84 | 23.43 / 19.27 / 11.74 | **22.49** / 18.43 / 11.07 | 1.06 |
| TV high, the 29th | 30.22 / 25.29 / 18.67 | 27.34 / 23.03 / 16.82 | **28.03** / 23.28 / 17.05 | 2.01 |
| TV follow, the 29th | 19.75 / 16.90 / 10.21 | 19.12 / 16.18 / 9.74 | **18.82** / 14.96 / 8.83 | 1.94 |
| 3B concourse walk | 23.53 / 19.12 / 12.24 | 20.02 / 16.37 / 10.13 | **22.76** / 17.16 / 10.43 | 1.96 |
| 3B field seat (the lounge) | 19.62 / 16.20 / 9.18 | 17.20 / 13.79 / 7.44 | **19.47** / 14.32 / 7.72 | 1.88 |
| Upper seat behind home | 24.63 / 20.44 / 14.08 | 22.14 / 18.26 / 12.27 | **23.65** / 18.68 / 12.57 | 1.76 |
| Left field, Harry's | 31.08 / 26.57 / 19.59 | 28.62 / 24.11 / 17.77 | **29.55** / 24.45 / 18.16 | 2.12 |
| Rain TV high, the 27th | 30.61 / 26.11 / 18.71 | 28.36 / 23.90 / 16.93 | **29.65** / 24.29 / 17.21 | 1.82 |
| A real 3B field seat | 26.04 / 22.08 / 15.27 | 23.18 / 19.37 / 13.32 | **24.60** / 19.78 / 13.62 | 2.30 |
| 3B plaza, the 27th | 23.29 / 19.26 / 11.90 | 21.91 / 17.73 / 10.35 | **22.80** / 17.76 / 10.56 | 1.50 |

- **The GPU saved 1.1-2.3 ms in every view**, 2.0-2.1 in TV high and left field.
- **The wall times are noisy between jobs.** In job d the CPU read 7-10 ms (5-7 in a and b) and the wall's gap over the GPU grew with it: the machine was busier. Job b, on a quieter machine, shows what the wall can do: 2-3.5 ms back in most views.
- **The coordinator's after-FP2 run** (`after-fp2.out`, without SP2) had TV high 31.6, left field 31.8 and rain TV high 31.3. These changes don't touch FP2's files, so they should take ~2 ms of GPU off each of those after the merge.

What each change is worth, from the same-page A/Bs (opaque + shadow ms; the players' rows are the biggest):

| Change | TV high | Left field | TV center | TV follow | Walking views |
|---|---|---|---|---|---|
| Far figure (vs all near) | 1.87 | 1.77 | 0 | 1.50 | 1.4-2.1 |
| Middle figure | 0 | 0 | 1.08 | 0.37 | 0 |
| Cut-outs drawn last | 0.24 | 0.24 | 0 | 0.12 | 0.1-0.5 |
| Scene copies skipped | 0.27 | 0.26 | 0.24 | 0.23 | 0.2-0.26 (the pass's own time) |
| TAAU's luma | ~0.1 | ~0.1 | ~0.1 | ~0.1 | ~0.1 (between jobs; ~0 in the same page) |
| Lights' loop | ~0.1 | ~0.1 | 0 | ~0.1 | 0-0.15 (noise) |

## Found on the way

- **The CPU isn't on the critical path.** With 3 ms of busy-wait added to every frame's CPU (`busy.js`), the wall time didn't move (TV high 28.06 → 27.85, TV follow 18.77 → 18.45). The 4-5 ms of wall over the GPU's span (first pass's start to last pass's end) is spent outside the frame's passes. So shaving the CPU's 6-8 ms (collect 2.0, drawItems 2.2, the scene graph's matrices 1.0: `cpu-tvhigh.cpuprofile` in `sp2-c`) won't raise the frame rate.
- **The players are drawn from inside the concourse and the lounge.** Their one box covers the field, and it shows through an opening. A box per player (24 more occlusion queries) would drop them; with the far figure it's now ~0.35 ms there.
- **The lights' cost is fragments, not arithmetic (most likely).** Cutting the per-light arithmetic by about a third moved nothing in the same page, and 2.3 ms for 8 banks over ~1M pixels is several times what their arithmetic should take. The likeliest reason: the crowd's and seats' triangles are a few pixels or less, so the GPU shades whole 2 × 2 quads mostly for pixels the triangle doesn't cover, and every bank runs in each lane. Fewer, larger triangles in the distance (a far crowd level) would cut that; so would deferred lighting, a much bigger change.

## What I'd do next

In order of win per risk. The first three are in FP2's files: they are SP1's crowd and Cast wins, written up again for after FP2, with what this round adds.

1. **The crowd, still (Crowd.js).** The distant level (done) is 55 triangles; the far one's 72 for fans 8-16 px are 1.7-1.9M triangles in left field and the 400s. What's left there:
   - the lean and head-turn trigonometry once per fan in the compute pass, not per vertex (SP1);
   - the near and close levels work their vertices out twice (this frame and the last, for the motion vectors). Skipping it for still fans doesn't work: every fan sways a little every frame (`cwFanPose`'s `r2`), so the rows always differ. Writing the previous frame's positions out once (a compute pass, or a stored buffer) would;
   - pieces of 120 by rows: a smaller piece only near the camera would cut more, but the pieces are made once, so it would have to be by distance from where people sit.
   This round adds a second reason for fewer, larger triangles: **the banks' 2.3-4 ms is mostly shading the 2 × 2 quads of triangles smaller than a pixel**, and each of the eight banks runs in every lane.
2. **The Cast (Cast.js).** From the 400s it's 1.9 ms: 737 people under 32 px at the distant figure's 386 triangles each (it carries every optional piece, folded away in the shader when not worn), and 36 far. A speck level for under ~12 px (the crowd's far fan is 72 triangles), with only the pieces that show at that size. And the middle level SP1 asked for (4,600 → ~1,500 triangles for 112-250 px; the players' middle figure is the pattern), and an `occlusionBox` per draw (the Cast draws with `frustumCulled = false`, so occlusion can't drop it).
3. **The lights over the bowl (4 ms from the 400s).** See 1 and 8: it is the quads.
4. **The 4-6 ms between the GPU's passes and the wall (the engine).** Every view spends 4-6 ms of wall time outside the span from the first pass's start to the last pass's end. It isn't the renderer's JS (3 ms of busy-wait there doesn't move the wall), and it isn't the number of draws: 300 and 600 more draws that cost the GPU nothing (job e, the 400s seat, 948 draws to start with) moved the wall by less than the job's noise (37.5, 36.5, 38.1, back to 35.8). It grows when the machine is busy. Next: a Chrome trace (Perfetto) of the GPU process during a profile, to see whether it's the present, the read-backs (the occlusion queries' and the timestamps' own), or the passes' count.
5. **The players' occlusion per player (Players.js, BallparkApp).** From the concourse and the lounge all 24 players are drawn, because their one box covers the field and shows through an opening. 24 small boxes (`Occlusion` already batches queries) would drop the hidden ones. Now ~0.35 ms there.
6. **TAAU (1.85 ms everywhere).** It's bound by its 27 texture reads a pixel, not its arithmetic (the luma A/B). `textureGather` for the depth's 3 × 3 (4 reads, not 9, compared in the same order so ties resolve as now): maybe 0.1-0.2 ms.
7. **The sun's (the moon's) shadow sampling: 2.2 ms from the 400s.** At night the key light is the moon, faint under the banks, but every lit fragment still runs the cascades' filter (PCSS on the first: 8 blocker taps and 12 filter taps). Most of that is the crowd's fragments, again the quads of tiny triangles. To measure next: the shadow filter's cost on the crowd's far and distant levels alone, and whether the moon's shadow on a fan 8-16 px tall can be seen at all (shot pairs; if it can't, those levels could take one hard tap).
8. **Deferred light for the banks.** The way to light every pixel once by eight banks, whatever the triangles' size, is a deferred pass: normals, albedo and roughness to a G-buffer, the banks in screen space. That's a big change to every material's output. Only worth it if 1 isn't enough.

## What the merger must know

**Files** (the engine and the post passes are mine; the rest is marked SP2 blocks):
- `src/engine/render/MeshRenderer.js`: `cuts()` and the cut-last sort in `collect()` (`cutLast`).
- `src/engine/render/SceneRenderer.js`: `opaqueDepthHalf` is a getter now (made on first ask), `copyColor`.
- `src/materials/LocalLights.js`: the hook rewritten (same light), the new `inv` uniform array. Rain.js (FW2) and the underwater beam read `pos` / `col` / `dir` / `count` as before.
- `src/post/TemporalUpscale.js`, `src/post/PostFX.js`: `TAAU_LUMA_WGSL`; the beauty pass binds the exposure and writes the luma to its alpha; `taau.lumaInAlpha`, `post.params.lockLuma`.
- `src/ballpark/game/Rig.js`: `buildPlayerGeometry( { lod } )` (`true`: far, `'mid'`: middle; the default unchanged). `src/ballpark/game/data/bodyLod.js` (new, generated) and `tools/build-body-lod.mjs` (new).
- `src/ballpark/game/Players.js`: `LOD_PX`, `MID_PX`, the `far` and `mid` draws in the constructor, `this._drawn` in `update()`, `lodSplit()`. Clear of FR1's jackets block (FR1 wasn't in this branch; the blocks don't overlap).
- `src/ballpark/BallparkApp.js`: inside SP1's `_playerBounds()` block (the split, and the far and middle draws share the box), and one line after the SceneRenderer is made (`copyColor = false`).
- `src/ballpark/Crowd.js` (after FP2 merged): the `distant` level (LODS, `crowd.distant`, a fifth mesh per piece, `CROWD_LOD < 3` for the face's features) and `PIECE = 120`. Anything that walks `ch.lods` should use its length (5), not 4.

**Things to keep in mind:**
- `players.far` and `players.mid` are children of `players.mesh`, like the costume: hiding the mesh hides all of them. `players.mesh.count` can now be 0 (everyone far): the draw is skipped, the children still draw.
- Anything that changes the players' body must keep `data/bodyLod.js` in step: re-run `node tools/build-body-lod.mjs` after `tools/build-body.mjs`. Changes in the vertex shader or the rigid pieces carry over by themselves.
- A new material with an alpha test or a `discard` is drawn after the other opaque ones automatically. Two coplanar surfaces, one cut out and one not, now draw in that order (`greater-equal`: the cut-out one wins a tie).
- An app that samples `sceneRenderer.opaqueCopy`'s colour must leave `copyColor` true (the default; only the ballpark sets it false).
- The standard job's template gained two celebration views while I worked (`cel-tv-high-120s`, `cel-tv-center-245s`); job a didn't have them.
- In the shared scratchpad I overwrote a `mkjob.mjs` at its root by mistake (another track's helper; mine are in `sp2/`).
