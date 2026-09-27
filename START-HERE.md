# START HERE: where we are

**Updated: Sunday 2026-09-27, on branch `ballpark`.**

**The plan is [docs/PLAN.md](docs/PLAN.md).**

- **Decided (section 7):**
  - GPU lock, still mode, scoped builds and the render desk: yes;
  - 4 agents at a time;
  - speed before new work;
  - round 2's first wave: sound, your seat among people, rituals and the timeline, and light and shadow;
  - I look up the seven season lines;
  - hosting: skipped for now.
- **Done (section 1, the GPU):** see [docs/GPU.md](docs/GPU.md).
  - the machine-wide lock (`tools/gpu/lock.mjs`), shared with the paintingwalk project;
  - `?still` render on demand with `window.__qa`;
  - scoped builds (`?only=`, `?focus=`);
  - the render desk (`tools/gpu/desk.mjs`).

  The full park now loads in ~5 s (25–37 s last night, under contention), and a scoped page in ~2.5 s.
- **Next:**
  - section 2: find which merge costs what, under the lock's exclusive mode, then win the speed back without cutting detail;
  - section 3: QA together;
  - section 6: round 2's first wave.
- **Notes:**
  - the agents' reports are in `docs/notes/round1/`, and the audit findings in `docs/notes/audit4/`;
  - old screenshots and QA scripts are in `.claude/qa/` (local only, gitignored). The desk's shots go to `.claude/qa/desk/`.
