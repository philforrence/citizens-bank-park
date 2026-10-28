# FI2: the insides (gauntlet round 1)

Fixer FI2, 2026-10-28, branch `worktree-agent-a7bf7d13e9621a3bb` (off `ballpark` at e3042ae, FB1's merge). Tickets from critic CI (`.claude/gauntlet/r1/CI.md`): CI-5, CI-6, CI-14, CI-16, and from the backlog CI-17. Nine desk jobs (the ninth run twice: my js failed the first time). Jobs 5-9 were on the full park, with no console errors.

**Shots.** Before: the critic's own (`.claude/gauntlet/r1/CI/shots1..3/`), and mine on this branch's base (`.claude/fi2/shots1/`). After: `.claude/fi2/shots2..7/` in this worktree (ignored; copy them across if wanted). `shots5/` and `shots6/` are the full park. Job files and outputs sit beside them (`job1..7.json`, `.out`).

## What's new

Four place modules, registered in `places/index.js` (one import and one entry each, so `only=suites`, `club`, `under`, `entrance` scope them):

- `places/inside/Kit.js`: the kit the rooms share.
  - One palette material for a whole room: carpet, block carpet, wallpaper, wood grain, acoustic tiles, granite, terrazzo with seam stitches, block, turf, netting, the Wall of Balls, and the atlas's prints.
  - Each vertex carries the light that falls on it, worked out at build time from the room's lamps: a can's pool, a wall's scallop, a dark room. So the rooms light themselves with no local lights. They stay inside the 12-light cap the domes already fill.
  - One canvas atlas (2048 × 1024): the corridor murals, eight paintings, the four bars' names, the suite plaques, HALL OF FAME CLUB, DIAMOND CLUB, the clubhouse mural.
  - Helpers:
    - `Reach` shows meshes only within reach of the camera.
    - `glassSplit` / `clearGlass` split each pixel of the glass between a clear near glass and a traced far glass.
    - `Screens` puts W2's LiveTV broadcast on the TVs.
    - `wallCollider`, `backFrom`.
- `places/Suites.js` (CI-5)
- `places/Club.js` (CI-6)
- `places/Under.js` (CI-14)
- `places/Entrance.js` (CI-17)

**The glass, near and far.**
- Within ~24 m of the camera (plus a 6 m dithered band) the suites' and the club's glass is clear, and the rooms behind it are real geometry with Cast people.
- Beyond that the glass traces the same rooms in its own shader (interior mapping): the same walls, cabinets, TVs, bars, paintings (their colours from the atlas), and people drawn with the bowl's `figure()`.
- The rooms and their people are drawn only near the camera, and only from where you could see in. That means:
  - inside the rooms;
  - on the field side of their glass;
  - for the club, from its seats and above.
  
  From the main concourse, FI1's walkway, or the suites under the club, they're off and the glass is traced however near.

## Per ticket

**CI-5, the suites (done).**
- Each run of the infield polyline is cut into suites about two panes wide (24 rooms, 6.0-7.5 m), 4.4 m deep. Each suite has:
  - striped wallpaper over a honey-wood wainscot, the dark patterned carpet, a white ceiling with two rows of cans;
  - cherry cabinets to the ceiling along the back, with the tube TV in its niche, the granite counter, the lit glass behind it, the drinks fridge, and an ice bucket of beers;
  - a granite buffet down one partition with chafing dishes (lids on, or food showing), plates and napkins;
  - a flat TV with the game on it (W2's LiveTV), and a framed picture;
  - a granite high-top with four honey barstools with red seats;
  - the wood door to the corridor, open in about half of them.
  
  Evidence: Ernst & Young's suite, Apr 2009 (`.claude/ref/home/flickr_21124578N08_...`).
- The glass from inside has bronze mullions at the partitions and mid-room, the sliding door's stile and pull, the sill and head. It's two-sided now.
- The corridor behind (2.4 m), from harpo42 2010 and greenheaps Aug 2008:
  - red-and-charcoal block carpet, an acoustic grid ceiling with cans, and a lit cove along the outer wall;
  - grey-green walls with the photo murals (invented: a crowd, the Vet);
  - each suite's door with its home-plate number plaque.
  
  The corridor's outer wall stands just inside FI1's brick: no second wall outside, and no door through to the walkway, which has no floor colliders.
- The elevators: the bowl's suite-level car stood inside a suite. It's hidden, and each bank's stop is now in the corridor, where a pair of flush stainless doors stands on the outer wall. You arrive looking down the corridor.
- **People:** parties in most suites (113 people, Cast, on Tempo):
  - on the stools, at the glass looking out, at the counter and the buffet;
  - beers, a sip now and then, talking, glancing out;
  - on their feet with their arms up at the last out.
  
  About a sixth of the rooms are dark and empty. A few are lit with no party.
- Walls you can't walk through: the partitions, and the back wall except at open doors.
- At build time, from the module: the bowl's `suite-glass` and `suite-frame` are hidden. The glass, mullions, band, end walls and floor are built here.
- Before/after:
  - CI `shots1/17`, `18`, `19` and my `shots1/17`, `18`, `19` against `shots6/a-suite-out`, `shots5/b-suite-back`, `d-corridor`, `e-glass-from-seats`, `i-3b-suite-day`, `h-elevator-arrival` (`shots4`);
  - from the field and the seats: `shots1/s1`, `s2` against `shots6/f-from-field-seats`, `shots5/g-from-mound`.

**CI-6, the Hall of Fame Club (done).**
- The room runs from the club glass back 9.5 m to a back wall, under a 3.9 m ceiling of acoustic tiles and light panels, on the red block carpet. Along it:
  - a drink rail down the glass with stools, high-tops in the middle, and TVs hung from the ceiling (both faces, the broadcast);
  - the four 2008 bars at their sections (2008 guide): Shibe Park Eatery 212, Baker Bowl Bistro 214, Recreation Park (martinis) 218, and Connie Mack's 229. Each has a back bar with a mirror and lit shelves of bottles, its name lit over it, a counter with a panelled front, brass foot rail and taps, stools, pendants, and two bartenders. The lettering is invented: no photo of the signs was found;
  - the Cooperstown Gallery between them: 40-odd canvases in gilt frames, with picture lights and brass plates. The canvases are invented: a player in the uniform of his day in an oil painter's manner, nobody's likeness, and not Perez's paintings;
  - the Wall of Balls behind home, rows of baseballs behind a cherry frame with its brass rail and HALL OF FAME CLUB over it (becca_elizabeth Apr 2008, greenheaps Aug 2008);
  - the architect's model of the ballpark in its glass case, with field, stands, light towers and trees (bradley-fry 2006);
  - the elevators on the back wall.
- **People:** a World Series crowd: 188 people at the bars, rail and tables, and standing in twos and threes.
- At build time:
  - the bowl's `club-glass` (its traced room) is hidden; its mullions stay;
  - the club-level car is hidden and the walker's club stop is moved to the elevators on the back wall;
  - a walkable floor is laid out to the back wall, because the bowl's club concourse is 8 m deep and the room is 9.5 m.
- From the seats the far glass traces the room: paintings in their own colours, the bars' names, figures with arms and shoulders (the critic's note on the old interior mapping).
- Before/after: CI `shots1/20`, `21`, my `shots1/20`, `21`, `c1` against `shots5/c1-club-inside`, `shots6/c2-wall-of-balls`, `c3-club-glass-from-seats`, `shots4/c4-rec-park-bar`, `c6-gallery`, `shots3/c5-model-case`.

**CI-14, under the stands (done).** Under the field level's seats round home plate, 16.8-28.6 m back from the foul territory wall (the seats are 4 m and more overhead there):
- **The Diamond Club's lounge**, behind home across the three faces (harpo42 27 Aug 2008; pompomflipflop Mar 2008; the 2008 guide):
  - cream terrazzo with a baseball's red seams inlaid, a black ceiling with cans;
  - the long bar with its front glowing red, under a red-lacquered soffit;
  - the back bar's frosted panels lit blue-white, TVs, DIAMOND CLUB;
  - black woven high chairs at the bar and high-tops, red leather banquettes with tables;
  - the clubhouse mural, invented in place of Tilghman's;
  - bartenders and a few members at the bar between innings.
- **Its glass wall at the first base end onto the indoor batting cages** (puckfiend 2005):
  - two netted tunnels on turf, the batter's box mats and plates, the pitching machine and its L-screen, ball carts and stray balls;
  - a walkway along the front behind a block half-wall.
- **The service corridor down the third base line:**
  - painted block with the red stripe, sealed concrete;
  - a sprinkler main, conduit and strip lights overhead;
  - maroon doors to the storerooms, the visitors' clubhouse doors at its end, and a security man.
- **The tunnels from both dugouts:**
  - up a ramp from the dugout floor, block walls with the red stripe, strip lights;
  - the bat racks with their bats, the helmets on a shelf (red on the Phillies' side, navy on the Rays');
  - a steel door on the dugout's wall, from behind. The dugout itself (Field.js) is untouched, so no doorway shows in the TV's view of it.
- The rooms are closed boxes: from the hollow you see plain walls. They're drawn only with the camera under the seats near them.
- Before/after: CI `shots3/14`, `15`, my `shots1/14`, `15`, `u3` against `shots5/u1-lounge-to-field`, `shots6/u2-lounge-bar`, `u4-cages`, `shots4/u5-3b-corridor`, `shots5/u6-1b-tunnel`.

**CI-16, the suite level's underside by day (checked: FI1's fix holds, nothing changed).**
- FI1's `suite-soffit` is a dark deck below the bowl's double-sided underside, and the sun leak is gone.
- FI1's brick and walkway replaced the blank precast back wall.
- See `shots5/15-overhead-129-day` and `17-overhead-3b-day` against CI `shots1/15` and shots2 `17`.

