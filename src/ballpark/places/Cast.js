import { Mesh, BufferGeometry, Float32BufferAttribute, PlaneGeometry, Color, Matrix4, Vector3, Frustum } from '../../engine/index.js';
import { StorageBuffer } from '../../engine/gpu/Texture.js';
import { ShaderModule } from '../../engine/gpu/Shader.js';
import { GPU } from '../../engine/gpu/GPU.js';
import { commonModule } from '../../engine/render/wgsl/common.js';
import { standard } from '../../materials/Materials.js';
import { canvasTexture } from '../geo.js';
import { fanHeadLevel, fanHeadBuffer, fanHeadModule, FH } from '../FanHead.js'; // ---- FF1

// The park's people seen up close: one figure system for every place (the concourse's fans, the gate's
// arrivals and scalpers, the Alley's hecklers, whoever the next places bring). People.js has the far-off
// figures (a tube body, three morphs); these are built to be looked at from a metre or two: a lofted trunk
// with a build (slim, broad, a belly), shoulders, hands and shoes, a modelled head (FW4: the brow, the eyes
// in their sockets, cheekbones, a chin, a nose with a bridge, ears, each face its own) with the face painted
// on it (the eyes that blink, brows, lips, the cold in the cheeks and ears, beards, glasses), hair (short, long,
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
//     p.lod                                    (read) how they were drawn last frame: 0 the near figure
//                                              (or the middle one), 1 the far, 2 the distant, -1 not at all (out of view,
//                                              hidden): update the unseen and the distant less often
//     p.frac                                   (read; H) how tall they stood on the screen last frame, a
//                                              share of its height (Tempo.js's cadence())
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
// Every troupe's people are slots in one pool, drawn by one pipeline: four meshes (the near figure, the
// middle one, the far one, the distant one) with the same material, and the contact shadows. Each person is a slot with a
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
	// (FW4, C3W-2: the arm hangs straight from the shoulder, the elbow and the hand at the body's side, as
	// arms do let go: the hand was 5 cm wider than the shoulder, an A)
	// (FW6, C4W-1: the shoulder joint in under the deltoid, the elbow in against the waist and the forearm
	// out a little past the hip (the elbow's carrying angle): the arms hung a hand's width out from the
	// body, 0.52 m across the deltoids, a box with two slabs beside it)
	shoulder: [ 0.188, 1.395, 0.025 ], elbow: [ 0.198, 1.115, 0.045 ], wrist: [ 0.209, 0.86, 0.035 ], hand: [ 0.207, 0.785, 0.024 ],
};
const HEAD_R = [ 0.079, 0.104, 0.096 ];
// ---- FP1: where a cap's crown comes down to on the head (d.y on the head's unit sphere), by how far
// round to the front it is: just above the brows in front, the tops of the ears at the sides, low behind
const capRim = ( front ) => 0.18 + 0.225 * front;

