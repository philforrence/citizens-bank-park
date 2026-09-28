# S: the park's whole soundscape (wave 3)

**Branch:** `worktree-agent-ace87180a8e7a2151`. **Place:** `sound` (`src/ballpark/places/Soundscape.js`, its parts in `src/ballpark/places/sound/`). It draws nothing.

This is what you'd hear standing in Citizens Bank Park on October 27 and 29, 2008, wherever you stand, on the replay's clock: Dan Baker at the mic, the music the booth played, 45,940 people following the game, the rain and the wind on the roofs and flags, the grounds crew, and the rooms you walk through.

It starts with the audio on the first click (`GameSound.resume`) and goes silent with the HUD's sound switch (GameSound's master). Per frame it walks a timeline pointer and nudges a few levels. Where you are is worked out four times a second, and everything it synthesizes is made in a worker.

## The modules

| File | What |
|---|---|
| `places/Soundscape.js` | The place: builds the parts when the audio starts, walks the timeline, the hooks (`pa.say`, `sfx`, `at`) |
| `sound/Plan.js` | The night laid out from `director.segments`: the PA's lines, the music, the crowd's moments, the umpire, the crew, God Bless America. Pure; Node builds it |
| `sound/Space.js` | Where you are for the ear: the open bowl, under a roof, shut away, outside. Sets the reverb's two rooms, the buses' tone and every positional sound's air |
| `sound/PA.js` | Dan Baker's clips out of the roof's speaker clusters and the scoreboard, with the bowl's echo; a ceiling speaker under a roof |
| `sound/Organ.js`, `Tunes.js` | A tonewheel organ (PeriodicWave drawbars, key click, percussion, Leslie); public-domain tunes and original riffs |
| `sound/Band.js` | A studio band in Web Audio: the walk-ups, the entrances, the between-innings rock, as original stand-ins |
| `sound/Music.js` | Schedules the organ and the band a quarter second ahead; ducks under Baker |
| `sound/Fans.js` | The crowd: the murmur, the roar, the swells, the claps, the chants, the hush, the singing, the fans near you, the concourse's talk |
| `sound/Weather.js` | The rain on the roofs, the ponchos and the tarp; the wind, the flags and halyards; the grounds crew; your footsteps; the horns and fireworks after |
| `sound/Recipes.js`, `Synth.js`, `synth.worker.js` | The synthesized sounds (pure functions), made in a worker |
| `sound/dsp.js` | Noise, filters, the rooms' impulse responses |
| `sound/Meter.js` | QA: plays a stretch of the replay with meters on every bus (through the desk's js) |
| `tools/audio/pa-lines.mjs`, `build-pa.py` | Baker's lines from the plan, voiced (Piper + WORLD) |
| `tools/audio/build-fans.py` | The crowd's voices: sung onto a beat grid and stacked (the chant, the boos, the stretch...), the shouts, the umpire, the crew |
| `test/soundscape.mjs`, `test/webaudio-stub.mjs` | The whole night on the CPU with a stand-in Web Audio |

## The changes

1. **One soundscape for the whole park, on the replay's clock.** A place (`sound`) that builds when the audio
   starts. The night is laid out once from the Director's segments (`Plan.js`: ~550 moments), and each frame walks a
   pointer through it. Everything is a function of the replay's time: a jump cuts what's playing (the PA, the music,
   the crowd's one-shots, the Phanatic's organ) and fires nothing. It follows R's longer suspension (140 s) and
   celebration (~300 s) by their durations. At 2x and up, the PA and the music keep quiet. Cost: 0.013 ms a frame in
   the browser; its synthesized sounds are made in a worker. *(Invention: the architecture.)*
2. **Where you are, for the ear** (`Space.js`): the open bowl, under a roof (the concourse under the suites'
   deck, the club level), shut away (a dugout, a tunnel), outside (the plaza, the lots, darker with distance
   from the facade). It reads OSM's footprint, the rain cover's map and the concourse level you stand on. The
   park's reverb (everything sends to it) becomes two rooms: the open bowl's long dark tail with the far stands'
   slaps a fifth to half a second later, and a roofed space's short dense one. The crowd, the field and the weather
   buses are darkened and turned down by where you are. **Every place's positional sound** (the vendors, the
   Phanatic's four-wheeler, B's and C's calls) gets an air filter: the highs fall away with distance, and a
   wall's worth through the facade. *(Common sense; the rooms invented.)*
3. **Dan Baker at the mic** (`PA.js`, 44 lines): every batter of the replay in his own form, "Now batting,
   number twenty-six, second baseman, Chase... Utley", with "Leading off for the Phillies..." for the first man up.
   The Phillies' names are slowed and sung up with a beat between first and last; the Rays' are read straight.
   Also the pinch hitters and runners and the seven pitching changes. The voice is Piper's CC0 "mike" given his
   cadence by a WORLD pass. Names Piper got wrong are given as IPA, and each take was checked by transcription.
   *(Evidence: his format and delivery; the voice invented.)*
4. **The park's speakers:** the clusters under the upper roof's truss (Bowl.js's cabinets) and the scoreboard's.
   You hear the nearest first, its neighbours after, and the far side of the bowl as an echo; under a roof there's
   the little ceiling speaker over your head too, and outside it all comes over the facade. The music and the
   Liberty Bell's toll come out of them too. *(The cabinets: Bowl.js; the rest common sense.)*
5. **The PA's night:** the welcome, the between-innings business (fouls, wet stairs, don't throw anything, the
   attendance, 45,940), the rain delay and the suspension ("...resume from this point, with the Phillies coming to
   bat in the bottom of the sixth inning. Please drive home safely."), the welcome back on the 29th, God Bless
   America's introduction (Navy Petty Officer Dorcus Whigham) and the champions. *(Evidence for the facts; the
   words invented in his register.)*
6. **The 2008 numbers:** Madson wore 63 and Hinske 32 (Baseball-Reference). The game data has 46 and 11, so the PA
   says the right ones, and the jerseys should change too (flagged below). *(Evidence.)*
7. **The booth's music** (no live organ in 2008): a tonewheel organ (`Organ.js`: drawbars, key click, percussion,
   Leslie) playing public-domain tunes between innings ("When the Saints Go Marching In", "The Entertainer", "Oh!
   Susanna", "Camptown Races", "La Cucaracha", "Yankee Doodle", "Rain, Rain, Go Away" on the 27th). It also plays the
   stings between pitches ("Charge!" and the park yelling it back, the "Let's go Phil-lies" riff the park chants
   back, the clap-along, the chromatic climb on two strikes), "Jingle Bells" after Feliz's hits (the booth played
   "Feliz Navidad"), a swing blues for the Rays' pitching changes, and a hymn's chords under God Bless America (no
   tune). *(Evidence: no organist, recorded music, the Feliz joke; the tunes chosen.)*
