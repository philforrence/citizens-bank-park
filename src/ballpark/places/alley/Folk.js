import { Cast, TOP as T, COLOR, HAT as CH, CHEST, BACK, PROP as CP, sign } from '../Cast.js';
import { armFK } from '../Concourse3BKit.js';

// The Alley's people, drawn by the park's one figure system (places/Cast.js). The Alley's code places
// them and moves each between two poses of a pair by k (a stride's two halves, a hand going up to heckle,
// arms thrown up at the last out, a cheesesteak handed over the counter), and gives them things to hold
// (a homemade sign, a beer, a hoagie, an umbrella, a kid's glove, a camera, a Rays fan's cowbell); here
// each pose is solved once into Cast's angles (the arms to the same hands and elbows, the lean, the head,
// the legs, the drop onto a bench) and a person drawn between the two, with a face, a build, the cold in
// the cheeks, and the rain on them if they're out in it.
//
//   const folk = new Folk( parent, { signs } );
//   const p = folk.add( 'lean', { x, y, z, yaw, look: { top: TOP.redHoodie, hat: HAT.cap, jersey: 'UTLEY' } } );
//   p.k = 0.7;  p.x += 1;  folk.hold( p, 'sign', { sign: 2 } );
//   folk.build();  folk.update();   (after moving people: every frame)

// ---------------------------------------------------------------- who they are

// the top (what shows): the Alley's wardrobe, dressed in Cast's (castLook below)
export const TOP = {
	redHoodie: 0, // a Phillies red hooded sweatshirt, PHILLIES across the chest
	redJacket: 1, // a red nylon Phillies jacket, the script on the chest (glossy)
	homeJersey: 2, // a replica home white pinstripe jersey over a red hoodie (the number on the back)
	roadJersey: 3, // a replica road grey, the name and the number
	greyHoodie: 4, // a heather grey hoodie, PHILLIES in red
	leather: 5, // a black leather jacket
	parka: 6, // a navy parka, long
	eagles: 7, // an Eagles jacket, midnight green (it's Philadelphia)
	carhartt: 8, // a brown duck work jacket
	powderBlue: 9, // a 1980 powder blue throwback, SCHMIDT 20
	flyers: 10, // a Flyers jacket, orange and black
	rays: 11, // a Rays fan: navy and Columbia blue
	staff: 12, // concession staff: a red polo, a black apron
	security: 13, // event security: black jacket, the hi-vis vest
	usher: 14, // an usher: red jacket, khakis
	bull: 15, // Greg Luzinski: a red Phillies polo over a white turtleneck
	kidRed: 16, // a kid's red Phillies jacket
	cook: 17, // the pit crew at Bull's: a black t-shirt over long sleeves, a red apron
	wsShirt: 18, // a red long-sleeved World Series 2008 t-shirt
	camo: 19, // a hunting jacket (a South Philly dad)
};
export const HAT = { none: 0, cap: 1, beanie: 2, wsCap: 3, raysCap: 4, hood: 5, staffCap: 6, greyBeanie: 7, backwards: 8, bald: 9, cabbie: 10 };
export const PANTS = { jeans: 0, khaki: 1, black: 2, sweats: 3, dark: 4 };
const FLAG = { poncho: 1, kid: 2, glasses: 4, beard: 8, woman: 16, open: 32, mustache: 64 };
export { FLAG };

// the jerseys' keys: the Cast back each wears ('-R': the road greys)
const JERSEY = {
	UTLEY: 'UTLEY', HOWARD: 'HOWARD', ROLLINS: 'ROLLINS', HAMELS: 'HAMELS', VICTORINO: 'VICTORINO', LIDGE: 'LIDGE', WERTH: 'WERTH',
	BURRELL: 'BURRELL', MYERS: 'MYERS', RUIZ: 'RUIZ', 'UTLEY-R': 'UTLEY', 'HOWARD-R': 'HOWARD', 'ROLLINS-R': 'ROLLINS', 'HAMELS-R': 'HAMELS',
	SCHMIDT: 'SCHMIDT', CARLTON: 'CARLTON', ASHBURN: 'ASHBURN', LONGORIA: 'LONGORIA', CRAWFORD: 'CRAWFORD', DAWKINS: 'DAWKINS',
	MCNABB: 'MCNABB', BULL: 'LUZINSKI',
};

const h = ( seed, k ) => {

	const s = Math.sin( seed * 12.9898 * k + 78.233 * k ) * 43758.5453;
	return s - Math.floor( s );

};

