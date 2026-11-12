# FK2: the players, coaches and umpires up close (step 12, round 1)

Fixer FK2, 2026-11-12, branch `worktree-agent-a35f4fd114a66f721` (off `ballpark` at 159da9d). The bundle: the players on the MakeHuman rig up close: CR1-5, SK1's F1-F3 and the squint (Lidge's shout), CR1-12, -14, -21, -22, -23, -24, -13, -6, -15, and AD1-10. The round stopped at the account's usage limit (the coordinator's 09:20 call); what's left is at the end.

## The shots

All in the main checkout, `.claude/gauntlet/s12/r1/FK2/`, 1280 × 800, full park (no `only=`).
- **`b1/`** (before, 38 shots, on 159da9d): the faces before the last pitch (`F01`-`F16`), Lidge's shout (`S01`-`S10`), Manuel and the champions' caps (`M01`-`M04`), FOX's pitcher (`G01`, `G02`), the bench (`B01`), TV at broadcast size (`T0`-`T4`).
- **`a1/`** (14 shots): after CR1-5 and the shout (before the faces' paint).
- **`a2/`** (21 shots, the last full-park job with the broadcast views): after everything; the same framings by name, plus `M05` (Manuel's cap close), `M06` (Ruiz's cap from the side) and `S11` (Lidge's posed bones at K+1.2 for CR1-6, in the job's result: `tools/` has no copy; rerun `S11` from `mkjob.mjs`). No console errors.
- **`a3/`, `a4/`, `a5/`, `a6/`** (8, 7, 5, 2 shots): the last tweaks after a2 (Lidge's beard, the temple's hair at the ear, the bench probed and its stripes antialiased; `a6/T0` TV center at play 20 on the final tree: 506 draws, 3,719,357 triangles). `a3` is scoped (`only=field,players,people`) and so over-exposed: judge shapes only. `a4`-`a6` full park, no console errors.
- **`cmp/`**: the comparison sheets and the reference crops: `p-s01.jpg` (the shout before, after, Getty 83485858), `p-ease.jpg` (strike three's ease in and out), `p-swap2.jpg` (the teeth at the near/mid swap), `p-neck.jpg` (the neckline), `fb-all.jpg` (CPU raster faces before the Looks changes), `ref-*.jpg` and `capz*.jpg` (Getty 83485858, 83485940, 83571347 cropped), `arm-cmp2.jpg` (CR1-6's CPU harness).
- **`tools/`**: the generators (copied from the scratchpad, which goes): `mkjob.mjs` (the jobs: `node mkjob.mjs <tag> [name prefixes]`; its page helper `__fk.face( p, d, fov, side, up )` frames a slot's face from his head bone's matrix), `face.mjs` (a CPU raster of the head with MakeHuman's expression units mixed freely, `units.json` from `bb.mjs`), `capray.mjs` / `capcheck*.mjs` / `clamp.mjs` (CR1-5's check of every head vertex against the cap's own triangles), `armup.mjs` (CR1-6's CPU harness), `prof.mjs` (the crown's profile), `nofetch.mjs` (makes `fetch` throw: build-body runs from its cached targets only), `rep.py` and `hunks.py` (whitespace-tolerant edits; one commit per ticket from one file's hunks).

## The counts

TV center at play 20 (`T0`): before (`b1`) 506 draws, 3,710,753 triangles, 783 pipelines, 18 occluded; after (`a2`, and `a6` on the final tree) 506 draws, 3,719,357 triangles, 783 pipelines, 18 occluded (+8,604: the mid figure's teeth, +6,480 in `a1`, and the seated figures' knees closed, AD1-10). TV center at strike three (`T1`, K+1.5): 501 draws, 4,637,977 → 4,650,193 triangles (more mid figures in the pile, each with teeth). The players' own draw stays one instanced draw; the shader test (`test/players-shader.mjs`) compiles: 9 draws, 407,246 triangles. Continuity: start hash 801248349, duration 3785.503, unchanged.

## CR1-5. Foreheads through the caps: fixed (46b0520)

- **Why.** FY4's head drop and FF3's faces move the head's vertices after the cap's crown was fitted to the base skull: a broad forehead (Lidge, Utley, Howard) came 0.5-4.3 mm through the crown's front.
- **What.** After the face and the expressions, every head vertex above the band is held inside the crown's own shell less 1.2-3 mm: the same tipped dome, the r^0.72 horizontal warp, the raised front (Rig.js' `crown()`), dropped with the head; eased in under the band; the ears left alone. Not for the helmets, the hoods, the bare heads or the catchers' skull caps.
- **Evidence.** Checked on the CPU against the cap's own triangles for 18 faces at rest and in the shout (`tools/capray.mjs`): 0.5-4.3 mm through before, none after. GPU: `a1/F01`, `F02`, `F09` against `b1/`.

