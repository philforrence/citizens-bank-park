// What everyone on the field looks like: each player of Game 5 by his MLB id (skin, hair, how he wears
// his beard, his build, how he wears the uniform), and the people who aren't in the box score: the
// coaches and managers, the umpires, the bat boys and ball girls, the grounds crew, the Phanatic.
// Players.js packs a look into each slot's per-instance data (the skinned mesh has no per-player
// geometry: builds scale the rig's bones, the rest is the shader's).
//
// Heights and weights from the 2008 rosters; faces from the Series' photos where they show (Werth's
// scruffy beard, Hamels clean-shaven, Lidge's goatee, Ruiz's chin beard, Howard's size, Rollins' small
// frame, Madson's and Price's height, Stairs' and Blanton's bellies); the rest (who wore high socks, whose
// batting gloves were which colour) is plausible invention.
//
//   look( id ) -> { skin, hair, beard, stubble, eyeBlack, glasses, grey, height, girth, belly, jaw,
//                   socks, sleeves, gloves: [ palm, strap ], bands, elbow, flaps, age }
//
// beard: 0 clean-shaven, 1 stubble, 2 heavy stubble, 3 goatee, 4 goatee and moustache, 5 short full
// beard, 6 moustache, 7 chin strap. gloves: batting glove colours (BG below). bands: wristbands, 1 left,
// 2 right, 3 both. flaps: the batting helmet's ear flaps, 1 left (a right-handed hitter's), 2 right,
// 3 both (switch hitters' double-flap helmets).

export const BG = { black: 0, white: 1, red: 2, navy: 3, columbia: 4, grey: 5, gold: 6, royal: 7 };

// skin tones (linear albedo)
const S = {
	fair: [ 0.62, 0.41, 0.3 ], light: [ 0.58, 0.37, 0.26 ], ruddy: [ 0.6, 0.35, 0.24 ], olive: [ 0.5, 0.32, 0.2 ],
	tan: [ 0.37, 0.215, 0.13 ], latin: [ 0.26, 0.14, 0.08 ], brown: [ 0.16, 0.083, 0.048 ], dark: [ 0.1, 0.05, 0.028 ],
	deep: [ 0.07, 0.036, 0.021 ], asian: [ 0.54, 0.37, 0.24 ],
};
// hair (linear)
const H = {
	black: [ 0.012, 0.01, 0.008 ], dark: [ 0.03, 0.019, 0.012 ], brown: [ 0.075, 0.045, 0.025 ], light: [ 0.16, 0.1, 0.055 ],
	sandy: [ 0.26, 0.17, 0.09 ], red: [ 0.2, 0.08, 0.035 ], grey: [ 0.3, 0.29, 0.28 ], white: [ 0.55, 0.54, 0.52 ], salt: [ 0.14, 0.13, 0.12 ],
};

const BASE = {
	skin: S.light, hair: H.brown, beard: 1, stubble: 0.4, eyeBlack: 0, glasses: 0, grey: 0,
	height: 1, girth: 1, belly: 0, jaw: 0, socks: 'low', sleeves: 'long', gloves: [ BG.black, BG.black ], bands: 0, elbow: 0, flaps: 1, age: 0.2,
};

// feet and inches -> the scale over the mesh's 6'2"
const ht = ( ft, inch ) => ( ft * 12 + inch ) / 74;

