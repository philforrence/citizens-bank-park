import { InstancedMesh, PlaneGeometry, Matrix4, Quaternion, Vector3, Color, Sphere } from '../../../engine/index.js';
import { StorageBuffer } from '../../../engine/gpu/Texture.js';
import { ShaderModule } from '../../../engine/gpu/Shader.js';
import { commonModule } from '../../../engine/render/wgsl/common.js';
import { standard } from '../../../materials/Materials.js';
import { canvasTexture } from '../../geo.js';
import { Mesher } from './Mesher.js';
import { BONE, J, pose, boneXf, apply, unapply, unrotate, FOLK_FK } from './FolkRig.js';

// The Third Base plaza's people, in one instanced draw: a figure of ~1,300 triangles (faces, hands,
// shoes, a jacket over the belt) posed by eleven rigid bones in the vertex shader (FolkRig.js), dressed
// in the fragment shader from a 24-bit look (what he wears, his skin, hair, beard, glasses, a kid, a
// woman), and carrying what his props bits say: an umbrella, a poncho and its hood, a ticket, a beer, a
// flip phone, a program, a rally towel, a glove, a vendor's tray, a scanner, a bag of peanuts, a microphone...
// Each prop is built into its bone's rest frame (at the pose it's held in), so it stays in the hand.
//
//   const folk = new Folk( parent );
//   const f = folk.add( { x, z, yaw, look, props, scale } );  f.pose (FolkRig.pose()), f.walk, f.phase
//   folk.update()  (after moving and posing them)

const MAX = 420;
const K = 4; // vec4s per figure

// the props: which bit shows them
export const PROP = {
	brim: 0, pom: 1, hood: 2, poncho: 3, bag: 4, backpack: 5, umbrella: 6, cup: 7, phone: 8, ticket: 9,
	program: 10, towel: 11, scanner: 12, sack: 13, flash: 14, sign: 15, tray: 16, mic: 17, glove: 18, hair: 19,
	shopbag: 20, fan: 21, radio: 22, badge: 23,
};
// what each vertex is (the fragment shader colours by it)
const PART = {
	top: 0, pants: 1, skin: 2, head: 3, shoe: 4, neck: 5, brim: 6, pom: 7, hood: 8, poncho: 9, bag: 10, strap: 11,
	canopy: 12, shaft: 13, cup: 14, phone: 15, ticket: 16, program: 17, towel: 18, scanner: 19, wand: 20, flash: 21,
	sign: 22, tray: 23, mic: 24, glove: 25, hair: 26, shopbag: 27, fan: 28, radio: 29, badge: 30, sleeve: 31,
};

// The look: 24 bits. top (5) | cell (5): the jersey's name and number, or the colour | pants (3) |
// head (3) | skin (2) | hair (2) | beard, glasses, kid, woman
export const TOP = {
	hoodieRed: 0, jerseyHome: 1, teeOverHoodie: 2, powderBlue: 3, jerseyRoad: 4, jacketBlack: 5, sweatGrey: 6,
	jacketNavy: 7, carhartt: 8, leather: 9, eagles: 10, windbreaker: 11, camo: 12, flyers: 13, raysJersey: 14,
	raysTee: 15, fleeceRed: 16, hoodieWhite: 17, parkaRed: 18, pufferBlack: 19,
	usher: 20, security: 21, police: 22, trooper: 23, vendor: 24, reporter: 25, crew: 26, bouncer: 27, storeStaff: 28,
	jerseyRed: 29, coatCamel: 30, raincoatYellow: 31,
};
export const HEAD = { bare: 0, capRed: 1, capNavy: 2, capWhite: 3, beanieRed: 4, beanieGrey: 5, hood: 6, uniform: 7 };
export const PANTS = { jeans: 0, darkJeans: 1, khaki: 2, black: 3, sweats: 4, navy: 5, uniformGrey: 6, camo: 7 };

// the backs and fronts: 8 x 4 cells of 128 px. R the fill, G the outline round it
export const CELL = {
	UTLEY: 0, HOWARD: 1, ROLLINS: 2, HAMELS: 3, BURRELL: 4, VICTORINO: 5, WERTH: 6, LIDGE: 7, MOYER: 8, RUIZ: 9,
	FELIZ: 10, MYERS: 11, SCHMIDT: 12, CARLTON: 13, ROSE: 14, DYKSTRA: 15, KRUK: 16, DAULTON: 17, LUZINSKI: 18,
	JENKINS: 19, LONGORIA: 20, UPTON: 21, COSTE: 22, ASHBURN: 23,
	script: 24, security: 25, police: 26, fox: 27, rays: 28, staff: 29, capP: 30, block: 31,
};
const BACKS = [ [ 'UTLEY', 26 ], [ 'HOWARD', 6 ], [ 'ROLLINS', 11 ], [ 'HAMELS', 35 ], [ 'BURRELL', 5 ], [ 'VICTORINO', 8 ], [ 'WERTH', 28 ],
	[ 'LIDGE', 54 ], [ 'MOYER', 50 ], [ 'RUIZ', 51 ], [ 'FELIZ', 7 ], [ 'MYERS', 39 ], [ 'SCHMIDT', 20 ], [ 'CARLTON', 32 ], [ 'ROSE', 14 ],
	[ 'DYKSTRA', 4 ], [ 'KRUK', 29 ], [ 'DAULTON', 10 ], [ 'LUZINSKI', 19 ], [ 'JENKINS', 23 ], [ 'LONGORIA', 3 ], [ 'UPTON', 2 ], [ 'COSTE', 27 ], [ 'ASHBURN', 1 ] ];

export function packLook( { top = 0, cell = 0, pants = 0, head = 0, skin = 0, hair = 0, beard = 0, glasses = 0, kid = 0, woman = 0 } = {} ) {

	return top | ( cell << 5 ) | ( pants << 10 ) | ( head << 13 ) | ( skin << 16 ) | ( hair << 18 ) | ( beard << 20 ) | ( glasses << 21 ) | ( kid << 22 ) | ( woman << 23 );

}

export function propBits( list ) {

	let b = 0;
	for ( const p of list ) b |= 1 << PROP[ p ];
	return b;

}

// ---------------------------------------------------------------- the figure

