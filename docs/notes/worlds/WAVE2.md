# Little worlds, wave 2: combined (2026-09-27)

All four are merged into `ballpark`. The combined park, with seven places, loads clean (about 10 s warm), plays through the last out with no console errors, and passes `npm test`.

Each builder's full notes are in `P0.md`, `A.md`, `B.md` and `C.md`. The one register of invented people is [CAST.md](CAST.md).

## What each built

- **P0: one people system.**
  - Everyone is on `places/Cast.js`: one pool, culled, level of detail by height on screen, sorted, and uploaded only when in view. The gate's and the Alley's figure systems are replaced by thin adapters and deleted.
  - The concourse's people went from 3.4 ms of GPU to 0.6, and people's draws from about 45 to 4.
  - New props, tops, hats and helpers: `seat()`, `sign()`, `lookAt()`.
  - The rain cover moved into the app (`RainCover.js`).
  - The name collisions are renamed: the Szymanskis, Josh, Travis, Ryan, and Carlos now from St. Petersburg.
- **A: the Phillie Phanatic, all night and all over the park, on the replay's clock:**
  - the pregame lap, and the taunting in left on the 29th;
  - the roof dances, and the hex on the Rays' pen;
  - the rain dance with eight ball girls;
  - the hot dog launcher on the Gator;
  - the stretch, visits into the stands and the Alley (the belly bump with Luzinski), the little Phanatic;
  - the last out, and the 2008 banner.

  Also: the red FourTrax with its tracks, his motions and 2008 look, Phanavision's captions, and the rail's cameras turning to him. The seated fans round him get up (`Crowd.focus`).
- **B: behind home plate, the TV backdrop:**
  - the Diamond Club as the 2008 chart has it, seated low;
  - the backstop as FOX showed it, with its virtual ads (seen by the center-field camera only);
  - about 250 fans in the vacated seats (`Crowd.vacate`), with named regulars and the signs from the nights' photos;
  - vendors passing beers down the row, beer runs, foul balls;
  - the suites' and booths' people, and the booths in their real order (Kalas in the red jacket);
  - sounds in place.
- **C: the 1B main concourse and the First Base Gate:**
  - about 300 fans with lines, the drink rail and standing room;
  - the gate open, with arrivals from the subway, Lot K and the taxis;
  - the Oct 2008 portables, and the stands' real fronts;
  - the plaza, Robin Roberts' statue, the Phun Zone;
  - named people and timed scenes, Lot K's tailgates, the Phanatic's photo line;
  - voiced calls and sounds.

**The coordinator added:** sounds in a place (`GameSound.sample/spot`), `Crowd.vacate()`, `Crowd.focus()`, and G for double speed.

## Cost (the lock's exclusive mode, 1280×800; all seven places vs `only=` without them)

| View | GPU without → with (ms) | CPU without → with (ms) |
|---|---|---|
| TV center | 17.7 → 20.1 (+2.4) | 2.5 → 4.7 |
| TV high | 22.5 → 24.4 (+1.9) | 3.5 → 6.1 |
| Overview | 18.8 → 21.3 (+2.6) | 3.6 → 5.9 |
| Night, TV center | 20.4 → 22.7 (+2.4) | 3.3 → 5.6 |
| The plaza | 16.0 → 19.2 (+3.2) | 3.2 → 6.3 |
| Concourse, 3B | 17.8 → 20.6 (+2.8) | 3.2 → 6.7 |
| Concourse, 1B | 17.9 → 20.3 (+2.5) | 2.5 → 5.3 |
| Behind home | 17.5 → 21.0 (+3.6) | 2.2 → 5.9 |

- **GPU:** about 2–3.5 ms for all seven places in any view, within the ~1 ms per place they're allowed, but it adds up.
- **CPU:** now 4.7–6.7 ms a frame, mostly the people's simulation. It's the next thing to trim (updating far and off-screen people less often, as P0 started) before more places.

## Flagged for later

- **The dugouts:** the Phillies used the first base dugout, as the code has it (confirmed by A's research).
- **Section numbering:** `Concourse.sectionAt` numbers the sections round the dugouts about 4–5 off.
- **The field-level sections** were split for the Diamond Club, so People.js's guard pattern shifts.
- **The crowd's signs** lie flat as blank white boards.
- **The press box** shows moiré through the backstop net.
- **The desk** keeps a shot's `hour` for the shots after it in the same job.
- **Concession prices** still look high for 2008.
- **Not built:** the 1B gate's escalators, the taxi stand, the TV trucks.
- **Pictures the builders asked the owner for** are listed at the end of each one's notes.