8. **The walk-ups as original stand-ins** (`Band.js`, a studio band in Web Audio). Each piece takes the style and
   tempo of the 2008 list, never a melody: Utley's slow orchestral march, Rollins's R&B, Burrell's 80s synth rock,
   Werth's hard rock, Victorino's one-drop reggae, Howard's boom-bap, Hamels's picked riff, Latin for Feliz, Ruiz and
   Romero, Lidge's pounding entrance, rock for Jenkins and Madson. Between innings, rock and party funk take turns
   with the organ, and an arena anthem stands in for "We Are the Champions". The music comes up as the batter leaves
   the on-deck circle and ducks under Baker. *(Evidence: the list; the music invented.)*
9. **The crowd follows the game** (`Fans.js`). The murmur shifts with the inning and the weather: the 27th hunched
   in the rain, emptying once it's called, the 29th filling and on its feet before the first pitch. A recorded roar
   rises with the count: two strikes, two outs, the 9th. Cheers, groans and "ooh"s answer every hit, run and
   strikeout, "aww"s a two-strike ball; boos go to Longoria and Upton, the called third strikes and the suspension.
   The park holds its breath before the 9th's big pitches, the rally towels whoosh on the 29th, the ponchos rustle as
   people get up on the 27th, and the odd brave Rays fans cheer from their corner. *(Evidence: "Eva", the towels, the
   two-strike roars, the few Rays fans; the rest common sense.)*
10. **Many voices at once** (`tools/audio/build-fans.py`). Piper voices are sung onto a beat grid (each syllable's
    vowel on its beat, at a note) and stacked, men and women, near and far, a little off. That gives "Let's go
    Phil-lies!" and its claps, started in one section and taken up round the bowl (heard from where each section
    is, the far side late), "CHARGE!", the boos, the "aww", and **the whole park singing "Take Me Out to the Ball
    Game"** at the stretch on the 29th, on A's organ's melody and tempo. *(Evidence: the crowd-participatory
    stretch; the chant inferred.)*
11. **The people near you:** in the seats, a shout now and then by who's up or pitching ("Eva!" at Longoria, "Come
    on, Cole, one more!", "Let's go, Brad!", "Upton, you bum!", "We did it!"), a two-finger whistle, a pair of hands
    clapping beside you. In the concourses, the talk of a packed concourse (the 27th "six or seven deep" out of the
    rain, the 29th keyed up), and on the 29th, before the resumption, the concourse stamping its feet to keep warm.
    *(Evidence for the concourses; the words invented.)*
