import { Mesh, BufferGeometry, Float32BufferAttribute, PlaneGeometry, Color, Matrix4, Vector3, Frustum } from '../../engine/index.js';
import { StorageBuffer } from '../../engine/gpu/Texture.js';
import { ShaderModule } from '../../engine/gpu/Shader.js';
import { GPU } from '../../engine/gpu/GPU.js';
import { commonModule } from '../../engine/render/wgsl/common.js';
import { standard } from '../../materials/Materials.js';
import { canvasTexture } from '../geo.js';

// The park's people seen up close: one figure system for every place (the concourse's fans, the gate's
// arrivals and scalpers, the Alley's hecklers, whoever the next places bring). People.js has the far-off
// figures (a tube body, three morphs); these are built to be looked at from a metre or two: a lofted trunk
// with a build (slim, broad, a belly), shoulders, hands and shoes, a head with a nose and a painted face
// (the eyes that blink, brows, lips, the cold in the cheeks and ears, beards, glasses), hair (short, long,
// a ponytail, a bald crown), a cap, a knit hat with its pom-pom, a hood up, a trooper's campaign hat, and
// what they wear: a Phillies jacket, a hoodie, the home whites with a name and number on the back, a red
// name-and-number tee over a thermal, a puffer, a work jacket, the 1980 powder blues, a long coat, a
// poncho over it all, a bag on a strap, a radio on the shoulder. Whatever's in their hands: a beer, a hot
// chocolate, a cardboard tray with a cheesesteak and fries, a program, a flip phone, a kid's glove, a
// rally towel, an umbrella, a homemade sign, a scalper's fan of tickets, a cowbell.
//
// ---- The API (stable: the places build on it; additions only)
//
//   import { Cast, TOP, COLOR, HAT, CHEST, BACK, GEAR, PROP, restPose, seat, sign } from './Cast.js';
//   const cast = new Cast( { parent, max } )   a troupe: parent is the place's group (the field frame);
//                                              max: at most this many people in it
//   const p = cast.add( look )                 someone new (look: packLook's fields, below), or null past max
//     p.x, p.y, p.z                            where (the field frame: metres, y up from the field)
//     p.yaw                                    which way they face (0: facing -z)
//     p.scale                                  their size (the figure is built ~1.75 m tall)
//     p.visible                                drawn or not
//     p.pose                                   the angles (restPose(): see below)
//     p.fresh = true                           no motion blur from where they were (after a jump)
//     p.lod                                    (read) how they were drawn last frame: 0 the near figure,
//                                              1 the far, 2 the distant, -1 not at all (out of view,
//                                              hidden): update the unseen and the distant less often
//   cast.setLook( p, look )                    re-dressed (a poncho on for the rain, off on the 29th)
//   cast.update( [ camX, 0, camZ ] )           once a frame, after posing (the camera in the field
//                                              frame; optional: the pool finds the camera itself)
//   cast.list                                  the troupe's people
//   cast.bounds = sphere                       optional: where the troupe is (a Sphere in the field frame),
//                                              to skip it wholesale when the camera looks elsewhere
//   sign( draw, name )                         a homemade sign ( draw( ctx, w, h ) on a 256 x 256 card):
//                                              returns its cell, the variant of PROP.sign / PROP.photo
//   seat( pose, h )                            the legs folded to sit on a seat h metres up
//   lookAt( key, { x, y, z, r, k } )           something worth a look (the field frame): everyone seen
//                                              within r metres (12) turns their head to it (and a little
//                                              of their body), each a beat late; k (0..1) how much.
//                                              lookAt( key, null ) when it's gone. (The Phanatic going
//                                              by: lookAt( 'phanatic', { x, y, z, r: 14, k: excite } ).)
//
// The pose (restPose(); angles in radians): phase and walk (the stride: walk 0..1, phase advancing ~4.5 rad
// a metre), drop (the pelvis lowered, m), lean (forward +), twist (left +), roll, headYaw (left +),
// headPitch (down +), mouth (0 shut .. 1 open), propL / propR (a PROP id in each hand), varL / varR
// (that prop's variant: a sign's cell, an umbrella's colours), armL / armR = [ shoulder pitch (forward +),
// roll (out to the side +), yaw (across the body +), elbow (bent +) ], hipL / hipR (thigh forward +),
// kneeL / kneeR (bent +), spread (the legs apart), breath (0..1), blink (0..1).
// Concourse3BKit.js solves arms to a point (armIK) and has the common gestures (GESTURE) and dress().
//
// ---- Underneath: one pool for the whole park
//
// Every troupe's people are slots in one pool, drawn by one pipeline: three meshes (the near figure, the
// far one, the distant one) with the same material, and the contact shadows. Each person is a slot with a
// pose (8 vec4s, written every frame) and a look (a vec4u of packed numbers, written when it changes); the
// vertex shader rigs the figure (every vertex belongs to a bone and turns about the joints above it) and
// runs twice for the near ones (this frame's pose and last frame's, for the motion vectors). Once a
// frame, as the pool is about to be drawn, it culls everyone outside the view, picks each one's figure by
// how tall they stand on the screen (a TV camera's long lens sees the backdrop close), sorts the near ones
// front to back, and uploads. The parts a person hasn't got (a brim without a cap, the props not in hand)
// fold to a point before any rigging, so the forty-odd props cost next to nothing on those not holding them.

// the joints standing (origin on the ground between the feet, facing -z, the right side +x)
export const J = {
	hip: [ 0.095, 0.93, 0.0 ], knee: [ 0.1, 0.5, - 0.005 ], ankle: [ 0.105, 0.085, 0.02 ],
	spine: [ 0, 0.98, 0.01 ], neck: [ 0, 1.465, 0.025 ], head: [ 0, 1.59, 0.005 ],
	shoulder: [ 0.195, 1.395, 0.025 ], elbow: [ 0.235, 1.115, 0.045 ], wrist: [ 0.245, 0.86, 0.03 ], hand: [ 0.245, 0.785, 0.02 ],
};
const HEAD_R = [ 0.079, 0.104, 0.096 ];

// bones
const B = { pelvis: 0, spine: 1, head: 2, uarm: [ 3, 4 ], farm: [ 5, 6 ], thigh: [ 7, 8 ], shin: [ 9, 10 ], prop: [ 11, 12 ] };
// parts (what the shaders dress), then the props at 32 + id
export const PART = {
	torso: 0, pants: 1, hand: 2, head: 3, brim: 4, pompom: 5, neck: 6, sleeve: 7, shoe: 8, poncho: 9, hairCard: 10, nose: 11, apron: 12, vest: 13,
	// ---- P0: worn gear and a hat with its own shape
	bag: 14, pack: 15, radio: 16, credential: 17, campaign: 18,
};

// What's in a hand (pose.propL / propR). Upright ones stay level whatever the arm does (a cup, a tray, an
// umbrella over the head, a sign held up); the others turn with the hand (a program held up, a phone to
// the ear).
export const PROP = {
	none: 0, beer: 1, soda: 2, cocoa: 3, tray: 4, program: 5, phone: 6, glove: 7, towel: 8, bag: 9, sandwich: 10,
	scorebook: 11, cottonCandy: 12, waterIce: 13, peanuts: 14, pocket: 15, programs: 16, hotdog: 17, money: 18, beers: 19, ticket: 20, pencil: 21, camera: 22,
	// ---- P0 (23-59): the gate's and the Alley's things
	umbrella: 23, // open over the head, the shaft through the fist (varR: 0 black, 1 Phillies red, 2 red and white golf, 3 navy, 4 plaid, 5 grey)
	furled: 24, // an umbrella rolled up, hanging from the hand
	sign: 25, // a homemade sign held up in both hands (the right carries it; var: its cell, sign())
	scanner: 26, // a ticket taker's scanner
	flashlight: 27, // a bag checker's, a bouncer's (left hand)
	mic: 28, // a reporter's microphone with the station's flag
	tickets: 29, // a scalper's tickets, fanned and held up
	cowbell: 30, // a Rays fan's
	tongs: 31, // the pitmaster's
	pennant: 32, // a Phillies pennant on its stick
	photo: 33, // a glossy 8 x 10 held flat (var: its cell, sign())
	cigarette: 34, // between the fingers, the tip lit
	radio: 35, // a transistor radio with its aerial up (left hand)
	thermos: 36, // a green steel vacuum flask, its cup for a lid (the tailgaters, the long line)
};
const UPRIGHT = [ PROP.beer, PROP.soda, PROP.cocoa, PROP.tray, PROP.bag, PROP.cottonCandy, PROP.waterIce, PROP.peanuts, PROP.beers,
	PROP.umbrella, PROP.sign, PROP.scanner, PROP.flashlight, PROP.mic, PROP.tickets, PROP.cowbell, PROP.tongs, PROP.pennant, PROP.photo, PROP.radio, PROP.thermos ];
// which props each hand can hold (the geometry is built once per hand)
const HAND_PROPS = [
	[ PROP.beer, PROP.soda, PROP.cocoa, PROP.glove, PROP.bag, PROP.scorebook, PROP.peanuts, PROP.programs, PROP.money, PROP.hotdog, PROP.ticket, PROP.cottonCandy,
		PROP.towel, PROP.program, PROP.sandwich, PROP.flashlight, PROP.photo, PROP.radio, PROP.thermos, PROP.phone ], // left
	[ PROP.beer, PROP.soda, PROP.cocoa, PROP.tray, PROP.program, PROP.phone, PROP.towel, PROP.sandwich, PROP.waterIce, PROP.cottonCandy, PROP.hotdog, PROP.money, PROP.beers, PROP.ticket, PROP.pencil, PROP.camera,
		PROP.peanuts, PROP.bag, PROP.umbrella, PROP.furled, PROP.sign, PROP.scanner, PROP.mic, PROP.tickets, PROP.cowbell, PROP.tongs, PROP.pennant, PROP.photo, PROP.cigarette, PROP.thermos ], // right
];
// the props that show past the near figure (the rest are too small to read there)
// (B: the camera and the phone too - their flash and screen are what the TV's long lens sees of them)
const FAR_PROPS = [ PROP.beer, PROP.soda, PROP.cocoa, PROP.tray, PROP.towel, PROP.program, PROP.programs, PROP.bag, PROP.cottonCandy, PROP.glove, PROP.camera, PROP.phone,
	PROP.umbrella, PROP.sign, PROP.beers, PROP.tickets ];
const TINY_PROPS = [ PROP.umbrella, PROP.sign ];

// the pose: 8 vec4s per person
export const POSE = 8;
// [ x, y, z, yaw ], [ scale, walk phase, walk, pelvis drop ], [ lean, twist, side lean, head yaw ],
// [ head pitch, mouth, prop left, prop right ], [ left shoulder pitch, roll, yaw, elbow ], [ right ... ],
// [ left hip pitch, knee, right hip pitch, knee ], [ legs apart, breath, blink, the props' variants ]

// The looks: numbers packed into a vec4u.
//   x: skin 0-7 | hair colour <<3 | hair style <<6 (0 short, 1 long, 2 ponytail, 3 bald) | facial <<8
//      (0 none, 1 moustache, 2 goatee, 3 beard, 4 stubble) | glasses <<11 | female <<12 | age <<13
//      (0 adult, 1 old, 2 kid, 3 teen) | build <<15 (0 slim, 1 average, 2 broad, 3 belly)
//   y: top <<0 (TOP) | its colour <<5 (COLOR) | sleeves' colour <<10 | the print on the back <<15 (the
//      atlas cell, 0 none: BACK) | the print on the chest <<22 (CHEST)
//   z: pants <<0 (0 jeans, 1 dark jeans, 2 khakis, 3 black, 4 grey sweats, 5 navy, 6 a trooper's grey with
//      the black stripe, 7 camo) | shoes <<3 (0 white sneakers, 1 black, 2 tan boots, 3 brown, 4 grey) |
//      hat <<6 (HAT) | poncho <<11 (0 none, 1 clear, 2 red, 3 white, 4 yellow, 5 orange, 6 a grey trash
//      bag, 7 a clear one shared with the one on the left) | scarf <<14 (0 none, 1 red and white, 2 grey,
//      3 black) | gloves <<16 | badge <<17 (a gold shield on the left breast: the police) | (bit 18: B's ticket
//      lanyard, look.lanyard) | gear <<19 (GEAR bits)
//   w: a seed (0..65535) for the small things | dry <<16 (under cover: the rain's not on them)
export const TOP = {
	jacket: 0, hoodie: 1, homeJersey: 2, nameTee: 3, fleece: 4, puffer: 5, leather: 6, work: 7, powder: 8, rays: 9,
	eagles: 10, staff: 11, usher: 12, security: 13, hawker: 14, seller: 15, satin: 16, roadJersey: 17, champsTee: 18, cook: 19,
	// ---- P0 (20-26)
	camo: 20, // a hunting jacket (a South Philly dad)
	flyers: 21, // a Flyers jacket: orange, the sleeves and yoke black, the winged P
	trooper: 22, // the Pennsylvania State Police's grey, the black placket and epaulettes, the badge
	coat: 23, // a long wool overcoat to the knees (a reporter, the man in the camel coat)
	polo: 24, // a polo shirt (the store staff; the Bull's red one over a white turtleneck: sleeves white)
	vendor: 25, // a street vendor's work coat under a canvas money apron
	raincoat: 26, // a police raincoat: long, yellow, the silver bands (POLICE on the back: BACK.POLICE)
};
// the colours a top can be (the order is COLOR's)
export const COLOR = { red: 0, maroon: 1, black: 2, navy: 3, grey: 4, white: 5, charcoal: 6, royal: 7, green: 8, tan: 9, brown: 10, cream: 11, lightGrey: 12, powder: 13, yellow: 14, pink: 15, raysNavy: 16, olive: 17, purple: 18, orange: 19,
	// ---- P0
	camel: 20, policeYellow: 21, trooperGrey: 22, midnight: 23 };
const COLORS = [
	[ 0.34, 0.018, 0.024 ], [ 0.13, 0.02, 0.028 ], [ 0.013, 0.013, 0.015 ], [ 0.014, 0.02, 0.058 ], [ 0.2, 0.2, 0.2 ],
	[ 0.72, 0.71, 0.68 ], [ 0.07, 0.07, 0.075 ], [ 0.03, 0.07, 0.3 ], [ 0.02, 0.1, 0.07 ], [ 0.3, 0.22, 0.12 ],
	[ 0.1, 0.055, 0.03 ], [ 0.55, 0.5, 0.4 ], [ 0.42, 0.42, 0.41 ], [ 0.33, 0.5, 0.7 ], [ 0.62, 0.48, 0.03 ],
	[ 0.62, 0.25, 0.35 ], [ 0.012, 0.03, 0.09 ], [ 0.1, 0.11, 0.05 ], [ 0.12, 0.04, 0.2 ], [ 0.6, 0.18, 0.02 ],
	[ 0.3, 0.2, 0.12 ], [ 0.6, 0.52, 0.02 ], [ 0.22, 0.22, 0.23 ], [ 0.0, 0.065, 0.075 ],
];
export const HAT = { none: 0, capRed: 1, capNavy: 2, knitRed: 3, knitGrey: 4, knitBlack: 5, cap1980: 6, capRays: 7, hood: 8, capBack: 9, knitPlain: 10, visor: 11, capBlack: 12, earmuffs: 13,
	// ---- P0 (14-20)
	capWhite: 14, // a white cap, the red P
	police: 15, // a Philadelphia police officer's peaked cap
	campaign: 16, // a State Trooper's campaign hat
	cabbie: 17, // a tweed flat cap (the old-timers)
	capWS: 18, // a black cap with the 2008 World Series mark in gold
};
export const CHEST = { none: 0, script: 1, block: 2, champs: 3, rays: 4, staff: 5, security: 6, eagles: 7, redOct: 8,
	// ---- P0 (9-12)
	ws: 9, // WORLD SERIES 2008 over the trophy's flags
	flyers: 10, // the Flyers' winged P
	bulls: 11, // Bull's BBQ, the pit crew's shirts
	fox: 12, // FOX 29
};
// worn gear (look.gear: these bits OR'd)
export const GEAR = { messenger: 1, backpack: 2, radio: 4, credential: 8 };

// the backs: [ name, number ] cells in the atlas (1..), the words across a back (40..), then the chest prints (64..)
export const BACKS = [
	null, [ 'UTLEY', '26' ], [ 'HOWARD', '6' ], [ 'ROLLINS', '11' ], [ 'HAMELS', '35' ], [ 'VICTORINO', '8' ], [ 'BURRELL', '5' ],
	[ 'WERTH', '28' ], [ 'LIDGE', '54' ], [ 'MYERS', '39' ], [ 'FELIZ', '7' ], [ 'RUIZ', '51' ], [ 'MOYER', '50' ],
	[ 'SCHMIDT', '20' ], [ 'CARLTON', '32' ], [ 'ROSE', '14' ], [ 'BOWA', '10' ], [ 'KRUK', '29' ], [ 'DYKSTRA', '4' ],
	[ 'DAULTON', '10' ], [ 'ASHBURN', '1' ], [ 'THOME', '25' ], [ 'CRAWFORD', '13' ], [ 'LONGORIA', '3' ], [ 'MADSON', '46' ],
	[ 'BLANTON', '56' ], [ 'DOBBS', '19' ], [ 'STAIRS', '12' ], [ 'KALAS', '' ], [ 'WESTBROOK', '36' ], [ 'DAWKINS', '20' ],
	// ---- P0 (31-47): more players (31-39), then the words across a back (40-47)
	[ 'LUZINSKI', '19' ], [ 'McNABB', '5' ], [ 'UPTON', '2' ], [ 'JENKINS', '23' ], [ 'COSTE', '27' ], null, null, null, null,
	[ '=STAFF' ], [ '=SECURITY' ], [ '=POLICE' ], [ '=FOX 29' ],
	// (48-51: B's; 52-55: C's)
];
// ---- B (home): the vendors' numbers, big and red on the backs of their mustard-yellow shirts (the
// 2008-09 photos), in atlas cells 56-59
BACKS[ 56 ] = [ '', '47' ]; BACKS[ 57 ] = [ '', '112' ]; BACKS[ 58 ] = [ '', '23' ]; BACKS[ 59 ] = [ '', '88' ];
// ---- end B
export const BACK = Object.fromEntries( BACKS.map( ( b, i ) => [ b ? b[ 0 ].replace( /^=/, '' ).replace( ' ', '' ).toUpperCase() : 'NONE', i ] ).filter( ( [ k ] ) => k !== 'NONE' ) );
BACK.NONE = 0;
const CHEST_CELL = 64; // the chest prints start at this atlas cell (8 x 10 cells of 128 px)
const ATLAS_ROWS = 10;

// ---------------------------------------------------------------- homemade signs

// The park's signs, one atlas of 8 x 4 cards (256 px each): each place registers its own (drawn when the
// pool first draws; a card drawn later redraws the atlas). Returns the card's cell (a sign's variant).
const SIGNS = [];
export function sign( draw, name = '' ) {

	const known = name ? SIGNS.findIndex( ( s ) => s.name === name ) : - 1;
	if ( known >= 0 ) return known;
	if ( SIGNS.length >= 32 ) return 0;
	SIGNS.push( { draw, name } );
	if ( POOL ) POOL._signsDirty = true;
	return SIGNS.length - 1;

}

// ---------------------------------------------------------------- something worth a look

const LOOKS = new Map();
export function lookAt( key, spot ) {

	if ( spot ) LOOKS.set( key, spot );
	else LOOKS.delete( key );

}

// ---------------------------------------------------------------- the figure's geometry

