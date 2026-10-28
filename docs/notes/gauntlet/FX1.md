# FX1: the small leftovers (gauntlet, step 9)

Fixer FX1, 2026-10-28, branch `worktree-agent-a4279e723277100e9` (off `ballpark` at df8937f, FW4's merge). The leftovers the fixers named in their notes and didn't reach: strike three everywhere (FR2), the left field board's script at night (FW5, then C4R-8), the cotton candy vendor (FW4, C3W-12), the standing rows behind home (FW4), the Left Field Gate's canopy and the press box's sill (FW5), and one "noticed elsewhere" one-liner (FW4's poncho mix).

**Shots.** In this worktree's ignored `.claude/gauntlet/r4/FX1/` (absolute: `/Users/phillipforrence/citizens-bank-park/.claude/worktrees/agent-a4279e723277100e9/.claude/gauntlet/r4/FX1/`), all on the full park (no `only=`) at 1280 × 800, no console errors in any: `b0/` (before, on the branch's base), `a1/` (after tickets 1-4 and 6, the gate still as it was), `final/` (everything but the script's last values), `last/` (the last job: every ticket's after and TV center, at 3849cf0). The recipes are `<job>.json` beside each folder, made by `/private/tmp/claude-501/-Users-phillipforrence-Documents-HomeKit/4f4e82b4-ef9f-4fa0-a3f9-d023a05012fe/scratchpad/fx1/mkjob.mjs` (its page helpers: `__railLook( s, back, h, fov, side )` frames the 3B drink rail at a place along the walkway and returns how many of the rail's and the standing rows' places are taken; `__tinaAt()` frames the cotton candy hawker). Contact sheets and crops beside them: `sheet_b0_*.jpg`, `sheet_a1_*.jpg`, `sheet_ba_rail.jpg`, `sheet_final_*.jpg`, `crop_script_ba_ref.jpg`, `crop_press_plate.jpg`.

**The replay's clock** is untouched: `director.duration` 3785.503 and the segment starts' hash 801248349, as FR2's (checked in Node with FR2's `times.mjs`). Strike three is at 3481.903, the celebrate segment at 3485.503.

## Per ticket

