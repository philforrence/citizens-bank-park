# FP1, round 1: the people

Fixer FP1, 2026-10-28, branch `worktree-agent-ac6cc74d296d052de` off `ballpark` at 214f49c. Tickets: critic CP's findings (`.claude/gauntlet/r1/CP.md`) and CI-2 (`.claude/gauntlet/r1/CI.md`).

**Shots.** The before shots are CP's own (`.claude/gauntlet/r1/CP-shots/`, taken at c55a711, which differs from 214f49c only in docs and two jersey numbers), plus `FP1/before/` (the TV center stats and CI's concourse views). The after shots are in `.claude/gauntlet/r1/FP1/final/` (the last job, the same recipes as CP's, by name), with the working rounds in `a1/` to `a5/` and `after/`. Each shot's recipe is CP's (`CP-shots/job*.json`, by name) or in `FP1/*.json`-style extras listed below.

## The big one: the figures were lit inside out

The engine's front face is counter-clockwise and the people's materials are double sided: a back face gets its normal turned round. The crowd's tubes (the trunk, the arms, the legs, the neck, the hands), the Cast's lofts (the trunk, the hips, the poncho, the apron, the vest) and its ellipsoids (the head, the joints, the pom-pom), and People's, RailFigures' and FieldFigures' tubes were all wound the other way from their normals. So they were lit on their far side, which is a good part of why the torsos read as flat drums and slabs, and why the Cast's nose went dark against its face (CP-13). Each figure builder now winds every triangle to face its own vertex normals (the codebase's rule: `Quads` in Stands.js does the same). This changes the look of every person in the park, for the better in every shot I took, and costs nothing.

## Per ticket

### CP-1: the caps (done)
- **Crowd.js:** close up, the cap has its own crown: a shell over the skull a finger bigger than the head, taller in front, down to just above the brows in front, the tops of the ears at the sides and low behind (`capRim`). The bill comes straight out of the crown's lower edge in front: six columns across, its root following the crown (so its sides drop, the arch), pitched a little down, 6 mm thick with an edge, its underside a shaded grey-green under the cap's colour (not black). The P is on the front panels, the right way round, with the panels' seams and the button. Near (the TV's long lens) the head is shaped into the crown (fuller above the band, taller) with a four-column bill with an underside; further off a flat bill at the crown's edge. The paint follows the same rim. Caps stay on under hoods with the bill poking out (Getty 83893023).
- **Cast.js:** the same crown shell and bill for the ball caps (the police cap and the motor helmet keep their own shapes), turned round for a backwards cap; the paint and the logo follow it down.
- **People.js, RailFigures.js, FieldFigures.js:** the bill moved down to the crown's edge, arched, with a shaded underside; the cap's paint down to its band.
- **Evidence:** `crop-83893023-caps.png` (Getty 83893023, Oct 27, 2008). Before: `CP-shots/macro-cap-34.jpg`, `macro-cap-side.jpg`, `fans-3b-29.jpg`; after: `final/` the same names.
- **Left:** the crown's rim sits 5 mm off the head, and the head's paint shows a hairline under it from some angles.

### CP-2: the seated torsos (done)
- The trunk is lofted through nine rings close up (six near, four mid, three far): hips, waist, chest, armpits, sloping shoulders, a collar round the neck, squared toward a superellipse, with smooth normals from the surface (the shoulders catch the lights above). The arms hang outside it from round shoulders (a dome over each sleeve's root).
- The figure sits about 10 cm taller (a seated adult's shoulders ~0.58 m and the top of the head ~0.9 m above the seat); the arm poses moved with it.
- The neck is skin only above a jacket's collar; the bare yoke and the hole under the chin are gone; a hoodie with its hood down has the hood lying on the back of the neck.
- **Evidence:** before `CP-shots/fans-day-1b-back.jpg`, `macro-*.jpg`, `fans-home-27-side.jpg`; after `final/` the same.

### CP-5: the Cast's mirrored P (done)
The stem on the figure's right (the viewer's left), the bowl beside it, on the crown and in the paint; mirrored for a cap turned round. After: `final/fans-home-27-front.jpg`, `home-front-29` (round a2).

### CP-6: the ponchos (done)
- **Crowd:** a clear poncho keeps the jacket under it (×0.88), glossy and crumpled (roughness 0.08 to 0.3 by a crinkle), the coloured ones opaque: 55% clear, 15% yellow, 15% red, 10% white or see-through blue, 5% orange. The 27th's TV backdrop is red, not lilac and pink: `CP-shots/fox-cf-27.jpg` against `final/fox-cf-27.jpg`.
- **Cast:** the poncho hangs from the shoulders over the arms; its hood is loose plastic over the head (a clear one shows the hair and the cap through it).

### CP-7: the knit hats (done)
A rounded dome over the hair (not the apex pulled up into a cone), a pom-pom ball close up (red and white on the Phillies' hat), the red hat's navy cuff and white P. After: `final/macro-knit-34.jpg`.

### CP-8: the towels (mostly done)
- **Crowd:** the towel is a 3 × 3 cloth; it goes up only to be twirled (a raised arm no longer sweeps it across the faces behind), the loose end trailing the turn and fluttering; on the lap a folded white towel with the red square. The kernel's thresholds are narrower (a mood held half way leaves a few fans half up, not one in ten crouched through the seat).
- **Cast:** the towel prop is a cloth that curls and flutters at its loose end.
- **Left:** the ripple machinery (`moodA`/`moodB`/`ripple`) is still set flat; the Squad's towels (`phanatic/Squad.js`) aren't mine.

### CP-9: the hoods (done)
Crowd and Cast: inflated loose over the head, a peak out over the brow, falling onto the neck behind, the face's opening left where it is so the rim stands proud; matte cloth (WET_FABRIC soaks it, no gloss), darker inside the rim, drawstrings on a hoodie; a poncho's hood glossy, a clear one showing the hair and cap. After: `final/macro-hood-34.jpg`.

### CP-10: the poses (partly)
Each fan leans his own way (forward on his knees to back in the seat, a little to one side), more hunched in the rain and leaning in on two strikes, two outs, late (a new `tense` in the crowd's mood), bending at the waist with his hands left on his lap; his head nods its own way, down under a hood in the rain, up when they cheer. **Left:** arms folded and hands in pockets (no attribute room for a seventh pose; it would need the limbs rebuilt from `aInfo` in the shader).

### CP-11: 2008's sea of red (done)
Crowd: red about 60% (and a red jacket with royal-blue shoulders), the home whites (with pinstripes and piping close up, a hoodie's sleeves under them) 6%, black 14%, navy 6%, charcoal and grey 8%, maroon, brown, powder blue 0.5%. People's walkers the same. The Diamond Club's powder blue (Dress.js) down to about one in a hundred. After: `final/fox-cf-29.jpg`, `final/tvc-29.jpg`.

### CP-12: a cold night's gear (partly)
Crowd: hoodies, zipped jackets (the zip, the collar) and sweatshirts; scarves (a band round the collar, one end down the chest, in bars); gloves (black, navy, red); one in seven holds a beer, a hot chocolate, a phone, a camera or a soda (close up). **Left:** jersey names and numbers, signs, lanyards.

### CP-13: the faces (done)
Close up a 12 × 8 head with a nose and a narrower jaw; the beard soft at its edges, not a mask (Crowd and Cast); the Cast's nose shaded as the face is (and no longer lit inside out).

### CP-14: the arms (done)
Close up 6-sided limbs, round shoulders; a raised arm lifts its shoulder and bends its elbow a little, inside the seat's width; the hands are mittens with rounded fingertips.

### CP-15: the scarves (done)
Cast: a knitted band (its own loft) round the neck and one end down the chest, bars across it, not a striped cape. After: `final/fans-home-29-cheer.jpg`.

### CP-17: the kids (done)
A kid's head is scaled back up to 0.92 of a man's about the neck (it shrank with the body).

### CP-18: the standing fans (done)
The standing figure is 1.75 m (chest and shoulders up), thicker thighs, shoes close up, the jacket's hem below the belt.

### CP-19: RailFigures (partly)
The cap (CP-1) and the inside-out lighting. **Left:** the move onto the Cast, the lenses, the ball girl's script.

### CP-21: the walkers' stride (done for the Cast)
The Cast's rig swings each arm against its leg while walking and eases the elbow, less the more the arm is already doing. People's walkers already swung theirs.

### CI-2: the concourse's crowd (done)
A throng in People.js: up to 1,600 more people with no CPU per person. A compute pass places each from his own hash and the time: walking the concourse's loop one way or the other at his own pace, standing about its edges, or coming in through one of the gates (a line from the plaza through the turnstiles into the atrium). As many are out as the replay's clock says (nightState: the gates before the first pitch, between innings, the Rays batting, wall to wall in the rain delay, few in the 9th, the last out). They aren't drawn within 5.5 m of the camera (the places' detailed people are there), nor beyond 130 m, nor at all unless the camera is on the concourse's level. The places' hiders don't apply to it: it fills the 3B and 1B stretches too. Before: `FP1/before/ci-*.jpg`; after: `final/ci-125-delay.jpg`, `ci-3b-129-delay.jpg`, `ci-3b-atrium-pregame.jpg`. **Left:** the gate atria are still thin close to the camera; the throng uses People's (simpler) figure.

### Not mine, not done: CP-3, CP-4, CP-16, CP-20 (the Phanatic and the Squad).

## Frame rate

The crowd now has four levels (close only under ~4 m of the screen's half height, and never through a long lens; near is the TV's backdrop), and each stands chunk is split into pieces of 360 seats that cull and choose their level on their own (a whole chunk of 1,500 used to draw at its nearest fan's level). Per fan, the triangles are close 669, near 236 (was 206), mid 124 (was 112), far 72 (was 60).

`__app.engine.meshRenderer.stats`, the same shot sequence (`mkperf`) on the base tree (214f49c, exported) and on this branch, 1280 × 800, full park. "Crowd" is the total less the same frame with the crowd hidden. These counts move by a few hundred thousand between frames (passes come and go), so read them to ±5%.

| View | Base total | FP1 total | Base crowd | FP1 crowd |
|---|---|---|---|---|
| TV center (play 20) | 6.26M, 517 draws | 5.86M, 523 draws | 3.57M | 2.55M |
| TV high (play 60) | 9.61M | 9.52M | 4.54M | 4.31M |
| Walking, 3B concourse, the delay | 10.16M | 12.16M | 4.81M | 5.64M |
| Field-level seat, 3B | 9.60M | 10.95M | 3.73M | 4.16M |

The last job (5b5b08b, after the beards' change) read 5.95M and 523 draws in the TV center view. The TV views are lighter than before; the walking and seat views carry 1–2M more (the close figures, the throng's 0.4M on the concourse, the Cast's crowns and scarves). Those views had 4–8 ms of headroom. The coordinator should profile: the close level's vertex count (492, run twice for the motion vectors) and the throng's compute pass are the costs to watch.

## Noticed elsewhere
- The Squad's ball girls (`phanatic/Squad.js`) and the players' rig use their own towels and caps; CP-20 asks for the same grid towel there.
- The Cast's wet rule (`DRY`: roughness to 0.25 on the 27th) makes nylon jackets very glossy in the rain; real ones are, but it's strong on the front rows.
- RailFigures' figures (and FieldFigures') still paint a hair-coloured bill on the bareheaded rather than folding it away.