// bones
const B = { pelvis: 0, spine: 1, head: 2, uarm: [ 3, 4 ], farm: [ 5, 6 ], thigh: [ 7, 8 ], shin: [ 9, 10 ], prop: [ 11, 12 ] };
// parts (what the shaders dress), then the props at 32 + id
export const PART = {
	torso: 0, pants: 1, hand: 2, head: 3, brim: 4, pompom: 5, neck: 6, sleeve: 7, shoe: 8, poncho: 9, hairCard: 10, nose: 11, apron: 12, vest: 13,
	// ---- P0: worn gear and a hat with its own shape
	bag: 14, pack: 15, radio: 16, credential: 17, campaign: 18,
	// ---- FP1: a cap's own crown (CP-1), a scarf wound round the neck (CP-15)
	crown: 19, scarf: 20,
	// ---- FW4: the near figure's ears
	ear: 21,
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
// ---- R (rituals): the press on the field at the last out (Getty 83571364: the photographers' long
// zooms, a flash on top; the handheld TV cameras on the shoulder; a boom mic in its fuzzy windscreen),
// all held level in the right hand
PROP.slr = 60; // a pro camera and zoom at the eye (var 0: Canon's white lens, 1: a black one)
PROP.eng = 61; // a TV camera on the right shoulder, the hand on its lens
PROP.boom = 62; // a boom pole up over the heads, the windscreen out front
UPRIGHT.push( PROP.slr, PROP.eng, PROP.boom );
HAND_PROPS[ 1 ].push( PROP.slr, PROP.eng, PROP.boom );
FAR_PROPS.push( PROP.slr, PROP.eng, PROP.boom );
// ---- end R

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
	[ 'DAULTON', '10' ], [ 'ASHBURN', '1' ], [ 'THOME', '25' ], [ 'CRAWFORD', '13' ], [ 'LONGORIA', '3' ], [ 'MADSON', '63' ],
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
// lod 2: the distant one (a few pixels tall: the fewest sides, next to nothing in hand); (FW4) lod 3: the
// middle one, the near figure's shapes on fewer sides with a plainer head, for those 112-250 px tall (the
// detail of the near one is for faces within a few metres)
export function figureGeometry( lod = 0 ) {

	const mid = lod === 3, fine = lod === 0 || mid, tiny = lod === 2, N8 = mid ? 6 : fine ? 8 : tiny ? 3 : 5, N6 = mid ? 5 : fine ? 6 : tiny ? 3 : 4;
	// (FW4: the near figure's sides, or the middle one's)
	const F = ( near, middle ) => mid ? middle : near;

	const pos = [], nrm = [], info = [], index = [];
	const sub = ( a, b ) => [ a[ 0 ] - b[ 0 ], a[ 1 ] - b[ 1 ], a[ 2 ] - b[ 2 ] ];
	const add = ( a, b ) => [ a[ 0 ] + b[ 0 ], a[ 1 ] + b[ 1 ], a[ 2 ] + b[ 2 ] ];
	const mul = ( a, k ) => [ a[ 0 ] * k, a[ 1 ] * k, a[ 2 ] * k ];
	const cross = ( a, b ) => [ a[ 1 ] * b[ 2 ] - a[ 2 ] * b[ 1 ], a[ 2 ] * b[ 0 ] - a[ 0 ] * b[ 2 ], a[ 0 ] * b[ 1 ] - a[ 1 ] * b[ 0 ] ];
	const norm = ( a ) => mul( a, 1 / ( Math.hypot( ...a ) || 1 ) );
	const side = ( j, s ) => [ j[ 0 ] * s, j[ 1 ], j[ 2 ] ];
	// (FF1: fh, a MakeHuman head's vertex: its record in the heads' buffer, plus one)
	const vert = ( p, n, bone, part, fh = 0 ) => {

		pos.push( ...p ); nrm.push( ...norm( n ) ); info.push( bone, part, fh );
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

	// a lofted body: rings [ y, rx, rz, z offset, squareness (FW4: 2 an ellipse, more toward a rounded
	// box: a jacket's shoulders are square across the top, not pointed in plan) ] round the vertical, n sides
	const loft = ( bone, part, rings, n, capBottom = false, capTop = false, smooth = false ) => {

		const R = rings.map( ( [ y, rx, rz, zo, sq = 2 ] ) => {

			const ring = [];
			for ( let k = 0; k < n; k ++ ) {

				const t = ( k / n ) * Math.PI * 2, ct = Math.cos( t ), st = Math.sin( t );
				const cx = sq === 2 ? ct : Math.sign( ct ) * Math.pow( Math.abs( ct ), 2 / sq ), sz = sq === 2 ? st : Math.sign( st ) * Math.pow( Math.abs( st ), 2 / sq );
				ring.push( vert( [ cx * rx, y, sz * rz + zo ], [ ct / rx, 0, st / rz ], bone, part ) );

			}

			return ring;

		} );
		// ---- FW1 (C2W-2): smooth normals from the surface (the shoulders face up, the chest's curve turns),
		// not straight out round the vertical (a drum)
		if ( smooth ) {

			const at = ( i ) => [ pos[ i * 3 ], pos[ i * 3 + 1 ], pos[ i * 3 + 2 ] ];
			for ( let r = 0; r < R.length; r ++ ) for ( let k = 0; k < n; k ++ ) {

				const a = sub( at( R[ r ][ ( k + 1 ) % n ] ), at( R[ r ][ ( k + n - 1 ) % n ] ) );
				const b = sub( at( R[ Math.min( r + 1, R.length - 1 ) ][ k ] ), at( R[ Math.max( r - 1, 0 ) ][ k ] ) );
				let nn = norm( cross( a, b ) );
				const p = at( R[ r ][ k ] ), out = [ p[ 0 ], 0, p[ 2 ] - rings[ r ][ 3 ] ];
				if ( nn[ 0 ] * out[ 0 ] + nn[ 2 ] * out[ 2 ] < 0 ) nn = mul( nn, - 1 );
				nrm.splice( R[ r ][ k ] * 3, 3, ...nn );

			}

		}

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

	// ---- FW1 (C2W-2): a body swept along an axis ax from o: rings [ d (along ax), rx (across, ac), rz
	// (in depth: ax x ac), the ring's centre moved across, in depth ], n sides squared toward a
	// superellipse (sq), smooth normals from the surface itself (the shoulders' slope, a hand's taper
	// catch the light as they turn); a rounded end (a dome of that height) at either end
	const sweep = ( bone, part, o, ax, ac, rings, n, domeS = 0, domeE = 0, sq = 2 ) => {

		const dp = norm( cross( ax, ac ) );
		const P = [], R = [];
		for ( const [ d, rx, rz, oa = 0, od = 0 ] of rings ) {

			const c = add( o, add( mul( ax, d ), add( mul( ac, oa ), mul( dp, od ) ) ) );
			const pr = [], ring = [];
			for ( let k = 0; k < n; k ++ ) {

				const t = ( k / n ) * Math.PI * 2, ct = Math.cos( t ), st = Math.sin( t );
				const x = Math.sign( ct ) * Math.pow( Math.abs( ct ), 2 / sq ) * rx, z = Math.sign( st ) * Math.pow( Math.abs( st ), 2 / sq ) * rz;
				const p = add( c, add( mul( ac, x ), mul( dp, z ) ) );
				pr.push( p );
				ring.push( vert( p, add( mul( ac, ct ), mul( dp, st ) ), bone, part ) );

			}

			P.push( { c, pr } );
			R.push( ring );

		}

		for ( let r = 0; r < R.length; r ++ ) for ( let k = 0; k < n; k ++ ) {

			const a = sub( P[ r ].pr[ ( k + 1 ) % n ], P[ r ].pr[ ( k + n - 1 ) % n ] );
			const b = sub( P[ Math.min( r + 1, R.length - 1 ) ].pr[ k ], P[ Math.max( r - 1, 0 ) ].pr[ k ] );
			let nn = norm( cross( a, b ) );
			const out = sub( P[ r ].pr[ k ], P[ r ].c );
			if ( nn[ 0 ] * out[ 0 ] + nn[ 1 ] * out[ 1 ] + nn[ 2 ] * out[ 2 ] < 0 ) nn = mul( nn, - 1 );
			nrm.splice( R[ r ][ k ] * 3, 3, ...nn );

		}

		for ( let r = 0; r < R.length - 1; r ++ ) for ( let k = 0; k < n; k ++ ) {

			const i0 = R[ r ][ k ], i1 = R[ r ][ ( k + 1 ) % n ], j0 = R[ r + 1 ][ k ], j1 = R[ r + 1 ][ ( k + 1 ) % n ];
			index.push( i0, i1, j0, i1, j1, j0 );

		}

		const dome = ( r, h, sgn ) => {

			const ci = vert( add( P[ r ].c, mul( ax, h * sgn ) ), mul( ax, sgn ), bone, part );
			for ( let k = 0; k < n; k ++ ) index.push( ci, R[ r ][ k ], R[ r ][ ( k + 1 ) % n ] );

		};

		if ( domeS ) dome( 0, domeS, - 1 );
		if ( domeE ) dome( R.length - 1, domeE, 1 );

	};
	// ---- end FW1

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

		tube( bone, part, c, add( c, [ 0, h, 0 ] ), [ rB, rB ], [ rT, rT ], fine ? F( n, Math.min( n, 6 ) ) : Math.min( n, 5 ), false, top );

	};

	// ---- FW4 (C3W-2): the near figure's head, modelled (it was a smooth egg with a face painted on it and
	// a four-point beak for a nose). The egg's points move by sculpt( d ) (d: the point on the unit
	// sphere, the face toward -z): the brow's ridge over eyes set back in their sockets, the cheekbones,
	// the face flatter across, the lips and the chin forward, the jaw narrowing under the ears, the
	// skull tucking in above the nape. The rows and columns crowd round the face. Under the concourse's
	// lights from above, the brow, the nose, the lip and the chin each throw their own shade, as faces do.
	// The painted features (the eyes, the brows, the mouth) sit where they did on the egg
	const sculpt = ( d ) => {

		const sm = ( a, b, x ) => {

			const t = Math.min( 1, Math.max( 0, ( x - a ) / ( b - a ) ) );
			return t * t * ( 3 - 2 * t );

		};
		const g = ( x, y, sx, sy ) => Math.exp( - ( x * x ) / ( sx * sx ) - ( y * y ) / ( sy * sy ) );
		const ax = Math.abs( d[ 0 ] ), front = sm( 0.15, - 0.55, d[ 2 ] );
		const o = [ 0, 0, 0 ];
		// the lower head: the jaw narrows toward the chin, the back tucks in above the nape
		const low = sm( - 0.25, - 0.95, d[ 1 ] );
		o[ 0 ] -= d[ 0 ] * HEAD_R[ 0 ] * 0.2 * low;
		if ( d[ 2 ] > 0 ) o[ 2 ] -= d[ 2 ] * HEAD_R[ 2 ] * 0.32 * low;
		o[ 1 ] += 0.012 * low * sm( 0.0, 0.6, d[ 2 ] );
		// the face flatter across (an egg's front is round): its sides come forward
		o[ 2 ] -= 0.007 * sm( 0.15, 0.55, ax ) * sm( 0.95, 0.6, ax ) * front * sm( - 0.75, - 0.45, d[ 1 ] ) * sm( 0.55, 0.3, d[ 1 ] );
		// the eyes set back in their sockets under the brow; the brow's ridge and the root of the nose
		o[ 2 ] += 0.0075 * g( ax - 0.33, d[ 1 ] - 0.09, 0.17, 0.12 ) * front;
		o[ 2 ] -= 0.0055 * g( ax - 0.25, d[ 1 ] - 0.29, 0.3, 0.065 ) * front;
		// the cheekbones, a little hollow under them
		o[ 2 ] -= 0.0045 * g( ax - 0.5, d[ 1 ] + 0.06, 0.14, 0.11 ) * front;
		o[ 0 ] += Math.sign( d[ 0 ] ) * 0.003 * g( ax - 0.72, d[ 1 ] + 0.02, 0.14, 0.14 );
		o[ 2 ] += 0.002 * g( ax - 0.5, d[ 1 ] + 0.36, 0.12, 0.1 ) * front;
		// the lips, the groove under them, the chin
		o[ 2 ] -= 0.005 * g( d[ 0 ], d[ 1 ] + 0.43, 0.26, 0.1 ) * front;
		o[ 2 ] += 0.0025 * g( d[ 0 ], d[ 1 ] + 0.585, 0.22, 0.045 ) * front;
		o[ 2 ] -= 0.011 * g( d[ 0 ], d[ 1 ] + 0.74, 0.3, 0.13 ) * front;
		return o;

	};
	// a point of the head: on the egg, sculpted
	const headAt = ( d ) => {

		const s = sculpt( d );
		return [ J.head[ 0 ] + d[ 0 ] * HEAD_R[ 0 ] + s[ 0 ], J.head[ 1 ] + d[ 1 ] * HEAD_R[ 1 ] + s[ 1 ], J.head[ 2 ] + d[ 2 ] * HEAD_R[ 2 ] + s[ 2 ] ];

	};
	const headFine = ( low ) => {

		// rows (from the crown, degrees) close through the face; columns round from the front, close at it
		const TH = ( low ? [ 0, 30, 55, 70, 80, 90, 100, 110, 120, 131, 145, 162, 180 ]
			: [ 0, 18, 34, 48, 58, 66, 72, 77, 82, 87, 92, 97, 102, 107, 112, 117, 122, 127, 132, 137, 143, 150, 160, 180 ] ).map( ( a ) => a * Math.PI / 180 );
		const W = low ? 14 : 24, PH = [];
		for ( let k = 0; k < W; k ++ ) {

			const u = ( k - W / 2 ) / ( W / 2 );
			PH.push( Math.PI * Math.sign( u ) * Math.pow( Math.abs( u ), 1.45 ) );

		}

		const dAt = ( th, ph ) => [ Math.sin( th ) * Math.sin( ph ), Math.cos( th ), - Math.sin( th ) * Math.cos( ph ) ];
		const P = TH.map( ( th ) => PH.map( ( ph ) => headAt( dAt( th, ph ) ) ) );
		const first = pos.length / 3;
		for ( let j = 0; j < TH.length; j ++ ) for ( let i = 0; i < W; i ++ ) {

			// the normal from the surface itself (along the row and down the column)
			let nn;
			if ( j === 0 ) nn = [ 0, 1, 0 ];
			else if ( j === TH.length - 1 ) nn = [ 0, - 1, 0 ];
			else {

				const a = sub( P[ j ][ ( i + 1 ) % W ], P[ j ][ ( i + W - 1 ) % W ] ), b = sub( P[ j + 1 ][ i ], P[ j - 1 ][ i ] );
				nn = norm( cross( b, a ) );
				const out = sub( P[ j ][ i ], J.head );
				if ( nn[ 0 ] * out[ 0 ] + nn[ 1 ] * out[ 1 ] + nn[ 2 ] * out[ 2 ] < 0 ) nn = mul( nn, - 1 );

			}

			vert( P[ j ][ i ], nn, B.head, PART.head );

		}

		for ( let j = 0; j < TH.length - 1; j ++ ) for ( let i = 0; i < W; i ++ ) {

			const a = first + j * W + i, b = first + j * W + ( i + 1 ) % W, c = a + W, e = b + W;
			if ( j > 0 ) index.push( a, c, b );
			if ( j < TH.length - 2 ) index.push( b, c, e );

		}

		// the nose: a bridge down from between the brows to the tip, the wings either side of it, and the
		// underside back in to the lip (in shade from the lights above), on a patch that lies on the face
		// and rises from it. Its edges meet the face with the face's own normal, so there's no seam
		const NU = low ? 5 : 9, NV = low ? 6 : 10, nose = [];
		for ( let jv = 0; jv < NV; jv ++ ) {

			const v = jv / ( NV - 1 ), row = [];
			// down the nose: the root at the brows, the tip at 0.78, the underside to the lip
			const y = v < 0.78 ? 0.25 - 0.45 * ( v / 0.78 ) : - 0.2 - 0.1 * ( ( v - 0.78 ) / 0.22 );
			const tipK = v < 0.78 ? Math.pow( v / 0.78, 1.25 ) : Math.cos( ( v - 0.78 ) / 0.22 * Math.PI / 2 );
			const hgt = 0.0025 + 0.0158 * tipK - 0.0025 * ( v > 0.78 ? ( v - 0.78 ) / 0.22 : 0 );
			const wide = 0.07 + 0.05 * v + 0.11 * Math.pow( Math.max( 0, ( v - 0.55 ) / 0.45 ), 0.7 );
			for ( let iu = 0; iu < NU; iu ++ ) {

				const u = iu / ( NU - 1 ) * 2 - 1;
				const dx = u * wide, dy = y, dz = - Math.sqrt( Math.max( 0, 1 - dx * dx - dy * dy ) );
				const base = headAt( [ dx, dy, dz ] );
				// the ridge rounded across; the wings (the alae) full at the sides near the bottom
				const ridge = Math.pow( Math.max( 0, 1 - u * u ), 1.4 );
				const wing = 0.006 * Math.pow( Math.max( 0, Math.sin( Math.PI * Math.min( 1, Math.max( 0, ( v - 0.6 ) / 0.4 ) ) ) ), 0.8 ) * Math.exp( - Math.pow( ( Math.abs( u ) - 0.62 ) / 0.3, 2 ) );
				const lift = Math.max( hgt * ridge, wing * ( 1 - 0.3 * ridge ) ) - 0.0012 * ( 1 - ridge );
				row.push( [ base[ 0 ], base[ 1 ], base[ 2 ] - lift ] );

			}

			nose.push( row );

		}

		const nFirst = pos.length / 3;
		for ( let jv = 0; jv < NV; jv ++ ) for ( let iu = 0; iu < NU; iu ++ ) {

			const a = sub( nose[ jv ][ Math.min( iu + 1, NU - 1 ) ], nose[ jv ][ Math.max( iu - 1, 0 ) ] );
			const b = sub( nose[ Math.min( jv + 1, NV - 1 ) ][ iu ], nose[ Math.max( jv - 1, 0 ) ][ iu ] );
			let nn = norm( cross( a, b ) );
			if ( nn[ 2 ] > 0 ) nn = mul( nn, - 1 );
			// at its edges the face's own normal (the egg's, sculpted: near enough)
			const edge = Math.max( Math.abs( iu / ( NU - 1 ) * 2 - 1 ), jv === 0 ? 1 : 0 );
			const fn = norm( sub( nose[ jv ][ iu ], J.head ).map( ( v, k ) => v / ( HEAD_R[ k ] * HEAD_R[ k ] ) ) );
			const k = Math.pow( edge, 3 );
			nn = norm( [ nn[ 0 ] * ( 1 - k ) + fn[ 0 ] * k, nn[ 1 ] * ( 1 - k ) + fn[ 1 ] * k, nn[ 2 ] * ( 1 - k ) + fn[ 2 ] * k ] );
			vert( nose[ jv ][ iu ], nn, B.head, PART.nose );

		}

		for ( let jv = 0; jv < NV - 1; jv ++ ) for ( let iu = 0; iu < NU - 1; iu ++ ) {

			const a = nFirst + jv * NU + iu, b = a + 1, c = a + NU, e = c + 1;
			index.push( a, c, b, b, c, e );

		}

		// the ears: a shell either side, a little behind the jaw, from the brows' height to the nose's
		// foot, standing off the head toward the back, its rim curled (folded away under a hood, a knit
		// hat, earmuffs, long hair)
		for ( const s of [ - 1, 1 ] ) {

			const EW = low ? 6 : 8, EH = low ? 4 : 6, eFirst = pos.length / 3, c = [ J.head[ 0 ] + s * ( HEAD_R[ 0 ] - 0.008 ), J.head[ 1 ] - 0.006, J.head[ 2 ] + 0.016 ];
			for ( let j = 0; j <= EH; j ++ ) for ( let i = 0; i < EW; i ++ ) {

				const th = j / EH * Math.PI, ph = i / EW * Math.PI * 2;
				// a flat oval disc (thin across), the top tipped back, standing out more behind than in front
				const e = [ Math.sin( th ) * Math.cos( ph ), Math.cos( th ), Math.sin( th ) * Math.sin( ph ) ];
				const out = 0.004 + 0.0055 * Math.max( 0, e[ 2 ] ) + 0.002 * Math.max( 0, e[ 1 ] );
				let p = [ e[ 0 ] * out, e[ 1 ] * 0.028, e[ 2 ] * 0.0155 ];
				p = [ p[ 0 ] + Math.max( 0, p[ 2 ] ) * 0.28 + 0.004, p[ 1 ], p[ 2 ] + p[ 1 ] * 0.22 ];
				vert( add( c, [ s * p[ 0 ], p[ 1 ], p[ 2 ] ] ), [ s * ( e[ 0 ] / out ), e[ 1 ] / 0.028, e[ 2 ] / 0.0155 ], B.head, PART.ear );

			}

			for ( let j = 0; j < EH; j ++ ) for ( let i = 0; i < EW; i ++ ) {

				const a = eFirst + j * EW + i, b = eFirst + j * EW + ( i + 1 ) % EW, cc = a + EW, d = b + EW;
				if ( j > 0 ) index.push( a, cc, b );
				if ( j < EH - 1 ) index.push( b, cc, d );

			}

		}

	};
	// ---- end FW4

	// ---- the body
	// the trunk (the spine bone), a jacket's hem below the belt: rings [ y, half width, half depth, z ]
	// (FW1, C2W-2: close up on 16 sides through twelve rings, a hem that turns under, the waist and the
	// chest, the armpits and the shoulders' slope, with the surface's own normals: it read as a box)
	// (FW4, C3W-2: the shoulders carried out to the point of the shoulder, square across the top in plan,
	// the slope from the collar a little flatter: the sleeve's head meets them there. They stopped short
	// at 0.18 m and a round pad over each sleeve's top stood proud of them)
	// (FW6, C4W-1: a human cross-section, not a box: round in plan at the shoulders (they were squared to
	// 2.6, a shelf with corners from any angle but straight on), the trapezius falling from the collar to
	// the point of the shoulder at 0.18 m (it ran out level to 0.21), the chest a little fuller and flatter
	// in front than the waist, which comes in under it, the jacket easing out again over the hips. The
	// sleeve's head is the deltoid that rounds the shoulder off below the trunk's slope)
	loft( B.spine, PART.torso, fine ? [
		[ 0.805, 0.166, 0.112, 0.012, 2.45 ], [ 0.83, 0.174, 0.12, 0.012, 2.5 ], [ 0.9, 0.174, 0.117, 0.011, 2.45 ], [ 0.98, 0.166, 0.11, 0.009, 2.25 ],
		[ 1.06, 0.155, 0.108, 0.008, 2.1 ], [ 1.14, 0.162, 0.113, 0.006, 2.15 ], [ 1.22, 0.172, 0.119, 0.006, 2.25 ], [ 1.3, 0.179, 0.118, 0.011, 2.2 ],
		[ 1.35, 0.184, 0.111, 0.018, 2.05 ], [ 1.385, 0.181, 0.1, 0.023 ], [ 1.41, 0.171, 0.09, 0.026 ], [ 1.43, 0.152, 0.081, 0.028 ],
		[ 1.452, 0.12, 0.07, 0.029 ], [ 1.472, 0.086, 0.062, 0.03 ],
	] : [
		[ 0.83, 0.172, 0.118, 0.012 ], [ 0.95, 0.168, 0.112, 0.01 ], [ 1.06, 0.164, 0.11, 0.008 ], [ 1.17, 0.172, 0.114, 0.006 ],
		[ 1.28, 0.182, 0.118, 0.012 ], [ 1.36, 0.186, 0.108, 0.022 ], [ 1.42, 0.16, 0.085, 0.028 ], [ 1.468, 0.088, 0.062, 0.03 ],
	], fine ? F( 16, 10 ) : tiny ? 5 : 8, true, true, fine );
	// the hips and seat (the pelvis), under the trunk's hem
	// (FW6: inside the jacket's hem, which follows it: its sides showed through the hem's whenever the
	// trunk turned or leant, a square flap of jacket hanging between two patches of trousers)
	loft( B.pelvis, PART.pants, [ [ 0.74, 0.158, 0.1, 0.012 ], [ 0.86, 0.163, 0.106, 0.012 ], [ 0.97, 0.152, 0.1, 0.012 ] ], fine ? F( 14, 9 ) : tiny ? 4 : 6, true, false, fine );
	// the neck
	tube( B.head, PART.neck, [ 0, 1.4, 0.03 ], [ 0, 1.54, 0.02 ], [ 0.052, 0.05 ], [ 0.046, 0.046 ], N6 );
	// the head, the nose, a cap's brim, a knit hat's pom-pom, long hair down the back
	// ---- FF1 (step 10): the near and middle figures' head is the players' MakeHuman head (FanHead.js: 1,200
	// triangles near, 400 the middle one), its nose and ears its own, its blend shapes moved by each one's
	// face in the shader; sized from the seats' egg to this one (HEAD_R). FW4's modelled egg (headFine) is
	// kept for anyone who wants it back
	const mhHead = ( name ) => {

		const L = fanHeadLevel( name ), first = pos.length / 3;
		const k = HEAD_R.map( ( r, i ) => r / FH.R[ i ] );
		for ( let i = 0; i < L.count; i ++ ) {

			const o = [ L.position[ i * 3 ] * k[ 0 ], L.position[ i * 3 + 1 ] * k[ 1 ], L.position[ i * 3 + 2 ] * k[ 2 ] ];
			const n = [ L.normal[ i * 3 ] / k[ 0 ], L.normal[ i * 3 + 1 ] / k[ 1 ], L.normal[ i * 3 + 2 ] / k[ 2 ] ];
			vert( add( J.head, o ), n, B.head, PART.head, L.rec + i + 1 );

		}

		for ( let i = 0; i < L.index.length; i ++ ) index.push( first + L.index[ i ] );

	};
	if ( fine ) mhHead( mid ? 'mid' : 'near' );
	// ---- end FF1
	else ellipsoid( B.head, PART.head, J.head, HEAD_R, tiny ? 5 : 8, tiny ? 4 : 6 );

	{

		const h = J.head;
		// ---- FP1 (CP-1, after the players' cap in game/Rig.js): a cap's crown is its own shell over the
		// skull, a finger bigger than the head and taller in front, down to the brow in front (the brows are
		// at d.y 0.3), over the tops of the ears and low behind (capRim); the bill comes straight out of its
		// lower edge in front, curved across (its root follows the crown, so its sides drop), pitched a
		// little down, with thickness and an underside. (It was a painted skullcap with a flat blade
		// through its middle.) The distant figure keeps the paint and a flat bill at the rim
		const R = HEAD_R;
		const rimAt = ( psi, out ) => {

			const dy = capRim( Math.cos( psi ) ), sxz = Math.sqrt( 1 - dy * dy );
			return [ Math.sin( psi ) * sxz * ( R[ 0 ] + out ), dy * ( R[ 1 ] + out ), - Math.cos( psi ) * sxz * ( R[ 2 ] + out ) ];

		};
		if ( ! tiny ) {

			const cw = fine ? F( 12, 10 ) : 8, ck = fine ? F( 4, 3 ) : 3;
			const apex = vert( add( h, [ 0, R[ 1 ] + 0.017, - 0.004 ] ), [ 0, 1, 0 ], B.head, PART.crown );
			const ringsC = [];
			for ( let k = 1; k <= ck; k ++ ) {

				const ring = [];
				for ( let i = 0; i < cw; i ++ ) {

					const u = k / ck, psi = ( i / cw ) * Math.PI * 2, front = Math.cos( psi ), th = u * Math.acos( capRim( front ) );
					const d = [ Math.sin( th ) * Math.sin( psi ), Math.cos( th ), - Math.sin( th ) * Math.cos( psi ) ];
					const grow = 0.005 + 0.011 * ( 1 - u * u ), lift = 0.012 * ( 1 - u );
					ring.push( vert( add( h, [ d[ 0 ] * ( R[ 0 ] + grow ), d[ 1 ] * ( R[ 1 ] + grow ) + lift, d[ 2 ] * ( R[ 2 ] + grow + 0.008 * Math.max( 0, front ) * Math.sin( Math.PI * u ) ) ] ), d, B.head, PART.crown ) );

				}

				ringsC.push( ring );

			}

			for ( let i = 0; i < cw; i ++ ) index.push( apex, ringsC[ 0 ][ i ], ringsC[ 0 ][ ( i + 1 ) % cw ] );
			for ( let k = 0; k < ck - 1; k ++ ) for ( let i = 0; i < cw; i ++ ) {

				const a = ringsC[ k ][ i ], b = ringsC[ k ][ ( i + 1 ) % cw ], c = ringsC[ k + 1 ][ i ], d = ringsC[ k + 1 ][ ( i + 1 ) % cw ];
				index.push( a, c, b, b, c, d );

			}

			// the bill: columns across it, the ends meeting the crown
			const S = fine && ! mid ? [ - 1, - 0.62, - 0.22, 0.22, 0.62, 1 ] : [ - 1, - 0.35, 0.35, 1 ];
			const top = [], bot = [], tipT = [], tipB = [];
			for ( const sg of S ) {

				const root = rimAt( sg * 1.17, 0 );
				const reach = 0.07 * Math.sqrt( Math.max( 0, 1 - sg * sg ) );
				const out = norm( [ root[ 0 ] / ( R[ 0 ] * R[ 0 ] ), 0, root[ 2 ] / ( R[ 2 ] * R[ 2 ] ) ] );
				const dir = norm( add( mul( out, 0.45 ), [ 0, 0, - 1 ] ) );
				const tip = add( root, [ dir[ 0 ] * reach, - 0.16 * reach, dir[ 2 ] * reach ] );
				const up = norm( [ out[ 0 ] * 0.35 * Math.abs( sg ), 1, - 0.12 ] );
				top.push( vert( add( h, root ), up, B.head, PART.brim ) );
				bot.push( vert( add( h, add( root, [ 0, - 0.006, 0 ] ) ), mul( up, - 1 ), B.head, PART.brim ) );
				tipT.push( reach > 0 ? vert( add( h, tip ), up, B.head, PART.brim ) : top[ top.length - 1 ] );
				tipB.push( reach > 0 ? vert( add( h, add( tip, [ 0, - 0.006, 0 ] ) ), mul( up, - 1 ), B.head, PART.brim ) : bot[ bot.length - 1 ] );

			}

			for ( let i = 0; i < S.length - 1; i ++ ) for ( const [ A, Bq ] of fine ? [ [ top, tipT ], [ bot, tipB ], [ tipT, tipB ] ] : [ [ top, tipT ], [ bot, tipB ] ] ) {

				const [ a, b, c, d ] = [ A[ i ], A[ i + 1 ], Bq[ i + 1 ], Bq[ i ] ];
				for ( const [ x, y, z ] of [ [ a, b, c ], [ a, c, d ] ] ) if ( x !== y && y !== z && x !== z ) index.push( x, y, z );

			}

		} else {

			const brim = [ [ - 0.075, 0.042, - 0.07 ], [ 0.075, 0.042, - 0.07 ], [ 0.068, 0.033, - 0.16 ], [ - 0.068, 0.033, - 0.16 ] ].map( ( o ) => vert( add( h, o ), [ 0, 1, - 0.1 ], B.head, PART.brim ) );
			index.push( brim[ 0 ], brim[ 1 ], brim[ 2 ], brim[ 0 ], brim[ 2 ], brim[ 3 ] );

		}

		// a scarf wound round the neck: a thick collar of knit, one end hanging down the chest
		// (FW4, SP2's: the distant figure, under 32 px, leaves out what's under a pixel there: the scarf, the
		// pom-pom, long hair, the hands; its shoes a wedge, not a box)
		if ( ! tiny ) loft( B.spine, PART.scarf, [ [ 1.385, 0.13, 0.095, 0.03 ], [ 1.43, 0.115, 0.088, 0.03 ], [ 1.48, 0.082, 0.072, 0.026 ] ], fine ? F( 10, 8 ) : 6, false, true );
		if ( ! tiny ) quad( B.spine, PART.scarf, [ 0.015, 1.41, - 0.098 ], [ 0.085, 1.41, - 0.09 ], [ 0.08, 1.14, - 0.13 ], [ 0.02, 1.14, - 0.132 ] );
		// ---- end FP1
		// (FW6, C4W-2: close up on 10 x 6, a fuzz in the shaders: it was a 12-faced polyhedron)
		if ( ! tiny ) ellipsoid( B.head, PART.pompom, add( h, [ 0, HEAD_R[ 1 ] + 0.045, 0.012 ] ), [ 0.035, 0.031, 0.035 ], fine ? F( 10, 6 ) : N6, fine ? F( 6, 4 ) : 3 );
		// long hair: (FP2) a shell round the back and sides of the head, from the crown down past the
		// shoulders, framing the face in front of the ears, fuller and further out as it falls over the
		// collar and down the back (it was a card hung behind the head: a panel from the side, nothing from
		// the front)
		if ( ! tiny ) {

			// rows: [ height, half width, half depth, how far round from the back ]
			const rows = fine ? [ [ 0.075, 0.062, 0.075, 2.2 ], [ - 0.02, 0.088, 0.106, 2.1 ], [ - 0.11, 0.096, 0.12, 1.95 ], [ - 0.19, 0.106, 0.14, 1.6 ], [ - 0.26, 0.116, 0.156, 1.25 ] ]
				: [ [ 0.075, 0.062, 0.075, 2.2 ], [ - 0.11, 0.096, 0.12, 1.95 ], [ - 0.26, 0.116, 0.156, 1.25 ] ];
			const cols = fine ? F( 13, 7 ) : tiny ? 3 : 5, R0 = [];
			// (FW4, C3W-12: the ends in locks, each its own length, and turned out a little where they lie on
			// the collar; the strands are the shaders'. Its bottom was one straight edge: a plank)
			// (FW6, C4W-6: close up five or six locks of their own lengths and widths, the hollows between them
			// up to 6 cm higher (it was an even sawtooth); the lower rows out over the collar and the back,
			// up onto the shoulders at the sides, not hung straight down)
			const lock = fine && ! mid ? [ 0.0, 0.03, 0.055, 0.012, 0.0, 0.04, 0.06, 0.02, 0.004, 0.035, 0.05, 0.018, 0.0 ] : [ 0.0, 0.022, 0.008, 0.03, 0.004, 0.026, 0.012, 0.018, 0.0 ];
			for ( const [ ri, [ y, rx, rz, span ] ] of rows.entries() ) {

				const ring = [], last = ri === rows.length - 1, low = fine && ri >= rows.length - 2;
				for ( let i = 0; i < cols; i ++ ) {

					const u = i / ( cols - 1 ) * 2 - 1, ph = u * span;
					const dy = fine && last ? - lock[ Math.round( ( i / ( cols - 1 ) ) * ( lock.length - 1 ) ) ] : 0, flip = fine && last ? 1.04 : 1;
					const sh = low ? 0.03 * Math.pow( Math.abs( u ), 3 ) * ( last ? 1 : 0.5 ) : 0;
					const out = low ? 1 + 0.06 * Math.max( 0, Math.cos( ph ) ) : 1;
					ring.push( vert( add( h, [ Math.sin( ph ) * rx * flip * ( 1 + sh * 2 ), y + dy + sh, Math.cos( ph ) * rz * flip * out ] ), [ Math.sin( ph ), 0.15, Math.cos( ph ) ], B.head, PART.hairCard ) );

				}

				R0.push( ring );

			}

			for ( let k = 0; k < R0.length - 1; k ++ ) for ( let i = 0; i < cols - 1; i ++ ) index.push( R0[ k ][ i ], R0[ k + 1 ][ i ], R0[ k ][ i + 1 ], R0[ k ][ i + 1 ], R0[ k + 1 ][ i ], R0[ k + 1 ][ i + 1 ] );

		}
		// ---- P0: a State Trooper's campaign hat: the wide flat brim, the crown with the four pinches of its
		// peak (W1's, from the Inquirer's troopers at the park)
		if ( ! tiny ) {

			const n = fine ? F( 16, 10 ) : 8, y0 = h[ 1 ] + 0.065;
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
		const hp = side( J.hip, s ), kn = side( J.knee, s ), an = side( J.ankle, s );
		if ( fine ) {

			// ---- FW1 (C2W-2): close up the limbs on 12 sides, the upper arm full at the shoulder and tapering,
			// the forearm thick below the elbow, a jacket's cuff flaring at the wrist; the thigh and the calf,
			// the trousers' hem over the shoe (they were 8-sided prisms whose facets showed)
			// (FW6: a ring's centre can move out from the body, + away from it: the deltoid's top rings sit in
			// toward the neck under the trunk's slope)
			const limb = ( bone, part, a, b, rings, domeS = 0 ) => {

				const ax = norm( sub( b, a ) ), l = Math.hypot( ...sub( b, a ) );
				let ac = cross( ax, [ 0, 0, 1 ] );
				if ( Math.hypot( ...ac ) < 0.2 ) ac = cross( ax, [ 1, 0, 0 ] );
				ac = norm( ac );
				const out = Math.sign( a[ 0 ] || 1 ) * Math.sign( ac[ 0 ] || 1 );
				sweep( bone, part, a, ax, ac, rings.map( ( [ t, rx, rz, o = 0 ] ) => [ t * l, rx, rz, o * out, 0 ] ), F( 12, 8 ), domeS );

			};
			// ---- FW4 (C3W-2): the sleeve's head is the sleeve's own: it rounds over the top of the arm from
			// under the shoulder's seam (its top just inside the trunk's shoulder) and fills out over the
			// deltoid below it, one surface down the arm. (It was a round pad, an ellipsoid on the joint
			// standing 5 cm proud of the shoulder line, on every sleeve in the park)
			// (FW6, C4W-1, C4W-7: a deltoid, not a ball: the head rises less above the joint (2.7 cm, not 3.6) and
			// is narrower (5.7 cm, not 6.4), so it rounds the trunk's falling shoulder off instead of standing on
			// its corner; full just below the joint and tapering to the elbow, the arm's outline falls in from the
			// shoulder as an arm's does. Its top is weighted to the spine in the rig, so it stays on the shoulder
			// when the arm comes up)
			limb( B.uarm[ L ], PART.sleeve, sh, el, [ [ - 0.04, 0.018, 0.03, - 0.02 ], [ 0, 0.027, 0.042, - 0.0165 ], [ 0.05, 0.034, 0.05, - 0.0125 ], [ 0.12, 0.044, 0.055, - 0.005 ],
				[ 0.21, 0.05, 0.057, 0 ], [ 0.3, 0.051, 0.056, 0.002 ], [ 0.55, 0.048, 0.052, 0.0015 ], [ 0.8, 0.046, 0.05 ], [ 1, 0.046, 0.048 ] ], 0.005 );
			// ---- end FW4
			ellipsoid( B.farm[ L ], PART.sleeve, el, [ 0.047, 0.047, 0.049 ], F( 10, 8 ), F( 5, 4 ) );
			limb( B.farm[ L ], PART.sleeve, el, wr, [ [ 0, 0.047, 0.048 ], [ 0.3, 0.046, 0.048 ], [ 0.8, 0.04, 0.042 ], [ 0.93, 0.043, 0.045 ], [ 1, 0.044, 0.046 ] ] );
			// the hand: a mitten swept from the wrist (inside the cuff) through the palm to the knuckles and
			// the fingers, which curl in toward the body, the tips rounded; the thumb along the front (it
			// was a paddle: a box and a box)
			const ax = norm( sub( ha, wr ) ), ac = norm( sub( [ 0, 0, - 1 ], mul( ax, - ax[ 2 ] ) ) );
			const dp = cross( ax, ac ), curl = dp[ 0 ] * - s > 0 ? 1 : - 1;
			sweep( B.farm[ L ], PART.hand, add( wr, [ 0, - 0.005, 0 ] ), ax, ac, [
				[ 0, 0.026, 0.02 ], [ 0.025, 0.033, 0.019 ], [ 0.055, 0.04, 0.017, 0, 0.002 * curl ], [ 0.08, 0.039, 0.015, 0, 0.005 * curl ],
				[ 0.103, 0.036, 0.013, 0, 0.011 * curl ], [ 0.122, 0.03, 0.011, 0, 0.017 * curl ],
			], F( 10, 6 ), 0, 0.011, 2.3 );
			const tAx = norm( add( add( mul( ax, 0.75 ), mul( ac, 0.55 ) ), mul( dp, 0.3 * curl ) ) );
			sweep( B.farm[ L ], PART.hand, add( add( wr, mul( ax, 0.03 ) ), add( mul( ac, 0.022 ), mul( dp, 0.006 * curl ) ) ), tAx, norm( cross( tAx, [ s, 0, 0 ] ) ),
				[ [ 0, 0.013, 0.012 ], [ 0.03, 0.011, 0.01 ], [ 0.05, 0.009, 0.009 ] ], F( 6, 4 ), 0, 0.008 );
			// the thigh, the knee, the shin and the trousers' hem
			// (FW6: the thigh's top inside the jacket's hips, and the jacket fuller over them at its front
			// corners, as a jacket hangs over the hips: the thighs' fronts came through the jacket's elliptical
			// skirt, a patch of trousers either side of a flap of jacket)
			limb( B.thigh[ L ], PART.pants, add( hp, [ 0, 0.02, 0 ] ), kn, [ [ 0, 0.068, 0.074 ], [ 0.3, 0.075, 0.075 ], [ 0.6, 0.073, 0.074 ], [ 1, 0.062, 0.064 ] ] );
			ellipsoid( B.shin[ L ], PART.pants, kn, [ 0.06, 0.058, 0.061 ], F( 10, 8 ), F( 5, 4 ) );
			limb( B.shin[ L ], PART.pants, kn, add( an, [ 0, 0.02, 0 ] ), [ [ 0, 0.06, 0.062 ], [ 0.32, 0.057, 0.06 ], [ 0.82, 0.049, 0.051 ], [ 1, 0.054, 0.056 ] ] );
			// the shoe: a last swept from the heel to the toe (the heel's round, the instep up to the ankle,
			// the ball wide, the toe lifted off the floor), the sole flat (it was a brick)
			sweep( B.shin[ L ], PART.shoe, [ an[ 0 ] + 0.003 * s, 0, 0.1 ], [ 0, 0, - 1 ], [ - 1, 0, 0 ], [
				[ 0, 0.031, 0.034, 0, 0.042 ], [ 0.025, 0.041, 0.042, 0, 0.043 ], [ 0.08, 0.045, 0.047, 0, 0.048 ], [ 0.15, 0.05, 0.034, 0, 0.035 ],
				[ 0.205, 0.047, 0.024, 0, 0.028 ], [ 0.233, 0.034, 0.016, 0, 0.027 ],
			], F( 10, 6 ), 0.008, 0.01, 3 );
			// ---- end FW1

		} else {

			tube( B.uarm[ L ], PART.sleeve, sh, el, [ 0.062, 0.064 ], [ 0.05, 0.052 ], N8 );
			tube( B.farm[ L ], PART.sleeve, el, wr, [ 0.049, 0.05 ], [ 0.04, 0.042 ], N8 );
			// the hand: a mitten, turned in toward the body
			if ( ! tiny ) boxAt( B.farm[ L ], PART.hand, add( ha, [ - 0.004 * s, 0.0, 0 ] ), [ 0.017, 0.045, 0.036 ] );
			// the thigh, the shin and the shoe
			tube( B.thigh[ L ], PART.pants, add( hp, [ 0, 0.05, 0 ] ), kn, [ 0.088, 0.09 ], [ 0.062, 0.064 ], N8 );
			tube( B.shin[ L ], PART.pants, kn, add( an, [ 0, 0.02, 0 ] ), [ 0.06, 0.062 ], [ 0.047, 0.05 ], N8 );
			if ( ! tiny ) boxAt( B.shin[ L ], PART.shoe, add( an, [ 0.003 * s, - 0.045, - 0.045 ] ), [ 0.048, 0.042, 0.125 ] );
			else {

				const w = [ add( an, [ 0, 0.01, 0.03 ] ), add( an, [ 0.003 * s, - 0.075, - 0.16 ] ), add( an, [ - 0.045, - 0.085, 0.0 ] ), add( an, [ 0.045, - 0.085, 0.0 ] ) ].map( ( p ) => vert( p, sub( p, add( an, [ 0, - 0.04, - 0.05 ] ) ), B.shin[ L ], PART.shoe ) );
				index.push( w[ 0 ], w[ 1 ], w[ 2 ], w[ 0 ], w[ 3 ], w[ 1 ], w[ 0 ], w[ 2 ], w[ 3 ], w[ 1 ], w[ 3 ], w[ 2 ] );

			}

		}

	}

	// a poncho: a bell of plastic from the shoulders to the knees, over everything (the spine bone); the
	// long coats wear it too, as their skirts
	// (FP1, CP-6: it hangs from the shoulders over the arms, not a bell from a tight collar)
	// (FW1, C2W-16: to mid-thigh, closer to the body front and back, more rings and sides close up: the
	// shaders hang its sides on the arms, sag its corners and fold it; it was a stiff bell to the knees)
	// (FW6, C4W-4: narrower, over the narrower shoulders: it stood 9 cm out from the arms at the elbow, a
	// bell 0.67 m across; and falling in a little under the hands to its hem, as film does round the legs,
	// not a box's straight sides)
	loft( B.spine, PART.poncho, fine ? [ [ 0.7, 0.29, 0.186, 0.02 ], [ 0.82, 0.3, 0.192, 0.02 ], [ 0.98, 0.302, 0.19, 0.018 ], [ 1.14, 0.296, 0.178, 0.018 ],
		[ 1.27, 0.288, 0.162, 0.022 ], [ 1.35, 0.272, 0.142, 0.026 ], [ 1.41, 0.243, 0.113, 0.03 ], [ 1.45, 0.163, 0.088, 0.03 ], [ 1.485, 0.078, 0.068, 0.03 ] ]
		: [ [ 0.7, 0.29, 0.186, 0.02 ], [ 0.98, 0.302, 0.19, 0.018 ], [ 1.27, 0.288, 0.162, 0.022 ], [ 1.41, 0.243, 0.113, 0.03 ], [ 1.485, 0.078, 0.068, 0.03 ] ],
	fine ? F( 18, 12 ) : tiny ? 5 : 8, false, false, fine );
	// an apron (the concession staff), a hi-vis vest (security): thin shells just over the trunk
	// (FW6: square at its corners over the jacket's skirt, which is now)
	if ( ! tiny ) loft( B.spine, PART.apron, [ [ 0.55, 0.19, 0.13, 0.0, 2.5 ], [ 0.8, 0.184, 0.13, 0.006, 2.6 ], [ 1.02, 0.176, 0.124, 0.006, 2.4 ] ], fine ? F( 12, 9 ) : 7, false, false );
	loft( B.spine, PART.vest, [ [ 0.98, 0.174, 0.122, 0.01, 2.3 ], [ 1.17, 0.177, 0.125, 0.006, 2.2 ], [ 1.3, 0.193, 0.129, 0.012, 2.2 ], [ 1.4, 0.192, 0.106, 0.024, 2.05 ] ], fine ? F( 12, 9 ) : tiny ? 5 : 7, false, false );

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

				// (FW6, C4W-15: close up a 12-sided cup flaring to its rim)
				cyl( bone, part, g, 0.034, 0.045, 0.15, id === PROP.beer && fine ? F( 12, 6 ) : 8 );
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
				if ( fine && ! mid ) {

					// ---- FW4 (C3W-12): close up the floss a cloud, lumpy, on a paper cone (it was a faceted ball:
					// a blue crystal on a stick)
					tube( bone, part, add( g, [ 0, 0.14, 0 ] ), add( g, [ 0, 0.22, 0 ] ), [ 0.012, 0.012 ], [ 0.026, 0.026 ], 6 );
					const c0 = add( g, [ 0, 0.3, 0 ] ), W = 12, Hh = 8, f0 = pos.length / 3;
					for ( let j = 0; j <= Hh; j ++ ) for ( let i = 0; i < W; i ++ ) {

						const th = j / Hh * Math.PI, ph = i / W * Math.PI * 2;
						const d = [ Math.sin( th ) * Math.cos( ph ), Math.cos( th ), Math.sin( th ) * Math.sin( ph ) ];
						const lump = 1 + 0.14 * Math.sin( th * 5 + ph * 2 ) * Math.sin( ph * 3 + th ) + 0.08 * Math.sin( ph * 7 - th * 3 );
						vert( add( c0, [ d[ 0 ] * 0.11 * lump, d[ 1 ] * 0.12 * lump - ( d[ 1 ] < - 0.6 ? 0.02 : 0 ), d[ 2 ] * 0.11 * lump ] ), d, bone, part );

					}

					for ( let j = 0; j < Hh; j ++ ) for ( let i = 0; i < W; i ++ ) {

						const a = f0 + j * W + i, b = f0 + j * W + ( i + 1 ) % W, cc = a + W, dd = b + W;
						if ( j > 0 ) index.push( a, cc, b );
						if ( j < Hh - 1 ) index.push( b, cc, dd );

					}
					// ---- end FW4

				} else ellipsoid( bone, part, add( g, [ 0, 0.3, 0 ] ), [ 0.11, 0.13, 0.11 ], fine ? 7 : 5, fine ? 4 : 3 );

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

				// (FP1, CP-8: a cloth, not a card: gathered in the fist, curling across and hanging in a sag;
				// the shaders flutter its loose end)
				const w = 0.22, len = 0.4, n = fine ? 3 : 2, g0 = pos.length / 3;
				for ( let j = 0; j <= n; j ++ ) for ( let i = 0; i <= n; i ++ ) {

					const u = i / n, v = j / n;
					const z = ( - w + 1.3 * w * u ) * ( 0.35 + 0.65 * Math.min( 1, v * 2.5 ) );
					const x = s * ( - 0.02 + 0.05 * v + 0.035 * Math.sin( Math.PI * u ) * Math.min( 1, v * 2 ) );
					vert( add( h, [ x, - len * v + 0.03 * Math.sin( Math.PI * u ) * v, z ] ), [ s, 0.1, 0 ], bone, part );

				}

				for ( let j = 0; j < n; j ++ ) for ( let i = 0; i < n; i ++ ) {

					const a = g0 + j * ( n + 1 ) + i, b = a + 1, c = a + n + 1, d = c + 1;
					index.push( a, c, b, b, c, d );

				}

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

			// ---- R (rituals): the press's gear
			} else if ( id === PROP.slr ) {

				// the body in front of the face (the hand on its grip), the zoom out front, the flash on top
				const b = add( h, [ - 0.075 * s, 0.01, - 0.02 ] );
				boxAt( bone, part, b, [ 0.072, 0.055, 0.04 ] );
				tube( bone, part, add( b, [ 0, - 0.005, - 0.04 ] ), add( b, [ 0, - 0.005, - 0.31 ] ), [ 0.043, 0.043 ], [ 0.047, 0.047 ], fine ? 10 : 6, false, true );
				if ( fine ) tube( bone, part, add( b, [ 0, - 0.005, - 0.31 ] ), add( b, [ 0, - 0.005, - 0.37 ] ), [ 0.05, 0.05 ], [ 0.058, 0.058 ], 10 );
				boxAt( bone, part, add( b, [ 0, 0.1, 0.005 ] ), [ 0.034, 0.042, 0.028 ] );

			} else if ( id === PROP.eng ) {

				// on the shoulder: the body back over it, the lens forward under the hand, the viewfinder at
				// the eye, the battery at the back
				const b = add( h, [ - 0.1 * s, 0.07, 0.12 ] );
				boxAt( bone, part, b, [ 0.07, 0.1, 0.2 ] );
				tube( bone, part, add( b, [ 0, - 0.02, - 0.2 ] ), add( b, [ 0, - 0.02, - 0.42 ] ), [ 0.05, 0.05 ], [ 0.055, 0.055 ], fine ? 8 : 5, false, true );
				if ( fine ) {

					boxAt( bone, part, add( b, [ - 0.1 * s, 0.07, - 0.16 ] ), [ 0.022, 0.03, 0.06 ] );
					boxAt( bone, part, add( b, [ 0, 0.0, 0.24 ] ), [ 0.05, 0.07, 0.04 ] );
					tube( bone, part, add( b, [ 0, 0.1, - 0.1 ] ), add( b, [ 0, 0.14, 0.12 ] ), [ 0.012, 0.012 ], [ 0.012, 0.012 ], 4 );

				}

			} else if ( id === PROP.boom ) {

				// the pole out and up from the hands, the furry windscreen at its tip
				const a = add( h, [ 0, 0.02, 0.35 ] ), tip = add( h, [ 0, 1.25, - 2.3 ] );
				tube( bone, part, a, tip, [ 0.014, 0.014 ], [ 0.01, 0.01 ], fine ? 6 : 4 );
				const d = [ tip[ 0 ] - a[ 0 ], tip[ 1 ] - a[ 1 ], tip[ 2 ] - a[ 2 ] ], l = Math.hypot( ...d );
				tube( bone, part, add( tip, d.map( ( v ) => v / l * 0.02 ) ), add( tip, d.map( ( v ) => v / l * 0.34 ) ), [ 0.055, 0.055 ], [ 0.05, 0.05 ], fine ? 8 : 5, true, true );
			// ---- end R

			}

		}

	}

	// ---- FP1: every triangle wound to face the way its vertices' normals do. The engine's front face is
	// counter-clockwise and the material is double sided, turning a back face's normal round: the lofts
	// (the trunk, the hips, the poncho) and the ellipsoids (the head, the joints) were wound the other
	// way, so they were lit inside out, and the nose against them went dark (CP-13)
	for ( let i = 0; i < index.length; i += 3 ) {

		const P3 = ( k ) => [ pos[ index[ i + k ] * 3 ], pos[ index[ i + k ] * 3 + 1 ], pos[ index[ i + k ] * 3 + 2 ] ];
		const N3 = ( k ) => [ nrm[ index[ i + k ] * 3 ], nrm[ index[ i + k ] * 3 + 1 ], nrm[ index[ i + k ] * 3 + 2 ] ];
		const [ a, b, c ] = [ P3( 0 ), P3( 1 ), P3( 2 ) ];
		const fn = cross( sub( b, a ), sub( c, a ) );
		if ( Math.hypot( ...fn ) < 1e-10 ) continue;
		const vn = add( add( N3( 0 ), N3( 1 ) ), N3( 2 ) );
		if ( fn[ 0 ] * vn[ 0 ] + fn[ 1 ] * vn[ 1 ] + fn[ 2 ] * vn[ 2 ] < 0 ) [ index[ i + 1 ], index[ i + 2 ] ] = [ index[ i + 2 ], index[ i + 1 ] ];

	}
	// ---- end FP1

	const geo = new BufferGeometry();
	geo.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
	geo.setAttribute( 'normal', new Float32BufferAttribute( nrm, 3 ) );
	geo.setAttribute( 'aInfo', new Float32BufferAttribute( info, 3 ) ); // (FF1: and the head's record)
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

// ---- FW4 (C3W-2): an arm let hang falls in against the body: the places' standing poses hold it a
// little out (a roll of ~0.06, from when the arm hung wide), so a hanging arm (pitched less than ~0.4)
// gives up most of that roll, less on a belly. Raised, reaching, held up: as posed
fn c3Hang( arm: vec4f, belly: f32 ) -> vec4f {
	let hang = 1.0 - smoothstep( 0.25, 0.65, abs( arm.x ) );
	return vec4f( arm.x, arm.y - ( 0.055 - 0.045 * belly ) * hang, arm.z, arm.w );
}

// ---- FW6 (C4W-2): where a knit hat comes down to (d.y on the head's unit sphere, d its point): two
// fingers over the brows in front (they're at 0.3, the eyes at 0.1), over the tops of the ears at the sides,
// low on the nape behind
fn c3KnitEdge( d: vec3f ) -> f32 {
	let fr = - d.z / max( length( d.xz ), 0.001 );
	return mix( - 0.15, 0.0, smoothstep( - 1.0, 0.0, fr ) ) + 0.39 * smoothstep( 0.0, 0.95, fr );
}
// ---- end FW6

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
		// ---- FP1 (CP-21): walking, the arms swing against the legs (the right arm with the left leg), the
		// elbows easing a little; less the more the arm is already doing (a beer held up doesn't swing)
		let free = 1.0 - smoothstep( 0.2, 0.6, abs( arm.x ) );
		let swing = - walk * 0.3 * sin( ph + select( 3.14159, 0.0, right ) ) * free;
		let Re = c3Rx( arm.w + walk * free * ( 0.12 + 0.1 * max( 0.0, - sin( ph + select( 3.14159, 0.0, right ) ) ) ) );
		let Ra = c3Ry( s * arm.z ) * c3Rz( s * arm.y ) * c3Rx( arm.x + swing );
		// ---- end FP1
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

// ---- FW4 (C3W-4, C3W-5): plastic film crumpled, for the ponchos here and in the seats (Crowd.js): facets
// between sharp creases that wander every way (a noise folded at its middle, two sizes), as a tilt for the
// normal and how near a crease the point is. The 27th's photos (Getty 83457911, 83893023; the
// AP's fan pulling his on) have the clear ones as a silvery crinkled haze over the jacket, every crease
// catching a light. It fades out where a pixel spans more than a fold (fw: metres a pixel), so it never
// sparkles from afar. (They were a smooth glossy coat on the jacket: under the lights its highlights
// gathered at the facets' corners into sequins)
export const filmModule = new ShaderModule( {
	name: 'film',
	code: /* wgsl */`
fn filmHash( p: vec3f ) -> f32 { return fract( sin( dot( p, vec3f( 127.1, 311.7, 74.7 ) ) ) * 43758.5453 ); }
// value noise and its gradient (smoothstep between the corners' hashes)
fn filmNoise( x: vec3f ) -> vec4f {
	let p = floor( x );
	let w = fract( x );
	let u = w * w * ( 3.0 - 2.0 * w );
	let du = 6.0 * w * ( 1.0 - w );
	let a = filmHash( p );
	let b = filmHash( p + vec3f( 1.0, 0.0, 0.0 ) );
	let c = filmHash( p + vec3f( 0.0, 1.0, 0.0 ) );
	let d = filmHash( p + vec3f( 1.0, 1.0, 0.0 ) );
	let e = filmHash( p + vec3f( 0.0, 0.0, 1.0 ) );
	let f = filmHash( p + vec3f( 1.0, 0.0, 1.0 ) );
	let g = filmHash( p + vec3f( 0.0, 1.0, 1.0 ) );
	let h = filmHash( p + vec3f( 1.0, 1.0, 1.0 ) );
	let k1 = b - a; let k2 = c - a; let k3 = e - a; let k4 = a - b - c + d;
	let k5 = a - c - e + g; let k6 = a - b - e + f; let k7 = - a + b + c - d + e - f - g + h;
	let n = a + k1 * u.x + k2 * u.y + k3 * u.z + k4 * u.x * u.y + k5 * u.y * u.z + k6 * u.z * u.x + k7 * u.x * u.y * u.z;
	let gr = du * vec3f( k1 + k4 * u.y + k6 * u.z + k7 * u.y * u.z, k2 + k5 * u.z + k4 * u.x + k7 * u.z * u.x, k3 + k6 * u.x + k5 * u.y + k7 * u.x * u.y );
	return vec4f( n, gr );
}
// L: the point on the figure (metres, its own frame); returns the normal's tilt (xyz: the creases run
// every way, so the frame they're in doesn't show) and the crease (w, 0..1). Two octaves of noise folded
// at its middle: a crease along each of its random curves, the film either side of it a facet tipped away
fn filmCrumple( L: vec3f, fw: f32 ) -> vec4f {
	let k = 1.0 - smoothstep( 0.003, 0.016, fw );
	if ( k <= 0.0 ) { return vec4f( 0.0 ); }
	let n1 = filmNoise( L * 19.0 + vec3f( 3.1, 7.7, 1.3 ) );
	let n2 = filmNoise( L * 47.0 + vec3f( 9.2, 0.4, 5.5 ) );
	let s1 = n1.x * 2.0 - 1.0;
	let s2 = n2.x * 2.0 - 1.0;
	// the fold |s|: its slope turns over at the crease (s = 0)
	let t = - ( sign( s1 ) * n1.yzw * 0.05 + sign( s2 ) * n2.yzw * 0.012 * 47.0 / 19.0 );
	let crease = max( 1.0 - smoothstep( 0.0, 0.12, abs( s1 ) ), 0.6 * ( 1.0 - smoothstep( 0.0, 0.1, abs( s2 ) ) ) );
	return vec4f( t * 2.0 * k, crease * k );
}
// a normal n tilted by t (only across it)
fn filmTilt( n: vec3f, t: vec3f ) -> vec3f { return normalize( n + t - n * dot( t, n ) ); }
`,
} );
// ---- end FW4

// the palette (the shaders read it from a buffer, not an array in every invocation)
const PAL = { colors: 0, skin: 32, hair: 40, pants: 48, shoes: 56, size: 64 };
const SKINS = [ [ 0.62, 0.42, 0.32 ], [ 0.56, 0.36, 0.25 ], [ 0.5, 0.31, 0.2 ], [ 0.42, 0.25, 0.15 ], [ 0.3, 0.17, 0.1 ], [ 0.2, 0.11, 0.06 ], [ 0.12, 0.065, 0.04 ], [ 0.5, 0.34, 0.2 ] ];
const HAIRS = [ [ 0.016, 0.012, 0.01 ], [ 0.04, 0.024, 0.014 ], [ 0.1, 0.058, 0.03 ], [ 0.19, 0.12, 0.06 ], [ 0.4, 0.29, 0.14 ], [ 0.28, 0.08, 0.03 ], [ 0.26, 0.25, 0.24 ], [ 0.58, 0.57, 0.55 ] ];
const PANTS = [ [ 0.05, 0.075, 0.14 ], [ 0.02, 0.03, 0.06 ], [ 0.3, 0.25, 0.16 ], [ 0.015, 0.015, 0.015 ], [ 0.2, 0.2, 0.2 ], [ 0.015, 0.02, 0.05 ], [ 0.14, 0.14, 0.15 ], [ 0.09, 0.1, 0.05 ] ];
const SHOES = [ [ 0.62, 0.61, 0.58 ], [ 0.015, 0.015, 0.015 ], [ 0.3, 0.19, 0.08 ], [ 0.08, 0.04, 0.02 ], [ 0.2, 0.2, 0.2 ] ];
function palette() {

	const a = new Float32Array( PAL.size * 4 );
	const put = ( i, c ) => a.set( [ c[ 0 ], c[ 1 ], c[ 2 ], 1 ], i * 4 );
	COLORS.forEach( ( c, i ) => put( PAL.colors + i, c ) );
	SKINS.forEach( ( c, i ) => put( PAL.skin + i, c ) );
	HAIRS.forEach( ( c, i ) => put( PAL.hair + i, c ) );
	PANTS.forEach( ( c, i ) => put( PAL.pants + i, c ) );
	SHOES.forEach( ( c, i ) => put( PAL.shoes + i, c ) );
	return a;

}

// ---- FW1 (C2W-1): the palette's colours, for People's throng (dressed as the Cast figure that takes
// each of them over up close, so the two match at the handover)
export function castPalette() {

	return { colors: COLORS, skin: SKINS, hair: HAIRS, pants: PANTS, shoes: SHOES };

}

// the parts only some have: shown or folded away, by the look
const brimHats = [ HAT.capRed, HAT.capNavy, HAT.cap1980, HAT.capRays, HAT.capBack, HAT.visor, HAT.capBlack, HAT.capWhite, HAT.police, HAT.cabbie, HAT.capWS ];
const capHats = [ HAT.capRed, HAT.capNavy, HAT.cap1980, HAT.capRays, HAT.capBack, HAT.capBlack, HAT.capWhite, HAT.police, HAT.capWS ];
// ---- R (rituals): the Philadelphia police motor officers' white helmet (Getty 83486531): glossy white
// down over the ears, a short black peak
HAT.motor = 21;
brimHats.push( HAT.motor );
capHats.push( HAT.motor );
// ---- end R
const knitHats = [ HAT.knitRed, HAT.knitGrey, HAT.knitBlack, HAT.knitPlain ];
// ---- FP1: the ball caps that have the crown's own shell (the police cap and the motor helmet shape the
// head instead)
const crownHats = [ HAT.capRed, HAT.capNavy, HAT.cap1980, HAT.capRays, HAT.capBack, HAT.capBlack, HAT.capWhite, HAT.capWS ];
const any = ( v, list ) => list.map( ( x ) => `${ v } == ${ x }u` ).join( ' || ' );

function castMaterial( pool ) {

	const mat = standard( {
		name: 'cast', roughness: 0.8, side: 'double', modules: [ castModule, filmModule, fanHeadModule ],
		storage: { c3Pose: { storage: () => pool.poseBuf, access: 'read' }, c3Prev: { storage: () => pool.prevBuf, access: 'read' }, c3Look: { storage: () => pool.lookBuf, access: 'read' },
			c3Order: { storage: () => pool.orderBuf, access: 'read' }, c3Pal: { storage: () => pool.palBuf, access: 'read' },
			fhRec: { storage: () => fanHeadBuffer(), access: 'read' } }, // (FF1: the heads)
		textures: { c3Atlas: () => pool.atlas, c3Signs: () => pool.signTex },
		attributes: { aInfo: 'vec3f' }, // (FF1: the bone, the part, a MakeHuman head's record)
		varyings: { vLocal: 'vec3f', vPart: 'u32', vLook: 'vec4u', vPose: 'vec4f', vVar: 'f32' },
		vertex: /* wgsl */`
	let bone = u32( v.aInfo.x + 0.5 );
	let part = u32( v.aInfo.y + 0.5 );
	// this draw's figure (0 near, 1 far, 2 distant, 3 the middle) and its stretch of the order: the visible ones packed
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
	} else if ( part == ${ PART.pompom }u ) { gone = !( hat == ${ HAT.knitRed }u || hat == ${ HAT.knitGrey }u ) || ( hat == ${ HAT.knitRed }u && fract( f32( lk.w & 65535u ) / 65536.0 * 29.7 ) < 0.4 );
	} else if ( part == ${ PART.hairCard }u ) { gone = hairStyle != 1u || hat == ${ HAT.hood }u || poncho > 0u;
	} else if ( part == ${ PART.poncho }u ) { gone = poncho == 0u && ! longCoat;
	} else if ( part == ${ PART.apron }u ) { gone = !( top == ${ TOP.staff }u || top == ${ TOP.cook }u || top == ${ TOP.seller }u || top == ${ TOP.vendor }u );
	} else if ( part == ${ PART.vest }u ) { gone = top != ${ TOP.security }u;
	} else if ( part == ${ PART.bag }u ) { gone = ( gear & ${ GEAR.messenger }u ) == 0u || poncho > 0u;
	} else if ( part == ${ PART.pack }u ) { gone = ( gear & ${ GEAR.backpack }u ) == 0u;
	} else if ( part == ${ PART.radio }u ) { gone = ( gear & ${ GEAR.radio }u ) == 0u;
	} else if ( part == ${ PART.credential }u ) { gone = ( gear & ${ GEAR.credential }u ) == 0u || poncho > 0u;
	} else if ( part == ${ PART.campaign }u ) { gone = hat != ${ HAT.campaign }u;
	// ---- FW1 (C2W-2): a hand in the pocket is in it (it hung out at the hip, a paddle)
	} else if ( part == ${ PART.hand }u ) { gone = u32( select( a3.z, a3.w, bone == 6u ) + 0.5 ) == ${ PROP.pocket }u;
	// ---- FP1: a cap's crown (not under a hood: the bill pokes out of it), a scarf
	} else if ( part == ${ PART.crown }u ) { gone = !( ${ any( 'hat', crownHats ) } ) || poncho > 0u;
	} else if ( part == ${ PART.scarf }u ) { gone = ( ( lz >> 14u ) & 3u ) == 0u || poncho > 0u;
	// ---- FW4: the ears, under a hood (a poncho's, up), a knit hat, earmuffs, the motor helmet, long hair
	} else if ( part == ${ PART.ear }u ) {
		gone = hat == ${ HAT.hood }u || ( poncho > 0u && fract( f32( lk.w & 65535u ) / 65536.0 * 13.1 ) > 0.35 ) || hat == ${ HAT.earmuffs }u || hat == ${ HAT.motor }u || hairStyle == 1u;
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
	let belly = select( select( select( 0.0, 0.3, build == 1u ), 0.55, build == 2u ), 1.0, build == 3u );
	// (FW4: a hanging arm held clear of a belly, and of a hi-vis vest's sides, which it would cut through)
	let armOut = min( 1.0, belly + select( 0.0, 0.8, top == ${ TOP.security }u ) );
	var q = v.position;
	var n = v.normal;
	// the build: a belly, broad shoulders, a woman's narrower shoulders and fuller hips; a kid's big head
	let onTrunk = part == ${ PART.torso }u || part == ${ PART.pants }u || part == ${ PART.apron }u || part == ${ PART.vest }u || part == ${ PART.poncho }u
		|| part == ${ PART.bag }u || part == ${ PART.pack }u || part == ${ PART.radio }u || part == ${ PART.credential }u;
	if ( onTrunk ) {
		let bump = smoothstep( 0.86, 1.08, q.y ) * smoothstep( 1.36, 1.14, q.y );
		q.z -= belly * 0.07 * bump * smoothstep( 0.02, - 0.08, q.z );
		q.x *= 1.0 + belly * 0.12 * bump;
		if ( build == 2u ) { q.x *= 1.0 + 0.08 * smoothstep( 1.15, 1.38, q.y ); }
		if ( female ) {
			q.x *= mix( 1.0, 0.88, smoothstep( 1.15, 1.4, q.y ) ) * mix( 1.07, 1.0, smoothstep( 0.9, 1.05, q.y ) );
			q.z -= 0.028 * smoothstep( 1.16, 1.24, q.y ) * smoothstep( 1.36, 1.28, q.y ) * smoothstep( 0.0, - 0.08, q.z );
		}
	}
	if ( female && ( part == ${ PART.sleeve }u || part == ${ PART.hand }u ) ) { q.x *= 0.95; }
	// ---- FW1 (C2W-2): a hoodie's pouch stands off the belly; a hand in the pocket takes the forearm's end
	// in to the hip with it
	// ---- FW6 (C4W-1): a jersey hangs loose and straight from the chest over what's under it (auds
	// 2988587598: the home whites over a red hoodie), not shrunk to the trunk like a jacket's waist
	if ( part == ${ PART.torso }u && ( top == ${ TOP.homeJersey }u || top == ${ TOP.roadJersey }u || top == ${ TOP.powder }u ) ) {
		let lo = smoothstep( 1.24, 1.02, q.y );
		q.x *= 1.0 + 0.075 * lo;
		q.z = ( q.z - 0.01 ) * ( 1.0 + 0.06 * lo ) + 0.01;
	}
	// ---- end FW6
	if ( part == ${ PART.torso }u && top == ${ TOP.hoodie }u ) {
		q.z -= 0.012 * smoothstep( 0.87, 0.91, q.y ) * smoothstep( 1.08, 1.04, q.y ) * smoothstep( 0.125, 0.095, abs( q.x ) ) * smoothstep( 0.0, - 0.07, q.z );
	}
	if ( ( bone == 5u || bone == 6u ) && part == ${ PART.sleeve }u && u32( select( a3.z, a3.w, bone == 6u ) + 0.5 ) == ${ PROP.pocket }u ) {
		let tp = smoothstep( 1.0, 0.87, q.y );
		let sx = select( - 1.0, 1.0, bone == 6u );
		let ax = vec2f( sx * ${ J.wrist[ 0 ].toFixed( 3 ) }, ${ J.wrist[ 2 ].toFixed( 3 ) } );
		// (closing to a point at the wrist, inside the jacket: its open end showed as a black hole)
		let qq = ax + ( q.xz - ax ) * ( 1.0 - 0.9 * tp );
		q = vec3f( qq.x - sx * 0.05 * tp, q.y, qq.y );
	}
	// ---- end FW1
	// ---- FW6 (C4W-7): a jersey's or a tee's short sleeve is a tube that flares a little to its hem at
	// mid-arm (it was the round head of the sleeve in white: a ball on the shoulder); a broad man's arms
	// hang from his broader shoulders (the trunk widened under them)
	if ( ( bone == 3u || bone == 4u ) && part == ${ PART.sleeve }u && ( ${ [ 'homeJersey', 'nameTee', 'powder', 'rays', 'roadJersey', 'champsTee', 'staff', 'cook', 'polo' ].map( ( k ) => `top == ${ TOP[ k ] }u` ).join( ' || ' ) } ) ) {
		let sx = select( - 1.0, 1.0, bone == 4u );
		let tt = clamp( ( ${ J.shoulder[ 1 ].toFixed( 3 ) } - q.y ) / ${ ( J.shoulder[ 1 ] - J.elbow[ 1 ] ).toFixed( 3 ) }, 0.0, 1.0 );
		let axc = mix( vec2f( sx * ${ J.shoulder[ 0 ].toFixed( 3 ) }, ${ J.shoulder[ 2 ].toFixed( 3 ) } ), vec2f( sx * ${ J.elbow[ 0 ].toFixed( 3 ) }, ${ J.elbow[ 2 ].toFixed( 3 ) } ), tt );
		let fl = 0.13 * smoothstep( 1.34, 1.272, q.y ) * smoothstep( 1.246, 1.262, q.y );
		q = vec3f( axc.x + ( q.x - axc.x ) * ( 1.0 + fl ), q.y, axc.y + ( q.z - axc.y ) * ( 1.0 + fl ) );
	}
	if ( build == 2u && ( ( bone >= 3u && bone <= 6u ) || bone >= 11u ) ) { q.x += select( - 0.012, 0.012, bone == 4u || bone == 6u || bone == 12u ); }
	// (C4W-4: under a poncho the sleeves are the film over the arm, a little fuller: an arm brought out
	// to a beer or a phone takes the plastic with it, not the jacket's sleeve out through a hole in it)
	if ( part == ${ PART.sleeve }u && poncho > 0u && poncho < 7u ) { q += n * 0.014; }
	// ---- end FW6
	if ( part == ${ PART.poncho }u ) {
		// one poncho for two (poncho 7): it hangs from his shoulders and spreads out over the one on his left
		if ( poncho == 7u ) {
			let spread = 1.0 - smoothstep( 1.18, 1.44, q.y );
			q.x = q.x * ( 1.0 + 0.95 * spread ) - 0.27 * spread;
			q.z = q.z * ( 1.0 + 0.25 * spread );
		}
		// ---- FW1 (C2W-16): a poncho's corners hang lower than its sides (front, back and over each arm), the
		// plastic falls in folds from the shoulders, and its sides hang on the arms (the rig, below)
		if ( poncho > 0u && poncho < 7u ) {
			let a = atan2( q.x, q.z - 0.02 );
			let low = smoothstep( 1.2, 0.72, q.y );
			// ---- FW4 (C3W-5): it hangs on what's under it: in to the chest and the back below the shoulders,
			// out over the arms at the sides, a hollow either side between them; its folds fall from the
			// shoulders, uneven, each poncho its own (they were one even ripple, a sine round a bell), and lit as
			// folds (the normal turned with them); the hem ragged
			let ps = f32( lk.w & 65535u ) / 65536.0;
			q.y -= ( 0.05 * ( 0.5 + 0.5 * cos( 4.0 * a ) ) + 0.045 * ( 0.5 + 0.5 * sin( a * 3.0 + ps * 41.0 ) ) ) * low * low;
			let drape = smoothstep( 1.38, 1.08, q.y );
			let sideK = pow( abs( sin( a ) ), 3.0 );
			let h1 = ( abs( a ) - 2.05 ) / 0.28;
			let h2 = ( abs( a ) - 1.05 ) / 0.28;
			let hollow = exp( - h1 * h1 ) + 0.7 * exp( - h2 * h2 );
			let hug = 1.0 - drape * ( 0.15 * ( 1.0 - sideK ) + 0.07 * hollow );
			let fy = smoothstep( 1.34, 0.9, q.y ) * ( 0.6 + 0.4 * low );
			let p1 = a * 7.0 + 0.6 + ps * 6.0;
			let p2 = a * 12.0 + ps * 17.0;
			let p3 = a * 4.0 + ps * 29.0;
			let fold = 1.0 + ( 0.06 * sin( p1 ) + 0.03 * sin( p2 ) + 0.025 * sin( p3 ) ) * fy;
			let dfold = ( 0.42 * cos( p1 ) + 0.36 * cos( p2 ) + 0.1 * cos( p3 ) ) * fy;
			q.x = q.x * fold * hug;
			q.z = ( q.z - 0.02 ) * fold * hug + 0.02;
			let nh = n.xz - dfold / fold * vec2f( cos( a ), - sin( a ) ) * length( n.xz );
			n = normalize( vec3f( nh.x, n.y, nh.y ) );
			// ---- end FW4
		}
		// ---- end FW1
		// a long coat hangs straighter than a poncho, and stops at the knee
		// ---- FW6 (C4W-4): its own skirt from the waist (the coat's body and sleeves are the trunk's and the
		// arms'), straight down to the knee, flaring a little, clear of the hands: it was the poncho's bell from
		// the shoulders, the sleeves stuck on its sides
		if ( poncho == 0u ) {
			let a = atan2( q.x, q.z - 0.015 );
			let yk = 1.04 - ( 1.485 - q.y ) / 0.785 * 0.56;
			let fl = smoothstep( 0.92, 0.5, yk );
			// (square at its front corners, as the jacket's skirt under it is)
			let sa = sign( sin( a ) ) * pow( abs( sin( a ) ), 0.8 );
			let ca = sign( cos( a ) ) * pow( abs( cos( a ) ), 0.8 );
			q = vec3f( sa * ( 0.184 + 0.02 * fl ), yk, ca * ( 0.134 + 0.014 * fl ) + 0.015 );
			n = normalize( vec3f( sin( a ) / 0.18, 0.04, cos( a ) / 0.125 ) );
		}
		// ---- end FW6
	}
	let headC = ${ f3( J.head ) };
	// ---- FF1 (step 10): the near and middle figures' MakeHuman head, moved by his face's weights (from who he
	// is and his seed: FanHead.js fhCoefs); its ears folded flat under a hood (a poncho's, up), a knit hat,
	// earmuffs, the motor helmet, long hair; the paint and what's shaped by it in the paint's frame (fhPaint)
	let fhi = u32( v.aInfo.z + 0.5 );
	var fhPaint = vec3f( 0.0 );
	if ( fhi > 0u ) {
		let hk = vec3f( ${ HEAD_R.map( ( r, i ) => ( r / FH.R[ i ] ).toFixed( 4 ) ).join( ', ' ) } );
		let fc = fhCoefs( lk.w & 65535u, female, age, lx & 7u, build );
		// ---- FF2: his expression (FanHead.js: MakeHuman's units): the mouth open as his act has it (talking,
		// shouting, singing, blowing into his hands), a smile with it by his own nature, a faint one at rest
		// for some; his lids at their own rest (more on the old), shut in a blink
		let fr = fract( vec3f( 0.618034, 0.414214, 0.732051 ) * f32( lk.w & 65535u ) );
		let mouthK = clamp( a3.y, 0.0, 1.0 );
		let smileK = max( 0.25 * fr.x * fr.x, mouthK * ( 0.15 + 0.7 * fr.y ) ) * select( 1.0, 0.5, age == 1u );
		let lidRest = 0.1 + 0.2 * fr.z + select( 0.0, 0.12, age == 1u );
		let fh = fhBlend( fhi - 1u, fc[ 0 ], fc[ 1 ], vec3f( mouthK, smileK, max( clamp( a7.z, 0.0, 1.0 ), lidRest * ( 1.0 - 0.6 * smileK ) ) ) );
		// ---- end FF2
		q += fh.dp * hk;
		n = normalize( n + fh.dn );
		fhPaint = fh.d;
		let hoodUp = poncho > 0u && fract( f32( lk.w & 65535u ) / 65536.0 * 13.1 ) > 0.35;
		if ( hat == ${ HAT.hood }u || hoodUp || ${ any( 'hat', knitHats ) } || hat == ${ HAT.earmuffs }u || hat == ${ HAT.motor }u || hairStyle == 1u ) { q += fh.fold * hk; }
	}
	// ---- end FF1
	if ( bone == 2u && part != ${ PART.neck }u ) {
		// a kid's head is big for his body; a hood (and a knit hat) sits over the hair
		if ( age == 2u ) { q = ${ f3( J.neck ) } + ( q - ${ f3( J.neck ) } ) * 1.22; }
		var d = ( q - headC ) / vec3f( ${ HEAD_R.map( ( r ) => r.toFixed( 3 ) ).join( ', ' ) } );
		if ( fhi > 0u ) { d = fhPaint; } // (FF1)
		// ---- FP1 (CP-9): a hood (and a poncho's, up) loose over the head: its peak out over the brow,
		// falling onto the neck behind, the face's opening left where it is so the rim stands proud of it
		let ponchoHood = poncho > 0u && fract( f32( lk.w & 65535u ) / 65536.0 * 13.1 ) > 0.35;
		if ( ( hat == ${ HAT.hood }u || ponchoHood ) && part == ${ PART.head }u ) {
			let face = smoothstep( - 0.55, - 0.85, d.z ) * smoothstep( 0.75, 0.45, length( d.xy - vec2f( 0.0, - 0.05 ) ) );
			// (FW6, C4W-4: a poncho's hood closer over the head, 13% not 17%: it was a ball for a head)
			var hq = ( q - headC ) * mix( select( 1.14, 1.13, ponchoHood ), 1.0, face );
			hq += vec3f( 0.0, 0.01, - 0.026 ) * smoothstep( - 0.1, - 0.6, d.z ) * smoothstep( 0.35, 0.8, d.y ) * ( 1.0 - face );
			hq += vec3f( 0.0, - 0.03, 0.03 ) * smoothstep( 0.1, 0.7, d.z ) * smoothstep( 0.1, - 0.6, d.y );
			q = headC + hq;
		}
		// ---- end FP1
		// ---- FW6 (C4W-2): a knit hat sits on the head: its edge on the forehead above the brows in front,
		// over the tops of the ears at the sides, low on the nape behind (knitEdge); the folded cuff a step
		// out from the skull (its thickness, 1.7 cm), the crown over it hugging the skull's round a finger
		// out, a little higher and slouching back. (It came down to the eyes, the head blown up 6% above
		// them: straight sides, a can)
		if ( ( ${ any( 'hat', knitHats ) } ) && part == ${ PART.head }u ) {
			let rel = d.y - c3KnitEdge( d );
			let on = smoothstep( - 0.035, 0.005, rel );
			let off = on * ( 0.009 + 0.005 * smoothstep( 0.15, 0.12, rel ) );
			q = q + normalize( q - headC ) * off;
			q.y += 0.007 * smoothstep( 0.55, 1.0, d.y );
			q.z += 0.009 * smoothstep( 0.45, 0.95, d.y ) * smoothstep( - 0.5, 0.4, d.z );
		}
		// ---- end FW6
		// ---- FP2: long hair under a hat comes out from under its band (its top tucked in under the hat)
		if ( part == ${ PART.hairCard }u && hat != ${ HAT.none }u ) {
			q = headC + ( q - headC ) * ( 1.0 - 0.14 * smoothstep( - 0.03, 0.05, q.y - headC.y ) );
		}
		// ---- end FP2
		// a peaked police cap: the crown wider and flat on top; a flat cap sits low and short
		if ( hat == ${ HAT.police }u && part == ${ PART.head }u && d.y > 0.45 ) {
			let t = smoothstep( 0.45, 0.8, d.y );
			q = vec3f( headC.x + ( q.x - headC.x ) * ( 1.0 + 0.18 * t ), mix( q.y, headC.y + ${ ( HEAD_R[ 1 ] * 0.95 ).toFixed( 3 ) }, t * 0.7 ), headC.z + ( q.z - headC.z ) * ( 1.0 + 0.12 * t ) );
		}
		if ( part == ${ PART.brim }u && hat == ${ HAT.cabbie }u ) { q = vec3f( q.x, q.y - 0.012, headC.z + ( q.z - headC.z ) * 0.7 ); }
		if ( part == ${ PART.brim }u && hat == ${ HAT.police }u ) { q = vec3f( q.x, q.y + 0.004, headC.z + ( q.z - headC.z ) * 0.85 ); }
		// ---- R (rituals): the motor helmet's peak, short and up on its dome
		if ( part == ${ PART.brim }u && hat == ${ HAT.motor }u ) { q = vec3f( q.x * 1.12, q.y + 0.03, headC.z + ( q.z - headC.z ) * 0.62 ); }
		// ---- end R
	}
	// ---- FP2: a cap on backwards is the cap turned half round about the head's own centre (a kid's
	// head is the bigger one about the neck). It was mirrored with the centre's height added to it, so every
	// backwards cap in the park hung in the air 1.6 m over its owner's bare head (C2I-7, the club; FW1's,
	// the 3B concourse; C2B-21's, at the pile and the stage)
	if ( ( part == ${ PART.brim }u || part == ${ PART.crown }u ) && hat == ${ HAT.capBack }u ) {
		let hc = select( headC, ${ f3( J.neck ) } + ( headC - ${ f3( J.neck ) } ) * 1.22, age == 2u );
		q = vec3f( 2.0 * hc.x - q.x, q.y, 2.0 * hc.z - q.z );
		n = vec3f( - n.x, n.y, - n.z );
		// ---- FW4: its crown's low back edge, now over the forehead, up over the brows (as the paint, below)
		if ( part == ${ PART.crown }u ) {
			let hr = ${ ( HEAD_R[ 1 ] ).toFixed( 3 ) } * select( 1.0, 1.22, age == 2u );
			let dz = ( q.z - hc.z ) / ( ${ HEAD_R[ 2 ].toFixed( 3 ) } * select( 1.0, 1.22, age == 2u ) );
			let dy0 = ( q.y - hc.y ) / hr;
			let dy1 = mix( dy0, max( dy0, 0.39 ), smoothstep( 0.1, - 0.45, dz ) );
			let k = sqrt( max( 0.05, 1.0 - dy1 * dy1 ) / max( 0.05, 1.0 - dy0 * dy0 ) );
			q = vec3f( hc.x + ( q.x - hc.x ) * k, hc.y + dy1 * hr, hc.z + ( q.z - hc.z ) * k );
		}
	}
	// ---- end FP2
	// ---- FW4 (C3W-2): faces of their own, from the seed: the jaw wider or narrower, the face below the
	// eyes longer or shorter, the nose bigger or smaller (a woman's finer and her brow softer, a kid's
	// small, an old man's longer). The paint keeps to the face as modelled (qFace), so the eyes and the
	// mouth stay where they're drawn on it; the cap's shell is above all this and still fits
	var qFace = q;
	if ( fhi > 0u ) { qFace = headC + fhPaint * vec3f( ${ HEAD_R.map( ( r ) => r.toFixed( 3 ) ).join( ', ' ) } ); } // (FF1: the paint's frame)
	if ( ( part == ${ PART.head }u || part == ${ PART.nose }u || part == ${ PART.ear }u ) && fhi == 0u ) { // (FF1: the MakeHuman head has its own)
		let kid = age == 2u;
		let rk = select( 1.0, 1.22, kid );
		let hk = select( headC, ${ f3( J.neck ) } + ( headC - ${ f3( J.neck ) } ) * 1.22, kid );
		let hr = vec3f( ${ HEAD_R.map( ( r ) => r.toFixed( 3 ) ).join( ', ' ) } ) * rk;
		let e = ( q - hk ) / hr;
		let fs = fract( vec4f( 0.137, 0.291, 0.463, 0.719 ) * f32( lk.w & 65535u ) * 0.0137 + vec4f( 0.11, 0.37, 0.59, 0.83 ) );
		let jaw = mix( 0.93, 1.07, fs.x ) * select( 1.0, 0.94, female ) * select( 1.0, 1.04, kid );
		let len = mix( 0.95, 1.06, fs.y ) * select( 1.0, 0.94, kid );
		let nose = mix( 0.86, 1.2, fs.z ) * select( 1.0, 0.85, female ) * select( 1.0, 0.78, kid ) * select( 1.0, 1.1, age == 1u );
		let eyeY = hk.y + 0.1 * hr.y;
		let jk = mix( 1.0, jaw, smoothstep( - 0.1, - 0.7, e.y ) );
		q.x = hk.x + ( q.x - hk.x ) * jk;
		if ( q.y < eyeY ) { q.y = eyeY + ( q.y - eyeY ) * len; }
		n = normalize( vec3f( n.x / jk, n.y / select( 1.0, len, q.y < eyeY ), n.z ) );
		if ( part == ${ PART.nose }u ) {
			// scaled from its root on the face: out from it most, across less, down a little
			let p0 = hk + vec3f( 0.0, - 0.005, - 0.089 ) * rk;
			let ns = vec3f( mix( 1.0, nose, 0.55 ), mix( 1.0, nose, 0.35 ), nose );
			q = p0 + ( q - p0 ) * ns;
			n = normalize( n / ns );
		}
		// a woman's brow without the ridge
		if ( female && part == ${ PART.head }u && e.z < 0.0 ) {
			let bx = ( abs( e.x ) - 0.25 ) / 0.3;
			let by = ( e.y - 0.29 ) / 0.065;
			q.z += 0.0045 * rk * exp( - bx * bx - by * by ) * smoothstep( 0.15, - 0.55, e.z );
		}
	}
	// ---- end FW4
	// ---- FP1 (CP-8): a towel's loose end flutters (its own pace and phase)
	// ---- FP2 (C2B-16): and held up over the head it's twirled: whirled round the fist (the plane square
	// to the arm, so over the head it's a tilted disc facing the field), the loose end trailing the turn and
	// sagging, the cloth's width half along the turn and half along the arm, so it reads as a white blur
	// from the front as in the photos (Getty 84082693, 112874141). Hanging off the raised arm it stood up
	// in line with it, a red and white stick over every head behind the plate. (The paint keeps the cloth
	// as it hangs: tRest)
	var tRest = q;
	var tUp = 0.0;
	if ( part == 32u + ${ PROP.towel }u ) {
		let th0 = vec3f( select( - 1.0, 1.0, bone == 12u ) * ${ J.hand[ 0 ].toFixed( 3 ) }, ${ J.hand[ 1 ].toFixed( 3 ) }, ${ J.hand[ 2 ].toFixed( 3 ) } );
		let tv = clamp( ( th0.y - q.y ) / 0.4, 0.0, 1.0 );
		let ph = frame.time * 7.0 + f32( lk.w & 255u ) * 0.37 + tv * 3.0;
		var tq = q + vec3f( 0.045 * sin( ph ), 0.02 * sin( ph * 1.3 ), 0.03 * cos( ph * 0.8 ) ) * tv * tv;
		let up = smoothstep( 1.75, 2.3, c3Pose[ k + select( 4u, 5u, bone == 12u ) ].x );
		if ( up > 0.0 ) {
			let sd = f32( ( lk.w >> 4u ) & 255u ) / 255.0;
			let dir = select( - 1.0, 1.0, sd > 0.4 );
			let tu = clamp( ( q.z - th0.z ) / 0.286 + 0.769, 0.0, 1.0 ) * 2.0 - 1.0;
			let a = dir * ( frame.time * ( 9.0 + 5.0 * sd ) + sd * 40.0 ) - dir * 1.7 * tv;
			let R = vec3f( cos( a ), 0.0, sin( a ) );
			let T = vec3f( - sin( a ), 0.0, cos( a ) ) * dir;
			let w = 0.3 + 0.7 * tv;
			let fl = sin( frame.time * 23.0 + sd * 9.0 + tv * 4.0 ) * 0.03 * tv;
			let spin = th0 + R * ( 0.02 + 0.36 * tv ) + T * ( tu * 0.12 * w ) - vec3f( 0.0, tu * 0.06 * w - 0.05 * tv * tv + fl, 0.0 );
			tq = mix( tq, spin, up );
			n = normalize( mix( n, normalize( normalize( cross( R, T * 0.12 - vec3f( 0.0, 0.06, 0.0 ) ) ) * 0.4 - vec3f( 0.0, 1.0, 0.0 ) ), up ) );
			tUp = up;
		}
		q = tq;
	}
	// ---- end FP1, FP2
	// this vertex's arm (the left's row or the right's)
	let armRow = k + select( 4u, 5u, bone == 4u || bone == 6u || bone == 12u );
	let at = c3Pose[ k ];
	var r0 = c3Rig( q, n, bone, part, at, c3Pose[ k + 1u ], c3Pose[ k + 2u ], a3.x, c3Hang( c3Pose[ armRow ], armOut ), c3Pose[ k + 6u ], a7.x );
	// ---- FW1 (C2W-16): a poncho's sides go where the arms do (rigged with the upper arm too, and blended:
	// over the arm it's the arm's, the hem and the middle the trunk's), swinging as they swing walking
	let wArm = select( 0.0, smoothstep( 0.17, 0.27, abs( q.x ) ) * smoothstep( 0.82, 1.06, q.y ), part == ${ PART.poncho }u && poncho > 0u && poncho < 7u );
	let armB = select( 3u, 4u, q.x > 0.0 );
	let armR2 = k + select( 4u, 5u, q.x > 0.0 );
	// ---- FW6 (C4W-4): and its lower sides the forearm's, so a beer held up, a phone at the ear, hands on
	// the rail lift the film over the arm and the hand comes out from under its edge (the forearm came out
	// through the plastic at mid-height, the hand a paddle sticking out of a bell)
	let wFore = select( 0.0, smoothstep( 1.2, 1.0, q.y ), lod == 0u || lod == 3u );
	if ( wArm > 0.0 ) {
		let ra = c3Rig( q, n, armB, part, at, c3Pose[ k + 1u ], c3Pose[ k + 2u ], a3.x, c3Hang( c3Pose[ armR2 ], armOut ), c3Pose[ k + 6u ], a7.x );
		var ap = ra.p;
		var an = ra.n;
		if ( wFore > 0.0 ) {
			let rf = c3Rig( q, n, armB + 2u, part, at, c3Pose[ k + 1u ], c3Pose[ k + 2u ], a3.x, c3Hang( c3Pose[ armR2 ], armOut ), c3Pose[ k + 6u ], a7.x );
			ap = mix( ap, rf.p, wFore );
			an = normalize( mix( an, rf.n, wFore ) );
		}
		r0.p = mix( r0.p, ap, wArm );
		r0.n = normalize( mix( r0.n, an, wArm ) );
	}
	// ---- end FW6
	// ---- end FW1
	// ---- FW6 (C4W-1): a jacket's skirt below the waist stays round the hips when the trunk turns or leans
	// (it swung with the chest, and the trousers showed through its sides)
	// (the near and middle figures: further off it's under a pixel, and the far ones stay as cheap as they were)
	let fineLod = lod == 0u || lod == 3u;
	let wHem = select( 0.0, smoothstep( 0.99, 0.87, q.y ), fineLod && ( part == ${ PART.torso }u || part == ${ PART.apron }u || ( part == ${ PART.poncho }u && poncho == 0u ) ) );
	if ( wHem > 0.0 ) {
		let rh = c3Rig( q, n, 0u, part, at, c3Pose[ k + 1u ], c3Pose[ k + 2u ], a3.x, c3Pose[ armRow ], c3Pose[ k + 6u ], a7.x );
		r0.p = mix( r0.p, rh.p, wHem );
		r0.n = normalize( mix( r0.n, rh.n, wHem ) );
	}
	// ---- FW6 (C4W-7): the sleeve's head (the deltoid over the joint) belongs to the shoulder as much as to
	// the arm: blended toward the spine's rig from 10 cm under the joint up, so an arm brought forward or
	// up stretches the cloth from the shoulder rather than swinging the head's back up over it (a ball on
	// every shoulder at the rail, every phone and every beer). Held right up (a towel), the arm takes more
	let wSh = select( 0.0, smoothstep( ${ ( J.shoulder[ 1 ] - 0.1 ).toFixed( 3 ) }, ${ ( J.shoulder[ 1 ] - 0.005 ).toFixed( 3 ) }, q.y ) * ( 0.72 - 0.4 * smoothstep( 1.6, 2.6, abs( c3Pose[ armRow ].x ) ) ), fineLod && part == ${ PART.sleeve }u && ( bone == 3u || bone == 4u ) );
	if ( wSh > 0.0 ) {
		let rs = c3Rig( q, n, 1u, part, at, c3Pose[ k + 1u ], c3Pose[ k + 2u ], a3.x, c3Pose[ armRow ], c3Pose[ k + 6u ], a7.x );
		r0.p = mix( r0.p, rs.p, wSh );
		r0.n = normalize( mix( r0.n, rs.n, wSh ) );
	}
	// ---- end FW6
	v.useWorld = true;
	v.worldPos = ( v.model * vec4f( r0.p, 1.0 ) ).xyz;
	v.worldNormal = normalize( ( v.model * vec4f( r0.n, 0.0 ) ).xyz );
	if ( lod == 0u || lod == 3u ) {
		// the near ones (and the middle ones) rigged again in last frame's pose: the arms' and legs' own motion for the TAA
		var r1 = c3Rig( q, n, bone, part, c3Prev[ k ], c3Prev[ k + 1u ], c3Prev[ k + 2u ], c3Prev[ k + 3u ].x, c3Hang( c3Prev[ armRow ], armOut ), c3Prev[ k + 6u ], c3Prev[ k + 7u ].x );
		if ( wArm > 0.0 ) {
			var ap1 = c3Rig( q, n, armB, part, c3Prev[ k ], c3Prev[ k + 1u ], c3Prev[ k + 2u ], c3Prev[ k + 3u ].x, c3Hang( c3Prev[ armR2 ], armOut ), c3Prev[ k + 6u ], c3Prev[ k + 7u ].x ).p;
			if ( wFore > 0.0 ) { ap1 = mix( ap1, c3Rig( q, n, armB + 2u, part, c3Prev[ k ], c3Prev[ k + 1u ], c3Prev[ k + 2u ], c3Prev[ k + 3u ].x, c3Hang( c3Prev[ armR2 ], armOut ), c3Prev[ k + 6u ], c3Prev[ k + 7u ].x ).p, wFore ); }
			r1.p = mix( r1.p, ap1, wArm );
		}
		if ( wHem > 0.0 ) { r1.p = mix( r1.p, c3Rig( q, n, 0u, part, c3Prev[ k ], c3Prev[ k + 1u ], c3Prev[ k + 2u ], c3Prev[ k + 3u ].x, c3Prev[ armRow ], c3Prev[ k + 6u ], c3Prev[ k + 7u ].x ).p, wHem ); }
		if ( wSh > 0.0 ) { r1.p = mix( r1.p, c3Rig( q, n, 1u, part, c3Prev[ k ], c3Prev[ k + 1u ], c3Prev[ k + 2u ], c3Prev[ k + 3u ].x, c3Prev[ armRow ], c3Prev[ k + 6u ], c3Prev[ k + 7u ].x ).p, wSh ); }
		v.prevWorldPos = ( v.prevModel * vec4f( r1.p, 1.0 ) ).xyz;
	} else {
		// further off, only where they've walked
		let moved = at.xyz - c3Prev[ k ].xyz;
		v.prevWorldPos = ( v.prevModel * vec4f( r0.p - moved, 1.0 ) ).xyz;
	}
	o.vLocal = select( select( q, qFace, part == ${ PART.head }u || part == ${ PART.nose }u || part == ${ PART.ear }u ), tRest, part == 32u + ${ PROP.towel }u );
	o.vPart = part | select( 0u, 128u, fhi > 0u ); // (FF2: 128, a MakeHuman head's: its eyes and mouth are modelled)
	o.vLook = lk;
	// ( the mouth, the breath, the blink, an umbrella up over them )
	o.vPose = vec4f( a3.y, a7.y, a7.z, select( 0.0, 1.0, u32( a3.w + 0.5 ) == ${ PROP.umbrella }u ) );
	o.vVar = select( f32( select( vars >> 8u, vars & 255u, right ) ), 300.0 + tUp * 99.0, part == 32u + ${ PROP.towel }u );
`,
		surface: /* wgsl */`
#if C3_FLAT
	// (profiling: the dressing skipped, the lighting kept)
	s.albedo = vec3f( 0.3 ); s.roughness = 0.8; s.metalness = 0.0; s.emissive = vec3f( 0.0 );
	return;
#endif
	let part = in.vs.vPart & 127u;
	let mhF = in.vs.vPart >= 128u; // (FF2: a MakeHuman head)
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
		// ---- FW1 (C2W-2): some jackets open down the front, the hoodie or sweater under them showing, the
		// facings' edges darker; the rest zipped; a ribbed hem at the waist
		let unzipped = zipped && g.y > 0.72 && top != ${ TOP.puffer }u && top != ${ TOP.raincoat }u && top != ${ TOP.usher }u;
		let gap = 0.026 + 0.05 * smoothstep( 1.05, 1.42, L.y );
		if ( unzipped && part == ${ PART.torso }u && L.z < 0.0 && L.y > 0.82 && abs( L.x ) < gap + 0.008 ) {
			c = select( sleeveC * 0.9, topC * 0.62, abs( L.x ) > gap );
			rough = 0.9;
		} else if ( zipped && part == ${ PART.torso }u && L.z < 0.0 && abs( L.x ) < 0.006 && L.y > 0.86 ) { c = mix( c, vec3f( 0.3 ), 0.7 ); metal = 0.6; }
		if ( part == ${ PART.torso }u && L.y < 0.842 && ! longCoat ) { c *= 0.84 + 0.06 * step( 0.5, fract( atan2( L.x, L.z ) * 9.0 ) ); }
		// ---- end FW1
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
		// ---- FW6 (C4W-13): further off, where a pixel spans a letter's stroke, the print fades to a pale tint
		// over its cell (its mean coverage), not the atlas's low mip, which averaged the name and the number
		// into one solid block: a white bib on every back at 8-20 m
		let pfar = smoothstep( 0.0035, 0.009, length( fwidth( L ) ) );
		let pcell = back > 0u && onBack && L.y > 1.0 && L.y < 1.38 && abs( L.x ) < 0.15;
		printA = mix( printA, select( 0.0, 0.28, pcell || printA > 0.001 ), pfar );
		// ---- end FW6
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
		// (a scarf is its own part: FP1)
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
		if ( scarf > 0u && L.y < 1.48 ) { c = select( select( vec3f( 0.012 ), vec3f( 0.25 ), scarf == 2u ), vec3f( 0.32, 0.02, 0.03 ), scarf == 1u ); rough = 0.95; }
	}
	// ---- FP1 (CP-15): the scarf: a knitted band round the neck and one end down the chest, the red and
	// white ones in bars across the band (it was a candy-striped cape over the whole yoke)
	if ( part == ${ PART.scarf }u ) {
		let end = L.y < 1.39;
		let bars = select( fract( atan2( L.x, L.z - 0.03 ) * 1.6 ), fract( L.y / 0.12 ), end ) < 0.5;
		c = select( select( vec3f( 0.012 ), vec3f( 0.25 ), scarf == 2u ), select( vec3f( 0.32, 0.02, 0.03 ), vec3f( 0.68, 0.67, 0.64 ), bars ), scarf == 1u );
		c *= 0.9 + 0.1 * sin( L.y * 260.0 );
		rough = 0.95;
	}
	// (the nose shaded as the face is: CP-13)
	// ---- FW4 (C3W-2): the modelled nose the face's own skin, its tip red with the cold (and a pair of
	// glasses' bridge across it); the ears red at their rims
	if ( part == ${ PART.nose }u || part == ${ PART.ear }u ) {
		let d = ( L - ${ f3( J.head ) } ) / vec3f( ${ HEAD_R.map( ( r ) => r.toFixed( 3 ) ).join( ', ' ) } );
		c = skin; rough = 0.55;
		if ( part == ${ PART.nose }u ) {
			c = mix( c, c * vec3f( 1.3, 0.78, 0.76 ), 0.4 * smoothstep( - 1.0, - 1.17, d.z ) * smoothstep( 0.15, - 0.15, d.y ) );
			if ( glasses && abs( d.y - 0.15 ) < 0.035 ) { c = vec3f( 0.015 ); rough = 0.3; }
		} else {
			c = mix( c, c * vec3f( 1.25, 0.8, 0.78 ), 0.3 + 0.3 * smoothstep( 1.02, 1.12, abs( d.x ) ) );
		}
	}
	// ---- end FW4
	// ---- end FP1
	var headAO = 1.0;
	if ( part == ${ PART.head }u ) {
		// the head in its own frame, the face toward -z
		let d = ( L - ${ f3( J.head ) } ) / vec3f( ${ HEAD_R.map( ( r ) => r.toFixed( 3 ) ).join( ', ' ) } );
		let ax = abs( d.x );
		c = skin;
		rough = 0.55;
		// ---- FF1: the MakeHuman head's eyeballs (the paint's d.z marks them), white under the lids
		let eyeball = d.z < - 2.0;
		if ( eyeball ) { c = vec3f( 0.56, 0.54, 0.51 ); rough = 0.12; }
		// ---- end FF1
		let fw = fwidth( d.x ) + fwidth( d.y );
		let near = 1.0 - smoothstep( 0.12, 0.35, fw );
		let front = smoothstep( 0.1, - 0.25, d.z );
		// the cold: red cheeks, nose and ears
		c = mix( c, c * vec3f( 1.3, 0.78, 0.76 ), 0.45 * smoothstep( 0.3, 0.05, length( vec2f( ax - 0.46, d.y + 0.16 ) ) ) * front );
		// the eyes: sockets in shadow, the whites and the irises; the brows; a blink now and then
		let blink = in.vs.vPose.z;
		let ey = vec2f( ax - 0.34, d.y - 0.1 );
		c *= mix( 1.0, 0.68, smoothstep( 0.22, 0.08, length( ey * vec2f( 1.0, 1.5 ) ) ) * front );
		// ---- FF1: on an eyeball the iris round the pupil (a brown, darker for a dark skin; a hazel or blue for
		// some fair ones, by the seed)
		if ( eyeball ) {
			let irisC = select( vec3f( 0.09, 0.05, 0.025 ), select( vec3f( 0.16, 0.12, 0.05 ), vec3f( 0.12, 0.17, 0.22 ), fract( seed * 53.1 ) < 0.5 ), skin.r > 0.55 && fract( seed * 19.3 ) < 0.45 );
			c = mix( c, irisC, smoothstep( 0.08, 0.065, length( ey ) ) );
		}
		// ---- end FF1
		// (---- FF2: on a MakeHuman head the white and the pupil on the eyeball alone, and no squash: the lids
		// are skin and close over it themselves; painted on the lids too, the eyes stared and stayed open)
		let onEye = select( 1.0, select( 0.0, 1.0, eyeball ), mhF );
		let bk = select( blink, 0.0, mhF );
		if ( mhF ) { c *= mix( 1.0, 0.8, smoothstep( 0.16, 0.1, length( ey * vec2f( 1.0, 1.6 ) ) ) * ( 1.0 - onEye ) * front ); }
		let white = smoothstep( 0.1, 0.075, length( ey * vec2f( 1.0, 1.9 + bk * 6.0 ) ) ) * near * front * onEye;
		c = mix( c, vec3f( 0.55, 0.53, 0.5 ), white );
		c = mix( c, vec3f( 0.02, 0.015, 0.01 ), smoothstep( 0.05, 0.035, length( ey * vec2f( 1.0, 1.0 + bk * 6.0 ) ) ) * near * front * onEye );
		let brow = smoothstep( 0.05, 0.02, abs( d.y - 0.3 + 0.05 * ax ) ) * step( 0.1, ax ) * step( ax, select( 0.56, 0.5, female ) ) * front;
		c = mix( c, hairC, brow * select( 0.85, 0.55, female ) );
		// the mouth: lips (redder on the women); open when he talks, shouts or blows into his hands
		let open = in.vs.vPose.x;
		// (---- FF2: a MakeHuman head's mouth opens itself: the lips their own size and colour, and inside them
		// (the paint's d.z marks it) dark, the upper teeth under the upper lip, as it opens)
		let mo = length( vec2f( d.x / 0.25, ( d.y + 0.45 ) / ( 0.05 + select( 0.13 * open, 0.0, mhF ) ) ) );
		let lip = c * select( vec3f( 0.85, 0.62, 0.6 ), vec3f( 0.95, 0.5, 0.52 ), female );
		c = mix( c, mix( lip, vec3f( 0.06, 0.02, 0.02 ), select( smoothstep( 0.3, 0.7, open ), 0.0, mhF ) ), smoothstep( 1.0, 0.7, mo ) * front );
		if ( mhF ) {
			let inM = smoothstep( - 1.04, - 1.3, d.z ) * smoothstep( 0.22, 0.16, abs( d.y + 0.45 ) ) * smoothstep( 0.32, 0.26, ax ) * smoothstep( 0.05, 0.35, open );
			let teeth = smoothstep( - 0.435, - 0.425, d.y ) * smoothstep( - 0.39, - 0.4, d.y ) * smoothstep( 0.13, 0.09, ax ) * 0.8;
			c = mix( c, mix( vec3f( 0.035, 0.008, 0.008 ), vec3f( 0.36, 0.34, 0.29 ), teeth ), inM );
			if ( inM > 0.5 ) { rough = mix( 0.3, 0.45, teeth ); }
		}
		// a moustache, a goatee, a beard, stubble (the stubble a shadow, the beard a softer band)
		// ---- FW6 (C4W-16): a moustache and a goatee in the hair's own colour, a little darker, their edges
		// soft and broken into stubble, the skin through them (hard black cut-outs with ruler edges)
		let fstub = 0.75 + 0.25 * sin( d.x * 211.0 + sin( d.y * 97.0 ) * 3.0 ) * sin( d.y * 183.0 + d.x * 41.0 );
		let fcol = mix( c, hairC * 0.8, 0.85 );
		// (FF1: the MakeHuman head has a neck under its chin, where the egg ended: no beard down it)
		let noNeck = smoothstep( - 1.12, - 0.98, d.y );
		let moust = smoothstep( 0.06, 0.02, abs( d.y + 0.33 + 0.04 * ax * ax ) ) * smoothstep( 0.33, 0.24, ax );
		let goat = smoothstep( - 0.47, - 0.53, d.y ) * smoothstep( 0.27, 0.19, ax ) * smoothstep( 0.0, - 0.2, d.z ) * noNeck;
		if ( facial == 1u || facial == 3u ) { c = mix( c, fcol, clamp( moust * fstub * 1.15, 0.0, 0.92 ) * front ); }
		if ( facial == 2u ) { c = mix( c, fcol, clamp( max( moust, goat ) * fstub * 1.15, 0.0, 0.92 ) * front ); }
		// ---- end FW6
		// (FP1, CP-13: the beard soft at its edges and broken up, not a black mask)
		if ( facial == 3u ) {
			// ---- FW4: the jaw and the cheeks below the cheekbone, up to the sideburns, the skin through its
			// edges (not round the side of the head to the back)
			let grain = 0.85 + 0.15 * sin( d.x * 93.0 ) * sin( d.y * 71.0 + d.z * 37.0 );
			let edgeY = - 0.16 + 0.24 * smoothstep( 0.35, 0.85, ax );
			let cover = smoothstep( edgeY + 0.03, edgeY - 0.1, d.y ) * smoothstep( 0.18, - 0.12, d.z ) * smoothstep( 0.5, 0.7, mo ) * smoothstep( 1.02, 0.86, ax ) * noNeck;
			c = mix( c, mix( hairC, c, 0.2 ) * grain, 0.72 * cover );
			// ---- end FW4
		}
		if ( facial == 4u ) { c *= mix( vec3f( 1.0 ), vec3f( 0.8, 0.82, 0.86 ), step( d.y, - 0.2 ) * step( d.z, 0.3 ) * step( 0.8, mo ) * noNeck ); }
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
		// (FP1: at the sides above the ears and behind them, not over them: under a cap it was a blindfold)
		var hairy = d.y > 0.42 - 0.55 * smoothstep( - 0.35, 0.5, d.z ) || ( ax > 0.8 && d.z > - 0.3 && ( d.y > 0.24 || ( d.z > 0.3 && d.y > - 0.15 ) ) );
		if ( hairStyle == 1u ) { hairy = d.y > 0.4 - 1.4 * smoothstep( - 0.55, 0.25, d.z ) || ( ax > 0.72 && d.y > - 0.55 && d.z > - 0.45 ); }
		if ( hairStyle == 2u ) { hairy = d.y > 0.36 - 0.6 * smoothstep( - 0.4, 0.4, d.z ) || ( d.z > 0.6 && d.y > - 0.4 && ax < 0.25 ); }
		if ( hairStyle == 3u ) { hairy = d.y > - 0.35 && d.y < 0.2 + 0.15 * smoothstep( 0.2, 0.8, d.z ) && d.z > - 0.15; rough = select( rough, 0.3, d.y > 0.2 ); }
		if ( hairy ) { c = hairC; rough = 0.7; }
		// ---- FW6 (C4W-6): the hair on the head in strands too, combed back from the face and down the
		// sides, the light breaking along them (it was one flat colour: a helmet)
		if ( hairy && hairStyle != 3u ) {
			let ha = atan2( d.x, - d.z ) * select( 1.0, 0.6, hairStyle == 1u );
			let hs = sin( ha * 38.0 + d.y * 6.0 + 2.0 * sin( ha * 7.0 + seed * 9.0 ) );
			c *= 0.86 + 0.14 * hs;
			s.normal = normalize( s.normal + 0.12 * hs * normalize( vec3f( cos( ha ), 0.0, sin( ha ) ) ) * near );
		}
		// ---- end FW6
		// hats: a cap (the white P on the red one), a knit hat (a folded cuff, ribs, the Phillies' white
		// band), a hood round the face
		var capC = select( select( vec3f( 0.014, 0.02, 0.06 ), vec3f( 0.33, 0.015, 0.02 ), hat == ${ HAT.capRed }u || hat == ${ HAT.capBack }u ), vec3f( 0.12, 0.018, 0.026 ), hat == ${ HAT.cap1980 }u );
		if ( hat == ${ HAT.capRays }u ) { capC = vec3f( 0.012, 0.025, 0.08 ); }
		if ( hat == ${ HAT.capBlack }u || hat == ${ HAT.capWS }u ) { capC = vec3f( 0.012 ); }
		if ( hat == ${ HAT.capWhite }u ) { capC = vec3f( 0.7, 0.69, 0.66 ); }
		if ( hat == ${ HAT.police }u ) { capC = vec3f( 0.01, 0.012, 0.03 ); }
		// ---- R (rituals): the motor helmet
		let motor = hat == ${ HAT.motor }u;
		if ( motor ) { capC = vec3f( 0.74, 0.74, 0.72 ); }
		// ---- end R
		let capped = ${ any( 'hat', capHats ) };
		// (FP1: down to the crown's band, capRim: just above the brows, the tops of the ears, low behind)
		let capFront = select( - d.z, d.z, hat == ${ HAT.capBack }u ) / max( length( d.xz ), 0.001 );
		// ---- FW4: a cap turned round sits up on the forehead, its back's band over the brows (its low back
		// edge came round over the eyes: a blindfold)
		let capY = select( ${ capRim( 0 ).toFixed( 3 ) } + 0.225 * capFront, max( ${ capRim( 0 ).toFixed( 3 ) } + 0.225 * capFront, 0.36 * smoothstep( 0.1, - 0.45, d.z ) ), hat == ${ HAT.capBack }u );
		if ( capped && ( d.y > capY || ( motor && d.y > - 0.05 && d.z > - 0.55 ) ) ) {
			c = capC; rough = select( 0.8, 0.18, motor );
			// the logo on the front panel (the back, turned round)
			let lz = select( d.z, - d.z, hat == ${ HAT.capBack }u );
			let lp = vec2f( select( d.x, - d.x, hat == ${ HAT.capBack }u ) / 0.28, ( d.y - 0.68 ) / 0.28 );
			if ( lz < - 0.55 && length( lp ) < 1.0 && hat != ${ HAT.police }u && ! motor ) {
				// a letter P: its stem on the figure's right (the viewer's left), the bowl beside it (CP-5:
				// it read as a q from the front); the WS cap's gold mark
				let stem = abs( lp.x - 0.25 ) < 0.13 && abs( lp.y ) < 0.7;
				let bowl = abs( length( ( lp - vec2f( - 0.05, 0.3 ) ) * vec2f( 1.0, 1.3 ) ) - 0.32 ) < 0.11 && lp.x < 0.25;
				if ( stem || bowl ) { c = select( select( vec3f( 0.75 ), vec3f( 0.32, 0.02, 0.03 ), hat == ${ HAT.capNavy }u || hat == ${ HAT.capWhite }u ), vec3f( 0.6, 0.62, 0.66 ), hat == ${ HAT.capRays }u ); }
				if ( hat == ${ HAT.capWS }u && ( stem || bowl || abs( lp.y + 0.55 ) < 0.08 ) ) { c = vec3f( 0.7, 0.55, 0.15 ); metal = 0.3; }
			}
			// a police cap: the badge over the peak, the black band round the crown, its crown glossy
			if ( hat == ${ HAT.police }u ) {
				if ( d.z < - 0.6 && abs( d.x ) < 0.13 && abs( d.y - 0.5 ) < 0.12 ) { c = vec3f( 0.62, 0.5, 0.22 ); metal = 0.8; rough = 0.3; }
				if ( d.y < 0.42 ) { c = vec3f( 0.006 ); rough = 0.3; }
			}
			if ( abs( fract( atan2( d.x, d.z ) * 0.955 ) - 0.5 ) > 0.485 && hat != ${ HAT.police }u && ! motor ) { c *= 0.7; }
		}
		// ---- FW6 (C4W-10): a brim shades the face from the band down to the nose (the eyes in its shade,
		// as every capped face under the concourse's lights is); under the chin the head's own shade
		let brimmed = ( ${ any( 'hat', brimHats ) } ) && hat != ${ HAT.capBack }u && ! motor;
		if ( brimmed ) {
			let rim = select( 0.36, capY, capped );
			headAO *= 1.0 - 0.42 * smoothstep( - 0.32, rim, d.y ) * step( d.y, rim + 0.02 ) * smoothstep( - 0.1, - 0.5, d.z );
		}
		headAO *= 1.0 - 0.35 * smoothstep( - 0.6, - 0.85, d.y ) * smoothstep( 0.3, - 0.2, d.z );
		// ---- end FW6
		if ( hat == ${ HAT.cabbie }u && d.y > 0.3 - 0.1 * smoothstep( - 0.2, 0.6, d.z ) ) {
			// a tweed flat cap: the herringbone's weave
			c = mix( vec3f( 0.14, 0.11, 0.08 ), vec3f( 0.22, 0.19, 0.15 ), step( 0.5, fract( ( d.x + abs( fract( d.y * 6.0 ) - 0.5 ) * 0.3 ) * 28.0 ) ) );
			rough = 0.95;
		}
		if ( hat == ${ HAT.visor }u && d.y > 0.18 && d.y < 0.34 ) { c = vec3f( 0.33, 0.015, 0.02 ); }
		let knit = ${ any( 'hat', knitHats ) };
		// ---- FW6 (C4W-2): from its edge (c3KnitEdge), the cuff a band 0.13 over it with the crease of its
		// fold at the top, the ribs all round; the bands and the P placed from the edge, not the eyes
		let kRel = d.y - c3KnitEdge( d );
		headAO *= select( 1.0, 1.0 - 0.22 * smoothstep( - 0.12, 0.0, kRel ) * smoothstep( - 0.1, - 0.5, d.z ), knit && kRel < 0.0 );
		if ( knit && kRel > 0.0 ) {
			// ---- FP2 (C2B-16): the plain ones navy, cream, charcoal, a woman's pink (Getty 83485455), not a
			// blend between navy and cream; the Phillies' red one in three kinds (kv), not one repeated row
			// after row: the cuffed one with the white P on the cuff and no pom-pom, the white band and white
			// pom-pom, the cuff striped white under a red pom-pom
			let kp = fract( seed * 41.3 );
			let kv = fract( seed * 29.7 );
			let plain = select( select( select( vec3f( 0.014, 0.02, 0.06 ), vec3f( 0.5, 0.47, 0.4 ), kp > 0.45 ), vec3f( 0.06, 0.06, 0.065 ), kp > 0.75 ), vec3f( 0.62, 0.3, 0.4 ), kp > 0.86 && female );
			var kc = select( select( select( vec3f( 0.3, 0.29, 0.26 ), vec3f( 0.026 ), hat == ${ HAT.knitBlack }u ), vec3f( 0.32, 0.018, 0.025 ), hat == ${ HAT.knitRed }u ), plain, hat == ${ HAT.knitPlain }u );
			let rib = 0.88 + 0.12 * sin( atan2( d.x, d.z ) * 40.0 );
			c = kc * rib;
			let cuffB = kRel < 0.13;
			if ( cuffB ) { c = kc * 0.82 * rib; }
			// (the fold's crease at the cuff's top, and its rolled lower edge, in shade)
			headAO *= 1.0 - 0.3 * smoothstep( 0.025, 0.0, abs( kRel - 0.13 ) ) - 0.15 * smoothstep( 0.02, 0.0, kRel );
			if ( hat == ${ HAT.knitRed }u ) {
				if ( kv < 0.4 ) {
					// (the white P on the red over a royal-blue cuff, Getty 83893023)
					if ( cuffB ) { c = vec3f( 0.025, 0.045, 0.2 ) * rib; }
					let lp = vec2f( d.x / 0.2, ( kRel - 0.27 ) / 0.13 );
					let stem = abs( lp.x - 0.25 ) < 0.14 && abs( lp.y ) < 0.8;
					let bowl = abs( length( ( lp - vec2f( - 0.05, 0.32 ) ) * vec2f( 1.0, 1.3 ) ) - 0.32 ) < 0.13 && lp.x < 0.25;
					if ( d.z < - 0.6 && ( stem || bowl ) ) { c = vec3f( 0.62, 0.6, 0.55 ); }
				} else if ( kv < 0.7 ) {
					if ( abs( kRel - 0.22 ) < 0.055 ) { c = vec3f( 0.62, 0.6, 0.55 ); }
				} else if ( abs( kRel - 0.035 ) < 0.025 || abs( kRel - 0.095 ) < 0.025 ) { c = vec3f( 0.62, 0.6, 0.55 ); }
			}
			// ---- end FP2
			rough = 0.97;
		}
		if ( hat == ${ HAT.earmuffs }u && ax > 0.78 && abs( d.y ) < 0.35 && abs( d.z ) < 0.4 ) { c = vec3f( 0.3, 0.02, 0.03 ); rough = 1.0; }
		if ( hat == ${ HAT.hood }u || ( poncho > 0u && g.x > 0.35 ) ) {
			let oval = length( vec2f( d.x * 1.05, ( d.y + 0.08 ) * 0.92 ) );
			// ---- FP1 (CP-6, CP-9): a clear poncho's hood shows the hair and the cap under its film; a
			// cloth hood is matte and soaks dark in the rain (WET_FABRIC's way, not a gloss)
			// ---- FW4 (C3W-4, C3W-5): a poncho's hood crumpled as the poncho is; the clear one a haze over the
			// hair and the cap (it was the hair lacquered: a black glossy helmet)
			var hoodCr = vec4f( 0.0 );
			if ( poncho > 0u && ( d.z > - 0.35 || oval > 0.72 ) ) {
				hoodCr = filmCrumple( L * 1.2, length( fwidth( L ) ) );
				s.normal = filmTilt( s.normal, hoodCr.xyz );
			}
			if ( poncho == 1u || poncho == 7u ) {
				c = mix( c * 0.7, vec3f( 0.44, 0.46, 0.5 ), select( 0.0, 0.22 + 0.12 * hoodCr.w, d.z > - 0.35 || oval > 0.72 ) );
				rough = 0.2;
			// ---- end FW4
			} else if ( d.z > - 0.35 || oval > 0.72 ) {
				c = select( topC, select( vec3f( 0.6 ), vec3f( 0.36, 0.02, 0.03 ), poncho == 2u ), poncho > 0u );
				if ( poncho == 4u ) { c = vec3f( 0.65, 0.5, 0.03 ); }
				if ( poncho == 5u ) { c = vec3f( 0.62, 0.2, 0.02 ); }
				if ( poncho == 6u ) { c = vec3f( 0.15, 0.155, 0.16 ); }
				c *= select( 1.0, 0.55, oval < 0.85 && d.z < - 0.2 ) * select( 1.0, 0.92 + 0.12 * hoodCr.w, poncho > 0u );
				rough = select( 0.88, 0.26, poncho > 0u );
			}
			// ---- end FP1
		}
	}
	if ( part == ${ PART.hairCard }u ) {
		// (FP2: its strands, darker in among them and toward the ends)
		let hl = L - ${ f3( J.head ) };
		// (FW6, C4W-6: the strands broken and uneven, not a corrugated sheet; lighter at the ends where the
		// light gets through them and at the crown, darker in among the locks)
		let sa0 = atan2( hl.x, hl.z );
		let sw = sa0 + 0.08 * sin( sa0 * 9.0 + hl.y * 23.0 + seed * 40.0 );
		c = hairC * ( 0.8 + 0.2 * sin( sw * 70.0 + hl.y * 30.0 + 2.0 * sin( sw * 13.0 ) ) ) * mix( 1.0, 0.8, smoothstep( - 0.05, - 0.2, hl.y ) );
		c *= mix( 1.0, 1.3, smoothstep( - 0.17, - 0.29, hl.y ) ) * mix( 1.0, 1.15, smoothstep( 0.05, 0.1, hl.y ) );
		c *= 0.82 + 0.18 * smoothstep( - 0.5, 0.5, sin( sw * 11.0 + seed * 17.0 ) );
		rough = 0.7;
		// ---- FW4 (C3W-12): the strands lit as strands: the normal turned across them by locks of a few
		// centimetres and finer, so the light breaks along them (it lay on the shell as on a board)
		let sa = sw;
		let st = 0.24 * sin( sa * 11.0 + hl.y * 7.0 + seed * 17.0 ) + 0.12 * sin( sa * 37.0 - hl.y * 14.0 + 1.7 * sin( sa * 5.0 ) ) + 0.06 * sin( sa * 97.0 + hl.y * 30.0 );
		s.normal = normalize( s.normal + st * vec3f( cos( sa ), 0.0, - sin( sa ) ) );
		rough = 0.62;
		// ---- end FW4
	}
	// ---- FP1 (CP-1, CP-5): a cap's crown: the cloth, the six panels' seams and the button, the P the
	// right way round on the front panels (the back, on a cap turned round)
	if ( part == ${ PART.crown }u ) {
		let d = ( L - ${ f3( J.head ) } ) / vec3f( ${ HEAD_R.map( ( r ) => r.toFixed( 3 ) ).join( ', ' ) } );
		let back = hat == ${ HAT.capBack }u;
		var cc = select( select( vec3f( 0.014, 0.02, 0.06 ), vec3f( 0.33, 0.015, 0.02 ), hat == ${ HAT.capRed }u || back ), vec3f( 0.12, 0.018, 0.026 ), hat == ${ HAT.cap1980 }u );
		if ( hat == ${ HAT.capRays }u ) { cc = vec3f( 0.012, 0.025, 0.08 ); }
		if ( hat == ${ HAT.capBlack }u || hat == ${ HAT.capWS }u ) { cc = vec3f( 0.012 ); }
		if ( hat == ${ HAT.capWhite }u ) { cc = vec3f( 0.7, 0.69, 0.66 ); }
		c = cc; rough = 0.8;
		let lx = select( d.x, - d.x, back );
		let lz = select( d.z, - d.z, back );
		if ( abs( fract( atan2( lx, - lz ) * 0.955 + 0.5 ) - 0.5 ) < 0.03 ) { c *= 0.7; }
		if ( d.y > 1.1 && length( d.xz ) < 0.12 ) { c *= 0.8; }
		if ( lz < - 0.55 ) {
			let lp = vec2f( lx / 0.26, ( d.y - 0.72 ) / 0.26 );
			let a = 1.0 - smoothstep( 0.1, 0.3, fwidth( lp.x ) + fwidth( lp.y ) );
			let stem = abs( lp.x - 0.25 ) < 0.12 && abs( lp.y ) < 0.75;
			let bowl = abs( length( ( lp - vec2f( - 0.05, 0.3 ) ) * vec2f( 1.0, 1.3 ) ) - 0.32 ) < 0.11 && lp.x < 0.25;
			if ( stem || bowl ) { c = mix( c, select( select( vec3f( 0.75 ), vec3f( 0.32, 0.02, 0.03 ), hat == ${ HAT.capNavy }u || hat == ${ HAT.capWhite }u ), vec3f( 0.6, 0.62, 0.66 ), hat == ${ HAT.capRays }u ), a ); }
			if ( hat == ${ HAT.capWS }u && ( stem || bowl || abs( lp.y + 0.55 ) < 0.08 ) ) { c = vec3f( 0.7, 0.55, 0.15 ); metal = 0.3; }
		}
	}
	// ---- end FP1
	if ( part == ${ PART.brim }u ) {
		c = select( select( vec3f( 0.014, 0.02, 0.06 ), vec3f( 0.33, 0.015, 0.02 ), hat == ${ HAT.capRed }u || hat == ${ HAT.capBack }u || hat == ${ HAT.visor }u ), vec3f( 0.12, 0.018, 0.026 ), hat == ${ HAT.cap1980 }u );
		if ( hat == ${ HAT.capRays }u ) { c = vec3f( 0.012, 0.025, 0.08 ); }
		if ( hat == ${ HAT.capBlack }u || hat == ${ HAT.capWS }u ) { c = vec3f( 0.012 ); }
		if ( hat == ${ HAT.capWhite }u ) { c = vec3f( 0.7, 0.69, 0.66 ); }
		if ( hat == ${ HAT.cabbie }u ) { c = vec3f( 0.16, 0.13, 0.1 ); }
		rough = 0.8;
		// the police cap's patent-leather peak
		if ( hat == ${ HAT.police }u ) { c = vec3f( 0.006 ); rough = 0.12; }
		// ---- R (rituals): the motor helmet's short black peak
		if ( hat == ${ HAT.motor }u ) { c = vec3f( 0.008 ); rough = 0.2; }
		// ---- end R
		// ---- FP1: its underside in shade, a grey-green under the cloth's colour (not a black slab), and
		// cloth, not the wet gloss that made a mirror of it across the face (CP-9)
		if ( in.N.y < - 0.25 && hat != ${ HAT.police }u && hat != ${ HAT.motor }u ) { c = mix( c * 0.5, vec3f( 0.06, 0.07, 0.06 ), 0.45 ); e = c * 0.25; }
		// ---- end FP1
	}
	if ( part == ${ PART.pompom }u ) {
		c = select( vec3f( 0.32, 0.29, 0.26 ), vec3f( 0.62, 0.6, 0.56 ), hat == ${ HAT.knitRed }u ); rough = 1.0;
		// (FW6: yarn's fuzz, the normal broken up and the inside darker)
		let pf = sin( L.x * 900.0 + L.y * 370.0 ) * sin( L.z * 830.0 - L.y * 510.0 );
		s.normal = normalize( s.normal + 0.35 * pf * normalize( vec3f( sin( L.y * 700.0 ), cos( L.x * 650.0 ), sin( L.z * 610.0 ) ) ) );
		c *= 0.85 + 0.15 * pf;
		// ---- FP2: the striped one's pom-pom is red
		if ( hat == ${ HAT.knitRed }u && fract( seed * 29.7 ) >= 0.7 ) { c = vec3f( 0.34, 0.02, 0.03 ); }
	}
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
	// ---- FW6 (C4W-4): a poncho wearer's sleeves are the film over the arm (the jacket's sleeve under it)
	let filmSleeve = part == ${ PART.sleeve }u && poncho > 0u && poncho < 7u;
	if ( filmSleeve ) { printA = 0.0; }
	if ( part == ${ PART.poncho }u || filmSleeve ) {
		if ( poncho == 0u ) {
			// a long coat's skirt: the coat's own cloth, open down the front
			c = topC * select( 1.0, 0.8, L.z < - 0.1 && abs( L.x ) < 0.025 );
			rough = select( 0.95, 0.25, top == ${ TOP.raincoat }u );
			if ( top == ${ TOP.raincoat }u && abs( L.y - 0.75 ) < 0.02 ) { c = vec3f( 0.75, 0.75, 0.7 ); e = vec3f( 0.3, 0.3, 0.25 ) * nk; }
		} else {
			// the poncho: clear plastic over the jacket (the jacket dulled through it), or red, white or
			// yellow; wet on the 27th, and creased
			// ---- FW4 (C3W-5): crumpled film (filmCrumple), the normal tilted with its facets: the clear
			// ones a silvery haze over the jacket, whiter in the creases and edge on; the white ones a milky
			// film with the jacket faint under it (a sheet, a ghost); the trash bag grey and dull, crinkled
			// big (a black balloon)
			// ---- FW6 (C4W-4): the clear film nearly invisible but for its creases and its edges: the jacket
			// under it at 0.9 (it was 0.72 under a 20% grey: an opaque grey shell), the folds' tilt halved and
			// their size each poncho's own (it was an even hammered dimpling, grey metal)
			let cr = filmCrumple( L * select( 0.8 + 0.45 * g.z, 0.7, poncho == 6u ), length( fwidth( L ) ) );
			s.normal = filmTilt( s.normal, cr.xyz * select( 0.22, 0.8, poncho > 1u ) );
			let fres = pow( 1.0 - abs( dot( s.normal, normalize( in.V ) ) ), 2.0 );
			let under = select( topC, c, filmSleeve ) * 0.9;
			let haze = vec3f( 0.44, 0.46, 0.5 );
			var pc = mix( under, haze, 0.08 + 0.06 * cr.w + 0.3 * fres );
			// ---- end FW6
			let lit = 0.96 + 0.06 * cr.w;
			if ( poncho == 2u ) { pc = vec3f( 0.36, 0.02, 0.03 ) * lit; }
			if ( poncho == 3u ) { pc = mix( under, vec3f( 0.56, 0.57, 0.58 ), 0.42 + 0.06 * cr.w + 0.2 * fres ); }
			if ( poncho == 4u ) { pc = vec3f( 0.65, 0.5, 0.03 ) * lit; }
			if ( poncho == 5u ) { pc = vec3f( 0.62, 0.2, 0.02 ) * lit; }
			if ( poncho == 7u ) { pc = mix( topC * 0.8, haze, 0.12 + 0.04 * cr.w + 0.32 * fres ); }
			if ( poncho == 6u ) { pc = vec3f( 0.15, 0.155, 0.16 ) * ( 0.9 + 0.15 * cr.w ); }
			c = pc;
			rough = select( select( 0.24, 0.2, poncho == 1u || poncho == 7u || poncho == 3u ), 0.45, poncho == 6u );
			// the clear film shows the jacket's print through it
			if ( poncho == 1u ) { c = mix( c, printC * 0.8, printA * 0.5 ); }
			// ---- end FW4
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
			// ---- FW6 (C4W-15): a 20 oz clear cup (dottcom 2931484933): the lager pale gold, lighter edge on
			// where the light comes through it; a white head of foam under a band of empty clear plastic and
			// the rolled rim's bright line (it was an opaque saturated tube with a cream lid)
			let cy = pl.y - ${ ( J.hand[ 1 ] - 0.06 ).toFixed( 3 ) };
			let edge = pow( 1.0 - abs( dot( normalize( in.N ), normalize( in.V ) ) ), 1.5 );
			c = mix( vec3f( 0.5, 0.31, 0.05 ), vec3f( 0.78, 0.6, 0.2 ), 0.55 * edge );
			e = vec3f( 0.25, 0.17, 0.04 ) * edge * 0.25;
			rough = 0.08;
			if ( cy > 0.11 ) { c = vec3f( 0.74, 0.72, 0.64 ); rough = 0.85; e = vec3f( 0.0 ); }
			if ( cy > 0.135 ) { c = mix( vec3f( 0.74, 0.72, 0.64 ) * 0.7, vec3f( 0.8 ), edge ); rough = 0.06; }
			if ( cy > 0.146 ) { c = vec3f( 0.85 ); rough = 0.2; }
			if ( in.N.y > 0.7 ) { c = vec3f( 0.75, 0.72, 0.62 ); rough = 0.9; e = vec3f( 0.0 ); }
			// ---- end FW6
		}
		if ( id == ${ PROP.soda }u ) { c = select( vec3f( 0.7, 0.68, 0.64 ), vec3f( 0.45, 0.03, 0.03 ), fract( pl.y / 0.05 ) < 0.45 ); rough = 0.5; }
		if ( id == ${ PROP.cocoa }u ) {
			// a white paper cup, a brown sleeve, a black lid
			c = vec3f( 0.72, 0.7, 0.66 );
			if ( abs( pl.y - 0.785 ) < 0.022 ) { c = vec3f( 0.2, 0.11, 0.05 ); }
			if ( pl.y > 0.848 ) { c = vec3f( 0.02 ); }
		}
		if ( id == ${ PROP.waterIce }u ) { c = select( vec3f( 0.7, 0.68, 0.64 ), select( vec3f( 0.55, 0.03, 0.05 ), vec3f( 0.6, 0.5, 0.05 ), g.y > 0.6 ), in.N.y > 0.3 ); }
		if ( id == ${ PROP.cottonCandy }u ) {
			// (FW1, C2W-20: the floss bunched and wispy, lit through, not a solid ball)
			let floss = 0.78 + 0.22 * sin( pl.x * 140.0 + sin( pl.y * 90.0 ) * 2.0 ) * sin( pl.z * 120.0 + pl.y * 60.0 );
			c = select( vec3f( 0.7 ), select( vec3f( 0.8, 0.36, 0.5 ), vec3f( 0.32, 0.52, 0.8 ), g.z > 0.6 ) * floss, pl.y > 0.93 ); rough = 1.0; e = c * 0.12;
		}
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
		if ( id == ${ PROP.scorebook }u ) {
			// (the scorebook's cover: cream card, a red band, the ruled grid showing at its edge)
			c = vec3f( 0.7, 0.68, 0.6 ); rough = 0.7;
			let by = pl.y - ${ ( J.hand[ 1 ] - 0.1 ).toFixed( 3 ) };
			if ( by > 0.08 && by < 0.11 ) { c = vec3f( 0.36, 0.03, 0.04 ); }
			if ( by < 0.06 && abs( fract( by * 60.0 ) - 0.5 ) < 0.08 ) { c *= 0.8; }
		}
		if ( id == ${ PROP.phone }u ) {
			// ---- FW1 (C2W-20): a flip phone: the dark body, a silver hinge, the small screen lit on its inner
			// face (it was a card of glowing stripes)
			c = vec3f( 0.025, 0.026, 0.03 ); metal = 0.4; rough = 0.35;
			let py = pl.y - ${ ( J.hand[ 1 ] - 0.05 ).toFixed( 3 ) };
			if ( abs( py ) < 0.004 ) { c = vec3f( 0.45 ); metal = 0.8; }
			if ( abs( pl.x ) < ${ ( J.hand[ 0 ] - 0.02 - 0.009 ).toFixed( 3 ) } && py > 0.008 && py < 0.04 && abs( pl.z - ${ ( J.hand[ 2 ] - 0.03 ).toFixed( 3 ) } ) < 0.016 ) { c = vec3f( 0.05, 0.08, 0.1 ); e = vec3f( 0.35, 0.5, 0.7 ) * 0.9; rough = 0.1; }
		}
		if ( id == ${ PROP.glove }u ) { c = vec3f( 0.3, 0.14, 0.05 ); rough = 0.6; }
		if ( id == ${ PROP.towel }u ) {
			// the 2008 rally towel (zackhample's from Game 4): white terry, one big red square over most of
			// it with "Fightin' Phils" across it in white, the World Series mark under it. (FP2, C2B-16: the
			// square was repeated down and across the cloth, so a towel read as red and white bars)
			c = vec3f( 0.78, 0.77, 0.73 ); rough = 1.0;
			let tv = ( ${ J.hand[ 1 ].toFixed( 3 ) } - pl.y ) / 0.4;
			let tu = ( pl.z - ${ J.hand[ 2 ].toFixed( 3 ) } ) / ( 0.286 * ( 0.35 + 0.65 * min( 1.0, max( tv, 0.0 ) * 2.5 ) ) ) + 0.769;
			if ( abs( tu - 0.5 ) < 0.36 && tv > 0.14 && tv < 0.72 ) {
				c = vec3f( 0.4, 0.02, 0.03 );
				let onLine = abs( tv - 0.3 ) < 0.055 || abs( tv - 0.5 ) < 0.065;
				if ( onLine && abs( tu - 0.5 ) < 0.27 && fract( tu * 9.0 + tv * 2.0 ) < 0.62 ) { c = vec3f( 0.78, 0.77, 0.73 ); }
			}
			if ( abs( tv - 0.82 ) < 0.025 && abs( tu - 0.5 ) < 0.3 ) { c = vec3f( 0.04, 0.06, 0.22 ); }
			// whirled, the square smears into the white: a pink and white blur (the photos), not a flag
			let whirl = clamp( ( in.vs.vVar - 300.0 ) / 99.0, 0.0, 1.0 );
			c = mix( c, mix( vec3f( 0.8, 0.79, 0.76 ), c, 0.3 ), whirl );
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
		// ---- R (rituals): the press's gear: black bodies; Canon's white zoom with its red ring (or a black
		// one); the flash firing now and then (the last out's flashes); the TV camera's grey, its red tally;
		// the boom's grey pole and the windscreen's grey fur
		if ( id == ${ PROP.slr }u ) {
			c = vec3f( 0.018 ); rough = 0.45;
			if ( pl.z < ${ ( J.hand[ 2 ] - 0.07 ).toFixed( 3 ) } ) {
				c = select( vec3f( 0.72, 0.71, 0.66 ), vec3f( 0.02 ), pv == 1u ); rough = 0.35;
				if ( abs( pl.z - ${ ( J.hand[ 2 ] - 0.32 ).toFixed( 3 ) } ) < 0.006 && pv == 0u ) { c = vec3f( 0.45, 0.02, 0.02 ); }
				if ( pl.z < ${ ( J.hand[ 2 ] - 0.34 ).toFixed( 3 ) } ) { c = vec3f( 0.015 ); }
			}
			if ( pl.y > ${ ( J.hand[ 1 ] + 0.07 ).toFixed( 3 ) } ) {
				c = vec3f( 0.02 );
				if ( pl.z < ${ ( J.hand[ 2 ] - 0.04 ).toFixed( 3 ) } && fract( frame.time * 0.7 + g.x * 23.0 + g.y * 7.0 ) > 0.955 ) { e = vec3f( 60.0 ); }
			}
		}
		if ( id == ${ PROP.eng }u ) {
			c = select( vec3f( 0.06, 0.062, 0.066 ), vec3f( 0.015 ), pl.z < ${ ( J.hand[ 2 ] - 0.1 ).toFixed( 3 ) } ); metal = 0.3; rough = 0.4;
			if ( pl.z < ${ ( J.hand[ 2 ] - 0.08 ).toFixed( 3 ) } && pl.z > ${ ( J.hand[ 2 ] - 0.11 ).toFixed( 3 ) } && pl.y > ${ ( J.hand[ 1 ] + 0.14 ).toFixed( 3 ) } ) { e = vec3f( 3.0, 0.1, 0.05 ); }
		}
		if ( id == ${ PROP.boom }u ) {
			c = vec3f( 0.35, 0.35, 0.36 ); metal = 0.7; rough = 0.3;
			if ( pl.y > ${ ( J.hand[ 1 ] + 1.2 ).toFixed( 3 ) } ) { c = vec3f( 0.3, 0.3, 0.29 ) * ( 0.8 + 0.3 * fract( sin( dot( pl.xz, vec2f( 91.0, 57.0 ) ) ) * 437.0 ) ); metal = 0.0; rough = 1.0; }
		}
		// ---- end R
	}
	// ---- FW6 (C4W-1, C4W-10): the cloth's folds and the body's own shade. Under the concourse's lights the
	// arms shade the trunk's sides (deepest in the armpits), the crook of the elbow and the arm's inside are
	// dark, the head shades the neck, a cap's brim the eyes; and the cloth isn't one even panel: drag lines
	// from the armpits across the chest and the back, the jacket bunched above its hem and fanning round it,
	// rings at the elbow, the cuff rucked at the wrist, a puffer's quilting puffed, a jersey hanging in
	// long folds, a hoodie's softer and bigger, each his own (the seed). Every figure was lit as one flat
	// colour per part: a box and two slabs (hcwoodward 2983666367, auds 2988587598: the folds and the shade
	// at arm's length). The folds are a height (m) turned into the normal from the screen's derivatives,
	// faded out where a pixel spans one
	var ao = 1.0;
	var fh = 0.0;
	let fk = 1.0 - smoothstep( 0.0035, 0.012, length( fwidth( L ) ) );
	let fax = abs( L.x );
	let fph = g.x * 6.2832;
	let fold = select( select( select( 1.0, 1.45, top == ${ TOP.hoodie }u || top == ${ TOP.fleece }u ), 0.6, top == ${ TOP.leather }u || top == ${ TOP.coat }u || top == ${ TOP.trooper }u ), 0.5, top == ${ TOP.puffer }u );
	if ( part == ${ PART.torso }u ) {
		let sideA = smoothstep( 0.105, 0.17, fax ) * smoothstep( 0.86, 1.0, L.y ) * smoothstep( 1.42, 1.32, L.y );
		let pit = smoothstep( 0.135, 0.175, fax ) * smoothstep( 1.2, 1.29, L.y ) * smoothstep( 1.4, 1.33, L.y );
		ao *= 1.0 - 0.36 * sideA - 0.22 * pit;
		ao *= 1.0 - 0.2 * smoothstep( 1.43, 1.468, L.y ) * smoothstep( 0.09, 0.03, fax ) * step( L.z, 0.03 );
		ao *= 1.0 - 0.2 * smoothstep( 0.865, 0.805, L.y );
		if ( fk > 0.0 ) {
			let diag = fax * 0.85 + ( 1.36 - L.y ) + 0.25 * L.z;
			let drag = sin( diag * 58.0 + fph + 1.7 * sin( L.y * 21.0 + L.z * 9.0 + fph ) ) * smoothstep( 0.02, 0.14, fax ) * smoothstep( 1.0, 1.22, L.y ) * smoothstep( 1.39, 1.29, L.y );
			let bunch = sin( L.y * 92.0 + 2.6 * sin( L.x * 19.0 + L.z * 7.0 + fph ) + fph ) * smoothstep( 0.86, 0.93, L.y ) * smoothstep( 1.08, 0.97, L.y );
			let hemF = sin( atan2( L.x, L.z ) * 10.0 + fph + 1.5 * sin( L.y * 37.0 + fph ) ) * smoothstep( 0.93, 0.83, L.y );
			let hang = sin( L.x * 46.0 + 2.0 * sin( L.y * 9.0 + fph ) + fph ) * smoothstep( 1.26, 1.0, L.y );
			let jersey = top == ${ TOP.homeJersey }u || top == ${ TOP.roadJersey }u || top == ${ TOP.powder }u;
			fh = select( 0.0034 * drag + 0.0028 * bunch + 0.0024 * hemF, 0.0012 * drag + 0.003 * hang + 0.0018 * hemF, jersey ) * fold;
			if ( top == ${ TOP.puffer }u ) { let b = fract( L.y / 0.09 ) * 2.0 - 1.0; fh += 0.0055 * ( 1.0 - b * b ); }
		}
	}
	if ( part == ${ PART.sleeve }u ) {
		// (the bind pose: the arm hanging, its axis ~0.19-0.21 out; the inside the body's side)
		let ax0 = mix( ${ J.shoulder[ 0 ].toFixed( 3 ) }, ${ J.wrist[ 0 ].toFixed( 3 ) }, clamp( ( ${ J.shoulder[ 1 ].toFixed( 3 ) } - L.y ) / ${ ( J.shoulder[ 1 ] - J.wrist[ 1 ] ).toFixed( 3 ) }, 0.0, 1.0 ) );
		let inner = smoothstep( 0.005, - 0.035, fax - ax0 ) * smoothstep( 1.4, 1.3, L.y );
		let crook = smoothstep( 0.06, 0.0, abs( L.y - ${ ( J.elbow[ 1 ] + 0.01 ).toFixed( 3 ) } ) ) * smoothstep( ${ ( J.elbow[ 2 ] + 0.01 ).toFixed( 3 ) }, ${ ( J.elbow[ 2 ] - 0.04 ).toFixed( 3 ) }, L.z );
		ao *= ( 1.0 - 0.3 * inner ) * ( 1.0 - 0.25 * crook );
		if ( fk > 0.0 ) {
			let el = smoothstep( 0.1, 0.0, abs( L.y - ${ ( J.elbow[ 1 ] + 0.01 ).toFixed( 3 ) } ) );
			let rings = sin( L.y * 170.0 + 2.0 * sin( atan2( L.x - sign( L.x ) * ax0, L.z ) * 2.0 + fph ) + fph ) * ( 0.4 + 0.6 * smoothstep( ${ ( J.elbow[ 2 ] + 0.03 ).toFixed( 3 ) }, ${ ( J.elbow[ 2 ] - 0.03 ).toFixed( 3 ) }, L.z ) );
			let cuff = sin( L.y * 210.0 + fph * 2.0 ) * smoothstep( 0.95, 0.89, L.y );
			let twist = sin( L.y * 55.0 + atan2( L.x - sign( L.x ) * ax0, L.z ) + fph ) * smoothstep( 1.3, 1.15, L.y );
			fh = ( 0.0022 * rings * el + 0.0016 * cuff + 0.0018 * twist ) * fold;
			if ( top == ${ TOP.puffer }u ) { let b = fract( L.y / 0.075 ) * 2.0 - 1.0; fh += 0.005 * ( 1.0 - b * b ); }
		}
	}
	if ( part == ${ PART.neck }u ) { ao *= 0.72; }
	if ( part == ${ PART.pants }u ) {
		ao *= 1.0 - 0.3 * smoothstep( 0.06, 0.015, fax ) * smoothstep( 0.68, 0.84, L.y );
		ao *= 1.0 - 0.28 * smoothstep( 0.74, 0.81, L.y );
		if ( fk > 0.0 ) { fh = 0.0022 * sin( L.y * 120.0 + 2.0 * sin( L.x * 40.0 + fph ) ) * ( smoothstep( 0.12, 0.0, abs( L.y - 0.5 ) ) + smoothstep( 0.2, 0.1, L.y ) ); }
	}
	if ( part == ${ PART.head }u ) { ao *= headAO; }
	if ( fh != 0.0 ) {
		let dPx = dpdx( in.P );
		let dPy = dpdy( in.P );
		let r1 = cross( dPy, s.normal );
		let r2 = cross( s.normal, dPx );
		let det = dot( dPx, r1 );
		let gr = sign( det ) * ( dpdx( fh ) * r1 + dpdy( fh ) * r2 ) * fk;
		s.normal = normalize( abs( det ) * s.normal - gr );
	}
	c *= mix( 1.0, ao, 0.75 );
	s.ao = ao;
	// ---- end FW6
	// the rain on them: shoulders, caps and hoods darker and glossy on the 27th
	let wetK = frame.wet * smoothstep( 0.2, 0.8, normalize( in.N ).y ) * select( 0.6, 1.0, part == ${ PART.poncho }u || part == 32u + ${ PROP.umbrella }u ) * select( 1.0, 0.0, ( ( lk.w >> 16u ) & 1u ) == 1u ) * select( 1.0 - 0.75 * in.vs.vPose.w, 1.0, part == 32u + ${ PROP.umbrella }u );
	// ---- FW1 (C2W-19): each by what it is: cloth (a cotton cap, a knit hat, a hoodie) soaks darker and stays
	// matte; a nylon shell goes darker and satin; plastic and vinyl (the ponchos, an umbrella) bead up and
	// shine; skin takes a thin sheen. (Every one of them went to 0.25: the caps and jackets like vinyl)
	let cloth = smoothstep( 0.55, 0.7, rough );
	let slick = 1.0 - smoothstep( 0.22, 0.32, rough );
	c *= mix( 1.0, mix( 0.86, 0.72, cloth ), wetK * ( 1.0 - slick ) );
	rough = mix( rough, mix( mix( 0.36, max( rough - 0.12, 0.62 ), cloth ), rough * 0.55, slick ), wetK );
	// ---- end FW1
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
// ---- FW4: taller than this (250 px of 800): the near figure's full detail (the modelled face, the
// ears, the limbs on 12 sides); between NEAR_FRAC and this, the middle one (SP2's 112-250 px)
const FULL_FRAC = 0.31;
const H = 1.75; // the figure's height
const _vp = new Matrix4(), _frustum = new Frustum(), _m = new Matrix4(), _inv = new Matrix4(), _cam = new Vector3();
let POOL = null;

class Pool {

	constructor() {

		this.troupes = [];
		this.people = [];
		this.cap = 0;
		this.hidden = false;
		this.stats = { people: 0, drawn: 0, near: 0, mid: 0, far: 0, tiny: 0, culled: 0 };
		this.pal = palette();
		this.palBuf = new StorageBuffer( { label: 'castPalette', count: PAL.size, type: 'vec4f', data: this.pal } );
		this._grow( 256 );
		this.atlas = drawAtlas();
		this.signTex = drawSigns();
		this._signsDrawn = SIGNS.length;
		this.material = castMaterial( this );
		this.blobMat = blobMaterial( this );
		this.geometry = [ figureGeometry( 0 ), figureGeometry( 1 ), figureGeometry( 2 ), figureGeometry( 3 ) ];
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

		this.meshes = [ make( this.geometry[ 0 ], this.material, 'cast', 0 ), make( this.geometry[ 1 ], this.material, 'cast-far', 1 ), make( this.geometry[ 2 ], this.material, 'cast-distant', 2 ),
			make( this.geometry[ 3 ], this.material, 'cast-mid', 3 ) ];
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

		// the order: [ the contact shadows | the near | the far | the distant | (FW4) the middle ], cap slots each
		this.order = new Uint32Array( cap * 5 );
		// two buffers of poses, turn about: this frame's, and last frame's (the previous poses, for the
		// motion vectors, without uploading them again)
		this._bufs = [ 0, 1 ].map( ( i ) => new StorageBuffer( { label: 'castPose' + i, count: cap * POSE, type: 'vec4f' } ) );
		this._cur = 0;
		this.lookBuf = new StorageBuffer( { label: 'castLooks', count: cap, type: 'vec4u' } );
		this.orderBuf = new StorageBuffer( { label: 'castOrder', count: cap * 5, type: 'u32' } );
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
		// (---- H: the lists kept from frame to frame, emptied, not made anew)
		const near = this._near ||= [], nearD = this._nearD ||= [], fresh = this._fresh ||= [];
		near.length = 0; nearD.length = 0; fresh.length = 0;
		let nBlob = 0, nFar = 0, nTiny = 0, nMid = 0, culled = 0, drawn = 0, lo = Infinity, hi = - 1;
		const hidden = this.hidden;
		const inv = _inv.copy( G.matrixWorld ).invert();
		const gone = _gone;
		// ---- FW6 (C4W-5): the camera in the field frame (people step aside from it)
		const IE = inv.elements;
		const fcx = IE[ 0 ] * cx + IE[ 4 ] * cy + IE[ 8 ] * cz + IE[ 12 ], fcy = IE[ 1 ] * cx + IE[ 5 ] * cy + IE[ 9 ] * cz + IE[ 13 ], fcz = IE[ 2 ] * cx + IE[ 6 ] * cy + IE[ 10 ] * cz + IE[ 14 ];
		// (only for the walker's eye, which marks the pool each step it takes: a TV camera's or a cameraman's
		// eye among the people is theirs, and they stay put)
		const walking = !! this.walkerSeen;
		this.walkerSeen = false;
		// ---- end FW6

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

				// ---- FW6 (C4W-5): people make way: within a metre of the eye (the walker's, at about head height
				// over the same floor) a person steps aside, away from it, easing there and back over a second
				// (the places' own steering doesn't know where you are: you walked through lines and the rail's
				// crowd, and the eye ended up inside heads). The walker's push reads the same offsets (_ax, _az)
				{

					const ex = x - fcx, ez = z - fcz, e2 = ex * ex + ez * ez, up = fcy - y;
					// (not one sat down: he stays in his chair or on his stool)
					const near = walking && e2 < 1.44 && up > 0.4 && up < 2.4 && a.hipL < 0.9 && a.hipR < 0.9;
					if ( near || p._ax ) {

						const e = Math.sqrt( e2 ) || 1;
						const k = near ? Math.min( 1, ( 1.2 - e ) / 0.7 ) * 0.42 : 0;
						p._ax = ( p._ax || 0 ) + ( ex / e * k - ( p._ax || 0 ) ) * 0.08;
						p._az = ( p._az || 0 ) + ( ez / e * k - ( p._az || 0 ) ) * 0.08;
						if ( Math.abs( p._ax ) + Math.abs( p._az ) < 0.002 && ! near ) p._ax = p._az = 0;
						x += p._ax; z += p._az;

					}

				}
				// ---- end FW6
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
				p.frac = frac; // ---- H: how tall they stood on the screen (Tempo.js's cadence())
				drawn ++;
				t.drawn ++;
				if ( frac > FULL_FRAC ) {

					p.lod = 0;
					near.push( sl );
					nearD.push( d );
					O[ nBlob ++ ] = sl;
					t.drawnNear ++;

				} else if ( frac > NEAR_FRAC ) {

					// ---- FW4: the middle figure (to the places, still near: p.lod 0)
					p.lod = 0;
					O[ cap * 4 + nMid ++ ] = sl;
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
		const idx = this._idx ||= [];
		idx.length = 0;
		for ( let i = 0; i < near.length; i ++ ) idx.push( i );
		idx.sort( ( i, j ) => nearD[ i ] - nearD[ j ] );
		for ( let i = 0; i < idx.length; i ++ ) O[ cap + i ] = near[ idx[ i ] ];
		const nNear = near.length;
		// (profiling: a figure left out, window.__cast.debug = { near: false })
		const D = this.debug;
		this.geometry[ 0 ].instanceCount = D && D.near === false ? 0 : nNear;
		this.geometry[ 1 ].instanceCount = D && D.far === false ? 0 : nFar;
		this.geometry[ 2 ].instanceCount = D && D.tiny === false ? 0 : nTiny;
		this.geometry[ 3 ].instanceCount = D && D.mid === false ? 0 : nMid;
		this.blobs.geometry.instanceCount = D && D.blobs === false ? 0 : nBlob;
		Object.assign( this.stats, { people: n, drawn, near: nNear, mid: nMid, far: nFar, tiny: nTiny, culled } );
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
		put( cap * 4, nMid );

	}

}

// ---- H: a troupe not drawn this frame (its place isn't, or it's out of view)
function _gone( t ) {

	for ( const p of t.list ) {

		p.lod = - 1;
		p.fresh = true;

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
	get meshMid() { return this.pool.meshes[ 3 ]; }
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
