# FI1: the concourse as built (gauntlet round 1)

Fixer FI1, 2026-10-28, branch `worktree-agent-a66bad4f282511e69` (off `ballpark` at 214f49c). Tickets from critic CI (`.claude/gauntlet/r1/CI.md`). Four desk jobs, all on the full park, no console errors.

**Shots.** Before: the critic's own shots, taken on the same code (`.claude/gauntlet/r1/CI/shots1..3/`); the framings below are theirs. After: in this worktree's ignored `.claude/fi1/shots1..4/` (the isolated worktree couldn't write to the main checkout's `.claude/gauntlet/`; copy them across if wanted). `shots4/` is the final job. Job files and outputs sit beside them (`job1..4.json`, `job2..4.out`).

## Counts

| View | Draws | Triangles | Pipelines |
|---|---|---|---|
| Ring behind home toward 3B (`01`, night), before (CI job1) | 792 | 6,133,170 | 673 |
| Same, after (job4) | 803 | 6,170,710 | 684 |
| 3B gate atrium in the 27th's rain (`04`), after | 591 | 6,625,446 | 684 |
| TV center, play 20, after | 448 | 6,057,444 | 684 |

Local lights: 147 sources (the domes), 12 active, which is the cap (`LocalLights` MAX). Before, the nearest plaza lamps already filled those slots, because the picker takes the nearest whatever the range, so the per-pixel light loop is no longer than before. The concourse builds in ~45-50 ms (was ~44).

## Per ticket

**CI-1, the ceiling (done).**
- `SOFFIT_WGSL` (Stands.js, the marked block only):
  - It was a pale, self-lit deck with a grid of strip lamps.
  - Now it's dark galvanized ribbed deck with sheet-to-sheet mottling and faint joist lines.
  - It has no glow of its own, just a bounce lift (0.13 of albedo by day, 0.05 at night).
- New `src/ballpark/ConcourseSteel.js`, round the infield:
  - maroon wide-flange girders across the concourse at every outer column, in to the suites' back and out to the brick;
  - knee braces, a beam along the mid columns, an edge beam at the suites' back;
  - joists every 2.4 m, two white sprinkler mains and a wire cable tray on hanger rods;
  - a club-level deck filling the gap between the club concourse and the outer ring's floors (from the walkway you looked 25 m up into the 400s' rake).
- The Pavilion, the Arcade and the left field deck get raked girders, joists and domes under their soffits.
- The low suite soffit over the rail is a dark painted deck with a few downlights and one maroon beam (auds, 27 Oct 2008, behind 125).
- The HID domes:
  - The places' pendants (`Concourse3BProps.pendant`) are now prismatic domes that glow all over and blaze at the lens.
  - Domes were added in the outer bays.
  - All of them are local lights (`domeLights`, registered lazily from Concourse3B/1B `update()`), so the nearest few light the floor and the steel for real.
- Evidence: harpo42 May 2008 (129-130), ZoeR Apr 2008, docindigo76 NLCS 2009, auds 27 Oct 2008, Getty WS Game 3.
- Before/after: CI `shots1/01`, `11`, `16`, shots3 `11` against `shots4/` (`01`, `09`, `16`, `11-rf-pavilion-under-day`).

**CI-3, the gate atria's mezzanine (done).**
- The suite level's walkway along the brick, round the whole infield:
  - a grated deck on a deep maroon girder;
  - a galvanized picket rail (an alpha-cut shader, not geometry);
  - the suites' back wall faced in brick from the walkway up to the deck, washed by a row of spots (shader scallops, stronger at night).
- A bridge across each end of the Third and First Base Gates' atria, its rail open into the walkway.
- Pedro Feliz's banner hangs on the 3B home-side bridge (hcwoodward, Game 5). Rollins still hangs in front of it, as in that photo.
- Two ushers and three fans lean on the 3B bridges' rails (`Stories.gallery`, Cast figures). They're unnamed, so there's no CAST.md entry.
- Before/after: CI `shots1/04`, shots2 `09`, `25` against `shots4/04`, `09`, `25`.

**CI-4, the hole behind home (done).**
- `_stands()` no longer clears for the Suite & Club Entrance (`suite: true`). Behind 121-124 there's now a Guest Services/Tickets pair and a Market, with the elevator core between them.
- The outer ring is closed in brick along the outer columns from the 1B atrium round to the 3B atrium (the 2005 plan: a row of rooms along the facade). It has colliders, and the outer-zone steel and domes stop at it.
- Not done: the suite lobby's glass doors with an usher. The lobby is now simply behind the brick.
- Before/after: CI `shots1/14`, `22`, `23` against `shots3/23`, `shots4/x4-home-wide-29`, `22`.

