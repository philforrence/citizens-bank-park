import { InstancedMesh, BufferGeometry, InterleavedBuffer, InterleavedBufferAttribute, Vector3, Vector4, Sphere, Box3, Matrix4 } from '../engine/index.js';
import { ShaderModule } from '../engine/gpu/Shader.js';
import { ComputeKernel } from '../engine/gpu/Compute.js';
import { UniformBlock } from '../engine/gpu/Uniforms.js';
import { StorageBuffer } from '../engine/gpu/Texture.js';
import { standard } from '../materials/Materials.js';

// The crowd: Game 5 was a sellout (45,940 on October 27, the same again for the resumption on the 29th),
// so a fan in nearly every seat. One low-poly seated figure, instanced on the seats' own matrices (the
// stands add a crowd chunk beside each chunk of seats). Who sits in each seat is decided here, on the
// CPU, when the chunk is added: age, build, skin and hair, the jacket or jersey (and whose number), the
// hat, glasses, a beard, a scarf, gloves, a blanket, what's in his hand, whether he has a sign or a
// towel, whether he's a Rays fan, how he behaves. It's packed into three integers per fan (the instance
// colour attribute) and the shaders dress and move him. Six poses are morphed per vertex: sitting and
// standing, each with the arms at rest, raised, or a hand brought to the face (a drink, a phone, the
// camera, praying hands), per arm; what everyone is doing follows the game (mood(), set every frame from
// the replay: two strikes, two outs, a Phillies rally, the last out), rippling out from the play.
//
//   const crowd = new Crowd();
//   crowd.addChunk( group, seatMatrices, tierName, seatInfo )   (Stands.js)
//   crowd.update( director, dt, rain ), crowd.lod( camera )     (every frame)

// the figure's joints: sitting (feet on the tread, origin under the seat's middle, facing -z), standing,
// and each arm raised or brought to the face (the right side; the left mirrors it)
const SIT = {
	hip: [ 0.1, 0.5, 0.06 ], knee: [ 0.12, 0.52, - 0.36 ], ankle: [ 0.12, 0.07, - 0.42 ],
	pelvis: [ 0, 0.47, 0.1 ], chest: [ 0, 0.96, 0.15 ], neck: [ 0, 1.02, 0.14 ], head: [ 0, 1.14, 0.12 ],
	shoulder: [ 0.2, 0.94, 0.14 ], elbow: [ 0.23, 0.68, 0.06 ], wrist: [ 0.15, 0.6, - 0.16 ], hand: [ 0.12, 0.59, - 0.25 ],
};
const SIT_UP = { elbow: [ 0.3, 1.2, 0.08 ], wrist: [ 0.3, 1.46, 0.02 ], hand: [ 0.29, 1.56, 0.0 ] };
const SIT_FACE = { elbow: [ 0.23, 0.71, 0.02 ], wrist: [ 0.1, 0.93, - 0.04 ], hand: [ 0.06, 1.01, - 0.01 ] };
const STAND = {
	hip: [ 0.1, 0.9, 0.0 ], knee: [ 0.11, 0.5, - 0.04 ], ankle: [ 0.12, 0.07, - 0.06 ],
	pelvis: [ 0, 0.88, 0.02 ], chest: [ 0, 1.38, 0.03 ], neck: [ 0, 1.45, 0.03 ], head: [ 0, 1.57, 0.02 ],
	shoulder: [ 0.2, 1.37, 0.03 ], elbow: [ 0.24, 1.1, 0.05 ], wrist: [ 0.23, 0.86, 0.0 ], hand: [ 0.22, 0.77, - 0.01 ],
};
const STAND_UP = { elbow: [ 0.3, 1.64, 0.0 ], wrist: [ 0.31, 1.9, - 0.05 ], hand: [ 0.3, 2.0, - 0.06 ] };
const STAND_FACE = { elbow: [ 0.23, 1.14, - 0.1 ], wrist: [ 0.1, 1.36, - 0.15 ], hand: [ 0.06, 1.44, - 0.12 ] };
// the six morph targets: [ base, arm ]
const POSES = [ [ SIT, null ], [ STAND, null ], [ SIT, SIT_UP ], [ STAND, STAND_UP ], [ SIT, SIT_FACE ], [ STAND, STAND_FACE ] ];

// parts (the shaders dress and move by them)
const P = { shirt: 0, pants: 1, hand: 2, head: 3, brim: 4, towel: 5, sleeve: 6, neck: 7, prop: 8, sign: 9, hair: 10, blanket: 11 };

// Levels of detail, chosen per chunk by how big its fans are on screen (lod()): the full figure (hands,
// neck, 8-sided trunk, a round head, the thing in his hand), a middle one (6 and 3 sides) and a far one
// (4-sided trunk, straight arms and legs, a 5-sided head) for fans a few pixels tall
const LODS = [
	{ trunk: 8, limb: 4, head: [ 8, 5 ], neck: true, hands: true, joints: true, prop: true, hair: true },
	{ trunk: 6, limb: 3, head: [ 6, 4 ], neck: false, hands: false, joints: true, prop: false, hair: true },
	{ trunk: 4, limb: 3, head: [ 5, 3 ], neck: false, hands: false, joints: false, prop: false, hair: false },
];

// stride of the interleaved vertex: position, normal, aStand, aStandN, aSitUp, aStandUp, aSitFace,
// aStandFace (3 each), aInfo (4: the part and side, then t, a, b: where on the part)
const STRIDE = 28;

