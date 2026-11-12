# FK1: the seats, the Deck's portals and end, the dugouts' roofs (step 12, round 1)

Fixer FK1, 2026-11-12, on branch `worktree-agent-a265194306130bb85`, off `ballpark` at 159da9d. The tickets are step 11's FX2 (its saved edits, `.claude/gauntlet/s12/FX2-wip.patch`: SC1-1, SC1-5, SC1-12, SC1-16), breaker AD1's AD1-7, AD1-12 and AD1-16 (WA2-10), FA3's rail over the dugouts' roofs and the one-sided hall wall. The usage limit cut the round short: the rows behind the dugouts still sit too high, and some refinements are left (below, "What's left").

## How it was checked

- **On the CPU first:** `node --check` on every file changed; `npm test` all ok; `node test/continuity.mjs` 504 segments, start hash 801248349, duration 3785.503; both changed tiers (the field level with its dugouts and Diamond Club mouths, a Deck with open portals and an open end) built headless in Node with the real `standsMaterials()` (`buildTier`), no errors, the meshes and colliders counted.
- **Two desk jobs, full park, 1280 x 800:**
  - **j1** (before, at 159da9d): every ticket's frame, by night and by day, the 400s seat's stats, the wall's polyline.
  - **j2** (after, at d4fc35f, which has everything but the notes): the same frames, the stats and TV center. No console errors.
- **Where the shots are:** `/Users/phillipforrence/citizens-bank-park/.claude/gauntlet/s12/r1/FK1/j1` (`b-*`) and `j2` (`a-*`). The job builder (`mkjob.mjs`) and the jobs are in the session's scratchpad; the frames are listed in it by name.

## Per ticket

### SC1-1, SC1-5, SC1-12, SC1-16: FX2's saved edits (SC1-1, -5, -12 done; SC1-16 not fixed)

Read before applying; all of it kept (commit fb06466).

- **SC1-1, the pans behind standing fans.** The seats' vertex stage (`SEAT_FOLD`) reads each seat's fan's stand weight (`cwPoseBuf[ fan * 10 ].x`, the crowd kernel's `st`, written for every fan every frame) and turns the pan about its back edge from flat to FS1's folded pan, from `st` 0.15 to 0.6; a vacated fan's seat is all the way up as before. Checked by hand: up = 0 is the pan as built, up = 1 FS1's folded pan exactly (0.26 m up, 15 degrees off upright), the normal rotates with it (the double-sided flip is right). The cost: one storage read per pan vertex of the seats built sat on, nothing per seat on the CPU, no new draw. The ratio `arrayLength( pose ) / arrayLength( ids )` is 10 because both are sized by `MAX_FANS` (Crowd.js).
- **SC1-5, the seats' blue.** `seatGeometry()`: `BLUE [ 0.042, 0.05, 0.115 ]`, the standards a deeper navy `[ 0.014, 0.021, 0.062 ]` (FX2's ten photos; my own look at Getty 83891095, 83511062, 83458502 agrees: a dusky violet-navy under the banks, never royal).
- **SC1-12, the nosings.** No yellow: a dark grit anti-slip strip 3 cm behind the worn pale edge, 5.5 cm wide, across the aisle and stopping short of the seats.
- **SC1-16, the Terrace's stair rail: not fixed.** FX2's edit is in: `ConcourseSteel` PALETTE `railGalv` (duller, rougher galvanizing) for the 400s stairs' handrails and the landing's guard rail (`terrace/Build.js`), the pipe round in 8 facets, not 5. But in SC1's own frame (`j2/a-s19-rail`) the white bar is unchanged: it is ~0.1 m thick at that distance, more than the 4.4 cm handrail, so it is another member (a guess: one of Stands.js's `rail`-material beams, albedo 0.6, on the 400s' closed portal or aisle; or the stair's own stringer flange). Next: find the mesh under that pixel, then dull it the same way.

**Evidence (before `j1/b-*`, after `j2/a-*`):**

| | frame | what changed |
|---|---|---|
| SC1-1 | `s20-legs`, `s20-hi`, `k3-side-100s`, `9th-side-400s` | the flat pan through the standing fan's shins is gone, folded up behind his calves (s20-legs: the pan at the bottom middle) |
| SC1-5 | `aisle-100s`, `aisle-400s`, `day-aisle-100s`, `day-lfc` | the seats a dusky navy, the standards navy |
| SC1-12 | `aisle-100s`, `aisle-400s`, `s20-legs` | the yellow nosings a dark grit strip |
| SC1-16 | `s19-rail` | unchanged (above) |

