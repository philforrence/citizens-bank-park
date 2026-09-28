# R: the night's rituals and the celebration

Branch: `worktree-agent-a036b479d074411b8`, off `ballpark` at `bb62637`. The place is `rituals` (`?only=rituals,...`).

**The two halves:**
- **The people on the field** are the players' rig (grounds crew, umpires, players, coaches, Hickey and Moyer). The Director poses them from R modules in `src/ballpark/game/`:

  | File | What it does |
  |---|---|
  | `Suspension.js` | The rain delay and the resumption. |
  | `TarpPlan.js` | The tarp as a pure plan of time. |
  | `Celebration.js` | The last out, the pile, the stage, the lap. |
  | `Breaks.js` | Warm-up throws, and the drying agent in the 5th. |
  | `RitualMoves.js` | The rig motions these need. |

- **Everything else** is in `src/ballpark/places/Rituals.js` and `places/rituals/*`:
  - the roll, the stage, the trophy, the Camaro, the flag and the rubber;
  - fireworks and their sound;
  - the stands emptying and filling;
  - Cast figures: the press, the motor officers, the presentation party, Kalas, the singer.

Everything is a pure function of `director.t`, so scrubbing works. `director.night( t )` says which night it is.

## The timeline change: read this first

- **The suspension's break is 160 s (it was 24 s).**
  - It is the same segment every place already finds: `kind: 'switch'`, inning 6, bottom.
  - The first 55% (88 s) is the 27th; the last 72 s are the 29th. A's Phanatic and Phanavision already split it at 0.55.
  - The 27th: the tarp pull, the delay, the suspension, the park emptying into the rain.
  - The 29th: the tarp off, the crew's work, the park filling, God Bless America, the Rays out.
- **The celebration is 300 s (it was 80 s).** It's the last segment, so it moves nothing else.
- **Everything after the suspension moves 136 s later.** Consequences:
  - **New helpers on the Director:**
    - `director.night( t )` returns `{ night, susp, delay, back, k, lt, dur, t0, split, resume }`;
    - `director.suspension`;
    - `director.radioTime( t )`.
  - **The radio mp3** is still on the old clock. `radioTime` maps onto it: the suspension's two lines play, the track stays silent through the rest of the delay, then picks up again. If S re-voices the radio, drop the map.
  - **Every place's own "is it the suspension?" test** now splits the same way, each in a small `// ---- R` block:
    - `_weather`: the 27th's rain goes on through the delay, and the tarp comes from the plan;
    - FieldRail and its waiting crew;
    - Concourse3BPeople `nightState`, the Alley's `when()` (its clock runs 10:40–11:50 pm through the delay), BehindHome, the gate's `Night.js`;
    - T1's benches; W3's Balfour in the pen;
    - C's hard-coded scene windows, remapped by `oldClock` in `Concourse1B.js`;
    - A's four-wheeler ride on the 29th;
    - the concourse TVs' RAIN DELAY and GAME SUSPENDED cards.

## The changes

E is evidence, C common sense, I invention.

1. **H14 fixed: the suspension told in full** (`Director.js` R blocks; `Suspension.js`). Nobody takes the field in the delay. The 27th:
   - The Phillies come in. The plate umpire (Kellogg) waves for the tarp and the umpires walk off. E: Getty 83458174.
   - Both pens walk in across the outfield in their jackets, around the tarp, to their dugouts. E: Getty 83458679, 83458226.
   - Twenty crew on the rig, in red hooded rain jackets and khakis, some hoods up. E: 20–25 counted in 83458679 and 88457361.
   - They run out along the tube and swing the roll off the wall onto the grass. Then they pull the sheet off it by the strap handles toward the first base line, walking with the handles behind them and the edge held up (T7's unused `pullBehind`). Three stay at the roll turning it; it thins to the black core, which stays where it lies beyond second. E: 83458220, 88457361, 83458149, 83458151, 83458226, 84081873.
   - They walk the edges square and stand by it. Most go in; six stay out in the rain.
   - C/I: the exact path of the roll from the wall onto the grass isn't photographed, so the swing-out is a simplification.
2. **The tarp's roll** (`rituals/Roll.js`, `TarpPlan.js`).
   - A silver-grey vinyl roll on its black ribbed core, laid along the plan's axis every frame it moves.
   - It turns as the sheet feeds off it, and the core shows through as it thins. The ends show the hollow, the ribbed wall and the wound layers. E: 83458220.
   - The canvas cover lies heaped along the wall while the roll is out.
   - Details2008's sheet gathers its unpulled part at the pulled edge, held up at waist height (`rollY`, an R edit inside W4's block).
