# FC4: C4R's random views, round 4

Branch `worktree-agent-a3ddb873d58913dd0`, off `ballpark` at ea08f2a (C4R-2 already fixed there). Tickets: C4R's findings (`.claude/gauntlet/r4/C4R.md`) but C4R-2 (done) and C4R-8 (another fixer's).

**Shots** are in the worktree, `.claude/qa/fc4/` (gitignored; copy them out before the worktree goes):
- `before/` (job 1): every ticket's view at ea08f2a, plus the rain's diagnostics (b02 one frame, b03 the banks' term off, b04 the drops off, b05 no rain at all);
- `a2/` to `a5/` (jobs 2-5): the rounds of afters and probes;
- `after/` (job 6): the full park, every ticket's after and a TV center shot.

All at 1280 × 800, full park (no `only=`). Jobs are in `.claude/qa/fc4/jobs/`.

## Done

### C4R-1: the 27th's rain from the seats (`game/Rain.js`, a block in `BallparkApp._weather`)

**What it was.** The diagnostics (before/b01-b05) showed that taking out the banks' all-round 0.15 "leak" in Rain.js changed little. The dashes came from the LocalLights loop: every drop round a seat is in some bank's beam, 40-60 m from it, and the loop gave each drop 0.12 of its light as side scatter. That's a twelfth of the forward lobe, and it lit every drop in the box.
- The rings up close: with `frames: 1` the drops are plain dashes. The hollow rings are the temporal resolve on a hard-edged, pixel-wide quad flickering on and off the pixel grid.

**What changed:**
- **Side scatter is a uniform, `scatter`.** The eye gets 0.02 (a sixth). A broadcast camera keeps 0.12 (`rain.broadcast`, set from `camMode` in `_weather`), so the TV views' speckle is as it was.
- **The forward lobe:** for the eye, 1.6 × cos²⁰ (it was 2.4 × cos¹²): a tighter glare round a lamp you look into.
- **The banks' all-round leak:** 0.15 → 0.02.
- **Far sheets (Night.js):** their streak gate is three times FW2's (`night.air.streakGate`, set in `_weather`), so the dim spill over the black sky draws none.
- **The cross-section:** the dash is 0.75 px either side with its light peaked in the middle. The same total light (`hw0 / halfW`).
- **The wind:** 1.4 → 4 m/s, about 25° of lean (`wind` 3.3, 2.2 on the 27th). It's steady on purpose: a drop's place is wind × clock, so a gusting wind would sweep every drop sideways.

**Evidence.** The 300s view (b01 → a3/c01 → after/f01): the sky over the board is clean. What's left is rain in the 3B bank's beam over your head and the glare round the LF bank, as the Oct 27 photos have it (flickr 74085116N00: a sheet only in a bank's beam).
- The LF board from the 3B seats (b06 → after/f02): the black sky is clear on the left; streaks remain only round the bank. This matches the Oct 27 21:57 photo of the board.
- TV high (b08 → f03) and TV center (b26 → f04) keep their speckle, now slanted.

**Left:** the night air's grey haze over the bowl (Night.js's sigma) is unchanged; it isn't C4R-1's.

### C4R-3: the seated fans at arm's length (`Crowd.js`, close level, clear of SP3's blocks)

- **Knees and elbows** rounded: a domed end on a ring half-way up, over the thigh and the upper arm. The shin's and forearm's tops end inside them, and the cuff is closed.
- **Hands** a hand's size: a 9.6 cm mitten, 14 cm long. A hand in a pocket is now in the pocket, not a nub.
- **The beer:** an eight-sided cup that widens upward, replacing the box.
  - The shader shows the lager through clear plastic (paler, darker at the bottom), the head, the empty plastic above it and the rim.
  - The hot chocolate gets a paper cup with a sleeve; the soda a band.
  - The vertex shader squares the cup off for a phone or a camera (close level only, via the module's runtime `lod`).
- **Long hair** falls in toward its ends, with ragged locks at the bottom. Its strands are finer and uneven (it was 23 even pleats).
- **Raised arms** (and arms at the face) take their normals with them. `cwRingFrame` maps a normal from the ring's frame on the resting arm to its frame on the raised one; this applies at the close and near levels.
  - Before, the ring's "across" flipped when the arm went up, so half of each sleeve was lit inside out and read as a square bar.
- `part`, `piece` and `fan` come from the unpacked lets; SP3's marked blocks are untouched.
- **Counts:** the close level goes 641 → 677 vertices and 904 → 1028 triangles a fan; the near level 197 → 199 (a fingertip dome). Middle, far and distant are unchanged.
- **Evidence:** b09 → f05 (knees, the cup), b11 → f06 (raised arms shade round), b10 → f07 (paper cups).
- **Left:** caps measure about 14.5 cm across the brim at the close level (the critic suggested 0.18 m), so I left them. From above, at 2-4 m, they still read big.

### C4R-4: the lots and streets lit under their lamps (new `GroundLight.js`; `Complex.js`, `Ground.js`, `Surroundings.js`)

**The map.** The poles Complex.js puts up are baked once (~20 ms at load) into a 512² map of the ground's light: 2.5 m texels, 1.28 km square, centred on the complex.
- The lots' metal halide pairs: cos⁵, a tenth of the light between poles.
- The streets' sodium cobra heads: cos³, out to 4.5 heights.
- The highways' lamps where the road is on the ground.

**Who uses it.** `groundLightModule` gives `groundLight( P )` (irradiance) and `groundGlint( P )`. The lots, the roads and the ground plane add `albedo × light × 3.4`. The lots' grid of pools is gone: it was lit where no pole stood and dark under the ones that did. The parked cars round you take their light from the map (`groundLightAt`).

**The wet 27th.** `frame.wet` gates it:
- The eight banks lie in the asphalt as streaks drawn toward you: tight across, long up and down, with a softer glow round each.
- The lamps' pools shine the lower you look across them.

I tried putting each lamp head in the water (spots looked up along the reflected ray): it gave trains of blobs, so I dropped it.

**Evidence.** b14 → f08, the lot behind the board on the 27th, with the bank streaks as in flickr 10048236N08. Also b15 → f11, b16 → f09 (Pattison), b17 → f10.

**Left:**
- Only the banks reflect. The board, the lamps and the cars' lights don't, so the photo's dozen streaks are three or four.
- Where OpenStreetMap has no street lamps, a street stays dark; Pattison's far side is lit only by its north-side lamps.

### C4R-5: the seams round the foul poles (`Bowl.js` `_seams`)

**The cause.** The corners' fans of rows are centred on the foul territory's corner, a couple of metres in from the pole. They don't meet the outfield seats' end or the foul line's start, so four seams run up from the poles:
- RF seats ↔ RF corner: 2.8 m wide at the front, 12.2 m at the back;
- RF corner ↔ the line: 0.8 to 6.5 m;
- the same on the LF side.

Through them you looked down into the hollow under the stands (the pit polygon's floor).

**The fix.** Each seam is now stepped up as an aisle:
- a tread a row, at the lower block's height, its nosing the aisles' yellow;
- the higher block's end walled down to it;
- walkable colliders under the treads.

**Evidence:** b18 → f12 (the RF corner seats on the 27th: a stair instead of a brick wall over a pond), b27 → f23 (aerial), and the LF aerial (a4/d16 → a5/e15).

**Partly done:**
- The seams are concrete aisles, not seats; the RF one is wide and bare at the back.
- The hollow itself is still there, now closed over. From inside it (a5/e16: the old eye at y 4.37) you still see the street and the columns ending at street level. With C4R-2 fixed and the seams walkable, a walker can't get there.

### C4R-6: the 3B suites' TVs mirrored (`places/Suites.js`)

`_screen` turns its corners to face you: if (b − a) × (d − a) points away from the room's normal, it swaps a↔b and c↔d. That fixes both the picture and the triangles' winding. The framed print beside the TV follows the wall's side.
- **Evidence:** b20 → a2/a07, f13 ("PHILLIES WIN THE WORLD SERIES" reads left to right). The 1B side is unchanged.

### C4R-9: the parked cars (`places/gate3b/Cars.js`)

- The wheels sit flush with the body's side, where they show; before, they were inside it.
- Each has a six-sided hub and the arch over it in shadow.
- The glass is a tinted grey, not a black slab.
- Cost: about +17 vertices a wheel (sedan, SUV, pickup and van only).
- **Evidence:** b23 → f15, a5/e09, e17.
- **Left:** the bodies are still boxes (no rounded greenhouse or bumpers).

### C4R-10: the roof's wordmark lit from behind (`Exterior.js`)

`wordMat` lights the letters' faces only (`in.front`); the backs are dark painted metal. The wordmarks at the gates are built facing out, so they're unchanged.
- **Evidence:** b24 → a2/a09, f16 (the mirrored green text is gone).

### C4R-11: rain in the Hall of Fame Club (`places/Club.js`)

The room's meshes are `userData.dynamic` (shown by distance), and RainCover skips those. The club now hands RainCover a hidden ceiling mesh as its `rainRoof`: glass to back wall, at the ceiling, out 0.8 m past the glass. Hidden means not batched and not drawn.
- **Probe** (a5/e10): the cover along the view into the room reads 24.5 m and more; the ceiling is at 22.5.
- **Verified in the final job:**
  - f19, the cover on: a few faint streaks remain over the drink rail at the room's left end;
  - f20, the cover off (`coverXf.w = 0`): the carpet speckled all over;
  - f21, the drops off: clean.

  The cover works. What's left is the strip by the glass at the room's end.

### C4R-12: the 27th by day under a grey sky (`sky/Sky.js`, `BallparkApp`)

- **Sky.js** gets an `overcast` uniform (a marked block): the dome mixes to a CIE-overcast grey (three times as bright overhead as at the horizon), and the sun disc goes behind it.
- **`_weather`** sets the overcast to 0.88-0.98 on the 27th, and the clouds' coverage to at least 0.97.
- **`applyAtmosphereReadback`** cuts the sun's direct light by 85% (soft shadows) and evens the sky's light toward grey.
- The 29th is as it was (a4/d15). At night it changes nothing (the dome is dark).
- **Evidence:** b32 → a5/e12, f22. Hard shadows are gone and the sky is pale grey; the volumetric clouds still show some blue at the zenith.

### C4R-13: the visitors' relievers' blank faces (`FieldFigures.js`, a marked block)

The relievers are FieldFigures figures, not the players' rig. Their head now gets the crowd's face, fading out where it would only flicker:
- the eye sockets, whites and irises;
- the brows, the nose's shadow, the mouth, the cold in the cheeks.

The hair comes down only to a hairline; before, it covered the forehead and the brows. Ball kids, coaches, the crew and the cameramen get the same face.
- **Evidence:** b25 → f17, where the near reliever has eyes, brows and a mouth. (f18's closer framing missed him.)

### C4R-7: the Left Field Gate's square (`places/leftfield/Plaza.js`, a block in `LeftField.js` update)

**Partly done.** Evidence: b21 → f14 (the square lit warm round a lantern at night), b30 → f24. Three lantern posts (iron posts, lit globes) stand down the ramp's side and by the gate, field (−116.9, −79), (−116.9, −92), (−109, −103). Their light goes into the app's local lights once they exist (kind `lamp`, 90, range 16), so the square isn't black after dark.
- **Not done:** the reference's umbrella tables, queue rails, stands and crowd, and the RF corner's matching square. I didn't place people or furniture without knowing the walkers' paths through the square.

## Not done

- **C4R-8:** the LF board's script (another fixer's).

## The counts

From `meshRenderer.stats`, the frame before the reading:

| View | Before (job 1) | After |
|---|---|---|
| 300s rain view (k08) | 745 draws, 3,864,784 tris | job 6: 745 draws, 4,012,960 tris (+3.8%) |
| 300s close crowd (k18) | 338 draws, 1,690,288 tris | jobs 2 and 6: 460 draws, 2,134,136 / 2,156,781 tris |

The final job (`after/`, 24 shots, the full park) loaded in 12.8 s with no console errors.

The close crowd's own share of the rise is about 124 triangles × the ~1,200 fans at the close level within ~7 m, so about 150k. The rest of job 2's difference is draws: 338 → 460, the same view and seek, other shots before it. The people and occlusion state seem to differ between jobs, so I wouldn't read it as cost.

## Elsewhere

- **The night air's haze** (Night.js) greys the whole sky from the 300s on the 27th. The photos have the sky black away from the banks.
- **Under the RF corner** the pit polygon makes a sunken hollow open to the street at its far edge. It's closed over now, but it's a hole in the structure: a floor at street level there, or a wall where it meets the street, would remove it.
- **A Cast person's head** fills the camera in the critic's r05 eye (b12, a2/a15): that eye is inside someone.
- **The parked cars' hubs** read white under halide light. A darker alloy might sit better.
