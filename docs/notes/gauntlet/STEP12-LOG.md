# Step 12's log

The plan is [../worlds/STEP12.md](../worlds/STEP12.md). Newest at the bottom. Times are local (America/New_York), 2026-11-12 unless a date is given.

- **The start.** `ballpark` is at step 11 as published (4d00c5d), clean. The machine is on AC. Step 11's queue is carried into `.claude/gauntlet/s12/TICKETS.md`. FX2's uncommitted seat edits are saved as `.claude/gauntlet/s12/FX2-wip.patch` (149 lines, `Stands.js`, `ConcourseSteel.js`, `terrace/Build.js`; it applies on `ballpark`).
- **Round 1 launched (08:01),** four agents:
  - **SP4, the speed track:** the 400s seat (28.9 ms) and left field (28.0 ms): the crowd's near-level hands, Harry's bottles and glass, the left field corner's one Kit mesh, and FX3's unexplained +137k triangles in TV center. Goals: 26 ms and 24 ms, nothing visibly different.
  - **FK1, the seats:** FX2's patch, read critically, then SC1-1 (pans fold up behind standing fans), SC1-5 (the seats' blue), SC1-12 (the nosings), SC1-16 (the white stair rail), AD1-7, AD1-12, AD1-16 (the Deck's portals, the Diamond Club's tunnel mouths, the end wedge), the dugout roof's rail, the one-sided hall wall.
  - **FK2, the players:** CR1-5 (foreheads through caps), SK1's F1-F3 and the squint (Lidge's shout), CR1-12, -14, -22, -21, -6, -24, -13, -15, -23, AD1-10; the real 2008 faces moved toward their photos.
  - **CR2, a critic on the field and the broadcast:** the ground, the 27th's rain, the walls and ads, the boards, the play itself and FOX's cameras, against Game 5 stills.
- **The baseline frame rate (07:59)** was taken while round 1's agents were starting, so it reads high (TAAU 1.88-2.47): [PERF.md](PERF.md), "Step 12". The code is step 11's. Merges in this step are judged by back-to-back A/B pairs.
- **The first fix pipeline launched (08:06),** as a workflow (`step12-fix-pipeline-a`): three bundles from step 11's queue whose files don't overlap each other's or round 1's. Each goes fixer (own worktree) → a skeptic who renders both trees, and a code reviewer who reads the diff without rendering → one repair round and a re-check if either sends it back. The workflow holds its rendering agents to three at a time.
  - **FK3, the outfield walk:** the Pavilion concourse's six stands and restrooms (SC1-7), the Right Field Gate's plaza (SC1-8), the roofs below the Terrace's left field end (SC1-13), the Alley's umbrellas (SC1-14), the Alley elevator blocked by its own stair (AD1-3), the Pavilion tower's brick edge (AD1-11).
  - **FK4, indoors:** the suites' glass swapping rooms and people (AD1-4), the corridor mural (AD1-8), the club's patrons in the delay (SC1-6), the carpet (SC1-9), the portraits and murals (SC1-10), the suite counter's collider (SC1-11), doors in the Hall of Fame Club's glass.
  - **FK5, the standing people:** floating pom-poms and high caps (CR1-16), bottle bodies (CR1-25), the concourse at strike three (SC1-3), people on the new stairs and ramps (AD1-14).
  - **Still queued:** the outside (the Spectrum and Wachovia Center, the cars' wheels, the far city), the Phanatic, the field's-edge people on the players' rig (after FK2), the crowd's pompom (after SP4).
