# FA2: the left side's way up and the outfield seats' edges (step 10)

Fixer FA2, 2026-10-28, branch `worktree-agent-a96a80373e75aa872`, off `ballpark` at d1a8f54, with `ballpark`'s 8c2671b merged in (WA1's walk audit). The tickets are auditor WA2's (`.claude/step10/WA2.md`): WA2-2, WA2-7, WA2-6, and WA2-3's left field part, in that order. WA1's left-side findings (WA1-1's left field deck, WA1-3, WA1-9, WA1-4's flower bed, WA1-5's Arcade back) are the same places, and they are covered here too.

## How it was proved: the walks

- **WA2's harness in Node** (`.claude/fa2/` in this worktree, gitignored). `park.mjs` builds the park's walkable parts with no drawing: Colliders, Field, Bowl with its crowd, Exterior, Landmarks, Concourse, and the alley, leftfield and terrace places. It uses FW3's stubs (headless Dawn and a blank 2D canvas). It then runs the real `Walker` on a stubbed input, with `BallparkApp._pushFromFans` and `_addElevators` borrowed, and evaluates WA2's own `harness.js` and walk files against it. **Parity:** on the base tree (`.claude/fa2/base/`, exported from 8c2671b), WA2's left-side walks end where WA2's page runs ended (L1 at (−52.05, 0, −92.56), L3 at (−44.52, 0, −101.42), M1, M2, A1, A2). One thing to know: in Node, the scene's matrices must be updated before the fans' grid is built.
- **WA1's flood fill** (`test/walk-audit.mjs`) ran on a dump from the last desk job (full park) and is compared with WA1's `summary.json` below.
- **Two desk jobs**, full park, 800 × 500, no console errors. Job 1 (`.claude/fa2/shots1/`) caught a NaN bug, described under WA2-2. Job 2 (`.claude/fa2/shots2/`) has every ticket's after shot, TV center, and the walk dump. Before shots are WA2's own in `/Users/phillipforrence/citizens-bank-park/.claude/step10/wa2/shots/`: `wa2-1e`, `wa2-2h` and `wa2-1d` (Porch), `wa2-1i`, `wa2-2b` and `wa2-3d` (Monty), `wa2-2d` (LF wall top).

### WA2's left-side walks, before (base tree) and after

| walk | before | after |
|---|---|---|
| L1 LF aisle down to the field | 2/4, fell into the 2 m gap: end (−52.05, **0**, −92.56) | 2/4, held on the front row by the guard rail: (−53, **3.6**, −93.5) |
| L3 LF front row along | 0/1, pushed off into the gap: (−44.52, **0**, −101.42) | stays on the front row at 3.6: (−52.56, 3.6, −93.94) |
| L2 concourse under the Porch to the Alley | 7/7 | 7/7 |
| H1 concourse to the scoreboard's base | 2/2 (walked through Harry's house) | 0/2: the house's walls stop you (go round it: G1 3/3 to the gate's square) |
| M1 Alley into Monty's seats | 1/3, into the pit: (−22, **0**, −116.77) | 2/3, down 146 to its front row: (−22, **4.26**, −114.88); the 3rd waypoint is past the wall |
| M2 Alley toward 409 | 2/3, pit (−13.98, 0, −122.05) | the same. It falls over the **batter's eye's** edge (pit outline 409→401), which is FA1's ticket, not through Monty |
| A1, A2 from the 3B suite / club stops toward the Arcade | never on the Arcade (end at 7.01) | the same: those routes have no way across; the Arcade is now reached by the escalator and the ramp (below) |

### The new walks (all in Node, `porch.js`, `arcade.js`, `monty.js`; results in `.claude/fa2/*-N.txt`)

| walk | result |
|---|---|
| E1 up the east stair from the Alley (both flights, the bridge, onto the walkway) | 7/7, 7.01 → 15.41, no drops |
| E2 the walkway, east end to west end | 8/8, at 15.41 the whole way |
| W1 down the west stair; W2 back up from the corner's concourse | 6/6; 7/7 |
| The elevator behind 141 | E at the concourse ("Elevator to the Scoreboard Porch") puts you on the walkway at 15.41; up there it offers the main concourse |
| P1 / P2 from the walkway down a Porch aisle to row 2, and back up | 3/3; 3/3 |
| U1 walkway → patio (by its east side) → Harry's upstairs door → the bar | 6/6 |
| X1 off the walkway's back; X2 off its west end | stopped by the rails |
| Escalator: walk up it, step off, cross to the Arcade's bridge, along it onto the Arcade walkway | 11/11, 7.01 → 16.12 |
| Ride: stand on the escalator's foot, no keys, for 40 s | carried to its top: (−118.24, 15.9, −57.96) |
| R1 up the ramp to the Arcade landing, across to the escalator's landing, to the Arcade | 17/17; R2 on up to its top (24.69): 13/13 |
| Off the ramp's side; off the bridge's side; through the Arcade's back wall | all stopped |
| M3 / M4 Alley down the 146/147 aisle to the front row, and back up | 3/3; 3/3 |
| M5 down the 147/148 aisle | 3/3 |
| M6 along the standing-room rail on the Alley | stays at 7.01 |

