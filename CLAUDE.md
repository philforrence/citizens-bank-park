# Citizens Bank Park: notes for Claude

## Where we are (2026-10-29)

Step 11 (the gauntlet again, with spot checks, breakers and skeptics) is merged and published as stage 11. [START-HERE.md](START-HERE.md) has the summary, and the end of [docs/notes/gauntlet/STEP11-LOG.md](docs/notes/gauntlet/STEP11-LOG.md) lists what's left, starting with a speed track (the 400s seat is at 28.9 ms).
The GPU rules are in [docs/GPU.md](docs/GPU.md). After a change: `npm test`, `node test/continuity.mjs`, the standard frame-rate views (`tools/gpu/standard-views.json`) and the walk audit (`test/walk-audit.mjs`).

## Standing rules

- **Subagents:** spawn them with model "opus".
- **Commits:** commit every step, on branch `ballpark`.
- **The GPU is shared** with other sessions on this machine (paintingwalk renders here too), so use it as little as possible. [docs/GPU.md](docs/GPU.md) has the details.
  - Render only through the render desk (`node tools/gpu/desk.mjs shoot job.json`), or wrap anything else that renders in `node tools/gpu/lock.mjs run --owner "cbp <who>" -- <cmd>`.
  - Batch all the shots into one job, and scope it (`only=` / `focus=`) unless you're judging light or look.
  - Check on the CPU first (`node --check`, `npm test`).
  - Never launch Chrome with `--disable-frame-rate-limit`.
  - Profile only under the lock's exclusive mode.
  - If the lock's paths, file formats or stale rules change, tell the paintingwalk session: it runs its own copy of the protocol.
- **Fidelity:** the user loves the details. Win speed back without cutting fidelity.
