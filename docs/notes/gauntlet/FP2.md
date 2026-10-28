# FP2, round 2: the people (the floating caps, the crowd behind home, round 1's leftovers)

Fixer FP2, 2026-10-28, branch `worktree-agent-abaf530eb1c36e780` off `ballpark` at f4a8176 (FW1's merge). Tickets: the floating caps (C2I-7 in `.claude/gauntlet/r2/C2I.md`; FW1's note; C2B-21's caps in the air), C2B-16 (`.claude/gauntlet/r2/C2B.md`), round 1's CP-12 and CP-19 (`.claude/gauntlet/r1/CP.md`), then a pass round the people.

**Shots.** All in this worktree's `.claude/gauntlet/r2/FP2/` (gitignored): `before/` (1280 × 800, at f4a8176, before any change), the working rounds `a1/` to `a4/`, `final/` (1280 × 800, the full park, no `only=`, no console errors) and `final2/` and `final3/` (the crowd's hair and the lanyards after the last two tweaks, the TV center again: the full park, no console errors). The recipes are `job-*.json`, made by `mkjob.py` (`python3 mkjob.py <stage> [size] [prefixes]`), with the helpers in `probe.js` (`__capProbe`, a toggle per figure system, `__castBy`, `__crowdFan`, `__signFan`: they find a figure and frame it). The light is the replay's clock throughout.

## Per ticket

### 1. The floating caps (done, everywhere)
- **The cause:** a Cast figure's backwards cap (`HAT.capBack`) is the cap turned half round about the head. The vertex shader mirrored x and z about the head's centre but added the centre to y as well (`vec3f( - ( q.x - c.x ), q.y, - ( q.z - c.z ) ) + c`), so the crown and the bill of every backwards cap hung 1.59 m (times the figure's size) over its owner's bare head. It had always done it to the bill; FP1's own crown (CP-1) made it a whole red cap.
- **The fix** (`Cast.js`): mirrored in x and z only, about the head's own centre (a kid's bigger head about the neck).
- **Found by:** the club's spot triangulated from C2I's two views to (31.5, 22.3, 47.4); a probe listed the Cast figures within 5 m (one, at (31.41, 18.59, 47.39), wore `capBack`), and the cap went with `__cast.hidden` and stayed with the crowd or People's walkers hidden (`before/cap-i11-*.jpg`). That explains all of them: the club's Recreation Park bar (C2I-7), FW1's under the 3B overhang on the 27th (a throng stand-in), and C2B-21's red caps over the stands at the pile and in front of the out-of-town board at 186 s (Cast fans at the rails). The seated crowd's, People's and the players' backwards caps were already right.
- **Before / after:** `before/cap-i11-club-rec-park-bar.jpg`, `cap-j06-club-stretch.jpg`, `cap-w22-concourse-rain-27.jpg`, `cap-pile-1b-20s.jpg`, `cap-stage-186.jpg`; `final/` the same names.

### 2. C2B-16, the crowd behind home (done)
- **The towels.** The candy-cane sticks were the Cast's towel hanging off the raised arm in line with it (a stick over every head), painted with its red square repeated down and across the cloth (red and white bars). The white cards were the seated crowd's towel twirled flat and level: edge-on to the center field camera, a white sliver.
  - Cast: held up (the arm's pitch over ~1.75), the towel is whirled round the fist in the plane square to the arm (over the head, a disc tipped toward the field), its loose end trailing the turn and sagging, its width half along the turn and half along the arm. One red square on the white with two lines of script, the World Series mark under it (zackhample's Game 4 towel, `.claude/ref/home/2008-10-26_zackhample-blog_ws-game4_rally-towel.jpg`); whirled, the square smears pink into the white.
  - Crowd: the turn tipped toward the field, the cloth's width half up and down, smaller (0.28 m out from the fist), crumpled across its width, the square smeared pink when it's up.
  - Reference: Getty 84082693 (Oct 29, the white-towel sea: white blurs with pink smears), Getty 112874141 (the strikeout).
