# Texture pass brief (shared by the eight builders)

The project: ~/citizens-bank-park, a browser (WebGPU) Citizens Bank Park on October 27 and 29, 2008, Game 5 of
the World Series (Rays at Phillies): 47 F, a cold driving rain on the 27th until the game was suspended in the
6th, cold and windy (and dry) on the 29th when the Phillies won their first title since 1980. A sold-out crowd
of 45,940 in red. You walk in through the Third Base Gate and watch the replay (TV cameras, radio, crowd).

Your job: make YOUR PART of the park richer, more faceted, more textured and more real. The owner LOVES detail
("nothing is too small"). Make 15 major changes (each a real, visible improvement, many small touches inside
each), chosen by:
  a) evidence: 2008 photos and descriptions (web search; local photos in the scratchpad: cbpimg/, gate/, hesb/,
     hes/, ref/, img/, grp/ (2008-era ballpark guide pages), twe*.jpg, audit3/ref/, audit4/*/ref/),
  b) common sense (what a real ballpark on a cold, wet World Series night has in it),
  c) creative choices where the record is silent: plausible, never glaring, true to this ultra-realistic
     moment. Invent freely where nobody could know: little stories, individual people (all Phillies fans,
     except the odd brave Rays fan), their faces, clothes, the things they carry, homemade signs, families,
     old-timers in 1980 jerseys, kids with gloves, a couple sharing a poncho, the guy who's been to every
     home game since the Vet. Name them in comments; let their story show in what they wear and do.
Read the earlier audits for what's still missing: scratchpad/audit3/ranked.md (H01-H30) and
scratchpad/audit4/*.md (HP, BW, LF, CR, EX: 50 items; some are done - check the code/git log).

## How you work
- You are in your OWN git worktree (a branch of `ballpark`). First: `ln -s ~/citizens-bank-park/node_modules node_modules`
  in the worktree root, then start your own dev server in the background:
  `npx vite --host 127.0.0.1 --port <YOUR PORT>` (never touch port 5189 or another agent's port).
- Look at your work: the screenshot harness is in the scratchpad (run from there):
  `node shot.mjs "http://127.0.0.1:<PORT>/?..." <outPrefix> '<steps JSON>'`
  steps: [{"file":"cam.js"},{"file":"audit3/seg.js"},{"js":"__start()","wait":1500},{"js":"__clean()"}, ...]
  helpers: __look(fx,fy,fz, tx,ty,tz, fov) (field frame: origin = back tip of home plate, -z toward center field,
  +x toward first base, y metres above the field; street/concourse level ~7 m), __seek(t), __pitchAt(after, off),
  __playAt(after, off), __cel(off), __susp(off), __app.cycleCamera('center'|'high'|'follow'|'walk'),
  URL options ?weather=off, ?hour=13 / ?hour=21, ?profile (GPU ms per pass in __app.profiler.result).
  Loads take minutes (eight of you share one GPU): batch many shots per run, look at every shot, crop to check.
- Commit on your branch after EACH change (small, descriptive messages in the repo's style - look at `git log`),
  ending with the line:  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
- Stay in your area and your files as much as possible (others are editing the rest in parallel; I merge all
  eight branches). If you must touch a shared file (BallparkApp.js to wire something in, geo.js for a helper),
  keep it to a few added lines in one place. Don't reformat or move code you don't own.
- Match the code: tabs, spaces inside parentheses, prose comments that say why, `standard()` materials with
  WGSL surface snippets, `canvasTexture()` for drawn textures (atlases when there are many), `Quads`/`beam()`/
  `box()` to merge geometry, InstancedMesh for repeats. The field frame is in `field.group`.
- Performance matters: the park is heavy (a 38,000-fan crowd, skinned players). Prefer instancing and merged
  geometry; static meshes get merged by material automatically (geo.batchStatic) unless instanced/dynamic;
  keep draw calls and triangles modest; night emissive with `frame.night`; wet with `frame.wet`. Check your
  area with ?profile before/after; don't add more than ~1 ms of GPU in a typical view.
- Don't break the game: after your last change, load the page cleanly (no console errors), take a day and a
  night shot of your area and one TV shot.

## When you finish
Write scratchpad/texture/<KEY>.md: your 15 changes (what, why, evidence/invention), the screenshots (paths),
anything unfinished, and anything you noticed in OTHER areas that looks wrong (for the review round). Your final
reply: the branch name, the 15 titles, and anything the merger must know (shared files touched).
