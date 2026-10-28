# The gauntlet's log

Every merge, what it fixed, and where its evidence is. The critics' findings are in `.claude/gauntlet/r<N>/` (local); each fixer's own notes are beside this file.

## Round 1 (2026-10-28)

**The critics** (07:40–08:50):
- **CP, the people:** 21 findings. The caps are skullcaps with a flat blade through them, the seated fans are octagonal drums with a bare-skin neck, and the Phanatic is a lean man in a green suit.
- **CB, the bowl:** 16 findings. In October 2008 the "banners" were the bunting fans on the fascias and field rails, plus the champions banner over the batter's eye after the last out; the park had them undersized and flat, and was missing the banner.
- **CY, the play:** 23 findings. Utley's play at the plate never happened (a data bug), a fresh page lit the night game at 4 pm, and FOX's center field camera was twice too wide.
- **CI, inside and under:** 23 findings. The concourse had a pale office ceiling, the gate atria had lost their mezzanine, and behind home was a 25 m hole.

**Coordinator fixes:**
- The 2008 numbers: Madson 63, Hinske 32 (214f49c).

**Merges:**
- **FI1, the concourse as built** (31dd982; notes [FI1.md](FI1.md)): CI-1, 3, 4, 7, 8, 9, 11, 19, 21, 22 and 23 done; CI-13, 18 and 20 partly; CI-10, 12, 15 and 17 left for later. Before: `.claude/gauntlet/r1/CI/shots1/`. After: `.claude/gauntlet/r1/FI1-shots/shots4/`.
- **FB1, the bowl, the roofs and the boards** (notes [FB1.md](FB1.md)): CB-1 (the bunting), 2 (the rain), 3 (the light banks), 4 (the logos), 5 (the dugout roofs), 7 (the ribbon boards), 8 (the out-of-town board), 9 (the tarp), 10 (the champions banner), 11, 12, 13 and 16 done, and the left field disc sign moved; CB-6, 14 and 15 partly. Before and after: `.claude/gauntlet/r1/FB1-shots/shots/`.
- **FY1, the game and the cameras** (notes [FY1.md](FY1.md)): CY-1 (Utley's play at the plate), 2 (the light follows the replay's clock), 3 (FOX's center field camera), 5 (the follow camera), 7, 8, 9, 10, 11, 12 (a FOX broadcast mode), 14, 20, 22 and 23 done; CY-13, 15 and 17 partly. **The replay's clock is kept** (every in-play segment keeps step 8's length) so the radio call stays in sync. Shots: `.claude/gauntlet/r1/FY1/`.
- **FP1, the people** (notes [FP1.md](FP1.md)): **every figure was lit inside out** (wound against its own normals): fixed in every figure system. CP-1 (real caps everywhere), 2 (jackets with shoulders), 5 (the P), 6, 7, 9, 11, 13, 14, 15, 17, 18 and 21 done; CP-8, 10, 12 and 19 partly; CI-2 (the concourse filled by a GPU throng on the replay's clock). Before: `.claude/gauntlet/r1/CP-shots/`; after: `.claude/gauntlet/r1/FP1/final/`.
- **FY2, the Phanatic and the players' look** (notes [FY2.md](FY2.md)): CP-3, 4, 16 and 20 (the Phanatic as the 2008 costume, his fur, the rain dance), CY-4 (whites white at night), 6 (the 2008 cut), 16 (the pile) and 21 done; CY-18 partly. Before and after: `.claude/gauntlet/r1/FY2/before/` and `after4/`.
- **FI2, the insides** (notes [FI2.md](FI2.md)): CI-5 (24 suites with parties and the corridor behind), CI-6 (the Hall of Fame Club: the four bars, the paintings, the Wall of Balls, the model), CI-14 (under the stands: the Diamond Club lounge, the batting cages, the service corridor, the dugout tunnels), CI-17 (the home plate entrance's atrium and lit script) done; CI-16 checked. Shots: `.claude/gauntlet/r1/FI2-shots/` (shots1 before, shots5-6 after).

## Round 2

- **C2W, the walk** (launched 09:23): fresh eyes on everything seen on foot, after round 1's merges.
- **C2B, the broadcast** (launched 09:40): fresh eyes on the replay through FOX's cameras, after round 1's merges.
- **SP1's first speed win, merged early** (611070b): hardware occlusion queries for the big objects in the opaque pass (crowd pieces, seat chunks, players, cars: skipped while their box shows no pixel, re-tested every frame, drawn on any doubt; `?noOcclusion` turns it off), box frustum tests for instanced pieces and the players' shadows, the stands' chunks by section, the underwater lighting term only under water. SP1 measured 3-8 ms back in every view but left field, with occlusion on and off matching.
- **C2I, inside and outside** (launched 10:05): the new insides, and outside all the way round.
- **C2W, the walk** (returned 10:10): 23 findings. The throng blinks out within 5.5 m of you, the Cast up close are still mannequins, every seated fan's back pokes through his seat back, the gate light towers went dark (a round-1 regression), and the rain outside reads as snow. Bundled into FW1 (the people) and FW2 (the building).
- **Coordinator:** the gate light towers lit again (C2W-4).
- **FW1, the people on the walk** (launched 10:12).
- **C2B, the broadcast** (returned 10:15): 24 findings. A policeman stands in front of both low cameras, the players are pear-shaped in close-up, the follow camera chases the ball into the night sky, the 9th's police line and the second base umpire stand in the center field frame, and the celebration gets one static wide shot. Bundled into FB2.
- **FB2, the broadcast** (launched 10:16).
- **C2I, inside and outside** (returned 10:23): 19 findings. The street trees are still icosahedra, three-quarters of the lots are empty, the Majestic Clubhouse Store is a white box, the World Series tents are missing, and in the new insides a cap floats under the club's ceiling, the buffets are toy blocks and the glass has no tint. Bundled into FW2 (outside) and FI3 (the insides' polish).
- **FW2, the walk's building and outside** (launched 10:24).
- **SP1's second speed win** (a62a3a7): the insides' material (one uniform palette, the netting's discard in the cages' own material), the players' draw packed to its visible slots, the local lights' BRDF only facing the light. Under the stands 33.0 -> 18.8 ms; the images unchanged.
- **FW1, the people on the walk** (notes [FW1.md](FW1.md)): C2W-1 (the throng handed over to close-up figures within 7 m: no bubble), 3 (backs against the seat backs), 2 (the Cast's hands, shoes, limbs), 6 (the seated crowd up close), 11 (the 27th's ponchos and variety), 12 (the Alley and the corners), 16, 19, CP-8 (the ripple) and CP-10 done; C2W-10, 20 and CP-12 (names and numbers on backs) partly. Shots: `.claude/gauntlet/r2/FW1-shots/`.
- **FP2, the people's polish** (launched 11:10): the floating caps, the crowd behind home (towels, beanies, flashes), signs and lanyards, RailFigures.
- **FB2, the broadcast** (notes [FB2.md](FB2.md)): 23 of C2B's 24 done: the police out of the low cameras and the last pitch's frame, the players hung from square shoulders, the follow camera framing the play, the second base umpire placed as in 2008, FOX's cool night and the fine mowing, the 27th's wet field, the celebration cut every 7-9 s, plays at the plate tight, 13 replays (the clock untouched), the umpires' powder blue, the Phanatic on air, Bradford's submarine, a 2008 bug. Shots: `.claude/gauntlet/r2/FB2/` (j0 before; final, final2, final3 after).
- **FR1, the celebration** (launched 11:13): the presentation facing the crowd, the pile's first seconds, the jackets, the rituals' small true things.
- **FW2, the walk's building and outside** (notes [FW2.md](FW2.md)): C2W-5 (the rain lit only where lamps reach it), 13 (the park lit from outside at night), 8, 9, 14, 18, 21 and C2I-1 (the trees grown), C2I-2 (the lots filled with cars, coaches on Darien) done; C2I-4 (the tents), C2I-6 (the Linc's face), C2W-15 (the plaza's sounds) and 23 partly. Shots: `.claude/gauntlet/r2/FW2-shots/` (shots1 before, shots6 after).
- **FW3, the upper deck and the walk's backlog** (launched 11:35): the Terrace concourse, the band over the SRO rail, the aisle steps, the escalators, the Left Field Gate plaza.
- **SP1, the speed track, finished** (notes [SP1.md](SP1.md)): on top of the occlusion culling and the insides' material, the local lights' spill test and the seats indexed. Every view under the floor, left field the tightest (31.1 ms on its own run). Its measured "next wins" went to SP2.
- **SP2, the second speed track** (launched 11:45): the local lights' tile list, a players LOD, TAAU, the small discards.
- **FP2, the people's polish** (notes [FP2.md](FP2.md)): the floating caps (backwards caps drawn 1.6 m over the head) fixed everywhere; C2B-16 (the crowd behind home: whirled towels, varied knits, 4,096 camera flashes peaking at the last out), CP-12 (signs with the night's words, lanyards), CP-19 (RailFigures rebuilt in place), long hair as a shell, the stands settling after the first minute. Shots: `.claude/gauntlet/r2/FP2-shots/`.
- **FI3, the insides' polish** (launched 12:03): the Majestic Clubhouse Store, the glass's tint, the home plate entrance at night, the suites', the lounge's, the gallery's and the cages' details.
