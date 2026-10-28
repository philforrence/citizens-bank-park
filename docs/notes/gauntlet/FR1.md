# FR1, round 2: the celebration (the night's climax)

Fixer FR1, 2026-10-28, branch `worktree-agent-a602f823b2ef49769` (off `ballpark` at 028432b). From Lidge's last pitch through the pile, the press, the stage, the trophy and the lap. Six desk jobs: `before`, `after1`, `after2`, `after3`, `final` and `final2`, all on the full park (no `only=`) at 1280 × 800.

**Shots** (main checkout, `.claude/gauntlet/r2/FR1/<job>/`):
- **Before:** `before/` (the presentation from the front, high home and on TV; the pile at 8 and 20 s; Manuel's jacket; the benches; the floating caps' first probe `X0`-`X7`; the 27th's roll).
- **After:** `after1/` (the stage turned round), `after2/` (the MVP at the car, the leis, the streamers, the probe by troupe and LOD `Z-*`), `after3/` (the probe that found the caps `Q1`-`Q4`, the jacket's second pass, the car), `final/` (every ticket's after shot, a broadcast sweep of the celebration `W-tv-*`, the stands `V-*`, the TV center shot and the counts), `final2/` (the last: every ticket's after shot again with the flag and the families in, the TV center shot, the counts).
- The job generator is `mkjob.mjs` in this session's scratchpad (`fr1/`), with the Node timeline checks beside it (`cel.mjs`, `mvp.mjs`) and the probes (`probe.js`, `stack.py`).

**References:** all local, nothing new downloaded: `.claude/ref/rituals/` (Getty 83570999, 83571356, 83486403, 83486314, 83486297, 83483743, 83571213, 83486425, 83487707, 88457361, 83458679; Flickr ronniebruce 2988347232, 2988348008, 2987489493, puffygreenjacket 2993502271, 2993510687, pompomflipflop 2985514327, johnpaulendicott 3001393534, anthonydefrancesco 2986359720; the FOX storyboards 1yP3u4ik2gs and U_R8E614TB8) and `.claude/ref/gauntlet/play/` (FOX t16330s, the pile from high first at ~20 s).

## The replay's clock

Untouched. `director.duration` is 3785.503 before and after (checked in Node after every Celebration change); the celebrate segment still starts at 3485.503 and runs 300 s. Everything added is a function of the time since the last out, and the radio's `director.t` is never touched.

## Per ticket

### 1. The presentation faces the crowd: done
- **Why:** `STAGE.point`'s front (+lz) faces the plate and the first base stands, but the men on it (`Celebration.js presentation`, `yaw: S.yaw`) and the party (`Party.js`, `yaw = S.yaw`) faced −z turned by the stage's yaw: out to right-center, their backs to the crowd and to high home, Howard lifting the trophy to the outfield.
- **The fix:** `STAGE.face = STAGE.yaw + π` for everyone standing on it (Manuel, the six players, the party); the trophy's and the hands' hand-offs come out of each man's own yaw, so they turned with him (checked: Montgomery's hold, Gillick's, Howard's `trophyHold`).
- **Who stands where, as the photos have it** (Getty 83570999, 83571356; ronniebruce 2988347232): left to right as you face it, Giles, Montgomery by the trophy's pedestal, Selig, Zelasko with Gillick (now in his tan coat) behind her, Manuel; Myers at the right-hand end. When the players come up (CEL.up − 3) the suits step back to the rail and FOX's two go to the right-hand end; Manuel steps back too. Howard is in the middle at the front with the trophy (ronniebruce 2987489493), the other five round him.
- **The stairs** were at the right-hand end, by the car. Both photos have them at the left-hand end by the pedestal, with handrails both sides, the far end railed and the Camaro beside it: `STAGE.stairs` (one place: the climb, the descent, the party's legs, the lap's start), the stage's rails and stairs mirrored in `Stage.js`.
- **The broadcast** (`BallparkApp._celebrateCut`, one marked FR1 block): FB2 had put the close shots on the center field camera because it saw the faces; now the faces are on the other side, so Manuel, Hamels, Howard and the trophy are from high home (16° off their line), and the stage between from high third.
- **Before / after:** `before/P04-stage-front-158`, `P05-stage-front-193` (backs), `P06-high-home-193`, `P02-tv-trophy-193` against `after2/P05`, `P06`, `P02` and `final/P05-stage-front-193`, `final/W-tv-189`, `W-tv-197`: faces, the trophy raised to the stands.

### 2. C2B-21, the pile at 8 s and the caps in the air: done
- **The press** (`Press.js`): FOX's handhelds and the boom out of the wells at 9-13 s, the photographers in a stream from 12 s over the next forty (`12 + 38·h^1.3`): none at 8 s, four or five photographers and the three TV men at 20 s (FOX t16330s; puffygreenjacket 2993510687 at ~20 s: "the first photographers arriving on the grass"), the crush building as the pile comes apart. A late one shoots what's left of the pile for a moment before going after his man (no jump to his subject on arrival).
- **The Phanatic** (`phanatic/Night.js`, one marked FR1 block, outside my files): on his feet on the steps behind the dugout for 8 s, then over the roof: at the pile ~16 s, not 8 (Getty 83486412 has him sprinting across the grass with the fireworks' smoke still up; the FOX high first frame at ~20 s doesn't have him yet).
- **The "thrown caps hanging in the air":** they were never thrown. Found by elimination (`before/X0`-`X7`: only hiding Cast's pool removed them; `after2/Z-*`: troupe 8 of 15, the press, and only its near figure; `after3/Q1`-`Q4`: with the press's hats taken off they're gone): **Cast's backwards cap (`HAT.capBack`) draws a metre or two off its wearer's head on the near figure**, so the press's backwards caps floated over the pile, in front of the out-of-town board and over the stage. The draw is Cast.js's (FP2's file now), so I didn't touch it: the press wear their caps forward (its share went to the black caps; the rng's sequence is unchanged). **For FP2 / the merger:** any other troupe's `capBack` near a camera will do the same (the vertex mirror at Cast.js ~1330 is applied to the crown and brim of every figure; something in the near figure's skinning of them goes wrong).
- **Before / after:** `before/L01-tv-pile-8s`, `L02-high1-pile-20s`, `X0-caps-base` against `after2/L01`, `L02`, `final/Q1-b14-caps`, `final/W-tv-003`, `W-tv-012`, `W-tv-025`.

