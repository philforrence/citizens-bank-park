# FK3: the outfield walk (step 12, round 1)

Fixer FK3, 2026-11-12, on branch `worktree-wf_ea58af0a-f20-1`, off `ballpark` at 1ce4222. The bundle: SC1-7, SC1-8, SC1-13 and SC1-14 (scout SC1, `.claude/gauntlet/s11/r1/SC1.md`), AD1-3 and AD1-11 (breaker AD1), then a walk of the outfield as a fan would and the worst thing on it fixed. All six tickets are done; the walk's fix is the Alley carts' awnings.

## How it was checked

- **On the CPU first:** `node --check` on every file I changed; `npm test` (all passed) after every ticket; `node test/continuity.mjs` (504 segments, start hash 801248349, duration 3785.503) after every ticket that touched more than one place.
- **In Node, headless** (scratch copies of FA1's `park.mjs` and WA2's walker harness, pointed at this worktree):
  - the Pavilion walkway's layout (which stand went where, the domes);
  - the walks round the Alley's elevator: up the stair, out of and in to each car's door, the stair's foot to each door, the bridge, the ride both ways;
  - the walks through the Right Field Gate's court: up the middle and both walls, across it, out of it to the Alley;
  - rays into the built park to find what the SC1-13 view and the SC1-8 aerial actually show (`outer-floors` at 24.7, `street-level` and `sidewalks` at 7.0);
  - the roof kit's units, where they landed.
- **Desk jobs** (all through `tools/gpu/desk.mjs`, owner "cbp FK3"):
  - **before** (full park, 1280 x 800, 22 shots): the stats in the two standard views, the tickets' frames, the walk.
  - **mid1** (scoped, 800 x 500, 14 shots): the first four fixes. It logged the cart awnings' shader error (`in.position_world` isn't a surface input; `in.P` is), fixed before the next.
  - **after** (full park, 1280 x 800, 25 shots): every ticket's after in its before's frame, the stats, TV center at play 20.
- **Where the shots are:** `/Users/phillipforrence/citizens-bank-park/.claude/gauntlet/s12/r1/FK3/`: `before/`, `mid1/`, `after/`.

## Per ticket

### SC1-7: the Pavilion's walkway, 60 m of blank block round the pole (done)

**What was wrong:** FW3's walkway (`Concourse.galleries`) fits its stand units only where a wall panel is at least two units long. Round the pole the wall is five panels of 8.6-9.6 m, so none took a unit: 205-208 were blank brick under a dark soffit, and the guide's stands crowded onto the straight run by the Alley (the Creamery and the Market at 203).

**The evidence:** the October 2008 concessions guide (Brewerytown "behind Sections 204, 209", Old City Creamery 205, the South Philadelphia Market 206, Fairmount Fries 208, Hatfield Grill 209) and the A-Z convenience guide (family restrooms "Pavilion, behind Sections 205 and 208").

