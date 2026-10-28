# SP3: the speed track, round 3

Branch `worktree-agent-ae4da94dfe6b25f94`, off `ballpark` after FW5 (fe81999). The goal was the same as SP1's and SP2's: win back frame time without cutting detail. The targets were the two views nearest the 30 fps floor (33.3 ms at 1280 × 800):
- a real 400s seat behind home, 33.5 ms on the coordinator's after-FW5 run;
- left field (Harry the K's), 29.3 ms.

The coordinator merged the first three commits as they landed (020625b, aecde12, df881e6).

How I measured:
- Exclusive desk jobs, 1280 × 800, the full park: `.claude/gauntlet/perf/sp3-a` to `sp3-f`.
- Every A/B ran in one page, and **every changed pipeline was compiled before it was timed** (a few frames, then `GPU.pipelinesReady()`). The engine compiles pipelines in the background and skips a draw until its pipeline is ready. Job a's switches were timed while their new pipelines were still compiling, so draws were missing and the numbers looked like wins that weren't real: culling the far crowd's back faces read −3.4 ms, and −0.1 once compiled first.
- PNG triplets (SP3's shaders / the old ones / SP3's again), diffed with SP2's `pngdiff.mjs` and looked at as crops. The scene's colour and motion vectors were also read back from a frozen scene (see "Exactness").
- The scripts are in the scratchpad's `sp3/`: `diag1.js` to `diag6.js`, `mkjob1.mjs` to `mkjob6.mjs`, `pairs.sh`, `trip.sh`, `masks.mjs`, `fanparts.mjs`.

## 1. The wall was the profiler's own read-back (aecde12)

SP2's lead 4 asked what the 4-6 ms of wall time over the GPU span was. It's `__qa.profile` itself.

Job b, same page, two frames in flight as the profile runs them (ms a frame):

| View | No timestamps | Timestamps, read back each frame | Timestamps written, not read back |
|---|---|---|---|
| The 400s seat | 23.58 | 28.90 | 24.68 |
| Left field | 20.73 | 26.88 | 20.77 |

- Job a measured the GPU idle between frames under the profile directly: 5.5 ms on average (the next frame's first pass start minus this frame's last pass end).
- With one, two, three or four frames in flight and no timestamps, the wall was the GPU time (the 400s: 39.3, 27.6, 27.6, 27.6 ms).
- So the per-frame resolve, copy and `mapAsync` of the pass timestamps stalls the next frame by ~5 ms on the M2.
- Nothing in play writes timestamps: only `?profile` does.

**The change (asked for by the coordinator):** `__qa.profile` runs `frames` plain for `wall`, then as many again with the timestamps for `gpu`, `passes` and `wallTs`. `wallTs` is the old figure, kept for continuity. A player's frame in the 400s is ~23 ms now, not the 28-33 the old metric said.

## 2. Only the varyings that vary (020625b): the big one

On this tile GPU, each vertex's outputs are written to memory and read back by the tiles. A vertex's bytes cost as much as its arithmetic, and the crowd is millions of vertices a frame. `MeshShader.js` now leaves out what doesn't vary (`MeshRenderer.leanVaryings`, on by default):
- **uv and colour**, when the geometry has none and the material's vertex hook doesn't mention them. The fragment takes the defaults, (0, 0) and white, as constants. That covers the crowd, the players and most of the park.
- **This frame's unjittered clip position** (for the motion vectors). It's the fragment's pixel less the frame's jitter, in the scene's own passes (`pass.pixelMotion`, set by `SceneRenderer`), whose frame camera is set at the target's size.
- **Last frame's clip z.** Only x / w and y / w are read.

The crowd's vertex went from 29 floats out to 19.

Same page, every pipeline compiled first (job b), off → on:

| View | Opaque ms | GPU ms |
|---|---|---|
| The 400s seat | 20.70 → **17.03** | 26.79 → 23.84 |
| Left field | 17.44 → **14.11** | 24.81 → 20.55 |

## 3. Fewer varyings still (df881e6)

- **A still object's last position.** An object whose matrix is last frame's (`MeshRenderer._slot` compares them), of a material whose motion is its object's alone, is drawn with a pipeline that has no last-frame clip position (`STILL_MOTION`). The fragment takes it from its world position: the clip position is linear in it, so this is the varying's value at the pixel.
  - Which materials qualify: `Material.stillMotion`. By default, one whose vertex hook doesn't touch `prevWorldPos`, `worldOffset`, `useWorld` or `prevModel`. The crowd's middle, far and distant levels say so.
  - The pipeline with the varying is drawn until the still one has compiled (`drawItems`).
- **World position from depth.** The crowd's middle, far and distant levels and the seats (`Material.worldFromDepth`) take their world position from the pixel's centre and depth, through the frame's inverse view-projection. A far fan is a hundred vertices over a few dozen pixels.
- **The fan and his part in one varying.** In `Crowd.js`, the part goes in vFan's low 5 bits.

The crowd's far vertex went from 19 floats out to 14. Same page (job c), opaque ms:
- still variant off → on: the 400s 16.66 → 16.48, left field 13.68 → 13.64;
- world from depth off → on: the 400s 16.97 → 16.67, left field 14.08 → 13.76.

These are much smaller than the first three varyings were worth. What cost was mostly the number of outputs, not each byte: uv, colour and the clip position were three whole locations for every mesh.

## Exactness

- **PNG triplets** (SP3 / the old shaders, `leanVaryings = false` / SP3, jobs b and c), in the 400s, TV high, TV center and left field. The old shaders differ from SP3 by no more than SP3 differs from itself. In the crops (the field, the near fans, the far stands, the seats) the only differences are the fans' animation.
- **Motion vectors of a camera move, read back** (job b): static pixels agree to 0.04 px at p90, which is f16's step.
- **A frozen scene** (dt 0, the jitter held, one camera move; the colour and motion read back for each variant against SP3, on the pixels SP3 gives the same twice; `diag5.js`, `diag6.js`, masks from `masks.mjs`). Job e still let the clock run while the pipelines compiled between runs, so its noise floor (SP3 against itself later) was as large as any variant's. The masks show that noise is the people walking at Harry's, the fans' poses and a light on the floor.
- **Job f holds everything still:** every frame at dt 0, and the measured frame at the same frame index modulo 64 (the shadows' and the sky's per-frame noise). SP3 against itself later is bit-identical, so what's left is each change alone. Of ~1.02M pixels:

| Against SP3 | View | Motion, max (px) | Colour off by > 1% | > 5% |
|---|---|---|---|---|
| The far crowd's and seats' world position as a varying | 400s | 0.039 | 7 | 5 |
| | Left field | 0.020 | 0 | 0 |
| The still variant off | 400s | 0.010 | 4 | 4 |
| | Left field | 0.0001 | 0 | 0 |
| Every old shader (`leanVaryings = false`) | 400s | 0.092 (p99 0.020) | 11 | 3 |
| | Left field | 0.092 (p99 0.024) | 13 | 5 |

  The motion vectors agree to f16's step. A dozen isolated pixels in a million change colour: a shadow or depth test landing the other way at an edge.

## What costs the time now (job d, the 400s, opaque 16.5 ms; same page, compiled first)

| Group | Hidden | Its moon shadow off | Its local lights off |
|---|---|---|---|
| The crowd | −6.9 | −0.9 | −1.6 |
| Figures (the Cast, people, players, rail figures) | −2.4 | −0.3 | −0.4 |
| The seats | −1.6 | −0.4 | −0.85 |
| Everything else (495 materials) | −1.9 | −0.4 | −0.7 |
| The field | −0.9 | ~0 | −0.3 |
| Trees | −0.3 | −0.2 | −0.2 |
| The stands' concrete and fascia | +1.5 (they hide what's behind them) | −0.4 | −0.7 |
| All of them | | −2.1 (shadows off) | −3.7 (lights off) |

