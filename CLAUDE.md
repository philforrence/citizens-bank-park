# Citizens Bank Park: notes for Claude

## Where we are (2026-09-27)

The plan is [docs/PLAN.md](docs/PLAN.md). Its section 7 decisions were answered on 2026-09-27 (recorded there).
Section 1 (the GPU) is built: the lock, still mode, scoped builds and the render desk, in [docs/GPU.md](docs/GPU.md).
Next: section 2 (win back the speed), then 3 (QA together), then round 2's first wave of 4.
[START-HERE.md](START-HERE.md) has the one-screen summary.

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
