> ## 🛑 WHERE WE LEFT OFF: Saturday 2026-09-26, 23:04 EDT
>
> **Stopped for the night here.** All 8 round-1 texture agents are merged into `ballpark`; nothing below has started.
> Pick up at **section 7 (decisions)**, then **section 1 (GPU)** → **2 (speed)** → **3 (QA together)**.
> No agents are running. Don't start round 2 until the decisions in section 7 are made.

# Plan: next session

Written 2026-09-26 at 23:04 EDT. Nothing below has started; it waits for your review.

## Where we are

- **Branch `ballpark` at 5718bd8.** All 8 round-1 texture agents are merged:
  - T1: the dugouts.
  - T2: the crowd.
  - T3: the concourse.
  - T4: the Liberty Bell and Memory Lane.
  - T5: Phanavision.
  - T6: the Suite & Club entrances and the facade frontages.
  - T7: the players and umpires.
  - T8: the bowl, suites, booths and FOX cameras.

  Three merges had conflicts, all one or two lines. Both sides were kept.
- **Smoke test of the merged build:** it loads with no console errors, and plaza, high view and field level look right. Shots are in `.claude/qa/shots/merged/`.
- **It is slower.** Before and after the merges, same views, run back to back:

  | View | Opaque pass before (62f9449) | After (5718bd8) |
  |---|---|---|
  | TV center field camera | 14.6 ms | 36.5 ms |
  | TV high home camera | 13.7 ms | 32.1 ms |
  | High overview | 19.6 ms | 35.9 ms |
  | Load to "Ready" | 7.6 s | 25–37 s |

  Another session's headless Chrome was using the GPU at the same time, so these are rough. The ~2.4× jump is real, but the per-part breakdown I tried came out as noise (it gave negative costs). No agent profiled its own work.
- **Notes now live in the repo** so they survive `/tmp`:
  - `docs/notes/round1/`: T1–T8 reports, the brief and the round-2 brief.
  - `docs/notes/audit4/`: the 50 section findings, the source of codes like BW01 and H07.
  - Screenshots and the QA scripts (`shot.mjs`, `cam.js`, the perf helpers) are in `.claude/qa/`. That folder is gitignored and stays local.

## 1. First: stop fighting over the GPU

**Why it's bad now.** Every agent opens its own headless Chrome with the whole park at 1280×800. Its render loop draws full frames the whole time the page is open (TAA, 3 shadow cascades, haze), even while the agent is only thinking. With 8 agents that is 8 full-rate renderers, plus other sessions on this machine. One of those (a Playwright Chrome) runs with `--disable-frame-rate-limit --disable-gpu-vsync`, so it renders as fast as it can. Loads took minutes and profiling was useless.

**The options, all put together into one approach:**

1. **A GPU lock (mutex).** About 30 minutes.
   - New `tools/gpu/lock.mjs`: a machine-wide lock at `/tmp/gpu-render.lock`, taken atomically with `mkdir`.
   - The lock records owner, pid and start time.
   - Waiters queue first-in-first-out with ticket files.
   - The lock is stale if its pid is dead or it has been held more than 3 minutes.
   - `node tools/gpu/lock.mjs run -- <cmd>` wraps any command, and `shot.mjs` takes the lock itself from browser launch to close.
   - An `--exclusive` flag waits for the queue to drain and then holds everyone off. It is for profiling, the only way to get honest numbers.
   - Other Claude sessions on this machine can use the same lock. With your OK I'll message them the path and usage. It only helps if they use it.
2. **Render on demand (`?still`).** About 1 hour.
   - The app stops its loop after load.
   - `__app.still(n)` renders n frames (about 16, enough for TAA to settle) for a shot, then stops again.
   - A tab that is waiting costs nearly nothing.
   - Agent shots default to 800×500 JPEG. Full 1280×800 is only for your review sets.
3. **Build only what you're working on (`?only=` / `?focus=`).** About 2 hours.
   - `?only=field,players,details` builds and draws just those parts. The app is already split into parts (complex, surroundings, exterior, bowl, crowd, concourse, landmarks, fascia, field, details, people, players), so this is mostly a switch around each build.
   - `?focus=x,z,r` hides everything outside a circle.
   - Load time drops from ~30 s to a few seconds, and each frame costs a fraction.
   - Every agent checks its own area this way. Only the coordinator loads the whole park.