// lod 0: the near figure; lod 1: the far one (fewer sides, no joints' rounds, a plain hand, no nose);
// lod 2: the distant one (a few pixels tall: the fewest sides, next to nothing in hand)
function figureGeometry( lod = 0 ) {

	const fine = lod === 0, tiny = lod === 2, N8 = fine ? 8 : tiny ? 3 : 5, N6 = fine ? 6 : tiny ? 3 : 4;

	const pos = [], nrm = [], info = [], index = [];
	const sub = ( a, b ) => [ a[ 0 ] - b[ 0 ], a[ 1 ] - b[ 1 ], a[ 2 ] - b[ 2 ] ];
	const add = ( a, b ) => [ a[ 0 ] + b[ 0 ], a[ 1 ] + b[ 1 ], a[ 2 ] + b[ 2 ] ];
	const mul = ( a, k ) => [ a[ 0 ] * k, a[ 1 ] * k, a[ 2 ] * k ];
	const cross = ( a, b ) => [ a[ 1 ] * b[ 2 ] - a[ 2 ] * b[ 1 ], a[ 2 ] * b[ 0 ] - a[ 0 ] * b[ 2 ], a[ 0 ] * b[ 1 ] - a[ 1 ] * b[ 0 ] ];
	const norm = ( a ) => mul( a, 1 / ( Math.hypot( ...a ) || 1 ) );
	const side = ( j, s ) => [ j[ 0 ] * s, j[ 1 ], j[ 2 ] ];
	const vert = ( p, n, bone, part ) => {

		pos.push( ...p ); nrm.push( ...norm( n ) ); info.push( bone, part );
		return pos.length / 3 - 1;

	};

	// a tube from a to b, elliptical rings (rx across, rz in depth), n sides, optional end caps
	const tube = ( bone, part, a, b, rA, rB, n = 8, capA = false, capB = false ) => {

		const ax = norm( sub( b, a ) );
		let across = cross( ax, [ 0, 0, 1 ] );
		if ( Math.hypot( ...across ) < 0.2 ) across = cross( ax, [ 1, 0, 0 ] );
		across = norm( across );
		const depth = norm( cross( across, ax ) );
		const rings = [];
		for ( const [ c, r ] of [ [ a, rA ], [ b, rB ] ] ) {

			const ring = [];
			for ( let k = 0; k < n; k ++ ) {

				const t = ( k / n ) * Math.PI * 2;
				const d = add( mul( across, Math.cos( t ) * r[ 0 ] ), mul( depth, Math.sin( t ) * r[ 1 ] ) );
				ring.push( vert( add( c, d ), add( mul( across, Math.cos( t ) / r[ 0 ] ), mul( depth, Math.sin( t ) / r[ 1 ] ) ), bone, part ) );

			}

			rings.push( ring );

		}

		for ( let k = 0; k < n; k ++ ) {

			const i0 = rings[ 0 ][ k ], i1 = rings[ 0 ][ ( k + 1 ) % n ], j0 = rings[ 1 ][ k ], j1 = rings[ 1 ][ ( k + 1 ) % n ];
			index.push( i0, j0, i1, i1, j0, j1 );

		}

		const cap = ( c, dir, ringIdx, flip ) => {

			const ci = vert( c, dir, bone, part );
			for ( let k = 0; k < n; k ++ ) {

				const i0 = rings[ ringIdx ][ k ], i1 = rings[ ringIdx ][ ( k + 1 ) % n ];
				if ( flip ) index.push( ci, i1, i0 ); else index.push( ci, i0, i1 );

			}

		};

		if ( capA ) cap( a, mul( ax, - 1 ), 0, false );
		if ( capB ) cap( b, ax, 1, true );

	};

	// a lofted body: rings [ y, rx, rz, z offset ] round the vertical, n sides
	const loft = ( bone, part, rings, n, capBottom = false, capTop = false ) => {

		const R = rings.map( ( [ y, rx, rz, zo ] ) => {

			const ring = [];
			for ( let k = 0; k < n; k ++ ) {

				const t = ( k / n ) * Math.PI * 2;
				ring.push( vert( [ Math.cos( t ) * rx, y, Math.sin( t ) * rz + zo ], [ Math.cos( t ) / rx, 0, Math.sin( t ) / rz ], bone, part ) );

			}

			return ring;

		} );
		for ( let r = 0; r < R.length - 1; r ++ ) for ( let k = 0; k < n; k ++ ) {

			const i0 = R[ r ][ k ], i1 = R[ r ][ ( k + 1 ) % n ], j0 = R[ r + 1 ][ k ], j1 = R[ r + 1 ][ ( k + 1 ) % n ];
			index.push( i0, i1, j0, i1, j1, j0 );

		}

		const cap = ( r, up ) => {

			const [ y, , , zo ] = rings[ r ];
			const ci = vert( [ 0, y, zo ], [ 0, up ? 1 : - 1, 0 ], bone, part );
			for ( let k = 0; k < n; k ++ ) {

				const i0 = R[ r ][ k ], i1 = R[ r ][ ( k + 1 ) % n ];
				if ( up ) index.push( ci, i1, i0 ); else index.push( ci, i0, i1 );

			}

		};

		if ( capBottom ) cap( 0, false );
		if ( capTop ) cap( R.length - 1, true );

	};

	const ellipsoid = ( bone, part, c, r, W, H ) => {

		const first = pos.length / 3;
		for ( let j = 0; j <= H; j ++ ) for ( let i = 0; i < W; i ++ ) {

			const th = j / H * Math.PI, ph = i / W * Math.PI * 2;
			const d = [ Math.sin( th ) * Math.cos( ph ), Math.cos( th ), Math.sin( th ) * Math.sin( ph ) ];
			vert( add( c, [ d[ 0 ] * r[ 0 ], d[ 1 ] * r[ 1 ], d[ 2 ] * r[ 2 ] ] ), [ d[ 0 ] / r[ 0 ], d[ 1 ] / r[ 1 ], d[ 2 ] / r[ 2 ] ], bone, part );

		}

		for ( let j = 0; j < H; j ++ ) for ( let i = 0; i < W; i ++ ) {

			const a = first + j * W + i, b = first + j * W + ( i + 1 ) % W, cc = a + W, d = b + W;
			if ( j > 0 ) index.push( a, cc, b );
			if ( j < H - 1 ) index.push( b, cc, d );

		}

	};

	// a box: centre, half sizes, turned about y by ry
	const boxAt = ( bone, part, c, h, ry = 0 ) => {

		const cy = Math.cos( ry ), sy = Math.sin( ry );
		const T = ( p ) => [ c[ 0 ] + p[ 0 ] * cy + p[ 2 ] * sy, c[ 1 ] + p[ 1 ], c[ 2 ] - p[ 0 ] * sy + p[ 2 ] * cy ];
		const TN = ( p ) => [ p[ 0 ] * cy + p[ 2 ] * sy, p[ 1 ], - p[ 0 ] * sy + p[ 2 ] * cy ];
		const faces = [ [ [ 0, 0, 1 ], [ 1, 0, 0 ], [ 0, 1, 0 ] ], [ [ 0, 0, - 1 ], [ - 1, 0, 0 ], [ 0, 1, 0 ] ], [ [ 1, 0, 0 ], [ 0, 0, - 1 ], [ 0, 1, 0 ] ],
			[ [ - 1, 0, 0 ], [ 0, 0, 1 ], [ 0, 1, 0 ] ], [ [ 0, 1, 0 ], [ 1, 0, 0 ], [ 0, 0, - 1 ] ], [ [ 0, - 1, 0 ], [ 1, 0, 0 ], [ 0, 0, 1 ] ] ];
		for ( const [ n, u, v ] of faces ) {

			const q = [ [ - 1, - 1 ], [ 1, - 1 ], [ 1, 1 ], [ - 1, 1 ] ].map( ( [ a, b ] ) => vert( T( [ ( n[ 0 ] + u[ 0 ] * a + v[ 0 ] * b ) * h[ 0 ], ( n[ 1 ] + u[ 1 ] * a + v[ 1 ] * b ) * h[ 1 ], ( n[ 2 ] + u[ 2 ] * a + v[ 2 ] * b ) * h[ 2 ] ] ), TN( n ), bone, part ) );
			index.push( q[ 0 ], q[ 1 ], q[ 2 ], q[ 0 ], q[ 2 ], q[ 3 ] );

		}

	};

	// a flat quad a b c d (both sides show: the material is double sided)
	const quad = ( bone, part, a, b, c, d ) => {

		const n = norm( cross( sub( b, a ), sub( d, a ) ) );
		const q = [ a, b, c, d ].map( ( p ) => vert( p, n, bone, part ) );
		index.push( q[ 0 ], q[ 1 ], q[ 2 ], q[ 0 ], q[ 2 ], q[ 3 ] );

	};

	// an upright cylinder (a cup), centre of its base c
	const cyl = ( bone, part, c, rB, rT, h, n = 8, top = true ) => {

		tube( bone, part, c, add( c, [ 0, h, 0 ] ), [ rB, rB ], [ rT, rT ], fine ? n : Math.min( n, 5 ), false, top );

	};

	// ---- the body
	// the trunk (the spine bone), a jacket's hem below the belt: rings [ y, half width, half depth, z ]
	loft( B.spine, PART.torso, [
		[ 0.83, 0.172, 0.118, 0.012 ], [ 0.95, 0.168, 0.112, 0.01 ], [ 1.06, 0.164, 0.11, 0.008 ], [ 1.17, 0.172, 0.114, 0.006 ],
		[ 1.28, 0.186, 0.118, 0.012 ], [ 1.36, 0.196, 0.108, 0.022 ], [ 1.42, 0.17, 0.085, 0.028 ], [ 1.465, 0.09, 0.062, 0.03 ],
	], fine ? 12 : tiny ? 5 : 8, true, true );
	// the hips and seat (the pelvis), under the trunk's hem
	loft( B.pelvis, PART.pants, [ [ 0.74, 0.16, 0.1, 0.012 ], [ 0.86, 0.168, 0.11, 0.012 ], [ 0.97, 0.16, 0.105, 0.012 ] ], fine ? 10 : tiny ? 4 : 6, true, false );
	// the neck
	tube( B.head, PART.neck, [ 0, 1.4, 0.03 ], [ 0, 1.54, 0.02 ], [ 0.052, 0.05 ], [ 0.046, 0.046 ], N6 );
	// the head, the nose, a cap's brim, a knit hat's pom-pom, long hair down the back
	ellipsoid( B.head, PART.head, J.head, HEAD_R, fine ? 14 : tiny ? 5 : 8, fine ? 9 : tiny ? 4 : 6 );
	if ( fine ) {

		const h = J.head, tip = [ 0, h[ 1 ] - 0.022, h[ 2 ] - HEAD_R[ 2 ] - 0.022 ];
		const a = [ - 0.017, h[ 1 ] - 0.042, h[ 2 ] - HEAD_R[ 2 ] + 0.012 ], b = [ 0.017, h[ 1 ] - 0.042, h[ 2 ] - HEAD_R[ 2 ] + 0.012 ], t = [ 0, h[ 1 ] + 0.02, h[ 2 ] - HEAD_R[ 2 ] + 0.01 ];
		const i = [ tip, a, b, t ].map( ( p ) => vert( p, sub( p, h ), B.head, PART.nose ) );
		index.push( i[ 0 ], i[ 1 ], i[ 3 ], i[ 0 ], i[ 3 ], i[ 2 ], i[ 0 ], i[ 2 ], i[ 1 ] );

	}

	{

		const h = J.head;
		const brim = [ [ - 0.078, 0.048, - 0.055 ], [ 0.078, 0.048, - 0.055 ], [ 0.07, 0.03, - 0.17 ], [ - 0.07, 0.03, - 0.17 ], [ 0, 0.045, - 0.115 ] ].map( ( o ) => vert( add( h, o ), [ 0, 1, - 0.15 ], B.head, PART.brim ) );
		index.push( brim[ 0 ], brim[ 4 ], brim[ 1 ], brim[ 1 ], brim[ 4 ], brim[ 2 ], brim[ 2 ], brim[ 4 ], brim[ 3 ], brim[ 3 ], brim[ 4 ], brim[ 0 ] );
		ellipsoid( B.head, PART.pompom, add( h, [ 0, HEAD_R[ 1 ] + 0.04, 0.005 ] ), [ 0.034, 0.03, 0.034 ], N6, fine ? 4 : 3 );
		// long hair: a card down the back, curved round the head
		const hc = [ - 0.08, - 0.04, 0, 0.04, 0.08 ];
		const top = hc.map( ( x ) => vert( add( h, [ x, 0.05, 0.075 - x * x * 3 ] ), [ x, 0, 1 ], B.head, PART.hairCard ) );
		const bot = hc.map( ( x ) => vert( add( h, [ x * 1.1, - 0.2, 0.09 - x * x * 3 ] ), [ x, 0, 1 ], B.head, PART.hairCard ) );
		for ( let k = 0; k < hc.length - 1; k ++ ) index.push( top[ k ], bot[ k ], top[ k + 1 ], top[ k + 1 ], bot[ k ], bot[ k + 1 ] );
		// ---- P0: a State Trooper's campaign hat: the wide flat brim, the crown with the four pinches of its
		// peak (W1's, from the Inquirer's troopers at the park)
		if ( ! tiny ) {

			const n = fine ? 16 : 8, y0 = h[ 1 ] + 0.065;
			const ring = ( r, y, pinch = 0 ) => Array.from( { length: n }, ( _, i ) => {

				const q = i / n * Math.PI * 2, k = 1 - pinch * Math.pow( Math.abs( Math.cos( q * 2 ) ), 6 );
				return vert( [ h[ 0 ] + Math.cos( q ) * r * k, y, h[ 2 ] + Math.sin( q ) * r * k ], [ Math.cos( q ), 0.5, Math.sin( q ) ], B.head, PART.campaign );

			} );
			const rings = [ ring( 0.205, y0 - 0.005 ), ring( 0.104, y0 ), ring( 0.1, y0 + 0.09, 0.12 ), ring( 0.04, y0 + 0.155, 0.3 ) ];
			for ( let r = 0; r < rings.length - 1; r ++ ) for ( let i = 0; i < n; i ++ ) {

				const a0 = rings[ r ][ i ], a1 = rings[ r ][ ( i + 1 ) % n ], b0 = rings[ r + 1 ][ i ], b1 = rings[ r + 1 ][ ( i + 1 ) % n ];
				index.push( a0, b0, a1, a1, b0, b1 );

			}

			const apex = vert( [ h[ 0 ], y0 + 0.17, h[ 2 ] ], [ 0, 1, 0 ], B.head, PART.campaign );
			for ( let i = 0; i < n; i ++ ) index.push( apex, rings[ 3 ][ ( i + 1 ) % n ], rings[ 3 ][ i ] );

		}

	}

	for ( const s of [ - 1, 1 ] ) {

		const L = s < 0 ? 0 : 1;
		const sh = side( J.shoulder, s ), el = side( J.elbow, s ), wr = side( J.wrist, s ), ha = side( J.hand, s );
		// the shoulder's round, the upper arm, the forearm and the cuff (sleeves: the shaders colour them)
		if ( fine ) ellipsoid( B.uarm[ L ], PART.sleeve, add( sh, [ - 0.012 * s, - 0.018, 0 ] ), [ 0.064, 0.052, 0.064 ], 8, 5 );
		tube( B.uarm[ L ], PART.sleeve, sh, el, [ 0.062, 0.064 ], [ 0.05, 0.052 ], N8 );
		if ( fine ) ellipsoid( B.farm[ L ], PART.sleeve, el, [ 0.05, 0.05, 0.052 ], 8, 4 );
		tube( B.farm[ L ], PART.sleeve, el, wr, [ 0.049, 0.05 ], [ 0.04, 0.042 ], N8 );
		// the hand: a mitten with its thumb, turned in toward the body
		boxAt( B.farm[ L ], PART.hand, add( ha, [ - 0.004 * s, 0.0, 0 ] ), [ 0.017, 0.045, 0.036 ] );
		if ( fine ) boxAt( B.farm[ L ], PART.hand, add( ha, [ - 0.016 * s, 0.022, - 0.03 ] ), [ 0.012, 0.026, 0.011 ] );
		if ( fine ) tube( B.farm[ L ], PART.hand, add( wr, [ 0, 0.01, 0 ] ), add( ha, [ 0, 0.02, 0 ] ), [ 0.03, 0.027 ], [ 0.02, 0.036 ], 6 );
		// the thigh, the knee, the shin and the shoe
		const hp = side( J.hip, s ), kn = side( J.knee, s ), an = side( J.ankle, s );
		tube( B.thigh[ L ], PART.pants, add( hp, [ 0, 0.05, 0 ] ), kn, [ 0.088, 0.09 ], [ 0.062, 0.064 ], N8 );
		if ( fine ) ellipsoid( B.shin[ L ], PART.pants, kn, [ 0.059, 0.058, 0.06 ], 8, 4 );
		tube( B.shin[ L ], PART.pants, kn, add( an, [ 0, 0.02, 0 ] ), [ 0.06, 0.062 ], [ 0.047, 0.05 ], N8 );
		boxAt( B.shin[ L ], PART.shoe, add( an, [ 0.003 * s, - 0.045, - 0.045 ] ), [ 0.048, 0.042, 0.125 ] );

	}

	// a poncho: a bell of plastic from the shoulders to the knees, over everything (the spine bone); the
	// long coats wear it too, as their skirts
	loft( B.spine, PART.poncho, [ [ 0.6, 0.29, 0.22, 0.02 ], [ 0.85, 0.27, 0.2, 0.02 ], [ 1.12, 0.262, 0.175, 0.015 ], [ 1.36, 0.245, 0.14, 0.025 ], [ 1.44, 0.17, 0.105, 0.03 ], [ 1.49, 0.07, 0.068, 0.03 ] ], fine ? 14 : tiny ? 5 : 8, false, false );
	// an apron (the concession staff), a hi-vis vest (security): thin shells just over the trunk
	if ( ! tiny ) loft( B.spine, PART.apron, [ [ 0.55, 0.19, 0.13, 0.0 ], [ 0.8, 0.178, 0.125, 0.004 ], [ 1.02, 0.172, 0.122, 0.004 ] ], fine ? 12 : 7, false, false );
	loft( B.spine, PART.vest, [ [ 0.98, 0.178, 0.122, 0.01 ], [ 1.17, 0.18, 0.124, 0.006 ], [ 1.3, 0.194, 0.128, 0.012 ], [ 1.4, 0.18, 0.1, 0.024 ] ], fine ? 12 : tiny ? 5 : 7, false, false );

	// ---- P0: worn gear (GEAR), on the trunk
	if ( ! tiny ) {

		// a messenger bag at the left hip on a strap across the chest
		boxAt( B.spine, PART.bag, [ - 0.215, 1.0, 0.02 ], [ 0.035, 0.12, 0.15 ] );
		quad( B.spine, PART.bag, [ 0.13, 1.44, - 0.118 ], [ 0.17, 1.42, - 0.112 ], [ - 0.17, 1.08, - 0.126 ], [ - 0.2, 1.1, - 0.12 ] );
		quad( B.spine, PART.bag, [ 0.13, 1.44, 0.138 ], [ 0.17, 1.42, 0.132 ], [ - 0.17, 1.08, 0.132 ], [ - 0.2, 1.1, 0.13 ] );
		// a backpack and its straps
		boxAt( B.spine, PART.pack, [ 0, 1.2, 0.2 ], [ 0.15, 0.2, 0.07 ] );
		if ( fine ) boxAt( B.spine, PART.pack, [ 0, 1.1, 0.28 ], [ 0.11, 0.08, 0.025 ] );
		for ( const x of [ - 0.1, 0.1 ] ) quad( B.spine, PART.pack, [ x - 0.02, 1.45, - 0.1 ], [ x + 0.02, 1.45, - 0.1 ], [ x + 0.03, 1.1, - 0.123 ], [ x - 0.01, 1.1, - 0.123 ] );

	}

	if ( fine ) {

		// a radio clipped at the left shoulder, its aerial
		boxAt( B.spine, PART.radio, [ - 0.12, 1.34, - 0.118 ], [ 0.027, 0.05, 0.017 ] );
		boxAt( B.spine, PART.radio, [ - 0.105, 1.42, - 0.118 ], [ 0.004, 0.035, 0.004 ] );
		// a lanyard round the neck and the credential on it (staff, the press)
		quad( B.spine, PART.credential, [ - 0.06, 1.445, - 0.07 ], [ - 0.045, 1.45, - 0.075 ], [ 0.006, 1.25, - 0.121 ], [ - 0.008, 1.25, - 0.121 ] );
		quad( B.spine, PART.credential, [ 0.045, 1.45, - 0.075 ], [ 0.06, 1.445, - 0.07 ], [ 0.008, 1.25, - 0.121 ], [ - 0.006, 1.25, - 0.121 ] );
		boxAt( B.spine, PART.credential, [ 0, 1.2, - 0.123 ], [ 0.045, 0.055, 0.003 ] );

	}

	// ---- what's held: each hand's set, built at its hand (the rig carries it)
	for ( const s of [ - 1, 1 ] ) {

		const L = s < 0 ? 0 : 1, bone = B.prop[ L ];
		const h = side( J.hand, s );
		// upright things sit just in front of the palm, held round their middle
		const g = add( h, [ - 0.035 * s, - 0.06, - 0.02 ] );
		for ( const id of HAND_PROPS[ L ] ) {

			// far off only the things that show at a distance
			if ( tiny && ! TINY_PROPS.includes( id ) ) continue;
			if ( ! fine && ! FAR_PROPS.includes( id ) ) continue;

			const part = 32 + id;
			if ( id === PROP.beer || id === PROP.soda ) {

				cyl( bone, part, g, 0.034, 0.045, 0.15, 8 );
				if ( id === PROP.soda && fine ) tube( bone, part, add( g, [ 0.01, 0.14, 0 ] ), add( g, [ 0.018, 0.22, 0.004 ] ), [ 0.004, 0.004 ], [ 0.004, 0.004 ], 4 );

			} else if ( id === PROP.beers ) {

				// two beers in one hand, pinched together at the rims
				cyl( bone, part, add( g, [ 0.03, 0, 0 ] ), 0.034, 0.045, 0.15, 6 );
				cyl( bone, part, add( g, [ - 0.06, 0, - 0.01 ] ), 0.034, 0.045, 0.15, 6 );

			} else if ( id === PROP.cocoa ) {

				cyl( bone, part, add( g, [ 0, 0.01, 0 ] ), 0.03, 0.04, 0.115, 8 );
				cyl( bone, part, add( g, [ 0, 0.125, 0 ] ), 0.041, 0.036, 0.014, 8 );

			} else if ( id === PROP.waterIce ) {

				cyl( bone, part, add( g, [ 0, 0.01, 0 ] ), 0.032, 0.042, 0.1, 8, false );
				ellipsoid( bone, part, add( g, [ 0, 0.11, 0 ] ), [ 0.04, 0.025, 0.04 ], fine ? 6 : 4, 3 );

			} else if ( id === PROP.cottonCandy ) {

				tube( bone, part, add( g, [ 0, 0.02, 0 ] ), add( g, [ 0, 0.2, 0 ] ), [ 0.008, 0.008 ], [ 0.012, 0.012 ], fine ? 5 : 3 );
				ellipsoid( bone, part, add( g, [ 0, 0.3, 0 ] ), [ 0.11, 0.13, 0.11 ], fine ? 7 : 5, fine ? 4 : 3 );

			} else if ( id === PROP.tray ) {

				// a cardboard carrier held in front at the waist: a cheesesteak in foil, a boat of fries,
				// two drinks
				const c = add( h, [ - 0.24 * s, - 0.02, - 0.1 ] );
				boxAt( bone, part, c, [ 0.2, 0.012, 0.14 ] );
				boxAt( bone, part, add( c, [ 0.05, 0.045, 0.03 ] ), [ 0.11, 0.032, 0.04 ], 0.15 );
				boxAt( bone, part, add( c, [ 0.06, 0.035, - 0.075 ] ), [ 0.07, 0.025, 0.045 ] );
				cyl( bone, part, add( c, [ - 0.11, 0.012, 0.05 ] ), 0.034, 0.045, 0.15, 6 );
				cyl( bone, part, add( c, [ - 0.11, 0.012, - 0.055 ] ), 0.034, 0.045, 0.15, 6 );

			} else if ( id === PROP.bag ) {

				boxAt( bone, part, add( h, [ 0, - 0.22, 0 ] ), [ 0.03, 0.17, 0.15 ] );
				if ( fine ) {

					tube( bone, part, add( h, [ 0, - 0.06, - 0.05 ] ), add( h, [ 0, 0.01, 0 ] ), [ 0.006, 0.006 ], [ 0.006, 0.006 ], 4 );
					tube( bone, part, add( h, [ 0, - 0.06, 0.05 ] ), add( h, [ 0, 0.01, 0 ] ), [ 0.006, 0.006 ], [ 0.006, 0.006 ], 4 );

				}

			} else if ( id === PROP.peanuts ) {

				// a brown paper bag, the top rolled over
				boxAt( bone, part, add( g, [ 0, 0.06, 0 ] ), [ 0.07, 0.1, 0.03 ] );
				if ( fine ) boxAt( bone, part, add( g, [ 0, 0.17, 0 ] ), [ 0.066, 0.018, 0.022 ] );

			} else if ( id === PROP.program || id === PROP.scorebook || id === PROP.programs ) {

				// held by its edge in the fingers, standing down from the hand (the arm turns it up)
				const n = id === PROP.programs ? 3 : 1;
				for ( let k = 0; k < n; k ++ ) boxAt( bone, part, add( h, [ 0.004 * k * s, - 0.1 - 0.012 * k, - 0.11 - 0.03 * k ] ), [ 0.006, 0.14, 0.107 ] );

			} else if ( id === PROP.phone ) {

				boxAt( bone, part, add( h, [ - 0.02 * s, - 0.05, - 0.03 ] ), [ 0.012, 0.05, 0.025 ] );

			} else if ( id === PROP.glove ) {

				boxAt( bone, part, add( h, [ 0.0, - 0.045, - 0.01 ] ), [ 0.045, 0.1, 0.085 ] );
				if ( fine ) boxAt( bone, part, add( h, [ - 0.01 * s, - 0.03, - 0.09 ] ), [ 0.03, 0.06, 0.03 ] );

			} else if ( id === PROP.towel ) {

				const top = [ - 0.02 * s, 0, 0 ], w = 0.22, len = 0.4;
				const a = vert( add( h, add( top, [ 0, 0, - w ] ) ), [ s, 0, 0 ], bone, part ), b = vert( add( h, add( top, [ 0, 0, w * 0.3 ] ) ), [ s, 0, 0 ], bone, part );
				const c = vert( add( h, [ 0.02 * s, - len, w * 0.35 ] ), [ s, 0, 0 ], bone, part ), d = vert( add( h, [ 0.03 * s, - len, - w ] ), [ s, 0, 0 ], bone, part );
				index.push( a, d, b, b, d, c );

			} else if ( id === PROP.sandwich || id === PROP.hotdog ) {

				boxAt( bone, part, add( h, [ - 0.02 * s, - 0.03, - 0.07 ] ), id === PROP.hotdog ? [ 0.028, 0.025, 0.1 ] : [ 0.035, 0.035, 0.12 ] );

			} else if ( id === PROP.ticket ) {

				// a ticket held out between the fingers
				boxAt( bone, part, add( h, [ - 0.03 * s, - 0.07, - 0.03 ] ), [ 0.002, 0.03, 0.075 ] );

			} else if ( id === PROP.camera ) {

				// a point-and-shoot held up in the fingertips, its screen toward the face
				boxAt( bone, part, add( h, [ - 0.04 * s, - 0.06, - 0.03 ] ), [ 0.05, 0.03, 0.013 ], Math.PI / 2 );

			} else if ( id === PROP.pencil ) {

				tube( bone, part, add( h, [ - 0.02 * s, - 0.02, - 0.04 ] ), add( h, [ - 0.02 * s, - 0.1, - 0.1 ] ), [ 0.004, 0.004 ], [ 0.003, 0.003 ], 4 );

			} else if ( id === PROP.money ) {

				boxAt( bone, part, add( h, [ - 0.03 * s, - 0.07, - 0.02 ] ), [ 0.003, 0.035, 0.07 ] );

			// ---- P0's props (upright ones are built as they're held, level; the others hanging from the
			// hand at rest)
			} else if ( id === PROP.umbrella ) {

				// the shaft up through the fist, the crook below it, eight panels over the head
				tube( bone, part, add( h, [ 0, - 0.13, 0 ] ), add( h, [ 0, 0.93, 0 ] ), [ 0.011, 0.011 ], [ 0.008, 0.008 ], fine ? 4 : 3, fine );
				if ( fine ) tube( bone, part, add( h, [ 0, - 0.13, 0 ] ), add( h, [ 0, - 0.19, 0.04 ] ), [ 0.013, 0.013 ], [ 0.012, 0.012 ], 4, false, true );
				const c = add( h, [ 0, 0.78, 0 ] ), R = 0.56, n = 8;
				for ( let k = 0; k < n; k ++ ) {

					// each panel its own vertices, so its colour holds to the tip; the rim sags between the ribs
					const a0 = k / n * Math.PI * 2, a1 = ( k + 1 ) / n * Math.PI * 2;
					const P = ( a, r, y ) => add( c, [ Math.cos( a ) * r, y, Math.sin( a ) * r ] );
					const N = ( a, up ) => [ Math.cos( a ) * 0.6, up, Math.sin( a ) * 0.6 ];
					const ap = vert( add( c, [ 0, 0.14, 0 ] ), [ 0, 1, 0 ], bone, part );
					const m0 = vert( P( a0, R * 0.55, 0.07 ), N( a0, 1 ), bone, part ), m1 = vert( P( a1, R * 0.55, 0.07 ), N( a1, 1 ), bone, part );
					const r0 = vert( P( a0, R, - 0.1 ), N( a0, 0.6 ), bone, part ), r1 = vert( P( a1, R, - 0.1 ), N( a1, 0.6 ), bone, part );
					index.push( ap, m1, m0, m0, m1, r1, m0, r1, r0 );

				}

			} else if ( id === PROP.furled ) {

				// rolled up and hanging from the crook in the fingers, the ferrule near the ground
				tube( bone, part, add( h, [ 0, - 0.02, 0 ] ), add( h, [ 0, - 0.7, - 0.02 ] ), [ 0.022, 0.022 ], [ 0.007, 0.007 ], 5 );
				tube( bone, part, add( h, [ 0, 0.03, 0.03 ] ), add( h, [ 0, - 0.02, 0 ] ), [ 0.01, 0.01 ], [ 0.01, 0.01 ], 4 );

			} else if ( id === PROP.sign ) {

				// a board 0.72 x 0.5, held along its bottom edge in both hands (the right carries it): its
				// face toward the crowd, the card from the sign atlas; the back plain cardboard
				boxAt( bone, part, add( h, [ - 0.27, 0.14, - 0.06 ] ), [ 0.36, 0.25, 0.005 ] );

			} else if ( id === PROP.scanner ) {

				// the reader pointing out of the fist, its grip
				boxAt( bone, part, add( h, [ - 0.02 * s, 0.01, - 0.09 ] ), [ 0.034, 0.022, 0.1 ] );
				boxAt( bone, part, add( h, [ - 0.02 * s, - 0.035, - 0.02 ] ), [ 0.02, 0.045, 0.022 ] );

			} else if ( id === PROP.flashlight ) {

				tube( bone, part, add( h, [ - 0.01 * s, 0.0, 0.05 ] ), add( h, [ - 0.01 * s, 0.01, - 0.14 ] ), [ 0.017, 0.017 ], [ 0.024, 0.024 ], 6, true, true );

			} else if ( id === PROP.mic ) {

				// the handle up from the fist, the station's flag, the ball of the head
				tube( bone, part, add( h, [ - 0.01 * s, - 0.07, 0.0 ] ), add( h, [ - 0.01 * s, 0.14, - 0.03 ] ), [ 0.016, 0.016 ], [ 0.02, 0.02 ], 6, true );
				boxAt( bone, part, add( h, [ - 0.01 * s, 0.09, - 0.02 ] ), [ 0.035, 0.03, 0.035 ] );
				tube( bone, part, add( h, [ - 0.01 * s, 0.14, - 0.03 ] ), add( h, [ - 0.01 * s, 0.2, - 0.04 ] ), [ 0.03, 0.03 ], [ 0.018, 0.018 ], 6, false, true );

			} else if ( id === PROP.tickets ) {

				// four tickets fanned out over the hand, held up to be seen
				for ( let k = 0; k < 4; k ++ ) {

					const a = - 0.5 + k * 0.33, dx = Math.sin( a ) * 0.17, dy = Math.cos( a ) * 0.17;
					const o = add( h, [ - 0.03 * s + k * 0.004, 0.03, - 0.04 - k * 0.003 ] );
					quad( bone, part, [ o[ 0 ] - 0.028, o[ 1 ], o[ 2 ] ], [ o[ 0 ] + 0.028, o[ 1 ], o[ 2 ] ], [ o[ 0 ] + 0.028 + dx, o[ 1 ] + dy, o[ 2 ] ], [ o[ 0 ] - 0.028 + dx, o[ 1 ] + dy, o[ 2 ] ] );

				}

			} else if ( id === PROP.cowbell ) {

				tube( bone, part, add( g, [ 0, 0.06, - 0.01 ] ), add( g, [ 0, - 0.08, - 0.02 ] ), [ 0.03, 0.022 ], [ 0.055, 0.04 ], 6, true, false );
				tube( bone, part, add( g, [ 0, 0.06, - 0.01 ] ), add( g, [ 0, 0.14, - 0.01 ] ), [ 0.01, 0.01 ], [ 0.01, 0.01 ], 4 );

			} else if ( id === PROP.tongs ) {

				boxAt( bone, part, add( h, [ - 0.015 * s, 0.0, - 0.2 ] ), [ 0.012, 0.008, 0.2 ] );

			} else if ( id === PROP.pennant ) {

				// the stick up from the fist, the felt flag off it
				tube( bone, part, add( h, [ 0, - 0.05, 0 ] ), add( h, [ 0, 0.45, 0 ] ), [ 0.006, 0.006 ], [ 0.005, 0.005 ], 4 );
				const p0 = vert( add( h, [ 0, 0.44, 0 ] ), [ 1, 0, 0 ], bone, part ), p1 = vert( add( h, [ 0, 0.24, 0 ] ), [ 1, 0, 0 ], bone, part ), p2 = vert( add( h, [ 0.02, 0.33, - 0.45 ] ), [ 1, 0, 0 ], bone, part );
				index.push( p0, p1, p2 );

			} else if ( id === PROP.photo ) {

				// a glossy 8 x 10 held flat, out in front (to be signed)
				boxAt( bone, part, add( h, [ - 0.02 * s, 0.0, - 0.14 ] ), [ 0.1, 0.003, 0.125 ] );

			} else if ( id === PROP.cigarette ) {

				// between the first two fingers (it points back along the hand at rest: out from the lips when
				// the hand is up at the mouth)
				tube( bone, part, add( h, [ - 0.025 * s, - 0.06, - 0.01 ] ), add( h, [ - 0.025 * s, - 0.06, 0.07 ] ), [ 0.004, 0.004 ], [ 0.004, 0.004 ], 4, false, true );

			} else if ( id === PROP.thermos ) {

				// the flask held round its middle, the cup screwed on over the stopper
				cyl( bone, part, add( g, [ 0, - 0.08, 0 ] ), 0.042, 0.042, 0.24, 8, false );
				cyl( bone, part, add( g, [ 0, 0.16, 0 ] ), 0.046, 0.044, 0.07, 8 );

			} else if ( id === PROP.radio ) {

				// a transistor radio held at the chest, the aerial up
				boxAt( bone, part, add( g, [ 0, 0.05, 0 ] ), [ 0.07, 0.045, 0.022 ] );
				tube( bone, part, add( g, [ 0.05 * s, 0.09, 0 ] ), add( g, [ 0.07 * s, 0.33, 0 ] ), [ 0.003, 0.003 ], [ 0.002, 0.002 ], 3 );

			}

		}

	}

	const geo = new BufferGeometry();
	geo.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
	geo.setAttribute( 'normal', new Float32BufferAttribute( nrm, 3 ) );
	geo.setAttribute( 'aInfo', new Float32BufferAttribute( info, 2 ) );
	geo.setIndex( index );
	geo.computeBoundingSphere();
	geo.instanceCount = 0;
	return geo;

}

