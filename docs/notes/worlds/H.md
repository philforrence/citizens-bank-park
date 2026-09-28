# H: the people-CPU tune-up, then Harry the K's and the left field corner

Wave 3's H. Branch `worktree-agent-a0654e0b978b37c73`, on `ballpark` at `bb62637`. The place is **`leftfield`**
(`src/ballpark/places/LeftField.js`, its parts in `places/leftfield/`). Live notes were `NOTES-H.md` in the wave's
shared space; the references are in `.claude/ref/leftfield/`.

## 1. The people-CPU tune-up

The seven places' people were +2.2 to +3.6 ms of CPU a frame (WAVE2.md). Nobody can tell whether a person they can't
see was moved this frame or three frames ago; the tune-up moves the unseen and the tiny less often, and makes each
move cheaper, without changing what anyone on screen does.

**What changed** (commits `32114ee`, `cdcc1ac`; everything in the places' update code is in `// ---- H` blocks):
- **`places/Tempo.js` (new).** `new Tempo( [ cast ] ).step( dt, camera )` returns the time to move a place's people
  by: every frame while any of its troupe was drawn last frame, else every 4th frame with the time since (the
  clockwork keeps up, the walkers walk as far; the sleeping places take turns). A camera cut or a quick swing wakes
  every place for that frame, and `tempo.cut` tells a place to move everyone (the pool's `p.lod` is the last view's).
  `cadence( p, d2 )` is the per-person rate: seen every frame; a few pixels tall every 3rd (P0's rule, and P0's
  "over 35 m" rule kept unless the lens makes them big: the TV's long lens sees people 150 m off at a tenth of the
  screen, now moved every frame); under a fiftieth of the screen's height every 6th; unseen every 4th (6th past
  40 m). `window.__tempo.off = true` runs everything at the old rates, for paired measurements in one page.
- **Cast.js:** the pool records `p.frac` (how tall each person stood on the screen) and keeps its per-frame lists.
- **The places on the tempo:** the concourses (3B, 1B), behind home, the Third Base Gate and the Alley move their
  people (and what they carry, throw and sit under: the gear, the blankets, the signs, the fouls, the gate's
  horses and FOX 29's shot) on their tempo. Every frame as before: the sounds, the TVs, the steam, the traffic, the
  lights, the Alley's pens (the players' rig), the Phanatic, the rail.
- **Per person:** the seated fans behind home plate and the concourses' stand staff now move by `cadence()` (they had
  no rate before); the concourses' walkers keep their own, with the long-lens exception.
- **Cheaper moves** (`Concourse3BPeople.js`, `home/Fans.js`): no arrays made per person per frame (the bins kept and
  emptied, the taken spots counted, the avoidance and the columns without destructuring, `_worldDir` reusing the
  point `_move` just looked up), a line's slot and a staff member's spot looked up once, the fans' acts compacted in
  place, their idle choice kept until its slot changes, `pickIdle`'s closure gone. Per call: `_walk` 11.1 to 7.3 us,
  `_avoid` 4.2 to 2.6, `_move` 2.9 to 1.7, `_atRail` 4.5 to 2.4, `_inLine` 7.3 to 4.3 (instrumented, Node).

**The numbers.** Two ways, because the machine is shared (other sessions' Chrome and agents; the exclusive lock
only holds the GPU) and a run's CPU drifts by 2x from one job to the next:
- **Node, the base and this tree built side by side in one process and run in turns** (`ab.mjs`: the GPU
  stubbed, each place's `update()` and the pool's flush on the thread's own CPU time, the least of 8 rounds of 60
  frames; `.claude/qa/h/tools/`). The seven places and the flush, ms per frame:

| View | Base | Tuned | |
|---|---|---|---|
| TV center | 0.96 | 0.49 | 51% |
| TV high | 1.07 | 0.55 | 52% |
| Overview | 1.18 | 0.88 | 74% |
| The plaza (WAVE2's) | 1.64 | 1.28 | 78% |
| Concourse, 3B | 1.28 | 0.78 | 61% |
| Concourse, 1B | 1.27 | 0.62 | 49% |
| Behind home | 1.25 | 1.04 | 83% |
| Left field | 1.17 | 0.43 | 37% |

- **The browser, under the lock's exclusive mode** (the full park, 1280 x 800, WAVE2's views; the last profile,
  `.claude/qa/h/tools/mkfinal.mjs`): in each view, Tempo on and `__tempo.off` in turns, three pairs, medians. The places'
  updates and the flush (ms a frame), and what the frame's CPU saved. (`__tempo.off` keeps the cheaper moves, so
  this understates the whole tune-up; it includes the new left field place, on its own tempo or at the full rate.)

