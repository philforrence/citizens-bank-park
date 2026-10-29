# Step 11: the gauntlet again, with adversaries (2026-10-29)

**The owner, 2026-10-29 morning, after stage 10 went up:** "alright do another step along the lines of the last continual improvements in realism, loops critics adversaries spot checks grounded in photos"

Step 11 is step 9's loop again ([STEP9.md](STEP9.md), the brief [../gauntlet/BRIEF.md](../gauntlet/BRIEF.md)): critics find, fixers fix in their own worktrees, the coordinator merges and measures. Every judgement is held against photos of the park in October 2008 (then the 2008 season, then 2004-2009; current photos only for what hasn't changed). It loops until the owner stops it or usage runs out, at most 4 agents at once, the 30 fps floor. It's published only when the owner asks.

## The roles

- **Critics (CR):** one zone each, as in step 9. Shots against photos, ranked findings: severity × screen time.
- **Spot checks (SC):** random and blind. Random standing spots drawn from the cells the walk audit reaches on foot (`.claude/step10/final2/audit/nodes.json`: every cell you can stand on, with its floor height), at random times in the replay and random directions, plus random TV moments. Each shot is held against the nearest 2008 photo of that spot. They catch what nobody chose to look at.
- **Adversaries (AD)**, of two kinds:
  - **Breakers:** try to break the illusion the way a curious player would. Close up, at the edges, behind things, inside things, the far side of a wall, the moment a level of detail swaps, people clipping or floating, repeated textures, a sign with the wrong year. They're scored on how glaring their finds are.
  - **Skeptics:** before a fixer's branch merges, a skeptic tries to refute it. Is the after really closer to the photo? What did it break nearby, in the views the fixer didn't shoot? Did it cost frames it didn't report? The skeptic's verdict (merge, merge with a follow-up, or send back) goes in the log with the evidence.
- **Fixers (FX):** a bundle of tickets each, bundled so no two share files. Before and after shots against the reference, as in step 9.
- **Speed tracks (SP):** when a view nears the floor. Speed is won back by LOD, batching, caching or Tempo, never by cutting detail.

## The files

- Findings: `.claude/gauntlet/s11/r<round>/<KEY>.md`
- Tickets: `.claude/gauntlet/s11/TICKETS.md`
- Fixers' notes: `docs/notes/gauntlet/<KEY>.md`
- The log, every merge with its evidence and the skeptic's verdict: [../gauntlet/STEP11-LOG.md](../gauntlet/STEP11-LOG.md)
- The frame rate after each merge: [../gauntlet/PERF.md](../gauntlet/PERF.md), "Step 11"

## Round 1 (launched 07:45)

| Key | Work |
|---|---|
| SC1 | Spot checks: 24 random standing spots and 6 random TV moments, each against a 2008 photo |
| AD1 | Breaker: everything a curious fan could find, with step 10's new places first |
| CR1 | Critic, the people up close: the fans' new faces and expressions, the players' faces, the Phanatic, against 2008 close-ups |
| FX1 | Fixer, step 10's known bugs: the players' mouths never open (Lidge's shout), and the pinstriped box on the infield seen from the outfield |

## How it ended (2026-10-29)

One round: three critics, a breaker, five fixers and three skeptics. The account's weekly usage limit stopped the last four agents at once, then the owner said "finish up this round and deploy! ... don't do another loop".
- **Merged:**
  - **FX1:** the players' mouths open (a rounding bug), with teeth and a dark mouth; the "pinstriped box" was a fan's floating pompom. Its skeptic upheld it.
  - **FX4:** the seated crowd's hands, raised arms, mouths, faces, expressions and shirts.
  - **FX3:** Harry the K's see-through windows and bottles, the left field elevator, the police clear of the rail, and the stand backs.
- **Published as stage 11.** Every standard view is 35 fps or better.
- **What's left:** FX2 (the seats), FX5 (the players) and the queued bundles, in [../gauntlet/STEP11-LOG.md](../gauntlet/STEP11-LOG.md) and `.claude/gauntlet/s11/TICKETS.md`.