function figureGeometry() {

	const m = new Mesher( { aRig: 4 } );
	const rig = ( bA, bB = bA, w = 1, part = 0, bit = - 1 ) => ( { aRig: [ bA, bB, w, part + 64 * ( bit + 1 ) ] } );

	// a vertical loft of elliptical rings: [ y, cx, cz, rx, rz, bA, bB, w ], n sides
	const loft = ( rings, n, part, { capTop = false, capBottom = false, bit = - 1 } = {} ) => {

		const ids = [];
		for ( const [ y, cx, cz, rx, rz, bA, bB, w ] of rings ) {

			const row = [];
			for ( let k = 0; k <= n; k ++ ) {

				const a = k / n * Math.PI * 2, c = Math.cos( a ), s = Math.sin( a );
				row.push( m.v( [ cx + c * rx, y, cz + s * rz ], [ c / rx, 0, s / rz ], [ k / n, y ], rig( bA, bB ?? bA, w ?? 1, part, bit ) ) );

			}

			ids.push( row );

		}

		for ( let i = 0; i < ids.length - 1; i ++ ) for ( let k = 0; k < n; k ++ ) m.quad( ids[ i ][ k ], ids[ i ][ k + 1 ], ids[ i + 1 ][ k + 1 ], ids[ i + 1 ][ k ] );
		const cap = ( i, up ) => {

			const [ y, cx, cz, , , bA, bB, w ] = rings[ i ];
			const c = m.v( [ cx, y, cz ], [ 0, up ? 1 : - 1, 0 ], [ 0.5, y ], rig( bA, bB ?? bA, w ?? 1, part, bit ) );
			for ( let k = 0; k < n; k ++ ) up ? m.tri( c, ids[ i ][ k + 1 ], ids[ i ][ k ] ) : m.tri( c, ids[ i ][ k ], ids[ i ][ k + 1 ] );

		};

		if ( capTop ) cap( rings.length - 1, true );
		if ( capBottom ) cap( 0, false );

	};

	const B = BONE;
	for ( const s of [ - 1, 1 ] ) {

		const thigh = s < 0 ? B.thighL : B.thighR, shin = s < 0 ? B.shinL : B.shinR;
		const upper = s < 0 ? B.upperL : B.upperR, fore = s < 0 ? B.foreL : B.foreR;
		const x = s * 0.1;
		// the leg: the shin, the knee between, the thigh up into the pelvis
		loft( [
			[ 0.085, x, 0.0, 0.048, 0.052, shin ], [ 0.3, x, 0.005, 0.052, 0.057, shin ], [ 0.46, x, 0.0, 0.056, 0.058, shin ],
			[ 0.51, x, 0.0, 0.058, 0.06, thigh, shin, 0.5 ], [ 0.57, x, 0.0, 0.063, 0.066, thigh ], [ 0.72, x, - 0.004, 0.073, 0.077, thigh ],
			[ 0.86, x, 0.0, 0.085, 0.086, thigh ], [ 0.97, s * 0.095, 0.0, 0.09, 0.09, thigh, B.pelvis, 0.5 ],
		], 8, PART.pants );
		// the shoe: a sole, a toe box, a heel
		const shoe = ( y0, y1, z0, z1, w0, w1 ) => {

			const a = [ x - w0, y0, z0 ], b = [ x + w0, y0, z0 ], c = [ x + w1, y0, z1 ], d = [ x - w1, y0, z1 ];
			const A = [ x - w0, y1, z0 ], Bb = [ x + w0, y1, z0 ], C = [ x + w1, y1 * 0.7, z1 ], D = [ x - w1, y1 * 0.7, z1 ];
			const R = rig( shin, shin, 1, PART.shoe );
			m.face( a, b, Bb, A, [ 0, 0, 1 ], undefined, R );
			m.face( b, c, C, Bb, [ 1, 0, 0 ], undefined, R );
			m.face( c, d, D, C, [ 0, 0.3, - 1 ], undefined, R );
			m.face( d, a, A, D, [ - 1, 0, 0 ], undefined, R );
			m.face( A, Bb, C, D, [ 0, 1, - 0.2 ], undefined, R );
			m.face( a, d, c, b, [ 0, - 1, 0 ], undefined, R );

		};

		shoe( 0.0, 0.11, 0.07, - 0.19, 0.047, 0.05 );
		// the arm: a shoulder cap into the torso, the sleeve to the cuff
		const ax = ( y ) => s * ( 0.19 + ( 1.42 - y ) * 0.012 );
		loft( [
			[ 0.905, ax( 0.905 ), 0.0, 0.036, 0.038, fore ], [ 0.96, ax( 0.96 ), 0.0, 0.04, 0.042, fore ], [ 1.06, ax( 1.06 ), 0.0, 0.046, 0.048, fore ],
			[ 1.15, ax( 1.15 ), 0.0, 0.048, 0.05, upper, fore, 0.5 ], [ 1.26, ax( 1.26 ), 0.0, 0.053, 0.055, upper ], [ 1.37, ax( 1.37 ), 0.0, 0.058, 0.06, upper ],
			[ 1.45, s * 0.182, 0.0, 0.056, 0.058, upper, B.torso, 0.5 ], [ 1.48, s * 0.17, 0.0, 0.03, 0.035, B.torso ],
		], 7, PART.sleeve );
		// the hand, palm in, and a thumb
		const hx = s * 0.222;
		loft( [ [ 0.72, hx, - 0.01, 0.013, 0.028, fore ], [ 0.78, hx, - 0.005, 0.024, 0.043, fore ], [ 0.85, hx, 0.0, 0.028, 0.045, fore ], [ 0.915, hx - s * 0.002, 0.0, 0.026, 0.034, fore ] ], 6, PART.skin, { capBottom: true } );
		m.tube( [ [ hx + s * 0.012, 0.87, - 0.025 ], [ hx + s * 0.018, 0.82, - 0.043 ], [ hx + s * 0.016, 0.79, - 0.05 ] ], [ 0.012, 0.011, 0.009 ], 4, { capB: true, ex: rig( fore, fore, 1, PART.skin ) } );

	}

	// the hips, and the jacket over them (it hangs past the belt); the chest; the collar
	loft( [ [ 0.84, 0, 0.005, 0.15, 0.105, B.pelvis ], [ 0.93, 0, 0.0, 0.165, 0.112, B.pelvis ], [ 1.02, 0, 0.0, 0.16, 0.108, B.pelvis, B.torso, 0.5 ] ], 10, PART.pants, { capBottom: true } );
	loft( [
		[ 0.86, 0, 0.003, 0.178, 0.123, B.pelvis, B.torso, 0.3 ], [ 0.98, 0, 0.0, 0.172, 0.118, B.pelvis, B.torso, 0.6 ],
		[ 1.1, 0, 0.0, 0.166, 0.112, B.torso ], [ 1.24, 0, 0.0, 0.176, 0.117, B.torso ], [ 1.36, 0, 0.004, 0.19, 0.122, B.torso ],
		[ 1.44, 0, 0.01, 0.168, 0.106, B.torso ], [ 1.49, 0, 0.012, 0.082, 0.072, B.torso ],
	], 12, PART.top, { capBottom: true } );
	// the neck
	loft( [ [ 1.47, 0, 0.012, 0.054, 0.054, B.torso, B.head, 0.5 ], [ 1.56, 0, 0.006, 0.05, 0.05, B.head ] ], 8, PART.neck );
	// the head: an egg, a nose, the jaw a little narrower, ears
	{

		const W = 14, H = 10, c = J.head, r = [ 0.078, 0.102, 0.094 ];
		const rows = [];
		for ( let j = 0; j <= H; j ++ ) {

			const row = [];
			for ( let i = 0; i <= W; i ++ ) {

				const th = j / H * Math.PI, ph = i / W * Math.PI * 2;
				const d = [ Math.sin( th ) * Math.cos( ph ), Math.cos( th ), Math.sin( th ) * Math.sin( ph ) ];
				const jaw = d[ 1 ] < - 0.2 ? 1 - 0.18 * ( - d[ 1 ] - 0.2 ) : 1;
				const nose = d[ 2 ] < - 0.9 && Math.abs( d[ 1 ] ) < 0.35 ? 0.014 * ( 1 - Math.abs( d[ 1 ] + 0.05 ) / 0.4 ) : 0;
				const p = [ c[ 0 ] + d[ 0 ] * r[ 0 ] * jaw, c[ 1 ] + d[ 1 ] * r[ 1 ], c[ 2 ] + d[ 2 ] * ( r[ 2 ] + nose ) * ( d[ 2 ] < 0 ? jaw : 1 ) ];
				row.push( m.v( p, d, [ i / W, j / H ], rig( B.head, B.head, 1, PART.head ) ) );

			}

			rows.push( row );

		}

		for ( let j = 0; j < H; j ++ ) for ( let i = 0; i < W; i ++ ) m.quad( rows[ j ][ i ], rows[ j + 1 ][ i ], rows[ j + 1 ][ i + 1 ], rows[ j ][ i + 1 ] );
		for ( const s of [ - 1, 1 ] ) m.tube( [ [ c[ 0 ] + s * 0.074, c[ 1 ] + 0.0, c[ 2 ] + 0.01 ], [ c[ 0 ] + s * 0.086, c[ 1 ] - 0.005, c[ 2 ] + 0.014 ] ], [ 0.02, 0.016 ], 5, { capB: true, ex: rig( B.head, B.head, 1, PART.head ) } );

	}

	props( m, rig );
	return m.geometry();

}

