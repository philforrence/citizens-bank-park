# FB2, round 2: the broadcast (critic C2B's tickets)

Fixer FB2, 2026-10-28, branch `worktree-agent-abb769f638efee40a` (off `ballpark` at 594d6c3). Tickets: C2B-1 to C2B-24 from `.claude/gauntlet/r2/C2B.md` (C2B-16, the crowd behind home, is FW1's). Seven desk jobs, all on the full park at 1280 × 800 (no `only=`); the last three with no console errors.

**Shots** (all in the main checkout, `.claude/gauntlet/r2/FB2/`):
- **Before:** C2B's own (`.claude/gauntlet/r2/C2B/j1..j3/`, taken on `ballpark` at 4dbd00a; my files hadn't changed since but for FI2's rooms-off block in BallparkApp), and `j0/`: the players from fixed looks (`P01`-`P08`) and the counts, on this branch before any change.
- **After:** `a1/` (the first fixes; the field's shader failed to compile in it, so its field is black), `a2/`, `a3/` (stopped at shot 17 by a slip of mine, fixed), and `final/`: every ticket's after shot. `final2/` and `final3/` re-take what changed after it: the high home counts, the 27th's plate, and the presentation's close shots.
- The job generator is `mkjob.mjs` in this session's scratchpad (the recipes are in each shot's name and the job JSON); Node timeline checks beside it (`tl.mjs`, `jenk.mjs`, `replays.mjs`).

**References:** C2B's, all local (`.claude/ref/gauntlet/play/`, the FOX world feed U_R8E614TB8; `.claude/ref/home/` and `.claude/ref/rituals/`, Getty and Flickr). Nothing new downloaded.

## The replay's clock

Untouched. `director.duration` is 3785.503 before and after, with all 504 segments where they were (checked in Node after every Director change). The fielder's spot off the wall (C2B-3) and the carom change the in-play plan's internals only; FY1's `legacyInPlayDur` keeps every segment's length. The replays (C2B-10) re-pose the players for the picture only: `director.t`, the radio, the crowd, the board and the bug run on live.

## Per ticket

### C2B-1 The policeman in front of the low cameras: done
- **Why:** `Police.js` stood an officer at each dugout's far end where the roof meets the photographers' well, 1.25 m out on the track: 1.5 m in front of the low base line camera's lens, on its line to the mound.
- **The officers** now stand past the photographers' well against the wall (`s = len + 1.3`, 0.75 m out), out of every low camera's view of the plate and the mound.
- **The pitcher close-ups** come from above, as FOX took them (t11530s, Balfour from a high camera, the grass behind him): the high camera on his open side (third for a righty in the set, first for a lefty), head to the thighs (`_directorCut`, `pitcherClose`). The low cameras keep the batters.
- **A guard** (`BallparkApp._lensBlocked`): a close-up isn't taken if a shown rail figure stands within 0.3-0.45 m of the line from the lens to the subject in the first 10 m; it falls back to the other camera, then to center field.
- **Before / after:** `C2B/j1/A03`, `A23`, `j3/C11`, `j2/B01` (half black) against `final/C01-tv-close-first-pitch`, `C02-tv-close-last-pitch`, `C03-tv-result-price`, `C04-low3-probe-hamels` (the probe: nobody in front of the lens).

### C2B-2 The players pear-shaped: done (held against Getty 83485455 and 83486198)
- **Why:** FY2's CY-6 drape pushed every jersey and pants vertex out along its normal (up to 4 cm at the back over the belt, 1.7 cm on the thigh), which rounded the base mesh's round trunk into a barrel and the seat and thighs into a pear; the shoulders were never widened; and a heavy man's girth scaled his hips and thighs as much as his chest.
- **The jersey** (`Players.js` vertex stage, the FB2 block that replaces FY2's): from the armpits to the belt it falls straight, an elliptical hull the chest's size (0.21 m half-width, narrowing to 0.18 at the belt) that the waist is filled out to; a big man's belly, outside it, stays his own; a little blousing at the back just over the belt; the cloth's 6 mm.
- **The shoulders:** the jersey's yoke squared (the trapezius' slope bridged, the trunk's top raised 1.2 cm and out 0.6 cm). The cap of the shoulder is pressed a centimetre flat under the cloth: lowering the arm from the mesh's A pose pops it up into a ball, which read as shoulder pads once the hull was in (`a2/P07`, `a2/C06`).
- **The hips and pants:** the trunk below the belt 5% in at the sides; each thigh pulled toward a straight cone round its bone from the hip (10.8 cm) to the knee (8.8 cm): filled out where it's under, the excess halved (more on the outer side: the jodhpurs), and 8 mm of cloth.
- **Girth** (`Rig.js` `solvePose`): the pelvis and the legs take 55% and 65% of the man's girth across (all of it front to back, his belly); the shoulder joints go out with the trunk they're in (`gw = g`; at 0.7 a big man's arms sat inside his scaled trunk).
- **Before / after:** `j0/P01`-`P08` against `final/P01`-`P08` (Howard front and side, Utley front and back, Rollins, Lidge, Hinske, Jenkins); TV: `C2B/j1/A14`, `j2/B21` against `final/C06-tv-jenkins-walkup`, `C07-tv-hinske-walkup`.
- **Against the references:** Jenkins in `final/P08` and `C06` has the broad back and the straight-hanging jersey of Getty 83485455; the pants hang straight; the shoulders are wider than the hips. Hinske (girth 1.12, a belly) is still a big man, as he was.
- **Left:** real fold normals; the sleeve's hem.

### C2B-3 The follow camera chasing the ball into the night: done
- **The framing** (`BallparkApp._playFrame`): while the ball is up, the high third camera holds the spot it's coming down (the landing point at 0.8 m) and the fielder going for it, and the ball once it's below 6 m, wide enough for all of them with room (the fov from their spread, at least a 12 m tall picture, at most 34°). Once it's fielded: the ball's way in (its height held to 0.8-3 m) and the lead runner still going.
- **Extra-base hits** go to the high home wide shot 0.8 s after the ball is down: the batter rounding first and the relay.
- **Home runs** frame the outfielder and the wall.
- **The fielder's spot** (`Director._planInPlay`, `insideFence`): a ball off the wall is played from 1.3 m in front of it, with a 0.3 s carom back out to him. Upton was playing Jenkins's double from behind the wall (the spray point was 0.7 m past the fence), which is why C2B's `B09` had no Upton in it.
- **Before / after:** `C2B/j2/B07`-`B10`, `j1/A16`, `A17`, `j3/C05`, `C07`, `j1/A05` against `final/F01`-`F05` (Upton running to the wall, then picking it off the track: `F05`), `F06`, `F07`, `F08`.

### C2B-4 The police line behind the plate: done
- The stretch of the 9th's line between the low home wells (|x| < 16, z > 3) comes out only 12 s after the last out (`Police.js`, `late`), walking from the corners like the rest.
- **Before / after:** `C2B/j1/A22`, `j3/C14` against `final/M03-center-last-pitch` and `final/H01` (an empty track behind the plate, as FOX's frame).

### C2B-5 The second base umpire in every center field frame: done
- `Director._umpires`: bases empty, on the grass 8 m behind second on the shortstop's side (−4, −47); a runner on first only, inside on the first base side (7, −29); a man in scoring position, inside on the shortstop side (−9, −30). All three are outside FOX's 2.7° center field frame (projected in Node). `Celebration.js`'s `UMP_AT` starts him where the last pitch left him.
- **Before / after:** `C2B/j1/A02`, `A07`, `A22` against `final/M01`, `M02`, `M03`.

### C2B-6 The night's colours: done
- **The light:** the night's key light is a neutral, faintly cool white (0.94, 0.965, 1.0), as FOX white-balanced to the metal halide; it was warm (1.0, 0.95, 0.86). One marked block in `applyAtmosphereReadback`.
- **The grass** albedo (0.14, 0.31, 0.05) → (0.13, 0.21, 0.085); **the clay** (0.56, 0.27, 0.11) → (0.53, 0.29, 0.155), the mound's a touch greyer.
- **Measured** (mean sRGB of a patch; `patch.py` in the scratchpad):
  - high home, the outfield grass: before (87, 148, 30), after the first change (67, 120, 48), final (74, 109, 53); FOX t13290s (89, 118, 67);
  - high home, the clay behind first: before (199, 139, 71), final (182, 136, 87); Getty 84082664 (195, 149, 95), FOX (167, 129, 97);
  - center field, the grass in front of the mound: before (123, 162, 77), final (116, 141, 98); FOX t13150s (116, 145, 107).
- **Before / after:** `C2B/j1/A30` against `final/S02-tv-high-last-pitch` and `M07`.

### C2B-7 The mowing: done
- `Field.js`: the outfield's passes 7 ft (were 15 ft squares), the infield's 5 ft (6 ft), soft-edged (×3, was ×9), at about half the contrast, the second pass a little weaker: a fine plaid (FOX t13290s, Getty 84082664).
- **Before / after:** `C2B/j1/A30` against `final/M07-high-last-pitch`.

### C2B-8 The celebration's coverage: done
- `BallparkApp._celebrateCut`, off Celebration's own schedule (`CEL`, `STAGE`, `trophyHold`), a new shot every 7-9 s:
  - the pile from all round: center (0-5 s), high first, low first tight, high third, center tight, low third (to 40 s);
  - the hugs and the crowd (to 60 s);
  - the stage going up, the crowd from four cameras, the infield;
  - the presentation: the stage, Moyer with the rubber, Manuel, Hamels, the party going up, then Howard with the trophy over his head, tight on the trophy. These close shots are from the center field camera: the rituals' stage party faces out to right-center (see "Noticed elsewhere"), so from high first or high home they were all backs (`final/E06`, `final2/E06`, `E11`);
  - the lap behind Myers's flag, followed from the camera across the field (high home as it passes center), with the crowd and the wide between;
  - the crowd and the wide to the end.
- **Before / after:** `C2B/j1/A26`-`A29` (one static wide) against `final/E01`-`E04`, `E08` and `final3/E05`, `E06`, `E12`, `E11` (Manuel, Hamels, the stage, Howard with the trophy: the faces, as FOX's interview and trophy frames; against `final2/E11`, the same moment from high home, all backs). `final/E05`-`E07` are from the code before the stage shots moved to center field.
- **Left:** a lower third or an interview graphic; the Rays' dugout shot (it waits on C2B-11's bench).

### C2B-9 Utley's play tight on the plate: done
- A runner coming home who slides (`plan.runners`: `to === 4`, `slide`) gets high home tight on the plate (fov 6.5, aim (−0.9, 0.6, −1.1)) from 1.6 s before he gets there to 1.6 s after the call (t13220s). That's Utley's play, Upton's slide on Peña's single and Peña's on Longoria's.
- **Before / after:** `C2B/j1/A19`, `j2/B04` against `final/F09-tv-utley-plate`, `F10-tv-utley-tag`, `F11-tv-pena-upton-slide`.

### C2B-10 Replays of the big plays: done
- **Which** (`game/Replays.js`, `replayPlan`): plays at the plate, tag outs, home runs, extra-base hits, double plays, runs scoring; 13 in the game. Each is on air from just after the result's start to the next pitch (the walk-up between), or, after a third out, 11 s into the change of sides (Utley's play: 2716.0-2722.7). At 0.7× speed, from 3.2 s before the play at the plate (or from contact).
- **The picture:** the play from the high first base camera (the other side from the live high third), framed as the follow camera frames it; for the last moments of a play at a base, tight on the bag from the low camera across (Ruiz's tag from the first base side, t13250s). A REPLAY tag over the bug.
- **How it keeps the clock:** after every place has updated on the live pose, `BallparkApp._frame` poses the director at the replayed moment (the players and the ball only) and restores `director.now` for the bug; the next frame's update poses live again. While a replay is on, the director keeps the rituals' rig slots (`holdSlots`), so nobody is freed and re-added frame to frame.
- **Before / after:** none before (no replays); `final/R01`-`R04` (Utley's throw, Ruiz's tag, Jenkins's double, Upton's slide).
- **Left:** no wipe graphic; the last out's strikeout isn't replayed (it's a pitch, not an in-play segment).

### C2B-11 The dugout benches: done
- `FieldFigures.js`: the head's cap and hair were measured from the standing pose's head centre, so every seated or leaning man had none (bare heads along the track); now from each head's own centre (a varying off the head's normal). Some of the Rays in their navy hoods on the 27th. The `lean` pose's forearms lie on the rail pointing out, the hands together over its front (they were folded across the chest: a bar held out at shoulder height from the field); the coach's `rail` pose has his hands on top of the rail.
- **Before / after:** `C2B/j2/B17`, `B18` against `final/B01-bench-3b-27`, `B02-bench-1b-29`.
- **Left:** the jackets' chest box (a white band) isn't yet a P with blue piping; moving the bench onto the players' rig.

### C2B-12 The drips across the long lens: done
- `Drips.js`: faded by their distance against the lens's focus (as `Rain.js` does its near drops): nothing nearer than about a third of the focus distance. Walking (a wide lens) they're as they were.
- **Before / after:** `C2B/j3/C01` against `final/C05-tv-walkup-rollins-27`.

### C2B-13 The 27th's field wet: done
- `Field.js`, the rain block: from the 4th on, the crew's calcined clay raked out in pale grey-tan streaks (rake tines, grains) round the plate, the bases, the base paths and the front of the mound (Getty 83458180); the standing water muddy (×0.5) rather than ink (×0.3); and the banks' sheen in the wet, which one key light can't give: what the surface mirrors toward the eye, if it's up where the bowl's ring of banks is, as glints on the water and a little on the clay.
- **Before / after:** `C2B/j1/A10`, `A11`, `A07`, `A09` against `final/W01-high-27-5th`, `M04-tv-tarp-pull`, `M02`, `M05`.
- **Note:** `a2/W01`, `M04` had the sheen at four times this strength, which turned the puddles white; it was cut before `final/`.

### C2B-14 The dugout strip's overlapping text: done
- `Details2008.js`: the logos every 180 px (were 118) with a dot between, each held to 150 px.
- **Before / after:** `C2B/j1/A14` against `final/C06` (the strip behind Jenkins).

### C2B-15 The umpires' powder-blue panels: done (CY-13's open half)
- `Players.js`: a powder-blue stripe (sRGB about 140, 180, 220) on the black jacket from the collar over each shoulder down to the armpit, front and back, along the raglan seam (FOX t13820s; Getty 83485455, 84081866). The number on the sleeve isn't drawn.
- **After:** `final/M06-ump-plate-side`, `F10`, `R02`.

### C2B-17 The Phanatic on air in the breaks: done
- `_phanaticCut`: in a break (any segment the cut has no other plan for), when he's out on the field or a dugout roof, every other 8 s on him from the high camera across the field (a 4 m tall picture, 6 m when he's on the field).
- **After:** `final/E09-tv-break-phanatic` (on the first base roof), `E10-tv-rain-dance`.

### C2B-18 The batter's boxes in the 9th: done
- `Field.js` (W4's chalk wear): it wears harder with the night, mostly gone but the front corners by the 9th; the foul lines kept crisp. `FieldRail.js`'s wear curve is unchanged.
- **After:** `final/M03` (the plate).

### C2B-19 The catchers' mitts: done
- `Rig.js`: 88% of the size and deeper; `Players.js`: Ruiz's black, Navarro's a dark brown.
- **After:** `final/M03`, `H01`.

### C2B-20 The TV bug: done
- `GameHUD.js`, the TV corner only: an opaque bevelled navy box under a brushed-silver WORLD SERIES header, the teams stacked in their colours, TOP 9TH in its tab, the count and 2 OUT in condensed caps (the world feed's bug, t13150s). The walking panel is as it was. No lower third at the walk-up.
- **After:** `a3/H01-tv-hud-last-pitch`.

### C2B-21 The pile at 8 s: not done
- The photographers and the caps at the pile are `places/rituals/Press.js` and the rituals' props, not my files. The low camera wells' photographers (`Wells.js`) stay in their wells.

### C2B-22 High home's framing and the net's cables: done
- fov 37 aimed at (0, 0.5, −44) (was 32 at (0, 0, −36)): the plate 89% down as FOX's, the wall at about 28% from the top (was 22%), the diamond 14% smaller. The backstop net's cables (`rail/Walls.js`, kept out of the batch) are hidden while the high home camera is the one on (a lens focused on the field doesn't see a 2 cm cable a few metres in front of it).
- **After:** `final/S02-tv-high-last-pitch`, `M07`.
- **Left:** FOX's eye was lower or its lens wider (its wall is at 40%); matching both the plate and the wall needs the eye moved, which I didn't.

### C2B-23 The Nikon virtual ad: done
- `places/home/Backstop.js`: black on yellow, upright.
- **After:** `final/N01-center-burrell-nikon`.

### C2B-24 Bradford's submarine: done
- `Motions.delivery`: a pitcher whose release is below about 1.15 m (Bradford's is 0.37 m; everyone else's is 1.6 m or more) folds nearly double through it: the trunk 0.85 rad over the front leg, the pelvis 0.3, the hips 0.2 m lower, over ±0.3 s. Everyone else's delivery is unchanged.
- **Before / after:** `C2B/j2/B23` against `final/N02-center-bradford-release`, `N03-bradford-side` (Getty 83912834).

### Also
- **The first frames of a shot are framed, not eased into** (`_settle`): on a cut, and after a jump in the replay, the TV camera snaps to its target for three frames. Before, a shot right after a seek eased from where the players had been posed the frame before, so a close-up could be off its man (C2B's `A01`, my `a2/C05`).
- **Under a cap the scalp's crown is kept under it** (`Players.js`). From the high cameras' new pitcher close-ups, the skull came through the top of the cap as a brown patch (`a1/C01`, `C02`).

## The counts

`JSON.stringify( __app.engine.meshRenderer.stats )`, full park, 1280 × 800, not profiled. Each is read in the shot after the view, so it's that view's.

| View | Before (`j0`) | After (`final`) |
|---|---|---|
| TV center, the last pitch (3480.9) | 472 draws, 4,067,584 triangles, 714 pipelines | 472 draws, 4,067,584 triangles, 714 pipelines (`final/`, the first shot, as in `j0`) |
| TV high, the last pitch | 641 draws, 5,344,361 triangles, 714 pipelines | 709 draws, 6,094,732 triangles, 714 pipelines (`final2/`) |

- **TV center** is unchanged. (Read again in `final2/` after three other views it came to 472 draws and 5.30 M triangles: the same draws, the crowd's LOD state carried over from the views before. Compare first shots with first shots.)
- **TV high** is 68 draws and 0.75 M triangles (14%) more: the wider frame (C2B-22) takes in the outfield's upper stands, the scoreboard and the city beyond. That's the one cost to watch; if the coordinator's profile shows it near the floor, fov 35 at ( 0, 0.5, -42 ) is the middle way.

- **Per-frame CPU:** a few hundred operations for the cut (the lens check walks the rail's ~150 figures, but only for a close-up), `_playFrame` (a few points), and during a replay one more `director.pose()` a frame (the players' sync was already per frame).
- **GPU:** the players' vertex stage has a handful more ALU ops per vertex (the hull, the cone); the field a few more per pixel (the drying agent and the sheen only on the 27th, the reflection vector); the drips a distance. No new draws, except the backstop cables mesh, which is now its own (unbatched) draw.

## For the merger

- **Files:** `BallparkApp.js` (the cameras and the cut; one marked block in `applyAtmosphereReadback`, the night key light colour; a marked block in `_frame` for the replays, and one at the replay-jump cut), `game/Director.js`, `game/Replays.js` (new), `game/Players.js`, `game/Rig.js`, `game/Motions.js`, `game/Celebration.js`, `game/GameHUD.js`, `Field.js`, `FieldFigures.js`, `Details2008.js`, `places/rail/Police.js`, `places/rail/Drips.js`, `places/rail/Walls.js` (outside the five named, three lines: the cables kept out of the batch and returned), `places/home/Backstop.js`.
- **The players' drape:** FY2's CY-6 block in `Players.js` is replaced, not added to. If another branch touched that block, take mine.
- **`Rig.js solvePose`:** the pelvis and legs take less of the girth and the shoulder joints all of it. Anything that solves a heavy man's pose for his hands (Props.js for the Phanatic, girth 1.0) sees his shoulders slightly further out; nothing else changes for girth 1.
- **The night key light** is now (0.94, 0.965, 1.0) × 0.75 × night. Everything lit by the stadium key after dark is a touch cooler and about as bright. The next fixer's Night.js work may want to know.
- **`director.holdSlots`** (new): while true, the rituals' `r:` slots aren't freed.
- **`Director._planInPlay`**: the fielder's spot `insideFence` (1.3 m) for balls that aren't caught; segment lengths are unchanged (FY1's rule), checked in Node.
- **FW1** may be changing `RailFigures.js` (the police and photographers): `_lensBlocked` reads only `figs.list` (x, y, z, shown, scale).

## Noticed elsewhere

- **The stage faces away from everyone** (the rituals): `STAGE.point`'s front (+lz) faces home and the first base stands, as the comment and the photo have it, and the players gather on that side; but the men on the stage (`Celebration.js` `presentation`, `yaw: S.yaw`) and the party (`places/rituals/Party.js`, `yaw = S.yaw`) face −z rotated by the yaw, out to right-center, their backs to the crowd and to high home (`final2/E11`: Howard lifting the trophy toward the outfield). Probably `S.yaw + Math.PI` in both, with the trophy's and the mics' hand-offs checked. I didn't change it (Party.js isn't mine, and the two must move together); the TV takes the presentation from center field meanwhile.

- **The pile's media and caps** (C2B-21): `places/rituals/Press.js` brings about 15 photographers to the pile by 8 s, and caps hang in the air for minutes.
- **The rain haze on the 27th** washes the high home picture grey (`final/W01`, `M04`): the rain and the air are `game/Rain.js` and `Night.js`, the next fixer's.
- **The walking players at the celebration** smear in still shots (`a1/E04`): the players' previous-frame bones look stale after a seek with the replay paused, so the motion blur shows. Not seen in motion.
- **The Rays' and Phillies' dugout jackets** still have the white chest band (C2B-11's third point).
- **Manuel's red jacket** balloons (`final3/E05`): the players' `jacket` role pushes the cloth out along the normals (+1.3 cm) on top of his girth, the same barrel C2B-2 took out of the jerseys; my hull is for the jerseys only.
