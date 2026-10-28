# FS1, round 4: the game from a seat

Fixer FS1, 2026-10-28, branch `worktree-agent-a351fd811568d85b1` off `ballpark` at a7d855f (C4S-1 already fixed there). Tickets: critic C4S's findings (`.claude/gauntlet/r4/C4S.md`), in the order given: C4S-2, -3, -10, -11, -4, -5, -8, -9, -7, -6.

**Shots.** In this worktree's ignored `.claude/gauntlet/r4/FS1/` (absolute: `/Users/phillipforrence/citizens-bank-park/.claude/worktrees/agent-a351fd811568d85b1/.claude/gauntlet/r4/FS1/`), all 1280 × 800 on the full park (no `only=`), the light on the replay's clock, no console errors in any job:
- `before/` (a7d855f, before any change);
- `a1/` (after C4S-2 and C4S-3, with the first cut of C4S-5 and of C4S-8's ponchos);
- `a2/` (after everything but the stayers' rank, the aisles above the field level, the delay's file and the 27th's gaps);
- `final/` (the last job, on 3df0220: every ticket's after, TV center and the counts; the page loaded in 11.7 s).

The recipes are `job-<stage>.json`, made by `/private/tmp/claude-501/-Users-phillipforrence-Documents-HomeKit/4f4e82b4-ef9f-4fa0-a3f9-d023a05012fe/scratchpad/fs1/mkjob.mjs` (`node mkjob.mjs <stage> 1280 800 <keys>`). Each view is the critic's own seat, through his `helpers.mjs` (`__shot`: the eye in a real seat, that seat emptied, the light on the replay's clock), under his shot's name (`k01`, `j01`, ...). Node checks in the same folder: `plan29.mjs` (C4S's, pointed at this worktree), `seg.mjs` (the segments round the last pitches).

**The replay's clock** is untouched: nothing in `game/` changed; `director.duration` 3785.503 (`seg.mjs`).

## Per ticket

### C4S-2: strike three and the celebration in one pose (done)
- **The towels:** the 9th's two-strike moods and the big hits' towel share cut to about a third at the most (`Crowd.mood()`: 0.2 + 0.1 two out + 0.15 late, was 0.3 + 0.25 + 0.4; a big hit 0.5, was 0.85). With three in four fans holding one, 0.95 had nearly all of them twirling.
- **Each his own act** (the compute pass, `cwFanPose`, a marked FS1 block; `Crowd._fsUpdate` gives it the seconds since strike three from `Director.champsAt`): from the strike, as the ripple reaches him, each fan picks an act every 2.5-7 s on his own beat, easing through his arms' rest between them: both arms up pumping, the towel (if he has one), a fist pumped, both hands on his head, a camera or phone up at his face (the prop given for the act), clapping, turned to a neighbour with a hand up, or just standing watching (some with a hand at the mouth). The mix drifts over the first two minutes from arms up and towels (30% / 30% of the towel holders) to clapping (24%), pictures (16%) and talking (14%); from 110 s a third sit back down by 230 s.
- **Hugs:** each seat and the one beside it (the crowd's order: `i ^ 1`, within 0.8 m and level) share a beat; when it says hug, both turn to each other (the head and a third of it in the shoulders), lean in (the roll), the inner arm up round the other's shoulders and the other fist up or down; 16-18% of the pairs at a time early, 12% later.
- **Evidence:** `before/` against `a1/` and `final/`: `k01-last-pitch-3b-upper` (edg126's frame: the 1B stands a white-pink sheet before, red with white flecks after, as in `night/commons_edg126_final_strikeout_from_3b_upper_oct29.jpg`), `k13-strike-towels-close` (the strike at arm's length: before, every arm up with a card; after, fists, arms up, a phone up, mouths open, heads turned, a few towels), `g02-pile-d1`, `k12-celebration-along-row` (3600), `g05-cel-d3-row-3570`, `g08-late-rfs` (3720).
- **Left:** the towel's own shape (3 × 3 points, still a card close up: `fanGeometry`, FW6's level shapes this round) and its blur; the hug's arm goes up beside the other's head rather than round his shoulders (the arm's morph has no "across"); the cap in the hand.

### C4S-3: nobody looks at the play (done)
- **The focus** (`Crowd._fsUpdate`, eased at 3/s so the heads follow a fly ball a beat behind it): the plate on a pitch or a walk-up (field 0, −7), the ball in play (`ballFocus ?? ballAt`), the pile (0, −18.4) from strike three, the flag (0, −132) in God Bless America, the infield in the suspension, and between times the infield loosely (attention 0.45, against 0.85 on a pitch and 0.95 in play).
- **The turn** (the compute pass): each seat's facing goes to the kernel in the seats buffer's w (`_seat()`); the yaw toward the focus from it, clamped to ±70°, ±8° his own way, one fan in ten hardly looking; the talk to a neighbour goes on top. In `cwVertex` a third of the turn is in the shoulders (from the waist up, the middle level and in), so the head turns 2/3 on the neck: no new per-fan data and one rotation per vertex (two trig) at the close, near and middle levels.
- **Evidence:** `before/` against `a1/`, `final/`: `j01-heads-along-3b-row-pitch` (the row below turned toward the plate, the backs of their heads to us), `k04-lf-corner-27`, `j02-heads-lf-line-from-1b-tele`.
- **Left:** the flashes' sprites keep the seat's facing (a few centimetres off at most).

### C4S-10: the 29th's sound 14 s off the picture (done)
- `places/sound/Plan.js` keys the 29th to `Suspension.G29` and `TarpPlan` (an FS1 block): without the tarp (FB4's `TARP_ON_29 = false`) the crew is heard working the skin from the split for 15 s (Suspension's ten, done by 13-17 s) and no roll; with it, the roll and the calls follow `T29`. Then the welcome (12.1 s) at the split + 1.5 and its roar, the PA's "please rise" (8.4 s) to end as she starts, the hymn and the hush over `G29.gba` exactly, the roar at its end + 0.3 (Balfour's jog in), the chant 3 s later.
- **Evidence** (`plan29.mjs`, heard against seen; the split 2231): before, the welcome 2249, its roar 2258.5 on the song's first bars, the crew's roll to 2266, "please rise" 2268 after she'd finished, the hymn 2271-2289; after, the crew 2231.5-2246.5, the welcome 2232.5, its roar 2244.8, "please rise" 2248.4-2256.8, the hymn 2257-2267 (the song 2257-2267), the roar 2267.3, the chant 2270.
- **Left:** the 27th's tarp sounds are still R's old 77-s schedule (a( 7 ) to a( 58 )), close to `T27` but not keyed to it.

### C4S-11: whistling in an emptied deck (done)
- `places/sound/Fans.js` `_near()` scales its rate by how full the seats within 10 m of you are (`_occupancy()`: the crowd's unvacated fans within 10 m and 6 m up or down, once a second or when you've moved 2 m; 1 with no seats round you). In the delay's emptied 400s it's ~0, so nobody whistles beside you.
- **Evidence:** `npm test`'s soundscape run; no shot (it's sound).

