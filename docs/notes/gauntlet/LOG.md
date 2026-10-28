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

## Round 2

- **C2W, the walk** (launched 09:23): fresh eyes on everything seen on foot, after round 1's merges.
