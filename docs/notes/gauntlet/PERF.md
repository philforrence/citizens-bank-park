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
| 08:58 | FI1, the concourse | 23.7 | 30.2 | 27.9 | 27.6 | 26.7 | 28.9 | 27.4 |
| 09:02 | FB1, the bowl (rain, TV high on the 27th: 29.8) | 23.9 | 30.6 | 28.0 | 27.7 | 25.6 | 29.2 | 27.5 |
| 09:10 | FY1, the game and cameras (rain, TV high on the 27th: 31.0) | 25.0 | 29.4 | 25.9 | 29.9 | 27.0 | 29.8 | 29.5 |

**From FY1 on, every view is lit at game time.** The light used to default to 4 pm, so the baseline's walking views were in daylight; now the replay's clock sets it (~8:30-10:40 pm), and the night's lamps cost the walking views ~2 ms. That's the honest condition: the game is at night. TV high got cheaper from FOX's tighter lens (fov 32).
| 09:25 | FP1, the people (rain, TV high on the 27th: 31.4) | 23.0 | 30.3 | 22.8 | 30.8 | 29.0 | 31.8 | 31.8 |

FP1's crowd culls and picks its LOD per 360-seat piece, so the TV views got cheaper (follow 25.9 -> 22.8); its close LOD and the concourse's throng cost the walking and seat views 1-2 ms. **The upper-deck seat and left field are 1.5 ms from the floor**: the speed track (SP1) has them.
| 09:48 | FY2, the Phanatic and players (rain, TV high on the 27th: 32.4) | 23.0 | 30.6 | 22.7 | 30.9 | 28.8 | 32.5 | 32.6 |

**At the floor's edge:** the upper-deck seat, left field and the rainy TV high are within 1 ms of 33.3. Until the speed track (SP1) lands, new fixes must cost nothing in those views.
| 09:58 | SP1, occlusion culling (rain, TV high on the 27th: 26.9) | 21.0 | 26.3 | 19.9 | 23.5 | 21.8 | 25.2 | 31.0 |

**The speed track's first win** gave back 2-7 ms everywhere but left field (an open view: little is hidden). Left field (31.0) is SP1's next target. From here the job also has a real field-level seat (`seat-3b-field-real`, the bowl critic's `__seat()`), since the old "3B field seat" eye sits under the stands.
| 10:08 | FI2, the insides (rain TV high 27.3; a real 3B field seat 25.7) | 21.2 | 25.9 | 20.3 | 24.1 | **33.0** | 25.2 | 30.8 |

**Under the stands is at the floor:** the old "3B field seat" eye is under the stands, where FI2's lounge, cages and tunnels now draw (21.8 -> 33.0 ms). Handed to SP1 ahead of left field. A real field-level seat is 25.7.
| 10:50 | SP1, the insides' material (SP1's own run, exclusive; rain TV high 26.5, a real 3B seat 24.8) | 21.1 | 25.8 | 19.0 | 22.6 | **18.8** | 24.9 | 30.2 |

Under the stands is back from the floor: FI2's room material built two 58-entry palettes per pixel and carried the cages' `discard`, which turns off the GPU's hidden-surface removal for everything drawn with it.
| 11:12 | FW1, the people on the walk (rain TV high 28.0; a real 3B seat 26.3) | 23.5 | 27.8 | 19.9 | 23.4 | 23.0 | 25.3 | 31.6 |
| 11:16 | FB2, the broadcast (rain TV high 31.2; a real 3B seat 26.7) | 23.9 | 30.4 | 20.4 | 24.0 | 20.2 | 25.4 | **32.1** |

FW1's heavier close-up Cast is seen by FOX's long lens (+2 ms in TV center and high). FB2 widened high home to FOX's framing (fov 37: +14% triangles, +2.6 ms). **Left field (32.1) and the rainy TV high (31.2) are within ~1-2 ms of the floor again:** both are SP1's.
| 11:37 | FW2, the building and outside (rain TV high 31.7; a real 3B seat 26.4) | 23.3 | 31.1 | 20.0 | 24.3 | 20.7 | 25.9 | 32.0 |

FW2 cost nothing measurable in these views (its trees, cars and tents are outside them). From here the job also has the walk's first view, the 3B plaza on the 27th (`walk-plaza-3b-27th`).
| 12:05 | SP1's last commits and FP2, the people's polish (rain TV high 31.3; a real 3B seat 27.0; the 3B plaza on the 27th 23.7) | 23.4 | 31.6 | 20.4 | 23.3 | 20.4 | 24.8 | 31.8 |