// the Alley's look as Cast's (the seed chooses the small things: skin, hair, a build, the shoes)
function castLook( L, seed ) {

	const r = ( k ) => h( seed, k );
	const kid = !! L.kid, woman = !! L.woman;
	const old = ! kid && r( 3 ) < 0.12;
	const si = r( 1 );
	const o = {
		skin: si > 0.88 ? 6 : si > 0.76 ? 5 : si > 0.55 ? 3 : [ 0, 1, 2 ][ Math.floor( r( 2 ) * 3 ) ],
		hair: old ? ( r( 4 ) < 0.5 ? 6 : 7 ) : woman && r( 5 ) > 0.6 ? 3 : [ 0, 1, 2, 3, 4 ][ Math.floor( r( 5 ) * 5 ) ],
		hairStyle: woman ? ( r( 6 ) < 0.6 ? 1 : 2 ) : L.hat === HAT.bald ? 3 : old && r( 7 ) < 0.3 ? 3 : 0,
		facial: L.beard ? 3 : L.mustache ? 1 : ! woman && ! kid && r( 8 ) < 0.16 ? 4 : 0,
		glasses: !! L.glasses, female: woman, age: kid ? 2 : old ? 1 : 0,
		build: L.build ?? ( kid ? 0 : Math.floor( r( 9 ) * ( woman ? 2.2 : 4 ) ) & 3 ),
		pants: [ 0, 2, 3, 4, 1 ][ L.pants ?? 0 ] ?? 0,
		shoes: r( 10 ) < 0.3 ? 0 : [ 1, 2, 3, 4 ][ Math.floor( r( 11 ) * 4 ) ],
		scarf: r( 12 ) < 0.12 ? [ 1, 2, 3 ][ Math.floor( r( 13 ) * 3 ) ] : 0, gloves: r( 14 ) < 0.15,
		top: T.jacket, color: COLOR.red, sleeves: COLOR.grey, back: 0, chest: 0, hat: CH.none, poncho: 0,
		seed: Math.floor( seed * 65536 ) & 65535,
	};
	const back = L.jersey ? BACK[ JERSEY[ L.jersey ] ] || 0 : 0;
	switch ( L.top ?? 0 ) {

		case TOP.redHoodie: Object.assign( o, { top: T.hoodie, color: COLOR.red, chest: CHEST.block } ); break;
		case TOP.redJacket: Object.assign( o, { top: T.jacket, color: COLOR.red, chest: CHEST.script } ); break;
		case TOP.homeJersey: Object.assign( o, { top: T.homeJersey, color: COLOR.white, back, chest: CHEST.script, sleeves: COLOR.red } ); break;
		case TOP.roadJersey: Object.assign( o, { top: T.roadJersey, color: COLOR.lightGrey, back, chest: CHEST.block, sleeves: r( 15 ) < 0.5 ? COLOR.grey : COLOR.red } ); break;
		case TOP.greyHoodie: Object.assign( o, { top: T.hoodie, color: COLOR.grey, chest: CHEST.block } ); break;
		case TOP.leather: Object.assign( o, { top: T.leather, color: COLOR.black } ); break;
		case TOP.parka: Object.assign( o, { top: T.coat, color: r( 16 ) < 0.6 ? COLOR.navy : COLOR.black } ); break;
		case TOP.eagles: Object.assign( o, { top: T.eagles, color: COLOR.green, chest: CHEST.eagles, back } ); break;
		case TOP.carhartt: Object.assign( o, { top: T.work, color: COLOR.brown } ); break;
		case TOP.powderBlue: Object.assign( o, { top: T.powder, color: COLOR.powder, sleeves: COLOR.powder, back } ); break;
		case TOP.flyers: Object.assign( o, { top: T.flyers, color: COLOR.orange, chest: CHEST.flyers } ); break;
		case TOP.rays: Object.assign( o, { top: T.rays, color: COLOR.raysNavy, sleeves: COLOR.powder, chest: CHEST.rays, back } ); break;
		case TOP.staff: Object.assign( o, { top: T.staff, color: COLOR.red, sleeves: COLOR.red, chest: CHEST.staff, scarf: 0 } ); break;
		case TOP.security: Object.assign( o, { top: T.security, color: COLOR.black, sleeves: COLOR.black, chest: CHEST.security, scarf: 0 } ); break;
		case TOP.usher: Object.assign( o, { top: T.usher, color: COLOR.red, sleeves: COLOR.red, scarf: 0 } ); break;
		case TOP.bull: Object.assign( o, { top: T.polo, color: COLOR.red, sleeves: COLOR.white, chest: CHEST.staff, scarf: 0 } ); break;
		case TOP.kidRed: Object.assign( o, { top: T.jacket, color: COLOR.red, chest: CHEST.script } ); break;
		case TOP.cook: Object.assign( o, { top: T.seller, color: COLOR.black, sleeves: COLOR.grey, chest: CHEST.bulls, scarf: 0 } ); break;
		case TOP.wsShirt: Object.assign( o, { top: T.champsTee, color: COLOR.red, sleeves: COLOR.red, chest: CHEST.ws } ); break;
		case TOP.camo: Object.assign( o, { top: T.camo, color: COLOR.olive } ); break;

	}

	o.hat = [ CH.none, CH.capRed, r( 17 ) > 0.8 ? CH.knitPlain : CH.knitRed, CH.capWS, CH.capRays, CH.hood, CH.capBlack, CH.knitGrey, CH.capBack, CH.none, CH.cabbie ][ L.hat ?? 0 ];
	if ( L.hat === HAT.bald ) o.hairStyle = 3;
	// a clear poncho over it all (the 27th), a red one now and then; the hood up under it
	if ( L.poncho ) o.poncho = r( 18 ) > 0.6 ? 2 : 1;
	// out in the rain they're wet; under the stands' canopies they stay dry
	o.dry = ! L.open;
	return o;

}

// ---------------------------------------------------------------- poses

// the joints for the right side (+x); the left mirrors x unless the pose gives it its own ('L:' prefix).
// Origin on the ground between the feet, facing -z
const BASE = {
	hip: [ 0.1, 0.9, 0.0 ], knee: [ 0.11, 0.5, - 0.02 ], ankle: [ 0.12, 0.08, 0.0 ], toe: [ 0.13, 0.04, - 0.15 ],
	pelvis: [ 0, 0.88, 0.02 ], chest: [ 0, 1.38, 0.03 ], neck: [ 0, 1.45, 0.03 ], head: [ 0, 1.58, 0.02 ],
	shoulder: [ 0.2, 1.37, 0.03 ], elbow: [ 0.23, 1.1, 0.06 ], wrist: [ 0.22, 0.86, 0.02 ], hand: [ 0.21, 0.77, 0.01 ],
};

