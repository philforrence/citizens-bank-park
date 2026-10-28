# FZ1, round 5: the pre-publish fixes

Fixer FZ1, 2026-10-28 17:38-18:05, branch `worktree-agent-ac4e9ccc3d083b804` off `ballpark` at e18ceb2 (C5F-1, the relievers, already fixed there). Tickets: critic C5F's breakages (`.claude/gauntlet/r5/C5F.md`) C5F-2 to C5F-6, done smallest risk first: C5F-3, -5, -4, -2, -6. One commit each.

**Shots.** In this worktree's ignored `.claude/gauntlet/FZ1/` (absolute: `/Users/phillipforrence/citizens-bank-park/.claude/worktrees/agent-ac4e9ccc3d083b804/.claude/gauntlet/FZ1/`), 1280 × 800 on the full park (no `only=`), HUD on where it matters:
- `before/`: e18ceb2, before any change. No console errors; the page loaded in 12.1 s.
- `after/`: everything, the same shots plus `z04b-past-crew`. No console errors; the page loaded in 23.4 s (the desk was busy).

The recipe is `mkjob.mjs` there (`node mkjob.mjs before|after`), through C5F's `helpers.mjs` (real key presses, held keys over rendered frames, what the HUD says).

**The replay's clock is untouched.** Nothing in the Director changed. `node test/continuity.mjs`: 504 segments, start hash 801248349, duration 3785.503. `npm test` passes.

**Counts** (`meshRenderer.stats`):

| | before | after |
|---|---|---|
| the opening view (`z01`) | 948 draws, 3,524,934 triangles, 769 pipelines | 948 draws, 3,525,150 triangles (+216: the gable posts), 769 pipelines |
| TV center, play 57 (`z14`) | 429 draws, 1,606,220 triangles | 430 draws, 1,616,249 triangles (the crowd at that moment; nothing of mine is in this view) |

## Per ticket

### C5F-3: the walking HUD never said the game was over (done)
- **The fix** (`game/GameHUD.js`): `refresh` now runs `_walkCard()` when you're walking, the same way it runs `_tvGraphics()` on TV. Both use one test for the end (`_final()`, FB3's: the pitch past the strike, its result, the celebration) and one tally (`_totals()`, split out of `_board()`).
  - **After the last out:** the inning tab reads Final, there's no count, three outs are lit, and the line reads "Phillies win the World Series · R H E · TB … · PHI …". The time label reads "Final · 58:50".
  - **The 27th's delay:** no count and no outs. The line reads "Rain delay · the tarp is on, bottom of the 6th", then from FB3's k > 0.7 "Game suspended · to resume in the bottom of the 6th, tied 2-2". The time label reads Rain delay, then Suspended.
  - **The 29th's return:** no count before the first pitch, as the bug has it.
- **Evidence:** `z09-hud-final` (t 3530), `z10-hud-delay` (2183), `z11-hud-suspended` (2215). Before, all three showed the last pitch: "▲ 9 0-2 Lidge pitching to Eric Hinske", "▼ 6 1-1 Balfour pitching to Geoff Jenkins". After:
  - **Final:** "TB 3 PHI 4 Final · Phillies win the World Series · R H E · TB 3 10 0 · PHI 4 8 1 … Final · 58:50".
  - **The delay:** "▼ 6 · Rain delay · the tarp is on, bottom of the 6th … Rain delay · 36:23".
  - **Suspended:** "▼ 6 · Game suspended · to resume in the bottom of the 6th, tied 2-2 … Suspended".

### C5F-5: T's line on F1, and the panel's clock (done)
- **T:** at the start, the sky follows the game's clock and nothing is "running". T sets the time of day running and lets go of the game's clock. That's useful (dawn over the park), so T stays as it is and the sheet now says what it does: "Run or stop the time of day · Off the game's clock; the Sky panel's Game clock puts it back" (`ui/UI.js`, `_buildHelp`).
- **The panel's clock:** the Sky panel's Time of day shows the park's clock (EDT). At the last out it reads 21:58, where it used to show 21:14 (solar) while the Game clock tooltip said 9:58 pm.
  - `TimeOfDayControl` takes an `offset` (hours from the value to what it shows and what you type).
  - `BallparkUI` passes `-EDT_TO_SOLAR` (now exported from `BallparkApp.js`), with a tooltip.
  - The light still runs on solar time; only the label changed.
- **Evidence:** `z12-f1-help` (helpText), `z13-h-panel` (panel text, and after T). After:
  - **The sheet:** T reads "Run or stop the time of day".
  - **The panel:** "Time of day 21:58" at t 3487 (was 21:14). After T it reads 21:59, with the toast "Time running".