// ---------------------------------------------------------------- the rig and the dressing (WGSL)

const f3 = ( v ) => `vec3f( ${ v.map( ( x ) => x.toFixed( 4 ) ).join( ', ' ) } )`;
const castModule = new ShaderModule( {
	name: 'cast',
	deps: [ commonModule ],
	code: /* wgsl */`
fn c3Rx( a: f32 ) -> mat3x3f { let c = cos( a ); let s = sin( a ); return mat3x3f( 1.0, 0.0, 0.0, 0.0, c, s, 0.0, - s, c ); }
fn c3Ry( a: f32 ) -> mat3x3f { let c = cos( a ); let s = sin( a ); return mat3x3f( c, 0.0, - s, 0.0, 1.0, 0.0, s, 0.0, c ); }
fn c3Rz( a: f32 ) -> mat3x3f { let c = cos( a ); let s = sin( a ); return mat3x3f( c, s, 0.0, - s, c, 0.0, 0.0, 0.0, 1.0 ); }

struct C3Out { p: vec3f, n: vec3f };

// is this prop upright (level whatever the hand does)?
fn c3Upright( id: u32 ) -> bool {
	return ${ UPRIGHT.map( ( u ) => `id == ${ u }u` ).join( ' || ' ) };
}

// A vertex of the figure (q, its normal n, rest pose) posed: turned about each joint in its bone's chain,
// then placed (the person's spot, yaw and scale), in the field frame. (The props not in hand never get
// here: they're folded away before the rig.) The pose's rows come in as they're needed, the arm's already
// the one on this vertex's side (no array to index: nothing spilled to memory)
fn c3Rig( q0: vec3f, n0: vec3f, bone: u32, part: u32, at: vec4f, a1: vec4f, a2: vec4f, headPitch: f32, arm: vec4f, legs: vec4f, spread: f32 ) -> C3Out {
	var q = q0;
	var n = n0;
	let walk = a1.z;
	let ph = a1.y;
	// the legs: the stride (the knee bends through the swing), and whatever the pose adds
	if ( bone >= 7u && bone <= 10u ) {
		let right = bone == 8u || bone == 10u;
		let s = select( - 1.0, 1.0, right );
		let th = ph + select( 3.14159, 0.0, right );
		let hipP = select( legs.x, legs.z, right ) + walk * 0.42 * sin( th );
		let knee = select( legs.y, legs.w, right ) + walk * ( 0.06 + 0.62 * max( 0.0, cos( th ) ) );
		let hip = vec3f( ${ J.hip[ 0 ].toFixed( 3 ) } * s, ${ J.hip[ 1 ].toFixed( 3 ) }, ${ J.hip[ 2 ].toFixed( 3 ) } );
		let kn = vec3f( ${ J.knee[ 0 ].toFixed( 3 ) } * s, ${ J.knee[ 1 ].toFixed( 3 ) }, ${ J.knee[ 2 ].toFixed( 3 ) } );
		if ( bone >= 9u ) {
			let R = c3Rx( - knee );
			q = R * ( q - kn ) + kn;
			n = R * n;
		}
		let R = c3Rz( s * spread ) * c3Rx( hipP );
		q = R * ( q - hip ) + hip;
		n = R * n;
	}
	// the upper body: the arms (and what they hold), the head, turned with the spine (the trunk's turn
	// worked out only for the vertices above the hips)
	let upper = bone != 0u && ( bone < 7u || bone > 10u );
	let spine = ${ f3( J.spine ) };
	var Rs = mat3x3f( 1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0 );
	if ( upper ) { Rs = c3Ry( a2.y ) * c3Rz( a2.z ) * c3Rx( - a2.x ); }
	if ( ( bone >= 3u && bone <= 6u ) || bone >= 11u ) {
		let right = bone == 4u || bone == 6u || bone == 12u;
		let s = select( - 1.0, 1.0, right );
		let sh = vec3f( ${ J.shoulder[ 0 ].toFixed( 3 ) } * s, ${ J.shoulder[ 1 ].toFixed( 3 ) }, ${ J.shoulder[ 2 ].toFixed( 3 ) } );
		let el = vec3f( ${ J.elbow[ 0 ].toFixed( 3 ) } * s, ${ J.elbow[ 1 ].toFixed( 3 ) }, ${ J.elbow[ 2 ].toFixed( 3 ) } );
		let Re = c3Rx( arm.w );
		let Ra = c3Ry( s * arm.z ) * c3Rz( s * arm.y ) * c3Rx( arm.x );
		if ( bone >= 11u ) {
			// a prop: upright ones stay level (only the anchor moves)
			let id = part - 32u;
			let hand = vec3f( ${ J.hand[ 0 ].toFixed( 3 ) } * s, ${ J.hand[ 1 ].toFixed( 3 ) }, ${ J.hand[ 2 ].toFixed( 3 ) } );
			let anchor = Rs * ( Ra * ( Re * ( hand - el ) + el - sh ) + sh - spine ) + spine;
			if ( c3Upright( id ) ) {
				// level, turned only with the trunk's twist
				let Ry = c3Ry( a2.y );
				q = anchor + Ry * ( q - hand );
				n = Ry * n;
			} else {
				q = anchor + Rs * Ra * Re * ( q - hand );
				n = Rs * Ra * Re * n;
			}
		} else {
			if ( bone >= 5u ) {
				q = Re * ( q - el ) + el;
				n = Re * n;
			}
			q = Ra * ( q - sh ) + sh;
			n = Ra * n;
			q = Rs * ( q - spine ) + spine;
			n = Rs * n;
		}
	} else if ( bone == 1u || bone == 2u ) {
		if ( bone == 2u ) {
			let neck = ${ f3( J.neck ) };
			let Rh = c3Ry( a2.w ) * c3Rx( - headPitch );
			q = Rh * ( q - neck ) + neck;
			n = Rh * n;
		}
		q = Rs * ( q - spine ) + spine;
		n = Rs * n;
	}
	// the pelvis carries it all: the bob of the stride, the drop into a crouch
	q.y += walk * 0.018 * cos( 2.0 * ph ) - a1.w;
	// placed: the spot, the yaw, the size
	let Ry = c3Ry( at.w );
	var o: C3Out;
	o.p = at.xyz + Ry * ( q * a1.x );
	o.n = Ry * n;
	return o;
}
`,
} );