Holding under the floor; TV high, its rainy twin and left field sit at 31-32 ms. SP2 (the local lights' tile list, a players LOD, TAAU) is on them.
| 12:10 | SP2's first win: the players' far figure (rain TV high 29.2; a real 3B seat 23.8; the 3B plaza 22.2) | 23.8 | 28.1 | 19.1 | 20.7 | 17.8 | 22.5 | 29.5 |

Every view at 34 fps or better; left field (29.5) has ~4 ms of room again.
| 12:15 | FR1, the celebration (rain TV high 29.1; a real 3B seat 23.8; the 3B plaza 22.5) | 23.3 | 27.6 | 19.6 | 20.7 | 18.2 | 22.5 | 29.7 |

FR1 cost nothing in the standard views. From here the job also has two celebration views (TV high 120 s after the last out, TV center at 245 s), where the most people are on the field.
| 12:55 | SP2's second win and FW3, the Terrace concourse (rain TV high 29.8; a real 3B seat 25.2; the plaza 23.3; celebration TV high 29.0 / center 24.7) | 22.9 | 29.1 | 19.0 | 22.6 | 19.5 | 22.5 | 30.9 |

**A new view over the floor:** a real seat in the 400s behind home (`seat-400s-home-real`, eye 0, 34.7, 58.9), added now that the 400s are built as 2008 had them, sees the whole bowl at once: **35.7 ms** (GPU 30.2, opaque 23.8). Handed to SP2 as its top target. The old "upper-deck seat" eye (0, 30, 75) was never in a seat (it now looks at the backs of the Terrace stands).
| 13:33 | SP2's crowd levels and pieces (SP2's own run: the 400s seat 31.9, rain TV high 24.0, celebration TV high 23.7) | 21.0 | 23.3 | - | - | - | 20.6 | 29.1 |

**Every view under the floor again**, the 400s seat included (31.9). Left field (29.1) is the tightest.
| 13:55 | SP2's crowd pieces and FB3, the broadcast round 3 (rain TV high 24.9; a real 3B seat 23.4; the plaza 22.9; celebration TV high 25.1 / center 24.1; **the 400s seat 33.1**) | 22.7 | 24.5 | 19.3 | 21.0 | 19.6 | 22.1 | 29.3 |

The TV views are the best they've been all day (TV high 24.5). **The 400s seat behind home (33.1, CPU 8.7 on a busy machine) sits right at the floor**, and left field (29.3) is next: they go to the next speed track (SP3) at the next free slot.
| 14:31 | FW5, the Terrace from below (rain TV high 24.9; a real 3B seat 23.8; the plaza 22.7; celebration 25.0 / 23.3; **the 400s seat 33.5**, GPU 27.8) | 22.6 | 24.5 | 19.1 | 21.8 | 18.3 | 20.9 | 29.3 |

FW5 cost nothing measurable (left field 29.3 as before). The 400s seat's wall time (33.5) is over its GPU span by ~6 ms with the CPU at 9.3 on a busy machine; SP3 has it.
| 14:36 | FI3, the insides' polish (rain TV high 24.8; a real 3B seat 23.4; the plaza 22.7; celebration 24.8 / 23.6; the 400s seat 32.4) | 22.5 | 24.7 | 17.8 | 20.4 | 17.3 | 20.9 | 29.7 |

