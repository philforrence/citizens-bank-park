# A: the Phillie Phanatic, all over the park, all night

Branch: `worktree-agent-a8047b44130fed83a` (on top of `02db415`). The place is `phanatic` (`?only=phanatic,...`): `src/ballpark/places/Phanatic.js`, with its parts in `src/ballpark/places/phanatic/`.

He's one slot of the players' rig (`game/Players.js`, `KIND.phanatic`), and his night is a plan laid against the replay's timeline: a list of acts, each a stretch of `director.t` with where he is and what he's doing as a function of the time into it. `plan.at( t )` is pure, so scrubbing, any camera and any frame order agree, and every moment of the 57-minute replay belongs to one act (walking between places is an act; so is being out of sight in the tunnels).

| file | what |
|---|---|
| `Phanatic.js` | The place: the rig slot, the vehicles, the props, the squad, the little Phanatic, the handler, the sounds, the hooks. |
| `phanatic/Night.js` | His night, act by act, tied to the replay's segments. |
| `phanatic/Plan.js` | Acts over time: `walk`, `hold`, `hide`, `add`, cues; `at( t )`. |
| `phanatic/Ways.js` | Where he can go: the warning track, the roofs and the steps behind the dugouts, the aisles, the concourse ring, the Alley. |
| `phanatic/Moves.js` | His motions in the rig. |
| `phanatic/ATV.js`, `Gator.js`, `Launcher.js` | The four-wheeler; the hot dog launcher's Gator; the hot dogs and the aim. |
| `phanatic/Props.js` | The sou'wester, the chef's toque, the 2008 banner, the popcorn, the party blower (on his bones, solved on the CPU). |
| `phanatic/Squad.js` | The ball girls who danced with him in the rain. |
| `phanatic/Tracks.js` | His wheels' tracks in the clay and the grass. |
| `phanatic/Sounds.js` | The organ's cues (synthesized) and the recordings. |

## References

About 130 files in `/Users/phillipforrence/citizens-bank-park/.claude/ref/phanatic/`: each image has a `.txt` beside it with the URL, the caption, the date and what it shows, plus `web-*.txt` notes for text sources (the richest is `mainlinetoday-2008-07-10-that-phanatic-pheeling.txt`). Getty images are the public watermarked previews; most Flickr photos are all rights reserved (private reference only). The ones that decided things:

- **Getty 83477166** (Chuck Solomon, SI) and **pompomflipflop 2980921474** (10:18 pm on the 27th): the ball girls dancing with him in the rain; his red vinyl slicker and sou'wester.
- **flickr 2598893736, 2651835254, 2426733500, 2817490595; Getty 83088147, 83835784:** the red Honda FourTrax Recon and its decals, the PHANATIC plate.
- **flickr qparker71 2842323072, hazboy 2851422456, visitphilly 2401025331; Getty 577674176:** the hot dog launcher on the green John Deere Gator; the Inquirer (Sept. 25, 2008) on the wrapping.
- **Getty 83434999, 83364430, 83151540:** the dances on the Phillies' roof in the 2008 postseason; **Getty 83477241** (Oct. 27): the hex's arms-out pose.
- **Getty 83838048, puffygreenjacket 2993483573** (9:23 pm on the 29th): the kid in the little Phanatic costume, ROLLINS 11; the party blower.
- **Getty 83434489, flickr 2977160292** (Game 3): the popcorn along a row.
- **flickr 2990889488, 3006436555** (29th pregame): out on the four-wheeler, taunting the Rays.
- **Getty 83486412, 83486112, 83570904; pompomflipflop 2986877513** (9:59 pm): the run for the pile; the 2008 banner.
- **flickr 2988583768** (9:14 pm on the 29th): dancing on the Phillies' roof in the 7th.

**Two findings for everyone:** the Phillies' dugout is the **first base** one (in front of 115–118), the visitors' the third base one (129–132), as the code has it; and in 2008 the hot dog launcher rode a **Gator**, not his four-wheeler.

## The changes

E is evidence, I invention, C common sense.

