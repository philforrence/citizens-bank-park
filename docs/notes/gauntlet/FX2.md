# FX2: the continuity glitches and the last loose ends (gauntlet, step 9)

Fixer FX2, 2026-10-28, branch `worktree-agent-ab5bc20dced8a657c` (off `ballpark` at 2f05b0d, FB4's merge). The teleports and vanishings fixers noted (FB4's "noticed elsewhere"), a sweep for more with a check the next people can run, and the left field corner's loose ends (FX1's and FC4's).

**Shots** (main checkout, `.claude/gauntlet/r4/FX2/<job>/`), all on the full park (no `only=`) at 1280 × 800, no console errors in any: `b0/` (before: the gate, the square, TV center), `final/` (every after, TV center, the TV high cameras at the joins), `final2/` (the Phanatic's picture raised again). The recipes: `/private/tmp/claude-501/-Users-phillipforrence-Documents-HomeKit/4f4e82b4-ef9f-4fa0-a3f9-d023a05012fe/scratchpad/fx2/jobs/*.json`; the Node scratch (`trace.mjs` one actor through a window, `play.mjs` a play's runners, `moyer.mjs` a man's celebration steps) beside them.

**The replay's clock** is untouched: `director.duration` 3785.503 and the segment starts' hash 801248349 (the check below prints both). Nothing in `compile()` changed; nothing moved the radio's `director.t`.

## The check: `test/continuity.mjs`

`node test/continuity.mjs [t0 t1] [--all] [--json out.json]`. It walks the whole replay at 30 Hz headless (113,566 frames in ~4 s): the Director's actors (players, coaches, managers, umpires, the celebration's people, the suspension's crews, the drying crew), the bat boys (OnDeck hooked in as FB4's walkups.mjs did) and the press round the stage (Press.js, built with FB4's stub). It flags:
- a **jump**: anyone stepping over 0.6 m in one frame (18 m/s, faster than anyone runs), marked as at a segment's first frame (FOX often cut there; the center, high and follow cameras never do) or inside one;
- a **vanishing**: anyone dropped from the frame standing on the field (not at a dugout, its rail, a camera well, the crew's gates in the foul walls, behind home or past the warning track);
- an **appearance**: anyone new in the frame on the field, out of nowhere;
- **deliberate** ones listed apart: the suspension's split between the 27th and the 29th, and the rain delay's start.

It exits 1 on any non-deliberate vanishing or appearance, a jump over 0.7 m, or a moved clock. Not in `npm test` (it's ~4 s; `npm test` passes).

| | Before (2f05b0d) | After |
|---|---|---|
| Jumps over 0.6 m in a frame | 630 (493 at a join, 129 inside a segment, 8 deliberate) | 7 (0 at a join, 1 inside at 0.60 m, 6 deliberate) |
| Vanishings on the field | 157 (37 inside a segment) | 6 (all deliberate: the split) |
| Appearances on the field | not counted then (37 on the first run with them) | 12 (all deliberate: the split) |

The one left: Werth at 3452.3 s, a 0.60 m step in a fielder's run (a step plan's speed at the limit).

## 1. The four named: done

- **The Rays' runner Perez, 3.3 m at the result segment's start** (2.4 s after strike three): every pitch left the runners at their full lead (`_runners`' lead never came back) and the next segment posed them on the bag: 3.29 m at 123 pitch joins, and Perez at the last out. Now the general carry below walks them back to the bag.
- **The Rays' base coaches vanished at the celebrate segment's start:** they jog off to their dugout now (the carry's "ghosts").
- **Moyer, 19 m at 142.1 s:** `Celebration.presentation()` sent him to a place in the crowd before the stage first (arriving at 142 s), but his walk to the mound began at 128 on the plan and the steps run in order, so at 142 he was by the stage and on the rubber the next frame. He goes for the rubber from where he is now (`game/Celebration.js`, FX2 block): out at 128, on the mound by 134, digging.
- **The lap's men, 1.3 m at 209-216 s and 258-265 s, 0.6 m at 231-237 s:** each walks at his own place beside the flag's line (`off[ 0 ]` sideways), and the side vector turned at the path's corners in one frame; and they walked out to the line's start, not to their place beside it. Now the side is taken across 3 m of the path (`lapSide`), and the walk out goes to their place.

## 2. The sweep: the worst fixed

- **The joins, in general** (`game/Director.js`, `pose()` split into `_scene()` and `_carry()`, FX2 block): each segment's scene is posed from its own plan, so at a join anyone could be elsewhere the next frame: the fielders back at their places the instant a ball in play became its result (137 jumps, up to 70 m), the 2B umpire across the infield when a runner reached (21 m), the leadoff hitter from center field to the on-deck circle as the half inning turned (100 m), the home team still running out when the first walk-up began (50 m). Now:
  - whoever is in both frames carries the difference and makes it up on foot, in the direction he has to go: a walk under 2 m, a trot under 6, a jog beyond, posed walking or running (a pitcher steps down off the rubber's height);
  - whoever's in the last frame but not the next jogs off to his dugout (a runner left on base, the base coaches at the third out, the Rays' coaches at the last out, a man replaced);
  - whoever's new comes on from his dugout (a pinch runner, a defensive replacement, the coaches as the game starts and resumes on the 29th).
  - Pure in t: the carries are worked out once per segment (`seg._fx2`), from the end of the one before with its own carries, forward from the last one done, so a seek or a replay poses the same (a cold seek to the ninth is a few hundred snapshots once, ~30 ms). The celebration's own people (Celebration.js, on the strike's clock) aren't carried; only the ones it drops go off on foot.
  - A runner left on base takes the field after he's jogged in (`_runOut`'s and `Breaks.showWarmups`' `wait`), not from the dugout while he's still on second.
- **A runner given two moves on one play** (second to third, third home: Utley on Victorino's single at 352 s) ran both at once from the pitch: at third the frame the ball was hit, then back at third from the dugout once he'd scored (46 m). `chainRunners` joins them at the first one's pace, at show time only (the plan's times and the clock are as they were).
- **The batter set off from the plate,** a metre from where he stood in the box (52 plays): the box's offset let go over his first 0.7 s.
- **The fielders' last metre** (a run ends a stride or two off where he fields, throws or takes the throw: ~40 steps of 0.6-1 m): closed over 0.3 s.
- **The batter who pulls up on a quick fly out** ran 16 m at 19 m/s (Zobrist at 3452): at a man's pace now.
- **The shortstop covering for the throw-down** (`game/Breaks.js`, FX2 block): he was at his place one frame and on the bag the next (10.6 m, every half inning): he trots over.
- **The 27th's tarp crew** (`game/Suspension.js`, one FX2 line): between the lay and setting off for the edge (`runTo` before its start) 16 of them were gone for a few frames in the middle of the outfield: they stay at the roll.

**On TV:** `final/C-tv-high-361.0`, `362.2` (high home, the result after Victorino's single: the fielders jogging back in from where they made the play; they were at their places in a frame), `C-tv-high-3486.2` (the celebration's start), `C-tv-3627.7` (Moyer on the mound, digging).

## 3. The left field corner

### The Phanatic's picture over the Left Field Gate: done
- **The photos** (`.claude/ref/leftfield/flickr-2008-10-27-game5-arrival-...`, `flickr-2008-10-29-night-left-field-gate-canopy-sign-lit-postgame.jpg`): the picture stands clear above the canopy, about three fifths of the board's width, in front of the board's lower left corner, the green Citizens Bank Park letters on the canopy across its foot.
- **Why it hid:** it hangs on the house's back, which is ~35 m inside the gate's canopy, so from the plaza outside the canopy's top hid all but its top metre (FX1 brought the canopy down 0.7 m; still). Raising it 0.6 m over the canopy's height did nothing from the plaza (`final/G-lfgate-out-night`).
- **Now** (`places/leftfield/Plaza.js`, FX2 block): 13 × 9.75 m (was 12.4 × 9.3), its foot 10 m over the street (3.8 m higher), 1.5 m further left of the board's centre so it's clear of the cap, stood 0.6 m further out in front of the board's back.
- **Before / after:** `b0/G-lfgate-out-night` and `out-day` (only a sliver of sky over the canopy) against `final2/G-lfgate-out-night`, `out-day` (the Phanatic's head and the sky above the canopy, the green letters across its foot, as the night photo).
- **Left:** our gate is much further from the scoreboard than the real one, so the lower half of the picture is still behind the canopy from 24 m out (the real one shows nearly whole); from the inside square it's seen from behind (its royal blue box). Moving it onto the gate itself would match better and is `Exterior._buildGate`'s (the atlas print is leftfield's).

### The Left Field Gate's sign: done
- `Exterior.js` `_buildGate` (FX2 block, the LF gate only): LEFT FIELD GATE in red block capitals on the dark fascia, lit by night (an emissive keyed on the letters' red, a tube's glow round each), faintly by day. The other gates keep the white serif capitals.
- **Before / after:** `b0/G-lfgate-out-night` (white serif) against `final/G-lfgate-out-night` and `final2/` (red, under the green letters, as the Oct 29 photo).

### The square inside the gate: done (furniture and people); the ramp's underside not
- `places/leftfield/Plaza.js` (FX2 block), `places/leftfield/People.js` (`plaza( carts, tables )`, FX2 block), `places/LeftField.js` (one line, passing the tables): four round tables under red and white umbrellas between FC4's lanterns and Harry's tower, two or three standing at each with a drink; a beer cart by the gate (its vendor and line from the plaza's cart code) with its queue held between two rows of black posts and navy belts, as the 2009 photo inside the gate (mostlyphilliespics 3972152381) has the terrace and the escalator's queue.
- **Before / after:** `b0/S-square-k07-above` (one umbrella cart in 40 m of bare concrete) against `final/S-square-k07-above` (the tables, the people, the queue), `final/S-square-k06-night`, `S-square-eye-day`.
- **Left:** the ramp's underside is still dark at night (C4R's "light the ramp's underside"); no white lattice panels; the tables' people stand (no chairs).

### The RF corner's matching square: not done
- I didn't find where it's built in time (`b0/R-rfsquare-r61-night` is the critic's view; my `R-rfsquare-above` framing landed in the RF stands). It wants the same: lanterns, tables, a cart.

## The counts

`JSON.stringify( __app.engine.meshRenderer.stats )`, full park, 1280 × 800, after 24 still frames of the view.

| View | Before (`b0/`) | After (`final/`) |
|---|---|---|
| TV center (play 20) | 495 draws, 3,575,548 triangles, 768 pipelines | 495 draws, 3,576,686, 768 pipelines |
| The LF gate's square from above (k07) | not read in `b0` | 390 draws, 2,245,236 |

(`final2/Z-center`'s 1,015 draws are a cold read straight after the inside view, with no warm-up frames: not comparable.)

## For the merger

- **Files:** `game/Director.js` (`pose()` now `_scene()` + `_carry()` + the extras + `_sync()`; `_snapshot`, `_carryOf`, `_carryInto`, `_carry`; `show_switch`'s `wait`; `_runOut( ..., wait )`; `chainRunners` at show time in `show_inplay`; the batter's box offset and the pulled-up pace in `_runnerAt`; the fielders' step gap in `show_inplay`), `game/Celebration.js` (Moyer's steps in `presentation()`, `lapSide`, the lap's walk out), `game/Breaks.js` (`arrival`'s and `showWarmups`' `wait`; the shortstop's trot), `game/Suspension.js` (one line), `places/leftfield/Plaza.js`, `places/leftfield/People.js`, `places/LeftField.js` (one line), `Exterior.js` (the LF gate's sign only), `test/continuity.mjs` (new).
- **Outside my list, each marked FX2:** `game/Breaks.js` and `game/Suspension.js` (the game's; nobody else's now), `places/LeftField.js` (one argument).
- **`Director.noCarry = true`** turns the carries off (for anyone who needs a segment's raw scene). Segments carry a cache, `seg._fx2`.
- **What reads `director.actors`** (the cameras' close-ups, `_lensBlocked`, the press) now sees the carried positions: right, since that's where the men are drawn.
- **Run `node test/continuity.mjs`** after any change to the Director, Celebration, Suspension or Breaks; it also prints the clock's hash.
- No images, sounds or invented people added: CREDITS.md and CAST.md unchanged.

## The frame-rate risk

- **CPU:** the carry is a map lookup and a few multiplies per carried man per frame (a dozen at most, for a few seconds after a join); once per segment, two scene snapshots (~0.1 ms) when the replay first reaches it, ~30 ms once on a cold seek far ahead. The check measures the whole replay's pose at 3.3 s per 113,566 frames, as before.
- **GPU:** the square's tables, umbrellas and posts are in leftfield's one batched mesh (a few hundred triangles); its 10-12 people are leftfield's Cast on its cadence; the sign is the same quad with another texture; the picture the same box and panel. TV center: the same draws, +1k triangles.
- I'd watch nothing in particular.

## Noticed elsewhere

- **Werth's 0.60 m step** at 3452.3 s (a fielder's run plan at 18 m/s for a frame).
- **The runners' lead** never comes back within a pitch; the carry walks them back at the next pitch's start (a trot while the pitcher gets the sign). A return just after the catch would be truer (in `show_pitch`, with a walk pose).
- **The RF corner's square** and **the ramp's dark underside** (above).