### The dugouts' roofs: FA3's rail (done)

**What was wrong:** a dark green pipe rail along the whole back edge of both dugouts' roofs. 2008 had none there: the first row behind the Phillies' dugout leans on the roof itself (Getty 83824852 and 112874141, Oct 29; the Phanatic dancing on it over their heads, 83434999).

**What I changed** (`Stands.js`, the ledge block): the back-edge rail is drawn only where the ledge is over a camera well (the 2.3 m drop), not over the roof (`roofSpan()`, from `layout.js` DUGOUTS and `Field.js` DUGOUT_ZONES: the roof between the wells, 0.2 m past each partition). The rails down the ends stay. A few rally towels lie on each roof's back edge, flat or hung over it (the crowd's 2008 towel: white terry, the red square, the white script), one every two or three metres; their own small mesh (`dugout-towels`, ~46 triangles).

**Colliders:** unchanged. The box along the roof's back edge (tag `field-level-rail`, 1.15 m over the ledge) stays: you stand at the roof's edge, not on it, as before.

**Evidence:** `j1/b-dugout3b-field` and `j2/a-dugout3b-field` (from the field by the 3B dugout, the police on its roof at 3584.5): the rail behind the officers is gone, the crowd stands at the roof's edge. Also `dugout1b-field`, `dugout3b-roof`, `day-dugout3b-field`, `tvhigh`. The same frames show what's left: the first row's legs over the roof (below).

### AD1-12: the Diamond Club's tunnel mouths (done; the 400s' mouths too)

**What was wrong:** one flat panel with a uniform warm glow: a shallow lit beige box.

**What I changed:** `tunnelMouth()` writes each mouth's quad with its size in its uv; the `portal-mouth` material traces the eye's ray on into a tunnel that size: painted block walls with their courses and joints, the floor, the ceiling, a lamp across the ceiling a metre in, the light from outside fading in the first metre or two, and nothing past six metres (it turns). No new geometry, no colliders. The 400s' closed portals use the same mouth.

**Evidence:** `j1/b-dc-tunnel` against `j2/a-dc-tunnel` (AD1's frame, (-14.2, 5.3, 21.6)), and `dc-tunnel-close`, `dc-from-plate`. The beige panel is now a block-lined tunnel going back into the dark. It still reads a little lighter near the mouth than 2008's black opening (`step10/crop-commons-2008-03-29-2372257740-dc-tunnel-parapet-126-127.jpg`): the light from outside could fall off faster (in the shader, `exp( - dep * 1.6 )` to `2.4`, and `0.8` to `0.5`). That isn't rendered, so it isn't in.

### AD1-7: the Deck's row-7 portals (done, my own reading of the photos)

**What was wrong:** FA1's open portal was a box: a lid level with row 11 (a bare 3.4 x 4 m slab with a pipe rail round it) and a 2.8 m sheer face beside row 7's fans.

**What I changed:** an open stairwell, open over it to the roof. Commons 2008-03-29 2372036920 (the RF corner, the Deck under its roof) has the rows unbroken between the aisles and, in them, only the pale concrete of a well's cut ends and silver rails, with people standing at them. So: the floor at row 6's level round the stair's hole (PavilionWays.js unchanged), the cut rows' ends stepped down as the cheeks (facing into the well), the back up to row 12's riser, a guard rail along each cheek a metre over the nosings with a mid rail and a post a row, and a lower one (0.85 m) in front of row 12's seats. The seats next to a well start clear of its rail (`inPortal`: 0.62 m past the cut, not 0.35, so none hangs over the drop).

**Colliders (pavilion-deck, every open portal):**
- **removed:** `pavilion-deck-portal-top` (the walkable lid over rows 7-11) and the three `pavilion-deck-portal-rail` boxes round it;
- **kept:** the two `pavilion-deck-portal` floor boxes either side of the stair's hole;
- **changed:** the `pavilion-deck-portal-cheek` boxes now rise to row 11 + 1.1 m (were to row 11 + 0.05, with the rail boxes above); `pavilion-deck-portal-back` 0.2 m wider and up to row 12 + 0.9 m (row 12's edge over the well).
- **Routes:** the stair, the floor, the mouth onto the row-6 cross-aisle and the aisles are as they were. The one route closed is walking across the lid at row 11's height; row 12, unbroken over each well's back, crosses the section instead.

**Evidence:** `deck-portal-front`, `day-deck-portal-front`, `deck-portal-row7`, `deck-portal-back`, `deck-portal-top`, and from across the field `day-deckend-as-2371236009`. The white box with its dark mouth is now a recessed well: stepped cheeks, rails, the floor and the stair's hole. **Fans:** 42,132 before, 42,120 after (the seats beside the wells).

### AD1-16 (WA2-10): the Deck's NW end (partly: built, not confirmed)

**What was wrong:** the end cap was one solid triangulated slab between the steps and the underside: a black wedge as the Pavilion's elevator lets you out.

**What I changed:** a tier may call an end open (`openEnd: [ start, end ]`; Bowl.js sets `[ true, false ]` on the Deck, a marked line). An open end is the stepped units' ends in a band 0.3 m under the steps' inner corners (pale concrete, the stands' material), and under them the maroon raker they sit on (the edge beam's steel) down to the deck's underside, with its flanges and a stiffener every 1.5 m. Other tiers' ends are unchanged.

**Evidence: not confirmed.** In `j2/a-arrive-pavilion`, AD1's frame, the dark mass at the top left looks as it did in `j1/b-arrive-pavilion`. So that mass may be the Deck's underside seen from below it, not the end cap. `day-deckend-as-2371236009` doesn't frame the end. Next: a frame square onto the NW end (e.g. from the rooftop bleachers' side), and a probe of which mesh the dark mass is.

### The one-sided hall wall (partly done)

**What was wrong:** `ConcourseSteel._hallWall`'s brick faced the field only. From the ring behind it (the back of house, reached from the gates' ends 61-77 m from the plate) it was see-through onto the stands' backs and the concourse; the standard view `walk-concourse3b` (eye (-40, 8.6, 60)) stands in that ring.