3. **The 29th, as it was** (E: MLB.com, Oct 29; research report).
   - The tarp comes off in the empty afternoon park: the edge is walked back and the roll wound up and swung back to the wall. E: it was off before the gates opened at 5:30.
   - The park fills.
   - The crew work the field. E: hoses on the clay, Getty 83824985. C: rakes around the bags, two drag mats around the arc, tampers on the mound and at the plate, Lucho Figueroa with the chalk liner.
   - God Bless America (see 11).
   - Balfour and Jim Hickey walk in from the pen. E: Getty 83824975, ~8:30.
   - The Rays run out and the umpires walk out. Jenkins, pinch-hitting for Hamels, walks to the on-deck circle. Everything is in place when the walk-up begins.
4. **The stands empty and fill** (`rituals/Seats.js`, Crowd.vacate).
   - The 27th: the seats thin through the delay, then empty for the exits once it's called off, leaving a few diehards. E: AP "six or seven deep" in the concourses; Getty 83458502 "as a few fans remain".
   - The 29th: the park fills from empty, full by the song.
5. **The board and the TVs.**
   - Once the game is called, Phanavision shows its own suspension message, word for word: "TONIGHT'S PHILLIES/RAYS GAME HAS BEEN SUSPENDED…" E: Getty 83458512, AP 4551252.
   - W2's concourse TVs switch from RAIN DELAY to GAME SUSPENDED / HOLD ON TO YOUR TICKETS at the announcement (`ANNOUNCE`, 48.4 s, where S's PA says it).
6. **Warm-up throws between every half inning** (`Breaks.js`). C:
   - grounders from first to third, short and second, thrown back;
   - the pitcher's tosses to the catcher, using the replay's ball;
   - catch in the outfield;
   - the catcher's throw down to second, then around the horn.
7. **The drying agent in the middle of the 5th on the 27th** (`Breaks.js`). E: AP "the grounds crew pours a drying agent on the mound … in the middle of the fifth"; Getty 83458171 (DIAMOND PRO calcined clay).
   - Four of the crew run out: two spread it over the mound, one rakes it in, one works the boxes.
   - The warm-up tosses wait until they're off.
8. **The pile, built up properly** (`Celebration.js`).
   - Lidge on his knees in front of the rubber. Ruiz, first there in his gear, embraces him. Howard dives from the first base side and over they go, Lidge underneath. E: Getty 83486412, 83485858, 83485929.
   - Then the rest in the order they'd arrive (infield, outfield, the dugout over the rail, the four still in the pen through its gate in center, the coaches with Manuel walking):
     - nine dive on in layers, heads in;
     - eight lean in;
     - the rest jump around it.
   - It comes apart from the top, Lidge last.
   - Then the hugs (Lidge and Ruiz, Manuel and Lidge, Howard and Utley…), and knots of players on the infield grass. One in five first goes out to the stands to wave.
9. **The champions' grey tees and black caps** (`Players.js`: `ROLE.tee`, `ROLE.champCap`). E: Getty 83571364, 83571213; ronniebruce 2987488477.
   - Each man puts them on 50–110 s after the out.
   - The coaches and the pen keep their red jackets and add the cap.
10. **The press, the police, the fireworks.**
    - **The press** (`rituals/Press.js`): 22 photographers with pro zooms and flashes, three FOX handhelds and a boom mic. They come out of the wells, ring the pile, and then each follows a man. A third of them turn to Kalas. E: Getty 83571364. Uses new Cast props `PROP.slr`, `PROP.eng`, `PROP.boom`.
    - **Six motor officers** (`rituals/Motors.js`): black leather, white helmets (`HAT.motor`), white Harleys with red and blue lamps. They ride in around the track, park, and stand facing the stands; one leads the lap. E: Getty 83486531; pompomflipflop 2986308010; ronniebruce 2987488477.
    - **Fireworks** (`rituals/Fireworks.js`), all on the GPU with no CPU cost. E: ronniebruce 2988346176, pompomflipflop 2985520865, danielbott 2987283345.
      - gerbs off the scoreboard and a red fountain off the Liberty Bell;
      - 34 shells over the outfield;
      - the booms synthesized and placed where each shell bursts, arriving late by the distance.
11. **God Bless America before the resumption, and the stretch** (`rituals/Song.js`).
    - PO1 Dorcus Whigham, in the Navy's dress blues, at a microphone behind the plate. E: MLB.com (Footer), Newman: 8:26 pm, "many in the crowd sang along". I: where she stood.
    - The whole bowl stands (`crowd.focus` over the park). The crew and everyone on the field stop where they are, caps over hearts, facing the flag.
    - The seventh-inning stretch stands the park up the same way.
