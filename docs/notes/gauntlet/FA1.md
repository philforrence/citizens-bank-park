# FA1: the ways up in right field, and the Alley's edges (step 10)

Fixer FA1, 2026-10-28, branch `worktree-agent-ac1bed4eae8201853` off `ballpark` (53ba76f merged in for WA1's `test/walk-audit.mjs`). Tickets: auditor WA2's (`.claude/step10/WA2.md`) WA2-1, WA2-3 (the Alley's parts), WA2-10, WA2-11, and from WA1 (`.claude/step10/WA1.md`) WA1-1 (right field), WA1-5 (the Pavilion concourse's back) and WA1-8 (the Alley's roof stair).

**The owner:** "ensure we can walk everywhere in the stadium and that everywhere walkable (especially walking around outfield seating ...) is as it is in the stadium."

**Evidence.** WA2's sources (`.claude/ref/step10/`, its `SOURCES.md`): the Phillies' "Finding Your Seats" (201-205 "Elevator or Stairs in Ashburn Alley"; 301-305 "to the 200 level and then additional stairs to the 300 level"; 306-310 the elevator behind 112, then stairs), RateYourSeats (301-310 entered at row 7), the 2008 chart (the notches in the 300s), the 2008 guide (the Pavilion's own concourse: family restrooms behind 205 and 208), Commons 2008-03-29 2371236009 / 2372036920 (the decks in right; the Alley's rail and flower boxes running on from the pens to the corner seats). The steel is the park's outfield steel as the 2008 photos draw it (the rooftop bleachers' stair, the bridge by the 147/148 plate): maroon stringers and columns, galvanized treads and pipe rails.

**Proof by walking.** WA2's harness (`.claude/step10/wa2/harness.js`, unchanged) with FA1's walks (`fa1walks.js`), run in the page (desk jobs `before` on `ballpark` and `after` on this branch) and in Node on the real Colliders and Walker (`park.mjs` + `walk.mjs`: the field, the bowl, the concourse, the landmarks, the Alley and the 1B concourse built without drawing, 1.1 s; the seated fans aren't in Node). WA1's flood fill (`test/walk-audit.mjs`) on each job's dump. All of it (the jobs' results, the shots `shots-before/`, `shots-after/`, `shots-final/`, `shots-last/`, the fills' maps `audit-*/`, and the scripts in `scripts/`: `park.mjs`, `walk.mjs`, `fa1walks.js`, `mkjob.mjs`, `tris.mjs`, `topwalk.mjs`) is copied to the main checkout's `/Users/phillipforrence/citizens-bank-park/.claude/step10/fa1/` (and in this worktree's ignored `.claude/fa1/`).

## The walks, before and after

WA2's harness, in the page, the full park (`before`: `ballpark` at 4fec017; `last`: this branch). `n/m` is the waypoints reached; the end is (x, height, z).

| walk | before | after |
|---|---|---|
| U1 the Alley up the stair to the Pavilion's concourse and along it | 5/6, stays at 7.01 (walks under the Pavilion) | 6/6, at 17.12 |
| U3 E at the Alley's elevator, there and back | no door in reach | Alley 7.01 → Pavilion 17.12 → Alley 7.01 |
| U2 round the Pavilion's concourse, the pole, down the line to The Break (posed on it) | 8/8 (posed: unreachable) | 8/8, passing the stairs |
| U6 off the Pavilion concourse's back | falls 10.1 m to 7.01 | held at 17.12 |
| U5 off the Pavilion's NW end from its rows | held (by the fans in the page; Node: falls) | held at 13.37 (the end rail) |
| V0-V2 from the Pavilion's concourse up the three stairs into the Deck's row 7 | (no way) | 3/3 each, at 24.37 |
| V0c along row 7's cross-aisle to the aisle, up it to the Deck's walkway | (no way) | 3/3, at 32.07 |
| P1 off the Alley onto Memory Lane's platform | steps down 1.9 m to 5.11 | held at the Wall of Fame's parapet |
| P3 off the Alley over the batter's eye (x -4) | falls 7 m to 0 | held at the parapet |
| P4, P5 off the Alley's corner by 101 | fall 7 m to 0 | held at the rail |
| P3b over Monty's corner (x -16, FA2's) | falls to 0 | falls to 0 (not mine) |
| Q1 up the roof stair onto the bleachers' roof | falls 4.5 m at its top | 3/3, on the roof at 11.51 |
| Q2 off the roof's front into the Alley | falls 4.5 m | held at the rail |

WA1's flood fill (`test/walk-audit.mjs` on each job's dump; cells of 0.5 m reached on foot / walkable but never reached):

| tag | before | after |
|---|---|---|
| `pavilion` (201-211's rows) | 0 / 31 | 1,026 / 10 |
| `pavilion-concourse` | 0 / 2,254 | 2,446 / 4 |
| `pavilion-deck` (301-310's rows) | 0 / 30 | 1,697 / 4 |
| `pavilion-deck-walkway` | 0 / 2,091 | 2,449 / 9 |
| `ashburn-alley` (the roof decks) | 0 / 2,603 | 675 / 2,114 (the bleachers' roof; the other three roofs don't connect) |
| `memory-lane-platform` | 0 (chained) | 0 (chained) |
| all cells reached | 516,827 | 526,380 |
| walker falls at street level (the Alley's edges among them) | 139 | 104 |

The last job's fill also found falls of up to 2.8 m off the sides of the vomitories' flush tops onto the rows beside them; their sides are railed now (after the last job; checked in Node: `topwalk.mjs`, held both ways). The one new walker fall otherwise: the Pavilion's rows at the RF pole (94.3, 11.9, -59.7), a 4.8 m drop at a section corner where the rows' colliders leave a wedge (WA1-10's slivers, `Stands.buildTier`'s row boxes); it was unreachable before.

## Per ticket

### WA2-1 / WA1-1: the Pavilion and the Pavilion Deck reached (done for the Alley's way up and the Deck; not done: the 1B Gate's escalator, the First Base Ramp, the elevator behind 112)
- **The Alley's stair** (new `src/ballpark/PavilionWays.js`, called from `Bowl._buildUpperDecks`' Pavilion part): against the Pavilion's NW end, over the Alley's east end, a two-flight switchback from the Alley (7.01 m) to the Pavilion's concourse (17.12 m): 56 risers of 18 cm, 28 cm galvanized treads with a dark nosing strip, open risers, two maroon channel stringers a side, galvanized handrail and mid rail on posts every fourth tread; the half landing (12.07 m) and the top landing on maroon frames and columns down to the Alley; the top landing a bridge across onto the concourse's NW end. Every tread and landing a walkable collider, every side solid in pieces that follow the slope.
- **The Alley's elevator**: a precast tower behind the stair (clear of the concourse's stand at the Alley's end, which a first placement stood in), doors toward the field at both levels; a new bank in `Bowl._elevators` (`Ashburn Alley` / `Pavilion`), with the doors and green signs the infield banks have. E rides it as any other (`BallparkApp._addElevators`, unchanged).
- **The Pavilion's concourse** (WA1-5): its back (the galleries' counters and glass, drawn by Concourse and Bowl with no colliders) is a solid wall at the glass line, so you can't walk through a stand and fall 10 m; its far end at The Break railed.
- **The Pavilion Deck, entered at row 7**: the Deck's tier has an open portal in every other section (four: two in right, one at the pole, one down the line): `Stands.js`' portal (FW3's for the 400s) made a vomitory: its rows 8-12 cut out between the cheeks, a floor at row 7's level inside, its back walled, the cheeks solid, its top flush with the rows round it (a railed landing level with row 12, 2.8 m over the floor: the 400s' boxes stand 1.1 m out of their rows, and the 2008 photos show nothing standing out of the Deck's), and row 7 a cross-aisle across that section (its seats out, so the fans don't hold you in the mouth). Under each, from the Pavilion's concourse, a steel stair running along the concourse under the deck and up through the hole (40 risers of 18 cm, the same steel), stepped off sideways at its top onto the box's floor and out through the mouth; the hole railed on the floor, a dark lining round it under the soffit. Each stair climbs the way that keeps its foot on the concourse. The Deck's row colliders are 0.6 m deep (they were 3 m), so a stair passes under the rows.
- **The ends' rails**: a pipe rail along every row's end at both ends of the Pavilion and the Deck (drawn, solid), and the Deck's walkway's two ends railed.
- Four portals: three have their stairs; the one at the pole has none (the concourse curves away from a straight stair there; the stairs are kept to the concourse's front half, so there are 2 m to walk past behind them), its floor closed: an alcove off row 7. Before/after: `before-a3-pavilion-concourse.jpg` / `last-a7-vomitory-stair.jpg` (up the stair under the deck), `last-a8-vomitory-mouth.jpg` (row 7's cross-aisle at a mouth), `before-a1-...` / `last-a1-alley-east-end-to-decks.jpg` (the stair and the tower from the Alley), `before-b2-...` / `last-b2-deck-end-from-alley.jpg`, `before-b1-...` / `last-b1-as-2371236009.jpg` (as the 2008 photo).
- **Not done**: the First Base Gate's escalator pair and the First Base Ramp (the 2008 guide's ways up to the Pavilion level from the 1B side), and the elevator behind 112 (306-310). The Pavilion's concourse is continuous from the Alley's stair round the pole to The Break (walk `U2`), so 206-211 and 306-310 are reached from the Alley today; the 1B side's own ways up are the next piece (the LF escalator's builder, `leftfield/Escalator.js`, would serve the 1B Gate's with its own sign text; FA2 owns that file).

### WA2-3: the Alley's edges (done for the Alley's parts)
- **Over the batter's eye**: the brick parapet along the batter's eye's back (Memory Lane's panels on it) is solid from Monty's corner (x -13.1) to the rail at the pens' west end (`AshburnAlley2008._railOverPens`, `alley-eye-parapet`). Walk `P3` (x -4) now stops at the parapet; before it fell 7 m. West of x -13.1 (over Monty's seats, `P3b`) is FA2's (`_pitOutline`, Monty.js): it still falls.
- **The corner by 101**: the rail with its mesh, cap, posts and window boxes runs on from the pens' east end along the pit's edge to 101's back corner, as the 2008 photo has it (2371236009: the rail and the flowers unbroken from the pens to the corner seats). Walks `P4`, `P5` stop at it; before they fell into the gap by the upper pen.

### WA2-11: Memory Lane (done)
- The Wall of Fame's parapet along the Alley's edge is solid (`MemoryLane.js`, `wall-of-fame-parapet`): walk `P1` stops at it; before it stepped off onto the platform 1.9 m below. The platform's 11-tread stair is walkable now; the chain at its head was already solid (closed during the game, as in 2008).

### WA1-8: the Alley's roof stair (done)
- The stair's landing is walkable (it was drawn only: the stair ended in a 4.5 m fall into the gap between the buildings), railed on its open sides; the stair's sides solid; each roof deck's front rail (drawn by Landmarks) solid along the Alley. Walk `Q1` climbs onto the roof by the rooftop bleachers; `Q2` stops at the front rail (before: fell 4.5 m into the Alley).
- Left: the rooftop bleachers' benches have no colliders (you walk through them), and their back row is 2.65 m over the roof where the stair lands, so the bleachers are reached only from their front, which has no walkway.

### WA2-10: the decks' NW end (partly)
- The ends are railed as an open deck's are (a pipe rail and mid rail along every row's end, posts), and the Alley's stair and elevator tower now stand at the Pavilion's end. The end caps themselves (Stands.js closes an upper tier's stepped profile down to its soffit) are as they were: still a solid precast end, not the open steel of the 2008 photo. WA2's reading of the photo was that the Deck runs on to the bell; held against 2372036920 the deck with the bunting fascia and the GREAT RUN HOME board under it, which runs on over the rooftop bleachers to the bell tower, is the Pavilion (the Deck, with the McDonald's fascia, stops short of it). Ours stops both at about the 369 mark.

## Files
- New: `src/ballpark/PavilionWays.js` (the stairs, landings, the tower, rails, walls, the vomitory stairs, their wells).
- `src/ballpark/Bowl.js`: in `_buildUpperDecks`' Pavilion part, the Deck's `portals` and the call to `pavilionWays()`; in `_elevators`, the outfield banks' doors and stops; one import. All in `---- FA1` blocks.
- `src/ballpark/Stands.js` (outside my list, marked `---- FA1`, additive): open portals (`portals.open`): the rows cut between the cheeks, the floor, the back wall, the cheeks' colliders, row 7 a cross-aisle, 0.6 m row colliders for that tier, `tier._portals`. Only the Pavilion Deck sets `open`; the 400s' portals (FW3) are unchanged.
- `src/ballpark/places/AshburnAlley2008.js`: the parapet's and the rail's colliders and the rail's new stretch (`_railOverPens`), the roof stair's landing and rails (`_roofStair`).
- `src/ballpark/places/alley/MemoryLane.js`: the Wall of Fame parapet's collider, the stair's treads.

## What the merger must know
- `Stands.js`: the tread code is now a local `slab()` called once, or twice either side of an open portal; behaviour is the same for every tier without `portals.open`.
- `Bowl.elevators` has a fourth bank (`Ashburn Alley` / `Pavilion`) with two stops; anything that assumes four stops a bank should read `stops.length` (`BallparkApp._addElevators` already does).
- The fans: row 7 of the Deck's four portal sections has no seats (about 90 fewer fans), and the portal boxes take their seats as the 400s' do.
- FA2 is building the left side's ways up; the escalator builder they own would be the natural one for the 1B Gate.

## Counts

- **What FA1 draws:** 5 meshes (maroon steel, galvanized treads, galvanized pipe, precast, the wells' lining), 6,440 triangles in all, static and batched by material with the rest; the Deck's portal boxes are the stands' own concrete. 440 colliders (they cost nothing on the GPU).
- **`meshRenderer.stats`, TV center (play 20), 1280 × 800, full park:** before (`ballpark` at 4fec017, which has FF2's faces this branch doesn't) 398 draws, 2,524,820 triangles, 769 pipelines; this branch, three runs: 314 / 2,677,522 / 779, 351 / 2,701,803 / 779, 352 / 2,700,139 / 779 (the last job). The draws move by ±40 from run to run with the places' people; the triangle difference is FF1 vs FF2's heads, not FA1 (FA1's 6.4k are in right field, behind FOX's center field camera). Not profiled (the coordinator does).
- **No console errors** in any job; the full park loads in 12-14 s.
- `npm test` passes; `node test/continuity.mjs`: the clock's hash 801248349, duration 3785.503, as before.

## Noticed elsewhere
- The Pavilion Deck in right-center as the 2008 photo has it: the McDonald's fascia's deck is the Deck and the bunting fascia with the GREAT RUN HOME board under it the Pavilion; in the photo the Pavilion, not the Deck, runs on over the rooftop bleachers to the bell tower. Both of ours end at about the 369 mark.
- The rooftop bleachers' benches have no colliders; their back row is 2.65 m over the roof where the stair lands.
- `test/walk-audit.mjs` assumed four stops a bank; it reads any size now (two lines, marked).
- The 1B side: the guide's First Base Gate escalator "to the Pavilion level" and the First Base Ramp are still signs only (`concourse1b/Prints.js`); with the Alley's stair the Pavilion is reached, but only from the Alley.
