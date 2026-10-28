# FW6, round 4: the people up close (the torsos, the hats), the floors, making way

Fixer FW6, 2026-10-28, branch `worktree-agent-a64f7b632f1643db3` off `ballpark` at ccb9bc0 (FC4 merged). Tickets: critic C4W's findings (`.claude/gauntlet/r4/C4W.md`): C4W-1, -2, -3, -4, -7, -5, then the rest as time allowed (-6, -10, -11, -12, -13, -14, -15, -16). Not mine and not touched: C4W-8 (McFadden's: `Frontages.js`, the concourse room), C4W-9 (the store's doors: `places/inside/Clubhouse.js`).

**Shots.** All in this worktree's `.claude/gauntlet/r4/FW6/` (gitignored), copied with the scripts (`mk.mjs`, `holes.mjs`, `counts.mjs`) to the main checkout's `.claude/gauntlet/r4/FW6/`: `before/` (1280 × 800, the full park, at ccb9bc0 before any change), the working rounds `a1/` to `a3/`, `final/` (the full park, no `only=`, no console errors), `crops/`. The recipes are `job-*.json`, made by `mk.mjs` in the session scratchpad (`fw6/`; it borrows C4W's `helpers.mjs` for `__castK`, `__frameCast`, `__walk`, `__ground`, `__who`), with:
- **a lineup** (FW4's way: a troupe of my own, every other troupe left out for that shot) on the 3B concourse by 129 on the 29th, six people dressed and posed the same in every job: a red Phillies jacket and the red knit, a beer up; a black puffer, the grey knit with its pom-pom, glasses, the phone at his ear; a woman in a navy hoodie, long hair, a red cap, a phone in both hands; the home whites over red sleeves, a black knit, a goatee; a red name tee and a navy cap, arms down; a woman in a navy fleece and a plain knit, hands in her pockets. Shot `line-front`, `line-shoulders`, `line-34`, `line-back`, `line-knits`, `line-knits2`, `line-side`, and by day `line-day`;
- **arms up** (a1 on): both arms up, a towel whirled, a fist pumped, a camera held up and an arm on the rail: `arms-front`, `arms-back`;
- **ponchos** (the 27th, wet): clear over a red jacket with a beer up, white with the hood up, yellow with the phone up, a trash bag, red over the home whites, clear over a navy hoodie with the hands in the pockets, and a woman's long camel coat: `ponchos-front`, `ponchos-34`;
- **C4W's own recipes** under its names (`j1-13`, `k2-09`, `k2-12`, `k2-16`, `k2-29`, `j1-11`, `k3-0x` walks, `k2-22`/`k2-23` walks, `k2-26`, `j1-33`, `k2-28`, `k3-13`, `j1-04`, `k3-d2`): who's nearest changes from run to run, so the lineups are the fair before/after.
- **an offline look** at the figure's geometry with no GPU: FW4's software rasterizer (`raster.mjs`, `view.mjs`), the near and middle figures in their rest pose; and `holes.mjs` (C4W's hole check with the new boxes, open floor and overhang both).

The light is the replay's clock throughout; `line-day` and `k3-d2` are by day (hour 14), last in each job.

## Per ticket

### C4W-1: the torsos as boxes (done; the near and middle figures, and the seated crowd's close shoulders)
- **The shoulders.** The trunk's top rings are round in plan (FW4 squared them to 2.4-2.6: from any angle but straight on, the top of the trunk was a flat shelf with corners) and fall from the collar: 1.472 m at 0.086, 1.452 at 0.12, 1.43 at 0.152, 1.41 at 0.171, 1.385 at 0.181 (the point of the shoulder; it ran out level to 0.21 at 1.40). The chest a little fuller and flatter in front (2.2-2.25 at 1.22-1.30), the waist in under it (0.155 at 1.06), the jacket easing out over the hips as before.
- **The deltoid.** The sleeve's head is the shoulder's round: its top rings sit in toward the neck under the trunk's slope (a ring's centre can move out or in now: `limb()`'s fourth number), rising 2.7 cm over the joint (3.6 before), full just under the joint (5.7 cm, not 6.4) and tapering to the elbow, so the outline falls from the trapezius over the deltoid and down the arm, ~0.49 m across the deltoids (0.52). The far figure's rings follow the slope too.
- **The arms** in against the body: the shoulder joint 0.188 (0.195), the elbow 0.198 (0.221) against the waist, the wrist and hand 0.209 / 0.207 out past the hip (the elbow's carrying angle). `J` moved: Concourse3BKit's `armIK` and `home/Poses.js` read it, so the solved poses land where they did. A broad man's arms hang 1.2 cm further out (his trunk was widened under them and its shoulder corners came through).
- **The skirt of the jacket stays round the hips** (blended to the pelvis below the waist when the trunk turns or leans: the trousers showed through the hem's sides, a square flap of jacket between two patches of trousers; the pelvis taken in a little under it). An apron and a long coat's skirt the same.
- **A jersey hangs loose** and straight from the chest (auds 2988587598), and its short sleeve is a tube flaring a little to its hem at mid-arm.
- **Folds and the body's own shade** (with C4W-10), in the Cast's shader, the near and middle figures (they fade out where a pixel spans a fold): drag lines from the armpits down across the chest and back, the jacket bunched over the hem and fanning round it, a jersey's long hanging folds, a hoodie's or fleece's bigger and softer ones, a leather jacket's fewer, rings in the crook of the elbow, the cuff rucked at the wrist, the trousers' at the knee and the shoe, a puffer's quilting puffed (a height turned into the normal from the screen's derivatives, each person's own phase). The shade: the trunk's sides where the arms hang (×0.64) and the armpits deeper, the arm's inside, the crook of the elbow, the neck under the head, the hem's underside, the crotch and under the jacket's hem; applied to the albedo (so the concourse's local lights see it too) and as `s.ao`.
- **The seated crowd's close level** (behind the drink rail at arm's length): its shoulders round in plan (2.4-2.5 to 2.0-2.15) and falling to the collar from over the arms' rounds (0.142 → 0.124 at the top: the top of the trunk was a flat ellipse 0.28 m across, level with the tops of the arms).
- **The hips**: the jacket's skirt square at its front corners over the hips (2.25-2.5: a jacket hangs over them, not an ellipse) and the thighs' tops slimmer, shallower and starting inside it; the vest, the apron and a long coat's skirt square over it in turn. The thighs' round fronts came through the jacket's elliptical skirt either side, a patch of trousers each side of a flap of jacket, on every figure close up (FW1's limbs; in the critic's crops and my befores both). Checked offline on the near and middle figures (no trouser left between the jacket's hem and the waist) and at 1.5 m in `final/k2-29-seats-rain-from-rail.jpg` (the usher; `crops/k2-29-hips-before-after.jpg`).
- Per figure (vertices / triangles): near 4,608 / 6,017 → 4,748 / 6,265; middle 3,291 / 3,704 → 3,338 / 3,794; far and distant as they were (1,342 / 1,271; 261 / 306).
- **Evidence:** auds 2988587598 (Oct 29 2008: a red hoodie and the home whites at arm's length, the shoulders sloping under the cloth, folds at the chest and the sleeves), hcwoodward 2983666367 (Oct 27 2008: the jackets' shoulders and folds in the atrium, the shade under the caps), whyy 2986647343. Before: `before/line-*.jpg`, C4W's `crops/j1-13-hats-torsos.jpg`, `k2-09`, `k3-d2`; after: `final/` the same names; `crops/line-front-standing-before-after.jpg`, `crops/line-shoulders-before-after.jpg`.

### C4W-7: the raised arm's sleeve head as a ball (done)
- FW4's sleeve head (rigged wholly to the upper arm) swung its back up over the shoulder line whenever the arm came forward or up. Now the sleeve's vertices from 10 cm under the joint up are blended toward the spine's rig (72% at the top, less for an arm held right up over the head, which takes more of the cloth with it), so an arm brought forward stretches the cloth from the shoulder; with the smaller deltoid tucked under the trunk's slope there's nothing to pop up. (The rig's second pass for the motion vectors does the same.)
- Before: `before/line-shoulders.jpg` (the woman's two shoulder balls, the puffer's), `before/line-side.jpg` (the beer arm's hump); after: `final/` the same (`crops/line-side-raised-arm-before-after.jpg`), and `final/arms-front.jpg`, `arms-back.jpg` (both arms up, a towel, a fist, a camera: the shoulders stay on).

### C4W-2: the knit hats (done; the Cast and the seated crowd)
- The edge (`c3KnitEdge` / `cwKnitEdge`, the same in both): two fingers over the brows in front (d.y 0.39; the brows are at 0.3, the eyes at 0.1: it came down to 0.12, the eyes), over the tops of the ears at the sides (0.0), low on the nape behind (-0.15).
- The shape: the cuff a 1.4 cm step out from the skull (its thickness), the crown over it 0.9 cm out, hugging the skull's round (it was the head blown up 6% above the eyes: straight sides, a can), a little higher and slouching back.
- The paint: the cuff the 0.13 over the edge, the crease of its fold and its rolled lower edge in shade, the ribs all round; the Phillies' P, the white band and the cuff's stripes placed from the edge.
- The ears show again under a knit, their tops under the cuff (FW4 folded them away).
- The pom-pom round (10 × 6 close, 6 × 4 middle; it was 6 × 4, 12 faces) and fuzzy (its normal broken up, its inside darker).
- **Evidence:** Getty 83893023 (Oct 27 2008: the red knit P, its blue cuff on the forehead), auds 2988587598 (the grey knit high on the forehead), hcwoodward 2983666367 (the patterned knit's cuff over the brows). Before: `before/line-knits.jpg`, `line-knits2.jpg`, `line-shoulders.jpg` (the grey knit on the glasses), `line-front.jpg` (the seated fans' knits); after: `final/` the same (`crops/line-knits-before-after.jpg`).

### C4W-3: the walker through the floors (done)
- `Bowl._walkable` made each quad's collider as long as its front edge; at every bend of a strip the quads fan out behind, so each convex corner left a wedge of drawn floor with nothing under it (239 m² of the Terrace's 15 m walkway, 52 m² of the club's). The box now covers its whole quad: from its leftmost corner to its rightmost along the front, from the front to the back (in the quad's frame), so where a quad is narrower behind it reaches over its neighbour's floor, which is floor too. The suites' floor and the press box's roof use it too.
- **Checked:** C4W's check with the new boxes (`fw6/holes.mjs`): the Terrace 239.4 m² open → 0, the club 52.4 → 0, and 0 m² of box over no floor in both. In the page, C4W's probes read 24.69 on the Terrace and 18.59 in the club everywhere (they read 7.01 and 18.59 under the Terrace, 7.01 under the club's corner), and its three walks stay up (`k3-01`, `-02`, `-03`: they fell 17.7 m).

### C4W-4: ponchos and long coats as bells (mostly done)
- A poncho's lower sides follow the forearm as well as the upper arm, and a wearer's sleeves are the film over the arm (a little fuller, painted as the poncho: the jacket's sleeve under a clear one, the yellow or red plastic over a coloured one), so a beer held up or a phone at the ear takes the plastic with it rather than the jacket's sleeve coming out through a hole in it.
- The bell narrower over the narrower shoulders (0.30 m half-width at the elbows, 0.335 before: it stood 9 cm out from the arms) and falling in a little to its hem under the hands.
- The clear film: the jacket under it at 0.9 (0.72 under a 20% grey: an opaque grey shell), the haze 8% plus the edges and creases, the creases' tilt at 0.22 of FW4's and each poncho's crumple its own size (the hammered dimpling). The white ones thinner, the jacket through them. A poncho's hood 13% over the head, not 17% (a ball).
- **The long coat** has its own skirt from the waist to the knee, straight and flaring a little, clear of the hands (it was the poncho's bell from the shoulders, the sleeves stuck on its sides); its body and sleeves are the trunk's and the arms', and the skirt stays with the hips.
- **Left:** a poncho is still a shell over the body, not film clinging to it; the hands don't come out of side slits; the middle figure's folds are few.
- **Evidence:** Getty 83891095 (Jim McIsaac, Oct 27 2008), the AP's (cbsnews 4551250), lsmithnet 2985873477. Before: `before/ponchos-front.jpg`, `ponchos-34.jpg`, `j1-11-3b-129-27.jpg`; after: `final/` the same (`crops/ponchos-34-before-after.jpg`).

### C4W-5: nobody makes way (done)
- **The walker is pushed by the people** (`Walker._pushFromPeople`): every person in the Cast's pool (the places' people and the throng's stand-ins) within 1.2 m of height pushes the walker's capsule out to arm's length (0.3 + 0.22 m × his size), softly, a third of the overlap a step, as `_pushFromFans` does for the seats. A box test on each of the ~3,400: ~20 µs a step (measured in Node).
- **People step aside** for the walker: in the pool's upload, a person within 1.2 m of the walker's eye (on his floor) moves away from it, up to 0.42 m, easing there and back over about a second; the walker's push reads the same offsets. Only for the walker (the walker marks the pool each step): a TV camera's or a cameraman's eye among people leaves them where they are. (The places' own steering doesn't know: it's the drawn person that moves, and the place carries on.)
- **Checked:** `k2-22` (into McFadden's line): the walker stops at x -73.42 behind the line (it walked through it to the glass at -72.09); `k2-23` (into the rail's crowd in the delay): it stops at (-11.26, 46.15) behind them (it went through to the rail and slid along it to -9.59).
- **Left:** the rail's standers don't lean aside; a line holds its place only because you're pushed.

### C4W-6: long hair as a board (partly)
- The Cast's long hair (the near figure) ends in five or six locks of their own lengths and widths, the hollows between them up to 6 cm higher (FW4's was an even sawtooth); its lower rows lie out over the collar and the back and come up onto the shoulders at the sides (13 columns close, 9 before). The strands broken and uneven (warped, three sizes, each head its own), lighter at the ends and the crown, darker in among the locks. The hair painted on the head (every style but bald) in strands too, combed back and down the sides (one flat colour: a helmet).
- **Left:** it's still one shell: no gaps between the locks, no thickness at its edges; the seated crowd's long hair as it was (FC4's).
- Before: `before/line-back.jpg`; after: `final/line-back.jpg`, `arms-back.jpg`.

### C4W-10: lit flat (done for the people's own shade)
- See C4W-1 for the trunk, the arms and the neck. The face: a cap's brim (any brimmed hat but one turned round) shades it from the band down to the nose, the eyes in it (×0.58 at the band); a knit's cuff shades the brow under it; the head's underside shades the chin's. The seated crowd's faces under a cap the same (×0.62).
- Not done: shadows cast by the local lights onto the figures themselves.

### C4W-11: strike three on the concourses (partly: the 3B concourse)
- At the rail (`Concourse3BPeople._react`), after the first moment (everyone's arms up at once), each goes through it his own way and at his own pace, a beat of 4-8 s each: the towel whirled with the other fist pumped, a fist pumped, clapping over his head, both hands on his head, an arm round the next one's shoulders, the phone held up to film it, both up again.
- The walkers who didn't get to the rail stop where they are, turn to the field and celebrate with the rest for two minutes, then go on their way (they strolled on). The stands' lines turn round to the field for the first minute and a half (they queued on with their backs to it) and celebrate where they stand.
- **Left:** the Terrace's rail (`places/terrace/People.js`, not mine) and People's throng carry on; nobody hugs or jumps in knots on the concourse floor; the staff stay behind their counters.
- Before: C4W's `shots2/k2-26-3b-concourse-strike3-40s.jpg`; after: `final/k2-26-3b-concourse-strike3-40s.jpg`.

### C4W-12: Pattison after the win (done)
- 240 celebrants (150), most in knots shoulder to shoulder round Schmidt's plinth, by McFadden's door and the gate, a band along the curb and out into the street, the rest scattered between, never two on one spot (`places/gate3b/Celebration.js`). `__who` counts 134 within 30 m of (-80, 105) (C4W: 11), 111 within 25 m of (-82, 100) (6), 191 within 30 m of (-90, 100) (14). The plaza's Folk pool holds 326 of its 600.
- **Left:** no barricades at the crossing; the crowd doesn't grow over the five minutes beyond the runs in from the doors and the lots.
- Reference: bps52769 3401495889 (23:15) and 3401495421 (23:18). After: `final/j1-33-pattison-after-win.jpg`, `k2-28`, `k3-13`.

### C4W-13: names and numbers as blank bibs (done)
- Where a pixel spans a letter's stroke (8-20 m), the back's print fades to a pale tint over its cell (its mean coverage, 0.28), not the atlas's low mip, which averaged the name and number into one solid block in the print's colour; a chest's script fades the same way.

### C4W-14: the 29th's ponchos by the store (done)
- The plaza's people take their ponchos off on the 29th as they put their umbrellas down (`places/gate3b/Cast.js`); the plaza's poncho kinds from the photos' mix (clear 62%, yellow 13, red 10, orange 6, a trash bag 6, white 3: `Folk.js`), as the throng's and the 3B Cast's are (it was a quarter each of clear, red, yellow and trash bags).
- **Checked:** `final/probe-plaza-ponchos-29` counts the plaza's 275 people shown at seek 2290: no ponchos. (Its twin at seek 1555 on the 27th finds none either: the people on the plaza during the game are the dry ones, as C4W found no umbrellas there at 1300. The 27th's rain gear on the plaza is the arrivals' before the game.)

### C4W-15: the beer (done)
- A 12-sided clear cup flaring to its rim (close up); the lager pale gold, lighter edge on where the light comes through it; a head of foam under a band of empty clear plastic and the rolled rim's bright line (dottcom 2931484933). It was an opaque saturated tube with a cream lid.

### C4W-16: beards as black cut-outs (done; the Cast and the seated crowd)
- A moustache and a goatee in the hair's own colour a little darker (FW4's beards already were), their edges soft and broken into stubble, the skin through them at the edges; the moustache curving with the lip.

## Counts

`__app.engine.meshRenderer.stats` with `__cast.stats` and the throng's `throngShown()`, 1280 × 800, the full park, read in the shot's own `js` after 6 frames in its view: `before/` (ccb9bc0) and `final/`:

| View | Before | After |
|---|---|---|
| Walking, the 3B concourse (PERF.md's, play 60) | 800 draws, 3,073,708 triangles; Cast far 92, distant 908; throng 467 shown | 803 draws, 3,094,414 triangles; Cast far 92, distant 908; throng 467 shown |
| The lineup (6 near Cast figures, the seats' close fans below) | 457 draws, 2,110,128 | 457 draws, 2,111,616 triangles |
| TV center (play 20) | 497 draws, 3,486,112; Cast middle 123 | 497 draws, 3,496,632 triangles; Cast middle 123 |

- **The concourse** +20,706 triangles and 3 draws with no change in its Cast figures (92 far, 908 distant, no near or middle): the walking view's draws and triangles move a little from run to run with the places' people (FC4 saw the same); the figures I changed aren't in it.
- **The lineup** +1,488: its six near figures at +248 each.
- **TV center** +10,520: its 123 middle figures at +90 each (+11k), the rest noise.

Per figure (vertices / triangles, folded props included): the Cast's near 4,608 / 6,017 → 4,748 / 6,265, middle 3,291 / 3,704 → 3,338 / 3,794, far 1,342 / 1,271 and distant 261 / 306 unchanged; the seated crowd's levels unchanged (the close level's rings moved, not added).

## What the merger must know
- **Cast.js** (mine): `J.shoulder`, `J.elbow`, `J.wrist`, `J.hand` moved in (0.188 / 0.198 / 0.209 / 0.207); anything that hard-codes where a Cast hand is at rest should read `J` (Concourse3BKit's `armIK` and `home/Poses.js` do). The trunk's, the sleeve's, the pelvis's and the poncho's rings; `limb()` takes a ring's outward offset. In the vertex shader: `c3KnitEdge()` (in `castModule`), three blended rigs (`wHem`: the jacket's skirt with the pelvis; `wSh`: the sleeve's head with the spine; `wFore`: the poncho's lower sides with the forearm), each only on the near and middle figures and redone for the motion vectors; a jersey's loose cut and short sleeve's flare; a broad man's arms 1.2 cm out; a poncho wearer's sleeves 1.4 cm fuller. In the surface: the folds and the shade block (`ao`, `fh`, `headAO`) just before the rain's wetting, `s.ao` set. The pool: `pool.walkerSeen` (set by the walker each step) and per person `p._ax`, `p._az` (the step aside, in the field frame, added to the drawn position only).
- **Crowd.js** (mine, all in `---- FW6` blocks, the near and close levels' looks only, clear of FS1's mood, poses, head turn and compute pass and of SP3's packed varyings): `cwKnitEdge()` at the top of `crowdModule`; the knit's shape in `cwVertex` and its paint; the beard paint; the close level's `TRUNK.close` rings; the brim's shade. The coordinator's C4S-1 hunk in `Crowd.mood()` on `ballpark` doesn't touch any of it.
- **Walker.js** (mine): imports `castPool` from `places/Cast.js` (no cycle: Cast.js imports nothing of the walker's); `_pushFromPeople()` after `blocked`.
- **Bowl.js**: `_walkable()` only (the strips', the suites' and the press roof's floors).
- **Concourse3BPeople.js** (`_react`'s champions, `_walk`'s first lines, `_inLine`'s facing), **gate3b/Celebration.js** (the spots), **gate3b/Cast.js** (the ponchos off on the 29th), **gate3b/Folk.js** (the poncho mix): one marked block each.
- No invented people, no textures or photos shipped (CAST.md, CREDITS.md unchanged).

## Frame rate

Not profiled (the coordinator does). What it costs and where:
- **The near figure** (over 250 px: a handful at a time on the walk) +140 vertices and +248 triangles (the deltoid's and the thigh's extra rings, the hair's columns, the pom-pom, the beer's sides); **the middle one** (112-250 px: FOX's long lens draws ~123 of them in TV center) +47 / +90. The far and distant figures unchanged.
- **The vertex shader**, near and middle figures only: three blended rigs, each a second `c3Rig` on part of the figure (the jacket's skirt below the waist, ~a quarter of the trunk's vertices, a pelvis rig with no rotations; the sleeve's head, a spine rig; a poncho's lower sides, a forearm rig, ponchos only), and again for the motion vectors. In TV center that's ~123 middle figures × a few hundred vertices: tens of thousands of extra rig evaluations a frame, cheap ones. I'd watch TV center and TV high (the 27th's ponchos).
- **The fragment shader**: the folds (a few sines and a screen-derivative bump on the trunk's, sleeves' and trousers' pixels, near and middle figures, faded to nothing where a pixel spans a fold) and the shade (a few multiplies, every figure). The knit's paint is a few comparisons more; the pom-pom's fuzz two sines.
- **The CPU**: the walker's push scans the Cast pool's ~3,400 people each walking step (a box test first: ~20 µs, measured in Node); the pool's step aside adds a few operations per person drawn, a square root only for those within 1.2 m of the walker's eye. Pattison after the win draws 240 celebrants (150): ~90 more Cast figures, nearly all far or distant from the plaza.

## Not done
- **C4W-8** (McFadden's paper dolls, its blank TVs, no way in: `Frontages.js`' `fzSaloon`, the concourse room, or a new room): outside my files, a room's worth (L).
- **C4W-9** (the store's doors): outside my files, and not the S it looks. Splitting the facade's box at the doors is easy (`Exterior.js` adds one per footprint piece, tag `facade`; `Clubhouse.js` knows `doorT`), but the doors are drawn shut, one glass pane across the opening in `_glass()`'s quads with the stiles and push bars in the frame's mesh, so walking in means walking through closed glass. It wants the doors as their own meshes that swing in as the walker comes up, then colliders for the back wall (`BACK_IN`), the cash wrap (`zBack - 1.0`, x 1.1-4.5), the two round racks (r ~0.65 at (1.3, zBack - 2.7) and (4.3, zBack - 2.5)) and the tables (`_fixtures`), all in the store's frame (`this.F`, `toF`).
- From C4W-11: the Terrace's rail at the strike (`places/terrace/People.js`), the stands' lines breaking, knots hugging and jumping on the concourse floor.
- From C4W-4: film that clings to what's under it, hands out of side slits; from C4W-6: gaps between the locks.

## Noticed elsewhere
- The plaza's Folk pool (600) holds 326 after the win now; a bigger Pattison crowd than this wants the throng's GPU figures beyond 25 m, as C4W-12 suggests.
- `castshader.mjs` (FW4's headless compile check) reports two command-encoder errors from its own setup (a render pass left open), not the shaders: it was the same before my changes.