12. **The stage, the trophy, the presentation** (`rituals/Stage.js`, `Party.js`, `Celebration.js`).
    - The stage goes up in pieces on the clay on the first base side of second: black-skirted deck, pipe rails, stairs, a clear pedestal, steel barriers. When finished it is merged to a few draws.
    - The MVP's red Camaro is driven in beside it.
    - The Commissioner's Trophy: 30 gold pennants around the silver ball.
    - Selig, Montgomery, Giles and Gillick (the club's men in the champions cap) go up with FOX's Zelasko and Chris Myers.
    - Selig speaks and hands over the trophy. Montgomery holds it up; Gillick holds it for the pictures.
    - Manuel is interviewed, the finger raised to the crowd. Myers interviews the MVP.
    - The players gather in front. Six go up and Howard lifts it.
    - E: Getty 83570999, 83486314, 83486316, 83486403, 83485971; ronniebruce 2988348008, 2988347232; anthonydefrancesco 2986359720.
13. **The lap behind the flag** (`Celebration.js`, `rituals/Flag.js`).
    - Eleven walk the track from the right field corner behind Brett Myers's big red flag, streaming off its pole. Howard carries the trophy.
    - The lead motor officer rides ahead. The fans along the way stand with arms out (`crowd.focus` following the flag).
    - E: Getty 83570906; ronniebruce 2987488477, 2988346732.
14. **Harry Kalas sings "High Hopes"** on the foul grass past the Phillies' dugout: houndstooth coat, champions cap, microphone, the cameras around him. E: johnpaulendicott 3001397124, 4255825686. I: exactly where, and when in the replay.
15. **Moyer and the rubber.**
    - Jamie Moyer is added as a rig player; he isn't in the box score's roster data.
    - While the stage goes up, he digs the pitching rubber out of the mound on his knees, then holds it for the cameras.
    - The hole stays in the clay. E: Getty 83571213; johnpaulendicott 3001401832.

## The people

Real people, as they were:
- Tim Welke (crew chief) and the umpires; Kellogg at the plate.
- Charlie Manuel, Davey Lopes, Steve Smith, Pete Mackanin, Rich Dubee, Milt Thompson, Ramon Henderson, Mick Billmeyer.
- Jim Hickey, Jamie Moyer.
- Bud Selig, David Montgomery, Bill Giles, Pat Gillick.
- Jeanne Zelasko and Chris Myers (FOX).
- Harry Kalas.
- PO1 Dorcus Whigham, US Navy. Her looks weren't found, so she is kept plain.

Invented people, in `CAST.md`:
- **Frank Tomaselli,** 57, Havertown: on the crew since the Vet's last years. He takes the far end of the roll (the end that swings across left field) and is one of the six who stay out with the tarp. He is crew 1, with grey hair and a moustache.
- **Lucho Figueroa,** 34, Kensington: the chalk liner man on the 29th. He stops with his cap on his heart for the song.
- **Ricky DeSantis,** 22: a Temple intern, his first October, on a hose on the 29th.

The photographers, FOX crews and motor officers are unnamed.

## References

About 280 images and 165 notes, in `/Users/phillipforrence/citizens-bank-park/.claude/ref/rituals/`:
- Getty comps; Flickr (pompomflipflop, puffygreenjacket, ronniebruce, johnpaulendicott, anthonydefrancesco, bub56 and others); Commons; YouTube storyboard frames of the FOX and international feeds.
- `web-*.txt`: MLB.com (Footer, Newman, Leach, Hoch), the Inquirer, AP, SI, Retrosheet, Phillies press releases, and the Getty upload-time timeline.

The researchers' reports are summarised in the commit messages.

The timeline, from the research:
- **Oct 27:** first pitch 8:30 pm; the third out 10:39; the tarp 10:40; called at 11:10; the PA ~11:20; a few left by 11:50.
- **Oct 29:** gates open 5:30; God Bless America 8:26; Balfour and Hickey walk in ~8:30; the Phanatic 8:37; play at 8:40, 44°F; the last out ~9:58.

## Screenshots

In the worktree's `.claude/qa/desk/`:
- `r2-*`: the roll and the pile.
- `r3-*`: the pile and the press; the delay with the stands emptying (full park); the 29th filling; the warm-ups.
- `r4-*`: the fireworks, the motor officers, the knots.
- `r5-*`: the stage, the trophy, the Camaro, the lap, Kalas, Moyer.
- `r6-*`: God Bless America (full park), the 29th's crew, Balfour and Hickey, the drying agent in the 5th, the stretch, the delay emptying.
- `r7-*`: the tarp pulled off the roll by the handles, the tarp on with its core, the 29th's edge walked back. This was the last job; it loaded with no console errors.

I was asked to wind down before the final day/night/rain/TV set, so there is no `rF-*` set.

## Cost

Draw and triangle counts are `JSON.stringify( __app.engine.meshRenderer.stats )` from the desk jobs. I didn't profile (the coordinator's job). **There is no clean "before" number:** the first job's printout was lost, and I was asked to stop before re-measuring the base.