**CI-17, the home plate Suite & Club Entrance (done, as an overlay: Exterior.js untouched).** References: thephillyfly 20 Apr 2008 by day; pvsbond Oct 2009 at night.
- Over the lobby's doors and their lettered canopy (Exterior's), the 12 m bay is a glazed atrium up to 19.6 m over the street. It stands 0.3 m out from the old brick and its PHILADELPHIA lettering, which are now behind it.
- Inside the atrium (traced): the galleries at the suite, club and terrace levels, their lit ceilings, the slab edges, a few pennants and a round banner in the void.
- Two brick towers stand proud of the wall either side, with stone caps and granite bases, under a thin steel cap that overhangs.
- Across the glass, on standoffs: the Phillies script in red channel letters with white edges and returns, the two blue stars and the swash. It's lit red after dark and drawn in canvas with a script font.
- Before/after: CI `shots1/24`, shots3 `06` against `shots6/24-outside-home-facade`, `06-home-plate-entrance`, `x-home-plate-entrance-day`.

**Not done:**
- CI-10, the escalators.
- CI-12, the Left Field Gate plaza.

Both need the left field ramp tower's and the Arcade's geometry worked round (`leftfield/Ramp.js`, `Bowl` arcade back wall). That was more than the time left.

## Counts

`__app.engine.meshRenderer.stats` (draws / triangles / pipelines), the full park.