const LOOKS = {
	// ---- the Phillies
	// Jimmy Rollins, the MVP of 2007: 5'8", a switch hitter in a double-flap helmet, red wristbands
	276519: { skin: S.dark, hair: H.black, beard: 4, stubble: 0.3, height: ht( 5, 8 ), girth: 0.92, socks: 'high', gloves: [ BG.red, BG.white ], bands: 3, flaps: 3, jaw: - 0.2 },
	// Jayson Werth: 6'5", the scruffy beard coming in, eye black, an elbow guard
	150029: { skin: S.ruddy, hair: H.brown, beard: 5, height: ht( 6, 5 ), girth: 1.0, eyeBlack: 1, gloves: [ BG.black, BG.red ], elbow: 1, jaw: 0.3 },
	// Chase Utley: 6'1", the black elbow guard on his front (right) arm, pants to the shoe tops
	400284: { skin: S.light, hair: H.brown, beard: 1, stubble: 0.55, height: ht( 6, 1 ), girth: 1.0, gloves: [ BG.black, BG.black ], elbow: 1, flaps: 2, jaw: 0.1 },
	// Ryan Howard: 6'4", 250 lb, the biggest man on the field
	429667: { skin: S.brown, hair: H.black, beard: 7, height: ht( 6, 4 ), girth: 1.17, belly: 0.35, gloves: [ BG.black, BG.white ], bands: 2, flaps: 2, jaw: 0.4 },
	// Pat Burrell: 6'4", dark stubble
	150100: { skin: S.light, hair: H.dark, beard: 2, height: ht( 6, 4 ), girth: 1.08, belly: 0.1, gloves: [ BG.white, BG.red ], jaw: 0.35 },
	// Shane Victorino, the Flyin' Hawaiian: 5'9", eye black, high socks, a switch hitter
	425664: { skin: S.tan, hair: H.black, beard: 4, height: ht( 5, 9 ), girth: 0.95, eyeBlack: 1, socks: 'high', gloves: [ BG.red, BG.red ], bands: 1, flaps: 3 },
	// Pedro Feliz: 6'1"
	150268: { skin: S.latin, hair: H.black, beard: 4, height: ht( 6, 1 ), girth: 1.03, gloves: [ BG.black, BG.black ], jaw: 0.2 },
	// Carlos Ruiz, Chooch: 5'10", stocky, the chin beard
	434563: { skin: S.latin, hair: H.black, beard: 3, height: ht( 5, 10 ), girth: 1.1, belly: 0.15, socks: 'high', gloves: [ BG.red, BG.black ], jaw: 0.35 },
	// Cole Hamels: 6'3", lean, clean-shaven
	430935: { skin: S.fair, hair: H.light, beard: 0, stubble: 0, height: ht( 6, 3 ), girth: 0.93, jaw: - 0.15, flaps: 2 },
	// Brad Lidge: 6'5", the goatee
	400058: { skin: S.light, hair: H.dark, beard: 3, height: ht( 6, 5 ), girth: 1.02, jaw: 0.1 },
	// Ryan Madson: 6'6", lanky
	425492: { skin: S.fair, hair: H.brown, beard: 0, stubble: 0.2, height: ht( 6, 6 ), girth: 0.92 },
	// J.C. Romero
	240694: { skin: S.tan, hair: H.black, beard: 4, height: ht( 5, 11 ), girth: 1.0 },
	// Chad Durbin, Scott Eyre (a big man with a big goatee), Clay Condrey, J.A. Happ, Brett Myers, Joe Blanton
	239795: { skin: S.light, hair: H.brown, beard: 1, height: ht( 6, 2 ) },
	113961: { skin: S.ruddy, hair: H.sandy, beard: 3, height: ht( 6, 1 ), girth: 1.12, belly: 0.3 },
	424925: { skin: S.light, hair: H.brown, beard: 3, height: ht( 6, 3 ) },
	457918: { skin: S.fair, hair: H.brown, beard: 0, height: ht( 6, 5 ), girth: 0.93 },
	408206: { skin: S.ruddy, hair: H.brown, beard: 3, height: ht( 6, 4 ), girth: 1.1, belly: 0.15 },
	430599: { skin: S.light, hair: H.brown, beard: 2, height: ht( 6, 3 ), girth: 1.18, belly: 0.45 },
	// Geoff Jenkins, Matt Stairs (5'9", barrel-chested), Eric Bruntlett, Chris Coste, Greg Dobbs
	132961: { skin: S.light, hair: H.brown, beard: 3, height: ht( 6, 1 ), girth: 1.05, gloves: [ BG.white, BG.black ], flaps: 2 },
	122644: { skin: S.ruddy, hair: H.brown, beard: 2, height: ht( 5, 9 ), girth: 1.17, belly: 0.5, flaps: 2 },
	429731: { skin: S.fair, hair: H.brown, beard: 0, height: ht( 6, 0 ), girth: 0.94, socks: 'high', gloves: [ BG.red, BG.white ] },
	400120: { skin: S.light, hair: H.dark, beard: 1, height: ht( 6, 1 ), girth: 1.05, socks: 'high' },
	425785: { skin: S.light, hair: H.brown, beard: 1, height: ht( 6, 1 ), flaps: 2 },

	// ---- the Rays
	// Akinori Iwamura: 5'9"
	493127: { skin: S.asian, hair: H.black, beard: 0, stubble: 0.1, height: ht( 5, 9 ), girth: 0.95, gloves: [ BG.white, BG.navy ], flaps: 2 },
	// Carl Crawford: eye black, an elbow guard, navy wristbands
	408307: { skin: S.dark, hair: H.black, beard: 4, height: ht( 6, 2 ), girth: 1.02, eyeBlack: 1, socks: 'high', gloves: [ BG.navy, BG.white ], bands: 3, elbow: 1, flaps: 2 },
	// B.J. Upton: 6'3", lean, eye black
	425834: { skin: S.brown, hair: H.black, beard: 1, height: ht( 6, 3 ), girth: 0.95, eyeBlack: 1, gloves: [ BG.black, BG.columbia ], bands: 2 },
	// Carlos Pena: the goatee, an elbow guard
	150289: { skin: S.latin, hair: H.black, beard: 4, height: ht( 6, 2 ), girth: 1.08, belly: 0.1, gloves: [ BG.navy, BG.navy ], elbow: 1, flaps: 2, jaw: 0.3 },
	// Evan Longoria, the rookie: 6'1"
	446334: { skin: S.olive, hair: H.dark, beard: 1, height: ht( 6, 1 ), eyeBlack: 1, gloves: [ BG.white, BG.navy ], jaw: 0.25 },
	// Dioner Navarro: 5'9", stocky, a switch hitter
	425900: { skin: S.latin, hair: H.black, beard: 4, height: ht( 5, 9 ), girth: 1.13, belly: 0.25, socks: 'high', gloves: [ BG.columbia, BG.navy ], flaps: 3 },
	// Rocco Baldelli: 6'4"
	408306: { skin: S.olive, hair: H.dark, beard: 1, height: ht( 6, 4 ), girth: 0.98, gloves: [ BG.navy, BG.white ] },
	// Jason Bartlett: high socks
	430583: { skin: S.light, hair: H.brown, beard: 2, height: ht( 6, 0 ), girth: 0.95, socks: 'high', gloves: [ BG.white, BG.white ] },
	// Scott Kazmir: lean, clean-shaven
	431148: { skin: S.fair, hair: H.dark, beard: 0, height: ht( 6, 0 ), girth: 0.93, flaps: 2 },
	// Grant Balfour, the fiery Australian, and his goatee; J.P. Howell; David Price, 6'6"; Dan Wheeler;
	// Chad Bradford, the submariner, 6'5"
	346797: { skin: S.ruddy, hair: H.brown, beard: 3, height: ht( 6, 2 ) },
	434442: { skin: S.light, hair: H.brown, beard: 1, height: ht( 6, 0 ), flaps: 2 },
	456034: { skin: S.brown, hair: H.black, beard: 4, height: ht( 6, 6 ), girth: 0.95, flaps: 2 },
	235095: { skin: S.light, hair: H.brown, beard: 3, height: ht( 6, 3 ) },
	136268: { skin: S.fair, hair: H.brown, beard: 0, height: ht( 6, 5 ), girth: 0.96 },
	// Eric Hinske, the red beard; Gabe Gross; Ben Zobrist; Willy Aybar; Fernando Perez; Elliot Johnson
	400134: { skin: S.ruddy, hair: H.red, beard: 5, height: ht( 6, 2 ), girth: 1.12, belly: 0.15, gloves: [ BG.black, BG.navy ], flaps: 2 },
	408212: { skin: S.light, hair: H.sandy, beard: 1, height: ht( 6, 3 ), flaps: 2 },
	450314: { skin: S.fair, hair: H.brown, beard: 0, height: ht( 6, 3 ), gloves: [ BG.white, BG.navy ], flaps: 3 },
	430632: { skin: S.latin, hair: H.black, beard: 4, height: ht( 6, 0 ), girth: 1.1, belly: 0.15, flaps: 3 },
	445010: { skin: S.brown, hair: H.black, beard: 1, height: ht( 5, 11 ), girth: 0.93, socks: 'high', eyeBlack: 1 },
	471107: { skin: S.light, hair: H.brown, beard: 1, height: ht( 6, 1 ), flaps: 3 },
	458567: { skin: S.fair, hair: H.brown, beard: 0, height: ht( 6, 3 ), girth: 0.92, flaps: 2 },
	448306: { skin: S.light, hair: H.brown, beard: 1, height: ht( 6, 4 ) },
	490063: { skin: S.tan, hair: H.dark, beard: 3, height: ht( 6, 4 ) },
};