### WA1's flood fill, before (WA1's run) and after (this branch's dump)

Cells reached on foot, per tag:

| tag | before | after |
|---|---|---|
| `lf-deck` (the Porch, 241-245) | **0** reached, 26 unreached | **217** reached, 0 unreached |
| `monty-seats` (and −1, −2, −3) | 26; blocks 1–3 none | 255 (one tier now) |
| `porch-walkway` / `harrys-upstairs` / `harrys-patio` | (no colliders) | 1,015 / 991 / 562 |
| `porch-stair-east` / `-west` | – | 98 / 96 |
| `lf-ramp` / `escalator` / `arcade-bridge` | (no colliders) | 2,726 / 135 / 384 |
| `arcade-concourse` | 966 (reached only by falling off the club seats' end) | 952, now by the escalator and the ramp |
| `left-field-seats` | 784 | 816 |

- **Falls.** `monty-seats` went from 15 edges (max 6.4 m) to 1 (4.3 m). `arcade` went from 52 to 29. `arcade-concourse` went from 185 edges (9.1 m) to 0. `left-field-seats` went from 149 to 111.
- **New edges** where a walker who *stops* exactly on an edge falls: `porch-walkway` 34 (8.4 m), `lf-deck` 34 (12.6 m at (−82.7, −87.3), the Porch's west kink), `lf-ramp` 14 (17.7 m, its top landing), `escalator-landing` 3. The walks above cross these places without falling. **Not yet checked** whether they're slivers (the audit's `walkSim` decides that); the next round should.
- **Totals:** walk fill 521,779 nodes (WA1: 516,827); boxes 3,453 → 4,100; fans 42,150 → 42,396.
- **Run it again with:**
  ```
  node test/walk-audit.mjs analyze .claude/fa2/job2-clean.json outDir
  ```

## Per ticket

### WA2-2: the Scoreboard Porch (241-245) and Harry the K's upstairs (done)

**What was wrong.** The Porch couldn't be reached at all: no floor behind its top row, no stairs, no colliders upstairs.

**What I built** (`places/leftfield/Access.js`, new):
- **The walkway** behind the Porch's top row, at the patio's height (15.41), the deck's whole length and 1.8 m past each end. It follows the deck's real back line (Bowl's `lf-deck` offset). Harry's old line was fitted by eye, ran 1.6 m into the top two rows at the pole's end, and only spanned the house. The outline:
  - 3 m deep where it's open;
  - up to the patio's rail along Harry's;
  - up to the house's face at the patio's two sides, which is how you get onto the patio and into the upstairs by its glass doors.
- **Its rails.** A galvanized pipe rail along its front, over the top row, open at each of the deck's five aisles, with a half step up from the top row there (painted nosing). A picket rail along its open back.
- **The Porch's back.** It is now a 0.44 m riser up to the walkway (Bowl.js: the `lf-deck` tier's `back.height`, an FA2 block). It was a 1.2 m wall with nothing behind it.
- **The east stair** from the Alley's west end: two 23-riser flights (0.18 × 0.28 m) and the bridge landing between them, on maroon columns with X-bracing, maroon stringers, treads in steel pans with galvanized nosings, galvanized picket rails. This follows the March 29, 2008 photo (`alley/commons-2008-03-29-pennants-center-field.jpg`: a stair up to a bridge by the 147/148 plate).
- **The west stair**, the same, off the walkway's west end into the corner behind 141-142.
- **The elevator behind 141**, at the walkway's west end. A maroon-clad shaft with steel doors and the green sign at the concourse and at the Porch. Its E stops are added by `LeftField._lifts()` once the walker exists.
- **Colliders for Harry's:**
  - the house's walls (the downstairs bar's opening left open);
  - the bar room's back and sides, and both counters;
  - the upstairs floor, back and sides, and the glass front with its two doors;
  - the patio's floor, its rail, the heaters and the high-tops.
- **The deck's two ends** got rails (they stood open over a 5–8 m drop).

**Evidence:** "Finding Your Seats" (241-245: "Elevator behind sect 141 or Stairs on either side of Scoreboard"); the 2008 photo above; `leftfield/commons-2008-03-29-lf-scoreboard-porch-140s-whole-from-3b-side.jpg` (the walkway with people standing along it, the rail at the rows' back, the stairs off both ends); `flickr-2009-05-13-harrys-center-awning-patio-porch-seats-stairs.jpg`.

**After shots** (`shots2/`): `b-porch-whole-from-3b-upper`, `c-east-stair-from-alley`, `d-west-stair-elevator-from-corner`, `e-`/`f-walkway-*`, `g-patio-and-upstairs-door`, `h-east-stair-top-landing`. The Porch itself is unchanged in rows: WA2 has 11 real rows (241 1-11), ours are 8.

**A bug found and fixed on the way.** Job 1's shots had lost every one of the corner's Kit things: Harry's furniture, the stairs, the Gulf disc. A zero-length `Kit.bar()` (one rail of the landing) made a NaN vertex, which made the bounding box NaN, which culled the whole `leftfield-things` mesh. `Kit.bar` now skips zero lengths (an FA2 block).

### WA2-7: the Arcade (233-237) (done)

**What was wrong.** The LF ramp and the escalator were drawn but had no colliders, and nothing reached the Arcade.

**What I built:**
- **The ramp** (`Ramp.js`, FA2 block):
  - each run is a floor stepping 9 cm a metre;
  - its rails are solid (1.8 m colliders, because a jump clears 1.7);
  - each landing is a floor with rails round its open end and sides;
  - the Arcade landing's end rail is open where FW3's bridge from the escalator lands. The drawn rail is open there too; it used to run across the bridge.
- **The escalator** (`Arcade.js`, new; the site from `Escalator.js`'s new `escalatorSite()`):
  - its band's treads (0.35 m, 0.2 m risers), its flats and balustrades, and FW3's landing as colliders;
  - **it carries you up** at its steps' 0.5 m/s (`ride()`, called from `LeftField.update`).
- **The Arcade's bridge.** The Arcade walkway's line carried on as a steel bridge (concrete deck, maroon girder and posts, galvanized picket rails) to beside the escalator's top. A 4 m cross bridge joins FW3's landing, whose rail on that side is now open (`Escalator.js`, FA2 block).
- **The Arcade walkway's back** (the stands' wall), its 3B end, and the Arcade rows' two ends are now solid. You used to walk through Brewerytown and fall 9 m (WA1-5, W05).

**Evidence:** the 2008 guide (the LF escalator "Takes guests to the Arcade seating area and the West Hall of Fame Club Entrance"; the LF Ramp to the "Suite Level, Hall of Fame Club, Arcade seating and Terrace Level"). FW3's own description has "a bridge to the Arcade's walkway".

**After shots:** `i-escalator-bridge-from-plaza`, `j-on-arcade-bridge-to-escalator`, `k-ramp-run`.

### WA2-6: Monty's Angle (146-148) (done, at 12 rows)

**What was wrong.** Monty's Angle was four strips of 2–8 rows, three of them with no way in, over an open pit you dropped into from the Alley.

**What I built** (`Monty.js`, rewritten) — one tier, the 2008 chart's three sections:
- **146** is the wedge at the jog. Its rows open out to 145's end (a lead segment with no rows mitres it onto the 140s' end line, so there's no wedge of pit between them).
- **147 and 148** run along the taller wall, their front rows under its top (4.6 and 4.9 m; the wall reaches 5.79).
- **Twelve rows of the 140s' 0.8 m**, each section climbing from its own wall to the Alley's level. They are entered from the Alley by their own aisles.
- **The pit now closes on their back row** (`Bowl._pitOutline`, FA2 block, and the exported `MONTY` constant), so the Alley's floor runs right up to the top row.
- **A standing-room rail along the top**: galvanized, with a steel counter, open at the two aisle heads (Commons 2004-06-29: the rail behind 146-148, a stair down into them).
- **Rails at 145's seam, at 148's end, and on the short bit of Alley edge from 148's back to the batter's eye's corner.**
- **The wall-top rail** now has colliders that step up with the wall.
- **Each row's tread under its whole width.** Stands' boxes cover only the shorter edge of a mitred row, and at 381 the rows turn 45°, so the 146/147 aisle was a crack 0.66 m wide all the way down. This is FA3's Stands.js crack problem; I worked around it locally.
- **Fans:** 447 seated, up from about 200, through the crowd's normal seat lists.

**Not as the chart:** the real sections run 24/18/13 rows (146 rows 1-24). Ours are 12, as deep as the Alley's west end allows without moving its stands and carts (the back is 10.2 m behind the wall; it was 7).

**After shots:** `l-monty-from-alley`, `m-monty-from-above` (against WA2's `wa2-2b`, the brick slope), `n-monty-as-2004-sro`.

### WA2-3, the left field part: the 2 m gap behind the LF wall (done)

**What was wrong.** The 2 m behind the LF wall had nothing under it; off the front row you fell into the gap and stayed at y 0.

**What I built** (in `Monty.js`, FA2 block): Details2008's trough and cap are now a floor (the soil a hand under the cap); a concrete sill closes the 28 cm between the trough's curb and the 140s' first riser at the row's height; the guard rail is solid to 1.1 m over the front row. L1 and L3 stay on the front row now.

**After shot:** `o-lf-wall-top-front-row` (against WA2's `wa2-2d`).

## Counts

`engine.meshRenderer.stats`, read in a shot's `js`, which reports the view rendered just before it:

| view | before | after |
|---|---|---|
| TV center, play 20 | FF1's PERF.md: no counts recorded here | 500 draws, 3,528,067 triangles (job 2) |
| From the LF wall top (`o`) | – | 482 draws, 3,080,158 triangles |
| Full park on load (job 1, before the NaN fix) | – | 944 draws |

- **Pipelines:** 769, unchanged. Nothing new draws on its own: the stairs, rails, elevator, bridge and counters are all in the corner's one Kit mesh (`leftfield-things`, 104,124 → 145,338 vertices, about +14,000 triangles), and the walkway slab is one mesh.
- **Monty's fans** go through the crowd's chunks (+246 fans).
- **Colliders:** +647 boxes and +23 cylinders. That's CPU per walker step, about 18% more boxes to scan; the GPU isn't involved.
- **Per frame:** `ride()` is a few multiplies; `_lifts()` runs once.

## What the merger must know

- **Bowl.js:** two FA2 blocks, nothing else.
  - The `lf-deck` tier's `back.height`: the Porch's back is a riser up to the walkway.
  - `_pitOutline`'s Monty part, plus the exported `MONTY` constant and an `intersect()` helper near `T400`. The pit outline now has one more point over 387→381→409. AshburnAlley2008's promenade follows the pit's edge (`pitEdgeZ`), so the Alley's floor moves out to Monty's back row by itself. Nothing in the Alley stands in the new seats: the carts are at z −132.5 and −132.8, and 148's back corner is at (−18.0, −131.4).
- **FA1's area:**
  - M2 still falls over the batter's eye's edge (pit 409→401), and the Alley rail there is FA1's.
  - I railed only the stretch from 148's back corner to the batter's eye's corner, (−18.0, −131.4) → (−13.13, −131.74).
  - I didn't touch `_elevators`. The elevator behind 141 is the place's own: interactables pushed by `LeftField._lifts()`, each with `to: { x, y, z }` (field).
- **WA1's audit:** `test/walk-audit.mjs` and `test/walk-audit-dump.js` (WA1's, on `ballpark`) assumed every interactable is a stop in one of the bowl's 4-stop banks, and crashed on mine. Now the dump records `to`, and the fill and the elevator report use it, or skip a stop that has none. These are small FA2-marked edits.
- **The escalator:** `escalatorSite()` (Escalator.js) repeats `Terrace._escalator`'s placement formula, because left field is built before the Terrace. If anyone moves the escalator in Terrace.js, move the site too.
- **FA3 (Stands.js cracks):** Monty adds its own full-width row boxes on top of Stands' boxes. Once Stands covers mitred rows itself, they're redundant but harmless.
- **The replay's clock is kept:** 801248349 / 3785.503. `npm test` passes.

## Not done / left

- **Real depth:** 146-148 at their real 24/18/13 rows (the Alley's west end would have to move), and the Porch at 11 rows.
- **The elevator behind 137** to the Arcade (the guide's), and bridges from the ramp's suite, club and Terrace landings. The ramp's top landing still ends 20 m from the Terrace walkway's LF end, which still drops 17.7 m (WA1-5).
- **The flood fill's new edge falls** listed above, to be checked with its `walkSim`.
- **The 3B suite and club stops** have no way along to the Arcade (A1, A2), as before.
- **No people** on the new stairs and walkway beyond Harry's own (`porchBack` spots); the escalator's riders are FW3's.

## Noticed elsewhere

- **In Node**, `BallparkApp._pushFromFans` builds its grid from `matrixWorld`. Anyone porting it must update the scene's matrices first, or the fans land in the wrong place.
- **The Porch's west kink** (−82.7, −87.3) shows 12.6 m edge falls in the fill: the deck's front-wall boxes at the convex kink. Check with FA3's tier-front work.
