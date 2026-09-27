# Citizens Bank Park: notes for Claude

## 🛑 Where we left off (2026-09-27, afternoon)

The owner disconnected while little-worlds wave 1 was merging.
**Read [START-HERE.md](START-HERE.md) first:**
- it says what's merged and what's left (W2, the concourse);
- after that: profile, the review set, then show the owner the combined park;
- **no next wave until the owner has reviewed it.**

The plan is [docs/PLAN.md](docs/PLAN.md), the GPU rules are in [docs/GPU.md](docs/GPU.md), and the worlds loop is in [docs/notes/worlds/WAVES.md](docs/notes/worlds/WAVES.md).

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
