# The gauntlet's frame rate

**The floor:** 30 fps, which is 33.3 ms a frame, in the walking and TV views (the owner, 2026-10-28).

**How it's measured:** one desk job under exclusive (nothing else rendering), the full park at 1280 × 800, `__qa.profile( { frames: 90, warm: 30 } )` in each view. "Frame" is the wall time per frame, back to back (CPU and GPU together); "GPU" is the timestamp-query total. The job is `.claude/gauntlet/perf/job-baseline.json`, re-run after each merge.

## Step 8, the baseline (e331dea + docs, 2026-10-28 08:05)

| View | Frame (ms) | fps | GPU (ms) | Opaque pass (ms) | CPU (ms) |
|---|---|---|---|---|---|
| TV center, the 27th (play 20) | 25.2 | 40 | 21.6 | 13.1 | 7.2 |
| TV high, the 29th (play 60) | **32.1** | **31** | 27.6 | 18.7 | 5.9 |
| TV follow, the 29th (play 61) | 29.7 | 34 | 26.0 | 17.5 | 5.5 |
| Walking, the 3B concourse | 28.1 | 36 | 24.3 | 15.9 | 5.6 |
| A field-level seat, 3B | 27.4 | 36 | 23.5 | 14.8 | 5.5 |
| An upper-deck seat behind home | 29.4 | 34 | 25.2 | 16.6 | 6.1 |
| Left field, Harry the K's | 28.0 | 36 | 24.2 | 15.3 | 5.5 |

The cold load was 62 s (shaders compiling in a fresh browser), no console errors.

**What it means:** the TV high camera is already at the floor, and the others have 4–8 ms of headroom. So the gauntlet carries **a speed track** alongside the fixes: win back opaque-pass time (LOD, culling, batching, cheaper distant materials) without cutting detail, so the fixes have room.

## After each merge

| When | Merged | TV center | TV high | TV follow | Concourse | Seat 3B | Upper | Left field |
|---|---|---|---|---|---|---|---|---|
| Baseline | step 8 | 25.2 | 32.1 | 29.7 | 28.1 | 27.4 | 29.4 | 28.0 |