// The props, each into its bone's rest frame from the pose it's held in
function props( m, rig ) {

	const B = BONE;
	// a prop part built in the posed frame of `pose` on bone b, then taken back to the rest frame
	const held = ( b, q, part, bit, build ) => {

		const xf = boneXf( b, q );
		const sub = new Mesher();
		build( sub, ( p ) => apply( xf, p ) );
		const base = m.count;
		for ( let i = 0; i < sub.count; i ++ ) {

			const p = unapply( xf, [ sub.pos[ i * 3 ], sub.pos[ i * 3 + 1 ], sub.pos[ i * 3 + 2 ] ] );
			const n = unrotate( xf, [ sub.nrm[ i * 3 ], sub.nrm[ i * 3 + 1 ], sub.nrm[ i * 3 + 2 ] ] );
			m.v( p, n, [ sub.uv[ i * 2 ], sub.uv[ i * 2 + 1 ] ], rig( b, b, 1, part, bit ) );

		}

		for ( const i of sub.index ) m.index.push( base + i );

	};

	const handR = ( q ) => apply( boneXf( B.foreR, q ), [ J.hand[ 0 ], J.hand[ 1 ], J.hand[ 2 ] ] );
	const handL = ( q ) => apply( boneXf( B.foreL, q ), [ - J.hand[ 0 ], J.hand[ 1 ], J.hand[ 2 ] ] );
	const rest = pose();
	const P = PROP, T = PART;

	// the cap's brim over the eyes, a little curved; the beanie's pom-pom
	held( B.head, rest, T.brim, P.brim, ( s ) => {

		const y = 1.705, z0 = - 0.08, z1 = - 0.175;
		for ( let k = 0; k < 4; k ++ ) {

			const a0 = - 0.085 + k * 0.0425, a1 = a0 + 0.0425;
			const dy = ( a ) => - 0.012 * ( a / 0.085 ) ** 2;
			s.face( [ a0, y + dy( a0 ), z0 + Math.abs( a0 ) * 0.2 ], [ a1, y + dy( a1 ), z0 + Math.abs( a1 ) * 0.2 ], [ a1, y - 0.02 + dy( a1 ), z1 + Math.abs( a1 ) * 0.5 ], [ a0, y - 0.02 + dy( a0 ), z1 + Math.abs( a0 ) * 0.5 ], [ 0, 1, - 0.15 ], [ [ a0, 0 ], [ a1, 0 ], [ a1, 1 ], [ a0, 1 ] ] );

		}

	} );
	held( B.head, rest, T.pom, P.pom, ( s ) => s.tube( [ [ 0, 1.735, 0.005 ], [ 0, 1.77, 0.005 ], [ 0, 1.8, 0.005 ] ], [ 0.012, 0.034, 0.005 ], 6, { capA: true, capB: true } ) );
	// the hood up: a shell round the top, sides and back of the head, open at the face
	held( B.head, rest, T.hood, P.hood, ( s ) => {

		const c = J.head, W = 12, H = 7, r = [ 0.1, 0.122, 0.112 ];
		const rows = [];
		for ( let j = 0; j <= H; j ++ ) {

			const row = [];
			for ( let i = 0; i <= W; i ++ ) {

				// round from one cheek, over the back, to the other (the face open)
				const th = j / H * Math.PI * 0.62, ph = - Math.PI * 0.22 + i / W * Math.PI * 1.44;
				const d = [ Math.sin( th ) * Math.sin( ph ), Math.cos( th ), Math.sin( th ) * Math.cos( ph ) ];
				row.push( s.v( [ c[ 0 ] + d[ 0 ] * r[ 0 ], c[ 1 ] + 0.01 + d[ 1 ] * r[ 1 ], c[ 2 ] + 0.012 + d[ 2 ] * r[ 2 ] ], d, [ i / W, j / H ] ) );

			}

			rows.push( row );

		}

		for ( let j = 0; j < H; j ++ ) for ( let i = 0; i < W; i ++ ) s.quad( rows[ j ][ i ], rows[ j ][ i + 1 ], rows[ j + 1 ][ i + 1 ], rows[ j + 1 ][ i ] );

	} );
	// long hair, down the back to the shoulders
	held( B.head, rest, T.hair, P.hair, ( s ) => {

		const c = J.head;
		s.tube( [ [ c[ 0 ], c[ 1 ] + 0.02, c[ 2 ] + 0.02 ], [ c[ 0 ], c[ 1 ] - 0.08, c[ 2 ] + 0.05 ], [ c[ 0 ], c[ 1 ] - 0.2, c[ 2 ] + 0.06 ] ], [ 0.09, 0.085, 0.06 ], 8, { capB: true } );

	} );
	// the poncho: a bell of plastic from the collar to mid-thigh over the jacket and the arms
	held( B.torso, rest, T.poncho, P.poncho, ( s ) => {

		const rings = [ [ 1.53, 0.07, 0.065 ], [ 1.47, 0.19, 0.135 ], [ 1.38, 0.255, 0.155 ], [ 1.12, 0.27, 0.175 ], [ 0.88, 0.29, 0.195 ], [ 0.72, 0.3, 0.205 ] ];
		const n = 14, ids = [];
		for ( const [ y, rx, rz ] of rings ) {

			const row = [];
			for ( let k = 0; k <= n; k ++ ) {

				const a = k / n * Math.PI * 2;
				// creases: the plastic hangs in folds
				const fold = 1 + 0.05 * Math.sin( a * 5 + y * 7 ) * ( 1.5 - y );
				row.push( s.v( [ Math.cos( a ) * rx * fold, y, 0.01 + Math.sin( a ) * rz * fold ], [ Math.cos( a ), 0.3, Math.sin( a ) ], [ k / n, y ] ) );

			}

			ids.push( row );

		}

		for ( let i = 0; i < ids.length - 1; i ++ ) for ( let k = 0; k < n; k ++ ) s.quad( ids[ i ][ k ], ids[ i + 1 ][ k ], ids[ i + 1 ][ k + 1 ], ids[ i ][ k + 1 ] );

	} );
	// a messenger bag at the left hip on a strap across the chest; a backpack
	held( B.torso, rest, T.bag, P.bag, ( s ) => s.box( [ - 0.215, 1.0, 0.02 ], [ 0.07, 0.24, 0.3 ] ) );
	held( B.torso, rest, T.strap, P.bag, ( s ) => {

		s.face( [ 0.13, 1.44, - 0.115 ], [ 0.17, 1.42, - 0.11 ], [ - 0.17, 1.08, - 0.125 ], [ - 0.2, 1.1, - 0.12 ], [ 0, 0, - 1 ] );
		s.face( [ 0.13, 1.44, 0.125 ], [ 0.17, 1.42, 0.12 ], [ - 0.17, 1.08, 0.13 ], [ - 0.2, 1.1, 0.125 ], [ 0, 0, 1 ] );

	} );
	held( B.torso, rest, T.bag, P.backpack, ( s ) => {

		s.box( [ 0, 1.2, 0.19 ], [ 0.3, 0.4, 0.14 ] );
		s.box( [ 0, 1.1, 0.27 ], [ 0.22, 0.16, 0.05 ] );

	} );
	held( B.torso, rest, T.strap, P.backpack, ( s ) => {

		for ( const x of [ - 0.1, 0.1 ] ) s.face( [ x - 0.02, 1.45, - 0.1 ], [ x + 0.02, 1.45, - 0.1 ], [ x + 0.03, 1.1, - 0.123 ], [ x - 0.01, 1.1, - 0.123 ], [ 0, 0, - 1 ] );

	} );

	// the umbrella, held up in the right hand: a shaft through the fist, eight ribs of canopy over the head
	const qU = pose( { flexR: 0.5, abductR: 0.14, elbowR: 1.3 } );
	const hU = handR( qU );
	held( B.foreR, qU, T.shaft, P.umbrella, ( s, X ) => {

		s.tube( [ [ hU[ 0 ], hU[ 1 ] - 0.13, hU[ 2 ] ], [ hU[ 0 ], hU[ 1 ] + 0.93, hU[ 2 ] ] ], [ 0.011, 0.008 ], 4, { capA: true } );
		// the J of the handle
		s.tube( [ [ hU[ 0 ], hU[ 1 ] - 0.13, hU[ 2 ] ], [ hU[ 0 ], hU[ 1 ] - 0.18, hU[ 2 ] + 0.03 ], [ hU[ 0 ], hU[ 1 ] - 0.15, hU[ 2 ] + 0.06 ] ], [ 0.014, 0.014, 0.012 ], 4, { capB: true } );

	} );
	held( B.foreR, qU, T.canopy, P.umbrella, ( s ) => {

		const c = [ hU[ 0 ] - 0.03, hU[ 1 ] + 0.78, hU[ 2 ] + 0.05 ], R = 0.56, n = 8;
		const mid = [], rim = [];
		for ( let k = 0; k <= n; k ++ ) {

			const a = k / n * Math.PI * 2, cx = Math.cos( a ), sz = Math.sin( a );
			mid.push( s.v( [ c[ 0 ] + cx * R * 0.55, c[ 1 ] + 0.07, c[ 2 ] + sz * R * 0.55 ], [ cx * 0.5, 1, sz * 0.5 ], [ k, 0.55 ] ) );
			// the rim sags a little between the ribs: the rib tips are the vertices
			rim.push( s.v( [ c[ 0 ] + cx * R, c[ 1 ] - 0.1, c[ 2 ] + sz * R ], [ cx, 0.6, sz ], [ k, 1 ] ) );

		}

		for ( let k = 0; k < n; k ++ ) {

			// an apex of its own for each panel, so the panel's colour holds to the tip
			const apex = s.v( [ c[ 0 ], c[ 1 ] + 0.14, c[ 2 ] ], [ 0, 1, 0 ], [ k + 0.5, 0 ] );
			const m0 = s.v( s.pos.slice( mid[ k ] * 3, mid[ k ] * 3 + 3 ), s.nrm.slice( mid[ k ] * 3, mid[ k ] * 3 + 3 ), [ k + 0.02, 0.55 ] );
			const m1 = s.v( s.pos.slice( mid[ k + 1 ] * 3, mid[ k + 1 ] * 3 + 3 ), s.nrm.slice( mid[ k + 1 ] * 3, mid[ k + 1 ] * 3 + 3 ), [ k + 0.98, 0.55 ] );
			const r0 = s.v( s.pos.slice( rim[ k ] * 3, rim[ k ] * 3 + 3 ), s.nrm.slice( rim[ k ] * 3, rim[ k ] * 3 + 3 ), [ k + 0.02, 1 ] );
			const r1 = s.v( s.pos.slice( rim[ k + 1 ] * 3, rim[ k + 1 ] * 3 + 3 ), s.nrm.slice( rim[ k + 1 ] * 3, rim[ k + 1 ] * 3 + 3 ), [ k + 0.98, 1 ] );
			s.tri( apex, m1, m0 );
			s.quad( m0, m1, r1, r0 );

		}

	} );
	// a cup (a beer, a coffee) upright in the right hand, the forearm across the body
	const qC = pose( { flexR: 0.35, abductR: 0.05, elbowR: 1.45 } );
	const hC = handR( qC );
	held( B.foreR, qC, T.cup, P.cup, ( s ) => s.tube( [ [ hC[ 0 ], hC[ 1 ] - 0.05, hC[ 2 ] ], [ hC[ 0 ], hC[ 1 ] + 0.09, hC[ 2 ] ] ], [ 0.032, 0.042 ], 7, { capA: true, capB: true } ) );
	// a flip phone at the ear
	const qP = pose( { flexR: 1.45, abductR: 0.55, elbowR: 2.55 } );
	const hP = handR( qP );
	held( B.foreR, qP, T.phone, P.phone, ( s ) => s.box( [ hP[ 0 ] - 0.015, hP[ 1 ] + 0.03, hP[ 2 ] - 0.01 ], [ 0.02, 0.1, 0.05 ] ) );
	// a ticket held out
	const qT = pose( { flexR: 0.85, abductR: 0.05, elbowR: 0.45 } );
	const hT = handR( qT );
	held( B.foreR, qT, T.ticket, P.ticket, ( s ) => s.face( [ hT[ 0 ] - 0.02, hT[ 1 ] - 0.01, hT[ 2 ] - 0.02 ], [ hT[ 0 ] - 0.02, hT[ 1 ] + 0.06, hT[ 2 ] - 0.02 ], [ hT[ 0 ] - 0.02, hT[ 1 ] + 0.06, hT[ 2 ] - 0.2 ], [ hT[ 0 ] - 0.02, hT[ 1 ] - 0.01, hT[ 2 ] - 0.2 ], [ 1, 0, 0 ], [ [ 0, 0 ], [ 0, 1 ], [ 1, 1 ], [ 1, 0 ] ] ) );
	// a program, rolled, in the left fist
	held( B.foreL, rest, T.program, P.program, ( s ) => s.tube( [ [ - 0.222, 0.8, 0.07 ], [ - 0.222, 0.8, - 0.2 ] ], [ 0.026, 0.026 ], 6, { capA: true, capB: true } ) );
	// a rally towel hanging from the left hand
	held( B.foreL, rest, T.towel, P.towel, ( s ) => {

		const x = - 0.225;
		s.face( [ x, 0.79, 0.03 ], [ x, 0.79, - 0.2 ], [ x - 0.02, 0.44, - 0.24 ], [ x - 0.02, 0.44, 0.0 ], [ - 1, 0, 0 ], [ [ 0, 0 ], [ 1, 0 ], [ 1, 1 ], [ 0, 1 ] ] );

	} );
	// the ticket taker's scanner, pointing out of the right fist
	const qS = pose( { flexR: 0.45, abductR: 0.08, elbowR: 1.1 } );
	const hS = handR( qS );
	held( B.foreR, qS, T.scanner, P.scanner, ( s ) => {

		s.box( [ hS[ 0 ], hS[ 1 ] + 0.01, hS[ 2 ] - 0.06 ], [ 0.07, 0.045, 0.2 ] );
		s.box( [ hS[ 0 ], hS[ 1 ] - 0.04, hS[ 2 ] + 0.0 ], [ 0.04, 0.09, 0.045 ] );

	} );
	// a brown paper bag of peanuts held out by its rolled top (the bit once meant for a wand: there were
	// none in 2008)
	const qW = pose( { flexR: 0.75, abductR: 0.1, elbowR: 0.7 } );
	const hW = handR( qW );
	held( B.foreR, qW, T.wand, P.sack, ( s ) => {

		s.box( [ hW[ 0 ], hW[ 1 ] - 0.13, hW[ 2 ] ], [ 0.13, 0.2, 0.08 ] );
		s.box( [ hW[ 0 ], hW[ 1 ] - 0.015, hW[ 2 ] ], [ 0.12, 0.05, 0.035 ] );

	} );
	// a flashlight in the other hand
	const qF = pose( { flexL: 0.4, abductL: 0.1, elbowL: 1.0 } );
	const hF = handL( qF );
	held( B.foreL, qF, T.flash, P.flash, ( s ) => s.tube( [ [ hF[ 0 ], hF[ 1 ], hF[ 2 ] + 0.05 ], [ hF[ 0 ], hF[ 1 ] + 0.01, hF[ 2 ] - 0.14 ], [ hF[ 0 ], hF[ 1 ] + 0.012, hF[ 2 ] - 0.16 ] ], [ 0.018, 0.02, 0.026 ], 6, { capA: true, capB: true } ) );
	// a cardboard sign held at the chest
	held( B.torso, rest, T.sign, P.sign, ( s ) => s.face( [ 0.3, 1.12, - 0.3 ], [ - 0.3, 1.12, - 0.3 ], [ - 0.3, 1.52, - 0.32 ], [ 0.3, 1.52, - 0.32 ], [ 0, 0.05, - 1 ], [ [ 0, 1 ], [ 1, 1 ], [ 1, 0 ], [ 0, 0 ] ] ) );
	// a vendor's tray on a strap round the neck, the peanut bags on it
	held( B.torso, rest, T.tray, P.tray, ( s ) => {

		s.box( [ 0, 1.02, - 0.3 ], [ 0.5, 0.08, 0.3 ] );
		for ( let i = 0; i < 6; i ++ ) s.box( [ - 0.18 + ( i % 3 ) * 0.18, 1.1, - 0.37 + Math.floor( i / 3 ) * 0.14 ], [ 0.12, 0.1, 0.1 ] );

	} );
	held( B.torso, rest, T.strap, P.tray, ( s ) => {

		for ( const x of [ - 0.2, 0.2 ] ) s.face( [ x * 0.5 - 0.02, 1.48, - 0.05 ], [ x * 0.5 + 0.02, 1.48, - 0.05 ], [ x + 0.02, 1.06, - 0.16 ], [ x - 0.02, 1.06, - 0.16 ], [ 0, 0.3, - 1 ] );

	} );
	// the reporter's microphone at her chin, the station's flag on it
	const qM = pose( { flexR: 0.7, abductR: 0.12, elbowR: 1.75 } );
	const hM = handR( qM );
	held( B.foreR, qM, T.mic, P.mic, ( s ) => {

		s.tube( [ [ hM[ 0 ], hM[ 1 ] - 0.06, hM[ 2 ] + 0.02 ], [ hM[ 0 ] - 0.01, hM[ 1 ] + 0.16, hM[ 2 ] - 0.04 ] ], [ 0.017, 0.02 ], 6, { capA: true } );
		s.box( [ hM[ 0 ] - 0.008, hM[ 1 ] + 0.1, hM[ 2 ] - 0.02 ], [ 0.07, 0.06, 0.07 ] );
		s.tube( [ [ hM[ 0 ] - 0.01, hM[ 1 ] + 0.16, hM[ 2 ] - 0.04 ], [ hM[ 0 ] - 0.012, hM[ 1 ] + 0.21, hM[ 2 ] - 0.05 ] ], [ 0.032, 0.02 ], 6, { capB: true } );

	} );
	// a kid's glove on the left hand
	held( B.foreL, rest, T.glove, P.glove, ( s ) => {

		s.tube( [ [ - 0.225, 0.9, 0.0 ], [ - 0.23, 0.82, - 0.01 ], [ - 0.228, 0.7, - 0.02 ], [ - 0.225, 0.64, - 0.03 ] ], [ 0.045, 0.07, 0.075, 0.035 ], 8, { capA: true, capB: true } );

	} );
	// a Majestic store bag from the left hand
	held( B.foreL, rest, T.shopbag, P.shopbag, ( s ) => {

		s.box( [ - 0.235, 0.53, - 0.01 ], [ 0.11, 0.36, 0.32 ] );
		s.face( [ - 0.235, 0.71, 0.08 ], [ - 0.235, 0.71, - 0.1 ], [ - 0.225, 0.8, - 0.03 ], [ - 0.225, 0.8, 0.01 ], [ - 1, 0, 0 ] );

	} );
	// a scalper's tickets, fanned, held up
	const qN = pose( { flexR: 2.3, abductR: 0.2, elbowR: 0.5 } );
	const hN = handR( qN );
	held( B.foreR, qN, T.fan, P.fan, ( s ) => {

		for ( let k = 0; k < 4; k ++ ) {

			const a = - 0.5 + k * 0.33, dx = Math.sin( a ) * 0.18, dy = Math.cos( a ) * 0.18;
			const o = [ hN[ 0 ] + k * 0.004, hN[ 1 ] + 0.02, hN[ 2 ] - 0.03 - k * 0.003 ];
			s.face( [ o[ 0 ] - 0.03, o[ 1 ], o[ 2 ] ], [ o[ 0 ] + 0.03, o[ 1 ], o[ 2 ] ], [ o[ 0 ] + 0.03 + dx, o[ 1 ] + dy, o[ 2 ] ], [ o[ 0 ] - 0.03 + dx, o[ 1 ] + dy, o[ 2 ] ], [ 0, 0, - 1 ], [ [ 0, 0 ], [ 1, 0 ], [ 1, 1 ], [ 0, 1 ] ] );

		}

	} );
	// a radio on the left shoulder, a credential on a lanyard
	held( B.torso, rest, T.radio, P.radio, ( s ) => {

		s.box( [ - 0.12, 1.37, - 0.125 ], [ 0.055, 0.1, 0.035 ] );
		s.box( [ - 0.105, 1.45, - 0.125 ], [ 0.008, 0.07, 0.008 ] );

	} );
	held( B.torso, rest, T.badge, P.badge, ( s ) => s.face( [ 0.045, 1.2, - 0.128 ], [ - 0.045, 1.2, - 0.128 ], [ - 0.045, 1.3, - 0.128 ], [ 0.045, 1.3, - 0.128 ], [ 0, 0, - 1 ] ) );

}

