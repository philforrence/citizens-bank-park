# FY3, round 4: the players as FOX's close-ups show them

Fixer FY3, 2026-10-28, branch `worktree-agent-ac465972dfcb321bf` (off `ballpark` at 3da836b). Critic first, then fixer.
- **Handed over:** no tickets, but the open ends of CY-18 (mannequin faces; caps), C3B-10 (the faces in the interviews) and C3B-11 (the jersey from above "still stiffer than FOX's").
- **My critique:** `.claude/gauntlet/r4/FY3-critique.md` in the main checkout, 13 findings, worst first.

## The shots

All in the main checkout, `.claude/gauntlet/r4/FY3/`; full park, 1280 × 800; no console errors in any job.

**The jobs:**
- `b0/` is the before, on this branch's base.
- `a1/`, `a2/` and `a3/` are the passes.
- `final/` (17:04) holds the same shots as `b0/`, plus `F16`-`F18`.
- `final2/` (17:20) is the last job, on the final code: `final/`'s shots, plus the TV high camera at the last pitch (`T02`, with `T03` reading its counts).

Each shot has the same name in every folder.

**The broadcast's own close-ups,** the TV camera at those seeks:
- `G-close-*`: the pitcher close-ups from high first and from center.
- `W-walkup-*`: the walk-ups from the low and high cameras.
- `A-lastout-s3.0`.
- `C-cel-*`: the pile and the interviews.
- `T00`: the TV center at the last pitch. `T01` reads its counts.

**Fixed looks at the men themselves,** `F01`-`F18`. The camera is put `dist` m in front of a man's face, found from his head bone after the seek (`__fy3face` in the job's js), so the same framing comes back after a change:
- Lidge: face, three-quarter, bust, side, legs and the back of his head.
- Hinske: face, body and feet.
- Feliz, Utley and the plate umpire.
- Price: face, back and chest.
- Werth on the 27th, Rollins and Howard.

**The job generator** is `/private/tmp/claude-501/-Users-phillipforrence-Documents-HomeKit/4f4e82b4-ef9f-4fa0-a3f9-d023a05012fe/scratchpad/fy3/mkjob.mjs`. The jobs sit beside the shots (`b0.json`, `a1.json`, ...).

**References.** All local; nothing new downloaded.
- **Getty,** in `.claude/ref/rituals/`, all 2008-10-29:
  - 83485159: Balfour on the mound, full length;
  - 83485858: Lidge at the last out;
  - 83483794: Feliz in batting practice, his face under the bill;
  - 83484235: Upton's face;
  - 83486314: Hamels at the Camaro.
- **The FOX world feed,** in `.claude/ref/gauntlet/play/`: t11530s (Balfour from above) and t12990s (Burrell).

## What I found and fixed, worst first

### 1. The beards were flat brown boxes: done
**Before:**
- FY2's beards were `if` boxes in the face's frame: a goatee was a rectangle pasted on the chin, and a chin strap was a bar (`b0/F01`, `F07`, `F11`, `F13`).
- Each beard was one flat colour.
- The skin's subsurface wrap and bounce light lit them orange.

**Now** (`Players.js`, the FY3 face block), each style is a soft density mask:
- **The moustache** follows the lip and thins at its ends.
- **The goatee** is densest in the middle. It runs down to the chin's underside, but stays in front of the throat.
- **The corners** round the mouth are thinner.
- **A full beard** runs up the cheeks, along a soft line sloping from under the cheekbone to the mouth's corner. Under the jaw it goes only where the chin juts forward, not down the throat.
- **A chin strap** follows the jaw's edge, rising to the ear.

**How the hair is drawn:**
- The edges are broken by a noise.
- The hair is grained hair by hair. That millimetre grain fades to its mean once a hair is smaller than a pixel, so the far faces don't sparkle.
- The beard thins into the stubble's shade and dots.
- The hair no longer carries the skin's wrap or bounce light.

**Looks.js** (one marked FY3 block):
- **Feliz's beard** is now a short one along the jaw, joined to the moustache and goatee, his cheeks clear (Getty 83483794). That's style 7, like Howard's. It was a goatee alone; a full beard (style 5) covered his cheeks like a mask (`a3/F07`).
- **Lidge, Utley and Burrell** get heavier stubble.

