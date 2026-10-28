# Step 9: all the way round (outline, 2026-10-28)

Step 8 ("The night itself") is tagged and live. Step 9 fills the rest of the park the scouting ranked ([SCOUT.md](SCOUT.md), places 5–7), starts the photoreal surfaces the owner approved, and clears the record fixes wave 3 left ([WAVE3.md](WAVE3.md)). It runs as **little worlds wave 4**, on the same loop as before ([WAVES.md](WAVES.md)).

**The owner, 2026-10-28:** outline step 9, then run it in a loop while they're away.

## Wave 4: four builders, one place each

| Key | Work | Module |
|---|---|---|
| E | **The right field corner:** the Pavilion's concourse and deck, the right field foul pole and flags, the RF gate and its plaza, the corner's stands and life. This is the long empty stretch from SCOUT (18 people on the RF concourse). | `places/RightField.js` (`rightfield`) |
| F | **The upper deck:** the 300 and 400 levels' concourses, ramps and stairs, the vendors up top, the wind, and the view of Center City, the Linc and the lots. It has one person in it now. | `places/UpperDeck.js` (`upper`) |
| G | **The Hall of Fame Club and the suites:** the 200-level club behind third (its bar, memorabilia cases and TVs), the suite parties (T8's lit-suite figures "read as pills"), and the elevators' landings. | `places/Club.js` (`club`) |
| T | **Photoreal surfaces:** CC0 scans in the texture recipe (a layer array, parallax, weathering, grime), starting with the "one wall, three ways" experiment on the Third Base Gate's brick, then the winner rolled out to the facade brick, the concourse concrete and the painted steel. Approved from the spiderbench research. | the material recipe in `geo.js` / `materials`, applied in Exterior.js and the concourse floors |

Every builder works from [BRIEF.md](BRIEF.md) (with a new "Wave 4" section), reads WAVE1–3, uses Cast.js for people, shares live notes in `.claude/wave4/`, and adds its invented people to CAST.md.

**What the places should hand each other:**
- E and F share the ramps and the right field stair towers. F owns the stairs above the main concourse.
- G's club TVs and the upper deck's concourse TVs show FOX's feed (the concourse TVs already exist, W2).
- T's recipe should be one the places can use too: E's Pavilion brick and F's concrete should come from it, not their own.
- The Phanatic (`director.phanatic.at( t )`) and the soundscape (`app.sound.spot()`) reach the new places.

## The coordinator, alongside (CPU first, on `ballpark`)

1. **Record fixes** (WAVE3.md): Madson wore 63 and Hinske 32 in 2008 (the jerseys show 46 and 11); the crew chief was Welke and the plate umpire Kellogg; the first pitch on the 27th was 8:30 pm. Check each against the record before changing it.
2. **`Crowd.thin( k )`** (R's request): the stands empty and fill cheaply, without `vacate`'s ~15 ms refresh, for the 27th's rain and the 29th's return.
3. **Keep the builders unblocked:** answer the `ASK-*.md` requests, and watch the GPU queue.

## When the wave returns

1. Merge each branch, and load the combined park clean through the desk.
2. `npm test`, then profile under exclusive; each place has a ~1 ms budget.
3. Write [WAVE4.md](WAVE4.md): what each built, what to reuse, the named characters, problems flagged elsewhere.
4. The step-9 screenshot as `docs/stages/step-9.jpg`, and START-HERE.md updated.
5. **Stop for the owner's review.** Nothing is pushed or tagged for the site until they've looked (WAVES.md's standing rule).

## Left for the owner

- **Listen to the soundscape and trim it** (wave 3's S): it needs ears.
- **Pictures to supply:** whatever the builders ask for in their notes.
- **The next waves:** outside the rest of the way round (the 1B, RF and LF plazas, the lots, Pattison), the booths and the press box, "your seat among people", and scripted Blender fan bodies once the crowd's shaders settle.
