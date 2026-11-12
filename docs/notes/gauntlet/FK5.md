# FK5, step 12 round 1: the standing people (the Cast and the concourse throng)

Fixer FK5, 2026-11-12, branch `worktree-wf_ea58af0a-f20-3` (off `ballpark` at 1ce4222). Two files changed, both mine: `src/ballpark/places/Cast.js` and `src/ballpark/People.js`, in "FK5" blocks. Nothing outside them.

**The owner:** "I LOOOOVE the details"; "nothing is too small"; plausible, not glaring.

## The shots

All are in the main checkout under `.claude/gauntlet/s12/r1/FK5/`, at 1280 × 800 on the replay's clock, through the render desk as "cbp FK5". **No console errors in any job.**

- **`b1/`, the before** (on 1ce4222, the full park): every framing by name. The perf views `perf-concourse3b` and `perf-plaza3b-27` carry the stats.
- **`a1/`, CR1-16, CR1-25 and SC1-3's after** (`c02-face`, `c1-face`, `c2-body`, `c4-throng`, `s06-lf-*`). It also has the celebration's counts on the 3B loop and behind home (`sc-loop3b-3470`, `sc-loop3b-3490`, `sc-home-3495`: the stats and `throngShown()`).
- **`a2/`, AD1-14's first after:**
  - the routes as the park builds them (the `ad01-pav-stair` value);
  - the stairs in play, at the delay and at the walk-in;
  - SC1-3's clap again.
- **`f1/`, the full park (no `only=`) on 84381c7:**
  - every before shot by its name;
  - the celebration's counts;
  - the stairs at the walk-in;
  - the elevators (behind home and on the 3B side at the walk-in, behind home in play, the 1B side in the delay);
  - TV center (`tv-center`, camera "center", play 20).
  
  Its values showed every elevator drawing the same lot (fixed in 448b1f4).
- **`f2/`, the last job,** the same shots on the final code (448b1f4). Its stairs' and elevators' values are read after 8 frames of their own (`__qa.still`): the desk reads a shot's `js` before its still frames, so f1's were the shot before's.
- **Crops** in `crops/` (ffmpeg, before on the left):
  - `ad01-stair-before-after.png` and `ad01-stair-between-before-after.png`;
  - `s06-lf-3565-before-after.png`;
  - `c4-throng-before-after.png`;
  - `c2-body-before-after.png`.
- **The generator:** `mkjob.mjs` (b1's shots by name), `mkf1.mjs` and `fk5-mkf2.mjs` (the last jobs), and `ways.mjs` / `ways2.mjs` / `elev.mjs` / `fk5-waiters.mjs` (the routes, the waiters and the in-sight rules in Node). All are in this session's scratchpad: `/private/tmp/claude-501/-Users-phillipforrence-citizens-bank-park/4f4e82b4-ef9f-4fa0-a3f9-d023a05012fe/scratchpad/`. Other fixers write there too.
- **References:** `.claude/ref/gauntlet/standing-people/SOURCES.md` lists the 11 photos used, all already in `.claude/ref/`, nothing new downloaded:
  - for the caps and knit hats: hcwoodward 2983666367, auds 2982693299, Getty 83486358 and 112874578;
  - for the ponchos and jackets: Getty 83891095, AP 4551250 and 4551238, Getty 83486360;
  - for the rail at the last out: Getty 83486360 and 83486358, the 2009 NLCS concourse from above, the Terrace's standing-room rail on the 29th;
  - for the Porch's stair: Flickr 2008-08-14.

## What I did, ticket by ticket

### 1. CR1-16, the pom-poms float and the caps ride high: done (a293dda)

**Why.** The near and middle Cast figures' caps were built on the far figure's egg, which is 14 mm higher and rounder than the MakeHuman head. So the crown rode a finger high over the skull and the bill stood off the brow. The knit hat inflates the real head (`off 0.009`), but the pom-pom was placed over the egg's top, so it floated over the hat.

**What changed** (`Cast.js`):
- **`skullAt( dir )`:** a ray from the head's centre (Möller–Trumbore over the `near` MakeHuman level), the nearest hit past 2 cm, cached by direction (falling back to 0.95 of the egg).
- **The crown:** for the near and middle LODs, every ring point is `onSkull( d, out )`: on the skull plus a finger's thickness at the band (6 mm), easing to 12 mm at the apex. The front panels stand up (a bulge of 11 mm on z at the front, as the 2008 New Era 59FIFTY's buckram does). The bill's root sits on it.
- **The far LOD keeps the egg.** It is a few pixels tall and has no skull.
- **The pom-pom:** sewn down onto the knit hat's top (its centre 8 mm into the hat's crown). Lumpy yarn on 14 × 9 (± 11% by a sine hash); it was a smooth 10 × 6 ellipsoid.
- **Measured in Node (lod 0):** the crown spans y −0.004..0.106 over J.head and the pom-pom 0.097..0.156, so they meet with no gap.
- **The crown's P and button** are painted by direction from the head's centre, so they stay on the panels now that the crown follows the skull.