## SK1's F1-F3 and the squint: Lidge's shout (5575dab)

- **F1, the mouth a tall oval.** The open weight alone (MakeHuman's mouth-open at 1.45) dropped the jaw into an O. A fourth expression record, the shout (build-body: mouth-open 0.4 on top of the jaw's own, the upper lip lifted off the teeth, the corners drawn in, the brows down past rest and knit, the cheeks up in a squint), its weight per slot in `i4.x`; the records are 12 u32 now (`Faces.js`' `EXPR_VEC4 = 3`). Getty 83485858: the mouth a wide, squarish roar, the teeth bared top and bottom.
- **F2, two dark-red marks on the upper lip.** The mouth's inside mark (`mk`) was flagged on the outer lip's vertices too; they're left out of it now (`outerLip` in the fragment).
- **F3, his face snaps in one frame.** His override eases in over 0.25 s at strike three and out over 0.5 s from +4.5 s (`p-ease.jpg`: `a1/S04`, `S05`, `S06`).
- **The teeth vanished at the near/mid swap.** The mid figure has teeth now (9-segment, Rig.js), so the open mouth isn't a dark hole at 13 m (`p-swap2.jpg`: `a1/S08`, `S09`). This is the one place extra geometry went on a figure that isn't the near one: +6,480 triangles at TV center.
- **The squint.** Painted crow's feet, the frown's creases between the brows and the nose-to-mouth fold, weighted by the shout and the smile.
- **The pile's biggest bursts shout too** (0.65 × the burst, the first 40 s): Howard (`a1/S10`).
- **Left:** in `a2/S01` two short dark-red marks still sit at the corners of the shouting mouth, where the upper lip lifts (the lips' inner colour on the lifted lip, or the cavity's mark at the corners: probe the flag there); a thin dark sliver along the nasolabial fold at some angles. The arms up balloon at the shoulders (CR1-6, below).

## CR1-24. The neck bib: fixed (ce9c323)

The undershirt's colour filled a broad crescent (a band 2.3 cm tall all round, a V 5 cm deep). Now the jersey's edge runs just under the collar's top line, dropping in front to a V 3.6 cm deep and 5 cm across: a crew collar about a centimetre tall and a narrow triangle above the top button (Getty 83485929, 83485858). `cmp/p-neck.jpg`; `a2/F01`, `F04` against `b1/`.

## CR1-12, -14, -21, -22. The faces (9585acc)

- **CR1-21, the Latin players' skin.** Feliz, Ruiz, Pena and Navarro were near the darkest brown; now an olive tan (`S.olivetan`), Rollins a mid brown (`S.mbrown`), with MakeHuman ethnic mixes to match (Looks.js' `ETH_OF`). Lidge ruddy with auburn hair (`H.auburn`).
- **CR1-21, the eye black.** Two holes: now a greasy rounded smear on the cheekbone's top (a power-4 superellipse with a noisy edge), slightly glossy.
- **CR1-12, one gaunt white face.** MakeHuman's `cheek-inner` (gaunt) halved after the fit and the cheeks' fullness eased; Lidge squarer and fuller, Utley's diamond and square, Hamels younger and fuller (`FF3_MH`).
- **CR1-12, the bill's shadow a mask.** It followed the bind pose; now its edge follows the head's pitch (the head bone's forward from `plBones`) with a soft 5 cm edge, 0.6 at its darkest.
- **CR1-12, the eyes.** The whites off-white (0.7, 0.68, 0.64), a small catchlight from the sun or the lights.
- **CR1-14, sticker beards.** Each man's density (`beardD`, 0.45-1, three bits from 32 in the face bits) and moustache (`mous`: full, thin, a horseshoe to the jaw, sparse; two bits from 256) from his photos: Feliz a short full beard (style 5, 0.8), Howard a thin moustache and chin hair (0.65), Werth scruffy (0.75), Rollins, Victorino, Crawford, Romero, Pena, Navarro their own. The edges broken by noise, the skin through at the edges, the chin's underside not painted (no band on the throat). Lidge: in `a2` a full short beard (style 5) covered his cheeks to the bone like a mask; the photo's cheeks are stubble with the chin darker, so he's the goatee (style 3) at 0.7 over heavy stubble (0.7): `cmp/p-lidge-beard.jpg` (b1, a2, a4).
- **CR1-22, bald temples.** The hair under the cap comes down the temple to the top of the ear and round it, the sideburns to the ear's middle, with FY3's grain; Manuel's white. In `a2/M06` it stood off the ear as a grainy patch with skin between (FY3's ear mask reaches 2 cm in front of the ear); the base head's side is 6.8-7.5 cm out in front of the ear, the ear's root 7.7-8.1, its rim 8.6-9 (`tools/side.mjs`), so the temple's hair is now kept off only the ear's own part from 7.8 cm out: `cmp/p-temple.jpg` (a2, a4), `a5/M06`.
- **Evidence.** Getty 83485858 (Lidge), 83483794 (Feliz), 83485929 (Howard), 83483743 and 83571347 (Manuel); `cmp/fb-all.jpg` (CPU before); `a2/F02`-`F15`, `M01`, `M03`, `a4/F01`, `F02` against `b1/`.