// ---------------------------------------------------------------- the backs of the jerseys

function backsAtlas() {

	return canvasTexture( 1024, 512, ( ctx ) => {

		ctx.clearRect( 0, 0, 1024, 512 );
		ctx.textAlign = 'center';
		ctx.textBaseline = 'alphabetic';
		const cellXY = ( i ) => [ ( i % 8 ) * 128, Math.floor( i / 8 ) * 128 ];
		// outline in G, fill in R (drawn over it)
		const text = ( i, str, x, y, font, outline = 6, maxW = 118 ) => {

			const [ cx, cy ] = cellXY( i );
			ctx.font = font;
			if ( outline ) {

				ctx.lineJoin = 'round';
				ctx.strokeStyle = 'rgb(0,255,0)';
				ctx.lineWidth = outline;
				ctx.strokeText( str, cx + x, cy + y, maxW );

			}

			ctx.fillStyle = 'rgb(255,0,0)';
			ctx.fillText( str, cx + x, cy + y, maxW );

		};

		BACKS.forEach( ( [ name, num ], i ) => {

			text( i, name, 64, 30, '700 22px "Arial Narrow", "Helvetica Neue", Helvetica, sans-serif', 4, 112 );
			text( i, String( num ), 64, 112, '700 78px "Arial Narrow", "Helvetica Neue", Helvetica, sans-serif', 8, 118 );

		} );
		text( CELL.script, 'Phillies', 64, 80, 'italic 700 40px "Brush Script MT", "Snell Roundhand", Georgia, serif', 0, 122 );
		text( CELL.security, 'SECURITY', 64, 70, '700 26px Helvetica, Arial, sans-serif', 0, 120 );
		text( CELL.police, 'POLICE', 64, 72, '700 34px Helvetica, Arial, sans-serif', 0, 120 );
		text( CELL.fox, 'FOX 29', 64, 76, '900 38px Helvetica, Arial, sans-serif', 0, 120 );
		text( CELL.rays, 'Rays', 64, 80, 'italic 700 48px Georgia, serif', 0, 120 );
		text( CELL.staff, 'STAFF', 64, 74, '700 34px Helvetica, Arial, sans-serif', 0, 122 );
		text( CELL.capP, 'P', 64, 104, 'italic 700 104px "Brush Script MT", "Snell Roundhand", Georgia, serif', 0, 120 );
		text( CELL.block, 'PHILLIES', 64, 74, '800 28px "Arial Narrow", Helvetica, Arial, sans-serif', 5, 122 );

	}, 'folk-backs' );

}