- **The hats.** The Cast behind home wore the red knit with the white band and pom-pom on about a third of heads. Now: on the 29th the red P caps mostly stay on (18% of capped heads take a knit hat, 42% of the rest); the Phillies' red knit comes in three kinds by seed (the white P over a royal-blue cuff and no pom-pom, as in Getty 83893023; the white band and white pom-pom; a cuff striped white under a red pom-pom); the plain knits are navy, cream, charcoal or (a woman's) pink, not a blend of navy and cream (`Dress.js`, `Cast.js`). Reference: Getty 83485455 (the backstop's front rows on the 29th: a P beanie, a pink one, caps, bare heads).
- **The flashes.** 4,096 fans hold a point-and-shoot's flash (`Crowd.js _flashBuild()`): nine times as many behind the plate (the TV's backdrop) as in the outfield, three times round the infield. Each fires now and then (its own pace, one every 1.25 to 3.3 s, a share of them going off): a sprite at his face (sat or stood, from the crowd's pose), ~12 px across however long the lens (a core and a glow; the bloom does the rest), on for ~0.1 s. The share (`Crowd.mood().flash`): 5% all night, 20-80% in the 9th on the 29th by the count (the most at the 2-2 to Hinske), up for big hits, all of them at the last out, settling over three minutes; 70% fewer in the rain. Not within 9 m of the camera, nor on the seats a place fills with its own figures within 30 m. One draw, all on the GPU from the crowd's clock; no CPU per fan. `__app.bowl.crowd.flashes.shown()` says how many sprites and the share; `_flashMat.uniforms.flash.value.w = 1` lights them all (QA). Reference: FOX's center field frame of the last pitch (`youtube_U_R8E614TB8_oct29_final_pitch_cf_view_crowd_standing.jpg`: a flash behind the plate), Getty 83486198.
- **Before / after:** `before/home-b20-cf-zoom-29.jpg` (C2B's 2x zoom at the last pitch: the sticks, the cards, the rows of red pom-poms, no flash) against `final/home-b20-cf-zoom-29.jpg` (pink-white whirls, the hats mixed, four flashes, the signs); `home-a22-center-last-pitch.jpg` (FOX's center frame: one flash over the backstop's left, as in FOX's); `home-b19-cf-zoom-27.jpg` (the 27th), `home-close-towels-29.jpg`, `flash-cf-zoom-3484.jpg`, `flash-celebrate-high.jpg`, `home-mound-towels-29.jpg`.
- **Left:** the Cast's towel turns at its own pace, not in step with the arm's circle (Fans.js, not mine, circles the arm); nothing blurs a whirled towel but the TAA, so a still frame shows crisp cloth where a photo shows a blur.

### 3. Round 1's leftovers
- **CP-12, signs and lanyards in the seats (done).**
  - One fan in a hundred (387 round the bowl) has a homemade sign, from his seed. The boards are the ones behind home (`home/Signs.js`, its atlas now shared: `signAtlas()`, `SIGN_GRID`), twelve for each night: the 27th's RAIN? WE'RE FROM PHILLY, PHILS IN PHIVE, HI MOM IN BOCA!; the 29th's 28 YEARS... WHAT'S ANOTHER DAY?, IT ENDS TONIGHT, HARRY, CALL IT!, FOX 9 MORE OUTS... (the night from the Director, a uniform). The sign's quad was at the close level only and never used; it's now at the near level too (the TV's backdrop) and painted, its words on the face toward the field (the plain board behind). It goes up over the head now and then between pitches and whenever the stands are up, fewer in the rain (most fold away). A sign holder has no towel.
  - One adult in about twenty-two wears a credential on a lanyard (the strap from the collar either side to a white card on the chest, its band at the top; close and near; not over a poncho).
  - Evidence: `final/cp12-sign-fan-29.jpg` (HARRY, CALL IT!, RED OCTOBER on the 1B side), `a3/cp12-sign-fan-29b.jpg` (28 YEARS... WHAT'S ANOTHER DAY?), `final3/cp12-lanyards-front*.jpg` (in `final2/` the card sat low on the chest, under the arms folded or the hands in the lap, and none showed; it's at mid-chest now). Reference: Getty 112873396 (Game 3: lanyards, towels, DON'T RAIN ON OUR PARADE), 83433888.
- **CP-19, RailFigures' coarser style (done in place, not ported).**
  - The trunk lofted through the hips, the waist, the chest at the armpits and the shoulders sloping in to the collar (it went straight from the chest to the neck: a flat-topped box with square shoulders), with round shoulders, elbows and knees, the limbs on ten sides, the head on 16 × 10.
  - The face as the seated crowd's (the cold in the cheeks, eyes in their sockets with whites and irises, brows, the shadow under the nose, lips): it was two dark slits.
  - The ball girls' and bat boys' Phillies script from the Cast's atlas (`castPool().atlas`, cell 65): it was a row of red bars.
  - The 400 mm lens round (14 sides), the maker's ring near the front (Canon's red on the white glass, a Nikon's gold on the black), its hood open on the front glass (dark, coated): it was an octagon capped black, a black ball on a grey pipe end on. The lens is 0.49 m from the body to the hood's rim, as the reference's.
  - Per figure 1,160 to 1,520 triangles (was 470 to 620): photoSit 623 → 1,463, ballGirl 473 → 1,209, police 479 → 1,215.
  - Before / after: `before/rail-ballgirl.jpg`, `rail-photog.jpg`; `final/` the same.
  - **Left:** the port to the Cast (one figure system), which would bring the hands, shoes, hair and the Cast's near figure; the RailFigures API (`add`, `morph`, `look`, `shown`) is used by `places/rail/*` (FB2's) and the poses are joint targets, not the Cast's angles, so it wants the kit's IK per pose and its own round. The bodies are still straight tubes (no folds).

### 4. Round the people (done: two things)
- **Long hair** was a card hung behind the head: a panel from the side, nothing from the front. Now a shell round the back and sides of the head from the crown down past the collar (to the shoulders seated), framing the face in front of the ears, fuller as it falls, its strands shaded and darker toward the ends; under a cap or a knit hat its top tucks in under the band. The Cast's (all three figures) and the seated crowd's close level (the near one keeps its three-column card); a ponytail is kept behind the head. `final/w4-cast-longhair-front.jpg`, `w4-cast-longhair-back.jpg`, `final2/w4-crowd-longhair-back.jpg`, `final/w4-crowd-longhair-side.jpg`.
- **The celebration in one pose.** At the trophy, three minutes after the out, the whole stands stood with both arms up and a towel going (`before/cap-stage-186.jpg`). The first minute is as it was; then it settles over ninety seconds into a crowd (fewer arms up, towels now and then, more clapping), each fan by his own thresholds. `final/w4-stage-186.jpg`.
- Looked at and left: the Cast's faces (a painted 14 × 9 head: FW1's note), the near Cast figures' hands at the hip in black gloves read as black discs on a red jacket in poor light (`final/w4-cast-longhair-front.jpg`, FW1's hands).