**Before / after:**
- `b0/F01`, `F02`, `F07`, `F10`, `F11`, `F13` against `final2/`.
- References: Getty 83485858 (Lidge's goatee) and 83483794 (Feliz).

### 2. Seams and bands across the face: done
**Before:**
- The stubble's hard top edge drew a line across the cheeks at the nose.
- `isFace` (`L.z < eye.z + 0.035`) drew a line down each cheek.
- The jaw's underside was a hard ×0.72 band.
- The goatee's box ran on down the throat as a stamped "crown", because the throat is at the chin's height.

**Now:**
- Everything is soft-edged: the face's weight is a smoothstep in depth.
- The jaw's shade follows its normal.
- The throat is kept out of every beard by its depth (the chin juts past it).

**Before / after:** `b0/F01`, `F02`, `F07` against `final2/`.

### 3. The jersey under every chin: done
**Before:** the collar's ring round the neck (`r < 0.1`) treated the underside of a jutting chin as jersey and as the undershirt's collar. Every jaw had a white and red crescent under it (`b0/F01`, `F02`, `F07`, `F11`, `F12`).

**Now:**
- A vertex in front of the neck and above the collar's line is skin (`chinU`).
- The undershirt's collar rides up the neck:
  - a crew neck's 1.2 cm for most;
  - a mock turtleneck's 4 cm for some, by seed (Balfour's navy mock);
  - the umpires' jackets close in a 3 cm collar.

### 4. Mannequin skin: mostly done
**Done:**
- The brows are thick and arched, thinning to the tail, hair by hair.
- The lids have their lash line and crease, and a little shade under the lower lid.
- The lips have their colour, and the line between them is drawn.
- The nose's tip, the cheeks and the ears are redder.
- A little oil on the brow and down the nose (a lower roughness).
- Short cropped hair at the temples, the sideburns and the back under the cap, where there was bald skin. It's kept off the forehead.
- A 3 mm brow ridge over each eye, in the vertex stage. The base mesh's brow is smooth, so the sockets sat under nothing.
- Blue or grey-green eyes for some of the fair-skinned men, by seed.

**Left:**
- Every man still has the one MakeHuman face; each has only his jaw's width and the ridge.
- The neck reads long from the front.

