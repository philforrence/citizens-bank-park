# Section audit brief (shared by the five section agents)

Project: ~/citizens-bank-park, a browser (WebGPU) Citizens Bank Park as it was for Game 5 of the 2008 World Series
(Rays at Phillies, Oct 27 2008, suspended in the rain in the 6th, finished Oct 29). Goal: AAA-game quality and
2008-specific accuracy. You audit ONE section of the park: research what it really looked like in 2008, compare
with the game, and write the 10 upgrades that would improve it most, each with a concrete how-to.

DO NOT edit anything in ~/citizens-bank-park. Write only in the scratchpad's audit4/ folder.

## Seeing the game
- A built snapshot is served at http://127.0.0.1:5193/ (use it; port 5189 is the live dev server that reloads as code changes).
- Screenshot harness (scratchpad): `node shot.mjs "<url>" <outPrefix> '<steps JSON>'`, run from the scratchpad dir.
  Steps: {"file":"cam.js"} loads helpers; {"file":"audit3/seg.js"} loads timeline helpers; {"js":"..."} evaluates;
  {"wait":ms}; {"shot":"name"} saves <outPrefix>-name.png. Start every run with
  [{"file":"cam.js"},{"file":"audit3/seg.js"},{"js":"__start()","wait":1500},{"js":"__clean()"}, ...].
- Helpers: __look(fx,fy,fz, tx,ty,tz, fovDeg) puts a free camera at field coords looking at a target. Field frame:
  origin = back tip of home plate, -z toward center field, +x toward 1st base, y = metres above the playing field
  (the concourse/street level is about 7-10 m up; see the existing findings for working examples).
  __seek(t) sets the replay time; __pitchAt(after, off), __playAt(after, off), __cel(off), __susp(off) jump to
  moments; __app.cycleCamera('center'|'high'|'follow'|...) picks a TV camera.
- URL options: ?weather=off (dry), ?hour=13 (daylight) or ?hour=21 (night, as the game was), ?poses (player lineup).
- Loading takes 1-6 minutes (five agents share one GPU): batch MANY shots into each run (move the camera between
  shots in the same run), keep to about 4 runs, give Bash a timeout of 600000. Crop/zoom saved PNGs with python3 /
  sips if you need detail. Look at every shot you take.

## Research
- WebSearch / WebFetch for 2008-era (2004-2009) photos and descriptions: Wikimedia Commons, Flickr, ballpark
  guides (ballparksofbaseball.com, ballparkdigest, andrewclem.com), news photos of the 2008 World Series, the
  Phillies' ballpark guide. Prefer things you can confirm; say how sure you are.
- Local reference photos in the scratchpad: cbpimg/, gate/, hesb/, hes/, ref/, img/, grp/ (a 2008-era ballpark
  guide as page images), audit3/ref/, twe*.jpg, rs*.jpg, crop_*.jpg, spec*.jpg.

## The code (read what your section touches so the fixes are specific)
src/ballpark/: Field.js (grass, dirt, mound, bases, dugouts, bullpens, foul poles, distance numbers),
Details2008.js (WS decals, tarp, wall ads, out-of-town board, dugout fascia), layout.js (wall/field geometry),
Bowl.js (seating bowl, levels, roof, light towers, press box, portals), Stands.js (seats, rails, aisles),
Fascia.js (LED ribbon boards, bunting, Terrace ads), Concourse.js (concession stands, bins, monitors in the concourse),
Landmarks.js (scoreboard, Harry the K's, Liberty Bell, Ashburn Alley, rooftop bleachers, clock, batter's eye, flags),
Exterior.js (gates, facade, plaza, statues), BallparkApp.js (lighting, weather, cameras), SkyGlow.js, game/Rain.js.
Geometry helpers in geo.js; materials via standard() with WGSL surface snippets (see any file for the pattern).

## Already planned (don't list these)
- A sold-out crowd in the stands (the seats are empty now; a crowd is being added).
- The players themselves (bodies, uniforms, faces, motions) - just rebuilt.
- Everything in audit3/ranked.md (read it first). Only list an item from there if you have a much sharper,
  section-specific fix, and say which H-number it extends.

## Output
Write audit4/<KEY>.jsonl: exactly 10 lines, ranked by visual impact (how much of a typical view of your section it
fixes x how wrong it is now), each a JSON object:
{"id":"<KEY>01", "section":"...", "title":"...", "area_pct":<share of a typical frame of this section>,
 "seen_in":"<your shot file + the exact url and __look / steps to reproduce>",
 "reference":"<URLs or local photo paths, and what they show>",
 "problem":"<what's wrong now, specific>",
 "target":"<what it looked like in 2008: colours (hex), sizes (m), materials, exact sign text, counts>",
 "fix":"<how to build it: file / function, geometry, shader approach, numbers>", "effort":"S|M|L"}
Also write audit4/<KEY>.md (the same, readable, with the screenshots referenced) and finally an empty file
audit4/DONE-<KEY>. Keep your final reply short: the 10 titles in order.