| Shot | Draws | Triangles | Pipelines |
|---|---|---|---|
| TV high, 30 s after the last out (scoped: rituals, field, details, players, rail, bowl, landmarks, phanatic) | 454 | 4.89 M | 321 |
| TV high, 170 s after, the stage up (same scope, before the finished stage was merged) | 711 | 4.94 M | 338 |
| The full park, God Bless America wide, 29th | 786 | 6.05 M | 661 |

- **Suspension GPU.** Outside the celebration, the rituals add the roll (1 draw), the cover heap (1) and the crew on the players' rig (instances of its one draw).
- **Celebration GPU:**
  - the fireworks are 1 additive draw while they run;
  - the stage merges to about 5 draws once it's up, only its deck casting shadows;
  - the Camaro is 5 draws and the trophy 3;
  - the Cast troupes are in P0's pool;
  - the bikes are 1 instanced draw.
- **CPU:**
  - posing the replay in Node: the suspension ~0.08 ms a frame, the pile ~0.1–0.2 ms, the rest ~0.06 ms;
  - the rig's skinning grows with the people on the field (up to ~40 in the celebration);
  - the rig's slots peak at 59 of 96: the rituals' people give theirs back when they're off;
  - Crowd.vacate refreshes cost ~15 ms each, about 17 times across the suspension (see Unfinished).

## Unfinished and ideas

- **The roll's path from the wall onto the grass isn't photographed.** The swing-out is a simplification. The photos show the roll pushed from the left field corner along the grass edge behind the infield, with a folded strip laid out.
- **Not found:**
  - Dan Baker's words for any of it (I've suggested two lines to S);
  - any music or chants in the delay;
  - the exact spot of God Bless America, and whether the lineups were introduced on the 29th;
  - whether confetti fell (streamers of paper do show on the outfield grass in Getty 83570999: see below).
- **Not built:**
  - The between-innings infield drag at CBP in 2008 isn't documented, so I didn't invent one. The crew rake and drag on the 29th before the resumption instead.
  - The MVP trophy itself (Hamels gets the interview, not a prop).
  - Champagne sprayed on the fans (Getty 83486414, Jenkins).
  - The Victorino family's leis (pompomflipflop 2985514327, puffygreenjacket 2993502271).
  - The streamers and clothes fans threw onto the track (Getty 83486531: jerseys handed down to a motor officer; 83570999: white streamers on the right field grass).
  - The families on the field.
  - The crowd's own flashes.
- **Crowd.vacate refresh.** Each step rewrites every fan's flag, about 15 ms with B's test, and there are about 17 steps across the suspension. A `Crowd.thin( k )` uniform in Crowd.js would make this free; that's the coordinator's call.
- **People's CPU.** The rituals' Cast troupes step only while their moment is on. They could use H's `Tempo` after the merge.

## Noticed elsewhere

- **Crew chief:** W4's and the old comments say Tschida was crew chief. It was **Tim Welke**; the plate umpire in Game 5 was **Jeff Kellogg** (MLB.com, SABR, the international feed's caption).
- **First pitch on the 27th:** the Alley's clock starts at 8:38. Retrosheet and the Inquirer give **8:30**. 8:37 was the scheduled resumption on the 29th; play actually resumed at 8:40.
- **The tarp's top is plain white, with no logos** (all photos); Details2008's pale grey is right.
- **Sandbags:** none are seen on the tarp's edges.
- **The Rays' relievers** wore navy hooded jackets with light-blue trim.
- **The towels on the 29th were white with a red square,** not red (research: AP, Flickr).
- **The CBP organ in 2008 was recorded, not live** (S found this too).

## What I'd keep working on

- **The roll's route onto the field.** The photos suggest it was pushed from the left field corner along the grass edge behind the infield, laying a folded strip, before the crew pulled the sheet toward home. That is worth a closer read of the storyboard frames and a proper path.
- **The final review set on the full park** (day, night, rain, TV) and a clean before/after measurement against `bb62637`. The base is extracted under the worktree's `.claude/qa/r/base` for exactly that; it's gitignored and can be deleted.
- **The celebration's small true things:** champagne on the fans (Jenkins), the leis, the streamers and jerseys thrown onto the track, families on the field, the crowd's camera flashes, and Hamels's MVP trophy as a prop.
- **The last research report** (the celebration) was still running when I stopped. It may date the presentation, say whether confetti fell, and give the pile's exact order; the `CEL` times should follow it.
- **A `Crowd.thin( k )` in Crowd.js** so the stands can empty and fill without the vacate rewrites.
- **The radio re-voiced for the longer delay** (S), so the track doesn't sit silent through it.