1. **His whole night on the replay's clock** (`Night.js`, `Plan.js`, `Ways.js`). The big bits in the 24 s half-inning breaks; through the innings he works the crowd on the main concourse ring, down the aisles into sections, in Ashburn Alley, and is out of sight in the tunnels between (about a third of the night, as a mascot would be). His routes are real paths: the warning track, the steps down the aisle behind the Phillies' dugout onto its roof (the section's first rows are its roof), the aisles row by row, the concourse ring, the Alley's promenade. E: the routines, the roof, the stands visits; C: the routes; I: the schedule where the record is silent (see the table in the shared NOTES-A.md, and `plan.acts`).
2. **His motions** (`Moves.js`), in the rig's style (functions of time, the mocap gaits underneath): the waddle (wide, toes out, rocking over each foot, leaned back behind the belly), a scamper, the belly shake (the belly itself jiggles: the look's belly packed per frame), the belly bump, four dances strung together by bars, waving, pumping the crowd up, pointing, **the hex** (feet wide, knees bent, both arms thrust at the pitcher, fingers shaking; E: Getty 83477241, "the whammy"), teasing, mimicking the pitcher's delivery (the mocap delivery, then he falls over his belly), riding and standing on the footrests (E: flickr 2979451717), the launcher's aim and recoil, the smooch on a bald head, ruffling hair, high fives, posing for pictures, the stretch's sway (3/4), popcorn along a row, running with the banner, jumping for joy.
3. **His look as the October 2008 photos have it** (`Players.js`, A blocks). The fur to just under the knee, padded red leggings, a white sock bunched at the ankle, green high-tops with cream toes and soles, orange laces and stripes and the red P roundel (E). Before, his legs were fur and his shoes white.
4. **The red Honda FourTrax Recon** (`ATV.js`). Red plastics over a black frame; black tube racks front and rear; the brush guard and the two headlights (lit at night); the seat; silver steel wheels with four lugs on low turf-tread tyres; "Phillie Phanatic" in white script on the front fenders, a baseball on each fender top, RECON and HOME RUN! on the side panel, HONDA and a baseball on the rear fenders, the tail light, and the plate reading PHANATIC in red (E, all from the photos). Wheels roll by the distance, the front pair steers, it pitches and rolls over the track.
5. **The pregame lap** (t -2 to 15): round from center field to the right field corner as the Phillies take the field, waving to the Pavilion, out through the gate. E: the pregame ride; I: the direction and gate.
6. **The Phillies' roof** (after the top of the 1st, the middle of the 5th, the 9th): down the steps from the concourse, the wave to the section behind, pumping them up, the dance drifting along the roof and turning round to the field, the belly shake, the organ under it. E: the roof, "The Phanatic Dance"; I: which breaks.
7. **Into the stands** (four visits: aisle B behind home, 129–130, aisle A behind home, 131–132; and the concourse). A kiss on a bald head, a kid's hair ruffled, a picture, high fives; at 129–130 a box of popcorn held up and tipped along the row as he shuffles in (E: Game 3). His **handler** a step behind him in a red staff jacket, waiting at the foot of the steps while he's on the roof (E: his bodyguard in 2008, a real person, left unnamed). The four-wheeler **parked on the 1B concourse** between rides with a kid on it for a picture (E: July 2008).
8. **Ashburn Alley** (the top of the 2nd): Bull's, a picture with Greg Luzinski at his signing table and a belly bump, the kids at the rail over the pens. I.
9. **The hex from the Alley rail on the Rays' relievers** as they warm in their pen below: Grant Balfour in the bottom of the 5th (teasing, the hex, mimicking his delivery), David Price before the bottom of the 8th. E: teasing the visitors' pen; I: the rail.
10. **The rain dance on the 27th** (after the bottom of the 5th, 10:18 pm): out onto the foul grass in front of the Phillies' dugout in the knee-length **red vinyl slicker and sou'wester** (`ROLE.slicker` in Players.js; the hat in Props.js), and **eight ball girls** jog out with white towels and dance round him: pinstriped jerseys over red sleeves, pinstriped shorts (`ROLE.shorts`), their names over 08 on their backs, ponytails swinging, towels whirled (`Squad.js`, rig slots only while they're out). The board: RAIN DANCE!. E (Getty 83477166, flickr 2980921474, AP); I: their names and moves.
11. **The 29th before the resumption:** out of the left field corner on the four-wheeler across the grass, parked, up on the footrests at the Rays, out through the gate (E: flickr 2990889488, 3006436555).
12. **The hot dog launcher on the Gator** (after the bottom of the 6th on the 29th, `Gator.js`): the green John Deere Gator with yellow wheels in off the right field corner and down the foul grass, **Rob** driving and **Dwayne** beside him (Cast), him standing in the bed in a **white chef's toque** at the big hot-dog-shaped barrel with the Hatfield oval on a swivelling yoke, the giant hot dog in a bun with its mustard zigzag and the steam cut-out on the bed's side; three volleys aimed into 108–112 (the last up by the concourse), each hot dog wrapped in white paper and duct tape tumbling on its parabola, the air blast at the muzzle and the fans cheering where it lands; a U-turn and out. E: all the look; I: the inning (the 5th was usual; the 29th had no 5th) and the targets.
13. **The seventh-inning stretch and the hex on Howell** (29th): on the Phillies' roof, swaying the section through "Take Me Out to the Ball Game" on the organ (the whole chorus, synthesized from the 1908 melody), then he stays up for the bottom of the 7th and puts the hex on J.P. Howell (E: Wikipedia, the Ballpark E-Guides, flickr 2988583768).
14. **The little Phanatic** (after the bottom of the 7th, 9:23 pm): a toddler in a mini-Phanatic costume, ROLLINS 11 on the back, held up by his dad by the painted World Series logo; the Phanatic snout to snout with him, a red and white party blower shooting out of his snout (E: Getty 83838048, puffygreenjacket 2993483573; I: the names). The kid is a rig slot a third of the size (Players.js: a Phanatic can wear a name and number).
15. **The 9th and the last out:** on the roof getting them up with Charge on the organ; down at the foot of the steps through the top of the 9th; at the last out over the roof, down onto the track, across the grass for the pile, jumping round it; off to left-center; back in with the big red **2008 banner** on its wooden pole with the gold tip, the cloth waving, round the infield and down the lines (E: Getty 83486412, 83570904; pompomflipflop 2986877513).
16. **The board, the cameras, the tracks, the sound.**
    - **Phanavision** (A blocks): while he's out in a break the video board's on him with a caption (THE HEX!, DANCE!, RAIN DANCE!, HOT DOGS!, STRETCH!, PHANATICS!, MAKE SOME NOISE!).
    - **The rail's cameras and photographers** swing onto him when he's out near them between plays (FieldRail/Wells A blocks). E: the Getty pictures are theirs.
    - **Tyre tracks** (`Tracks.js`): the four-wheeler's in the wet clay of the track on the 27th (raked out with the tarp) and across the left field grass on the 29th, the Gator's down the right field line; each bit appears as the wheel passes. E: "all of those tire tracks he leaves in the grass" (2009), flickr 2980316108.
    - **Sound:** the four-wheeler's engine and the Gator's follow them (a CC0 ATV recording, faster as they open up); the launcher's air blast (CC0) over a synthesized whump; a small crowd close by cheering (CC0) where he stops, where the popcorn spills, where the hot dogs land; the organ: a Wrigley organ riff (CC0) when he first comes out, an original bouncy dance riff, a spooky diminished chord under every hex, a run up the keys for the belly shake, Take Me Out, Charge. Credits in `public/audio/places/phanatic/CREDITS.md`.

## The people (invented, in CAST.md)

- **The ball girls' squad:** Brianna, Kristen, Dana, Lauren, Tara, Renee, Alyssa, Colleen.
- **Rob Iacono,** 38, South Philly, promotions staff, drives the Gator; **Dwayne Mitchell,** 27, Mount Airy, beside him.
- **Chris Dunleavy,** 29, Fishtown, holding up his son **Aidan,** 2, in the little Phanatic costume.
- **Frank Bianchi,** 44, Delran NJ, taking a picture of his daughter **Sophia,** 6, on the parked four-wheeler.
- His handler (a real person in 2008) and the man inside (Tom Burgoyne) are left unnamed.

## Screenshots

In the worktree's `.claude/qa/desk/`:
- `a1-*`: the first pass (the lap, the roof, the stands, Bull's), scoped.
- `a2-*`: the rain dance, the Gator, the little Phanatic, the banner, the stretch, the hex, the popcorn, the Alley hex, the parked four-wheeler with Frank and Sophia, the 29th's ride; scoped, night.
- `a3-*`: Phanavision on him (`a3-board-112`), the pile on TV (`a3-tv-cel-3362`), the wells.
- `a4-*`: **the full park, no console errors**: the rain dance from the infield (`a4-rain-field-1926`), the tracks on the LF grass and the RF line (`a4-tracks29-2185`, `a4-gatortracks-2410`), the handler on the concourse (`a4-handler-180`), the TV shot (`a4-tv-112`), a day shot on the roof (`a4-day-roof-110`).
- `a5-*`: **the full park, no console errors**: the rain close up with the slicker, sou'wester and the squad (`a5-rain-close-1927`), the little Phanatic (`a5-blower-2799`), the Gator by day (`a5-day-gator-2380`). (The desk keeps a shot's `hour` for the ones after it, so `a5-night-*` and `a5-banner-high` came out by day.)

## Cost

- **First desk job** (scoped `only=phanatic,field,players,bowl,crowd,alley,landmarks`, the lap view): 302 draws, 5.63 M triangles, 267 pipelines.
- **Full park** (a4, the rain dance view): 790 draws, 6.00 M triangles, 614 pipelines (wave 1's full park had 598 pipelines: mine add about ten materials, most of them only drawn while their bit is on).
- **His own meshes:** the four-wheeler 5,566 triangles in 5 draws (parked on the concourse most of the night); the Gator 1,234 + its wheels in 6 draws (only on its run); the tyre tracks 5,028 in 1 transparent draw (hidden before the first ride); props, towels, ponytails and hot dogs 1 draw each only while shown; the Cast troupe (five people, P0's pool after the merge). He himself is one more instance of the players' draw.
- **CPU** (node, the whole replay stepped at 4 Hz): `update()` averages 0.01 ms, 0.15 ms at worst in the rain dance (the squad's bones solved for the towels and ponytails); compiling the night 3–17 ms once.

## Unfinished

- **The seated crowd round him doesn't get up** (Crowd.js isn't ours). Heads turn in the Cast people (P0's `lookAt`, after the merge), and B's and C's fans react off `app.phanatic.now`. For the coordinator: a `crowd.focus( key, { x, z, r, stand, arms } | null )` using the ripple uniform that's already there would let the fans within ~10 m stand and wave while he's in their section, on the roof, and where the hot dogs land.
- **The rail's ball girls Jess and Caitlin** stay on their chairs during the rain dance (their RailFigures have no dance pose); the squad are the others.
- **Not seen yet in a render:** the sou'wester up close, the party blower, the ball girls' towels and ponytails up close; the audio isn't heard in the headless desk (the buffers and spots are exercised in node).
- **His tail** (a blue tuft) isn't modelled.

## Noticed elsewhere

- **Section numbers:** `Concourse.sectionAt` puts about 110 behind the Phillies' dugout and 135 behind the visitors'; the 2008 seating charts put 115–118 and 129–132 there. Every section sign in the park is some four or five off round the dugouts.
- **The dugout sides are right** (W4 had flagged photo captions): the Phillies are on the first base side.
- **People.js's aisle guard** stands on the bottom step of the aisle behind the middle of each dugout (the steps that come out onto the roof), so the Phanatic brushes through him on his way down to the roof and back. Moving the guard to the aisle's side (or off the dugouts' middle aisles) would clear it.
- **The desk:** a shot's `hour` carries on to the shots after it in the same job (worth documenting in GPU.md, or resetting per shot).
- **The dugout roofs** in the 2008 postseason photos (the research's reading of Getty 83434999 and others): a white top with painted lettering, and a navy front band with citizensbank.com / Citizens Bank Park / neweracap.com panels. Worth comparing with Details2008's roofs.
