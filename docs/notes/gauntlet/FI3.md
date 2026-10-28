# FI3: the insides, made convincing (gauntlet round 2)

Fixer FI3, 2026-10-28, branch `worktree-agent-a1c0d61b2f6798113` (off `ballpark` at 3bfa0d1, FP2's merge). Tickets from critic C2I (`.claude/gauntlet/r2/C2I.md`): C2I-3, C2I-9, C2I-5, C2I-8, C2I-10, C2I-12, C2I-13, C2I-14, C2I-11, C2I-15, C2I-18, C2I-19, C2I-16 (C2I-7 was already fixed). Every desk job was on the full park at 1280 × 800, with no console errors.

**Shots.** Before: the critic's (`.claude/gauntlet/r2/C2I/shots1..3/`) and mine on this branch's base, `.claude/fi3/shots1/` (job 1). After: `.claude/fi3/shots2..10/` in this worktree (ignored; copy them across if wanted): the last full set is `shots8/` (28 views and the glass on/off pair), and `shots10/` (the last job) the store after its last fix, with the TV views. The job files come from `.claude/fi3/mkjob.mjs` (one table of named views), so any view can be shot again by name. `diag/` holds four small diagnostic shots (the glass, what stood inside the store's block). (Jobs 2-6 came closer together than the brief's 15-20 minutes while I chased the store's and the glass's bugs; 7-10 were spaced.)

## Per ticket

**C2I-3, the Majestic Clubhouse Store (done).** New place `places/inside/Clubhouse.js` (registered in `places/index.js` as `clubhouse`).
- The glass was the facade's paint (`Frontages.js` `fzStore`, traced: an icon grid). At build time the store's two ground-storey glass runs are cut out of the facade's mesh (`exterior` group, mesh `facade`), both faces, and the granite round the glass put back in the facade's own material and uv (so it shades as before). Behind it now there's a real room in the block (6.6 m across the front, 5.9 m deep to its back wall, inside the facade's 0.8 m walls), behind real glass with bronze mullions and a pair of doors in the front's middle. `Exterior.js` and `Frontages.js` untouched; the upper storey (the Phanatic Attic) is still the facade's trace.
- In it (Getty 27 Oct 2008, the store lit to the ceiling; 25 Oct, WS Game 3, racks of red jackets and a yellow-framed World Series board; 20 Oct, jerseys on chrome racks): a maple strip floor, a white ceiling of cans; dress forms in the window bays (home whites, the 2008 cream alternates, road greys, the black World Series tee, the red jacket); the jersey wall down the brick side in slatwall, two rows face out with their chest prints, three rows of caps over them, the NATIONAL LEAGUE CHAMPIONS header lit; two round racks (red jackets; whites and greys), two tables of folded tees; the cash wrap across the back with two registers and the red bags, the cap wall behind it, the World Series board over it; two boards hung over the floor, one facing the glass. The marks and signs are canvas, invented (no MLB logo).
- People (Cast, on Tempo every 5th frame unseen): two clerks and a floor man in navy polos with lanyards, shoppers at the racks, the walls and the tables (a hand out to the rack, a shirt held up), a line at the registers, some with the red bags. How many shown follows `nightState()`: packed before the first pitch, in the rain delay and after the last out; about a third of that while the game's on.
- Found on the way, inside the block that had been shut:
  - one of the plaza's tree spots (Exterior's grate at (−96, 20)): the place takes it out of `exterior.treeSpots` before the gate3b place grows its trees (so `clubhouse` is listed before `gate3b`);
  - the Third Base Gate's stair tower (`Exterior._stairTower`, 10 × 7 m, at the gate's s = +20) stands across the block's open side, 2 m into it: its first landing's soffit was a black band across the store at 3.5 m, its mesh front a grey panel over it (found with a js that listed the meshes with vertices inside the room). The back wall stands 2.35 m in from that line, the side glass ends there (its last 1.6 m looked into the tower), and the floor was re-laid for the shallower room (5.9 m deep): the four-way rack dropped, the line five long;
  - a plaza lamp under the canopy (a local light) shone in through the glass and cast the tree's shadow on the jersey wall: the store's material has no local lights (`insideMaterial( …, { local: false } )`) and takes only 0.3 of the scene's own light (`direct: 0.3`: its lamps are baked in);
  - the block's brick stands open-topped 20 m up: a shadow-casting roof over the ceiling.