// the people who aren't on the roster (negative ids; Director.js)
export const STAFF = {
	// the umpires: the World Series crew of six, older men (grey at the temples, one moustache)
	'-1': { skin: S.ruddy, hair: H.salt, beard: 0, stubble: 0.3, height: ht( 6, 0 ), girth: 1.1, belly: 0.3, age: 0.8, jaw: 0.3 },
	'-2': { skin: S.light, hair: H.grey, beard: 6, height: ht( 6, 1 ), girth: 1.05, belly: 0.2, age: 0.8 },
	'-3': { skin: S.brown, hair: H.salt, beard: 6, height: ht( 6, 2 ), girth: 1.1, belly: 0.2, age: 0.7 },
	'-4': { skin: S.fair, hair: H.salt, beard: 0, height: ht( 6, 3 ), girth: 1.08, belly: 0.25, age: 0.75 },
	'-5': { skin: S.light, hair: H.dark, beard: 0, height: ht( 5, 11 ), girth: 1.12, belly: 0.3, age: 0.6 },
	'-6': { skin: S.ruddy, hair: H.grey, beard: 1, height: ht( 6, 2 ), girth: 1.05, belly: 0.2, age: 0.8 },
	// Charlie Manuel, 64, 6'3" and heavy, white hair; Joe Maddon in his black-framed glasses
	// (---- FB3, C3B-10: a big man, not a ball: girth 1.2 and belly 0.75 read 10-15% wider than Getty
	// 83570999 in the interview's mid-shot, with the jacket's hull over it)
	manuel: { skin: S.ruddy, hair: H.white, beard: 0, stubble: 0.2, height: ht( 6, 3 ), girth: 1.1, belly: 0.5, age: 1, jaw: 0.5 },
	maddon: { skin: S.light, hair: H.white, beard: 0, stubble: 0.1, glasses: 1, height: ht( 5, 11 ), girth: 1.0, belly: 0.1, age: 0.9 },
	// the base coaches: Davey Lopes (1B) and Steve Smith (3B) for the Phillies, George Hendrick and Tom
	// Foley for the Rays
	lopes: { skin: S.brown, hair: H.salt, beard: 6, height: ht( 5, 9 ), girth: 1.0, age: 0.8 },
	smith: { skin: S.light, hair: H.grey, beard: 0, height: ht( 6, 0 ), girth: 1.05, belly: 0.2, age: 0.7 },
	hendrick: { skin: S.dark, hair: H.salt, beard: 6, height: ht( 6, 3 ), girth: 1.02, age: 0.85 },
	foley: { skin: S.ruddy, hair: H.grey, beard: 0, height: ht( 6, 1 ), girth: 1.05, belly: 0.2, age: 0.6 },
	// the bat boys (a Phillies bat boy and the one the club gives the visitors, in their grey), the ball
	// girls (on their stools down the lines, hair tied back under the cap)
	batboy: { skin: S.light, hair: H.brown, beard: 0, stubble: 0, height: ht( 5, 8 ), girth: 0.88, age: 0, socks: 'high' },
	batboyAway: { skin: S.tan, hair: H.dark, beard: 0, stubble: 0, height: ht( 5, 7 ), girth: 0.86, age: 0 },
	ballgirl: { skin: S.fair, hair: H.sandy, beard: 0, stubble: 0, height: ht( 5, 5 ), girth: 0.84, age: 0.1, jaw: - 0.6 },
	ballgirl2: { skin: S.olive, hair: H.dark, beard: 0, stubble: 0, height: ht( 5, 6 ), girth: 0.84, age: 0.1, jaw: - 0.6 },
	// the grounds crew
	crew: { beard: 1, age: 0.4 },
	// the Phillie Phanatic: the performer inside about 5'10", the costume (Rig.js' phanatic()) taking him to
	// 6'6" at the top of his hair; his build is the costume's, so the bones aren't broadened (belly 1 is
	// the costume's at rest: Moves.js' jiggle swings it)
	phanatic: { skin: [ 0.09, 0.36, 0.03 ], hair: [ 0.09, 0.36, 0.03 ], beard: 0, stubble: 0, height: 0.95, girth: 1.0, belly: 1.0, age: 0, socks: 'high' },
};

