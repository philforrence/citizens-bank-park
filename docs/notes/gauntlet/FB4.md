# FB4, round 4: the broadcast and the night's rituals (critic C4B's tickets)

Fixer FB4, 2026-10-28, branch `worktree-agent-a1e8cc35a677d2a8e` (off `ballpark` at d369a1b, FX1's merge). Tickets: C4B-1 to C4B-13 from `.claude/gauntlet/r4/C4B.md`, all of them taken on. Five desk jobs, all on the full park (no `only=`) at 1280 × 800, no console errors in any: `b0` (before, on a copy of the base: `scratchpad/fb4/base`), `a1`, `a2`, `a3`, `final`.

**Shots** (main checkout, `.claude/gauntlet/r4/FB4/<job>/`), with 2 × 2 contact sheets and crops beside them (`sheet_*.jpg`, `crop_*.jpg`). The job generator is `/private/tmp/claude-501/-Users-phillipforrence-Documents-HomeKit/4f4e82b4-ef9f-4fa0-a3f9-d023a05012fe/scratchpad/fb4/mkjob.mjs` (each job's JSON beside it: `b0.json` ... `final.json`); the Node checks in `scratchpad/fb4/node/`: `press.mjs` (the press through the presentation: anyone in the deck's footprint, the fastest step), `bench.mjs` (who's out of the dugout second by second after strike three, any man jumping, the clock), `walkups.mjs` (the low camera's line through all 75 walk-ups, the base's cut against FB4's), `susp.mjs` (FR2's: the crew frame by frame through the suspension), `who.mjs`, `subj.mjs`, `segs.mjs`; `stub.mjs` lets Cast build in Node (a do-nothing canvas and GPU device).

**Before:** C4B's own shots (`.claude/gauntlet/r4/C4B/j1..j3/`, on 73a22e2: the same code as my base for every ticket but C4B-3, which FX1 changed after them) and `b0/` (the views C4B didn't shoot, and C4B-3 after FX1).

**References:** C4B's, all local, nothing new downloaded: `.claude/ref/rituals/` (Getty 83570999, 83486175, 83458151, 83458153, 88457361, 83458220, 84081825, 83824977, 83824985, 83486314, 83570904; flickr puffygreenjacket 2994338984, johnpaulendicott 2987133943, garrettfield 2988061976, bub56 2994749367, ronniebruce 2988348008; FOX US 1yP3u4ik2gs sheets 125, 128-131 and its open; the world feed's 2:52:30), `.claude/ref/home/` (Getty 84081866), `.claude/ref/gauntlet/bowl/` (Getty 84080911).

## The replay's clock

Untouched. `director.duration` is 3785.503 and all 504 segment starts hash the same as FR2's and FX1's (801248349), checked in Node after every Celebration, Suspension and TarpPlan change (`bench.mjs`, `susp.mjs`). Nothing moved the radio's `director.t`. Strike three is at 3481.903, the celebrate segment at 3485.503.

## Per ticket

### C4B-1 The photographers inside the stage: done
- **Why:** `Press.js` sent each photographer after his man at y 0; when the men went up on the deck (Manuel at 147 s, the players at 184) the follow point fell in the deck's footprint. In Node on the base, someone stood in the footprint in 21,579 of the 4,800 × 26 person-frames from 100 to 260 s (11 at 170-180 s).
- **Now** (`places/rituals/Press.js`, one FB4 block): when his man is up (`a.y`) or the place he'd shoot from is within 0.6-1.2 m of the deck, he works from the pit along its front: two rows pressed against it (0.4 and 0.95 m out), the left end left clear for the way to the stairs, the players' crowd behind; crouchers stand up there, heads tipped up. He walks to the pit, and to any new place, at a hurried walk (3.2 m/s, at once after a seek), and nobody's ever placed on the deck (round its edge). That smoothing also cures the base's teleports: when a man turned round (the gather at 120-124 s) his photographers jumped 4-9 m in a frame (200 steps faster than 7 m/s in Node; none now, the fastest 5.1 m/s).
- **Before / after:** C4B's `j1/D-cel-192`, `crops/D-cel-192-deck.jpg` (a head through the deck by Howard's leg) and `b0/A-tv-192` against `a1/A-tv-192`, `final/Z-tv-192`: Howard with the trophy up over a row of long lenses held up at the stage's front, as Getty 83570999 and puffygreenjacket 2994338984 have the press. The probe (`STAGE_IN` in the job's js) finds nobody in the footprint at 186 and 192 s (11 and 6 before).

