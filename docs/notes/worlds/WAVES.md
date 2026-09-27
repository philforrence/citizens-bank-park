# Little worlds: the waves

The loop the owner asked for on 2026-09-27: "loop on the agents, once they've all returned, cross-pollinate and keep going on new parts of the park, new worlds, personalities and interactions."

It runs in waves of 4 builders, one place each, on the shared brief ([BRIEF.md](BRIEF.md)).

**When a wave returns:**
1. Merge each branch, and load it clean through the desk.
2. Profile the merged park under exclusive; each place has a ~1 ms budget.
3. Write `WAVE<n>.md`:
   - what each place built;
   - the systems others should reuse (people roles, props, timeline hooks);
   - the places' named characters;
   - the problems they flagged elsewhere.
4. Launch the next 4 places, their prompts pointing at `WAVE<n>.md` so they build on what's there.

## Wave 1 (launched 2026-09-27)

| Key | Place | Module |
|---|---|---|
| W1 | The Third Base Gate and its plaza | `places/ThirdBaseGate.js` (`gate3b`) |
| W2 | The main concourse, home to third | `places/Concourse3B.js` (`concourse3b`) |
| W3 | Ashburn Alley and the bullpens | `places/AshburnAlley2008.js` (`alley`) |
| W4 | Field level round home and the dugouts (the rail) | `places/FieldRail.js` (`rail`) |

## Candidates for the next waves

- **Harry the K's and the left field corner:**
  - the two-level bar and grill under Phanavision;
  - Monty's Angle seats;
  - the missing left field ramp;
  - the Phanavision tower's base.
- **The broadcast booths and the press box:**
  - Harry Kalas, Scott Franzke and Larry Andersen on the radio, and Buck and McCarver for FOX;
  - the writers' row, the scoreboard operators.
- **Your seat among people:**
  - a section behind home plate (or in the 300 level) seen from a seat;
  - featured neighbours with names, habits and reactions to the game, around the visitor.
- **The Pavilion and the right field corner:**
  - the Pavilion's bleachers and deck, the Arcade;
  - the right field foul pole, and the flags.
- **The First Base Gate and the Rotunda side:**
  - the other entrance, and the lots;
  - the tailgaters on Pattison.
- **The Hall of Fame Club:**
  - the 200-level club behind third;
  - its bar, memorabilia cases and TVs.
- **The upper deck concourse (300/400):** the wind, the view of the city, the stands up there.
- **The grounds crew's world** (it borders the rituals round):
  - the tarp crew and their equipment room;
  - the infield drag between innings.
- **The Phillies' clubhouse tunnel and the dugout steps:** only if the camera ever goes there.

Also due, by the spiderbench research ([../research/spiderbench.md](../research/spiderbench.md)), and approved by the owner:
- **A photoreal-surfaces builder:**
  - CC0 photo scans in its texture recipe (a layer array, parallax, weathering, grime);
  - starting with the "one wall, three ways" experiment on the Third Base Gate's brick.
- **Scripted Blender for fan bodies with real clothing:**
  - it waits until the crowd's shaders settle;
  - it needs a static-glTF path in the engine.
