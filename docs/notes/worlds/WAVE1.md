# Little worlds, wave 1: combined (2026-09-27)

All four places are merged into `ballpark`. The combined park loads clean and plays through the last out with no console errors. Each builder's full notes are in `W1.md` … `W4.md`; this page is the cross-pollination for the next wave and the owner's review.

## What each place built

- **W1: the Third Base Gate and its plaza** (`gate3b`)
  - The arriving crowd follows the replay's clock through the gate, now open, with bag tables, turnstiles and towel staff.
  - The Majestic store and McFadden's are on their correct sides; round 1 had them swapped.
  - The Schmidt statue, street vendors and scalpers, the State Police horses, FOX 29 live.
  - About 800 parked cars, traffic obeying the signals, and tailgaters.
  - Trees grown branch by branch, and the rain on the plaza.
  - The last out, when 150 celebrants take over Pattison.
- **W2: the main concourse, home to third** (`concourse3b`)
  - About 350 people with somewhere to go.
  - Stand lines where the food is handed over.
  - The drink rail and the restroom lines.
  - Carts, bins and condiments.
  - Live TVs showing the FOX broadcast drawn from the replay.
  - The 2008 section signs, park-wide.
  - Banners and the Buena Vista bedsheet.
  - A wet, littered floor, and steam and breath.
  - **Rain kept out from under the decks** (Rain.js's cover map).
- **W3: Ashburn Alley and the bullpens** (`alley`)
  - The pens stacked as in 2008; every pitching change is warmed up in them, and the Phillies' pen empties at the last out.
  - The brick promenade and the rail over the pens.
  - Bull's BBQ with Luzinski signing.
  - The clock on the replay's time.
  - The Wall of Fame, the All-Star Walk, the Ashburn statue and the flags.
  - Fans in the rooftop bleachers.
- **W4: the rail** (`rail`)
  - Camera wells full: FOX, a parabolic dish, photographers.
  - Bat boys and ball girls.
  - On-deck mats, and backstop cushions.
  - The plate and chalk wearing through the game.
  - The tarp tube on the 3B side, with the grounds crew in the rain.
  - Standing water.
  - Security, and the police line in the 9th.

## Cost (the lock's exclusive mode, 1280×800, GPU ms per frame; with the places vs `only=` without them)

| View | Without | With | Places |
|---|---|---|---|
| TV center | 17.7 | 19.1 | +1.5 |
| TV high | 22.8 | 24.6 | +1.8 |
| Overview | 18.6 | 20.2 | +1.5 |
| Night, TV center | 20.4 | 21.5 | +1.1 |
| The plaza (start view, first pitch) | 15.7 | 18.2 | +2.6 |
| The concourse behind home | 18.0 | 20.7 | +2.7 |

- **CPU** is +1.1 to +2.3 ms a frame, now about 4–5 ms in all, mostly the people's simulation.
- **Loading:** 8.2 s warm, but **~30 s cold**. The park went from ~400 shader pipelines to **598**, and each has to compile once in a fresh browser.
- **The plaza and the concourse run about 2.5× their ~1 ms budget**, both from their big crowds of close-up walking people.

## Reuse this: the systems the places built

- **Three new figure systems for people seen close up:**
  - W1's `places/gate3b/Folk*`: 2,100 triangles, an 11-bone rig in the vertex shader, a 24-bit look, 24 props, a 943-triangle far LOD;
  - W3's `places/alley/Folk.js`: its own rig and far LOD;
  - W2's `places/Cast.js`: painted faces with blinking eyes, 2008 fan clothing with correct name and number backs, about 20 props, 3 LODs (2,035 / 944 / 376 triangles).

  On top of those are `People.js` (the park's staff and walkers) and `Crowd.js` (the seated fans). **Before the next wave, merge the three into one**, probably Cast.js, the most complete. That would cut pipelines (and the cold load), GPU and CPU, and give every later place the same people. Next waves should use the merged system and not build their own.
- **Timeline hooks:** all four read `__app.director` (the segments, the innings, the rain on the 27th, the suspension, the 29th, the last out) to drive their people. W3 warms up every pitching change in the replay.
- **Rain cover:** `Rain.setCover()` keeps rain out from under anything overhead. It's built by W2's place today, and should move into the app so it holds whatever's in scope.
- **FOX broadcast drawing:** W2's TVs draw the broadcast from the replay (the score bug, lower thirds, NOW PITCHING). The broadcast world can build on it.
- **`FieldFigures.POSES`:** W3 adds a `penPhone` pose at import.
- **`details.tarpRoll`:** W4 builds into it, and the tarp sheet now pulls from the 3B side, ready for the rituals round.
- **The references:** 57 (rail), 73 (Alley), 129 (gate) and 67 (concourse) images and texts, in `.claude/ref/<place>/`, local and permanent.

## Tidy-ups for the next pass

- **Invented names collide between places.** They were built in parallel, so name them from one register (`docs/notes/worlds/CAST.md`) from now on.
  - Two **Kowalski** families: W2's Mike, Denise, Tyler and Katie at the concourse rail; W3's Rich, Linda and Danny in the Alley.
  - Two Rays fans **from Clearwater**: W2's Kevin, W3's Carlos.
  - Two **Kevins**: W2's Rays fan and W4's bat boy.
  - Two **Tylers**: W2's Kowalski boy and W4's kid on the rail.
- **Crossed edits:** W1 hides some of People.js's gate staff at runtime, and W2 hides People.js's figures in its stretch. With one figure system, these become plain data.
- **Leftovers:** `Exterior._saloonSign` is unused, and a removed tree's collider remains at (−72, 74).

## Problems the builders flagged elsewhere

- **Dugout sides:** the photo captions put the Phillies in the 3B dugout, while the audit and the code say 1B. **The owner may want to confirm.**
- **Madson wore 63 in 2008,** not 46: add it to `build-game.mjs`'s number table.
- **People.js field-level security** should wear royal-blue event staff kit, not black with hi-vis.
- **Concession prices** look high for 2008: beer $5.00, soda $3.25 and hot dog $3.50 per the Team Marketing Report.
- **The suite level's underside** is still a black slab at night (H07).
- **The Arcade's columns** stand on the rail line past 134.
- **Memory Lane** is really a sloped lane between two batter's-eye walls: a rebuild.
- **The OSM lamp positions** on the plaza differ from Exterior's invented ones.
- **The CF/RF pad colour** needs checking against the 2008 photos.
- **Photographers:** the 2009 photos show a second, standing tier.
- **The celebration's** photographer scrum and motor officers belong to the rituals round.

## Pictures the builders asked the owner for

- **The rail:**
  - Game 5's photographers' wells;
  - the bat boys;
  - a ball girl on the line in the rain;
  - the tarp roll's ends and cart.
- **The Alley:**
  - an All-Star Walk marker;
  - inside a pen's shelter;
  - Bull's BBQ in the postseason;
  - the Memory Lane platform;
  - an eye-level Alley shot on the 27th or 29th.
- **The gate:**
  - the plaza at street level on the night;
  - McFadden's frontage;
  - the store pavilion from the gate side;
  - the corner at 11th and Pattison;
  - the lots on a game night;
  - the State Police horses.
- **The concourse:**
  - condiment stations and recycling bins;
  - the concourse TVs;
  - Aramark uniforms;
  - the October carts;
  - the ceiling behind home;
  - McFadden's inside entrance;
  - the Game 5 rally towel;
  - the concourse's real width.
