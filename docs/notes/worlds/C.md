# C: the main concourse on the first base side, and the First Base Gate

Branch: `worktree-agent-a7e250263264e24e1`, 21 commits on top of 02db415 (including this note).

**The place:** `concourse1b` (`src/ballpark/places/Concourse1B.js`, its parts in `src/ballpark/places/concourse1b/`).
- **The concourse** runs from behind home plate (x = 0) round the 1B side to behind 108, where it turns into the right field corner.
- **The First Base Gate** is at ( 73.5, 25.5 ), with its plaza out to Pattison Avenue, and Lot K across the street.

**Scope for work:** `only=concourse1b,concourse,bowl,people,exterior&focus=60,20,90`. Add `surroundings,complex` and widen the focus (80,70,140) for the plaza and Lot K.

## How it's built

**The walkway.** This side's walkway is W2's `Walkway` turned round (`concourse1b/Walk.js`):
- `s` runs from 0 at x = 0 behind home plate to ~152 behind 108;
- `d` is W2's: the drink rail at 30.1, the column line at 40.9, the stands' counters at 44.8.

So W2's concourse system works here unchanged. `concourse1b/People.js` **subclasses** W2's `ConcoursePeople`: it sets its own gate portal, keeps right the other way, glances at the field to the left, and has this side's carts' menus. It doesn't edit W2's file. P0 has agreed to keep those names working (ASK-C.md).

**Reused from wave 1** by import, not edited:
- from W2: the props kit and its builders, `LiveTV`, `floorSkin`, `Steam`, `GESTURE`, `dress`;
- from W1: `buildOpenGate`, `plantBeds`, `plantTrees`, `buildDrips`.

**Shared at runtime with W2's place:**
- The props share W2's material, so the batching merges both sides' props into one draw.
- The TVs show W2's one broadcast picture, through its screens' material.

**The files:**

| File | What it holds |
|---|---|
| `Concourse1B.js` | The place: bins, carts, TVs, lights, banners, the stands' fronts, the plaza, the Phanatic's reactions, the update |
| `concourse1b/Walk.js` | The walkway turned round |
| `concourse1b/People.js` | W2's crowd on this side, and `admit()`: an arrival walks on in as a concourse fan (the cast slots swap) |
| `concourse1b/Gate.js` | The gate open (W1's builder at this plaza's level) |
| `concourse1b/Arrivals.js` | The way in: sources, lines, bag check, scan, tripods, towels; the exodus at the suspension; umbrellas |
| `concourse1b/Scenes.js` | Timed scenes at the gate: Augie and Nicky, the smokers, Bernie's thermos, the nurses, the last out |
| `concourse1b/Stories.js` | The named people on the concourse, the Phun Zone's kids, Guest Services, the Home Stand, the photo line |
| `concourse1b/Prints.js` | This side's atlas and printed things (one draw): banners, signs, the stands' fronts, the kiosk's and carts' signs, the Phun Zone's arch, Lot K's valances and flags |
| `concourse1b/Things.js` | The program kiosk, the caricaturist's corner, the carts' tops and signs |
| `concourse1b/Plaza.js` | The brick and the drop-off loop, bollards, lamps, the pier, planting, bench, bin, bike rack, pay phones, drips; the Phanatic Phun Zone |
| `concourse1b/Tailgate.js` | Lot K's fence and three tailgates |
| `concourse1b/Sounds.js` | The spots: voices, sizzle, registers, scanner, turnstile, rain on the canopy, murmur, the lines' reactions |
| `tools/audio/concourse1b-calls.py` | The Piper voices, into `public/audio/places/concourse1b/` |

## The changes

### 1. The concourse's crowd: ~300 fans with somewhere to go
- **What:** W2's system on this side:
  - fans up the aisle steps, out of the restrooms and in through the gate;
  - along to a stand's line, the counter, the food handed over, back to the seats;
  - the drink rail, the women's lines at 111 and 117, and this side's half of the standing room behind home (121-122).
- **This side's own:**
  - walkers keep right, which toward first is the stands' side;
  - the glance at the field is to the left going toward first.
- **Replaced:** People.js's generic walkers on this stretch (97 in the scouting census) are handed over through the hiders.
- **Source:** common sense, and W2's evidence (the AP's "six or seven deep behind home plate").