function fanGeometry( lod ) {

	const L = LODS[ lod ];
	const verts = [], index = [];
	const sub = ( a, b ) => [ a[ 0 ] - b[ 0 ], a[ 1 ] - b[ 1 ], a[ 2 ] - b[ 2 ] ];
	const add = ( a, b ) => [ a[ 0 ] + b[ 0 ], a[ 1 ] + b[ 1 ], a[ 2 ] + b[ 2 ] ];
	const mul = ( a, k ) => [ a[ 0 ] * k, a[ 1 ] * k, a[ 2 ] * k ];
	const cross = ( a, b ) => [ a[ 1 ] * b[ 2 ] - a[ 2 ] * b[ 1 ], a[ 2 ] * b[ 0 ] - a[ 0 ] * b[ 2 ], a[ 0 ] * b[ 1 ] - a[ 1 ] * b[ 0 ] ];
	const norm = ( a ) => mul( a, 1 / ( Math.hypot( ...a ) || 1 ) );
	// a joint in pose k, on side s (+1 the right, -1 the left)
	const joint = ( k, name, s ) => {

		const [ base, arm ] = POSES[ k ];
		const j = ( arm && arm[ name ] ) || base[ name ];
		return [ j[ 0 ] * s, j[ 1 ], j[ 2 ] ];

	};

	// one vertex: its place in the six poses, its normal sitting and standing, what it belongs to
	const vert = ( p6, n0, n1, part, side, t = 0, a = 0, b = 0 ) => {

		verts.push( { p6, n0, n1, code: part + 16 * ( side + 1 ), t, a, b } );
		return verts.length - 1;

	};

	// a ring of n points round the segment a -> b at its end t (0 or 1), radii rx (across) and rz (depth)
	const ring = ( a, b, t, n, rx, rz ) => {

		const ax = norm( sub( b, a ) );
		let across = norm( cross( ax, [ 0, 0, 1 ] ) );
		if ( Math.hypot( ...cross( ax, [ 0, 0, 1 ] ) ) < 0.2 ) across = norm( cross( ax, [ 0, 1, 0 ] ) );
		const depth = norm( cross( across, ax ) );
		const c = add( a, mul( sub( b, a ), t ) );
		const out = [];
		for ( let k = 0; k < n; k ++ ) {

			const ang = ( k / n ) * Math.PI * 2 + Math.PI / n;
			const d = add( mul( across, Math.cos( ang ) ), mul( depth, Math.sin( ang ) ) );
			out.push( [ add( c, add( mul( across, Math.cos( ang ) * rx ), mul( depth, Math.sin( ang ) * rz ) ) ), norm( d ) ] );

		}

		return out;

	};

	// a tube between two joints in all six poses; rA / rB radii at the ends ( [ across, depth ] ); the
	// fewer the sides, the further out the corners go so the flats keep the silhouette. Each vertex keeps
	// t (along the tube, + t0) and where round it it is (a across, b toward the back, metres)
	const tube = ( ja, jb, s, rA, rB, part, side, n, cap = false, t0 = 0 ) => {

		const f = ( 1 + 1 / Math.cos( Math.PI / n ) ) / 2;
		const base = verts.length;
		for ( const t of [ 0, 1 ] ) {

			const r = t ? rB : rA;
			const rings = POSES.map( ( _, k ) => ring( joint( k, ja, s ), joint( k, jb, s ), t, n, r[ 0 ] * f, r[ 1 ] * f ) );
			for ( let k = 0; k < n; k ++ ) {

				const ang = ( k / n ) * Math.PI * 2 + Math.PI / n;
				vert( rings.map( ( rg ) => rg[ k ][ 0 ] ), rings[ 0 ][ k ][ 1 ], rings[ 1 ][ k ][ 1 ], part, side, t + t0, Math.cos( ang ) * r[ 0 ], Math.sin( ang ) * r[ 1 ] );

			}

		}

		for ( let k = 0; k < n; k ++ ) {

			const a = base + k, b = base + ( k + 1 ) % n, c = base + n + k, d = base + n + ( k + 1 ) % n;
			index.push( a, b, c, b, d, c );

		}

		if ( cap ) for ( let k = 1; k < n - 1; k ++ ) index.push( base + n, base + n + k + 1, base + n + k );

	};

	// the same point in every pose but the arms' (a head, a brim, hair), sitting at sit, standing at st
	const fixed = ( sit, st ) => [ sit, st, sit, st, sit, st ];

	// the trunk (a jacket over the shoulders), the neck
	tube( 'pelvis', 'chest', 1, [ 0.17, 0.12 ], [ 0.2, 0.11 ], P.shirt, 0, L.trunk, true );
	if ( L.neck ) tube( 'chest', 'neck', 1, [ 0.12, 0.09 ], [ 0.055, 0.05 ], P.neck, 0, 8 );
	for ( const s of [ - 1, 1 ] ) {

		// the sleeves (t 0..1 the upper arm, 1..2 the forearm), the hands; the legs
		if ( L.joints ) {

			tube( 'shoulder', 'elbow', s, [ 0.06, 0.06 ], [ 0.05, 0.05 ], P.sleeve, s, L.limb );
			tube( 'elbow', 'wrist', s, [ 0.05, 0.05 ], [ 0.042, 0.042 ], P.sleeve, s, L.limb, false, 1 );
			tube( 'hip', 'knee', s, [ 0.085, 0.085 ], [ 0.06, 0.06 ], P.pants, 0, L.limb );
			tube( 'knee', 'ankle', s, [ 0.058, 0.058 ], [ 0.05, 0.05 ], P.pants, 0, L.limb, false, 1 );

		} else {

			tube( 'shoulder', 'wrist', s, [ 0.06, 0.06 ], [ 0.045, 0.045 ], P.sleeve, s, L.limb );
			tube( 'hip', 'ankle', s, [ 0.08, 0.08 ], [ 0.055, 0.055 ], P.pants, 0, L.limb );

		}

		if ( L.hands ) tube( 'wrist', 'hand', s, [ 0.035, 0.02 ], [ 0.03, 0.018 ], P.hand, s, 4 );

	}

	// the head: a low sphere round its centre in each pose (the shaders put the hair, a cap, a hood and
	// the face on it); its top vertex is marked (t = 1): a knit hat's peak
	{

		const [ W, H ] = L.head, r = [ 0.082, 0.105, 0.098 ];
		const first = verts.length;
		for ( let j = 0; j <= H; j ++ ) for ( let i = 0; i < W; i ++ ) {

			const th = j / H * Math.PI, ph = i / W * Math.PI * 2;
			const d = [ Math.sin( th ) * Math.cos( ph ), Math.cos( th ), Math.sin( th ) * Math.sin( ph ) ];
			const o = [ d[ 0 ] * r[ 0 ], d[ 1 ] * r[ 1 ], d[ 2 ] * r[ 2 ] ];
			vert( fixed( add( SIT.head, o ), add( STAND.head, o ) ), d, d, P.head, 0, j === 0 ? 1 : 0 );

		}

		for ( let j = 0; j < H; j ++ ) for ( let i = 0; i < W; i ++ ) {

			const a = first + j * W + i, b = first + j * W + ( i + 1 ) % W, c = a + W, d = b + W;
			if ( j > 0 ) index.push( a, b, c );
			if ( j < H - 1 ) index.push( b, d, c );

		}

		// a cap's brim (collapsed for the bareheaded)
		const brim = [ [ - 0.075, 0.055, - 0.06 ], [ 0.075, 0.055, - 0.06 ], [ 0.07, 0.045, - 0.16 ], [ - 0.07, 0.045, - 0.16 ] ].map( ( o ) => vert( fixed( add( SIT.head, o ), add( STAND.head, o ) ), [ 0, 1, 0 ], [ 0, 1, 0 ], P.brim ) );
		index.push( brim[ 0 ], brim[ 2 ], brim[ 1 ], brim[ 0 ], brim[ 3 ], brim[ 2 ] );

		// long hair (or a ponytail) down the back of the head
		if ( L.hair ) {

			const q = [];
			for ( const [ u, v ] of [ [ 0, 0 ], [ 1, 0 ], [ 1, 1 ], [ 0, 1 ] ] ) {

				const o = [ ( 0.085 + 0.015 * v ) * ( 1 - 2 * u ), 0.03 - 0.23 * v, 0.066 + 0.02 * v ];
				q.push( vert( fixed( add( SIT.head, o ), add( STAND.head, o ) ), [ 0, 0.2, 1 ], [ 0, 0.2, 1 ], P.hair, 0, 0, u, v ) );

			}

			index.push( q[ 0 ], q[ 2 ], q[ 1 ], q[ 0 ], q[ 3 ], q[ 2 ] );

		}

	}

	// the rally towel in the right hand: on the lap sitting, hanging from the hand held up (u across,
	// v down it; t = 1 at the loose end)
	{

		const q = [];
		for ( const [ dx, dy, tip ] of [ [ - 0.14, 0, 0 ], [ 0.14, 0, 0 ], [ 0.14, - 0.32, 1 ], [ - 0.14, - 0.32, 1 ] ] ) {

			const hand = ( k ) => joint( k, 'hand', 1 );
			const lap = add( hand( 0 ), [ dx, 0.03, dy * 0.6 ] );
			const lapS = add( hand( 1 ), [ dx * 0.5, dy * 0.8, 0.02 ] );
			const up = add( hand( 2 ), [ dx, dy + 0.02, 0 ] );
			const upS = add( hand( 3 ), [ dx, dy + 0.02, 0 ] );
			q.push( vert( [ lap, lapS, up, upS, lap, lapS ], [ 0, 0, - 1 ], [ 0, 0, - 1 ], P.towel, 1, tip, dx > 0 ? 0 : 1, tip ) );

		}

		index.push( q[ 0 ], q[ 2 ], q[ 1 ], q[ 0 ], q[ 3 ], q[ 2 ] );

	}

	// the sign, in both hands: flat on the lap sitting, at the waist standing, over the head held up. u
	// runs from his right (the viewer's left) to his left, v down it
	{

		const at = ( k, u, v ) => {

			const x = ( k >= 2 && k <= 3 ? 0.36 : 0.3 ) * ( 1 - 2 * u );
			if ( k === 2 ) return [ x, 1.97 - 0.51 * v, - 0.1 + 0.02 * v ];
			if ( k === 3 ) return [ x, 2.4 - 0.51 * v, - 0.14 + 0.02 * v ];
			if ( k % 2 === 0 ) return [ x, 0.62 - 0.02 * v, - 0.46 + 0.4 * v ];
			return [ x, 1.1 - 0.5 * v, - 0.2 ];

		};
		const q = [];
		for ( const [ u, v ] of [ [ 0, 0 ], [ 1, 0 ], [ 1, 1 ], [ 0, 1 ] ] ) q.push( vert( POSES.map( ( _, k ) => at( k, u, v ) ), [ 0, 1, 0 ], [ 0, 0, - 1 ], P.sign, u ? - 1 : 1, 0, u, v ) );
		index.push( q[ 0 ], q[ 2 ], q[ 1 ], q[ 0 ], q[ 3 ], q[ 2 ] );

	}

	// a blanket: over the lap and the knees sitting, round the shoulders standing
	if ( L.hair ) {

		const q = [];
		const sit = [ [ 0.23, 0.56, 0.06 ], [ 0.25, 0.58, - 0.42 ], [ 0.25, 0.22, - 0.47 ] ];
		const st = [ [ 0.22, 1.38, 0.12 ], [ 0.27, 0.98, 0.17 ], [ 0.26, 0.7, 0.16 ] ];
		const nS = [ [ 0, 1, 0 ], [ 0, 0.6, - 0.8 ], [ 0, 0, - 1 ] ];
		for ( let j = 0; j < 3; j ++ ) for ( const u of [ 0, 1 ] ) {

			const k = 1 - 2 * u;
			q.push( vert( fixed( [ sit[ j ][ 0 ] * k, sit[ j ][ 1 ], sit[ j ][ 2 ] ], [ st[ j ][ 0 ] * k, st[ j ][ 1 ], st[ j ][ 2 ] ] ), nS[ j ], [ 0, 0.1, 1 ], P.blanket, 0, 0, u, j / 2 ) );

		}

		for ( const j of [ 0, 2 ] ) index.push( q[ j ], q[ j + 3 ], q[ j + 1 ], q[ j ], q[ j + 2 ], q[ j + 3 ] );

	}

	// what he has in his left hand: a box the shader sizes for a beer, a hot dog, a camera, a glove...
	// (every vertex at the hand, t a b = the corner)
	if ( L.prop ) {

		const hand = POSES.map( ( _, k ) => joint( k, 'hand', - 1 ) );
		for ( const [ ax, sg ] of [ [ 0, 1 ], [ 0, - 1 ], [ 1, 1 ], [ 1, - 1 ], [ 2, 1 ], [ 2, - 1 ] ] ) {

			const n = [ 0, 0, 0 ];
			n[ ax ] = sg;
			const u = [ ( ax + 1 ) % 3, ( ax + 2 ) % 3 ];
			const q = [];
			for ( const [ a, b ] of [ [ - 1, - 1 ], [ 1, - 1 ], [ 1, 1 ], [ - 1, 1 ] ] ) {

				const c = [ 0, 0, 0 ];
				c[ ax ] = sg * 0.5;
				c[ u[ 0 ] ] = a * 0.5;
				c[ u[ 1 ] ] = b * 0.5;
				q.push( vert( hand, n, n, P.prop, - 1, c[ 1 ], c[ 0 ], c[ 2 ] ) );

			}

			index.push( q[ 0 ], q[ 1 ], q[ 2 ], q[ 0 ], q[ 2 ], q[ 3 ] );

		}

	}

	const data = new Float32Array( verts.length * STRIDE );
	verts.forEach( ( v, i ) => {

		const o = i * STRIDE;
		const [ p0, p1, p2, p3, p4, p5 ] = v.p6;
		data.set( p0, o );
		data.set( v.n0, o + 3 );
		data.set( p1, o + 6 );
		data.set( v.n1, o + 9 );
		data.set( sub( p2, p0 ), o + 12 );
		data.set( sub( p3, p1 ), o + 15 );
		data.set( sub( p4, p0 ), o + 18 );
		data.set( sub( p5, p1 ), o + 21 );
		data.set( [ v.code, v.t, v.a, v.b ], o + 24 );

	} );
	const buf = new InterleavedBuffer( data, STRIDE );
	const g = new BufferGeometry();
	[ [ 'position', 3 ], [ 'normal', 3 ], [ 'aStand', 3 ], [ 'aStandN', 3 ], [ 'aSitUp', 3 ], [ 'aStandUp', 3 ], [ 'aSitFace', 3 ], [ 'aStandFace', 3 ], [ 'aInfo', 4 ] ].reduce( ( o, [ name, k ] ) => {

		g.setAttribute( name, new InterleavedBufferAttribute( buf, k, o ) );
		return o + k;

	}, 0 );
	g.setIndex( index );
	// every pose: standing, arms and signs up, a kid on the shoulders, a step into the aisle
	g.boundingBox = new Box3( new Vector3( - 1.3, - 0.1, - 1.0 ), new Vector3( 1.3, 2.8, 0.7 ) );
	g.boundingSphere = new Sphere( new Vector3( 0, 1.2, - 0.1 ), 1.95 );
	return g;

}

