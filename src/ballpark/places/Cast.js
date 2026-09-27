import { InstancedMesh, BufferGeometry, Float32BufferAttribute, Matrix4, PlaneGeometry, Color } from '../../engine/index.js';
import { StorageBuffer } from '../../engine/gpu/Texture.js';
import { ShaderModule } from '../../engine/gpu/Shader.js';
import { commonModule } from '../../engine/render/wgsl/common.js';
import { standard } from '../../materials/Materials.js';
import { canvasTexture } from '../geo.js';

// A cast of standing and walking people seen up close: the concourse's fans, staff and vendors. People.js
// has the far-off figures (a tube body, three morphs); these are built to be looked at from a metre or
// two: a lofted trunk with a build (slim, broad, a belly), shoulders, hands and shoes, a head with a
// nose and a painted face (the eyes, brows, lips, the cold in the cheeks and ears, beards, glasses), hair
// (short, long, a ponytail, a bald crown), a cap, a knit hat with its pom-pom or a hood up, and what
// they wear: a Phillies jacket, a hoodie, the home whites with a name and number on the back, a red
// name-and-number tee over a thermal, a puffer, a work jacket, the 1980 powder blues, a poncho over it
// all. Whatever's in their hands: a beer, a hot chocolate, a cardboard tray with a cheesesteak and fries,
// a program, a flip phone, a kid's glove, a rally towel, a bag from the team store.
//
// One instanced draw. Each person is a slot with a pose (8 vec4s: where, which way, the walk, the lean,
// the head, each arm's shoulder and elbow, the legs, what's in each hand) written every frame by the
// CPU, and a look (a vec4 of packed numbers) written once. The vertex shader rigs the figure: every
// vertex belongs to a bone (the pelvis, the spine, the head, each upper arm, forearm, thigh and shin,
// and the things held in each hand) and is turned about the joints in the chain above it; it runs
// twice (this frame's pose and last frame's) for the motion vectors. A soft contact shadow sits under
// everyone (a second instanced draw on the transparent pass).
//
//   const cast = new Cast( { parent, max } )
//   const p = cast.add( look )          p.x, p.y, p.z (field frame), p.yaw (0: facing -z); p.pose
//                                       (the angles, see POSE); p.visible
//   cast.update()                       writes the slots (call once a frame, after posing)

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
export const PART = { torso: 0, pants: 1, hand: 2, head: 3, brim: 4, pompom: 5, neck: 6, sleeve: 7, shoe: 8, poncho: 9, hairCard: 10, nose: 11, apron: 12, vest: 13 };

// What's in a hand (pose.propL / propR). Upright ones stay level whatever the arm does (a cup, a tray);
// the others turn with the hand (a program held up, a phone to the ear).
export const PROP = {
	none: 0, beer: 1, soda: 2, cocoa: 3, tray: 4, program: 5, phone: 6, glove: 7, towel: 8, bag: 9, sandwich: 10,
	scorebook: 11, cottonCandy: 12, waterIce: 13, peanuts: 14, pocket: 15, programs: 16, hotdog: 17, money: 18, beers: 19,
};
const UPRIGHT = [ PROP.beer, PROP.soda, PROP.cocoa, PROP.tray, PROP.bag, PROP.cottonCandy, PROP.waterIce, PROP.peanuts, PROP.beers ];
// which props each hand can hold (the geometry is built once per hand)
const HAND_PROPS = [
	[ PROP.beer, PROP.soda, PROP.cocoa, PROP.glove, PROP.bag, PROP.scorebook, PROP.peanuts, PROP.programs, PROP.money, PROP.hotdog ], // left
	[ PROP.beer, PROP.soda, PROP.cocoa, PROP.tray, PROP.program, PROP.phone, PROP.towel, PROP.sandwich, PROP.waterIce, PROP.cottonCandy, PROP.hotdog, PROP.money, PROP.beers ], // right
];

// the pose: 8 vec4s per person
export const POSE = 8;
// [ x, y, z, yaw ], [ scale, walk phase, walk, pelvis drop ], [ lean, twist, side lean, head yaw ],
// [ head pitch, mouth, prop left, prop right ], [ left shoulder pitch, roll, yaw, elbow ], [ right ... ],
// [ left hip pitch, knee, right hip pitch, knee ], [ legs apart, breath, blink, - ]

// The looks: numbers packed into a vec4 (exact in a float up to 2^24).
//   x: skin 0-7 | hair colour <<3 | hair style <<6 (0 short, 1 long, 2 ponytail, 3 bald) | facial <<8
//      (0 none, 1 moustache, 2 goatee, 3 beard, 4 stubble) | glasses <<11 | female <<12 | age <<13
//      (0 adult, 1 old, 2 kid, 3 teen) | build <<15 (0 slim, 1 average, 2 broad, 3 belly)
//   y: top <<0 (TOP) | its colour <<5 (COLOR) | sleeves' colour <<10 | the print on the back <<15 (the
//      atlas cell, 0 none) | the print on the chest <<21 (CHEST)
//   z: pants <<0 (0 jeans, 1 dark jeans, 2 khakis, 3 black, 4 grey sweats, 5 navy) | shoes <<3 (0 white
//      sneakers, 1 black, 2 tan boots, 3 brown, 4 grey) | hat <<6 (HAT) | poncho <<10 (0 none, 1 clear,
//      2 red, 3 white, 4 yellow, 5 orange, 6 a grey trash bag) | scarf <<13 (0 none, 1 red and white, 2 grey, 3 black) | gloves <<15
//      | hat colour <<16
//   w: a seed (0..65535) for the small things
export const TOP = {
	jacket: 0, hoodie: 1, homeJersey: 2, nameTee: 3, fleece: 4, puffer: 5, leather: 6, work: 7, powder: 8, rays: 9,
	eagles: 10, staff: 11, usher: 12, security: 13, hawker: 14, seller: 15, satin: 16, roadJersey: 17, champsTee: 18, cook: 19,
};
// the colours a top can be (the order is COLOR's)
export const COLOR = { red: 0, maroon: 1, black: 2, navy: 3, grey: 4, white: 5, charcoal: 6, royal: 7, green: 8, tan: 9, brown: 10, cream: 11, lightGrey: 12, powder: 13, yellow: 14, pink: 15, raysNavy: 16, olive: 17, purple: 18, orange: 19 };
const COLORS = [
	[ 0.34, 0.018, 0.024 ], [ 0.13, 0.02, 0.028 ], [ 0.013, 0.013, 0.015 ], [ 0.014, 0.02, 0.058 ], [ 0.2, 0.2, 0.2 ],
	[ 0.72, 0.71, 0.68 ], [ 0.07, 0.07, 0.075 ], [ 0.03, 0.07, 0.3 ], [ 0.02, 0.1, 0.07 ], [ 0.3, 0.22, 0.12 ],
	[ 0.1, 0.055, 0.03 ], [ 0.55, 0.5, 0.4 ], [ 0.42, 0.42, 0.41 ], [ 0.33, 0.5, 0.7 ], [ 0.62, 0.48, 0.03 ],
	[ 0.62, 0.25, 0.35 ], [ 0.012, 0.03, 0.09 ], [ 0.1, 0.11, 0.05 ], [ 0.12, 0.04, 0.2 ], [ 0.6, 0.18, 0.02 ],
];
export const HAT = { none: 0, capRed: 1, capNavy: 2, knitRed: 3, knitGrey: 4, knitBlack: 5, cap1980: 6, capRays: 7, hood: 8, capBack: 9, knitPlain: 10, visor: 11, capBlack: 12, earmuffs: 13 };
export const CHEST = { none: 0, script: 1, block: 2, champs: 3, rays: 4, staff: 5, security: 6, eagles: 7, redOct: 8 };

