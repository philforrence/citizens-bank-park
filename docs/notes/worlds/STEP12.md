# Step 12: the gauntlet, round and round (2026-11-12)

**The owner, 2026-11-12:** "can you ... do a step 12 now? just like... work really hard to make everything better? In ways similar to how we've worked in the past, just iterate loop critique and improve"

Step 12 is the same loop as steps 9 and 11 ([STEP9.md](STEP9.md), [STEP11.md](STEP11.md), the brief [../gauntlet/BRIEF.md](../gauntlet/BRIEF.md)): critics find, fixers fix in their own worktrees, skeptics try to refute each fixer before its merge, the coordinator merges and measures. Every judgement is held against photos of the park in October 2008 (then the 2008 season, then 2004-2009; current photos only for what hasn't changed). It loops until the owner stops it or usage runs out, at most 4 agents at once, the 30 fps floor. It's published only when the owner asks.

## What's different from step 11

- **It starts from a queue.** Step 11 ended at the usage limit with two fixers unfinished (the seats, the players) and five bundles waiting (`.claude/gauntlet/s11/TICKETS.md`). Round 1 picks those up before any new finding.
- **Speed first.** The 400s seat is at 28.9 ms and left field at 28.0 ms, against a floor of 33.3 ms. A speed track runs from the start, so the fixers have room to add detail.
- **The roles** are step 11's: critics (CR), spot checks (SC), breakers (AD), skeptics (SK), fixers (here **FK**, since `FX` is taken) and speed tracks (SP, from SP4).
- **Fix pipelines run as workflows** (from 08:10): each bundle goes fixer → a skeptic who renders both trees and a code reviewer who reads the diff → one repair round if either sends it back → the coordinator's merge. The workflow holds its rendering agents to three at a time, since the GPU is shared.
- **A zone nobody looked at in step 11:** the field, the game and the boards as the TV cameras show them on every pitch.

## The files

- Findings: `.claude/gauntlet/s12/r<round>/<KEY>.md`
- Tickets: `.claude/gauntlet/s12/TICKETS.md`
- Fixers' notes: `docs/notes/gauntlet/<KEY>.md`
- The log, every merge with its evidence and the skeptic's verdict: [../gauntlet/STEP12-LOG.md](../gauntlet/STEP12-LOG.md)
- The frame rate after each merge: [../gauntlet/PERF.md](../gauntlet/PERF.md), "Step 12"

## Round 1

| Key | Work |
|---|---|
| SP4 | Speed track: the 400s seat and left field (the crowd's near-level hands, Harry's bottles and glass), and the +137k triangles step 11 added to the TV center view |
| FK1 | Fixer, the seats: finish step 11's FX2 from its saved edits (the pans behind standing fans, the seats' blue, the aisles' nosings, the Terrace's white stair rail), then the Deck's portals and end wedge, the dugout roof's rail and the one-sided hall wall |
| FK2 | Fixer, the players: foreheads through caps, one gaunt face, sticker beards, Lidge's shout and squint, Manuel's jacket, the pinstripes round seated thighs |
| CR2 | Critic, the field and the broadcast: the grass, the dirt, the walls, the boards and the play itself as FOX's cameras show them, against Game 5 stills |

Next in line as slots free: the outside and outfield bundle, the field's-edge people on the players' rig, the indoors bundle, the Cast and the throng, the Phanatic, and fresh spot checks and breakers on whatever merges.