**What I changed:** `src/ballpark/places/alley/Pavilion.js` (new), called from one marked FK3 block in `places/Terrace.js` right after `galleries()`:
- FW3's Pavilion meshes come out (their materials kept) and its Pavilion spots leave the gallery list;
- the walkway is laid out again with FW3's spacing, except that a panel with room for one unit and half a metre of block each side takes one: the curve's five panels each get a unit;
- the guide's list claims the nearest free unit in its order, through Concourse's own stand kit (`_foodUnit`, `_pairUnit`, the same materials, the same signs). The result: Brewerytown 204, the Creamery 205, the Market 206, the family restrooms 206 and 207 (on the curve: the nearest free units to the guide's 205 and 208 once the Creamery and the Market have 205 and 206; this said "205 and 208" until the repair), Fairmount Fries 208, Brewerytown 209, Hatfield 210 (the nearest free to 209), FW3's restrooms at 202 and the second Market at 211 (no 2008 source for it); plain bays (a steel service door, a poster frame) between;
- the stands' staff and lines come back through the gallery spots terrace/People.js serves (7 food spots);
- 17 HID domes (ConcourseSteel's `hidDome`) hung from the Deck's underside down the walkway's middle every 9 m, lit as local lights (registered once from `AshburnAlley2008.update`). The walkway had been lit by spill only.

**Before / after:** `before/sc1-7-along.jpg`, `sc1-7-s22.jpg`, `sc1-7-back.jpg` against `after/` (same frames).

**What's left:** the Pavilion walkway's people are FW3's (TerracePeople); the new units' lines are as dense as the straight run's.

### SC1-8: the court inside the Right Field Gate, a bare slab in the dark (done)

**What it is:** rays from the scout's frames show it: the court is `street-level` slab, open to the sky, 37 m between two 6.5 m facade walls (x 93.5 and 131.2) and 57 m from the gate's line north to where it passes under the Pavilion to the Alley. The "terracotta box" is the west wall: the footprint's notch, with the Alley's outside sidewalks behind it.

**The evidence:** the scout's (the 2008 chart, the October 2008 guide's Games of Baseball "near the Right Field Gate"); the Alley's 2008 photos for what the Alley is dressed in (commons 2008-03-29; newballpark.org, 20 Jun 2008, at night, downloaded to `.claude/ref/gauntlet/outfield-fk3/`); gf's 27 Oct 2008 photo of the "Welcome to World Series Game 5" placards on a gate's grid.

**What I changed:** `src/ballpark/places/alley/Gate.js` (new), built by `AshburnAlley2008` before its people are batched:
- the floor: the Alley's red clay pavers in a running bond, in panels framed by 3 m concrete bands on a 12 m grid and a 2 m concrete border, worn down the middle, gum, the night's litter, puddles and rings on the 27th, warm pools under the lamps;
- eight lamp posts as the Alley's (Landmarks.js): a grey pole on a base, the cross arm, a PA horn, a frosted lantern under a flat grey disc; lit after dark, each a local light;
- six benches along the walls (steel ends, wood slats and back), four round concrete planters with shrubs and late mums;
- six red cans with blue recycling bins and a programs and towels cart (Fair's own, added to its lists);
- three "Welcome to World Series Game 5" placards zip-tied to the gate's grid, facing in (the Third Base Gate's design);
- four 2008 World Series banners on the walls, two each side; the park's green wayfinding sign by the passage: ASHBURN ALLEY, SECTIONS 101-112 and 140-148, PAVILION 201-211 and the ELEVATOR;
- people: two ushers and a guard inside the turnstiles, a family's photo under the canopy (the 29th), two friends waiting, a man on a bench (the 29th). The Alley's people's bounding sphere grows to take them in.

**Before / after:** `before/sc1-8-s07.jpg`, `sc1-8-aerial.jpg`, `sc1-8-other-way.jpg`, `sc1-8-from-alley.jpg` against `after/` (same frames), and `after/sc1-8-gate-in.jpg`, `after/sc1-8-rain.jpg`.

**What's left:** the gate's crowd coming in on the 29th's evening (the people here stand; nobody walks in); the turnstiles' inside faces are Exterior's and untouched.

### SC1-13: the roofs below the Terrace's LF end, bare grey slabs (done)

**What it is:** the ring's top at the Terrace's level (`outer-floors` at 24.7, seen over the Terrace concourse's back rail). FW3 had given it a membrane, but faint: it read as the concourse floor.

**The evidence:** none for this roof (the scout found none); common sense, as the scout's fix asks, and the park's other flat roofs.

**What I changed:** one marked FK3 block in `Bowl._outerRing`, and a one-line hook in FW3's roof branch of `outer-floors`' shader:
- the membrane: pale single-ply in 3 m sheets, a lighter lap and a fine weld line at each, staggered end laps every 9 m, drains on a 12 m grid with grime gathered round them and standing water, FW3's walkway pads; its sheen and darkening in the rain (the material is DRY, so the roof's branch does it itself);
- rooftop units every ~21 m where the roof is 8 m deep, 60 % of the way out: air handlers (louvred grilles, panel seams, grime) and pairs of condensers (a fan guard in the top), all on membrane-wrapped curbs, their conduit on sleepers back to the building (16 units round the ring);
- a dark bronze metal coping along the edge, a drip down its face.

No colliders: nobody goes out there.

**Before / after:** `before/sc1-13-s19b.jpg` against `after/sc1-13-s19b.jpg`, and `after/sc1-13-aerial.jpg`.

### SC1-14: Ashburn Alley's furled umbrellas, flat paper cones (done)

**The evidence:** the 2008 photo of Bull's plaza (commons 2008-03-29): eight-panel market umbrellas, red and white, the Phillies script on the white panels, some furled in the wind.

**What I changed:** `alley/Bulls.js`, one marked block:
- open: a canopy 1.35 m out and 0.42 m down to the ribs' tips, convex, each panel's cloth sagging between its ribs; a scalloped valance; eight ribs, eight stretchers, the runner and the finial;
- furled: the cloth gathered round the pole from the hub down past a tie to a loose hem, eight folds with the ribs in their valleys, a little twist;
- the white panels drawn with the script (mirrored so it reads from outside, as printed cloth does), a red piping at the rim and the hem; the weave and the grime toward the hem; wet fabric in the rain.

**Before / after:** `before/sc1-14-s08.jpg` against `after/sc1-14-s08.jpg`; `mid1/sc1-14-under.jpg` and `after/sc1-14-close.jpg` close to.

### AD1-3: the Alley's elevator tower blocked by its own stair (done)

**What was wrong:** Concourse (FI1) builds every bank's brick core at its street stop: 6.4 m wide, two cars with stainless doors at s -4.65 and -1.85 (in the frame along the Pavilion's front). FA1's stair didn't know about it: the lower flight (s -3.45 to -2.05) put its stringer and rail across the right-hand car's door, and the top landing's back column stood 15 cm in front of the left-hand car's door.

