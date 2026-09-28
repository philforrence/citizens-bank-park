# Audio build (fishing sounds)

Rebuilds the fishing sounds in `public/audio/` from CC0 Freesound previews. Needs node and ffmpeg
(libopus). Nothing is synthesised: every sound is a real recording (sources and licences in
`public/audio/CREDITS.md`).

```sh
cd tools/audio
node search.mjs "fishing reel"          # CC0-only Freesound search: id:user duration downloads title
node dl.mjs 509902:tosha73 507070:paulprit 450849:kyles 371313:Mrthenoronha 725426:mwchristian95 \
  523282:MrFossy 464697:BranndyBottle 849752:JoelMcDaniel 537084:khenshom 507094:paulprit \
  507093:paulprit 649003:ramattahatta 570208:RatBird 336585:Anthousai
                                         # -> raw/<id>.ogg + raw/<id>.json (prints each licence; check CC0)
node build-fishing.mjs                   # -> out/*.ogg + fishing-bank.json
cp out/*.ogg ../../public/audio/         # then copy the entries of fishing-bank.json into src/audio/soundBank.js
```

- Loops (`reel_wind`, `reel_drag`, `line_strain`): excerpt, equal-power crossfade at the wrap, loudness-normalised
  to -23 LUFS integrated; `lufs` in the bank is the median momentary loudness.
- Sprites (all others): slices peak-normalised to -1 dBFS; `lufs` is each slice's maximum momentary loudness.
- The mixer (`src/audio/SoundScape.js`, `MIX`) turns target loudness into gains with those measurements.

`raw/`, `work/` and `out/` are build scratch (not committed).

# The ballpark's voices (Citizens Bank Park)

All Piper TTS (MIT) with only its CC0 and public-domain voices, through a WORLD vocoder pass, in a Python venv
(see `build-home.py`'s docstring for the setup; voices and caches live in `$CBP_HOME_AUDIO`, default
`/tmp/cbp-home-audio`):

```sh
node tools/audio/pa-lines.mjs                                  # Dan Baker's lines from the soundscape's plan -> pa-lines.json
CBP_HOME_AUDIO=/tmp/cbp-home-audio python tools/audio/build-pa.py --pick   # -> public/audio/ballpark/pa/ (takes checked by faster-whisper)
CBP_HOME_AUDIO=/tmp/cbp-home-audio python tools/audio/build-fans.py        # the crowd, the shouts, the umpire, the crew -> public/audio/ballpark/fans/
CBP_HOME_AUDIO=/tmp/cbp-home-audio python tools/audio/build-home.py        # behind home plate's vendors and fans -> public/audio/places/home/
```

`build-fans.py` sings voices onto a beat grid (each syllable's vowel on its beat, at a note) and stacks them into
crowds: "Let's go Phil-lies!" with its claps, "CHARGE!", the boos, the "aww", the whole park singing "Take Me Out to
the Ball Game" at the stretch (A's organ's melody and tempo), the concourse's talk.
