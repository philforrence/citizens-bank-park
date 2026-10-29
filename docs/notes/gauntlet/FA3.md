# FA3, step 10: the inner bowl and the edges (the walk)

Fixer FA3, 2026-10-28, branch `worktree-agent-aa9ac94caced634f3` off `ballpark` at 8c2671b. Tickets from WA1 (`.claude/step10/WA1.md`) and WA2 (`.claude/step10/WA2.md`): WA1-7, WA1-4 / WA2-5, WA1-2 / WA2-9, WA1-5, WA1-10, WA1-6, WA2-4, WA2-3's dugout slot. Wound down at the coordinator's call before WA2-12 and WA2-8.

**The owner:** "ensure we can walk everywhere in the stadium and that everywhere walkable ... is as it is in the stadium."

## The numbers (`test/walk-audit.mjs`)

The fill now also moves diagonally (a 1.3 m gap at 35° to its grid, the drink rail's at the baseline aisle heads, let no move along an axis through: the old fill reached those aisles only by falling into the hollow and popping up). So both rows below are the new fill: "before" is WA1's own dump (`.claude/step10/WA1/dump-result.json`, ballpark 8c156d0) with the walker's old rules (`WA_OLD=1`); "after" is this branch's last dump (job 3, full park) with the new ones.

| | before | after |
|---|---|---|
| seated fans the walker can get to (a floor at his row's height within 9 m) | 26,493 of 42,150 | 25,883 of 42,123 |
| fall edges over 1 m (the fill) | 9,830 | 1,459 |
| of which the walker's own update falls (walkSim) | 3,131 | 857 |
| into the hollow under the stands | 6,770 | 864 (the outfield's: the Alley's edges, the LF seats' centre end, Monty's, by 101) |
| onto the field | 712 | 218 (fill-only: the walker's own crossing takes none; a sliver at the 215 ft joints) |
| onto a lower deck / to the street | 1,137 / 1,211 | 139 / 238 |
| lifts by the ground (pops) | 4,540 | 0 |
| cracks in the seat floors | 50.8 m² | 2.6 m² |
| cells only a jump reaches | 60,342 | 63,197 |

The 400s went from 0 of 6,485 fans to 4,488 of 6,504 (the rest are more than 9 m from an aisle the fill reaches). The total is a little lower because some of the old reach was by falling and popping: lost on purpose, the Diamond Club's 18 rows (about 1,250: members, from the club below), the Arcade (954: reached only by falling off the 300s' end; FA2 has its ramp and escalator), the field level's aisles reached only from the hollow.

**Still open in the fill:** jumps (63,197 cells only a jump reaches: the fill's jump holds the peak for a whole move, cruder than the walker; two clusters to look at, a jump from the 300s' third base end at (-61.8, 23.9, 6.8) down onto the club concourse, and jumps down the 3B rows to a sliver at (-56.5, -9) onto the field); 2.6 m² of cracks at sharp joints (the 150 ft and 215 ft corners).

Run it: `node test/walk-audit.mjs job > job.json; node tools/gpu/desk.mjs shoot job.json > out.txt`, keep from the first `{`, `node test/walk-audit.mjs analyze dump.json outDir` (~100 s). `summary.json` has a `score` and `fansByTag`; `WA_OLD=1` runs the old walker rules; `WA_PATH="x,z x,z ..." WA_H=h` walks a path with the fill's own move and says what stops it (walls, fans, the ground).

## Per ticket

**WA1-7, the jump (done).** `Walker.updateWalk`: in the air a box is a wall unless its top is under where the feet were a frame ago (coming down onto it) or within 2 cm of them; the walk's 0.62 m step in the air carried a jump's 1.04 m over every 1.1 m rail. `BallparkApp._pushFromFans`: the fans push down to 1.2 m below them (a jump), not 0.7. The upper decks' front-wall colliders now reach the pipe rail drawn on them (+0.37 m: the walls are 0.75–1.0 m over the front row, which a jump cleared). The audit's copy has the same rules (and the jump's peak as the walker integrates it at 60 Hz, 1.04 m).

**WA1-4 / WA2-5, onto the field (done).** `Stands.buildTier` `frontRail`: a wall 1.15 m over each lower tier's first tread (jump-proof), at the real barrier: down the lines the low wall and its green pipe rail (2.34 m over the field), behind home the backstop's net, in the corners behind the wall, the left field seats at the guard rail behind the planter (`??=`, FA2's own wins). In right field it's drawn: a dark green pipe rail on posts with chain-link, and at each aisle's foot a taller frame with glass over it (Commons 2008-03-29 2371427833): `front-rail`, `front-mesh` (alpha-tested), `front-glass` (late pass) in `standsMaterials`. `Bowl._seams`: a rail across each pole seam's foot (the walker went down the seam's aisle onto the field by the pole). The field is reachable only by the free camera (F).

**WA2-3, the dugout slot (done).** The dugouts' sections (`ledge`): their first row's tread carried forward 0.75 m to the dugout's back, a riser in front; a green pipe rail over the roof's back edge and down both ends to the wall (the camera wells), walls to the walker. You dropped into the slot at the foot of the aisle and stayed.

**WA1-2 / WA2-9, the 400s (done).** The boxes moved from the middle of every other section to its side by an aisle (`portals.atAisle`, `portalS()`; Commons 2008-03-29 2372257740 has the lit box beside an aisle), so you come out onto row 1 and step into the aisle (in the middle, row 1's fans held you in a pocket). `places/terrace/Build.js`: a walkable box under each of the stairs' treads, its handrails walls up to the well, a guard rail round the opening on the landing, the post a pillar, a landing at row 1's height round the stair's head inside the box (drawn, concrete). `Stands.buildTier`: the rows over each box open (treads, risers and floors cut round the well), its cheeks, back and face walls up to the rail round its top, the cheek on the stair's side starting at the deck's underside so the climber's head clears it; the upper decks' row colliders end at the deck's underside (they hung 2 m below the 400s into the stairs' headroom). The 400s' back is a wall now (`back.wall`: its top row's back fell 29.8 m to the street).

**WA1-5, unrailed edges (done, the infield's).** `Bowl._strip( …, ends )`: rails across the Terrace walkway's and the club concourse's ends (17.7 m and 7.6 m falls), kept in `bowl.endRails[ name ]` so a bridge built onto an end (FA2's ramp) can take them out. `endRail` on the suite seats, the club seats, the 300s, the 400s and the Arcade: a wall up each end, row by row, and a pipe rail drawn up the stepped end. `places/terrace/Build.js`: the 300s' back rail (curb, glass, top rail) is a wall now, open at the aisle heads (you stepped over it into the top row, and behind home onto the press box's roof and off it, 19 m: W06). `Bowl._pressBox`: its front and ends are walls, the ends to a rail over its roof and set in 0.45 m (the aisle beside keeps its width), the roof's floor short of its ends. The Arcade's back is a wall open at its aisles (`back.wall: 'aisles'`).

**WA1-10, the cracks (done).** `Stands.buildTier`'s row boxes span `min( f0, b0 )..max( f1, b1 )` (FW6's fix to `_walkable`): the corners' fans, whose rows widen twenty-fold front to back, were half crack at the top; the shaft through the club, Arcade and 300s on the third base side is closed.

**WA1-6, the hollow (done: the step rule; partly: walls).** `Walker.updateWalk`: the ground rising more than a step is a wall (slide along an axis, else stop), only from where you stood on it (a pose under the street still comes up): no more 7 m lift out of the pit or 1.2 m out of a dugout. With the cracks, the fronts and the seams closed, the hollow's ways in are gone but for the outfield's (the Alley's edges, the LF flower bed: FA1's and FA2's). Not done: wall colliders for `Under.js`'s rooms and the pit's brick (unreachable on foot now; the free camera can still drop you in).

**WA2-4, the Diamond Club (done, simplified).** `Stands.buildTier` `parapet` (Bowl: `infield.parapet`): across the club's seven sections in front of row 18 (`places/home/Seats.js` CLUB_ROWS) a concrete parapet 0.55 m over row 18 (1.2 m on the club's side) with glass to 1.05 m and a pipe rail on posts, unbroken across the aisles (gates shut), a wall to the walker; in sections F and B a tunnel's mouth under it, dark, its approach stepping down through the club's rows 14-17 between low walls with a pipe rail (the 2008 photo by 126-127; the chart's "entered at rows 13-14"). `Seats.js` leaves those seats out (`parapetMouth()`). Simplified: in 2008 119-128 sat on a step a couple of metres over the club's top row; ours keep the one continuous rake (the concourse's height fixes the top row), so the mouths are 2.1 m only because the approach steps down. The ten sections of 119-128 above are WA2-8's.

**Not done:** WA2-12 (drink rails at the outfield tops; `Concourse._rail` takes only `tiers[0]`: generalise it to a tier and a depth), WA2-8 (section counts; not started), Under.js walls, the HOF club room's floor at its bends (`places/Club.js`, FI2's: 37 fall edges, 7.6 m), the Pavilion's and the LF deck's back walls (FA1's, FA2's tiers: `back.wall: 'aisles'` would do).

## Files

`src/ballpark/Walker.js`, `BallparkApp.js` (one line, `_pushFromFans`), `Stands.js`, `Bowl.js` (`_lowerTiers`' end, the upper tiers' options, `_strip`, `_pressBox`, `_seams`, `T400`; nothing in FA1's or FA2's blocks), `places/terrace/Build.js`, `places/home/Seats.js`, `test/walk-audit.mjs`. All marked `---- FA3`.

## For the merger

- **Stands.js is FA1's too** (their open-portal option and a local `slab()` in the tread code). Mine touches the tread loop (the well cut: `lessWell`, `wellOf`), the row collider (span, `underside`), the frontWall collider's top, the seat loop (`inMouth`), and adds one block before the portals (`box`, `wallLine`, frontRail, ledge, endRail, back wall, parapet, the portals' walls) and the materials. Keep both: the well cut applies to rows over a portal or a mouth.
- `portalS()` / `portalDir()` moved the 400s' boxes; Build.js and Stands.js share them. If FA1's open portals use `S.len / 2`, they're unaffected unless they set `atAisle`.
- `bowl.endRails[ 'terrace-walkway' ]` and `[ 'club-concourse' ]`: the end rails' colliders, for FA2's bridges (splice them out of `colliders.boxes`).
- `places/home/Seats.js` must match `Stands.buildTier`'s seats (it already copied the portals); `parapetMouth()` keeps it in step.
- **Frame rate:** colliders are free on the GPU (+~700 boxes, a linear scan per walker query: a few µs). New meshes per tier: front rail, mesh and glass (right field, the infield's dugouts), the parapet's glass and the tunnel mouths, the end rails in the existing rails mesh; +3 pipelines. TV center: job 3 (full park, after) `{"draws":494,"triangles":3639992,"pipelines":773}` (the second of two TV center shots; the first returned the walk view's frame); job 1 `{"draws":431,"triangles":2631260,"pipelines":773}` (likewise the previous view's: the desk's js runs before the shot). Not profiled.
- npm test passes; `node test/continuity.mjs`: 801248349 / 3785.503 (kept).

## Shots

`.claude/fa3/` in the worktree (gitignored): `j1/` (the RF rail, the dugout ledge), `j2/` (WA2's framings after: `wa2-2f-home-dc-and-119-128-from-field`, `wa2-3a-…-from-rf-pole`, `wa2-2c-1b-dugout-and-rows-behind`, `dc-from-122-125-as-michealnichols`, `400s-stair-from-concourse`, `rf-front-rail`), `j3/` (the last, full park, no console errors). Before: WA1's `shots/` and WA2's `shots/` in `.claude/step10/`. The maps: `.claude/fa3/base8/` (before) and `a3/` (after).

## Noticed

- The RF pole view (WA2's `wa2-3a`) looks through a picket fence close to the eye, before and after (Field.js's pipe rail's pickets at the pole): not this branch's.
- The parapet's glass at a grazing angle reads as a pale sheet in the j2 shot from 122-125; its alpha is the Terrace glass's formula now (fainter), not re-shot.