// the palette (the shaders read it from a buffer, not an array in every invocation)
const PAL = { colors: 0, skin: 32, hair: 40, pants: 48, shoes: 56, size: 64 };
function palette() {

	const a = new Float32Array( PAL.size * 4 );
	const put = ( i, c ) => a.set( [ c[ 0 ], c[ 1 ], c[ 2 ], 1 ], i * 4 );
	COLORS.forEach( ( c, i ) => put( PAL.colors + i, c ) );
	[ [ 0.62, 0.42, 0.32 ], [ 0.56, 0.36, 0.25 ], [ 0.5, 0.31, 0.2 ], [ 0.42, 0.25, 0.15 ], [ 0.3, 0.17, 0.1 ], [ 0.2, 0.11, 0.06 ], [ 0.12, 0.065, 0.04 ], [ 0.5, 0.34, 0.2 ] ].forEach( ( c, i ) => put( PAL.skin + i, c ) );
	[ [ 0.016, 0.012, 0.01 ], [ 0.04, 0.024, 0.014 ], [ 0.1, 0.058, 0.03 ], [ 0.19, 0.12, 0.06 ], [ 0.4, 0.29, 0.14 ], [ 0.28, 0.08, 0.03 ], [ 0.26, 0.25, 0.24 ], [ 0.58, 0.57, 0.55 ] ].forEach( ( c, i ) => put( PAL.hair + i, c ) );
	[ [ 0.05, 0.075, 0.14 ], [ 0.02, 0.03, 0.06 ], [ 0.3, 0.25, 0.16 ], [ 0.015, 0.015, 0.015 ], [ 0.2, 0.2, 0.2 ], [ 0.015, 0.02, 0.05 ], [ 0.14, 0.14, 0.15 ], [ 0.09, 0.1, 0.05 ] ].forEach( ( c, i ) => put( PAL.pants + i, c ) );
	[ [ 0.62, 0.61, 0.58 ], [ 0.015, 0.015, 0.015 ], [ 0.3, 0.19, 0.08 ], [ 0.08, 0.04, 0.02 ], [ 0.2, 0.2, 0.2 ] ].forEach( ( c, i ) => put( PAL.shoes + i, c ) );
	return a;

}

// the parts only some have: shown or folded away, by the look
const brimHats = [ HAT.capRed, HAT.capNavy, HAT.cap1980, HAT.capRays, HAT.capBack, HAT.visor, HAT.capBlack, HAT.capWhite, HAT.police, HAT.cabbie, HAT.capWS ];
const capHats = [ HAT.capRed, HAT.capNavy, HAT.cap1980, HAT.capRays, HAT.capBack, HAT.capBlack, HAT.capWhite, HAT.police, HAT.capWS ];
const knitHats = [ HAT.knitRed, HAT.knitGrey, HAT.knitBlack, HAT.knitPlain ];
const any = ( v, list ) => list.map( ( x ) => `${ v } == ${ x }u` ).join( ' || ' );

