# Citizens Bank Park: notes for Claude

## Where we are (2026-11-12, evening)

Step 12 (the gauntlet, round and round) is stopped part way, at the owner's word: "wind down and make notes for when I tell you to pick it up". Five branches are merged on `ballpark` (speed, the seats, the players, the outfield walk, the standing people); three more are finished but not yet judged (the rain, the backstop, the ground); indoors is held. Nothing is published or pushed: stage 11 is the last stage on the site. **Start with "Where step 12 stopped" at the end of [docs/notes/gauntlet/STEP12-LOG.md](docs/notes/gauntlet/STEP12-LOG.md):** it has the pick-up list in order. Wait for the owner to say pick it up, and publish only when asked.
The GPU rules are in [docs/GPU.md](docs/GPU.md). After a change: `npm test`, `node test/continuity.mjs`, the standard frame-rate views (`tools/gpu/standard-views.json`) and the walk audit (`test/walk-audit.mjs`).

## Standing rules

- **Subagents:** spawn them with model "fable". Check the plan's usage before each launch (`mcp__ccd_session_mgmt__get_usage`): once the weekly Fable limit is at 70% or more, spawn them with model "opus" (Opus 5.5) instead, so the coordinator (which runs on Fable) keeps enough to go on. The owner, 2026-11-12: "If you're nearing 100% fable usage, switch the subagents to Opus 5.5".
- **Commits:** commit every step, on branch `ballpark`.
- **The GPU is shared** with other sessions on this machine (paintingwalk renders here too), so use it as little as possible. [docs/GPU.md](docs/GPU.md) has the details.
  - Render only through the render desk (`node tools/gpu/desk.mjs shoot job.json`), or wrap anything else that renders in `node tools/gpu/lock.mjs run --owner "cbp <who>" -- <cmd>`.
  - Batch all the shots into one job, and scope it (`only=` / `focus=`) unless you're judging light or look.
  - Check on the CPU first (`node --check`, `npm test`).
  - Never launch Chrome with `--disable-frame-rate-limit`.
  - Profile only under the lock's exclusive mode.
  - If the lock's paths, file formats or stale rules change, tell the paintingwalk session: it runs its own copy of the protocol.
- **Fidelity:** the user loves the details. Win speed back without cutting fidelity.