// ---- R (rituals): the grounds crew with names (CAST.md): Frank Tomaselli, 57, on the crew since the
// Vet's last years (the far end of the roll; he stays out with the tarp); Lucho Figueroa, 34, the chalk
// liner man; Ricky DeSantis, 22, the Temple intern on the hose. And Jamie Moyer (45; 6'0", lean) and
// Jim Hickey, the Rays' pitching coach
STAFF[ 'r:crew1' ] = { skin: S.fair, hair: H.salt, beard: 6, height: ht( 5, 10 ), girth: 1.1, belly: 0.35, age: 0.85, jaw: 0.3 };
STAFF[ 'r:liner' ] = { skin: S.latin, hair: H.black, beard: 4, height: ht( 5, 9 ), girth: 1.0, age: 0.35 };
STAFF[ 'r:crew5' ] = { skin: S.light, hair: H.brown, beard: 0, stubble: 0.25, height: ht( 6, 0 ), girth: 0.92, age: 0.05, jaw: - 0.2 };
STAFF[ 'r:moyer' ] = { skin: S.light, hair: H.dark, beard: 0, stubble: 0.3, height: ht( 6, 0 ), girth: 0.93, age: 0.55, jaw: - 0.1 };
STAFF[ 'r:hickey' ] = { skin: S.ruddy, hair: H.grey, beard: 0, height: ht( 6, 2 ), girth: 1.05, belly: 0.2, age: 0.6 };
// ---- end R