// the backs: [ name, number ] cells in the atlas (1..), then the chest prints
export const BACKS = [
	null, [ 'UTLEY', '26' ], [ 'HOWARD', '6' ], [ 'ROLLINS', '11' ], [ 'HAMELS', '35' ], [ 'VICTORINO', '8' ], [ 'BURRELL', '5' ],
	[ 'WERTH', '28' ], [ 'LIDGE', '54' ], [ 'MYERS', '39' ], [ 'FELIZ', '7' ], [ 'RUIZ', '51' ], [ 'MOYER', '50' ],
	[ 'SCHMIDT', '20' ], [ 'CARLTON', '32' ], [ 'ROSE', '14' ], [ 'BOWA', '10' ], [ 'KRUK', '29' ], [ 'DYKSTRA', '4' ],
	[ 'DAULTON', '10' ], [ 'ASHBURN', '1' ], [ 'THOME', '25' ], [ 'CRAWFORD', '13' ], [ 'LONGORIA', '3' ], [ 'MADSON', '46' ],
	[ 'BLANTON', '56' ], [ 'DOBBS', '19' ], [ 'STAIRS', '12' ], [ 'KALAS', '' ], [ 'WESTBROOK', '36' ], [ 'DAWKINS', '20' ],
];
export const BACK = Object.fromEntries( BACKS.map( ( b, i ) => [ b ? b[ 0 ] : 'NONE', i ] ) );
const CHEST_CELL = 40; // the chest prints start at this atlas cell

// ---------------------------------------------------------------- the figure's geometry