// ---------------------------------------------------------------- the shaders

const f3 = ( a ) => `vec3f( ${ a.map( ( x ) => x.toFixed( 3 ) ).join( ', ' ) } )`;

// the most fans (the seats' chunks come to ~42,000)
const MAX_FANS = 49152;

// Everything about a fan that's the same for all his vertices and all his pixels is worked out once a
// frame, for each fan, by a compute pass (Crowd._kernel): how far up he is, each arm raised or at his
// face, the towel's turn, his head turned to talk, the jump and the sway, his build, what he's wearing
// and holding, and the colours of it all. Per fan: 8 vec4s of pose (this frame's, then last frame's for
// the motion vectors) in cwPoseBuf, and 6 of look in cwLookBuf. The vertex shader keeps only what
// differs vertex to vertex (the morph, the towel's spin, the head, the build), the fragment shader only
// what differs pixel to pixel (the face, the hair, the hat): each of his ~200 vertices and every pixel
// of him no longer works the rest out again (it was most of the crowd's cost).

// the hash (the CPU has the same, pcg(), to pick the cast's seeds)
const cwHashModule = new ShaderModule( {
	name: 'crowd-hash',
	code: /* wgsl */`
fn cwHash( n: u32 ) -> u32 {
	var x = n * 747796405u + 2891336453u;
	x = ( ( x >> ( ( x >> 28u ) + 4u ) ) ^ x ) * 277803737u;
	return ( x >> 22u ) ^ x;
}

// four numbers in [ 0, 1 ) from a fan's seed
fn cwRand4( s: u32 ) -> vec4f {
	return vec4f( f32( cwHash( s ) ), f32( cwHash( s + 101u ) ), f32( cwHash( s + 202u ) ), f32( cwHash( s + 303u ) ) ) / 4294967296.0;
}

// 1 inside [ a, b ] of a cycle x in [ 0, 1 ), easing in and out
fn cwWin( x: f32, a: f32, b: f32 ) -> f32 {
	return smoothstep( a, a + 0.02, x ) * ( 1.0 - smoothstep( b - 0.02, b, x ) );
}
`,
} );

// the flags in a fan's pose (r3.w): a bit per part he has on him (parts 0-11), then his hood up, a knit
// hat's peak, a ponytail, a poncho
const PONCHO_BIT = 15;

