# FX3: left field, the police and the concourse (step 11, round 1)

Fixer FX3, 2026-10-29, on branch `worktree-agent-aba0afb710fc37aec`, off `ballpark` at e4b9951 (the same code as AD1's 609f71e). The tickets are breaker AD1's (`.claude/gauntlet/s11/r1/AD1.md`): AD1-1, AD1-9, AD1-6, AD1-15, AD1-2 and AD1-5. All six are done.

## How it was checked

- **On the CPU first:**
  - `node --check` on every file I changed;
  - `npm test`: all ok;
  - `node test/continuity.mjs`: 504 segments, start hash 801248349, duration 3785.503, so the clock is kept;
  - the back bars' triangles, counted in Node with a stub Kit (`count.mjs`): 17,664 upstairs and 10,833 downstairs.
- **Four desk jobs, all on the full park, all with no console errors:**
  - **j1** (800 × 500, before): the stats; three probes (Harry's frame, the rail's line on the dugout roof, the concourse's stands against the hall wall); and two frames AD1 hadn't shot (the downstairs bar from inside, the ramp's lamp from the side).
  - **j2** (1280 × 800, after): every ticket's after, in AD1's own frames.
  - **j3** (1280 × 800, after a tuning pass): TV center, `walk-concourse3b` and `walk-leftfield-harrys` at their standard moments, with the stats.
  - **j4** (1280 × 800, last): after the back bars moved into a mesh of their own. It has the same three views and the stats.
- **Befores:** AD1's own (`.claude/gauntlet/s11/r1/AD1/j1`, `j2`, `j3`). No code changed between AD1's base and mine.
- **Where the shots are:** `/Users/phillipforrence/citizens-bank-park/.claude/gauntlet/s11/r1/FX3/`: `j1` to `j4`, with each job and its result.

## Per ticket

### AD1-1: Harry the K's upstairs was sealed from inside (done, and the downstairs too)

**What was wrong:** the room builder's last quad, the inside of the front wall, ran across the whole front, opening and all. It was one-sided, facing in. So from the patio you saw in, and from inside both bars you saw a red-and-wood wall:
- upstairs, across the glass;
- downstairs, across the bar's open front onto the dining room.

**What I changed:**
- **The wall's inside** (`Harrys.js` `box()`): drawn only round the opening it's given (`UP` upstairs, `DN` downstairs), as strips above, beside and below it. Upstairs that leaves the 0.6 m between the glass head and the ceiling. Downstairs it leaves the 0.2 m over the bar's front.
- **The neon beer signs in the windows:**
  - from inside they read backwards (a mirrored quad facing the room), as neon does from behind;
  - each hangs on two thin black rods.
- **The glass** (`LeftField.js`, one property, marked): two-sided. From inside you get its faint Fresnel and the smudges.

**Evidence:**

| | before | after |
|---|---|---|
| 1 m in, looking out | AD1 `j3/01` (black) | `j2/a01`, `j4` |
| 4 m in, looking out | AD1 `j3/02` (people facing a red wall) | `j2/a02`, `j3/f04`: the patio's high-tops and heaters, the rail, the people along it, the Porch, the lit bowl and the towers, and YUENGLING backwards |
| also | AD1 `j2/03`, `j1/13` | `j2/a03`, `a04` |
| downstairs, from behind the bar | `j1/b01` (a wood wall) | `j2/a05`: the dining room, the hanging HARRY THE K'S sign and its GRILLE / BAR arrows, the maroon steel and the pendants, the 140s, the field and the bowl |

The downstairs after is as the 2009 NLCS photo of the lower level has it (`ref/leftfield/flickr-2009-10-18-nlcs-harrys-lower-level-…`: maroon beams, low pendants). The upstairs after has the 2008-10-10 photo's view from the rail (`ref/leftfield/flickr-2008-10-10-nlcs-harrys-upper-high-top-…`): the whole bowl at that height, the blue high-tops at the rail.

**The patio from outside** (AD1 `j3/03`, `j3/f03`) is unchanged in what you see, apart from AD1-9's ceiling and bottles.

### AD1-9: the back bar's bottles were cartons and the ceiling a black void (done)

**What was wrong:**
- **The bottles** were painted on a flat lit panel: rectangles with a label band.
- **The ceiling** had an albedo of 0.025, with the cans floating in black.

**What I changed:**
- **`Harrys.js` `backBar()`:** the back bar built in three dimensions in front of the panel, upstairs (19 m) and downstairs (12 m):
  - **Mahogany pilasters** every 2.3 m, a cornice with a brass line, and in each bay two glass shelves with a strip of light under each front edge. There's a strip along the counter's back too.
  - **On the shelves and the counter, about 700 bottles.** Each is half a three-sided lathe (only the half facing the room is built), 39 triangles a bottle:
    - five shapes: a fifth, a tall liqueur, vodka, a squat rum or cognac, and the well's liter;
    - a shoulder, a neck, and a cap or foil;
    - a label band in one of eight colours;
    - glass in six colours.
  - **The counter row** is the well: liters with chrome pour spouts. Every third bay has a register and its screen, and some have a pyramid of upturned pints on a bar mat. Now and then a bottle is missing (it's being poured).
  - **Their own mesh:** the bottles and their bays are a mesh of their own (`harrys-backbars`). It uses the Kit's material, has its own tight box, and has `userData.dynamic` set so the static batch doesn't fold it back into the corner's.
- **`Kit.js` palette (appended):**
  - six glasses, lit through by the strips;
  - label colours that catch the room's light;
  - foil, stainless, the ramp's lens, shelf glass, the strip, the call button and black rod.
- **`Kit.js` shader:** the glass's glow falls off toward its edges (×(0.12 + 0.88 f³), f the facing). So a bottle is bright through its middle and dark at the rim.
- **`Atlas.js`:** the back bar's cell is now the mirror behind them: smoked glass, the strips' warm light on it, the bottles' backs soft and dim in it, the bevelled panel seams. Its shelf lines are at `SHELF_PX`, which Harrys.js reads to stand its shelves at those heights.
  - The blur is drawn once, from a canvas of its own. A canvas filter on every fill cost 3.8 s of the load in j2, which j3 confirmed fixed: leftfield builds in 138 ms (78 before).
- **The ceiling** (`harrys-room`, kind 2): the deck over the room, painted out a dark warm grey (0.072):
  - its ribs every 0.3 m across the room, and a darker line at each beam every 3 m;
  - the cans every 1.8 m, as before;
  - each can's soft pool on the paint round it.

  This is grounded in the lower level's ceiling, the deck's own exposed structure (2009 NLCS photo). Bars paint theirs out dark.

**Evidence:**

| | before | after |
|---|---|---|
| the bar from the stools | AD1 `j1/12` | `j2/a07` |
| the back bar close | — | `j2/a09`, `j3/f01` |
| the ceiling | AD1 `j2/04` | `j2/a08`, `j3/f05` |
| from the patio | AD1 `j3/03` | `j3/f03` |

In j2 the ceiling read too bright, like a beige slatted ceiling. It's darker in j3, with softer pools.

**What's left:**
- The bottles are three-sided, so they're faceted from close up, and the glass is emissive, not refractive.
- The labels are colour bands, not printed. An atlas of real-looking generic labels would be the next step.

### AD1-6: the elevator behind 141, the floating sign, the bare walkway (done)

**What I changed:**
- **The doors** (`Access.js`): fronted as the concourse's are (FI1's, in Concourse.js):
  - two brushed stainless leaves meeting on a dark line, a hand-worn strip at their edge;
  - a stainless frame (jambs and head) standing proud of the maroon cladding, and a galvanized sill;
  - the hall lantern over the head (up and down arrows, the one lit);
  - the call plate beside the doors with its one lit button: up at the concourse, down at the Porch.
- **The sign:** the park's own elevator sign (cream, ELEVATOR in the dark letters with the car pictogram, the red band, after ZoeR's April 2008 photo by the Home Stand, as FI1 used). The band says where it goes: "↑ SCOREBOARD PORCH 241–245" at the concourse, "↓ MAIN CONCOURSE" at the Porch.
  - The atlas cells are `liftUp`, `liftDown` and `liftFloor`.
  - It was a blank green bar. I followed the brief's "as the park's other elevator signs are", which are cream and red. Green was FA2's guess.
- **The "SCOREBOARD PORCH / SECTIONS 241–245" sign** (`Harrys.js`) is now a sign cabinet:
  - a navy box, its face printed on both sides (the walkway's and the Porch's), with a black cap along its top;
  - on two black-painted pipe posts off the walkway's slab, each with a base plate and two brackets.
- **The walkway's concrete** (`harrys-walkway`, the material of both Harry's walkway and the Porch's):
  - saw-cut joints every 2.4 m along the board and every 1.5 m across it, in the board's frame;
  - a broom finish across, fading with distance;
  - grime blotches, darker joint edges, and gum spots.

  The look follows the Porch from the 3B side (Commons 2008-03-29): a jointed, broom-finished slab.

**Evidence:**

| | before | after |
|---|---|---|
| the concourse stop | AD1 `j3/24` | `j2/a10`, `j3/f06` |
| the Porch-level stop and the sign on its posts | AD1 `j3/14` | `j2/a11` |
| the walkway | AD1 `j1/11` | `j2/a13` |
| also | AD1 `j2/25` | `j2/a12` |

**What's left:** the sign's posts have no colliders (they're 6 cm pipe; you can walk through them).

### AD1-15: the LF ramp's lamp, a blazing box (done)

**What was wrong:** every lamp on the ramp was a 0.5 × 0.18 × 0.5 m box of the bar's lamp glow, blown out at night: three under each run, and one on each pole.

**What I changed** (`Ramp.js`): the fixtures as the March 29, 2008 photo of this ramp has them (`ref/leftfield/commons-2008-03-29-crop-lf-ramp-maroon-switchbacks-…`):
- **Under each run:** small grey bell domes (0.42 m across) on short black stems from the deck's underside, their lens facing down.
- **On top:** the poles' flat round heads (0.76 m) on a 0.6 m arm, each with a lens under it and a cap.
- **The lens:** a new palette entry, `lens`, dimmer than `lamp` (glow 0.3 against 1.0). I toned it down again in j4.

**Evidence:**

| | before | after |
|---|---|---|
| the run | AD1 `j1/19` | `j2/a14`, `j3/f07` |
| from the side | `j1/b03` | `j2/a15` |
| from the left field seats | — | `j2/a16`: small points, as in the photo |

From directly under a fixture the lens is still bright. A real HID lens is too.

### AD1-2: the police on the 3B dugout roof (done)

**What was actually there:** I measured it in j1, with the `b04` probe.
- **The rail** (FA3's ledge rail) is 2.87 m back from the dugout's front line, on the roof's back edge (the roof runs −0.45 to 2.85).
- **The officers** stood 2.05–2.38 m back, 0.49–0.82 m in front of the rail. So they weren't inside it.
- **What AD1 saw:** in AD1's `j3/08` crop the rail's top bar passes behind their legs; from the field it reads at thigh height, behind them. AD1 had taken the rail to be at ~2.2.
- **But it was too close:** at 0.5 m, the parade-rest elbows and hands come within a few centimetres of the pipe.

The 2008 photo (`ref/rail/flickr_puffygreenjacket_2994329550_police_on_rays_dugout_roof_…`, 9:32 pm) has the officers spread over the back half of the roof, facing the crowd.

**What I changed** (`Police.js`):
- **The rail's line** is read from the bowl: the field level's section over the dugout and its `tier.ledge`, through `tierSections`, in the dugout's frame. It can't drift from Stands.js now. The fallback is `DUGOUT_WIDTH + 0.27`.
- **The officers** stand 0.85 to 1.6 m clear of it (t = 1.27–2.02, seeded per officer). That spreads them over the roof's back half.

**Evidence:**
- **j2's** `a17` value: the nine at t = 1.31–1.93.
- **Shots:**

  | | before | after |
  |---|---|---|
  | from the home end | AD1 `j3/08` | `j2/a17` |
  | top down | AD1 `j3/09` | `j2/a18` |
  | the celebration | AD1 `j2/16` | `j2/a19`: spread over the white roof, facing the crowd, the rail clear behind them |

### AD1-5: the black block on the 3B main concourse (done; see "What the merger must know")

**What it was:**
- **The block** is the back of McFadden's unit behind 127 (the concourse's `_unit`): 7.5 m of red ground-face block with no light on it. Every light near it is a dome over the concourse, on the far side.
- **Where the camera is:** the `walk-concourse3b` eye at (−40, 8.6, 60) is 5.6 m outside FI1's hall wall (`ConcourseSteel._hallWall`, `closedS` 25.7–172.4, which takes in this unit at s 142.7).
  - That wall is drawn one-sided, facing the concourse, so from out there you see through it to the stands' backs.
  - The walk audit reaches that outer ring at 7.01 (cells at 61–77 m from the plate). You get into it from the gate's end.

**What I changed** (`Concourse.js`): every stand's back, wherever its unit is, is finished as a stand's back:
- **The door:** a painted steel service door near one end, in its frame. It has a stainless kick plate, a push bar, the hinge side's dark line, and an AUTHORIZED PERSONNEL ONLY plaque. The plaque is a new cell in the stands' sign atlas: painted, unlit, white with the park's red letters and navy rules.
- **The wall pack** over the door: its dark housing, and its lens lit.
- **The light:** the wall pack's pool on the block is in the block's own shader. The back face is flagged by its uv (over `BACK_UV`, u the metres from the lamp, v the height), with a faint bounce everywhere on it.
  - It isn't a local light, so it costs no light slots. 27 wall packs would have taken the nearest-light slots from the concourse's own domes.
- **The name:** on a food stand, its die-cut name again over the back, at 58%, for whoever comes at it from behind.

**Evidence:**

| | before | after |
|---|---|---|
| `walk-concourse3b` | AD1 `j3/18`, `j1/b05` | `j2/a20`, `j3/f11` |
| close to the door | AD1 `j3/19` | `j2/a22`, `j3/f10` |
| the 3B gate end, where the backs face the atrium for real | — | `j3/f08` (Hatfield's back, its name and its door), `j3/f09` (Brewerytown's) |

## Counts (`engine.meshRenderer.stats`: draws / triangles)

These are read in a shot's `js`, so they're the view rendered just before it.

| view | before (j1) | after (j3) | last (j4) |
|---|---|---|---|
| `walk-leftfield-harrys` (play 60) | 1,053 / 5,310,140 | 1,055 / 5,355,897 | J4LF |
| TV center (play 20) | 509 / 3,495,853 | 506 / 3,666,058 | J4TV |
| `walk-concourse3b` | 814 / 3,222,479 (seek 3000) | 822 / 3,269,133 (play 60) | J4WC |
| Harry's upstairs, 4 m in, looking out | 789 / 2,492,366 (a wall) | 1,180 / 5,565,255 (the bowl through the glass) | — |

- **Where the triangles come from:**
  - The back bars are 28.5k triangles.
  - The ramp's fixtures, the elevator's fronts, the sign and the neon backs add about 3k to the corner's Kit mesh.
  - The stands' backs add about 2.5k to the concourse's props mesh.
- **What it costs:**
  - **Draws:** no new ones apart from the back bars' own mesh.
  - **Pipelines:** 783 before and after.
  - **CPU per frame:** nothing.
  - **Load:** leftfield builds in 138 ms, against 78.
- **The TV center's +170k triangles in j3:** about six times the bottles. The likeliest reading is that the corner's one Kit mesh is drawn in more than one pass (it's in view of FOX's center field camera). That's why j4 moved the bottles into a mesh of their own, with their own box. See j4's numbers.

## What the merger must know

- **Files touched:**
  - **My tickets':** `places/leftfield/Harrys.js`, `Kit.js`, `Atlas.js`, `Access.js`, `Ramp.js`; `places/rail/Police.js`; `src/ballpark/Concourse.js`.
  - **Outside my list:** `places/LeftField.js`, one property (`side: 'double'` on Harry's glass), marked FX3.
  - Every block is marked `---- FX3`.
  - **Not touched:** FX1's files, FX2's (`Stands.js`, `Crowd.js`), the cameras and the Director.
- **Atlas.js:**
  - The old painted-bottle block is gone.
  - The atlas's seeded random sequence after the back bar now differs, so the photographs' and the scorecard's random marks come out differently. They're random marks, not content.
- **Kit.js:** the palette entries are appended, so no index moved.
- **The hall wall is still see-through from outside** (`ConcourseSteel._hallWall`, FI1's: one-sided brick facing the concourse). This is a find, not fixed here (not my file). From the outer ring between it and the facade, which the walk audit reaches, you see through it to the stands' backs, and the collider stops you 5 m short of them.
  - **The fix** is the wall's outer face. It's a few lines in `_hallWall`: the same quads with the normal reversed. Or close the ring off at the gate's end.
  - **What it does to the perf view:** once the wall has its outer face, the `walk-concourse3b` eye (−40, 8.6, 60), which is out in that ring, will look at a brick wall 6 m away. The standard view should then move onto the concourse proper, for example (−36, 8.6, 46) → (−20, 8.6, 30). The perf history will need a new baseline for it.
- **The police:** FA3's ledge rail on the dugout roof isn't in the 2008 photo (`puffygreenjacket 2994329550`): the first row's fans sit right at the roof's back edge, and their towels lie on the roof. That's for whoever has Stands.js, not for me.
- **The clock is kept:** 801248349 / 3785.503.

## Frame-rate risk

1. **Harry's upstairs, looking out.** It used to be a wall (789 draws, 2.5M triangles). Now it's the whole bowl through the glass (1,180 draws, 5.6M), like any view from the Porch. The corner was already the second-heaviest place (24–25 ms, PERF.md step 10). This is the view I'd profile: from inside the upstairs, looking out over the patio.
2. **The back bars' 28.5k triangles.** They're in their own culled mesh as of j4. If the TV views still show the gain, check whether the static batch or the shadow passes are picking them up.

## Noticed elsewhere

- **The black wedge in AD1's `j2/03`:** at the left of the frame from (−80, 17.05, −114) inside Harry's there's a black block, before and after. Probably the room's end wall or a stool at the eye. I haven't looked into it.
- **Harry's upstairs ceiling height:** at 3.5 m, the room's ceiling is only 0.6 m over the glass head (UP.y1 18.31, ceiling 18.91). Fine, but the strip of red wall over the glass reads deep from inside.