function figureGeometry() {

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

	// an upright cylinder (a cup), centre of its base c
	const cyl = ( bone, part, c, rB, rT, h, n = 8, top = true ) => {

		tube( bone, part, c, add( c, [ 0, h, 0 ] ), [ rB, rB ], [ rT, rT ], n, false, top );

	};

	// ---- the body
	// the trunk (the spine bone), a jacket's hem below the belt: rings [ y, half width, half depth, z ]
	loft( B.spine, PART.torso, [
		[ 0.83, 0.172, 0.118, 0.012 ], [ 0.95, 0.168, 0.112, 0.01 ], [ 1.06, 0.164, 0.11, 0.008 ], [ 1.17, 0.172, 0.114, 0.006 ],
		[ 1.28, 0.186, 0.118, 0.012 ], [ 1.36, 0.196, 0.108, 0.022 ], [ 1.42, 0.17, 0.085, 0.028 ], [ 1.465, 0.09, 0.062, 0.03 ],
	], 12, true, true );
	// the hips and seat (the pelvis), under the trunk's hem
	loft( B.pelvis, PART.pants, [ [ 0.74, 0.16, 0.1, 0.012 ], [ 0.86, 0.168, 0.11, 0.012 ], [ 0.97, 0.16, 0.105, 0.012 ] ], 10, true, false );
	// the neck
	tube( B.head, PART.neck, [ 0, 1.4, 0.03 ], [ 0, 1.54, 0.02 ], [ 0.052, 0.05 ], [ 0.046, 0.046 ], 8 );
	// the head, the nose, a cap's brim, a knit hat's pom-pom, long hair down the back
	ellipsoid( B.head, PART.head, J.head, HEAD_R, 14, 9 );
	{

		const h = J.head, tip = [ 0, h[ 1 ] - 0.022, h[ 2 ] - HEAD_R[ 2 ] - 0.022 ];
		const a = [ - 0.017, h[ 1 ] - 0.042, h[ 2 ] - HEAD_R[ 2 ] + 0.012 ], b = [ 0.017, h[ 1 ] - 0.042, h[ 2 ] - HEAD_R[ 2 ] + 0.012 ], t = [ 0, h[ 1 ] + 0.02, h[ 2 ] - HEAD_R[ 2 ] + 0.01 ];
		const i = [ tip, a, b, t ].map( ( p ) => vert( p, sub( p, h ), B.head, PART.nose ) );
		index.push( i[ 0 ], i[ 1 ], i[ 3 ], i[ 0 ], i[ 3 ], i[ 2 ], i[ 0 ], i[ 2 ], i[ 1 ] );

	}

	{

		const h = J.head;
		const brim = [ [ - 0.078, 0.048, - 0.055 ], [ 0.078, 0.048, - 0.055 ], [ 0.07, 0.03, - 0.17 ], [ - 0.07, 0.03, - 0.17 ], [ 0, 0.045, - 0.115 ] ].map( ( o ) => vert( add( h, o ), [ 0, 1, - 0.15 ], B.head, PART.brim ) );
		index.push( brim[ 0 ], brim[ 4 ], brim[ 1 ], brim[ 1 ], brim[ 4 ], brim[ 2 ], brim[ 2 ], brim[ 4 ], brim[ 3 ], brim[ 3 ], brim[ 4 ], brim[ 0 ] );
		ellipsoid( B.head, PART.pompom, add( h, [ 0, HEAD_R[ 1 ] + 0.04, 0.005 ] ), [ 0.034, 0.03, 0.034 ], 6, 4 );
		// long hair: a card down the back, curved round the head
		const hc = [ - 0.08, - 0.04, 0, 0.04, 0.08 ];
		const top = hc.map( ( x ) => vert( add( h, [ x, 0.05, 0.075 - x * x * 3 ] ), [ x, 0, 1 ], B.head, PART.hairCard ) );
		const bot = hc.map( ( x ) => vert( add( h, [ x * 1.1, - 0.2, 0.09 - x * x * 3 ] ), [ x, 0, 1 ], B.head, PART.hairCard ) );
		for ( let k = 0; k < hc.length - 1; k ++ ) index.push( top[ k ], bot[ k ], top[ k + 1 ], top[ k + 1 ], bot[ k ], bot[ k + 1 ] );

	}

	for ( const s of [ - 1, 1 ] ) {

		const L = s < 0 ? 0 : 1;
		const sh = side( J.shoulder, s ), el = side( J.elbow, s ), wr = side( J.wrist, s ), ha = side( J.hand, s );
		// the shoulder's round, the upper arm, the forearm and the cuff (sleeves: the shaders colour them)
		ellipsoid( B.uarm[ L ], PART.sleeve, add( sh, [ - 0.012 * s, - 0.018, 0 ] ), [ 0.064, 0.052, 0.064 ], 8, 5 );
		tube( B.uarm[ L ], PART.sleeve, sh, el, [ 0.062, 0.064 ], [ 0.05, 0.052 ], 8 );
		ellipsoid( B.farm[ L ], PART.sleeve, el, [ 0.05, 0.05, 0.052 ], 8, 4 );
		tube( B.farm[ L ], PART.sleeve, el, wr, [ 0.049, 0.05 ], [ 0.04, 0.042 ], 8 );
		// the hand: a mitten with its thumb, turned in toward the body
		boxAt( B.farm[ L ], PART.hand, add( ha, [ - 0.004 * s, 0.0, 0 ] ), [ 0.017, 0.045, 0.036 ] );
		boxAt( B.farm[ L ], PART.hand, add( ha, [ - 0.016 * s, 0.022, - 0.03 ] ), [ 0.012, 0.026, 0.011 ] );
		tube( B.farm[ L ], PART.hand, add( wr, [ 0, 0.01, 0 ] ), add( ha, [ 0, 0.02, 0 ] ), [ 0.03, 0.027 ], [ 0.02, 0.036 ], 6 );
		// the thigh, the knee, the shin and the shoe
		const hp = side( J.hip, s ), kn = side( J.knee, s ), an = side( J.ankle, s );
		tube( B.thigh[ L ], PART.pants, add( hp, [ 0, 0.05, 0 ] ), kn, [ 0.088, 0.09 ], [ 0.062, 0.064 ], 8 );
		ellipsoid( B.shin[ L ], PART.pants, kn, [ 0.059, 0.058, 0.06 ], 8, 4 );
		tube( B.shin[ L ], PART.pants, kn, add( an, [ 0, 0.02, 0 ] ), [ 0.06, 0.062 ], [ 0.047, 0.05 ], 8 );
		boxAt( B.shin[ L ], PART.shoe, add( an, [ 0.003 * s, - 0.045, - 0.045 ] ), [ 0.048, 0.042, 0.125 ] );

	}

	// a poncho: a bell of plastic from the shoulders to the knees, over everything (the spine bone)
	loft( B.spine, PART.poncho, [ [ 0.6, 0.32, 0.25, 0.02 ], [ 0.85, 0.29, 0.21, 0.02 ], [ 1.12, 0.262, 0.175, 0.015 ], [ 1.36, 0.245, 0.14, 0.025 ], [ 1.44, 0.17, 0.105, 0.03 ], [ 1.49, 0.07, 0.068, 0.03 ] ], 14, false, false );
	// an apron (the concession staff), a hi-vis vest (security): thin shells just over the trunk
	loft( B.spine, PART.apron, [ [ 0.55, 0.19, 0.13, 0.0 ], [ 0.8, 0.178, 0.125, 0.004 ], [ 1.02, 0.172, 0.122, 0.004 ] ], 12, false, false );
	loft( B.spine, PART.vest, [ [ 0.98, 0.178, 0.122, 0.01 ], [ 1.17, 0.18, 0.124, 0.006 ], [ 1.3, 0.194, 0.128, 0.012 ], [ 1.4, 0.18, 0.1, 0.024 ] ], 12, false, false );

	// ---- what's held: each hand's set, built at its hand (the rig carries it)
	for ( const s of [ - 1, 1 ] ) {

		const L = s < 0 ? 0 : 1, bone = B.prop[ L ];
		const h = side( J.hand, s );
		// upright things sit just in front of the palm, held round their middle
		const g = add( h, [ - 0.035 * s, - 0.06, - 0.02 ] );
		for ( const id of HAND_PROPS[ L ] ) {

			const part = 32 + id;
			if ( id === PROP.beer || id === PROP.soda ) {

				cyl( bone, part, g, 0.034, 0.045, 0.15, 8 );
				if ( id === PROP.soda ) tube( bone, part, add( g, [ 0.01, 0.14, 0 ] ), add( g, [ 0.018, 0.22, 0.004 ] ), [ 0.004, 0.004 ], [ 0.004, 0.004 ], 4 );

			} else if ( id === PROP.beers ) {

				// two beers in one hand, pinched together at the rims
				cyl( bone, part, add( g, [ 0.03, 0, 0 ] ), 0.034, 0.045, 0.15, 6 );
				cyl( bone, part, add( g, [ - 0.06, 0, - 0.01 ] ), 0.034, 0.045, 0.15, 6 );

			} else if ( id === PROP.cocoa ) {

				cyl( bone, part, add( g, [ 0, 0.01, 0 ] ), 0.03, 0.04, 0.115, 8 );
				cyl( bone, part, add( g, [ 0, 0.125, 0 ] ), 0.041, 0.036, 0.014, 8 );

			} else if ( id === PROP.waterIce ) {

				cyl( bone, part, add( g, [ 0, 0.01, 0 ] ), 0.032, 0.042, 0.1, 8, false );
				ellipsoid( bone, part, add( g, [ 0, 0.11, 0 ] ), [ 0.04, 0.025, 0.04 ], 6, 3 );

			} else if ( id === PROP.cottonCandy ) {

				tube( bone, part, add( g, [ 0, 0.02, 0 ] ), add( g, [ 0, 0.2, 0 ] ), [ 0.008, 0.008 ], [ 0.012, 0.012 ], 5 );
				ellipsoid( bone, part, add( g, [ 0, 0.3, 0 ] ), [ 0.11, 0.13, 0.11 ], 7, 4 );

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
				tube( bone, part, add( h, [ 0, - 0.06, - 0.05 ] ), add( h, [ 0, 0.01, 0 ] ), [ 0.006, 0.006 ], [ 0.006, 0.006 ], 4 );
				tube( bone, part, add( h, [ 0, - 0.06, 0.05 ] ), add( h, [ 0, 0.01, 0 ] ), [ 0.006, 0.006 ], [ 0.006, 0.006 ], 4 );

			} else if ( id === PROP.peanuts ) {

				boxAt( bone, part, add( g, [ 0, 0.06, 0 ] ), [ 0.07, 0.1, 0.03 ] );

			} else if ( id === PROP.program || id === PROP.scorebook || id === PROP.programs ) {

				// held by its edge in the fingers, standing down from the hand (the arm turns it up)
				const n = id === PROP.programs ? 3 : 1;
				for ( let k = 0; k < n; k ++ ) boxAt( bone, part, add( h, [ 0.004 * k * s, - 0.1 - 0.012 * k, - 0.11 - 0.03 * k ] ), [ 0.006, 0.14, 0.107 ] );

			} else if ( id === PROP.phone ) {

				boxAt( bone, part, add( h, [ - 0.02 * s, - 0.05, - 0.03 ] ), [ 0.012, 0.05, 0.025 ] );

			} else if ( id === PROP.glove ) {

				boxAt( bone, part, add( h, [ 0.0, - 0.045, - 0.01 ] ), [ 0.045, 0.1, 0.085 ] );
				boxAt( bone, part, add( h, [ - 0.01 * s, - 0.03, - 0.09 ] ), [ 0.03, 0.06, 0.03 ] );

			} else if ( id === PROP.towel ) {

				const top = [ - 0.02, 0, 0 ], w = 0.22, len = 0.4;
				const a = vert( add( h, add( top, [ 0, 0, - w ] ) ), [ s, 0, 0 ], bone, part ), b = vert( add( h, add( top, [ 0, 0, w * 0.3 ] ) ), [ s, 0, 0 ], bone, part );
				const c = vert( add( h, [ 0.02 * s, - len, w * 0.35 ] ), [ s, 0, 0 ], bone, part ), d = vert( add( h, [ 0.03 * s, - len, - w ] ), [ s, 0, 0 ], bone, part );
				index.push( a, d, b, b, d, c );

			} else if ( id === PROP.sandwich || id === PROP.hotdog ) {

				boxAt( bone, part, add( h, [ - 0.02 * s, - 0.03, - 0.07 ] ), id === PROP.hotdog ? [ 0.028, 0.025, 0.1 ] : [ 0.035, 0.035, 0.12 ] );

			} else if ( id === PROP.money ) {

				boxAt( bone, part, add( h, [ - 0.03 * s, - 0.07, - 0.02 ] ), [ 0.003, 0.035, 0.07 ] );

			}

		}

	}

	const g = new BufferGeometry();
	g.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
	g.setAttribute( 'normal', new Float32BufferAttribute( nrm, 3 ) );
	g.setAttribute( 'aInfo', new Float32BufferAttribute( info, 2 ) );
	g.setIndex( index );
	g.computeBoundingSphere();
	return g;

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

struct C3Pose { p: array<vec4f, ${ POSE }> };
struct C3Out { p: vec3f, n: vec3f };

// is this prop upright (level whatever the hand does)?
fn c3Upright( id: u32 ) -> bool {
	return ${ UPRIGHT.map( ( u ) => `id == ${ u }u` ).join( ' || ' ) };
}

// A vertex of the figure (q, its normal n, rest pose) posed: turned about each joint in its bone's chain,
// then placed (the person's spot, yaw and scale), in the field frame. part: what it is (the props
// collapse unless they're what the hand holds).
fn c3Rig( q0: vec3f, n0: vec3f, bone: u32, part: u32, P: C3Pose ) -> C3Out {
	let at = P.p[ 0 ];
	let a1 = P.p[ 1 ];
	let a2 = P.p[ 2 ];
	let a3 = P.p[ 3 ];
	var q = q0;
	var n = n0;
	let walk = a1.z;
	let ph = a1.y;
	// the legs: the stride (the knee bends through the swing), and whatever the pose adds
	let legs = P.p[ 6 ];
	let extra = P.p[ 7 ];
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
		let R = c3Rz( s * extra.x ) * c3Rx( hipP );
		q = R * ( q - hip ) + hip;
		n = R * n;
	}
	// the upper body: the arms (and what they hold), the head, turned with the spine
	let spine = ${ f3( J.spine ) };
	let Rs = c3Ry( a2.y ) * c3Rz( a2.z ) * c3Rx( - a2.x );
	var hide = false;
	if ( ( bone >= 3u && bone <= 6u ) || bone >= 11u ) {
		let right = bone == 4u || bone == 6u || bone == 12u;
		let s = select( - 1.0, 1.0, right );
		let arm = select( P.p[ 4 ], P.p[ 5 ], right );
		let sh = vec3f( ${ J.shoulder[ 0 ].toFixed( 3 ) } * s, ${ J.shoulder[ 1 ].toFixed( 3 ) }, ${ J.shoulder[ 2 ].toFixed( 3 ) } );
		let el = vec3f( ${ J.elbow[ 0 ].toFixed( 3 ) } * s, ${ J.elbow[ 1 ].toFixed( 3 ) }, ${ J.elbow[ 2 ].toFixed( 3 ) } );
		let Re = c3Rx( arm.w );
		let Ra = c3Ry( s * arm.z ) * c3Rz( s * arm.y ) * c3Rx( arm.x );
		let held = u32( select( a3.z, a3.w, right ) + 0.5 );
		if ( bone >= 11u ) {
			// a prop: only what's in this hand; upright ones stay level (only the anchor moves)
			let id = part - 32u;
			hide = id != held;
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
			// a hand in a pocket isn't seen
			if ( part == ${ PART.hand }u && held == ${ PROP.pocket }u ) { hide = true; }
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
			let Rh = c3Ry( a2.w ) * c3Rx( - a3.x );
			q = Rh * ( q - neck ) + neck;
			n = Rh * n;
		}
		q = Rs * ( q - spine ) + spine;
		n = Rs * n;
	}
	// the pelvis carries it all: the bob of the stride, the drop into a crouch
	q.y += walk * 0.018 * cos( 2.0 * ph ) - a1.w;
	if ( hide ) { q = ${ f3( J.spine ) }; }
	// placed: the spot, the yaw, the size
	let Ry = c3Ry( at.w );
	var o: C3Out;
	o.p = at.xyz + Ry * ( q * a1.x );
	o.n = Ry * n;
	return o;
}
`,
} );

function castMaterial( pose, prev, looks, order, atlas ) {

	const mat = standard( {
		name: 'cast', roughness: 0.8, side: 'double', modules: [ castModule ],
		storage: { c3Pose: pose, c3Prev: prev, c3Look: looks, c3Order: order },
		textures: { c3Atlas: atlas },
		attributes: { aInfo: 'vec2f' },
		varyings: { vLocal: 'vec3f', vPart: 'u32', vLook: 'vec4u', vPose: 'vec4f' },
		vertex: /* wgsl */`
	let bone = u32( v.aInfo.x + 0.5 );
	let part = u32( v.aInfo.y + 0.5 );
	// the visible ones are packed at the front: this instance draws that slot
	let slot = c3Order[ v.instance ];
	let lk = c3Look[ slot ];
	let lx = u32( lk.x );
	let lz = u32( lk.z );
	let age = ( lx >> 13u ) & 3u;
	let female = ( ( lx >> 12u ) & 1u ) == 1u;
	let build = ( lx >> 15u ) & 3u;
	let hairStyle = ( lx >> 6u ) & 3u;
	let hat = ( lz >> 6u ) & 15u;
	let poncho = ( lz >> 10u ) & 7u;
	let top = u32( lk.y ) & 31u;
	var q = v.position;
	var n = v.normal;
	// the build: a belly, broad shoulders, a woman's narrower shoulders and fuller hips; a kid's big head
	if ( part == ${ PART.torso }u || part == ${ PART.pants }u || part == ${ PART.apron }u || part == ${ PART.vest }u || part == ${ PART.poncho }u ) {
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
	let headC = ${ f3( J.head ) };
	if ( bone == 2u && part != ${ PART.neck }u ) {
		// a kid's head is big for his body; a hood (and a knit hat) sits over the hair
		if ( age == 2u ) { q = ${ f3( J.neck ) } + ( q - ${ f3( J.neck ) } ) * 1.22; }
		let d = ( q - headC ) / vec3f( ${ HEAD_R.map( ( r ) => r.toFixed( 3 ) ).join( ', ' ) } );
		if ( hat == ${ HAT.hood }u && part == ${ PART.head }u ) {
			let face = smoothstep( - 0.55, - 0.85, d.z ) * smoothstep( 0.75, 0.45, length( d.xy - vec2f( 0.0, - 0.05 ) ) );
			q = headC + ( q - headC ) * mix( 1.16, 1.0, face );
		}
		if ( ( hat == ${ HAT.knitRed }u || hat == ${ HAT.knitGrey }u || hat == ${ HAT.knitBlack }u || hat == ${ HAT.knitPlain }u ) && part == ${ PART.head }u ) {
			q = q + ( q - headC ) * 0.06 * smoothstep( 0.1, 0.5, d.y );
			q.y += 0.018 * smoothstep( 0.7, 1.0, d.y );
		}
	}
	// the parts only some have: collapsed (zero area) on the rest
	var gone = false;
	if ( part == ${ PART.brim }u ) { gone = !( hat == ${ HAT.capRed }u || hat == ${ HAT.capNavy }u || hat == ${ HAT.cap1980 }u || hat == ${ HAT.capRays }u || hat == ${ HAT.capBack }u || hat == ${ HAT.visor }u || hat == ${ HAT.capBlack }u ); }
	if ( part == ${ PART.brim }u && hat == ${ HAT.capBack }u ) { q = vec3f( - ( q.x - headC.x ), q.y, - ( q.z - headC.z ) ) + headC; n = vec3f( - n.x, n.y, - n.z ); }
	if ( part == ${ PART.pompom }u ) { gone = !( hat == ${ HAT.knitRed }u || hat == ${ HAT.knitGrey }u ); }
	if ( part == ${ PART.hairCard }u ) { gone = hairStyle != 1u || hat == ${ HAT.hood }u || poncho > 0u; }
	if ( part == ${ PART.poncho }u ) { gone = poncho == 0u; }
	if ( part == ${ PART.apron }u ) { gone = !( top == ${ TOP.staff }u || top == ${ TOP.cook }u || top == ${ TOP.seller }u ); }
	if ( part == ${ PART.vest }u ) { gone = !( top == ${ TOP.security }u || top == ${ TOP.hawker }u ); }
	if ( gone ) { q = ${ f3( J.spine ) }; }
	var P0: C3Pose;
	var P1: C3Pose;
	let k = slot * ${ POSE }u;
	for ( var i = 0u; i < ${ POSE }u; i ++ ) {
		P0.p[ i ] = c3Pose[ k + i ];
		P1.p[ i ] = c3Prev[ k + i ];
	}
	let r0 = c3Rig( q, n, bone, part, P0 );
	let r1 = c3Rig( q, n, bone, part, P1 );
	v.useWorld = true;
	v.worldPos = ( v.model * vec4f( r0.p, 1.0 ) ).xyz;
	v.worldNormal = normalize( ( v.model * vec4f( r0.n, 0.0 ) ).xyz );
	v.prevWorldPos = ( v.prevModel * vec4f( r1.p, 1.0 ) ).xyz;
	o.vLocal = q;
	o.vPart = part;
	o.vLook = vec4u( lx, u32( lk.y ), lz, u32( lk.w ) );
	o.vPose = vec4f( P0.p[ 3 ].y, P0.p[ 7 ].y, P0.p[ 7 ].z, P0.p[ 1 ].z );
`,
		surface: /* wgsl */`
	let part = in.vs.vPart;
	let L = in.vs.vLocal;
	let lk = in.vs.vLook;
	let skinI = lk.x & 7u;
	let hairI = ( lk.x >> 3u ) & 7u;
	let hairStyle = ( lk.x >> 6u ) & 3u;
	let facial = ( lk.x >> 8u ) & 7u;
	let glasses = ( ( lk.x >> 11u ) & 1u ) == 1u;
	let female = ( ( lk.x >> 12u ) & 1u ) == 1u;
	let age = ( lk.x >> 13u ) & 3u;
	let top = lk.y & 31u;
	let topCI = ( lk.y >> 5u ) & 31u;
	let sleeveCI = ( lk.y >> 10u ) & 31u;
	let back = ( lk.y >> 15u ) & 63u;
	let chest = ( lk.y >> 21u ) & 7u;
	let pantsI = lk.z & 7u;
	let shoesI = ( lk.z >> 3u ) & 7u;
	let hat = ( lk.z >> 6u ) & 15u;
	let poncho = ( lk.z >> 10u ) & 7u;
	let scarf = ( lk.z >> 13u ) & 3u;
	let gloves = ( ( lk.z >> 15u ) & 1u ) == 1u;
	let seed = f32( lk.w ) / 65536.0;
	let g = fract( vec4f( seed * 13.1, seed * 71.7, seed * 191.3, seed * 7.37 ) );
	let nk = smoothstep( 0.15, 0.7, frame.night );
	var COLS = array<vec3f, ${ COLORS.length }>( ${ COLORS.map( f3 ).join( ', ' ) } );
	var SKIN = array<vec3f, 8>( vec3f( 0.62, 0.42, 0.32 ), vec3f( 0.56, 0.36, 0.25 ), vec3f( 0.5, 0.31, 0.2 ), vec3f( 0.42, 0.25, 0.15 ), vec3f( 0.3, 0.17, 0.1 ), vec3f( 0.2, 0.11, 0.06 ), vec3f( 0.12, 0.065, 0.04 ), vec3f( 0.5, 0.34, 0.2 ) );
	var HAIR = array<vec3f, 8>( vec3f( 0.016, 0.012, 0.01 ), vec3f( 0.04, 0.024, 0.014 ), vec3f( 0.1, 0.058, 0.03 ), vec3f( 0.19, 0.12, 0.06 ), vec3f( 0.4, 0.29, 0.14 ), vec3f( 0.28, 0.08, 0.03 ), vec3f( 0.26, 0.25, 0.24 ), vec3f( 0.58, 0.57, 0.55 ) );
	let skin = SKIN[ skinI ];
	let hairC = HAIR[ hairI ];
	var topC = COLS[ min( topCI, ${ COLORS.length - 1 }u ) ];
	var sleeveC = COLS[ min( sleeveCI, ${ COLORS.length - 1 }u ) ];
	var c = topC;
	var rough = 0.85;
	var metal = 0.0;
	var e = vec3f( 0.0 );
	// the print on a jersey's back (the name over the number) or its chest, from the atlas: 8 x 8 cells
	var printA = 0.0;
	var printC = vec3f( 0.72, 0.71, 0.68 );
	if ( part == ${ PART.torso }u || part == ${ PART.sleeve }u ) {
		// what he wears: the top's cloth, its sheen, its seams
		let shiny = top == ${ TOP.jacket }u || top == ${ TOP.puffer }u || top == ${ TOP.leather }u || top == ${ TOP.satin }u || top == ${ TOP.usher }u;
		rough = select( 0.88, 0.45, shiny );
		if ( top == ${ TOP.leather }u ) { rough = 0.38; }
		// a jersey or a tee: the sleeves are the thermal or hoodie underneath, below the short sleeve
		let shortSleeve = top == ${ TOP.homeJersey }u || top == ${ TOP.nameTee }u || top == ${ TOP.powder }u || top == ${ TOP.rays }u || top == ${ TOP.roadJersey }u || top == ${ TOP.champsTee }u || top == ${ TOP.staff }u || top == ${ TOP.cook }u;
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
		let zipped = top == ${ TOP.jacket }u || top == ${ TOP.fleece }u || top == ${ TOP.puffer }u || top == ${ TOP.leather }u || top == ${ TOP.work }u || top == ${ TOP.satin }u || top == ${ TOP.usher }u || top == ${ TOP.eagles }u;
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
		// the prints: the name and number on the back, the chest's script
		let onBack = L.z > 0.03 && part == ${ PART.torso }u;
		let onFront = L.z < - 0.03 && part == ${ PART.torso }u;
		if ( back > 0u && onBack && L.y > 0.98 && L.y < 1.4 ) {
			let uv = vec2f( 0.5 - L.x / 0.34, ( 1.4 - L.y ) / 0.42 );
			if ( all( uv > vec2f( 0.0 ) ) && all( uv < vec2f( 1.0 ) ) ) {
				let cell = vec2f( f32( back % 8u ), f32( back / 8u ) );
				printA = textureSample( c3Atlas, smpAnisoClamp, ( cell + uv ) / 8.0 ).r;
			}
		}
		if ( chest > 0u && onFront && L.y > 1.08 && L.y < 1.36 ) {
			let uv = vec2f( 0.5 + L.x / 0.32, ( 1.36 - L.y ) / 0.28 );
			if ( all( uv > vec2f( 0.0 ) ) && all( uv < vec2f( 1.0 ) ) ) {
				let ci = ${ CHEST_CELL }u + chest;
				let cell = vec2f( f32( ci % 8u ), f32( ci / 8u ) );
				printA = textureSample( c3Atlas, smpAnisoClamp, ( cell + uv ) / 8.0 ).r;
			}
		}
		// the print's colour: red on white, white on red, maroon on powder blue, navy on the Rays' white
		printC = select( vec3f( 0.72, 0.71, 0.68 ), vec3f( 0.32, 0.018, 0.024 ), dot( topC, vec3f( 0.33 ) ) > 0.35 );
		if ( top == ${ TOP.powder }u ) { printC = vec3f( 0.14, 0.02, 0.03 ); }
		if ( top == ${ TOP.rays }u ) { printC = select( vec3f( 0.8 ), vec3f( 0.02, 0.04, 0.12 ), dot( topC, vec3f( 0.33 ) ) > 0.35 ); }
		if ( top == ${ TOP.security }u || top == ${ TOP.staff }u ) { printC = vec3f( 0.75 ); }
		if ( top == ${ TOP.champsTee }u ) { printC = select( vec3f( 0.3, 0.02, 0.03 ), vec3f( 0.7 ), dot( topC, vec3f( 0.33 ) ) < 0.2 ); }
		c = mix( c, printC, printA );
		// a scarf round the neck
		if ( scarf > 0u && part == ${ PART.torso }u && L.y > 1.38 ) {
			c = select( select( vec3f( 0.012 ), vec3f( 0.25 ), scarf == 2u ), select( vec3f( 0.32, 0.02, 0.03 ), vec3f( 0.7 ), fract( ( L.x + L.y ) / 0.05 ) < 0.5 ), scarf == 1u );
			rough = 0.95;
		}
	}
	if ( part == ${ PART.pants }u ) {
		var PANTS = array<vec3f, 6>( vec3f( 0.05, 0.075, 0.14 ), vec3f( 0.02, 0.03, 0.06 ), vec3f( 0.3, 0.25, 0.16 ), vec3f( 0.015 ), vec3f( 0.2 ), vec3f( 0.015, 0.02, 0.05 ) );
		c = PANTS[ min( pantsI, 5u ) ] * ( 0.9 + 0.2 * g.z );
		// jeans fade at the thighs and knees
		if ( pantsI < 2u ) { c *= 1.0 + 0.25 * smoothstep( 0.3, 0.0, abs( L.y - 0.62 ) ) * smoothstep( - 0.02, - 0.06, L.z ); }
		rough = 0.9;
	}
	if ( part == ${ PART.shoe }u ) {
		var SHOES = array<vec3f, 5>( vec3f( 0.62, 0.61, 0.58 ), vec3f( 0.015 ), vec3f( 0.3, 0.19, 0.08 ), vec3f( 0.08, 0.04, 0.02 ), vec3f( 0.2 ) );
		c = SHOES[ min( shoesI, 4u ) ];
		if ( L.y < 0.012 ) { c = select( c * 0.5, vec3f( 0.5 ), shoesI == 0u ); }
		// the soles wet from the floor
		rough = 0.6;
	}
	if ( part == ${ PART.hand }u ) { c = select( skin, select( vec3f( 0.012 ), vec3f( 0.3, 0.02, 0.03 ), g.y > 0.6 ), gloves ); rough = select( 0.6, 0.9, gloves ); }
	if ( part == ${ PART.neck }u ) { c = skin; rough = 0.6; if ( L.y < 1.43 ) { c = topC; } if ( scarf > 0u ) { c = select( select( vec3f( 0.012 ), vec3f( 0.25 ), scarf == 2u ), vec3f( 0.32, 0.02, 0.03 ), scarf == 1u ); rough = 0.95; } }
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
		if ( hat == ${ HAT.capBlack }u ) { capC = vec3f( 0.012 ); }
		let capped = hat == ${ HAT.capRed }u || hat == ${ HAT.capNavy }u || hat == ${ HAT.cap1980 }u || hat == ${ HAT.capRays }u || hat == ${ HAT.capBack }u || hat == ${ HAT.capBlack }u;
		if ( capped && d.y > 0.26 - 0.12 * smoothstep( - 0.2, 0.6, d.z ) ) {
			c = capC; rough = 0.8;
			// the logo on the front panel (the back, turned round)
			let lz = select( d.z, - d.z, hat == ${ HAT.capBack }u );
			let lp = vec2f( d.x / 0.3, ( d.y - 0.55 ) / 0.3 );
			if ( lz < - 0.55 && length( lp ) < 1.0 ) {
				// a letter P: its stem and bowl
				let stem = abs( lp.x + 0.25 ) < 0.14 && abs( lp.y ) < 0.7;
				let bowl = abs( length( ( lp - vec2f( 0.05, 0.3 ) ) * vec2f( 1.0, 1.3 ) ) - 0.32 ) < 0.12 && lp.x > - 0.25;
				if ( stem || bowl ) { c = select( select( vec3f( 0.75 ), vec3f( 0.32, 0.02, 0.03 ), hat == ${ HAT.capNavy }u ), vec3f( 0.6, 0.62, 0.66 ), hat == ${ HAT.capRays }u ); }
			}
			if ( abs( fract( atan2( d.x, d.z ) * 0.955 ) - 0.5 ) > 0.485 ) { c *= 0.7; }
		}
		if ( hat == ${ HAT.visor }u && d.y > 0.18 && d.y < 0.34 ) { c = vec3f( 0.33, 0.015, 0.02 ); }
		let knit = hat == ${ HAT.knitRed }u || hat == ${ HAT.knitGrey }u || hat == ${ HAT.knitBlack }u || hat == ${ HAT.knitPlain }u;
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
				c = select( topC, vec3f( 0.5 ), poncho > 0u );
				c *= select( 1.0, 0.55, oval < 0.85 && d.z < - 0.2 );
				rough = select( 0.85, 0.2, poncho > 0u );
			}
		}
	}
	if ( part == ${ PART.hairCard }u ) { c = hairC; rough = 0.7; }
	if ( part == ${ PART.brim }u ) {
		c = select( select( vec3f( 0.014, 0.02, 0.06 ), vec3f( 0.33, 0.015, 0.02 ), hat == ${ HAT.capRed }u || hat == ${ HAT.capBack }u || hat == ${ HAT.visor }u ), vec3f( 0.12, 0.018, 0.026 ), hat == ${ HAT.cap1980 }u );
		if ( hat == ${ HAT.capRays }u ) { c = vec3f( 0.012, 0.025, 0.08 ); }
		if ( hat == ${ HAT.capBlack }u ) { c = vec3f( 0.012 ); }
		rough = 0.8;
	}
	if ( part == ${ PART.pompom }u ) { c = select( vec3f( 0.32, 0.29, 0.26 ), vec3f( 0.62, 0.6, 0.56 ), hat == ${ HAT.knitRed }u ); rough = 1.0; }
	if ( part == ${ PART.apron }u ) {
		// the concession staff's black apron (the cooks' white, stained)
		c = select( vec3f( 0.014 ), vec3f( 0.6, 0.58, 0.54 ) * ( 0.85 + 0.15 * g.x ), top == ${ TOP.cook }u );
		if ( top == ${ TOP.seller }u ) { c = vec3f( 0.3, 0.02, 0.03 ); }
		rough = 0.9;
	}
	if ( part == ${ PART.vest }u ) {
		// hi-vis: fluorescent yellow-green, two silver bands (the hawkers' is yellow and red)
		c = select( vec3f( 0.55, 0.62, 0.02 ), vec3f( 0.7, 0.45, 0.02 ), top == ${ TOP.hawker }u );
		if ( abs( L.y - 1.06 ) < 0.02 || abs( L.y - 1.18 ) < 0.02 ) { c = select( vec3f( 0.65 ), vec3f( 0.3, 0.02, 0.03 ), top == ${ TOP.hawker }u ); rough = 0.3; }
		e = c * 0.06;
	}
	if ( part == ${ PART.poncho }u ) {
		// the poncho: clear plastic over the jacket (glossy, the jacket dulled through it), or red, white
		// or yellow; wet on the 27th, and creased
		var pc = select( select( select( mix( topC, vec3f( 0.45 ), 0.22 ), vec3f( 0.36, 0.02, 0.03 ), poncho == 2u ), vec3f( 0.62 ), poncho == 3u ), vec3f( 0.65, 0.5, 0.03 ), poncho == 4u );
		if ( poncho == 5u ) { pc = vec3f( 0.62, 0.2, 0.02 ); }
		if ( poncho == 6u ) { pc = vec3f( 0.06, 0.065, 0.07 ); }
		let crease = 0.9 + 0.1 * sin( atan2( L.x, L.z ) * 11.0 + L.y * 7.0 ) + select( 0.0, 0.12 * sin( L.y * 31.0 + L.x * 17.0 ), poncho == 6u );
		c = pc * crease;
		// the clear ones catch the light like wet film: glossier where they face it
		rough = select( 0.18, 0.1, poncho == 1u );
	}
	// what's in their hands
	if ( part >= 32u ) {
		let id = part - 32u;
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
		if ( id == ${ PROP.towel }u ) { c = vec3f( 0.75, 0.74, 0.7 ); rough = 1.0; }
		if ( id == ${ PROP.bag }u ) { c = select( vec3f( 0.72 ), vec3f( 0.35, 0.02, 0.03 ), g.w > 0.5 ); rough = 0.35; }
		if ( id == ${ PROP.sandwich }u ) { c = vec3f( 0.7, 0.7, 0.72 ); metal = 0.9; rough = 0.35; }
		if ( id == ${ PROP.hotdog }u ) { c = vec3f( 0.62, 0.42, 0.2 ); }
		if ( id == ${ PROP.peanuts }u ) { c = vec3f( 0.6, 0.5, 0.35 ); }
		if ( id == ${ PROP.money }u ) { c = vec3f( 0.35, 0.42, 0.3 ); rough = 0.9; }
	}
	// the rain on them: shoulders, caps and hoods darker and glossy on the 27th
	let wetK = frame.wet * smoothstep( 0.2, 0.8, normalize( in.N ).y ) * select( 0.6, 1.0, part == ${ PART.poncho }u );
	c *= mix( 1.0, 0.8, wetK * step( 0.5, rough ) );
	rough = mix( rough, 0.25, wetK * 0.6 );
	s.albedo = c;
	s.roughness = rough;
	s.metalness = metal;
	// lit by the concourse's own lights after dark
	s.emissive = e + c * nk * 0.12;