## CR1-23. The champions' cap: fixed (2d79052)

- **What it was.** A little navy roundel with a P and 2008 on a ribbon.
- **What it is.** The front filled by CHAMPIONS arched in red letters edged white (a dark keyline outside), WORLD SERIES small on a band over the arch, the Phillies' red roundel with the white P under the arch's middle, 20 and 08 in gold either side; the cell mapped over 12 cm of the front for this cap only. White piping, a 3 mm cord outlining the two front panels: up their outer seams from the band to the button and across the front over the bill's join. The Series logo on the left side, as on the everyday caps.
- **Evidence.** Getty 83571347 (`cmp/capz1.jpg`: Manuel on the stage, the piping up the front panel's seam and along the bill's join; `capz3.jpg`: Rollins), 83485940 (`capz2.jpg`: the arch, 20 and 08 in gold; the side logo on the cap beside him). The bill's edge isn't piped in these photos (the ticket's Flickr reference said it was), so it's left plain.
- **Shots.** `a2/M01`, `M03`, `M05`, `M06`, `a5/M01` against `b1/M01`, `M03`. On Manuel's turned head in `a5/M01` the arch's last S went round the side out of the cell, so the arch is 9.5 cm across now (cc44dec: not rendered since; it's only the letters' spacing).

## AD1-10. The seated Phillies' pinstripes: fixed (bbf5ecc)

In `FieldFigures.js` (not my file: a marked FK2 block). The pants' tubes carry their axis's tilt from upright in the part's fraction (`PART.pants + 0.5 + tilt / 2π × 0.9`), and the stripes run along it: on a seated man's thigh they ran across it. The thigh is closed at the knee, where its open end read as a curled flap. `a5/B02` probes the figures' meshes (the seated thighs carry 1.282-1.285, the upright legs 1.47-1.51). Along a thigh seen edge on, the hard step broke the stripes into dashes (`a5/B01`), so they're antialiased now and faded to their mean below a pixel: `a6/B01`; `cmp/p-bench.jpg` (b1, a5, a6). The knee is still a corner where the 6-sided thigh and shin tubes meet: a ball at the knee would round it.

## CR1-13. FOX's pitcher: the fly fixed, the tyre not (d3ed366)

- **The fly.** The bridge (FY3) kept the groin's V's normals, turned in and down: a pale notch with a dark V either side. Its normal now turns forward with the bridge. `a2/G02` against `b1/G02`.
- **Left: the tyre at the belt.** From `b1/G02`: the hull (FB2) is 0.21 m half-wide at the chest and 0.18 at the belt, and FB3 squeezes only the last 6 cm into the belt (to 0.4), so the cloth stands out 2 cm over it; with the pitcher's set (the trunk bent) and FY3's belly creases it reads as a roll. Next: taper the hull from the chest to the belt so it meets the belt without the step (FB3's squeeze over 12-15 cm, not 6), and check the creases' depth with the trunk bent.

## Not done

- **CR1-6, the shoulders balloon with the arms up.** Linear blend skinning at the shoulder: the sleeve carries 10-28% of the torso's weight at the top of the arm and the torso near the shoulder 25-40% of the arm's, and FB2's yoke and stand-off push the cloth out on top of that. The CPU harness (`tools/armup.mjs`, `cmp/arm-cmp2.jpg`) didn't reproduce the GPU's pose (a V against arms straight up), so `a2/S11` dumps Lidge's 17 bone matrices at K+1.2 for it. Candidate fixes: fade the yoke and the stand-off by the upper arm's lift (its posed direction against the torso's up); move the sleeve's torso weight to the arm as it lifts; a shrug (the shoulder's top raised with the arm).
- **CR1-15, Manuel's jacket.** His white hair shows a little at the temples now (CR1-22). The jacket still reads round (`b1/M02`, `a5/M01`): FR1's clamp keeps it inside the chest's hull, but the hull is filled out all the way to the hem (`below` is 1 under 1.33 m) and Manuel's `girth` scales it again in the bones, so it's widest at the belly and the knit hem pulls it in under: a ball. Next: for the jacket, let the hull hang straight down from the armpits (hx fixed from the chest down, no fill below the belly), the hem not gathered in; and his face older (heavier lids, jowls: FF3_MH for Manuel).
- **The faces against the photos.** The Looks changes move the men toward their photos; more could be done per man in `FF3_MH` (Werth's long face, Burrell's).