function castMaterial( pool ) {

	const mat = standard( {
		name: 'cast', roughness: 0.8, side: 'double', modules: [ castModule ],
		storage: { c3Pose: { storage: () => pool.poseBuf, access: 'read' }, c3Prev: { storage: () => pool.prevBuf, access: 'read' }, c3Look: { storage: () => pool.lookBuf, access: 'read' },
			c3Order: { storage: () => pool.orderBuf, access: 'read' }, c3Pal: { storage: () => pool.palBuf, access: 'read' } },
		textures: { c3Atlas: () => pool.atlas, c3Signs: () => pool.signTex },
		attributes: { aInfo: 'vec2f' },
		varyings: { vLocal: 'vec3f', vPart: 'u32', vLook: 'vec4u', vPose: 'vec4f', vVar: 'f32' },
		vertex: /* wgsl */`
	let bone = u32( v.aInfo.x + 0.5 );
	let part = u32( v.aInfo.y + 0.5 );
	// this draw's figure (0 near, 1 far, 2 distant) and its stretch of the order: the visible ones packed
	// at the front, this instance draws that slot
	let lod = u32( draw.params.z + 0.5 );
	let slot = c3Order[ u32( draw.params.y + 0.5 ) + v.instance ];
	let lk = c3Look[ slot ];
	let lx = lk.x;
	let lz = lk.z;
	let top = lk.y & 31u;
	let hat = ( lz >> 6u ) & 31u;
	let poncho = ( lz >> 11u ) & 7u;
	let gear = ( lz >> 19u ) & 15u;
	let hairStyle = ( lx >> 6u ) & 3u;
	let k = slot * ${ POSE }u;
	let a3 = c3Pose[ k + 3u ];
	let a7 = c3Pose[ k + 7u ];
	let right = bone == 12u;
	let vars = u32( a7.w + 0.5 );
	// what isn't there costs nothing: the props not in hand and the parts this one hasn't got fold to a
	// point before any rigging
	var gone = false;
	let longCoat = top == ${ TOP.coat }u || top == ${ TOP.raincoat }u;
	if ( part >= 32u ) {
		gone = part - 32u != u32( select( a3.z, a3.w, right ) + 0.5 );
	} else if ( part == ${ PART.brim }u ) { gone = !( ${ any( 'hat', brimHats ) } );
	} else if ( part == ${ PART.pompom }u ) { gone = !( hat == ${ HAT.knitRed }u || hat == ${ HAT.knitGrey }u );
	} else if ( part == ${ PART.hairCard }u ) { gone = hairStyle != 1u || hat == ${ HAT.hood }u || poncho > 0u;
	} else if ( part == ${ PART.poncho }u ) { gone = poncho == 0u && ! longCoat;
	} else if ( part == ${ PART.apron }u ) { gone = !( top == ${ TOP.staff }u || top == ${ TOP.cook }u || top == ${ TOP.seller }u || top == ${ TOP.vendor }u );
	} else if ( part == ${ PART.vest }u ) { gone = top != ${ TOP.security }u;
	} else if ( part == ${ PART.bag }u ) { gone = ( gear & ${ GEAR.messenger }u ) == 0u || poncho > 0u;
	} else if ( part == ${ PART.pack }u ) { gone = ( gear & ${ GEAR.backpack }u ) == 0u;
	} else if ( part == ${ PART.radio }u ) { gone = ( gear & ${ GEAR.radio }u ) == 0u;
	} else if ( part == ${ PART.credential }u ) { gone = ( gear & ${ GEAR.credential }u ) == 0u || poncho > 0u;
	} else if ( part == ${ PART.campaign }u ) { gone = hat != ${ HAT.campaign }u;
	}
	if ( gone ) {
		v.useWorld = true;
		v.worldPos = vec3f( 0.0 );
		v.worldNormal = vec3f( 0.0, 1.0, 0.0 );
		v.prevWorldPos = vec3f( 0.0 );
		o.vLocal = vec3f( 0.0 );
		o.vPart = part;
		o.vLook = vec4u( 0u );
		o.vPose = vec4f( 0.0 );
		o.vVar = 0.0;
		return;
	}
	let age = ( lx >> 13u ) & 3u;
	let female = ( ( lx >> 12u ) & 1u ) == 1u;
	let build = ( lx >> 15u ) & 3u;
	var q = v.position;
	var n = v.normal;
	// the build: a belly, broad shoulders, a woman's narrower shoulders and fuller hips; a kid's big head
	let onTrunk = part == ${ PART.torso }u || part == ${ PART.pants }u || part == ${ PART.apron }u || part == ${ PART.vest }u || part == ${ PART.poncho }u
		|| part == ${ PART.bag }u || part == ${ PART.pack }u || part == ${ PART.radio }u || part == ${ PART.credential }u;
	if ( onTrunk ) {
		let belly = select( select( select( 0.0, 0.3, build == 1u ), 0.55, build == 2u ), 1.0, build == 3u );
		let bump = smoothstep( 0.86, 1.08, q.y ) * smoothstep( 1.36, 1.14, q.y );
		q.z -= belly * 0.07 * bump * smoothstep( 0.02, - 0.08, q.z );
		q.x *= 1.0 + belly * 0.12 * bump;
		if ( build == 2u ) { q.x *= 1.0 + 0.1 * smoothstep( 1.15, 1.38, q.y ); }
		if ( female ) {
			q.x *= mix( 1.0, 0.88, smoothstep( 1.15, 1.4, q.y ) ) * mix( 1.07, 1.0, smoothstep( 0.9, 1.05, q.y ) );
			q.z -= 0.028 * smoothstep( 1.16, 1.24, q.y ) * smoothstep( 1.36, 1.28, q.y ) * smoothstep( 0.0, - 0.08, q.z );
		}
	}
	if ( female && ( part == ${ PART.sleeve }u || part == ${ PART.hand }u ) ) { q.x *= 0.95; }
	if ( part == ${ PART.poncho }u ) {
		// one poncho for two (poncho 7): it hangs from his shoulders and spreads out over the one on his left
		if ( poncho == 7u ) {
			let spread = 1.0 - smoothstep( 1.18, 1.44, q.y );
			q.x = q.x * ( 1.0 + 0.95 * spread ) - 0.27 * spread;
			q.z = q.z * ( 1.0 + 0.25 * spread );
		}
		// a long coat hangs straighter than a poncho, and stops at the knee
		if ( poncho == 0u ) {
			let hang = 1.0 - smoothstep( 0.95, 1.3, q.y );
			q.x *= 1.0 - 0.3 * hang;
			q.z = ( q.z - 0.015 ) * ( 1.0 - 0.3 * hang ) + 0.015;
			q.y = max( q.y, 0.55 + ( q.y - 0.6 ) * 0.9 );
		}
	}
	let headC = ${ f3( J.head ) };
	if ( bone == 2u && part != ${ PART.neck }u ) {
		// a kid's head is big for his body; a hood (and a knit hat) sits over the hair
		if ( age == 2u ) { q = ${ f3( J.neck ) } + ( q - ${ f3( J.neck ) } ) * 1.22; }
		let d = ( q - headC ) / vec3f( ${ HEAD_R.map( ( r ) => r.toFixed( 3 ) ).join( ', ' ) } );
		if ( hat == ${ HAT.hood }u && part == ${ PART.head }u ) {
			let face = smoothstep( - 0.55, - 0.85, d.z ) * smoothstep( 0.75, 0.45, length( d.xy - vec2f( 0.0, - 0.05 ) ) );
			q = headC + ( q - headC ) * mix( 1.16, 1.0, face );
		}
		if ( ( ${ any( 'hat', knitHats ) } ) && part == ${ PART.head }u ) {
			q = q + ( q - headC ) * 0.06 * smoothstep( 0.1, 0.5, d.y );
			q.y += 0.018 * smoothstep( 0.7, 1.0, d.y );
		}
		// a peaked police cap: the crown wider and flat on top; a flat cap sits low and short
		if ( hat == ${ HAT.police }u && part == ${ PART.head }u && d.y > 0.45 ) {
			let t = smoothstep( 0.45, 0.8, d.y );
			q = vec3f( headC.x + ( q.x - headC.x ) * ( 1.0 + 0.18 * t ), mix( q.y, headC.y + ${ ( HEAD_R[ 1 ] * 0.95 ).toFixed( 3 ) }, t * 0.7 ), headC.z + ( q.z - headC.z ) * ( 1.0 + 0.12 * t ) );
		}
		if ( part == ${ PART.brim }u && hat == ${ HAT.cabbie }u ) { q = vec3f( q.x, q.y - 0.012, headC.z + ( q.z - headC.z ) * 0.7 ); }
		if ( part == ${ PART.brim }u && hat == ${ HAT.police }u ) { q = vec3f( q.x, q.y + 0.004, headC.z + ( q.z - headC.z ) * 0.85 ); }
	}
	if ( part == ${ PART.brim }u && hat == ${ HAT.capBack }u ) { q = vec3f( - ( q.x - headC.x ), q.y, - ( q.z - headC.z ) ) + headC; n = vec3f( - n.x, n.y, - n.z ); }
	// this vertex's arm (the left's row or the right's)
	let armRow = k + select( 4u, 5u, bone == 4u || bone == 6u || bone == 12u );
	let at = c3Pose[ k ];
	let r0 = c3Rig( q, n, bone, part, at, c3Pose[ k + 1u ], c3Pose[ k + 2u ], a3.x, c3Pose[ armRow ], c3Pose[ k + 6u ], a7.x );
	v.useWorld = true;
	v.worldPos = ( v.model * vec4f( r0.p, 1.0 ) ).xyz;
	v.worldNormal = normalize( ( v.model * vec4f( r0.n, 0.0 ) ).xyz );
	if ( lod == 0u ) {
		// the near ones rigged again in last frame's pose: the arms' and legs' own motion for the TAA
		let r1 = c3Rig( q, n, bone, part, c3Prev[ k ], c3Prev[ k + 1u ], c3Prev[ k + 2u ], c3Prev[ k + 3u ].x, c3Prev[ armRow ], c3Prev[ k + 6u ], c3Prev[ k + 7u ].x );
		v.prevWorldPos = ( v.prevModel * vec4f( r1.p, 1.0 ) ).xyz;
	} else {
		// further off, only where they've walked
		let moved = at.xyz - c3Prev[ k ].xyz;
		v.prevWorldPos = ( v.prevModel * vec4f( r0.p - moved, 1.0 ) ).xyz;
	}
	o.vLocal = q;
	o.vPart = part;
	o.vLook = lk;
	// ( the mouth, the breath, the blink, an umbrella up over them )
	o.vPose = vec4f( a3.y, a7.y, a7.z, select( 0.0, 1.0, u32( a3.w + 0.5 ) == ${ PROP.umbrella }u ) );
	o.vVar = f32( select( vars >> 8u, vars & 255u, right ) );
`,
		surface: /* wgsl */`
#if C3_FLAT
	// (profiling: the dressing skipped, the lighting kept)
	s.albedo = vec3f( 0.3 ); s.roughness = 0.8; s.metalness = 0.0; s.emissive = vec3f( 0.0 );
	return;
#endif
	let part = in.vs.vPart;
	let L = in.vs.vLocal;
	let lk = in.vs.vLook;
	let skinI = lk.x & 7u;
	let hairI = ( lk.x >> 3u ) & 7u;
	let hairStyle = ( lk.x >> 6u ) & 3u;
	let facial = ( lk.x >> 8u ) & 7u;
	let glasses = ( ( lk.x >> 11u ) & 1u ) == 1u;
	let female = ( ( lk.x >> 12u ) & 1u ) == 1u;
	let top = lk.y & 31u;
	let topCI = ( lk.y >> 5u ) & 31u;
	let sleeveCI = ( lk.y >> 10u ) & 31u;
	let back = ( lk.y >> 15u ) & 127u;
	let chest = ( lk.y >> 22u ) & 15u;
	let pantsI = lk.z & 7u;
	let shoesI = ( lk.z >> 3u ) & 7u;
	let hat = ( lk.z >> 6u ) & 31u;
	let poncho = ( lk.z >> 11u ) & 7u;
	let scarf = ( lk.z >> 14u ) & 3u;
	let gloves = ( ( lk.z >> 16u ) & 1u ) == 1u;
	let seed = f32( lk.w & 65535u ) / 65536.0;
	let g = fract( vec4f( seed * 13.1, seed * 71.7, seed * 191.3, seed * 7.37 ) );
	let nk = smoothstep( 0.15, 0.7, frame.night );
	let skin = c3Pal[ ${ PAL.skin }u + skinI ].xyz;
	let hairC = c3Pal[ ${ PAL.hair }u + hairI ].xyz;
	let topC = c3Pal[ ${ PAL.colors }u + min( topCI, ${ COLORS.length - 1 }u ) ].xyz;
	let sleeveC = c3Pal[ ${ PAL.colors }u + min( sleeveCI, ${ COLORS.length - 1 }u ) ].xyz;
	let longCoat = top == ${ TOP.coat }u || top == ${ TOP.raincoat }u;
	var c = topC;
	var rough = 0.85;
	var metal = 0.0;
	var e = vec3f( 0.0 );
	// the print on a jersey's back (the name over the number, or a word) or its chest, from the atlas: 8 x 10 cells
	var printA = 0.0;
	var printC = vec3f( 0.72, 0.71, 0.68 );
	if ( part == ${ PART.torso }u || part == ${ PART.sleeve }u ) {
		// what he wears: the top's cloth, its sheen, its seams
		let shiny = top == ${ TOP.jacket }u || top == ${ TOP.puffer }u || top == ${ TOP.leather }u || top == ${ TOP.satin }u || top == ${ TOP.usher }u || top == ${ TOP.flyers }u || top == ${ TOP.raincoat }u;
		rough = select( 0.88, 0.45, shiny );
		if ( top == ${ TOP.leather }u ) { rough = 0.38; }
		if ( top == ${ TOP.raincoat }u ) { rough = 0.25; }
		if ( top == ${ TOP.coat }u ) { rough = 0.95; }
		// a jersey or a tee: the sleeves are the thermal or hoodie underneath, below the short sleeve
		let shortSleeve = top == ${ TOP.homeJersey }u || top == ${ TOP.nameTee }u || top == ${ TOP.powder }u || top == ${ TOP.rays }u || top == ${ TOP.roadJersey }u || top == ${ TOP.champsTee }u || top == ${ TOP.staff }u || top == ${ TOP.cook }u || top == ${ TOP.polo }u;
		if ( part == ${ PART.sleeve }u && shortSleeve && L.y < 1.26 ) { c = sleeveC; rough = 0.9; }
		// the home whites: red pinstripes (a pale stripe on the powder blues' placket)
		let jersey = top == ${ TOP.homeJersey }u || top == ${ TOP.roadJersey }u;
		if ( jersey && ( part == ${ PART.torso }u || L.y > 1.26 ) ) {
			let pw = fwidth( L.x ) + fwidth( L.z );
			let pin = smoothstep( 0.06 + pw * 20.0, 0.0, abs( fract( ( L.x + L.z * 0.3 ) / 0.038 ) - 0.5 ) - 0.44 ) * ( 1.0 - smoothstep( 0.003, 0.008, pw ) );
			c = mix( c, vec3f( 0.36, 0.05, 0.06 ), pin * 0.45 * select( 1.0, 0.0, top == ${ TOP.roadJersey }u ) );
			// the red piping down the front and round the collar
			if ( part == ${ PART.torso }u && L.z < 0.0 && abs( L.x ) < 0.012 && L.y > 0.9 ) { c = vec3f( 0.3, 0.02, 0.03 ); }
		}
		// the puffer's quilted bands, a zip down the front of the jackets and fleeces
		if ( top == ${ TOP.puffer }u && part == ${ PART.torso }u ) { c *= 0.8 + 0.2 * smoothstep( 0.0, 0.4, abs( fract( L.y / 0.09 ) - 0.5 ) ); }
		let zipped = top == ${ TOP.jacket }u || top == ${ TOP.fleece }u || top == ${ TOP.puffer }u || top == ${ TOP.leather }u || top == ${ TOP.work }u || top == ${ TOP.satin }u || top == ${ TOP.usher }u || top == ${ TOP.eagles }u || top == ${ TOP.camo }u || top == ${ TOP.flyers }u || top == ${ TOP.raincoat }u;
		if ( zipped && part == ${ PART.torso }u && L.z < 0.0 && abs( L.x ) < 0.006 && L.y > 0.86 ) { c = mix( c, vec3f( 0.3 ), 0.7 ); metal = 0.6; }
		// a work jacket's corduroy collar, a satin jacket's striped cuffs and waistband
		if ( top == ${ TOP.work }u && part == ${ PART.torso }u && L.y > 1.41 ) { c = vec3f( 0.08, 0.045, 0.02 ); }
		if ( top == ${ TOP.satin }u && ( ( part == ${ PART.torso }u && L.y < 0.9 ) || ( part == ${ PART.sleeve }u && L.y < 0.92 ) ) ) {
			c = select( vec3f( 0.6 ), vec3f( 0.3, 0.02, 0.03 ), fract( L.y / 0.02 ) < 0.5 );
		}
		// a hoodie's pouch pocket and its hood lying down the back
		if ( top == ${ TOP.hoodie }u && part == ${ PART.torso }u ) {
			if ( L.z < 0.0 && L.y > 0.9 && L.y < 1.06 && abs( L.x ) < 0.11 ) { c *= 0.85; }
			if ( L.z > 0.05 && L.y > 1.3 ) { c *= 0.8; }
		}
		// the Eagles' midnight green with the silver and black
		if ( top == ${ TOP.eagles }u && part == ${ PART.sleeve }u && L.y < 1.1 ) { c = vec3f( 0.25 ); }
		// the concession staff's polo; the hawker's and the program seller's colours
		if ( top == ${ TOP.usher }u && part == ${ PART.torso }u && L.z < 0.0 && L.y > 1.18 && L.y < 1.24 && L.x > 0.05 && L.x < 0.13 ) { c = vec3f( 0.7, 0.6, 0.3 ); metal = 0.5; }
		if ( top == ${ TOP.usher }u ) {
			// the royal-blue side panels down the ribs and the sleeves' undersides, white piping at their edges
			let sidePanel = ( part == ${ PART.torso }u && abs( L.x ) > 0.125 && L.y < 1.36 ) || ( part == ${ PART.sleeve }u && L.z > 0.035 );
			let piping = ( part == ${ PART.torso }u && abs( abs( L.x ) - 0.125 ) < 0.008 && L.y < 1.36 );
			if ( sidePanel ) { c = vec3f( 0.03, 0.08, 0.36 ); }
			if ( piping ) { c = vec3f( 0.75 ); }
		}
		// the hawkers' yellow shirts, a number badge on the chest
		if ( top == ${ TOP.hawker }u && part == ${ PART.torso }u && L.z < 0.0 && abs( L.x - 0.08 ) < 0.035 && abs( L.y - 1.28 ) < 0.03 ) { c = vec3f( 0.8 ); }
		// ---- P0's tops
		if ( top == ${ TOP.camo }u ) {
			// a hunting jacket's blotches: olive, brown, khaki
			let cell = floor( vec3f( L.x * 14.0 + L.z * 5.0, L.y * 11.0, L.z * 14.0 - L.x * 3.0 ) );
			let hsh = fract( sin( dot( cell, vec3f( 12.9898, 78.233, 37.719 ) ) ) * 43758.5453 );
			c = select( select( vec3f( 0.1, 0.11, 0.05 ), vec3f( 0.16, 0.1, 0.05 ), hsh > 0.45 ), vec3f( 0.24, 0.21, 0.12 ), hsh > 0.78 );
			rough = 0.9;
		}
		if ( top == ${ TOP.flyers }u && ( part == ${ PART.sleeve }u || L.y > 1.33 ) ) { c = vec3f( 0.012 ); }
		if ( top == ${ TOP.trooper }u ) {
			// the black placket stripe and epaulettes; the badge over the left breast
			if ( part == ${ PART.torso }u && L.z < 0.0 && abs( L.x ) < 0.01 && L.y > 0.9 ) { c = vec3f( 0.012 ); }
			if ( part == ${ PART.torso }u && L.y > 1.38 && abs( L.x ) > 0.1 ) { c = vec3f( 0.015 ); }
			if ( part == ${ PART.torso }u && L.z < 0.0 && abs( L.x + 0.09 ) < 0.022 && abs( L.y - 1.29 ) < 0.028 ) { c = vec3f( 0.62, 0.5, 0.22 ); metal = 0.8; rough = 0.3; }
		}
		if ( top == ${ TOP.coat }u && part == ${ PART.torso }u ) {
			// the lapels' shade and the buttons down the front
			if ( L.z < 0.0 && L.y > 1.22 && abs( L.x ) < 0.05 + ( L.y - 1.22 ) * 0.6 ) { c *= 0.75; }
			if ( L.z < 0.0 && abs( L.x - 0.03 ) < 0.008 && abs( fract( L.y / 0.1 ) - 0.5 ) < 0.08 && L.y < 1.2 ) { c = vec3f( 0.02 ); }
		}
		if ( top == ${ TOP.polo }u && part == ${ PART.torso }u && L.y > 1.41 ) { c *= 0.85; }
		// a police officer's shield over the left breast
		if ( ( ( lk.z >> 17u ) & 1u ) == 1u && part == ${ PART.torso }u && L.z < 0.0 && abs( L.x + 0.09 ) < 0.02 && abs( L.y - 1.29 ) < 0.026 ) { c = vec3f( 0.62, 0.5, 0.22 ); metal = 0.8; rough = 0.3; }
		if ( top == ${ TOP.raincoat }u ) {
			// the silver reflective bands round the body and the sleeves, bright in the lights
			if ( ( part == ${ PART.torso }u && abs( L.y - 1.05 ) < 0.02 ) || ( part == ${ PART.sleeve }u && abs( L.y - 1.0 ) < 0.02 ) ) { c = vec3f( 0.75, 0.75, 0.7 ); e = vec3f( 0.3, 0.3, 0.25 ) * nk; }
		}
		// the prints: the name and number on the back, the chest's script
		let onBack = L.z > 0.03 && part == ${ PART.torso }u;
		let onFront = L.z < - 0.03 && part == ${ PART.torso }u;
		if ( back > 0u && onBack && L.y > 0.98 && L.y < 1.4 ) {
			let uv = vec2f( 0.5 + L.x / 0.34, ( 1.4 - L.y ) / 0.42 );
			if ( all( uv > vec2f( 0.0 ) ) && all( uv < vec2f( 1.0 ) ) ) {
				let cell = vec2f( f32( back % 8u ), f32( back / 8u ) );
				printA = textureSample( c3Atlas, smpAnisoClamp, ( cell + uv ) / vec2f( 8.0, ${ ATLAS_ROWS }.0 ) ).r;
			}
		}
		if ( chest > 0u && onFront && L.y > 1.08 && L.y < 1.36 ) {
			let uv = vec2f( 0.5 - L.x / 0.32, ( 1.36 - L.y ) / 0.28 );
			if ( all( uv > vec2f( 0.0 ) ) && all( uv < vec2f( 1.0 ) ) ) {
				let ci = ${ CHEST_CELL }u + chest;
				let cell = vec2f( f32( ci % 8u ), f32( ci / 8u ) );
				printA = textureSample( c3Atlas, smpAnisoClamp, ( cell + uv ) / vec2f( 8.0, ${ ATLAS_ROWS }.0 ) ).r;
			}
		}
		// the print's colour: red on white, white on red, maroon on powder blue, navy on the Rays' white
		printC = select( vec3f( 0.72, 0.71, 0.68 ), vec3f( 0.32, 0.018, 0.024 ), dot( topC, vec3f( 0.33 ) ) > 0.35 );
		if ( top == ${ TOP.powder }u ) { printC = vec3f( 0.14, 0.02, 0.03 ); }
		if ( top == ${ TOP.rays }u ) { printC = select( vec3f( 0.8 ), vec3f( 0.02, 0.04, 0.12 ), dot( topC, vec3f( 0.33 ) ) > 0.35 ); }
		if ( top == ${ TOP.security }u || top == ${ TOP.staff }u ) { printC = vec3f( 0.75 ); }
		if ( top == ${ TOP.champsTee }u ) { printC = select( vec3f( 0.3, 0.02, 0.03 ), vec3f( 0.7 ), dot( topC, vec3f( 0.33 ) ) < 0.2 ); }
		if ( top == ${ TOP.flyers }u ) { printC = vec3f( 0.012 ); }
		if ( top == ${ TOP.raincoat }u ) { printC = vec3f( 0.02 ); }
		if ( chest == ${ CHEST.ws }u && onFront ) { printC = select( vec3f( 0.75, 0.6, 0.2 ), vec3f( 0.72, 0.71, 0.68 ), dot( topC, vec3f( 0.33 ) ) < 0.2 ); }
		if ( chest == ${ CHEST.bulls }u && onFront ) { printC = vec3f( 0.75, 0.55, 0.15 ); }
		c = mix( c, printC, printA );
		// ---- B (home): a ticket lanyard (the Diamond Club's, heston 2986440011): a white strap from the
		// sides of the neck down to a clear pouch on the chest with the ticket in it (look.z bit 18)
		if ( ( ( lk.z >> 18u ) & 1u ) == 1u && part == ${ PART.torso }u && L.z < - 0.02 ) {
			let lx = abs( L.x );
			let sy = clamp( ( L.y - 1.2 ) / 0.23, 0.0, 1.0 );
			let strap = abs( lx - mix( 0.014, 0.068, sy ) ) < 0.007 && L.y > 1.19 && L.y < 1.44;
			let pouch = lx < 0.043 && L.y > 1.06 && L.y < 1.2;
			if ( strap ) { c = vec3f( 0.7, 0.69, 0.66 ); rough = 0.8; }
			if ( pouch ) {
				// the ticket through the plastic: white stock, a red band, a dark barcode
				c = vec3f( 0.68, 0.67, 0.64 );
				if ( L.y > 1.165 ) { c = vec3f( 0.42, 0.03, 0.04 ); }
				if ( L.y < 1.085 && abs( fract( L.x * 160.0 ) - 0.5 ) < 0.2 ) { c = vec3f( 0.05 ); }
				rough = 0.15;
			}
		}
		// ---- end B
		// a scarf round the neck
		if ( scarf > 0u && part == ${ PART.torso }u && L.y > 1.38 ) {
			c = select( select( vec3f( 0.012 ), vec3f( 0.25 ), scarf == 2u ), select( vec3f( 0.32, 0.02, 0.03 ), vec3f( 0.7 ), fract( ( L.x + L.y ) / 0.05 ) < 0.5 ), scarf == 1u );
			rough = 0.95;
		}
	}
	if ( part == ${ PART.pants }u ) {
		c = c3Pal[ ${ PAL.pants }u + pantsI ].xyz * ( 0.9 + 0.2 * g.z );
		// jeans fade at the thighs and knees; a trooper's black stripe down the leg
		if ( pantsI < 2u ) { c *= 1.0 + 0.25 * smoothstep( 0.3, 0.0, abs( L.y - 0.62 ) ) * smoothstep( - 0.02, - 0.06, L.z ); }
		if ( pantsI == 6u && abs( abs( L.x ) - 0.19 ) < 0.012 ) { c = vec3f( 0.012 ); }
		if ( pantsI == 7u ) {
			let cell = floor( vec3f( L.x * 12.0, L.y * 9.0, L.z * 12.0 ) );
			let hsh = fract( sin( dot( cell, vec3f( 12.9898, 78.233, 37.719 ) ) ) * 43758.5453 );
			c = select( vec3f( 0.1, 0.11, 0.05 ), vec3f( 0.18, 0.15, 0.08 ), hsh > 0.5 );
		}
		rough = 0.9;
	}
	if ( part == ${ PART.shoe }u ) {
		c = c3Pal[ ${ PAL.shoes }u + min( shoesI, 4u ) ].xyz;
		if ( L.y < 0.012 ) { c = select( c * 0.5, vec3f( 0.5 ), shoesI == 0u ); }
		// the soles wet from the floor
		rough = 0.6;
	}
	if ( part == ${ PART.hand }u ) { c = select( skin, select( vec3f( 0.012 ), vec3f( 0.3, 0.02, 0.03 ), g.y > 0.6 ), gloves ); rough = select( 0.6, 0.9, gloves ); }
	if ( part == ${ PART.neck }u ) {
		c = skin; rough = 0.6;
		if ( L.y < 1.43 ) { c = topC; }
		// a turtleneck under a polo (the Bull's)
		if ( top == ${ TOP.polo }u && sleeveCI != topCI && L.y < 1.53 ) { c = sleeveC; rough = 0.9; }
		if ( scarf > 0u ) { c = select( select( vec3f( 0.012 ), vec3f( 0.25 ), scarf == 2u ), vec3f( 0.32, 0.02, 0.03 ), scarf == 1u ); rough = 0.95; }
	}
	if ( part == ${ PART.nose }u ) { c = skin * vec3f( 1.12, 0.88, 0.86 ); rough = 0.5; }
	if ( part == ${ PART.head }u ) {
		// the head in its own frame, the face toward -z
		let d = ( L - ${ f3( J.head ) } ) / vec3f( ${ HEAD_R.map( ( r ) => r.toFixed( 3 ) ).join( ', ' ) } );
		let ax = abs( d.x );
		c = skin;
		rough = 0.55;
		let fw = fwidth( d.x ) + fwidth( d.y );
		let near = 1.0 - smoothstep( 0.12, 0.35, fw );
		let front = smoothstep( 0.1, - 0.25, d.z );
		// the cold: red cheeks, nose and ears
		c = mix( c, c * vec3f( 1.3, 0.78, 0.76 ), 0.45 * smoothstep( 0.3, 0.05, length( vec2f( ax - 0.46, d.y + 0.16 ) ) ) * front );
		// the eyes: sockets in shadow, the whites and the irises; the brows; a blink now and then
		let blink = in.vs.vPose.z;
		let ey = vec2f( ax - 0.34, d.y - 0.1 );
		c *= mix( 1.0, 0.68, smoothstep( 0.22, 0.08, length( ey * vec2f( 1.0, 1.5 ) ) ) * front );
		let white = smoothstep( 0.1, 0.075, length( ey * vec2f( 1.0, 1.9 + blink * 6.0 ) ) ) * near * front;
		c = mix( c, vec3f( 0.55, 0.53, 0.5 ), white );
		c = mix( c, vec3f( 0.02, 0.015, 0.01 ), smoothstep( 0.05, 0.035, length( ey * vec2f( 1.0, 1.0 + blink * 6.0 ) ) ) * near * front );
		let brow = smoothstep( 0.05, 0.02, abs( d.y - 0.3 + 0.05 * ax ) ) * step( 0.1, ax ) * step( ax, select( 0.56, 0.5, female ) ) * front;
		c = mix( c, hairC, brow * select( 0.85, 0.55, female ) );
		// the mouth: lips (redder on the women); open when he talks, shouts or blows into his hands
		let open = in.vs.vPose.x;
		let mo = length( vec2f( d.x / 0.25, ( d.y + 0.45 ) / ( 0.05 + 0.13 * open ) ) );
		let lip = c * select( vec3f( 0.85, 0.62, 0.6 ), vec3f( 0.95, 0.5, 0.52 ), female );
		c = mix( c, mix( lip, vec3f( 0.06, 0.02, 0.02 ), smoothstep( 0.3, 0.7, open ) ), smoothstep( 1.0, 0.7, mo ) * front );
		// a moustache, a goatee, a beard, stubble (the stubble a shadow, the beard a softer band)
		if ( facial == 1u || facial == 3u ) { c = mix( c, hairC, smoothstep( 0.05, 0.02, abs( d.y + 0.33 ) ) * step( ax, 0.3 ) * front ); }
		if ( facial == 2u ) { c = mix( c, hairC, ( smoothstep( 0.05, 0.02, abs( d.y + 0.33 ) ) * step( ax, 0.28 ) + step( d.y, - 0.5 ) * step( ax, 0.24 ) ) * front ); }
		if ( facial == 3u ) { c = mix( c, hairC, 0.8 * step( d.y, - 0.2 ) * step( d.z, 0.4 ) * step( 0.55, mo ) * smoothstep( 0.95, 0.75, ax + max( 0.0, d.y + 0.2 ) ) ); }
		if ( facial == 4u ) { c *= mix( vec3f( 1.0 ), vec3f( 0.8, 0.82, 0.86 ), step( d.y, - 0.2 ) * step( d.z, 0.3 ) * step( 0.8, mo ) ); }
		// glasses: thin dark frames round the eyes and over the nose, a glint
		if ( glasses ) {
			let ring = abs( length( ey * vec2f( 1.0, 1.25 ) ) - 0.17 );
			let fr = max( smoothstep( 0.035, 0.015, ring ), smoothstep( 0.03, 0.01, abs( d.y - 0.14 ) ) * step( ax, 0.18 ) );
			c = mix( c, vec3f( 0.015 ), fr * front );
			rough = mix( rough, 0.15, smoothstep( 0.17, 0.12, length( ey * vec2f( 1.0, 1.25 ) ) ) * front );
		}
		// the ears (red with the cold)
		c *= mix( vec3f( 1.0 ), vec3f( 1.1, 0.8, 0.78 ), smoothstep( 0.86, 0.95, ax ) * step( abs( d.y ), 0.25 ) * step( abs( d.z ), 0.35 ) );
		// the hair: short (a hairline, the back and sides), long, pulled back, or a horseshoe round a bald
		// crown (which shines)
		var hairy = d.y > 0.42 - 0.55 * smoothstep( - 0.35, 0.5, d.z ) || ( ax > 0.8 && d.y > - 0.05 && d.z > - 0.3 );
		if ( hairStyle == 1u ) { hairy = d.y > 0.4 - 1.4 * smoothstep( - 0.55, 0.25, d.z ) || ( ax > 0.72 && d.y > - 0.55 && d.z > - 0.45 ); }
		if ( hairStyle == 2u ) { hairy = d.y > 0.36 - 0.6 * smoothstep( - 0.4, 0.4, d.z ) || ( d.z > 0.6 && d.y > - 0.4 && ax < 0.25 ); }
		if ( hairStyle == 3u ) { hairy = d.y > - 0.35 && d.y < 0.2 + 0.15 * smoothstep( 0.2, 0.8, d.z ) && d.z > - 0.15; rough = select( rough, 0.3, d.y > 0.2 ); }
		if ( hairy ) { c = hairC; rough = 0.7; }
		// hats: a cap (the white P on the red one), a knit hat (a folded cuff, ribs, the Phillies' white
		// band), a hood round the face
		var capC = select( select( vec3f( 0.014, 0.02, 0.06 ), vec3f( 0.33, 0.015, 0.02 ), hat == ${ HAT.capRed }u || hat == ${ HAT.capBack }u ), vec3f( 0.12, 0.018, 0.026 ), hat == ${ HAT.cap1980 }u );
		if ( hat == ${ HAT.capRays }u ) { capC = vec3f( 0.012, 0.025, 0.08 ); }
		if ( hat == ${ HAT.capBlack }u || hat == ${ HAT.capWS }u ) { capC = vec3f( 0.012 ); }
		if ( hat == ${ HAT.capWhite }u ) { capC = vec3f( 0.7, 0.69, 0.66 ); }
		if ( hat == ${ HAT.police }u ) { capC = vec3f( 0.01, 0.012, 0.03 ); }
		let capped = ${ any( 'hat', capHats ) };
		if ( capped && d.y > 0.26 - 0.12 * smoothstep( - 0.2, 0.6, d.z ) ) {
			c = capC; rough = 0.8;
			// the logo on the front panel (the back, turned round)
			let lz = select( d.z, - d.z, hat == ${ HAT.capBack }u );
			let lp = vec2f( d.x / 0.3, ( d.y - 0.55 ) / 0.3 );
			if ( lz < - 0.55 && length( lp ) < 1.0 && hat != ${ HAT.police }u ) {
				// a letter P: its stem and bowl (the WS cap's gold mark)
				let stem = abs( lp.x + 0.25 ) < 0.14 && abs( lp.y ) < 0.7;
				let bowl = abs( length( ( lp - vec2f( 0.05, 0.3 ) ) * vec2f( 1.0, 1.3 ) ) - 0.32 ) < 0.12 && lp.x > - 0.25;
				if ( stem || bowl ) { c = select( select( vec3f( 0.75 ), vec3f( 0.32, 0.02, 0.03 ), hat == ${ HAT.capNavy }u || hat == ${ HAT.capWhite }u ), vec3f( 0.6, 0.62, 0.66 ), hat == ${ HAT.capRays }u ); }
				if ( hat == ${ HAT.capWS }u && ( stem || bowl || abs( lp.y + 0.55 ) < 0.08 ) ) { c = vec3f( 0.7, 0.55, 0.15 ); metal = 0.3; }
			}
			// a police cap: the badge over the peak, the black band round the crown, its crown glossy
			if ( hat == ${ HAT.police }u ) {
				if ( d.z < - 0.6 && abs( d.x ) < 0.13 && abs( d.y - 0.5 ) < 0.12 ) { c = vec3f( 0.62, 0.5, 0.22 ); metal = 0.8; rough = 0.3; }
				if ( d.y < 0.42 ) { c = vec3f( 0.006 ); rough = 0.3; }
			}
			if ( abs( fract( atan2( d.x, d.z ) * 0.955 ) - 0.5 ) > 0.485 && hat != ${ HAT.police }u ) { c *= 0.7; }
		}
		if ( hat == ${ HAT.cabbie }u && d.y > 0.3 - 0.1 * smoothstep( - 0.2, 0.6, d.z ) ) {
			// a tweed flat cap: the herringbone's weave
			c = mix( vec3f( 0.14, 0.11, 0.08 ), vec3f( 0.22, 0.19, 0.15 ), step( 0.5, fract( ( d.x + abs( fract( d.y * 6.0 ) - 0.5 ) * 0.3 ) * 28.0 ) ) );
			rough = 0.95;
		}
		if ( hat == ${ HAT.visor }u && d.y > 0.18 && d.y < 0.34 ) { c = vec3f( 0.33, 0.015, 0.02 ); }
		let knit = ${ any( 'hat', knitHats ) };
		if ( knit && d.y > 0.12 - 0.1 * smoothstep( - 0.2, 0.6, d.z ) ) {
			var kc = select( select( select( vec3f( 0.3, 0.29, 0.26 ), vec3f( 0.012 ), hat == ${ HAT.knitBlack }u ), vec3f( 0.32, 0.018, 0.025 ), hat == ${ HAT.knitRed }u ), mix( vec3f( 0.014, 0.02, 0.06 ), vec3f( 0.42, 0.4, 0.36 ), g.w ), hat == ${ HAT.knitPlain }u );
			c = kc * ( 0.88 + 0.12 * sin( atan2( d.x, d.z ) * 40.0 ) );
			if ( d.y < 0.34 ) { c = kc * 0.8; }
			if ( hat == ${ HAT.knitRed }u && abs( d.y - 0.55 ) < 0.07 ) { c = vec3f( 0.62, 0.6, 0.55 ); }
			rough = 0.97;
		}
		if ( hat == ${ HAT.earmuffs }u && ax > 0.78 && abs( d.y ) < 0.35 && abs( d.z ) < 0.4 ) { c = vec3f( 0.3, 0.02, 0.03 ); rough = 1.0; }
		if ( hat == ${ HAT.hood }u || ( poncho > 0u && g.x > 0.35 ) ) {
			let oval = length( vec2f( d.x * 1.05, ( d.y + 0.08 ) * 0.92 ) );
			if ( d.z > - 0.35 || oval > 0.72 ) {
				c = select( topC, select( vec3f( 0.5 ), mix( topC * 0.85, vec3f( 0.45 ), 0.2 ), poncho == 1u ), poncho > 0u );
				c *= select( 1.0, 0.55, oval < 0.85 && d.z < - 0.2 );
				rough = select( 0.85, 0.2, poncho > 0u );
			}
		}
	}
	if ( part == ${ PART.hairCard }u ) { c = hairC; rough = 0.7; }
	if ( part == ${ PART.brim }u ) {
		c = select( select( vec3f( 0.014, 0.02, 0.06 ), vec3f( 0.33, 0.015, 0.02 ), hat == ${ HAT.capRed }u || hat == ${ HAT.capBack }u || hat == ${ HAT.visor }u ), vec3f( 0.12, 0.018, 0.026 ), hat == ${ HAT.cap1980 }u );
		if ( hat == ${ HAT.capRays }u ) { c = vec3f( 0.012, 0.025, 0.08 ); }
		if ( hat == ${ HAT.capBlack }u || hat == ${ HAT.capWS }u ) { c = vec3f( 0.012 ); }
		if ( hat == ${ HAT.capWhite }u ) { c = vec3f( 0.7, 0.69, 0.66 ); }
		if ( hat == ${ HAT.cabbie }u ) { c = vec3f( 0.16, 0.13, 0.1 ); }
		rough = 0.8;
		// the police cap's patent-leather peak
		if ( hat == ${ HAT.police }u ) { c = vec3f( 0.006 ); rough = 0.12; }
	}
	if ( part == ${ PART.pompom }u ) { c = select( vec3f( 0.32, 0.29, 0.26 ), vec3f( 0.62, 0.6, 0.56 ), hat == ${ HAT.knitRed }u ); rough = 1.0; }
	if ( part == ${ PART.apron }u ) {
		// the concession staff's black apron (the cooks' white, stained; the street vendors' canvas)
		c = select( vec3f( 0.014 ), vec3f( 0.6, 0.58, 0.54 ) * ( 0.85 + 0.15 * g.x ), top == ${ TOP.cook }u );
		if ( top == ${ TOP.seller }u ) { c = vec3f( 0.3, 0.02, 0.03 ); }
		if ( top == ${ TOP.vendor }u ) { c = vec3f( 0.36, 0.3, 0.19 ) * ( 0.85 + 0.2 * fract( L.y * 37.0 ) ); }
		rough = 0.9;
	}
	if ( part == ${ PART.vest }u ) {
		// hi-vis: fluorescent yellow-green, two silver bands (the hawkers' is yellow and red)
		c = select( vec3f( 0.55, 0.62, 0.02 ), vec3f( 0.68, 0.52, 0.03 ), top == ${ TOP.hawker }u );
		if ( ( abs( L.y - 1.06 ) < 0.02 || abs( L.y - 1.18 ) < 0.02 ) && top != ${ TOP.hawker }u ) { c = vec3f( 0.65 ); rough = 0.3; }
		e = c * 0.06;
	}
	if ( part == ${ PART.poncho }u ) {
		if ( poncho == 0u ) {
			// a long coat's skirt: the coat's own cloth, open down the front
			c = topC * select( 1.0, 0.8, L.z < - 0.1 && abs( L.x ) < 0.025 );
			rough = select( 0.95, 0.25, top == ${ TOP.raincoat }u );
			if ( top == ${ TOP.raincoat }u && abs( L.y - 0.75 ) < 0.02 ) { c = vec3f( 0.75, 0.75, 0.7 ); e = vec3f( 0.3, 0.3, 0.25 ) * nk; }
		} else {
			// the poncho: clear plastic over the jacket (glossy, the jacket dulled through it), or red, white
			// or yellow; wet on the 27th, and creased
			let fres = pow( 1.0 - abs( dot( normalize( in.N ), normalize( in.V ) ) ), 2.5 );
			var pc = select( select( select( mix( topC * 0.8, vec3f( 0.42, 0.44, 0.47 ), 0.03 + 0.35 * fres ), vec3f( 0.36, 0.02, 0.03 ), poncho == 2u ), vec3f( 0.62 ), poncho == 3u ), vec3f( 0.65, 0.5, 0.03 ), poncho == 4u );
			if ( poncho == 5u ) { pc = vec3f( 0.62, 0.2, 0.02 ); }
			if ( poncho == 7u ) { pc = mix( topC * 0.8, vec3f( 0.42, 0.44, 0.47 ), 0.1 + 0.35 * fres ); }
			if ( poncho == 6u ) { pc = vec3f( 0.06, 0.065, 0.07 ); }
			let crease = 0.9 + 0.1 * sin( atan2( L.x, L.z ) * 11.0 + L.y * 7.0 ) + select( 0.0, 0.12 * sin( L.y * 31.0 + L.x * 17.0 ), poncho == 6u );
			c = pc * crease;
			// the clear ones catch the light like wet film: glossier where they face it
			rough = select( 0.18, 0.06, poncho == 1u || poncho == 7u );
			// the clear film shows the jacket's print through it
			if ( poncho == 1u ) { c = mix( c, printC, printA * 0.6 ); }
		}
	}
	// ---- P0: the worn gear
	if ( part == ${ PART.bag }u ) { c = select( select( vec3f( 0.02 ), vec3f( 0.14, 0.08, 0.04 ), g.z > 0.55 ), vec3f( 0.015, 0.02, 0.05 ), g.z > 0.85 ); rough = 0.7; if ( abs( L.x + 0.215 ) > 0.04 ) { c = vec3f( 0.015 ); } }
	if ( part == ${ PART.pack }u ) {
		c = select( select( vec3f( 0.015, 0.02, 0.06 ), vec3f( 0.02 ), g.w > 0.45 ), vec3f( 0.3, 0.02, 0.03 ), g.w > 0.8 );
		if ( L.z > 0.26 ) { c *= 0.7; }
		if ( L.z < 0.0 ) { c = vec3f( 0.015 ); }
		rough = 0.75;
	}
	if ( part == ${ PART.radio }u ) { c = vec3f( 0.02 ); rough = 0.4; if ( L.y > 1.385 && L.y < 1.395 ) { c = vec3f( 0.6, 0.02, 0.02 ); e = vec3f( 0.8, 0.02, 0.02 ) * nk; } }
	if ( part == ${ PART.credential }u ) {
		c = vec3f( 0.3, 0.02, 0.03 );
		if ( L.y < 1.26 ) { c = select( vec3f( 0.75, 0.74, 0.7 ), vec3f( 0.08, 0.1, 0.3 ), L.y > 1.235 ); if ( abs( L.x + 0.015 ) < 0.012 && abs( L.y - 1.2 ) < 0.018 ) { c = skin; } }
		rough = 0.5;
	}
	if ( part == ${ PART.campaign }u ) { c = vec3f( 0.035, 0.034, 0.033 ) * ( 0.85 + 0.2 * fract( sin( dot( floor( L * 80.0 ), vec3f( 12.9, 78.2, 37.7 ) ) ) * 43758.5 ) ); rough = 0.9; if ( L.y < ${ ( J.head[ 1 ] + 0.075 ).toFixed( 3 ) } && L.y > ${ ( J.head[ 1 ] + 0.062 ).toFixed( 3 ) } ) { c = vec3f( 0.015 ); } }
	// what's in their hands
	if ( part >= 32u ) {
		let id = part - 32u;
		let pv = u32( in.vs.vVar + 0.5 );
		rough = 0.4;
		let pl = L;
		if ( id == ${ PROP.beer }u || id == ${ PROP.beers }u ) {
			// a clear plastic cup of lager with its head of foam
			c = vec3f( 0.55, 0.33, 0.04 );
			rough = 0.1;
			if ( in.N.y > 0.7 ) { c = vec3f( 0.75, 0.72, 0.62 ); rough = 0.9; }
		}
		if ( id == ${ PROP.soda }u ) { c = select( vec3f( 0.7, 0.68, 0.64 ), vec3f( 0.45, 0.03, 0.03 ), fract( pl.y / 0.05 ) < 0.45 ); rough = 0.5; }
		if ( id == ${ PROP.cocoa }u ) {
			// a white paper cup, a brown sleeve, a black lid
			c = vec3f( 0.72, 0.7, 0.66 );
			if ( abs( pl.y - 0.785 ) < 0.022 ) { c = vec3f( 0.2, 0.11, 0.05 ); }
			if ( pl.y > 0.848 ) { c = vec3f( 0.02 ); }
		}
		if ( id == ${ PROP.waterIce }u ) { c = select( vec3f( 0.7, 0.68, 0.64 ), select( vec3f( 0.55, 0.03, 0.05 ), vec3f( 0.6, 0.5, 0.05 ), g.y > 0.6 ), in.N.y > 0.3 ); }
		if ( id == ${ PROP.cottonCandy }u ) { c = select( vec3f( 0.7 ), select( vec3f( 0.75, 0.3, 0.45 ), vec3f( 0.25, 0.45, 0.75 ), g.z > 0.6 ), pl.y > 0.93 ); rough = 1.0; e = c * 0.05; }
		if ( id == ${ PROP.tray }u ) {
			// the carrier's cardboard, the cheesesteak's foil, the fries' red and white boat, the drinks
			c = vec3f( 0.42, 0.3, 0.17 );
			if ( pl.y > 0.776 && abs( pl.x ) < 0.09 ) {
				c = select( select( vec3f( 0.6, 0.45, 0.1 ), vec3f( 0.45, 0.03, 0.03 ), pl.y < 0.79 ), vec3f( 0.7, 0.7, 0.72 ), pl.z > - 0.1 );
				if ( pl.z > - 0.1 ) { metal = 0.85; rough = 0.35; }
			}
			if ( pl.y > 0.776 && abs( pl.x ) > 0.07 ) { c = select( vec3f( 0.7, 0.68, 0.64 ), vec3f( 0.45, 0.03, 0.03 ), fract( pl.y / 0.05 ) < 0.45 ); }
		}
		if ( id == ${ PROP.program }u || id == ${ PROP.programs }u ) {
			// the World Series program: a glossy cover, the Fall Classic's navy and gold
			c = mix( vec3f( 0.02, 0.04, 0.14 ), vec3f( 0.55, 0.42, 0.12 ), step( 0.7, fract( pl.y * 9.0 + pl.z * 4.0 ) ) );
			rough = 0.25;
		}
		if ( id == ${ PROP.scorebook }u ) { c = vec3f( 0.7, 0.68, 0.62 ); rough = 0.8; }
		if ( id == ${ PROP.phone }u ) { c = vec3f( 0.08, 0.08, 0.09 ); metal = 0.5; e = vec3f( 0.25, 0.4, 0.6 ) * 0.8 * step( 0.5, fract( pl.y * 30.0 ) ); }
		if ( id == ${ PROP.glove }u ) { c = vec3f( 0.3, 0.14, 0.05 ); rough = 0.6; }
		if ( id == ${ PROP.towel }u ) {
			// the 2008 rally towel (the Game 4 photos): white terry, a big red square, the script in white
			c = vec3f( 0.75, 0.74, 0.7 ); rough = 1.0;
			let tq = vec2f( pl.z * 4.0, ( pl.y - 0.6 ) * 4.5 );
			if ( abs( fract( tq.x + 0.5 ) - 0.5 ) < 0.3 && abs( fract( tq.y + 0.5 ) - 0.5 ) < 0.28 ) { c = vec3f( 0.36, 0.02, 0.03 ); if ( abs( fract( tq.y + 0.5 ) - 0.5 ) < 0.05 && abs( fract( tq.x + 0.5 ) - 0.5 ) < 0.22 ) { c = vec3f( 0.8 ); } }
		}
		if ( id == ${ PROP.bag }u ) { c = select( vec3f( 0.72 ), vec3f( 0.35, 0.02, 0.03 ), g.w > 0.5 ); rough = 0.35; }
		if ( id == ${ PROP.sandwich }u ) { c = vec3f( 0.7, 0.7, 0.72 ); metal = 0.9; rough = 0.35; }
		if ( id == ${ PROP.hotdog }u ) { c = vec3f( 0.62, 0.42, 0.2 ); }
		if ( id == ${ PROP.peanuts }u ) { c = vec3f( 0.36, 0.24, 0.13 ) * ( 0.85 + 0.25 * fract( pl.y * 37.0 ) ); rough = 0.95; }
		if ( id == ${ PROP.money }u ) { c = vec3f( 0.35, 0.42, 0.3 ); rough = 0.9; }
		// a World Series ticket: the white stock, a red band
		if ( id == ${ PROP.ticket }u ) { c = select( vec3f( 0.75, 0.74, 0.7 ), vec3f( 0.45, 0.03, 0.04 ), fract( pl.y * 40.0 ) < 0.3 ); rough = 0.8; }
		if ( id == ${ PROP.pencil }u ) { c = vec3f( 0.7, 0.55, 0.05 ); }
		if ( id == ${ PROP.camera }u ) {
			// silver (or black), the screen lit; now and then the flash (the last out's flashbulbs)
			c = select( vec3f( 0.55, 0.56, 0.58 ), vec3f( 0.03 ), pv == 1u ); metal = 0.7; rough = 0.3;
			e = vec3f( 0.3, 0.45, 0.6 ) * 0.5;
			if ( fract( frame.time * 0.9 + g.x * 17.0 ) > 0.965 ) { e = vec3f( 30.0 ); }
		}
		// ---- P0's props
		if ( id == ${ PROP.umbrella }u ) {
			// the canopy's panels: black, Phillies red, a red and white golf umbrella, navy, a plaid, grey;
			// the shaft and the crook black
			let rel = pl - vec3f( ${ J.hand[ 0 ].toFixed( 3 ) }, ${ ( J.hand[ 1 ] + 0.78 ).toFixed( 3 ) }, ${ J.hand[ 2 ].toFixed( 3 ) } );
			let panel = u32( floor( ( atan2( rel.z, rel.x ) + 3.14159 ) / 0.785398 ) ) % 2u;
			c = vec3f( 0.012 );
			if ( pv == 1u ) { c = vec3f( 0.33, 0.015, 0.02 ); }
			if ( pv == 2u ) { c = select( vec3f( 0.33, 0.015, 0.02 ), vec3f( 0.72, 0.71, 0.68 ), panel == 1u ); }
			if ( pv == 3u ) { c = vec3f( 0.01, 0.014, 0.05 ); }
			if ( pv == 4u ) { c = mix( vec3f( 0.1, 0.01, 0.01 ), vec3f( 0.02, 0.05, 0.02 ), step( 0.5, fract( rel.x * 12.0 ) ) ) * ( 0.8 + 0.4 * step( 0.5, fract( rel.z * 12.0 ) ) ); }
			if ( pv == 5u ) { c = vec3f( 0.25, 0.25, 0.26 ); }
			if ( rel.y < - 0.12 ) { c = vec3f( 0.015 ); metal = 0.5; }
			rough = 0.35;
		}
		if ( id == ${ PROP.furled }u ) { c = vec3f( 0.012, 0.014, 0.03 ); rough = 0.4; }
		if ( id == ${ PROP.sign }u || id == ${ PROP.photo }u ) {
			// the card from the sign atlas on its face; the back and the edges plain cardboard
			c = vec3f( 0.45, 0.36, 0.22 );
			rough = 0.9;
			let cell = vec2f( f32( pv % 8u ), f32( pv / 8u ) );
			var uv = vec2f( 0.0 );
			var face = false;
			if ( id == ${ PROP.sign }u ) {
				let o = vec3f( ${ ( J.hand[ 0 ] - 0.27 ).toFixed( 3 ) }, ${ ( J.hand[ 1 ] + 0.14 ).toFixed( 3 ) }, ${ ( J.hand[ 2 ] - 0.06 ).toFixed( 3 ) } );
				// (read from in front: the figure's right is the reader's left)
				uv = vec2f( 0.5 - ( pl.x - o.x ) / 0.72, 0.5 - ( pl.y - o.y ) / 0.5 );
				face = pl.z < o.z - 0.004;
			} else {
				// (in either hand)
				let o = vec3f( select( - 1.0, 1.0, pl.x > 0.0 ) * ${ ( J.hand[ 0 ] - 0.02 ).toFixed( 3 ) }, ${ J.hand[ 1 ].toFixed( 3 ) }, ${ ( J.hand[ 2 ] - 0.14 ).toFixed( 3 ) } );
				uv = vec2f( 0.5 - ( pl.x - o.x ) / 0.2, 0.5 + ( pl.z - o.z ) / 0.25 );
				face = pl.y > o.y + 0.002;
				rough = 0.2;
			}
			if ( face ) { c = textureSample( c3Signs, smpAnisoClamp, ( cell + clamp( uv, vec2f( 0.01 ), vec2f( 0.99 ) ) ) / vec2f( 8.0, 4.0 ) ).rgb; }
		}
		if ( id == ${ PROP.scanner }u ) { c = vec3f( 0.03 ); rough = 0.4; if ( pl.z < ${ ( J.hand[ 2 ] - 0.185 ).toFixed( 3 ) } ) { c = vec3f( 0.6, 0.05, 0.03 ); e = vec3f( 0.8, 0.05, 0.02 ) * 0.4; } }
		if ( id == ${ PROP.flashlight }u ) { c = vec3f( 0.04 ); metal = 0.7; rough = 0.3; if ( pl.z < ${ ( J.hand[ 2 ] - 0.135 ).toFixed( 3 ) } ) { c = vec3f( 0.8 ); e = vec3f( 3.0, 2.8, 2.4 ) * nk; } }
		if ( id == ${ PROP.mic }u ) {
			// the grille, the station's flag in its red and blue
			c = vec3f( 0.03 ); rough = 0.4;
			if ( abs( pl.y - ${ ( J.hand[ 1 ] + 0.09 ).toFixed( 3 ) } ) < 0.031 ) { c = select( vec3f( 0.04, 0.08, 0.35 ), vec3f( 0.45, 0.03, 0.03 ), pl.y > ${ ( J.hand[ 1 ] + 0.1 ).toFixed( 3 ) } ); }
			if ( pl.y > ${ ( J.hand[ 1 ] + 0.14 ).toFixed( 3 ) } ) { c = vec3f( 0.25 ); metal = 0.7; }
		}
		if ( id == ${ PROP.tickets }u ) { c = select( vec3f( 0.75, 0.74, 0.7 ), vec3f( 0.45, 0.03, 0.04 ), fract( ( pl.y - pl.x ) * 20.0 ) < 0.25 ); rough = 0.8; }
		if ( id == ${ PROP.cowbell }u ) { c = vec3f( 0.45, 0.42, 0.36 ); metal = 0.8; rough = 0.35; }
		if ( id == ${ PROP.tongs }u ) { c = vec3f( 0.5, 0.5, 0.52 ); metal = 0.9; rough = 0.3; }
		if ( id == ${ PROP.pennant }u ) { c = select( vec3f( 0.25, 0.17, 0.08 ), vec3f( 0.36, 0.02, 0.03 ), pl.y > ${ ( J.hand[ 1 ] + 0.23 ).toFixed( 3 ) } && pl.z < ${ ( J.hand[ 2 ] - 0.03 ).toFixed( 3 ) } ); rough = 0.9; if ( abs( pl.y - ${ ( J.hand[ 1 ] + 0.33 ).toFixed( 3 ) } ) < 0.015 && pl.z < ${ ( J.hand[ 2 ] - 0.08 ).toFixed( 3 ) } ) { c = vec3f( 0.75 ); } }
		if ( id == ${ PROP.cigarette }u ) { c = select( vec3f( 0.75 ), vec3f( 0.6, 0.35, 0.1 ), pl.z < ${ ( J.hand[ 2 ] + 0.0 ).toFixed( 3 ) } ); if ( pl.z > ${ ( J.hand[ 2 ] + 0.06 ).toFixed( 3 ) } ) { c = vec3f( 0.3, 0.05, 0.0 ); e = vec3f( 2.5, 0.5, 0.05 ) * ( 0.6 + 0.4 * sin( frame.time * 3.0 + g.y * 20.0 ) ); } rough = 0.9; }
		if ( id == ${ PROP.thermos }u ) { c = select( vec3f( 0.08, 0.16, 0.08 ), vec3f( 0.3 ), pl.y > ${ ( J.hand[ 1 ] + 0.095 ).toFixed( 3 ) } ); metal = 0.4; rough = 0.45; }
		if ( id == ${ PROP.radio }u ) { c = select( vec3f( 0.3, 0.02, 0.03 ), vec3f( 0.6 ), pl.y > ${ ( J.hand[ 1 ] + 0.02 ).toFixed( 3 ) } ); metal = 0.3; rough = 0.4; }
	}
	// the rain on them: shoulders, caps and hoods darker and glossy on the 27th
	let wetK = frame.wet * smoothstep( 0.2, 0.8, normalize( in.N ).y ) * select( 0.6, 1.0, part == ${ PART.poncho }u || part == 32u + ${ PROP.umbrella }u ) * select( 1.0, 0.0, ( ( lk.w >> 16u ) & 1u ) == 1u ) * select( 1.0 - 0.75 * in.vs.vPose.w, 1.0, part == 32u + ${ PROP.umbrella }u );
	c *= mix( 1.0, 0.8, wetK * step( 0.5, rough ) );
	rough = mix( rough, 0.25, wetK * 0.6 );
	s.albedo = c;
	s.roughness = rough;
	s.metalness = metal;
	// lit by the park's own lights after dark
	s.emissive = e + c * nk * 0.12;
`,
	} );
	mat.underwaterLighting = 'none';
	mat.setDefine( 'DRY', 1 );
	return mat;

}