// The compute pass: one thread per fan
const kernelCode = /* wgsl */`
struct CwFanPose { r0: vec4f, r1: vec4f, r2: vec4f, r3: vec4f };

// his pose at time t
fn cwFanPose( ids: vec3u, h: vec4f, seat: vec3f, t: f32 ) -> CwFanPose {
	let look = ids.y;
	let act = ids.z;
	let build = ( ids.x >> 22u ) & 3u;
	let outfit = look & 31u;
	let hat = ( look >> 10u ) & 7u;
	let hairStyle = ( look >> 13u ) & 3u;
	let blanket = ( look >> 20u ) & 1u;
	let age = ( look >> 21u ) & 3u;
	let female = ( look >> 23u ) & 1u;
	let prop = act & 15u;
	let sg = ( act >> 4u ) & 63u;
	let towel = ( act >> 10u ) & 1u;
	let isRays = ( ( act >> 18u ) & 1u ) == 1u;
	let rain = cw.misc.z;
	let poncho = ( ( act >> 19u ) & 1u ) == 1u || fract( h.z * 9.3 ) < rain * 0.28;
	let capped = hat == 1u || hat == 2u || hat == 5u || hat == 6u;
	let hoodie = outfit == 0u || outfit == 3u || outfit == 15u || outfit == 16u;
	let hood = hat == 4u || poncho || ( ! capped && hoodie && fract( h.w * 5.3 ) < 0.45 * rain );

	// the reaction reaches each fan in turn, spreading out from where it happened
	let rip = cw.ripple;
	let tau = rip.w - length( seat.xz - rip.xy ) * rip.z - h.y * 0.45;
	let M = mix( cw.moodA, cw.moodB, smoothstep( 0.0, 0.7 + h.z * 0.8, tau ) );
	let A1 = cw.act1;
	let A3 = cw.act3;
	let calm = ( 1.0 - M.x ) * ( 1.0 - A1.z );

	// up, arms up (the Rays fans have their own moments), clapping, towels, a jump
	let st = smoothstep( h.x * 0.92, h.x * 0.92 + 0.08, select( M.x, A3.x, isRays ) );
	let upAll = smoothstep( h.y * 0.9, h.y * 0.9 + 0.1, select( M.y, A3.y, isRays ) );
	let clap = select( A1.x * step( h.z, 0.8 ), 0.0, isRays ) * ( 1.0 - upAll );
	let face = clap * ( 0.5 + 0.13 * sin( t * 15.0 + h.w * 40.0 ) );
	// the rally towels twirled over their heads: each at his own pace (1.4 to 2.3 turns a second), the
	// phase rippling across the stands so neighbours are close but never together
	let tw = select( 0.0, smoothstep( fract( h.z * 13.0 ) * 0.9, fract( h.z * 13.0 ) * 0.9 + 0.1, M.z ), towel == 1u && ! isRays );
	let upR = max( upAll, tw );
	// talking to the neighbours now and then
	let yaw = select( - 0.6, 0.6, h.w > 0.5 ) * cwWin( fract( t / ( 28.0 + h.y * 25.0 ) + h.z * 9.0 ), 0.0, 0.16 ) * calm;
	let jump = M.w * st;
	// each arm raised or at the face (left, right), pumping when they're up
	let pump = mix( 1.0, 0.88 + 0.12 * sin( t * 6.0 + h.w * 30.0 ), upAll );
	let aUL = upAll * pump;
	let aUR = upR * pump;
	// the towel's turn, and its tip flapping held still
	let th = t * ( 9.0 + 5.5 * fract( h.w * 17.0 ) ) + dot( seat.xz, vec2f( 0.31, 0.23 ) ) + h.x * 1.2;

	// his build (broad, a belly), a kid's size
	var WIDE = array<f32, 4>( 0.92, 1.0, 1.12, 1.26 );
	let wide = select( WIDE[ build ], 0.93, female == 1u );
	let sc = select( select( 0.97 + h.y * 0.08, 0.92, age == 3u ), 0.64 + h.z * 0.1, age == 2u );

	// what he's wearing and holding (the trunk, legs, hands, head, sleeves and neck always)
	var keep = 207u;
	if ( capped && ! hood ) { keep |= 1u << 4u; }
	if ( towel == 1u && ! isRays ) { keep |= 1u << 5u; }
	if ( prop != 0u ) { keep |= 1u << 8u; }
	if ( sg != 0u ) { keep |= 1u << 9u; }
	if ( ( hairStyle == 1u || hairStyle == 3u ) && ! hood && ! capped ) { keep |= 1u << 10u; }
	if ( blanket == 1u ) { keep |= 1u << 11u; }
	// a seat given to someone else (Crowd.vacate): nobody here
	if ( ( act >> 31u ) == 1u ) { keep = 0u; }
	let flags = keep | select( 0u, 1u << 12u, hood ) | select( 0u, 1u << 13u, hat == 3u || hat == 7u ) | select( 0u, 1u << 14u, hairStyle == 3u ) | select( 0u, 1u << ${ PONCHO_BIT }u, poncho );

	var o: CwFanPose;
	o.r0 = vec4f( st, aUL, aUR, face * ( 1.0 - aUL ) );
	o.r1 = vec4f( face * ( 1.0 - aUR ), tw, th, yaw );
	o.r2 = vec4f( max( 0.0, sin( t * 8.0 + h.w * 30.0 ) ) * 0.14 * jump, sin( t * 0.6 + h.z * 20.0 ) * 0.012, sin( t * 9.0 + h.w * 50.0 ) * 0.16, cos( t * 7.0 + h.z * 20.0 ) * 0.06 );
	o.r3 = vec4f( wide, sc, max( upAll, jump ), f32( flags ) );
	return o;
}

struct CwFanLook { c0: vec4f, c1: vec4f, c2: vec4f, c3: vec4f, c4: vec4f, c5: vec4f };

// his colours: skin (and the base roughness), hair (and a number for his stubble), the jacket or
// jersey (and his look's bits), the trousers, the cap, the knit hat
fn cwFanLook( ids: vec3u, h: vec4f, poncho: bool ) -> CwFanLook {
	let look = ids.y;
	let act = ids.z;
	let hat = ( look >> 10u ) & 7u;
	let skinI = ( ids.x >> 16u ) & 7u;
	let hairI = ( ids.x >> 19u ) & 7u;
	let isRays = ( ( act >> 18u ) & 1u ) == 1u;
	let g = fract( h * vec4f( 3.1, 5.7, 7.3, 11.9 ) + h.yzwx );

	// skin: pale to dark; hair: black, browns, blond, red, grey, white
	var SKIN = array<vec3f, 8>( vec3f( 0.62, 0.42, 0.32 ), vec3f( 0.56, 0.36, 0.25 ), vec3f( 0.5, 0.31, 0.2 ), vec3f( 0.42, 0.25, 0.15 ), vec3f( 0.3, 0.17, 0.1 ), vec3f( 0.2, 0.11, 0.06 ), vec3f( 0.12, 0.065, 0.04 ), vec3f( 0.5, 0.34, 0.2 ) );
	var HAIR = array<vec3f, 8>( vec3f( 0.016, 0.012, 0.01 ), vec3f( 0.04, 0.024, 0.014 ), vec3f( 0.1, 0.058, 0.03 ), vec3f( 0.19, 0.12, 0.06 ), vec3f( 0.4, 0.29, 0.14 ), vec3f( 0.28, 0.08, 0.03 ), vec3f( 0.26, 0.25, 0.24 ), vec3f( 0.58, 0.57, 0.55 ) );

	// the jacket or jersey: mostly Phillies red, then white, black, grey, navy, maroon, powder blue
	var shirt = mix( vec3f( 0.22, 0.012, 0.016 ), vec3f( 0.36, 0.022, 0.028 ), g.x );
	let u = fract( ( h.x * 0.37 + h.y * 0.63 ) * 13.7 );
	if ( u > 0.46 ) { shirt = vec3f( 0.5, 0.49, 0.46 ) * mix( 0.8, 1.0, g.x ); }
	if ( u > 0.54 ) { shirt = vec3f( 0.014, 0.014, 0.016 ); }
	if ( u > 0.68 ) { shirt = vec3f( 0.12, 0.12, 0.125 ) * mix( 0.7, 1.4, g.x ); }
	if ( u > 0.77 ) { shirt = vec3f( 0.015, 0.022, 0.06 ); }
	if ( u > 0.84 ) { shirt = vec3f( 0.12, 0.018, 0.025 ); }
	if ( u > 0.89 ) { shirt = mix( vec3f( 0.12, 0.09, 0.05 ), vec3f( 0.05, 0.08, 0.05 ), g.y ); }
	if ( u > 0.93 ) { shirt = vec3f( 0.22, 0.33, 0.48 ); }
	if ( isRays ) { shirt = select( vec3f( 0.015, 0.04, 0.12 ), vec3f( 0.28, 0.45, 0.62 ), g.y > 0.5 ); }
	var rough = 0.85;
	// in the rain a good few in ponchos: clear plastic (the jacket under it, glossy) or red and white ones
	if ( poncho ) { shirt = select( mix( shirt, vec3f( 0.42 ), 0.3 ), select( vec3f( 0.6 ), vec3f( 0.36, 0.02, 0.03 ), g.z > 0.4 ), g.w > 0.7 ); rough = 0.22; }
	let pants = select( select( vec3f( 0.03, 0.045, 0.1 ), vec3f( 0.28, 0.22, 0.15 ), g.y > 0.72 ), vec3f( 0.02 ), g.y > 0.86 );
	var capC = select( select( vec3f( 0.02, 0.03, 0.1 ), vec3f( 0.72 ), g.w > 0.85 ), vec3f( 0.42, 0.015, 0.02 ), g.w < 0.7 );
	if ( hat == 5u ) { capC = vec3f( 0.14, 0.02, 0.03 ); }
	if ( hat == 6u ) { capC = vec3f( 0.012, 0.02, 0.07 ); }
	// knit hats: Phillies red with a white band, or grey, black, cream, navy
	let knit = select( select( select( vec3f( 0.09 ), vec3f( 0.012 ), g.z > 0.5 ), vec3f( 0.5, 0.47, 0.4 ), g.z > 0.8 ), vec3f( 0.36, 0.02, 0.03 ), hat == 3u );

	var o: CwFanLook;
	o.c0 = vec4f( SKIN[ skinI ], rough );
	o.c1 = vec4f( HAIR[ hairI ], g.w );
	o.c2 = vec4f( shirt, f32( look ) );
	o.c3 = vec4f( pants, 0.0 );
	o.c4 = vec4f( capC, 0.0 );
	o.c5 = vec4f( knit, 0.0 );
	return o;
}

@compute @workgroup_size( WG_X, 1, 1 )
fn main( @builtin( global_invocation_id ) gid: vec3u ) {
	let i = gid.x;
	if ( i >= u32( cw.misc.w + 0.5 ) ) { return; }
	let ids = cwIds[ i ].xyz;
	let seat = cwSeats[ i ].xyz;
	let h = cwRand4( ids.x & 0xffffu );
	let cur = cwFanPose( ids, h, seat, cw.misc.x );
	let prev = cwFanPose( ids, h, seat, cw.misc.x - cw.misc.y );
	let b = i * 8u;
	cwPoseBuf[ b ] = cur.r0;
	cwPoseBuf[ b + 1u ] = cur.r1;
	cwPoseBuf[ b + 2u ] = cur.r2;
	cwPoseBuf[ b + 3u ] = cur.r3;
	cwPoseBuf[ b + 4u ] = prev.r0;
	cwPoseBuf[ b + 5u ] = prev.r1;
	cwPoseBuf[ b + 6u ] = prev.r2;
	cwPoseBuf[ b + 7u ] = prev.r3;
	let lk = cwFanLook( ids, h, ( ( u32( cur.r3.w + 0.5 ) >> ${ PONCHO_BIT }u ) & 1u ) == 1u );
	let c = i * 6u;
	cwLookBuf[ c ] = lk.c0;
	cwLookBuf[ c + 1u ] = lk.c1;
	cwLookBuf[ c + 2u ] = lk.c2;
	cwLookBuf[ c + 3u ] = lk.c3;
	cwLookBuf[ c + 4u ] = lk.c4;
	cwLookBuf[ c + 5u ] = lk.c5;
}
`;