### 1. Strike three, everywhere: done
- Keyed to `Director.champsAt( t )` now (the celebrate segment, its clock from the strike), each in a marked FX1 line or block:
  - `places/Concourse3BPeople.js` `nightState()`: the segment and `celebrateT`. Every place that reads `nightState()` follows: the 3B and 1B concourses, the club, the suites, the Terrace, left field, the clubhouse, the Alley's sounds.
  - `places/BehindHome.js` `_night()`: `N.seg`, `N.kind`, `N.lt` (so `N.celebrate`, `N.celT`, the flashes and the regulars' hugs).
  - `FieldLevel.js`: the Phillies' bench (and pen) leave the dugout at the strike.
  - `People.js` `update()`: the police along the warning track, the lines and the walkers.
  - `Landmarks.js`: the champions banner unrolls `BANNER.at` (150 s) after the strike, 3.6 s sooner than it did (FR2: "it unrolls later anyway"). Falls back to the celebrate segment under `oldCelebration`.
  - Also `places/FieldRail.js` (`S.celebrate`, one line): the camera wells turn to the pile and the rail's police come out at the strike. Not on the list, but the same 3.6 s, and it's on TV.
- Not changed (their timing doesn't hinge on 3.6 s, or they're someone else's script): `Rituals.js` (the stage and the party run from the segment's start, FR2's), `gate3b/Night.js` (the crowd reaches Pattison minutes later), `Concourse3BTV.js`, `rail/Police.js`'s own `t0`, `sound/` (FB3 moved the roar to the strike already).
- **Before / after** (TS + 2.5 s, still the `result` segment): `b0/s1-dugout-s2.5` (the bench in the dugout) against `final/s1-dugout-s2.5` (empty: they're out at the pile); `b0/s1-3bconcourse-s2.5` (fans walking) against `a1/` and `final/` (everyone at the rail, towels up); `__railLook` counts at that moment: the rail behind home 14 → 21 of 21 taken, the standing rows 61 → 102. `sheet_b0_strike.jpg`, `sheet_a1_strike.jpg`, `sheet_final_c.jpg` (top row).

### 2. The left field board's "Phillies" script at night: done (with C4R-8)
- **What it was:** FW5's "unlit at night" was from the Left Field Gate's plaza: the letters' backs were plain dark maroon, black against the night sky (`b0/s2-script-back-tele-29`). From the field it was lit, but at 2.2 × the texture it blew out to salmon pink with a white-hot rim (`b0/s2-script-from-plate-29`; C4R-8).
- **The photos:** from the field (flickr 7630606N06 2987955241, Oct 29 2008; ronniebruce 2988340492, Oct 27; `.claude/ref/night/`), a deep red fill, a thin warm gold outline, blue stars, dimmer than the video board. From the plaza (ronniebruce 2988349308, Oct 29; `.claude/ref/leftfield/flickr-2008-10-29-...-postgame-left-field-gate-...` and the night postgame photo): the reversed letters' backs dark over the board's back, with warm light along their edges. By day the backs are maroon (Commons 2008-03-29), as they were.
- **Now** (`Landmarks.js`, the `script-sign` and `script-backs` surfaces, one FX1 block): by night the faces at 0.7 of the texture's red with the green and blue cut (under ACES's shoulder: at 1.15 it still read orange-red, `final/`), the stars bright blue, the outline gold at 0.45; the backs' outline glows a warm gold at 0.22 by night, the backs a faint warm 0.05.
- **Before / after:** `crop_script_ba_ref.jpg` (b0 over last over the 2008 photo: salmon with a white halo, then deep red with a gold rim beside the photo's), `b0/` and `last/` `s2-script-from-plate-29` and `s2-script-back-tele-29` (the backs from the plaza: black before, the reversed letters' edges gold after).
- **Left:** the letters are Georgia italic on a canvas, not the club's script (it's drawn, so no photo or generated image of real signage); the neon tubes inside the faces aren't drawn.

### 3. The cotton candy vendor's bags: done
- FW5 had already made the 3B cart's octagonal cans into pillows (`Concourse3BProps.js`, in the merge; `b0/s3-cart-rack-side`). What was still "a pole of octagonal blocks" was the hawker in the seats behind home, Tina Maldonado (`home/Gear.js` GEAR.cotton: a steel pole at the hip with twelve six-by-four blobs round its top).
- **The photos** (`.claude/ref/concourse3b/getty_2009-08-06_89878128_cotton-candy-vendor.jpg`, `2007-09-30_flickr_pompomflipflop_2109470277_cotton-candy-vendor.jpg`): the park's cotton candy hawkers carried a stained plywood board on the head, one hand up to steady it, the bags standing on it, each on its paper cone pushed through a hole in the board (the cones' ends show under it), pastel pink and blue floss in clear bags pinched at the top.
- **Now** (`home/Gear.js`, `home/Build.js` three palette entries `plywood`, `flossPink`, `flossBlue`, `home/Aisles.js` `holdGear()`): the board (with a lip front and back) on her head, ten lumpy bags in two staggered rows (10 × 6 sides each, pinched to a white tie, the bag's twisted neck above it), the cones' ends below; her left hand up on the board's edge (`armIK` reaches it: hand within 1 cm, the elbow just over the shoulder). Same instanced draw.
- **Before / after:** `b0/s3-tina-*` (my first framing landed inside the aisle's tunnel: no usable before; the old pole is the code above and C3W's `j2-08`), `a1/s3-tina-field-29`, `a1/s3-tina-above-29`, `final/s3-tina-field-27` (in her yellow poncho on the 27th).
- **Left:** the floss is a lit pastel with a plastic sheen, not a translucent bag over floss; the board doesn't tilt.

### 4. The 3B standing rows step up to the rail: done
- **What it was:** behind home (`_standing()`: rows from 31.35 m, the drink rail at 30.1) the rows fill to how wet the night is and the rail to its own share (25% in the delay, 50% in the game), so in the delay most of the rail behind home stood empty with the front row a metre back from it (`__railLook` at 2215: rail 6 of 21 behind home, front row 22 of 35).
- **Now** (`_atRail`, one FX1 block): a front-row stander looks every 1-3 s for a free place on the rail within 0.9 m along it, walks the metre up to it and leans on it (the rail's own poses: forearms on it, a beer on the shelf, folded, a hand on it); the newcomers fill the front row's places from behind, as before. At 2215 the rail behind home is 16 of 21, at 2185 19-20 of 21 (11 before).
- **Before / after:** `sheet_ba_rail.jpg` (b0 left, a1 right: `s4-rail-delay-2215` and `s4-rail-delay-side`), and `final/`, `last/` the same names.

### 5. The Left Field Gate's canopy: partly
- **Checked** against the Game 5 arrival photo (`.claude/ref/leftfield/flickr-2008-10-27-game5-arrival-left-field-gate-carlton-statue-...`), the postgame photo of Oct 29 and flickr 2006-08-12 under it: the bar gates reach nearly to the canopy's beams and its top runs along the foot of the Phanatic's picture. Ours had 1.4 m of air over the 3.5 m gates (soffit 4.9 m), and from the plaza the fascia hid the picture's middle.
- **Now** (`Exterior.js` `_buildGate`, one FX1 block, the Left Field Gate only): soffit 4.2 m, top 5.3 m (0.7 m lower). The braces, the globes, the sign and the green letters on top come with it. `a1/s5-lfgate-square-24m-day` (before) against `final/` the same.
- **Left (not mine now):** from the plaza the Phanatic's picture still sits mostly behind the canopy, where every 2008 photo has it standing clear above it, its foot at the canopy's top: the picture's box (`places/leftfield/Plaza.js`, FW5's, FC4's now) wants to be higher or further forward. And the photo's Carlton stood out in front of the gate, square to it; ours stands 15 m along the facade (`data/surroundings.js` STATUES), so the "from the statue" framing can't be matched. The Right Field Gate's canopy (same builder) is unchanged: I didn't check it.

### 6. The press box's sill behind the club level's boards: done (the photos disagreed)
- **The photos:** yeago81 5247698087 and 5247898427 (2009, the booths as in 2008: the same stations, the same black bunting): under the booths' sill, brick and the seats' top row; no boards in front of the press box (the deck fronts behind home are plain concrete with speakers).
- **Ours:** the press box stands in the 300s' tier where its seats are skipped (`Bowl.js`, `terrace-300`'s `skip`), and `Fascia._terrace` hung its ads and LED (the LED segment, MasterCard, the Citizens Bank Park panels) along that tier's front right across the booths.
- **Now** (`Fascia.js` `_terrace`, one FX1 block): nothing hung over the tier's skipped front (the press box's span); the rest of the list keeps its places. `crop_press_plate.jpg` (b0 over a1, from the plate), `sheet_final_c.jpg` (bottom row, from the 3B side close below).
- **Left:** what shows under the booths now is the tier's dark front band, not FW5's white sill over brick (that face of the press box sits behind it); and the club seats under the booths in the photo are glass in ours (the structure: the press box is on our 300s, where the photos have it at the back of the 200s).