const seated = ( H, upper ) => ( {
	pelvis: [ 0, H + 0.12, 0.06 ], hip: [ 0.1, H + 0.1, 0.03 ], knee: [ 0.13, H + 0.08, - 0.4 ], ankle: [ 0.14, 0.08, - 0.44 ], toe: [ 0.15, 0.04, - 0.58 ],
	'L:knee': [ - 0.12, H + 0.07, - 0.41 ], 'L:ankle': [ - 0.13, 0.08, - 0.4 ], 'L:toe': [ - 0.14, 0.04, - 0.54 ],
	...upper( H ),
} );
const both = ( o ) => {

	// the same joints on the left, mirrored
	const out = { ...o };
	for ( const [ k, v ] of Object.entries( o ) ) if ( ! k.startsWith( 'L:' ) && [ 'shoulder', 'elbow', 'wrist', 'hand' ].includes( k ) ) out[ 'L:' + k ] = [ - v[ 0 ], v[ 1 ], v[ 2 ] ];
	return out;

};

export const POSES = {
	stand: {},
	// talking with his hands: the right forearm up, the palm open
	talk: { elbow: [ 0.25, 1.12, - 0.04 ], wrist: [ 0.22, 1.26, - 0.27 ], hand: [ 0.19, 1.3, - 0.35 ] },
	// hands in his jacket's pockets, the weight on one leg
	pockets: {
		elbow: [ 0.25, 1.1, 0.02 ], wrist: [ 0.17, 0.95, - 0.1 ], hand: [ 0.14, 0.92, - 0.13 ],
		'L:elbow': [ - 0.25, 1.1, 0.02 ], 'L:wrist': [ - 0.17, 0.95, - 0.1 ], 'L:hand': [ - 0.14, 0.92, - 0.13 ],
		'L:knee': [ - 0.1, 0.5, - 0.06 ], 'L:ankle': [ - 0.15, 0.08, - 0.05 ], 'L:toe': [ - 0.2, 0.04, - 0.18 ],
	},
	// a stride's two halves (Cast walks them with its own stride: these are for handAt)
	walkA: {
		knee: [ 0.11, 0.52, - 0.2 ], ankle: [ 0.12, 0.1, - 0.28 ], toe: [ 0.13, 0.05, - 0.43 ],
		'L:knee': [ - 0.11, 0.47, 0.12 ], 'L:ankle': [ - 0.12, 0.16, 0.26 ], 'L:toe': [ - 0.13, 0.06, 0.13 ],
		elbow: [ 0.23, 1.11, 0.1 ], wrist: [ 0.22, 0.9, 0.16 ], hand: [ 0.21, 0.82, 0.19 ],
		'L:elbow': [ - 0.23, 1.11, - 0.08 ], 'L:wrist': [ - 0.22, 0.89, - 0.16 ], 'L:hand': [ - 0.21, 0.8, - 0.2 ],
	},
	walkB: {
		'L:knee': [ - 0.11, 0.52, - 0.2 ], 'L:ankle': [ - 0.12, 0.1, - 0.28 ], 'L:toe': [ - 0.13, 0.05, - 0.43 ],
		knee: [ 0.11, 0.47, 0.12 ], ankle: [ 0.12, 0.16, 0.26 ], toe: [ 0.13, 0.06, 0.13 ],
		'L:elbow': [ - 0.23, 1.11, 0.1 ], 'L:wrist': [ - 0.22, 0.9, 0.16 ], 'L:hand': [ - 0.21, 0.82, 0.19 ],
		elbow: [ 0.23, 1.11, - 0.08 ], wrist: [ 0.22, 0.89, - 0.16 ], hand: [ 0.21, 0.8, - 0.2 ],
	},
	// forearms folded on a rail 1.07 m up (the Alley's over the pens), bent over it, looking down
	lean: {
		pelvis: [ 0, 0.86, 0.1 ], hip: [ 0.1, 0.88, 0.1 ], knee: [ 0.11, 0.49, 0.02 ], ankle: [ 0.12, 0.08, 0.06 ], toe: [ 0.13, 0.04, - 0.09 ],
		chest: [ 0, 1.27, - 0.16 ], neck: [ 0, 1.33, - 0.21 ], head: [ 0, 1.42, - 0.28 ],
		shoulder: [ 0.2, 1.26, - 0.16 ], elbow: [ 0.24, 1.12, - 0.36 ], wrist: [ - 0.02, 1.13, - 0.42 ], hand: [ - 0.1, 1.13, - 0.41 ],
		'L:shoulder': [ - 0.2, 1.26, - 0.16 ], 'L:elbow': [ - 0.24, 1.13, - 0.35 ], 'L:wrist': [ 0.03, 1.15, - 0.4 ], 'L:hand': [ 0.11, 1.15, - 0.39 ],
	},
	// the same, the right arm out over the rail, pointing down into the pen (the heckle)
	leanPoint: {
		pelvis: [ 0, 0.86, 0.1 ], hip: [ 0.1, 0.88, 0.1 ], knee: [ 0.11, 0.49, 0.02 ], ankle: [ 0.12, 0.08, 0.06 ], toe: [ 0.13, 0.04, - 0.09 ],
		chest: [ 0, 1.29, - 0.14 ], neck: [ 0, 1.36, - 0.19 ], head: [ 0, 1.46, - 0.25 ],
		shoulder: [ 0.2, 1.3, - 0.14 ], elbow: [ 0.28, 1.25, - 0.42 ], wrist: [ 0.32, 1.16, - 0.68 ], hand: [ 0.33, 1.12, - 0.77 ],
		'L:shoulder': [ - 0.2, 1.28, - 0.14 ], 'L:elbow': [ - 0.24, 1.13, - 0.35 ], 'L:wrist': [ 0.03, 1.15, - 0.4 ], 'L:hand': [ 0.11, 1.15, - 0.39 ],
	},
	// both hands on the rail, arms straight, looking out
	rail: both( {
		chest: [ 0, 1.37, - 0.05 ], neck: [ 0, 1.44, - 0.07 ], head: [ 0, 1.56, - 0.1 ],
		shoulder: [ 0.2, 1.36, - 0.05 ], elbow: [ 0.25, 1.2, - 0.2 ], wrist: [ 0.26, 1.08, - 0.33 ], hand: [ 0.26, 1.06, - 0.4 ],
	} ),
	// both arms thrown up
	cheer: both( {
		chest: [ 0, 1.39, 0.04 ], neck: [ 0, 1.46, 0.05 ], head: [ 0, 1.59, 0.05 ],
		shoulder: [ 0.2, 1.39, 0.04 ], elbow: [ 0.31, 1.64, 0.02 ], wrist: [ 0.33, 1.9, - 0.02 ], hand: [ 0.32, 2.0, - 0.03 ],
	} ),
	// clapping, the hands together in front of the chest
	clap: both( { elbow: [ 0.27, 1.14, - 0.12 ], wrist: [ 0.09, 1.28, - 0.3 ], hand: [ 0.03, 1.31, - 0.33 ] } ),
	// a sign held up in both hands at head height, then pumped up over it
	sign: both( { elbow: [ 0.31, 1.33, - 0.14 ], wrist: [ 0.29, 1.56, - 0.26 ], hand: [ 0.27, 1.63, - 0.28 ] } ),
	signHigh: both( { elbow: [ 0.31, 1.62, - 0.1 ], wrist: [ 0.29, 1.88, - 0.2 ], hand: [ 0.27, 1.95, - 0.22 ] } ),
	// on a bench 0.45 m up, the hands in the lap; eating (the right hand to the mouth)
	sit: seated( 0.45, ( H ) => ( {
		chest: [ 0, H + 0.6, 0.1 ], neck: [ 0, H + 0.67, 0.1 ], head: [ 0, H + 0.79, 0.08 ],
		shoulder: [ 0.2, H + 0.58, 0.1 ], elbow: [ 0.24, H + 0.34, 0.0 ], wrist: [ 0.17, H + 0.3, - 0.22 ], hand: [ 0.14, H + 0.3, - 0.3 ],
		'L:elbow': [ - 0.24, H + 0.34, 0.0 ], 'L:wrist': [ - 0.17, H + 0.3, - 0.22 ], 'L:hand': [ - 0.14, H + 0.3, - 0.3 ],
	} ) ),
	sitEat: seated( 0.45, ( H ) => ( {
		chest: [ 0, H + 0.59, 0.06 ], neck: [ 0, H + 0.66, 0.04 ], head: [ 0, H + 0.77, 0.01 ],
		shoulder: [ 0.2, H + 0.57, 0.06 ], elbow: [ 0.25, H + 0.36, - 0.14 ], wrist: [ 0.1, H + 0.62, - 0.2 ], hand: [ 0.05, H + 0.7, - 0.15 ],
		'L:elbow': [ - 0.24, H + 0.34, 0.0 ], 'L:wrist': [ - 0.17, H + 0.3, - 0.22 ], 'L:hand': [ - 0.14, H + 0.3, - 0.3 ],
	} ) ),
	// both hands out over a counter: taking a tray, handing it over
	reach: both( { chest: [ 0, 1.37, - 0.02 ], neck: [ 0, 1.44, - 0.04 ], head: [ 0, 1.56, - 0.06 ], elbow: [ 0.2, 1.17, - 0.18 ], wrist: [ 0.15, 1.16, - 0.42 ], hand: [ 0.12, 1.16, - 0.5 ] } ),
	// carrying food in both hands at the waist; a drink to the mouth
	carry: both( { elbow: [ 0.24, 1.08, - 0.02 ], wrist: [ 0.15, 1.04, - 0.28 ], hand: [ 0.11, 1.04, - 0.34 ] } ),
	drink: { elbow: [ 0.24, 1.14, - 0.1 ], wrist: [ 0.1, 1.36, - 0.15 ], hand: [ 0.06, 1.44, - 0.12 ], 'L:elbow': [ - 0.24, 1.08, - 0.02 ], 'L:wrist': [ - 0.15, 1.04, - 0.28 ], 'L:hand': [ - 0.11, 1.04, - 0.34 ] },
	// a camera (or a flip phone) up to the face in both hands; a phone to the ear
	photo: both( { elbow: [ 0.26, 1.3, - 0.16 ], wrist: [ 0.1, 1.47, - 0.24 ], hand: [ 0.05, 1.52, - 0.25 ] } ),
	phone: { elbow: [ 0.28, 1.3, - 0.02 ], wrist: [ 0.15, 1.5, - 0.03 ], hand: [ 0.1, 1.56, - 0.01 ] },
	// a dad with his kid up on his shoulders, holding the kid's shins; then his free arm up
	shoulders: both( { elbow: [ 0.3, 1.46, 0.0 ], wrist: [ 0.22, 1.6, - 0.03 ], hand: [ 0.17, 1.64, - 0.03 ] } ),
	shouldersUp: { elbow: [ 0.3, 1.46, 0.0 ], wrist: [ 0.22, 1.6, - 0.03 ], hand: [ 0.17, 1.64, - 0.03 ], 'L:elbow': [ - 0.31, 1.64, 0.02 ], 'L:wrist': [ - 0.33, 1.9, - 0.02 ], 'L:hand': [ - 0.32, 2.0, - 0.03 ] },
	// the kid up there: astride the neck (his origin 1.45 m under the seat), legs down over the chest
	ride: {
		pelvis: [ 0, 0.95, 0.06 ], hip: [ 0.1, 0.93, 0.04 ], knee: [ 0.17, 0.86, - 0.16 ], ankle: [ 0.16, 0.52, - 0.14 ], toe: [ 0.16, 0.47, - 0.26 ],
		chest: [ 0, 1.38, 0.05 ], neck: [ 0, 1.45, 0.05 ], head: [ 0, 1.58, 0.04 ],
		shoulder: [ 0.2, 1.37, 0.05 ], elbow: [ 0.25, 1.12, - 0.02 ], wrist: [ 0.12, 1.02, - 0.12 ], hand: [ 0.05, 1.0, - 0.12 ],
	},
	rideUp: {
		pelvis: [ 0, 0.95, 0.06 ], hip: [ 0.1, 0.93, 0.04 ], knee: [ 0.17, 0.86, - 0.16 ], ankle: [ 0.16, 0.52, - 0.14 ], toe: [ 0.16, 0.47, - 0.26 ],
		chest: [ 0, 1.39, 0.06 ], neck: [ 0, 1.46, 0.07 ], head: [ 0, 1.59, 0.07 ],
		...both( { shoulder: [ 0.2, 1.38, 0.06 ], elbow: [ 0.31, 1.64, 0.03 ], wrist: [ 0.33, 1.9, - 0.01 ], hand: [ 0.32, 2.0, - 0.02 ] } ),
	},
	// at the pit: tongs in the right hand over the grate, then turning the meat
	grill: {
		chest: [ 0, 1.36, - 0.06 ], neck: [ 0, 1.42, - 0.1 ], head: [ 0, 1.53, - 0.15 ],
		elbow: [ 0.23, 1.06, - 0.18 ], wrist: [ 0.18, 1.01, - 0.42 ], hand: [ 0.17, 0.99, - 0.5 ],
		'L:elbow': [ - 0.24, 1.08, - 0.08 ], 'L:wrist': [ - 0.2, 1.0, - 0.28 ], 'L:hand': [ - 0.18, 0.98, - 0.34 ],
	},
	grillFlip: {
		chest: [ 0, 1.36, - 0.06 ], neck: [ 0, 1.42, - 0.1 ], head: [ 0, 1.53, - 0.15 ],
		elbow: [ 0.24, 1.08, - 0.16 ], wrist: [ 0.21, 1.13, - 0.4 ], hand: [ 0.21, 1.2, - 0.46 ],
		'L:elbow': [ - 0.24, 1.08, - 0.08 ], 'L:wrist': [ - 0.2, 1.0, - 0.28 ], 'L:hand': [ - 0.18, 0.98, - 0.34 ],
	},
	// both hands on the pinball's flipper buttons, leaning in; then a shove
	pinball: both( {
		pelvis: [ 0, 0.88, 0.05 ], chest: [ 0, 1.34, - 0.1 ], neck: [ 0, 1.4, - 0.15 ], head: [ 0, 1.5, - 0.2 ],
		shoulder: [ 0.2, 1.33, - 0.1 ], elbow: [ 0.3, 1.08, - 0.22 ], wrist: [ 0.3, 0.98, - 0.42 ], hand: [ 0.29, 0.97, - 0.5 ],
	} ),
	pinballShove: both( {
		pelvis: [ 0, 0.88, 0.04 ], chest: [ 0, 1.33, - 0.14 ], neck: [ 0, 1.39, - 0.19 ], head: [ 0, 1.48, - 0.25 ],
		shoulder: [ 0.2, 1.32, - 0.14 ], elbow: [ 0.3, 1.07, - 0.3 ], wrist: [ 0.3, 0.98, - 0.48 ], hand: [ 0.29, 0.97, - 0.55 ],
	} ),
	// signing at a table (seated): the pen on the photo, then looking up with it held out
	autograph: seated( 0.46, ( H ) => ( {
		chest: [ 0, H + 0.58, 0.0 ], neck: [ 0, H + 0.64, - 0.04 ], head: [ 0, H + 0.74, - 0.09 ],
		shoulder: [ 0.21, H + 0.56, 0.0 ], elbow: [ 0.27, H + 0.34, - 0.26 ], wrist: [ 0.12, H + 0.3, - 0.46 ], hand: [ 0.07, H + 0.3, - 0.53 ],
		'L:shoulder': [ - 0.21, H + 0.56, 0.0 ], 'L:elbow': [ - 0.28, H + 0.33, - 0.22 ], 'L:wrist': [ - 0.16, H + 0.3, - 0.44 ], 'L:hand': [ - 0.1, H + 0.3, - 0.5 ],
	} ) ),
	autographUp: seated( 0.46, ( H ) => ( {
		chest: [ 0, H + 0.6, 0.04 ], neck: [ 0, H + 0.67, 0.03 ], head: [ 0, H + 0.79, 0.01 ],
		shoulder: [ 0.21, H + 0.58, 0.04 ], elbow: [ 0.27, H + 0.4, - 0.2 ], wrist: [ 0.2, H + 0.46, - 0.45 ], hand: [ 0.17, H + 0.48, - 0.52 ],
		'L:shoulder': [ - 0.21, H + 0.58, 0.04 ], 'L:elbow': [ - 0.28, H + 0.33, - 0.2 ], 'L:wrist': [ - 0.16, H + 0.3, - 0.44 ], 'L:hand': [ - 0.1, H + 0.3, - 0.5 ],
	} ) ),
	// pointing down into the pen for his kid; crouched beside him
	point: { chest: [ 0, 1.37, - 0.03 ], neck: [ 0, 1.44, - 0.05 ], head: [ 0, 1.55, - 0.09 ], elbow: [ 0.27, 1.28, - 0.22 ], wrist: [ 0.31, 1.22, - 0.48 ], hand: [ 0.32, 1.2, - 0.57 ] },
	crouch: {
		pelvis: [ 0, 0.52, 0.18 ], hip: [ 0.12, 0.52, 0.16 ], knee: [ 0.2, 0.52, - 0.25 ], ankle: [ 0.18, 0.08, - 0.02 ], toe: [ 0.19, 0.04, - 0.16 ],
		'L:knee': [ - 0.16, 0.34, 0.1 ], 'L:ankle': [ - 0.15, 0.08, 0.38 ], 'L:toe': [ - 0.15, 0.02, 0.24 ],
		chest: [ 0, 0.97, 0.05 ], neck: [ 0, 1.04, 0.02 ], head: [ 0, 1.15, - 0.02 ],
		shoulder: [ 0.2, 0.96, 0.05 ], elbow: [ 0.27, 0.9, - 0.2 ], wrist: [ 0.29, 0.93, - 0.45 ], hand: [ 0.29, 0.94, - 0.53 ],
		'L:elbow': [ - 0.22, 0.72, - 0.06 ], 'L:wrist': [ - 0.2, 0.55, - 0.2 ], 'L:hand': [ - 0.19, 0.52, - 0.26 ],
	},
	// arms folded (a guard, a coach), and holding an umbrella up in the right hand
	folded: {
		elbow: [ 0.23, 1.12, - 0.05 ], wrist: [ - 0.06, 1.18, - 0.16 ], hand: [ - 0.14, 1.19, - 0.14 ],
		'L:elbow': [ - 0.23, 1.13, - 0.05 ], 'L:wrist': [ 0.06, 1.2, - 0.16 ], 'L:hand': [ 0.14, 1.21, - 0.14 ],
	},
	umbrella: { elbow: [ 0.24, 1.12, - 0.12 ], wrist: [ 0.12, 1.28, - 0.26 ], hand: [ 0.08, 1.32, - 0.26 ] },
};

