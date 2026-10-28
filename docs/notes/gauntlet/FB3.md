# FB3, round 3: the broadcast where round 2's merges meet (critic C3B's tickets)

Fixer FB3, 2026-10-28, branch `worktree-agent-a9290d8a0a2a8c223` (off `ballpark` at 1ae8c75). Tickets: C3B-1 to C3B-18 from `.claude/gauntlet/r3/C3B.md`. Five desk jobs (`a1`, `a2`, `a3`, `final`, `final2`), all on the full park at 1280 × 800 (no `only=`), no console errors in any.

**Shots** (all in the main checkout, `.claude/gauntlet/r3/FB3/`):
- **Before:** C3B's own (`.claude/gauntlet/r3/C3B/j1..j3/`): job 3 ran on 1ae8c75, this branch's base, and jobs 1 and 2 on 1c01154, whose cuts, celebration and HUD are the same code.
- **After:** `a1/` (the first pass at every ticket), `a2/` (the celebration's group shots, the jersey, the lap probe), `a3/` (the throng, the jersey again, the lap's men found), `final/` (every ticket's after shot, the TV center shot, the counts), `final2/` (the last: the wet clay at the plate after its last change, the TV center shots on both nights, the celebration's high home wide with the throng, and the counts). Contact sheets beside them: `sheet_*.jpg`; side-by-sides `cmp_price2.jpg` (the jersey), `cmp_puddle.jpg`.
- The job generator is `/private/tmp/claude-501/-Users-phillipforrence-Documents-HomeKit/4f4e82b4-ef9f-4fa0-a3f9-d023a05012fe/scratchpad/fb3/mkjob.mjs` (the jobs themselves are beside the shots: `a1.json` ... `final2.json`) (each shot's recipe is its name and the job JSON); Node checks beside it: `lastout.mjs` (the clock, the last out frame by frame), `lap.mjs`, `lap2.mjs` (the lap's route), `segs.mjs`.

**References:** C3B's, all local: FOX US 1yP3u4ik2gs storyboards in `.claude/ref/rituals/` (sheet 125: the last out; 131: the presentation), the world feed U_R8E614TB8 in `.claude/ref/gauntlet/play/` (t11530s, t13150s, t16330s, t16340s) and `.claude/ref/rituals/` (3:03:00, the GAME SUSPENDED card; 2:03:00, RAIN DELAY), Getty 83570906, 83570999, 84081866. Nothing new downloaded.

## The replay's clock

Untouched. `director.duration` is 3785.503 before and after and every one of the 504 segments starts where it did (a hash of all the start times, checked in Node after each Director or Celebration change: `lastout.mjs`). What moved is what's shown inside them: from strike three (3481.903, the ball in Ruiz's mitt) the men on the field are posed from the celebration's plan through the last 2.4 s of the pitch segment and the 1.2 s result (C3B-1). The crowd's champions cue (`s.celebrate()`) moved from the celebrate segment's 0.3 s to the last pitch's segment at the strike + 0.15 s; the radio track isn't a cue and wasn't touched.

## Per ticket

### C3B-1 The last out: done
- **The kneel on time** (`Celebration.js showLastOut`, `fieldClock`; `Director.lastOut`, a hook in `pose()`): the men on the field at the last out (Lidge, Ruiz, Howard and the fielders: `info.field`) run on the strike's clock, `t - tStrike`, from strike three. The first 0.6 s are eased in from what the pitch had them doing (Lidge's follow-through, Ruiz's crouch, the fielders' ready), position, yaw and pose. In the celebrate segment their clock is `lt + 3.6 (1 - lt/40)`, back to the segment's by 40 s (9% slow in the pile, where nobody can tell), so the presentation and the lap are where they were. The bench, the pen, the coaches and Moyer stay on the segment's clock: their figures in the dugout (`FieldLevel.js`) and the pen (`alley/Pens.js`) are there till the celebrate segment starts, and moving them would mean two of each. Lidge is on his knees, arms up, 0.5 s after the strike; Ruiz there at 2.4 s; Howard over them at 3.3 s (was 3.6 s later each).
- **Ruiz** comes in on Lidge's left as the center field camera sees it and holds him facing him (he faced the plate, his back to Lidge).
- **The cut** (`BallparkApp._lastOutCut`): one shot from center field from the pitch to the pile. It holds FOX's framing through the pitch, then from 0.45 s after the strike pushes in over 1.3 s to Lidge kneeling (a picture 2.6 m tall: his knees at the bottom, the glove up near the top, Ruiz at the right edge: FOX US sheet 125, frame 2), and from 4.6 s widens to the pile; at the celebrate segment's 5 s the cut goes to high first on the pile, as before. It was a cut 1.4 s after the strike to a 1.5° close-up of the rubber (three quarters grass), then Lidge standing still.
- **The fireworks** (`Rituals.js`, marked) go up with the strike, not 3.6 s after.
- **Before / after:** C3B's `j2/B-lastout-3483.5`, `3484.2`, `3485`, `3486.5` against `final/A-lastout-s1.0` to `s8.6` (and `a1/A-lastout-front-s1.6`, `s3.0` from in front), beside FOX US sheet 125 frame 2 (`.claude/ref/rituals/youtube_1yP3u4ik2gs_storyboard_fox_last_out_pile_oct29.jpg`): the same shot, "54" on his knees from behind, arms up, the glove raised, Ruiz coming in at the right.