The desk runs a shot's `js` before it renders that shot, so a plain `JSON.stringify( stats )` returns the previous view's frame. That applies to my job1, job5 and job6 values and, I think, to everyone's. Job 7 measures properly: the js awaits `__qa.still()` first. It measures each view with FI2's places on and then off in the same page: groups hidden, people hidden, the bowl's suite and club glass shown again.

Walking views, the full park at night (hour 21), job 7, each measured with FI2's places on and then off in the same page:

| View | Without FI2 | With FI2 | Change |
|---|---|---|---|
| Ring behind home toward 3B | 593 / 7,542,122 | 596 / 7,554,741 | +3 / +13k |
| In a suite behind home, looking out | 808 / 9,953,534 | 815 / 10,001,110 | +7 / +48k |
| In the club behind home | 579 / 7,606,469 | 586 / 7,689,458 | +7 / +83k |
| Field level seats looking up at the suites | 530 / 7,547,316 | 548 / 7,665,920 | +18 / +118k |
| The Diamond Club's lounge (job 8) | - | 523 / 7,031,337 | |

The stats count every pass of a frame, the shadow cascades included.

**The TV views:** job 9 turned FI2's places off one at a time in the TV follow view (play 61):
- all on: 633 draws;
- the entrance or the under-stands off: 633 (they draw nothing there);
- the club also off: 631;
- the suites also off: 627.

So FI2 costs **6 draws** in a TV view: the suites' and the club's always-on shell and traced glass, the suites' shell also in the shadow cascades. That's about 3k triangles, and the traced glass replaces the bowl's two interior-mapped strips.

The rooms are off in FOX's camera modes, so the TV high and center views are the same: the only change there is the same shells and glass.

My job 7 and 8 "with/without" rows for the TV views (e.g. TV center 529 → 543, follow 596 → 633) are not comparable. The "without" shots inherited hour 21 from the walk shots before them; the "with" ones ran at the replay's default hour.