| View | Off (the old rates) | On | | Frame CPU saved |
|---|---|---|---|---|
| TV center | 1.73 | 0.96 | 55% | 0.46 |
| TV high | 1.96 | 1.32 | 67% | 0.43 |
| Overview | 2.03 | 1.73 | 85% | 0.23 |
| Night, TV center | 1.65 | 0.97 | 59% | 0.50 |
| The plaza (WAVE2's) | 2.53 | 2.24 | 89% | 0.01 |
| Concourse, 3B | 2.32 | 1.57 | 68% | 0.58 |
| Concourse, 1B | 2.25 | 1.31 | 58% | 0.56 |
| Behind home | 2.08 | 1.83 | 88% | 0.16 |
| Left field | 1.82 | 0.89 | 49% | 0.87 |

- The places' whole cost to the frame (in-page, the places on against all of them off, as WAVE2 measured it),
  before (the base, exclusive, run 1) and after (the last run, with the eighth place in): TV center 1.77 to 1.27,
  high 1.93 to 1.51, overview 2.75 to 2.04, night 1.77 to 1.14, plaza 2.67 to 2.57, concourse 3B 2.34 to 1.87,
  1B 2.12 to 1.65, behind home 1.78 to 1.63; left field 1.23 to 1.64 with Harry the K's in it. Across runs these are
  rough (the "places off" frame itself ran 0.2 to 1 ms slower in the last run).

**Where it gets to half, and where not.** About half in the TV views and the walking views (the places out of view
sleep; their fixed work, the lines and the staff, goes with them). The views that see nearly every place at once
(the overview; WAVE2's "plaza", a camera under the plaza's floor looking up through the gate at the concourse; the
field behind home looking up at the stands) gain 15-25%: there the concourses' people are all "seen" through the
frustum, walls or no walls (tiny, and hidden behind the stands and the facade), so they stay awake and move every
3rd or 6th frame. An occlusion test for the concourse's people (the facade, the top of the seats) is what would
win the rest.

**For the next builders:** new people should use `Tempo` and `cadence()`; no arrays or closures per person per
frame; and never solve arm IK per frame (`railArms()` called per person per frame cost me 1.7 ms before I cached it).

## 2. Harry the K's and the left field corner

What was there: Landmarks' closed brick box under the scoreboard with a flat strip of lit "glass" on a patio hidden
behind the porch, a covered concourse open to the sky behind the 140s, an empty L-shaped plaza inside the Left Field
Gate (the scouting counted 18 people), a brick wedge over Monty's Angle, sky where the Left Field ramp stood.

### The changes

1. **Harry the K's opened up** (`leftfield/Harrys.js`; Landmarks exposes the house in a marked block and the place
   replaces it). The brick house now has two openings and two rooms. **Upstairs**, behind the glass (mullions, the
   neon beer signs in the windows: Budweiser, Yuengling Lager, Miller Lite): the bar along the back wall, the back
   bar's lit shelves of bottles, the taps, stools, the pendant lamps, TVs showing the broadcast (W2's LiveTV), the
   photographs, the Harry Kalas plaque ("The Voice of the Phillies since 1971", Ford C. Frick Award 2002), the
   pennants (1950, 1980, 1983, 1993, and the NL pennant of October 15, 2008), the Spring 2008 menu with its prices, the
   "$1 dogs in the Alley Hour" board. **Evidence:** Phillies.com's Harry the K's pages and menu (captured Oct 6, 2008:
   the prices, "Harry's Upstairs", the Alley Hour special); BaseballParks.com (2004): two levels, "at the rear of the
   seating sections on the field level and the upper Scoreboard Porch level". The rooms' furnishing is invented.
