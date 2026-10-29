# Step 11's log: the gauntlet again, with adversaries

The plan is [../worlds/STEP11.md](../worlds/STEP11.md). Every merge is here with its evidence and the skeptic's verdict; the frame rate after each is in [PERF.md](PERF.md), "Step 11".

- **Start (2026-10-29 07:45):** stage 10 published. Round 1 launched: SC1 (spot checks), AD1 (breaker), CR1 (the people up close), FX1 (the players' mouths, the pinstriped box).
- **SC1, spot checks** (returned 08:15; findings `.claude/gauntlet/s11/r1/SC1.md`, shots in `SC1/`): 24 random standing spots from the walkable cells (seed 20261029) and 6 TV moments, three full-park jobs with no console errors, 16 findings. The top five:
  1. standing fans' shins pass through the seat pans;
  2. raised arms end in points, with no hands;
  3. the concourse at strike three is one rank deep;
  4. the Spectrum and the Wachovia Center are black drums (and the Wachovia Center's signs read "WACHOWNTER");
  5. the seats read royal blue under the lights.
  The rest: an empty club in the rain, the Pavilion concourse's blank brick, a bare plaza inside the RF Gate, pixel-art carpet, cartoon portraits and murals indoors, a suite counter you walk into, yellow nosings, bare roofs, paper-cone umbrellas, hexagonal wheels, and a rail that burns white. Held up: the TV moments, the 27th's infield dirt (within FOX's own variation), the Spectrum's lettering.
- **FX2, the seats** (launched 08:17): SC1-1, SC1-5, SC1-12, SC1-16.
- **AD1, the breaker** (returned 08:17; finds `.claude/gauntlet/s11/r1/AD1.md`, shots in `AD1/j1-j3`): three full-park jobs (121 shots), no console errors, 16 finds. The top five:
  1. Harry the K's upstairs is sealed from inside: its windows show a wall;
  2. the police on the 3B dugout roof stand inside FA3's new rail;
  3. the Ashburn Alley elevator is blocked by its own stair;
  4. the suites' glass swaps rooms and people at 24-30 m;
  5. a pitch-black, unlit concession block in the standard 3B concourse view.
  - **Tried and held:** the club's views out, the suites from inside, no rain under the roofs, the crowd's detail levels (no seam), the 400s' stairs, the main elevators, the scoreboard's back, the seats' navy, no z-fighting, no post-2008 towers, Monty's ground, the RF rail, the Arcade bridge and the escalator.
- **FX3, left field, the police and the concourse** (launched 08:18): AD1-1, -2, -5, -6, -9, -15.
- **CR1, the people up close** (returned 08:31; findings `.claude/gauntlet/s11/r1/CR1.md`, shots in `CR1/j1-j3`, `crops`): three full-park jobs, no console errors, 25 findings. The glaring ones:
  1. the people at the field's edge (the dugout rail's Phillies, the ball girls, the police line) are still step-8 dolls beside the MakeHuman players;
  2. every fan's hand is a mitten, and every raised arm the same pole;
  3. open mouths are pale bags with a white crescent and fangs;
  4. every fan wears the same face paint (bar brows, round wire glasses on 24%, ruler hairline);
  5. the players' foreheads show through the front of their caps.
  The rest: shoulders that balloon, tube torsos, sawtoothed hair and masked hoods in the rain, women who read as men in wigs, one grin for everyone, one gaunt white player's face, sticker beards, Manuel's jacket, the Latin players' skin, the Cast's floating pom-poms, stiff towels, one seated pose, the Phanatic's crayon mohawk. Held up: the faces at 3-10 m, FOX's backdrop at broadcast size, the caps and helmets on TV, the Phanatic's shape. Bundled by system: the crowd (now), the players (after FX1), the field's edge (after FX3), the Cast and throng, the Phanatic.
- **FX4, the seated crowd** (launched 08:32): CR1-2/SC1-2, -3, -4, -11, -10, -8, -9, -19, -18, -7, -17.
- **FX1, the players' mouths and the pinstriped box** (returned 08:37; notes in its branch's `docs/notes/gauntlet/FX1.md`; sheets in `.claude/gauntlet/s11/FX1/`):
  - **The mouths.** The shader read the packed expression as `u32( i0.y + 0.5 )`. From 2^23 up (a blink over half shut) an f32 can't hold the + 0.5, so Lidge's open weight rounded into the smile and read 0 for his whole shout. Fixed. Also: the whole mouth cavity is flagged dark (305 → 604 vertices), teeth are added on the near figure, Lidge's eyes are screwed up, and the middle figure takes the expressions.
  - **The "box"** was a fan's six-sided striped pompom in the row in front of the camera, floating over the MakeHuman crown. It's now a 12 × 7 yarn pompom sat in the crown. The pile already read right.
  - At a look: Lidge's shout now reads as Getty 83485858 does.
- **SK1, the first skeptic** (launched 08:40): trying to refute FX1 before it merges. A/B on both trees, the players and crowd FX1 didn't shoot, the counts.
- **FX4, the seated crowd** (returned 09:03; notes in its branch's `docs/notes/gauntlet/FX4.md`; shots in `.claude/gauntlet/s11/r1/FX4/`; `Crowd.js` only):
  - **Done:**
    - real hands (fists, a finger up, open hands, grips, gloves), and four ways to raise an arm per fan per moment;
    - the open mouth dark, with no fangs;
    - each fan's own brows, five 2008 glasses styles on 11%, soft hairlines;
    - expressions by the moment (each act of the celebration, grim in the rain, tense at two strikes);
    - seated postures.
  - **Partly done:** women's and old faces (paint only), hoods, cloth towels close up, chest prints.
  - **Not done:** the 1,200-triangle head at arm's length.
  - **Counts:** +1.8% triangles in the 400s seat, +1.0% in TV center, the same draws.
- **SK2, the second skeptic** (launched 09:03): trying to refute FX4. A/B on both trees, mid-game crowds, the rain, the detail levels' swaps, the counts.
- **SK1's verdict on FX1: merge with follow-ups** (`.claude/gauntlet/s11/SK1.md`, 46 shots on both trees, no console errors):
  - **Claims:** five of six upheld (the rounding bug confirmed on `ballpark`; the dark cavity strongly; teeth never through the lips; the middle figure's jaw no longer pops; every pompom on its crown). Lidge's eyes are partly upheld: no squint.
  - **Counts:** draws and pipelines are identical; triangles +0.1% in TV center, +1.7-2.7% in the close crowd views (the pompoms).
  - **Regressions, none blocking:** two dark-red marks on the upper lip over open mouths (FF3's flag, on both trees); Lidge's face changes in one frame; teeth vanish at the near-to-middle swap; a 12-sided pompom under 1 m; no pompom on the near crowd level.
  - **Follow-ups:** F1-F3 (Lidge's jaw and lip, the lip marks, easing in and out) go to FX5; F4-F5 (the pompom's fluff, a near-level pompom) are queued.
- **FX1 merged** (09:06). `npm test` passes and the clock is kept (801248349 / 3785.503).
- **FX5, the players** (launched 09:06):
  - from CR1: CR1-5 (foreheads through caps), -12, -14, -21, -6, -22, -23, -24, -13, -15;
  - from AD1: AD1-10;
  - SK1's F1-F3 and the squint.
- **FX3, left field, the police and the concourse** (returned 09:09; notes in its branch's `docs/notes/gauntlet/FX3.md`; shots in `.claude/gauntlet/s11/r1/FX3/`):
  - **Harry the K's:** see-through from inside, upstairs and down; 3D back bars with ~700 bottles; a painted ceiling deck.
  - **The 141 elevator:** stainless doors and the park's ELEVATOR sign with where it goes; the Porch sign on posts; the walkway's concrete.
  - **The ramp's lights** are the photo's bell domes.
  - **The police:** never inside the rail; they now stand 0.85-1.6 m clear of it, read from the seating.
  - **The black block** was McFadden's back: every stand's back now has a service door, a plaque and a painted wall light.
  - **For the coordinator:**
    - the standard view `walk-concourse3b` stands outside FI1's one-sided hall wall, looking through it (`ConcourseSteel.js`);
    - FA3's rail on the 3B dugout roof isn't in the 2008 photo (`Stands.js`).
- **SK3, the third skeptic** (launched 09:09): trying to refute FX3. Harry's from outside, every stand back, the police at other moments, the counts, and FX3's unexplained +137k triangles in TV center.
- **The usage limit (17:29):** the account's weekly limit stopped all four running agents at once: SK2 (FX4's skeptic, after its first pair), SK3 (FX3's skeptic, before any shots), FX2 (the seats, with uncommitted, untested edits to `Stands.js`, `ConcourseSteel.js` and `terrace/Build.js` in its worktree `.claude/worktrees/agent-a6114dff98eb5f98f`) and FX5 (the players, before any code change; its before shots are in `.claude/gauntlet/s11/FX5/b0`).
- **The owner: "finish up this round and deploy! don't need to rush, but don't do another loop."** The loop stopped; the coordinator finished the round:
  - **FX4 merged (17:32),** checked against SK2's pairs (`.claude/gauntlet/s11/SK2/pairs`, `crops`). Close up it's closer to the photos: hands and fists, 2008 chest prints, varied faces, fewer glasses. At broadcast size it's unchanged.
  - **FX3 merged,** checked against its shots: Harry's upstairs looks out onto the patio and the bowl, ~700 bottles, the stand backs' service doors, the ELEVATOR / SCOREBOARD PORCH 241-245 sign. `npm test` passes and the clock is kept (801248349 / 3785.503).
  - **Frame rate:** every view is 35 fps or better (the 400s seat 28.9 ms, left field 28.0 ms); [PERF.md](PERF.md) has the costs and the speed track for next time.
  - **Stage 11's screenshot:** Lidge's shout at strike three under the Liberty Bell's fireworks (`docs/stages/step-11.jpg`), shot on the merged `ballpark`.
  - **Not in this round, for next time** (`.claude/gauntlet/s11/TICKETS.md`):
    - FX2's seats (finish from its worktree);
    - FX5's players: foreheads through caps, one gaunt face, sticker beards, Lidge's tall-oval shout and squint (SK1's F1-F3);
    - the indoors bundle;
    - the outside and outfield bundle;
    - the field's-edge dolls (CR1-1);
    - the Cast and the throng;
    - the Phanatic up close;
    - the one-sided hall wall behind the standard 3B concourse view;
    - the speed track.