// ---------------------------------------------------------------- the material

const folkModule = new ShaderModule( { name: 'w1-folk-fk', deps: [ commonModule ], code: FOLK_FK } );

function folkMaterial( info, moved, backs ) {

	const mat = standard( {
		name: 'w1-folk', roughness: 0.85, side: 'double', modules: [ commonModule, folkModule ],
		storage: { folkInfo: info, folkMoved: moved },
		textures: { folkBacks: backs },
		attributes: { aRig: 'vec4f' },
		varyings: { vPart: 'f32', vLook: 'vec4f', vLocal: 'vec3f', vLN: 'vec3f' },
		vertex: /* wgsl */`
	// info: 0 (phase, walk, seed, look) 1 (flexL, abductL, elbowL, flexR) 2 (abductR, elbowR, lean, twist)
	// 3 (yaw, pitch, sit, props)
	let base = v.instance * ${ K }u;
	let i0 = folkInfo[ base ]; let i1 = folkInfo[ base + 1u ]; let i2 = folkInfo[ base + 2u ]; let i3 = folkInfo[ base + 3u ];
	let look = u32( i0.w );
	let props = u32( i3.w );
	let seed = i0.z;
	let rigW = v.aRig.w;
	let bit = i32( floor( rigW / 64.0 ) ) - 1;
	let part = rigW - floor( rigW / 64.0 ) * 64.0;
	var p = v.position;
	var n = v.normal;
	// a prop he isn't carrying folds away to nothing
	let shown = bit < 0 || ( ( props >> u32( max( bit, 0 ) ) ) & 1u ) == 1u;
	// his build: broader in a big coat, a woman narrower at the shoulders; a kid's head bigger
	let hs = fract( seed * 7.13 );
	let woman = ( ( look >> 23u ) & 1u ) == 1u;
	let kid = ( ( look >> 22u ) & 1u ) == 1u;
	let g = select( 0.95 + 0.3 * hs * hs, 0.9 + 0.08 * hs, woman );
	let bA = u32( v.aRig.x + 0.5 ); let bB = u32( v.aRig.y + 0.5 );
	let sh = ( g - 1.0 ) * 0.17 * select( 1.0, 0.6, woman );
	if ( bA == 1u || bA == 0u ) { p.x *= g; p.z *= mix( 1.0, g, 0.8 ); }
	if ( bA >= 7u ) { let s = select( 1.0, -1.0, bA <= 8u ); p.x = s * 0.1 + ( p.x - s * 0.1 ) * mix( 1.0, g, 0.6 ); p.z *= mix( 1.0, g, 0.6 ); }
	if ( bA >= 3u && bA <= 6u ) { p.x += select( 1.0, -1.0, bA <= 4u ) * sh; }
	if ( kid && bA == 2u ) { p = vec3f( 0.0, 1.5, 0.0 ) + ( p - vec3f( 0.0, 1.5, 0.0 ) ) * 1.22; }
	// the walk: the legs swing, the knee bends in the swing, the arms counter (less when the hand's
	// busy), a bob; the rest is the pose he's in
	let ph = i0.x; let wk = i0.y;
	var q: FolkPose;
	let swL = 1.0 - smoothstep( 0.5, 1.2, i1.z ) * 0.85;
	let swR = 1.0 - smoothstep( 0.5, 1.2, i2.y ) * 0.85;
	q.flexL = i1.x - wk * 0.32 * sin( ph ) * swL;
	q.abductL = i1.y; q.elbowL = i1.z + wk * 0.22 * swL;
	q.flexR = i1.w + wk * 0.32 * sin( ph ) * swR;
	q.abductR = i2.x; q.elbowR = i2.y + wk * 0.22 * swR;
	q.lean = i2.z + wk * 0.05; q.twist = i2.w + wk * 0.06 * sin( ph );
	q.yaw = i3.x; q.pitch = i3.y;
	let sit = i3.z;
	q.hipL = wk * 0.42 * sin( ph ) + sit * 1.45;
	q.hipR = - wk * 0.42 * sin( ph ) + sit * 1.45;
	q.kneeL = wk * ( 0.08 + 0.62 * max( 0.0, cos( ph ) ) ) + sit * 1.5;
	q.kneeR = wk * ( 0.08 + 0.62 * max( 0.0, - cos( ph ) ) ) + sit * 1.5;
	q.bob = wk * 0.028 * ( abs( cos( ph ) ) - 0.5 ) - sit * 0.46;
	q.sh = sh;
	let xa = folkBone( bA, q );
	var pp = xa.m * p + xa.t;
	var nn = xa.m * n;
	let w = v.aRig.z;
	if ( w < 0.999 ) {
		let xb = folkBone( bB, q );
		pp = mix( xb.m * p + xb.t, pp, w );
		nn = mix( xb.m * n, nn, w );
	}
	if ( ! shown ) { pp = vec3f( 0.0, -50.0, 0.0 ); }
	v.useWorld = true;
	v.worldPos = ( v.model * vec4f( pp, 1.0 ) ).xyz;
	v.worldNormal = normalize( ( v.model * vec4f( nn, 0.0 ) ).xyz );
	v.prevWorldPos = v.worldPos - folkMoved[ v.instance ].xyz;
	o.vPart = part;
	o.vLook = vec4f( f32( look & 0xFFFFu ), f32( look >> 16u ), seed, f32( props ) );
	// the rest pose's own position for the patterns (a kid's face, a big man's jersey, drawn as on anyone)
	o.vLocal = v.position;
	o.vLN = n;
`,
		surface: /* wgsl */`
	let part = i32( in.vs.vPart + 0.5 );
	let look = u32( in.vs.vLook.x + 0.5 ) | ( u32( in.vs.vLook.y + 0.5 ) << 16u );
	let seed = in.vs.vLook.z;
	let L = in.vs.vLocal;
	let top = look & 31u; let cell = ( look >> 5u ) & 31u; let pantsK = ( look >> 10u ) & 7u; let headK = ( look >> 13u ) & 7u;
	let skinK = ( look >> 16u ) & 3u; let hairK = ( look >> 18u ) & 3u;
	let beard = ( ( look >> 20u ) & 1u ) == 1u; let glasses = ( ( look >> 21u ) & 1u ) == 1u; let woman = ( ( look >> 23u ) & 1u ) == 1u;
	let h = fract( sin( vec4f( seed * 12.9898, seed * 78.233, seed * 39.346, seed * 11.135 ) ) * 43758.5453 );
	let night = smoothstep( 0.15, 0.7, frame.night );
	// ---- the clothes
	let red = vec3f( 0.36, 0.018, 0.025 ) * mix( 0.85, 1.1, h.x );
	var topC = red; var trim = vec3f( 0.03, 0.04, 0.11 ); var rough = 0.85;
	var jersey = 0u; // 1 pinstripes, 2 plain jersey, 3 staff back text
	var backCell = cell; var numFill = red; var numLine = vec3f( 0.02, 0.03, 0.12 );
	var sleeve = vec3f( -1.0 );
	switch top {
		case 0u: { topC = red; backCell = 99u; }
		case 1u: { topC = vec3f( 0.8, 0.79, 0.76 ); jersey = 1u; }
		case 2u: { topC = red; sleeve = vec3f( 0.3, 0.3, 0.3 ) * mix( 0.8, 1.1, h.y ); jersey = 2u; numFill = vec3f( 0.8, 0.79, 0.76 ); numLine = vec3f( 0.8, 0.79, 0.76 ); }
		case 3u: { topC = vec3f( 0.33, 0.5, 0.72 ); jersey = 2u; numFill = vec3f( 0.45, 0.02, 0.05 ); numLine = vec3f( 0.8, 0.79, 0.76 ); }
		case 4u: { topC = vec3f( 0.42, 0.42, 0.42 ); jersey = 2u; }
		case 5u: { topC = vec3f( 0.018 ); backCell = 99u; }
		case 6u: { topC = vec3f( 0.2, 0.2, 0.2 ) * mix( 0.8, 1.3, h.y ); backCell = 99u; }
		case 7u: { topC = vec3f( 0.015, 0.02, 0.06 ); backCell = 99u; }
		case 8u: { topC = vec3f( 0.3, 0.2, 0.09 ); backCell = 99u; rough = 0.95; }
		case 9u: { topC = vec3f( 0.012, 0.01, 0.01 ); backCell = 99u; rough = 0.35; }
		case 10u: { topC = vec3f( 0.0, 0.07, 0.07 ); trim = vec3f( 0.6 ); backCell = 99u; }
		case 11u: { topC = red * 1.1; trim = vec3f( 0.8 ); backCell = 99u; rough = 0.5; }
		case 12u: { topC = vec3f( 0.08, 0.09, 0.05 ); backCell = 99u; }
		case 13u: { topC = vec3f( 0.02 ); trim = vec3f( 0.6, 0.15, 0.01 ); backCell = 99u; }
		case 14u: { topC = vec3f( 0.01, 0.02, 0.07 ); jersey = 2u; numFill = vec3f( 0.3, 0.5, 0.7 ); numLine = vec3f( 0.8 ); }
		case 15u: { topC = vec3f( 0.3, 0.5, 0.7 ); backCell = 99u; }
		case 16u: { topC = red * 0.9; backCell = 99u; rough = 0.95; }
		case 17u: { topC = vec3f( 0.75, 0.74, 0.72 ); backCell = 99u; }
		case 18u: { topC = red; trim = vec3f( 0.02 ); backCell = 99u; rough = 0.55; }
		case 19u: { topC = vec3f( 0.02 ); backCell = 99u; rough = 0.45; }
		case 20u: { topC = vec3f( 0.012, 0.018, 0.06 ); trim = red; jersey = 2u; backCell = 99u; numFill = vec3f( 0.8 ); }
		case 21u: { topC = red; trim = vec3f( 0.02 ); jersey = 3u; backCell = ${ CELL.staff }u; numFill = vec3f( 0.8 ); rough = 0.6; }
		case 22u: { topC = vec3f( 0.012, 0.016, 0.045 ); jersey = 3u; backCell = ${ CELL.police }u; numFill = vec3f( 0.8 ); }
		case 23u: { topC = vec3f( 0.22, 0.22, 0.23 ); trim = vec3f( 0.01 ); backCell = 99u; }
		case 24u: { topC = vec3f( 0.03, 0.04, 0.09 ); backCell = 99u; }
		case 25u: { topC = vec3f( 0.05, 0.05, 0.06 ); backCell = 99u; rough = 0.5; }
		case 26u: { topC = vec3f( 0.02 ); jersey = 3u; backCell = ${ CELL.fox }u; numFill = vec3f( 0.8 ); rough = 0.45; }
		case 27u: { topC = vec3f( 0.012 ); jersey = 3u; backCell = ${ CELL.security }u; numFill = vec3f( 0.75 ); }
		case 28u: { topC = red; backCell = 99u; }
		case 29u: { topC = red; jersey = 2u; numFill = vec3f( 0.8, 0.79, 0.76 ); numLine = vec3f( 0.02, 0.03, 0.12 ); }
		case 30u: { topC = vec3f( 0.3, 0.2, 0.12 ); backCell = 99u; }
		default: { topC = vec3f( 0.55, 0.45, 0.02 ); backCell = 99u; rough = 0.3; }
	}
	var pantsC = vec3f( 0.035, 0.05, 0.11 ) * mix( 0.8, 1.2, h.z );
	switch pantsK {
		case 1u: { pantsC = vec3f( 0.012, 0.016, 0.035 ); }
		case 2u: { pantsC = vec3f( 0.3, 0.24, 0.15 ); }
		case 3u: { pantsC = vec3f( 0.012 ); }
		case 4u: { pantsC = vec3f( 0.16, 0.16, 0.17 ); }
		case 5u: { pantsC = vec3f( 0.012, 0.016, 0.05 ); }
		case 6u: { pantsC = vec3f( 0.14, 0.14, 0.15 ); }
		case 7u: { pantsC = vec3f( 0.08, 0.09, 0.05 ); }
		default: {}
	}
	var skin = vec3f( 0.6, 0.38, 0.27 );
	if ( skinK == 1u ) { skin = vec3f( 0.45, 0.27, 0.17 ); }
	if ( skinK == 2u ) { skin = vec3f( 0.25, 0.13, 0.07 ); }
	if ( skinK == 3u ) { skin = vec3f( 0.12, 0.065, 0.04 ); }
	var hair = vec3f( 0.018, 0.014, 0.01 );
	if ( hairK == 1u ) { hair = vec3f( 0.1, 0.055, 0.025 ); }
	if ( hairK == 2u ) { hair = vec3f( 0.42, 0.3, 0.13 ); }
	if ( hairK == 3u ) { hair = vec3f( 0.3, 0.29, 0.28 ); }
	var capC = red; var capLogo = vec3f( 0.8, 0.79, 0.76 );
	if ( headK == 2u ) { capC = vec3f( 0.012, 0.018, 0.06 ); capLogo = red; }
	if ( headK == 3u ) { capC = vec3f( 0.75, 0.74, 0.72 ); capLogo = red; }
	if ( headK == 4u ) { capC = red; }
	if ( headK == 5u ) { capC = vec3f( 0.18 ); }
	if ( headK == 7u ) { capC = select( vec3f( 0.012, 0.016, 0.045 ), vec3f( 0.03, 0.03, 0.028 ), top == 23u ); }
	var c = topC;
	var e = vec3f( 0.0 );
	var metal = 0.0;
	var wetGloss = 0.0;
	// derivatives up here, where every pixel takes them: the atlas's mip level (its cells are 0.3 m for
	// 128 px) and the pinstripes' width
	let fw = length( fwidth( L ) );
	let lod = log2( max( fw * 430.0, 1.0 ) );
	let onArm = part == 31;
	let arc = atan2( L.z, select( L.x, L.x - sign( L.x ) * 0.2, onArm ) ) * select( 0.17, 0.05, onArm );
	let lw = fwidth( arc ) + 1e-4;
	switch part {
		case 0, 31: {
			// the top: the sleeves a different colour for a tee over a hoodie; the front, the back and
			// the trims
			c = topC;
			if ( onArm && sleeve.x >= 0.0 ) { c = sleeve; }
			// cuffs, the waistband, a zip down the front of a jacket
			if ( L.y < 0.93 && ! onArm ) { c = mix( c, trim, 0.35 ); }
			if ( onArm && L.y < 0.94 ) { c = c * 0.7; }
			if ( ( top >= 5u && top <= 13u ) || top == 18u || top == 19u ) {
				if ( abs( L.x ) < 0.006 + fw && L.z < 0.0 && L.y > 0.9 && L.y < 1.47 ) { c = c * 0.45 + vec3f( 0.04 ); }
				// the stripes on an Eagles or a windbreaker sleeve
				if ( ( top == 10u || top == 11u || top == 13u ) && onArm && abs( L.y - 1.22 ) < 0.03 ) { c = trim; }
			}
			// a puffer's quilting
			if ( top == 19u || top == 18u ) { c = c * ( 0.8 + 0.25 * smoothstep( 0.0, 0.5, abs( fract( L.y / 0.09 ) - 0.5 ) * 2.0 ) ); }
			// pinstripes (the home whites): thin red lines round the body every 2.5 cm, fading to pink far off
			if ( jersey == 1u ) {
				let stripe = 1.0 - smoothstep( 0.002, 0.002 + lw, abs( fract( arc / 0.025 ) - 0.5 ) * 0.025 );
				c = mix( c, red, mix( stripe * 0.9, 0.1, clamp( lw / 0.02, 0.0, 1.0 ) ) );
				if ( onArm && L.y < 1.18 && L.y > 1.13 ) { c = red; }
			}
			// the name and number on the back, the script or the word across the front
			if ( backCell < 32u && L.z > 0.02 && ! onArm ) {
				let uv = vec2f( ( L.x + 0.15 ) / 0.3, 1.0 - ( L.y - 1.0 ) / 0.43 );
				if ( uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0 ) {
					let a = textureSampleLevel( folkBacks, smpLinearClamp, ( vec2f( f32( backCell % 8u ), f32( backCell / 8u ) ) + uv ) / vec2f( 8.0, 4.0 ), lod );
					c = mix( c, numLine, a.g * select( 1.0, 0.0, jersey == 3u ) );
					c = mix( c, numFill, a.r );
				}
			}
			if ( L.z < - 0.02 && ! onArm && ( jersey >= 1u || top == 0u || top == 14u || top == 15u || top == 17u || top == 28u ) ) {
				var fc = select( ${ CELL.script }u, ${ CELL.block }u, top == 0u || top == 17u || top == 28u );
				if ( top == 14u || top == 15u ) { fc = ${ CELL.rays }u; }
				if ( jersey == 3u ) { fc = 99u; }
				let uv = vec2f( ( 0.15 - L.x ) / 0.3, 1.0 - ( L.y - 1.14 ) / 0.3 );
				if ( fc < 32u && uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0 ) {
					let a = textureSampleLevel( folkBacks, smpLinearClamp, ( vec2f( f32( fc % 8u ), f32( fc / 8u ) ) + uv ) / vec2f( 8.0, 4.0 ), lod );
					var ink = select( red, vec3f( 0.8, 0.79, 0.76 ), jersey == 2u || top == 0u || top == 28u || top == 29u );
					if ( top == 14u ) { ink = vec3f( 0.3, 0.5, 0.7 ); }
					if ( top == 15u || top == 17u ) { ink = select( red, vec3f( 0.01, 0.02, 0.07 ), top == 15u ); }
					c = mix( c, numLine, a.g * select( 0.0, 1.0, top == 0u ) );
					c = mix( c, ink, a.r );
				}
			}
			// the hi-vis vest over security's jacket, the police raincoat's bands, a trooper's black trim
			if ( top == 99u && ! onArm && L.y > 0.98 && L.y < 1.43 ) {
				c = vec3f( 0.55, 0.62, 0.02 );
				if ( abs( L.y - 1.1 ) < 0.02 || abs( L.y - 1.22 ) < 0.02 ) { c = vec3f( 0.6 ); e = vec3f( 0.25 ) * night; }
				if ( L.z > 0.02 && L.y > 1.26 && L.y < 1.4 ) {
					let uv = vec2f( ( L.x + 0.15 ) / 0.3, 1.0 - ( L.y - 1.18 ) / 0.3 );
					let a = textureSampleLevel( folkBacks, smpLinearClamp, ( vec2f( f32( ${ CELL.security }u % 8u ), f32( ${ CELL.security }u / 8u ) ) + uv ) / vec2f( 8.0, 4.0 ), lod );
					c = mix( c, vec3f( 0.02 ), a.r );
				}
				e += c * 0.06;
			}
			if ( top == 22u && ( abs( L.y - 1.05 ) < 0.02 || ( onArm && abs( L.y - 1.0 ) < 0.02 ) ) ) { c = vec3f( 0.7, 0.7, 0.3 ); e = vec3f( 0.3, 0.3, 0.12 ) * night; }
			if ( top == 23u && ( abs( L.x ) < 0.004 + fw || ( onArm && abs( fract( atan2( L.z, L.x - sign( L.x ) * 0.2 ) / 6.2832 * 2.0 ) - 0.5 ) < 0.03 ) ) ) { c = vec3f( 0.01 ); }
			if ( top == 20u && L.y > 1.44 ) { c = trim; }
			if ( top == 24u && L.z < 0.0 && L.y < 1.2 && L.y > 0.86 && abs( L.x ) < 0.14 ) { c = vec3f( 0.3, 0.26, 0.2 ); }
		}
		case 1: { c = pantsC; rough = 0.9;
			// jeans' seams, sweats' stripe, the troopers' black stripe
			if ( pantsK == 4u && abs( abs( L.x ) - 0.1 ) > 0.075 && abs( abs( L.x ) - 0.1 ) < 0.09 ) { c = vec3f( 0.6 ); }
			if ( pantsK == 6u && abs( abs( L.x ) - 0.1 ) > 0.078 && abs( abs( L.x ) - 0.1 ) < 0.09 ) { c = vec3f( 0.01 ); }
		}
		case 2: { c = skin; rough = 0.6; }
		case 3: {
			// the face: skin, eyes, brows, the nose's shade, a mouth; cheeks and nose red with the cold;
			// hair, a cap with the P, a beanie's ribs, a hood, a trooper's hat
			let hd = L - vec3f( ${ J.head.join( ', ' ) } );
			c = skin; rough = 0.55;
			let front = hd.z < 0.0;
			let ex = abs( hd.x ) - 0.03;
			if ( front ) {
				let eye = length( vec2f( ex / 1.3, hd.y - 0.012 ) );
				c = mix( c, vec3f( 0.02, 0.015, 0.012 ), 1.0 - smoothstep( 0.006, 0.009 + fw, eye ) );
				c = mix( c, vec3f( 0.75, 0.73, 0.7 ), ( 1.0 - smoothstep( 0.009, 0.011 + fw, eye ) ) * step( 0.004, eye ) * 0.35 );
				let brow = abs( hd.y - 0.032 + ex * ex * 8.0 );
				c = mix( c, hair * 0.8, ( 1.0 - smoothstep( 0.004, 0.006 + fw, brow ) ) * step( abs( ex ), 0.02 ) );
				c = mix( c, c * 0.72, ( 1.0 - smoothstep( 0.006, 0.012, abs( hd.x ) ) ) * step( hd.y, 0.01 ) * step( - 0.022, hd.y ) );
				let mouth = abs( hd.y + 0.042 + hd.x * hd.x * 3.0 );
				c = mix( c, vec3f( 0.25, 0.08, 0.07 ), ( 1.0 - smoothstep( 0.002, 0.004 + fw, mouth ) ) * step( abs( hd.x ), 0.02 ) );
				// the cold: cheeks and the tip of the nose
				c = mix( c, c * vec3f( 1.25, 0.8, 0.78 ), ( 1.0 - smoothstep( 0.0, 0.025, length( vec2f( ex - 0.012, hd.y + 0.018 ) ) ) ) * 0.6 );
				if ( glasses ) {
					let rim = abs( length( vec2f( ex, hd.y - 0.012 ) ) - 0.017 );
					c = mix( c, vec3f( 0.01 ), 1.0 - smoothstep( 0.0015, 0.003 + fw, rim ) );
					if ( abs( hd.y - 0.014 ) < 0.0025 && abs( hd.x ) < 0.012 ) { c = vec3f( 0.01 ); }
				}
				if ( beard && hd.y < - 0.015 ) { c = mix( c, hair * 0.9, smoothstep( - 0.015, - 0.03, hd.y ) * 0.9 * ( 1.0 - smoothstep( - 0.034, - 0.028, hd.y ) * ( 1.0 - smoothstep( 0.006, 0.01, abs( hd.x ) ) ) * 0.6 ) ); }
			}
			// hair: over the top, down the back, a hairline at the brow
			let hairline = hd.y > 0.045 - 0.05 * smoothstep( - 0.02, 0.07, hd.z ) || ( hd.z > 0.03 && hd.y > - 0.04 );
			let bald = fract( seed * 3.7 ) < 0.12 && ! woman;
			if ( hairline && ! ( bald && hd.y > 0.06 ) ) { c = hair; rough = 0.7; }
			if ( headK == 1u || headK == 2u || headK == 3u || headK == 7u ) {
				if ( hd.y > 0.035 - 0.012 * smoothstep( -0.05, 0.05, hd.z ) ) {
					c = capC; rough = 0.8;
					// the P on the front panel
					if ( headK < 7u && hd.z < - 0.03 ) {
						let uv = vec2f( ( 0.03 - hd.x ) / 0.06, 1.0 - ( hd.y - 0.038 ) / 0.055 );
						if ( uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0 ) {
							let a = textureSampleLevel( folkBacks, smpLinearClamp, ( vec2f( f32( ${ CELL.capP }u % 8u ), f32( ${ CELL.capP }u / 8u ) ) + uv ) / vec2f( 8.0, 4.0 ), lod );
							c = mix( c, capLogo, a.r );
						}
					}
					// a button on top
					if ( length( hd.xz ) < 0.008 ) { c = capC * 0.6; }
				}
			}
			if ( headK == 4u || headK == 5u ) {
				if ( hd.y > 0.02 ) {
					c = capC * ( 0.8 + 0.25 * step( 0.5, fract( atan2( hd.z, hd.x ) * 12.0 ) ) );
					if ( headK == 4u && abs( hd.y - 0.055 ) < 0.012 ) { c = vec3f( 0.8, 0.79, 0.76 ); }
					if ( hd.y < 0.04 ) { c = c * 0.85; }
					rough = 0.95;
				}
			}
		}
		case 4: { c = select( vec3f( 0.02 ), vec3f( 0.6, 0.6, 0.58 ), fract( seed * 11.0 ) < 0.35 ); rough = 0.6; if ( L.y < 0.025 ) { c = vec3f( 0.03 ); } }
		case 5: { c = skin; rough = 0.6; if ( fract( seed * 5.1 ) < 0.3 ) { c = select( red, vec3f( 0.03, 0.03, 0.05 ), fract( seed * 9.7 ) < 0.5 ); rough = 0.95; } }
		case 6: { c = capC * 0.9; }
		case 7: { c = select( vec3f( 0.8 ), red, headK == 5u ); rough = 1.0; }
		case 8: { c = select( topC, vec3f( 0.3, 0.3, 0.31 ), sleeve.x >= 0.0 ); rough = 0.85; if ( top == 23u ) { c = vec3f( 0.25, 0.25, 0.24 ); } }
		case 9: {
			// the poncho: clear (the jacket showing through, milky), MLB red, or yellow
			let pk = u32( fract( seed * 13.7 ) * 4.0 );
			c = select( select( select( mix( topC * 0.8, vec3f( 0.3, 0.31, 0.33 ), 0.3 ), red * 1.1, pk == 1u ), vec3f( 0.55, 0.42, 0.02 ), pk == 2u ), vec3f( 0.015 ), pk == 3u );
			rough = 0.25; wetGloss = 1.0;
		}
		case 10: { c = select( vec3f( 0.02, 0.02, 0.025 ), vec3f( 0.08, 0.05, 0.03 ), fract( seed * 3.1 ) < 0.4 ); rough = 0.7; }
		case 11: { c = vec3f( 0.015 ); }
		case 12: {
			// the umbrella: black, navy, red, a golf umbrella in red and white panels, one in plaid
			let k = u32( fract( seed * 5.3 ) * 7.0 );
			let panel = u32( floor( in.uv.x ) ) % 2u;
			c = vec3f( 0.012 );
			if ( k == 1u ) { c = vec3f( 0.01, 0.014, 0.05 ); }
			if ( k == 2u ) { c = red; }
			if ( k == 3u ) { c = select( red, vec3f( 0.8, 0.79, 0.76 ), panel == 1u ); }
			if ( k == 4u ) { c = mix( vec3f( 0.1, 0.01, 0.01 ), vec3f( 0.02, 0.05, 0.02 ), step( 0.5, fract( in.uv.x * 6.0 ) ) ) * ( 0.8 + 0.4 * step( 0.5, fract( in.uv.y * 9.0 ) ) ); }
			if ( k == 5u ) { c = vec3f( 0.25, 0.25, 0.26 ); }
			rough = 0.4; wetGloss = 1.0;
		}
		case 13: { c = vec3f( 0.03 ); metal = 0.6; rough = 0.4; }
		case 14: {
			// a beer (clear plastic, gold) or a coffee (white, a brown sleeve)
			let beer = fract( seed * 7.7 ) < 0.5;
			c = select( vec3f( 0.8, 0.79, 0.76 ), vec3f( 0.5, 0.33, 0.04 ), beer );
			if ( ! beer && abs( L.y - 0.79 ) < 0.03 ) { c = vec3f( 0.25, 0.13, 0.06 ); }
			rough = 0.3;
		}
		case 15: { c = vec3f( 0.15, 0.15, 0.16 ); metal = 0.5; rough = 0.35; e = vec3f( 0.2, 0.35, 0.5 ) * 0.3 * night; }
		case 16: { c = vec3f( 0.8, 0.79, 0.74 ); if ( in.uv.y > 0.6 ) { c = vec3f( 0.5, 0.05, 0.06 ); } }
		case 17: { c = mix( vec3f( 0.7, 0.68, 0.62 ), vec3f( 0.08, 0.1, 0.3 ), step( 0.5, fract( in.uv.x * 3.0 ) ) ); }
		case 18: { c = select( vec3f( 0.8, 0.79, 0.76 ), red, fract( seed * 3.3 ) < 0.35 ); rough = 0.95; }
		case 19: { c = vec3f( 0.02 ); if ( in.uv.y > 0.8 ) { c = vec3f( 0.5, 0.02, 0.02 ); e = vec3f( 0.8, 0.02, 0.02 ) * night; } }
		case 20: { c = vec3f( 0.36, 0.24, 0.13 ) * ( 0.85 + 0.25 * fract( L.y * 37.0 ) ); rough = 0.95; } // brown paper
		case 21: { c = vec3f( 0.04 ); metal = 0.7; rough = 0.3; }
		case 22: {
			// cardboard, marker: NEED TIX
			c = vec3f( 0.45, 0.33, 0.19 );
			let q = in.uv;
			let ink = step( abs( fract( q.x * 7.0 ) - 0.5 ), 0.18 ) * step( abs( q.y - 0.35 ), 0.12 ) + step( abs( fract( q.x * 5.0 + 0.2 ) - 0.5 ), 0.2 ) * step( abs( q.y - 0.7 ), 0.12 );
			c = mix( c, vec3f( 0.02 ), clamp( ink, 0.0, 1.0 ) * step( 0.1, q.x ) * step( q.x, 0.9 ) );
		}
		case 23: { c = select( vec3f( 0.45, 0.33, 0.18 ), vec3f( 0.6, 0.45, 0.25 ), L.y > 1.05 ); }
		case 24: { c = vec3f( 0.03 ); if ( L.y > 0.9 ) { c = vec3f( 0.02 ); } }
		case 25: { c = vec3f( 0.25, 0.1, 0.03 ); rough = 0.5; }
		case 26: { c = hair; rough = 0.7; }
		case 27: { c = vec3f( 0.78, 0.77, 0.74 ); if ( abs( fract( in.uv.y * 2.0 ) - 0.5 ) < 0.1 ) { c = red; } rough = 0.5; }
		case 28: { c = vec3f( 0.8, 0.78, 0.72 ); if ( in.uv.y > 0.75 ) { c = vec3f( 0.45, 0.03, 0.05 ); } }
		case 29: { c = vec3f( 0.02 ); }
		case 30: { c = vec3f( 0.8 ); }
		default: {}
	}
	// the rain: cloth soaks dark where it faces the sky; plastic, leather and umbrellas bead and shine
	let N = normalize( in.N );
	let up = clamp( N.y * 0.7 + 0.45, 0.0, 1.0 );
	let wet = frame.wet;
	if ( wetGloss > 0.5 ) { rough = mix( rough, 0.12, wet ); }
	else { c = c * mix( 1.0, 0.72, wet * up * select( 1.0, 0.3, part == 2 || part == 3 ) ); rough = mix( rough, rough * 0.8, wet * up ); }
	s.albedo = c;
	s.roughness = rough;
	s.metalness = metal;
	// the ambient of a city night: they shouldn't go black between the lamps
	s.emissive = e + c * night * 0.05;
`,
	} );
	mat.setDefine( 'DRY', 1 );
	mat.underwaterLighting = 'none';
	return mat;

}