// The vertex: where this vertex of fan `fan` is, from the pose the compute pass worked out for him (prev:
// last frame's, for the motion vectors)
const crowdModule = new ShaderModule( {
	name: 'crowd',
	code: /* wgsl */`
struct CwPose {
	p: vec3f,
	n: vec3f,
	local: vec3f,
};

fn cwVertex( pos: vec3f, nrm: vec3f, stp: vec3f, stn: vec3f, sitUp: vec3f, standUp: vec3f, sitFace: vec3f, standFace: vec3f, info: vec4f, fan: u32, prev: bool ) -> CwPose {
	let b = fan * 8u + select( 0u, 4u, prev );
	let r0 = cwPoseBuf[ b ];
	let r1 = cwPoseBuf[ b + 1u ];
	let r2 = cwPoseBuf[ b + 2u ];
	let r3 = cwPoseBuf[ b + 3u ];
	let st = r0.x;
	let flags = u32( r3.w + 0.5 );
	var o: CwPose;
	let code = u32( info.x + 0.5 );
	let part = code & 15u;
	let side = f32( code >> 4u ) - 1.0;

	// the morph: each arm raised or at the face, standing or sitting
	let isL = side < - 0.5;
	let isR = side > 0.5;
	let aU = select( select( 0.0, r0.z, isR ), r0.y, isL );
	let aF = select( select( 0.0, r1.x, isR ), r0.w, isL );
	var p = mix( pos + sitUp * aU + sitFace * aF, stp + standUp * aU + standFace * aF, st );
	var n = normalize( mix( nrm, stn, st ) );

	// the towel: spun round over the head, flapping a little held still
	if ( part == 5u ) {
		let hand = mix( ${ f3( SIT_UP.hand ) }, ${ f3( STAND_UP.hand ) }, st );
		let th = r1.z;
		let rad = vec3f( cos( th ), 0.0, sin( th ) );
		let tan = vec3f( - sin( th ), 0.0, cos( th ) );
		let sd = select( 1.0, - 1.0, info.z > 0.5 );
		let tip = info.y > 0.5;
		let spin = hand + select( tan * sd * 0.07 + vec3f( 0.0, 0.03, 0.0 ), rad * 0.36 + tan * sd * 0.1 + vec3f( 0.0, 0.1 + 0.05 * sin( th * 2.0 ), 0.0 ), tip );
		if ( tip ) { p.x += r2.z * aU; p.z += r2.w * aU; }
		p = mix( p, spin, r1.y );
	}

	// the head: a hood or a poncho's hood round it, a knit hat's peak, turned to talk
	let headC = mix( ${ f3( SIT.head ) }, ${ f3( STAND.head ) }, st );
	var local = info.zyw;
	if ( part == 3u || part == 4u || part == 10u ) {
		local = p - headC;
		if ( part == 3u ) {
			if ( ( flags & ( 1u << 12u ) ) != 0u ) { p = headC + local * 1.16; }
			if ( info.y > 0.5 && ( flags & ( 1u << 13u ) ) != 0u ) { p.y += 0.045; }
		}
		// a ponytail: the long hair narrowed
		if ( part == 10u && ( flags & ( 1u << 14u ) ) != 0u ) { p.x = headC.x + ( p.x - headC.x ) * 0.32; p.y -= 0.03; }
		let piv = mix( ${ f3( SIT.neck ) }, ${ f3( STAND.neck ) }, st );
		let cy = cos( r1.w );
		let sy = sin( r1.w );
		let q = p - piv;
		p = piv + vec3f( q.x * cy + q.z * sy, q.y, - q.x * sy + q.z * cy );
		n = vec3f( n.x * cy + n.z * sy, n.y, - n.x * sy + n.z * cy );
	}

	// his build (broad, a belly), a kid's size (still sat on the seat, feet off the tread)
	if ( part != 3u && part != 4u && part != 10u ) {
		p.x *= r3.x;
		if ( part == 0u && info.w < 0.0 ) { p.z += info.w * ( r3.x - 1.0 ) * 1.4; }
	}
	p = p * r3.y;
	p.y += ( 1.0 - r3.y ) * 0.47 * ( 1.0 - st );

	// up and down with the jumping, a little sway
	p.y += r2.x;
	p.x += r2.y * ( p.y - 0.45 );

	// nothing of what he isn't wearing or holding
	o.p = select( vec3f( 0.0 ), p, ( ( flags >> part ) & 1u ) == 1u );
	o.n = n;
	o.local = local;
	return o;
}
`,
} );

