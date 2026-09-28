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

_(draft: the changes, evidence, people, numbers and screenshots are filled in at the end)_