// the soft shadow on the floor under each (the concourse's light comes from everywhere at once)
function blobMaterial( pool ) {

	const mat = standard( { name: 'cast-contact', color: new Color( 0, 0, 0 ), transparent: true, depthWrite: false, lit: false,
		storage: { c3Pose: { storage: () => pool.poseBuf, access: 'read' }, c3Order: { storage: () => pool.orderBuf, access: 'read' } },
		varyings: { vK: 'f32' },
		vertex: /* wgsl */`
	let slot = c3Order[ u32( draw.params.y + 0.5 ) + v.instance ];
	let at = c3Pose[ slot * ${ POSE }u ];
	let a1 = c3Pose[ slot * ${ POSE }u + 1u ];
	let s = a1.x * ( 0.75 + 0.35 * a1.z );
	v.useWorld = true;
	v.worldPos = ( v.model * vec4f( at.x + v.position.x * 0.62 * s, at.y + 0.012, at.z + v.position.z * 0.62 * s, 1.0 ) ).xyz;
	v.worldNormal = ( v.model * vec4f( 0.0, 1.0, 0.0, 0.0 ) ).xyz;
	o.vK = select( 0.0, 1.0, a1.x > 0.05 && a1.w < 0.2 );
`,
		surface: 'let r = length( in.uv - 0.5 ) * 2.0; s.albedo = vec3f( 0.0 ); s.alpha = ( 1.0 - smoothstep( 0.15, 1.0, r ) ) * 0.5 * in.vs.vK;' } );
	mat.underwaterLighting = 'none';
	return mat;

}

