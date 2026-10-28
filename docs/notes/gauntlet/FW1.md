# FW1, round 2: the people (the walk)

Fixer FW1, 2026-10-28, branch `worktree-agent-ab7b2dc22a232b9ca` off `ballpark` at 6422aec. Tickets: critic C2W's people findings (`.claude/gauntlet/r2/C2W.md`): C2W-1, -3, -2, -6, -11, -10, -12, -16, -19, -20, and round 1's leftovers CP-8, CP-10, CP-12 (`.claude/gauntlet/r1/CP.md`).

**Shots.** All in this worktree's `.claude/gauntlet/r2/FW1/` (gitignored): `before/` (1280 × 800, at 6422aec, before any change), the working rounds `a1/` to `a5/` (800 × 500), `final/` (1280 × 800, the full park, the same recipes as `before/`, by name, no console errors) and `v1/` (checks at a calm moment: the seated fans' hands between innings on the 27th, where `v-c20-400s-27-switch.jpg` has the arms folded; at seek 2900, `c2w6-*`, most of the rows are clapping or have their towels up). The recipes are `job-*.json`, made by `mkjob.mjs` (`node mkjob.mjs <stage> [size] [prefixes]`); the Cast close-ups frame the nearest standing place figure to a spot (`__nearCast`, which skips the throng's stand-ins). The light is the replay's clock throughout.

## Per ticket

### C2W-1: nobody came within 5.5 m (done)
FP1's throng folded away everyone within 5.5 m of the camera, so you walked in a bubble of bare floor and people blinked out as you reached them.
- **The handover.** Within 7 m of the camera each of the throng is drawn as the Cast's figure (the places' close-up one: a face, hands, shoes), and handed back past 7.8 m. Both are dressed from one record per person (`throngDress()`: Concourse3BKit's `dress()`, the places' own fan, plus his size and his rain gear), so the colours match across the switch. The CPU keeps track of the few near the camera: a sweep of 200 people a frame (the whole 2,000 on a jump or a teleport) finds the candidates within 11.5 m, each is placed exactly by `_thrPlace()` (the pass's `thrPlace()`, the same numbers: his lane, his pace, the obstacles), the nearest get the troupe's 72 Cast figures, and the pass is told not to draw them (`thrHide`, a bit each). In the delay at 129, 24-25 of them are Cast figures.
- **Stepping round.** Nobody walks through you, a column or the places' own people: each person is pushed out of the way of up to 56 obstacles a frame (`thrPush()`, the camera at 1 m last, then the nearest of the concourse's columns, the light tower's legs in left and the places' standing people), smoothly, so they part round you as you walk.
- **Only the shown are drawn.** The pass appends those it shows to a list and counts them into an indirect draw (FP1's drew all of them every frame, the hidden folded to a point). The renderer's stats don't count an indirect draw's triangles: `__app.people.throngShown()` gives them.
- **Out of FOX's views.** The center field camera's platform is by the Alley's new walk: the throng (and its stand-ins) is never drawn from FOX's cameras.
- **Evidence:** `hcwoodward 2983666367` (Oct 27 2008, the 3B atrium shoulder to shoulder to the lens). Before: `before/c2w1-d01-throng-ring-delay.jpg` (the ring), `c2w1-d02-throng-eye-delay.jpg`; after: `final/` the same names.
- **Left:** the handover is a change of figure at 7 m (People's simpler one to the Cast's); in a dense spot it can be seen if you look for it. The stand-ins' poses are chosen at the handover (a beer, arms folded, hands in pockets, on the rail); they don't change while held.

### C2W-3: backs through the seat backs (done)
The seated figure's back presses flat against the seat back's front face up to its top (Stands.js `SEAT_BACK`, shared with `seatGeometry`), free above it (the shoulders over the top), at every level of detail and in the motion vectors. Before: `before/c2w3-c12-seat-backs-rf.jpg` (a pentagon of jacket in every navy seat back); after: `final/c2w3-c12-seat-backs-rf.jpg`. Reference: Getty 83458502 (Oct 27 2008, the backs from the concourse).

### C2W-2: the Cast face to face (done, the near figure only)
- Hands swept from the wrist through the palm to curled fingers with rounded tips, and a thumb (a box and a box); a hand "in the pocket" is in it, the sleeve closing into the jacket at the hip (the hand hung out).
- Shoes swept on a last: the heel's round, the instep up to the ankle, the ball wide, the toe lifted (a brick).
- The limbs on 12 sides: the upper arm full at the shoulder, the forearm thick below the elbow, a jacket's cuff flaring, the calf, the trousers' hem over the shoe (8-sided prisms whose facets showed).
- The trunk on 16 sides through twelve rings (a hem that turns under, the waist, the chest, the armpits, the shoulders' slope) with the surface's own normals (it was lit as a drum: the shoulders didn't face up); a hoodie's pouch stands off the belly; a quarter of the jackets open down the front over the hoodie or sweater under them; a ribbed hem.
- Per near figure: 3,113 vertices and 3,072 triangles before, 3,823 and 4,544 after (the far and distant figures as they were but for the poncho's rings).
- Before: `before/c2w2-c08-cast-sro-front.jpg`, `c2w2-c07-cast-sro-side.jpg`, `c2w2-c10-cast-129-back.jpg`; after: `final/` the same. (The recipe frames whoever's nearest at that moment, so the figures differ between runs.)
- **Left:** the faces are still painted on a 14 × 9 head; the hands don't close round what they hold.

### C2W-6: the seated crowd up close (done)
- The close level's mittens are blunt, wider at the knuckles, with a low rounded end (the pointed dome read as a claw); its limbs and hands 8-sided.
- The lap towel is out for about half of them on the 29th and few on the 27th (put away otherwise, up whenever they twirl it), folded narrower and rucked up, its far end over the knee and down, turned its own way, or bunched in the fist (it was a flat placard on every lap).
- Sitting at rest the hands do their own thing (CP-10's leftover, with no seventh morph: the forearm turned about the elbow in the vertex shader): on the lap, arms folded (the right under, the left over), in the jacket's pockets, clasped between the knees; more folded and pocketed in the rain; a cup in hand keeps them on the lap.
- Women's long hair is cut her own way (bangs at their own height, swept to one side, pulled back behind the ears), to her own length, in more colours; each face has its own jaw width and length.
- Before: `before/c2w6-c20-400s-1b.jpg`, `c2w6-c16-aisle-3b-along-row.jpg`; after: `final/` the same. Reference: hcwoodward 2986561533 (Oct 29 2008, towels held and crumpled), Getty 83893023 (Oct 27, hands in sleeves and pockets).

### C2W-11: the throng dry and alike (done)
The throng (2,000) is dressed from its record in the Cast's palette (the home whites with the script and a red name panel behind, name-and-number tees, hoodies with the pouch, zipped jackets, puffers' quilting, knit hats with the cuff and pom-pom, caps of every colour and the odd one backwards, shoes), with his size and build (slim, broad, a belly, a woman's shoulders) and hair. On the 27th, as the rain comes on (each at his own level of it), 40% put on a poncho (clear mostly, red, white, yellow, orange; most with the hood up), others a hood, and a few carry a furled umbrella (open on the plazas, for the Cast stand-ins). The figure gained sleeves, shoes, a poncho and the umbrella as parts (folded away when not worn): 282 vertices, 394 triangles (was 198, 266). Before: `before/c2w11-d12-1b-108-delay.jpg`, `c2w11-c11-throng-close-delay.jpg`; after: `final/` the same. Reference: Getty 83891095 (Oct 27 2008, the fans in ponchos at the tarp).

### C2W-10: the throng in a narrow band (mostly done)
Each line's band across the walkway is per segment: the loop's walkers use 8.4 m of it (from just behind the drink rail's shelf to the counters' lines), drifting across it as they go; a quarter of the loop's people stand at the drink rail two deep facing the field (most of them within 75 m of the point behind home: auds 2987724987 and 2983519438, the SRO packed both nights), leaning on it with a beer on the shelf as Cast figures; others stand about, by the rail or out toward the stands. They step round the columns and the places' people (C2W-1). Before: `before/c2w10-c06-sro-rail-29.jpg` (one or two at the SRO rail), `c2w10-w22-concourse-rain-27.jpg`; after: `final/` the same. **Left:** nobody crosses at an angle to a stand or a restroom; carts and kiosks aren't obstacles (only columns and people).

### C2W-12: past the foul poles (done)
Lines down the Alley's promenade (midway between the storefronts' counters and the rail over the pens, as wide as the walk is at each point), behind the left field seats (in two pieces either side of Harry the K's), behind the right field seats, and round the left field corner's broad floor from the loop's end; 28% of the throng, on the loop's clock, busier before the game and before the 29th's resumption (and the gates busy then too). Before: `before/c2w12-w15-alley-east-29.jpg`, `c2w12-w17-lf-corner-29.jpg`; after: `final/` the same. Reference: flickr gf 2057 (Oct 29 2008, the Alley full).

### C2W-16: the Cast's ponchos (done)
To mid-thigh, over the shoulders and arms (wide enough that the shoulders and arms don't poke through), its sides rigged with the upper arms too and blended, so it rises and swings with them; its corners hang lower than its sides; folds fall from the shoulders. Before: `before/c2w16-d05-poncho-side.jpg`, `c2w16-d06-poncho-front.jpg`; after: `final/` the same.

### C2W-19: caps and nylon like vinyl (done)
The Cast's rain wets each thing as what it is: cloth (a cap, a knit hat, a hoodie) darker and matte, nylon darker and satin, plastic and vinyl beading and shining, skin a sheen (everything went to roughness 0.25). The seated crowd and the throng already go through the engine's WET_FABRIC, which keeps cloth matte. Before/after: `c2w19-c09-cast-129-front.jpg`.

### C2W-20: things at arm's length (partly)
The Cast's flip phone is a dark body with a small lit screen (a card of glowing stripes), the scorebook has a printed cover, the cotton candy's floss is wispy and lit through. **Not mine, not done:** the cotton candy vendor's pole of bags (`places/Concourse3BProps.js`).

### Round 1's leftovers
- **CP-8 (done):** a sudden lift (a hit, a strikeout, the last out) now starts the kernel's ripple, set flat until now: from the play outward at 45 m/s each fan takes it up as it reaches him, a beat late of his own (about thirty waves over the replay, run in Node over the Director's timeline).
- **CP-10 (done):** the seated crowd's arms folded and hands in pockets (C2W-6); the throng's stand-ins have them too.
- **CP-12 (partly):** the home whites and red name-and-number tees in the seats carry a name over a number on the back (the Cast's atlas; close and near); signs and lanyards in the seats not done.
- **CP-19 (not done):** RailFigures.

## Counts

`__app.engine.meshRenderer.stats` and `__cast.stats`, 1280 × 800, the full park, `before/` (6422aec) and `final/`:

| View | Before | After |
|---|---|---|
| Walking, the 3B concourse (PERF.md's, play 60) | 755 draws, 4.96M triangles (the old throng's 0.43M in it: all 1,600 drawn); Cast near 2, far 81 | 755 draws, 4.55M + the throng's 0.18M (466 drawn) = 4.73M; Cast near 2, far 81 |
| The 3B concourse at 129 in the delay (`c2w1-d02`) | 492 draws, 4.73M (the old throng's 0.43M in it); Cast near 14 | 492 draws, 4.38M + the throng's 0.40M (1,005 drawn) = 4.78M; Cast near 19 (25 of them the throng's stand-ins) |
| A field-level seat, 3B (the bowl critic's `__seat`) | 752 draws, 6.21M | 752 draws, 6.28M |
| TV center (play 20) | 477 draws, 7.69M; Cast near 123 | 477 draws, 7.89M; Cast near 123 |

Per figure: the Cast's near figure 3,113 vertices and 3,072 triangles before, 3,823 and 4,544 after (far 1,337 / 1,263, distant 384 / 386, about as before); the seated crowd's close level 492 / 669 before, 532 / 717 after (the others unchanged); People's figure 198 / 266 before, 282 / 394 after. The draw counts are unchanged in every view. (The 800 × 500 working rounds count differently: the counts move with the resolution.)

Since the throng is an indirect draw now, the renderer's triangle count no longer includes it: `throngShown()` gives its drawn people and triangles (above). Build: People 3 ms before, 51 ms after (the 2,000 dresses and the lines, once at load).

## What the merger must know
- **Exports added:** `castPalette()` and `figureGeometry()` from Cast.js, `figureGeometry()` from People.js, `fanGeometry()` from Crowd.js (the last three for counting in Node), `SEAT_BACK` from Stands.js. New imports: People.js takes Cast.js, Concourse3BKit.js, `places/alley/Promenade.js` (`pitEdgeZ`) and `fencePoint`; Crowd.js takes Cast.js (`castPool`, for the atlas) and geo.js.
- **The throng's lines read others' data:** the concourse's columns (`concourse.steel.columns`), the gates (`exterior.lanes`), the Alley's storefronts (`landmarks.alleyFront`) and the pit, the left and right field tiers, FOX's cameras (`bowl.tvCams`). If FW2 moves the concourse's stands or columns, the loop's band ([-2.6, 5.8] m about the walking line, the rail at -3.68) is in `_throngLines()`.
- **The Cast troupe `people.proxies`** (72 figures, `troupe.throng = true`) is the throng's stand-ins: tools that pick "the nearest Cast figure" should skip it. `people.thrForce = true` draws the whole throng from anywhere (a QA look from above).
- **The stats:** the throng's triangles are out of `meshRenderer.stats` (an indirect draw); compare views with `throngShown()`.

## Frame rate
Not profiled (the coordinator does). What it costs and where:
- **The TV views** pay for the Cast's heavier near figure: FOX's long lens sees 123 Cast figures as "near" in TV center (the rail, the dugouts, the field at the last out), so +0.2M triangles and ~87,000 more vertices rigged twice. TV high in the rain was 27 ms after SP1; it's the one I'd watch.
- **The walking views** draw fewer throng triangles than before (only those shown, by an indirect draw) but up to 72 more Cast near figures (about 25 in the delay at 129: ~190,000 more vertex invocations, rigged twice), and the throng's pass now steps each of 2,000 people round up to 56 obstacles (twice: this frame and last).
- **The CPU:** the throng's stand-ins cost a sweep of 200 people a frame, the ~40 candidates placed exactly and the ~25 held posed (each against the obstacles), and a look through the places' people every third frame for the obstacles: I'd estimate 0.1-0.2 ms. The Cast pool flushes the stand-ins with the rest.
- **The seated crowd's close level** carries 40 more vertices a fan (8-sided limbs and hands): a field-level seat is +0.07M triangles.

## Noticed elsewhere
- In `final/c2w10-w22-concourse-rain-27.jpg` a red cap hangs in the air under the overhang's edge above the rail, about 13 m out from the eye (roughly (-33, 10, 27)); it isn't in `before/`. I couldn't place whose it is (a figure whose body is hidden by the steel, or something of mine): worth a look.
- The cotton candy vendor's bags (`Concourse3BProps.js`, C2W-20) are still solid octagonal blocks.
- On the plaza in the rain, bright vertical streaks stand on the paving under the lamps (`final/c2w16-d06-poncho-front.jpg`): the lamps' reflections drawn as tall shafts.