**CI-7, the stands (done).**
- The unit bodies are red ground-face block (0.4 x 0.2 m with aggregate) over a dark base course, with dark roofs and white-tiled bays.
- Each brand has a die-cut sign drawn on transparent ground over its menu board, which stands above the roofline where it's tall: Hatfield's oval, Brewerytown's sunburst arch, the Creamery, Pizza, Cobblestone, the Market, the Schmitter.
- Hatfield and Brewerytown also hang out over the walkway on arms.
- The sign shader discards the cut-away and leaves painted (alpha < 1) parts unlit.
- Note: the 1B place still lays C's Market panel and Cobblestone blade over its units.

**CI-8, the columns (done, without touching Bowl.js).**
- `ConcourseSteel._columns` hides every bowl `columns` box (`visible = false`; the places still find them) and draws wide-flange columns on base plates.
- `bowl._colSteel` is repainted glossy maroon with metalness 0. This also changes the outer frame and the rear wall's steel.
- Knee braces were added at the outer and mid columns.

**CI-9, the elevators (main concourse done).**
- Each bank is a brick core up to the deck with two cars:
  - brushed stainless leaves in a frame;
  - a lit call plate and floor indicators;
  - a cream ELEVATORS sign in the 2008 colours.
- The bowl's mint-green bars are hidden at every level, and its main-level door slabs are hidden. The walker's stops are unchanged.
- The upper levels' cars are still slabs inside the suites (FI2's CI-5).

**CI-11, the restroom signs (done).** The home-plate plaque (cream, red line, navy edge, figures in red caps, braille) sits on the block beside each door at 1.3-2.0 m. The sign over the door is painted, not a lightbox.

**CI-13, the Home Stand (partly).**
- The sign is a dark bronze plaque on the brick: HOME STAND ★★ OFFICIAL PHILLIES MERCHANDISE ★★. The 3B place's hung Home Stand sheet is removed.
- The shop is 2.4 m deep, with two chrome racks of home whites and red alternates and a counter with a register.
- No shoppers or clerk yet.

**CI-19, the drink rail (done).** A red-painted apron runs under the shelf's edges on both sides.

**CI-20, the kitchens (partly).**
- The bays have geometry in depth: a stainless back counter and two pendants. The grills have a glass warmer of foil sandwiches under a red heat lamp, and the Creamery has a soft-serve machine.
- The Market's shelves are mixed goods, no longer an American flag.
- The room shader is otherwise unchanged.

**CI-21, the prices (done).**
- The anchors are from the Team Marketing Report FCI, April 2008: draft $5.00, premium $6.00, soda $3.25, hot dog $3.50. The rest are scaled ×0.88 to the quarter.
- The cart signs were scaled to match.

**CI-22, PHILADELPHIA inside (done).** The brick shader keeps the lettering to faces turned away from home plate (new `parkC` uniform, marked block in Exterior.js).

**CI-23 (done).**
- McFadden's inside door behind 127: two openings onto its bar (the taps room), with green and yellow signs.
- The Majestic Clubhouse Store's door behind 134 beside the Home Stand. Make Your Own Phanatic moved along, claiming a unit near 136.
- One tile mosaic on the brick by the 3B gate (2.4 x 1.8 m). The design is invented: a batter in pinstripes under the skyline, drawn tile by tile in canvas. Mandell's real pieces aren't on record.

**Not done:** CI-10 (the escalators), CI-12 (the Left Field Gate plaza), CI-15 (the trees), CI-17 (the home plate glass tower and script), CI-18 (only the steel and domes under the Arcade and Pavilion; their painted back walls are unchanged).

## For the merger

- **Bowl.js is untouched, but this code reaches into the bowl at build time:**
  - it hides the `columns` meshes (all levels), `elevator-sign` (all levels) and main-level `elevator-door`;
  - it repaints `bowl._colSteel`.
  
  If FB1 renames those materials or rebuilds the columns, adapt `ConcourseSteel._columns` and `Concourse._elevatorCores`.
- **The mezzanine's brick faces the suites' back wall** (Bowl's L/H07 precast, CI-16) at d = 34.06, from the suite level to the club deck. FI2's CI-5/CI-16 should open the suite corridor onto this walkway rather than build another wall.
- **Shared files touched:**
  - Stands.js: the `SOFFIT_WGSL` block only.
  - Exterior.js: one marked block.
  - The places Concourse3B.js, Concourse1B.js, Concourse3BProps.js and Concourse3BStories.js are this bundle's.
- **No image files were shipped** (everything is canvas or shader), so there's no CREDITS line. The mosaic's design is invented, and the code says so.

## Noticed elsewhere

- The concourse floor at night now reads by the domes' pools. Away from the nearest dozen lights it's dark, as in the Game 5 photos.
- The places' floor skins also paint pools, so near domes the floor is bright (dome intensity is 48; tune in `domeLights`).
- The suite-level elevator stop is still inside a suite (CI-5).