- The store's inside door behind 134 (FI1's CI-23): two racks of jerseys and a World Series board in the doorway, a greeter; the traced team-store rooms (Concourse.js room 7: the Home Stand, the clubhouse door, Make Your Own Phanatic) have jersey walls on their sides too, where they were plain white (one marked FI3 block in `ROOMS_WGSL`: two lines).
- The Home Stand staffed: a clerk at the register, another behind the racks, shoppers at a rack, paying, and at the table out front.
- Before/after: `shots1/00-storeFront`, `01-storeDelay`, `02-storePregame`, `03-storeSide`, `05-homeStand`, `27-storeDay` against `shots8/` and `shots10/` (the store after its last fix) of the same names, and `storeIn`, `storeWall` (inside, new).

**C2I-16, the bed's roses (done, with C2I-3).** `gate3b/Store.js`: each shrub rose is now a mound of 46 small leaf faces over a dome (each tangent to it, so the outline's a lumpy round), the leaves dark green going bronze, a few faded pink blooms and red hips on top. They were ten flat squares, pink and green.

**C2I-9, the suites' and the club's glass (done).**
- `Kit.js` `clearGlass` (the near glass): seen from outside by day, tinted dark grey-green at 0.86 alpha with the sky's reflection (the environment, at 0.55); after dark nearly clear; from inside, clear. Which side the camera is on is worked out from the quad's own normal (`in.N` turned back by `in.front`), not from `in.front` alone. The pair `shots8/28-glassCheck` and `29-glassOff` (the same view, the near glass on and off) shows what it does: the club behind it goes from a bright open box to a dim grey room.
- After dark, from inside, the room is mirrored in the glass: the view ray is reflected and the same room traced (the suites share `suiteRoomWGSL()` with their far glass; the club traces its ceiling panels, back wall and paintings). The walls are a ghost, the lamps bright (`shots8/suiteOut`, `clubOut`).
- The far glass (traced): by day the room behind is barely there (`lk` 0.07, the cans' glow at 12 %, the people dim), a grey-green tint over it, a floor of 0.12 under the Fresnel, a little more of the sky in it. The suites' mullions are navy (`navyFrame`).
- What's left: the photos' near-black band isn't quite reached; the rooms still read, dimmed. The rooms' own baked light by day is 75 % of the night's; if wanted it could be dimmed further (an `insideMaterial` option), at the cost of the inside views by day.

**C2I-5, the home plate entrance (done).** `Entrance.js`.
- The script: a house script (SignPainter, on this Mac), its strokes fattened, sized to 90 % of the canvas and the canvas made taller, a cream edge, the swash a long rounded bar, the stars over the i's measured off the word and lit blue at night; the returns dark (they were grey).
- The round banner: moved high and to one side, smaller and deeper in, as a navy and cream roundel with the P; one row of pennants, high. It sat dead centre over the script and read as a target.
- The lobby: its glass (Exterior's `suite-glass` at home plate) is given a material of this module's at build time: the same uv and corridors over it, and after dark a lobby that blazes white, its linear lights running back from the glass, cream walls and terrazzo, the desk and a man at it.
- The towers: their brick a deeper red, and after dark washed by two uplights at each foot, fading up the brick.
- Before/after: `shots1/18-entranceNight`, `19-entranceDoors`, `26-entranceDay` against `shots8/`.

**C2I-8, the suites' buffet (done).** `Suites.js` `_buffet`, `_cabinets`, `_rollTop`.
- Roll-top chafers (half cylinders with a handle) on wire stands over sterno cans and their blue flames, the pans' rims; the open ones show chicken fingers, meatballs in their sauce or hot dogs with their rolls, a serving spoon; a stack of plates.
- The galvanized bucket heaped with ice, the necks of brown and green bottles and silver cans out of it; red cans, beer-coloured cups.
- The fridge is an opening in the cherry front with a stainless frame, its lit back, white walls, three wire shelves of cans and bottles.
- The upper cabinets' fronts are panels (the cans' baked light on them is smooth: the stair-step is gone).
- Stainless, chrome, glass bottles and cans mirror the room, faked (`P_STEEL` in `Kit.js`: the view mirrored, the ceiling bright over it, the floor dark under, round glints of the cans). They were metals mirroring the sky probe: matte white indoors.

**C2I-10, the Diamond Club lounge (done).** `Under.js` `_lounge`, `_bar`; `Kit.js` atlas.
- The back panels from the atlas (`loungePanel`): dark, columns of names in white (invented initials and surnames), a great glowing batter or pitcher in each. In front: two frozen-drink machines, rows of bottles, two registers, the cooler.
- The ceiling: a line of seven pale discs with downlights over the bar's front, the red soffit's round ends, a duct with its grilles, two tracks of spot heads.
- The mural (`muralClub`): six tall figures in their own poses and colours (a swing, a high kick, a catcher's crouch, a stretch, a runner, a batter waiting) on a warm painted ground. It was eleven identical bars.
- The banquettes channel-tufted in horizontal rolls, two seat cushions each; the high-tops behind home pulled to the bar.
- The terrazzo: black and blue chips, brass strips fanning out, and the medallion (a steel ring, a red field, the white diamond) in the middle.
- Not done: the medallion's lettering.

**C2I-12, the Cooperstown Gallery (done).** `Kit.js` `drawPortraits`, `paintingUV`; `Club.js` `_plan`, `_displayCase`, `_case`, the far glass.
- 24 invented canvases (three atlas rows): head and shoulders large, a face with its light and shadow sides, eyes, brows, a nose's shadow, a moustache on some, in the uniform and cap of an era (1915 flannels with a collar, a striped cap, 1950 pinstripes, the A's blue, 1980 maroon, the powder blue road), over a grandstand's arches and a crowd in dabs, a small figure swinging or pitching. Nobody's likeness, not Perez's paintings.
- Dealt along the wall so no canvas repeats within six; the far glass deals them too.
- Every sixth place a lit wood-and-glass case (pompomflipflop, Aug 2009): a jersey on the navy back panel, two bats, balls on brass stands, a cap; its glass in the club's case-glass mesh.

**C2I-13, the Wall of Balls (done).** `Kit.js` `P_BALLS`: rows of baseballs on a deep maroon board, a maroon shelf under every sixth row, each ball shaded as a sphere lit from above with its stitches and a glint, its shadow on the board round it; far off it goes to the mix of maroon and cream. The club's traced wall is maroon too.

**C2I-14, the cages' netting (done).** The nets are in a mesh of their own on the late pass (`netMaterial()` in `Kit.js`, `Under.js`): each strand drawn with its share of the pixel, so near it's twine and far a soft veil of an eighth. No moiré, nothing cut away, and the cages' room now uses the shared under-stands material: the `net: true` discard is gone from it.

**C2I-11, the tunnels' helmets and bat rack (done).** `Under.js` `_tunnel`, `_helmet`: helmets as glossy domes in bands, dropping lower at the back, one ear flap, a short bill, vent holes, a few turned bill-in; the bat rack a dark frame with a tray, rails and slots, the bats standing knob-up (ash, maple, black, the grips taped), one or two out.

**C2I-15, the suite corridor (done).** `Suites.js` `_corridor`, `_backWall`; `Kit.js`.
- The ceiling a dark bronze open-cell grid (`P_GRIDCEIL`) with round cans; the cove kept.
- Wall-size photographs between the doors on the suites' side, one after another: the crowd (redrawn as a photograph: rows going back, faces with eyes and the light on them, caps, towels and arms up), the Vet, and a new one, Broad Street 1980 (invented).
- The doors honey in grey steel frames; the carpet's far colour more charcoal and taupe.

**C2I-18, the suites' outdoor seats (partly).** `Suites.js` `_shell`: a granite drink rail along the front wall and one on navy posts in front of the second row, with cups, plates and cans on them now and then. Not done: the glass dividers between the suites, because the seated crowd's seats don't line up with the rooms' partitions, and a pane through a fan is worse than none.

**C2I-19, the hollow under the stands (partly).** `Under.js` `_hollow`; `Kit.js`.
- The streaks: `Inside.panel4` gave a face with no uv function a uv of 0..1 over the whole face, so a pattern stretched along a 20 m wall into long streaks, and `P_SPECKLE` hashed world xz besides. `panel4`'s default uv is in metres now (as `quad` and `panel` have it), and the speckle goes by uv (`shots8/17-hollow`).
- Storage under caged work lights behind the third base corridor and beyond the cages: a cage of folding chairs, a golf cart, shrink-wrapped pallets, kegs, stacked crowd barriers.
- Not done: block walls and doors closing the hollow's open ends (the bowl's walls round it would need checking first).