function crowdMaterial( lod, poseBuf, lookBuf ) {

	const call = ( prev ) => `cwVertex( v.position, v.normal, v.aStand, v.aStandN, v.aSitUp, v.aStandUp, v.aSitFace, v.aStandFace, v.aInfo, fan, ${ prev } )`;
	const mat = standard( {
		name: 'crowd-' + [ 'near', 'mid', 'far' ][ lod ], roughness: 0.8, side: 'double',
		modules: [ crowdModule ],
		defines: { CROWD_LOD: lod },
		storage: { cwPoseBuf: poseBuf, cwLookBuf: lookBuf },
		attributes: { aStand: 'vec3f', aStandN: 'vec3f', aSitUp: 'vec3f', aStandUp: 'vec3f', aSitFace: 'vec3f', aStandFace: 'vec3f', aInfo: 'vec4f' },
		varyings: { vPart: 'u32', vFan: 'u32', vLocal: 'vec3f' },
		vertex: /* wgsl */`
	// which fan: the chunk's first (Crowd.addChunk) and his seat in it
	let fan = u32( draw.params.y + 0.5 ) + v.instance;
	let cur = ${ call( 'false' ) };
#if CROWD_LOD == 0
	let prev = ${ call( 'true' ) };
	v.prevWorldPos = select( ( v.prevModel * vec4f( prev.p, 1.0 ) ).xyz, ( v.prevModel * vec4f( 0.0, 0.0, 0.0, 1.0 ) ).xyz, all( cur.p == vec3f( 0.0 ) ) );
#else
	v.prevWorldPos = ( v.prevModel * vec4f( cur.p, 1.0 ) ).xyz;
#endif
	v.useWorld = true;
	v.worldPos = ( v.model * vec4f( cur.p, 1.0 ) ).xyz;
	v.worldNormal = normalize( ( v.model * vec4f( cur.n, 0.0 ) ).xyz );
	o.vPart = u32( v.aInfo.x + 0.5 ) & 15u;
	o.vFan = fan;
	o.vLocal = cur.local;
`,
		surface: /* wgsl */`
	let part = in.vs.vPart;
	let fan = in.vs.vFan;
	let L = in.vs.vLocal;
	// his colours and his pose's flags (the compute pass)
	let k = fan * 6u;
	let c0 = cwLookBuf[ k ];
	let c1 = cwLookBuf[ k + 1u ];
	let c2 = cwLookBuf[ k + 2u ];
	let r3 = cwPoseBuf[ fan * 8u + 3u ];
	let flags = u32( r3.w + 0.5 );
	let poncho = ( flags & ( 1u << ${ PONCHO_BIT }u ) ) != 0u;
	let hood = ( flags & ( 1u << 12u ) ) != 0u;
	let look = u32( c2.w + 0.5 );
	let hat = ( look >> 10u ) & 7u;
	let hairStyle = ( look >> 13u ) & 3u;
	let facial = ( look >> 15u ) & 3u;
	let glasses = ( ( look >> 17u ) & 1u ) == 1u;
	let age = ( look >> 21u ) & 3u;
	let female = ( ( look >> 23u ) & 1u ) == 1u;
	let nk = smoothstep( 0.15, 0.7, frame.night );
	let skin = c0.rgb;
	let hairC = c1.rgb * mix( 1.0, 0.7, frame.wet );
	let shirt = c2.rgb;
	var rough = c0.w;

	var c = shirt;
	var e = vec3f( 0.0 );
	if ( part == 1u ) { c = cwLookBuf[ k + 3u ].rgb; rough = 0.9; }
	if ( part == 2u ) { c = skin; rough = 0.6; }
	if ( part == 7u ) { c = select( skin, shirt, L.y < 0.35 ); }
	if ( part == 3u ) {
		// the head in its own frame, the face toward -z
		let d = L / vec3f( 0.082, 0.105, 0.098 );
		let ax = abs( d.x );
		c = skin;
		rough = 0.55;
#if CROWD_LOD != 2
		// how big a pixel is on the face: the features fade out when they would only flicker
		let fw = fwidth( d.x ) + fwidth( d.y );
		let near = 1.0 - smoothstep( 0.15, 0.4, fw );
		let front = smoothstep( 0.1, - 0.25, d.z );
		// the cold: red cheeks, nose and ears
		c = mix( c, c * vec3f( 1.3, 0.78, 0.76 ), 0.4 * smoothstep( 0.3, 0.05, length( vec2f( ax - 0.46, d.y + 0.16 ) ) ) * front );
		c = mix( c, c * vec3f( 1.3, 0.8, 0.78 ), 0.35 * smoothstep( 0.14, 0.02, length( vec2f( d.x, d.y + 0.12 ) ) ) * front );
		// the eyes: sockets in shadow, the whites and the irises up close; the brows
		let ey = vec2f( ax - 0.34, d.y - 0.1 );
		c *= mix( 1.0, 0.7, smoothstep( 0.2, 0.08, length( ey * vec2f( 1.0, 1.5 ) ) ) * front );
		let white = smoothstep( 0.1, 0.075, length( ey * vec2f( 1.0, 1.9 ) ) ) * near * front;
		c = mix( c, vec3f( 0.55, 0.53, 0.5 ), white );
		c = mix( c, vec3f( 0.02, 0.015, 0.01 ), smoothstep( 0.05, 0.035, length( ey ) ) * near * front );
		let brow = smoothstep( 0.05, 0.02, abs( d.y - 0.3 + 0.05 * ax ) ) * step( 0.1, ax ) * step( ax, select( 0.56, 0.5, female ) ) * front;
		c = mix( c, hairC, brow * select( 0.85, 0.55, female ) );
		// the nose: its ridge catching the light, the shadow under it
		c *= 1.0 + 0.1 * smoothstep( 0.1, 0.03, ax ) * step( - 0.18, d.y ) * step( d.y, 0.22 ) * front;
		c *= mix( 1.0, 0.72, smoothstep( 0.1, 0.03, length( vec2f( d.x * 0.8, d.y + 0.24 ) ) ) * front );
		// the mouth: lips (redder on the women), open when he shouts
		let open = r3.z;
		let mo = length( vec2f( d.x / 0.25, ( d.y + 0.45 ) / ( 0.05 + 0.13 * open ) ) );
		let lip = c * select( vec3f( 0.85, 0.62, 0.6 ), vec3f( 0.95, 0.5, 0.52 ), female );
		c = mix( c, mix( lip, vec3f( 0.06, 0.02, 0.02 ), smoothstep( 0.3, 0.7, open ) ), smoothstep( 1.0, 0.7, mo ) * front );
		// a moustache, a goatee, a beard, stubble
		if ( facial == 1u || facial == 3u ) { c = mix( c, hairC, smoothstep( 0.05, 0.02, abs( d.y + 0.33 ) ) * step( ax, 0.3 ) * front ); }
		if ( facial == 2u ) { c = mix( c, hairC, ( smoothstep( 0.05, 0.02, abs( d.y + 0.33 ) ) * step( ax, 0.28 ) + step( d.y, - 0.5 ) * step( ax, 0.24 ) ) * front ); }
		if ( facial == 3u ) { c = mix( c, hairC, step( d.y, - 0.2 ) * step( d.z, 0.4 ) * step( 0.55, mo ) * smoothstep( 0.95, 0.8, ax + max( 0.0, d.y + 0.2 ) ) ); }
		if ( facial == 0u && ! female && age != 2u && c1.w < 0.35 ) { c *= mix( vec3f( 1.0 ), vec3f( 0.82, 0.84, 0.88 ), step( d.y, - 0.2 ) * step( d.z, 0.3 ) * step( 0.8, mo ) ); }
		// glasses: thin dark frames round the eyes and over the nose
		if ( glasses ) {
			let ring = abs( length( ey * vec2f( 1.0, 1.25 ) ) - 0.17 );
			let fr = max( smoothstep( 0.035, 0.015, ring ), smoothstep( 0.03, 0.01, abs( d.y - 0.14 ) ) * step( ax, 0.18 ) );
			c = mix( c, vec3f( 0.015 ), fr * front );
			rough = mix( rough, 0.2, smoothstep( 0.17, 0.12, length( ey * vec2f( 1.0, 1.25 ) ) ) * front );
		}
		// the ears (red with the cold)
		c *= mix( vec3f( 1.0 ), vec3f( 1.1, 0.8, 0.78 ), smoothstep( 0.86, 0.95, ax ) * step( abs( d.y ), 0.25 ) * step( abs( d.z ), 0.35 ) );
#endif
		// the hair: short (a hairline, the back and sides), long down the back, pulled back, or a
		// horseshoe round a bald crown (which shines)
		var hairy = d.y > 0.42 - 0.55 * smoothstep( - 0.35, 0.5, d.z ) || ( ax > 0.8 && d.y > - 0.05 && d.z > - 0.3 );
		if ( hairStyle == 1u ) { hairy = d.y > 0.4 - 1.4 * smoothstep( - 0.55, 0.25, d.z ) || ( ax > 0.72 && d.y > - 0.55 && d.z > - 0.45 ); }
		if ( hairStyle == 3u ) { hairy = d.y > 0.38 - 1.0 * smoothstep( - 0.4, 0.4, d.z ); }
		if ( hairStyle == 2u ) { hairy = d.y > - 0.35 && d.y < 0.2 + 0.15 * smoothstep( 0.2, 0.8, d.z ) && d.z > - 0.15; rough = select( rough, 0.3, d.y > 0.2 ); }
		if ( hairy ) { c = hairC; rough = 0.7; }
		// a cap (a logo panel in front), a knit hat (a folded cuff, ribs, a pom-pom), a hood round the face
		if ( ( hat == 1u || hat == 2u || hat == 5u || hat == 6u ) && d.y > 0.26 - 0.12 * smoothstep( - 0.2, 0.6, d.z ) ) { c = cwLookBuf[ k + 4u ].rgb; rough = 0.8; }
		if ( hat == 3u || hat == 7u ) {
			if ( d.y > 0.14 ) {
				let knit = cwLookBuf[ k + 5u ].rgb;
				c = knit * ( 0.9 + 0.1 * sin( atan2( d.x, d.z ) * 36.0 ) );
				if ( d.y < 0.34 ) { c = knit * 0.8; }
				if ( hat == 3u && abs( d.y - 0.55 ) < 0.07 ) { c = vec3f( 0.6, 0.58, 0.54 ); }
				if ( d.y > 0.93 ) { c = select( knit, vec3f( 0.62 ), hat == 3u ); }
				rough = 0.95;
			}
		}
		if ( hood ) {
			let oval = length( vec2f( d.x * 1.05, ( d.y + 0.08 ) * 0.92 ) );
			if ( d.z > - 0.35 || oval > 0.72 ) { c = shirt * select( 1.0, 0.55, oval < 0.85 && d.z < - 0.2 ); rough = select( 0.85, 0.22, poncho ); }
		}
	}
	if ( part == 4u ) { c = cwLookBuf[ k + 4u ].rgb; }
	if ( part == 5u ) { c = vec3f( 0.8, 0.79, 0.76 ); rough = 0.9; }
	if ( part == 10u ) { c = hairC; rough = 0.7; }
	// lit by the stands' fill after dark, as the seats are
	s.albedo = c;
	s.roughness = rough;
	s.emissive = e + c * nk * 0.12;
`,
	} );
	mat.underwaterLighting = 'none';
	return mat;

}