// the pairs: [ from, to ]
export const PAIRS = {
	idle: [ 'stand', 'talk' ], pockets: [ 'pockets', 'talk' ], walk: [ 'walkA', 'walkB' ], lean: [ 'lean', 'leanPoint' ],
	rail: [ 'rail', 'cheer' ], cheer: [ 'clap', 'cheer' ], sign: [ 'sign', 'signHigh' ], sit: [ 'sit', 'sitEat' ],
	serve: [ 'stand', 'reach' ], carry: [ 'carry', 'drink' ], photo: [ 'photo', 'phone' ], shoulders: [ 'shoulders', 'shouldersUp' ],
	ride: [ 'ride', 'rideUp' ], grill: [ 'grill', 'grillFlip' ], pinball: [ 'pinball', 'pinballShove' ],
	autograph: [ 'autograph', 'autographUp' ], point: [ 'stand', 'point' ], crouch: [ 'crouch', 'crouch' ], umbrella: [ 'umbrella', 'folded' ],
};

// a pose's joint on one side (the left mirrors the right unless the pose gives it its own)
function joint( P, name, s ) {

	const own = s < 0 ? P[ 'L:' + name ] : null;
	if ( own ) return own;
	const j = P[ name ] || BASE[ name ];
	return [ j[ 0 ] * ( j[ 0 ] ? s : 1 ), j[ 1 ], j[ 2 ] ];

}