Recorded values: in job 8 (with), TV high was 767 / 9,016,747, TV center 543 / 7,229,148 and TV follow 633 / 8,629,133. In job 1 (before, mis-timed), the page's first frame was 805 / 6,214,910 and the TV high view 768 / 9,011,113.

Build: suites ~110 ms, club ~130 ms, under ~30 ms, entrance ~5 ms (the atlas canvas is drawn once). Pipelines +22 (the new materials).

## For the merger

- **Bowl.js, Exterior.js, Concourse*.js, ConcourseSteel.js, Stands.js, Field.js: untouched.** At build time the modules hide these bowl meshes, all found by name:
  - `suite-glass` and `suite-frame` (Suites);
  - `club-glass` (Club; its `club-mullions` stay);
  - the suite and club levels' `elevator-door` slabs.
  
  They move the bowl's elevator stops for 'Suite level' and 'Club level' (`bowl.elevators`, before `_addElevators()` reads them). If FB/FI rename these meshes or rebuild `_suites`, `_clubGlass` or `_elevators`, adapt `Suites` and `Club`.
- **Reused from other modules:**
  - the bowl's interior-mapping module (`figure()`, found on the `suite-glass` material's modules);
  - FI1's `brickWGSL` (ConcourseSteel.js);
  - W2's LiveTV material (`concourse3b-tv`, found on the places);
  - Cast, Tempo, `dress` and `GESTURE` (Concourse3BKit), and `nightState` (Concourse3BPeople);
  - home/Build.js's `Builder.frame`.
- **The suites' geometry must match the bowl's:** the glass at `D.suites + 1.9`, 7 m deep, the club seats' slab over it. The club's glass top follows `_buildUpperDecks`'s formula (copied).
- **The corridor's outer wall is a face just inside FI1's brick** (`dIn - 0.03` against FI1's `dIn + 0.06`). The suite-level elevator doors are flush on it. They don't line up with FI1's main-level cores, which stand 10 m further out.
- **No image files shipped:** everything is canvas or shader. The invented artwork (paintings, murals, the clubhouse mural, the bars' lettering) is marked as invented in the code. No named people, so nothing for CAST.md.

## Frame rate

- Interiors cost nothing unless you're in or near them, and can see in:
  - the room meshes, TV quads and clear glass are toggled by distance and line of sight each frame (a few distance tests);
  - the people are hidden with them, and move on `Tempo` (every 6th frame unseen).
- **Always drawn:**
  - the suites' and the club's far glass, which replaces the bowl's two interior-mapped strips. Its trace is a little longer: three people planes, and the club's four bars and its paintings' atlas lookups;
  - two small shells (mullions, bands, ends);
  - the entrance (64 triangles plus the script), within 160 m of it.
- **In the TV views** it adds 6 draws and ~3k triangles: see Counts.
- **Inside a room:**
  - the suites' visible rooms are ~10-25k triangles each, plus up to ~60-100 Cast people;
  - the club's rooms likewise, plus 80+ people;
  - the lounge is lighter.
  
  The people are the cost to watch: the club near home shows ~80 at once.
- **No per-frame CPU beyond:** the reach tests, a loop over ~320 people to sync their visibility, and the pose loop for the visible ones on Tempo.

## Noticed elsewhere

- **TV follow camera:** the high-third camera's view (`camera: 'follow'`) has the black rails of its own platform across the lower third of the picture (`Bowl._tvCameras` `platform()` rails at y + 0.5 and y + 1.05, the eye at `clubY + 2.2`). It's not from this branch: `shots5/02-tv-follow`. The camera should sit higher, or the rails drop on that platform.
- **The desk's `js` timing:** it runs before the shot's frames (see Counts). Earlier fixers' "stats in view X" values are probably the previous view's.
- **FI1's walkway** has no floor colliders, so the walker can't use it (or a door from the suite corridor onto it).
- **The concourse ring** at `[[12,8.6,52],[-25,8.2,48]]` is unchanged and clean (`shots6/r1-ring-home-to-3b`).
- **The desk's `hour` carries over between shots.** A shot without one inherits the last. Measuring "with/without" pairs needs the same hour set on both.
- **Not seen rendered:** after the last image, the lounge's frosted panels were dimmed (a palette value, `frost` in Kit.js) because they read too white in `shots8/after-lounge`.