4. **One shared renderer (the "render desk").** Half a day. This is the "they all share one renderer" idea.
   - One long-lived headless Chrome with one GPU context, fed by a queue folder: jobs go in as `/tmp/render-desk/jobs/*.json` and images come back in `done/`.
   - A job gives the worktree's dev-server port, URL parameters, the steps (seek, camera, hour, weather) and the shots.
   - The desk runs jobs one at a time and keeps up to 2 pages warm, idling in still mode.
   - Agents never launch a browser. Only one thing ever touches the GPU, and it is never idle-busy.
5. **Workflow rules for agents.** These cost nothing and go in the brief.
   - At most one render batch per agent every ~20 minutes, with all its shots in that one job.
   - Check on the CPU first:
     - `node --check`, `npm test`;
     - the Director timeline run in Node (T7 did this);
     - canvas textures drawn on a plain 2D page, without WebGPU (T5 did this).
   - Run 4 agents at a time, not 8, in two staggered waves.
   - Agents don't profile. The coordinator does one profiling pass per wave, under `--exclusive`.
   - Never launch Chrome with `--disable-frame-rate-limit`.
6. **An experiment: rendering on the CPU (SwiftShader).**
   - Chrome can run WebGPU on SwiftShader, which uses no GPU at all. It is slow, maybe seconds per frame.
   - If a 640×400 still takes under ~30 s, use it for layout and geometry checks, and keep the real GPU for light and look.
   - It would also let cloud sessions render, since they have no GPU. That is how your cloud credits could help.

**My recommendation:**
- Tomorrow morning, build 1, 2 and the small shots, and write 5 into the brief. That cuts the contention right away.
- Then build 3.
- Build 4 before round 2 starts if we run more than 4 agents.
- Try 6 on the side.

## 2. Then: win back the speed (no fidelity cuts)

Before any new detail, with the GPU exclusive:

1. **Find which merge costs what.** Profile each merge commit in order on the same 3 views (TV center, TV high, high overview), plus warm load time: 62f9449 → T4 → T3 → T8 → T2 → T7 → T5 → T1 → T6. That's 9 short loads.
2. **Suspects:**
   - **T2's crowd:** it's the largest draw. The vertex shader is heavier and the near figure has ~20 more triangles.
   - **T7's players:** 96 slots, ~1,500 more vertices, and three more storage reads per pixel.
   - **T8:** the lit suites traced into depth, and the camera operators.
   - **T1's dugout figures and gear:** about 12 draws.
   - **Load time:** most likely T5's lamp-matrix drawing and the new canvas textures (T2 atlas, T6 frontages). Profile the load on the CPU.
3. **Fix without losing detail.** Use the same moves as last time:
   - LOD distances;
   - interior-mapped rooms only on their openings;
   - batching;
   - no shadow casting for small parts;
   - drawing canvases once and caching them.

   Target ~60 fps plugged in, back to the post-optimisation numbers from before round 1.

## 3. QA together (you and me)

Run `npm run dev`, then open http://127.0.0.1:5189/. Press C to cycle the cameras; add `?hour=21` for night.

**New since you last looked, by area:**
- **Field level:**
  - dugouts rebuilt (taller roof, 2008 logos, steps, bench, fluorescent strips);
  - helmets, bats, coolers, the orange heater;
  - Manuel and Maddon at the rails, benches manned.
- **Players:**
  - faces and builds per player;
  - uniforms worn their way, gear, dirt and rain on them;
  - pitcher and batter routines;
  - umpires' calls.