const sub = ( a, b ) => [ a[ 0 ] - b[ 0 ], a[ 1 ] - b[ 1 ], a[ 2 ] - b[ 2 ] ];
const d2 = ( a, b ) => ( a[ 0 ] - b[ 0 ] ) ** 2 + ( a[ 1 ] - b[ 1 ] ) ** 2 + ( a[ 2 ] - b[ 2 ] ) ** 2;

// an arm of Cast's to a pose's hand and elbow (the trunk leant as the pose leans it): gradient descent
// from a natural start, the hand first, the elbow near where it was
function solveArm( s, hand, elbow, trunk ) {

	const lo = [ - 1.0, - 0.5, - 1.2, 0.02 ], hi = [ 3.1, 1.8, 1.6, 2.6 ];
	const cost = ( a ) => {

		const f = armFK( s, a, trunk );
		return d2( f.hand, hand ) + 0.25 * d2( f.elbow, elbow ) + 0.0002 * ( a[ 1 ] * a[ 1 ] + a[ 2 ] * a[ 2 ] );

	};

	let best = null, bc = Infinity;
	for ( const start of [ [ 0.4, 0.15, 0.1, 1.0 ], [ 1.4, 0.3, 0.4, 1.4 ], [ 2.4, 0.3, 0.0, 0.4 ], [ - 0.2, 0.1, 0.0, 0.6 ] ] ) {

		let a = start.slice(), c = cost( a ), step = 0.4;
		for ( let it = 0; it < 300 && step > 1e-4; it ++ ) {

			const g = [ 0, 0, 0, 0 ];
			for ( let k = 0; k < 4; k ++ ) {

				const b = a.slice();
				b[ k ] += 1e-3;
				g[ k ] = ( cost( b ) - c ) / 1e-3;

			}

			const gl = Math.hypot( ...g ) || 1;
			const b = a.map( ( v, k ) => Math.max( lo[ k ], Math.min( hi[ k ], v - step * g[ k ] / gl ) ) );
			const cb = cost( b );
			if ( cb < c ) {

				a = b; c = cb; step *= 1.2;

			} else step *= 0.5;

		}

		if ( c < bc ) {

			bc = c; best = a;

		}

	}

	return best;

}

