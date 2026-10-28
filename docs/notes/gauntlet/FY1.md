# FY1, round 1: the play (critic CY's tickets)

Fixer FY1, branch `worktree-agent-ab6197dfe0db53ccb` (off `ballpark` at 214f49c). Tickets from `.claude/gauntlet/r1/CY.md`.

**Shots** (all full park, 1280 × 800, `.claude/gauntlet/r1/FY1/` in the main checkout):
- `before/`: the views before any change (the default hour, the CF camera on Lidge and on Romero, the follow camera, Utley's play, the HUD, high home).
- `after1/`: the cameras, the game clock and Utley's play, after the first fixes.
- `after2/`: coaches, the manager, the horn, the cut-off, Upton's slide, the HUD in both modes.
- `final/`: the last job, every ticket's after shot, the TV center shot and the counts.

**References:** CY's, in `.claude/ref/gauntlet/play/` (the world feed of Game 5, U_R8E614TB8) and `.claude/ref/home/` (Getty CF-angle stills). Nothing new downloaded.

## The replay's clock (read this first)

The radio call is one mp3 voiced on the replay's clock (`public/audio/radio/game5.mp3`, Radio.js seeks it to `director.t`). My first plays ran longer than step 8's and moved everything after them: the last pitch came 3 s late.
- **The fix:** every in-play segment keeps step 8's length (`legacyInPlayDur`, the old plan's arithmetic). A play that needs longer now (Utley's tag, a throw through the cut-off) borrows up to 2.4 s from the result segment after it.
- **Checked in Node** against 214f49c's Director: all 429 segments but the results start where they did, and the duration is 3785.503 in both.
- **For anyone changing the Director:** keep the segment clock, or the radio call drifts.

## Per ticket

### CY-1 Utley's play at the plate: done
- **The data:** `outBase: 0` is home plate, read as 4 everywhere (`outBaseOf`, `runTo`): the in-play plan, the steals, the umpires' calls. It's the only out at home in the game.
- **The play** (top of the 7th on the 29th):
  - Iwamura's chopper is slow to Utley (an infield single on the ground is a chopper or a roller, or he'd have been thrown out).
  - Utley fields it behind second, pumps to first (`M.pumpFake`), turns and throws home.
  - Ruiz takes it a stride out in front of the plate toward third and dives back across (`M.diveTag`, a root tilt). Bartlett comes in head first (`M.slideHead`, tilted face down, his hands on the plate).
  - The plate umpire is out on the third base line in foul ground and punches him out. The ball beats Bartlett by about half a second.
