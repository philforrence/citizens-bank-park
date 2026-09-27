# The PA (Dan Baker's lines)

Every clip here is synthesized speech, not a recording of Dan Baker or of the 2008 PA. They are voiced offline by
`tools/audio/build-pa.py` from the lines in `tools/audio/pa-lines.json` (`node tools/audio/pa-lines.mjs` writes it
from the soundscape's plan):

- **Voice:** [Piper](https://github.com/rhasspy/piper) (MIT) with `en_US-mike-medium`, trained on a CC0 dataset
  ([OHF-Voice voice-datasets](https://github.com/OHF-Voice/voice-datasets); the model card says "License: CC0").
- **Delivery:** a WORLD vocoder pass ([pyworld](https://github.com/JeremyCCHsu/Python-Wrapper-for-World-Vocoder),
  MIT) draws the announcer's pitch and timing on it (the code is `tools/audio/build-home.py`'s `call()`), then a PA
  microphone's band and presence. The park's echo is added in the browser (`src/ballpark/places/sound/PA.js`).
- **Words:** the batters in Baker's own form, number, position, name (PhillyVoice, 2017), and the rest as described
  in `docs/notes/worlds/S.md`, including which announcements are documented and which are invented.
- **Numbers:** as worn in 2008 (Baseball-Reference): Madson 63 and Hinske 32, where the game data has later ones.

Each take was checked by transcription (faster-whisper, `--pick` keeps the first take whose name is heard right).