// A pose as Cast's angles: the lean of the trunk (pelvis to chest), the head's pitch (neck to head, on the
// lean), the legs (hip, knee, ankle: the thigh's swing and the knee's bend), the drop of the pelvis, the
// arms solved to the same hands and elbows
const _solved = new Map();
function castPose( name ) {

	let o = _solved.get( name );
	if ( o ) return o;
	const P = POSES[ name ];
	const J = ( n, s = 1 ) => joint( P, n, s );
	const tilt = ( a, b ) => Math.atan2( - ( b[ 2 ] - a[ 2 ] ), b[ 1 ] - a[ 1 ] );
	const lean = tilt( J( 'pelvis' ), J( 'chest' ) ) - tilt( BASE.pelvis, BASE.chest );
	const headPitch = - ( tilt( J( 'neck' ), J( 'head' ) ) - tilt( BASE.neck, BASE.head ) - lean ) * 0.8;
	const leg = ( s ) => {

		const hp = J( 'hip', s ), kn = J( 'knee', s ), an = J( 'ankle', s );
		const t = sub( kn, hp ), u = sub( an, kn );
		const ft = Math.atan2( - t[ 2 ], - t[ 1 ] ), fs = Math.atan2( - u[ 2 ], - u[ 1 ] );
		const spread = Math.asin( Math.max( - 0.6, Math.min( 0.6, ( Math.abs( kn[ 0 ] ) - Math.abs( hp[ 0 ] ) ) / Math.hypot( ...t ) ) ) );
		return [ ft, Math.max( 0, ft - fs ), spread ];

	};

	const [ hipR, kneeR, spR ] = leg( 1 ), [ hipL, kneeL, spL ] = leg( - 1 );
	const drop = Math.max( 0, BASE.hip[ 1 ] - J( 'hip' )[ 1 ] );
	const trunk = { lean };
	// (Cast solves the arms standing: a pose sat or crouched has its hands raised by the drop)
	const up = ( v ) => [ v[ 0 ], v[ 1 ] + drop, v[ 2 ] ];
	o = {
		lean, headPitch, hipL, kneeL, hipR, kneeR, drop, spread: Math.max( 0, ( spL + spR ) / 2 ),
		armL: solveArm( - 1, up( J( 'hand', - 1 ) ), up( J( 'elbow', - 1 ) ), trunk ),
		armR: solveArm( 1, up( J( 'hand', 1 ) ), up( J( 'elbow', 1 ) ), trunk ),
	};
	_solved.set( name, o );
	return o;

}

