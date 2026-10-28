# Step 9: the gauntlet (2026-10-28)

Step 8 ("The night itself") is tagged and live. Step 9 isn't new places. It's a **critique-and-fix loop over the whole park**: critics go round the stadium taking shots, hold each one up against real photos of Citizens Bank Park in October 2008, and list what looks wrong. Fixers fix it, piece by piece, and the loop goes round again.

## What the owner asked for (2026-10-28, in their words)

> "go around the stadium and just basically make things look better ... take random shots, screenshots, and compare them to real photos of the 2008 Citizens Bank Park. Or if they're like innocuous enough, the current photos of Citizens Bank Park, but try to get 2008. I'm looking for banners hanging from the rafters. I'm looking for the all the people, their hats are all messed up and their torsos, and the fanatic looks weird."

> "split up into agents and have all those agents just like find really like messed up things and just fix them ... improve the stadium like piece by piece, bit by bit. You can feel free to add like under the stadium. You can feel free to add inside the boxes, inside different stores ... and improve the play."

> "I want like sub agents to critique everything that's going on. And when I come back, I just want it to look so much more realistic ... while also trying to keep the frames per second somewhat high so that it's a playable game."

**Their answers to my questions:**
- **How long:** until they message, or until 7 pm on the 28th, whichever is first. At 7 pm, wind down (finish what's running), don't hard stop.
- **Frame rate:** a **30 fps floor** in the walking and TV views.
- **"The play":** both. The players on the field (how they look and move) and how it plays (walking, the cameras, the controls, the scrubber and HUD).
- **Publishing:** yes. When the loop ends, tag step-9 with a screenshot and push it to the site.

## The loop

The full briefs are in [../gauntlet/BRIEF.md](../gauntlet/BRIEF.md). The working files (tickets, findings, shots, references) are in `.claude/gauntlet/` (local).

1. **Critics** (read-only on the code) each take a zone of the park. They shoot it through the render desk (day, night, rain, close and far), find 2008 photos of the same spot, and write ranked findings: what's wrong, the shot, the reference, a suggested fix, the files, and the frame-rate risk.
2. **The coordinator triages** the findings into **tickets** (`.claude/gauntlet/TICKETS.md`), ranked by how glaring each is times how much it's on screen, and bundled so that no two fixers touch the same files.
3. **Fixers** each take a bundle, in their own worktree: before and after shots of the same views against the reference, `npm test`, a clean load.
4. **The coordinator verifies** the before and after against the reference, merges, loads the combined park clean, and checks the frame rate under exclusive. A fix that breaks the floor is optimized (LOD, batching, caching) before it stays. Never by deleting detail.
5. **Rolling, not in lockstep:** at most 4 agents at once (the GPU rule). When a slot frees, it goes to the next ticket, or to a critic for a zone that hasn't been looked at since its last fixes.

**Zones for the critics** (round 1 follows the owner's list first):
- **People:** the seated fans up close (the hats and torsos), the standing and walking people, the vendors, the Phillie Phanatic.
- **The bowl, the roof and the boards:** the banners hanging from the rafters, the roofs and light towers, Phanavision and the ribbon boards, the fascia, the field, the view from the seats, the skyline.
- **The play:** the players' look and motion (pitching, swinging, running, fielding, the pile), the umpires, the TV cameras against FOX's 2008 broadcast, and the controls (walking, the free camera, the scrubber, the HUD).
- **Inside and under:** the concourses and the stands' insides, the stores, the suites and boxes, the Hall of Fame Club, under the stadium, the gates and outside.

## The frame-rate floor

30 fps is 33.3 ms a frame. The baseline is step 8, measured under exclusive at 1280 × 800 before the first fix ([../gauntlet/PERF.md](../gauntlet/PERF.md)). Every merge is re-measured in the same views.

## At the end

1. The last merges, the combined park loaded clean, `npm test`, and the final frame-rate check.
2. [../gauntlet/LOG.md](../gauntlet/LOG.md): every fix, with its before and after and its reference.
3. `docs/stages/step-9.jpg`, START-HERE.md updated, then `git tag -a step-9` and `git push origin ballpark step-9`.

## How it went (2026-10-28, 7:40 am to 7 pm)

Five rounds of critics (people, the bowl, the play, inside and under; then the walk, the broadcast, inside and outside; random shots everywhere; the game from your seat; a pre-publish check) and about thirty fixers, including three speed tracks, merged one by one into `ballpark`. Every merge, with its evidence and what was left, is in [../gauntlet/LOG.md](../gauntlet/LOG.md); the frame rate after each in [../gauntlet/PERF.md](../gauntlet/PERF.md). Published as stage 9, with `docs/stages/step-9.jpg`.
