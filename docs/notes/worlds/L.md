# L: light and night (wave 3)

Branch: `worktree-agent-ac37d68521dbfed8f` (9 commits on `ballpark` bb62637). My module is `src/ballpark/Night.js` (`app.night`); everything in shared files is in `// ---- L` blocks.

**References:** `.claude/ref/night/` (192 images and `INDEX.md`, with the facts and a table of which Center City towers stood in October 2008). They include FOX frames of both nights (YouTube storyboards, 320 × 180), Getty and Flickr photos of the park, the lights and the skyline on the nights, and the airport's METARs.

## What changed

1. **Rain wets each kind of surface its own way** (`engine/render/wgsl/lighting.js` `shadeSurface`; PLAN 4's "rain gloss"). Evidence: Getty 83885893 and 84081829 (clear ponchos shine, jackets soak).
   - **Hard ground** (the default) darkens under a broken film of water, pooled in places. The pools come from warped sines, which are cheap. At night the film mirrors less of the sky probe.
   - **Bare metal** beads: its sheen tightens.
   - **Cloth** (`WET_FABRIC`) soaks: darker, a little richer, and matte. Skin takes a thin sheen, and smooth things (ponchos, vinyl, helmets, eyes) bead and shine.
   - `WET_FABRIC` is set on `people`, `bunting`, `flag-cloth`, `tv-cameras` and the crowd's three materials (from Night.js; Crowd.js is untouched).
2. **The night air** (Night.js, in AirHaze's march and composite). Each light bank lights the rain and mist in front of it, depth-aware:
   - **Two lobes:** a broad one for the beams seen from the side, and the drops' narrow forward lobe for the glare round a bank you look into.
   - **Rain in the light:** on the 27th, streaks show in that lit air, and past the park the rain veils Center City. Its visibility was 4–5 mi at the airport by 10:15 pm.
   - **SkyGlow's halo sprites are off.** They sat 10 m and more above the banks.
   - **Evidence:** Getty 83458502 and 83458121, luidude 2980716306 (the lit cone under a bank), FOX t2h26m20s (a curtain of lit rain) and t2h03m20s (the downpour greys the bowl).
3. **Half resolution:** the banks' in-scatter is computed in the haze march's free `w` channel and upsampled depth-aware. After dark the sun-shaft march is off, since it marched the stadium key as if it were a sun. At full resolution the air cost 2.5 ms; now it's a net saving (see Cost).
4. **The stadium key has a footprint at night** (the `directModulation` hook):
   - full on the field, ~40% on the stands, ~30% just outside the park, fading to ~4% past the lots;
   - the banks' spots narrowed to 26°/52° (`BEAM`), so the stands under a bank get its edge.

   The FOX and Getty frames of both nights show the field bright, the stands dimmer and the surroundings black (the blimp shots).
5. **H07** (Bowl.js `_suites`): the suite level's underside over the main concourse is now a lit soffit, and the suites have a back wall. From the concourse you had looked up into their open backs, at the unlit ceilings: a black slab by day and night.
6. **FOX's broadcast grade** (any TV camera): a little more contrast and saturation, balanced to the lamps, and a brighter exposure target at night. The home whites are white and the night sky navy-black, as in Getty 83485455 and 83486198 and the FOX frames. The settings panel's grade stays the base.
7. **The long lens's rain:** streaks of 1/100 s (Rain.js, one line), the fine rain of the center field frames on the 27th.
8. **The 2008 skyline:**
   - **Left out:** 20 towers finished after the Series (the research's table), among them Comcast Technology Center, FMC Tower, the W and The Laurel.
   - **Lit floors, not a sprinkle of dots:** where a window is finer than a pixel, the floor's share glows.
   - **The crowns as lit on the nights:**
     - Two Liberty's gables in red, white and blue on the 27th (btjones 2996432962);
     - One Liberty's and Mellon's red;
     - Comcast Center's white top with a red ring for the Series;
     - the Cira Centre's red LEDs with the Phillies' P;
     - the PSFS sign;
     - City Hall floodlit, its clock faces amber;
     - red obstruction lights on the tall roofs.
9. **The Holiday Inn Philadelphia Stadium** (1974–2019) beyond right-center: an 11-storey dark slab with a scatter of rooms lit, one or two in a TV's blue, and the green script on its roof. Sources: andrewwinn 2605278835, bub_56 2994754127. Its footprint isn't known, so it's a 60 × 16 m slab.
10. **The city beyond:** South Philadelphia's sodium street grid on the ground past the complex, blurred along each axis. The lots' tall poles are metal halide, white with pools rather than an orange carpet (roadieshow 3024603196, Getty 83476821).
11. **The two nights:**
    - **The 27th:** a dimmer lit sky over the bowl, and the rain's veil.
    - **The 29th, after dark:** the airport's "few" clouds and a dry, clearer air.
    - **No moon either night** (new on Oct 28, 2008). The fake moon's blue sky had been sheening every wet reflection.
12. **The light towers:**
    - each fixture's metal-halide tint drifts (pink, blue-white), as in Getty 84081811;
    - from the street, the gate towers' fixtures show lit (roadieshow 3023773899).
13. **Phanavision's colour on the fans in front of it:** one spot light, coloured from a 12 × 10 sample of the board whenever it's redrawn, at most every 1.5 s.

**Not needed:** "the dusk before the first pitch". First pitch was 8:37 pm, about 2.5 h after sunset (6:03), so the replay never starts in twilight.

## Cost

All numbers are GPU ms per frame at 1280 × 800, taken under the lock's exclusive mode.

**On the same page** (`app.night.off` restores the old haze and turns the night air off):

| View | L on | L off | Difference |
|---|---|---|---|
| TV center, 27th | 23.38 | 23.94 | −0.56 |
| TV high, 27th | 28.80 | 29.49 | −0.69 |
| Overview, 27th | 27.67 | 28.13 | −0.46 |
| TV center, 29th | 23.01 | 24.00 | −0.99 |

**Against the "before" page** (a different session):

| View | Before | After |
|---|---|---|
| TV center, 27th | 22.13 | 23.38 |
| TV high, 27th | 27.91 | 28.80 |
| Overview, 27th | 26.13 | 27.67 |
| Plaza, 27th | 23.18 | 24.09 |
| TV center, 29th | 23.33 | 23.01 |

- **The rainy-night rise is unexplained.** On the 27th the opaque pass came out about 1 ms higher than in the before session (15.4 against 14.3), while on the dry 29th it didn't move (15.5 against 15.4).
  - In the before session the 27th's opaque pass was oddly 1.1 ms cheaper than the 29th's.
  - I couldn't pin it down within my three exclusive runs.
  - **For the coordinator:** A/B `G.wet` and `WET_FABRIC` under exclusive.
- **Draws, triangles and pipelines at load:** 773 / 6,040,346 / 627 before, 777 / 6,039,842 / 631 after.
- **CPU:** nothing per frame beyond a few uniforms, plus the board sample (a 12 × 10 `getImageData` at most every 1.5 s).

## Screenshots

In `.claude/wave3/L-shots/` (local), copied from the worktree's `.claude/l/`:
- `before/`: the base.
- `after/`: the final code, 1280 × 800.

The views are the same in both, so compare by name:
- `tv-center-27`, `tv-high-27`, `overview-27`, `plaza-27`, `tv-center-29`;
- `skyline-27`, `skyline-29`;
- `concourse-up-27` (H07), `home-from-field-27`, `lf-board-27`, `gate-towers-27`, `tv-center-day-29`.

Only `after/` has:
- `skyline-zoom-29`, `aerial-27`, `bowl-29`, `tv-high-29`, `h07-day`;
- `night-skyline-29` and `day-tv-center`, from the last check run.

## Shared files touched (all `// ---- L`)

- **`engine/render/wgsl/lighting.js`:** the rain's wetting in `shadeSurface`. **Everyone:** a cloth or people material should `setDefine( 'WET_FABRIC', 1 )`, or `DRY` if it has its own rain.
- **`post/AirHaze.js`:** an optional `nightModule` (`HZ_NIGHT`). The march writes `w`, the temporal pass keeps `w`, and the composite upsamples it.
- **`ballpark/BallparkApp.js`:**
  - the `Night` import and construction;
  - `night.update()` in `_frame`;
  - the banks' cone angles;
  - the halo sprites off;
  - `_weather`: `skyGlow` dimmer, and the 29th's clouds and haze after dark;
  - the street grid passed to `Ground`.
- **`ballpark/Bowl.js`:**
  - `_suites`: the underside and the back wall;
  - `_portalTower`: the per-fixture uv;
  - the lamp and housing shaders.
- **`ballpark/Surroundings.js`:** `AFTER_2008`, `CROWNS`, the windows, City Hall, `_nightCrown`, `_beacons`, `_holidayInn`.
- **`ballpark/Complex.js`:** the lots' halide pools and pole heads.
- **`ballpark/Ground.js`:** the far city's lamps (an optional `grid` parameter).
- **`ballpark/game/Rain.js`:** the long lens's streak length.

**R (the rituals):** I read `app.rain.amount` for the air, so whatever your block in `_weather` sets through the delay, the air follows.

## What I'd keep working on

- **Find the 27th's ~1 ms opaque rise** with an exclusive A/B of the wet path.
- **The far city:** a flat plane still shows its receding streets as a faint sunburst. Low rooftop masses in front would hide it properly.
- **The ribbon boards' light on the fans.** The FOX frames show the magenta WS2008 ribbon colouring the rows. It needs a line light, or a term in the crowd's shader (Crowd.js, the coordinator's).
- **A lens starburst on the banks for the TV cameras,** as FOX's frames on the 29th show; rarely in frame from the three TV cameras.
- **Wet surfaces under cover still get wet.** `shadeSurface` doesn't know the rain cover map (the club concourse floor, for one).
- **The PECO crown's amber ticker, and the Centre Square heights** (the research says they're swapped).
- **The suites' back wall** is plain precast. No photo of it from the concourse was found.

## Pictures I'd like from the owner

- The main concourse behind 3B looking up toward the field (what the suite level's back looks like).
- The Holiday Inn's footprint or an aerial from 2008.
- The skyline from the stands on the 27th or 29th themselves.
- A photo of the ribbon boards lighting the rows at night.