### 2. The First Base Gate open for the game (evidence)
- **Exterior** (a C mark): `GATES[1]` is `leaves: 'open'`.
- **The gate** is built with W1's open-gate builder (the same gate design as the Third Base Gate, per rdowens's photo of 23 Jul 2008): the white grid leaves folded into fins with their baseball discs, the red wheeled bins, the red bag tables, the turnstile cabinets with their tripods turning, the "Welcome to World Series Game 5" placards, the towel cartons.
- **People.js's** takers and guards at this gate are handed over.

### 3. The arrivals: the way in on the replay's clock
- **Where from** (`Arrivals.js`), the sources all evidenced (the 2008 guide, the research's `arrival-transport-lots_2008.txt`):
  - off the Broad Street Line at Pattison, east along Pattison's north sidewalk;
  - over Pattison from Lot K and the Linc's lots;
  - from the taxi stand at Darien and Pattison;
  - down Darien.
- **At the gate:**
  - the lines at the 8 lanes shuffle up a slot at a time;
  - bags are opened on the table for the staffer's flashlight;
  - the ticket is held out to the taker's scanner, then the beep and the tripod's third of a turn;
  - a towel from the carton;
  - **the same person walks on into the concourse** (`People1B.admit` swaps the cast slots).
- **By the clock:** a rush for the first pitch on the 27th (the lines longer than 8 lanes can scan), thinning in the rain; again for the 29th's resumption.
- **The staff:** takers in navy Phillies jackets (the NLDS photo), bag check in red STAFF jackets, security at the ends.
- **Named:** lane 4's taker is **Dee Mastrangelo** ("enjoy the game, hon") and its bag check **Terrell Johnson**.
- **Evidence:** the bag rules ("one bag, 16×16×8, subject to inspection"; no thermoses) and no wands in 2008.

### 4. The portables and kiosks where the October 2008 concessions guide put them
- **The carts:**
  - nachos behind 122 and 111;
  - draft beer 118-119 and 110, bottled beer 109;
  - the Hatfield Grill cart 114, with a steam table under a sneeze guard;
  - the **Phanatic Phood** cart by the kids' zone (112-113): a warmer, juice boxes, "KIDS' MEALS";
  - cotton candy 107;
  - water ice 116. The Inquirer (29 Oct) says water ice was "scaled back" in the cold and Aramark sold 15,000 hot chocolates on the 27th, so this cart has a hand-lettered **HOT CHOCOLATE $3.00** taped over its sign and an urn on the lid.
- **The World Series program kiosk** behind 115-116, from Getty 83600062 (Game 3, 25 Oct): a curved counter with a black top, the base royal blue with a white stripe and a red one, the red steel arch with the PROGRAMS signs, the black program covers stood up.
- **The caricaturist's corner** by 109-110: the 2008 guide has a caricaturist on each side of the main concourse, and a July 2008 photo shows one. It has an easel with a face coming together, a board of samples ("CARICATURES $15"), and the stools.

### 5. What hangs overhead: banners and signs (evidence for the style, invention for the names)
- **The players' banners,** in W2's style: Utley over the gate's way in, Hamels over its turnstiles, **Howard behind 116-117** (where a 2010 photo has him), Victorino 120, Werth 111, Myers 108-109.
- **Coca-Cola pole banners** on the columns (6, 8, 28, 54, 11).
- **Directional signs:**
  - behind 108-109, from the 2010 photo there: RAMP TO ALL LEVELS, ADVANCE TICKETS, GUEST SERVICES, FIRST BASE GATE;
  - one facing the turnstiles, pointing to the sections both ways, the ESCALATOR, the PHANATIC PHUN ZONE and the THIRD BASE GATE.
- Which players' banners hung on this side in 2008 wasn't found.

### 6. The stands' real fronts (evidence: pvsbond Oct 2009 and visitphilly Apr 2008, both of the 2008 fittings)
- **The South Philadelphia Market's header** replaces the generic name band on both of this side's markets (116, and the one for 106). It's the illustrated 9TH ST. MARKET panel:
  - a checker border round slate blue;
  - the Italian Market's cream board under a Phillies pennant;
  - SOUTH PHILADELPHIA in tall gold capitals over the sunburst, the produce and the vendor with his hanging scale;
  - the Coca-Cola cup, the hot dog, the peanuts and a pretzel breaking out of the frame.
- **The Cobblestone Grill's oval blade sign,** on blue arms at the stand's end: Elfreth's Alley's houses, COBBLESTONE GRILL on a maroon banner, "of Elfreth's Alley", the cheesesteak.
- **No change was needed to the line-up:** with the Exterior built, Concourse.js already puts the guide's stands here (Hatfield 120, Market 116 and 109/"106", Brewerytown 111/"113", Creamery 110, Pizza 109, Cobblestone 108). The 3 markets the scouting counted included units that the gate and the suite entrance take out.

### 7. The TVs, the floor, steam and breath
- **TVs:** one over every stand and restroom on this side, on W2's broadcast.
- **The floor skin** (W2's `floorSkin` on this walkway): rain tracked in from the 1B gate, the wet at the restroom doors, beer spilled at Brewerytown and the beer carts, litter building up by the inning.
- **Steam:** off the Hatfield and Cobblestone flat-tops, the cups, and people's breath.

### 8. The plaza as the 2008 photos show it (evidence: rdowens Jul 2008, puckfiend 2005, bikesontransit Jan 2007)
- **The paving:** red-brown brick along the gate with a darker border course, and the **drop-off loop**: a brick ring round a planted island with young trees going yellow (W1's trees and beds).
- **The fixtures:**
  - the grey bollards with their dark band;
  - the disc-headed lamps, lit after dark: they're added to the exterior's lamp list, so the app makes point lights of them;
  - the tall **brick pier** with its stepped limestone cap and the maroon X carrying the loudspeakers;
  - the planting along the fence;
  - the black slatted bin and the bench;
  - the galvanized wave of a bike rack;
  - the **pay phones** outside the gate (the 2008 guide).
- **The rain curtaining off the canopy's edge** on the 27th (W1's drips).

### 9. Robin Roberts as he stands (Exterior.js, a C block)
- **Pose:** in his follow-through, the right hand swept down, the glove at his chest.
- **Plinth:** two tiers of reddish granite with "ROBIN ROBERTS / PHILLIES HALL OF FAME PITCHER 1948-1961" cut in the front.
- **Finish:** the pale grey-white patina ("B/W in a color world"), with the cap, sleeves, socks, belt, glove and spikes charcoal.
- **Where:** in front of the fence about 18 m west of the gate's centreline, facing south to Pattison, his back to the gate. That's from Owens's GPS and the photos. OSM had him 30 m out on the plaza, bronze, facing the park.

### 10. The Phanatic Phun Zone (evidence: Flickr krachel June 2008 and a 2009 photo; the 2008 guide: "inside First Base Gate plaza", kids eight and under)
- **Where:** in the court inside the gate, east of it, against the brick wall.
- **The frame:** red tube-and-netting with red pyramid-roofed towers, crawl tubes with blue-ringed bubble windows, a blue tube bridge, white domes, a slide, and on top the giant hot dog and the Phanatic on his red ATV.
- **The signs:** the Inquirer's black board in Old English letters, and the white arch reading PHANATIC (his medallion) PHUN ZONE.
- **The people:** one kid running the lower deck, one waving down from the top, one down the slide over and over; a father on the phone and a mother waving outside.

### 11. The people with names on the concourse (invention, in CAST.md)
- **Loretta Hayes** on the Market's register behind 116, talking the whole time ("what can I get you, baby?").
- **Gus Karamanlis** calling the programs at the kiosk.
- **Rosemarie Iannucci** at the Phanatic Phood cart.
- **Leo Czarnecki** by the Hatfield Grill with his transistor at his ear and a hot dog; the line turns round to him after every play.
- **Marty Gold** the caricaturist, drawing **Mai Nguyen** while **Linh** photographs the drawing.
- **Tuan** and **Andy Nguyen** at the rail behind 110. Andy has his glove on and is lifted at the last out.
- **Brandon Tully,** a Rays fan from Tampa at Penn in a Longoria jersey: looked over as he passes, and clapping for them at the end.
- A beer man; the ushers at every aisle taking tickets and pointing the way; security at the gate's mouth.

### 12. Scenes at the gate on the replay's clock (invention on evidence: `Scenes.js`)
- **Augie Ferrante** at the Roberts statue, pointing up and telling his grandson **Nicky** about the Whiz Kids while Nicky tries the follow-through: at the 27th's first pitch, and again when the gates open on the 29th.
- **Tony Brandolini** and **Richie Feeney**'s last cigarettes under the canopy's edge. Smoking was allowed at the gates in 2008 and there was no re-entry.
- **Bernie Loughlin**'s thermos found at Terrell's table: "sorry, sir, no thermoses, it's gotta go"; "it's coffee! it's forty degrees out here!"; he walks it out to the bin by the fin and comes back to the front of the line.
- **The nurses Keisha Morton and Mary Beth Riordan** (Methodist Hospital, straight off the day shift) running in through the rain in the 3rd.
- **The suspension:** the lines turn round, and fans stream out between the fins into the rain and off to the subway, the lots and the taxis.
- **The last out:** a dozen from the Lot K tailgates run over to the gate, jumping and hugging, towels round their heads; the gate's staff cheer and hug too.
- Each scene ends in a turnstile's line, and so in the concourse.

### 13. Lot K across Pattison (evidence: the research's lot letters, the 2008 tailgating rule, rdowens's "K6/K8" photo)
- The black picket fence along the sidewalk, with a gap at the crosswalk.
- **Three tailgates:** a white pop-up with a red Phillies valance, a kettle grill smoking, coolers, camp chairs round a little TV on a folding table showing the broadcast, a flag on a pole.
- **The people:** two in the chairs (a beer, a cocoa), one at the grill with the tongs, one standing. A poncho and a hood on the 27th. They're up out of their chairs at a run and at the last out.

### 14. The Phanatic, Guest Services and the Home Stand (invention on evidence)
- **When the Phanatic passes** (A's `app.phanatic.now`): within 14 m everyone turns to look, the kids jump with their arms up, and a few get a camera or a flip phone up.
- **The photo line:** when he parks his four-wheeler behind 111 (A's plan: 789-886 on the 27th), a line forms: a father and son, two girls with a phone, an older couple. Each in turn stands beside him while the other takes it. His spot is kept clear of the walkers.
- **Guest Services** (the guide: lost children are taken there):
  - an usher walks a lost boy up from the rail;
  - the woman at the window calls it in;
  - his father comes hurrying in his UTLEY jersey, drops to his knees and hugs him;
  - off they go hand in hand.
- **The Home Stand:** a man holding a cap up, a woman flicking through the shirts, one off with her bag, the clerk ringing it up.

### 15. What it sounds like (`app.sound.spot`)
- **Voiced with Piper** (CC0 and public-domain voices; `tools/audio/concourse1b-calls.py`, credited in CREDITS.md):
  - Gus's "Programs! … Fifteen dollars!", the beer man, Loretta at her register;
  - "Hot chocolate! Get your hot chocolate here!", "Phanatic Phood! Hot dogs for the kids!";
  - Dee's "enjoy the game, hon" (and "welcome back" on the 29th), "tickets out, folks";
  - the bag check, Terrell's "it's gotta go" and Bernie's protest;
  - security's "keep it moving", an usher's "all the way down, on your right";
  - Leo's "did you hear Harry?", a fan's "Hey, Tampa! Nice shirt!", the caricaturist's "hold still, sweetheart".
- **Synthesized in code:** the flat-tops' sizzle, the registers' drawers, the scanner's beep and the tripod's ratchet at each scan, the **rain drumming on the gate's steel canopy** (the 27th, louder as it pours), and the lines' murmur in the rush.
- **Using the park's own recordings:** the lines at the TVs going up at a Phillies run and groaning at the Rays'.
- **Playback:** one-shots play only within 42 m of the camera.

### Also
- **Umbrellas** for some arriving on the 27th: open in the rain, furled under the canopy.
- **P0's props in the right hands:** the scanner, flashlight, thermos, cigarette, radio and tongs, through stand-ins (`PR` in Arrivals.js) until P0's Cast.js merges.
- `cast.bounds` is set for P0's pool.
- **The build:** the banners' blurred crowds are now drawn small and scaled up. A blur filter on every dot had been most of a 1.4 s build in the browser. In Node the build is ~70 ms.

## The people (invented; all in `.claude/wave2/CAST.md`)
- **At the gate:**
  - Dee Mastrangelo (61, Marcus Hook, thirty years an usher at the Vet);
  - Terrell Johnson (26, Germantown, a Temple grad student on the bag check);
  - Bernie Loughlin (58, Roxborough, a SEPTA bus driver with his thermos).
- **On the plaza:**
  - Augie Ferrante (79, Marconi Plaza, saw the Whiz Kids in 1950) and his grandson Nicky (10);
  - Tony Brandolini and Richie Feeney (Pennsport, smoking);
  - Keisha Morton and Mary Beth Riordan (nurses at Methodist, late in the rain).
- **On the concourse:**
  - Loretta Hayes (57, Southwest Philly, on the Market's register since the park opened, 22 years at the Vet);
  - Gus Karamanlis (70, Upper Darby, retired Navy Yard machinist, the program kiosk);
  - Rosemarie Iannucci (45, Pennsport, the Phood cart);
  - Leo Czarnecki (66, Bridesburg, his radio);
  - Marty Gold (58, Cherry Hill, the caricaturist);
  - the Nguyens from Washington Avenue (Tuan, Linh, Andy 8, Mai 6);
  - Brandon Tully (24, from Tampa, a grad student at Penn, the Rays fan).
- **Unnamed:** the ushers, the gate staff, the lost boy and his father, the Phun Zone family, the photo line, the tailgaters, the celebrants.

## References
- **Saved:** 47 images, 4 text files, `SOURCES.md` and `getty_captions.txt` in `/Users/phillipforrence/citizens-bank-park/.claude/ref/concourse1b/`, gathered by a research subagent. Also W2's refs in `../concourse3b/` (the 2008 concessions and convenience guides).
- **The ones this work leans on:**
  - `2008-07-23_flickr_rdowens_3626076537_first-base-gate.jpg`: the gate;
  - `…3626891788` and `…3626078323`: Roberts, with the GPS;
  - `2005-09-09_flickr_puckfiend_571731134`: the loop, the bollards and the lamps;
  - `2007-01-30_…2294282048`: the paving and the furniture;
  - `2008-06-16_flickr_krachel_2605267543`: the Phun Zone;
  - `2009-10-01_flickr_pvsbond_3991556517`: the Market's header;
  - `…3992316468`: the Cobblestone sign;
  - `2008-07-23_flickr_rdowens_3626081771`: Lot K and the Linc;
  - `first-base-gate_facts-geometry_2008.txt`;
  - `getty_2008-10-25_83600062`, in `../concourse3b/`: the program kiosk.

## Screenshots
All in the worktree, gitignored:
- **`.claude/c/shots/b0/`** is before (scoped, without the place): `along-night`, `stands-night`, `gate-mouth-night`, `gate-plaza-night`, `rf-end-day`, `roberts-day`.
- **`.claude/c/shots/c1/` to `c7/`** are the steps:
  - `c2/`: kiosk, caricature, banners, Leo, the Nguyens;
  - `c3/`: plaza, Phun Zone;
  - `c4/`: Roberts, Augie and Nicky, the thermos, the last out, the market's and Cobblestone's fronts;
  - `c6/`: Lot K, the exodus;
  - `c7/`: the after counts, Guest Services.
- **`.claude/c/shots/final/`** is the full park (no `only=`, no console errors, load 9.6 s):
  - `final-day` (29th, the program kiosk and the Market);
  - `final-night` (27th, the gate from the loop);
  - `final-rain` (27th's 6th, the lanes);
  - `final-concourse-night`;
  - `final-lastout` (the rail behind 110);
  - `final-tv` (the center field camera).

## Counts (`meshRenderer.stats`, the frames of that view)

**Scoped**, `only=concourse,bowl,people,exterior(,concourse1b)&focus=60,20,90`:

| View | Before (b0): draws, triangles | After (c7): draws, triangles | Cast drawn (near) |
|---|---|---|---|
| `along-night` (behind 121 looking toward first, 27th, 5th) | 137, 412,843 | 219, 941,096 | 383 (71) |
| `stands-night` (115-118) | 193, 618,243 | 211, 853,114 | 382 (47) |
| `gate-plaza-night` (first pitch) | not taken | 225, 959,765 | 483 (6) |

**The full park** (final job):

| View | Draws | Triangles | Pipelines | Cast drawn |
|---|---|---|---|---|
| `final-night` | 767 | 8,594,784 | 620 | 381 (1 near) |
| `final-concourse-night` | 440 | 7,714,245 | 620 | 382 (64 near) |
| `final-tv` | 535 | 7,180,094 | 620 | 380 |

- **The scoped "after" draws** include every place's side effects on the shared parts in scope: with a place in `only=`, all the places are built.
- **My own draws:**
  - the cast (3 LODs and the contact shadows);
  - one prints mesh; the props (merged with W2's);
  - the TVs (merged with W2's);
  - the floor skin, the steam;
  - the brick, the drips, the planting and trees;
  - the gate's (W1's builder: fins, balls, red, steel, dark, logos, cartons, placards, tripods);
  - the tailgates' TVs.
- **The cast** is ~300 concourse fans, ~40 stand staff, ~50 named and scene people, 118 at the gate and 12 at the tailgates. 380-480 are visible at once.
- **Before P0's pool merges,** everyone visible is drawn wherever the camera is. P0's pool skips the ones out of view, so the gate's and Lot K's people cost nothing from the concourse.
- **GPU:** not profiled (the coordinator profiles). **If it's over ~1 ms,** the levers are: the concourse pool (300 → ~220), this side's standing room behind home (limited to s < 15 now), and the arrival pool (118).
- **CPU:** the place's update is ~0.7-0.9 ms a frame in Node, with ~450 people out.

## Unfinished
- **The escalators** from the 1B gate plaza to the Pavilion and Terrace (the 2008 guide) aren't built: where they stood exactly wasn't found. The wayfinding sign points to them.
- **The taxi stand** at Darien and Pattison (the NW corner, 90 m east) isn't built.
- **The TV trucks** (KYW, FOX 29 seen on the 27th) aren't built: where they parked is unknown.
- **The umbrellas and P0's props** show only after P0's Cast.js merges (stand-ins until then; `PR` in Arrivals.js).
- **The photo line with the Phanatic** needs A's place (`app.phanatic`) to trigger. Not rendered here.
- **The Phun Zone** is a simplification of a much busier structure; a junior zone (under 2) isn't built.
- **The concourse's arrivals appear at the gate's portal** when W2's system picks it (rarely: the admitted ones come through the turnstiles). The concourse's fans leaving by the gate still vanish just inside the turnstiles.

## Noticed elsewhere
- **Complex's instanced trees** along Pattison east of the gate are big low-poly blobs (seen from the plaza toward Lot K). W1 regrew them only round the 3B plaza.
- **Guest Services** is behind 119 here, not 122 (the guide), because the suite entrance takes the units within ~12 m of x = 0. The TICKETS window shares its unit.
- **W2's "Nachos 122" cart** is on the 3B side (s = 9); 122 is on the 1B side, where I have one too.
- **The elevator bank at the gate's mouth** (s ~64) draws as a blank blue-grey panel with a green light.
- **The exterior's sidewalk hull** makes the plaza one pale, flat expanse to Pattison. The 2008 plaza had more planting along Pattison.
- **OSM's Robin Roberts position** ( 75, 69.8 ) is 30 m out on the plaza; the photos and Owens's GPS put him in front of the fence west of the gate. That's fixed in the C block.
- **The 2008 concourse prices** (W2's note): the Concourse.js boards still say beer $6.75, hot dog $3.75.

## Pictures I'd like from the owner
- **The First Base Gate on 27 or 29 October 2008:** the crowd at the lanes, any postseason banner over it, the staff.
- **The court inside the gate:** the Phun Zone in 2008 (its exact place), and the escalators to the Pavilion.
- **The 1B stands' fronts in 2008:** Neighborhood (Seasons) Pizza, Old City Creamery, Brewerytown, Hatfield Grill, the Phanatic Phood cart, the Photo Booth, the Home Stand, the newsstand.
- **Which players' banners** hung over sections 105-122 in 2008.
- **Lot K and the taxi stand** on a game night; where the TV trucks parked.
- **The 1B ticket windows** (Will Call) on Pattison.