### 7. "Noticed elsewhere" one-liners
- **Done: the 3B Cast's ponchos** (FW4's note; `places/Concourse3BKit.js` `dress()`, one line): the 27th's mix as FW4 set the throng's from Getty 83891095 and 83457911: clear 62, yellow 13, red 10, orange 6, trash bag 6, white 3 (was clear 60, red 25, white 10, yellow 5). `final/s7-3b-ponchos-27`.
- Looked at, not done: the tarp's cover heap (FR2: a structural length, `rail/Tarp.js`); the rail's hidden bat boy figures (FR2: cleanup, not a look); the Cast's coat (FW4's, Cast.js); the crowd's crinkle banding (Crowd.js, SP3's file now); the distant Cast figure (FW5, perf track).

## Counts

`JSON.stringify( __app.engine.meshRenderer.stats )`, full park, 1280 × 800, read in the next shot's js (the same view held).

| View | Before (`b0/`, the base) | After (`last/`) |
|---|---|---|
| TV center (play 20) | 496 draws, 3,458,124 triangles, 766 pipelines | 497 draws, 3,467,516 triangles, 766 pipelines |
| The 3B rail behind home in the delay (`__railLook( 12, 3.5, 1.9, 60, 5 )`, seek 2185) | not read in `b0`; `a1/` (tickets 1-4 in): 830 draws, 4,408,678 | 831 draws, 4,428,366 |