// ---------------------------------------------------------------- the crowd

export class Folk {

	constructor( parent, field ) {

		this.field = field;
		this.info = new Float32Array( MAX * K * 4 );
		this.infoBuffer = new StorageBuffer( { label: 'folkInfo', count: MAX * K, type: 'vec4f' } );
		this.moved = new Float32Array( MAX * 4 );
		this.movedBuffer = new StorageBuffer( { label: 'folkMoved', count: MAX, type: 'vec4f' } );
		this.backs = backsAtlas();
		this.geometry = figureGeometry();
		this.material = folkMaterial( this.infoBuffer, this.movedBuffer, this.backs );
		this.mesh = new InstancedMesh( this.geometry, this.material, MAX );
		this.mesh.name = 'w1-folk';
		this.mesh.frustumCulled = false;
		this.mesh.castShadow = false;
		this.mesh.receiveShadow = true;
		this.mesh.userData.dynamic = true;
		parent.add( this.mesh );
		// a soft dark patch under each (grounds them in the lamplight and on the wet paving)
		const blobGeo = new PlaneGeometry( 1, 1 );
		blobGeo.rotateX( - Math.PI / 2 );
		const blobMat = standard( { name: 'w1-folk-contact', color: new Color( 0, 0, 0 ), transparent: true, depthWrite: false, lit: false,
			surface: 'let r = length( in.uv - 0.5 ) * 2.0; s.albedo = vec3f( 0.0 ); s.alpha = ( 1.0 - smoothstep( 0.15, 1.0, r ) ) * 0.5;' } );
		blobMat.underwaterLighting = 'none';
		this.blobs = new InstancedMesh( blobGeo, blobMat, MAX );
		this.blobs.name = 'w1-folk-contact';
		this.blobs.frustumCulled = false;
		this.blobs.layers.set( 2 );
		this.blobs.userData.dynamic = true;
		// where they are (for ?focus=: an instanced mesh's own box is taken from its matrices at the build, all at the origin)
		for ( const m of [ this.mesh, this.blobs ] ) m.boundingSphere = new Sphere( new Vector3( - 100, 7, 60 ), 130 );
		parent.add( this.blobs );
		this.list = [];
		this._m = new Matrix4();
		this._q = new Quaternion();
		this._v = new Vector3();
		this._s = new Vector3();
		this._up = new Vector3( 0, 1, 0 );

	}