## For the merger

- **Files:** `game/Players.js`, `game/Looks.js`, `game/Faces.js`, `game/Rig.js`, `tools/build-body.mjs`, `game/data/body.js` (regenerated: 1038 KB, the shout's records), and `FieldFigures.js` (AD1-10: a marked FK2 block, small and additive).
- **The expression records are 12 u32 a head vertex now** (were 8): `Faces.js`' `EXPR_VEC4` is used by Players.js' `plExpr` buffer and its reads; anything else that reads `exprRecords()` must use it.
- **`plInfo`'s `i4.x`** carries the shout weight (FY4's packFace only reads `qa.w`'s bits 12-17 there).
- **The face bits in `i2.w`:** beard & 7, eye black 8, glasses 16, beard density × 32 (3 bits), moustache shape × 256 (2 bits).
- **build-body** was run with `--import tools/nofetch.mjs`: from its cached MakeHuman targets only, nothing fetched.
- **The bill's shadow reads `plBones` in the fragment stage** (the head bone's forward); the shader test compiles it.

## Frame-rate risk

Low. The near figure's face paint adds a few dozen ALU ops in the fragment for the head's pixels (the squint's lines, the beard's noise, the eye black's superellipse, the catchlight) and the cap's piping a handful for the champions' cap's pixels; the vertex stage adds the cap clamp (head vertices above the band) and one more expression record read for the near figure's 2,401 expression vertices. The mid figure's teeth: +6,480 triangles at TV center. No new draws, pipelines or passes.

## Noticed elsewhere

- The desk was busy (SP4's exclusive profiling, three jobs ahead): a fixer's job can wait 15-20 minutes for its turn.

## Repair (round 1, after SK-FK2 and RV-FK2)

Repairer for FK2, 2026-11-12, branch `worktree-wf_e827367a-b28-2` (FK2's branch merged into a fresh worktree off `ballpark`, then the commits below). The skeptic sent the bundle back for one thing, the champions' cap reading CHAMPION; that and its follow-ups are here, in the brief's order.

**The shots** (main checkout, 1280 × 800, full park, no console errors in any job):
- **Before:** the skeptic's own shots of FK2's tree, `.claude/gauntlet/s12/r1/SK-FK2/a1/<name>.jpg` (its extras `C1`-`C3`, `W1`-`W6`, `Z2`, `S14` in `SK-FK2/a2/`). This repair started from exactly that tree, and every after below is the skeptic's framing by the same name.
- **After:** `.claude/gauntlet/s12/r1/FK2-repair/a4/<name>.jpg`, the last job: 81 shots, each item's after, TV center at play 20 (`T0`) with the counts. `a1/`, `a2/`, `a3/` are the earlier passes (a1 after the first round, a2 after the second, a3 before the jacket's collar was right).
- **Sheets:** `FK2-repair/sheets/` (before beside after, cut with `tools/sheet.mjs`). **The recipe:** `FK2-repair/mkjob.mjs` (SK-FK2's, pointed at this tree: `node mkjob.mjs <tag> after [prefixes]`), each job's result in `result-<tag>.txt`.
- **On the CPU:** `FK2-repair/tools/` and `FK2-repair/cpu/`. `prev.mjs` with `paint.mjs` is a software raster of the near figure's head with the face's paint ported by hand (the beards, the collar, the mouth's inside, the catchlight, the cap's cord): it reproduced the skeptic's defects before anything was rendered (`cpu/feliz-old-f.jpg`, `cpu/lidge-old-shout.jpg`, `cpu/nk-old.jpg`), so each repair was shaped there first. `capclear.mjs`, `capn.mjs`, `jaw.mjs`, `mouth.mjs`, `mouth2.mjs`, `nrm.mjs`, `ease.mjs` are the measurements quoted below.

### Blocking 1. The champions' cap reads CHAMPIONS: fixed (bbf6cef, f33c2e7)

- **The cause, as RV-FK2 found it:** the side logo's test (`Nb.x < -0.5 && abs( Nb.y ) < 0.6`) is true on the crown's front from 3.5 cm to the wearer's left of centre, and took the cell there without drawing anything. `tools/capn.mjs` maps it on the crown's own normals: every sample of the front between 3.5 and 6.5 cm to his left, at every height.
- **What changed:** the Series logo is on the champions' cap's **back**, low and 6 cm across, where Getty 83485940 (the cap from behind), 83486314 (Hamels) and 83912493 (Werth, both on backwards) have it; the champions' cap is out of the side logo's test again; and that test now holds only where its own cell reaches (`L.z > -0.065`, the reviewer's condition), so no cap's front can lose pixels to it. The arch is back at 10.5 cm (FK2 narrowed it to 9.5 on the wrong diagnosis; 83485940 has it from seam to seam).
- **The logo's art:** the patch cell was a navy disc with WORLD SERIES 2008. It's now the 2008 Series logo as 83485940 shows it close: the diamond edged navy and gold on a green field, WORLD over SERIES in white edged navy across it, the batterman in its top corner, 2008 and the base under the words. The same cell is the sleeve's patch and the everyday caps' side logo, so those are the real logo too (`a4/X1-utley-right-sleeve.jpg`, `a4/X5-lidge-cap-side-patch.jpg` against 83485858, Lidge's cap). The atlas' two cells as drawn: `a4/X6-atlas-cells.png`.
- **Rendered:** `SK-FK2/a1/M09-ruiz-cap-top.jpg` | `a4/M09-ruiz-cap-top.jpg` (square on: CHAMPIONS, whole); `SK-FK2/a1/M05-manuel-cap.jpg` | `a4/M05-manuel-cap.jpg`; `SK-FK2/a2/C1-howard-cel-cap.jpg` | `a4/C1-howard-cel-cap.jpg`; and Utley from both sides (`a4/C2`, `C3`), Hamels (`a4/M12`), Manuel at arm's length (`a4/M01`): the word whole on six men. The back: `SK-FK2/a1/M08-ruiz-cap-behind.jpg` | `a4/M08-ruiz-cap-behind.jpg`, `a4/X7-howard-cap-behind.jpg`, `a4/X8-manuel-cap-behind-34.jpg`. No logo on the left side: `a4/M07-ruiz-cap-other-side.jpg`. FOX's cut of the stage, the caps from behind: `a4/T10-tv-3640.jpg`. Sheets: `sheets/pair-caps.jpg`, `sheets/cap-back-a2.jpg`.

### 1. Feliz's beard: fixed (5777620)

- **What was wrong underneath:** FY3's chin strap was centred 4 mm over a line that runs 1.6 to 2.3 cm **under** the base head's jaw edge (`tools/jaw.mjs`: the surface turns under at 1.657 m 2 cm from the middle, 1.677 at 5.5 cm, then up the back of the jaw to the lobe), so it lay on the throat; FK2 swapped it for a full beard instead.
- **What changed:** the strap (style 7) is on the face's side of the jaw's edge: from the sideburn down in front of the ear, round the jaw's angle in a curve, along the jaw to the chin, 1.3 cm wide at the side and 2 at the chin, with the patch under the lower lip; at full density its edge is clean (a barber's), not broken by the grain. Feliz: style 7, black, full, the moustache down round the mouth's corners, his cheeks clear (stubble 0.3) on FK2's olive-tan skin.
- **Rendered:** `SK-FK2/a1/F07-feliz.jpg` | `a4/F07-feliz.jpg`; by day `N18-feliz-day`; under the helmet at his walk-up `SK-FK2/a2/W6-feliz-helmet-2843.jpg` | `a4/W6-feliz-helmet-2843.jpg`; at FOX's size `W1-tv-feliz-walkup-2843`. Against Getty 83483794 (`SK-FK2/ref-crops/getty-83483794-feliz-face.jpg`): `sheets/pair-feliz.jpg`. The CPU's four views: `cpu/feliz-n3.jpg`.

### 2. The champions' cap's piping: fixed (ee7d3ab)

The line across the front above the bill is gone; the cord comes down each front seam to the bill's corner and runs on round the bill's rim to its tip, 4 mm of white over the edge and just under it (the distance from the bill's middle in the lathed disc's own frame, Rig.js). Flickr 2993502271 (`SK-FK2/ref-crops/flickr-2993502271-caps-piping.jpg`), Getty 83485940 and 83571347. `a4/M09`, `M05`, `M06-ruiz-cap-side`, `C1`; `cpu/cap-sheet.jpg`.

### 3. Strike three no longer steps: fixed (9f51caa)

Every man's face now goes from the one he had to the champions' over 0.25 s from when he sees it: Lidge at once, the rest up to an eighth of a second after him, each his own; the crew's smile and the Rays' set jaws the same way. Lidge's bytes in the running app (`result-a4.txt`; open / smile of 255): K − 0.05: 10 / 0; K + 0.03: 27 / 10 (it was 71 / 152); + 0.07: 72 / 46; + 0.10: 114 / 75; + 0.17: 207 / 115; + 0.25: 255 / 115. `tools/ease.mjs` runs `expression()` frame by frame for Lidge, two other Phillies, a Ray and a crew man. `SK-FK2/a1/E-k*.jpg` | `a4/E-k*.jpg`; `sheets/pair-ease.jpg`.

### 4. The collar an even ring: fixed (edafd1a, 52b9fbe, d38b2ee)

- **What was wrong underneath:** both edges of the undershirt's band were heights (a plane tipped down to the front), cut off at 10 and 11 cm from the neck's axis. Over the flat of the shoulders a height is no edge: the skin ran out to the 10 cm circle, the band was the centimetre between the two circles with a square tab where each met the plane, and the line stepped from facet to facet.
- **What changed:** both edges are a cone round the neck's axis: the old heights on the neck's own column, a centimetre higher for every centimetre further out, so they cross the trapezius' slope squarely and close round the neck's base. An even ring about a centimetre wide all the way round, the V in front as FK2 left it (Getty 83485929, Howard; 83485858, Lidge).
- **The jackets:** the knit collar stopped 6 cm short of the middle on each side, the throat in a square notch; it now closes round the front, 2 cm lower under the chin (Getty 83571347: Manuel's stands all round his neck). And the chin's-underside rule is kept off the jersey's own front: below the collar the paint's position is the shaped cloth, stood 0.6 to 1.3 cm off the chest, which passed for a jutting chin and left a tab of skin over a jacket's zip once the neckline closed in (`sheets/jacket-zoom2-a3.jpg` has it; `a4` doesn't).
- **Rendered:** `SK-FK2/a1/F03-utley.jpg` | `a4/F03-utley.jpg`; the arms up, where the torn edge was plainest: `S01-lidge-shout`, `S02-lidge-shout-34`, `S07-lidge-arms-up`; at 2.6 m `N19-lidge-body`; the far figure `L03-lidge-21m-far`; the jackets `N10-foley-3b-coach`, `N11-maddon-27`, `M02-manuel-body`, `M05-manuel-cap`; the plate umpire `N06-ump-plate`. `sheets/pair-collar.jpg`, `sheets/pair-jackets.jpg`; `cpu/nk-old.jpg` | `cpu/nk-new.jpg`.

### 5. Beards thinned by hairs: fixed (5777620)

- The density scaled the whole beard's opacity. It's now how much of the skin the hairs cover: each hair at full strength, the skin between them, the grain's threshold set by the density (about half the skin at 0.45, all of it at 1), and the cover's mean once a hair is under a pixel.
- **Werth:** the strap at 0.55, sandy, his hair sandy: a light scruff along the jaw and on the chin, off the cheeks (Getty 83912493). `SK-FK2/a1/F08-werth.jpg` | `a4/F08-werth.jpg`; `N03-werth-helmet`; `W2-tv-werth-walkup-3146.7`.
- **Navarro's sparse moustache** is fewer hairs (six tenths of his density), not the mask cut by the grain's threshold: `SK-FK2/a1/N02-navarro-mask.jpg` | `a4/N02-navarro-mask.jpg`; `sheets/pair-navarro.jpg`.
- The men FK2 gave a density keep it, read as cover: Howard, Rollins, Ruiz, Victorino, Crawford, Hinske (`a4/F04`, `F05`, `F09`, `F06`, `F13`, `N04`). Everyone at the default (1) is as before.

### 6. Lidge's shout: the dashes fixed; the muzzle lighter, and what's left (96e14a9, 8f7a2b9, 5777620)

- **The dashes were geometry, not paint.** The bag the lips curl into runs 3.8 cm out behind the cheeks, and its upper side walls stay with the skull while the open jaw, the grin and the shout draw the cheek beside the mouth's corner back 4, 7 and 2 mm (`tools/mouth.mjs`, `mouth2.mjs`: the records' own moves). The walls stood out through the cheek, 7 mm wide and 2 cm tall, painted as the dark inside (`cpu/shout-dbg.jpg` shows the mark). They now go back a little further than the cheek does, by the expression's weights (vertex stage; the near and the middle figure).
- **The last ticks at the corners:** the inside's depth was measured from the middle of the lips, so the rims by the corners (8.5 mm further back) were painted black; they're the lips' red. And the line between the lips, a shut mouth's, is gone by the time the mouth is a third open: it lay along both rims.
- **The muzzle:** Lidge is the strap at 0.6 with a sparse moustache in a reddish blond (`H.strawberry`), stubble 0.45 (it was the goatee over stubble 0.7 across the whole beard's ground, in auburn); the fold from the nose round the mouth is 5 mm of shade at a fifth, not a 3 mm line at a third.
- **Rendered:** `SK-FK2/a1/S01-lidge-shout.jpg` | `a4/S01-lidge-shout.jpg`, `S02-lidge-shout-34`, `S13-lidge-shout-low`; the middle figure forced on at 1 m, `SK-FK2/a2/Z2` | `a4/Z2-lidge-shout-1m-forced-mid.jpg`; the pile: `a4/S10-howard-shout.jpg`, `S14-shoutiest-k_2.5`. `sheets/pair-shout.jpg`, `sheets/pair-shout-zoom.jpg`; against Getty 83485858, `sheets/pair-shout-34-photo.jpg`.
- **Left:** with his head thrown back at K + 1.2 the skin round the open mouth is still a shade darker than his cheeks. It isn't there with his head level at K + 0.25 (`a4/E-kp0.25.jpg`), and the shader's normals there are within 5 degrees of the moved surface's own on average (`tools/nrm.mjs`), so I take it for the scene's light on a face turned up under the bill, and the lips' own tint, not the stubble or the folds. I haven't proved that with a render that isolates it. The photo's face is lit by a flash.

### 7. The catchlight can be seen: fixed (bdf6d28, 3448622, 118607b)

11 degrees up and 9 out it sat under the upper lid at every man's resting lids (`cpu/eyes.jpg`, top row), and at a fifth of the light's strength it was dimmer than the lit white beside it. It's on the pupil's edge just under its middle, the same side in both eyes, 2 mm across and as bright as the light it mirrors; it fades out once a pixel covers more than 1.5 to 4 mm of him, so a far face doesn't spark (not seen to spark: a precaution, since it's five times brighter than it was). At 0.8 m by night: `a4/F10-burrell.jpg`, `F01-lidge`, `F11-hamels` (`sheets/eyes08-a4.jpg`: twice up, the befores above); at 0.45 m by night and day: `a4/X3-lidge-eyes.jpg`, `X4-hamels-eyes-day`.

### 8. No pinpricks along Burrell's bill: fixed (e1b2839)

The crown's facets cut up to 1.1 mm inside its own shell between their corners, so with every vertex held 1.2 mm in, the head's triangles still came through between them. `tools/capclear.mjs` samples every head triangle (not only its vertices) against the crown's own triangles: at FK2's margin 11 of 63 looks had points outside the crown (Burrell 48 samples, worst 0.68 mm; Utley 64; Longoria 80, worst 0.81 mm; Balfour 68; Dobbs 26; the first base umpire 22; Lidge 16; Pena 12; Durbin 8; Baldelli 4; Werth 2). (e1b2839's message says 12: a miscount.) At 2.5 mm at the band to 3.8 higher up, eased in over 9 mm under it: none of the 63 within 0.3 mm of the crown, at rest, in Lidge's shout or in a pile burst. `SK-FK2/a1/F10-burrell.jpg` | `a4/F10-burrell.jpg` (`sheets/pair-burrell-bill.jpg`).

### 9. The reviewer's small things: done (5777620, 9f51caa, b6ccc5a)

- Looks.js' skin and hair tables' closing braces are at column zero.
- `plInfo`'s fifth vec4 is described as what it holds: x the shout, w the neck's thickness alone (0 to 62), y and z free. `packFace` and its fifteen retired numbers are gone (Looks.js still exports `FACE_PACK` for its own seeded faces); the shader reads the neck as it is.
- `expression()` writes its packed weights and the shout into the slot's numbers itself (`info[ o + 1 ]`, `info[ o + 16 ]`); the `_shout` module variable is gone. It's exported, so the ease can be run on the CPU.
- FieldFigures.js (FK2's marked note): the pinstripe's cover is measured from its middle, so both edges are antialiased, and it's worked out only `if ( pin )`. `a4/B01-bench-1b.jpg`.
- The eye black's three pows run only for the men who wear it.

### 10. test/players-shader.mjs: passes

`node tools/gpu/lock.mjs run --owner "cbp FK2 repair" -- node test/players-shader.mjs` on this tree, after the last change to the shader: `players shader: ok {"draws":9,"triangles":407246,"pipelines":5,"occluded":0}` (the Phillie, the Ray and the Phanatic in the main and shadow passes through Dawn; the same counts FK2 reported).

### 11. The five long pale faces: moved, modestly (4f2267e)

Within what the rig allows (MakeHuman's modifiers and the paint):
- **Utley:** dark hair and brows, the sun on his skin (`S.sun`), a day's dark stubble; the jaw's angle flared, the chin broad and cleft, the eyes narrower under a low brow.
- **Hamels:** his hair and brows a dark brown, not light (Getty 83486314, `SK-FK2/ref-crops/getty-83486314-hamels-cap-backwards.jpg`); the long nose and chin, a wide mouth, the cheekbones.
- **Longoria:** broader and heavier in the brow and the cheek. **Bartlett:** pointed (MakeHuman's inverted triangle; FF3's `shape-triangular` is a pear), the cheekbones out, a sharper nose, small eyes. **Kazmir:** round and boyish, full cheeks, a short chin.
- No 2008 close-up of Utley, Longoria, Bartlett or Kazmir was looked at for this (the one Utley photo in `.claude/ref/rituals` wouldn't open here; none of the other three is there): those four are their well-known looks, kept plausible, not checked against a photo. Hamels is against 83486314.
- `SK-FK2/a1/F03-utley`, `F11-hamels`, `F12-longoria`, `N16-bartlett`, `N12-kazmir-27` | the same names in `a4/`; `sheets/pair-five.jpg`; `cpu/five-old2.jpg` | `cpu/five-n2.jpg`. They read as five men now; none is a portrait.

### Left, as the brief says

CR1-6 (the shoulders balloon with the arms up: `a4/S07-lidge-arms-up.jpg`), CR1-15 (Manuel's jacket a ball, his face young) and CR1-13's roll at the belt: not touched.

### The counts

No geometry, draw, pipeline or pass was added: the repair is paint, a few vertex moves and JS.
- **TV center at play 20** (`a4/T0`): 506 draws, 3,719,357 triangles, 783 pipelines, 18 occluded: FK2's figure to the triangle.
- **Frame by frame** (`P-T0`, twelve frames in a row, the renderer's four-frame cadence; `result-a4.txt`), with 4 near, 21 middle and 0 far men: 381 draws and 2,844,324 triangles in the light phase, 506 and 3,681,229 in the middle one, 587 and 3,799,856 in the heavy one. SK-FK2's job 3 had FK2's tree at 381 and 2,846,488 in the light phase (ballpark 2,850,184): the same within the live crowd's noise.
- Per frame on the CPU: `expression()` does one more smoothstep a slot. In the fragment: the beard's cover is one smoothstep more where there is a beard; the collar a `max`; the eye black's pows now skipped for most men. The frame time wasn't measured (the coordinator profiles).
- `node test/continuity.mjs`: start hash 801248349, duration 3785.503. `npm test`: exit 0.

### Walking

No collider, and nothing a walker stands on, was added, moved or removed: the diff is `game/Players.js`, `game/Looks.js` and FK2's marked note in `FieldFigures.js`' fragment.

### For the merger

- **Files:** `src/ballpark/game/Players.js`, `src/ballpark/game/Looks.js`, `src/ballpark/FieldFigures.js` (inside FK2's marked AD1-10 note, in the pants' fragment), this file. `data/body.js`, `tools/build-body.mjs`, `Faces.js` and `Rig.js` are as FK2 left them: nothing was rebuilt.
- **`plInfo`'s fifth vec4:** `w` is the neck alone now (0 to 62, was bits 12-17 of a packed number); `y` and `z` are free. Nothing outside Players.js reads it.
- **The patch cell's art changed** (atlas cell 123): the sleeves and the everyday caps' sides carry the Series' diamond, not the navy disc.
- **`expression( p, t, ch, info, o )`** is exported and writes into `info`; it returned the packed number before. Players.js is its only caller.
- **Two new tones in Looks.js:** `S.sun` (with its entry in `ETH_OF`) and `H.strawberry`.
- RV-FK2's notes for the merger still stand (the frame time after FK2 isn't measured; the main checkout's `tools/body/.cache` has 10 of the 220 MakeHuman files).

### Noticed elsewhere (not this bundle's, not touched)

- **Every batting helmet sits over the eyes, the batters' too, not only the coaches'** (`a4/N14-perez-helmet.jpg`, `N10-foley-3b-coach`, `N03-werth-helmet`; the same on FK2's tree, `SK-FK2/a1/`). From Rig.js, worked out by hand and not rendered: the shell's rim is cut at 0.62π and tipped 0.12, which puts its front edge at about 1.752 m, 1.5 cm **below** the eyes' centre (1.767; the cap's is at 1.80), and the bill hangs at 1.773, at the eyes' height. A rim tipped about 0.26 and cut near 0.56π (front at the brow, 1.79; the nape as now), the flaps' start moved to match, and the bill up at 1.795, should show the eyes in FOX's walk-ups. It needs its own before and after on every batter.
- **The champions' tee's print** is a roundel over two bars; Getty 83571347 (Rollins on the stage) has the big WORLD SERIES CHAMPIONS 2008 crest across the chest.
- **SK-FK2's `M13-rollins-cel` framing** is black on this tree too: the camera is inside another figure on the stage at 3640.
- **The desk:** four jobs, at 18:20, 18:27, 18:34 and 18:50 UTC (50, 46, 81 and 81 shots; 65 to 100 s each), and `test/players-shader.mjs` five times under the lock (2 s each). The first three were seven minutes apart, closer than the brief's fifteen: I misjudged the time between them. The last waited its fifteen.