2. **The patio** (Flickr, Oct 10, 2008, the NLCS: Harry's upstairs over left field): round high-tops in glossy royal
   blue on pedestals right at the rail, white stools, the menu in its acrylic stand, Coke cups; three tall propane
   patio heaters (invented, for 47 and 44 degrees).
3. **The walkway** joining the porch's top row to the patio (Landmarks' patio stopped 3 to 7 m short of the porch,
   open to the concourse below), its rails at the ends, and fans standing along the porch's back wall; it keeps the
   rain off the concourse below (a place's `rainRoof`, a marked line in BallparkApp).
4. **The lower level's bar** in the house's ground storey, open to the covered concourse: the counter and brass
   rail, taps, the back bar, the kitchen's pass under heat lamps, the lit fascia, the menu, "please wait to be
   seated".
5. **The lower level's dining room** under the porch: four-tops with numbered tent cards and ketchup, the counter
   with stools along the back of the 140s looking out over the seats (Phillies.com's "view from Harry's lower level",
   2007), the host stand, a low rail; overhead the deck's maroon beams and joists and dome pendants hung low on long
   cords; the old tube TVs on wall brackets (the 2009 NLCS photos of the lower level).
6. **Three murals** of our own on the brick over the lower bar (Phillies.com, 2008: "three murals" in Harry's by a
   local artist; the 2009 photos: big, bright, painterly): the fans and the skyline on a summer night, the booth's
   microphone ON AIR over the diamond, a kid reaching up with his glove. No one's likeness (`leftfield/Murals.js`).
7. **The hanging sign** under the walkway, both faces: the long orange hexagon in a lime-green neon rim, the
   microphone and its radio waves, HARRY THE K'S, BROADCAST BAR & GRILLE (Flickr 2009, lit at night), with the LOWER
   LEVEL / UPPER LEVEL arrows under it (BaseballParks.com 2004: the words; 2009: the dark green board, red discs).
8. **Section plates** over the aisles into 143-146 and on the porch's 242-244, and the SCOREBOARD PORCH, SECTIONS
   241-245 sign (the 2007-08 seating chart; the Porch Package page).
9. **Harry's people** (`leftfield/People.js`: about 175 in Harry's, 30 more in the corner's plaza): bartenders working the taps along the bars,
   servers on their rounds with trays, the host; regulars on the stools watching the TVs, diners at the tables,
   stools over the 140s, the patio's rail and tables, the walkway's standing fans. Each has a drink, the wings, a
   phone, a word with the next one, hands out to the heaters; they answer the game from the crowd's own mood (up for
   a big pitch, arms up for a Phillies run, hands on the head for a Rays one, the rally towels on the 29th), and at the
   last out everyone's up, jumping, cameras over the heads, hugging. Ponchos on the 27th out in the rain; dry inside
   and under the porch. When the Phanatic is out in front of them (A's: across the left field grass on the 29th) every
   head's on him, cameras and phones up, arms waving.
10. **Named people** (`leftfield/Named.js`; see below).
11. **Harry's sounds** (`leftfield/Sounds.js`, `tools/audio/leftfield-calls.py`): the two rooms' hubbub, looping (made
    from many voiced lines overlapped far off in a hard room, glasses set down), the patio heaters' roar (made in
    code), and a dozen voices near you (Piper TTS, CC0 and public-domain voices).
12. **The seats over Monty's Angle** (`leftfield/Monty.js`): the 140s go on round the jog in the wall (387 to 381) and
    along the taller wall to 409, rows thinning as it climbs from 12'8" to 19', as the park's own tiers so the crowd
    sits in them (about 200 more fans); the wall's cap and a galvanized picket rail stepping up with it. **Evidence:**
    the World Series photos (fans above State Farm up to the 409 mark), April 2008 (the mesh rail on the slope), the
    2007-08 chart (146-148 over the angle).
13. **The Left Field ramp** (`leftfield/Ramp.js`): the open steel switchback behind the corner from the street to the
    terrace, eight runs at 1 in 12, maroon columns and girders, X-bracing, silver rails, lamps under the runs, light
    poles on top; the Gulf disc lit on the top landing facing home and the BUBBA burger boxes on its field face. From
    home it now fills the gap left of the scoreboard. **Evidence:** the Phillies' ballpark guide (the ramp's levels);
    April 2008 and Game 5's postgame photo from the plaza (the ramp beside the scoreboard's back); the audit's LF06.
    Its exact footprint is my estimate.
