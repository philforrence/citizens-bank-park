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
- the guide's list claims the nearest free unit in its order, through Concourse's own stand kit (`_foodUnit`, `_pairUnit`, the same materials, the same signs). The result: Brewerytown 204, the Creamery 205, the Market 206, the family restrooms 205 and 208 (on the curve), Fairmount Fries 208, Brewerytown 209, Hatfield 210 (the nearest free to 209), FW3's restrooms at 202 and the second Market at 211; plain bays (a steel service door, a poster frame) between;
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
- the lower flight and its half landing moved 0.5 m, so the flight's foot is on the pier between the two cars, 0.4 m clear of each door's path (the flight now s -3.95 to -2.55);
- the bridge (the top landing): its back edge carried on the core, no columns there; its two front columns at s -5.6 and -0.09, clear of both doors; it runs the whole of the core's face, s -5.75 to 0.06;
- the d1 rail along its back is gone: the tower's face is there now.

**Walked:** up the stair to the Pavilion's concourse, out of each car's door to the field side, in to each from the Alley and from the stair's foot, the bridge to the upper door, the ride both ways (all reached, no falls).

**Before / after:** `before/ad1-3-wide.jpg`, `ad1-3-door.jpg`, `ad1-3-from-alley.jpg` against `after/`; `after/ad1-3-bridge.jpg`.

### AD1-11: the Pavilion elevator tower's face dissolving from brick to precast (done)

**What was wrong:** FA1's precast tower (2.5 x 2.6 m, from the street to 20.5) and Concourse's brick core shared their front face, so the two fought in a ragged noise edge up the middle of it.

**What I changed:** FA1's tower is now the core's head: the storey of the bridge and the machine room over it, from the bridge's underside (16.8) to 20.5, over the whole of the core's footprint and 5 cm proud of the brick all round, a cast band at its foot and a reveal under the cap. Below it the brick core is the tower. Its collider covers the head only (the core's own covers the street).

**Before / after:** `before/ad1-11-face.jpg` against `after/ad1-11-face.jpg`.

### The walk: the Alley carts' awnings (done)

**The walk:** the LF corner on the 27th, Bull's on the 29th, behind the batter's eye on the 27th, the pens on the 29th, the RF end on the 27th, back west, the rail over the pens (`before/walk-1` to `walk-7`).

**The worst thing:** every cart's awning (the water ice, the cotton candy, the beer, the programs, the funnel cakes) was six loose 6 cm slats with nothing under them: from the cart lines you looked up through a set of bars. The Alley's 2008 photos have striped cloth awnings and umbrellas over the carts.

**What I changed:** `alley/Fair.js`: each awning a striped cloth on its frame: a low gable, the stripes running over it front to back (the cart's colour and white), a scalloped valance round all four sides, the ridge and eave rails; the cloth's weave, the valance a shade darker, wet in the rain.

**Before / after:** `before/walk-3-eye-27.jpg`, `walk-5-rf-end-27.jpg`, `ad1-3-from-alley.jpg` against `after/`; `after/walk-cart-close.jpg`.

## The counts

`JSON.stringify(__app.engine.meshRenderer.stats)` at play 60, full park, 1280 x 800, in the two standard views (the before and after desk jobs):

| View | Before | After | Change |
|---|---|---|---|
| eye (60, 9, -110) to (20, 6, -100) | draws 954, triangles 3,591,499, pipelines 783, occluded 324 | draws 961, triangles 3,610,655, pipelines 791, occluded 325 | +7 draws, +19,156 triangles, +8 pipelines |
| eye (-95, 9, -95) to (-60, 4, -60) | draws 946, triangles 5,123,411, pipelines 783, occluded 42 | draws 951, triangles 5,140,575, pipelines 791, occluded 42 | +5 draws, +17,164 triangles, +8 pipelines |

The new meshes: the walkway's domes (one mesh), the gate's kit, floor and signs (three), the roof units (one), the new Pavilion stand units, and the umbrellas and awnings in place of what they replace. The new pipelines are mostly the new materials (the court, its signs, its kit, the roof units, the awnings' cloth, the umbrellas' cloth); I didn't trace the other two. The after job logged no console errors. Speed risk: low (under 1 % more draws and triangles in either view).

## Walking: colliders added, moved or removed

- **Added** (`rf-gate-court`, the Right Field Gate's court): eight lamp-post cylinders (r 0.2, 7.5 m), four planter cylinders (r 1.0, 0.66 m), two sign-post cylinders (r 0.08), six bench boxes (0.6 x 1.9 x 0.9 m).
- **Moved** (FA1's, `PavilionWays.js`):
  - the lower flight's treads and sides, and the half landing, 0.5 m toward -s;
  - the bridge (`fa1-landing` at 17.12): s -4.6..0.06 is now -5.75..0.06, d 11..13.55;
  - its columns (`fa1-post`): (-4.45, 11.15), (-0.09, 11.15), (-4.45, 13.45), (-0.09, 13.45) are now (-5.6, 11.15) and (-0.09, 11.15);
  - the tower (`fa1-elevator`): was s -4.5..-2.0, d 13.6..16.2, y 7.01..20.52; now s -6.5..0, d 13.55..17.95, y 16.82..20.52 (the brick core's own collider holds the street).
- **Removed:** the bridge's rail along its back edge (`'d1:-1.9:0.06'`), now against the tower's face.
- No route is closed: every walk above reaches its end.

## Files outside mine (small, marked)

- `src/ballpark/places/Terrace.js`: an import and one FK3 block after `galleries()` (the Pavilion walkway).
- `src/ballpark/Bowl.js`: one FK3 block in `_outerRing` (the roof) and a one-line hook (`${ roofWGSL }`) in FW3's roof branch.

## Noticed elsewhere

- **The Alley elevator's upper door** (at the bridge, the Pavilion's level) is Bowl's plain grey slab, no frame, no sign: Concourse hides every `elevator-sign` above the street. The street doors have their ELEVATORS sign; the upper one should have a frame and a small sign too (Concourse's or Bowl's, not mine).
- **The LF corner's walk on the 27th** (`after/walk-1-lf-corner-27.jpg`) is very dark beside a big unlit wall: worth a lighting pass by whoever owns leftfield.
- **The court's north passage** at z -100..-104 is blocked at x 78.7 by existing geometry (the passage under the Pavilion to the Alley); walking out of the court at z -96 or -112 works. Not a closed route, but the narrowest way through.
- **The Alley's east end** at x 67 doesn't connect east straight along z -135: that's the footprint (the court is reached by the Pavilion's passage, north of it).
- **The headless walker** (WA2's harness) sticks when a path runs straight into a post's centre (my first walk across the court hit a lamp post dead on); an offset path passes. A harness artifact, not a block.