**What I changed:** its outer face, 0.3 m behind the inner one, and both ends, in the same block material (`concourse-brick`: red ground-face block over its dark base, as the 2008 concourse's walls, pompomflipflop 2591541163). On the outer face, every 20-odd metres, a back-of-house door (grey hollow metal, a dark frame, a kick plate and a lever) with a warm wall pack over it, in ConcourseSteel's palette mesh (a new entry, `doorGrey`). A few hundred triangles in all. **Colliders:** unchanged (`concourse-wall`, 0.4 m thick on the inner face's line; the doors are drawn, not doors you open).

**Evidence:** `concourse3b-std`, `ring-home` and `ring-gate`, before and after. From the ring, the wall is now brick with a lit door: `a-concourse3b-std` shows the door and its wall pack at the right, and `a-ring-gate` shows the brick face at the right. Before, you saw through it.

**For the coordinator (don't edit `standard-views.json` here):** `walk-concourse3b` looks from inside that ring. A view of the concourse itself: eye (-36, 8.6, 46) looking at (-20, 8.6, 30), fov 60, play 60 (shot as `concourse-proper` in j1 and j2).

## What's left

- **The hall wall's ring side:** doors and wall packs, but no signs, conduit or stains yet; the doors' look is common sense, not a 2008 photo (none of the back of house found).
- **The rows behind the dugouts sit too high.** In 83824852, 112874141 and 83434999 the roof's top is at the waist of a fan standing in the first row behind it (the floor ~0.9 m under the roof); here row 4 is 0.12 m under it, so from the field the first rows' legs show over the roof. Lowering the dugout sections' rows 4-8 (a `rowY` like the Diamond Club's) needs the joints with the neighbouring sections walled and railed, and the people who walk those rows from `rowHeights` (People.js's aisle walkers and security, the Phanatic's walk down to the roof, places/phanatic/Ways.js) moved onto `rowY`. Not started.
- **AD1-7's portals beside the aisles.** In 2372036920 the wells look to be at the aisles (the 400s' `atAisle`), not mid-section; FA1's stairs (PavilionWays.js) are laid from `_portals`, so moving them is a Bowl.js setting plus a walk audit.
- **The walk audit** was not run (`test/walk-audit.mjs`): run it on the merge for the Deck's portals.

## Counts

- The 400s seat (eye (0, 30, 75) to (0, 0, -60), play 60): before (j1) `{"draws":786,"triangles":3542173,"pipelines":783,"occluded":421}`; after (j2) `{"draws":787,"triangles":3543985,"pipelines":784,"occluded":421}`. That is +1 draw and +1 pipeline (the towels' material) and +1,812 triangles. The pans' fold is in the vertex stage: one storage read per pan vertex, no CPU cost.
- j2 loaded the full park in 16.7 s with no console errors. Fans: 42,132 before, 42,120 after.
- Headless (Node): the field level gains `field-level-dugout-towels` (46 triangles); the Deck's portals' concrete goes from 2 boxes' quads to the stepped cheeks (52 triangles a portal) and their rails.

## Noticed elsewhere

- `Police.js` (FX3) places the roof's officers from the rail's line (`railLine`, from `tier.ledge`): the line is the roof's back edge, unchanged, so they stand where they stood.
- The 400s' closed portals still stand as boxes with lids; the photos ground them (AD1-7's "related"), their finish is the stands' plain concrete.

## Repair (round 1's send-back)

Repairer, 2026-11-12, on `worktree-wf_e827367a-b28-1`: `ballpark` at d13689d with FK1's branch merged, then the repairs. From the skeptic's report (`.claude/gauntlet/s12/r1/SK-FK1.md`: one blocking defect, the hall wall's outer face black at night) and the reviewer's (`RV-FK1.md`). Nine of the ten follow-ups are done; the tenth (the Deck's wells beside the aisles) is not. Of the nine, the navy is done as asked and is still short of the photos, and the pan's motion vector is left with a frame sequence, as the brief allowed (below, "What's left").

**Three corrections to the notes above** (the reviewer's and the skeptic's): the Deck's stepped cheeks are 26 triangles a portal, not 52; the seat's fold is two storage reads a pan vertex (the ids and the pose), not one; and `k3-side-100s` was never evidence for SC1-1 (it is in the Diamond Club, where the cushions stayed flat until this repair).

### How it was checked

- **On the CPU:** `node --check` on every file touched; `npm test` ok; `node test/continuity.mjs`: 504 segments, start hash 801248349, duration 3785.503.
- **Headless builds:**
  - the lower tiers, before (FK1's tree) and after: `field-level-front-rail` 624 to 432 triangles, 4 untagged wall boxes gone (the dugouts' mid-span walls), every other mesh and collider the same;
  - the upper tiers: the Deck's `-portal-back` up to row 12 + 1.1 m, all else the same;
  - the hall wall, with the page's own units, path and distances (dumped in j1): 12 bays, 7 doors, the 5 `concourse-wall` boxes as they were;
  - the cushion's fold by hand: at up 0 within 1 cm of where it was built, at up 1 on the folded pan, 5 cm proud of it.
- **The walk audit** (`test/walk-audit.mjs`, on j4's dump, the last tree's 5,243 boxes): 529,492 cells reached walking, 37,725 of 42,120 fans, 1,078 falls, 486 walker falls, 0 pops, holes 3.17 m2: the skeptic's numbers for FK1's tree, exactly. `pavilion-deck-portal` 126 cells reached and 65 not, as before. With jumps 67,579 cells against 67,573: the four under the dugouts' removed walls and two on the stairwells' plinths. In `.claude/gauntlet/s12/r1/FK1-repair/audit/`.
- **The reviewer's stairwell model** (`portal-walk.mjs`, a copy in `FK1-repair/tools/`, on FK1's tree and on this one): item 5 below.
- **Four desk jobs**, full park, 1280 x 800, no console errors in any, under `/Users/phillipforrence/citizens-bank-park/.claude/gauntlet/s12/r1/FK1-repair/`:
  - `j1` (before, the merged tree): the pick under SC1-16's white bar, the hall wall's and the stands' places, a first frame sequence;
  - `j2` (after): every item;
  - `j3`: after the wall's doors were made two-sided and its ends given no door;
  - `j4` (the last): every item's after shot, FOX's center camera, the counts. Since j3: the doors' concourse sides in the concourse's own light (in j3 they glowed in the dark nooks), and the door behind home back (a rounding slip in the columns' test had dropped it).
  - j3 went 12 minutes after j2, not 15: my misreading of the clock.
- **The befores** are the skeptic's own shots of the same code: `SK-FK1/before/b-*.jpg` (ballpark) and `SK-FK1/after/a-*.jpg`, `SK-FK1/after2/a-*.jpg` (FK1's tree, which is what was merged). The afters below are `FK1-repair/j4/a-*.jpg`, in the skeptic's framing and under the skeptic's names.
- The job builders and the page helper are in `FK1-repair/tools/` (`mk1.mjs`, `mk2.mjs`, `pick.js`; `wall.mjs` and `pad-math.mjs` are the two headless checks; the jobs as they ran and their results beside them). The builders read `pick.js` from the session's scratchpad: point their `HERE` at that folder to run them again.

### Blocking: the hall wall's outer face (fixed)

**What was wrong:** FK1's outer face was one unlit plane 0.3 m behind the inner one. On both of the replay's nights it was black, and it stood in front of FX3's lit stand backs (step 11, AD1-5), which the standard view `walk-concourse3b` looks at.

**What I changed** (`ConcourseSteel._hallWall`; one marked block in `Concourse.js` hands it the stands' backs):
- **A bay at every stand's back.** The outer face opens the stand's width and height (7.5 x 4.2 m, 1.2 m deep). In it stands FX3's back as it was: the block, the service door, the plaque, the stand's name, the wall pack and its pool. The brick returns to the stand each side, under a concrete head and a dark steel lintel. Twelve bays. So the wall is closed (no more seeing through to the concourse) and the backs are seen from the ring as before.
- **The brick lit as FX3 lit the backs.** The ring's faces have a material of their own (`concourse-brick-ring`: `brickWGSL`'s new `ring` option): the same pool under a wall pack and the same bounce off the floor, less of it up the wall. The bond comes from where the brick is, so the uv is free for the light.
- **The wall packs light the floor.** Every wall pack, the backs' and the wall's own, throws a pool on the ring's floor (`concourse-ring-pools`: one additive mesh laid 12 mm over the slab, 66 triangles; the cosine law under a lamp 2.86 m up, gone 5 m off).
- **FK1's doors, where there is wall for them.** FK1 put a door every 20-odd metres; most would now fall in a bay. They stand where the wall runs 3 m or more clear of the stands: two at each of the two turns, one behind home, one each side where the stands leave a 6.6 m gap (seven). Each has FK1's frame, kick plate and lever, the stands' backs' wall pack at their height, and a conduit up the wall to a box. The leaf is lit by its wall pack now (it was a black leaf in a lit wall).
- **The doors are two-sided.** Each is drawn on the wall's inner face too, in the concourse's own light, except behind home, where the elevator's core stands against it. A door keeps 0.95 m clear of the frame's columns.
- **The wall's two ends have no door**, only a wall pack: they stand clear of the last stand, brick on both sides, and the tile mosaic is on the 3B end's other side.
- **The inner face's normals.** `WL.at()` gives a corner the way of the stretch before it, so the inner face after each of the two turns (behind home, and the 3B diagonal) was shaded 45 degrees off. Each stretch takes its own normal now. A small change of light on the concourse's brick there.

**Colliders:** none changed. `concourse-wall` is the 5 boxes it was, so you stop at a bay's mouth 1.3 m from the stand's back, where the see-through wall stopped you on `ballpark`.

**Evidence** (before on ballpark, before on FK1's tree, after):

| view | ballpark | FK1 | repair |
|---|---|---|---|
| the standard view, play 60 | `SK-FK1/before/b-std-walk-concourse3b.jpg` | `SK-FK1/after/a-std-walk-concourse3b.jpg` (black) | `j4/a-std-walk-concourse3b.jpg` |
| the 1B side's ring | `b-ring-1b-door.jpg` | `a-ring-1b-door.jpg` (black) | `j4/a-ring-1b-door.jpg` |
| the wall's end by the Third Base Gate | `b-wall-end1-ring.jpg` | `a-wall-end1-ring.jpg` (a black slab) | `j4/a-wall-end1-ring.jpg`, `j4/a-ring-end-3b.jpg` |
| by day | | `a-day-ring-1b-door.jpg` | `j4/a-day-ring-1b-door.jpg`, `j4/a-day-std-walk-concourse3b.jpg` |

Also in j4: `a-ring-bay-square`, `a-ring-bay-slant`, `a-ring-home`, `a-ring-corner-3b`, `a-ring-door-close` (the ring); `a-ring-rain-27th` (the 27th); `a-wall-conc`, `a-wall-conc-gap`, `a-wall-end0-conc`, `a-wall-end1-conc`, `a-conc-corner-3b`, `a-conc-corner-1b`, `a-conc-gap-1b` (the concourse's side: the stands, the brick behind them, the doors' other sides).

**What a skeptic should know:**
- **From `wall-end1-ring`'s own spot the first stand's back is not seen.** It was seen there through the see-through wall. The wall's last 3.3 m of brick now stand between that eye and the bay, lit, with a wall pack. Three metres further along it is all there (`a-ring-end-3b`: the door, the plaque, the wall pack, SOUTH PHILADELPHIA MARKET).
- **The standard view draws less than it did:** 724 draws and 2,166,096 triangles in j4 (ballpark 885 and 3,347,079 in the skeptic's run), because a closed wall hides the concourse it used to look into. Its perf history breaks whichever way the wall is closed; `concourse-proper` (FK1's suggestion, above) is the like-for-like view.

### 1. The towels on the dugouts' roofs (fixed)

They lay at y 1.754, under the roof's lettered top (`Details2008.js`, 5 mm over the roof) and under the rain's water (`rail/Drips.js`, 9 mm). They lie 15 mm over the roof now (`towels()`, `yR`): 30 of them, every top at 1.765.

**Evidence:** `SK-FK1/after2/a-towel-3.jpg` (white roof, no towel) against `j4/a-towel-3.jpg`; `a-towel-0`, `a-towel-9-rain`; `SK-FK1/after/a-dug1b-top.jpg` against `j4/a-dug1b-top.jpg` (two on 5 m of back edge), `a-dug1b-top-rain`, `a-day-dug1b-top`. Getty 83824852 has one under a boy's hand at the roof's edge.

### 2. The rail across each dugout's roof (fixed)

FA3's rail down a section's end stood across the white roof at mid-span, where a dugout's two sections meet. It is not drawn where the end falls inside the roof's span (`roofSpan()`), and its wall goes with it.

**Colliders removed:** 4 untagged wall boxes, two at each dugout's mid-span (the two sections' ends), each from 0.25 m behind the front line to the ledge's edge at 2.87 m, from 1.2 m under the ledge to 1.15 m over it. The box along the roof's back edge (`field-level-rail`, 23 of them) is as it was, so the walker still stands at the roof's edge, not on it.

**Evidence:** `SK-FK1/after2/a-dug1b-crossrail.jpg` (the rail, the Phanatic against it) against `j4/a-dug1b-crossrail.jpg`; `SK-FK1/after/a-dug3b-as-2994329550.jpg` against `j4/a-dug3b-as-2994329550.jpg` (flickr puffygreenjacket 2994329550: the roof clear); `a-dug1b-top-wide`, `a-dugout3b-roof`.

### 3. The seats' navy (done as asked; still darker than the photos)

`seatGeometry()`: the plastic twice as light at the same hue, `[ 0.084, 0.1, 0.23 ]`; the standards the plastic's blue, a shade deeper, `[ 0.06, 0.076, 0.2 ]` (they were near black).

**Measured** (mean sRGB, the same boxes in both frames):

| | FK1 | repair | the concrete beside |
|---|---|---|---|
| the 29th, a seat back's rear face (`aisle-100s`) | (5, 6, 14) | (12, 14, 30) | (144, 140, 131) |
| the 29th, a lit seat back | (16, 18, 33) | (29, 31, 53) | |
| the 27th's delay (`navy-as-83511062`) | (9, 10, 18) | (16, 18, 32) | (95, 90, 84) |

So seat over concrete (the brighter channel) goes from 0.10-0.23 to 0.21-0.37 on the dry night and from 0.19 to 0.35 in the rain. The hue holds (228 to 236). The skeptic's three photos are 0.55 to 1.1; the emptied park in Getty 84081873 (CB-12's photo, in the seats' material's comment) is about (25, 26, 32), which is where the delay's seats are now.

**Evidence:** `FK1/j2/a-aisle-100s.jpg` against `j4/a-aisle-100s.jpg`; `SK-FK1/after/a-navy-as-83511062.jpg` against `j4/a-navy-as-83511062.jpg` (Getty 83511062); `a-navy-as-83891095`, `a-aisle-400s`; by day `a-day-nose-400s`, `a-day-aisle-100s`.

### 4. The nosing's strip (fixed)

The strip stopped 0.5 m from the section's end, 0.25 to 0.5 m of bare tread short of the seats. A row's seats stand in from the aisle by half of what is left over when they are counted, so each row's tread now shifts its distance-from-the-end by that much (`buildTier`, `strip`), and the concrete paints the strip to about 0.1 m from the row's first seat.

**Evidence:** `SK-FK1/after/a-day-nose-400s.jpg` against `j4/a-day-nose-400s.jpg`; `SK-FK1/after/a-navy-as-83511062.jpg` against `j4/a-navy-as-83511062.jpg`; `a-aisle-100s`. Commons 2008-03-29 2371427833 has them running to the seats.

### 5. The pocket behind a Deck stairwell (fixed: it has a way out)

- **The back raised, as asked:** `pavilion-deck-portal-back` rises to row 12 + 1.1 m (it was + 0.9); the drawn rail stays at 0.85.
- **That alone did not do it.** In the reviewer's own model (`portal-walk.mjs`, a full house, walking and jumping) the strip behind the stair was still reached at 124 places and still had no way out: 2 fewer ways in from row 12 and 4 fewer from row 11, the rest as before (in over the cheeks from rows 8 to 11, and over the back from rows 13 and 14, which stand 0.55 and 1.1 m higher).
- **So the strip is a plinth,** 0.16 m up, as a slab's edge is curbed behind a stair (`buildTier`, the open portal: `yP`). From it the 1.04 m jump clears the stair's own rail (1.12 m) onto the stair. In the same model: the strip reached at 115 places, "back out to the cross-aisle: yes". Walking only, nothing changes (1,222 places, the strip not reached).
- **PavilionWays.js's rail at line 146 need not change now.** Lowering it to 1.0 m (the reviewer's fix) would do no harm on top of this.