### 5. The batting helmets' ear flaps: done
**Before:** two balls hung below the shell (`b0/F12`, Rollins's double flap; `F13`; `F05`).

**Now** (`Rig.js`, `flap()`):
- **The flap** is a patch of the shell's own ellipsoid, carried on from its rim over the ear down to the lobe. It's flush with the shell at the top, then flares off the cheek toward its rounded lower edge. Carried further round the ellipsoid, it came in to the jaw in two points (`a3/F12`).
- **The ear's hole** is shaded, in `Players.js`.
- **The shell** is 0.8 cm lower.
- **The bill** is longer and level.

**Before / after:** `b0/F05`, `F12`, `F13`, `W-walkup-3462.5` against `final2/`.

### 6. The caps were domes: done
**Before:** the cap was a hemisphere tipped back. Its bill was tipped up 13°, so from in front it read as a black band (its underside), and the cap sat on the lids (`b0/F01`, `F02`, `F07`).

**Now** (`Rig.js`, `crown()`):
- **The crown:** the dome's profile is squared (the horizontal radius to the power 0.72), with the front panels taller, about 11 cm at the front (Feliz's and Balfour's caps). The normals at the sphere's seam are averaged, so it doesn't show.
- **The panels:** the crown's six panels are seamed up to the button (in the shader). From the high cameras the crown was one smooth shell.
- **The fit:** the cap is worn up off the brows, the band a finger above them, so the brows and eyes show in the bill's shadow.
- **The bill:** longer (9 cm), curved down 3 cm at its sides, and level to a little down.
- **The 2008 World Series logo** is on the cap's left side, as both clubs wore it in the Series (Lidge, Getty 83485858; Balfour, 83485159). It's left off the champions' caps and the navy caps.

**Before / after:**
- `b0/F01`, `F02`, `F07`, `F10`, `F16` against `final2/`.
- From above: `G-close-523.9`, `G-close-3178.2`.

### 7. The pants were tights: done
**Before:** the thighs and knees bulged round the leg, the crotch made a V and the seat was modelled (`b0/G-close-1720.9`, `F06`, `F14`, `W-walkup-3462.5`).

**Now** (the vertex stage, in an FY3 block after FB3's):
- **Below the knee,** long pants hang loose to the hem. A cone round the shin's bone, 8.8 cm at the knee to 7.6 cm at the hem and a little fuller where it breaks, is filled out where the leg is under it, and the excess is taken in.
- **The fly** bridges the groin's crease, a little behind the fronts of the thighs. A first try pulled the inner thighs forward lower down and hung a pouch between the legs (`a2/F18`); that's out.
- **The seat** runs straight across the cleft.
- **Excluded:** high socks keep FB2's cut, and the ball girls' bare shins are left out.

**Before / after:**
- `b0/F06`, `F14`, `F15`, `G-close-1720.9`, `G-close-3178.2` against `final2/`, plus `final2/F18`.
- References: Getty 83485159 and 83485858.

### 8. No folds in the cloth: done (C3B-11; CY-6's "real fold normals")
**Before:** the jersey and pants were smooth rubber. FY2's fold noise only darkened the colour.

**Now** (the surface stage), a height field of folds a few millimetres deep tilts the shading normal, through the screen's derivatives:
- **On the jersey and its sleeves,** one field, creasing from the armpits down and across. It was two fields, which made a seam of dashes where they met (`a1/F13`).
- **On the pants,** long folds down the leg, breaking over the shoe tops.
- **Driven by the pose,** read from this frame's bones in the fragment (no new varying):
  - a few irregular creases, mostly behind the knee, as it bends;
  - creases across the belly as the trunk bends over the pelvis (the set, the crouch).
- **No regular ripples:** every crease's phase is broken by a noise. A regular ripple read as corrugated cloth (`a3/G-close-3178.2`).

**Limits:**
- The tilt is held under about 20°. On slivers of triangles the derivatives are near degenerate, and the tilt blew up into rows of bright dashes (`a1/F13`, `F10`).
- It fades out once a pixel covers more than a few millimetres of him, so the wide views pay only one `fwidth`.

**Not done:** the cloth's motion. It is still rigid with the body; only the pose's creases move.

### 9. Torn hems and slippers: done
**The hem:**
- **Before:** the mesh's ragged end ring at the ankle (where the bare foot was cut away), with a band of sock under it (`b0/F15`).
- **Now:** long pants reach the shoe tops (`cuffAt` 0.9), and the leg's last few centimetres are brought to one level just above the ankle, a clean hem breaking over the shoe.

**The cleats:**
- **The shape** (`Rig.js`, `cleat()`): the instep is higher and the toe rounder.
- **The upper** is black, or the Phillies' red for some (Lidge's red Nikes).
- **The stripe** sweeps up from the toe box to the heel on both sides, thickest mid-foot: red on a Phillie's black, white on a Ray's and on the red ones.
- **The laces** run down the instep.
- **The sole:** a pale midsole line over the black sole.

**Before / after:** `b0/F15` against `final2/F15`, plus `final2/F18`.

### 10. RAYS in the wrong letters: done
**Now** (`drawChest`):
- the navy serif capitals are edged in white and Columbia blue;
- the gold sunburst is at the R's shoulder;
- the R's leg carries on as a tail sweeping under AYS to the S (Balfour).

**Also:**
- the Rays' manta on the left sleeve (`drawRay`, atlas cell 118);
- the road pants piped in navy down the outer seam.

**Before / after:** `b0/G-close-3178.2`, `F06` against `final2/`, plus `final2/F17`.

### 11. The umpires up close: partly
- **Done:** their jackets' collar; their shoes plain black (the cleats' stripe kept off them).
- **Not done:** the face is the players' face, now with all of the above (an older man's lines at the eyes, grey temples). The powder-blue stripes are as FB2 drew them.

