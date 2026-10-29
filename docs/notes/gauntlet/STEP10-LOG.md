# Step 10's log

Every agent, merge and measurement in step 10 ([STEP10.md](../worlds/STEP10.md)). The working files (audits, tickets, shots) are in `.claude/step10/` (local).

## Round 1 (2026-10-28, from 19:24)

- **FF1, the fans' faces from the players' MakeHuman head** (launched 19:24).
- **WA1, a walkability flood fill of the whole park** (launched 19:24).
- **WA2, the outfield seats and the inner bowl against the real stadium** (launched 19:24).
- **FF1, the fans' faces** (notes [FF1.md](FF1.md); merged 19:54): the fans' heads from the players' MakeHuman head, in three decimated levels (1,200 / 400 / 90 triangles), with eight blend shapes from MakeHuman's own gender, age, ethnicity, weight, face and head targets (holding 78% of how 1,500 faces drawn like the 2008 crowd differ). Each fan's weights come from who he is plus his seed; the face paint, caps, hats, hoods, hair, beards and glasses follow the modelled features. Before and after: `.claude/gauntlet/s10/FF1/` (b0, a2). Left: expressions, the blink, the 400-triangle level's facets, the chin.
- **FF2, the faces' second round** (launched 19:56): critique first, then expressions (cheering, singing), smoother close heads, the blink, the chin; then the players sharing the blend shapes.
- **WA2, the outfield and the inner bowl against the real stadium** (returned 20:03; findings `.claude/step10/WA2.md`, references `.claude/ref/step10/`, from the 2008 seating chart and fan guide): nothing above the main concourse in the outfield can be reached (the Pavilion and its Deck, the Scoreboard Porch and Harry the K's upstairs, the Arcade, the 400s); you step off every front row onto the field; holes at the LF wall, behind the dugouts and on the Alley's edge; the Diamond Club open from the concourse to the backstop; Monty's Angle a shallow strip; section counts off the chart.
- **FA1, the right side and Ashburn Alley's access** and **FA2, the left side** (launched 20:05).
- **WA1, a walkability flood fill of the whole park** (returned 20:08; findings `.claude/step10/WA1.md`, maps `.claude/step10/WA1/maps/`): the walker reaches 64% of the seated fans (26,850 of 42,150). Working: the plazas, all five gates, the main concourse ring, Ashburn Alley, every 100s aisle, the 12 elevator stops. Unreachable: the outfield's upper seating (8,734 fans), the 400s (6,485: their stairs have no colliders), the Alley's roof decks, three of Monty's four blocks. Falls: onto the field at the foot of every aisle, off unrailed edges up to 19 m, cracks in the seat floors (one shaft 21.8 m), the hollow under the stands; a jump clears every rail. Its flood fill is committed as `test/walk-audit.mjs`.
- **FA3, the inner bowl and the edges** (launched 20:10): the jump, the fronts onto the field, the 400s' stairs, the unrailed edges, the seat floors' cracks, the hollow, the Diamond Club's separation, the dugout slot, drink rails; WA1's outfield findings went to FA1 and FA2.
- **FF2, the faces' second round** (notes [FF2.md](FF2.md); critique `.claude/step10/FF2-critique.md`; merged 20:19): the fans' faces move. Jaws open, smiles push the cheeks into the lids, and blinks come from MakeHuman's own expression targets, mixed by the crowd's shares. Fans cheer from strike three (not the Rays fans, less in the rain, none in God Bless America). There's a painted mouth inside, teeth, lids that close over the eyeball, and the close heads are shaded with the full head's normals. Shots: `.claude/gauntlet/s10/FF2/` (b0 before, a2-a4 after).
- **FF3, the players share the fans' face targets** (launched 20:21): the players' faces fitted from MakeHuman's identity targets to the real men, the players' expressions, and the fans' open mouths and chins.
- **FA1, the right side and Ashburn Alley** (notes [FA1.md](FA1.md); shots and fill maps in `.claude/step10/fa1/`; merged 20:37): the Pavilion and its Deck can be reached at last.
  - A two-flight steel stair (56 risers) and an elevator tower go from the Alley to the Pavilion's concourse.
  - The Deck is entered at row 7 through open portals in every other section, with steel stairs climbing from the concourse under the deck.
  - The Pavilion concourse's back is solid (no more 10 m fall through the stands).
  - The Alley's edges, the Wall of Fame parapet and the roof decks are railed.
  - Cells reached: the Pavilion's rows 0 → 1,026, its concourse 0 → 2,446, the Deck's rows 0 → 1,697, the Deck's walkway 0 → 2,449, the bleachers' roof 0 → 675. Falls at street level 139 → 104. npm test and continuity (801248349 / 3785.503) pass.
  - Left: the 1B side's own ways up, a 4.8 m fall at the RF pole (row-collider slivers), and the rooftop bleachers' benches.
- **FA4, the 1B side's ways up, elevators both ways, and things you walk through** (launched 20:38).
- **Wind-down (the owner, 20:42: "wind down and finish up and merge everything and push and publish").** The loop stopped, and the four running fixers were told to commit what works and return.
- **FA2, the left side** (notes [FA2.md](FA2.md); shots in its worktree's `.claude/fa2/shots2/`; merged 20:48):
  - The Scoreboard Porch has a walkway behind its top row, reached by stairs from the Alley's west end (X-braced maroon steel, as the 2008 photo has it) and from the corner, and by the elevator behind 141.
  - Harry the K's upstairs, its patio and its bars are solid and walkable.
  - The Left Field ramp is walkable to the Arcade, and the escalator carries you up; a bridge joins the Arcade's walkway to it.
  - 146-148 over Monty's Angle are three sections of 12 rows up to a standing-room rail (447 fans).
  - The LF wall's top is floored and railed.
  - Also fixed: a zero-length rail's NaN that culled the whole left-field Kit mesh.
  - Cells reached: the LF deck 0 → 217, 146-148 26 → 255.
  - The walk audit's elevator code (FA1's and FA2's) is merged by hand: banks of any size, plus a place's own `to`.
- **FA4, elevators both ways** (notes [FA4.md](FA4.md); merged 20:49): E rides up a floor and Shift+E down, and the prompt names both floors. The 1B Gate's escalators and ramp, the elevator behind 112, the rooftop bleachers and the WA1-13 walk-throughs are researched and planned in FA4.md, not built.
- **FF3, the players share the fans' face targets** (notes [FF3.md](FF3.md); shots `.claude/gauntlet/s10/FF3/a2/`; merged 20:50):
  - The players' faces come from the same MakeHuman targets as the fans': 115 of the face's and head's targets and the macros' share, baked as sparse blend shapes on the body's head (`tools/build-body.mjs`).
  - Each man's face is worked out once when he comes on (`game/Faces.js`) and read on every figure. FY4's 16 numbers are mapped onto the modifiers, with photo fits on top (by eye).
  - Blinks, chewing, and the shout and grin from strike three run on the near figure.
  - The fans' open mouths are dark inside at every level, and the 90-triangle head's mouth is painted.
  - A fan with no expression on reads none of the expressions' records, which wins back some of FF2's cost.
  - **Broken:** on the GPU, Lidge's jaw doesn't drop for his shout at strike three. His weights read back right, his lids shut, and the CPU path opens it. Look first at the FF3 block in `Players.js`'s vertex stage and the `plExpr` buffer.
  - The players' draw is at WebGPU's 8 vertex buffers (`aField` is 3 wide now). `body.js` grew from 518 KB to 968 KB.
- **FA3, the inner bowl and its edges** (notes [FA3.md](FA3.md); maps and shots in its worktree's `.claude/fa3/`; merged 20:54):
  - You can no longer walk onto the field: rails at the real barriers, and right field's pipe rail, chain-link and glass are drawn.
  - A jump no longer clears every rail, and there's no 7 m lift out of the pit.
  - The 400s are reached by stairs that climb into their boxes, and the boxes are moved beside an aisle as in 2008.
  - Rails and walls close the open ends and backs. The seat floors' cracks are closed (whole mitred treads).
  - The Diamond Club is behind a glass parapet, entered by two tunnels.
  - **The merge:** `Stands.js` was combined by hand. FA1's `slab()` (the tread drawn twice either side of an open portal) now carries FA3's well cut, its whole-tread collider and the upper decks' undersides. A tier with open portals keeps FA1's 0.6 m deep rows. FA3's walls round a portal's box skip FA1's open portals: FA1 walls its own, its tops are flush and its stairs come up under the cheeks. FA1's Node walks pass on the merged park: the Alley stair, the elevator, round the pole, all three Deck stairs and row 7's cross-aisle up to the walkway.
- **The walk audit on the merged park** (`test/walk-audit.mjs`, FA3's 8-way fill; the dump and maps in `.claude/step10/final/`; the load had no console errors):

  | | WA1 (start of step 10) | after FA3 alone | **merged** |
  |---|---|---|---|
  | fans reached | 26,850 of 42,150 (64%), or 26,493 by the new fill | 25,883 | **35,647 of 42,132 (85%)** |
  | falls the real walker takes | 3,131 | 857 | **466** |
  | fall edges over 1 m | 9,830 | 1,459 | **1,033** |
  | lifts out of the pit (pops) | 4,540 | 0 | **0** |
  | cracks in the seat floors | 50.8 m² | 2.6 m² | **3.2 m²** |

  - Now reached: the Pavilion (4,642 fans), the Pavilion Deck (7,816), the 400s (11,531), the LF deck (1,502), Monty's 146-148 (1,502), the Arcade (1,646), the Porch walkway, Harry's upstairs, the LF ramp and escalator.
  - **A regression to fix first: the club concourse and the club seats are cut off** (club-concourse 0 of 5,445 cells; club-level 0, 4,797 fans). FA1's dump, before FA3, reached 5,664 and 1,055 cells.
    - What's ruled out, on the final dump on the CPU:
      - not FA3's walker rules (`WA_OLD=1` still reaches 0);
      - not the new rails across the club concourse's ends;
      - not the rails up the club seats' ends (each removed from the dump: still 0).
    - The elevators' club stops land on the club room's floor (`club`, 18.59), and `club-concourse-rail`, unchanged since step 9 and with no openings, runs between it and the concourse. So the old route in was something else in FA3's `Bowl.js`/`Stands.js` changes.
    - Next: diff the boxes near the club between `.claude/step10/fa1/last-result.json` (before) and `.claude/step10/final/dump.json` (after), and trace the old route on FA1's dump with `WA_PATH`.
    - The real fix is probably doors: in 2008 you went from the club's indoor concourse out to its seats through doors, so open the club room's doorways in the concourse's back rail.
  - Still unreached: the club as above; the 300s (575 of 1,313 cells reached), the press box roof (closed on purpose), the dugouts and pens (not public), Memory Lane's platform (chained), the three other Alley roofs. FA3.md and FA4.md list the remaining falls (the Hall of Fame Club room floor's 7.6 m bends, the Alley's west edge over Monty's, slivers at the 150 ft and 215 ft joints).
- **Not measured after FA2, FA4, FF3 and FA3.** The laptop went on battery at about 20:30, and readings since swing ±40% (PERF.md). Each fixer reports its draw and triangle counts as unchanged or small (FA2 +14,000 triangles, FA3 3 pipelines).
- **Stopped at 21:05 by the owner** ("leave audit notes for the next time and I'll fire you up to resolve conflicts and publish tomorrow"). Everything is merged on `ballpark`, with no conflicts left. Not tagged, not published.

### Tomorrow, in order
1. **The club regression** above (the club concourse and seats unreachable), then re-run the walk audit.
2. **Frame rate, on AC power:** run the standard views, then an A/B of `step-9` against `ballpark`, back to back. Make a worktree at the tag (`git worktree add --detach <dir> step-9`, symlink `node_modules`) and point a job's `"root"` at it.
3. **Lidge's jaw** (FF3.md), and a look at the players' faces close up against the photos.
4. **Publish stage 10:** a screenshot (the fans' faces in a cheering crowd, or the Pavilion Deck's row 7 with the crowd round you) as `docs/stages/step-10.jpg`, update START-HERE, then `git tag -a step-10` and `git push origin ballpark step-10`.
5. **Then, if the owner wants more:**
   - FA4's plans: the 1B Gate's escalators and ramp, the elevator behind 112, the rooftop bleachers, and the walk-throughs (Bull's BBQ, the tarp tube in `places/rail/Tarp.js`, the rituals' stage, the towel cartons).
   - WA2-8: the section counts against the 2008 chart.
   - WA2-12: the outfield tops' drink rails.
   - WA2-10: the Deck's open NW end.
   - The Under.js walls, the fans' chin against a collar, and a fresh critic of the faces.

### 2026-10-29 morning: finished and published (the owner: "finish out your merges, checks and stuff and republish")
- **The club regression, fixed** (34b16dd). The bowl's "club concourse" is an 8 m strip with a collider-only rail along its back. But the Hall of Fame Club's glass stands 0.4 m behind the seats' top row, so that strip is inside the club room. `Club.js` lays the room's floor out to the back wall and moves the elevators' club stops there, and the rail stayed in the middle of the room. It was there in step 9 too: the walk audit reached the club only by falling 9 m off the Terrace onto the club seats, or 5 m off the 300s' end, and FA3's rails closed those falls. The parent chains in the audits' `nodes.json` showed the route. Now `Club.js` takes `club-concourse-rail` out once its floor is down. On the page: the club concourse 0 → 5,768 cells, the club seats 0 → 999 (3,826 fans), the room 821 → 1,641.
- **The walk audit, final** (`.claude/step10/final2/`, no console errors): **37,737 of 42,132 fans reached (90%; 64% at the start of step 10)**. The walker falls 486 times (3,131 at the start), with no pops and 3.2 m² of cracks.
- **The frame rate:** steady this time, though on battery (the anti-aliasing pass held at 1.8-1.9 ms). Every standard view is 37 fps or better, the 400s seat 27.1 ms. Against `step-9` back to back: +0.6 ms in TV center, +1.1 ms in the 400s seat, +3.4 ms in left field (FA2's corner, now about 25 ms, 40 fps), nothing in the celebration ([PERF.md](PERF.md)).
- **Lidge's jaw, narrowed but not fixed.** In FF3's shots every player's smile and blink reach the GPU, but no player's mouth-open term does: no jaw and no brows, for anyone. The records decode right on the CPU (the jaw drops up to 3.7 cm, the blink 1 cm), and the shader reads them in the right order. The next step is a desk shot with `ex.x` forced to 1 in `Players.js`' FF3 block, to tell a weight that reads 0 from a move that doesn't land.
- **Found in passing, not new:** from the Pavilion Deck at strike three, a red-and-white pinstriped box stands on the infield between the mound and second. Step 9 as published has it too, and it doesn't show from the 400s, so it looks like a far stand-in for the pile. Shots: `.claude/step10/stage/box9/` and `box10/`.
- **Stage 10's screenshot:** fans' faces at strike three behind first base, under the 2008 WORLD CHAMPIONS ribbon (`docs/stages/step-10.jpg`).
- **Left for later:**
  - FA4's plans: the 1B Gate's escalators and ramp, the elevator behind 112, the rooftop bleachers, the walk-throughs.
  - WA2-8 (the section counts), WA2-10 (the Deck's open NW end), WA2-12 (the outfield tops' drink rails).
  - Doors in the club's glass: you can walk through it anywhere today, where in 2008 it was doors at the aisles.
  - The Under.js walls, Lidge's jaw, the pinstriped box, and a speed track for the left field corner.