**Colliders changed:** the 4 `pavilion-deck-portal-back` boxes' tops (row 12 + 0.9 to + 1.1), and the tops of the 4 walkable `pavilion-deck-portal` boxes behind the stairs' holes (the mouth's level to 0.16 m over it).

**Evidence:** `j4/a-well-plinth.jpg`, `a-well-inside-back.jpg`, `a-well-inside-side.jpg`, `a-well-row12.jpg` (before: `SK-FK1/after/a-well-inside-back.jpg`, `a-well-inside-side.jpg`, `a-well-row12.jpg`).

### 6. The Diamond Club's cushions (fixed)

**What was wrong:** `places/home/Club.js` drew a static cushion on each of the club's pans. FX2's fold turned the plastic pan up behind a standing fan and left the cushion flat at his knees, in every row behind home; and the pads had kept the old royal blue.

**What I changed:**
- **The pan cushions are a mesh of their own** (`buildPads()`, `home-pads`: 1,260 cushions, the triangles they had), whose vertex stage turns each about its pan's back edge by the pan's own rule. By seat:
  - **one of the crowd's fans** (1,015 seats): his stand weight and his vacated bit, read from the crowd's buffers exactly as the pan reads them. The fan is found once, by his seat, when the crowd has seated itself;
  - **one of the place's own people** (186 seats: the front rows, the regulars): how far up he is (`Fans.js`'s `up`), written to a small buffer when it changes. The crowd's fan there is vacated, so that seat's plastic pan is up for good; the cushion is down while he sits and up when he stands;
  - **a seat nobody has** (59): up, as its pan is built.
