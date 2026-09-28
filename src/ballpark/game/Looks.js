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
	manuel: { skin: S.ruddy, hair: H.white, beard: 0, stubble: 0.2, height: ht( 6, 3 ), girth: 1.2, belly: 0.75, age: 1, jaw: 0.5 },
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
	// the Phillie Phanatic: 6'6" of green fur and belly
	phanatic: { skin: [ 0.06, 0.3, 0.035 ], hair: [ 0.06, 0.3, 0.035 ], beard: 0, stubble: 0, height: 1.02, girth: 1.3, belly: 1.6, age: 0, socks: 'high' },
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

const CREW_SKINS = [ S.light, S.brown, S.ruddy, S.latin, S.fair, S.dark, S.tan, S.olive ];
const CREW_HAIR = [ H.brown, H.black, H.sandy, H.black, H.dark, H.black, H.dark, H.brown ];

// a look for anyone: a player by his id, the staff by their key, else something plausible from the seed
export function look( id, seed = 0 ) {

	const o = { ...BASE };
	const L = LOOKS[ id ] || STAFF[ id ];
	if ( L ) return Object.assign( o, L );
	// someone we have no notes on: from the seed
	const r = ( k ) => {

		const s = Math.sin( seed * 91.7 + k * 17.3 ) * 43758.5453;
		return s - Math.floor( s );

	};

	const i = Math.floor( r( 1 ) * CREW_SKINS.length );
	o.skin = CREW_SKINS[ i ];
	o.hair = CREW_HAIR[ i ];
	o.beard = [ 0, 1, 1, 2, 3, 4, 6, 1 ][ Math.floor( r( 2 ) * 8 ) ];
	o.height = 0.93 + r( 3 ) * 0.1;
	o.girth = 0.95 + r( 4 ) * 0.2;
	o.belly = r( 5 ) < 0.4 ? r( 6 ) * 0.5 : 0;
	o.jaw = r( 7 ) - 0.5;
	o.age = r( 8 );
	return o;

}
