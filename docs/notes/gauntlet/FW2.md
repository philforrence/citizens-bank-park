# FW2: the walk's outside and its fittings (gauntlet round 2)

Fixer FW2, 2026-10-28, branch `worktree-agent-a9d0e818b58d56581` (off `ballpark` at b9307c1). Tickets from round 2's walk critic C2W (`.claude/gauntlet/r2/C2W.md`) and inside-and-outside critic C2I (`.claude/gauntlet/r2/C2I.md`), in the order the coordinator gave. Six desk jobs, all on the full park at 1280 × 800; the last (job 6, 36 shots) loaded in 10.2 s with no console errors (job 3 had one WGSL error in the lots' new shader, fixed for job 4).

**Shots.** My jobs and shots are in the worktree's ignored `.claude/gauntlet/r2/FW2/` (absolute: `/Users/phillipforrence/citizens-bank-park/.claude/worktrees/agent-a9d0e818b58d56581/.claude/gauntlet/r2/FW2/`): `mkjob.mjs` (the framings, the critics'), `job1..6.json` / `.out`, `shots1/` (before, on b9307c1, named `before-*`), `shots2..5/` (the work as it went), `shots6/` (the last job, named `after-*`). The critics' own shots (`.claude/gauntlet/r2/C2W/`, `C2I/`) are the before for the framings I didn't reshoot.

## Counts

`__app.engine.meshRenderer.stats` after a 32-frame still:

| View | Draws | Triangles | Pipelines | Occluded |
|---|---|---|---|---|
| 3B plaza in the 27th's rain (`[[-96,8.6,52],[-78,10,30],60]`, seek 1550), before (job 1) | 865 | 5,766,563 | 714 | 109 |
| Same, after (job 6) | 889 | 5,828,330 | 726 | 115 |
| 3B concourse in the delay (`[[-40,8.6,40],[-30,8.3,47],70]`, seek 2185), before | 493 | 4,820,082 | 714 | 31 |
| Same, after | 515 | 4,730,761 | 726 | 44 |
| Lot K on the ground (`o08`, seek 2900), after (859 real lot cars) | 201 | 763,397 | 726 | 2 |

What's added: the grown street trees (152 of them, ~2,050 triangles each, in 140 m blocks that frustum- and occlusion-cull), 557 far trees as 12-triangle card crowns (one instanced draw, and one for the trunks), the real lot cars round you when you're on the ground outside the park (859 at Lot K, ~120-170 triangles each, four instanced draws), 16 coaches (one draw), five tents (four draws), the Linc's letters (one). The 3B concourse's triangles went down a little: the grown trees' blocks behind the facade are culled, and the lot cars are off inside the footprint.

## Per ticket

**C2W-5, the 27th's rain outside (done).** `game/Rain.js`, `Night.js`.
- Each drop is lit by the lamps actually near it: the rain's vertex shader runs LocalLights' chosen dozen (the six banks, the scoreboard, the nearest plaza posts, the gate's and the tents' lights) as they light a surface (inverse square, range window, spot cone), through the drops' forward lobe (seen against a lamp a drop blazes, side on a tenth of that). The banks also leak a halo (their fixtures' backs, the l0-l7 slots, 1/r²). The flat 0.25 floor of light is gone; a little of the city's glow off the cloud is left (0.02). A drop's coverage goes with its light, so unlit drops don't show at all. New uniform `lightK` (gain, the light that makes a drop show, the glow, the banks' leak) for tuning.
- Near dashes are 8 px on the wide lens (were 5), still a pixel wide: no flakes.
- The far sheets (`naStreaks`) show only where the air is really lit (`streakGate` on the lit air): in the beams over the field and the glare round the banks, not ruled over the whole black sky.
- Evidence: roadieshow 3023773899 (Oct 27 2008, the gate from the street: nothing against the dark brick, a glow round the lights); Getty 83458502.
- Before: `shots1/before-c01-towers-facade-27.jpg`, `before-w03-*`, C2W `shots1/w04-*`. After: `shots6/after-c01-*`, `after-w04-*`, `after-w03-*`; inside the bowl `after-d10-*`, TV `after-tv-high-27.jpg`, job 2's `a-tv-center-27.jpg` (the long lens's speckle kept).
- What's left: the rain outside is now quiet: visible near lamps within the rain box (~30 m ahead), and as speckle in the beams. Drops seen against a bright background (a lit window) don't show more than elsewhere; that would need the scene colour in the rain's pass. The TV high view's veil is a little fainter than FB1's (its drops are lit by the banks only where the cones reach them): FB2 should look.

