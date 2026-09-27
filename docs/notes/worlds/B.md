# B: behind home plate, the TV backdrop

Branch: `worktree-agent-aa87afb5710a62b13`, on top of `ballpark` at 02db415.

**The place:** `home` (`src/ballpark/places/BehindHome.js`). Its parts are in `places/home/`.

**Scope for work:** `only=home,bowl,crowd,field,rail,players&focus=0,25,45`.

**Why this place:** the center field camera (C, then "center") looks straight at it on every pitch.

## The files

| File | What it holds |
|---|---|
| `BehindHome.js` | The place: who sits where, the night's state, the update |
| `home/Seats.js` | The Diamond Club's seven sections and their seats (as the stands put them), the aisles, the crowd's vacate test |
| `home/Poses.js` | Sitting in a stadium seat and getting up out of it, and the seated gestures (Kit's IK) |
| `home/Fans.js` | The seated people: the crowd's mood, idle life, acts others give them, the head on the ball |
| `home/Dress.js` | The same person on the 27th (ponchos) and the 29th (knit hats, scarves, gloves) |
| `home/Regulars.js` | The people with names, their scripts, the signs they hold |
| `home/Aisles.js` | Vendors, ushers, the club's server, beer runs, the Pisanos' late arrival, the aisles kept clear for the Phanatic |
| `home/Club.js` | The ledge behind the pads and what's on it each night, the club's padded seats |
| `home/Backstop.js` | The green panel (FOX's virtual ads through the TV camera), the steel rail, the front row's camera and operator, the stations' placards over the booths |
| `home/Fouls.js` | Fouls into the net (the flinch), and a pop foul over it once a night |
| `home/Signs.js` | Poster-board signs (an atlas), held between the hands |
| `home/Gear.js` | The vendors' gear, a thrown bag of peanuts, the foul ball (one instanced draw) |
| `home/Blankets.js` | The 29th's blankets on laps |
| `home/Moments.js` | Shared moments: fans on TV, the Phanatic near, cameras up in the 9th |
| `home/Sound.js` | Sounds in place (`sound.spot`) |
| `home/Build.js` | The palette builder and material (per-night geometry folded away on the other night) |
| `tools/audio/build-home.py` | Rebuilds `public/audio/places/home/` |

## The changes

### 1. The Diamond Club as it was: seven sections, A to G
- **Evidence:** the 2008/09 phillies.com seating chart. Section A is by the visitors' dugout, D is dead centre and G is by the Phillies' dugout, with an aisle either side of D.
- **What changed:** the model had one 14 m section behind the plate. Now:
  - the backstop's face is C, D and E;
  - each angled face is two sections (B, A and G, F).
- **How:** `tier.splits` in `Stands.tierSections`, set in a B block in `Bowl._lowerTiers`.
  - Every section also gets a `pk`, its place in the default split, and `buildTier`'s portal rule uses it, so the portals everywhere else stay where they were.
- **Effect on the TV picture:** two aisles now run straight up behind the plate, at x = ±2.31, with vendors and people on them. That is what the 2008 broadcasts show.
- **Seat count:** the club's 18 rows hold ~1,190 seats. The 2008 guide says "1,258 extra-wide, padded seats".

### 2. The club's first four rows sit low behind the backstop's wall
- **Evidence:** the center field photos (Getty 83485455 and 83485581, Oct 29) and heston 2986440011 (Game 3) show the front row's heads level with the top of the steel rail over the pads.
- **Before:** the first tread was 1.2 m up, so whole seated bodies showed above the 4.5 ft wall.
- **Now:** the treads are at 0.72, 0.95, 1.18 and 1.41 m, climbing to meet row 5 at its usual height.
- **Scope:** this is `tier.rowY` (a B block in Stands and in Bowl), and it applies only between the dugouts' home ends. Rows 5 and up, and every other section, are unchanged.

### 3. The backstop as the TV saw it
- **The green panel:**
  - It sits on the first base side of the plate, 5 m wide and 10 cm proud of the brick.
  - A dark band along its top reads phillies.com, and a Van Wagner plate sits at its foot.
  - **Through the center field camera only,** it shows FOX's virtual ad for the half inning. The saved frames of the feed show RAMADA and Nikon on the 27th and WISER'S and TIPTOP on the 29th. That feed is the one seen in Canada; the US ads aren't documented.
  - From anywhere else, the panel is plain green.
  - **Evidence:** Getty 83457399 and 83485455; the FOX frames in `.claude/ref/home/`.
- **The steel rail** over the pads along the club's front, standing on the ledge, with balusters every 12.5 cm.
- **The camera in the front row** on the first base side of the plate:
  - it has a black rain cover on the 27th;
  - its operator is in a red Phillies cap, bent to the eyepiece (Getty 83485581);
  - it turns with the play;
  - its seats are given over to it.

### 4. ~250 people in the seats (Cast figures in the crowd's vacated seats)
- **Who:** the club's front rows in C, D and E (and B and F's first two rows), groups along D's aisles, and the named people.
- **What they do:**
  - They sit, and they get up when the crowd does (`Crowd.mood()`, each with their own threshold).
  - They clap, put their arms up, twirl towels, and bring out cameras for a Phillies run and the last out.
  - Their heads follow the ball in play, or the plate.
  - Between pitches they sip beer, hold a hot chocolate in both hands, text, keep score, eat, talk to their neighbours, fold their arms, and blow into their hands on the 29th.
  - In the 9th on the 29th they sit with elbows on knees and hands together.
- **What they wear:** the 27th's ponchos (from the Getty frames and the FOX feed: clear most of all, then yellow, red, white, orange and a trash bag) with hoods up. The 29th's knit hats, scarves and gloves. The same lucky jersey both nights.
- **Ticket lanyards** on the club crowd (a Cast B block; heston 2986440011). Kids have their gloves.
- **LOD:** it's chosen by the camera's zoom. The TV's 5° lens sees them from 150 m as if from 12 m, so it draws the far figure (968 triangles).

### 5. The named regulars (CAST.md), with scripts
- **Enza Palumbo** keeps score in her late husband Carmine's 1980 cap, front row, first base side of the plate, in the TV's picture. At the last out she puts her hands to her mouth, then looks up.
- **Harold Wexler** explains the Series to his son **Mark** between innings; at the last out Mark holds him.
- **Maureen Kelly** is on her flip phone to Boca, waving at the camera.
- **Dom Russo** has a sign for every few innings.
- **The Baptistes** share a blanket on the 29th and hug at the last out.
- **Bobby Cusack** gets up and yells at called strikes on the Phillies.
- **The Costellos:** Gianna spots herself on TV ("Mom! We're on TV!"); Matty stands on his seat.
- **The Villanova four.**
- **The Pisanos** (see 8).

### 6. Signs for the camera
- They are poster board, hand-lettered in marker, with pencil guide lines. They're held up between pitches while the Phillies are in the field, and at the big moments.
- **Documented wording** (Getty captions and FOX frames, Oct 27 and 29):
  - PHILS IN PHIVE; PHINALLY; 28 YEARS... WHAT'S ANOTHER DAY?; IT ENDS TONIGHT; PHABULOUS PHILLIES PHINALE; FOX 9 MORE OUTS; RAYS RAYS GO AWAY;
  - the DUE UP: 1 GAME 5½ / 2 WORLD CHAMPS / 3 BROAD ST. PARADE lineup;
  - at the last out: PHINALLY! 1980-2008; YO ADRIAN WE DID IT!!; WE ARE WORLD CHAMPIONS!
- **Ours:** RAIN? WE'RE FROM PHILLY, SUSPENDED... NOT DEFEATED, the 3/2/1 MORE OUTS countdown, HI MOM IN BOCA!, LIGHTS OUT LIDGE.

### 7. Vendors working the aisles
- **Who:** Jimmy (beer, 47), Kyle (beer, 112), Reggie (hot dogs, and hot chocolate on the 27th), Tina (cotton candy) and Luis (peanuts, thrown).
- **What they wear:** mustard-yellow shirts with big red numbers on the back (the 2008-09 photos; Cast atlas cells 56-59, a B block), and ponchos on the 27th.
- **Where and when:** they come down D's two aisles from the concourse to the club's back row, calling. The club itself had attendants ("to place order, signal your attendant", 2006 menu).
  - They stop where a hand goes up. The beer, dog or cotton candy passes along the row hand to hand, and the money comes back the same way.
  - A bag of peanuts is thrown in an arc.
- **Their gear** is one instanced draw: a steel bin with bottles and a sleeve of cups; a hot-dog box; a cocoa cooler with its tank; a peanut sack; the cotton candy pole.
- **The beer** is sold until the 9th on the 29th (the Inquirer, Oct 29).

### 8. Life in the rows
- **Beer runs:** someone a seat or three in gets up, the ones between stand to let him by ("excuse me"), and he goes up the aisle. A minute or two later he comes back with two beers (or a hot chocolate) and they stand again.
- **The club's ushers** (Earl and Carmen) stand at the top of the club's aisles. On the 27th they wipe seats with a towel.
- **The Pisanos,** late and soaked in the 2nd on the 27th: down aisle ED, the ticket out; Earl comes up to their row and wipes their seats; they squeeze in.
- **Megan,** the club's server: takes an order crouched at the row end, and comes back with it on a tray at her shoulder (beer through the 7th, then hot chocolate).

### 9. Foul balls
- **Fouls back into the net:** the club's rows behind it flinch.
- **A pop foul over the screen, once a night** (the replay's own ball, bound for the net, is hidden meanwhile):
  - **the 27th:** off Pete Kostic's hands and under the seats; Mo comes up with it.
  - **the 29th:** Sean Gallagher catches it barehanded, then leans down over the row between and gives it to Matty Costello, who is up on his seat. Matty holds it up and his father holds him. It stays in Matty's glove the rest of the night.

### 10. The big moments, the cold and the rain
- **Towels.**
- **Cameras:** flashes at Phillies runs and the last out, and cameras up in the 9th (the camera and phone are kept on Cast's far LOD so the TV sees them; a B block).
- **The last out:** people jump, and kids stand on their seats.
- **On TV:** a fan's flip phone rings ("you're on TV") and he waves at center field.
- **The Phanatic:** when he's near (`app.phanatic.now`), heads turn, kids get up on their seats, and cameras come out.
- **Breath** in the cold, and a wisp off every hot chocolate (W2's Steam, near the camera only).
- **The 29th's blankets:** fleece, plaid, grey and navy; the Baptistes share one; they're left in a heap on the seat when someone stands.

### 11. The ledge and the club's padded seats
- **The ledge** at the rail's foot holds each night's things:
  - hot chocolate most of all on the 27th, and a soaked rally towel;
  - beer, gloves and cameras on the 29th;
  - cups, water bottles, nachos, programs, a flip phone and peanuts.
- **The club's 18 rows** have navy vinyl pads on the pan and the back. They're darker and glossy in the rain.

### 12. The suites and booths: people, not pills
- **`figure()`** (Bowl's `interiorModule`, a B block) is now a person, not a capsule:
  - a head with ears, the hairline, eyes, nose and mouth;
  - a collar;
  - arms apart from the trunk, holding a drink, folded, or with a hand up;
  - legs and shoes;
  - shading that is darker toward the edges.
- It is used by every suite and booth.

### 13. The booths in their real order
- **Evidence:** a 2009 photo from below (yeago81 5247698087). From the first base side to third: the writers' press box, the TV booth (FOX in the Series), 1210 WPHT, the second TV booth (the Rays' radio here), Béisbol 1480 (WUBA), then ESPN Radio.
- **The PA announcer** is alone at his mic beside FOX. There was no organist in 2008: Paul Richardson retired in 2005, and the music was recorded.
- **Kalas** wears the red striped jacket he had on at the field before the resumption (the CSN frames of his call).
- **The stations' placards** hang over the windows: Comcast SportsNet, 1210 AM The Big Talker, my PHL 17, Béisbol 1480 AM.
- These are T8's booths remapped in a B block. The placards are my own meshes.

### 14. Sounds in place (heard within 45 m)
- **Voices:**
  - the vendors' calls (beer, hot dogs, hot chocolate, peanuts, cotton candy);
  - "Hey, beer man! Two here!" and "Over here! Two dogs!";
  - "down in front!" at Dom's sign;
  - "excuse me" and "thank you" on the runs;
  - the usher's "can I see your tickets?";
  - Gianna's "Mom! We're on TV!"
- **Small sounds:** seats' clacks, a poncho's crinkle, the change handed back, a bag of peanuts landing, a flip phone snapped shut, a flash whining up.
- **How they were made:** Piper TTS with only CC0 and public-domain voices, through a WORLD vocoder pass into hawkers' calls; CC0 Freesound and synthesized foley.
- **Checked:** every voice clip was transcribed back (faster-whisper). `peanuts-1` was rebuilt because its P was lost.
- **Files:** `public/audio/places/home/CREDITS.md`, `tools/audio/build-home.py`.

### 15. The aisles kept clear for the Phanatic
- A's plan (`app.phanatic.plan.aisles`) says when he's on an aisle. The vendors wait up top or turn back, and the runs wait.
- **Heads-up:** with the split, A's `aisleBySection( 124 )` picks D's third base aisle, so his home-plate visit comes straight down the TV's aisle.

## The people (CAST.md, B)
- Enza Palumbo.
- Harold and Mark Wexler.
- Maureen Kelly.
- Dom Russo.
- Andre and Simone Baptiste.
- Bobby Cusack.
- The Costellos: Paul, Theresa, Matty and Gianna.
- The Villanova four: Sean Gallagher, Pete Kostic, Mo Rahman and Rick Albrecht.
- Gary and Lorraine Pisano.
- The vendors: Jimmy Donnelly, Kyle Brandt, Reggie Timmons, Tina Maldonado and Luis Ortega.
- The ushers: Earl Whitaker and Carmen Ortiz.
- The server: Megan Sweeney.

The front-row camera's operator is unnamed.

## Screenshots (in the worktree, `.claude/qa/b/`, gitignored)
- **`steps/b1-*`:** before the club's rows were lowered (the whole seated bodies above the wall).
- **`steps/b2-*` to `b8-*`:** each step:
  - b3: the vendors and signs;
  - b5 and b6: the foul pop and the vendors close;
  - b7: the A-G split, the panel and the rail;
  - b8: the booths and the placards, and WISER'S on the 29th.
- **`final/`:** the full park, 1280 × 800, no console errors:
  - `final-tv27`: the TV center view on the 27th in the rain, RAMADA on the panel;
  - `final-tv29`: the TV in the 9th on the 29th, WISER'S, the police line;
  - `final-night-walkby`: from the concourse behind home, down D's aisles;
  - `final-day-walkby`: the same view in the day (hour 15);
  - `final-rain-club`: the club's front, the panel and the rail on the 27th;
  - `final-lastout`: the towels and the club's front;
  - `final-booths`: the booths and the placards.
  - After the hour-15 shot the desk kept hour 15, so `final-rain-club`, `final-lastout` and `final-booths` are in daylight.

## Counts
- **First desk job** (scoped `only=home,bowl,crowd,field`, TV center, 800 × 500, with the first version of the place): 144 draws, 1,822,580 triangles, 87 pipelines.
- **Full park, TV center, 27th, 1280 × 800, final:**

| | draws | triangles | pipelines |
|---|---|---|---|
| with the place | 533 | 6,452,609 | 609 |
| the place's group hidden | 523 | 6,195,520 | 609 |

  So the place costs 10 draws and about 257,000 triangles in the TV view. The club rail is merged into the stands' rails, so it isn't counted.
- **Measured in Node** (camera on the concourse behind home): 14 draws. They are:
  - the cast's three LODs and contact shadows;
  - things (ledge, items, pads: ~45k triangles);
  - gear, signs, blankets, panel, placards, camera, rail;
  - steam, shared with W2's.
- **Cast:** ~258 figures (250 seated, the vendors, ushers, server and camera operator).
- **CPU:** about 0.25 ms a frame in Node. After a jump in the replay the aisles run a 90 s warm-up once.
- **GPU:** not profiled (the coordinator's job). The cast's double-rigged vertex shader is the main cost: ~250 × 968 triangles in the TV view.

## References
- **Location:** `/Users/phillipforrence/citizens-bank-park/.claude/ref/home/`, 152 files, with `SOURCES.md` listing each one's URL, date and what it shows.
- **The most useful:**
  - Getty 83457399, 83485455 and 83485581 (Zelevansky's center field angle);
  - FOX frames of Game 5 with the virtual ads;
  - heston 2986440011;
  - the 2009 seating chart with A-G;
  - the Diamond Club's 2006 menu and ticket;
  - yeago81 5247698087 (the booths);
  - the CSN frames of Kalas's call;
  - adrianlee712's beer vendor.

## Unfinished
- **Diamond Club rows** behind the front five are Crowd.js fans except along D's aisles. The seats between the aisle groups are the crowd's.
- **Restocking:** the vendors don't walk to C's Hatfield Grill or draft cart. C offered spots.
- **Rays' families:** no section was found, so none were placed.
- **Booth interiors** stay T8's traced rooms. From the field you see mostly their ceilings.
- **The club's back walkway** (the chart's gap between the club and 122-125) isn't built; the rows run straight through.
- **Poses:** figures pass things with the hand on the passing side; there's no hand-to-hand within one person.

## Noticed elsewhere
- **Crowd.js signs on laps:** the seated crowd's signs lie flat on laps as blank white boards. Along the aisles they read as white paper squares from close up (`steps/b6-vendor.jpg`, `b5-late1.jpg`).
- **People.js:** its aisle security guards on the third base side move over one section with the split (`i % 3`). Its walkers and guards on the club's aisles are hidden by this place.
- **The concourse above:** the new aisle heads behind home (x = ±2.31) give W2's and C's concourses two new portals and section signs.
- **The press box spandrel** shows a moiré through the backstop net from the field.