14. **The plaza inside the Left Field Gate** (`leftfield/Plaza.js`): on the wall behind the scoreboard facing the gate,
    Game 5's batting order as nine big baseball cards in light boxes (Rollins 11 to Hamels 35), and the immense
    picture of the Phanatic beside them (BaseballParks.com 2004: the nine cards and the Phanatic at the left field
    entrance; Phillies.com 2008's "Starting Lineup"; the Game 5 arrival photo); lantern lamp posts; people crossing
    from the gate to the Alley and down to the concourse.
15. **The corner's portables** where the Phillies' October 2008 concessions guide puts them: draft beer in the
    scoreboard area, funnel cake and nachos behind 141, a Hatfield Grill cart behind 145, each with its lit sign, a
    vendor and a line (the lines' fronts with money out).
16. **The light tower's sponsor panels at night** (a marked block in Landmarks): their faces dark, only the letters
    glowing red or blue, as the World Series night photos show W.B. MASON and Budweiser (Oct 29, 2008; audit LF02).

### The people with names (CAST.md, wave 3)

- **Vinnie DiNardo,** 54, Girard Estates: head bartender downstairs since the park opened in 2004.
- **Kitty Moran,** 44, Mayfair: upstairs behind the bar; knows the regulars by name and by drink.
- **Lou Sabatini,** 71, Wissinoming, retired from the Frankford Arsenal: the end stool upstairs under the Kalas
  plaque, a KALAS tee and a tweed cap, his transistor radio at his ear all night for Harry on 1210 (the TVs have
  FOX); a fist for a Phillies run; "Shh, shh. Harry's got it. Listen."
- **The Delco boys** at the patio rail straight over left: **Brendan Quinn,** 27, Havertown (UTLEY); **Matt "Tank"
  Tancredi,** 28, Drexel Hill (WERTH); **Shane McGrath,** 26, Upper Darby (his Flyers jacket). On Carl Crawford
  through the bottom halves (cupped hands, a point, "Craw-ford!") and "E-VA!" at Longoria (S's research: the
  Inquirer's blog had the park calling him that).
- **Nina Castellano,** 29, Northern Liberties, and **Derek Hsu,** 30, a Penn resident: a first date at a window
  high-top upstairs; they watch each other more than the game; she's in his fleece by the 29th; a kiss at the last out.
- **The Pagliaros** of Folcroft at a four-top downstairs, their first World Series: **Vince,** 45, a Local 98
  electrician; **Carla,** 43; **Anthony,** 12, his glove on all night; **Lucia,** 8.
- **Marcy Delgado,** 34, from Brandon, Florida, in Carl Crawford's road grey, and **Jake Moretti,** 35, Collingswood
  (HOWARD): at the counter over the 140s where she can watch Crawford in left; arms up for a Rays run, folded for the
  Phillies'; one "Let's go Rays!".
- **Gloria Santangelo,** 63, Prospect Park, the host; servers **Angela Ricci,** 31, South Philly, and **Marcus Bell,**
  23, a Temple junior.

### Cost

- **CPU:** the place's update is 0.01-0.2 ms a frame (on its tempo; ~210 people, each on `cadence()`), with its
  share of the pool's flush.
- **GPU** (the last exclusive profile, 1280 x 800, the place shown and hidden in turns, medians of three pairs):
  TV high 0.53 ms, the overview 0.65, from the porch toward Harry's patio 0.83, from home at night ~1.2, the left
  field corner from the outfield 1.35 (Harry's, the Monty seats' 200 fans, the ramp), and inside the lower level's
  dining room, the densest close view, 2.28. **After that profile** I trimmed it (the downstairs tables 58% taken, was
  72%, the counter's stools 60%; fewer sides on the stools and pendants; the ramp's steel out of the shadow pass), not
  re-measured (my three exclusive jobs were used). The lower level's close view is likely still over the ~1 ms.
- **Draws:** pipelines 627 to 635 (the corner's new materials); the full park from Harry's patio 792 draws, 7.16 M
  triangles (800 x 500, the final look); the corner's own geometry ~122,000 triangles (the things in one draw 34,000,
  the Monty crowd's chunks). Before, from the outfield corner (the base, 1280 x 800): 399 draws, 4.67 M triangles.

### Screenshots

In `/Users/phillipforrence/citizens-bank-park/.claude/qa/h/shots/` (local, 800 x 500): `before/` (the corner as it
was), `s1`-`s5` (building it), `final/` (the full park, no console errors: `day-patio`, `night-from-field`,
`rain-lower`, `tv-high`, `tv-center`, `celebrate-patio` (the last out: towels, WORLD CHAMPIONS), `plaza-night` (the
lineup lit), `lf-from-home-night`). The profiles' jobs and results: `.claude/qa/h/prof/` (`before`, `after` (a run
spoiled by the machine's load), `final`). The Node benches: `.claude/qa/h/tools/` (`ab.mjs`: two trees side by side
in turns, run from a worktree's `.claude/h/` with the base's `src` exported to `base/src`; `bench.mjs`; `stub.mjs`,
P0's stand-in for the GPU).

### Unfinished

- The lower level's close view over the GPU budget (above).
- The ramp's connections into the suite, club and terrace levels aren't built (its landings stop at the rails).
- The plaza is dark at night (L's key light now stops at the field; my lamp posts are emissive only).
- Walkers cross the plaza on fixed loops (they don't avoid each other or the ramp's columns).
- The upstairs room reads bright by day through the glass (no interior occlusion).
- The Phanatic's taunting in left on the 29th depends on A's timing inside R's longer suspension (check at the merge).

### Noticed elsewhere

- **The light tower's panels** still use a Georgia italic for Budweiser and plain faces by day (LF02's full fix).
- **The scoreboard's back** (Exterior, the cap and ball) sits over Harry's house's back wall; in the 2008 photos the
  Phanatic picture hung on its own lit panel under it, where I've put it on the house.
- **The walking views see every place's people through the walls** (the tune-up's limit, above).

### Pictures I'd like from the owner

Harry's upstairs bar room in 2008 (the bar, its TVs, what hung on the walls); how the public walked past Harry's
lower level behind the 140s (was the dining room fenced off from the concourse?); the Left Field ramp from the plaza
in 2008, and where it met the concourses; the plaza behind the scoreboard on a 2008 game night (the lineup cards up
close, the portables); the patio on a cold night (were there heaters?); Monty's Angle's seats close up.