// ---------------------------------------------------------------- the props

// what they hold (the Alley's names) and what Cast holds for it
export const PROP = { sign: 0, cup: 1, hoagie: 2, umbrella: 3, glove: 4, camera: 5, cowbell: 6, towel: 7, tray: 8, pennant: 9, photo: 10, tongs: 11, bag: 12, phone: 13 };
const HELD = [ CP.sign, CP.beer, CP.sandwich, CP.umbrella, CP.glove, CP.camera, CP.cowbell, CP.towel, CP.tray, CP.pennant, CP.photo, CP.tongs, CP.bag, CP.phone ];
// the hand Cast can hold each in (the left, or the right if the left can't)
const LEFT_OK = new Set( [ CP.beer, CP.soda, CP.sandwich, CP.glove, CP.towel, CP.bag, CP.phone, CP.photo ] );

// a glossy 8 x 10: the Bull at bat in 1980's powder blue (for signing)
function bullPhoto( ctx, w, hh ) {

	ctx.fillStyle = '#5b6f86'; ctx.fillRect( 0, 0, w, hh );
	ctx.fillStyle = '#8aa6c8'; ctx.fillRect( w * 0.35, hh * 0.25, w * 0.3, hh * 0.5 );
	ctx.fillStyle = '#6b1422'; ctx.beginPath(); ctx.arc( w * 0.5, hh * 0.2, w * 0.1, 0, Math.PI * 2 ); ctx.fill();
	ctx.fillStyle = '#2a2a2a'; ctx.fillRect( w * 0.58, hh * 0.05, w * 0.04, hh * 0.35 );
	ctx.strokeStyle = '#f4f1ea'; ctx.lineWidth = 6; ctx.strokeRect( 8, 8, w - 16, hh - 16 );

}

// ---------------------------------------------------------------- the people

export class Folk {

	// signs: [ draw( ctx, w, h ) ], the homemade signs (the sign prop's variants)
	constructor( parent, { signs = [] } = {} ) {

		this.parent = parent;
		this.cast = new Cast( { parent, max: 900 } );
		this.list = [];
		this.props = [];
		// the signs into the park's sign atlas (a variant is an index into signs; 15 the Bull's photo)
		this.signCells = signs.slice( 0, 15 ).map( ( draw, i ) => sign( draw, 'alley-' + i ) );
		this.signCells[ 15 ] = sign( bullPhoto, 'alley-bull-photo' );
		this.time = 0;

	}

	// where the place is (the pool skips the whole troupe when the view is elsewhere)
	set bounds( s ) {

		this.cast.bounds = s;
		this._bounds = s;

	}

	get bounds() {

		return this._bounds;

	}

	// a person: which pair of poses, where (field frame, y his feet), which way he faces (yaw 0 faces -z),
	// who he is ( look: { top, hat, pants, jersey, poncho, kid, glasses, beard, woman, open } ), how far
	// into the gesture ( k ), a scale (his height), and on which nights he's there ( 1 the 27th, 2 the 29th)
	add( pair, { x, y = 0, z, yaw = 0, look = {}, k = 0, scale = 1, sway = 1, nights = 3, seed = null } ) {

		const s = seed ?? ( ( this.list.length * 0.6180339 + 0.137 ) % 1 );
		const c = this.cast.add( castLook( look, s ) );
		if ( ! c ) return null;
		const p = { pair, x, y, z, yaw, look, k, scale: look.kid ? scale * 0.7 : scale, sway, nights, seed: s, shown: true, visible: true, _c: c };
		this.list.push( p );
		return p;

	}