### 3. Manuel's jacket and the dugout jackets: done
- **The balloon** (`Players.js`): the `jacket` role pushed the trunk out 1.3 cm along the normals on top of a big man's girth and was kept out of FB2's hull. Now the jacket goes through the hull a size up (+1.4 cm across, +1.2 cm deep, the cloth 1.3 cm), falls straight past the belt to a knit hem at the hip (it stopped at the belt, the belt showing under it), its sides clamped to the chest's width (a big belly fills its front, not its sides: it was wider at the belly than at the shoulders) and its back hanging over the seat; the sleeves stand off 7 mm, not 1.3 cm on top of the jersey's.
- **The 2008 jacket** (Getty 83483743, 83570999): the royal-blue band in the knit collar, the blue panel down the underside of the sleeve and on down the side to the hem, the white script edged in royal blue with blue stars (the Rays' navy jacket gets Columbia blue the same way).
- **The benches** (`FieldFigures.js`, one marked block, outside my files): the white chest band is now the "Phillies" script, white edged in blue, rising across the chest, and the blue collar; placed by how far up the trunk it is (the trunk's tubes now carry it in their part's fraction), so it sits on the chest seated, leaning or standing (the old band was placed by height and missed every seated man).
- **Also, on the way:** the champions tee's P was mirrored (it read as a 9: `final/N09`), now the right way round; the black champions cap has a round red, white and navy emblem (CHAMPIONS, the P, a 2008 ribbon) in its own atlas cell (119) in place of the everyday white P.
- **Before / after:** `before/J01`, `J02`, `J05` against `final/J01-manuel-stage-front-158`, `J02`, `J07-manuel-front-60`, `J05-bench-1b-29-close`.
- **Left:** Manuel is still a big man in a big jacket (his girth); the jacket has no folds of its own.

### 4. Wave 3's leftovers: partly
- **Done: the MVP at the car** (Getty 83486314; FOX's Chevy MVP frames): Selig and Myers come down the stairs (behind the others, not across Manuel's interview), Selig takes the silver MVP trophy (a new prop, `Stage.js mvpTrophy`) off the Camaro's hood, Hamels comes in from the crowd, Chevrolet's man (unnamed) waits by the car from when it's parked; they stand in a row in front of its nose facing the plate. Selig hands it over at 171 s; it's Hamels's from then on (`Celebration.mvpHold`): at his chest, up in his fist on the stage, round the lap. The TV's MVP close-up (high home) sees all four.
- **Done: the Camaro's greenhouse** lofted (raked windshield, the low roof in body colour with its sunroof, the fast back glass): it was a black box with a red slab on it in the MVP close-ups.
- **Done: the leis** (`rituals/Leis.js`): purple orchid leis on Victorino (two), Lidge, Rollins, Werth and Ruiz from 178-190 s, by the time they're up on the stage (puffygreenjacket 2993502271 at ~10:18; pompomflipflop 2985514327; Getty 83487707). One instanced draw per shape, each on its wearer's torso bone (the rig's skinning matrix, read as the mesh is drawn). `final2/W-tv-197`, `W-tv-230`, `N08`. Left: in a close-up from behind they still dip into the tee over the shoulders.
- **Done: the streamers** (`rituals/Streamers.js`): long white crepe streamers bunched on the right field grass behind the stage and in left, red scraps on the track (Getty 83570999). One static mesh, shown from 4 s after the out.
- **Done: the families** (`rituals/Families.js`): out of the dugout after the presentation, a wife and three kids round Moyer at the rubber (Getty 83571213), a wife in a knitted scarf with a little boy by Bruntlett, a young mother and a boy by Eyre (johnpaulendicott 3001393534; Getty 83486425). Unnamed, plain looks; logged in CAST.md.
- **Not done: the tarp roll's route on the 27th.** What the photos say: the roll stood on the track by the left field pole (Getty 88457361), was pushed off it onto the grass laying a silver strip behind it (FOX U_R8E614TB8, 2h52m30, frames 7-9), then along the outfield edge of the infield dirt behind short and second toward the first base side, the strip behind it (2h54m00, frames 1-3; Getty 83458679, the strip on the dirt side), and the crew then pulled the strip's edge across the infield (modelled). Ours swings from the wall to lie along the sheet's left field edge and peels the sheet off it. Doing it properly means the sheet unfolding in two stages in `Details2008.setTarp` as well as `TarpPlan.rollAxis`; left for the next fixer.
- **Not done:** champagne on the fans (Jenkins, ~10:40+: past our five minutes), the crowd's camera flashes (Crowd.js, FP2's), the clubhouse men handing out the tees and caps.

### 5. Watching it through: what I fixed, what's next
- Watched through the broadcast (`final/W-tv-*`, every ~10-30 s from 3 to 295 s) and from the stands (`final/V-stands-*`) against the photos. The most glaring things I found and fixed on the way: the faces (ticket 1), the floating caps (ticket 2), the tee's mirrored P, the everyday P on the champions caps, the MVP on nobody's spot (Hamels in the crowd for "his" close-up), the Camaro's box cabin, the players gathered with nothing on (no leis), the empty grass behind the stage.
- **Then the next most glaring: the lap's flag** (`rituals/Flag.js`). On TV for a minute and a half it was a small "Phillies" script pennant with a white and blue band down the hoist (`final/W-tv-240`). Getty 83570906 has the big one: Phillies red edged in navy, 2008 in big white numerals, the small World Series mark by the fly, about 2.6 × 1.6 m (it takes Myers on the pole and a teammate on its far corner). Now that (`final2/W-tv-230`, `W-tv-245`, `N12-flag-lap-side-235`).
- **And the streamers** came out grey: wound face down, the double-sided material lit them from underneath; wound up now (`final2/N05`).
- The last job, `final2/`, re-takes every ticket's after shot with all of it in.

## The counts

`JSON.stringify( __app.engine.meshRenderer.stats )`, full park, 1280 × 800, not profiled; each read in the shot after the view (so it's that view's).

| View | Before (`before/`, the first job) | After (`final2/`, the last job) |
|---|---|---|
| TV center, the last pitch (3480.9) | FB2's: 472 draws, 4,067,584 triangles, 714 pipelines | 472 draws, 4,167,848 triangles, 721 pipelines |
| TV, the pile at 8 s | 438 draws, 4,216,415 triangles, 715 pipelines | 437 draws, 4,134,415 triangles, 721 pipelines |
| TV, Manuel's interview (158 s; 160 s after) | 451 draws, 4,307,021 triangles | 452 draws, 3,463,824 triangles |
| TV, the trophy (193 s; 189-197 s after) | 455 draws, 4,294,349 triangles | 451-453 draws, 3.48-3.49 M triangles |
| The stage from in front, 193 s | 553 draws, 5,371,446 triangles | 562 draws, 5,363,598 triangles |
| The 1B stands, 245 s (the stands' heaviest view) | (not shot) | 746 draws, 7,210,245 triangles |

- **TV center** is the same 472 draws; its triangles are within the crowd LOD's carry-over FB2 noted (+0.1 M). +6-7 pipelines: the new materials (the leis, the streamers, the MVP trophy's silver and band, the flag's cloth unchanged).
- **The presentation on TV** is about 0.8 M triangles lighter: its close shots are from high home now (the center field camera's long view took in the outfield stands behind).
- **The stage view** +9 draws while it's all up: the leis (2, instanced), the streamers (1), the MVP trophy (2), the families and Chevrolet's man (in Cast's pool, no new draw). The Camaro's greenhouse goes into the glass's merged mesh (no new draw).
- **CPU, per frame:** the leis copy at most six matrices out of the rig's bones (as the mesh is drawn); the families' troupe (8) and the party's new man step only from 210 s and 114 s; Party's descent and Press's new timing are a few lines of arithmetic. Nothing outside the celebration. The Director's pose of the celebration in Node is unchanged within noise (0.3-0.8 ms per pose call, as before).
- **GPU:** the jacket's hull runs only for jacket wearers (the coaches and the pen, up to ~12 in the celebration) and is a few ALU ops; FieldFigures' script a few ops on the benches' chests.

## For the merger

- **Files:** `game/Celebration.js` (STAGE.face, STAGE.stairs, MVP, mvpHold, the presentation's spots), `places/Rituals.js`, `places/rituals/Party.js`, `Press.js`, `Stage.js`, new `Leis.js`, `Streamers.js`, `Families.js`; `game/Players.js` (the jacket's hull and look, the tee's P, the champions cap's emblem; all marked FR1); and outside my list, each in one marked block: `BallparkApp.js` (`_celebrateCut`'s presentation shots: FB2's block, camera changed), `FieldFigures.js` (the benches' script: the trunk tubes' part fraction, the shader), `places/phanatic/Night.js` (the Phanatic's 8 s on the steps).
- **The replay's clock** is untouched (3785.503).
- **`Players.js` atlas cell 119** is now the champions cap's emblem (cells 96-119 were free; the backs use 0-95).
- **FieldFigures' `aPart`** now carries a fraction (0.05-0.85) on the trunk's vertices: `i32( vPart + 0.01 )` still gives the part; anything comparing `aPart` to a whole number should floor it (the jacket's puff did, `< 0.5`, now `< 0.95`).
- **Cast's backwards cap** (`HAT.capBack`) on the near figure draws off the head: the press no longer wears it; the bug is Cast.js's.

## Noticed elsewhere

- **Cast's backwards cap** (`HAT.capBack`, Cast.js ~1330 and the near figure's skinning): its crown and brim draw a metre or two off the wearer's head on the near figure. The press no longer wear it; any other troupe's does the same near a camera (FP2's file).
- **The lap's players don't hold the flag's far corner** (Getty 83570906: a teammate runs with it); the flag's fly streams free.
- **Manuel is still very broad** in close-up (girth 1.2 and belly 0.75 in Looks.js, over a 6'3" frame): the jacket now hangs right, but he reads 10-15 % wider than in Getty 83570999. A look question (Looks.js), not the jacket's.
- **The crowd before the stage all face it**: in the photos the front of the stage is a crush of photographers and TV cameras with the players more to its sides; ours put the players squarely in front and the press among them. Their backs fill the bottom of high home's presentation shots.
- **The champions tee's print** is a P roundel over two bars; the real one was the "World Series Champions 2008" mark with the P over it (pompomflipflop 2985494275). R's block in Players.js.
- **The tarp roll's route on the 27th** (above, ticket 4): the photos' sequence is clear enough to model now.
- **Selig, Myers and Chevrolet's man** stay by the car to the end; in the photos they'd be gone once the MVP was done (no photo either way).
