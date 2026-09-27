# Behind home plate: sounds

The place `home` (src/ballpark/places/BehindHome.js, home/Sound.js) plays these as sounds in the park (GameSound.spot).
All are CC0 or public domain; nothing needs attribution, and they are listed for the record. `tools/audio/build-home.py` rebuilds them.

- **Voices:** Piper TTS (https://github.com/rhasspy/piper, MIT), with only the CC0 and public-domain voices from huggingface `rhasspy/piper-voices` (licence from each voice's MODEL_CARD). They are turned into calls with a WORLD vocoder pass (pyworld): the stressed vowels drawn out, a sung contour, the pitch raised into a shout, hoarseness, saturation and compression. They are kept dry: the park adds distance and reverb.
- **Recordings:** CC0 Freesound previews, at https://freesound.org/s/<id>/.
- **Synthesized:** numpy and scipy.

| File | Source | What |
|---|---|---|
| beer-1.mp3 | Piper en_US-mike-medium (CC0) | "Beer here! Cold beer!" |
| beer-2.mp3 | Piper en_US-mike-medium (CC0) | "Bee-ah! Getcha beer here!" |
| beer-3.mp3 | Piper en_US-joe-medium (CC0) | "Who's thirsty? Beer here!" |
| hotdogs-1.mp3 | Piper en_US-john-medium (public domain) | "Hot dogs! Get your hot dogs here!" |
| hotdogs-2.mp3 | Piper en_US-john-medium (public domain) | "Hot dogs, hot dogs!" |
| peanuts-1.mp3 | Piper en_US-joe-medium (CC0) | "Hey, peanuts! Peanuts here!" |
| peanuts-2.mp3 | Piper en_US-joe-medium (CC0) | "Getcha peanuts!" |
| lemonade-1.mp3 | Piper en_US-ljspeech-medium (public domain) | "Lemonade! Ice cold lemonade!" |
| cotton-candy-1.mp3 | Piper en_US-bryce-medium (public domain) | "Cotton candy!" |
| cotton-candy-2.mp3 | Piper en_US-bryce-medium (public domain) | "Cotton candy! Cotton candy!" |
| hot-chocolate-1.mp3 | Piper en_US-mike-medium (CC0) | "Hot chocolate! Hot chocolate here!" |
| hot-chocolate-2.mp3 | Piper en_US-mike-medium (CC0) | "Hot chocolate!" |
| fan-beer-man.mp3 | Piper en_US-bryce-medium (public domain) | "Hey, beer man! Two here!" |
| fan-two-dogs.mp3 | Piper en_US-bryce-medium (public domain) | "Over here! Two dogs!" |
| down-in-front-1.mp3 | Piper en_US-john-medium (public domain) | "Down in front!" |
| down-in-front-2.mp3 | Piper en_US-kristin-medium (public domain) | "Down in front!" |
| kid-on-tv.mp3 | Piper en_US-ljspeech-medium (public domain) | "We're on TV! Mom, we're on TV!" |
| excuse-me.mp3 | Piper en_US-kristin-medium (public domain) | "Excuse me, sorry, excuse me." |
| usher-tickets.mp3 | Piper en_US-norman-medium (public domain) | "Can I see your tickets? Right down there, row 8." |
| seat-clack-1.mp3 | synthesized | A plastic stadium seat springing up against its iron standard (clack, rebound, frame ring) |
| seat-clack-2.mp3 | synthesized | An older, heavier seat: a lower clack, one rebound, a loose armrest rattling after |
| seat-clack-3-squeak.mp3 | synthesized | A seat with a creaking hinge, then the clack |
| peanut-bag.mp3 | Freesound 545532 rsellick (CC0) + synthesized peanut rattles | A paper bag of peanuts in the shell, rustled and shaken |
| coins-bill.mp3 | Freesound 413748 My Name Here (bill) + 235487 ekfink (coins), both CC0 | A crumpled bill and a handful of change handed over |
| poncho.mp3 | Freesound 663672 Solar01 (thin plastic bag) shaped by 658410 IENBA (raincoat movement), both CC0 | A clear plastic poncho crinkling as someone moves in their seat |
| camera-flash.mp3 | Freesound 85675 tmkappelt (disposable camera shutter, CC0) + synthesized flash-charge whine | A point-and-shoot's flash charging (whine), the shutter, and the flash recharging |
| flip-phone.mp3 | Freesound 69586 JamesOC (CC0) | A flip phone snapped shut (a Sony Ericsson W300i, 2006) |
| thank-you.mp3 | Freesound 770763 AquarianThunderProductions (CC0) | A woman: "Thank you!" |