`,
	} );
	mat.underwaterLighting = 'none';
	mat.setDefine( 'DRY', 1 );
	return mat;

}

// The atlas: the backs (the name curved over the number, as the Phillies' are lettered), the chest prints.
// A mask (white on black): the shader colours it.
function drawAtlas() {

	return canvasTexture( 1024, 1024, ( ctx ) => {

		ctx.fillStyle = '#000';
		ctx.fillRect( 0, 0, 1024, 1024 );
		ctx.fillStyle = '#fff';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'alphabetic';
		const cell = ( i ) => [ ( i % 8 ) * 128, Math.floor( i / 8 ) * 128 ];
		BACKS.forEach( ( b, i ) => {

			if ( ! b ) return;
			const [ x, y ] = cell( i );
			const [ name, num ] = b;
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
		// October 15), RAYS, EVENT STAFF, SECURITY, EAGLES
		const chests = [ null, 'script', 'block', 'champs', 'rays', 'staff', 'security', 'eagles', 'redOct' ];
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

			}

			ctx.restore();

		} );

	}, 'castAtlas' );

}

// ---------------------------------------------------------------- the cast

// a look: the fields above, packed
export function packLook( o ) {

	const x = ( o.skin & 7 ) | ( ( o.hair & 7 ) << 3 ) | ( ( o.hairStyle & 3 ) << 6 ) | ( ( o.facial & 7 ) << 8 ) | ( ( o.glasses ? 1 : 0 ) << 11 )
		| ( ( o.female ? 1 : 0 ) << 12 ) | ( ( o.age & 3 ) << 13 ) | ( ( o.build & 3 ) << 15 );
	const y = ( o.top & 31 ) | ( ( o.color & 31 ) << 5 ) | ( ( o.sleeves & 31 ) << 10 ) | ( ( o.back & 63 ) << 15 ) | ( ( o.chest & 7 ) << 21 );
	const z = ( o.pants & 7 ) | ( ( o.shoes & 7 ) << 3 ) | ( ( o.hat & 15 ) << 6 ) | ( ( o.poncho & 7 ) << 10 ) | ( ( o.scarf & 3 ) << 13 ) | ( ( o.gloves ? 1 : 0 ) << 15 );
	return [ x, y, z, ( o.seed ?? Math.floor( Math.random() * 65536 ) ) & 65535 ];

}

export class Cast {

	constructor( { parent, max = 320 } ) {

		this.max = max;
		this.list = [];
		this.pose = new Float32Array( max * POSE * 4 );
		this.prev = new Float32Array( max * POSE * 4 );
		this.looks = new Float32Array( max * 4 );
		this.poseBuf = new StorageBuffer( { label: 'castPose', count: max * POSE, type: 'vec4f' } );
		this.prevBuf = new StorageBuffer( { label: 'castPrev', count: max * POSE, type: 'vec4f' } );
		this.lookBuf = new StorageBuffer( { label: 'castLooks', count: max, type: 'vec4f' } );
		// which slots are drawn this frame, packed (so the hidden cost nothing)
		this.order = new Uint32Array( max );
		this.orderBuf = new StorageBuffer( { label: 'castOrder', count: max, type: 'u32' } );
		this.atlas = drawAtlas();
		this.material = castMaterial( this.poseBuf, this.prevBuf, this.lookBuf, this.orderBuf, this.atlas );
		this.geometry = figureGeometry();
		this.mesh = new InstancedMesh( this.geometry, this.material, max );
		this.mesh.name = 'cast';
		this.mesh.frustumCulled = false;
		this.mesh.castShadow = false;
		this.mesh.receiveShadow = true;
		this.mesh.userData.dynamic = true;
		const I = new Matrix4();
		for ( let i = 0; i < max; i ++ ) this.mesh.setMatrixAt( i, I );
		this.mesh.count = 1;
		parent.add( this.mesh );
		// a soft shadow on the floor under each (the concourse's light comes from everywhere at once)
		const blob = new PlaneGeometry( 1, 1 );
		blob.rotateX( - Math.PI / 2 );
		this.blobMat = standard( { name: 'cast-contact', color: new Color( 0, 0, 0 ), transparent: true, depthWrite: false, lit: false,
			storage: { c3Pose: this.poseBuf, c3Order: this.orderBuf },
			varyings: { vK: 'f32' },
			vertex: /* wgsl */`
	let slot = c3Order[ v.instance ];
	let at = c3Pose[ slot * ${ POSE }u ];
	let a1 = c3Pose[ slot * ${ POSE }u + 1u ];
	let s = a1.x * ( 0.75 + 0.35 * a1.z );
	v.useWorld = true;
	v.worldPos = ( v.model * vec4f( at.x + v.position.x * 0.62 * s, at.y + 0.012, at.z + v.position.z * 0.62 * s, 1.0 ) ).xyz;
	v.worldNormal = ( v.model * vec4f( 0.0, 1.0, 0.0, 0.0 ) ).xyz;
	o.vK = select( 0.0, 1.0, a1.x > 0.05 );