**What I changed:** `PavilionWays.js` (FA1's, mine for this step):
- the lower flight moved 0.5 m toward -s and its half landing widened 0.5 m with it, so the flight's foot is on the pier between the two cars (the flight now s -3.95 to -2.55). Its treads stop 0.12 m short of each car opening (s -5.23..-4.07, -2.43..-1.27) and its stringers' outer faces are flush with the openings' edges: clear, but with no margin (this said "0.4 m clear" until the repair). It widened the well between the two flights from 0.3 to 0.8 m, and the half landing had no rail across it: a 5 m fall to the Alley, railed in the repair (below);
- the bridge (the top landing): its back edge carried on the core, no columns there; its two front columns at s -5.6 and -0.09, clear of both doors; it runs the whole of the core's face, s -5.75 to 0.06;
- the d1 rail along its back is gone: the tower's face is there now.

**Walked:** up the stair to the Pavilion's concourse, out of each car's door to the field side, in to each from the Alley and from the stair's foot, the bridge to the upper door, the ride both ways (all reached, no falls).

**Before / after:** `before/ad1-3-wide.jpg`, `ad1-3-door.jpg`, `ad1-3-from-alley.jpg` against `after/`; `after/ad1-3-bridge.jpg`.

### AD1-11: the Pavilion elevator tower's face dissolving from brick to precast (done)

**What was wrong:** FA1's precast tower (2.5 x 2.6 m, from the street to 20.5) and Concourse's brick core shared their front face, so the two fought in a ragged noise edge up the middle of it.

**What I changed:** FA1's tower is now the core's head: the storey of the bridge and the machine room over it, from the bridge's underside (16.8) to 20.5, over the whole of the core's footprint and 5 cm proud of the brick all round (its back was 15 cm proud until the repair), a cast band at its foot and a reveal under the cap. Below it the brick core is the tower. Its collider covers the head only (the core's own covers the street).

**Before / after:** `before/ad1-11-face.jpg` against `after/ad1-11-face.jpg`.

### The walk: the Alley carts' awnings (done)

**The walk:** the LF corner on the 27th, Bull's on the 29th, behind the batter's eye on the 27th, the pens on the 29th, the RF end on the 27th, back west, the rail over the pens (`before/walk-1` to `walk-7`).

**The worst thing:** every cart's awning (the water ice, the cotton candy, the beer, the programs, the funnel cakes) was six loose 6 cm slats with nothing under them: from the cart lines you looked up through a set of bars. The Alley's 2008 photos have striped cloth awnings and umbrellas over the carts.

**What I changed:** `alley/Fair.js`: each awning a striped cloth on its frame: a low gable, the stripes running over it front to back (the cart's colour and white), a scalloped valance round all four sides, the ridge and eave rails; the cloth's weave, the valance a shade darker, wet in the rain.

**Before / after:** `before/walk-3-eye-27.jpg`, `walk-5-rf-end-27.jpg`, `ad1-3-from-alley.jpg` against `after/`; `after/walk-cart-close.jpg`.

## The counts

**Superseded: see the Repair's counts below.** This table is off by one shot (the sync read returns the previous shot's frame: its first row is the page's start view, its second the Alley view), and it has no Harry's or TV view.

`JSON.stringify(__app.engine.meshRenderer.stats)` at play 60, full park, 1280 x 800, in the two standard views (the before and after desk jobs):

| View | Before | After | Change |
|---|---|---|---|
| eye (60, 9, -110) to (20, 6, -100) | draws 954, triangles 3,591,499, pipelines 783, occluded 324 | draws 961, triangles 3,610,655, pipelines 791, occluded 325 | +7 draws, +19,156 triangles, +8 pipelines |
| eye (-95, 9, -95) to (-60, 4, -60) | draws 946, triangles 5,123,411, pipelines 783, occluded 42 | draws 951, triangles 5,140,575, pipelines 791, occluded 42 | +5 draws, +17,164 triangles, +8 pipelines |

The new meshes: the walkway's domes (one mesh), the gate's kit, floor and signs (three), the roof units (one), the new Pavilion stand units, and the umbrellas and awnings in place of what they replace. The new pipelines are mostly the new materials (the court, its signs, its kit, the roof units, the awnings' cloth, the umbrellas' cloth); I didn't trace the other two. The after job logged no console errors. Speed risk: low (under 1 % more draws and triangles in either view).

## Walking: colliders added, moved or removed

- **Added** (`rf-gate-court`, the Right Field Gate's court): eight lamp-post cylinders (r 0.2, 7.5 m), four planter cylinders (r 1.0, 0.66 m), two sign-post cylinders (r 0.08), six bench boxes (0.6 x 1.9 x 0.9 m).
- **Moved** (FA1's, `PavilionWays.js`):
  - the lower flight's treads and sides 0.5 m toward -s, the half landing widened 0.5 m toward -s with them (`fa1-landing` at 12.07, s -3.95..-0.3);
  - the bridge (`fa1-landing` at 17.12): s -4.6..0.06 is now -5.75..0.06, d 11..13.55;
  - its columns (`fa1-post`): (-4.45, 11.15), (-0.09, 11.15), (-4.45, 13.45), (-0.09, 13.45) are now (-5.6, 11.15) and (-0.09, 11.15);
  - the tower (`fa1-elevator`): was s -4.5..-2.0, d 13.6..16.2, y 7.01..20.52; now s -6.5..0, d 13.55..17.85, y 16.82..20.52 (the brick core's own collider holds the street; d1 was 17.95 until the repair).
- **Removed:** the bridge's rail along its back edge (`'d1:-1.9:0.06'`), now against the tower's face.
- **Added in the repair:** the half landing's rail across the well between the flights (`'d1:-2.55:-1.75'`, an `fa1-rail` box at 12.07).
- No route is closed: every walk above reaches its end. (But the half landing's well was a 5 m fall until the repair: see below.)

## Files outside mine (small, marked)

- `src/ballpark/places/Terrace.js`: an import and one FK3 block after `galleries()` (the Pavilion walkway).
- `src/ballpark/Bowl.js`: one FK3 block in `_outerRing` (the roof) and a one-line hook (`${ roofWGSL }`) in FW3's roof branch.

## Noticed elsewhere

- **The Alley elevator's upper door** (at the bridge, the Pavilion's level) is Bowl's plain grey slab, no frame, no sign: Concourse hides every `elevator-sign` above the street. The street doors have their ELEVATORS sign; the upper one should have a frame and a small sign too (Concourse's or Bowl's, not mine).
- **The LF corner's walk on the 27th** (`after/walk-1-lf-corner-27.jpg`) is very dark beside a big unlit wall: worth a lighting pass by whoever owns leftfield.
- **The court's north passage** at z -100..-104 is blocked at x 78.7 by existing geometry (the passage under the Pavilion to the Alley); walking out of the court at z -96 or -112 works. Not a closed route, but the narrowest way through.
- **The Alley's east end** at x 67 doesn't connect east straight along z -135: that's the footprint (the court is reached by the Pavilion's passage, north of it).
- **The headless walker** (WA2's harness) sticks when a path runs straight into a post's centre (my first walk across the court hit a lamp post dead on); an offset path passes. A harness artifact, not a block.

## Repair (step 12, round 1: the skeptic's and the reviewer's defects)

The skeptic's report is `.claude/gauntlet/s12/r1/SK-FK3.md`; its defects are numbered as there. Paths below are relative to `.claude/gauntlet/s12/r1/`. "Before" is the skeptic's `SK-FK3/after/` (the fixer's tree, which is this branch's base for the repair); "after" is the repair's `FK3/repair1/` (full park, 1280 x 800, at the skeptic's framings), `FK3/repair2/` (scoped `only=alley,terrace,bowl,people`, for the poster's line, the mums and the dome's arm), `FK3/repair3/` (full park, the bays' undersides) and, for the roof units (SC1-13, below), `FK3/repair4-before/` (the fixer's tree) against `FK3/repair5/`. Every desk job as owner "cbp FK3 repair", never exclusive, 15 minutes or more apart, no console errors.

**Checked on the CPU first:** `node --check`; `npm test` exit 0; `node test/continuity.mjs` exit 0 (504 segments, start hash 801248349, duration 3785.503, 7 jumps, 6 deliberate); the Pavilion walkway, the court and the stair built headless on the real Bowl and Concourse, and the landing walked on their colliders (below); all of it again after the undersides and the roof units' clearance (the last changes), and the roof units checked against the park's other meshes (below).

### 1. The fall hole at the Alley stair's half landing (blocking; done)

**What was wrong:** moving the lower flight to s -3.95..-2.55 left a 0.8 m well between it and the upper flight (s -1.75..-0.35), and the half landing's rails were only `'d0', 's0'`. A walker turning on the landing toward the core slid between the flights' sides and fell 5 m to the Alley.

**What I changed:** `PavilionWays.js`: the half landing's rails are `[ 'd0', 's0', 'd1:-2.55:-1.75' ]`, a rail along its back edge across the well (an `fa1-rail` collider with it), its posts at the ends. The upper flight stays where it was (closing the well by moving it would put its stringer back toward the right-hand car's door).

**Walked:** 15 starts on the landing, on the colliders of the park as built (Field, Bowl, Concourse, PavilionWays): on the fixer's tree 11 fell to 7.01; now none do. The switchback still walks up to 17.12 and down to 7.01. The walk audit (`FK3/repair1/wa/summary.json`): walker falls 486 (488 on the fixer's tree, 486 before FK3), no `fa1-landing` entry in `walkFalls` (it had 2 edges, 5.1 m), nodes 529,388 and reached fans 37,737 as the fixer's.

**After:** `FK3/repair1/landing-well.jpg` (from the landing: the rail across the well), `landing-from-alley.jpg`.

### 2. The curve's stand bays hanging out of the Pavilion's back (done)

**What was wrong:** the kit's food bay (1.3 m) and restroom vestibule (1.6 m) go in behind the wall with no back, ends or floor; on the Pavilion there's no building behind the wall, so they hung over the court's north end and the passage as lit white boxes, open below, the tubes and the staff seen from the court.

**What I changed:** `alley/Pavilion.js`: for each unit with a stand or restrooms, a block box behind the wall in the stands' precast (`Q.body`, no new mesh): its back at 1.75 m, its two ends, a roof at the wall's head, a floor in it at the walkway's level (the staff stand on it) and a strip below the floor at the wall's line; its underside 0.3 m below the walkway in concrete with the floor's bounce (ConcourseSteel's palette, `'concrete'`, in the domes' mesh: no new draw). 10 units, 140 triangles. The brick and the navy base course carry round from the wall.

**Before / after:** `SK-FK3/after/sc17-bays-court.jpg`, `sc17-bays-side.jpg`, `sc17-bays-day.jpg` against `FK3/repair1/` (the same names); `sc18-sign.jpg` (the boxes over the court's north view gone).

**The undersides:** in the block, by day, each box had a black slot under it (`FK3/repair1/sc17-bays-day.jpg`): the precast's downward face is a plain 0.3 grey with no bounce (Concourse's `blockWGSL`, not mine), and the park's downward faces get their light from an emissive bounce term (Stands' `SOFFIT_WGSL`, ConcourseSteel's palette); the ground bounce gives these next to nothing, high over the court under the Pavilion's slab (my reading, not measured). In the steel palette's concrete they take the tone of the Pavilion's slab soffit beside them: `FK3/repair3/sc17-bays-day.jpg`, `sc17-bays-side-day.jpg`; after dark (`sc17-bays-court.jpg`, `sc17-bays-side.jpg`) a pale strip under each dark box, about the slab's grey, lit by the court's lamps.

### 3. The wayfinding arrows pointing east (done)

`alley/Gate.js`: the arrows point the reader's right (west: the Alley, the Pavilion's elevator, the sections), set at the right end of each line as the park's signs set them; the text left-aligned. `SK-FK3/after/sc18-sign.jpg` against `FK3/repair1/sc18-sign.jpg`.

### 4. The counts table off by one shot, no TV view (done: corrected)

`meshRenderer.stats` read after `await __qa.still( { frames: 24 } )` in the shot's js, full park, 1280 x 800. The before and FK3 columns are the skeptic's (jobs B and A/C); the repair's from `FK3/repair1` (job 1, 10:14):

| View | Before FK3 | FK3 | FK3 + repair |
|---|---|---|---|
| Alley: eye (60, 9, -110), play 60 | 946 / 5,125,553 | 951 / 5,144,553 | 952 / 5,144,963 |
| Harry's: eye (-95, 9, -95), play 60 | 1,054 / 5,412,961 | 1,059 / 5,427,593 | 1,060 / 5,431,909 |
| TV center, play 20 | 505 / 3,701,145 | 511 / 3,712,133 | 511 / 3,712,265 |
| TV high, play 60 | 800 / 3,931,071 | 807 / 3,943,885 | 807 / 3,943,443 |

(draws / triangles; pipelines 791 in every view, as FK3's: the posters use the court's signs' material, so no new pipeline; local lights 242 in every view.)

The repair adds one draw in the Alley and Harry's views (the posters' mesh, `pavilion-posters`, 10 triangles) and none in the TV views. Triangles: +0.01 to +0.08 %.

**Why FK3's draws reach TV center** (`passes-tv-center` in job 1: I wrapped `drawItems` for one frame and counted FK3's meshes by pass): `outer-roof-units`, `alley-fair-awnings` (and `alley-fair`) are drawn in shadow cascades 0 and 2 and in the opaque pass; `rf-gate-kit` in cascade 2 only; `rf-gate-court` and `rf-gate-signs` aren't drawn there at all. So they're shadow-cascade draws of the new shadow-casting meshes plus the opaque pass's frustum test passing the roof units' and the fair's long bounds (the roof units span the LF end; the fair's carts and awnings span x -60..128). Merging the gate's three meshes wouldn't win any of it back at TV center; splitting the roof units' and the fair's bounds might, and wants a profile.

