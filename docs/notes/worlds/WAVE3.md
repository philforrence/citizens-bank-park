# Little worlds, wave 3: combined (2026-09-27, wound down early for compute)

All four are merged into `ballpark`. The combined park (ten places) loads clean in about 13 s: no console errors, `npm test` passes, and the new timeline plays from the 27th's rain delay into the 29th's return and on through the trophy. Each builder's full notes, including a "What I'd keep working on" section, are in `S.md`, `R.md`, `L.md` and `H.md`. The cast register is [CAST.md](CAST.md).

## What each built

- **S: the park's whole soundscape** (`places/Soundscape.js`, `sound`).
  - **Where you stand** (the bowl, under a roof, shut away, the plaza) changes what you hear, and every place's sounds sit in one reverb.
  - **The PA:** Dan Baker's 44 lines (Piper's CC0 voice given his cadence), through the roof's speakers, including the night's announcements.
  - **The music:** public-domain organ tunes and original walk-up stand-ins, never a copyrighted melody.
  - **The crowd follows the game:** chants spreading from one section, boos, the stretch sung, fans near you calling out.
  - **The rest:** the umpires, the weather on the roofs and ponchos, the last out's horns and fireworks.
  - **Cost:** 0.013 ms a frame. **Nobody has heard it yet**; it needs a listen and a trim.
- **R: the rituals** (`places/Rituals.js`, `rituals`, and the Director).
  - **The suspension is told in full** (H14 fixed): 160 s, the 27th's first 88 s, then the 29th.
    - The 27th: the tarp going on as photographed, the stands emptying into the rain.
    - The 29th: the tarp off, the crew, God Bless America, the return.
  - Warm-up throws, and the drying agent.
  - **The celebration (300 s):** the pile built properly, the champions tees, the press out of the wells, motor officers, fireworks, the trophy stage and presentation, the lap, and Kalas singing High Hopes.
  - **New:** `director.night( t )` and `director.radioTime( t )`.
- **L: light and night.**
  - **Rain wets each surface its own way** (`WET_FABRIC`): cloth soaks matte, skin takes a sheen, ponchos shine.
  - **The light banks light the rain in the air** (`Night.js`), and the key light stays in the park.
  - **H07 fixed:** the suite level's underside is lit.
  - **FOX's broadcast grade.**
  - **The 2008 skyline, lit as on the nights,** with the Holiday Inn, South Philly's lamps, and each night's own sky.
  - **Cost:** 0.5–1.0 ms saved in the same page, though the rainy 27th's opaque pass is about 1 ms higher and not yet explained.
- **H: the people-CPU tune-up, then Harry the K's.**
  - **Tempo:** a place's people run at full rate only while they're seen. That's about half the people CPU in the TV and walking views, less in views that see every place at once.
  - **Harry the K's (`leftfield`), both levels:** 205 people, 17 of them named.
  - The Angle's seats (called "Monty's Angle" only from 2024), the Left Field ramp, the plaza's lineup cards and portables, the tower's panels at night.

## What they'd keep working on (from their notes)

- **Sound:**
  - listen and trim the mix;
  - a real drum kit, and more of Baker's lines;
  - re-voice the radio for the longer delay; it's silent through it now.
- **Rituals:**
  - the tarp roll's exact route;
  - the celebration's small true things (champagne, leis, streamers, families on the field);
  - a `Crowd.thin( k )` so the stands empty and fill cheaply (each `vacate` refresh is about 15 ms);
  - a final review set and measurement.
- **Light:**
  - find the 27th's extra ~1 ms;
  - the ribbon boards' magenta light on the rows;
  - keep the floors under cover dry;
  - the far city's streets;
  - a lens starburst for the TV cameras.
- **CPU and the left field corner:**
  - an occlusion test, so people hidden behind walls sleep too;
  - Harry's lower level is probably still over its ~1 ms GPU budget up close;
  - the ramp's bridges to the upper levels.
- **Record fixes to make:**
  - Madson wore 63 and Hinske 32 in 2008 (the jerseys show 46 and 11);
  - the crew chief was Welke and the plate umpire Kellogg;
  - first pitch on the 27th was 8:30 pm.
