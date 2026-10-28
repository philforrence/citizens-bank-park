# FB1, round 1: the bowl, the roofs and the boards (critic CB's tickets)

Fixer FB1, 2026-10-28, branch `worktree-agent-a69e6ed791fccac3a` off `ballpark` (214f49c). The tickets are CB's findings (`.claude/gauntlet/r1/CB.md`). Four desk jobs, all on the full park at 1280 × 800, plus one scoped diagnostic. The "before" shots are CB's own, taken on the same commit (`.claude/gauntlet/r1/CB/shots/job{1,2,3}/`), and my job 1, which framed the new views before any change.

My jobs and shots are in the worktree under `.claude/gauntlet/r1/FB1/`. That folder is gitignored, so the absolute path is `/Users/phillipforrence/citizens-bank-park/.claude/worktrees/agent-a69e6ed791fccac3a/.claude/gauntlet/r1/FB1/`:
- `mkjob.mjs` generates the jobs;
- `shots/job1-before/`, `job2-after/` (CB-1, 4, 10), `job3-after/` (CB-2, 3, 5, 7, 8, 9, 11, 12), `job4-after/` (the rest, and the last full-park check).

**The counts** (TV center, the 29th, play 60):

| | draws | triangles | pipelines |
|---|---|---|---|
| Before (job 1) | 792 | 6,133,170 | 673 |
| After (job 4) | 794 | 6,177,634 | 676 |

Almost all of the +44k triangles are the seats and fans that now fill the 400s' old tunnel openings (CB-13). The bunting, the banner, the lamp heads and the press box's fascia together add a few thousand. Job 4 had no console errors.

## Done

**CB-1, the bunting** (Fascia.js `_bunting`, `fan()`, `drawBunting`)
- **The change:**
  - The fans are now 2.1 × 1.5 m (a 2.2 × 1.6 m cloth). Each is tied on at the pipe rail 0.3 m above the fascia's top and hangs below the precast band's lower edge.
  - Each fan is 14 flat facets radiating from the top centre, with alternate folds standing 6 cm out, so the pleats catch the light. The edge is scalloped.
  - The texture is redrawn: a wide red outer band, a white band, and a blue centre with five stars, plus fold creases and sheen.
  - New field-level fans on the low wall's rail: a pair just past each dugout's far end, and one in each corner 6 m from the pole end.
  - One mesh in all, the same material (it's in Night.js's FABRIC list, so it soaks in the rain).