**C2W-13, the park a black mass outside at night (done).** `Exterior.js`, `Frontages.js` (`fzSodium`), `Bowl.js`, `ConcourseSteel.js`, `Landmarks.js`.
- The street's sodium lamps wash the facade's brick and granite from below, in pools every 30 m, fading up the wall (both brick materials, outer faces only: `facade-brick` got FI1's `parkC` test).
- Over the Third and First Base Gates the frame's ceilings are lit pale green-white, a metal halide lens every 6 m and its pool on the deck, within ~40 m of each gate: the outer ring's floors (`outer-floors`, Bowl) and FI1's `concourse-deck` (ConcourseSteel).
- The stair towers' landings are lit underneath (a wall-pack's lens and its pool, new `stair-soffit` material) and their mesh fronts catch it.
- The scoreboard's back redrawn after ronniebruce 2988349308 (Oct 29 2008): a black field in a light frame, the cap shaded with seams, the P outlined, the ball with its stitches, the name in bright green; floodlit from below at night.
- Before: `shots1/before-c01-*`, `before-d03-*`, `before-d13-*`. After: `shots6/after-c01-*`, `after-d03-*`, `after-d04-*`, `after-d13-*`, `after-w03-*`.
- What's left: no people at the frame's rails (FW1's people); the brick masses' upper storeys stay dark but for their windows; the forecourt outside the Left Field Gate is still a black plane (C2I-17, not mine).

**C2I-1, the street trees (done).** `Complex.js` (`_trees`), using `places/gate3b/Trees.js`'s `plantTrees`.
- The 152 OpenStreetMap trees within 250 m of the park and outside W1's area are grown branch by branch with gate3b's grower: two thirds honey locusts as W1's, a third bigger and broader (8-10 m), October colours, in grates along Pattison's sidewalk. They're in 140 m blocks, each kept out of the static batching (`userData.dynamic`), so the blocks out of view or behind the walls aren't drawn.
- The 557 further out are four crossed leaf cards and two across the top round a thin trunk, a lacy crown texture with holes, the normals bent out from the crown's middle; one instanced draw. W1's place still finds them as `trees-crowns` / `trees-trunks` and grows its area's itself.
- None casts a shadow (no octagons under the lot lights). The four across the home plate entrance are gone (its photo has planters).
- Evidence: rdowens 3626083721 (Jul 2008, Pattison's honey locusts in grates), thephillyfly 2429950785 (Apr 2008, the entrance), bps52769 3401495889 (Oct 29 2008).
- Before: `shots1/before-o27-home-plate-entrance-day.jpg`, `before-o08-*`, `before-o30-*`. After: `shots6/after-o27-*`, `after-o08-*`, `after-o30-*`, `after-d11-*`.
- What's left: the far card crowns read as round puffs from the air (better than gems, not yet trees); the grower makes only one species' leaves.

**C2I-2, the lots (done).** `Complex.js` (`_lots`), `places/gate3b/Cars.js` (`LotCars`), `places/ThirdBaseGate.js` (marked block).
- Two tiers. On the ground outside the park, real cars in every stall within 170 m of you (W1's sedans, SUVs, pickups and vans, 90 % taken), re-chosen when you've walked 20 m (`LotCars`, four instanced meshes, up to 1,400 each). Inside the park and from the decks and the air, the lots' shader paints a car in nine stalls in ten on the same grid, with a little relief from above (the view ray stepped down through each car's body and cabin, seven samples), its contact shadow, lit by its pole's pool. The shader leaves alone the stalls with real cars (W1's round the plaza, LotCars' round you: `lotNear`), the tailgates (both gates') and the tents (`lotClear`).
- The lots' striping and its pools are now laid out in the field frame: in the world frame they ran 10 degrees off the lots' edges and off their own poles. W1's parked cars now line up with the stripes.
- Parked cars stand in their pole's light (the car material's `info.z` for a parked car; W1's parked cars too).
- 16 coaches (a new flat-fronted `coach` body) nose to tail on Darien's west curb and Hartranft's south curb.
- Evidence: Getty 83476766 and 83476821 (Oct 27 2008 from the north-east: every lot packed, the buses on the road), roadieshow 3024603196.
- Before: `shots1/before-o08-*`, `before-o17-aerial-ne-27.jpg`, `before-j05-*`, `before-o30-*`. After: `shots6/after-o08-*`, `after-o17-*`, `after-j05-*`, `after-o30-*`, `after-lot31-cars-29.jpg`, `after-darien-buses-29.jpg`.
- What's left: the painted cars are boxes of colour from the decks (no windscreen glint); nobody walks in the lots but the tailgaters.

**C2I-4, the World Series tents (partly).** New `places/gate3b/Tents.js`; `ThirdBaseGate.js` (marked block).
- Five frame tents: a 6 × 12 m on the 3B plaza off the walk to the gate, a 10 × 15 and a 6 × 12 along the 3B lot's Pattison side, a 6 × 12 and a 10 × 15 in the strip behind Lot K's fence. White vinyl on aluminium legs, a gabled roof with an invented mark (WORLD SERIES and 2008 under stars in navy and red, not MLB's logo), a scalloped valance with a red hem, walls on three sides (the back with clear windows), the fourth open to the walk; racks of jackets and a till, or tables and a bar, inside. After dark the fabric glows from within with the print in silhouette, and each tent's lamps are a local light on the paving.
- Colliders for the walker, obstacles for the plaza's people, and the cars keep out of them.
- Evidence: 7630606N06 2987956027 (Oct 27 2008, marquees glowing in front of the gate), 2988814584 (Oct 29), Getty 83433586.
- Before: `shots1/before-j01-*`, `before-j02-*`. After: `shots6/after-plaza-tent-29.jpg`, `after-lotk-tent-29.jpg`, `after-c01-*` (the plaza's at the left), `after-j05-*`.
- What's left: no Cast staff or customers inside (the place's Cast could put a few there on Tempo).

**C2W-8, Pedro Feliz's banner (done).** `places/Concourse3BSigns.js`. The player fits the picture helmet to cleats (scale 1.42, was 2.0, which cut the swing's and the leg kick's heads off), and is painted: the cloth shaded down one side, the jersey lit from the left with folds, a generic face under the brim's shadow (no likeness), batting gloves, a turned bat, cleats with soles, a gloss on the helmet. The Coca-Cola pole banners likewise. Before: `shots1/before-c03-feliz-banner.jpg`; after: `shots6/after-c03-*`.

**C2W-9, text reading backwards (done).** `Concourse.js` (the blade signs: each face's u runs to its own viewer's right; the rod through the face is gone, the sign hangs from the arm on two drops), `Complex.js` (`_spectrum`: u reversed round the drum). After: `shots6/after-c04-*`, `after-c05-*`, `after-o11-*`.

**C2W-14, the mezzanine girders (done).** `ConcourseSteel.js`: `wide()` takes web stiffeners (every 1.5 m on the mezzanine girder, the bridges', the suites' edge beam and the mid beam; 2.4 m on the cross girders), and the palette's maroon is satin (roughness 0.62, was 0.42). Before: `shots1/before-d14-*`; after: `shots6/after-d14-*`.

**C2W-17, the band over the SRO rail (not fixed).** `ConcourseSteel.js` `_lowSoffit`. It isn't FI1's dark panel z-fighting the bowl's face: I dropped the panel 6 cm and ran it forward under the suites' outdoor rows to their front (`D.suites + 0.05`) with a dark fascia band along its edge, and the pale band with its dark blotches is still there in `shots6/after-d10-*` and `after-c06-*` (as in `shots1/before-d10-*`). From the rail's eye (y 8.6) it sits about 12 degrees up, ~9-10 m out toward the field at y ~10.5: a downward-facing surface in front of the suites' front, and the blotches look like shadow-map acne on a face lit at a grazing angle rather than two coplanar faces. Next: a `js` that lists the meshes whose bounds hold field ( -5, 10.5, 39 ) from that eye, then either kill that face's shadow receiving or darken it. The changes I made are harmless (a dark deck under the rows) and stay.

**C2I-6, the Linc and the arenas (partly).** `Complex.js`.
- The Linc's face toward Pattison (in the footprint the stadium lies across, so it's a long side): a glass curtain wall in arched 9 m bays between rust-copper columns, mullions and transoms, a few floors lit behind it; the red script "Lincoln Financial Field" across it on a cut-out canvas, lit red after dark; the canopies' undersides glowing white.
- The Wachovia Center's glass band in panes on mullions with a transom, the lobby behind lit unevenly; the Spectrum's foot in panes with doors every 15 m.
- After: `shots6/after-o10-*`, `after-j22-linc-day.jpg`, `after-o11-*`.
- What's left: the masts are still plain beams, not raked spikes; no marquee pylon by the arenas.

**C2W-15, the silent way in (partly).** New `places/gate3b/Sounds.js`, `ThirdBaseGate.js` (marked block). On the 3B plaza: hooves as the mounted police's horses shift and walk and a snort now and then, FOX 29's generator at the curb, Pattison's traffic (hissing on the wet on the 27th), the scanner's beep and the turnstile's ratchet at each lane as a ticket is scanned (from the Arrivals' lanes), the rain on the gate's canopy, the lines' murmur, a program seller calling from the carts, security moving the lines along in the rush. The synthesized sounds and two of the Piper calls are the First Base Gate's (`concourse1b/Sounds.js`, its CREDITS). Checked in Node (every buffer built, no NaN). Not done: the 3B concourse's and the Alley's stand cries (new Piper clips needed).