// ---------------------------------------------------------------- who sits where

// the same hash as the shader's (cwHash), for choosing the cast's seeds
function pcg( n ) {

	let x = ( Math.imul( n >>> 0, 747796405 ) + 2891336453 ) >>> 0;
	x = Math.imul( ( ( x >>> ( ( x >>> 28 ) + 4 ) ) ^ x ) >>> 0, 277803737 ) >>> 0;
	return ( ( x >>> 22 ) ^ x ) >>> 0;

}

export const rand4 = ( s ) => [ 0, 101, 202, 303 ].map( ( o ) => pcg( s + o ) / 4294967296 );

// a small seeded random number generator (mulberry32)
function rng( seed ) {

	let a = seed >>> 0;
	return () => {

		a = ( a + 0x6D2B79F5 ) >>> 0;
		let t = a;
		t = Math.imul( t ^ ( t >>> 15 ), t | 1 );
		t ^= t + Math.imul( t ^ ( t >>> 7 ), t | 61 );
		return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296;

	};

}

// pick a key of a table of weights
function pick( r, table ) {

	let sum = 0;
	for ( const k in table ) sum += table[ k ];
	let x = r() * sum;
	for ( const k in table ) {

		x -= table[ k ];
		if ( x <= 0 ) return + k;

	}

	return + Object.keys( table )[ 0 ];

}

const strHash = ( s ) => [ ...s ].reduce( ( a, ch ) => Math.imul( a ^ ch.charCodeAt( 0 ), 16777619 ) >>> 0, 2166136261 );

// age: 0 adult, 1 old, 2 kid, 3 teen; hat: 0 bare, 1 red cap, 2 navy cap, 3 red knit hat, 4 hood up, 5 the
// 1980 maroon cap, 6 a Rays cap, 7 a knit hat; hair: 0 short, 1 long, 2 bald, 3 ponytail; facial: 0 none,
// 1 moustache, 2 goatee, 3 beard
function randomFan( r ) {

	const f = { seed: Math.floor( r() * 65536 ), outfit: 0, player: 0, hat: 0, hair: 0, facial: 0, glasses: 0, scarf: 0, gloves: 0, blanket: 0, age: 0, female: 0,
		skin: 0, hairColor: 0, build: 1, prop: 0, sign: 0, towel: 0, rider: 0, carrier: 0, away: 0, aisle: 0, rays: 0, poncho: 0, beh: 0 };
	const u = r();
	f.age = u < 0.06 ? 2 : u < 0.13 ? 3 : u < 0.28 ? 1 : 0;
	f.female = r() < ( f.age === 2 ? 0.45 : 0.4 ) ? 1 : 0;
	// South Philadelphia, the suburbs, the city: mostly pale, some olive, brown and dark
	f.skin = pick( r, { 0: 22, 1: 26, 2: 16, 7: 9, 3: 11, 4: 7, 5: 5, 6: 4 } );
	f.hairColor = f.age === 1 ? pick( r, { 6: 45, 7: 30, 1: 15, 2: 10 } )
		: pick( r, { 0: f.skin >= 4 ? 70 : 24, 1: 30, 2: 20, 3: 9, 4: f.female ? 16 : 7, 5: 4 } );
	f.build = f.age === 2 ? 0 : f.female ? pick( r, { 0: 35, 1: 55, 2: 10 } ) : pick( r, { 0: 18, 1: 48, 2: 24, 3: 10 } );
	f.hat = f.age === 1 ? pick( r, { 0: 30, 1: 22, 2: 6, 3: 6, 4: 4, 5: 14, 7: 18 } )
		: f.female ? pick( r, { 0: 36, 1: 22, 2: 3, 3: 15, 4: 12, 7: 12 } )
			: f.age === 2 ? pick( r, { 0: 15, 1: 50, 3: 22, 4: 8, 7: 5 } )
				: pick( r, { 0: 27, 1: 30, 2: 7, 3: 9, 4: 12, 5: 2, 7: 13 } );
	f.hair = f.female ? pick( r, { 0: 10, 1: 58, 3: 32 } ) : f.age === 1 ? pick( r, { 0: 62, 2: 38 } ) : pick( r, { 0: 80, 1: 6, 2: f.age === 0 ? 14 : 0 } );
	if ( ! f.female && ( f.age === 0 || f.age === 1 ) ) f.facial = f.age === 1 ? pick( r, { 0: 55, 1: 25, 2: 8, 3: 12 } ) : pick( r, { 0: 50, 1: 10, 2: 22, 3: 18 } );
	f.glasses = r() < ( f.age === 1 ? 0.55 : f.age === 2 ? 0.08 : 0.2 ) ? 1 : 0;
	return f;

}

// three integers (exact in float32: < 2^24) for the shaders
function pack( f, out, i ) {

	out[ i * 3 ] = ( f.seed & 0xffff ) | ( f.skin << 16 ) | ( f.hairColor << 19 ) | ( f.build << 22 );
	out[ i * 3 + 1 ] = f.outfit | ( f.player << 5 ) | ( f.hat << 10 ) | ( f.hair << 13 ) | ( f.facial << 15 ) | ( f.glasses << 17 ) | ( f.scarf << 18 ) | ( f.gloves << 19 ) | ( f.blanket << 20 ) | ( f.age << 21 ) | ( f.female << 23 );
	out[ i * 3 + 2 ] = f.prop | ( f.sign << 4 ) | ( f.towel << 10 ) | ( f.rider << 11 ) | ( f.carrier << 13 ) | ( f.away << 14 ) | ( f.aisle << 16 ) | ( f.rays << 18 ) | ( f.poncho << 19 ) | ( f.beh << 20 );

}

export class Crowd {

	constructor() {

		this.geometries = [ 0, 1, 2 ].map( ( k ) => fanGeometry( k ) );
		// who each fan is and where he sits (written once, when the stands are done), and what the compute
		// pass works out for him each frame (see cwHashModule)
		this.idsBuf = new StorageBuffer( { label: 'crowd ids', count: MAX_FANS, type: 'vec4u' } );
		this.seatsBuf = new StorageBuffer( { label: 'crowd seats', count: MAX_FANS, type: 'vec4f' } );
		this.poseBuf = new StorageBuffer( { label: 'crowd pose', count: MAX_FANS * 8, type: 'vec4f' } );
		this.lookBuf = new StorageBuffer( { label: 'crowd look', count: MAX_FANS * 6, type: 'vec4f' } );
		// the reaction: its mood before (A) and after (B) (stand, arms up, towels, jumping), where it started
		// (x, z) and how fast it spreads (1 / speed), and how long ago; clapping, the chant, tension; the
		// Rays fans standing and cheering; time, dt, rain and how many fans
		this.params = new UniformBlock( 'CrowdParams', {
			moodA: [ 'vec4f', new Vector4() ], moodB: [ 'vec4f', new Vector4() ], ripple: [ 'vec4f', new Vector4( 0, 0, 0.02, 99 ) ],
			act1: [ 'vec4f', new Vector4() ], act3: [ 'vec4f', new Vector4() ], misc: [ 'vec4f', new Vector4( 0, 0.016, 0, 0 ) ],
		} );
		this.materials = [ 0, 1, 2 ].map( ( k ) => crowdMaterial( k, this.poseBuf, this.lookBuf ) );
		this.geometry = this.geometries[ 0 ];
		this.material = this.materials[ 0 ];
		this.chunks = [];
		this.meshes = [];
		this.count = 0;
		this.time = 0;
		this._mood = { stand: 0.03, cheer: 0, clap: 0, jump: 0, towel: 0.03 };

	}

	allMaterials() {

		return this.materials;

	}

	// is there someone in this seat (by its matrix)? A few seats are empty
	occupied( m ) {

		const e = m.elements;
		const s = Math.sin( e[ 12 ] * 12.9898 + e[ 14 ] * 78.233 + e[ 13 ] * 3.7 ) * 43758.5453;
		return s - Math.floor( s ) > 0.04;

	}

	// who sits in each seat of a chunk: three integers per fan
	_dress( mats, name, info ) {

		const n = mats.length, out = new Float32Array( n * 3 );
		const r = rng( strHash( name ) + this.chunks.length * 7919 );
		for ( let i = 0; i < n; i ++ ) {

			const f = randomFan( r );
			f.towel = r() < 0.75 ? 1 : 0;
			// the odd brave Rays fan (in Rays blue, most in a Rays cap; he sits out the Phillies' moments)
			if ( r() < 0.004 ) {

				f.rays = 1;
				if ( r() < 0.6 ) f.hat = 6;

			}
			pack( f, out, i );

		}

		return out;

	}

