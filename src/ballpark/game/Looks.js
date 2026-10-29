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
// the head's own size (Rig.js' solvePose scales the head bone, the cap and helmet with it): the mesh's
// head is one size for everyone but for height; Howard's, Hinske's and Manuel's are big, Rollins' small
const HEAD = {
	429667: 1.045, 400134: 1.04, 434563: 1.025, 425900: 1.03, 150100: 1.03, 150289: 1.03, 346797: 1.02, 150268: 1.015,
	276519: 0.97, 430935: 0.98, 425834: 0.985, 430583: 0.97, 425664: 0.98, 493127: 0.98, 408307: 0.99, 456034: 0.99,
	'-1': 1.03, '-3': 1.02, '-5': 1.03, manuel: 1.05, lopes: 0.99,
};
for ( const [ id, h ] of Object.entries( HEAD ) ) ( LOOKS[ id ] || STAFF[ id ] ).head = h;
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

// a head's size where the notes give none: a little bigger with a full face and a thick neck
const headOf = ( f ) => 1 + 0.012 * ( ( f.full || 0 ) + ( f.neck || 0 ) );
const keySeed = ( id ) => typeof id === 'number' ? id * 0.00731 : [ ...String( id ) ].reduce( ( a, c ) => ( a * 31 + c.charCodeAt( 0 ) ) % 9973, 7 ) * 0.0917;
// ---- end FY4

// ---- FF3 (step 10): every man's face from MakeHuman's own targets (Faces.js; tools/build-body.mjs), as the
// fans' are: `mh`, his weights on MakeHuman's face modifiers (-1 the decrease's end, 1 the increase's), its
// head shapes (0..1), and the macros' share of the face: his African and Asian shares, his age (MakeHuman's
// old is about 90), his weight. FY4's sixteen numbers come across as the modifiers that do what they did
// (the lower face's length as the chin's height, the cheeks' flesh as their volume and the head's fat,
// the bridge as the nose's hump and Greek line, ...), each a little short of MakeHuman's caricature at its
// end; then the faces from the Series' photos on top (FF3_MH): Getty's 2008-10-29 set in .claude/ref/rituals/
// (Lidge 83485858 and 83485929, Feliz 83483794, Upton 83484235, Manuel 83483743, Howard 83884253, Rollins
// 94863165, Hamels 83486314, Balfour 83485159, Jenkins 83486414, Ruiz 83485955, Werth 83912493, Victorino
// 83571325, Burrell 83571337), FOX's (`.claude/ref/gauntlet/play/`) and the men's well-known looks
const ETH_OF = new Map( [ [ S.fair, [ 0.0, 0.0 ] ], [ S.light, [ 0.01, 0.01 ] ], [ S.ruddy, [ 0.0, 0.0 ] ], [ S.olive, [ 0.08, 0.04 ] ],
	[ S.tan, [ 0.3, 0.12 ] ], [ S.latin, [ 0.42, 0.06 ] ], [ S.brown, [ 0.72, 0.03 ] ], [ S.dark, [ 0.86, 0.02 ] ], [ S.deep, [ 0.92, 0.02 ] ], [ S.asian, [ 0.03, 0.88 ] ] ] );