	add( o = {} ) {

		if ( this.list.length >= MAX ) return null;
		const f = {
			x: 0, y: LEVELS_STREET, z: 0, yaw: 0, scale: 1, look: 0, props: 0, seed: Math.random(),
			walk: 0, phase: Math.random() * 6.28, sit: 0, visible: true, pose: pose(), ...o,
		};
		if ( o.pose ) f.pose = pose( o.pose );
		this.list.push( f );
		return f;

	}

	update() {

		const M = this._m, q = this._q, v = this._v, s = this._s;
		const rot = this.field.group.rotation.y, cy = Math.cos( rot ), sy = Math.sin( rot );
		let n = 0;
		for ( const f of this.list ) {

			if ( ! f.visible ) {

				f.px = undefined;
				continue;

			}

			const dx = f.px === undefined ? 0 : f.x - f.px, dz = f.px === undefined ? 0 : f.z - f.pz, dy = f.px === undefined ? 0 : f.y - f.py;
			this.moved.set( [ dx * cy + dz * sy, dy, - dx * sy + dz * cy, 0 ], n * 4 );
			f.px = f.x; f.py = f.y; f.pz = f.z;
			q.setFromAxisAngle( this._up, f.yaw );
			M.compose( v.set( f.x, f.y, f.z ), q, s.setScalar( f.scale ) );
			this.mesh.setMatrixAt( n, M );
			M.compose( v.set( f.x, f.y + 0.012, f.z ), q, s.set( 0.75 * f.scale, 1, 0.6 * f.scale ) );
			this.blobs.setMatrixAt( n, M );
			const p = f.pose, o = n * K * 4;
			const I = this.info;
			I[ o ] = f.phase; I[ o + 1 ] = Math.min( 1, f.walk ); I[ o + 2 ] = f.seed; I[ o + 3 ] = f.look;
			I[ o + 4 ] = p.flexL; I[ o + 5 ] = p.abductL; I[ o + 6 ] = p.elbowL; I[ o + 7 ] = p.flexR;
			I[ o + 8 ] = p.abductR; I[ o + 9 ] = p.elbowR; I[ o + 10 ] = p.lean; I[ o + 11 ] = p.twist;
			I[ o + 12 ] = p.yaw; I[ o + 13 ] = p.pitch; I[ o + 14 ] = f.sit; I[ o + 15 ] = f.props;
			n ++;

		}

		this.mesh.count = Math.max( 1, n );
		this.blobs.count = Math.max( 1, n );
		if ( ! n ) this.mesh.setMatrixAt( 0, M.makeScale( 0, 0, 0 ) );
		this.mesh.instanceMatrix.needsUpdate = true;
		this.blobs.instanceMatrix.needsUpdate = true;
		this.infoBuffer.write( this.info );
		this.movedBuffer.write( this.moved );
		this.count = n;

	}

}

const LEVELS_STREET = 7.0104;
export { figureGeometry };