## Counts

`__app.engine.meshRenderer.stats`, 1280 × 800, the full park:

| View | Before (f4a8176) | After |
|---|---|---|
| TV center at the last pitch (seek 3480.9, `home-a22`) | 472 draws, 4.17M triangles; Cast near 124 | 473 draws, 4.37M (`final3/`); Cast near 123; flashes 4,096 sprites, 80% of their turns firing |
| TV center (play 20, FW1's recipe) | FW1's final on this base: 477 draws | 479 draws, 4.39M; Cast near 123 |
| Walking, the 3B concourse (play 60, PERF.md's) | FW1's final on this base: 755 draws, 4.55M + the throng's 0.18M | 757 draws, 4.74M + the throng's 0.18M (466 drawn) |
| TV high at the last out (seek 3492) | | 648 draws, 6.94M |

The new draws: the flashes (one) and a second in the walking view (not mine to say which; FW1's count was a different run). The triangles: +0.2M in the TV views, from the near crowd's sign quad (+2 triangles a fan, folded to a point unless he has one), RailFigures' rounder figures and the flashes' 8,192 (folded unless firing). Per figure: the seated fan's close level 532/717 → 554/749 vertices/triangles (the hair's shell), near 236 → 238 triangles (the sign); the Cast's near 3,823/4,544 → 3,858/4,600, far 1,337/1,263 → 1,342/1,271 (the hair).

No invented people (CAST.md) and no textures or photos shipped (CREDITS.md): the signs are the boards behind home's, the script is the Cast's atlas.

## What the merger must know
- **Exports added:** `signAtlas()` and `SIGN_GRID` from `places/home/Signs.js` (one marked block; its `Signs` class now uses the shared atlas). New import: `Crowd.js` takes `places/home/Signs.js`; `RailFigures.js` takes `../Cast.js` (`castPool`) and `../../geo.js` (`canvasTexture`).
- **`Crowd.js`:** `crowdMaterial( lod, poseBuf, lookBuf, idsBuf )` (the ids for the signs), two uniforms on the crowd's materials (`cwNight`, `cwHome`), the `LODS` entries' `sign` flag, `Crowd.mood()` returns `flash`, `this._fwd` (each seat's facing), the flashes' mesh at the scene's root (`crowd._flashes`, layer 2, additive).
- **Not my files, one block each:** `home/Signs.js` (above). Nothing else outside my list.
- The celebration's towel and cheer now ease off after the first minute; anything that wanted the stands in full cry at the trophy (the rituals) should set its own `Crowd.focus`.

## Frame rate
Not profiled (the coordinator does). What it costs and where:
- **The TV views:** +5% triangles (4.17M → 4.38M at the last pitch). Most of it is the near crowd's sign quad (4 vertices a fan, folded unless he has a sign: ~2% more vertex work on the near level) and RailFigures (2.5× their triangles, drawn in the shadow pass too: there are a few dozen on the rails). The flashes are one additive draw whose sprites are folded to a point unless firing (a few dozen at a time, a few pixels each). The TV high view was the one at 27 ms in the rain: it's the one I'd watch.
- **The walking views:** +0.19M triangles at the 3B concourse (the crowd's close-level hair and signs, the rail's figures across the field).
- **The CPU:** nothing per frame but the flashes' two uniforms and the night's (a `Director.night()` call); no per-fan work.

## Noticed elsewhere
- The Cast's near figures' faces are still painted on a big flat head; at arm's length that's the most doll-like thing left (`final/w4-cast-knitP.jpg`).
- In the rain the 3B concourse's walkers' and the Cast's nylon read very glossy under the lights (FP1's note too).
- `home/Fans.js` circles the arm for the towel at one pace and the Cast's shader whirls the towel at another; tying the two (the arm's roll as the towel's angle) would make the twirl one motion.