- **The evidence:** yeago81 2007 (the fans' shape and drape), Getty 84080911 (the LF-corner rail fan), luidude 2981634108 (the pair on the 1B rail past the dugout), Commons 2008-03-29.
- **Before:** `job1-before/bunting-3b-club-from-field-day.jpg`, `lf-corner-rail-29.jpg`, `1b-far-well-day.jpg`; CB `job2/bunting-3b-club-tele-day.jpg`.
- **After:** `job2-after/` and `job3-after/bunting-3b-club-tele-day.jpg`, `job2-after/1b-far-well-day.jpg`, `job4-after/foul-pole-lf-29.jpg` (the LF corner fan).
- **What's left:** the fans are flat-faceted, not cloth-simulated. The LF-corner fan in `lf-corner-rail-29` happens to sit behind a groundskeeper.

**CB-4, the World Series logos** (Details2008.js)
- **The change:** turned 45° (`turn` ±π/4), so each baseline is parallel to its foul line and the top faces fair territory. That makes each read upright to the fans behind its dugout. They're centred at [∓13.2, −2.6], 11 m out along the line and 7.5 m off it.
- **The evidence:** Getty 163678267, from high behind home: the 3B logo's MLB block upper right, the 1B logo's upper left, as now in the model.
- **Before / after:** `job1-before/tv-high-27.jpg` / `job2-after/tv-high-27.jpg`; `ws-logo-from-{3b,1b}-seats-day.jpg`.
- **For the merger:** places/phanatic/Night.js still uses the old spot [12, −3.8] for the little Phanatic "by the logo". He now stands at the logo's edge, which is fine, but whoever owns that file can move him.

**CB-10, the champions banner** (Landmarks.js `_champsBanner`, `drawChampsBanner`, `update`)
- **The change:**
  - A 6.4 × 8.5 m red sheet hangs off the batter's eye's cap over the middle ivy mass, at bearing −1.7°, down to the shrubs. It follows the wall pieces, 0.1–0.28 m off the brick.
  - It's creased (fold grid and wrinkles in the shader) and sways a little in the vertex stage.
  - It unrolls from the top 150 s into the celebration (Director's `celebrate` segment, 300 s long), over 9 s.
  - The texture is drawn in the photo's spirit: the globe, orbit ring and ball, the P in its ring, WORLD SERIES on a navy plaque, CHAMPIONS, 20 · the Series logo · 08, the white band with the script and two stars, and WinCraft's tag. One mesh, one 768 × 1024 texture, casting no shadow.
- **The evidence:** Getty 83486029; pompomflipflop 2986379660.
- **Before:** `job1-before/batters-eye-after-win-29.jpg`.
- **After:** `job2-after/batters-eye-after-win-29.jpg`, `batters-eye-unrolling-29.jpg`, `champs-banner-close-29.jpg`; `job4-after/batters-eye-after-win-29.jpg`.

**CB-2, the rain** (game/Rain.js; Night.js `naStreaks`)
- **The cause:** the long white lines were drops 0.6–2 m from the lens. A 0.26 m streak there crosses a quarter of the frame. TAA also blended each drop's motion with the background's.
- **The change:**
  - The near fade now starts at 1.2–3.5 m (plus the lens's focus term).
  - Each dash is capped on screen at 5 px (wide lens) to 7 px (long lens), and is never thinner than a pixel. Alpha is scaled when a dash is widened to cover a pixel.
  - The base length is halved (0.05–0.13 m).
  - The box is centred 9 m ahead of the focus point, so less of it sits behind the camera. Drops go from 14,000 to 20,000.
  - `VELOCITY_OPAQUE` (as AirMotes uses it) lets each drop own its pixel's motion vector.
  - The long lens gets 1.7× alpha, so the TV center camera shows the speckle.
  - Night.js's far sheets have smaller cells (0.22 × 1.2 m), and each dash there is capped at about 5 px.
- **The evidence:** Getty 83885893 and 84081811 (the fine dense speckle).
- **Before:** CB `job1/roofs-from-cf-27.jpg`, `1b-field-27.jpg`; `perf/baseline/tv-center-27th.jpg`.
- **After:** `job3-after/roofs-from-cf-27.jpg`, `1b-field-27.jpg`; `job4-after/tv-center-27.jpg`, `tv-high-27.jpg`.
- **What's left:** in the darkest sky, the far sheets' cell grid can show a faint regularity.

**CB-3, the light banks in the rain** (Night.js)
- **The change:**
  - The drops' narrow lobe is `sigmaN = 0.0003 + 0.0007·rain`, a third of what it was, and `gN` goes 0.9 → 0.97 in the rain.
  - The broad part's cubic rain term is 0.0012 → 0.0009.
  - `naSpot`'s spill floor outside the cone is halved (0.05 → 0.025), so the lit air sits in the beams.
- **The evidence:** Flickr 74085116N00 2981641556, Getty 84081811, 84081873.
- **The result:** the banks are tight rectangles with a small halo and their grids show again. The stands under them are readable, no longer milky.
- **Before / after:** CB `job1/roofs-from-cf-27.jpg`, `1b-field-27.jpg`, `lf-upper-raindelay-27.jpg` against `job3-after/` same names.
- **What's left:** the cone of lit drizzle below each bank is only faint. The bloom (post, not mine) still rounds the brightest lamps a little.

**CB-5, the dugout roofs** (places/rail/Drips.js)
- **The change:**
  - The standing water is now the roof's own white (0.72), roughness 0.03, at most 22% alpha.
  - It sits only in a few thin pools along the back edge (more than 2.2 m back from the front).
  - It's off on the 29th, and the mesh is hidden when dry.
- **What covered the 1B pond:** nothing. Its noise just fell under the threshold there.
- **Before / after:** CB `job3/dugout-roof-3b-rain-27.jpg` / `job3-after/dugout-roof-3b-rain-27.jpg`, and `tv-high-tarp-27.jpg`.

**CB-9, the tarp** (Details2008.js `tarpMat`; places/rituals/Roll.js)
- **The change:**
  - The vinyl is (0.86, 0.87, 0.85) with a 0.25 night lift, so it's the brightest thing on the field.
  - Long wrinkles, and its seams.
  - Puddles only in the sheet's own low folds (the same fold function the geometry uses): 6% darker, roughness 0.12, so they catch the banks and no longer mirror the black sky as dark spots.
  - The roll's outer layer is the same white.
- **The evidence:** Getty 84081873, 83458710.
- **Before / after:** CB `job3/tarp-close-27.jpg`, `job2/tv-high-tarp-27.jpg` / `job4-after/tarp-close-27.jpg`, `job3-after/tv-high-tarp-27.jpg`.
- **What's left:** no black tube on the far edge.

**CB-7, the ribbon boards** (Fascia.js `drawRibbon`, `update`)
- **The new `game` design**, on red: the WS2008 block; the line score in a black box (TB / PHI, nine innings, R H E); the TR roundel, MLB logo, WORLD SERIES 2008 and the P roundel; and the batter in a black box (a small head shot, number, name, position, his 2008 AVG / HR / RBI from Phanavision's `SEASON`).
- **The other designs:** `october` is now white on red. `ws` (the intros) is blue 2008 graphics.
- **The schedule:** the walk-up and between halves show `game`; the rotation is half `game`, with `october` and the red NL champions in it, and `msg` and `citizens` once each per cycle.
- **The Terrace LED segments** share the texture, so they're red too.
- **The evidence:** Getty 84080911, 83571001, 163678267.
- **Before / after:** CB `job2/bunting-3b-club-tele-day.jpg`, `lf-corner-from-1b-29.jpg` / `job3-after/` same names.
- **What's left:** at a distance the line score's digits run together a little.

**CB-8, the out-of-town board** (Details2008.js `drawOutOfTown`)
- **The change:**
  - Turkey Hill at the 398 end.
  - Two rows of dark cells (6, then 5 columns), each black with a grey diamond outline. The grey stays under the material's 0.55 lit threshold, so the diamonds are painted, not lit.
  - A lit white panel with this game's pitcher and his B/S/P count small in navy, then Majestic, then a blank lit white panel, and Modell's by the pole.
- **The evidence:** Flickr 74085116N00 2981641556; the Alley's 2008-10-27 dusk crop.
- **Before / after:** CB `job1/rf-wall-from-1b-29.jpg` / `job3-after/rf-wall-from-1b-29.jpg`.

**CB-11, the backstop's colours** (Field.js; places/rail/Backstop.js, one marked `FB1` block)
- **The change:**
  - The cushions and the cap are now (0.027, 0.094, 0.072), a dark grey-green, where they were a saturated teal.
  - The brick is (0.15, 0.04, 0.027), and its mortar is darker and half as strong.
  - The night emissives are kept: the park's whole night look relies on them, so I corrected the albedo against the measured TV-frame ratio instead.
- **The evidence:** Getty 83485455, 83885893.
- **Before / after:** CB `job1/tv-center-29.jpg` / `job3-after/` and `job4-after/tv-center-29.jpg`.

**CB-12, the seats at night** (Stands.js `seats`; I didn't touch SOFFIT_WGSL)
- **The change:** the night lift is 0.12 → 0.03, and BLUE is [0.032, 0.075, 0.25] (a shade deeper).
- **Before / after:** CB `job2/pens-from-rf-seats-29.jpg` / `job3-after/pens-from-rf-seats-29.jpg`.

**CB-13, the 400s' slabs** (Bowl.js)
- **The change:** `terrace-400` has no `portals` now. The 400s are entered from the walkway along their front, up the aisles.
- **The result:** the grey slabs are gone from every view; the LF-end block was one of them.
- **Before / after:** CB `job1/3b-upper-29.jpg`, `roof-underside-1b.jpg` (the 1B 400s across) / `job4-after/` same names.
- **Side effect:** CB's `__seat` eye at terrace-400 [−75, −20] row 12 now lands inside a fan seated where the slab was. The maroon bar across `job4-after/3b-upper-29.jpg` is that fan's arm. The scoped diagnostic (`shots/diag/`) shows the structure itself is clear.

**CB-16, the roof's lights and speakers** (Bowl.js `_roof`, `lampHead()`, `cabinet()`)
- **The lights:** each is a 10-sided dark drum, r 0.3 m and 0.42 m deep, aimed down at the field (0.55 out, −0.83 down). It has a visor over the top half and a round glowing face (`roof-edge-lights`, brightest at the centre), on a two-arm yoke from the truss chord.
- **The speakers:** each is a tapered black cabinet with a grille on its face, on a hanger.
- **Counts:** the same as before; about 64 triangles per lamp.
- **Before / after:** CB `job1/roof-underside-1b.jpg`, `upper-home-29.jpg` / `job4-after/` same names.

**CB-14 in part, the Linc and the lots** (Complex.js)
- **The Linc:** the glass bands are dark, with about one window in ten lit (0.3); the rest is 0.012.
- **The lots:** the pools' emissive uses the bare asphalt with the stall lines at 35% contrast. The broad term is 0.5 → 0.22, so the light falls off between the poles.
- **Before / after:** CB `job2/view-out-south-from-400-29.jpg` / `job4-after/view-out-south-from-400-29.jpg`.
- **What's left:** the lots aren't filled with cars (see below).

**The cross-zone notes**
- **The FOX virtual ad:** no change needed. places/home/Backstop.js already shows the ad only through the center field camera (`camMode === 'center'`), and `__qa.look` switches back to walk. CB's own walk shot `job3/backstop-net-from-field-29.jpg` shows the panel plain green.
- **The orange disc** (places/leftfield/Ramp.js, one marked `FB1` block): it hangs 2.4 m across under the west end of the left field deck over the top rows, as in Commons 2008-03-29's zoom. It used to stand on the ramp's top landing at 27 m.
  - The brand on it is still the unconfirmed "Gulf".
  - **Before / after:** CB `job3/foul-pole-lf-29.jpg` / `job4-after/foul-pole-lf-29.jpg`.

## Partly done or not done

**CB-6(a), the press box roof in the 400s' view of home plate: not done.** The geometry rules it out without a structural decision:
- **The measurements:**
  - The press box front (with its tilt) is at z ≈ 42.3 behind home. Its glass tops out at 23.75 m, and its roof sits at 24.55 m.
  - The 400s start at z 51.8 (D.t300Back + 2.4).
  - From row 3 (eye at z 54.7, y 28.8), the sightline to home passes z 42.3 at 22.3 m. Even from row 15 it's 23.6 m.
  - So the glass itself, not just the roof, hides the plate, and lowering the roof can't help.
  - The club's back rows sit right under the press box floor (19.65 m), so the box can't come down either.
- **In 2008:** the 400s' front rows overhang the press box (Getty 83457165, 84082684).
- **Two ways to fix it:**
  1. Recess the press box about 5 m and make it shallower (glass at about D.t300 + 5, so it clears from row 1 up). Move the high-home camera spot (`cameraSpots[2]`) back with it. The TV high framing changes a little.
  2. Bring the 400s' front forward behind home (a variable-offset front, and rows added at the back to keep the rear wall).

  Either touches the profiled TV high view or the stands' build, so it's the coordinator's call.
- **What I did do (part b):** the free-standing Terrace elevator doors with their glowing sign now stand at the walkway's front edge facing the walkway, with a one-sided sign. The home bank's is at the press box's first-base end. `job4-after/press-roof-from-400-row3-29.jpg`: the black door is gone from centre.

**CB-15, the press box: partly done.** The fascia, signs and dimmer rooms are done. The bright white band with rows of lights that spans the whole infield at that height in `press-box-from-mound-29` is mostly the underside of the 400s and the concourse ceiling (Stands.js SOFFIT_WGSL). That's FI1's now, so I left it.

**CB-14, the empty lots: not done.** Filling the lots toward the Linc and east of the 1B side with places/gate3b/Cars.js's instanced cars, at a coarse LOD, is left.

## Noticed elsewhere

- **The rally towels** are rigid white boards in every seat view, and from row 12 of the 400s some fill a quarter of the frame. That's CB's cross-zone note, for Crowd.js's fixer.
- **The __seat helper's eyes** often land inside fans now that the 400s' openings have seats. Critics should add a little `dy` or pick aisle seats.
- **Seen from the field at night**, the 400s' soffit and the concourse ceilings read as one evenly lit white band round the infield, as noted under CB-15.

## The frame-rate risk

- **Rain** (Rain.js): 20,000 drops instead of 14,000 (vertex work +43%; each still runs an 8-light loop per vertex). The fill falls a lot, since the long near streaks are gone. It's only on in the rain. To win frames back if needed, drop N to 16,000; the box shift alone doubled the drops in view.
- **The 400s' openings filled:** about 500 more seats and fans in the 400s (+44k triangles in TV center), all instanced and batched.
- **Everything else:** a handful of quads, one 768 × 1024 and a few small canvas textures, one extra draw for the lamp housings and one for the press fascia (+2 draws, +3 pipelines).