- **The pads' colour:** the palette's `pad` and `padSeam` (`places/home/Build.js`) in the seats' navy.
- The back's pad and its piping are static as before.

**Outside my files** (small, marked): `places/BehindHome.js` builds the mesh and calls its `update()` after the fans' (three lines); `places/home/Build.js`, the two palette entries.

**Evidence:** `SK-FK1/after2/a-rows-k3-club-home.jpg` (a flat blue slab at every standing fan's knees) against `j4/a-rows-k3-club-home.jpg`; `SK-FK1/after2/a-rows-cel-100s-1b.jpg` against `j4/a-rows-cel-100s-1b.jpg`; seated, the cushions down under them: `a-rows-seated-club-home`, `a-rows-seated-100s-1b`; the place's own people in the front rows: `a-club-front-rows-cel`, `a-club-front-rows-seated`; emptied in the delay: `a-rows-delay-club-home`, `a-navy-as-83511062` (bottom right: FK1's has flat blue cushions on every empty seat); by day `a-day-rows-cel-100s-1b`. `a-pads-state` has the counts.

### 7. The folding pan's motion vector (left, with a frame sequence)

The engine's hook does not allow it cheaply. A material whose vertex stage writes a previous position comes off the still pipeline (`MeshRenderer.js` `stillMotion()`), which is what draws the 45,000 seats lean, and that file is the speed branch's.

**The sequence:** `j4/a-fold-seq-00.jpg` to `-16.jpg`: the replay running, the TAA's history kept (the desk's own cut and hold put aside for these shots), every other frame of the half second in which the 100s down the 1B line get up after strike two in the 9th (3479.3 to 3479.8). A pan is caught part way up in them (`a-fold-seq-07`, t 3479.53: the seat right of centre, under the woman in the bobble hat as she rises): sharp-edged, no trail. What blurs in those frames is the rising fan, who has motion vectors of his own. j2's `a-fold-seq-16` to `-21` are the same half second at a coarser step.

### 8. Stands.js tidied (done)

The stale FA1 comments (the open portal "flush with the rows", its "landing ... railed"), the dead `PO.open ? 0.05 :` in `yTop`, the always-true `if ( ! PO.open )`, `openEnd` in the tier's option list, and the open end's band triangulated only for a tier that has one.

### 9. SC1-16, the white bar on the Terrace's stair (fixed)

**What it is:** the handrail itself. A pick under the bar's pixels (j1, `b-s19-rail`'s values) hits `terrace-steel`, palette entry 12 (`railGalv`), 0.67 m from the eye: at that distance a 4.4 cm pipe is the bar's width. (FK1 took the bar for something 0.1 m thick further off.) The Terrace concourse's domes hang over it.