FI3 cost nothing measurable (under the stands is cheaper: no discard, no local lights). Every view under the floor; the 400s seat (32.4) and left field (29.7) are SP3's.
| 14:56 | SP3, only the varyings that vary (SP3's own standard run: the 400s seat 28.3) | - | - | - | - | - | - | 25.4 |

**A correction to the metric:** SP3 found that the "wall" in every row above includes ~5-6 ms of the profiler itself (resolving, copying and reading back the GPU timestamps every frame). A player never runs that (only `?profile` does), so a player's frame is about the GPU column, 5-6 ms under the wall column. Every view has always had that much more room than this table shows. From SP3's next commit on, `wall` is measured without the timestamps and the old figure is kept as `wallTs`.

## From 15:05: what a player gets

`wall` is now measured without the profiler's timestamps (SP3, aecde12); `wallTs` is the old figure.

| When | Merged | View | wall (ms) | fps | wallTs | GPU |
|---|---|---|---|---|---|---|
| 15:05 | SP3's varyings, the new metric | TV center, the 27th | 17.0 | 59 | 20.1 | 16.9 |
| | | TV high, the 29th | 17.8 | 56 | 21.5 | 17.6 |
| | | TV high, the 27th's rain | 18.7 | 53 | 22.7 | 18.5 |
| | | TV follow | 13.7 | 73 | 17.3 | 13.7 |
| | | The 3B concourse | 14.7 | 68 | 18.5 | 14.5 |
| | | Under the stands (the lounge) | 11.3 | 88 | 16.1 | 11.3 |
| | | A real 3B field seat | 16.6 | 60 | 20.6 | 16.6 |
| | | The 3B plaza, the 27th | 16.5 | 61 | 20.9 | 16.2 |
| | | Left field, Harry the K's | 20.8 | 48 | 24.9 | 20.4 |
| | | **A real 400s seat behind home** | **23.5** | **43** | 29.1 | 23.7 |
| | | The celebration, TV high / TV center | 18.6 / 18.2 | 54 / 55 | 22.5 / 22.1 | 18.3 / 18.4 |

Every view is at 43 fps or better. Step 8's baseline, by the same honest measure, was its GPU column (21.6-27.6 ms, 36-46 fps), with a fraction of today's detail.
| 15:05 | FW4, the people up close | every view within 0.6 ms of 15:05's: TV center 17.1, TV high 17.8, rain 18.8, follow 13.9, concourse 14.5, lounge 11.1, real 3B seat 17.1, plaza 16.4, left field 20.7, **the 400s seat 23.8** (42 fps), celebration 18.6 / 18.7 | | | | |
| 15:16 | SP3's second win | TV center 17.2, TV high 17.6, rain 18.5, follow 13.8, concourse 14.2, lounge 11.2, real 3B seat 16.9, plaza 16.1, left field 20.2 (50 fps), **the 400s seat 23.3** (43 fps), celebration 18.5 / 18.6; no console errors | | | | |
| 16:24 | SP3's notes, FX1, FC4 | TV center 17.2, TV high 17.8, rain 18.7, follow 13.9, concourse 14.3, lounge 11.6, real 3B seat 17.2, plaza 16.0, left field 20.1, **the 400s seat 23.6** (42 fps), celebration 18.7 / 18.7; no console errors | | | | |
| 16:42 | FB4, the broadcast and rituals | TV center 17.3, TV high 18.1, rain 18.9, follow 13.9, concourse 14.2, lounge 11.6, real 3B seat 17.5, plaza 16.1, left field 20.0, **the 400s seat 23.7** (42 fps), celebration 18.9 / 18.8; no console errors | | | | |
| 17:28 | FX2 (continuity), the mood fix, FY3 (the players up close) | TV center 17.6, TV high 17.9, rain 18.8, follow 14.1, concourse 15.3, lounge 11.6, real 3B seat 17.4, plaza 16.6, left field 20.0, **the 400s seat 23.8** (42 fps), celebration 18.9 / 18.9; no console errors | | | | |
| 17:30 | FW6, the people and the walker | TV center 18.7 (+1.1: the middle Cast's rig passes under FOX's long lens), TV high 18.1, rain 19.0, follow 14.2, concourse 14.8, lounge 12.1, real 3B seat 17.6, plaza 16.8, left field 20.5, **the 400s seat 24.3** (41 fps), celebration 19.1 / 20.0; no console errors | | | | |

## Step 9 as published (17:58, everything merged)

| View | Frame (ms) | fps |
|---|---|---|
| TV center, the 27th | 19.8 | 51 |
| TV high, the 29th | 19.1 | 52 |
| TV high, the 27th's rain | 20.1 | 50 |
| TV follow | 15.0 | 67 |
| The 3B plaza, the 27th | 17.7 | 57 |
| The 3B concourse | 15.6 | 64 |
| Under the stands (the lounge) | 12.6 | 80 |
| A real 3B field seat | 18.8 | 53 |
| Left field, Harry the K's | 21.6 | 46 |
| **A real 400s seat behind home** | **25.4** | **39** |
| The celebration, TV high / TV center | 20.0 / 20.6 | 50 / 48 |

No console errors; 12.9 s to load. Every view at 39 fps or better against the 30 fps floor. (Step 8's, by the same measure, were its GPU column above: 21.6-27.6 ms, 36-46 fps, with its walking views lit at 4 pm.)

## Step 10

| When | Merged | TV center | TV high | follow | concourse | lounge | real 3B seat | plaza | left field | **400s seat** | celebration |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 17:58 | step 9 as published | 19.8 | 19.1 | 15.0 | 15.6 | 12.6 | 18.8 | 17.7 | 21.6 | **25.4** | 20.0 / 20.6 |
| 19:58 | FF1, the fans' MakeHuman heads | 20.2 | 19.4 | 15.4 | 15.8 | 12.9 | 19.0 | 17.3 | 21.4 | **25.3** (40 fps) | 19.8 / 20.3 |

FF1 cost ~0.3 ms in TV center and nothing measurable elsewhere; no console errors.