### 5. The placard's last line clipped (done in mine; gate3b's copy left)

`alley/Gate.js`: every placard line drawn with a 228 px max width, the last at 19 px: "Tampa Bay at Philadelphia" reads whole (`SK-FK3/after/sc18-placard-in.jpg` against `FK3/repair1/sc18-placard-in.jpg`). The Third Base Gate's copy (`gate3b/Gate.js`) has the same overflow; that file isn't mine.

**With it** (the skeptic's SC1-8 items 6, 7):
- The court's signs are single-sided now; each placard has a blank stock back toward the street (they were double-sided, read mirrored from outside).
- A pair of 2008 World Series banners on each lamp post on two arms, as the Alley's posts carry theirs (`FK3/repair1/sc18-sign.jpg`, `sc18-court-27-wide.jpg`, `sc18-s07-day.jpg`).
- The four wall banners' poles are one colour (geo's `beam` gives each face u 0..1, which ran the kit's palette across them).

### 6. The planter shrubs, faceted blocks (done)

`alley/Gate.js`: each planter four low evergreens round a taller one and three clumps of late mums at the rim, each a mound of small leaf or flower cards over a dark core, as the Third Base Gate's beds are built (their cards are larger); the mums a colour each (rust, gold, plum, white), packed heads with dark leaves between. `SK-FK3/after/sc18-shrubs-close.jpg` against `FK3/repair1/sc18-shrubs-close.jpg` and, with the mums moved out to the rim and fuller (they showed as a patch or two under the evergreens' skirts), `FK3/repair2/sc18-shrubs-close.jpg`, `shrubs-day.jpg`.