### C5F-4: the towel staffers 8-24 m from their cartons (done)
- **The bug:** `towelSpots[ k ].at` is `[ x, y, z ]`, but both gates' Arrivals read `at[ 1 ]` (the floor's height, 7.16) as z. The four staffers stood in the concourses (3B: z 7.16 for spots at z 31.66 / 21.56; 1B: 7.16 for 15.02 / 25.33). Now both use `at[ 2 ]`.
- **The cartons** (`gate3b/Gate.js`, both gates):
  - **Where the stack stands:** 1.25 m to the staffer's outer side. Everyone coming in passes the staffer and then bears in toward the concourse's middle (3B's `_goIn`: via `T.s ± 0.7`, then toward `0.2 × via`). That line ran straight through the old stack, which stood at the staffer's own `s`. Out at his side it's out of every path in.
  - **The third carton** now sits on the inner one. It used to hang in the air between the two lower ones.
  - **The walker's box** is 1.0 m wide, was 1.5.
  - **`towelSpots` gives `stack`**, and both Arrivals push it onto their obstacles (r 0.7), so the routed walkers go round it.
- **Evidence:** `z07-towel-cartons`, `z08-towel-cartons-s2` (seek 300). The js returns each staffer against his spot, the stacks, the 1B lanes and a count of 3B folk within 0.6 m of a stack over 6 × 20 frames. After:
  - **The staffers** are on their spots: 3B (-70.48, 31.66) and (-80.75, 21.56); 1B (73.08, 15.02) and (63.03, 25.33).
  - **The 3B stacks** are at (-69.03, 31.97) and (-81.08, 20.11), and no folk came within 0.6 m of one in the 6 samples.
  - **The 1B gate is not checked on the picture** (it wasn't in this job). Its lanes are at s ±1.8, ±5.4, ±9 and ±12.6, and its in-walk goes straight down the lane, drifting inward (`concourse1b/Arrivals._goIn`). So the ±9 lanes now pass 0.4-1 m from the stacks at ±8.45, about as near as the old stacks at ±7.2 were to the ±5.4 lanes.

### C5F-2: W from the start walked you through FOX 29's live shot (done)
- **The fix** (`gate3b/TV.js`): the whole live shot moves 5.5 m off the walk's line, toward the store. Camera `[-107.8, 61.3]` (was `[-103.2, 64.4]`), reporter `[-104.0, 56.1]` (was `[-99.4, 59.2]`). Everything is built from those two points (the tent, the lights, the crew, the fans behind her, the obstacles), so it all moves with them, at the same angle: the gate is still behind her, and the shot is still in the opening view, a little left of centre.
- **Off the line** (field frame, from the start toward the gate):
  - the camera and the reporter: 5.9 and 5.6 m;
  - the nearest leg of the light stand: 4.2 m;
  - the producer: 4.4 m.
  - The plaza's planters were kept 3 m clear of the same line (`ThirdBaseGate.clear()`).
- **Colliders:** the reporter, the photographer and the producer get small cylinders (r 0.3, 0.3, 0.35; 1.8 m high), as the tripod and the light stands already had.
- **Evidence:** `z03-walk-3s`, `z04-g-double`, `z04b-past-crew` (W from the start, then G with Shift), `z05-crew-side` (from the side, high). Before, `z04` was the photographer's back filling the left half of the frame, with the walker at (-103.99, 66.14), 1.9 m from the camera. After: the same keys walk straight on to (-93.69, 50.89). On the way they cross (-98.84, 58.51), the reporter's old spot, 5.6 m from where she stands now. `z04` now shows the gate ahead, with the live shot's fans at the left edge of the frame.

### C5F-6: the World Series tent a flat, glowing white box at night (partly done)
- **The change** (`gate3b/Tents.js`, the shaders only, plus a few tubes):
  - **The roof:** glows most over the two lamps (a quarter of the way in from each end) and toward the ridge. It falls off toward the ends and the eaves, and the folds between the rafters glow less.
  - **The gables:** the apex's uv moved up the print's margin, so the gables brighten toward the ridge too, instead of one flat tone.
  - **The walls:** glow most up by the eave and least at the foot, brightest mid-panel. The frame's uprights (every 3 m) are dark lines against the glow, and new gable posts (every 3 m across each end, real tubes) match the lines.
  - **The valance:** a little glow only.
  - **The base albedo** is a quarter to 30% darker at night, so the street lamps don't flatten it.
- **Evidence:** `z01-start-clean` and `z06-tent-night`. After, in `z06`: the walls are brighter under the eave and dimmer at the foot, and the gable end shows its new centre post as a dark upright.
- **But the tent still reads mostly as one bright white box:** the gable triangle and the roof are only a little less even. I committed it because it's no worse and loads with no errors.
- **What's left:**
  - turn the glow well down overall (the roof to about 0.6 of now, the walls to about half), so the lamps' hot spots carry the look;
  - the rafters in silhouette on the roof (that needs the roof's uv in metres, not 0..1);
  - the gable's glow falling off sideways from its post.

## Files touched
- `src/ballpark/game/GameHUD.js` (C5F-3)
- `src/ui/UI.js`, `src/ballpark/BallparkUI.js`, `src/ballpark/BallparkApp.js` (C5F-5; in BallparkApp only `export` on `EDT_TO_SOLAR`)
- `src/ballpark/places/gate3b/Gate.js`, `src/ballpark/places/gate3b/Arrivals.js`, `src/ballpark/places/concourse1b/Arrivals.js` (C5F-4)
- `src/ballpark/places/gate3b/TV.js` (C5F-2)
- `src/ballpark/places/gate3b/Tents.js` (C5F-6)

`game/Rig.js`, `Players.js` and `Looks.js` are not touched.

## Left, and noticed
- **C5F-6** is only partly done (see above).
- **C5F-4 at the 1B gate:** its in-walk doesn't go round obstacles. Look at a 1B shot. If the ±9 lanes brush the stacks, move the 1B stacks inboard, or bend that walk round them.
- **C5F-2:** the cable still runs from the tent across the walk to the truck, flat on the paving, as before.
- **Noticed (not mine):** in the 27th's opening frames (`z04`, `z06`) the rain streaks close to the eye draw as bright vertical bars.
- **Frame rate:** no new per-frame CPU work. The HUD redraws at most once per 0.1 s of replay, the tent's change is in its shaders, and the rest is done at build time.