- **Crowd:** every fan different (age, build, face, hair, hats, cold cheeks), with 3 levels of detail.
- **Concourse:** the 2008 line-up of stands with lit kitchens, drink rails and section plates at the aisle tops.
- **Center field:** the Liberty Bell sign rebuilt, Memory Lane behind the batter's eye.
- **Left field:** Phanavision following the game (amber lamp matrix, the video board's cards, replays and prompts, rain delay, celebration).
- **Bowl:** the Arcade and right field corner closed, the Pavilion's 2008 boards, lit suites, the booths, FOX's cameras and operators.
- **Outside:**
  - the Suite & Club entrances;
  - the Majestic store, McFadden's and the ticket windows;
  - PHILADELPHIA in buff brick.

**Things the agents never saw rendered. Please look at these:**
- **T5 board screens:**
  - the pile;
  - THANK YOU;
  - RED OCTOBER;
  - WELCOME BACK;
  - NOW PITCHING;
  - the wide shot.
- **T1:**
  - the dugout interiors by day;
  - the bench emptying at the last out and in the rain delay.
- **T7:**
  - the plate umpire's strike and punch-out;
  - the base umpires' out calls;
  - the batter stepping out;
  - elbow guards;
  - batting-glove colours.
- **T8's last two tweaks:** standing figures' trousers, booth ceiling.
- **T4:** the bell's toll volume.
- **T6:** the First Base ticket windows, and the West/East entrances after the final colour tweaks.

## 4. Known problems to fix (what the agents flagged)

**Field and pens**
- **Bullpens:**
  - the chain-link renders as solid black sheets from the Alley and beyond ~15 m;
  - the mums planter is purple noise;
  - the pens run under the Alley floor, so the Alley's edge is a bare concrete lip (`Field._buildBullpens`).
- **A security guard on a ledge:** one stands on top of the backstop wall, and one on each dugout roof (`People.js`).
- The backstop brick looks flat and unlit at night.
- **Rain delay (H14):** the Rays take the field and players jog on the tarp (`Director.js`).
- The dugout camera wells are built but empty.

**Bowl and concourse**
- The suite level's underside is a black slab by day (H07, `Bowl.js`).
- The field-level vomitory crates are still there (BW09).
- **Concourse open to the sky:**
  - down the lines, where the 200 level is missing (BW01);
  - under the Scoreboard Porch, whose brick back wall also shimmers at mid distance.
- Rain streaks draw inside the covered concourse.
- The concourse trash cans are gone. Wanted: red Phillies cans and blue recycling, with condiment stations.
- Concourse stands sit under the RF deck's columns past The Break (`Concourse.js`).
- Standing figures in the suites read as tall pills from a distance.

**Landmarks**
- **RF light tower:** it should be a twin-leg portal frame. Change `_lightTower( …, [ 6, 6 ] )` to `[ 9.5, 1.4 ]` in `Landmarks.js`.
- **The Alley:**
  - no rail over the pens;
  - a big empty grey apron behind the batter's eye, with a lone kiosk box at (40, −128);
  - the lamp post at x = 50 stands 0.5 m from the bell tower's leg.
- **Left field:**
  - the rail on top of the wall reads as opaque grey panels from the field, and the flowers don't show;
  - no seats over Monty's Angle;
  - the LF ramp is missing, leaving a blank brick wedge behind the foul pole.

**People**
- Full beards read as a dark mask at distance (T2).
- Seated fans look boxy up close.
- **The crowd's mood hooks are flat:** the ripple uniforms are in place but unused, and Rays fans never stand.

**Players**
- Seven players have no 2008 season line on the board: Gross, Perez, Eyre, Condrey, Blanton, Bradford, Johnson. Their numbers need looking up.
- The board can't show RBIs; the game state doesn't track them.
- The home whites read grey-blue in the TV shot by day.
- **Rain gloss:** it makes all cloth (jerseys, flags, the tarp) look plastic. `frame.wet` treats every non-DRY surface like concrete.

**Outside**
- **Street trees:**
  - on Pattison, crude blobs with thick trunks;
  - on the plaza, smooth spheres.

  Visible in the smoke-test plaza shot.
- Every parking lot is empty on a sold-out night.
- Pattison and 11th Street have no curbs, crosswalks or signals.
- The blade sign's text is mirrored on its back; a ticket window's "6" reads as "E".

## 5. Round-1 work that never got built

Each agent was asked for 15 changes and stopped at 1–2 when we wound down. Their full lists and research are in `docs/notes/round1/T*.md`:

- **T1 field:**
  - the tarp tube on the 3B side with its "WORLD SERIES '08 ON FOX" banner;
  - the crew pulling the tarp, with sandbags;
  - separate teal backstop cushions;
  - wall panels down the lines;
  - a worn plate and chalk;
  - painted-in grass logos;
  - the on-deck doughnut and pine tar;
  - ball kids;
  - relievers in the pens;
  - puddles on the warning track.
- **T2 crowd:** the parts and data bits are already in place for:
  - 2008 name-and-number jerseys, including 1980 powder blues;
  - homemade signs, different on the 27th and the 29th;
  - props with idle actions (beer, hot dog, foam finger, scorebook, flip phone, cowbell);
  - camera flashes at the last out;
  - kids on shoulders;
  - fans spilling into the aisles;
  - beer runs;
  - rain emptying seats;
  - reactions rippling out from the play;
  - named featured fans.
- **T3 concourse:**
  - red carts (water ice, cotton candy, hot chocolate);
  - live TVs showing the game;
  - grill steam;
  - wet footprints and litter;
  - **Concourse people:** the whole cast is still to do; the hooks are in place.
    - small rigs;
    - kids;
    - ponchos;
    - trays;
    - rail leaners;
    - families;
    - program sellers;
    - the restroom line.
- **T4 center field:**
  - the brick promenade and All-Star Walk markers;
  - the picket rail and window boxes over the pens;
  - the Wall of Fame, rewriting `_wallOfFame`;
  - the giant pinball machine, the ATM and carts;
  - Bull's BBQ with smoke;
  - fans in the rooftop bleachers;
  - clock hands on the replay's time;
  - flags;
  - the Alley's night light pools.
- **T5 left field:**
  - the sponsor panels on the tower;
  - the Phillies script;
  - Harry the K's;
  - the porch concourse;
  - the LF ramp;
  - Monty's Angle seats;
  - the flower bed and wall ads.
- **T6 outside:**
  - fans arriving, with queues;
  - vendors;
  - **Pennsylvania State Police horses:** Philadelphia's mounted unit was disbanded 2004–2011 (Inquirer, 30 Oct 2008).
  - **Fox29's morning show** at the Third Base Gate (same source);
  - the broadcast compound;
  - cars and tailgaters in the lots;
  - curbs and street furniture.
- **T7 players:** motions written but unused (rosin, on-deck kneel, coach signs, rake, tarp pull, the Phanatic's dance). Scenes still to build:
  - base coaches;
  - bat boys;
  - the grounds crew and tarp crew;
  - the Phanatic on the dugout roof;
  - the reworked celebration (Lidge's glove on the grass, the pile, Ruiz in his gear).
- **T8 bowl:**
  - contoured seats up close;
  - section signs in the upper decks;
  - speakers, TVs and downlights under the decks;
  - rain on the stands (wet seats, dry covered rows, drips off the roof edges);
  - rain visible in the light beams;
  - wind on the 29th;
  - light tower glow.

## 6. Round 2: the eight immersion worlds

As planned (`docs/notes/round1/ROUND2.md`). Round-1 leftovers go to the world they belong to. Run them in two waves of 4 under the GPU rules above, and do a critic pass after each wave.

| World | Also picks up |
|---|---|
| **Sound** (crowd bed, PA, organ, the bell's toll, rain, 2008 walk-up and between-innings music) | T4 toll level |
| **Your seat among people** (the hero crowd around you, the neighbours, reactions rippling out) | T2's list, beards, boxy fans, flat mood hooks |
| **The broadcast** (the director cutting FOX's cameras, the score bug, replays in sync with the board) | T8 cameras, T5 board sync |
| **Rituals and the timeline** (tarp, grounds crew, Phanatic, 7th inning, the suspension and resumption, the celebration) | T7's scenes and motions, H14, T1 tarp |
| **Light and shadow** (night pools, light towers, backstop at night, suite underside by day) | T4 night Alley, T8 tower glow, H07 |
| **Photoreal surfaces** (CC0 materials; wet cloth vs wet concrete; whites that read white) | rain gloss, grey whites, chain-link, trees |
| **Faces and bodies** (players, fans and staff up close) | suite pills, seated fans |
| **Your hands on it** (walk anywhere, buy a cheesesteak, find your seat, the camera and replay controls) | the concourse cast, T3 people |

Round 3: a full critic pass against the 2008 photos and broadcast, then fixes.

## 7. Questions the agents left, and decisions for you

1. **GPU plan:** build the lock and still mode first thing, and the render desk before round 2? (Recommended.) And may I message the other sessions on this machine about the lock?
2. **How many agents at once:** 4 (recommended), or 8 on the render desk?
3. **Speed:** fix the ~2.4× regression before any new work? (Recommended.)
4. **Round-2 order:** which 4 worlds go first? I'd start with sound, your seat among people, rituals and the timeline, and light and shadow.
5. **The seven season lines** (T5): I'll look them up unless you want to supply them.
6. **Hosting:** still waiting on `gh auth login`, the repo name and your OK for a public repo.

## Housekeeping

- The 8 round-1 worktrees and branches (`.claude/worktrees/agent-*`) are all merged. Delete them after QA.
- The dev server (5189), the stages preview (5190) and two old snapshot servers (5192/5193) are still running. None of them use the GPU; the snapshot servers can go.
