# Step 10: real faces in the stands, and walk everywhere (2026-10-28)

**The owner, 2026-10-28 evening:** "can we give the people in the stands the facial structures of real people like the players on the field? And then can we just ensure we can walk everywhere in the stadium and that everywhere walkable (especially walking around outfield seating behind first inner bowl) is as it is in the stadium? Loop til you're out of usage or I say so."

It runs as the gauntlet did ([../gauntlet/BRIEF.md](../gauntlet/BRIEF.md)): critics find, fixers fix in their own worktrees, the coordinator verifies, merges and measures; at most 4 agents at once; `npm test`, `node test/continuity.mjs` and the standard frame-rate views (`tools/gpu/standard-views.json`) after every merge; the 30 fps floor holds. It loops until the owner stops it.

## 1. Faces: the fans get the players' facial structure

The players are the MakeHuman base mesh (`game/data/body.js`, built by `tools/build-body.mjs`), each with his own face shape (FY4: 16 face numbers in `Looks.js`, applied in `Players.js`'s vertex stage) and FY3's skin, brows, eyes and beards. The fans are hand-built heads: the Cast's near and middle figures (`places/Cast.js`) and the seated crowd's close and near levels (`Crowd.js`). The plan: a fan head built from the same MakeHuman head (and MakeHuman's own face targets, as blend shapes, for real variety), at the vertex budget each level can afford, with the faces varied per person by seed: men, women and kids, every age, the skin, brows, eyes, hair and beards the players have.

## 2. Walk everywhere, as it is

Every place a fan could walk in Citizens Bank Park in 2008 should be walkable here, and nothing more: the plazas and gates, every concourse level, the ramps, stairs, escalators and elevators, the aisles and cross-aisles of the seating bowl, the outfield seats (the left field seats, the Pavilion and the right field seats), Ashburn Alley and the bullpens' overlook, the Terrace and the 400s, the suites' and the club's levels. Two audits first: a technical flood fill of the walker over the whole park (unreachable floors, holes, invisible walls, stairs that don't climb, places you get stuck or fall) and a walk of the outfield seats and the inner bowl against the real stadium's layout. Then fixers on what they find.

## Round 1 (launched 19:24)

| Key | Work |
|---|---|
| FF1 | The fans' faces from the players' MakeHuman head |
| WA1 | Walkability audit: a flood fill of the whole park |
| WA2 | Walkability audit: the outfield seats and the inner bowl against the real stadium |

## Rounds 2 and 3 (19:56-20:54)

| Key | Work | Notes |
|---|---|---|
| FF2 | The fans' faces move: expressions, blinks, smooth close heads | [FF2.md](../gauntlet/FF2.md) |
| FF3 | The players' faces from the same MakeHuman targets; the players' expressions; the fans' open mouths | [FF3.md](../gauntlet/FF3.md) |
| FA1 | The Pavilion and its Deck reached from Ashburn Alley; the Alley's edges | [FA1.md](../gauntlet/FA1.md) |
| FA2 | The left side: the Porch, Harry's upstairs, the LF ramp and escalator, the Arcade, Monty's 146-148 | [FA2.md](../gauntlet/FA2.md) |
| FA3 | The inner bowl and its edges: the field closed, the 400s' stairs, the rails, the cracks, the Diamond Club | [FA3.md](../gauntlet/FA3.md) |
| FA4 | Elevators both ways; the 1B side's ways up planned | [FA4.md](../gauntlet/FA4.md) |

## Where it stands (2026-10-28, 21:05)

The owner stopped it for the night. Everything is merged on `ballpark`; not tagged or published. The walker now reaches 85% of the seated fans (it was 64%), and the falls it takes are down from 3,131 to 466. One regression: the club concourse and the club seats are cut off. The details, and what to do tomorrow in order, are at the end of [../gauntlet/STEP10-LOG.md](../gauntlet/STEP10-LOG.md).