// The atlas: the backs (the name curved over the number, as the Phillies' are lettered; a word across the
// shoulders), the chest prints. A mask (white on black): the shader colours it. 8 x 10 cells of 128 px.
function drawAtlas() {

	return canvasTexture( 1024, 128 * ATLAS_ROWS, ( ctx ) => {

		ctx.fillStyle = '#000';
		ctx.fillRect( 0, 0, 1024, 128 * ATLAS_ROWS );
		ctx.fillStyle = '#fff';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'alphabetic';
		const cell = ( i ) => [ ( i % 8 ) * 128, Math.floor( i / 8 ) * 128 ];
		BACKS.forEach( ( b, i ) => {

			if ( ! b ) return;
			const [ x, y ] = cell( i );
			const [ name, num ] = b;
			if ( name.startsWith( '=' ) ) {

				// a word across the back (STAFF, SECURITY, POLICE, FOX 29)
				const word = name.slice( 1 );
				ctx.font = `900 ${ word.length > 6 ? 24 : 34 }px "Helvetica Neue", Arial, sans-serif`;
				ctx.fillText( word, x + 64, y + 52, 120 );
				return;

			}

			// the name in an arc over the number
			ctx.font = `700 ${ name.length > 7 ? 14 : 17 }px "Helvetica Neue", Arial, sans-serif`;
			const w = ctx.measureText( name ).width;
			let cx = x + 64 - w / 2;
			for ( const ch of name ) {

				const cw = ctx.measureText( ch ).width;
				const t = ( cx + cw / 2 - ( x + 64 ) ) / 60;
				ctx.save();
				ctx.translate( cx + cw / 2, y + 30 + t * t * 10 );
				ctx.rotate( t * 0.35 );
				ctx.fillText( ch, 0, 0 );
				ctx.restore();
				cx += cw;

			}

			ctx.font = `800 ${ num.length > 1 ? 70 : 76 }px "Times New Roman", Georgia, serif`;
			ctx.fillText( num, x + 64, y + 108, 110 );

		} );
		// the chest: the script "Phillies", block PHILLIES, the NL champions' tee (they won the pennant on
		// October 15), RAYS, EVENT STAFF, SECURITY, EAGLES, RED OCTOBER; the World Series tee, the Flyers'
		// winged P, Bull's BBQ, FOX 29
		const chests = [ null, 'script', 'block', 'champs', 'rays', 'staff', 'security', 'eagles', 'redOct', 'ws', 'flyers', 'bulls', 'fox' ];
		chests.forEach( ( k, j ) => {

			if ( ! k ) return;
			const [ x, y ] = cell( CHEST_CELL + j );
			ctx.save();
			if ( k === 'script' ) {

				ctx.font = 'italic 700 44px "Brush Script MT", "Snell Roundhand", Georgia, serif';
				ctx.translate( x + 64, y + 70 );
				ctx.rotate( - 0.12 );
				ctx.fillText( 'Phillies', 0, 0, 120 );

			} else if ( k === 'block' ) {

				ctx.font = '900 24px "Helvetica Neue", Arial, sans-serif';
				ctx.fillText( 'PHILLIES', x + 64, y + 60, 118 );

			} else if ( k === 'champs' ) {

				ctx.font = '800 15px "Helvetica Neue", Arial, sans-serif';
				ctx.fillText( '2008', x + 64, y + 36 );
				ctx.font = '900 19px "Helvetica Neue", Arial, sans-serif';
				ctx.fillText( 'NATIONAL', x + 64, y + 58, 118 );
				ctx.fillText( 'LEAGUE', x + 64, y + 78, 118 );
				ctx.font = '900 17px "Helvetica Neue", Arial, sans-serif';
				ctx.fillText( 'CHAMPIONS', x + 64, y + 98, 118 );

			} else if ( k === 'rays' ) {

				ctx.font = '900 40px "Helvetica Neue", Arial, sans-serif';
				ctx.fillText( 'RAYS', x + 64, y + 72, 118 );

			} else if ( k === 'staff' ) {

				ctx.font = '800 17px "Helvetica Neue", Arial, sans-serif';
				ctx.fillText( 'PHILLIES', x + 34, y + 44, 56 );

			} else if ( k === 'security' ) {

				ctx.font = '900 22px "Helvetica Neue", Arial, sans-serif';
				ctx.fillText( 'SECURITY', x + 64, y + 60, 118 );

			} else if ( k === 'eagles' ) {

				ctx.font = '900 26px "Helvetica Neue", Arial, sans-serif';
				ctx.fillText( 'EAGLES', x + 64, y + 62, 118 );

			} else if ( k === 'redOct' ) {

				ctx.font = '900 22px "Helvetica Neue", Arial, sans-serif';
				ctx.fillText( 'RED', x + 64, y + 50, 118 );
				ctx.fillText( 'OCTOBER', x + 64, y + 76, 118 );

			} else if ( k === 'ws' ) {

				// the 2008 World Series logo, as the shirts had it: WORLD SERIES over 2008, the flags' bar
				ctx.font = '900 18px "Helvetica Neue", Arial, sans-serif';
				ctx.fillText( 'WORLD SERIES', x + 64, y + 44, 118 );
				ctx.font = '900 38px "Helvetica Neue", Arial, sans-serif';
				ctx.fillText( '2008', x + 64, y + 84 );
				ctx.fillRect( x + 26, y + 96, 76, 5 );

			} else if ( k === 'flyers' ) {

				// the winged P (the mask: the jacket's black shows where it's white)
				ctx.beginPath(); ctx.arc( x + 70, y + 62, 26, 0, Math.PI * 2 ); ctx.fill();
				ctx.fillRect( x + 26, y + 48, 40, 8 ); ctx.fillRect( x + 30, y + 64, 34, 8 );
				ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc( x + 74, y + 60, 11, 0, Math.PI * 2 ); ctx.fill();

			} else if ( k === 'bulls' ) {

				ctx.font = 'italic 800 30px Georgia, serif';
				ctx.fillText( 'Bull\'s', x + 64, y + 58 );
				ctx.font = '800 22px Georgia, serif';
				ctx.fillText( 'BBQ', x + 64, y + 88 );

			} else if ( k === 'fox' ) {

				ctx.font = '900 30px Helvetica, Arial, sans-serif';
				ctx.fillText( 'FOX 29', x + 64, y + 72, 118 );

			}

			ctx.restore();

		} );

	}, 'castAtlas' );

}

// the homemade signs, 8 x 4 cards of 256 px (a card nobody registered: plain cardboard)
function drawSigns() {

	return canvasTexture( 2048, 1024, ( ctx, w, h ) => {

		ctx.fillStyle = '#8c7350';
		ctx.fillRect( 0, 0, w, h );
		SIGNS.forEach( ( S, i ) => {

			ctx.save();
			ctx.translate( ( i % 8 ) * 256, Math.floor( i / 8 ) * 256 );
			ctx.beginPath(); ctx.rect( 0, 0, 256, 256 ); ctx.clip();
			S.draw( ctx, 256, 256 );
			ctx.restore();

		} );

	}, 'castSigns' );

}

// ---------------------------------------------------------------- looks and poses

// a look: the fields above, packed
export function packLook( o ) {

	const x = ( o.skin & 7 ) | ( ( o.hair & 7 ) << 3 ) | ( ( o.hairStyle & 3 ) << 6 ) | ( ( o.facial & 7 ) << 8 ) | ( ( o.glasses ? 1 : 0 ) << 11 )
		| ( ( o.female ? 1 : 0 ) << 12 ) | ( ( o.age & 3 ) << 13 ) | ( ( o.build & 3 ) << 15 );
	const y = ( o.top & 31 ) | ( ( o.color & 31 ) << 5 ) | ( ( o.sleeves & 31 ) << 10 ) | ( ( o.back & 127 ) << 15 ) | ( ( o.chest & 15 ) << 22 );
	const z = ( o.pants & 7 ) | ( ( o.shoes & 7 ) << 3 ) | ( ( o.hat & 31 ) << 6 ) | ( ( o.poncho & 7 ) << 11 ) | ( ( o.scarf & 3 ) << 14 ) | ( ( o.gloves ? 1 : 0 ) << 16 ) | ( ( o.badge ? 1 : 0 ) << 17 ) | ( ( o.lanyard ? 1 : 0 ) << 18 ) | ( ( o.gear & 15 ) << 19 );
	return [ x >>> 0, y >>> 0, z >>> 0, ( ( ( o.seed ?? Math.floor( Math.random() * 65536 ) ) & 65535 ) | ( ( o.dry ? 1 : 0 ) << 16 ) ) >>> 0 ];

}

// a pose standing at ease; the angles in radians (see c3Rig): arm = [ shoulder pitch (forward +),
// roll (out to the side +), yaw (across the body +), elbow (bent +) ]
export function restPose() {

	return {
		phase: 0, walk: 0, drop: 0, lean: 0, twist: 0, roll: 0, headYaw: 0, headPitch: 0, mouth: 0,
		propL: 0, propR: 0, varL: 0, varR: 0, armL: [ 0.05, 0.06, 0, 0.12 ], armR: [ 0.05, 0.06, 0, 0.12 ],
		hipL: 0, kneeL: 0, hipR: 0, kneeR: 0, spread: 0, breath: 0, blink: 0,
	};

}

// Seated on something h metres up (a stadium seat is ~0.45): the thighs out level, the shins down, the
// pelvis lowered onto the seat. (With h over ~0.5 the feet hang: a kid on a wall.)
export function seat( pose, h = 0.45 ) {

	pose.hipL = pose.hipR = 1.5;
	pose.kneeL = pose.kneeR = 1.5;
	pose.drop = 0.84 - h;
	pose.walk = 0;
	return pose;

}