### C4S-4: the rain delay (mostly done)
- **The seats fold:** the seats' material reads the crowd's ids (`Stands.js`, marked FS1 blocks): the seats built sat on carry their first fan in `drawParams`; a vacated fan's seat folds its pan up 75° in the vertex shader (the empty seats' own fold). The 29th's filling folds them down again. `final/k14-empty-seats-close` against `before/` (the field of flat blue shelves now rows of upright pans, as in Getty 83511062), `k05-sro-tarp-empty-27`, `c04-empty-t4h`, `k15-29th-filling`.
- **Who stays:** `Crowd._covers()` marks the seats with the level above's seats over them (a 2 m grid of the highest seat, 3.5 m up within a cell: 25.6% of the 42,150); `Seats.js`'s rank (one marked line) is `0.9 h + 0.14 cover` through `p.cover` (was by height): at the delay's emptiest about one in five stays under cover and one in eighteen in the open, low and high alike.
- **The stayers:** in the delay (`fs1.z`, from 4 s into the break) nearly half are on their feet, turning to each other now and then; their heads loosely on the infield.
- **The going:** the aisle walkers file up the steps through the delay, a new one from a row as one goes out, and down them as the 29th fills (People.js, FS1 block), on every deck now (C4S-9). `final/h01d-aisle-delay-2205`, `k15b-29th-filling-field-level`.
- **Left:** the 7% steps (`Seats.js`'s STEP, FX2's file): each step rewrites every fan's flag and uploads the ids, so smaller steps would cost a hitch each; the walkers are the aisles' few, not one per seat that empties; the front rail's stayers (RailFigures) unchanged.