function mhOf( o ) {

	const f = o.face || {}, v = ( k ) => f[ k ] || 0;
	const [ af, as ] = ETH_OF.get( o.skin ) || [ 0.2, 0.1 ];
	const mh = {
		african: af, asian: as,
		// (the look's age: 0 a rookie of 22 .. 1 Manuel's 64)
		old: Math.max( 0, ( 22 + 42 * ( o.age ?? 0.2 ) - 25 ) / 65 ),
		weight: Math.max( - 1, Math.min( 1, ( ( o.girth || 1 ) - 1 ) * 3 + ( o.belly || 0 ) * 0.6 ) ),
		'chin-height': 0.75 * v( 'jawL' ), 'chin-out': 0.8 * v( 'chin' ), 'chin-width': 0.75 * v( 'chinW' ),
		cheekbones: 0.8 * v( 'cheek' ), cheeks: 0.7 * v( 'full' ), 'head-fat': 0.45 * v( 'full' ),
		'brow-ridge': 0.55 * v( 'brow' ), 'nose-length': 0.6 * v( 'noseL' ), 'nose-out': 0.35 * v( 'noseL' ),
		'nose-width': 0.6 * v( 'noseW' ), 'nose-nostrils': 0.45 * v( 'noseW' ), 'nose-flare': 0.3 * v( 'noseW' ),
		'nose-hump': 0.35 * v( 'bridge' ), 'nose-greek': 0.45 * v( 'bridge' ), 'eye-spacing': 0.6 * v( 'eyes' ),
		'ear-size': 0.55 * v( 'ears' ), 'ear-out': 0.35 * v( 'ears' ), 'neck-width': 0.45 * v( 'neck' ),
		'lip-upper': 0.55 * v( 'lips' ), 'lip-lower': 0.7 * v( 'lips' ), 'mouth-width': 0.6 * v( 'mouthW' ),
		'eye-deep': 0.7 * v( 'deep' ), jaw: 0.65 * v( 'gonion' ),
	};
	// age's own, past the macro's: the lids' bags, the lobes, the neck's fold
	const aged = Math.max( 0, ( o.age ?? 0.2 ) - 0.45 ) / 0.55;
	if ( aged > 0 ) Object.assign( mh, { 'eye-bag': 0.5 * aged, 'ear-lobe': 0.4 * aged, 'neck-double': 0.35 * aged * Math.max( 0.3, mh.weight + 0.5 ) } );
	return Object.assign( mh, o.mhFit || {} );

}
// the men from the photos: what FY4's numbers can't say (his face's mix, the eyes' fold and lids, the nose's
// line, the mouth's set, the head's shape)
const FF3_MH = {
	// Lidge: a long, lean face with a strong, jutting chin under the goatee, deep-set eyes under a straight
	// brow, a long straight nose, thin lips (Getty 83485858, 83485929)
	400058: { 'shape-rectangular': 0.45, 'nose-curve': - 0.2, 'mouth-height': - 0.2, 'eye-fold': 0.3, 'brow-angle': - 0.25, prognathism: 0.2, 'cheek-inner': - 0.3 },
	// Ruiz: Panamanian; a broad, round face, heavy-lidded eyes, a wide nose, full lips (83485955)
	434563: { african: 0.38, asian: 0.06, 'shape-round': 0.55, 'eye-size': - 0.3, 'eye-fold': 0.4, 'nose-height': - 0.2, 'cheek-height': - 0.2 },
	// Hinske: a big round head, the red beard over a heavy jaw, small eyes
	400134: { 'shape-round': 0.4, 'eye-size': - 0.35, 'nose-volume': 0.3, 'neck-double': 0.3 },
	// Utley: angular, high cheekbones over hollow cheeks, a heavy brow, a flared jaw, narrow-set eyes, a
	// straight nose (83485866; johnpaulendicott 2987990948)
	400284: { 'shape-diamond': 0.35, 'cheek-inner': - 0.5, 'eye-size': - 0.2, 'nose-curve': - 0.15, 'mouth-angles': - 0.2 },
	// Howard: a big round face, broad nose and full lips, heavy cheeks, a thick neck (83884253)
	429667: { 'shape-round': 0.6, 'eye-size': - 0.15, 'nose-height': - 0.25, 'mouth-out': 0.3, 'neck-double': 0.25 },
	// Rollins: a narrow face, high cheekbones, a small chin, a wide nose, big ears (94863165)
	276519: { 'shape-invertedtriangular': 0.5, 'nose-height': - 0.2, 'mouth-out': 0.35, 'eye-size': 0.15 },
	// Werth: a long face, a long nose with a hump, hooded eyes (83912493)
	150029: { 'shape-oval': 0.4, 'nose-curve': 0.35, 'eye-fold': 0.4, 'nose-tip': - 0.25 },
	// Feliz: Dominican; broad cheekbones and a broad nose, a heavy jaw, sleepy lids (83483794)
	150268: { african: 0.5, asian: 0.04, 'shape-square': 0.35, 'eye-fold': 0.45, 'nose-height': - 0.2, 'mouth-out': 0.25 },
	// Burrell: a square jaw and heavy brow, dark deep-set eyes, a strong nose (83571337)
	150100: { 'shape-square': 0.6, 'nose-curve': 0.2, 'brow-angle': - 0.3, 'eye-fold': 0.25 },
	// Hamels: narrow and fine, big eyes, a straight nose, a soft chin (83486314)
	430935: { 'shape-oval': 0.5, 'eye-size': 0.35, 'nose-point': - 0.3, 'cheek-inner': - 0.2, 'forehead-vert': 0.2 },
	// Victorino: Hawaiian, of Portuguese, Japanese and native Hawaiian descent; a round face, wide
	// cheekbones, narrow eyes, a broad nose (83571325)
	425664: { african: 0.18, asian: 0.42, 'shape-round': 0.35, 'eye-epicanthus': 0.35, 'eye-size': - 0.2, 'eye-fold': 0.3 },
	// Jenkins: a long face, a square chin, a straight nose (83486414)
	132961: { 'shape-rectangular': 0.4, 'nose-curve': - 0.1, 'eye-fold': 0.2 },
	// Madson: long and lean, a long chin, a narrow nose
	425492: { 'shape-oval': 0.45, 'nose-point': - 0.3, 'cheek-inner': - 0.35 },
	// Crawford: a lean face, high cheekbones, a broad nose and full lips
	408307: { african: 0.9, 'shape-diamond': 0.25, 'mouth-out': 0.3, 'nose-height': - 0.15 },
	// Longoria: Mexican-American; a square jaw, a heavy brow, a strong straight nose
	446334: { african: 0.06, asian: 0.08, 'shape-square': 0.55, 'nose-curve': 0.1, 'eye-fold': 0.3 },
	// Upton: a long, lean face, high cheekbones, a wide nose (83484235)
	425834: { african: 0.8, 'shape-oval': 0.5, 'cheek-inner': - 0.3, 'mouth-out': 0.3 },
	// Pena: Dominican; a broad, heavy face, a big nose, the brow heavy
	150289: { african: 0.35, asian: 0.04, 'shape-square': 0.45, 'nose-volume': 0.35, 'nose-curve': 0.2, 'eye-fold': 0.3 },
	// Bartlett: a narrow, pointed face, small eyes
	430583: { 'shape-triangular': 0.4, 'eye-size': - 0.25, 'nose-point': - 0.2 },
	// Navarro: Venezuelan; round and fleshy, a broad nose, a small chin
	425900: { african: 0.25, asian: 0.08, 'shape-round': 0.65, 'neck-double': 0.35, 'eye-size': - 0.2 },
	// Price: a long face, a broad nose and full lips, big ears
	456034: { african: 0.85, 'shape-oval': 0.45, 'mouth-out': 0.3, 'eye-size': 0.1 },
	// Balfour: a square, rugged face, a heavy brow, a broken boxer's nose (83485159)
	346797: { 'shape-square': 0.5, 'nose-curve': 0.25, 'nose-hump': 0.4, 'brow-angle': - 0.35, 'eye-fold': 0.35 },
	// Iwamura: a flat bridge and wide cheekbones, the eyes' epicanthic fold
	493127: { asian: 0.95, african: 0.0, 'shape-round': 0.3, 'eye-epicanthus': 0.6, 'eye-fold': 0.6, 'nose-greek': - 0.4 },
	// Baldelli: a long Italian face, a strong nose
	408306: { 'shape-oval': 0.35, 'nose-curve': 0.3, 'eye-fold': 0.25 },
	// Kazmir: youthful, a soft round chin, big eyes
	431148: { 'shape-oval': 0.3, 'eye-size': 0.3, 'cheeks': 0.2 },
	// Aybar and Fernando Perez: Dominican
	430632: { african: 0.5, 'shape-square': 0.3, 'eye-fold': 0.35 },
	445010: { african: 0.7, 'shape-oval': 0.35 },
	// the umpires and the coaches: older faces
	'-1': { 'shape-round': 0.4 }, '-2': { 'shape-rectangular': 0.4, 'nose-curve': 0.3 }, '-3': { african: 0.75, 'shape-round': 0.3 },
	'-4': { 'shape-oval': 0.45, 'nose-curve': 0.2 }, '-5': { 'shape-square': 0.5 }, '-6': { 'shape-diamond': 0.3, 'eye-fold': 0.3 },
	// Manuel: big and heavy, the big fleshy nose, jowls, big ears, heavy lids (83483743)
	manuel: { 'shape-square': 0.4, 'nose-volume': 0.6, 'nose-flare': 0.4, 'eye-fold': 0.55, 'eye-size': - 0.25, 'neck-double': 0.6, 'mouth-angles': - 0.3 },
	// Maddon: a long face behind his glasses, a long nose
	maddon: { 'shape-oval': 0.4, 'nose-curve': 0.3, 'eye-bag': 0.6 },
	lopes: { african: 0.8, 'shape-oval': 0.3 }, hendrick: { african: 0.88, 'shape-rectangular': 0.35 },
	smith: { 'shape-square': 0.3 }, foley: { 'shape-round': 0.3 }, 'r:moyer': { 'shape-oval': 0.4, 'eye-fold': 0.3 }, 'r:hickey': { 'shape-square': 0.3 },
};
// the ball girls: young women's faces (the body's a man's)
FF3_MH.ballgirl = { female: 0.9, 'shape-oval': 0.4, 'eye-size': 0.2 };
FF3_MH.ballgirl2 = { female: 0.9, 'shape-round': 0.3, 'eye-size': 0.15, african: 0.12 };
for ( const [ id, m ] of Object.entries( FF3_MH ) ) ( LOOKS[ id ] || STAFF[ id ] ).mhFit = m;
// ---- end FF3

const CREW_SKINS = [ S.light, S.brown, S.ruddy, S.latin, S.fair, S.dark, S.tan, S.olive ];
const CREW_HAIR = [ H.brown, H.black, H.sandy, H.black, H.dark, H.black, H.dark, H.brown ];

// a look for anyone: a player by his id, the staff by their key, else something plausible from the seed
export function look( id, seed = 0 ) {

	const o = { ...BASE };
	const L = LOOKS[ id ] || STAFF[ id ];
	if ( L ) {

		Object.assign( o, L );
		if ( ! o.face ) o.face = seededFace( keySeed( id ), /^ballgirl/.test( id ) ); // ---- FY4
		o.head ??= headOf( o.face ); // ---- FY4
		o.id = id; // ---- FF3
		o.mh = mhOf( o ); // ---- FF3
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
	o.head = headOf( o.face ); // ---- FY4
	o.mh = mhOf( o ); // ---- FF3
	return o;

}