12. **The field:** the plate umpire's calls from behind home ("Stee-rike!", the third one sold, "Foul ball!",
    "Time!", "Play ball!"). The bat and the mitt come from home plate, late by the time sound takes to reach you (in
    step through FOX's cameras). *(Common sense.)*
13. **The weather on the ear:** the recorded rain in the open and past the edge of a roof; the steel roof over the
    upper deck drumming; the concrete decks shedding it off their edges; the ponchos round you spattering; the tarp
    drummed while it's down. Both nights' wind (the 27th's NNW gusts to 22-25 mph, the 29th's colder west wind)
    comes in gusts, stronger up high, with the flags cracking and the halyards clanking behind center field. Your
    footsteps splash on the 27th and are dry on the 29th. *(Evidence: PHL's weather record and the press.)*
14. **The grounds crew and the tarp, on R's times:** the roll swung out off the third base side and pushed across the
    infield (the core's rumble, the vinyl dragging and slapping, "Let's go, let's go!", "Pull it!"), the edges walked
    square in the wind, the core rolled off; on the 29th it's wound back up, then rakes, hoses, the drag mat and the
    tamper. **God Bless America** on the 29th: the park silent under the organ's chords, then the roar. *(R's
    research for the times; the sounds invented.)*
15. **The last out:** the hush, the pitch, the roar that doesn't stop, the towels, the Liberty Bell ringing out of
    the speakers, the organ's fanfare, Baker, the anthem. Outside, car horns start up round the lots, and fireworks
    go up over the rowhouses (after R's own over the outfield). And `sfx()` gives R's motor officers and
    photographers their sounds. *(Evidence: the roar, the song, the bell, the fireworks, the horns.)*

## What the record says, and what's invented

The references are in `.claude/ref/sound/` (33 files, `SOURCES.md` indexes them). **C** = a 2008 or primary
source; **I** = inferred; **invented** = where the record is silent.

- **Dan Baker's form** (C: PhillyVoice 2017, his own words): "Number 12, second baseman, Mickey Morandini":
  number, position, name. "Leading off for the Phillies, number 10, shortstop Larry Bowa!" for the first man up
  (IBWAA, 2023). Long names "lend themselves to a more melodic interpretation"; a fan's rendering of his Utley:
  "Chaassseeee Utttleeeeeyyy". The visitors: "I just try to do it straight." He doesn't shout. Pitching changes,
  pinch hitters and runners: no transcript found; by analogy (I).
- **The suspension** (C): tarp at 10:40 pm, suspended 11:10; an announcement about ten minutes later told fans they
  were done for the night; "a collective groan"; fans huddled in the corridors. Baker's exact words aren't recorded:
  `suspended` and `rain-delay` are invented, in his register. **The resumption** (C): "The Phillies will be coming
  to bat to start the bottom of the sixth inning with the game tied, 2-2" (the club's release): `welcome-29` builds
  on it.
- **Music** (C): no live organ at CBP in 2008 (Paul Richardson retired after 2005 and died October 2, 2006; the live
  organ came back in 2018). The music was recorded, run from the booth. So the organ here is the booth's recorded
  organ clips (I), and between innings recorded rock takes turns with it. The 2008 walk-up list "as provided by the
  Phillies' organization" (Utley "Kashmir", Rollins "Girls All Around the World", Burrell "Dirty Laundry", Werth "Heavy
  Metal", Victorino Marley, Howard rap, Hamels "Thunderstruck", Lidge "Soldiers") sets each stand-in's style only.
  Feliz's hits got "Feliz Navidad" (C): here the organ's "Jingle Bells" (1857). "We Are the Champions" blared after the
  last out and 45,000 sang it (C): here an original anthem.
- **God Bless America on the 29th** (C): no anthem that night; Navy Petty Officer Dorcus Whigham sang it before the
  first pitch. **The stretch on the 29th** (C): "a crowd-participatory rendition of 'Take Me Out to the Ball Game'".
- **The crowd** (C): Longoria heckled as "Eva"; the Rays booed in the introductions; few Rays fans; rally towels,
  a "wave of white"; nobody sat on the 29th; the two-strike roars building pitch by pitch; the concourses "six or
  seven deep" on the 27th; the 29th's fans "stamping their feet, trying to stay warm" on the concourse; "an enormous,
  unceasing jet-engine roar" at the end; horns and "Let's Go, Phillies" on Broad Street; fireworks over South
  Philadelphia at 9:58. The "Let's go Phil-lies" chant in the park and its clap pattern are inferred (I).
- **The weather** (C, PHL's ASOS record and the press): the 27th, 45 F falling to 41, NNW wind ~15 mph gusting 22-25,
  light rain turning to a downpour, "slashing winds", flags "starched"; the 29th, dry, 42-44 F, a W wind 10-20 mph.
- **The park** (C): the Liberty Bell sways and rings after home runs and wins, "its ring can be heard throughout the
  park"; Baker's booth on the Hall of Fame Club level. The PA's speakers: the roof truss's cabinets as Bowl.js models
  them, and the scoreboard's (I).

## People

No one is named. The voices are anonymous on purpose: the fans near you are whoever sits round you, the crowd's
voices are stacked strangers (no CAST.md entries). The real people are Dan Baker (his words and form; the voice is a
CC0 TTS voice, not his, and the credits say so), the players by name and number, and Navy Petty Officer Dorcus Whigham,
named in the PA's introduction as the Inquirer reported.

## Measured (the render desk, `sound/Meter.js`)

- **Cost:** 0.013 ms a frame in the browser (300 updates timed in the page), 9.5 ms once when the audio starts;
  the synthesized sounds are made in a worker; nothing is drawn. **Draws and triangles: unchanged** (the place's
  group is empty): 59 draws, 1,993,233 triangles, 69 pipelines in `only=sound,field,players`, with or without it.
- **Levels** (dB RMS, the master, seats behind home): the murmur -31; Utley's walk-up at -11 before the trims
  (the band has since come down 10 dB); Baker -12 to -22 over it; two strikes, two outs in the 9th -16 to -20;
  **the hush before the last pitch -27 to -30; the last out -13**; the stretch's singing with the organ -13.
  Peaks now under -1.7 dBFS (the stretch had clipped at +0.2 before the limiter was tightened).
- **Zones** (the cover map read in a full scope): the open seats "bowl"; the club and terrace concourses "roof";
  the dugouts "roof"; the plaza and the lots "outside". The main concourse now reads "roof" from its level (the map
  keeps the top of what's overhead, the upper roof); this last fix wasn't re-measured (the wind-down).
- **Screenshots:** the desk's shots are only the scoped scenes the meters ran in (nothing of mine is visible):
  `.claude/qa/desk/s-zones.jpg`, `s-utley.jpg`, `s-last.jpg`, `s-stretch.jpg`, `s-plaza.jpg` (local).

## Shared files touched (all small, in `// ---- S` blocks)

- `game/GameSound.js`: one reverb input for the rooms; `play( name, { bus } )` and the buses (organ names to the
  music, cheers to the crowd); `play()` returns its source; the music's one-shots kept (cut on a jump); the hooks
  for `cheer`, `organ`, `celebrate` (delegated when the soundscape is there); an air filter on every `spot()`;
  `onLoaded`.
- `BallparkApp.js`: one line, `this.rainCover = cover`.
- `LibertyBell.js`: its toll out of the PA's bus.
- `places/index.js`: the `sound` place registered.
- `package.json`: `npm test` also runs `test/soundscape.mjs`.
- `CREDITS.md`, `tools/audio/README.md`: sections appended.

## For the merger

- **R's timeline:** the plan reads the suspension and the celebration by their durations and R's 0.55 split; the tarp's
  and the crew's sounds are on R's times (ASK-R.md), God Bless America at 40-58 s into the 29th's part. At the merge,
  check `plan.tarp` against R's `TarpPlan.js` and swap in R's roll path if it exports one. R makes the park's
  fireworks (asked to use `app.sound.spot`); mine are far-off ones from 60 s. R can use `app.soundscape.sfx()`.
- **The numbers:** `build-game.mjs`'s table should give **Madson 63 and Hinske 32** (2008, Baseball-Reference); the
  jerseys show 46 and 11 now. The PA already says 63 and 32.
- A desk job of mine (offline renders of the band and organ for spectrograms, and a zone check) was already waiting
  on the GPU lock when the wind-down came; the desk has no cancel, so it'll run once (about a minute, two frames).

## What I'd keep working on

- **Listen to it.** Everything here was judged by meters, transcription and spectra, not by ear: the balance of
  the PA, the band and the crowd, the band's stand-ins as music, the organ's registration, the crowd's chant and
  the stretch's sound need a person's ears and a round of trims.
- Re-measure the main concourse's zone and the mix after the last trims (the band -10 dB, the organ +3, Baker -3).
- The band's pieces: more variety per player (intros and endings), and a mix pass; a real drum kit's samples
  (CC0) would lift it.
- The PA: a few more of Baker's lines (the lineups, the presentation on the stage when R's times are in), and a
  closer match to his cadence against the 2008 FOX broadcast (YouTube IDs in `crowd_youtube-fanvideos_2008-10.txt`).
- The crowd singing along to the anthem stand-in at the end ("oh"s); the chant's section spread tuned to the
  bowl's real section angles.
- Occlusion between zones for the places' own sounds (a spot on the concourse heard from the seats).

## Wanted from the owner

- **Audio of the nights**, for reference only: the FOX broadcast of Game 5 (both nights) or fan videos from the
  stands, to match Baker's cadence and the crowd's level and texture; anything of the park's 2008 PA.