### C4S-5: God Bless America (done)
- `Crowd._fsUpdate` reads the song from the 29th's split and `G29.gba` (no change to `Song.js`): up at its start, the caps off a beat later, on again as she ends. In the kernel the fans it reaches (all but 6%, Rays fans too) take the cap off (keep bit 4 cleared, flag 19 "bareheaded": the surface paints no cap or knit hat, the long hair shows), most knit hats too (65% of them), bring the right hand to the chest, put the arms, towels and signs down, half sing (the mouth a little open, moving), and face the flag (C4S-3's turn, attention 1).
- **Evidence:** `final/k08-gba-toward-flag`, `k09-gba-3b-stands-across` against `before/` (the 3B stands across: bare heads where the caps were, the sign down; the near fans' heads to the flag).
- **Left:** the cap isn't in the hand (it's gone); the hand is on the right of the chest.

### C4S-8: the 27th at its wettest (mostly done)
- **Rain gear:** the poncho share `rain × 0.45` (was 0.28) and every hoodie's hood up (95%, 80% over a cap, was 50%/30%) in the kernel.
- **Umbrellas** (`Crowd._umbrellas`, one draw): about one in seventy of the open seats' fans (not under a deck, `UMBRELLA_SHARE` 0.014: 447 round the park), the same fans the kernel gives the raised right hand: an eight-gore canopy a metre across on its shaft in that hand (red, black, black and white, golf-striped, navy), tipped into the wind toward the field, placed on the GPU from his pose and build, folded away out of the rain or when his seat's empty. `a2/j04-horseshoe-side` (two black ones in the background), `final/umb-nearest-3b-27` (the section behind the 3B dugout at 2122: six or seven up over it, as in Getty 83458180's), `final/a03-first-t4h` (one at the 400s' front rail).
- **Gaps:** 7% of the open seats empty from the 5th on the 27th (a `Crowd.vacate` test, written only when it changes).
- **Left:** the canopy is the same at every distance (8 gores, 16 triangles; no far disc needed at that count); at night the red ones read nearly black under the lights.