**What I changed:**
- **The paint** (`ConcourseSteel` PALETTE `railGalv`): weathered zinc, darker and mostly metal (albedo 0.27, roughness 0.72, metalness 0.62; it was 0.4, 0.68, 0.4, so 60% of it matte under the lamp).
- **The pipe round to the light** (`terrace/Build.js` `roundPipe()`): every vertex's normal out from the axis. `pipe()` gives each facet one normal, so the lamp lit whole flat facets end to end. The stairs' handrails, their posts (in 6, were 4) and the landings' guard rails.

**Evidence:** `FK1/j2/a-s19-rail.jpg` (a flat white bar) against `j4/a-s19-rail.jpg` (a grey pipe with a soft highlight); `a-s19-rail-back`, `a-day-s19-rail`. Getty 83485581: silver-grey under the lights.

### What's left

- **10, the Deck's wells beside the aisles: not done.** The Bowl.js line would be one word (`atAisle`), but `PavilionWays.js` lays each stair from the well's place and picks its way by a test of room on the concourse. Moved 4 m along, a well can fail that test and be closed over with no stair. That needs PavilionWays' owner and a walk audit; from across the field by day the wells are still pale rectangles in two sections (`j4/a-day-well-across2.jpg`).
- **3, the navy:** twice as light is still under the photos' 0.55. The rest is light, not paint: the seats' rear faces get a 0.03 fill where the concrete beside them gets 0.06 to 0.12 (`standsMaterials()`), and CB-12 took the seats' down from 0.12 because whole blocks glowed. A matter for whoever balances the bowl's night light.
- **The bays' mouths:** you look into a bay but stop at its mouth (the wall's collider, as on ballpark). Walking in would want the collider cut at each bay and the walk audit.
- **The rows behind the dugouts** still sit too high (FK1's own "what's left", above); not in this repair.

### Noticed (not changed)

- **The place's own people sit over a folded pan.** A seat the place has taken has its crowd fan vacated, so FS1's rule keeps its plastic pan up for good, behind the sitter's hips, and he sits on the cushion alone. It is hidden inside him, and was so before; a seat's pan would have to follow the place's person as its cushion now does (`Stands.js`'s seat material reads only the crowd's buffers).
- **A frame column stands in most of the bays,** 0.5 m in front of the stand's back (the bowl's outer columns, 0.4 m inside the wall's line): in some it is in front of the stand's name (`a-ring-home`, `a-ring-end-3b`). They stood there before, seen through the wall.
- **A running jump down a Deck aisle still clears the front rail** (the reviewer's note; `-front` is not in this repair).

### Counts (j4, the last job)

| view | draws | triangles | for comparison |
|---|---|---|---|
| FOX's center camera, play 20 (`a-tv-center`) | 592 | 3,806,666 | FK1's tree 589 and 3,805,024, ballpark 588 and 3,803,692 (the skeptic's run) |
| the 400s seat, play 60 (`a-std-walk-seat-upper-home`) | 789 | 3,508,521 | FK1's own j2: 787 and 3,543,985 (the triangles follow the crowd's levels, which follow the shots before) |
| `walk-concourse3b`, play 60 | 724 | 2,166,096 | FK1's tree 795 and 2,289,345, ballpark 885 and 3,347,079 (the skeptic's run) |

So +3 draws where all three new meshes are in view (the ring's brick, its pools, the club's cushions), +2 from the 400s seat.

Fans 42,120 and colliders: 5,243 boxes (FK1's tree 5,247: the dugouts' 4). Pipelines 787 (FK1's 784): the ring's brick, its pools, the club's cushions. Nothing new per frame on the CPU but `pads.update()`: 186 numbers compared, and a 20 KB buffer written when one of the place's people stands or sits.
