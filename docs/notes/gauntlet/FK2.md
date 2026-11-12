# FK2: the players, coaches and umpires up close (step 12, round 1)

Fixer FK2, 2026-11-12, branch `worktree-agent-a35f4fd114a66f721` (off `ballpark` at 159da9d). The bundle: the players on the MakeHuman rig up close: CR1-5, SK1's F1-F3 and the squint (Lidge's shout), CR1-12, -14, -21, -22, -23, -24, -13, -6, -15, and AD1-10. The round stopped at the account's usage limit (the coordinator's 09:20 call); what's left is at the end.

## The shots

All in the main checkout, `.claude/gauntlet/s12/r1/FK2/`, 1280 × 800, full park (no `only=`).
- **`b1/`** (before, 38 shots, on 159da9d): the faces before the last pitch (`F01`-`F16`), Lidge's shout (`S01`-`S10`), Manuel and the champions' caps (`M01`-`M04`), FOX's pitcher (`G01`, `G02`), the bench (`B01`), TV at broadcast size (`T0`-`T4`).
- **`a1/`** (14 shots): after CR1-5 and the shout (before the faces' paint).
- **`a2/`** (21 shots, the last job, full park): after everything; the same framings by name, plus `M05` (Manuel's cap close), `M06` (Ruiz's cap from the side) and `S11` (Lidge's posed bones at K+1.2 for CR1-6, in the job's result).
- **`cmp/`**: the comparison sheets and the reference crops: `p-s01.jpg` (the shout before, after, Getty 83485858), `p-ease.jpg` (strike three's ease in and out), `p-swap2.jpg` (the teeth at the near/mid swap), `p-neck.jpg` (the neckline), `fb-all.jpg` (CPU raster faces before the Looks changes), `ref-*.jpg` and `capz*.jpg` (Getty 83485858, 83485940, 83571347 cropped), `arm-cmp2.jpg` (CR1-6's CPU harness).
- **`tools/`**: the generators (copied from the scratchpad, which goes): `mkjob.mjs` (the jobs: `node mkjob.mjs <tag> [name prefixes]`; its page helper `__fk.face( p, d, fov, side, up )` frames a slot's face from his head bone's matrix), `face.mjs` (a CPU raster of the head with MakeHuman's expression units mixed freely, `units.json` from `bb.mjs`), `capray.mjs` / `capcheck*.mjs` / `clamp.mjs` (CR1-5's check of every head vertex against the cap's own triangles), `armup.mjs` (CR1-6's CPU harness), `prof.mjs` (the crown's profile), `nofetch.mjs` (makes `fetch` throw: build-body runs from its cached targets only), `rep.py` and `hunks.py` (whitespace-tolerant edits; one commit per ticket from one file's hunks).

## The counts

TV center at play 20 (`T0`): before (`b1`) 506 draws, 3,710,753 triangles, 783 pipelines; after (`a1`) 506 draws, 3,717,233 triangles (+6,480: the mid figure's teeth, below); `a2`'s are in its result. The players' own draw stays one instanced draw; the shader test (`test/players-shader.mjs`) compiles: 9 draws, 407,246 triangles. Continuity: start hash 801248349, duration 3785.503, unchanged.

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
- **Left:** a thin dark sliver along the nasolabial fold at some angles; check `a2/S01`, `S02`.

## CR1-24. The neck bib: fixed (ce9c323)

The undershirt's colour filled a broad crescent (a band 2.3 cm tall all round, a V 5 cm deep). Now the jersey's edge runs just under the collar's top line, dropping in front to a V 3.6 cm deep and 5 cm across: a crew collar about a centimetre tall and a narrow triangle above the top button (Getty 83485929, 83485858). `cmp/p-neck.jpg`; `a2/F01`, `F04` against `b1/`.

## CR1-12, -14, -21, -22. The faces (9585acc)

- **CR1-21, the Latin players' skin.** Feliz, Ruiz, Pena and Navarro were near the darkest brown; now an olive tan (`S.olivetan`), Rollins a mid brown (`S.mbrown`), with MakeHuman ethnic mixes to match (Looks.js' `ETH_OF`). Lidge ruddy with auburn hair (`H.auburn`).
- **CR1-21, the eye black.** Two holes: now a greasy rounded smear on the cheekbone's top (a power-4 superellipse with a noisy edge), slightly glossy.
- **CR1-12, one gaunt white face.** MakeHuman's `cheek-inner` (gaunt) halved after the fit and the cheeks' fullness eased; Lidge squarer and fuller, Utley's diamond and square, Hamels younger and fuller (`FF3_MH`).
- **CR1-12, the bill's shadow a mask.** It followed the bind pose; now its edge follows the head's pitch (the head bone's forward from `plBones`) with a soft 5 cm edge, 0.6 at its darkest.
- **CR1-12, the eyes.** The whites off-white (0.7, 0.68, 0.64), a small catchlight from the sun or the lights.
- **CR1-14, sticker beards.** Each man's density (`beardD`, 0.45-1, three bits from 32 in the face bits) and moustache (`mous`: full, thin, a horseshoe to the jaw, sparse; two bits from 256) from his photos: Feliz a short full beard (style 5, 0.8), Lidge a reddish beard over the jaw with the goatee darker (style 5, 0.7), Howard a thin moustache and chin hair (0.65), Werth scruffy (0.75), Rollins, Victorino, Crawford, Romero, Pena, Navarro their own. The edges broken by noise, the skin through at the edges, the chin's underside not painted (no band on the throat).
- **CR1-22, bald temples.** The hair under the cap comes down the temple to the top of the ear and round it, the sideburns to the ear's middle, with FY3's grain; Manuel's white.
- **Evidence.** Getty 83485858 (Lidge), 83483794 (Feliz), 83485929 (Howard), 83483743 and 83571347 (Manuel); `cmp/fb-all.jpg` (CPU before); `a2/F01`-`F15`, `M01`, `M03` against `b1/`.

## CR1-23. The champions' cap: fixed (2d79052)

- **What it was.** A little navy roundel with a P and 2008 on a ribbon.
- **What it is.** The front filled by CHAMPIONS arched in red letters edged white (a dark keyline outside), WORLD SERIES small on a band over the arch, the Phillies' red roundel with the white P under the arch's middle, 20 and 08 in gold either side; the cell mapped over 12 cm of the front for this cap only. White piping, a 3 mm cord outlining the two front panels: up their outer seams from the band to the button and across the front over the bill's join. The Series logo on the left side, as on the everyday caps.
- **Evidence.** Getty 83571347 (`cmp/capz1.jpg`: Manuel on the stage, the piping up the front panel's seam and along the bill's join; `capz3.jpg`: Rollins), 83485940 (`capz2.jpg`: the arch, 20 and 08 in gold; the side logo on the cap beside him). The bill's edge isn't piped in these photos (the ticket's Flickr reference said it was), so it's left plain.
- **Shots.** `a2/M01`, `M03`, `M05`, `M06` against `b1/M01`, `M03`.

## AD1-10. The seated Phillies' pinstripes: fixed (bbf5ecc)

In `FieldFigures.js` (not my file: a marked FK2 block). The pants' tubes carry their axis's tilt from upright in the part's fraction (`PART.pants + 0.5 + tilt / 2π × 0.9`), and the stripes run along it: on a seated man's thigh they ran across it. The thigh is closed at the knee, where its open end read as a curled flap. `a2/B01` against `b1/B01`.

## CR1-13. FOX's pitcher: the fly fixed, the tyre not (d3ed366)

- **The fly.** The bridge (FY3) kept the groin's V's normals, turned in and down: a pale notch with a dark V either side. Its normal now turns forward with the bridge. `a2/G02` against `b1/G02`.
- **Left: the tyre at the belt.** From `b1/G02`: the hull (FB2) is 0.21 m half-wide at the chest and 0.18 at the belt, and FB3 squeezes only the last 6 cm into the belt (to 0.4), so the cloth stands out 2 cm over it; with the pitcher's set (the trunk bent) and FY3's belly creases it reads as a roll. Next: taper the hull from the chest to the belt so it meets the belt without the step (FB3's squeeze over 12-15 cm, not 6), and check the creases' depth with the trunk bent.

## Not done

- **CR1-6, the shoulders balloon with the arms up.** Linear blend skinning at the shoulder: the sleeve carries 10-28% of the torso's weight at the top of the arm and the torso near the shoulder 25-40% of the arm's, and FB2's yoke and stand-off push the cloth out on top of that. The CPU harness (`tools/armup.mjs`, `cmp/arm-cmp2.jpg`) didn't reproduce the GPU's pose (a V against arms straight up), so `a2/S11` dumps Lidge's 17 bone matrices at K+1.2 for it. Candidate fixes: fade the yoke and the stand-off by the upper arm's lift (its posed direction against the torso's up); move the sleeve's torso weight to the arm as it lifts; a shrug (the shoulder's top raised with the arm).
- **CR1-15, Manuel's jacket.** His white hair now shows (CR1-22's temples). The jacket still reads round in `b1/M02`: FR1's clamp keeps it inside the chest's hull, but the hull is filled out all the way to the hem (`below` is 1 under 1.33 m) and Manuel's `girth` scales it again in the bones, so it's widest at the belly and the knit hem pulls it in under: a ball. Next: for the jacket, let the hull hang straight down from the armpits (hx fixed from the chest down, no fill below the belly), the hem not gathered in; and his face older (heavier lids, jowls: FF3_MH for Manuel).
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