### C3B-2 The lap's last 20 s through the center field platform: done, and the real cause found
- **The camera:** `_celebrateCut`'s lap takes high home across center (|x| < 26, z < -90) and high third / high first either side; `fit()` never takes the center field camera on anything within 45 m of it or more than about 11° below it (it goes to high home).
- **The men behind the wall:** with the camera fixed the lap's last 20 s still showed only the padding, a police bike and a photographer (`a2/C-cel-272`, `C-cel-283`, `a3/L-near-283` from 30 m away). Celebration's `LAP` was hand-placed points joined by straight legs; the leg from [58, -84] to [44, -104] to [24, -116] cut behind the right-center wall (the fence is 110.5 m out at 23°, the point 112.9 m), so from about 270 s Myers, the flag and the men behind him walked behind it. Now the route is on the track, 2.7 m in from OUTFIELD's fence at every angle (`onTrack`).
- **Before / after:** C3B's `j2/C-cel-283`, `C-cel-292`, `j3/B-lap-281.5` against `final/C-cel-272`, `C-cel-283`, `C-cel-289`, `L-lap-near-283`.

### C3B-3 The presentation on an empty stage: done
- `CEL.party` 114 → 86: the 38 m walk from the first base side's gate puts them up from 120 to 125, all at the microphones when Selig starts at 126 (FOX US sheet 131). The MVP's walk down (CEL.mvp[0] - 12) and the step back (CEL.up - 3) are unchanged and still after it. The TV takes the party walking out from high third from 112 (`_partyAt`), and the stage tight only from 126.
- **Before / after:** C3B's `j2/D-stage-front-124`, `D-stage-front-129.4`, `j1/S120`, `j2/C-cel-130` against `final/D-stage-front-124`, `D-stage-front-129.4`, `C-cel-117`, `C-cel-128`.

### C3B-4 The pitcher close-ups aimed at the rubber: done
- `_directorCut`'s `close()` aims at the man's body (his pelvis from the pose, turned by his yaw and scaled by his height, lowered as far as his hips are), not his root, which stays on the rubber while the follow-through carries him a metre and more toward the plate. The pitcher's close-up is a little wider (half 0.85 m, was 0.72).
- **Before / after:** C3B's `j2/G-kclose-523.9`, `1408.9`, `1720.9`, `3232.4`, `j1/S007` against `a1/G-kclose-*` and `final/G-close-523.9`, `1720.9`: the man centred, head to the knees, in his fielding crouch.