	// a crowd chunk on these seats (their matrices): near, middle and far versions, one drawn at a time
	addChunk( group, mats, name, info = [] ) {

		if ( this.off || ! mats.length ) return;
		if ( this.count + mats.length > MAX_FANS ) throw new Error( `Crowd: more than ${ MAX_FANS } fans (raise MAX_FANS)` );
		const ids = this._dress( mats, name, info );
		// the chunk's first fan in the crowd's buffers (draw.params.y)
		const base = this.count;
		let first = null;
		const make = ( k, suffix ) => {

			const mesh = new InstancedMesh( this.geometries[ k ], this.materials[ k ], mats.length );
			if ( first ) mesh.instanceMatrix = first.instanceMatrix;
			else mats.forEach( ( m, i ) => mesh.setMatrixAt( i, m ) );
			mesh.drawParams = [ base, 0, 0 ];
			mesh.computeBoundingBox();
			mesh.computeBoundingSphere();
			mesh.name = name + suffix;
			mesh.receiveShadow = true;
			mesh.castShadow = false;
			mesh.visible = k === 0;
			group.add( mesh );
			this.meshes.push( mesh );
			first = first || mesh;
			return mesh;

		};

		this.chunks.push( { near: make( 0, '-crowd' ), mid: make( 1, '-crowd-mid' ), far: make( 2, '-crowd-far' ), ids, base } );
		this.count += mats.length;

	}

	// pick each chunk's version by how big its fans are on screen: the distance to the chunk against the
	// camera's zoom (the center field camera's long lens sees the far stands in full)
	lod( camera ) {

		const k = Math.tan( ( camera.fov || 60 ) * Math.PI / 360 );
		const c = this._c || ( this._c = new Vector3() );
		for ( const ch of this.chunks ) {

			const bs = ch.near.boundingSphere;
			if ( ! bs ) continue;
			c.copy( bs.center ).applyMatrix4( ch.near.matrixWorld );
			const d = Math.max( 0, camera.position.distanceTo( c ) - bs.radius ) * k;
			const level = d < 11 ? 0 : d < 30 ? 1 : 2;
			ch.near.visible = level === 0;
			ch.mid.visible = level === 1;
			ch.far.visible = level === 2;

		}

	}

	// how the crowd feels about the game at the replay's time (a function of the timeline, so scrubbing
	// shows the right thing): up on two strikes and two outs when the Phillies pitch, on their feet for a
	// rally, everyone up and jumping at the end
	mood( d ) {

		const seg = d.segmentAt( d.t );
		const m = { stand: 0.03, cheer: 0, clap: 0.05, jump: 0, towel: 0.03 };
		if ( ! seg ) return m;
		const s = seg.snap || {}, lt = d.t - seg.t0;
		const phPitch = s.half === 'top', late = s.inning >= 9;
		const two = ( s.strikes || 0 ) >= 2, outs2 = ( s.outs || 0 ) >= 2;
		if ( seg.kind === 'pitch' || seg.kind === 'walkup' ) {

			if ( phPitch ) {

				if ( two ) m.stand = 0.12 + ( outs2 ? 0.3 : 0 ) + ( late ? 0.4 : 0 ), m.clap = 0.6, m.towel = 0.3 + ( outs2 ? 0.25 : 0 ) + ( late ? 0.4 : 0 );
				else if ( late ) m.stand = 0.3, m.clap = 0.4, m.towel = 0.5;

			} else {

				// the Phillies batting: runners on, clapping
				const on = ( s.bases || [] ).filter( Boolean ).length;
				m.clap = 0.2 + 0.2 * on;
				if ( on >= 2 ) m.stand = 0.15;

			}

		}

		if ( seg.kind === 'inplay' || seg.kind === 'result' ) {

			const r = seg.ev?.result || seg.snap?.result;
			const type = r?.type || '';
			const hit = /single|double|triple|home_run/.test( type ), scored = ( r?.rbi || 0 ) > 0 || seg.scored > 0;
			const good = s.half === 'bottom' ? ( hit || scored ) : ! hit;
			if ( good ) {

				const big = scored || /home_run|double|triple/.test( type ) || ( s.half === 'top' && outs2 );
				const k = Math.min( 1, lt / 1.2 );
				m.stand = Math.max( m.stand, ( big ? 0.85 : 0.35 ) * k );
				m.cheer = ( big ? 0.6 : 0.2 ) * k;
				m.clap = 0.6;
				m.towel = ( big ? 0.85 : 0.45 ) * k;

			}

		}

		if ( seg.kind === 'celebrate' ) {

			m.stand = 1;
			m.cheer = 0.9;
			m.jump = 1;
			m.towel = 1;

		}

		return m;

	}

	update( d, dt, rain = 0 ) {

		this.time += dt;
		const target = d ? this.mood( d ) : this._mood;
		// the crowd takes a moment to rise and to settle
		const k = 1 - Math.exp( - dt * 2.5 );
		for ( const key of [ 'stand', 'cheer', 'clap', 'jump', 'towel' ] ) this._mood[ key ] += ( target[ key ] - this._mood[ key ] ) * k;
		const M = this._mood;
		const U = this.params.fields;
		U.moodA.value.set( M.stand, M.cheer, M.towel, M.jump );
		U.moodB.value.set( M.stand, M.cheer, M.towel, M.jump );
		U.act1.value.set( M.clap, 0, 0, 0 );
		U.misc.value.set( this.time, dt, rain, this.count );
		if ( ! this.count ) return;
		if ( ! this._kernel ) this._seat();
		this._kernel.dispatch( Math.ceil( this.count / 64 ) );

	}

	// Empty the seats a test picks: test( seat ) with the seat's world position (a Vector3-like {x, y, z})
	// returns true to leave it empty, for a place that puts its own person there (a Cast figure, a
	// featured fan). Any time: applied when the fans are seated, or at once if they are.
	vacate( test ) {

		( this._vacate ||= [] ).push( test );
		if ( this._ids ) this._writeIds();

	}

	_writeIds() {

		const ids = this._ids, seats = this._seats, p = { x: 0, y: 0, z: 0 };
		let n = 0;
		for ( let f = 0; f < this.count; f ++ ) {

			p.x = seats[ f * 4 ];
			p.y = seats[ f * 4 + 1 ];
			p.z = seats[ f * 4 + 2 ];
			const empty = ( this._vacate || [] ).some( ( t ) => t( p ) );
			ids[ f * 4 + 2 ] = empty ? ( ids[ f * 4 + 2 ] | 0x80000000 ) >>> 0 : ids[ f * 4 + 2 ] & 0x7fffffff;
			if ( empty ) n ++;

		}

		this.vacated = n;
		this.idsBuf.write( ids );

	}

	// once the stands are built (the first frame): who each fan is and where he sits, into the buffers
	// the compute pass reads, and the pass itself
	_seat() {

		const ids = new Uint32Array( this.count * 4 ), seats = new Float32Array( this.count * 4 );
		const m = new Matrix4(), w = new Matrix4();
		for ( const ch of this.chunks ) {

			const mesh = ch.near, im = mesh.instanceMatrix.array;
			mesh.updateWorldMatrix( true, false );
			for ( let i = 0; i < mesh.count; i ++ ) {

				const f = ch.base + i;
				for ( let k = 0; k < 3; k ++ ) ids[ f * 4 + k ] = ch.ids[ i * 3 + k ];
				w.multiplyMatrices( mesh.matrixWorld, m.fromArray( im, i * 16 ) );
				seats.set( [ w.elements[ 12 ], w.elements[ 13 ], w.elements[ 14 ], 0 ], f * 4 );

			}

		}

		this._ids = ids;
		this._seats = seats;
		this.seatsBuf.write( seats );
		this._writeIds();
		this._kernel = new ComputeKernel( {
			label: 'crowd', modules: [ cwHashModule ], workgroupSize: [ 64, 1, 1 ],
			bindings: {
				cw: { uniform: this.params }, cwIds: { storage: this.idsBuf }, cwSeats: { storage: this.seatsBuf },
				cwPoseBuf: { storage: this.poseBuf, access: 'read_write' }, cwLookBuf: { storage: this.lookBuf, access: 'read_write' },
			},
			code: kernelCode,
		} );

	}

}
