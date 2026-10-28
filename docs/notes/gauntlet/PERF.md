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
