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
