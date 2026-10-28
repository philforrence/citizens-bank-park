# FY2: the Phanatic and the players' look (gauntlet round 1)

Fixer FY2, 2026-10-28, branch `worktree-agent-a672e363a9a2fcc68` (off `ballpark` at 31dd982). Tickets from critics CP (`.claude/gauntlet/r1/CP.md`: CP-3, 4, 16, 20) and CY (`.claude/gauntlet/r1/CY.md`: CY-4, 6, 16, 18, 21). Five desk jobs, all on the full park at 1280 x 800, no console errors.

**Shots.** `.claude/gauntlet/r1/FY2/` in the main checkout: `before/` (this branch before any change), `after1/` to `after4/` (`after4/` is the last job, on the final code). The same names in every folder, so any shot can be held against its before. The job generator is `mkjob.mjs` in this session's scratchpad; the shots' recipes:
- `P1`-`P4`: the Phanatic at "the little Phanatic" (t 2926.4, the 29th, 21.8 h): front, side, face, three-quarter.
- `P5` the 2008 banner (t 3567.7), `P6` the concourse (t 167.2, 20.4 h), `P7`/`P8` the rain dance with the ball girls (t 1919.2, the 27th), `P9` the dugout roof from the field, `P10` the Alley.
- `Y1` the TV center camera at the last pitch (3480.2, 21.9 h) and `Y1s` its stats; `Y2` Lidge from the 1B side, `Y3` Hinske, Ruiz and the umpire, `Y4`/`Y5` Utley at second, `Y6` Longoria, `Y7` Feliz batting, `Y8`/`Y9` the pile at 8 and 20 s, `Y10` the 27th's rain; in `after4/` also `Y11` the TV high camera and `Y12` the TV center on the 27th.

## Counts (TV center, the last pitch: `__app.engine.meshRenderer.stats`)

| | Draws | Triangles | Pipelines |
|---|---|---|---|
| Before | 518 | 8,843,853 | 684 |
| after2/after3 (the costume in the shared rig) | 518 | 9,579,779 | 684 |
| after4, final (the costume in its own draw) | 521 | 8,735,831 | 686 |