- **The ball:** between its flights it's in a glove and isn't drawn (it used to lie on the grass at Utley's feet). `director.ballFocus` keeps where it was for the cameras.
- **Before / after:** `before/u2-plate-close.jpg`, `before/u1-utley-high.jpg` (Ruiz at an empty plate, Bartlett at third). After: `final/u2-plate-dive.jpg`, `final/u3-plate-tag.jpg`, `final/u4-high-tag.jpg`, `after1/u5-plate-call.jpg`.
- **Against the reference:** `youtube_..._t13250s_ruiz_tags_bartlett_headfirst_replay_oct29.jpg`, the same shape: Ruiz diving across, Bartlett head first along the line, the umpire beside it.
- **Left:** Ruiz lands a little on top of Bartlett; it reads as the tag.

### CY-2 The default hour: done
- **Is 16 what a player gets?** Yes. `timeOfDay: 16.0` came with Tidewater's engine in step 1 (`git log -L`) and was never changed for the night game. Nothing on a normal load set it, and the before shot's page read `[16, 0]`.
- **The fix:** the light follows the replay's own clock, the Alley's `when()`. That runs 8:38 pm at the first pitch on the 27th to 10:40 at the suspension, then the delay, then 8:37 to 9:58 pm on the 29th. EDT is converted to local solar time (−1 h for daylight saving, +16.2 min equation of time, −0.7 min longitude), so 19.9 to 21.2.
- **It lets go** once the hour is set another way: `?hour=`, the Sky slider, T, a QA shot's `hour`. The Sky panel has a **Game clock** toggle to pick it up again.
- **The loader's tip** "Press T to let the day run" is gone.
- **Before / after:** `before/00-default-hour-center.jpg` (sunny 4 pm, long shadows) against `after1/00-default-hour-center.jpg` and `final/00-default-hour-center.jpg` (night). The js read `gameClock true`, hour 20.33 at t 2704 and 21.22 at t 3483.

### CY-3 FOX's center field camera: done
- **The eye** is fixed at (−9, 9.5, −128) for every pitcher, in left-center (it was ±1.8 by the pitcher's hand).
- **The lens:** fov 2.7 (was 5.2), aimed at (0.4, 0.75, 0), with no depth of field.
- **The frame** (`final/c2-center-romero-iwamura.jpg`, `final/c1-center-lidge-set.jpg`):
  - the pitcher full length lower left, his feet at 83% down;
  - the plate at 62%, the batter, catcher and umpire upper middle;
  - the crowd behind home sharp;
  - all as in t13150s and t16310s (pitcher 38% across, plate 54%: within a few percent of FOX's frame).
- **Bowl.js, one marked `FY1` block:** the CF platform and its two cameras moved to left-center with it, so the camera you look through is where its platform is.
- **Left:**
  - The runner on second and, with runners on, the second base umpire behind the mound (Director `_umpires`: (−4.5, −22.5)) are in the bottom of the frame. FOX's camera is higher, but the plate and mound positions need ~9.5 m at 128 m.
  - The backstop has no virtual ad (FOX's world feed had WISER'S / Nikon there; it's not in the park).

### CY-5 The follow camera through the rail: done
- **The fix:** the lens is 0.4 m out past the club platform's rail and 0.25 m higher, toward the field, so the rail and its posts are behind it. It's tighter, fov 650 / d (4–30).
- **Before / after:** `before/f1-follow-utley.jpg` (the black rail and post across the bottom third) against `after1/f1-follow-utley.jpg`, `after1/f2-follow-groundout.jpg` and `final/f1-follow-utley.jpg`.

### CY-10 Keys and labels: done
- **G** is double speed only. The game panel hides on **J** and with photo mode (P).
- **"The game" section** (C, K, `,` `.`, `-` `=`, B, J) is on F1 (`UI.addHelpSection`), the start card has C and K (`UI.addStartKeys`), and the loader's tips say how to watch on TV and run the replay.
- **The mode label** names the camera ("FOX broadcast", "Center field camera"...), and the prompt says "C Next camera".
- **Shots:** `after2/h1-hud-walk.jpg` and `after2/h2-hud-tv.jpg` (the start card with the new keys).

### CY-11 The HUD: done
- **The play line:** "Last play: ..." while it's this half's. From the change of sides it reads "Top of the 7th: Rays batting, Dioner Navarro leads off" (`after2/h1-hud-walk.jpg`).
- **The pitch's speed** comes up once the pitch reaches the plate (`now.pitch`).
- **Moments:** the big plays are gold marks on the slider and a list to jump to. They are the first pitch, Victorino's single, Peña's tying single in the rain, the tarp, the return, Jenkins's double, Werth's single, Baldelli's home run, Utley's play, Burrell's double, Feliz's single and the last pitch.
- **On TV** the panel shrinks to a bottom-left corner bug like FOX's 2008 one (`after2/h2-hud-tv.jpg`). The play line and transport come back on hover.

### CY-12 Broadcast cutting: done
- **The modes:** C steps walk → **FOX broadcast** → center → high → follow.
- **The broadcast cuts as FOX did:**
  - center field for every pitch;
  - between pitches, close-ups from the low first / third base cameras in the dugout wells (the rail's `Wells.js`): the batter from his open side, the pitcher from his, with a soft crowd behind;
  - high home on a ground ball, high third following anything in the air;
  - after a play, the batter on base or the pitcher;
  - a pitching change followed out and in;
  - the celebration from center, then high first.
- **High home is tighter:** fov 32 aimed at (0, 0, −36), the plate near the bottom (t13290s).
- **Shots:** `after1/tv1-close-pitch-start.jpg` (Hinske stepping in, Ruiz in the foreground), `after1/tv3-inplay-ground.jpg`, `final/tv1-broadcast-pitch.jpg`.
- **Left:** no replays and no on-screen graphics. Close-ups use the low cameras only (FOX also had a low home and a "high first" tight).

### CY-7 Base coaches: done
- **Who:** the batting team's coaches stand in their boxes all game, in helmets (2008, the first season they had to) and jackets: Lopes and Smith for the Phillies, Hendrick and Foley for the Rays.
- **What they do:**
  - the third base coach gives signs as the batter steps in, and both go hands on knees as the pitcher comes set;
  - on a hit the third base coach windmills a runner round or holds him up, and the first base coach claps a Phillies hitter in;
  - between innings they come out from the dugout.
- **Slots:** `r:` ids, freed between halves.
- **Shots:** `after2/co1-3b-coach-signs.jpg` (Foley signing), `after2/co2-windmill-upton.jpg`.
- **Left:** coaches' numbers (blank) and the first base coach's slap with the runner.

### CY-8 Base running: done
- **Runners:** they start from their leads (with two out, on contact), get up to speed (out of the box too), and swing out before a base they round, cutting the inside corner (`alongBases`: the heading turns through the curve, no 90° snap).
- **Slides:** on tag plays and when scoring as the throw comes in; the batter runs through first on infield plays.
- **Steals:** the catcher throws through (a 2 s pop time), the shortstop (second baseman with a lefty up) covers and tags, the runner slides in feet first, and the base umpire calls it.
- **The catcher** straddles the front of the plate off the runner's line when a run scores, so nobody runs through him.
- **Shots:** `after2/s1-upton-slide.jpg` (Upton's slide home in the rain, against Getty 84081866), `final/s2-upton-steal.jpg`.

### CY-9 Runners' gloves: done
- Anyone in a helmet (the batter, the runners, the coaches) has the fielder's glove taken off in `_sync`.
- **Before:** `before/c2...` (Bartlett's glove). **After:** `final/c2-center-romero-iwamura.jpg`.

### CY-14 Catches overhead: done (with CY-1)
- Throws are caught chest high (`M.receive`, at the ball's height). The first baseman stretches off the bag toward the throw (`M.stretch`, mirrored for Howard) as it arrives, standing on the inside of the bag.
- `catchHigh` is for fly balls only.
- **Shot:** `final/dp3-1b-stretch.jpg` (Howard on the double play, the critic's DP3 view).

### CY-22 The ball after strike three: done
- Strike three stays in the catcher's mitt, including the last pitch of the Series (`final/k22-last-pitch-mitt.jpg`).
- With the bases empty and fewer than three out it goes around the horn: catcher → third → short in the result, then short → second → third → pitcher in the next walk-up (`after2/k1-horn.jpg`).
- With men on, it's flipped back to the pitcher.

### CY-23 Cut-offs and backing up: done
- **A runner going home:** the throw comes through the cut-off man between the mound and the plate (the first baseman; the third baseman from left), who holds it, and the pitcher backs up the plate. That's Peña on Feliz's single (Getty 83486150), in `after2/cut1-feliz-high.jpg`.
- **Otherwise** the throw goes to the base ahead of the lead runner, with the pitcher backing up third.

### CY-13 The plate umpire: partly
- **Done:** he's lower (`M.umpSet`: pelvis 0.63, trunk pitched 0.7 rad), his chin just over the catcher's head (`after2/ump1-center-romero-set.jpg` against Getty 83485455). He sets up in the slot on the batter's side, and goes out to the third base line for a runner coming home.
- **Not done:** the jacket's powder-blue panels are Players.js (the uniforms fixer's file).

### CY-17 The manager on pitching changes: partly
- **Done:** Manuel (or Maddon) comes out to the mound while the catcher and infielders gather round it. He takes the ball from the pitcher, who jogs off, hands it to the reliever from the pen and walks back into the next pitch (`after2/mgr-change.jpg`).
- **Not done:**
  - the "Coaching visit to mound" advisories, which have no time on the clock (adding segments would move the radio call);
  - the reliever's warm-up throws (the 18 s change has no room).

### CY-15 Walking: partly
- **Done:**
  - the seated fans push you back out (a 1 m grid of the crowd's seats, built once), so you go up the stands by the aisles, not through laps;
  - the eye eases over steps;
  - walking is 1.9 m/s and Shift 4.6 (were 3.0 / 6.2); G still doubles.
- **Not done:**
  - footsteps by surface: the walker is built with no audio object, so it plays none at all;
  - STEP stays 0.62, because the aisles are the rows' own treads (Stands.js), with nothing smaller to step on.
- **Test:** `final/w3a` / `w3b`. CY's "W3" walk, 4 s up from the front row, is in the final job's values.

### CY-20 The on-deck hitter: done
- He kneels with his bat, gets up every so often for two easy practice swings and a stretch with the bat across his shoulders (`M.batStretch`), and goes down again, each to his own rhythm (`after2/od1-ondeck-ruiz.jpg`).
- **Left:** sending him to the plate to signal a runner in.

## Not mine, and not done
CY-4 (the whites at night), CY-6 (the uniforms' cut), CY-16 (the pile), CY-18 (faces and caps), CY-19 (one delivery for every pitcher), CY-21 (gloves and belts). These are Players.js / Rig.js / Looks.js / Celebration.js work.

## The counts
`engine.meshRenderer.stats` (draws / triangles), full park, 1280 × 800, not profiled:

| View | Before | After |
|---|---|---|
| TV center | 524 / 6.45 M (Romero, t 2700.4, but at the 4 pm default) | 481 / 6.27 M (the last pitch, t 3480.2); 478 / 6.74 M (Romero, t 2705) |
| TV high, the last pitch | not recorded | 619 / 8.39 M |
| TV follow, Utley's play | not recorded | 445 / 7.97 M |

- **How the counts were read:** a shot's `js` runs before its frames, so each figure is the view of the shot before it (`final/` job values, matched up here).
- **Not a clean before and after:** the before center figure was taken at the 4 pm default hour, not the same light.
- **The walk test** (CY's W3: from the front row at (−12, 21) holding W away from the field for 4 s):
  - before, he went 11.8 m up through the rows to (−12, 32.8);
  - now he stays at (−11.97, 20.62), held at the front row by the fans (`final/w3b-after-4s.jpg`).

- **What changes the GPU cost:**
  - the center camera is narrower (2.7°) and has no DOF;
  - high home is narrower (32° against 48°);
  - the follow camera is tighter.
  - All three see less, so they should cost less.
- **What's added:** 2 coaches always (and the manager at changes): 2–3 of the 96 rig slots.
- **The close-ups** in the broadcast mode use the DOF (an in-shader branch that costs nothing when off).
- **The fan grid** for the walker is built once (≈45k seats), then a 3 × 3 cell lookup a frame.

## Noticed elsewhere
- **The second base umpire** stands at (−4.5, −22.5) with runners on, right behind the mound, big in every CF frame with men on. In 2008 the B umpire with a runner on was usually inside, behind the mound on the shortstop side, so it's plausible, but it's the biggest figure in the frame.
- **The rail world's people** stand along the backstop in the CF frame (`after1/c1`): two men standing in front of the backstop's padding behind the plate. FOX's frames show nobody there.
- **The Phanatic** is in the seats behind the 3B well in the batter close-up (`after1/tv1-close-pitch-start.jpg`). Probably right (he roamed), but worth a look.