// ---- FY3 (gauntlet r4, the close-ups): the faces held against the Series' close-ups. Feliz wore a short
// beard along the jaw joined to the moustache and the goatee, his cheeks clear (Getty 83483794, batting
// practice on the 29th), not a goatee alone; Lidge's goatee over a day's stubble (Getty 83485858); Utley
// and Burrell a heavier stubble than the rest
LOOKS[ 150268 ].beard = 7;
LOOKS[ 150268 ].stubble = 0.7;
LOOKS[ 400058 ].stubble = 0.65;
LOOKS[ 400284 ].stubble = 0.7;
LOOKS[ 150100 ].stubble = 0.75;
// ---- end FY3

// ---- FY4 (gauntlet r4, every man his own face): the mesh is one MakeHuman face; Players.js shapes it in
// the vertex stage by sixteen numbers (twelve here, four in MORE below), -1 to 1 (0 the base mesh's), each a few millimetres at its ends:
//   jawL the lower face's length (the chin lower), chin its jut, chinW its breadth (square or pointed),
//   cheek the cheekbones, full the cheeks' flesh (a round face or a gaunt one), brow the ridge over the
//   eyes, noseL the nose's length and how far it stands out, noseW its breadth at the wings, bridge how
//   high the bridge stands, eyes their spacing, ears their size and how far they stand off the head, neck
//   its thickness (a thick neck sits the head a little lower too).
// The looks are from the Series' close-ups and the 2008 team photos as remembered (Getty's 2008-10-29 set
// in .claude/ref/rituals/ for Lidge, Feliz, Upton, Balfour and Hamels; the FOX feed for Burrell): Lidge's
// long face, jutting chin and deep-set eyes; Ruiz's broad round face and wide nose; Utley's angular face,
// high cheekbones and heavy brow; Howard's big round face; Rollins' narrow face, high cheekbones and ears;
// Werth's long face and long nose; Hamels' narrow, fine face; Navarro's round one; Longoria's square jaw
// and heavy brow; Upton's and Price's long lean faces; Iwamura's flat bridge and wide cheekbones. Older men
// get age's own besides (Players.js: jowls, the nose and ears grown): the umpires, the coaches, Manuel.
// The jaw's width stays the look's `jaw`
export const FACE_KEYS = [ 'jawL', 'chin', 'chinW', 'cheek', 'full', 'brow', 'noseL', 'noseW', 'bridge', 'eyes', 'ears', 'neck' ];
// (and four more, FACE_MORE: lips fuller, mouthW wider, deep-set eyes, gonion the jaw's angle flared)
export const FACE_MORE = [ 'lips', 'mouthW', 'deep', 'gonion' ];
// how Players.js packs them: four to a float, in this order
export const FACE_PACK = [ 'jawL', 'chin', 'chinW', 'lips', 'cheek', 'full', 'brow', 'mouthW', 'noseL', 'noseW', 'bridge', 'deep', 'eyes', 'ears', 'neck', 'gonion' ];
const fc = ( ...v ) => Object.fromEntries( FACE_KEYS.map( ( k, i ) => [ k, v[ i ] ?? 0 ] ) );
//                     jawL  chin chinW cheek  full brow noseL noseW bridge eyes ears  neck
const FACES = {
	400058: fc( 0.7, 0.6, 0.1, 0.3, - 0.6, 0.6, 0.5, - 0.2, 0.6, - 0.2, 0.0, - 0.1 ), // Lidge
	434563: fc( - 0.3, - 0.2, 0.6, 0.3, 0.8, 0.3, 0.0, 0.8, - 0.5, 0.2, 0.2, 0.7 ), // Ruiz
	400134: fc( 0.1, 0.2, 0.6, 0.0, 0.7, 0.4, 0.1, 0.4, - 0.1, - 0.2, 0.0, 0.9 ), // Hinske
	400284: fc( 0.4, 0.5, 0.4, 0.8, - 0.8, 0.7, 0.2, - 0.3, 0.5, - 0.4, 0.2, 0.2 ), // Utley
	429667: fc( 0.2, 0.1, 0.6, 0.4, 0.9, 0.4, 0.2, 0.9, - 0.4, 0.3, 0.1, 1.0 ), // Howard
	276519: fc( - 0.3, - 0.3, - 0.6, 0.8, - 0.5, 0.2, - 0.1, 0.6, - 0.4, 0.1, 0.7, - 0.2 ), // Rollins
	150029: fc( 0.8, 0.3, 0.3, 0.3, - 0.4, 0.6, 0.8, 0.0, 0.6, 0.0, 0.0, 0.3 ), // Werth
	150268: fc( 0.1, 0.0, 0.5, 0.8, 0.2, 0.5, 0.0, 0.7, - 0.3, 0.2, 0.0, 0.5 ), // Feliz
	150100: fc( 0.3, 0.4, 0.8, 0.3, 0.0, 0.7, 0.2, 0.1, 0.3, - 0.1, - 0.2, 0.8 ), // Burrell
	430935: fc( 0.3, - 0.1, - 0.6, - 0.2, - 0.6, - 0.3, 0.6, - 0.4, 0.7, 0.2, 0.5, - 0.6 ), // Hamels
	425664: fc( - 0.3, - 0.2, 0.1, 0.5, 0.7, 0.1, - 0.2, 0.6, - 0.4, 0.3, 0.1, 0.0 ), // Victorino
	132961: fc( 0.5, 0.5, 0.3, 0.1, - 0.2, 0.4, 0.6, 0.1, 0.4, - 0.2, 0.3, 0.3 ), // Jenkins
	425492: fc( 0.6, 0.1, - 0.3, 0.0, - 0.5, 0.1, 0.4, - 0.2, 0.4, 0.0, 0.3, - 0.5 ), // Madson
	408307: fc( 0.2, 0.0, - 0.3, 0.8, - 0.6, 0.3, - 0.1, 0.6, - 0.3, 0.3, 0.2, 0.2 ), // Crawford
	446334: fc( 0.3, 0.4, 0.8, 0.4, - 0.2, 0.8, 0.2, 0.0, 0.4, - 0.2, - 0.2, 0.5 ), // Longoria
	425834: fc( 0.7, - 0.1, - 0.5, 0.7, - 0.6, 0.2, 0.0, 0.6, - 0.3, 0.2, 0.3, - 0.4 ), // Upton
	150289: fc( 0.3, 0.3, 0.7, 0.4, 0.3, 0.7, 0.4, 0.5, 0.2, 0.0, 0.0, 0.7 ), // Pena
	430583: fc( 0.1, 0.3, - 0.7, 0.2, - 0.6, 0.1, 0.2, - 0.4, 0.3, - 0.4, 0.4, - 0.4 ), // Bartlett
	425900: fc( - 0.5, - 0.5, 0.2, 0.2, 1.0, 0.1, - 0.2, 0.7, - 0.5, 0.1, 0.1, 0.8 ), // Navarro
	456034: fc( 0.7, 0.0, - 0.3, 0.4, - 0.5, 0.2, 0.2, 0.6, - 0.2, 0.3, 0.7, - 0.5 ), // Price
	346797: fc( 0.1, 0.5, 0.7, 0.3, 0.1, 0.9, 0.3, 0.2, 0.3, - 0.3, 0.0, 0.6 ), // Balfour
	493127: fc( - 0.2, - 0.3, 0.0, 0.8, 0.3, - 0.4, - 0.4, 0.3, - 0.8, 0.5, 0.2, 0.0 ), // Iwamura
	408306: fc( 0.4, 0.3, 0.2, 0.3, - 0.4, 0.5, 0.5, 0.0, 0.6, - 0.2, 0.0, 0.1 ), // Baldelli
	431148: fc( 0.0, - 0.2, - 0.3, 0.1, - 0.3, 0.0, 0.1, - 0.2, 0.2, 0.2, 0.3, - 0.3 ), // Kazmir
	430632: fc( - 0.2, 0.0, 0.4, 0.4, 0.5, 0.3, 0.0, 0.6, - 0.3, 0.1, 0.1, 0.5 ), // Aybar
	445010: fc( 0.3, - 0.2, - 0.4, 0.6, - 0.5, 0.2, 0.0, 0.5, - 0.3, 0.2, 0.3, - 0.2 ), // Fernando Perez
	// the umpires (older men: age adds its own) and the managers and coaches
	'-1': fc( 0.0, - 0.1, 0.5, 0.0, 0.7, 0.3, 0.4, 0.4, 0.0, 0.0, 0.3, 0.8 ),
	'-2': fc( 0.6, 0.2, - 0.1, 0.3, - 0.2, 0.4, 0.6, 0.0, 0.6, - 0.2, 0.4, 0.3 ),
	'-3': fc( - 0.1, - 0.3, 0.3, 0.3, 0.5, 0.4, 0.2, 0.7, - 0.3, 0.2, 0.2, 0.6 ),
	'-4': fc( 0.7, 0.5, 0.0, 0.4, - 0.4, 0.2, 0.5, - 0.1, 0.4, 0.0, 0.6, 0.2 ),
	'-5': fc( - 0.3, 0.0, 0.7, 0.1, 0.8, 0.2, 0.0, 0.3, 0.0, 0.1, 0.2, 0.9 ),
	'-6': fc( 0.2, 0.1, 0.2, 0.2, 0.3, 0.6, 0.3, 0.2, - 0.3, - 0.1, 0.3, 0.5 ),
	// Charlie Manuel: the big, heavy face, the big nose and ears (and age's jowls); Maddon's long face
	manuel: fc( 0.5, - 0.2, 0.5, 0.0, 0.9, 0.4, 1.0, 0.7, 0.3, 0.0, 1.0, 0.9 ),
	maddon: fc( 0.4, 0.1, - 0.2, 0.1, - 0.2, 0.2, 0.7, 0.0, 0.6, 0.0, 0.3, 0.0 ),
	lopes: fc( 0.1, 0.0, 0.2, 0.6, - 0.2, 0.3, 0.1, 0.6, - 0.2, 0.1, 0.4, 0.3 ),
	smith: fc( 0.3, 0.2, 0.3, 0.1, 0.2, 0.3, 0.4, 0.1, 0.3, - 0.1, 0.3, 0.4 ),
	hendrick: fc( 0.5, 0.0, 0.0, 0.6, - 0.3, 0.4, 0.2, 0.6, - 0.2, 0.2, 0.4, 0.2 ),
	foley: fc( 0.2, 0.3, 0.4, 0.2, 0.3, 0.2, 0.5, 0.2, 0.2, - 0.1, 0.4, 0.5 ),
	'r:moyer': fc( 0.3, 0.1, - 0.2, 0.1, - 0.4, 0.2, 0.4, - 0.1, 0.3, 0.0, 0.3, - 0.2 ),
	'r:hickey': fc( 0.1, 0.2, 0.3, 0.2, 0.3, 0.3, 0.4, 0.2, 0.2, 0.0, 0.3, 0.5 ),
};
//                     lips mouthW deep gonion
const MORE = {
	400058: [ - 0.5, 0.0, 0.6, 0.2 ], 434563: [ 0.4, 0.3, 0.0, 0.5 ], 400134: [ 0.0, 0.2, 0.3, 0.5 ], 400284: [ - 0.4, 0.1, 0.7, 0.6 ],
	429667: [ 0.7, 0.5, 0.1, 0.6 ], 276519: [ 0.5, 0.2, 0.0, - 0.3 ], 150029: [ - 0.2, 0.1, 0.5, 0.3 ], 150268: [ 0.4, 0.3, 0.3, 0.5 ],
	150100: [ - 0.2, 0.2, 0.6, 0.8 ], 430935: [ - 0.3, - 0.2, 0.0, - 0.5 ], 425664: [ 0.4, 0.4, - 0.2, 0.1 ], 132961: [ - 0.3, 0.0, 0.4, 0.3 ],
	425492: [ - 0.3, - 0.1, 0.3, - 0.2 ], 408307: [ 0.6, 0.2, - 0.1, - 0.2 ], 446334: [ - 0.1, 0.1, 0.5, 0.8 ], 425834: [ 0.5, 0.0, - 0.1, - 0.3 ],
	150289: [ 0.3, 0.3, 0.4, 0.6 ], 430583: [ - 0.4, - 0.3, 0.3, - 0.4 ], 425900: [ 0.4, 0.2, - 0.2, 0.2 ], 456034: [ 0.6, 0.2, 0.0, - 0.2 ],
	346797: [ - 0.4, 0.1, 0.7, 0.6 ], 493127: [ - 0.1, 0.1, - 0.6, 0.3 ], 408306: [ - 0.2, 0.0, 0.4, 0.3 ], 431148: [ - 0.2, - 0.2, 0.1, - 0.2 ],
	430632: [ 0.3, 0.2, 0.0, 0.4 ], 445010: [ 0.5, 0.1, - 0.1, - 0.2 ],
	'-1': [ 0.0, 0.2, 0.3, 0.4 ], '-2': [ - 0.4, 0.0, 0.4, 0.1 ], '-3': [ 0.4, 0.3, 0.2, 0.4 ], '-4': [ - 0.3, - 0.1, 0.5, 0.0 ],
	'-5': [ 0.1, 0.3, 0.1, 0.6 ], '-6': [ - 0.2, 0.1, 0.6, 0.3 ],
	manuel: [ 0.2, 0.3, 0.6, 0.3 ], maddon: [ - 0.3, 0.0, 0.3, 0.0 ], lopes: [ 0.4, 0.2, 0.2, 0.0 ], smith: [ - 0.2, 0.0, 0.3, 0.3 ],
	hendrick: [ 0.5, 0.2, 0.2, 0.1 ], foley: [ - 0.2, 0.1, 0.3, 0.4 ], 'r:moyer': [ - 0.3, 0.0, 0.3, - 0.1 ], 'r:hickey': [ - 0.1, 0.1, 0.3, 0.3 ],
};
for ( const [ id, m ] of Object.entries( MORE ) ) FACE_MORE.forEach( ( k, i ) => FACES[ id ][ k ] = m[ i ] );
for ( const [ id, f ] of Object.entries( FACES ) ) ( LOOKS[ id ] || STAFF[ id ] ).face = f;
// the jaw's width where the notes had none
Object.assign( LOOKS[ 400134 ], { jaw: 0.4 } );
Object.assign( LOOKS[ 425900 ], { jaw: 0.3 } );
Object.assign( LOOKS[ 425664 ], { jaw: 0.2 } );
Object.assign( LOOKS[ 408307 ], { jaw: - 0.1 } );
Object.assign( LOOKS[ 425834 ], { jaw: - 0.25 } );
Object.assign( LOOKS[ 430583 ], { jaw: - 0.3 } );
Object.assign( LOOKS[ 456034 ], { jaw: - 0.1 } );
Object.assign( LOOKS[ 346797 ], { jaw: 0.35 } );
Object.assign( LOOKS[ 493127 ], { jaw: 0.2 } );
Object.assign( LOOKS[ 132961 ], { jaw: 0.2 } );