### C3B-5 People in front of the low cameras in the celebration: done
- `fit()` asks the lens guard (below), and a shot given up stays given up for its slot. The pile's low-camera shots are now FOX's handhelds on the grass (`_handheld`, camera 'hand'): 4.8-5.2 m from the pile, on a man's shoulder, from the first side that's clear (the plate side first, the outfield's stands and the lights behind), nobody within a metre of the lens or in the first 2 m; picked when the slot starts, again if someone walks into it (twice at most), else the low camera if it's clear, else high. The hugs by the dugout get one too. FOX US sheet 125's frames 3-6 and 9 are these.
- The celebration's shots are named by their slot in the schedule, so a handheld or a given-up camera holds for its whole slot.
- **Before / after:** C3B's `j2/C-cel-013`, `C-cel-040`, `C-cel-058` against `final/C-cel-015`, `C-cel-036`, `C-cel-066` (and `a1/C-cel-015` to `C-cel-064`).

### C3B-6 The lens guard misses the field: done
- `_lensBlocked( e, at, skip, half, clear, near )` asks everyone near the field: the rail's figures, the Director's actors (players, coaches, umpires, the rituals' men; not the subject; 0.4 m round and as tall as he is now, so the catcher in his crouch is 1.4 m), the celebration's press, party, families and throng, and the Phanatic. Blocked if he's on the line anywhere short of the last 1.2 m (`near`: more for a group, where the people round it are the picture), or if he's in the picture at all while nearer than 60% of the way (from `half`, the picture's half-height at the subject). Once given up, a close-up stays given up for its segment (`_blockedOnce`). The runner at first falls back to high first when low first is blocked (FOX's usual angle on him).
- **Cost:** about 350 point-to-line tests per call, a few calls a frame: well under 0.1 ms.
- **Before / after:** C3B's `j1/S100`, `j2/E-1b-runner-3000.4` (the Rays' coach across Crawford) against `a1/E-1b-runner-3000.4`, `final/E-1b-runner-3000.4`.

### C3B-7 The bug: done
- `GameHUD._tvGraphics` (TV only; the walking panel is as it was): in a break, no count, 0 OUT, the man on the mound to the half's first batter (the walk-up before a pitching change had the new man pitching); the 27th's delay: RAIN DELAY · BOTTOM 6TH INNING (FOX US 2:03:00), then for its last 30% the line score card, TB 2 5 0 / PHI 2 4 1, GAME SUSPENDED (the world feed's card at 3:03:00; the numbers counted from the plays and checked against it); the 29th's part: the card again, the game resuming; from strike three FINAL in the tab, PHILLIES WIN THE WORLD SERIES, the bug gone once the pile's on (sheet 125: no bug after the out) and back on hover for the transport; the champions' lower third at 58-70 s (sheet 125, frame 8); the final line score card, 3 10 0 / 4 8 1 (counted from the plays, as `g.final` has them), at 236-250 s.
- **Before / after:** C3B's `crops/huds.png`, `j1/S064`, `S074`, `S089`, `S119` against `final/H-break-1925`, `H-walkup-change-2671.8`, `S-susp-2220`, `S-susp-2262`, `A-lastout-s2.2`, `C-cel-066`, `C-cel-240`.

### C3B-8 The suspension on one static wide: done
- `_suspensionCut`, a new shot every 8-12 s. The 27th: the wide as the crew run out; the roll swinging off the wall from high third, tight on it; the line of them walking the sheet's edge across from high home and high first; the fans in their ponchos from high first; PhanaVision with its suspension notice from high home; the first base stands emptying from high third; the covered field wide under the GAME SUSPENDED card. The 29th: the bowl filling from high first; the roll coming off; the wide; the Phillies' dugout from low third; the pens from high home (Balfour and Hickey walking in: the world feed's 3:08); the first base stands from high third; then the Phanatic and the wide to the walk-up.
- **Before / after:** C3B's `j2/A-susp-*`, `j1/S072`-`S076` (one wide) against `a1/S-susp-*` (`sheet_a1_susp1.jpg`, `sheet_a1_susp2.jpg`) and `final/S-susp-*`.

### C3B-9 The empty field and the lone stage box: partly
- **Done: the field filling up** (`rituals/Throng.js`, new): 43 Cast figures out of the field gates and the dugouts' ends from 48 s on, in nine knots: in front of the Phillies' dugout, on the grass toward it, by the plate, the stage's left end by the stairs, behind it, past the car, behind short, the Rays' empty dugout (security). The club's and MLB's people in dark jackets with credentials, security in yellow, the grounds crew in red, photographers with their cameras up, a few family. Talking, a phone up, clapping the hand-off, the MVP and the players going up. Unnamed (CAST.md).
- **Done: the TV** no longer frames the bare box: while the stage goes up, a handheld in the knot of players by the dugout, the wide, the crowd, the infield; the stage done and the car coming in from high home; the party walking out.
- **Not done:** the crew carrying the stage's pieces in (Gators or men): the pieces still slide in on their own over 4 s.
- **Before / after:** C3B's `j1/S118`, `j2/C-cel-067`, `C-cel-103`, `j1/S123` against `a3/C-cel-090`, `C-cel-100`, `C-cel-117`, `a3/D-field-from-high-home-219` and `final/C-cel-066`, `C-cel-090`, `C-cel-100`, `C-cel-219-high`.

### C3B-10 The interview close-ups on the crudest figures: partly
- **Done:** mid-shots, waist up with the people beside, as FOX's were: Manuel half 1.9 m (was 1.0), the MVP 2.1 (1.5), Howard and the trophy 1.9 (1.2-1.25), Moyer 1.6 (1.3). Manuel (`Looks.js`, one marked line) girth 1.1, belly 0.5 (was 1.2, 0.75; FR1 noted him 10-15% too wide against Getty 83570999).
- **Not done:** the party's figures (Cast's near figure for faces and hands), Zelasko's belted grey coat, the trophy's acrylic case.
- **Before / after:** C3B's `j1/S121`, `j2/C-cel-157`, `C-cel-166` against `final/C-cel-158`, `C-cel-170`, `C-cel-192`.

### C3B-11 The pitchers' shoulder pads: done (one FB3 block in `Players.js`, after FB2's)
- The shoulder line slopes down again from 7 cm in from its point (2.8 cm down and 1 cm in at the point; FB2's squaring kept by the neck); the cap of the shoulder taken in 14% round the arm's bone; the sleeve's top drawn in to the arm (1.3 cm, which takes back FB2's stand-off there) and its underside let down 1.6 cm toward the hem; the hull eased into the belt over its last 6 cm instead of standing out over it; the tops of the inner thighs drawn in 42% and down 5 cm, a sag for a crotch. The jacket keeps FR1's.
- **Before / after:** C3B's `j1/S106` (Price) against `a3/P-close-3178.2` and `final/G-close-3178.2`: `cmp_price2.jpg` side by side. Narrower, sloping shoulders, the sleeves on the arm, the jersey into the belt; the crotch shallower but still there. FOX t11530s (Balfour from above) is still looser and more folded.

### C3B-12 The 27th's plate puddle blown out: done
- `Field.js`: the white wasn't only the puddle. The standing water's roughness is 0.17 (W4's 0.03 made it a mirror for the one key light, which stands for six banks), FB2's bank sheen is broken into specks and held under 0.09, and (the most of it) the soaked clay is no glossier than 0.4 (it went to 0.25: from high first the key light's glint came back off the clay beside the puddle as a white sheet).
- **Before / after:** C3B's `j1/S070` against `a2/Q-puddle-2108.1`, `final/Q-puddle-2108.1` (the puddle fixed, the clay still white: `cmp_puddle.jpg`) and `final2/Q-puddle-2108.1` (dark, speckled mud and a small glint: `cmp_puddle2.jpg`, top). From high home (`cmp_puddle2.jpg`, bottom: C3B's `j2/I-plate27-2101.8` against `final2/Q-plate27-high-2101.8`) the plate's as it was, a touch more matte.

### C3B-13 Walk-ups from behind: done
- The walk-up is from the low camera he's walking toward (low third for a Phillie, low first for a Ray), then high on the same side if that's blocked, then his stance's open side.
- **Before / after:** C3B's `j1/S020`, `S043`, `S047`, `S084`, `S103` against `final/W-walkup-*`.

### C3B-14 Lockstep: done
- Every man in the celebration's plan has a stride phase and a stride length (±8%) of his own (`Celebration.js add`), in the walks, the runs, the stairs and the lap.
- **After:** `a2/C-cel-140`, `a3/C-cel-140`, `final/C-cel-140`.

### C3B-15 The runner on second in the center field frame: not done
- Leading him further toward third moves him 1.3 m across a 7 m picture; dropping him out of it needs the camera higher (FY1's calibration of the mound and the plate) or the in-play plans' 3.3 m lead changed (Utley's play's timing hangs on it). Left.

### C3B-16 The lap's flag: done
- `Flag.js`: printed through (the back reads 2008, not 8002), the fly behind the pole (it was turned to stream out ahead of him), more sag at the fly and its lower corner, bigger waves running down it, and its motion (the ripple and the walk) in the motion vectors. Nobody holds the fly's corner yet.
- **Before / after:** C3B's `j1/S124`, `crops/S124-flag.png` against `a2/C-cel-230`, `C-cel-245`, `C-cel-262`, `final/C-cel-245`, `C-cel-262`.

### C3B-17 The virtual ads in the broadcast mode: done
- `Backstop.js`: the ad's on whenever the broadcast's cut is on the center field camera (`_tvShot` starts with 'center'), not only when it's held.
- **After:** `final/A-lastout-s0.2` (WISER'S on the last pitch), `V-center-ad-3450.5`.

### C3B-18 The ball girls' towels: done
- `Squad.js`: whirled at about 5 rad/s (9-12) and their vertex wave slowed to match; the terry a soft mottle, not a per-texel stipple.
- **Before / after:** C3B's `j1/S064`, `crops/S064-towels.png` against `a2/Q-towels-1925`, `Q-towels-1931`, `final/H-break-1925`.

## The counts

`JSON.stringify( __app.engine.meshRenderer.stats )`, full park, 1280 × 800, not profiled. After: each view shot twice, the second shot's js reading the first's (the replay held between). Before: C3B's tables (`j1_table.txt`, `j2_table.txt`), the same code but for my changes; all 756 pipelines after (the base's).

| View | Before (C3B) | After |
|---|---|---|
| TV center, the last pitch (3481) | 481 draws, 4.33 M triangles (`j2/B-lastout-3481`) | 487 draws, 3.72 M (`final2/T00`, `final/T00`) |
| TV center, the 27th (t 32) | 475 draws, 4.21 M (`j1/S001`) | 481 draws, 3.59 M (`final2/T01`) |
| TV 2-3.5 s after strike three | high third close, fov 1.48: 422 draws, 3.51 M | center push-in, fov 1.45: 475-480 draws, 3.41-3.46 M (`final/A-lastout-s2.2`-`s3.4`) |
| TV, the pile 5-9 s after the strike | center fov 9: 521-524 draws, 4.5-6.13 M | center fov 1.45-3.5: 476-495 draws, 3.2-4.8 M |
| TV, the pile at 13-15 s | low first fov 9.6: 485 draws, 6.59 M (`j2/C-cel-013`) | handheld fov 47: 693 draws, 4.22 M (`final/C-cel-015-hand`) |
| High home wide, the celebration at 219 s | 756 draws, 5.52 M (`j1/S123`) | 793 draws, 5.68 M (`final2/C-cel-219-highhome`, the throng on the field) |

- **The TV center shots** are as they were in draws (+6) and lighter in triangles (the players' LOD state; the same view).
- **The new views:** the handheld on the grass (693 draws, 4.2 M) is inside the TV's envelope (high home's wide is 715-793). The last out's push-in and the pile from center are lighter than the fov 9 wide they replace.
- **The celebration's high home wide** is the heaviest TV view: +37 draws and +0.16 M triangles with the throng (43 Cast figures, P0's pool; at that distance most are its far figure). That's the one to watch; the throng's knots or its count can come down if the coordinator's profile puts it near the floor.
- **CPU per frame:** the lens guard, about 350 point-to-line tests a call and one to five calls a frame in TV mode (the celebration's crowd shots ask all four cameras); `showLastOut` for 3.6 s once; the throng's 43 figures posed each frame only from 40 s into the celebration (a few hundred operations); the GameHUD's board and lower third rebuilt only when their text changes. None of it runs in the walking view but the throng and the last out's poses.
- **GPU:** the jersey's FB3 block is a few dozen ALU ops per player vertex; the flag's vertex stage computes its ripple twice (now and a frame ago); the field's wet clay one `max`.

## For the merger

- **Files:** `BallparkApp.js` (the cut: `_lastOutCut`, `_celebrateCut`, `_handheld`, `_partyAt`, `_suspensionCut`, `_lensBlocked`, `_blockedOnce`, the walk-up and result cases, `body()` in `_directorCut`, the 'hand' camera in `_foxCamera`); `game/Director.js` (`lastOut`, the hook in `pose()`, the champions cue moved); `game/Celebration.js` (`showLastOut`, `fieldClock`, `field` flags, Ruiz's approach, per-man stride, `CEL.party` 86, `LAP` on the track); `game/GameHUD.js`; `places/Rituals.js` (the fireworks on the strike's clock, the throng); new `places/rituals/Throng.js`; `places/rituals/Flag.js`; `places/home/Backstop.js`; `places/phanatic/Squad.js`; `Field.js` (the wet clay's and the puddle's roughness, the sheen's cap).
- **Outside my files, one marked block each:** `game/Players.js` (FB3 block right after FB2's `// ---- end FB2` in the body's vertex stage: the yoke, the sleeve, the belt, the crotch; SP2 works in this file: the block is self-contained and applies to every LOD that runs this vertex stage); `game/Looks.js` (Manuel's girth and belly, one line).
- **`director.lastOut`** = { pitch, result, cel, tStrike, lead } (the last pitch's segment, the result, the celebrate segment, strike three's time, 3.6). `Celebration.showLastOut( d, celSeg, s )` poses the field's men s after the strike; `fieldClock( lt, lead )` is their clock in the celebrate segment. Anything that wants "the moment of the last out" should use `lastOut.tStrike`, not the celebrate segment's start (the Liberty Bell, `Crowd.js`'s celebration state and `alley/Night.js` still use the segment: 3.6 s late; I left them).
- **The champions cue** (`s.celebrate()` and the speech fallback's line) is on the last pitch's segment now, at the strike + 0.15 s; the celebrate segment has no cues.
- **`CEL.party` is 86** (was 114). `Party.js` reads it; FR1's other party times are relative to CEL's other marks and unchanged.
- **`LAP` changed** (Celebration.js): on the warning track at OUTFIELD's angles. `Rituals._lapBike` and the lead bike's parking match use `lapAt`, so they follow; the route is 192 m (the men cover about 124 m of it by 292 s, to center field).
- **`_lensBlocked( e, at, skip, half, clear, near )`** (FB2's had `( e, at )`): reads `places[wells].figs.list`, `director.actors`, the rituals' `press`, `party`, `families`, `throng` casts' `list` (x, y, z, visible, scale) and `phanatic.now`. FW or anyone changing those lists' fields should keep x, y, z, visible/shown and scale.
- **A new TV camera, 'hand'** (`_foxCamera( 'hand' )` returns the handheld's eye, `_hand.e`); `cycleCamera` doesn't step to it, only the cut uses it.
- **GameHUD:** two new elements, `.gm-board` (the line score card) and `.gm-l3` (the lower third), TV mode only; `gm-nobug` fades the bug out after the pile (it comes back on hover, with the transport).
- **The replay's clock is untouched** (3785.503, all 504 segment starts the same).

## Noticed elsewhere

- **The pile's divers fly** (`final/A-lastout-s4.2`, `s6.0`): men in the air, horizontal, arms out, for the second or two of their dive; and they lie at odd heights over Lidge. R's/FY2's `dive` and `lie` steps; worth a look by whoever has the celebration's bodies next.
- **The on-deck figure in the walk-ups** (`final/W-walkup-610.8`, `a1/W-walkup-1415.2`): the rail's crude on-deck man in pinstripes stands by the circle in the low cameras' walk-up close-ups, half see-through in some (its fade); next to the rig's detailed batter it's the crudest figure on TV.
- **The 3.6 s:** the Liberty Bell's ring (`LibertyBell.js`, celebrate t0 + 0.3), the crowd's champions state (`Crowd.js`, `seg.kind === 'celebrate'`) and the Alley's and the 3B concourse's celebrations (`alley/Night.js`, `Concourse3BPeople.js`) start with the celebrate segment, 3.6 s after strike three (the crowd's roar cue now fires at the strike). `director.lastOut.tStrike` is there for them.
- **The radio track** is on the old clock (`radioTime`: the suspension mapped from 24 s to 160); the strikeout's call lands at 3480.8, about a second before the strike: fine as it is.
- **C3B-9's stage crew:** the stage's pieces still slide in by themselves over 4 s (`Stage.js` parts' `from`); no Gators or men carry them.
- **The players' far and middle figures and SP2's culling were not the lap's problem** (I suspected them: the a2 and a3 probes with the LOD and the occlusion culling off showed the same empty track); it was the route behind the wall.