`,
			surface: 'let r = length( in.uv - 0.5 ) * 2.0; s.albedo = vec3f( 0.0 ); s.alpha = ( 1.0 - smoothstep( 0.15, 1.0, r ) ) * 0.5 * in.vs.vK;' } );
		this.blobMat.underwaterLighting = 'none';
		this.blobs = new InstancedMesh( blob, this.blobMat, max );
		this.blobs.name = 'cast-contact';
		this.blobs.frustumCulled = false;
		this.blobs.layers.set( 2 );
		this.blobs.userData.dynamic = true;
		for ( let i = 0; i < max; i ++ ) this.blobs.setMatrixAt( i, I );
		this.blobs.count = 1;
		parent.add( this.blobs );
		this._fresh = true;

	}

	// someone new: a look (packLook's fields) and a pose to start from
	add( look ) {

		if ( this.list.length >= this.max ) return null;
		const slot = this.list.length;
		const p = { slot, x: 0, y: 0, z: 0, yaw: 0, scale: 1, visible: true, fresh: true, pose: restPose(), look };
		this.looks.set( packLook( look ), slot * 4 );
		this.list.push( p );
		this._looksDirty = true;
		return p;

	}

	// dressed differently (a poncho on for the rain, off on the 29th)
	setLook( p, look ) {

		p.look = look;
		this.looks.set( packLook( look ), p.slot * 4 );
		this._looksDirty = true;

	}

	get triangles() {

		return this.geometry.index.count / 3;

	}

	update() {

		if ( this._looksDirty ) {

			this.lookBuf.write( this.looks );
			this._looksDirty = false;

		}

		// last frame's poses become the previous ones
		this.prev.set( this.pose );
		const P = this.pose;
		let drawn = 0;
		for ( const p of this.list ) {

			const o = p.slot * POSE * 4, a = p.pose;
			if ( ! p.visible ) {

				P.fill( 0, o, o + POSE * 4 );
				p.fresh = true;
				continue;

			}

			P[ o ] = p.x; P[ o + 1 ] = p.y; P[ o + 2 ] = p.z; P[ o + 3 ] = p.yaw;
			P[ o + 4 ] = p.scale; P[ o + 5 ] = a.phase; P[ o + 6 ] = a.walk; P[ o + 7 ] = a.drop;
			P[ o + 8 ] = a.lean; P[ o + 9 ] = a.twist; P[ o + 10 ] = a.roll; P[ o + 11 ] = a.headYaw;
			P[ o + 12 ] = a.headPitch; P[ o + 13 ] = a.mouth; P[ o + 14 ] = a.propL; P[ o + 15 ] = a.propR;
			P.set( a.armL, o + 16 );
			P.set( a.armR, o + 20 );
			P[ o + 24 ] = a.hipL; P[ o + 25 ] = a.kneeL; P[ o + 26 ] = a.hipR; P[ o + 27 ] = a.kneeR;
			P[ o + 28 ] = a.spread; P[ o + 29 ] = a.breath; P[ o + 30 ] = a.blink; P[ o + 31 ] = 0;
			this.order[ drawn ++ ] = p.slot;
			// someone who's just appeared has no motion from last frame
			if ( p.fresh ) {

				this.prev.set( P.subarray( o, o + POSE * 4 ), o );
				p.fresh = false;

			}

		}

		// nobody to draw: one collapsed figure (a slot with no pose)
		if ( ! drawn ) this.order[ drawn ++ ] = this.list.length ? this.list[ 0 ].slot : 0;
		this.drawn = drawn;
		this.mesh.count = drawn;
		this.blobs.count = drawn;
		this.poseBuf.write( P );
		this.prevBuf.write( this.prev );
		this.orderBuf.write( this.order.subarray( 0, Math.max( 4, drawn ) ) );

	}

}

// a pose standing at ease; the angles in radians (see c3Rig): arm = [ shoulder pitch (forward +),
// roll (out to the side +), yaw (across the body +), elbow (bent +) ]
export function restPose() {

	return {
		phase: 0, walk: 0, drop: 0, lean: 0, twist: 0, roll: 0, headYaw: 0, headPitch: 0, mouth: 0,
		propL: 0, propR: 0, armL: [ 0.05, 0.06, 0, 0.12 ], armR: [ 0.05, 0.06, 0, 0.12 ],
		hipL: 0, kneeL: 0, hipR: 0, kneeR: 0, spread: 0, breath: 0, blink: 0,
	};

}
