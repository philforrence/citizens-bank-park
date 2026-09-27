# Citizens Bank Park: notes for Claude

## 🛑 Where we left off (2026-09-26, 23:04 EDT)

We stopped for the night after merging the 8 round-1 texture agents into `ballpark`.
**Before doing anything else, read [docs/PLAN.md](docs/PLAN.md) and show the user its section 7 (decisions).**
Don't start new agents or round 2 until the user has answered them.
[START-HERE.md](START-HERE.md) has the one-screen summary.

## Standing rules

- **Subagents:** spawn them with model "opus".
- **Commits:** commit every step, on branch `ballpark`.
- **The GPU is shared** with other sessions on this machine, so use it as little as possible:
  - one browser at a time, and close it when done;
  - batch all the shots into one load;
  - check on the CPU first (`node --check`, `npm test`);
  - never launch Chrome with `--disable-frame-rate-limit`;
  - profile only when nothing else is rendering.

  Section 1 of the plan covers the lock and the shared renderer still to be built.
- **Fidelity:** the user loves the details. Win speed back without cutting fidelity.