// ---------------------------------------------------------------- the pool

const NEAR_FRAC = 0.14; // stood taller than this share of the screen's height: the near figure
const TINY_FRAC = 0.04; // shorter than this: the distant one
const H = 1.75; // the figure's height
const _vp = new Matrix4(), _frustum = new Frustum(), _m = new Matrix4(), _inv = new Matrix4(), _cam = new Vector3();
let POOL = null;

class Pool {

	constructor() {

		this.troupes = [];
		this.people = [];
		this.cap = 0;
		this.hidden = false;
		this.stats = { people: 0, drawn: 0, near: 0, far: 0, tiny: 0, culled: 0 };
		this.pal = palette();
		this.palBuf = new StorageBuffer( { label: 'castPalette', count: PAL.size, type: 'vec4f', data: this.pal } );
		this._grow( 256 );
		this.atlas = drawAtlas();
		this.signTex = drawSigns();
		this._signsDrawn = SIGNS.length;
		this.material = castMaterial( this );
		this.blobMat = blobMaterial( this );
		this.geometry = [ figureGeometry( 0 ), figureGeometry( 1 ), figureGeometry( 2 ) ];
		const make = ( geo, mat, name, lod ) => {

			const m = new Mesh( geo, mat );
			m.name = name;
			m.frustumCulled = false;
			m.castShadow = false;
			m.receiveShadow = true;
			m.userData.dynamic = true;
			// drawn first: people stand in front of most of what's behind them (the floor, the walls)
			m.renderOrder = - 1;
			// this draw's stretch of the order, and which figure it is
			m.drawParams = [ 0, lod, 0 ];
			m.onBeforeRender = ( r, s, camera ) => this.flush( camera );
			return m;

		};

		this.meshes = [ make( this.geometry[ 0 ], this.material, 'cast', 0 ), make( this.geometry[ 1 ], this.material, 'cast-far', 1 ), make( this.geometry[ 2 ], this.material, 'cast-distant', 2 ) ];
		for ( const [ i, m ] of this.meshes.entries() ) m.drawParams[ 0 ] = this.cap * ( i + 1 );
		const blob = new PlaneGeometry( 1, 1 );
		blob.rotateX( - Math.PI / 2 );
		blob.instanceCount = 0;
		this.blobs = new Mesh( blob, this.blobMat );
		this.blobs.name = 'cast-contact';
		this.blobs.frustumCulled = false;
		this.blobs.layers.set( 2 );
		this.blobs.userData.dynamic = true;
		this.blobs.drawParams = [ 0, 0, 0 ];
		this.blobs.onBeforeRender = ( r, s, camera ) => this.flush( camera );
		this.group = null;
		this._frame = - 1;
		if ( typeof window !== 'undefined' ) window.__cast = this;

	}

	// room for n people
	_grow( n ) {

		const cap = Math.max( 256, Math.ceil( n * 1.25 / 64 ) * 64 );
		if ( cap <= this.cap ) return;
		const old = this.cap ? { pose: this.pose, looks: this.looks } : null;
		this.cap = cap;
		this.pose = new Float32Array( cap * POSE * 4 );
		this.looks = new Uint32Array( cap * 4 );
		if ( old ) {

			this.pose.set( old.pose );
			this.looks.set( old.looks );

		}

		// the order: [ the contact shadows | the near | the far | the distant ], cap slots each
		this.order = new Uint32Array( cap * 4 );
		// two buffers of poses, turn about: this frame's, and last frame's (the previous poses, for the
		// motion vectors, without uploading them again)
		this._bufs = [ 0, 1 ].map( ( i ) => new StorageBuffer( { label: 'castPose' + i, count: cap * POSE, type: 'vec4f' } ) );
		this._cur = 0;
		this.lookBuf = new StorageBuffer( { label: 'castLooks', count: cap, type: 'vec4u' } );
		this.orderBuf = new StorageBuffer( { label: 'castOrder', count: cap * 4, type: 'u32' } );
		this._looksDirty = true;
		for ( const p of this.people || [] ) p.fresh = true;
		if ( this.meshes ) for ( const [ i, m ] of this.meshes.entries() ) m.drawParams[ 0 ] = cap * ( i + 1 );

	}

	get poseBuf() { return this._bufs[ this._cur ]; }
	get prevBuf() { return this._bufs[ 1 - this._cur ]; }

	// the pool's meshes go in the field frame (the group the troupes' places are in): found from a troupe
	// once they're all built and in the scene (not from one whose place isn't drawn: ?only=)
	_attach( troupe ) {

		let o = troupe.parent;
		while ( o.parent && ! o.parent.isScene ) o = o.parent;
		if ( ! o.parent ) return false;
		if ( this.group !== o ) {

			this.group = o;
			for ( const m of [ ...this.meshes, this.blobs ] ) o.add( m );

		}

		return true;

	}

	add( troupe, look ) {

		const slot = this.people.length;
		if ( slot >= this.cap ) this._grow( slot + 1 );
		const p = { slot, x: 0, y: 0, z: 0, yaw: 0, scale: 1, visible: true, fresh: true, pose: restPose(), look, troupe };
		this.looks.set( packLook( look ), slot * 4 );
		this.people.push( p );
		this._looksDirty = true;
		return p;

	}

	setLook( p, look ) {

		p.look = look;
		this.looks.set( packLook( look ), p.slot * 4 );
		this._looksDirty = true;

	}

	// once a frame, as the first of the pool's meshes is about to be drawn: who's seen and in which figure
	// (p.lod), the poses and the order up to the GPU
	flush( camera ) {

		if ( this._frame === GPU.frame ) return;
		this._frame = GPU.frame;
		const G = this.group;
		if ( ! G || ! camera ) return;
		if ( this._signsDirty && SIGNS.length !== this._signsDrawn ) {

			this.signTex = drawSigns();
			this._signsDrawn = SIGNS.length;

		}

		this._signsDirty = false;
		const n = this.people.length;
		if ( n > this.cap ) this._grow( n );
		// the camera: the view's four sides (world), and how big a figure stands on the screen
		_vp.multiplyMatrices( camera.projectionMatrix, camera.matrixWorldInverse );
		_frustum.setFromProjectionMatrix( _vp );
		const planes = _frustum.planes;
		const pe = camera.projectionMatrix.elements, focal = Math.abs( pe[ 5 ] ) * 0.5;
		_cam.setFromMatrixPosition( camera.matrixWorld );
		const cx = _cam.x, cy = _cam.y, cz = _cam.z;
		G.updateWorldMatrix( true, false );
		const M = G.matrixWorld.elements;
		const P = this.pose;
		const O = this.order, cap = this.cap;
		const near = [], nearD = [], fresh = [];
		let nBlob = 0, nFar = 0, nTiny = 0, culled = 0, drawn = 0, lo = Infinity, hi = - 1;
		const hidden = this.hidden;
		const inv = _inv.copy( G.matrixWorld ).invert();
		const gone = ( t ) => {

			for ( const p of t.list ) {

				p.lod = - 1;
				p.fresh = true;

			}

		};

		for ( const t of this.troupes ) {

			t.drawn = 0;
			t.drawnNear = 0;
			// a troupe whose place isn't drawn (?only=), or looked away from
			let o = t.parent;
			while ( o && o !== G ) o = o.parent;
			// (profiling: window.__cast.skip, a Set of troupes left out)
			if ( ! o || hidden || this.skip?.has( t ) ) {

				gone( t );
				continue;

			}

			// where the troupe's frame is in the pool's (the field frame: the same, for every place so far)
			t.parent.updateWorldMatrix( true, false );
			const R = _rel( t, inv );
			if ( t.bounds && ! _sphereIn( planes, M, t.bounds.center.x, t.bounds.center.y, t.bounds.center.z, t.bounds.radius ) ) {

				gone( t );
				continue;

			}

			for ( const p of t.list ) {

				if ( ! p.visible ) {

					p.lod = - 1;
					p.fresh = true;
					continue;

				}

				const a = p.pose;
				let x = p.x, y = p.y, z = p.z, yaw = p.yaw;
				if ( R ) {

					const x0 = x, y0 = y, z0 = z;
					x = R[ 0 ] * x0 + R[ 4 ] * y0 + R[ 8 ] * z0 + R[ 12 ];
					y = R[ 1 ] * x0 + R[ 5 ] * y0 + R[ 9 ] * z0 + R[ 13 ];
					z = R[ 2 ] * x0 + R[ 6 ] * y0 + R[ 10 ] * z0 + R[ 14 ];
					yaw += Math.atan2( R[ 8 ], R[ 0 ] );

				}

				// in the view? (a sphere round the figure: taller with an umbrella or a sign up)
				const s = p.scale, my = y + 0.9 * s;
				const big = a.propR === PROP.umbrella || a.propR === PROP.sign ? 0.5 : 0;
				const wx = M[ 0 ] * x + M[ 4 ] * my + M[ 8 ] * z + M[ 12 ], wy = M[ 1 ] * x + M[ 5 ] * my + M[ 9 ] * z + M[ 13 ], wz = M[ 2 ] * x + M[ 6 ] * my + M[ 10 ] * z + M[ 14 ];
				const r = - ( 1.15 + big ) * s;
				let seen = true;
				for ( let i = 0; i < 4; i ++ ) {

					const pl = planes[ i ], nn = pl.normal;
					if ( nn.x * wx + nn.y * wy + nn.z * wz + pl.constant < r ) {

						seen = false;
						break;

					}

				}

				if ( ! seen ) {

					p.lod = - 1;
					p.fresh = true;
					culled ++;
					continue;

				}

				// seen: the pose packed
				const sl = p.slot, o4 = sl * POSE * 4;
				P[ o4 ] = x; P[ o4 + 1 ] = y; P[ o4 + 2 ] = z; P[ o4 + 3 ] = yaw;
				P[ o4 + 4 ] = s; P[ o4 + 5 ] = a.phase; P[ o4 + 6 ] = a.walk; P[ o4 + 7 ] = a.drop;
				P[ o4 + 8 ] = a.lean; P[ o4 + 9 ] = a.twist; P[ o4 + 10 ] = a.roll; P[ o4 + 11 ] = a.headYaw;
				P[ o4 + 12 ] = a.headPitch; P[ o4 + 13 ] = a.mouth; P[ o4 + 14 ] = a.propL; P[ o4 + 15 ] = a.propR;
				const L = a.armL, Rr = a.armR;
				P[ o4 + 16 ] = L[ 0 ]; P[ o4 + 17 ] = L[ 1 ]; P[ o4 + 18 ] = L[ 2 ]; P[ o4 + 19 ] = L[ 3 ];
				P[ o4 + 20 ] = Rr[ 0 ]; P[ o4 + 21 ] = Rr[ 1 ]; P[ o4 + 22 ] = Rr[ 2 ]; P[ o4 + 23 ] = Rr[ 3 ];
				P[ o4 + 24 ] = a.hipL; P[ o4 + 25 ] = a.kneeL; P[ o4 + 26 ] = a.hipR; P[ o4 + 27 ] = a.kneeR;
				P[ o4 + 28 ] = a.spread; P[ o4 + 29 ] = a.breath; P[ o4 + 30 ] = a.blink; P[ o4 + 31 ] = ( a.varR || 0 ) + 256 * ( a.varL || 0 );
				// heads turned to what's worth a look (lookAt)
				if ( LOOKS.size ) _look( p, P, o4, x, y, z, yaw );
				if ( sl < lo ) lo = sl;
				if ( sl > hi ) hi = sl;
				// someone who's just come into view has no motion from last frame
				if ( p.fresh ) {

					fresh.push( sl );
					p.fresh = false;

				}

				// how tall on the screen (a share of its height): the figure by it
				const dx = wx - cx, dy = wy - cy, dz = wz - cz;
				const d = Math.sqrt( dx * dx + dy * dy + dz * dz ) + 0.01;
				const frac = H * s * focal / d;
				drawn ++;
				t.drawn ++;
				if ( frac > NEAR_FRAC ) {

					p.lod = 0;
					near.push( sl );
					nearD.push( d );
					O[ nBlob ++ ] = sl;
					t.drawnNear ++;

				} else if ( frac > TINY_FRAC ) {

					p.lod = 1;
					O[ cap * 2 + nFar ++ ] = sl;
					O[ nBlob ++ ] = sl;

				} else {

					p.lod = 2;
					O[ cap * 3 + nTiny ++ ] = sl;

				}

			}

		}

		// the near ones front to back (the ones behind are hidden early)
		const idx = near.map( ( _, i ) => i ).sort( ( i, j ) => nearD[ i ] - nearD[ j ] );
		for ( let i = 0; i < idx.length; i ++ ) O[ cap + i ] = near[ idx[ i ] ];
		const nNear = near.length;
		// (profiling: a figure left out, window.__cast.debug = { near: false })
		const D = this.debug;
		this.geometry[ 0 ].instanceCount = D && D.near === false ? 0 : nNear;
		this.geometry[ 1 ].instanceCount = D && D.far === false ? 0 : nFar;
		this.geometry[ 2 ].instanceCount = D && D.tiny === false ? 0 : nTiny;
		this.blobs.geometry.instanceCount = D && D.blobs === false ? 0 : nBlob;
		Object.assign( this.stats, { people: n, drawn, near: nNear, far: nFar, tiny: nTiny, culled } );
		if ( this._looksDirty && n ) {

			this.lookBuf.write( this.looks.subarray( 0, n * 4 ) );
			this._looksDirty = false;

		}

		if ( ! drawn ) return;
		// this frame's poses into the other buffer (last frame's become the previous ones), as far as the
		// ones seen reach; those who've just come into view get this frame's as their previous too
		this._cur = 1 - this._cur;
		const S = POSE * 4, from = lo * S, to = ( hi + 1 ) * S;
		this.poseBuf.write( P.subarray( from, to ), from * 4 );
		if ( fresh.length > 48 ) this.prevBuf.write( P.subarray( from, to ), from * 4 );
		else for ( const sl of fresh ) this.prevBuf.write( P.subarray( sl * S, sl * S + S ), sl * S * 4 );
		// each stretch of the order written as far as it's used
		const put = ( base, count ) => {

			if ( count ) this.orderBuf.write( O.subarray( base, base + count ), base * 4 );

		};

		put( 0, nBlob );
		put( cap, nNear );
		put( cap * 2, nFar );
		put( cap * 3, nTiny );

	}

}

// Heads turned to what's worth a look (lookAt): the nearest spot in range and in front of them (not
// behind: they'd have to turn round), the head most of the way and the shoulders a little, each coming
// round at their own pace (p._look eases to it) and some more than others
function _look( p, P, o4, x, y, z, yaw ) {

	let w = 0, want = 0, pitch = 0;
	for ( const L of LOOKS.values() ) {

		const r = L.r ?? 12, dx = L.x - x, dz = L.z - z, d2 = dx * dx + dz * dz;
		if ( d2 > r * r || d2 < 0.25 ) continue;
		let a = Math.atan2( - dx, - dz ) - yaw;
		a = Math.atan2( Math.sin( a ), Math.cos( a ) );
		if ( Math.abs( a ) > 2.3 ) continue;
		const d = Math.sqrt( d2 ), k = ( L.k ?? 1 ) * Math.min( 1, 1.6 * ( 1 - d / r ) ) * ( 1 - Math.max( 0, Math.abs( a ) - 1.6 ) / 0.7 );
		if ( k > w ) {

			w = k; want = a;
			pitch = Math.atan2( y + 1.5 * p.scale - ( L.y ?? y + 1.2 ), d );

		}

	}

	const eager = 0.55 + 0.45 * ( ( p.slot * 0.6180339 ) % 1 );
	p._look = ( p._look || 0 ) + ( w * eager - ( p._look || 0 ) ) * 0.06;
	const k = p._look;
	if ( k < 0.01 ) return;
	if ( w > 0.01 ) p._lookA = want;
	const a = p._lookA || 0, head = Math.max( - 1.25, Math.min( 1.25, a * 0.8 ) );
	P[ o4 + 9 ] += ( Math.max( - 0.45, Math.min( 0.45, a - head ) ) + a * 0.1 ) * k;
	P[ o4 + 11 ] += ( head - P[ o4 + 11 ] ) * k;
	P[ o4 + 12 ] += ( Math.max( - 0.5, Math.min( 0.6, pitch ) ) - P[ o4 + 12 ] ) * k * 0.7;

}

// a troupe's frame in the pool's (null when it's the same: every place's group sits in the field frame)
function _rel( t, inv ) {

	const e = _m.multiplyMatrices( inv, t.parent.matrixWorld ).elements;
	const id = Math.abs( e[ 0 ] - 1 ) + Math.abs( e[ 5 ] - 1 ) + Math.abs( e[ 10 ] - 1 ) + Math.abs( e[ 12 ] ) + Math.abs( e[ 13 ] ) + Math.abs( e[ 14 ] ) + Math.abs( e[ 8 ] );
	if ( id < 1e-4 ) return null;
	return ( t._R ||= new Float32Array( 16 ) ).set( e ), t._R;

}

// a sphere (in the pool's frame, M its world matrix) against the view's four sides
function _sphereIn( planes, M, x, y, z, r ) {

	const wx = M[ 0 ] * x + M[ 4 ] * y + M[ 8 ] * z + M[ 12 ], wy = M[ 1 ] * x + M[ 5 ] * y + M[ 9 ] * z + M[ 13 ], wz = M[ 2 ] * x + M[ 6 ] * y + M[ 10 ] * z + M[ 14 ];
	for ( const pl of planes ) if ( pl.normal.x * wx + pl.normal.y * wy + pl.normal.z * wz + pl.constant < - r ) return false;
	return true;

}

// ---------------------------------------------------------------- a troupe (a place's people)

export class Cast {

	constructor( { parent, max = 320 } ) {

		this.pool = POOL ||= new Pool();
		this.pool.troupes.push( this );
		this.parent = parent;
		this.max = max;
		this.list = [];
		this.bounds = null;
		this.drawn = 0;
		this.drawnNear = 0;
		// (the pool's meshes go into the scene now, with this troupe's place; they move to the field frame
		// on the first update, once every place is in it)
		if ( ! this.pool.group ) for ( const m of [ ...this.pool.meshes, this.pool.blobs ] ) parent.add( m );

	}

	// the pool's meshes (shared by every troupe)
	get mesh() { return this.pool.meshes[ 0 ]; }
	get meshFar() { return this.pool.meshes[ 1 ]; }
	get meshTiny() { return this.pool.meshes[ 2 ]; }
	get blobs() { return this.pool.blobs; }
	// (the figures are picked by how tall someone stands on the screen, the lens's zoom included: a troupe's
	// near / far are kept for the callers that set them, and not needed)
	get near() { return this._near ?? NEAR_FRAC; }
	set near( v ) { this._near = v; }
	get far() { return this._far ?? TINY_FRAC; }
	set far( v ) { this._far = v; }

	// someone new: a look (packLook's fields) and a pose to start from
	add( look ) {

		if ( this.list.length >= this.max ) return null;
		const p = this.pool.add( this, look );
		this.list.push( p );
		return p;

	}

	// dressed differently (a poncho on for the rain, off on the 29th)
	setLook( p, look ) {

		this.pool.setLook( p, look );

	}

	get triangles() {

		return this.pool.geometry[ 0 ].index.count / 3;

	}

	// once a frame, after posing. (The pool culls, picks the figures and uploads as it's drawn, with the
	// camera it's drawn for: cam is no longer needed.)
	update( cam = null ) {

		void cam;
		if ( ! this.pool.group ) this.pool._attach( this );

	}

}

// the pool (for tests and tools): every troupe's people
export function castPool() {

	return POOL;

}