### 7. The court's concrete near-white at night (done)

`alley/Gate.js`, the floor shader, toward the 2008 photo (mostly warm grey-brown pavers, light bands only at the edges):
- the pavers mostly warm grey-brown, a buff, a dark and a red clay one here and there, fading to their mean with distance; a red soldier course round each panel;
- the concrete bands 1.2 m (were 3 m) and the border 1.2 m (was 2), the concrete darker (0.33 against near-white);
- the lamps' pools in the shader softer (0.8, were 1.4), and the puddles' share of them 0.6 (was 1.5);
- the puddles: a damp margin, then an edge held to a pixel (`fwidth`), so their rims no longer draw as bright contour lines.

`SK-FK3/after/sc18-s07-27.jpg`, `sc18-court-27-wide.jpg`, `sc18-s07-day.jpg` against `FK3/repair1/` (the same names); `sc18-alley-same-hour.jpg` for the Alley at that moment.

### 8. Empty black poster frames in the plain bays (done)

`alley/Pavilion.js`: a poster in each plain bay's frame, a 5 cm black border round it, three of the club's that October in turn: the 2008 National League Champions (red, pinstripes, the script, the pennant), the World Series' Games 3, 4 and 5 at Citizens Bank Park, Oct. 25-27 (navy and gold, the trophy), and 2009's season ticket plans. They're in the court's signs' atlas (`SIGN_CELLS.posters`, the atlas kept at 1024 x 1024 for them) and material. Five plain bays: four on the straight run by the Alley, one on the curve. `FK3/repair1/pav-poster-close.jpg`; the World Series poster's bottom line ("Phillies vs RAYS") laid out by width in `FK3/repair2/pav-poster-close.jpg` (the script ran into the "vs").