**C2W-18, McFadden's windows (done).** `Frontages.js` `fzSaloon`, after the 2009 photo from inside C2I added (pvsbond 3992273398): the room 6.5 m tall and 12 deep under a pressed-tin ceiling washed blue-violet with its pendants; an island bar in the middle with its bottles, a big TV with the game and a neon each side; TVs and neon on the walls; the crowd in four ranks at jittered depths and heights, caps on most, red, black, grey and white tops. Before: C2I `shots2/o23-*`; after: `shots6/after-o23-*`, `after-o22-*`.

**C2W-21, the ticket windows (done).** `Concourse.js` (room 6 in `ROOMS_WGSL`): a counter just inside the glass, a clerk behind it at most windows (a red Phillies jacket or a navy blazer), the speaking grille, the glass's dimming and sheen; the office wall a shade darker; TICKETS · WILL CALL over the ticket window. Traced, not a Cast figure. After: `shots6/after-tickets-close-29.jpg`, `after-w10-*`.

**C2W-23, the Alley's floor (partly).** `places/alley/Promenade.js`: pale concrete along the stands (2.8 m) and along the rail and the flower boxes (3.8 m), the cross bands at the lamps; the brick a duller red-brown band down the middle; a season's stains where the crowd stands. Moderate confidence on the exact pattern (wallyg 2005 from above; gf Oct 29 2008). After: `shots6/after-w15-*`: duller and stained, concrete at both edges, but from the walk the brick band down the middle still fills most of the view; the photos have more concrete than that.