// anyone else (the rest of the rosters, the crews, the bat boys): a face from his seed, within the range
// of the men above (a ball girl's softer)
function seededFace( seed, soft = false ) {

	const r = ( k ) => {

		const s = Math.sin( seed * 53.3 + k * 29.1 ) * 24634.6345;
		return s - Math.floor( s );

	};

	const f = Object.fromEntries( FACE_PACK.map( ( k, i ) => [ k, ( r( i + 1 ) * 2 - 1 ) * 0.6 ] ) );
	if ( soft ) Object.assign( f, { chin: - 0.3, chinW: - 0.5, brow: - 0.6, neck: - 0.8, full: 0.1, noseL: - 0.5, noseW: - 0.4 } );
	return f;

}

const keySeed = ( id ) => typeof id === 'number' ? id * 0.00731 : [ ...String( id ) ].reduce( ( a, c ) => ( a * 31 + c.charCodeAt( 0 ) ) % 9973, 7 ) * 0.0917;
// ---- end FY4

const CREW_SKINS = [ S.light, S.brown, S.ruddy, S.latin, S.fair, S.dark, S.tan, S.olive ];
const CREW_HAIR = [ H.brown, H.black, H.sandy, H.black, H.dark, H.black, H.dark, H.brown ];

// a look for anyone: a player by his id, the staff by their key, else something plausible from the seed
export function look( id, seed = 0 ) {

	const o = { ...BASE };
	const L = LOOKS[ id ] || STAFF[ id ];
	if ( L ) {

		Object.assign( o, L );
		if ( ! o.face ) o.face = seededFace( keySeed( id ), /^ballgirl/.test( id ) ); // ---- FY4
		return o;

	}
	// someone we have no notes on: from the seed
	const r = ( k ) => {

		const s = Math.sin( seed * 91.7 + k * 17.3 ) * 43758.5453;
		return s - Math.floor( s );

	};

	const i = Math.floor( r( 1 ) * CREW_SKINS.length );
	o.skin = CREW_SKINS[ i ];
	o.hair = CREW_HAIR[ i ];
	o.beard = [ 0, 1, 1, 2, 3, 4, 6, 1 ][ Math.floor( r( 2 ) * 8 ) ];
	// (---- FB4, C4B-4: 5'7" to 6'4" and slight to stout: the crew pushing the roll were twenty of one
	// height and build in the 27th's tight shots, where Getty 88457361 has them all sorts)
	o.height = 0.9 + r( 3 ) * 0.15;
	o.girth = 0.92 + r( 4 ) * 0.28;
	o.belly = r( 5 ) < 0.4 ? r( 6 ) * 0.5 : 0;
	o.jaw = r( 7 ) - 0.5;
	o.age = r( 8 );
	o.face = seededFace( seed + 0.5 + ( id != null ? keySeed( id ) : 0 ) ); // ---- FY4 (the coaches with no notes share a seed)
	return o;

}