	// a prop in his hand: 'right', 'left', or 'both' (between the hands: Cast's right carries it); a
	// variant (the sign's cell, the umbrella's colours, the cup's kind)
	hold( p, kind, { hand = 'right', variant = 0, open = 1, turn = 0, offset = [ 0, 0, 0 ] } = {} ) {

		const pr = { person: p, kind: PROP[ kind ], hand, variant, open, turn, offset, shown: true };
		this.props.push( pr );
		( p.props ||= [] ).push( pr );
		return pr;

	}

	// (the figures and the LOD are the pool's now)
	build() {

		for ( const p of this.list ) for ( const pr of p.props || [] ) pr.person = p;
		// the poses in use solved now, not on the first frame
		for ( const pair of new Set( this.list.map( ( p ) => p.pair ) ) ) if ( pair !== 'walk' ) for ( const n of PAIRS[ pair ] ) castPose( n );

	}

	lod() {}

	// the joint of his hand now (his own frame, before his scale): Cast's arm as posed
	handAt( p, side ) {

		const a = p._c.pose;
		const f = armFK( side, side < 0 ? a.armL : a.armR, { lean: a.lean, twist: a.twist, roll: a.roll } );
		return [ f.hand[ 0 ], f.hand[ 1 ] - a.drop, f.hand[ 2 ] ];

	}

	update() {

		const dt = 1 / 60;
		this.time += dt;
		for ( const p of this.list ) {

			const c = p._c;
			c.visible = p.shown && p.visible;
			if ( ! c.visible ) {

				p._ph = undefined;
				continue;

			}

			c.x = p.x; c.y = p.y; c.z = p.z; c.yaw = p.yaw; c.scale = p.scale;
			const [ A, B ] = PAIRS[ p.pair ];
			const a = c.pose, k = Math.max( 0, Math.min( 1, p.k ) );
			if ( p.pair === 'walk' ) {

				// Cast's own stride: its phase from the walker's (or read off k, for the ones only given k)
				let ph;
				if ( p.walk && p.walk.phase !== undefined ) ph = p.walk.phase;
				else {

					const dk = k - ( p._k ?? k ), s = Math.asin( Math.max( - 1, Math.min( 1, 2 * k - 1 ) ) );
					ph = dk >= 0 ? s : Math.PI - s;

				}

				p._k = k;
				const sn = Math.sin( ph );
				a.walk = 1; a.phase = ph; a.lean = 0.05; a.headPitch = 0.04; a.drop = 0; a.spread = 0;
				a.hipL = a.hipR = a.kneeL = a.kneeR = 0;
				a.armL[ 0 ] = 0.05 + 0.3 * sn; a.armL[ 1 ] = 0.08; a.armL[ 2 ] = 0; a.armL[ 3 ] = 0.25;
				a.armR[ 0 ] = 0.05 - 0.3 * sn; a.armR[ 1 ] = 0.08; a.armR[ 2 ] = 0; a.armR[ 3 ] = 0.25;

			} else {

				const P = castPose( A ), Q = castPose( B ), m = ( u, v ) => u + ( v - u ) * k;
				a.walk = 0;
				a.lean = m( P.lean, Q.lean ); a.headPitch = m( P.headPitch, Q.headPitch );
				a.hipL = m( P.hipL, Q.hipL ); a.kneeL = m( P.kneeL, Q.kneeL ); a.hipR = m( P.hipR, Q.hipR ); a.kneeR = m( P.kneeR, Q.kneeR );
				a.drop = m( P.drop, Q.drop ); a.spread = m( P.spread, Q.spread );
				for ( let i = 0; i < 4; i ++ ) {

					a.armL[ i ] = m( P.armL[ i ], Q.armL[ i ] );
					a.armR[ i ] = m( P.armR[ i ], Q.armR[ i ] );

				}

			}

			// breathing, a look about now and then, a blink; mouths open when they're up and shouting
			const t = this.time + p.seed * 41;
			a.twist = 0; a.roll = 0;
			a.headYaw = 0.22 * Math.sin( t * 0.21 ) * Math.sin( t * 0.13 + p.seed * 9 ) * p.sway;
			a.breath = 0.5 + 0.5 * Math.sin( t * 1.3 );
			a.blink = ( t * 0.26 ) % 1 < 0.035 ? 1 : 0;
			a.mouth = ( p.pair === 'cheer' || p.pair === 'rail' ) && k > 0.6 ? 0.8 * k : p.pair === 'lean' && k > 0.5 ? 0.7 : 0;
			// what's in the hands
			let R = 0, L = 0, vR = 0, vL = 0;
			for ( const pr of p.props || [] ) {

				if ( ! pr.shown ) continue;
				let id = HELD[ pr.kind ], v = 0;
				if ( pr.kind === PROP.cup && pr.variant > 0.5 ) id = CP.soda;
				if ( pr.kind === PROP.umbrella ) {

					if ( pr.open < 0.5 ) id = CP.furled;
					v = [ 0, 1, 2 ][ pr.variant ] ?? 0;

				}

				if ( pr.kind === PROP.sign || pr.kind === PROP.photo ) v = this.signCells[ pr.variant ] ?? 0;
				if ( pr.kind === PROP.camera ) v = pr.variant > 0.5 ? 0 : 1;
				if ( pr.hand === 'left' && LEFT_OK.has( id ) && ! L ) {

					L = id; vL = v;

				} else if ( ! R ) {

					R = id; vR = v;

				} else if ( LEFT_OK.has( id ) && ! L ) {

					L = id; vL = v;

				}

			}

			a.propR = R; a.varR = vR; a.propL = L; a.varL = vL;

		}

		this.cast.update();

	}

}