**Not done:** C2W-17 (above), C2W-7 (the Terrace concourse: an L, and it means re-laying the 400s' front over a real concourse, which touches the bowl's tiers and the TV high view), C2W-22 (the aisle steps are in `Stands.js`, which FW1 has open for the seats), CI-10 (the escalators), CI-12 (the Left Field Gate plaza), CI-18 (the Arcade's and the Pavilion's walls). For CI-10/12 the placement wants a scoped look at the plaza behind 138-140 first: the ramp (`leftfield/Ramp.js`) stands at x -125..-118, z -64..-96, and mostlyphilliespics 3972152381 has the escalator rising beside a brick tower with the Schmitter under it.

## For the merger

- **Shared files, marked `FW2` blocks:** `places/ThirdBaseGate.js` (the tents, the lot cars, the plaza's sounds, the tents' lights in `_lights()`, Cars' clear list); everything else is in my files.
- **game/Rain.js** (in my list, though FB2 has `game/`): it now imports `localLightsModule` and loops LocalLights in its vertex shader; `setLights` still feeds the banks (now only their halo). New uniform `lightK`. **Night.js:** new uniform `streakGate`.
- **Complex.js:** the lots' shader works in the field frame now (stripes and pools turned 10 degrees onto the lots' edges and poles); `lotNear()` / `lotClear()`; it imports `plantTrees` and `rng` from `places/gate3b/` and `W1_LOTS` from `Cars.js`.
- **Cars.js** exports `body`, `carMaterial`, `LotCars`, `LOT_NEAR`, `W1_LOTS`; `carMaterial` adds a parked car's pool light from `info.z` (w = 1); W1's parked cars now set it. New body type `coach`.
- **ConcourseSteel.js:** `wide()` has an optional `stiff` spacing; the palette's maroon is rougher (all of FI1's maroon steel); the low suite soffit moved 6 cm down and forward to `D.suites + 0.05`; `concourse-deck` is lit near the two frame gates.
- **Bowl.js:** only the `outer-floors` material (the gates' lit ceilings, uniform `gates`) and the `Vector4` import.
- **Exterior.js:** `facade-brick` has a `parkC` uniform now (set beside FI1's); the stair towers' landing undersides are a new `stair-soffit` material.
- No image files shipped (canvas and shader only), so no CREDITS line; the plaza's sounds reuse the 1B's clips (already credited). No invented people.

## The frame-rate risk

- **The lots' shader** (a seven-step relief march per lot pixel, outside W1's and LotCars' zones): cheap per pixel, but from the decks and the air the lots fill much of the frame. If the upper deck's views slip, drop the march to four steps.
- **The trees:** ~310k triangles grown, in blocks; seen whole only from outside or high up. On the plaza and Pattison you see one or two blocks.
- **Lot cars:** ~860 at Lot K (~120k triangles) when you're on the ground outside; none inside the park. The rebuild (every 20 m walked) is ~1-2 ms on one frame.
- **Rain (the 27th only):** the vertex shader now loops 12 local lights plus 8 banks for 80,000 vertices.
- Left field (the tightest view) gains nothing: it's inside the footprint (no real lot cars) and the tree blocks behind the scoreboard are occluded.

## Noticed elsewhere

- On the 3B concourse a hung Hatfield blade sign overlaps the stand's own die-cut oval from some angles (both FI1's), so "Hatfield" reads twice.
- `__app.places` has no handle on the Exterior's `gateGuards` for the 3B gate (the sounds fall back to Exterior's).
- The lot cars inside W1's zone (the 3B lots) still re-upload all their instance matrices every frame (`Cars.write()` marks every type's `instanceMatrix` dirty for the moving fleet): ~6,700 parked cars' worth each frame. Splitting parked and moving into separate meshes would save that upload.
- The aerial and upper-deck views show an orange striated band along the horizon on the 27th (the rain veil over the sodium carpet), not mine.