Left field: the crowd −5.3, figures −2.2, every local light −2.9, the shadows −1.0.

The crowd's vertex work, stripped level by level (a measurement: every vertex at its sitting place), in the 400s:
- close and near −0.75 (that's where `cwVertex` runs twice);
- far −0.3, distant −0.4, middle −0.1.

**`Material.receiveShadows` does nothing.** It's in the pipeline key and sets `RECEIVE_SHADOWS`, but no shader reads it. SP2's "the crowd's shadow receiving off: −0.1 ms" measured nothing. My per-group shadow column patched the lighting module in the page (`RECEIVE_SHADOWS` takes the moon's shadow away) to measure it. I didn't commit that: no material sets it false today, so it would change nothing, but whoever wants the flag should know it's a no-op.

## Tried and dropped

All measured with the pipelines compiled:
- **The far crowd's back faces culled** (levels 3-4, `side: 'front'`; the fans are wound to their normals and no seat matrix is mirrored, 0 of 41,991): −0.1 ms in both views. The GPU culls back faces after the vertex work, which is what costs.
- **The crowd's local lights Lambert only:** −0.55 ms (−0.3 for the far levels alone). It's a look change (the wet nylon's glints), so not kept.
- **The lights' loop to a constant bound** (12, with a break): +0.4 ms.
- **The lights' loop without branches** (what a branch skipped multiplied by zero): +0.1 ms.

## The numbers

**The standard views, after FW5.**
- "Coordinator after FW5" is `after-fw5.out` (no SP3); its wall is the old metric.
- "SP3" is job f, this branch with everything. Its wall is the new metric (no timestamps), `wallTs` the old one.
- GPU and opaque are measured the same way in both: the GPU column is the like-for-like one.

| View | Coordinator after FW5: wall / GPU / opaque | SP3: wall / wallTs / GPU / opaque | GPU saved |
|---|---|---|---|
| The 400s behind home | 33.48 / 27.80 / 20.95 | **22.92** / 27.50 / 22.51 / 16.53 | **5.3** |
| Left field, Harry's | 29.32 / 24.31 / 17.77 | **20.20** / 24.36 / 19.88 / 13.72 | **4.4** |
| A real 3B field seat | 23.77 / 19.49 / 13.13 | 16.23 / 20.21 / 16.13 / 10.01 | 3.4 |
| TV high, the 29th | 24.45 / 19.73 / 13.30 | 17.60 / 21.33 / 17.33 / 11.18 | 2.4 |
| Rain TV high, the 27th | 24.91 / 20.47 / 13.28 | 18.34 / 22.35 / 18.20 / 11.19 | 2.3 |
| Celebration TV high (120 s) | 24.99 / 20.44 / 14.03 | 18.43 / 22.54 / 18.29 / 11.92 | 2.2 |
| Celebration TV center (245 s) | 23.34 / 19.91 / 13.23 | 18.16 / 21.24 / 18.00 / 11.49 | 1.9 |
| 3B concourse walk | 21.78 / 16.14 / 9.67 | 14.29 / 18.21 / 14.20 / 8.08 | 1.9 |
| 3B field seat (the lounge) | 18.31 / 13.81 / 6.75 | 11.79 / 16.76 / 11.93 / 5.40 | 1.9 |
| Upper seat behind home | 20.86 / 16.44 / 10.20 | 14.53 / 18.65 / 14.56 / 8.44 | 1.9 |
| 3B plaza, the 27th | 22.69 / 18.11 / 10.80 | 16.08 / 21.85 / 16.30 / 8.86 | 1.8 |
| TV center, the 27th | 22.63 / 18.25 / 10.77 | 16.88 / 20.16 / 16.77 / 9.57 | 1.5 |
| TV follow, the 29th | 19.05 / 14.68 / 8.33 | 13.65 / 16.88 / 13.59 / 7.60 | 1.1 |

- **The GPU saved 1.1-5.3 ms in every view**: 5.3 in the 400s and 4.4 in left field, the two that were nearest the floor.
- **On the old metric** (`wallTs`), the 400s went 33.5 → 27.5 and left field 29.3 → 24.4. On the new one, a frame is ~23 ms in the 400s (43 fps) and ~20 in left field (50 fps). The worst view is now 22.9 ms, 10 ms under the floor.
- **This branch's own jobs** (the 400s; left field), wall / GPU / opaque:
  - job a, before anything: 34.62 / 27.65 / 21.10; 29.48 / 24.49 / 17.68;
  - job b, the lean varyings: 28.29 / 22.97 / 16.96; 25.43 / 20.69 / 14.18;
  - job c, everything, with the new metric: 22.83 (wallTs 27.50) / 22.49 / 16.50; 20.18 (25.05) / 20.17 / 13.72.

## What I'd do next

In order of win per risk. The first two are in other fixers' files or are look calls.

1. **The figures (FW4's `Cast.js` and `People.js`, FR2's rail figures).** Hidden, they're −2.4 ms in the 400s and −2.2 in left field: the Cast 0.34-0.43M triangles, the people at Harry's 0.84M.
   - Each could set `worldFromDepth: true` on the materials of its small figures (an engine flag now, no shader change); it's what the far crowd got.
   - The Cast's distant figure is 386 triangles for a person 4-8 px tall, against the crowd's 55. SP2's speck level (only the pieces that show at that size, ~60 triangles) and an `occlusionBox` per draw still stand.
   - `Cast.js` was FW4's this round, so I left it.
2. **A speck level for the crowd** (FW4's look, the coordinator's call). Fans under ~4.5 px (lod()'s d over ~115: the far side of the bowl from the 400s, the first-base side from Harry's) at ~25 triangles: the trunk, head and arms as a few quads, the colours kept. The distant level is 20,000 fans (1.2M vertices) in the 400s and 29,500 (1.7M) in left field. It was −4.2 ms hidden in job a, before the varyings. Its towel alone is 9 of its 58 vertices.
3. **The banks: −3.7 ms in the 400s and −2.9 in left field with every local light off.**
   - The crowd's share is 1.6 ms, the seats' 0.85, the concrete's 0.7, the rest 0.7.
   - It isn't the arithmetic: SP2's third less, a constant bound and no branches each moved nothing or made it worse.
   - What's left:
     - a per-fan bank irradiance for the far levels, worked out in the crowd's compute pass (the banks are 50-150 m from a 1 m fan, so L and the falloff barely change across him; ~1% from exact, the specular kept per pixel);
     - or deferred light for the banks (a G-buffer and the eight banks in screen space): the big one.
4. **The moon's shadow: −2.1 ms in the 400s**, the crowd's share 0.9 (with `RECEIVE_SHADOWS` made to work in the page). Two things to do:
   - make `Material.receiveShadows` work (lighting.js, around `shadow = sunShadow(...)`), so the flag is real;
   - decide whether the far crowd needs more than one tap of a moon that the banks outshine. That's a look call.
5. **The close level's second `cwVertex`** (the motion vectors): −0.75 ms in the 400s for both calls. Two ways to shrink it:
   - a vertex off the arms (side 0) needs last frame's pose only when st, the yaw, r3 or r4 changed, and otherwise just last frame's sway. But the mood eases every frame for seconds after each change, and 80% of fans clap a little (`clap` 0.05 at rest), so it would rarely skip;
   - only the fans within the close distance at the close level: the camera's piece drawn as an instance range (`firstInstance`) at the close level and the rest of the piece at the near one.
6. **TAAU (1.8 ms everywhere):** SP2's `textureGather` for the depth's 3 × 3, maybe 0.1 ms.

## What the merger must know

**Files** (the engine is mine; the rest are marked SP3 blocks):
- `src/engine/render/MeshShader.js`: `VARY_UV`, `VARY_COLOR`, `PIXEL_MOTION`, `LEAN_VARYINGS` (prevClip is a vec3f), `STILL_MOTION`, `WORLD_FROM_DEPTH`, `motionCur()`, `motionPrev()`, `worldOf()`.
- `src/engine/render/MeshRenderer.js`:
  - `leanVaryings` and `stillMotion` (both on);
  - the pass key gains both, and `pass.stillPass`;
  - `_slot()` sets `still`;
  - `drawItems()` picks the still pipeline, and calls `_slot()` before the pipeline check.
- `src/engine/render/SceneRenderer.js`: `pixelMotion: true` on the scene's passes.
- `src/engine/render/Material.js`: `stillMotion` (null = from the vertex hook), `worldFromDepth` (in the pipeline key).
- `src/ballpark/QA.js`: `profile()`'s `wall` without timestamps, `wallTs` the old figure.
- `src/ballpark/Crowd.js` (FW4's look): three marked SP3 blocks:
  - the end of `crowdMaterial()`;
  - the varyings line (vPart is gone, the part is in vFan's low 5 bits);
  - the vertex hook's `o.vFan` and the surface's first three lines (part, piece, fan).
- `src/ballpark/Stands.js`: `worldFromDepth: true` on the seats' material.

**Things to keep in mind:**
- **A vertex hook that moves its vertices from frame to frame** must mention `prevWorldPos` (or `worldOffset` / `useWorld`) or set `stillMotion: false`. Otherwise a still object of that material gets motion vectors from its position alone, which is what it got before for anything that didn't set `prevWorldPos`.
- **The engine reads the hook's text.** A hook that writes `o.uv` / `o.color` keeps those varyings; the detection is by the words `uv` and `color` in `material.vertex`.
- **`worldFromDepth` is for small things with many vertices.** It costs a matrix product per pixel and saves 12 bytes per vertex. It needs the scene's own passes (`pixelMotion`); elsewhere the varying stays.
- **The profile now takes twice the frames** (plain, then with timestamps). PERF.md's wall column changes meaning from here on; `wallTs` is the old one.
- `meshRenderer.leanVaryings = false` brings back every old shader, for an A/B. `stillMotion = false` brings back only the still variant.