The shared rig draws 17,789 vertices a man now (18,505 before, the old Phanatic head, snout and eyes among them; the curved bills add 224), and the costume's 4,341 are drawn only for the Phanatic's slots; so the triangles are below the before though the costume is more than four times the old Phanatic pieces. Three draws more (the costume's main and depth passes), two pipelines. The page loaded in 9.6 s cold (9.7 before); the players build in 35 ms.

## Per ticket

**CP-3, the Phanatic's body (done).**
- He was the players' rig scaled up (girth 1.3, a belly pushed out): a lean man in a green suit with a ball for a head.
- Now the costume is its own geometry (`Rig.js`, `phanatic()`, measured off Getty 577355744, 83891040, 83570904, 84082561 and pompomflipflop's NLCS profile):
  - **the body:** a pear of rings from the collar to a ragged shag hem just past the knees, about 0.85 m across at the hips, the belly carried out in front; skinned to the torso above the waist, the pelvis through the belly and half to the thighs at the hem, so the skirt swings with his stride;
  - **the jersey** is the body's top half to a hem riding on the belly (pinstripes, red trim at the collar and the elbow-length sleeves, the script across the chest, PHANATIC and the star across the back);
  - **the gawking neck:** a fur column out of the collar, skinned to the torso at the bottom and the head above (the performer's head is inside it, Main Line Today, July 2008, so it goes where he looks);
  - **the head**, smaller than the neck is tall, on top of it.
- The performer inside is 5'10" (`Looks.js`: height 0.95, girth 1.0), so the costume tops out at about 6'6" with the hair; his own trunk is shrunk inside the costume, his arms thick shag under loose sleeves, his hands big furry mitts, his shins padded red leggings.
- The belly shake: Moves.js' `jiggle` (packed with the look's belly, now 1 at rest) swings the costume's belly.
- Motions: none changed. His moves already lean him back behind the belly and hold the arms out; they read with the new body (`after4/P1`-`P5`).
- Before/after: `before/P1`, `P2`, `P4`, `P5` against `after4/` the same.

**CP-4, the face (done).**
- The snout: a lathed horn of lime velour (no strands; a soft sheen) straight out of the face, 4 degrees down in the bind pose so his usual lean back carries it level, flaring to the mouth; a ring of darker shag round it; the mouth's dark inside and his tongue.
- The eyes: white, big, side by side over the snout, with round black pupils looking in and down; heavy hot pink lids over the top third.
- The hair: a mop of blue locks (a few pink) on the crown in front of the red cap, which is on backwards with its bill over his nape.
- `Props.js` follows the new head (the sou'wester and the toque scaled to it, the blower out of the snout's end) and solves his bones at his look's size.
- Before/after: `before/P3` against `after4/P3`.

**CP-16, the fur (done).**
- The colour is a vivid yellow-leaning kelly (sampled off the October photos), dark at the roots and light at the tips.
- The strands are noise stretched along them in clumps, not the old voxel hash; the costume's surface is displaced in clumps too (longer down the skirt), so the silhouette is shaggy.
- A cloth sheen (the material's `SHEEN` lobe, on for the players now) catches the outer strands, so in the concourse he's green, not a black hole (`before/P6` against `after4/P6`).
- Not done: shell layers for a real fuzzy edge; the clump displacement does most of it at TV distance.

**CP-20, the ball girls in the rain (done).**
- Their hair is a sheet curved round the head from under the cap, down past the shoulders to the shoulder blades behind (on the head's bone), in wet strands, each her own colour.
- Navy caps for most, the red for a few (`ROLE.navyCap`; Getty 83477166, 83458678, 84081831).
- The towels are white terry rally towels with a red print, and the cloth sags from the fist and flaps (the vertex stage), not a board.
- The Phanatic's slicker tents over the costume and hangs open below the chest, the fur showing between its fronts and below its hem (Getty 84081831), rubberised, the rain beading on it.
- Before/after: `before/P7`, `P8` against `after4/P7`, `P8`.

**CY-4, the whites and greys at night (done).**
- The road grey is a light cool heather (linear 0.47, 0.48, 0.53; it was 0.28, a charcoal).
- The night's key light is the banks behind home, so the backs the CF camera sees had only the far towers. A fixed ring of banks in the field's frame (down both lines, the two outfield towers, a little from above) now lights the players' cloth and skin after dark (`NIGHT_FILL`, a few dot products per player pixel, on the field-frame normal the vertex stage now passes).
- Lidge's back in the TV center view: mean sRGB (72, 67, 56) before, (166, 151, 139) after (CY's target from Getty 83486198: the whites at about 165-200). A road grey's shadowed side behind second: (25, 30, 27) before, (93, 103, 111) after. The whites are a little warm (the banks' light colour); the greys cool.
- Before/after: `before/Y1`, `Y3` against `after4/Y1`, `Y3`, `Y12`.

**CY-6, the cut (done, mostly).**
- The jersey stands off the trunk, more at the back and over the belt (blousing), less in front; the short sleeves stand off the arm; the pants are fuller through the seat and the thighs; a lean man's base-mesh belly is flattened.
- The cloth's drape is shaded in its hollows (a noise fold term on the jersey and pants).
- Both jerseys are button-fronts: the placket's edge, the buttons, and on the Rays' greys the navy piping down it and round the sleeve ends; the collar's V is smaller.
- The script and RAYS fill the chest from armpit to armpit (`CHEST`: 0.38 x 0.22 m; `drawChest()` squeezes the lettering by the cell's aspect so it comes out true, the P tall).
- Not done: the shoulders widened; real fold normals.
- Before/after: `before/Y6`, `Y2`, `Y4` against `after4/`.

**CY-18, faces and caps (partly).**
- The faces: the shadow of the bill across the brow and the eyes (soft), deeper sockets, the line of the lips, mottled skin; eye black a smudge, not a bar.
- The caps' bills curve down at the sides, and the caps' undervisors are a dark grey-green (the bill is marked `aField.x = -3`).
- Not done: the crown's height. Lowering it shows the skull through the top (tried in after2), so the crown stays as it was; FP1 is rebuilding the fans' caps from this one and the call shape is unchanged.

**CY-21, gloves and belts (done).**
- The Phillies' belts are their red, darkened.
- The glove is 86% of the size it was, the four finger stalls side by side, not fanned, and mostly black or dark brown (a few tan).

**CY-16, the pile (done).**
- `Celebration.js`: the men on the pile lean in on the middle at 40-50 degrees, in layers rising outward, their heads together over Lidge, so it heaps up 1.5-2 m in the middle.
- The next ring is bent over the backs in front of them, pressing in (a new `pressIn` pose there), not standing with arms out; the outer ring is closer in, jumping and pumping fists.
- Not done: the photographers (not in this file; they circle it by 8 s).
- Before/after: `before/Y8`, `Y9` against `after4/Y8`, `Y9`.

## The frame rate

- **The rig's skinning is skipped** for every piece a man isn't wearing (the helmets, the catcher's gear, the mitts, the rake, the hood and so on collapse to one point without the four-bone loop). Before, those ~5,000 vertices a man were skinned and then thrown away.
- **The Phanatic's costume is its own small draw** (`players-phanatic-costume`, a child of the players' mesh, up to 4 instances with the slot each is in an instanced attribute), so the 4,341 vertices of the costume don't ride along on the other slots. Its cost is the Phanatic's own, two pipelines more (main and depth).
- **New per-pixel work on the players:** the night fill (four dot products), a fold noise on jersey and pants pixels, mottling on face pixels, and the sheen lobe (now on for the material). On the Phanatic's pixels, two noises for the fur.
- No new CPU per frame beyond filling the costume's slots (a loop over the used slots).

## For the merger

- **Files:** `game/Rig.js`, `game/Players.js`, `game/Looks.js`, `game/Celebration.js`, `places/phanatic/Props.js`, `places/phanatic/Squad.js`, and a new `test/players-shader.mjs`.
- **`test/players-shader.mjs`** compiles the players' materials headless with a Phillie, a Ray and the Phanatic, and fails on any WGSL error. It renders one 32 x 32 frame, so run it under the lock: `node tools/gpu/lock.mjs run --owner "cbp players-shader" -- node test/players-shader.mjs`. It isn't in `npm test`.
- **`Rig.js` exports `PHAN`** (the costume's head, snout, eyes, the jersey's and skirt's hems in the bind frame) and **`PHANATIC_PARTS`**; the new parts are 29-35.
- **`ROLE.navyCap`** (2^21) is new.
- **The players' cap:** only the bill's geometry changed (curved, through a `bill()` helper with the same placement), and it's marked -3 in `aField.x`. If FP1 copied the cap for the fans, nothing they rely on moved.
- **`Looks.js` `phanatic`** is now height 0.95, girth 1.0, belly 1.0. `places/Phanatic.js` reads `slot.packed.belly` as the resting belly for the jiggle, which still works. Its little Phanatic overrides girth 1.1 and belly 1.1, which is fine with the costume.
- **No change to Motions.js, Director.js, Cast.js, People.js, Crowd.js or BallparkApp.js.**

## Noticed elsewhere

- The TV center view at the last pitch (`Y1`) has a grey-uniformed man with a glove standing behind second base (between the mound and the camera); with the Phillies in the field it should be no Ray, so it's probably a base umpire in grey with a glove, or a runner. For CY's fixer.
- `P7`: a grey band covers the top quarter of the frame in the rain dance's front view (the camera under something, or the rain's lens effect).
- The photographers circle the pile by 8 s (CY-16's third point; not in Celebration.js).