### 12. The shoulders from above and behind: partly
- **Done:** the cap of the shoulder is taken in a little more round the arm (FB3's 14% to 20%).
- **Left:** FB2's yoke and FB3's slope are otherwise unchanged. From center field (`F14`) and from above (`G-close-3178.2`), the shoulders still read a little square.
- On a big man (Hinske, `F06`), the waist still blouses over the belt in a ring.

### 13. The interview party: not mine
- Selig, Zelasko, Chris Myers and the photographers are Cast's figures (`places/rituals/Party.js`, `Cast.js`).
- The rig's men among them (Hamels, Howard, Manuel) have all of the above.

## The counts

`JSON.stringify( __app.engine.meshRenderer.stats )`, full park, 1280 × 800, not profiled. Each shot's js runs before it renders, so it reads the view before it: `T01` reads the TV center at the last pitch (`T00`), and `G-close-523.9` reads `G-close-3178.2`'s.

| View | Before (`b0`) | After (`final2`, the last job) |
|---|---|---|
| TV center, the last pitch (3480.9) | 491 draws, 3,443,730 triangles, 767 pipelines | 491 draws, 3,438,546 triangles, 767 pipelines |
| The pitcher close-up from high first (3178.2) | 443 draws, 3,537,339 triangles, 767 pipelines | 443 draws, 3,531,939 triangles, 767 pipelines |
| TV high, the last pitch (no before) | | 793 draws, 3,646,440 triangles, 767 pipelines |

- **Draws and pipelines** are unchanged: no new mesh or material.
- **Triangles** are ~5,000 fewer. Each flap patch has 100 triangles where the ball had 192, and each cleat has one more section.

## The frame rate

**Geometry:** none added. The rig's vertex count is about the same (the flaps fewer, the cleat a ring more). The middle and far figures (SP2) take every change by themselves:
- the vertex stage's shaping runs on whatever vertices a figure has;
- the cap, helmet, flaps and cleats are rigid pieces, built for each level by `buildPlayerGeometry`.

**`data/body.js` is untouched,** so `tools/build-body-lod.mjs` didn't need re-running (I didn't change `tools/build-body.mjs`).

**Vertex stage,** per player vertex, a handful of ALU ops:
- the shin's cone;
- the fly and the seat;
- the hem;
- the brow ridge.

**Fragment stage,** on the players' pixels only:
- **Face pixels:** the face block is a few noises (grain, edge, mottling), about what FY2's was.
- **Cloth pixels,** only while a pixel covers under ~7 mm of him (`fk > 0`): the fold field, two or three noises and the derivatives. Near the knee and the belly it adds two storage reads of the bones and a noise. In the wide views (TV high, the walk) the players are far smaller, so it costs one `fwidth`.
- **The TV center's players,** at 200-400 px, are at the edge of the fade (5-8 mm a pixel): a few tens of thousands of pixels.

**Where to watch:** the TV close-ups (the pitcher from high first, the walk-ups), where the players fill a third of the frame. Those views are otherwise light: grass and a few figures, against the heavy views' crowd. The views at the floor's edge (left field, the 400s) have the players far, so the folds fade out and the faces are a few pixels.

**CPU:** no new per-frame work. The atlas has one more cell, drawn once.

## For the merger

**Files:**
- `src/ballpark/game/Players.js`, all in FY3 blocks:
  - the face block, which replaces FY2's (CY-18) in the `skinArea == 1` branch;
  - the chin and collar test;
  - the shoes;
  - the folds;
  - the Rays' piping and manta;
  - the vertex stage's pants, fly, seat, hem and brow;
  - `drawRay`, `drawChest`'s RAYS;
  - one value in FB3's block, the shoulder's take-in 0.14 → 0.2, marked.
- `src/ballpark/game/Rig.js`: `crown()`, the cap and bill, `flap()` and the helmet, the cleat's profile.
- `src/ballpark/game/Looks.js`: one FY3 block before `CREW_SKINS`, Feliz's beard and four men's stubble. Clear of FB4's roll crew.

**Things to keep in mind:**
- **The atlas:** `C.ray` (cell 118) is new. Cells 96-117 are still free.
- **`cuffAt`** for long pants is 0.9, past the leg's end, so long pants have no sock showing. High socks keep `U.cuff`.
- **The players' fragment stage now reads `plBones`** (the knee and belly creases). The engine binds it to both stages by itself (`Shader.js`'s reachability). It's two storage buffers in the fragment stage, under any limit.
- **A cap or helmet built from the rig elsewhere** (FP1 copied the cap for the fans) sees only its own copy. The call shape is unchanged, and the bill is still marked `aField.x = -3`.
- **`test/players-shader.mjs`** compiles the material headless (run it under the lock). It passed after every change.
- **`npm test`** passes.

## Noticed elsewhere

- **The interview party** (`C-cel-158`, `C-cel-170`): Selig, Zelasko, Chris Myers and the photographers are Cast's block figures (`places/rituals/Party.js`, `Cast.js`), the crudest people in the close-ups now, beside the rig's men. Cast's near figure for them is C3B-10's open half.
- **The bench and the on-deck men** (`W-walkup-3093.3`, `W-walkup-610.8`; FieldFigures.js and the rail's figures) are block figures, beside the rig's batter in every walk-up.
- **The cloth doesn't move** with the body's motion (no lag or flutter). In a still the pose-driven creases do what they can. Real cloth motion would want the previous frame's matrices in the vertex stage, a lag on the loose parts; untested in the desk's held shots.
