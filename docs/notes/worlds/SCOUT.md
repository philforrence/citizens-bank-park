# Scouting: where the park is still empty (2026-09-27)

The owner asked: find the parts of the stadium with few people and no specific detail, rank them by the overall effect filling them would have (more populated sections), add a Phillie Phanatic running around, and say how to divide the work between subagents.

**How I scouted,** on the combined wave-1 park at the replay's early innings (t = 700, the 27th):
- **A census** of every standing or walking person (People.js, and each place's figure lists), by zone: level × side of the park × inside or outside.
- **A tour of 20 views:** the main concourse sampled all the way round on the bowl's own walkway, the corners and upper decks from the field, the gates outside, the overview, and the field between innings.

## The census

About **1,160 people standing or walking**, plus **42,154 seated fans** (the crowd fills every seat already).

| Zone | People | Who |
|---|---|---|
| Main concourse, 3B side | 366 | W2's concourse and People.js |
| Main concourse, behind home | 212 | W2 and People.js |
| Main concourse, 1B side | 97 | People.js only: generic walkers |
| Main concourse, CF (the Alley) | 92 | W3 |
| Field level, 3B / 1B / behind home | 80 / 64 / 12 | W4's rail |
| Outside: LF / RF / CF / behind home / 3B | 44 / 26 / 16 / 16 / 13 | W1's arrivals and lots, People.js |
| **Main concourse, RF corner** | **18** | People.js |
| **Main concourse, LF corner** | **18** | People.js |
| **Suites and club levels** | **2** | T8's lit suites (their figures "read as pills") |
| **Upper deck, 300 and 400 levels** | **1** | nobody |

**What the tour showed:**
- **The 1B-side concourse:** wide and nearly empty; the same "South Philadelphia Market" stand over and over, no carts, TVs, lines or signs of the night.
- **Both concourse ends:** long empty stretches. The LF end opens onto a bare plaza.
- **The LF corner from the field:** no Harry the K's under Phanavision.
- **Between innings:** Phanavision shows the Phanatic, but **there's no Phanatic anywhere**. The rig and his look already exist (T7: `KIND.phanatic`, fur, the PHANATIC jersey, his dance motion); the replay never brings him out.

## Ranked by overall effect

"Effect" weighs:
- how much of the time the place is on screen (the TV center shot is on for every pitch; the walk passes the concourse);
- how big it is;
- how empty or generic it is now;
- how full it was on the night.

1. **The Phillie Phanatic.** He's on screen every half-inning break, and he's the most Philadelphia thing in the building.
   - **Between innings:** his ATV laps of the warning track, the hot dog launcher, dancing on the Rays' dugout roof, teasing their pitcher and bullpen.
   - **In the rain on the 27th:** dancing with the ball girls (W4 found Getty 83477166).
   - **The stretch,** visits into the stands and the Alley, and the last out.
   - He needs only the timeline and the existing rig.
2. **Behind home plate: the TV backdrop.** The center-field camera looks straight at it on every pitch: the Diamond Club's front rows, the lower seats behind the plate, the suites and the booths. Today it's seated fans only. It needs:
   - vendors working the aisles (beer men, hot dogs);
   - fans getting up to let people pass, signs, cameras;
   - the Diamond Club ledge with cups and lanyards;
   - lit suites with parties;
   - the booths: Harry Kalas, Scott Franzke and Larry Andersen on the radio, Buck and McCarver for FOX.
3. **The main concourse, 1B side, and the First Base Gate.** The other half of the walkable ring: the mirror of W2 and W1, with People.js's generic walkers only, and the gate plaza plain.
4. **The left field corner:**
   - Harry the K's, the two-level bar and grill under Phanavision;
   - the Scoreboard Porch concourse, and the bare LF-end plaza;
   - Monty's Angle's missing seats, and the LF ramp.

   It's in the TV high and wide shots, and it was one of the park's busiest spots.
5. **The right field corner:** the Pavilion's concourse, the Arcade, and the RF gate and its plaza. A long empty stretch today.
6. **The upper deck:** the 300 and 400 levels' concourses and stairs, vendors up top, the wind and the view of Center City. It has one person in it now. It's seen mostly on foot, which is why it ranks below the corners.
7. **The Hall of Fame Club and the suites' interiors:** the 200-level club behind third (its bar, memorabilia cases and TVs) and the suite parties. The TV hardly sees them; you'd get there by the elevators.
8. **Outside, the rest of the way round:** the 1B, RF and LF gate plazas, the lots and Pattison east.

## First: one people system

Wave 1 built **three** figure systems for close-up people:
- W1's `gate3b/Folk`;
- W3's `alley/Folk.js`;
- W2's `Cast.js`, the most complete: painted faces, 2008 clothing with correct name and number backs, about 20 props, 3 LODs.

That's why the plaza and the concourse run about 2.5× their GPU budget, and why the cold load went from ~400 to 598 shader pipelines. Every place in this list needs people. So one builder should move the gate and the Alley onto Cast.js and delete the duplicates, then trim the crowds' cost back into budget. That same builder should start a single register of invented names (`CAST.md`), fixing wave 1's collisions: two Kowalski families, two Rays fans from Clearwater, two Kevins, two Tylers.

## How I'd divide it

At most 4 builders at once, one place each, on the shared brief. New places use **Cast.js** for people, and the Phanatic uses the players' rig.

**Wave 2**
- **P0: one people system.**
  - Move W1's and W3's people onto Cast.js, keeping every character and behaviour.
  - Remove the duplicates.
  - Bring the plaza's and the concourse's people back to ~1 ms.
  - Start `CAST.md`, and rename the collisions.
  - Keep Cast.js's public API stable, since the others build on it at the same time.
- **A: the Phillie Phanatic,** park-wide. A place module (`places/Phanatic.js`) that drives one of the players' rig slots from the replay's timeline, plus his ATV, his hot dog launcher and his props. The ball girls and the rail (W4) and the Alley (W3) are his stops.
- **B: behind home plate, the TV backdrop:** the Diamond Club, the aisle vendors and the lower sections' life, the suites and the booths (Kalas and the radio crew, FOX's booth).
- **C: the 1B-side main concourse and the First Base Gate:** the other half of the ring and the other entrance, reusing what W2 and W1 learned (the section signs, the TVs and the carts are already park-wide).

**Wave 3**
- **D:** the left field corner and Harry the K's.
- **E:** the right field corner, the Pavilion and the RF gate.
- **F:** the upper deck.
- **G:** the Hall of Fame Club and the suites.

**Wave 4, or alongside**
- **The photoreal-surfaces builder** (CC0 scans; approved from the spiderbench research).
- **The rituals round:** the tarp pull, the rain delay and the celebration. Its props are ready (W4's tarp tube, the crew).
- **Outside the rest of the way round.**

Between waves, as before: merge, profile under exclusive, write up what to reuse, and **the owner reviews before the next wave launches**.

## Evidence

- The census, in the desk's result for the scouting job.
- The 20 views, in the session scratchpad: `walk-*` (the concourse sampled round the ring), `field-to-*`, `outside-*`, `between-innings`, `high-overview`.
- My outside-gate shots were set below the street (the plaza is 7 m above the field), so they show little; the census covers those zones.
