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