### C4S-9: the aisles (mostly done)
- **When they walk** (People.js, FS1 block): a pitch on its way, they stop and watch, facing the play; in the top of the 9th they go up and wait at the top (a jump into the 9th finds them there), so the steps are clear for the last outs.
- **Every deck:** one walker in about every other aisle of every tier above the field level (not the suites), on the same walk.
- **Evidence:** `final/j05-aisle-walker-in-the-9th` (the walker C4S filmed strolling down through the 0-2, at the top and still), `a2/j05b-aisle-3b-field-level-9th` (the steps clear), `final/h01d-aisle-delay-2205` (the delay's file up the steps).
- **Not done:** vendors above the field level (home/Aisles.js's behind home only), ushers holding people at the tops, the steps full after the strike; GameSound's beer man still calls everywhere.

### C4S-7: the rails black at night (done)
- `Stands.js` `rails` (and the Diamond Club's rail, which shares it): roughness 0.35 → 0.55, metalness 0.8 → 0.45, 0.6 grey. The backstop's net (`Bowl.js`, FS1 block): strands ~2.5 mm (0.03 of the cell each side, was 0.06), 60% (was 80%), fading to a 5% veil within 1.5-3.5 m of the eye.
- **Evidence:** `final/k17-diamond-club-front-9th` against `before/` (black bars and a dark cage; now silver-grey rails and the field clear), `a03-first-t4h`.

### C4S-6: the horseshoe as a blindfold (done)
- `Crowd.js` surface (`hairStyle == 2u`, FS1 block): the band from the crown's edge (0.24 over the ears, 0.32 at the back) down to the nape's hairline (−0.62 behind, −0.3 behind the ear), round above and behind the ear to a sideburn (its front edge 0.24 in front of the ear's middle), the ear itself bare, the edges broken by a grain.
- **Evidence:** `final/j04d-horseshoe-side-29`, `j03d-horseshoe-behind-29` (dry, the 29th), and `j04`, `j03` at 1000 (he's under a clear poncho's hood on the 27th now).

## Counts

`JSON.stringify( __app.engine.meshRenderer.stats )`, the full park at 1280 × 800, read in the next shot's js with the same view held:

| View | Before (`before/`, a7d855f) | After (`final/`, 3df0220) |
|---|---|---|
| TV center (play 20, the 27th) | 496 draws, 3,493,580 triangles, 768 pipelines | 497 draws, 3,522,988 triangles, 769 pipelines |
| A real 400s seat behind home (`a03`'s, seek 24, the 27th) | 1,114 draws, 6,019,402 triangles, 768 pipelines | 1,113 draws, 6,031,456 triangles, 769 pipelines |

- **+1 draw, +1 pipeline:** the umbrellas (one draw, one material; in the rain only). The seats' material recompiles once with `SEAT_FOLD` (same count).
- **+12k to +29k triangles:** the umbrellas (447 × 20 triangles, folded to a point outside the rain) and the 48 new aisle walkers above the field level (People's figures).
- **The crowd's per-fan data is unchanged** (5 + 5 vec4s of pose, 6 of look); the kernel's work grows (the head turn's atan2 always; the acts and the hug's two reads of the neighbour only from strike three).
- Other figures from the jobs: 25.6% of the 42,150 seats are under a deck; 447 umbrellas; 69 aisle walkers in all (21 before), all 69 at the top and still at the 0-2 with two out in the 9th (`j05`).

## What the merger must know
- **Files:** `src/ballpark/Crowd.js` (FS1 blocks: the kernel's head turn, acts, song, delay and umbrella hand; `cwFanPose( ids, h, seat: vec4f, t, i )`; `cwVertex`'s shoulder turn; the surface's `hat` and the horseshoe; `mood()`'s towel shares; `_fsUpdate`, `_covers`, `_umbrellas`; the `fs1` / `fsLook` uniforms), `src/ballpark/Stands.js` (the seats' fold, `SEAT_FOLD`, the rails), `src/ballpark/Bowl.js` (the net's strands), `src/ballpark/People.js` (`_aisles`' upper decks, `update()`'s aisle holds and file), `src/ballpark/places/rituals/Seats.js` (one line: the rank, FX2's folder), `src/ballpark/places/sound/Plan.js`, `places/sound/Fans.js`.
- **Crowd.js is shared with FW6** (the near level's geometry). Mine are the kernel, `cwVertex`'s head and sit blocks, the surface's `hat` line and the bald band, and the CPU methods; `fanGeometry()` is untouched.
- **The seats buffer's w** now carries each seat's facing (atan2 of `_fwd`), + 8 if it's under a deck. Anything else reading `cwSeats[ i ].w` should take that off.
- **The pose's flag 19** is "bareheaded now" (the song): the surface's `hat` reads 0 with it.
- **`_writeIds()`'s test argument** has `p.cover` (0..1) now; the gaps test is one more `Crowd.vacate` test.
- **Seats sat on** have `drawParams = [ first fan + 1, 0, 0 ]` on their InstancedMesh; the seats' material binds the crowd's ids buffer (`cwIds`) when the crowd is on.
- No new people (CAST.md), textures or sounds (CREDITS.md).

## The frame-rate risk

Not profiled (the coordinator does). What it costs and where:
- **The crowd's vertex work (the one to watch):** the shoulders' share of the head turn is one rotation (two trig, a dozen flops) per vertex at the close, near and middle levels whenever the fan's yaw is over 0.01, which is now most fans on a pitch (the far and distant levels skip it; their heads take the whole turn on the neck as before). SP3 put the close and near levels' whole `cwVertex` at ~0.75 ms in the 400s and the middle at ~0.1; I'd expect a few % of that, under 0.1 ms. If it shows, the turn can go to the head alone at the middle level too (`lod <= 1u`).
- **The compute pass:** a few dozen more operations per fan (twice: this frame and last), more from strike three; at 42,150 fans, small next to the draw.
- **The seats:** a branch per vertex and one storage read for the 4 pan vertices of each seat built sat on.
- **The umbrellas:** one draw of ~18k vertices, only in the rain. **The net:** one `length()` per pixel.
- **People:** 48 more aisle walkers (+0.01-0.02M triangles in the seat views), their update on the same loop.
- **The CPU:** `_fsUpdate` per frame (`champsAt`, `segmentAt`, `night()`: a few calls); `Fans._occupancy()` a pass over the 42,150 seats once a second, only in the seats (~0.2 ms each time); the 27th's gaps rewrite the ids twice in the whole replay (at the 5th and at the suspension).

## Noticed elsewhere
- The towel's 3 × 3 card (C4S-2's left): wants FW6's geometry pass.
- The 27th's tarp sounds (C4S-10's left).