### The reviewer's and the skeptic's smaller points

- **The domes' strength (done):** the walkway's domes are local lights at the Terrace's strength, 16 at range 12 (were 48 at 14, `domeLights`' for domes under the Deck): they hang 5 m over the floor. Registered by the walkway's own `lightUp`. The walkway reads the same (`SK-FK3/after/sc17-s22-29.jpg` against `FK3/repair1/sc17-s22-29.jpg`, `sc17-curve-along.jpg`, `sc17-201-along.jpg`).
- **The dome past the Deck's end (done):** `soffit()` returns null past either end of the Deck (it carried the end segment's soffit on, and the last dome's conduit rose 4.5 m to a Deck that isn't there). That dome, at (76.8, -4.5), hangs on a conduit arm off the back wall, with a strut and a plate. `FK3/repair2/pav-end-dome-arm.jpg`.
- **`offsetPolyline` (done):** imported from `Bowl.js`; the walkway's copy is gone.
- **AD1-11, the head's back (done):** the precast head is 5 cm proud of the core's back as of its other faces (d1 `dD + 4.25`; it was 4.35, 15 cm), and its collider with it.
- **The SC1-13 roof units against what else stands on the ring's top (done; the reviewer asked the skeptic to check):** built headless (Field, Bowl, Concourse, Exterior, Landmarks: the park as built, in the field frame), every other mesh's triangles sampled (vertices, edges and inside, every 0.12 m at most) for points inside each unit's casing. 3 of 16 casings had something in them:
  - the first base air handler (54.5, 51.7), under the upper deck: one corner 1.9 m past the footprint, over the facade's head, the edge's guard rail through it; from outside its top showed over the brick (`FK3/repair4-before/units-1b-ahu.jpg`);
  - at the Third Base Gate, a condenser (-94.3, 9.8) in a leg of the gate's left field side light tower (two of the leg's four chords through its casing), its pair 0.9 m beside the leg (`units-3b-tower-lf.jpg`);
  - a condenser (-64.1, 46.8) down inside the brick stair tower under the gate's home plate side light tower, over the footprint's edge, the brick's head 0.25 m up its casing; its pair against the light tower's back, between its legs (`units-3b-tower-home.jpg`).

  The LF ramp (places/leftfield, not built here) is 33 m and more from the nearest unit (field frame: the ramp x -125..-119, z -96..-60; the units' last at -118.9, -26.9). **The fix** (`Bowl.js`, in FK3's block): a unit's spot is taken only when every corner of its curbs is inside the footprint and 1.5 m from its edge, each casing's centre 9 m from a gate's light tower (the portal tower's legs are 12.4 m across), and the frame's line doesn't bend there (a casing on the chord sat skew, its conduit's riser inside it); otherwise the next spot along (2.5 m), the ones after it keeping their places. All 16 casings kept, none with anything in them; the three clusters moved 6, 14 and 8 m along the ring; the other 11 casings where they were. Script: `units.mjs` in the repair's scratch (not committed). Before / after: `FK3/repair4-before/` (the fixer's tree) against `FK3/repair5/`, `units-3b-gate.jpg`, `units-3b-tower-lf.jpg`, `units-3b-tower-home.jpg`, `units-1b-ahu.jpg`, `sc113-aerial-lf-day.jpg` (hour 16); `FK3/repair5/sc113-s19b-27.jpg` for the scout's framing (the LF end's units, which didn't move). After: the first base air handler 6 m along, back from the brick (nothing over the facade from outside); the gate's condensers on the open roof clear of the towers and stair towers, the moved pair about 4 m from the gate's air handler; the LF end's pair clear of the tower behind it.
- **The notes' wrong statements (done):** corrected above, in place: the restrooms at 206 and 207, not 205 and 208; the lower flight's margin nil, not 0.4 m; the half landing widened, not moved; the head's back 15 cm until now; the tower collider's d1 17.85; the counts table superseded by the one here.

### Left, and why

- **gate3b/Gate.js's placard overflow:** not my file.
- **The atlas at 1024 x 512:** kept at 1024 x 1024; its lower half now holds the posters.
- **Merging the gate's three meshes:** it wouldn't change TV center's draws (above).
- **The troupe's sphere test's CPU cost, the light registration through `Terrace.update`, Concourse's `galleries` duplication:** a profile, and files outside mine.
- **The stanchions' colliders** (the queue belts at the curve's units are walked through): Concourse's kit.
- **The bays' brick sides near-black at night** (`FK3/repair3/sc17-bays-court.jpg`): the block's vertical faces get the FX3 pool and bounce only on a stand's back (Concourse's `blockWGSL`, by uv); these are dark as the Pavilion's own back wall beside them is. Not mine to change.

**Speed risk:** low. +1 draw in the Alley and Harry's views (the posters), none in the TV views, no new pipeline, +2,244 triangles in the court's kit (the shrubs' and mums' cards, the banners), +64 in its signs, +140 in the bays' skins (20 of them, the undersides, in the domes' mesh), +36 in the dome's arm. The roof units' clearance moves three clusters: no triangle or draw changes.