### C4B-3 Nobody out of the dugout for 5.5 s: done
- **Now** (`game/Celebration.js`, FB4 blocks in `plan()`, `showLastOut`, `evalSteps`, `showCelebration`): the bench, Moyer, the coaches and the pen are on the strike's clock (`field`, as FB3 put the fielders). From strike three the bench, Moyer and the dugout coaches are the rig's men at the dugout's rail on the upper step (a metre apart along the covered stretch, where FieldLevel's figures were until FX1 hid them at the strike), the players jumping, the coaches applauding; 0.3-1.6 s after it (Moyer 1.1, the coaches 1.6-4.0, Manuel walking out at 4.5) they go over the rail (a new step kind, `vault`: up off the step, knees up, over, down onto the grass) and across at a sprint. 75% of the bench players in the red pullover (`ROLE.jacket`, swapped for the champions tee at `tChamps` like the rest: `info.bench`), as Getty 83486175 has them. The pen comes out of its gate 0.8-2.4 s after the strike (its figures go at the strike: FR2's `alley/Night.js`). `showLastOut` now passes the staff's `who` and the jackets, so the rig's slots are made with them.
- **And** the ring and the backs ran to `approach`, a metre outside their place, and stood at their place the next frame (a metre's jump for 20 men at 10-30 s): they run to their place now (the divers still leap from `approach`).
- **Node** (`bench.mjs`): Phillies off the bench out of the dugout: 0 at 1-5 s before; now 17 at the rail at 0.2 s, 11 on the grass at 1.5 s, 17 by 2 s, 22 by 3 s; at the pile 5 at 5 s, 10 at 6 s, 16 at 10 s (C4B asked for 15 by 7 s: they're 28 m away at 6.8 m/s, so the bench lands at 5-6.5 s and the pen and the coaches later). The only jump left over 18 m/s is the Rays' Perez at 2.4 s (the result segment's start: the Director's, not mine; below).
- **Before / after:** `b0/sheet_last.jpg` and `sheet_bench.jpg` against `a1/sheet_dugout.jpg` (from the grass at 0.4, 1.0, 1.6, 2.4 s: the rail packed, then over it and pouring across the grass in red jackets and pinstripes, as Getty 83486175), `a1/sheet_last.jpg` and `final/B-last-tv-s5.6`, `s7` (the center field camera widening on a pile growing with red jackets; it was six men and the umpire).

### C4B-2 The walk-ups back on the high cameras: done
- **The cut** (`BallparkApp._directorCut`, `walkup`, one FB4 block): until the low camera's line to the hitter is first clear the wide holds, up to 3.4 s in; from then the low camera's his (and given up as before if someone walks in later). It latched the first block for the whole walk-up.
- **The boy** (`places/rail/OnDeck.js`, FB4 blocks): out for the bat once the ball's away from the plate (the in-play's start + 2.6 s) unless a runner's coming home; at a hustle (4.6 m/s out, 4.0 back); round behind the plate umpire (`_via`, z 3.4) out and back. He'd left at the result + 0.6 s and was at the bat 1.6-2.9 s into the next walk-up, on the line.
- **Node** (`walkups.mjs`, the Director's actors, the bat boys posed by OnDeck; the rail's figures aren't in Node): of 75 walk-ups, the base's cut kept the low camera on 18; the boy's new trip alone makes it 29, the wait alone 69, both 74. Live on the desk (`a1/`, `final/` values): Utley 730.9 and Rollins 1349.6 `low3:close` from lt 1.06 to the end (both `high3:close` throughout before), Crawford `low1:close`; seeked: 733.6, 1352.2, 2950.2 low, 1605.1 high first (a rail figure, I'd guess).
- **Before / after:** C4B's `j1/S029-t733.6`, `S054-t1355.2` (helmets from 50 m up) against `a1/sheet_walkups.jpg` (faces, walking up to the plate). The catcher crouches beside the hitter in the low third frames: that's the shot.

### C4B-5 The pull: partly
- **The sheet** (`Details2008.js`, the sheet's vertex stage, one FB4 block): the top layer's pulled-out part placed by its distance behind the free edge (`dE`): the edge at the crew's hips (`TarpPlan.EDGE_UP` 0.78 m), sagging 9% between hands 2.2 m apart, then a hump up steeply to its crest 1.8 m back (steeper than the high cameras look down, so the black underside faces them under the edge), a long tail and a lower billow over the whole run, and waves rolling back along it as they walk; the normal from the profile's slope, and the billows' lee sides a shade darker (in the vertex colour's blue: white vinyl under six banks and its night emissive read flat). FR2's lift was the last 2.6 m of vinyl sloping up to the edge, so from above it was a thin black line on the grass; its billow 0.16-0.3 m.
- **The plan** (`game/TarpPlan.js`): the edge let down over the last 7% of the pull instead of dropped in a frame (`edgeY` 0.75 → 0.05 at kp = 1).
- **The crew** (`game/Suspension.js` `puller`, FB4 block): 0.42 m ahead of the edge (`PULL_OFF`, was 0.9 with the hands 0.65 m short of it), hands back on the hem at its height, leaning into it each his own lean; facing the edge while they hold it up waiting (`runTo`'s hold faced away from it, the hands in front of him) and turned round over the pull's first 0.7 s. `edgeStart` and the end of the pull follow (no jumps: `susp.mjs`).
- **Before / after:** C4B's `crops/T27-u39-edge.jpg`, `T27-u44-edge.jpg`, `b0/D-pull-tv-u44` against `a3/crop_pull_39.jpg` (the edge up in their hands, the black underside and the white tabs showing under it, the men right at it), `final/D-pull-tv-u39`, `u44`, `D-pull-g83458151-u42` and `crop_pull_g.jpg`.
- **What's left (why partly):** the men are at the edge with their hands on it and it's up, and from high home the underside shows under it; but from high first (u 44) and from 83458151's angle the band of underside is a few pixels and the balloon behind them reads only faintly, where Getty's is a metre-high wall of white with the black hem and underside a broad band under it. The hump would want to be steeper and higher still (or the camera lower: the photo's from the field level's front rows), and the sheet's night emissive flattens its shading. No straps over the shoulders.

### C4B-4 The roll crew: done (one marked block in `Players.js`)
- **The men** (`game/Suspension.js`): not evenly spaced (±0.25 m along the roll), each his own distance back from it (0.45-0.69 m) and his own way of pushing (`pushStyle`): 60% bent over it with both hands, deeper or shallower; a quarter upright with the right hand on it, the left at his side; the rest down low with a shoulder to it; a look along the line now and then. Their heights 5'7" to 6'4" and builds slight to stout (`game/Looks.js`, the seeded look for anyone unnamed: was 0.93-1.03 and 0.95-1.15).
- **The look** (`game/Players.js`, three marked FB4 lines in the body's fragment stage; FW4's / the people track's file): the crew's hood a soft cotton (roughness 0.8, was 0.25), and soaked through like cotton, darker with a dull sheen (rough toward 0.5, colour × 0.72; it went to 0.12, a slicker's gloss: the glossy red domes); the club's script on the hoodie's chest (the players' jacket cell, `C.jacketHome`; the crew's jackets were blank). The hood's shape (a shell over the head) is the rig's: not changed.
- **Before / after:** C4B's `crops/T27-u11.3-crew.jpg` and `a2/K-roll-tv-u10.5` (a drill line of glossy domes) against `a3/crop_crew_u11.3.jpg`, `a3/sheet_crew.jpg`, `final/E-crew-*`.

### C4B-6 The 29th's tarp at 7:45 pm: done
- **Now** (`game/TarpPlan.js` `TARP_ON_29 = false`; FR2's T29 kept behind it): the 29th's part opens with the tarp stowed. The crew (`Suspension.js` `night29`, FB4 block; `work()` takes a start already at the job and a time to stop): ten of them at their jobs on the skin as it opens, the hoses on the clay behind the bags (Getty 83824977, 83824985), the rakes, the tampers, the drags round the arc, done by 13-17 s and off by the song; the liner out at 4 s (it waited for the tarp off the plate at 25). The cut (`_suspensionCut`, FB4 block): the bowl filling, the hoses from high third, the skin being groomed from high home.
- **Before / after:** C4B's `j1/B-susp-2234-u91` ... `u109`, `j2/T29-*` against `a2/F-29-tv-*` (the overlay's on those: `clean: false`), `a3/F-29-tv-u10`, `final/F-29-tv-u10`, `u17`.

### C4B-7 God Bless America on the dugout: done
- **The cut** (`_suspensionCut`, FB4 block): through the song (`G29.gba`) the park standing (the high wide), then the singer behind the plate from center field, the flag behind the camera; the Phillies' dugout after it from low third (high third if blocked), then the pens and the bowl as before. FOX didn't air the song; this is what their cameras had.
- **The rail** (`FieldLevel.js`, FB4 blocks): ten more Phillies at the rail on the 29th (a `phiRail29` group in FieldFigures' instanced poses, shown from the split on and hidden at the celebration), leaning on it and hands on it, eight in the red pullovers and two in the whites.
- **Left:** caps off for the song and the hoods: FieldFigures has no cap-off or hood pose.
- **After:** `a2/F-29-tv-u28` (high wide), `final/F-29-tv-u33` (`center:suspsinger`), `a3/F-29-tv-u39` (high third: the crew walking off crossed low third's line) and `final/F-29-tv-u39` (low third, once the crew were off by the song: the rail packed with red pullovers and a couple of the whites, as FOX US's open).

### C4B-8 The plate puddle from high first: done
- `Field.js`, FB4 lines: the puddle's specular held to 22% but for small rain-broken specks (up to 62%, roughness 0.18; the rest 0.34): `s.specularIntensity`, which lowers the grazing Fresnel too (at 70° from the normal it was the whole puddle); its edge feathered (smoothstep 0.6-0.8, was 0.66-0.74, the white pool's hard outline); the soaked clay's specular × 0.55 at full wet.
- **Before / after:** `b0/H-puddle-look` (a white pool with a hard edge) against `a3/H-puddle-look` (glints, but a bright crackle of them, so I made them fewer and smaller) and `final/H-puddle-look` (dark muddy water with fine glints), `final/H-puddle-tv`.

### C4B-9 The field level's tunnel portals: done (one marked block in `Bowl.js`)
- `Bowl.js`: the field level tier's `portals` taken out (commented, in an FB4 block); `Stands.js` seats those rows and the crowd fills them (nothing else read the field level's portals; `home/Seats.js` handles a tier without). The 400s' are FW3's stairs and stay.
- **Before / after:** C4B's `j3/P-portal-grass-on`, `crops/portal_on_off.jpg` against `a3/P-portal-grass`, `final/P-portal-grass`, `P-portal-tv-u61`.

### C4B-10 The presentation and the MVP from high home: done
- `BallparkApp._celebrateCut` (FB4 block) and `_handheld` (new options: the lens's height, the side to try first, the tries round it): Manuel's interview and Howard's trophy from a riser at the stage's foot, 6.2 m out, 2.75 m up, over the heads of the crowd in front (the press's long lenses in the bottom of the frame); the MVP from a handheld on the clay in front of the four of them, 4.2 m, 1.6 m up; each held for its whole time; high home if the lens is blocked.
- **Before / after:** C4B's `crops/ours_interviews.jpg` against `crops/fox_interviews.jpg`, and `a3/sheet_pres.jpg`, `final/C-pres-tv-158`, `172`, `192`: Manuel with the microphone beside Zelasko, the trophy on its pedestal; Selig, Hamels with the MVP trophy, Myers and Chevrolet's man; Howard with the trophy up over the lenses.
- **Left:** the party's faces and coats are Cast's (the people track's).

### C4B-11 The Camaro: done but the body's lines
- `places/rituals/Stage.js` `camaro()` (FB4 blocks): glass that catches the stands' glow at a slant (a Fresnel sheen in its emissive by night; it was 0.02 grey, a black slab); the B-pillar across the side glass; the wheels out flush with the body in dark arches, silver five-spoke rims standing out from the tyres, brushed (metalness 0.55 with a night lift: full metal mirrored the dark and read black), a hub; the quad lamps, the black grille slot, the intake, the bow-tie. All in its baked meshes' four materials (no new draw).
- **Not done:** the body's shoulder crease and the hood's bulge (the loft's eight-point rings).
- **Before / after:** C4B's `j1/D-cel-168`, `crops/ours_interviews.jpg` (right) against `a3/C-camaro` (lamps, grille and glass right, the rims still black there) and `final/C-camaro` (the rims silver).

### C4B-12 The roll shot opening on the 3B stands: done
- `_suspensionCut` (FB4 line): u 7-9.5 on the roll off the wall from high home (high first, then the wide, if blocked); high third from 9.5. `a2/K-roll-tv-u7.5`, `u8.5` (`high:susproll0`), `final/K-roll-tv-u8.5`.

### C4B-13 The Phanatic's banner: done
- `places/phanatic/Props.js`: printed through (the back face samples u flipped, as FB3's `Flag.js`). `final/C-banner-tv-108`.

## The counts

`JSON.stringify( __app.engine.meshRenderer.stats )`, full park, 1280 × 800, not profiled; read in the shot's own js after 24 still frames of its view.

| View | Before (`b0/`, the base) | After |
|---|---|---|
| TV center (play 20) | 496 draws, 3,422,744 triangles, 767 pipelines | 495 draws, 3,468,994, 767 pipelines (`final/Z-center`) |
| The celebration's high home wide (108 s), the heaviest TV view | 821 draws, 3,879,722 | 821 draws, 3,898,830 (`final/C-banner-tv-108`; `a3/` 3,888,882) |
| The trophy (192 s) | high home tight: 487 draws, 2,761,679 | the riser: 548 draws, 5,210,385 (`final/Z-tv-192`) |

- **TV center:** −1 draw, +46k triangles (1.3%): the field level's reclaimed rows are fans now (the crowd's instanced chunks), within the LOD's carry-over FB2 noted (±0.1 M). Pipelines unchanged (the changed shaders replace their old ones).
- **The celebration's high home wide:** the same draws, +19k triangles (the reclaimed seats, the Camaro's wheels and front).
- **The trophy from the riser** is a different picture: eye level, so the near Cast figures (the press in the pit, the crowd) and more of the stands: +61 draws, +2.45 M triangles over high home's tight. C4B measured FB3's pile handheld at 728-749 draws and 3.6-5.4 M, so it's inside the envelope in draws and near its top in triangles.

## For the merger

- **Files:** `places/rituals/Press.js`; `game/Celebration.js` (`plan()`'s bench, pen, staff and their `rail`/`out`/`jacket`; the `vault` step; `showLastOut` passes `who` and jackets; `bench` and the tee; the ring and the backs run to their place; `DUGOUTS` imported from `layout.js`); `places/rail/OnDeck.js` (`_via`, `_route`, `_along`, the fetch's start, the pace); `BallparkApp.js` (the walk-up's wait `_wuWait`, `_suspensionCut`'s 27th roll shot and its 29th part, `_celebrateCut`'s presentation, `_handheld( tag, aim, half, r, o )`, imports `TARP_ON_29`, `G29` from `Suspension.js`, `MVP`); `game/TarpPlan.js` (`EDGE_UP`, `TARP_ON_29`); `game/Suspension.js` (`CREW`'s `v` jitter, `back`, `style`; `pushStyle`; `puller`; `PULL_OFF`; `night29`'s no-tarp branch; `work( ..., until )`; the liner's start); `Details2008.js` (the sheet's vertex stage: `tarpProfile`, the lee shading in `v.color.b`); `FieldLevel.js` (`phiRail29`); `Field.js` (the puddle, the wet clay); `places/rituals/Stage.js` (`camaro()`); `places/phanatic/Props.js`.
- **Outside my files, marked FB4:** `game/Players.js` (three lines in the body's fragment stage: the crew's chest script, the hood's roughness, the crew's soak: the people track's / SP3's file); `game/Looks.js` was in my list (the unnamed's height and girth spread: it touches every seeded look, the crew and anyone else on the rig without notes); `Bowl.js` (one block: the field level's `portals` out; FC4 is on the RF foul pole's wedge in the same file).
- **`TarpPlan.TARP_ON_29`** (false): the 29th's tarp coming off (FR2's T29) is behind it; `tarpState` returns the stowed state from the split. Suspension's and the cut's 29th branches follow it.
- **The celebration's bench and pen are on the strike's clock now** (`field` on everyone in the plan), so `showLastOut` poses them from strike three; anything that counted on the bench appearing at the celebrate segment's start (FieldLevel's figures, the pens) already switches at the strike (FX1, FR2).
- **`_handheld`** takes an options object (`y`, `a0`, `spread`); its callers without it are as before.
- **No new images, sounds or invented people** (CREDITS.md and CAST.md unchanged).

## The frame-rate risk

- **The celebration's high home wide** (the heaviest TV view): +0 draws, +9k triangles (the field level's reclaimed seats' fans, the Camaro's wheels and fronts). Nothing new there that isn't in an existing instanced draw or baked mesh.
- **The riser and the MVP handheld** (C4B-10) are eye-level views, so they take in more of the stands than high home's tight: 548 draws and 5.21 M triangles at the trophy (high home's tight was 487 and 2.76 M). The pile's handheld (FB3) was 693-749 draws, inside the envelope.
- **CPU:** the press's smoothing and pit test, a few dozen operations per photographer from the pile on; the walk-up's wait, one more `_lensBlocked` call a frame through a walk-up's first seconds; the bench, `pushStyle` and the puller, pose arithmetic for men posed before; the 29th's crew are fewer (ten, no tarp). In Node the suspension's pose call is as it was.
- **GPU:** the sheet's vertex stage evaluates its profile twice (for the slope) over its 6,300 vertices while it's out; the puddle and the clay two more mixes; the Camaro's glass and rims a few ALU each; the 29th has no sheet or roll. The field level's portals (two batched meshes) are gone and ~ their rows' seats are fans in the crowd's chunks.
- I'd watch the riser shots' draws if the coordinator's profile puts them near the floor: high home's tight on the stage is the fallback, one line each in `_celebrateCut`.

## Noticed elsewhere

- **The Rays' runner on second jumps 3.3 m at the result segment's start** after strike three (Perez at 2.4 s after the strike: the Director's pitch scene's lead against the result scene's start; `bench.mjs`). On TV center's push-in he's at the frame's edge. `game/Director.js`.
- **The Rays' base coaches and the umpires vanish at the celebrate segment's start** (3.6 s after the strike): `showCelebration` has the umpires walking off but they and the coaches are dropped from the actors for a frame or more (`who.mjs` at 4 s: the umpires are there, the coaches gone).
- **Moyer jumps 16 m at 141.2 s** of the celebration (`press.mjs`'s actor check: `r:moyer` 499 m/s for a frame), and the lap's men 1.3 m at 209-216 s and 0.5 m at 230-240 s: the presentation's steps (Celebration's `presentation()`, Moyer's dig and the lap's start). Worth a frame-by-frame look.
- **The walk-up's low third close-up** has the catcher crouched beside the hitter in the frame's lower half (`a1/W-seek-733.6`): right for the shot, but the guard's `near` 1.2 m keeps him in.
- **The hood** is still a shell over the head, not a soft hood round a face with a cap's brim under it: the rig's geometry (`Players.js`).
