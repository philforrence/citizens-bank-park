# FA4: the first-base side's ways up, elevators both ways, the things you walk through (step 10)

Fixer FA4, 2026-10-28, branch `worktree-agent-a01431366cc117dde` off `ballpark` at 98e4428 (FA1 merged). Bundle: WA2-1's remainder (the First Base Gate's escalators, the First Base Ramp, the elevator behind 112), WA1-11 (elevators one way only), WA1-8's remainder (the rooftop bleachers), WA1-13's walk-throughs, WA1-12 (the 3B turnstile line). Audits: `.claude/step10/WA1.md`, `WA2.md`.

The coordinator called time about 45 minutes in (the owner asked to finish and publish), so one ticket is done and the rest is research and a plan for whoever picks them up.

## Done

### WA1-11: the elevators go both ways
- **What changed.** `BallparkApp._addElevators`: E rides up a floor and Shift+E rides down one. At the top floor E rides down; at the bottom Shift+E rides up. The prompt names both floors, for example "Elevator up to terrace · Shift+E down to suite level". Before, every stop rode to the next stop round a ring (main concourse, suites, club, Terrace, main), so going from the club down to the suites took two rides by way of the Terrace and the street (WA1-11).
- **How.** Each bank's floors are sorted by height. Shift is read in the interactable's `action` at the moment E is pressed, so `Walker.js` (FA3's) is untouched: its prompt still shows the key E. There is still one interactable per stop, in the same order, so the walk audit's bank-and-stop mapping holds. Each interactable also carries `stop`, `above` and `below` for tools to read.
- **The audit.** `test/walk-audit.mjs` (additive, marked `---- FA4`): the fill rides from a stop to the floors on either side of it by height, not to the next stop round the ring.
- **Evidence.**
  - `BallparkApp.prototype._addElevators` run on the Node park (FA1's harness: real `Bowl`, `Colliders` and `Walker`). Script: `.claude/fa4/scripts/elev.mjs`, in the worktree.
  - It covers all 14 stops in all 4 banks (home, 1B and 3B with four stops each, plus FA1's Alley/Pavilion bank with two), and both E and Shift+E at each stop: each ride lands on the right floor at the right door, and none is wrong. For example, 1B club: E goes to the Terrace (56.7, 24.69, 26.83) and Shift+E to the suite level (46.35, 10.97, 16.35). Alley: E goes to the Pavilion at 17.12; at the Pavilion, both keys go down to the Alley.
- **Checks.** `npm test` passes. `node test/continuity.mjs` gives start hash 801248349 and duration 3785.503, both kept.
- **The page.** A full-park desk job (`.claude/fa4/job-load.json`, 800 × 500) loaded cleanly, with no console errors, in 12.9 s.
  - At the 1B club stop the prompt reads "Elevator up to terrace · Shift+E down to suite level".
  - `meshRenderer.stats` there: 948 draws, 3,509,865 triangles, 779 pipelines.
  - TV center (play 20): 848 draws, 4,101,190 triangles, 779 pipelines.
  - The pipelines are FA1's 779; there's no new geometry, so the draws and triangles are the day's build, not this change.
  - The shots are in `.claude/fa4/shots-load/`.
- **Frame rate.** No risk: no geometry, and nothing runs per frame (the prompt text is built only while you stand at a door, as before).

## Not done (research and plan, for the next fixer)

### WA2-1's remainder: the First Base Gate's escalators and the First Base Ramp
- **What 2008 had.**
  - **The 2008 guide** (`.claude/ref/leftfield/phillies-com-2008-10-convenience-guide-...txt`):
    - "First Base Gate - Takes guests from the First Base Gate Plaza to the Pavilion Level with a second escalator taking guests to the Terrace Level."
    - "First Base Ramp - Provides access to the Suite Level, Pavilion/Hall of Fame Club Level and Terrace Level."
    - "First Base Gate [stairway] - gives access to the Suites, Hall of Fame Club and Terrace Level". That is the open stair towers either side of the gate, which `Exterior._stairTower` draws with no walkable treads.
  - **Finding Your Seats** says 206-211 are reached by the "1st Base Gate and take Escalator immediately inside gate". MLB's facts page puts the escalators "near Sections 114, 126 and 140".
- **Where, in our frame** (from `.claude/fa4/scripts/probe.mjs`):
  - **The gate.** The gate line runs through (73.5, 25.48). Along it, u = (−0.70, 0.72); outward, n = (0.72, 0.70); the gate's `G.P( s, o, y )` comes from `buildGate1B`.
  - **The Break** is at about G.P( −16, −20 ), roughly 10 m up and 20 m in from the gate line. Above the court inside the gate:
    - the Pavilion's 1B end, its front at (64.1, −6.1);
    - the Pavilion concourse (17.12, x 73.6-92.3, z −32.2..1.6);
    - the club concourse's end (18.59, ending about (64, 11));
    - the Terrace walkway's end (24.69, its end edge (78.0, 14.8)-(67.3, 3.6)).
  - **The Phun Zone court** is east of the gate, at G.P( −34, 2 ) = (98.7, 2.45).
- **What it looks like** (2008 photos):
  - `concourse1b/2008-07-23_flickr_rdowens_3626076537_first-base-gate.jpg`, upper right: the ramp's long runs rise eastward behind the gate, screened by grey perforated-metal panels in maroon steel frames.
  - `concourse1b/2008-12-13_flickr_yeago81_5248040315_...ramp-tower-from-southeast.jpg`: the ramp tower's end, with cantilevered landings on maroon brackets, galvanized mesh rails, disc lamps on the top landings, and the runs going off to the north-east.
  - The escalators were presumably built like the LF escalator, the same architects' detail: brushed stainless, a pale green standing-seam canopy on maroon posts (mostlyphilliespics, Sept 2009; `leftfield/Escalator.js`, FW3's).
  - I found no photo of the 1B gate's escalator itself; searches of Flickr and the web turned up only the LF one.
- **The plan.**
  - **Two escalators** in a new builder in `places/concourse1b/`, written on the LF escalator's approach but with walkable steps: stepped walkable boxes up the 30° incline between solid balustrades.
    - The first runs from the court just inside the gate up to the Pavilion concourse's 1B end at 17.12, about 17.5 m of run. A short ramp or two steps joins it to the club concourse at 18.59.
    - The second runs from there up to the Terrace walkway's end at 24.69.
  - **The First Base Ramp** goes in the court east of the gate along the east arm of the notch, (84.7, 14.0)-(113.4, 39.5): switchback runs at 1:12 with landings at 10.97, 17.12/18.59 and 24.69, each landing bridged to the concourse it serves, as FA1's `PavilionWays` Kit builds stairs and landings.
  - **Sign text** should come from the 2008 guide.
  - **Watch:**
    - the gate's colliders (`gate`, `turnstile`, `table`, `boxes`, x 61-84, z 13-36);
    - the stands' `concession` colliders;
    - the elevator core at (58.7, 28.8).

### The elevator behind 112 (306-310)
- **Plan:** a new bank in `Bowl._elevators` (an `---- FA4` block, after FA1's), with two stops, "Main concourse" (7.01) and "Pavilion" (17.12), in a precast tower like FA1's `Kit.tower`. Put it on the concourse behind 112: `Walk1B` s ≈ 120-130, d ≈ 48 (behind the stands' line), so its upper door opens onto the Pavilion concourse (x 73.6-92.3, z −32.2..1.6). `BallparkApp._addElevators` already takes banks of any size, and they go both ways.
- Finding Your Seats lists no other public elevator we lack, on the stairs-and-elevators side, beyond FA2's (behind 137 and 141).

### WA1-8's remainder: the rooftop bleachers
- **What 2008 had.**
  - `alley/crop-2008-10-29-ws5-rooftop-bleachers-night.jpg` (Game 5) and `alley/commons-2011-rooftop-bleachers.jpg` (structure only).
  - The bleachers stand back from the roof's front rail: fans stand along the galvanized rail in front of the first row of benches.
  - The roof deck runs at roof level round their sides. Fans walk on the west side, and the east side has bar-height tables.
  - The stair aisles start from the front walkway. The open side is closed in navy panels, and a brick stair head-house stands behind.
- **Plan:**
  - In `Landmarks.js`, pull each bleacher back from the front edge about 1.4 m (rows 0.8 m deep, so the back row stays on the roof), and narrow it about 1.3 m on the stair's side. That leaves a roof-level walkway from FA1's landing (x 33.3-36.4, z −150.2..−149.0) along the side to the front.
  - Make the treads walkable boxes (0.4 m risers) and the benches walkable 0.3 m boxes at the tread + 0.43. A solid box lower than the 0.62 m step is ignored by `resolveCapsule`, so the benches must be walkable to be stepped over rather than walked through.
  - Make the side and back guardrails solid.
  - Export the layout so `AshburnAlley2008._bleacherFans` seats the fans on the same benches.
  - Extend FA1's landing west onto the [2, 30] roof for the other bleachers.
  - Give the retired-numbers house (x 4-16) a solid collider.
- No code yet.

### WA1-13's walk-throughs
Not started. Where each is, for the next fixer:
- **Bull's BBQ:** `places/alley/Bulls.js`, at (−71.5, −140): the tent posts, counter, picnic tables and umbrella poles. Cylinders for the posts and poles, boxes for the counter and the tables.
- **The tarp tube:** `places/rail/Tarp.js` (not `Field.js`; nobody's list has it), the `tarp-tube` mesh at about (−64, 0, −56).
- **The rituals' stage:** `places/rituals/Stage.js`.
- **The towel cartons at the 3B gate:** `places/gate3b/Gate.js` ~l. 222-233. The cartons are 0.4 m boxes: as a solid collider, a box under the 0.62 m step is ignored, so they need to be walkable or reach over 0.62 m.
- **The 3B stalls:** `Concourse3B*.js`.
- **The suites:** `Suites.js` has wall colliders (`_colliders`) but none on the furniture.
- **The RF corner behind 101-104:** unchecked.

### WA1-12: the turnstile line at the 3B gate
- Not checked in the page.
- **The method I'd use:** a desk shot whose `js` holds W, steering the walker by wrapping `walker.update`, with `frames` about 240, so the Cast's draw-time offsets run while it walks in from the plaza. A second shot reads where it got to.

## Files touched
- `src/ballpark/BallparkApp.js`: `_addElevators` only.
- `test/walk-audit.mjs`: additive, `---- FA4`: the fill's elevator rides.
- `docs/notes/gauntlet/FA4.md`.
- Local, ignored: `.claude/fa4/scripts/` (FA1's Node park harness, repointed: `park.mjs`, `stubs.mjs`; `probe.mjs`, which dumps the 1B gate and The Break's geometry; `elev.mjs`, the elevator check) and `.claude/fa4/job-load.json`.

## What the merger must know
- The interactables keep FA1's shape (one per stop, bank by bank). `test/walk-audit-dump.js` reads `it.text()`, which still works. `test/walk-audit.mjs` now models up and down rides; the old ring model would report the Terrace→main ride, which no longer exists.
- Shift is also sprint, but that doesn't matter at a door. The help screen doesn't list Shift+E; the prompt does.
- No geometry, no new meshes: no frame-rate risk.