- **TV center:** +1 draw (within the LOD's carry-over between jobs), +9.4k triangles: the hawker's board and bags, counted once per vendor instance in the gear's draw (below). Pipelines unchanged: the script's and the palette's changed shaders replace their old ones.
- **The rail view:** the same draws within one; +20k triangles between `a1` and `last` (the 3B Cast's poncho mix: more ponchos drawn as film, a few more people at the rail as middle figures).

## For the merger
- **Files** (every change in a marked FX1 line or block): `src/ballpark/People.js`, `FieldLevel.js`, `Landmarks.js` (the banner's clock; the script's two surfaces), `Fascia.js` (`_terrace`), `Exterior.js` (`_buildGate`'s heights), `places/Concourse3BPeople.js` (`nightState()`, `_atRail`), `places/Concourse3BKit.js` (`dress()`'s poncho pick), `places/BehindHome.js` (`_night`), `places/FieldRail.js` (one line), `places/home/Gear.js` (GEAR.cotton), `places/home/Build.js` (three palette entries at the end), `places/home/Aisles.js` (`holdGear`). Nothing in `src/engine/`, `src/materials/`, `Stands.js`, `Crowd.js` or `places/leftfield/`.
- `nightState()` now returns the celebrate segment from strike three: anything that reads `ns.seg`, `ns.result` or `ns.celebrateT` sees the celebration 3.6 s sooner (a strikeout's `result` reaction gives way to the champions' at the strike).
- `home/Build.js`'s `PAL` has three more entries at its end (no index moved).
- The Phanatic's picture over the Left Field Gate (ticket 5's "left") is FC4's to place.
- No images, sounds or people added: CREDITS.md and CAST.md unchanged.

## The frame-rate risk
- **TV center:** the hawker's board and bags are in the gear's one instanced draw; every instance carries every gear's vertices (folded away by tag), so its ~1,400 more triangles count once per vendor drawn: about +9k triangles in TV center (3.458 → 3.468 M), no new draw or pipeline.
- **The script:** a few more ALU on its two materials, a few hundred pixels from most views.
- **The rail:** a front-row stander checks ~21 places every 1-3 s on the place's own cadence: nothing measurable. More people at the rail behind home in the delay, but they're the same Cast figures moved a metre.
- **The canopy and the press box:** the same meshes, smaller or with fewer quads.
- I'd watch nothing in particular; if TV center's +9k matters, the bags' 10 × 6 sides could go to 8 × 5.

## Noticed elsewhere
- **The Phanatic's picture over the Left Field Gate** sits behind the canopy from the plaza (ticket 5).
- **The press box is on our 300s** where the 2009 photos have it at the back of the 200s (club seats in front of its brick); from below, under the booths, ours shows the 300s' front band and the club's glass.
- **The Right Field Gate's canopy** uses the same 4.9 m soffit; unchecked against photos.
- **The Left Field Gate's sign** reads LEFT FIELD GATE in white on the maroon fascia; the 2008 night photo has it in red lit letters, the 2006 one on a navy box hung under the edge.
- **The 3B concourse's poncho-wearers** (the Cast's poncho shape) read as grey slabs from behind at arm's length on the 27th (`final/s7-3b-ponchos-27`): the film's crumple shows, the shoulders don't.