**Evidence:**
- `b1/c4-throng.jpg` against `a1/c4-throng.jpg` and `f1/` / `f2/c4-throng.jpg` (side by side in `crops/c4-throng-before-after.png`). The pom-pom sits on its knit hat, and the caps hug the heads with the bills at the brows; before, the P caps' crowns stood a finger high.
- `a2/sc-loop3b-3490.jpg`: the pom-poms of the knit hats in the celebration.

**Left:** the crowd's pom-poms in the seats are Crowd.js's (SP4's), not checked.

### 2. CR1-25, glossy bottle-shaped bodies: done (e696e35, plus the far figure's poncho in f66fc3f)

**Why.** The poncho was lofted as a bell: round, flaring at the hem, smooth, at roughness 0.24. In the AP and Getty photos of the 27th, it hangs from the shoulders:
- squared over the deltoids, then straight down;
- flat front and back;
- in long sharp-crested folds;
- the clear film crinkled at 1–5 cm, its light in thin streaks along the creases.

The jackets were uniform gloss tubes with no seams.

**What changed** (`Cast.js`, and People.js's far figure):
- **The poncho's loft (fine LODs):** eleven rings, down the trapezius to a squared shoulder over the deltoid, then straight over the arms. Flatter front and back (the depth 0.17–0.18 against a width of 0.29–0.30). No flare at the hem.
- **The poncho's film:** a height field of long sharp-crested folds (9/rad) with finer ones between (21/rad), into the normal by the screen's derivatives (FW6's fold field).
  - The clear film is crinkled twice as hard (tilt 0.8 against 0.45).
  - The coloured vinyl's roughness is 0.3 (it was 0.24).
- **The jackets:**
  - seams over the shoulders, down the sides and round the armholes, and a jacket's yoke (each darkens the AO by up to 30% and dips the height field);
  - nylon and satin at roughness 0.52 (from 0.45), leather 0.46 (from 0.38) and creased as nylon, a raincoat 0.32 (from 0.25);
  - a long coat's skirt in soft folds (7/rad).
- **The throng's far figure:** its poncho on the shoulders too. Its rings go [0.6, 0.285, 0.168] … [1.51, 0.075, 0.07], flatter, one ring more (+20 triangles).

**Evidence:**
- `b1/c2-body.jpg` against `a1/` and `f2/c2-body.jpg` (side by side in `crops/c2-body-before-after.png`): the red poncho from behind at 5 m. Before, a bell flaring at the hem; after, it hangs from squared shoulders.
- `b1/c02-face.jpg` / `c1-face.jpg` against `f2/`: the jackets' seams and less gloss.
- `a2/ad01-pav-stair-delay.jpg`: the ponchos in the Alley in the delay.

**Left:**
- From behind, a poncho with the hood down still reads a little wide at the elbows. The photos' ponchos are like that, but the hood bunched at the nape could be better.
- The throng's proxies are redrawn from run to run, so the same person isn't always in the same framing.

### 3. SC1-3, the concourse at strike three: done (61f0251; the clap in f66fc3f)

**Why.** At strike three the throng's walkers kept strolling. The rail was two deep, there were no knots of people hugging or filming, and the stands' workers stayed behind their counters.

**What changed** (`People.js`; the GPU's `thrPlace` and its CPU mirror `_thrPlace` alike):
- **The 9th and the celebration (`gather`).** Each walker stops where he is (his clock held at the moment, `tw = min( t, cel.y )`), then goes in his own time over two to six seconds:
  - **To the rail** (68% of the walkers, half the others): three more ranks behind its two. Each rank is half a place along from the one in front, 0.58 m apart, facing the field.
  - **Or into a knot of two to five** on the concourse's floor (a 3.4 m cell's hash picks the size). It stands face to face (talking, hugging: 55%) or turned to the field (filming, cheering).
- **The shares then:**
  - in the 9th: walkers 0.75, standers 0.7 (a tense gathering);
  - at the celebration: walkers 0.85, standers 0.9 (the ranks, not strollers);
  - the old strollers 0.03.
- **At strike three the arms go up.** The far figure's arms turn about the shoulder:
  - a V pumping (2.45 + 0.35 pump);
  - straight up (2.9);
  - one fist, the other arm down.
  
  A third of them jump (0.11 m). The arms' normals turn with them.
- **The Cast proxies near you** are posed for it:
  - **in a knot face to face:** a hug (armIK) or a high five;
  - **the others:** cheer, a fist, a rally towel waved, a camera or a phone held up high, an overhead clap, both hands lifted;
  - **in the 9th:** arms folded, hands in pockets, a beer, blowing on the hands, a clap.
  
  Mouths open, heads up. The hands on the head first tried went through the knit hats, so it's an overhead clap.
- **The stands' staff:** at the celebration they step 0.36 m to the counter's front and lean out (reach 0.75).
- **Timing:**
  - a seek landing in the celebration starts it 20 s in;
  - continuing into the 9th starts it now;
  - a jump starts it 30 s back.

**Evidence:**
- `b1/s06-lf-3565.jpg` against `f2/s06-lf-3565.jpg` (side by side in `crops/s06-lf-3565-before-after.png`), and `a2/` and `f2/sc-loop3b-3490.jpg`:
  - the rail three and four deep;
  - knots;
  - arms up;
  - phones and cameras held high;
  - the clap above a knit hat.
- **Before and after at 136-137:** before, one rank at the rail and the floor strolling; after, the ranks deep and the floor in knots, everyone's arms up.
- **Counts (a1; f2's under "The counts"):**

  | View | Throng shown | Throng triangles | Total triangles |
  |---|---|---|---|
  | 3B loop at 3470 | 914 | 360,116 | 4.51 M |
  | 3B loop at 3490 | 881 | 347,114 | 4.39 M |
  | home at 3495 | 986 | 388,484 | 4.59 M |

**Left:** the left field concourse's rail people at 136-137 may also come from `places/leftfield/People.js` (not mine), which I didn't touch.

### 4. AD1-14, nobody uses the new stairs: done for the stairs and the elevators (f66fc3f, 63c5e47, 84381c7, 448b1f4)

**Why.** Step 10's ways up (the Pavilion's switchback, the Deck's portal stairs, the Porch's towers, the 400s' stairs, the elevators) stood empty on a sold-out night. Flickr 2008-08-14 shows fans on the Porch's stair.

**What changed** (`People.js`, the `_ways*` methods):
- **The routes.** Every tread the colliders know (tags `fa1-stair`, `pavilion-deck-portal`, `porch-stair-east`/`-west`, `terrace-400-stair`) is chained into flights:
  - a tread is the next one if it is a step up (0.08–0.32 m) and a run along (0.12–0.6 m), the same way as the last;
  - flights are joined at their landings (a top within 4.5 m and 0.4 m of the next foot);
  - each route runs from a step onto the floor before the foot to a step off at the top.
  
  At runtime the park has **16 routes**:
  - the Alley's switchback (19.4 m);
  - three of the Deck's portals (13.5 m each);
  - the Porch's two towers (16.2 m each);
  - ten of the 400s' stairs (9.3 m each).
- **The climbers:** up to 48 in one Cast pool, one figure for every 3.5 m of route. When that comes to more than 48, all routes get fewer, and every route keeps its two (the 400s' stairs, which came last, had gone without). In the park that's 41:
  - the switchback 4;
  - the Deck's portals 3 each;
  - the Porch's towers 4 each;
  - the 400s' stairs 2 each.
  - **Each trip is its own:** its way, a hand on the rail (30%), a beer (15%), a poncho in the 27th's rain.
  - **They keep right.**
  - **A stair's gait:** going up, the leading knee lifted and the body over it; coming down, a little back.
  - **How many by the moment:**

    | Moment | Share on the stairs | Going up |
    |---|---|---|
    | The walk-in | 1 | 78% |
    | The delay | 0.65 | 30% (going down under cover) |
    | Between innings | 0.85 | half |
    | In play | 0.2–0.3 | |
    | The 9th | 0.08 | |
    | Strike three | 0.1 | |
    | Going home, 90 s after strike three | 0.9 | 15% |
- **Nobody appears or goes before your eyes:**
  - A trip starts from a stair's end only while that end is out of sight or 20 m off.
  - At a trip's end, if you can see it from under 20 m, he stops there waiting for someone until you can't. The next one to finish there stands a step behind him.
  - A seek (or the first frame) deals everyone again, part-way along their trips, so a stair isn't empty the moment it's shown.
- **The elevators** (`_waitersUpdate`). At each elevator's doors on the main concourse (the three infield banks, FI1's cores) and at the Alley's tower (the Alley, the Pavilion), there are places for up to three to wait.
  - **The places:** either side of the doors and a step out. Each has floor under it (the bowl's ground, the colliders' walkable boxes), nothing solid in the way (a capsule), and nobody going by (1.3 m clear of the stairs' routes, outside the throng's bands).
  - **The middle is kept clear:** you arrive there off a ride and ride from there.
  - **How many by the moment:** the walk-in about two, going home more, the delay and between innings a few, in play less than one, nobody new at the last out.
  - **Their poses:** facing the doors, one watching the floor over them; hands in pockets, arms folded, a phone at the ear, a beer.
  - **A new lot** comes every 30–90 s, only while the door is out of sight (over 45 m off or behind you).
  - **At strike three** the ones there turn to the field with their arms up.
- **The cost:** on Tempo (every 4th frame unseen), built at the first update. The walker steps round them as round everyone in the pool. No colliders are added or changed.

**Evidence:**
- **Routes:** `a2/ad01-pav-stair` (its value lists the 16 routes).
- **The stairs:**
  - `b1/ad01-pav-stair-delay.jpg` against `a2/` and `f2/ad01-pav-stair-delay.jpg`: people on the switchback in the delay;
  - `crops/ad01-stair-before-after.png` (a2 in play) and `crops/ad01-stair-between-before-after.png` (f2 between innings: one at the switchback's turn, one at the top);
  - `a2/ad22-400s-stair.jpg`: one stepping off the top of a 400s stair;
  - `a2/ad15-porch-west.jpg`: at the foot and the top of the Porch's stair;
  - `a2/ad02-pav-landing.jpg`: at the switchback's top by the elevator.
- **The walk-in** (b1 had none; the stairs were empty in every b1 shot):
  - `f1/ad22-400s-stair-walkin.jpg`: one going up a 400s stair mid-stride, keeping right, another at the top;
  - `f1/ad05-deck-portal-walkin.jpg`: three on a Deck portal's stair, two going up, one coming down;
  - and the same framings in `f2/`.
- **The elevators:**
  - `f2/el-home-walkin.jpg`: two at the left door and one at the right, facing them, among the walk-in's crowd;
  - `f2/el-1b-delay.jpg`: one at the 1B bank's door in the delay;
  - `f1/el-3b-walkin.jpg`: a phone at the ear under a poncho's hood.
- **Counts:** f2's values (`ad01-pav-stair*`, `el-*`, in "The counts" below): how many of the 41 climbers are out and each door's lot, by the moment.
- **In Node** (`ways2.mjs`, a camera on the switchback's foot for 120 s): no trip started at the foot while it was seen, and the one coming down waited there. No NaN.

**Left:**
- The Suite, Club and Terrace stops have no waiters. They are inside others' places (FK4's), and the Terrace is in the 400s seat's view, which is on the speed track.
- On the treads, those standing a step behind are at the route's linear height, so their feet can be up to half a riser off a tread.
- Watch one end of a stair for minutes and nobody new comes from it: those who arrive wait there a step apart.
- There are no people going in or out of the elevators' doors. The cars aren't modelled; the 3B stretch's own people (Concourse3BPeople) already use its door as a portal.
- The ramps: none of step 10's have treads in the colliders, so they aren't routes. The 1B Gate's escalators and ramp are still in the queue (FA4's plans).

### 5. With time left: the standing people at 2–6 m against 2008 photos

The worst thing at 2–6 m was the poncho (the bell). That is CR1-25 above, carried to the throng's far figure, which is what you see past 6 m.

## The counts

`JSON.stringify( __app.engine.meshRenderer.stats )`, read the same way in the first job and the last. Both jobs read them as the desk does, before the shot's frames. So each is the frame the page had just drawn (the first shot's is the page's opening view, the second's the first shot's view), but the same frames before and after.

| View | Draws | Triangles | Pipelines | Occluded |
|---|---|---|---|---|
| perf-concourse3b, before (b1) | 954 | 3,591,499 | 783 | 324 |
| perf-concourse3b, after (f2) | 953 | 3,601,661 (+10,162) | 783 | 325 |
| perf-plaza3b-27, before (b1) | 831 | 3,385,748 | 783 | 285 |
| perf-plaza3b-27, after (f2) | 831 | 3,400,282 (+14,534) | 783 | 285 |

The views' own frames, after only (f2, read after 8 frames of their own):
- **`perf-concourse3b-settled`:** 812 draws, 3,178,001 triangles, 304 occluded.
- **`perf-plaza3b-27-settled`:** 951 draws, 3,833,342 triangles, 329 occluded.

**The celebration (f2, settled):**

| View | Throng shown | Throng triangles | Total triangles | Draws |
|---|---|---|---|---|
| 3B loop at 3490 | 983 | 406,962 | 4,635,736 | 652 |
| home at 3495 | 935 | 387,090 | 3,839,666 | 617 |

**The stairs and the elevators (f2, settled):**

| Moment (seek) | Climbers out of 41 | The three infield doors' waiters | The Alley / Pavilion |
|---|---|---|---|
| The walk-in (40) | 41, 41, 40 | 3, 2, 3 | 1, 1 |
| Between innings (2930) | 33 | 1, 2, 2 | 1, 1 |
| The delay (2200) | 29, 25 | 2, 1, 2 and 1, 2, 1 | 1, 1 |
| In play (3000, 1300) | 14, 12 | 0, 0, 0 and 0, 1, 0 | |

**perfRisk:**
- At the 9th and the celebration, more of the throng is shown (the shares 0.75–0.9 against the strollers': about 300–500 more far figures, 120–200k triangles, in the 880–990 shown at those views).
- The far figure has 20 more triangles (the poncho's ring).
- The Cast's fine pom-pom is 140 vertices against 60.
- The climbers and the waiters add one Cast pool (room for 63; in the park 41 climbers and 11 waiters, many of them hidden at any moment), on Tempo. The CPU per step is a loop over 52 people plus one camera transform.
- The 400s' stairs now have climbers: the 400s seat (the speed track's 28.9 ms view) can see two or three on the stairs below it, at the far LOD.

## Noticed elsewhere

- **The left field concourse's rail people** at 136-137 (SC1's s06) may come partly from `places/leftfield/People.js`, not the throng.
- **The crowd's pom-poms** (Crowd.js, SP4's) are not checked against the new Cast hats.
- **The scratchpad is shared** with the other fixers' subagents: FK3 overwrote a `SOURCES.md` there. Use unique names.
- **`b1/c5-concourse-29`'s framing is inside a wall** (CR1's framing on this build). **`sc-3b-3490` (the perf view's eye at the moment) looks from behind the stands through a gap.** For SC1-3, the 3B loop's and 136-137's framings are the ones to judge.
- **The NACHOS cart stands in front of the 3B elevators** (`f1/el-3b-walkin.jpg`): its back is to the doors, a metre or two out, right where you would wait. It isn't mine, and I didn't touch it.
- **The render desk reads a shot's `js` before its still frames,** so a value read straight after a seek is the shot before's. Wrap it as `( async () => { await __qa.still( { frames: 8 } ); return … } )()` to read the shot's own.
- **The Node park build** (`stub.mjs`) throws `.then is not a function` from GPU.js:165; the tests here catch it.

## Repair

FK5 repair, 2026-11-12, branch `worktree-wf_ea58af0a-f20-11` (FK5's branch merged in c1b7716). The skeptic sent FK5 back for two defects. The code reviewer passed it with follow-ups. Still only `Cast.js` and `People.js`, in "FK5 repair" blocks. No colliders were added, moved or removed.

**The commits:**
- 9547c32: wet vinyl;
- cd4b042 and 03d4e54: nobody stands in anybody, and the arms;
- 226ed96 and 8473c45: the hats ride the face's morph (8473c45 for a cap worn backwards);
- 310f55d: the ways up;
- aa28560 and 49fbb1a: the stands' staff (49fbb1a takes the Alley's back to 4 cm behind the window, after r3).

**The evidence:**
- **Renders**, all through the desk and owned by "cbp FK5 repair":
  - `.claude/gauntlet/s12/r1/FK5-repair/r1/` and `r2/` are on the full park at 1280 × 800;
  - `r3/` is scoped (`only=concourse,landmarks,people,leftfield,bowl`), with no console errors, so the shader with 8473c45's change compiles;
  - the crops are in `FK5-repair/crops/`.
- **The befores** are the skeptic's, in `.claude/gauntlet/s12/r1/SK-FK5/`: `b1/` is before FK5, and `a1/` and `a3/` are FK5 as it was sent.
- **The Node scripts** are in the session's scratchpad: `fk5r/r-ranks2.mjs` and `r-knotsizes.mjs`, and `fk5r2/capfit2.mjs`, `capfit2c.mjs` (caps worn backwards), `ways3.mjs` and `pairs-cam.mjs`.

**The checks:**
- `npm test` passes;
- `node test/continuity.mjs` gives start hash 801248349 and duration 3785.503.

### Defect 1 (blocking): gathered people stood inside one another

This covers the skeptic's defects 1, 2, 10 and 11, and the reviewer's rail-proxy, armIK and `_thrPlace` items.

**Why.** Rail ranks were dealt into 0.56 m slots, so two with the same slot and rank stood about 0.1 m apart. Everyone in a 3.4 m cell who went to a knot went to the same ring, 0.36–0.50 m across. Behind home, two figures 0.04 m apart were drawn as one, with four hands (`SK-FK5/a3/ov-pair-home.jpg`).

**What changed** (People.js, the same for the GPU pass and its CPU mirror):
- **`_thrGatherPlan`** works out where each person goes, once, as they stop (in `thrWho`, after everyone's two).
  - **The ranks** behind the rail take one person to a place: the nearest free place, the front rank first, the 9th's choosers first.
  - **The knots** are up to 5 people who stopped near each other at the same share. Each knot's hash wants 2 to 5; one left without anyone near stands alone (the sizes are below).
    - A ring stands face to face, a shoulder's width between neighbours (radius 0.31/sin(π/n)).
    - A row stands side by side, turned to the field.
  - **Each is placed** clear of everyone placed before it (a metre grid), and where no column pushes one person into another.
- **The rail** (03d4e54):
  - Where a line turns, the inside of the corner closed up: behind home and at both ends of the infield's arc, pairs stood 7–14 cm apart. In order along each line, anyone at the rail all night who would stand in someone there now steps on along it until he's clear.
  - The columns are found by 4 m cells.
- **The arms** (`thrArms`, on the GPU and the CPU alike):
  - **In the 9th**, the far figure takes the proxy's pose (folded, pockets, a beer, blowing, clapping). It used to reach out 0.35, which popped at the swap.
  - **At strike three**, the arms come off the rail before they go up. They used to drop from 0.55 to 0 in a frame.
  - **20 to 40 s later** they come down into clapping, filming, a phone at the ear, an arm round the next one, hugs, or back on the rail. About one in seven keep them up. Before, they stayed up for the whole five minutes.
  - **The rail's all-night proxies** keep FW4's lean in the 9th.
  - **The armIK targets** (hug, high five, overhead clap, the stair rail's hand) are solved once at module scope (`FK5_ARMS`).
  - **`_thrPlace`** no longer allocates closures or arrays per call.

**Evidence, in Node** (`r-ranks2.mjs`: the plan as the park makes it, with the skeptic's shares and moments):

| Moment | Pairs under 0.10 m | Under 0.30 m | Under 0.40 m |
|---|---|---|---|
| Celebration (t 500, 1787 shown), FK5 | 251 | 699 | – |
| Celebration, repaired | **0** | 3 | 6 |
| The 9th (1564 shown), FK5 | 204 | 553 | – |
| The 9th, repaired | **0** | 0 | 0 |

The three under 0.30 m at the celebration are each a stroller (role 0) beside a gathered person.

People within 12 m of the views who overlap someone (under 0.25 m), at the celebration:

| View | FK5 | Repaired |
|---|---|---|
| 136-137 | 27 of 89 | **0 of 91** |
| 3B loop | 30 of 97 | **0 of 98** |
| Home | 48 of 126 | **0 of 125** |
| 1B | 35 of 116 | **2 of 117** (a stroller and the gathered one beside him) |

**The knots** (`r-knotsizes.mjs`): 370 knots holding 872 people. By size:

| Size | Knots |
|---|---|
| 1 | 106 |
| 2 | 112 |
| 3 | 83 |
| 4 | 52 |
| 5 | 17 |

FK5 had 158 knots, sized 1 to 12, with 557 of 831 people in knots of six or more, each on one ring under 0.5 m across. A knot of one now stands alone, turned to the field like a row. It no longer faces an empty ring.

**The arms:** at the celebration, 60 s after strike three, 204 of 1787 still have them up. The skeptic's `s06-lf-3770` value (`cheerUp`, 83 of 83 in r2) counts `out.cheer`, which records how far up the arms went and never falls. It isn't evidence that the arms are still up. `r2/s06-lf-3770.jpg` at 3770 shows a mix: a few still up, others clapping or at their sides.

**The plan's cost:** 3.3–3.7 ms, once, as they stop.

**Evidence, in the page** (r2):
- **`ov-pair-home`**, the skeptic's framing for the fused pair: "no pair of 150". Compare `SK-FK5/a3/ov-pair-home.jpg`.
- **`ov-pair-home-fixed` and `knot-top-home-fixed`** use fixed eyes behind home, so before and after are the same view. Pairs under 0.10 m: 0 and 0. Under 0.25 m: 3 and 2. The closest are 0.151 and 0.115 m.
- **`r2/knot-top-home-fixed.jpg`**, against `SK-FK5/a3/knot-top-home.jpg`: distinct figures, two face to face, no bodies run together.
- **The last few close pairs in the page** (`pairs-cam.mjs`) aren't the plan's:
  - One is a stroller beside a knot, 0.116 m apart.
  - Others come from the camera's own push. The pass steps people round the eye, by up to 1 m when it's low. In `ov-pair-home-fixed` the closest pair is 0.264 m apart with that push and 0.439 m without it.

### Defect 2 (blocking): wet vinyl no longer looked wet

This covers the skeptic's defects 3 and 6.

**Why.** FK5 raised the coloured ponchos to roughness 0.3 and the raincoat to 0.32. That crossed FW1's 0.32 line for nylon, so in the rain they came out rougher than dry and darkened like cloth.

**What changed** (Cast.js, 9547c32):
- The ponchos' film, their hoods and a raincoat (top and skirt) are now vinyl, slick in the rain whatever their sheen when dry. The trash bag (poncho 6) stays dull, as FW1 had it.
- A raincoat's skirt is 0.32, like its top.
- A poncho's hood takes its body's sheen. At 0.25 and 0.26, the skirt and hood had been glossier than the garment they hang from.
- Poncho 7's crinkle tilt is back at 0.8. FK5 had cut it to 0.45, which the notes above didn't say.

**Evidence:** `FK5-repair/crops/a1-poncho-rain-1.png` (FK5) against `r1-poncho-rain-1.png` and `r1-poncho-rain-3.png`: the long wet highlights are back down the red poncho's folds. The same holds in `r2/poncho-rain-1.jpg` and `poncho-rain-3.jpg`.

### The follow-ups done

**The caps' crowns, the bills and the pom-pom follow the face's morph** (skeptic's defect 4; Cast.js, 226ed96 and 8473c45).
- **How:** each of their vertices carries the record of the skull vertex under it (`skullRec`). That is the nearest vertex in that direction on the near or middle head's skull. A cap carries two records in its one float: its own way, and turned half round for a cap worn backwards. The shader moves the vertex by that record's morph, as it moves the head under it. Only the shape moves: the normal and the paint are untouched.
- **A cap worn backwards** is turned half round (FP2) after the morph is added. So the morph's move is turned with it first (8473c45), and comes out as the skull's own.
  - In 226ed96 it was added unturned. Where the skull came out at the sides, front and back, the cap went in.
  - That was worse than not following at all: over 1000 faces the near crown came through the skull on 748, by more than 4 mm on 516. FK5 had 607 and 223.
  - The Node check, `capfit2c.mjs` (set `BUG=1` for 226ed96's order), now gives the rows below.
  - Not seen in a render: r3's `capback-side` and `capback-front` framed the worst backwards cap in the park (seed 4896, top +24.9 mm) from 0.9 m, but others stood between.
- **Over 1000 faces** (`capfit2.mjs`):

| Measure | FK5 | Repaired |
|---|---|---|
| Near crown through the skull | 757 | 73 |
| …by more than 2 mm | 558 | 3 |
| …by more than 4 mm | 422 | 0 |
| Near crown worn backwards, through | 607 | 19 |
| …by more than 2 mm | 393 | 1 |
| Middle crown worn backwards, through | 459 | 1 |
| …by more than 2 mm | 304 | 1 |
| Middle crown through | 804 | 254 |
| …by more than 2 mm | 635 | 71 |
| Pom-pom floating over the knit top (near) | 216 | 0 |
| Pom-pom floating over the knit top (middle) | 243 | 0 |

- The pom-pom's lowest point now sits 6.9 mm above the skull's top on every face, seated into the knit (whose top is at 16 mm). Under FK5 that point ran from 20 mm into the head to 36 mm over it.
- **Renders** of the worst faces in the park (r2): `knit-worst-side` and `knit-worst-front` (the top morphed −35.9 mm), and `cap-worst-side` and `cap-worst-back` (+30.8 mm). The crown sits on the head and the pom-pom on the knit.

**The ways up** (reviewer's queue and switchback items, skeptic's defect 7; People.js, 310f55d):
- **The landings** (`_waysLanding`). A landing where the way turns gets the points you'd walk across it by: where the flights' lines meet, at a corner; at a switchback, two points at the landing's height. The route used to run from one flight's top tread straight to the next flight's first, through the rails and stringers between them.
- **Keeping right.** The offset is mitred at each point, so it's the same on either side of a corner. Each climber faces along the route ±0.3 m either side of him.
  - At the Alley's switchback (`ways3.mjs`), the largest move in 2 cm of route was 18–58 cm. It is now 2–3 cm.
  - Route points within 12 cm of a rail or side were 26 (at 0.12 m and 0.25 m right). They are now 0.
  - A climber turns at most 3.8° in 2 cm of route. He used to snap round at each corner.
  - In the page: `r2/landing-switchback.jpg` shows three on the landing.
  - Every route in the page (r3's `landing-porch` value, 16 routes):
    - The Alley's switchback and both of the Porch's towers each get two corners (a U-turn landing).
    - The largest move in 2 cm of route at 0.4 m right is 2.0–2.9 cm, and the largest turn 3.8°.
    - The Alley's three straight stairs and the 400s' ten get no corners: 2.0 cm and 0°.
    - `r3/landing-porch.jpg` shows the Porch east tower's landing from the flight above, clear of its rails. Nobody was on it at that moment.
    - The Deck's portal stairs weren't in r3's scope.
- **The queue.** Someone coming up to an end that's in sight now stops where the line ahead of him ends, 0.75 m back for each one holding there. He used to walk through them to the end, then jump back.
  - Watching the switchback's top for 120 s: no step back.
  - Four sent up together stop 0.75 m apart.
- **What counts as "in sight."** It used to be 20 m for a stair's end and 45 m for a door, whatever the lens. It is now an end where a figure would be over 2.5% of the frame's height and in front of the camera (`WAYS_SEEN`). That is about 60 m at 60°, and further down a TV camera's long lens.

**`dry` for the waiters and the covered stairs** (skeptic's defect 8): it comes from the rain cover's heights, by most of a route's points or by a door's spot.
- `r2/el-waiter-27`: `dry: true`. In a1 he had a wet cap and a glossy poncho indoors.
- `r2/ad-climb-rain` is on the open switchback: `dry: false`, which is right.
- In r3, the routes under cover are dry: the Alley's three straight stairs and the 400s' ten. The switchback and the Porch's towers are out in the rain.

**The stands' staff** (skeptic's defect 9, reviewer's staff item; People.js, aa28560):
- **The step.** At strike three they step to 15 cm behind the stand's front and no further: inset − 0.15, at most a food stand's 0.36. That is 0.1 at a ticket window and 0.15 at a shop.
  - At the window: `r2/cel-staff-window`'s `staffOut` is −0.15. It was +0.11, through the wall.
- **The Alley's staff** (inset 0) used to stand at the stand's mid, 10 cm out on the customers' side of the counter's panel, with the ledge through their waists. Then they stepped 0.36 further out.
  - They now stand in the window, their middle 4 cm behind its plane, and they lean out over the ledge without a step.
    - `r2/cel-staff-alley.jpg` and `staff-alley-side.jpg` (`staffOut` −0.14): face, cap and arms whole, the ledge at the belt.
    - Their toes show at the panel's foot.
  - I tried 7 cm to hide the toes (aa28560). In `r3/cel-staff-alley.jpg`, `staff-alley-side.jpg` and `staff-alley-steep.jpg` the painted kitchen took the head as well, all but the face's front. 49fbb1a put it back to 4 cm.

### Corrections to the notes above

- **The elevators' evidence was misattributed** (skeptic's defect 12).
  - The figures I pointed at in `f2/el-home-walkin.jpg` and `f1/el-3b-walkin.jpg` (the UTLEY 26, the white jacket, the grey poncho) are in the before too. They are the throng's or the places' people.
  - The waiters are the two at the home bank's doors: one facing the left door, one the right (`SK-FK5/a1/el-home-walkin.jpg` against `b1/`).
- **"No flare at the hem" isn't so** (skeptic's defect 5).
  - The loft's hem is unchanged: 0.292 against 0.29.
  - The bell you see from behind comes from the arm rig spreading the poncho, not from the loft. It is still there (see "Left").
- **"Twice as hard" was the other way round.** Poncho 7 (the clear poncho for two) had its crinkle cut from 0.8 to 0.45. It is back at 0.8.
- **"Knots of two to five"** was false in FK5. Now it's 1 to 5 by construction. Two is the commonest size, not three or four as cd4b042's message says.
- **The celebration's throng triangles** were +219k on the 3B loop, above the 120–200k given in perfRisk above. The figures are under "The costs" below.

### The costs

The stats are read as the desk does, at the shot's first frame (a) and after its own frames (b).

| View (r2) | Draws (a / b) | Triangles (a / b) | Compared with |
|---|---|---|---|
| `cost-tv-center` | 506 / 505 | 3,690,531 / 3,679,721 | FK5 (a1): 3,726,633 / 3,715,823; before FK5 (b1): 3,673,613 |
| `cost-cel-loop3b` | 661 / 660 | 4,660,961 / 4,644,431 | FK5 (a1, from the skeptic's report): 408k throng triangles |

- On `cost-cel-loop3b` the throng shows 978 figures and 404,892 triangles. Those are not in the stats.
- On the stroll before FK5 (b1), the throng had about 189k. The celebration's shares add about 216k: some 4% of that frame's 5.07M triangles (stats plus throng).
- **New per-vertex work in Cast.js:** the crown, bill and pom-pom vertices now run the morph (`fhBlend`) as the head's do. That is the crown's 49 vertices, the bill's, and the pom-pom's 140 on the near figure (31 crown and 63 pom-pom on the middle one), and only on figures wearing those hats. The far LOD carries none.
- **The ways:** each climber now makes three `_waysAt` lookups per Tempo step, against one segment walk before.

### Left

- **The speed track.** Get frame times for the 3B loop's and behind home's celebration views at the next profiling wave. By the rules I didn't profile.
- **The page's last few close pairs** come from strollers beside the gathered, the camera's own push near a low eye, and the places' people pushing the throng. None of them is the plan's.
- **Knots of one.** 106 people stand alone on the floor, turned to the field. They are realistic but many; they could walk to the nearest knot with room.
- **The poncho's bell from behind** comes from the arm rig, not the loft.
- **The middle LOD's crown** still sags 2–4 mm into the skull on 7% of faces. That head's skull is coarser under the rim.
- **On the treads,** those holding a step behind stand at the route's linear height, up to half a riser off a tread.
- **Watch a stair's end for minutes** and nobody new comes from it. Those who arrive wait there a step apart.
- **The Alley's painted kitchen** is a plane 1 cm behind the window's, and the counter is built against it. So there's no room behind the counter for a person. The staffer's back is cut off, which shows from a steep side, and his toes show at the panel's foot. A real fix is a shallow kitchen behind the window (FK3's `places/alley`, or Landmarks.js), not the staff's inset.
- **Two climbers can start a trip from the same end in the same step** and walk at the same s. In r3, two were at 0.4 m up the Porch's east stair. Their keep-right offsets are 0–0.2 m apart, so they may stand in each other. That is unchecked, and it was FK5's dealing before this repair.
- **The 3B bank's waiters** ignore Concourse3B's own people.