## Counts

`__app.engine.meshRenderer.stats` (draws / triangles / pipelines), measured after a `__qa.still()` in the shot's js (the desk runs a shot's js before its frames), the full park:

| View | Before (job 1) | After (job 10, the last) |
|---|---|---|
| The store's front from the plaza, the 29th | 817 / 4,492,607 / 728 | 823 / 4,526,262 / 731 |
| In a suite behind home, looking out | 894 / 8,079,034 / 728 | 896 / 8,115,088 / 731 |
| TV center | 476 / 4,279,068 / 728 | 475 / 4,277,662 / 731 |
| TV high | 718 / 6,314,558 / 728 | 718 / 6,322,086 / 731 |
| Inside the store, in the rain delay (new view) | n/a | 815 / 3,650,803 / 731 |

- **Pipelines +3:** the store's room material, its glass, the cages' net (the cages' own material went: they share the under-stands one now).
- **TV high +8k triangles:** the suites' drink rails and their cups, in the always-drawn shell (and its shadows). TV center is unchanged.
- **The store's front +6 draws, +34k triangles:** the store's room, glass, frame and people (the facade's painted room cost nothing but pixels).
- **In a suite +36k triangles:** the buffet, the bucket, the fridge, the rails.

## For the merger

- **New file** `places/inside/Clubhouse.js`, and in `places/index.js` one import and one entry, `clubhouse`, listed **before** `gate3b` (it removes the tree spot inside the store's block before gate3b grows the trees).
- **Facade surgery at build time** (`Clubhouse._cutFacade`): it finds the exterior's `facade` mesh and the store's two edges by geometry (the footprint's A-B and B-C of `STORE`, the facade 0.8 m thick, its ground storey 6.5 m). If FW3 changes how `Exterior._buildFacade` builds that mesh (its thickness, splitting the quads, its uv), the cut finds nothing and the place quietly builds no room (the painted store stays). The facade's colliders are untouched: you can't walk in.
- **The lobby at home plate**: `Entrance._lobby` replaces the material of the exterior's `suite-glass` mesh nearest the home plate gate.
- **Concourse.js**: one marked FI3 block in `ROOMS_WGSL` (the `hitK >= 3` branch skips room 7; room 7's pattern takes `ax` along the side walls). FW3 has this file open.
- **gate3b/Store.js**: the roses only, a marked block.
- **Kit.js**: the atlas is 2048 × 2048 now (was 1024 tall); `cellUV` handles it, and Club.js's one hard-coded `256 / 1024` is fixed. New palette entries and patterns (`P_PLANKS`, `P_SLAT`, `P_PIN`, `P_STEEL`, `P_ICE`, `P_GRIDCEIL`); `stainless` and `chrome` are no longer metals (faked reflections instead). `insideMaterial` takes `local: false` (NO_LOCAL_LIGHTS) and `direct` (how much of the scene's light falls on it); `clearGlass` takes `reflect`, `colors` and `tint`; `netMaterial()`, `PAINTINGS` and `paintingUV()` are new. `Inside.panel4` with no uv function now gives uv in metres (it was 0..1 over the face): FI2's uses of that default were plain colours, the uppers' grain, and the hollow's concrete.
- **Under.js**: the rooms' material has no local lights now (they're closed boxes). If anyone relied on the concourse's domes lighting the lounge, they don't.
- No image files shipped: everything is canvas or shader; the invented artwork (portraits, murals, the lounge's panels, the store's prints and boards) is marked invented in the code. No named people (the panels' names are invented initials and common surnames), so nothing for CAST.md.

## Frame rate

- **The store**: its room (~11k triangles) is drawn only from the plaza's side within 200 m, never from FOX's cameras; its people (up to 35, Cast) only within 45 m; the frame, roof and the concourse door's racks are always drawn (small). Its material has no local lights.
- **Under the stands**: the cages' room lost its discard (hidden-surface removal back on for it), and the rooms' material has no local lights: both cheaper. The nets are a small late-pass mesh.
- **The suites**: the drink rails (~6k triangles) are in the always-drawn shell, so in the TV views and the shadow cascades too. The near glass's night reflection traces the room only on the glass's pixels, from inside, after dark.
- **The atlas** is twice the memory (2048², ~21 MB with mips).
- **Watch**: the TV high camera (the suites' shell and its rails, the glass); the plaza walk past the store before the first pitch (the store's people at their busiest).

## Noticed elsewhere

- The store's block (Exterior's footprint A-B-C-D at the Third Base Gate) was a shut, open-topped 20 m brick box with things inside it nobody had seen: a plaza tree (Exterior's grate list at (−96, 20): taken out of the spots here, still in the list), and the Third Base Gate's stair tower standing 2 m into it across its open side (its landing and flight through the store's back). Worth knowing for anyone who builds in the footprint's other notches.
- The desk's `hour` sticks for the rest of a page's life (as C2I and FI2 found): the night shots' js turns the replay's clock back on.
- `Entrance.js`'s script relies on the SignPainter font (macOS); elsewhere it falls back to Brush Script, thinner.
