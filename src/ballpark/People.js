import { InstancedMesh, BufferGeometry, Float32BufferAttribute, Matrix4, Quaternion, Vector3, Vector4 } from '../engine/index.js';
import { StorageBuffer } from '../engine/gpu/Texture.js';
import { ComputeKernel } from '../engine/gpu/Compute.js';
import { UniformBlock } from '../engine/gpu/Uniforms.js';
import { nightState } from './places/Concourse3BPeople.js';
import { standard } from '../materials/Materials.js';
import { tierSections, rowHeights } from './Stands.js';
import { offsetPolyline } from './Bowl.js';
import { LEVELS, fencePoint } from './layout.js';
// ---- FW1: the throng's close-up figures and their dress
import { Cast, HAT, TOP, PROP, restPose, castPool, castPalette } from './places/Cast.js';
import { GESTURE, railArms, dress, sizeOf, rng, pick } from './places/Concourse3BKit.js';
import { pitEdgeZ } from './places/alley/Promenade.js';
// ---- end FW1

// Everyone who isn't in a seat or on the field: the staff behind every concession stand and the lines
// in front of them (longer when the Rays are batting and between innings, when the Phillies fans go for
// food), people walking the concourse and up and down the aisles, ushers at the tops of the aisles,
// event security at the foot of them and at the gates, ticket takers at every turnstile, a trickle of
// late arrivals across the plaza, and at the last out a line of police along the warning track.
//
// One instanced mesh of low-poly standing figures (1.6 to 1.9 m tall, like the crowd's), three poses
// morphed per vertex: standing, a walking stride (swung both ways for the cycle) and reaching forward
// (over a counter, to scan a ticket). Who they are (the clothes) and what they're doing come from a
// per-person record the vertex shader reads; the town moves on the CPU (update()).
//
//   const people = new People( { field, bowl, concourse, exterior } );
//   people.update( dt, director )

const MAX = 1400;
const STREET = LEVELS.mainConcourse;
export const ROLE = { fan: 0, staff: 1, security: 2, usher: 3, police: 4 };

// the figure's joints, standing (origin on the ground between the feet, facing -z)
const STAND = {
	hip: [ 0.1, 0.9, 0.0 ], knee: [ 0.11, 0.5, - 0.02 ], ankle: [ 0.12, 0.07, 0.0 ],
	pelvis: [ 0, 0.88, 0.02 ], chest: [ 0, 1.43, 0.03 ], neck: [ 0, 1.5, 0.03 ], head: [ 0, 1.62, 0.02 ],
	shoulder: [ 0.19, 1.355, 0.03 ], elbow: [ 0.23, 1.09, 0.06 ], wrist: [ 0.22, 0.86, 0.02 ], hand: [ 0.21, 0.77, 0.01 ],
};
// mid-stride, left foot forward: the legs apart, the arms swung the other way (the cycle swings it both
// ways: position + walk * sin( phase ))
const WALK = {
	knee: [ [ - 1, [ 0.11, 0.52, - 0.2 ] ], [ 1, [ 0.11, 0.47, 0.12 ] ] ],
	ankle: [ [ - 1, [ 0.12, 0.1, - 0.28 ] ], [ 1, [ 0.12, 0.16, 0.26 ] ] ],
	elbow: [ [ - 1, [ 0.23, 1.11, 0.14 ] ], [ 1, [ 0.23, 1.11, - 0.05 ] ] ],
	wrist: [ [ - 1, [ 0.22, 0.89, 0.18 ] ], [ 1, [ 0.22, 0.9, - 0.14 ] ] ],
	hand: [ [ - 1, [ 0.21, 0.8, 0.21 ] ], [ 1, [ 0.21, 0.82, - 0.2 ] ] ],
};
// reaching forward with both hands at chest height
const REACH = { elbow: [ 0.2, 1.2, - 0.2 ], wrist: [ 0.15, 1.2, - 0.42 ], hand: [ 0.12, 1.2, - 0.5 ] };
// (FW1: the sleeves, the shoes, a poncho and a furled umbrella their own parts, for the throng's dress;
// the poncho and the umbrella fold away on those without)
const P = { shirt: 0, pants: 1, skin: 2, head: 3, brim: 4, vest: 5, sleeve: 6, shoe: 7, poncho: 8, brolly: 9 };

export function figureGeometry() {

	const pos = [], walk = [], reach = [], nrm = [], part = [], index = [];
	const sub = ( a, b ) => [ a[ 0 ] - b[ 0 ], a[ 1 ] - b[ 1 ], a[ 2 ] - b[ 2 ] ];
	const add = ( a, b ) => [ a[ 0 ] + b[ 0 ], a[ 1 ] + b[ 1 ], a[ 2 ] + b[ 2 ] ];
	const mul = ( a, k ) => [ a[ 0 ] * k, a[ 1 ] * k, a[ 2 ] * k ];
	const cross = ( a, b ) => [ a[ 1 ] * b[ 2 ] - a[ 2 ] * b[ 1 ], a[ 2 ] * b[ 0 ] - a[ 0 ] * b[ 2 ], a[ 0 ] * b[ 1 ] - a[ 1 ] * b[ 0 ] ];
	const norm = ( a ) => mul( a, 1 / ( Math.hypot( ...a ) || 1 ) );
	// a joint of side s (-1 left, +1 right) in a pose
	const at = ( name, s, pose ) => {

		const base = STAND[ name ];
		let j = base;
		if ( pose === 'walk' && WALK[ name ] ) j = WALK[ name ].find( ( [ side ] ) => side === s )[ 1 ];
		if ( pose === 'reach' && REACH[ name ] ) j = REACH[ name ];
		return [ j[ 0 ] * ( base[ 0 ] ? s : 1 ), j[ 1 ], j[ 2 ] ];

	};

	const ring = ( a, b, t, n, rx, rz ) => {

		const ax = norm( sub( b, a ) );
		let across = norm( cross( ax, [ 0, 0, 1 ] ) );
		if ( Math.hypot( ...cross( ax, [ 0, 0, 1 ] ) ) < 0.2 ) across = norm( cross( ax, [ 0, 1, 0 ] ) );
		const depth = norm( cross( across, ax ) );
		const c = add( a, mul( sub( b, a ), t ) );
		const out = [];
		for ( let k = 0; k < n; k ++ ) {

			const ang = ( k / n ) * Math.PI * 2 + Math.PI / n;
			out.push( [ add( c, add( mul( across, Math.cos( ang ) * rx ), mul( depth, Math.sin( ang ) * rz ) ) ), norm( add( mul( across, Math.cos( ang ) ), mul( depth, Math.sin( ang ) ) ) ) ] );

		}

		return out;

	};

	const tube = ( ja, jb, s, rA, rB, p, n = 4, cap = false ) => {

		const poses = [ 'stand', 'walk', 'reach' ].map( ( ps ) => [ at( ja, s, ps ), at( jb, s, ps ) ] );
		const base = pos.length / 3;
		for ( const t of [ 0, 1 ] ) {

			const r = t ? rB : rA;
			const rings = poses.map( ( [ a, b ] ) => ring( a, b, t, n, r[ 0 ], r[ 1 ] ) );
			for ( let k = 0; k < n; k ++ ) {

				pos.push( ...rings[ 0 ][ k ][ 0 ] );
				nrm.push( ...rings[ 0 ][ k ][ 1 ] );
				walk.push( ...sub( rings[ 1 ][ k ][ 0 ], rings[ 0 ][ k ][ 0 ] ) );
				reach.push( ...sub( rings[ 2 ][ k ][ 0 ], rings[ 0 ][ k ][ 0 ] ) );
				part.push( p );

			}

		}

		for ( let k = 0; k < n; k ++ ) {

			const a = base + k, b = base + ( k + 1 ) % n, c = base + n + k, d = base + n + ( k + 1 ) % n;
			index.push( a, b, c, b, d, c );

		}

		if ( cap ) for ( let k = 1; k < n - 1; k ++ ) index.push( base + n, base + n + k + 1, base + n + k );

	};

	const vert = ( p, n, pt ) => {

		pos.push( ...p ); walk.push( 0, 0, 0 ); reach.push( 0, 0, 0 ); nrm.push( ...n ); part.push( pt );
		return pos.length / 3 - 1;

	};

	// the trunk (the vest over it for the staff who wear one: the shader decides): a jacket lofted from
	// the hem past the waist and the chest to shoulders that slope in to a collar round the neck (FP1,
	// CP-2: it was the crowd's flat-topped drum with a bare cone for a neck); rings [ y, half width, half
	// depth, z ]
	{

		const rings = [ [ 0.82, 0.17, 0.12, 0.01 ], [ 1.05, 0.158, 0.11, 0.01 ], [ 1.27, 0.17, 0.116, 0.018 ], [ 1.36, 0.166, 0.104, 0.025 ],
			[ 1.43, 0.14, 0.092, 0.03 ], [ 1.47, 0.086, 0.075, 0.03 ], [ 1.53, 0.068, 0.062, 0.03 ] ];
		const n = 8, first = pos.length / 3;
		rings.forEach( ( [ y, rx, rz, z ], r ) => {

			for ( let k = 0; k < n; k ++ ) {

				const a = ( k / n ) * Math.PI * 2 + Math.PI / n;
				// the normal tilted by the slope to the next ring (the shoulders face up)
				const nb = rings[ Math.min( r + 1, rings.length - 1 ) ], pb = rings[ Math.max( r - 1, 0 ) ];
				const slope = ( pb[ 1 ] - nb[ 1 ] ) / Math.max( 0.02, nb[ 0 ] - pb[ 0 ] );
				vert( [ Math.cos( a ) * rx, y, Math.sin( a ) * rz + z ], norm( [ Math.cos( a ), slope * 0.8, Math.sin( a ) ] ), P.shirt );

			}

		} );
		for ( let r = 0; r < rings.length - 1; r ++ ) for ( let k = 0; k < n; k ++ ) {

			const a = first + r * n + k, b = first + r * n + ( k + 1 ) % n;
			index.push( a, b + n, b, a, a + n, b + n );

		}

		const top = first + ( rings.length - 1 ) * n;
		for ( let k = 1; k < n - 1; k ++ ) index.push( top, top + k + 1, top + k );

	}
	for ( const s of [ - 1, 1 ] ) {

		tube( 'shoulder', 'elbow', s, [ 0.058, 0.058 ], [ 0.05, 0.05 ], P.sleeve );
		tube( 'elbow', 'wrist', s, [ 0.05, 0.05 ], [ 0.042, 0.042 ], P.sleeve );
		tube( 'wrist', 'hand', s, [ 0.035, 0.02 ], [ 0.03, 0.018 ], P.skin );
		tube( 'hip', 'knee', s, [ 0.085, 0.085 ], [ 0.06, 0.06 ], P.pants );
		tube( 'knee', 'ankle', s, [ 0.058, 0.058 ], [ 0.05, 0.05 ], P.pants );
		// ---- FW1: a shoe under each ankle (the toe out in front, the heel behind), moving with it
		{

			const an = at( 'ankle', s, 'stand' ), aw = sub( at( 'ankle', s, 'walk' ), an );
			const q = [];
			for ( const [ x, y, z ] of [ [ - 1, 0, 1 ], [ 1, 0, 1 ], [ 1, 0, - 1 ], [ - 1, 0, - 1 ], [ - 1, 1, 1 ], [ 1, 1, 1 ], [ 1, 1, - 1 ], [ - 1, 1, - 1 ] ] ) {

				const o = [ x * 0.046 * ( y ? 0.85 : 1 ), - 0.07 + y * 0.085, z < 0 ? - 0.16 * ( y ? 0.6 : 1 ) : 0.05 ];
				pos.push( ...add( an, o ) ); walk.push( ...aw ); reach.push( 0, 0, 0 ); nrm.push( ...norm( [ x, y * 2 - 1, z * 0.6 ] ) ); part.push( P.shoe );
				q.push( pos.length / 3 - 1 );

			}

			for ( const [ a, b, c, d ] of [ [ 4, 5, 6, 7 ], [ 0, 1, 5, 4 ], [ 1, 2, 6, 5 ], [ 2, 3, 7, 6 ], [ 3, 0, 4, 7 ] ] ) index.push( q[ a ], q[ b ], q[ c ], q[ a ], q[ c ], q[ d ] );

		}

	}

	// ---- FW1 (C2W-11): a poncho, from the shoulders over the arms to mid-thigh (the 27th's ponchos);
	// the shader folds it away on the rest. Rings [ y, half width, half depth, z ]
	{

		const rings = [ [ 0.6, 0.29, 0.2, 0.02 ], [ 0.86, 0.3, 0.2, 0.02 ], [ 1.12, 0.29, 0.17, 0.02 ], [ 1.31, 0.26, 0.14, 0.025 ], [ 1.43, 0.165, 0.1, 0.03 ], [ 1.51, 0.075, 0.07, 0.03 ] ];
		const n = 10, first = pos.length / 3;
		rings.forEach( ( [ y, rx, rz, z ], r ) => {

			for ( let k = 0; k < n; k ++ ) {

				const a = ( k / n ) * Math.PI * 2;
				const nb = rings[ Math.min( r + 1, rings.length - 1 ) ], pb = rings[ Math.max( r - 1, 0 ) ];
				const slope = ( pb[ 1 ] - nb[ 1 ] ) / Math.max( 0.02, nb[ 0 ] - pb[ 0 ] );
				vert( [ Math.cos( a ) * rx, y, Math.sin( a ) * rz + z ], norm( [ Math.cos( a ), slope * 0.8, Math.sin( a ) ] ), P.poncho );

			}

		} );
		for ( let r = 0; r < rings.length - 1; r ++ ) for ( let k = 0; k < n; k ++ ) {

			const a = first + r * n + k, b = first + r * n + ( k + 1 ) % n;
			index.push( a, b + n, b, a, a + n, b + n );

		}

	}

	// ---- FW1 (C2W-11): a furled umbrella hanging from the right hand, its crook in the fingers
	{

		const h0 = at( 'hand', 1, 'stand' ), hw = sub( at( 'hand', 1, 'walk' ), h0 ), hr = sub( at( 'hand', 1, 'reach' ), h0 );
		const first = pos.length / 3;
		for ( const [ y, r ] of [ [ 0.02, 0.024 ], [ - 0.68, 0.007 ] ] ) for ( let k = 0; k < 4; k ++ ) {

			const a = k / 4 * Math.PI * 2;
			pos.push( h0[ 0 ] + Math.cos( a ) * r, h0[ 1 ] + y, h0[ 2 ] - 0.01 + Math.sin( a ) * r ); walk.push( ...hw ); reach.push( ...hr ); nrm.push( Math.cos( a ), 0, Math.sin( a ) ); part.push( P.brolly );

		}

		for ( let k = 0; k < 4; k ++ ) {

			const a = first + k, b = first + ( k + 1 ) % 4;
			index.push( a, b, b + 4, a, b + 4, a + 4 );

		}

	}

	// the head, a cap's brim
	{

		const W = 8, H = 6, r = [ 0.082, 0.105, 0.098 ], hc = STAND.head;
		const first = pos.length / 3;
		for ( let j = 0; j <= H; j ++ ) for ( let i = 0; i < W; i ++ ) {

			const th = j / H * Math.PI, ph = i / W * Math.PI * 2;
			const d = [ Math.sin( th ) * Math.cos( ph ), Math.cos( th ), Math.sin( th ) * Math.sin( ph ) ];
			// (the jaw narrower than the skull)
			const jaw = Math.max( 0, Math.min( 1, ( - d[ 1 ] - 0.15 ) / 0.7 ) );
			vert( add( hc, [ d[ 0 ] * r[ 0 ] * ( 1 - 0.16 * jaw ), d[ 1 ] * r[ 1 ], d[ 2 ] * r[ 2 ] ] ), d, P.head );

		}

		for ( let j = 0; j < H; j ++ ) for ( let i = 0; i < W; i ++ ) {

			const a = first + j * W + i, b = first + j * W + ( i + 1 ) % W, c = a + W, d = b + W;
			if ( j > 0 ) index.push( a, b, c );
			if ( j < H - 1 ) index.push( b, d, c );

		}

		// a cap's bill, out of the crown's lower edge just above the brows (FP1, CP-1: it came out of the
		// cap's middle), its sides a little lower
		const brim = [ [ - 0.072, 0.034, - 0.066 ], [ 0, 0.043, - 0.093 ], [ 0.072, 0.034, - 0.066 ], [ 0.064, 0.028, - 0.15 ], [ 0, 0.033, - 0.165 ], [ - 0.064, 0.028, - 0.15 ] ].map( ( o ) => vert( add( hc, o ), [ 0, 1, - 0.1 ], P.brim ) );
		index.push( brim[ 0 ], brim[ 1 ], brim[ 5 ], brim[ 1 ], brim[ 4 ], brim[ 5 ], brim[ 1 ], brim[ 2 ], brim[ 4 ], brim[ 2 ], brim[ 3 ], brim[ 4 ] );

	}

	// every triangle wound to face the way its vertices' normals do (FP1: the engine's front face is
	// counter-clockwise and the material double sided, so the tubes, wound the other way, were lit inside
	// out)
	for ( let i = 0; i < index.length; i += 3 ) {

		const P3 = ( k ) => [ pos[ index[ i + k ] * 3 ], pos[ index[ i + k ] * 3 + 1 ], pos[ index[ i + k ] * 3 + 2 ] ];
		const N3 = ( k ) => [ nrm[ index[ i + k ] * 3 ], nrm[ index[ i + k ] * 3 + 1 ], nrm[ index[ i + k ] * 3 + 2 ] ];
		const fn = cross( sub( P3( 1 ), P3( 0 ) ), sub( P3( 2 ), P3( 0 ) ) );
		const vn = add( add( N3( 0 ), N3( 1 ) ), N3( 2 ) );
		if ( fn[ 0 ] * vn[ 0 ] + fn[ 1 ] * vn[ 1 ] + fn[ 2 ] * vn[ 2 ] < 0 ) [ index[ i + 1 ], index[ i + 2 ] ] = [ index[ i + 2 ], index[ i + 1 ] ];

	}

	const g = new BufferGeometry();
	g.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
	g.setAttribute( 'normal', new Float32BufferAttribute( nrm, 3 ) );
	g.setAttribute( 'aWalk', new Float32BufferAttribute( walk, 3 ) );
	g.setAttribute( 'aReach', new Float32BufferAttribute( reach, 3 ) );
	g.setAttribute( 'aPart', new Float32BufferAttribute( part, 1 ) );
	g.setIndex( index );
	g.computeBoundingSphere();
	return g;

}

function peopleMaterial( info, moved, throng = null ) {

	const T = throng;
	const mat = standard( {
		name: 'people', roughness: 0.8, side: 'double',
		storage: T ? { thrOut: T.out, thrDress: T.dress, thrPal: T.pal } : { pplInfo: info, pplMoved: moved },
		defines: { THRONG: T ? 1 : 0 },
		attributes: { aWalk: 'vec3f', aReach: 'vec3f', aPart: 'f32' },
		varyings: { vPart: 'f32', vInfo: 'vec4f', vLocal: 'vec3f', vDress: 'vec4u' },
		vertex: /* wgsl */`
	// info: x the stride's phase (radians), y how much he's walking (0..1), z the role + a seed (its
	// fraction), w how much he's reaching
	let hc = vec3f( ${ STAND.head.join( ', ' ) } );
#if THRONG
	// (the throng: where he is and was, from its pass: [ x, y, z, yaw ], the info, last frame's place;
	// his clothes, THRONG_DRESS: the throng's info.z is what he has on tonight, WEAR_*)
	let thrAt = thrOut[ v.instance * 3u ];
	let inf = thrOut[ v.instance * 3u + 1u ];
	let thrWas = thrOut[ v.instance * 3u + 2u ];
	let dress = thrDress[ v.instance ];
	let wear = u32( inf.z + 0.5 );
	let seedV = f32( dress.z & 65535u ) / 65536.0;
	let hat = dress.y & 31u;
	let cap = ${ THR_CAPS.map( ( h ) => `hat == ${ h }u` ).join( ' || ' ) };
	let knit = ${ THR_KNITS.map( ( h ) => `hat == ${ h }u` ).join( ' || ' ) };
	let hood = hat == ${ HAT.hood }u || ( wear & ${ WEAR.hood }u ) != 0u;
	let ponchoOn = ( wear & ${ WEAR.poncho }u ) != 0u;
	let kid = ( ( dress.y >> 14u ) & 3u ) == 2u;
	let reachK = max( inf.w, 0.0 );
#else
	let inf = pplInfo[ v.instance ];
	let dress = vec4u( 0u );
	let hat = 0u;
	let seedV = fract( inf.z );
	let cap = fract( seedV * 7.0 ) < 0.45 || inf.z >= 1.0;
	let knit = false;
	let hood = false;
	let ponchoOn = false;
	let kid = false;
	let wear = 0u;
	let reachK = inf.w;
#endif
	let walkK = inf.y;
	let sw = sin( inf.x );
	var p = v.position + v.aWalk * sw * walkK + v.aReach * reachK;
	// a bob in the stride, a sway standing
	p.y += abs( cos( inf.x ) ) * 0.03 * walkK;
	p.x += sin( frame.time * 0.7 + seedV * 30.0 ) * 0.01 * ( 1.0 - walkK ) * ( p.y - 0.4 );
	if ( v.aPart > 2.5 && v.aPart < 3.5 ) {
		let d = ( p - hc ) / vec3f( 0.082, 0.105, 0.098 );
		if ( hood ) {
			// ---- FW1 (C2W-11): a hood up (or a poncho's), loose over the head, its peak over the brow, the
			// face's opening left where it is (the Crowd's and the Cast's, CP-9)
			let face = smoothstep( - 0.55, - 0.85, d.z ) * smoothstep( 0.75, 0.45, length( d.xy - vec2f( 0.0, - 0.05 ) ) );
			var q = ( p - hc ) * mix( 1.15, 1.0, face );
			q += vec3f( 0.0, 0.01, - 0.024 ) * smoothstep( - 0.1, - 0.6, d.z ) * smoothstep( 0.35, 0.8, d.y ) * ( 1.0 - face );
			q += vec3f( 0.0, - 0.03, 0.03 ) * smoothstep( 0.1, 0.7, d.z ) * smoothstep( 0.1, - 0.6, d.y );
			p = hc + q;
		} else if ( knit ) {
			// a knit hat: a rounded dome over the hair
			p = hc + ( p - hc ) * ( 1.0 + 0.06 * smoothstep( 0.1, 0.5, d.y ) ) + vec3f( 0.0, 0.018 * smoothstep( 0.7, 1.0, d.y ), 0.0 );
		} else if ( cap ) {
			// (FP1, CP-1) a cap: the head fuller above its band and a little taller, the crown's shape
			let front = - d.z / max( length( d.xz ), 0.001 );
			p = hc + ( p - hc ) * ( 1.0 + 0.075 * smoothstep( 0.06 + 0.225 * front, 0.26 + 0.225 * front, d.y ) ) + vec3f( 0.0, 0.014 * smoothstep( 0.55, 1.0, d.y ), 0.0 );
		}
	}
	// a cap on backwards: its bill behind
	if ( v.aPart > 3.5 && v.aPart < 4.5 && hat == ${ HAT.capBack }u ) { p = vec3f( 2.0 * hc.x - p.x, p.y, 2.0 * hc.z - p.z ); }
	// what he hasn't got folds away: a bill without a cap, the poncho, the umbrella
	let keep = ( v.aPart < 3.5 || v.aPart > 4.5 || ( cap && ! hood ) ) && ( v.aPart < 7.5 || v.aPart > 8.5 || ponchoOn ) && ( v.aPart < 8.5 || ( wear & ${ WEAR.brolly }u ) != 0u );
	// a kid's head big for his body
	if ( kid && v.aPart > 2.5 && v.aPart < 4.5 ) { p = vec3f( 0.0, 1.5, 0.03 ) + ( p - vec3f( 0.0, 1.5, 0.03 ) ) * 1.3; }
	let lp = select( vec4f( 0.0, 0.0, 0.0, 1.0 ), vec4f( p, 1.0 ), keep );
	v.useWorld = true;
#if THRONG
	// placed on the concourse by the throng's pass, facing his way, his size; nobody there: folded away
	// (his size from his record, as the Cast figure that takes him over has it)
	let sc = select( 0.5 + f32( ( dress.z >> 16u ) & 255u ) / 400.0, 0.0, inf.w < - 0.5 );
	let ca = cos( thrAt.w );
	let sa = sin( thrAt.w );
	let cb = cos( thrWas.w );
	let sb = sin( thrWas.w );
	let q = lp.xyz * sc;
	v.worldPos = ( v.model * vec4f( thrAt.xyz + vec3f( q.x * ca + q.z * sa, q.y, - q.x * sa + q.z * ca ), 1.0 ) ).xyz;
	v.prevWorldPos = ( v.model * vec4f( thrWas.xyz + vec3f( q.x * cb + q.z * sb, q.y, - q.x * sb + q.z * cb ), 1.0 ) ).xyz;
	v.worldNormal = normalize( ( v.model * vec4f( v.normal.x * ca + v.normal.z * sa, v.normal.y, - v.normal.x * sa + v.normal.z * ca, 0.0 ) ).xyz );
#else
	v.worldPos = ( v.model * lp ).xyz;
	v.worldNormal = normalize( ( v.model * vec4f( v.normal, 0.0 ) ).xyz );
	v.prevWorldPos = v.worldPos - pplMoved[ v.instance ].xyz;
#endif
	o.vPart = v.aPart;
	o.vInfo = inf;
	o.vLocal = p;
	o.vDress = vec4u( dress.x, dress.y, dress.z, wear );
`,
		surface: /* wgsl */`
	let part = i32( in.vs.vPart + 0.01 );
	let inf = in.vs.vInfo;
	let L = in.vs.vLocal;
	var rough = 0.85;
	var e = vec3f( 0.0 );
	var metal = 0.0;
#if THRONG
	// ---- FW1 (C2W-1, C2W-11): the throng dressed from its record (People.js throngDress()), in the Cast's
	// palette, as the Cast figure that takes each of them over close up is
	let dr = in.vs.vDress;
	let top = dr.x & 31u;
	let shirt = thrPal[ ( dr.x >> 5u ) & 31u ].xyz;
	let sleeveC = thrPal[ ( dr.x >> 10u ) & 31u ].xyz;
	let pants = thrPal[ ${ PAL_AT.pants }u + ( ( dr.x >> 15u ) & 7u ) ].xyz;
	let shoeC = thrPal[ ${ PAL_AT.shoes }u + min( ( dr.x >> 18u ) & 7u, 4u ) ].xyz;
	let skin = thrPal[ ${ PAL_AT.skin }u + ( ( dr.x >> 21u ) & 7u ) ].xyz;
	let hair = thrPal[ ${ PAL_AT.hair }u + ( ( dr.x >> 24u ) & 7u ) ].xyz;
	let hairStyle = ( dr.x >> 27u ) & 3u;
	let female = ( ( dr.x >> 29u ) & 1u ) == 1u;
	let hat = dr.y & 31u;
	let ponchoK = ( dr.y >> 5u ) & 7u;
	let gloves = ( ( dr.y >> 23u ) & 1u ) == 1u;
	let wear = dr.w;
	let seed = f32( dr.z & 65535u ) / 65536.0;
	let capped = ${ THR_CAPS.map( ( h ) => `hat == ${ h }u` ).join( ' || ' ) };
	let knitted = ${ THR_KNITS.map( ( h ) => `hat == ${ h }u` ).join( ' || ' ) };
	let hooded = hat == ${ HAT.hood }u || ( wear & ${ WEAR.hood }u ) != 0u;
	var capC = vec3f( 0.33, 0.015, 0.02 );
	if ( hat == ${ HAT.capNavy }u ) { capC = vec3f( 0.014, 0.02, 0.06 ); }
	if ( hat == ${ HAT.capBlack }u || hat == ${ HAT.capWS }u ) { capC = vec3f( 0.012 ); }
	if ( hat == ${ HAT.capWhite }u ) { capC = vec3f( 0.7, 0.69, 0.66 ); }
	var c = shirt;
	if ( part == 0 || part == 6 ) {
		let shiny = top == ${ TOP.jacket }u || top == ${ TOP.puffer }u || top == ${ TOP.satin }u;
		rough = select( 0.88, 0.5, shiny );
		// a jersey's or a tee's short sleeves over the hoodie or thermal under it
		let shortSl = top == ${ TOP.homeJersey }u || top == ${ TOP.nameTee }u || top == ${ TOP.powder }u;
		if ( part == 6 && shortSl && L.y < 1.22 ) { c = sleeveC; rough = 0.9; }
		// the home whites' red piping and the script across the chest; a jacket's zip; a hoodie's pouch;
		// the puffer's quilting
		if ( top == ${ TOP.homeJersey }u && part == 0 ) {
			if ( L.z < 0.0 && abs( L.x ) < 0.012 && L.y > 0.86 ) { c = vec3f( 0.3, 0.02, 0.03 ); }
			if ( L.z < - 0.05 && abs( L.y - 1.24 ) < 0.035 && abs( L.x ) < 0.11 ) { c = vec3f( 0.32, 0.02, 0.03 ); }
			if ( L.z > 0.05 && L.y > 1.0 && L.y < 1.3 && abs( L.x ) < 0.08 ) { c = mix( c, vec3f( 0.32, 0.02, 0.03 ), 0.8 ); }
		}
		if ( ( top == ${ TOP.jacket }u || top == ${ TOP.fleece }u || top == ${ TOP.puffer }u ) && part == 0 && L.z < 0.0 && abs( L.x ) < 0.006 && L.y > 0.86 ) { c = mix( c, vec3f( 0.3 ), 0.7 ); }
		if ( top == ${ TOP.hoodie }u && part == 0 && L.z < 0.0 && L.y > 0.9 && L.y < 1.06 && abs( L.x ) < 0.11 ) { c *= 0.85; }
		if ( top == ${ TOP.puffer }u && part == 0 ) { c *= 0.8 + 0.2 * smoothstep( 0.0, 0.4, abs( fract( L.y / 0.09 ) - 0.5 ) ); }
		if ( top == ${ TOP.nameTee }u && part == 0 && L.z > 0.05 && L.y > 1.0 && L.y < 1.3 && abs( L.x ) < 0.08 ) { c = mix( c, vec3f( 0.72, 0.71, 0.68 ), 0.85 ); }
	}
	if ( part == 1 ) { c = pants * ( 0.9 + 0.2 * fract( seed * 37.0 ) ); rough = 0.9; }
	if ( part == 7 ) { c = shoeC; rough = 0.6; if ( L.y < 0.012 ) { c *= 0.5; } }
	if ( part == 2 ) { c = select( skin * vec3f( 1.06, 0.92, 0.9 ), vec3f( 0.012 ), gloves ); rough = select( 0.6, 0.88, gloves ); }
	if ( part == 3 ) {
		let d = ( L - vec3f( ${ STAND.head.join( ', ' ) } ) ) / vec3f( 0.082, 0.105, 0.098 );
		let ax = abs( d.x );
		let front = smoothstep( 0.1, - 0.25, d.z );
		c = skin; rough = 0.6;
		// the cold in the cheeks, the eyes' sockets, the brows, the mouth (the far figure: shading only)
		c = mix( c, c * vec3f( 1.25, 0.8, 0.78 ), 0.4 * smoothstep( 0.3, 0.05, length( vec2f( ax - 0.46, d.y + 0.16 ) ) ) * front );
		c *= mix( 1.0, 0.55, smoothstep( 0.2, 0.08, length( vec2f( ax - 0.34, d.y - 0.1 ) * vec2f( 1.0, 1.6 ) ) ) * front );
		c = mix( c, hair, smoothstep( 0.05, 0.02, abs( d.y - 0.3 + 0.05 * ax ) ) * step( 0.1, ax ) * step( ax, 0.55 ) * front * 0.8 );
		c *= mix( 1.0, 0.7, smoothstep( 1.0, 0.7, length( vec2f( d.x / 0.25, ( d.y + 0.45 ) / 0.06 ) ) ) * front );
		// the hair: short, long, pulled back, or a bald crown
		var hairy = d.y > 0.42 - 0.55 * smoothstep( - 0.35, 0.5, d.z ) || ( ax > 0.8 && d.z > - 0.3 && ( d.y > 0.24 || ( d.z > 0.3 && d.y > - 0.15 ) ) );
		if ( hairStyle == 1u ) { hairy = d.y > 0.4 - 1.4 * smoothstep( - 0.55, 0.25, d.z ) || ( ax > 0.72 && d.y > - 0.55 && d.z > - 0.45 ); }
		if ( hairStyle == 2u ) { hairy = d.y > 0.36 - 0.6 * smoothstep( - 0.4, 0.4, d.z ) || ( d.z > 0.6 && d.y > - 0.4 && ax < 0.25 ); }
		if ( hairStyle == 3u ) { hairy = d.y > - 0.35 && d.y < 0.2 + 0.15 * smoothstep( 0.2, 0.8, d.z ) && d.z > - 0.15; }
		if ( hairy ) { c = hair; rough = 0.7; }
		// a cap down to its band, its P; a knit hat; a hood round the face
		let capFront = - d.z / max( length( d.xz ), 0.001 );
		if ( capped && d.y > 0.18 + 0.225 * capFront ) {
			c = capC; rough = 0.8;
			let lp = vec2f( d.x / 0.28, ( d.y - 0.68 ) / 0.28 );
			if ( d.z < - 0.55 && length( lp ) < 1.0 && ( ( abs( lp.x - 0.25 ) < 0.14 && abs( lp.y ) < 0.7 ) || ( abs( length( ( lp - vec2f( - 0.05, 0.3 ) ) * vec2f( 1.0, 1.3 ) ) - 0.32 ) < 0.12 && lp.x < 0.25 ) ) ) {
				c = select( vec3f( 0.75 ), vec3f( 0.32, 0.02, 0.03 ), hat == ${ HAT.capNavy }u || hat == ${ HAT.capWhite }u );
				if ( hat == ${ HAT.capWS }u ) { c = vec3f( 0.7, 0.55, 0.15 ); }
			}
		}
		if ( knitted && d.y > 0.12 - 0.1 * smoothstep( - 0.2, 0.6, d.z ) ) {
			let kc = select( select( vec3f( 0.3, 0.29, 0.26 ), vec3f( 0.012 ), hat == ${ HAT.knitBlack }u ), vec3f( 0.32, 0.018, 0.025 ), hat == ${ HAT.knitRed }u );
			c = kc * ( 0.88 + 0.12 * sin( atan2( d.x, d.z ) * 40.0 ) );
			if ( d.y < 0.34 ) { c = select( kc * 0.8, vec3f( 0.012, 0.016, 0.05 ), hat == ${ HAT.knitRed }u ); }
			if ( hat == ${ HAT.knitRed }u && d.y > 0.95 ) { c = vec3f( 0.62, 0.6, 0.55 ); }
			rough = 0.95;
		}
		if ( hooded ) {
			let oval = length( vec2f( d.x * 1.05, ( d.y + 0.08 ) * 0.92 ) );
			let ponchoHood = ( wear & ${ WEAR.poncho }u ) != 0u && ( wear & ${ WEAR.hood }u ) != 0u && hat != ${ HAT.hood }u;
			if ( ponchoHood && ponchoK == 1u ) {
				c = c * 0.88 + vec3f( 0.012 ); rough = 0.08;
			} else if ( d.z > - 0.35 || oval > 0.72 ) {
				c = select( shirt, thrPal[ ${ THR_PONCHO_COLOR }u + ponchoK ].xyz, ponchoHood );
				c *= select( 1.0, 0.55, oval < 0.85 && d.z < - 0.2 );
				rough = select( 0.88, 0.3, ponchoHood );
			}
		}
	}
	// the bill, its underside in shade
	if ( part == 4 ) { c = select( capC, mix( capC * 0.5, vec3f( 0.06, 0.07, 0.06 ), 0.45 ), in.N.y < - 0.25 ); }
	if ( part == 8 ) {
		// the poncho: clear plastic over the jacket (the jacket dulled through it, glossy), or red, yellow,
		// white, blue, orange; creased
		let fres = pow( 1.0 - abs( dot( normalize( in.N ), normalize( in.V ) ) ), 2.5 );
		let crease = 0.9 + 0.1 * sin( atan2( L.x, L.z ) * 11.0 + L.y * 7.0 );
		c = select( thrPal[ ${ THR_PONCHO_COLOR }u + ponchoK ].xyz, mix( shirt * 0.8, vec3f( 0.42, 0.44, 0.47 ), 0.03 + 0.35 * fres ), ponchoK == 1u ) * crease;
		rough = select( 0.2, 0.06, ponchoK == 1u );
	}
	if ( part == 9 ) { c = vec3f( 0.012, 0.014, 0.03 ); rough = 0.4; }
#else
	let role = i32( floor( inf.z ) );
	let seed = fract( inf.z );
	let h = fract( sin( vec4f( seed * 12.9898, seed * 78.233, seed * 39.346, seed * 11.135 ) ) * 43758.5453 );
	// a fan's jacket (FP1, CP-11: 2008's sea of red, as the crowd's): red, the home whites, black, navy,
	// charcoal and grey, maroon; the powder blue a rare throwback
	var shirt = mix( vec3f( 0.22, 0.012, 0.016 ), vec3f( 0.36, 0.022, 0.028 ), h.x );
	let u = h.y;
	if ( u > 0.6 ) { shirt = vec3f( 0.62, 0.61, 0.58 ); }
	if ( u > 0.66 ) { shirt = vec3f( 0.014, 0.014, 0.016 ); }
	if ( u > 0.8 ) { shirt = vec3f( 0.015, 0.022, 0.06 ); }
	if ( u > 0.86 ) { shirt = vec3f( 0.12, 0.12, 0.125 ) * mix( 0.5, 1.5, h.x ); }
	if ( u > 0.94 ) { shirt = vec3f( 0.12, 0.018, 0.025 ); }
	if ( u > 0.99 ) { shirt = vec3f( 0.22, 0.33, 0.48 ); }
	var pants = select( select( vec3f( 0.03, 0.045, 0.1 ), vec3f( 0.28, 0.22, 0.15 ), h.z > 0.72 ), vec3f( 0.02 ), h.z > 0.86 );
	var capC = select( vec3f( 0.014, 0.02, 0.07 ), vec3f( 0.33, 0.014, 0.02 ), h.w < 0.7 );
	var vest = false;
	// the staff: concession workers in red polos and black caps; event security in a hi-vis vest over
	// a black jacket; ushers and ticket takers in Phillies red jackets, khakis, red caps; police in navy
	if ( role == 1 ) { shirt = vec3f( 0.4, 0.02, 0.03 ); pants = vec3f( 0.02 ); capC = vec3f( 0.015 ); }
	if ( role == 2 ) { shirt = vec3f( 0.015 ); pants = vec3f( 0.02 ); capC = vec3f( 0.015 ); vest = true; }
	if ( role == 3 ) { shirt = vec3f( 0.42, 0.02, 0.03 ); pants = vec3f( 0.3, 0.24, 0.15 ); capC = vec3f( 0.42, 0.02, 0.03 ); }
	if ( role == 4 ) { shirt = vec3f( 0.012, 0.016, 0.045 ); pants = vec3f( 0.012, 0.016, 0.045 ); capC = vec3f( 0.01, 0.012, 0.03 ); }
	let si = fract( h.w * 3.3 + seed );
	var skin = vec3f( 0.55, 0.34, 0.23 );
	if ( si > 0.55 ) { skin = vec3f( 0.42, 0.25, 0.16 ); }
	if ( si > 0.75 ) { skin = vec3f( 0.25, 0.13, 0.07 ); }
	if ( si > 0.88 ) { skin = vec3f( 0.13, 0.07, 0.04 ); }
	let hair = select( select( vec3f( 0.02, 0.015, 0.01 ), vec3f( 0.12, 0.07, 0.03 ), h.z > 0.55 ), vec3f( 0.3, 0.28, 0.26 ), h.z > 0.88 );
	var c = shirt;
	if ( ( part == 0 || part == 6 ) && vest && L.y > 0.95 && L.y < 1.4 && part == 0 ) {
		// the vest: fluorescent yellow-green, two silver bands
		c = vec3f( 0.55, 0.62, 0.02 );
		if ( abs( L.y - 1.08 ) < 0.025 || abs( L.y - 1.2 ) < 0.025 ) { c = vec3f( 0.6 ); rough = 0.3; }
		e = c * 0.05;
	}
	if ( part == 1 ) { c = pants; rough = 0.9; }
	if ( part == 7 ) { c = select( vec3f( 0.02 ), vec3f( 0.55, 0.54, 0.5 ), fract( seed * 23.0 ) > 0.6 && role == 0 ); rough = 0.6; }
	if ( part == 2 ) { c = skin; rough = 0.6; }
	if ( part == 3 ) {
		let hd = L - vec3f( ${ STAND.head.join( ', ' ) } );
		c = skin; rough = 0.6;
		let capped = fract( seed * 7.0 ) < 0.45 || role > 0;
		if ( hd.y > 0.03 - 0.06 * smoothstep( -0.02, 0.06, hd.z ) ) { c = hair; rough = 0.7; }
		// (the cap down to its band: just above the brows, the tops of the ears, low behind)
		let front = - hd.z / max( length( hd.xz ), 0.001 );
		if ( capped && hd.y > 0.105 * ( 0.18 + 0.225 * front ) ) { c = capC; }
	}
	// the bill, its underside in shade
	if ( part == 4 ) { c = select( capC, mix( capC * 0.5, vec3f( 0.06, 0.07, 0.06 ), 0.45 ), in.N.y < - 0.25 ); }
#endif
	s.albedo = c;
	s.roughness = rough;
	s.metalness = metal;
	s.emissive = e + c * smoothstep( 0.15, 0.7, frame.night ) * 0.1;
`,
	} );
	mat.underwaterLighting = 'none';
	return mat;

}

const rnd = ( s ) => {

	const x = Math.sin( s * 12.9898 + 78.233 ) * 43758.5453;
	return x - Math.floor( x );

};

// ---- FP1 (CI-2): the throng. A sold-out World Series night's concourse was a crush (the 3B gate at
// 19:01 on the 27th shoulder to shoulder, the AP's fans "six or seven deep behind home plate" in the rain
// delay), and the places' own people are a few hundred. So a crowd that costs no CPU per person: up to
// THRONG figures on the concourse's walking lines, each placed by a compute pass from his own numbers and
// the time (walking a line one way or the other at his own pace, leaning on the rail, or standing about),
// as many out as the replay's clock says (nightState's busy: the gates before the game, between innings,
// the Rays batting, wall to wall in the delay; few in the 9th; at the rail for the last out). Not drawn
// far off, and not at all when the camera's away from the concourse (the TV's cameras).
//
// ---- FW1 (round 2, C2W-1, C2W-10, C2W-11, C2W-12): the throng comes up to you. Within HAND metres of the
// camera each of them is drawn as the Cast's figure (the places' close-up figure: a face, hands, shoes),
// dressed the same (one record per person, throngDress(), read by both), and handed back past HAND_OUT;
// the CPU keeps track of the few near the camera (a sweep of SWEEP a frame finds them, CAND metres out)
// and tells the pass whom not to draw (thrHide). Nobody walks through you, a column or the places' own
// people: each steps round them (thrPush: OBS obstacles a frame). They use the walkway's whole width
// (from the drink rail to the stands' fronts, per segment of each line), lean on the rail two deep
// behind home, walk the outfield too (behind the left and right field seats, the Alley), and dress for
// the night: on the 27th the ponchos, the hoods up, the umbrellas furled under the roof.
const THRONG = 2000;
const THRONG_FAR = 130;
const HAND = 7.0, HAND_OUT = 7.8, CAND = 11.5, PROXIES = 72, SWEEP = 200;
const OBS = 56;
// what he has on in the rain (throngDress()'s record, w: these bits, and the rain level he puts them on at)
const WEAR = { poncho: 1, hood: 2, brolly: 4 };
const THR_CAPS = [ HAT.capRed, HAT.capNavy, HAT.cap1980, HAT.capRays, HAT.capBack, HAT.capBlack, HAT.capWhite, HAT.capWS ];
const THR_KNITS = [ HAT.knitRed, HAT.knitGrey, HAT.knitBlack, HAT.knitPlain ];
// the Cast's palette, in the same places (Cast.js PAL), then the ponchos' colours
const PAL_AT = { colors: 0, skin: 32, hair: 40, pants: 48, shoes: 56 };
const THR_PONCHO_COLOR = 64;
function throngPalette() {

	const P = castPalette(), a = new Float32Array( 72 * 4 );
	const put = ( i, c ) => a.set( [ c[ 0 ], c[ 1 ], c[ 2 ], 1 ], i * 4 );
	P.colors.forEach( ( c, i ) => put( PAL_AT.colors + i, c ) );
	P.skin.forEach( ( c, i ) => put( PAL_AT.skin + i, c ) );
	P.hair.forEach( ( c, i ) => put( PAL_AT.hair + i, c ) );
	P.pants.forEach( ( c, i ) => put( PAL_AT.pants + i, c ) );
	P.shoes.forEach( ( c, i ) => put( PAL_AT.shoes + i, c ) );
	// the Cast's ponchos: (none), clear, red, white, yellow, orange, a grey trash bag
	[ [ 0, 0, 0 ], [ 0.42, 0.44, 0.47 ], [ 0.36, 0.02, 0.03 ], [ 0.62, 0.62, 0.6 ], [ 0.65, 0.5, 0.03 ], [ 0.62, 0.2, 0.02 ], [ 0.06, 0.065, 0.07 ], [ 0.42, 0.44, 0.47 ] ].forEach( ( c, i ) => put( THR_PONCHO_COLOR + i, c ) );
	return a;

}

// the hash the throng's numbers come from
function thrHash( n ) {

	let x = ( Math.imul( n >>> 0, 747796405 ) + 2891336453 ) >>> 0;
	x = Math.imul( ( ( x >>> ( ( x >>> 28 ) + 4 ) ) ^ x ) >>> 0, 277803737 ) >>> 0;
	return ( ( x >>> 22 ) ^ x ) >>> 0;

}

const fract = ( x ) => x - Math.floor( x );

// a polyline with points no further apart than step (so a line can be cut where it passes something)
function densify( P, step ) {

	const out = [ P[ 0 ] ];
	for ( let i = 1; i < P.length; i ++ ) {

		const a = P[ i - 1 ], b = P[ i ], n = Math.max( 1, Math.ceil( Math.hypot( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ] ) / step ) );
		for ( let k = 1; k <= n; k ++ ) out.push( [ a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * k / n, a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * k / n ] );

	}

	return out;

}

// Who each of the throng is: a fan dressed as the places dress theirs (Concourse3BKit's dress(): 2008's sea
// of red, the home whites with UTLEY 26 on the back, hoodies, knit hats), his size, and what he'd put on
// in the rain (C2W-11; the AP's and Getty's fans at the tarp on the 27th: clear ponchos mostly, red, yellow,
// white; hoods up; umbrellas): a look for the Cast, and the same packed for the throng's shader
function throngDress( i ) {

	const r = rng( thrHash( i * 5 + 90001 ) );
	const L = dress( r );
	const scale = sizeOf( L, r );
	// the rain's gear, and the rain level (0.3 at the first pitch on the 27th to 1 in the delay) he puts it on at
	let wear = 0;
	const u = r();
	if ( u < 0.4 ) {

		L.poncho = Number( pick( r, { 1: 55, 2: 15, 3: 10, 4: 15, 5: 5 } ) );
		wear |= WEAR.poncho;
		// (the Cast puts a poncho's hood up by the seed: the same here)
		if ( fract( ( L.seed / 65536 ) * 13.1 ) > 0.35 ) wear |= WEAR.hood;

	} else {

		L.poncho = 0;
		if ( ( L.top === TOP.hoodie || L.top === TOP.puffer || L.top === TOP.fleece || L.top === TOP.jacket ) && L.hat !== HAT.hood && r() < 0.4 ) wear |= WEAR.hood;
		if ( r() < 0.09 ) wear |= WEAR.brolly;

	}

	const at = Math.min( 15, Math.floor( ( 0.25 + 0.7 * r() ) * 15 ) );
	const pack = [
		( L.top & 31 ) | ( ( L.color & 31 ) << 5 ) | ( ( L.sleeves & 31 ) << 10 ) | ( ( L.pants & 7 ) << 15 ) | ( ( L.shoes & 7 ) << 18 ) | ( ( L.skin & 7 ) << 21 ) | ( ( L.hair & 7 ) << 24 ) | ( ( L.hairStyle & 3 ) << 27 ) | ( ( L.female ? 1 : 0 ) << 29 ),
		( L.hat & 31 ) | ( ( L.poncho & 7 ) << 5 ) | ( ( L.build & 3 ) << 12 ) | ( ( L.age & 3 ) << 14 ) | ( ( L.gloves ? 1 : 0 ) << 23 ),
		( L.seed & 65535 ) | ( Math.max( 0, Math.min( 255, Math.round( ( scale - 0.5 ) * 400 ) ) ) << 16 ),
		wear | ( at << 4 ),
	].map( ( v ) => v >>> 0 );
	return { look: L, scale: 0.5 + ( ( pack[ 2 ] >>> 16 ) & 255 ) / 400, wear, at, pack, r };

}

const throngCode = /* wgsl */`
struct ThrPlace { at: vec4f, phase: f32, walking: f32 };

// the segment of line k at s metres along it (each segment 4 vec4s: its ends, [ s0, length, the way
// along ], the walkway's band across it at each end (min, max, metres outward of the line), [ the rail,
// which side is outward ])
fn thrSegAt( k: u32, s: f32 ) -> u32 {
	let ln = thrLines[ k ];
	var lo = u32( ln.x + 0.5 );
	var hi = lo + u32( ln.y + 0.5 ) - 1u;
	for ( var it = 0u; it < 10u; it ++ ) {
		if ( lo >= hi ) { break; }
		let mid = ( lo + hi + 1u ) / 2u;
		if ( thrSeg[ mid * 4u + 1u ].x <= s ) { lo = mid; } else { hi = mid - 1u; }
	}
	return lo;
}

// stepped round what's in the way: each obstacle (x, z, radius) moves whoever is within twice its radius
// out from it, smoothly (not at all at twice the radius, out to the radius at its centre)
fn thrPush( p0: vec2f ) -> vec2f {
	var p = p0;
	let n = u32( thr.cam.w + 0.5 );
	for ( var j = 0u; j < n; j ++ ) {
		let o = thrObs[ j ];
		let d = p - o.xy;
		let r = length( d );
		if ( r < 2.0 * o.z ) {
			let dir = select( vec2f( 1.0, 0.0 ), d / max( r, 1e-4 ), r > 1e-4 );
			let k = 1.0 - r / ( 2.0 * o.z );
			p = o.xy + dir * ( r + o.z * k * k );
		}
	}
	return p;
}

// where he is at time t (P0: his numbers, P1: [ line, kind, out key, lane ]): a walker (kind 0) goes back
// and forth along his line at his own pace, drifting across the walkway; at the rail (1) he leans on it,
// in the front row or the second; standing about (2) he keeps his spot, turning now and then
fn thrPlace( P0: vec4f, P1: vec4f, t: f32 ) -> ThrPlace {
	let k = u32( P1.x + 0.5 );
	let kind = u32( P1.y + 0.5 );
	let L = thrLines[ k ].z;
	var s = P0.x * L;
	var heading = 1.0;
	var o: ThrPlace;
	o.walking = 0.0;
	if ( kind == 0u ) {
		let speed = 0.8 + 0.65 * P0.z;
		let dir = select( - 1.0, 1.0, P0.w > 0.5 );
		let u = fract( P0.x + dir * speed * t / ( 2.0 * L ) ) * 2.0 * L;
		let back = u > L;
		s = select( u, 2.0 * L - u, back );
		heading = select( dir, - dir, back );
		o.walking = 1.0;
	}
	let j = thrSegAt( k, s );
	let A = thrSeg[ j * 4u ];
	let C = thrSeg[ j * 4u + 1u ];
	let W = thrSeg[ j * 4u + 2u ];
	let E = thrSeg[ j * 4u + 3u ];
	let f = clamp( ( s - C.x ) / max( C.y, 0.001 ), 0.0, 1.0 );
	let wMin = mix( W.x, W.z, f );
	let wMax = mix( W.y, W.w, f );
	var lane = mix( wMin, wMax, P1.w );
	if ( kind == 0u ) { lane = clamp( lane + 0.6 * sin( t * 0.06 + P0.y * 40.0 ), wMin, wMax ); }
	if ( kind == 1u ) { lane = E.x + select( 0.0, 0.7, P1.w > 0.5 ) + 0.16 * ( fract( P1.w * 7.0 ) - 0.5 ); }
	let nrm = vec2f( - C.w, C.z ) * E.y;
	let p = thrPush( mix( A.xy, A.zw, f ) + nrm * lane );
	var yaw = atan2( - C.z * heading, - C.w * heading );
	if ( kind == 1u ) { yaw = atan2( nrm.x, nrm.y ) + 0.5 * ( fract( P0.z * 5.3 ) - 0.5 ) + 0.6 * sin( t * 0.09 + P0.y * 30.0 ) * step( 0.75, fract( P0.w * 3.7 ) ); }
	if ( kind == 2u ) { yaw = P0.z * 6.2832 + 0.5 * sin( t * 0.15 + P0.y * 20.0 ); }
	o.at = vec4f( p.x, ${ STREET.toFixed( 3 ) }, p.y, yaw );
	o.phase = s * 5.2 * heading;
	return o;
}

@compute @workgroup_size( WG_X, 1, 1 )
fn main( @builtin( global_invocation_id ) gid: vec3u ) {
	let i = gid.x;
	if ( i >= ${ THRONG }u ) { return; }
	let P0 = thrWho[ i * 2u ];
	let P1 = thrWho[ i * 2u + 1u ];
	let t = thr.misc.x;
	let cur = thrPlace( P0, P1, t );
	let was = thrPlace( P0, P1, t - thr.misc.y );
	// out tonight? (the clock's share of the walkers, the rail, the standers, the gates'; the outfield's
	// own share of it)
	let lk = thrLines[ u32( P1.x + 0.5 ) ].w;
	let kind = u32( P1.y + 0.5 );
	var share = select( select( thr.share.x, thr.share.y, kind == 1u ), thr.share.z, kind == 2u );
	if ( lk > 0.5 && lk < 1.5 ) { share = thr.share.w; }
	if ( lk > 1.5 ) { share = share * thr.misc.z; }
	// (not drawn here: the Cast draws him, close to the camera)
	let hid = ( thrHide[ i >> 5u ] >> ( i & 31u ) ) & 1u;
	let d = cur.at.xyz - thr.cam.xyz;
	let d2 = dot( d, d );
	let shown = P1.z < share && hid == 0u && d2 < ${ ( THRONG_FAR * THRONG_FAR ).toFixed( 1 ) } && d2 > 0.04;
	// what he has on: the rain's gear, once the rain's come on enough for him
	let dw = thrDress[ i ].w;
	let wear = select( 0u, dw & 7u, thr.misc.w * 15.0 > f32( ( dw >> 4u ) & 15u ) );
	thrOut[ i * 3u ] = cur.at;
	thrOut[ i * 3u + 1u ] = vec4f( cur.phase, cur.walking, f32( wear ), select( - 1.0, select( 0.0, 0.55, kind == 1u ), shown ) );
	thrOut[ i * 3u + 2u ] = was.at;
}
`;
// ---- end FW1

export class People {

	constructor( { field, bowl, concourse, exterior, landmarks } ) {

		this.info = new Float32Array( MAX * 4 );
		this.infoBuffer = new StorageBuffer( { label: 'peopleInfo', count: MAX, type: 'vec4f' } );
		// how far each moved since the last frame (world frame), for the motion vectors
		this.moved = new Float32Array( MAX * 4 );
		this.movedBuffer = new StorageBuffer( { label: 'peopleMoved', count: MAX, type: 'vec4f' } );
		this.field = field;
		this.mesh = new InstancedMesh( figureGeometry(), peopleMaterial( this.infoBuffer, this.movedBuffer ), MAX );
		this.mesh.name = 'people';
		this.mesh.frustumCulled = false;
		this.mesh.castShadow = false;
		this.mesh.receiveShadow = true;
		field.group.add( this.mesh );
		this.list = [];
		this.time = 0;
		this._m = new Matrix4();
		this._q = new Quaternion();
		this._v = new Vector3();
		this._s = new Vector3();
		this._up = new Vector3( 0, 1, 0 );
		this._seed = 1;
		// ---- W2 (concourse): a place can take a stretch of the concourse over with its own people
		// (places/Concourse3B.js): hiders are ( x, z ) => true where People's own figures at street level
		// aren't drawn
		this.hiders = [];
		// ---- end W2
		this._stands( [ ...( concourse?.standSpots || [] ), ...( landmarks?.alleyStands || [] ) ] );
		this._walkway( bowl );
		this._aisles( bowl );
		this._gates( exterior );
		this._police( bowl );
		this._exterior = exterior;
		// ---- FW1: what the throng's lines and obstacles come from
		this._bowl = bowl;
		this._concourse = concourse;
		this._landmarks = landmarks;
		// ---- end FW1
		this._throng();

	}

	// a person: at x, y, z facing yaw; role; he may be given a path to walk
	_add( role, x, y, z, yaw, extra = {} ) {

		if ( this.list.length >= MAX ) return null;
		const seed = rnd( this._seed ++ );
		const p = { role, x, y, z, yaw, seed, scale: 0.92 + 0.12 * rnd( seed * 91 ), phase: rnd( seed * 17 ) * 6.28, walk: 0, reach: 0, visible: true, ...extra };
		this.list.push( p );
		return p;

	}

	// ---- the concession stands: two behind each counter, a line in front
	_stands( spots ) {

		this.stands = [];
		for ( const st of spots ) {

			const { mid, n, u } = st;
			const yaw = Math.atan2( - n[ 0 ], - n[ 1 ] ); // facing +n (out over the counter)
			// behind the counter (the Alley's kitchens are painted into their windows: there the staff stand
			// in the window itself, behind the counter's front)
			const inset = st.inset ?? 0.6;
			const staff = ( st.staff || [ - 1.6, 1.6 ] ).map( ( k ) => this._add( ROLE.staff, mid[ 0 ] + u[ 0 ] * k - n[ 0 ] * inset, STREET, mid[ 1 ] + u[ 1 ] * k - n[ 1 ] * inset, yaw ) );
			// the line: up to eight people out from the counter, facing it
			const line = [];
			for ( let q = 0; q < 8; q ++ ) {

				const off = 0.95 + q * 0.78, side = ( rnd( this._seed + q ) - 0.5 ) * 0.25;
				const p = this._add( ROLE.fan, mid[ 0 ] + n[ 0 ] * off + u[ 0 ] * side, STREET, mid[ 1 ] + n[ 1 ] * off + u[ 1 ] * side, yaw + Math.PI + ( rnd( this._seed * 3 + q ) - 0.5 ) * 0.4 );
				if ( p ) {

					p.visible = false;
					p.queue = { mid, n, u, q };
					line.push( p );

				}

			}

			this.stands.push( { staff, line, len: 0, target: 0, next: rnd( this._seed ) * 8, base: 1 + Math.floor( rnd( this._seed * 5 ) * 4 ) } );

		}

	}

	// ---- walking the main concourse round the infield, both ways
	_walkway( bowl ) {

		if ( ! bowl?.path ) return;
		const line = offsetPolyline( bowl.path, bowl.top + 4.2, [ 0, - 40 ] );
		const seg = [];
		let L = 0;
		for ( let i = 0; i < line.length - 1; i ++ ) {

			const l = Math.hypot( line[ i + 1 ][ 0 ] - line[ i ][ 0 ], line[ i + 1 ][ 1 ] - line[ i ][ 1 ] );
			seg.push( { a: line[ i ], b: line[ i + 1 ], l, s: L } );
			L += l;

		}

		this.walkLine = { seg, L };
		for ( let k = 0; k < 170; k ++ ) {

			const p = this._add( ROLE.fan, 0, STREET, 0, 0 );
			if ( ! p ) break;
			p.walker = { s: rnd( k * 7.1 ) * L, dir: rnd( k * 3.3 ) < 0.5 ? - 1 : 1, speed: 1.1 + 0.5 * rnd( k * 5.7 ), lane: ( rnd( k * 9.1 ) - 0.5 ) * 4.5, busy: rnd( k * 2.9 ) };
			p.walk = 1;

		}

	}

	// ---- FP1 (CI-2), FW1 (round 2): the throng's mesh (People's figure, placed on the GPU), its pass, and
	// the Cast figures that take it over close up (see THRONG)
	_throng() {

		if ( ! this.walkLine ) return;
		const lines = this._throngLines();
		// the segments (4 vec4s each: see thrSegAt) and the lines ( [ first segment, count, length, kind ] )
		const nSeg = lines.reduce( ( n, l ) => n + l.pts.length - 1, 0 );
		const S = new Float32Array( nSeg * 16 ), Ls = new Float32Array( lines.length * 4 );
		let j = 0;
		lines.forEach( ( line, k ) => {

			const first = j;
			let s = 0;
			for ( let i = 0; i < line.pts.length - 1; i ++ ) {

				const a = line.pts[ i ], b = line.pts[ i + 1 ];
				const l = Math.max( 1e-3, Math.hypot( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ] ) );
				const dx = ( b[ 0 ] - a[ 0 ] ) / l, dz = ( b[ 1 ] - a[ 1 ] ) / l;
				// which side is outward (away from the field, for the loop: the rail's on the inside)
				const mx = ( a[ 0 ] + b[ 0 ] ) / 2, mz = ( a[ 1 ] + b[ 1 ] ) / 2;
				const out = line.kind === 0 ? ( - dz * mx + dx * ( mz + 40 ) > 0 ? 1 : - 1 ) : 1;
				S.set( [ a[ 0 ], a[ 1 ], b[ 0 ], b[ 1 ], s, l, dx, dz, line.band[ i ][ 0 ], line.band[ i ][ 1 ], line.band[ i + 1 ][ 0 ], line.band[ i + 1 ][ 1 ], line.rail || 0, out, 0, 0 ], j * 16 );
				s += l;
				j ++;

			}

			Ls.set( [ first, line.pts.length - 1, s, line.kind ], k * 4 );
			line.L = s;
			line.first = first;

		} );
		this._thrS = S;
		this._thrL = Ls;
		this._thrLines = lines;
		this.thrSeg = new StorageBuffer( { label: 'throng segments', count: nSeg * 4, type: 'vec4f', data: S } );
		this.thrLines = new StorageBuffer( { label: 'throng lines', count: lines.length, type: 'vec4f', data: Ls } );
		// (the camera's distance to any of the lines decides whether the throng is drawn at all)
		this._thrNear = lines.flatMap( ( l ) => l.pts.slice( 1 ).map( ( b, i ) => ( { a: l.pts[ i ], b, l: Math.max( 1e-3, Math.hypot( b[ 0 ] - l.pts[ i ][ 0 ], b[ 1 ] - l.pts[ i ][ 1 ] ) ) } ) ) );

		// who's who: [ his numbers ], [ line, kind (0 walking, 1 at the rail, 2 standing about), the key his
		// line's share is held against, his lane across it ], and his dress
		const who = new Float32Array( THRONG * 8 ), dressBuf = new Uint32Array( THRONG * 4 );
		this._thrDress = [];
		const gates = lines.map( ( l, k ) => l.kind === 1 ? k : - 1 ).filter( ( k ) => k >= 0 );
		const outs = lines.map( ( l, k ) => l.kind === 2 ? k : - 1 ).filter( ( k ) => k >= 0 );
		const outLen = outs.reduce( ( n, k ) => n + lines[ k ].L, 0 );
		// the rail behind home is two deep all night (auds, 27 and 29 Oct 2008): most at the rail stand
		// within 75 m of the loop's point behind home
		const loop = lines[ 0 ];
		let sHome = loop.L / 2, best = Infinity, acc = 0;
		for ( let i = 0; i < loop.pts.length - 1; i ++ ) {

			const a = loop.pts[ i ], b = loop.pts[ i + 1 ], l = Math.hypot( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ] );
			for ( let f = 0; f <= 1; f += 0.05 ) {

				const d = Math.hypot( a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * f, a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * f - 48 );
				if ( d < best ) { best = d; sHome = acc + l * f; }

			}

			acc += l;

		}

		for ( let i = 0; i < THRONG; i ++ ) {

			const r = rng( thrHash( i * 3 + 777 ) );
			const h = [ r(), r(), r(), r() ];
			const u = i / THRONG;
			let k = 0;
			if ( u >= 0.6 && u < 0.72 && gates.length ) k = gates[ i % gates.length ];
			else if ( u >= 0.72 && outs.length ) {

				let x = r() * outLen;
				k = outs[ outs.length - 1 ];
				for ( const o of outs ) {

					x -= lines[ o ].L;
					if ( x <= 0 ) { k = o; break; }

				}

			}

			const lk = lines[ k ].kind, q = r();
			const kind = lk === 0 ? ( q < 0.5 ? 0 : q < 0.77 ? 1 : 2 ) : lk === 1 ? ( q < 0.85 ? 0 : 2 ) : ( q < 0.62 ? 0 : 2 );
			let lane = kind === 0 ? ( r() + r() ) / 2 : r();
			if ( kind === 1 && r() < 0.62 ) h[ 0 ] = Math.max( 0.01, Math.min( 0.99, ( sHome + ( r() - 0.5 ) * 150 ) / loop.L ) );
			if ( kind === 2 && lk === 0 ) lane = r() < 0.5 ? 0.85 + 0.15 * r() : 0.1 * r();
			who.set( [ ...h, k, kind, r(), lane ], i * 8 );
			const D = throngDress( i );
			dressBuf.set( D.pack, i * 4 );
			this._thrDress.push( D );

		}

		this._thrWho = who;
		this.thrWho = new StorageBuffer( { label: 'throng who', count: THRONG * 2, type: 'vec4f', data: who } );
		this.thrDressBuf = new StorageBuffer( { label: 'throng dress', count: THRONG, type: 'vec4u', data: dressBuf } );
		this.thrPal = new StorageBuffer( { label: 'throng palette', count: 72, type: 'vec4f', data: throngPalette() } );
		this.thrOut = new StorageBuffer( { label: 'throng', count: THRONG * 3, type: 'vec4f' } );
		this._thrObs = new Float32Array( OBS * 4 );
		this.thrObs = new StorageBuffer( { label: 'throng obstacles', count: OBS, type: 'vec4f' } );
		this._thrHide = new Uint32Array( Math.ceil( THRONG / 32 ) );
		this._thrHideWas = new Uint32Array( this._thrHide.length ).fill( 1 );
		this.thrHide = new StorageBuffer( { label: 'throng hidden', count: this._thrHide.length, type: 'u32' } );
		this.thrParams = new UniformBlock( 'ThrongParams', {
			misc: [ 'vec4f', new Vector4( 0, 0.016, 1, 0 ) ], cam: [ 'vec4f', new Vector4( 0, - 100, 0, 0 ) ], share: [ 'vec4f', new Vector4( 0.5, 0.8, 0.5, 0.3 ) ],
		} );
		this.thrKernel = new ComputeKernel( {
			label: 'throng', workgroupSize: [ 64, 1, 1 ],
			bindings: {
				thr: { uniform: this.thrParams }, thrSeg: { storage: this.thrSeg }, thrLines: { storage: this.thrLines }, thrWho: { storage: this.thrWho },
				thrDress: { storage: this.thrDressBuf }, thrObs: { storage: this.thrObs }, thrHide: { storage: this.thrHide }, thrOut: { storage: this.thrOut, access: 'read_write' },
			},
			code: throngCode,
		} );
		this.throng = new InstancedMesh( this.mesh.geometry, peopleMaterial( null, null, { out: this.thrOut, dress: this.thrDressBuf, pal: this.thrPal } ), THRONG );
		this.throng.name = 'people-throng';
		this.throng.frustumCulled = false;
		this.throng.castShadow = false;
		this.throng.receiveShadow = true;
		this.throng.visible = false;
		this.mesh.add( this.throng );
		this.thrShare = [ 0.5, 0.8, 0.5, 0.3, 1 ];
		this._thrCam = new Vector3( 0, - 1000, 0 );
		this._thrInv = new Matrix4();
		// the camera, as the people are drawn (the main view's; the people cast no shadows), in the field's frame
		this.mesh.onBeforeRender = ( r, s, camera ) => {

			if ( camera ) this._thrCam.setFromMatrixPosition( camera.matrixWorld ).applyMatrix4( this._thrInv.copy( this.field.group.matrixWorld ).invert() );

		};
		// the ones close to the camera: Cast figures (a troupe of PROXIES), each standing in for one of the
		// throng (p.thr) while he's within HAND metres
		this.proxies = new Cast( { parent: this.field.group, max: PROXIES } );
		this.proxies.throng = true;
		for ( let k = 0; k < PROXIES; k ++ ) {

			const p = this.proxies.add( this._thrDress[ 0 ].look );
			p.visible = false;
			p.thr = - 1;

		}

		this._thrCand = new Set();
		this._thrSweep = 0;
		this._thrPl = { x: 0, z: 0, yaw: 0, phase: 0, walking: 0, s: 0 };
		// the columns on the concourse's floor (FI1's steel), for the throng to step round
		this._thrCols = ( this._concourse?.steel?.columns || [] ).filter( ( c ) => Math.abs( c.y0 - STREET ) < 1.5 ).map( ( c ) => [ c.x, c.z ] );
		// (and the light tower's legs in left, by the walk behind the seats)
		this._thrCols.push( [ ...fencePoint( - 24.5, 455 ), 3 ] );

	}

	// The throng's lines: the concourse's loop round the infield (the walkway from the drink rail to the
	// stands' fronts), one through each gate (from the plaza, through its turnstiles, into the atrium: the
	// crush before the game), and the outfield's (C2W-12: behind the left field seats round to Harry the
	// K's, behind the right field seats, and the Alley's promenade from the storefronts to the rail). Each
	// a polyline and its band across it at each point (metres outward of the line)
	_throngLines() {

		const bowl = this._bowl, lines = [];
		const pts = [ this.walkLine.seg[ 0 ].a, ...this.walkLine.seg.map( ( g ) => g.b ) ];
		// (the walking line is 4.2 m back from the field level's top; the drink rail at 0.1, the stands'
		// fronts 15 m back: the band keeps clear of the rail's shelf and the lines at the counters)
		lines.push( { pts, kind: 0, band: pts.map( () => [ - 2.6, 5.8 ] ), rail: - 3.68 } );
		const gates = new Map();
		for ( const lane of this._exterior?.lanes || [] ) {

			const G = gates.get( lane.gate ) || gates.set( lane.gate, { x: 0, z: 0, fx: 0, fz: 0, n: 0 } ).get( lane.gate );
			G.x += lane.entry[ 0 ]; G.z += lane.entry[ 2 ]; G.fx += lane.face[ 0 ]; G.fz += lane.face[ 1 ]; G.n ++;

		}

		for ( const G of gates.values() ) {

			const x = G.x / G.n, z = G.z / G.n, l = Math.hypot( G.fx, G.fz ) || 1, fx = G.fx / l, fz = G.fz / l;
			const p = [ [ x + fx * 14, z + fz * 14 ], [ x, z ], [ x - fx * 9, z - fz * 9 ], [ x - fx * 20, z - fz * 20 ] ];
			lines.push( { pts: p, kind: 1, band: p.map( () => [ - 3.5, 3.5 ] ), outdoors: 14 } );

		}

		// the outfield: behind the left field seats (clear of Harry the K's under the scoreboard), behind the
		// right field seats; the walkway between the seats' backs and the stands (Concourse.js puts those 9
		// and 10 m back)
		const lf = bowl.tiers?.[ 1 ], rf = bowl.tiers?.[ 2 ];
		const sb = fencePoint( - 36, 452 );
		const band = ( P, w ) => P.map( () => [ - w, w ] );
		if ( lf?.front ) {

			// (in pieces either side of Harry the K's: a line never bridges the gap)
			const top = ( lf.start || 0 ) + lf.rows * lf.depth;
			let P = [];
			const flush = () => {

				if ( P.length > 1 ) lines.push( { pts: P, kind: 2, band: band( P, 2.8 ), outdoors: 1e9 } );
				P = [];

			};
			for ( const q of densify( offsetPolyline( lf.front, top + 4.5, [ 0, 0 ] ), 4 ) ) {

				if ( Math.hypot( q[ 0 ] - sb[ 0 ], q[ 1 ] - sb[ 1 ] ) > 24 ) P.push( q ); else flush();

			}

			flush();
			this._thrLF = offsetPolyline( lf.front, top + 4.5, [ 0, 0 ] );

		}

		if ( rf?.front ) {

			const top = ( rf.start || 0 ) + rf.rows * rf.depth;
			const P = densify( offsetPolyline( rf.front, top + 5, [ 0, 0 ] ), 4 );
			if ( P.length > 1 ) lines.push( { pts: P, kind: 2, band: band( P, 3.2 ), outdoors: 1e9 } );
			this._thrRF = offsetPolyline( rf.front, top + 5, [ 0, 0 ] );

		}

		// the left field corner: from the loop's end round the corner's broad floor to the walk behind the
		// left field seats (w17: an empty floor on a sold-out night)
		const end = pts[ pts.length - 1 ], lf0 = this._thrLF?.[ 0 ];
		if ( lf0 && Math.hypot( end[ 0 ] - lf0[ 0 ], end[ 1 ] - lf0[ 1 ] ) < 60 ) {

			const P = densify( [ end, [ end[ 0 ] - 3, end[ 1 ] - 12 ], [ ( end[ 0 ] + lf0[ 0 ] ) / 2 - 4, ( end[ 1 ] + lf0[ 1 ] ) / 2 - 4 ], lf0 ], 4 );
			lines.push( { pts: P, kind: 2, band: band( P, 4.5 ), outdoors: 1e9 } );

		}

		// the Alley: from its left field end to the right field end, midway between the storefronts' counters
		// and the rail over the pens, as wide as the walk is there
		if ( bowl.pit ) {

			const zB = ( this._landmarks?.alleyFront ?? - 143 ) + 1.8;
			const P = [], B = [];
			for ( let x = - 60; x <= 55; x += 5 ) {

				const zR = Math.max( zB + 4, Math.min( pitEdgeZ( bowl.pit, x ) - 0.01, - 126 ) ) - 1.4;
				P.push( [ x, ( zB + zR ) / 2 ] );
				const w = Math.max( 1.2, ( zR - zB ) / 2 );
				B.push( [ - w, w ] );

			}

			lines.push( { pts: P, kind: 2, band: B, outdoors: 1e9 } );

		}

		return lines;

	}

	// where throng person i is at time t, on the CPU (the pass's thrPlace(), the same numbers): into
	// this._thrPl. push: step round the obstacles (as the pass does)
	_thrPlace( i, t, push = true ) {

		const W = this._thrWho, o = i * 8, S = this._thrS, out = this._thrPl;
		const k = Math.round( W[ o + 4 ] ), kind = Math.round( W[ o + 5 ] ), laneF = W[ o + 7 ];
		const L = this._thrL[ k * 4 + 2 ];
		let s = W[ o ] * L, heading = 1;
		out.walking = 0;
		if ( kind === 0 ) {

			const speed = 0.8 + 0.65 * W[ o + 2 ], dir = W[ o + 3 ] > 0.5 ? 1 : - 1;
			const u = fract( W[ o ] + dir * speed * t / ( 2 * L ) ) * 2 * L, back = u > L;
			s = back ? 2 * L - u : u;
			heading = back ? - dir : dir;
			out.walking = 1;

		}

		let lo = Math.round( this._thrL[ k * 4 ] ), hi = lo + Math.round( this._thrL[ k * 4 + 1 ] ) - 1;
		while ( lo < hi ) {

			const mid = ( lo + hi + 1 ) >> 1;
			if ( S[ mid * 16 + 4 ] <= s ) lo = mid; else hi = mid - 1;

		}

		const g = lo * 16;
		const f = Math.max( 0, Math.min( 1, ( s - S[ g + 4 ] ) / Math.max( S[ g + 5 ], 0.001 ) ) );
		const wMin = S[ g + 8 ] + ( S[ g + 10 ] - S[ g + 8 ] ) * f, wMax = S[ g + 9 ] + ( S[ g + 11 ] - S[ g + 9 ] ) * f;
		let lane = wMin + ( wMax - wMin ) * laneF;
		if ( kind === 0 ) lane = Math.max( wMin, Math.min( wMax, lane + 0.6 * Math.sin( t * 0.06 + W[ o + 1 ] * 40 ) ) );
		if ( kind === 1 ) lane = S[ g + 12 ] + ( laneF > 0.5 ? 0.7 : 0 ) + 0.16 * ( fract( laneF * 7 ) - 0.5 );
		const dx = S[ g + 6 ], dz = S[ g + 7 ], nx = - dz * S[ g + 13 ], nz = dx * S[ g + 13 ];
		let x = S[ g ] + ( S[ g + 2 ] - S[ g ] ) * f + nx * lane, z = S[ g + 1 ] + ( S[ g + 3 ] - S[ g + 1 ] ) * f + nz * lane;
		if ( push ) {

			const O = this._thrObs;
			for ( let j = 0; j < this._thrObsN; j ++ ) {

				const ox = O[ j * 4 ], oz = O[ j * 4 + 1 ], R = O[ j * 4 + 2 ];
				const ex = x - ox, ez = z - oz, r = Math.hypot( ex, ez );
				if ( r < 2 * R ) {

					const ux = r > 1e-4 ? ex / r : 1, uz = r > 1e-4 ? ez / r : 0, kk = 1 - r / ( 2 * R ), rr = r + R * kk * kk;
					x = ox + ux * rr; z = oz + uz * rr;

				}

			}

		}

		let yaw = Math.atan2( - dx * heading, - dz * heading );
		if ( kind === 1 ) yaw = Math.atan2( nx, nz ) + 0.5 * ( fract( W[ o + 2 ] * 5.3 ) - 0.5 ) + 0.6 * Math.sin( t * 0.09 + W[ o + 1 ] * 30 ) * ( fract( W[ o + 3 ] * 3.7 ) >= 0.75 ? 1 : 0 );
		if ( kind === 2 ) yaw = W[ o + 2 ] * 6.2832 + 0.5 * Math.sin( t * 0.15 + W[ o + 1 ] * 20 );
		out.x = x; out.z = z; out.yaw = yaw; out.s = s; out.phase = s * 5.2 * heading; out.kind = kind; out.line = k;
		return out;

	}

	// is he out tonight (the pass's test, with the same single-precision shares)?
	_thrOut( i ) {

		const W = this._thrWho, o = i * 8, k = Math.round( W[ o + 4 ] ), kind = Math.round( W[ o + 5 ] ), lk = this._thrL[ k * 4 + 3 ];
		const U = this._thrShareF;
		let share = kind === 1 ? U[ 1 ] : kind === 2 ? U[ 2 ] : U[ 0 ];
		if ( lk > 0.5 && lk < 1.5 ) share = U[ 3 ];
		if ( lk > 1.5 ) share = Math.fround( share * U[ 4 ] );
		return W[ o + 6 ] < share;

	}

	_throngUpdate( dt, d ) {

		if ( ! this.throng ) return;
		// the clock: the share of the walkers, those at the rail, those standing about, at the gates, and
		// the outfield's share of it
		const ns = nightState( d );
		let w = ns.top ? 0.62 : 0.32, s = ns.top ? 0.5 : 0.3, rail = 0.8, g = 0.08, of = 1;
		if ( ns.between ) w = 1, s = 0.8;
		// (before the first pitch, the gates: the replay opens on the walk-in; the Alley's packed)
		if ( ns.seg?.kind === 'intro' || ( ns.inning === 1 && ns.half === 'top' && ( ns.snap?.outs || 0 ) === 0 ) ) g = 1, of = 1.4, rail = 0.6;
		if ( ns.suspended ) w = 0.8, s = 1, g = 0.3, rail = 0.9;
		// (the 29th's evening, before the resumption: the gates open, the fans streaming in)
		if ( ! ns.suspended && ns.seg?.kind === 'switch' && ns.inning === 6 && ns.half === 'bottom' && ! ns.first ) w = 0.8, s = 0.7, g = 1, of = 1.4, rail = 0.7;
		if ( ns.inning === 9 && ! ns.celebrate ) w *= 0.5, s *= 0.5, rail = 1;
		if ( ns.celebrate ) w = 0.12, s = 0.5, g = 0, rail = 1;
		// (easing in and out over a few seconds; a jump in the replay starts on the new moment)
		const jump = d && this._thrT !== undefined && Math.abs( d.t - this._thrT - dt ) > 2;
		this._thrT = d ? d.t : undefined;
		const k = jump ? 1 : 1 - Math.exp( - dt * 0.5 );
		const want = [ w, rail, s, g, of ];
		for ( let i = 0; i < 5; i ++ ) this.thrShare[ i ] += ( want[ i ] - this.thrShare[ i ] ) * k;
		this._thrShareF = this.thrShare.map( Math.fround );
		// only when the camera's on the concourse (not the TV's cameras, not from the seats). (thrForce, for
		// a look from above: everyone drawn, as if from the middle of the outfield at the concourse's level)
		const c = this.thrForce ? ( this._thrFake ||= new Vector3( 0, STREET + 1.6, - 40 ) ) : this._thrCam;
		let near = Infinity;
		for ( const g of this._thrNear ) {

			const ux = ( g.b[ 0 ] - g.a[ 0 ] ) / g.l, uz = ( g.b[ 1 ] - g.a[ 1 ] ) / g.l;
			const f = Math.max( 0, Math.min( g.l, ( c.x - g.a[ 0 ] ) * ux + ( c.z - g.a[ 1 ] ) * uz ) );
			near = Math.min( near, Math.hypot( g.a[ 0 ] + ux * f - c.x, g.a[ 1 ] + uz * f - c.z ) );

		}

		// (on the concourse's level: walking it, at the gates; not from the seats, the suites or the press box)
		// (nor through FOX's cameras: the center field camera's platform is by the Alley's walk)
		const tv = this._bowl?.tvCams?.list?.some( ( q ) => Math.hypot( c.x - q.x, c.y - q.y - 1.42, c.z - q.z ) < 1.5 );
		this.throng.visible = !! this.thrForce || ( near < 40 && Math.abs( c.y - STREET - 1.6 ) < 4 && ! tv );
		this.proxies.update();
		if ( ! this.throng.visible ) {

			for ( const p of this.proxies.list ) if ( p.thr >= 0 ) { p.thr = - 1; p.visible = false; }
			this._thrHeld?.clear();
			return;

		}

		const t = this.time;
		this._throngObstacles( c );
		this._throngProxies( c, t, jump, ns );
		const U = this.thrParams.fields;
		U.misc.value.set( t, Math.max( 1e-3, dt ), this._thrShareF[ 4 ], ns.first ? ns.rain : 0 );
		U.cam.value.set( c.x, c.y, c.z, this._thrObsN );
		U.share.value.set( ...this._thrShareF.slice( 0, 4 ) );
		this.thrObs.write( this._thrObs );
		this.thrKernel.dispatch( Math.ceil( THRONG / 64 ) );

	}

	// what the throng steps round this frame (the pass and _thrPlace() use the same list): the columns and
	// the places' own people near the camera, and the camera itself (you), last, so nobody ends up in it
	_throngObstacles( c ) {

		const O = this._thrObs, near = this._thrObsNear ||= [];
		near.length = 0;
		for ( const [ x, z, r = 0.55 ] of this._thrCols ) {

			const dd = Math.abs( x - c.x ) + Math.abs( z - c.z );
			if ( dd < 40 ) near.push( [ dd, x, z, r ] );

		}

		const pool = castPool();
		if ( pool ) for ( const p of pool.people ) {

			if ( ! p.visible || p.troupe === this.proxies || Math.abs( p.y - STREET ) > 0.6 ) continue;
			const dd = Math.abs( p.x - c.x ) + Math.abs( p.z - c.z );
			if ( dd < 28 ) near.push( [ dd, p.x, p.z, 0.42 ] );

		}

		// the nearest (the order they're applied in doesn't matter much; the camera's goes last)
		if ( near.length > OBS - 1 ) near.sort( ( a, b ) => a[ 0 ] - b[ 0 ] );
		let n = 0;
		for ( const [ , x, z, r ] of near ) {

			if ( n >= OBS - 1 ) break;
			O.set( [ x, z, r, 0 ], n * 4 );
			n ++;

		}

		// (from well above the floor, nobody needs to step round you)
		const up = Math.max( 0, Math.min( 1, ( 4.5 - ( c.y - STREET ) ) / 2 ) );
		if ( up > 0 ) {

			O.set( [ c.x, c.z, 1.0 * up, 0 ], n * 4 );
			n ++;

		}

		this._thrObsN = n;

	}

	// Who's close enough for a Cast figure: a sweep of a few hundred a frame keeps the candidates (those
	// out and within CAND metres); each of them is placed exactly, and the nearest within HAND get a Cast
	// figure (kept until they're past HAND_OUT); the pass is told not to draw them
	_throngProxies( c, t, jump, ns ) {

		const cand = this._thrCand;
		const moved = ! this._thrCamWas || Math.hypot( c.x - this._thrCamWas.x, c.z - this._thrCamWas.z ) > 3;
		( this._thrCamWas ||= new Vector3() ).copy( c );
		const n = jump || moved ? THRONG : SWEEP;
		for ( let j = 0; j < n; j ++ ) {

			const i = ( this._thrSweep + j ) % THRONG;
			const P = this._thrPlace( i, t, false );
			if ( this._thrOut( i ) && Math.hypot( P.x - c.x, P.z - c.z ) < CAND ) cand.add( i ); else cand.delete( i );

		}

		this._thrSweep = ( this._thrSweep + n ) % THRONG;
		// who wants a Cast figure: the candidates out and in reach (those who have one keep it a little further)
		const held = this._thrHeld ||= new Map(), wantD = this._thrWant ||= new Map();
		wantD.clear();
		for ( const i of cand ) {

			if ( ! this._thrOut( i ) ) continue;
			const P = this._thrPlace( i, t );
			const dd = Math.hypot( P.x - c.x, P.z - c.z );
			if ( dd < ( held.has( i ) ? HAND_OUT : HAND ) ) wantD.set( i, dd );

		}

		// let go of those who've gone; then the nearest of the rest get the free figures
		for ( const [ i, p ] of held ) if ( ! wantD.has( i ) ) {

			held.delete( i );
			p.thr = - 1;
			p.visible = false;

		}

		const free = this.proxies.list.filter( ( p ) => p.thr < 0 );
		const fresh = [ ...wantD.keys() ].filter( ( i ) => ! held.has( i ) ).sort( ( a, b ) => wantD.get( a ) - wantD.get( b ) );
		for ( const i of fresh ) {

			const p = free.pop();
			if ( ! p ) break;
			p.thr = i;
			p.fresh = true;
			held.set( i, p );
			this._thrDressUp( p, i, ns );

		}

		// the hidden ones' bits for the pass
		const H = this._thrHide;
		H.fill( 0 );
		const rain = Math.fround( ns.first ? ns.rain : 0 );
		for ( const [ i, p ] of held ) {

			H[ i >> 5 ] |= 1 << ( i & 31 );
			const P = this._thrPlace( i, t );
			p.x = P.x; p.y = STREET; p.z = P.z; p.yaw = P.yaw;
			p.visible = true;
			const a = p.pose;
			a.walk = P.walking;
			a.phase = P.phase * 0.87;
			if ( P.walking === 0 ) a.headYaw = 0.35 * Math.sin( t * 0.23 + i );
			// the rain's gear on (or off) as the rain comes on (the pass's rule)
			const D = this._thrDress[ i ], wear = rain * 15 > D.at ? D.wear : 0;
			const outdoors = P.s < ( this._thrLines[ P.line ].outdoors || 0 );
			if ( wear !== p._wear || outdoors !== p._outdoors ) this._thrLook( p, D, wear, outdoors );

		}

		let changed = false;
		for ( let j = 0; j < H.length; j ++ ) if ( H[ j ] !== this._thrHideWas[ j ] ) { changed = true; break; }
		if ( changed ) {

			this.thrHide.write( H );
			this._thrHideWas.set( H );

		}

	}

	// a Cast figure dressed as throng person i (his record's look), posed for what he's doing
	_thrDressUp( p, i, ns ) {

		const D = this._thrDress[ i ], W = this._thrWho, kind = Math.round( W[ i * 8 + 5 ] );
		p.scale = D.scale;
		const rain = ns.first ? Math.fround( ns.rain ) : 0;
		const r = rng( thrHash( i * 11 + 4242 ) );
		const a = Object.assign( p.pose, restPose() );
		const set = ( G ) => {

			if ( G[ 0 ] ) a.armL = G[ 0 ].slice();
			if ( G[ 1 ] ) a.armR = G[ 1 ].slice();

		};
		const u = r(), kid = D.look.age === 2;
		if ( kind === 1 ) {

			// at the rail: leaning on it, a beer on the shelf; or arms folded, hands in the pockets
			if ( u < 0.6 && ! kid ) {

				set( railArms( D.scale ) );
				a.lean = 0.3;
				if ( r() < 0.45 ) a.propR = PROP.beer;

			} else if ( u < 0.8 ) set( GESTURE.fold );
			else { set( GESTURE.pockets ); a.propL = a.propR = PROP.pocket; }

		} else if ( kind === 2 ) {

			// standing about: arms folded against the cold, hands in the pockets, a beer, a hot chocolate, a phone
			if ( u < 0.25 ) set( GESTURE.fold );
			else if ( u < 0.5 ) { set( GESTURE.pockets ); a.propL = a.propR = PROP.pocket; }
			else if ( u < 0.7 && ! kid ) { set( GESTURE.carry ); a.propR = PROP.beer; }
			else if ( u < 0.8 ) { set( GESTURE.warm ); a.propR = PROP.cocoa; }
			else if ( u < 0.85 && ! kid ) { set( GESTURE.phone ); a.propR = PROP.phone; }

		} else {

			// walking: most with their arms free (they swing), some with a beer, a hot chocolate, hands in pockets
			if ( u < 0.12 && ! kid ) { set( GESTURE.carry ); a.propR = PROP.beer; }
			else if ( u < 0.2 ) { set( GESTURE.carry ); a.propR = PROP.cocoa; }
			else if ( u < 0.36 ) { set( GESTURE.pockets ); a.propL = a.propR = PROP.pocket; }

		}

		// a furled umbrella in the right hand when he has one (not with a drink in it); opened outdoors
		p._brolly = ( D.wear & WEAR.brolly ) !== 0 && a.propR === 0 && ! kid;
		p._armR = a.armR.slice();
		this._thrLook( p, D, rain * 15 > D.at ? D.wear : 0, false );

	}

	// his Cast look tonight: the rain's gear on or not, dry under the roof
	_thrLook( p, D, wear, outdoors ) {

		const L = { ...D.look };
		L.poncho = wear & WEAR.poncho ? D.look.poncho : 0;
		if ( ( wear & WEAR.hood ) && ! ( wear & WEAR.poncho ) ) L.hat = HAT.hood;
		L.dry = ! outdoors;
		this.proxies.setLook( p, L );
		p._wear = wear;
		p._outdoors = outdoors;
		if ( p._brolly ) {

			const open = ( wear & WEAR.brolly ) && outdoors;
			p.pose.propR = wear & WEAR.brolly ? ( open ? PROP.umbrella : PROP.furled ) : 0;
			p.pose.armR = open ? GESTURE.carry[ 1 ].slice() : p._armR.slice();

		}

	}
	// ---- end FW1

	_alongWalk( s ) {

		const { seg, L } = this.walkLine;
		s = Math.max( 0, Math.min( L - 1e-3, s ) );
		for ( const g of seg ) if ( s <= g.s + g.l ) {

			const t = ( s - g.s ) / g.l;
			const ux = ( g.b[ 0 ] - g.a[ 0 ] ) / g.l, uz = ( g.b[ 1 ] - g.a[ 1 ] ) / g.l;
			return { x: g.a[ 0 ] + ( g.b[ 0 ] - g.a[ 0 ] ) * t, z: g.a[ 1 ] + ( g.b[ 1 ] - g.a[ 1 ] ) * t, ux, uz };

		}

		return { x: 0, z: 0, ux: 1, uz: 0 };

	}

	// ---- up and down the aisles of the field level, ushers at the top, security at the foot
	_aisles( bowl ) {

		const tier = bowl?.tiers?.[ 0 ];
		if ( ! tier ) return;
		const secs = tierSections( tier ), ys = rowHeights( tier ), D = tier.depth, S0 = tier.start || 0;
		const deep = tier.rows * D;
		const aisle = ( S, d ) => {

			const s = S.m0 * ( S0 + d );
			return [ S.a[ 0 ] + S.ux * s + S.nx * ( S0 + d ), S.a[ 1 ] + S.uz * s + S.nz * ( S0 + d ) ];

		};

		const yAt = ( d ) => {

			const r = Math.max( 0, Math.min( ys.length - 1, d / D ) ), i = Math.floor( r ), f = r - i;
			return ( ys[ i ] ?? ys[ ys.length - 1 ] ) * ( 1 - f ) + ( ys[ Math.min( ys.length - 1, i + 1 ) ] ?? ys[ ys.length - 1 ] ) * f;

		};

		this.aisleWalkers = [];
		secs.forEach( ( S, i ) => {

			if ( ! S.seats ) return;
			const top = aisle( S, deep + 0.5 );
			const inward = Math.atan2( S.nx, S.nz ); // facing the field (-n)
			if ( i % 2 === 0 ) this._add( ROLE.usher, top[ 0 ], yAt( deep ) + 0.05, top[ 1 ], inward );
			// ---- W4 (rail): the guard stands on the aisle's first step, facing the crowd. He stood in the
			// air in front of the wall (on the backstop's cushions, on the dugout roofs); behind a dugout the
			// section's first rows are its roof, so his step is the first row behind it
			const first = S.skipRows || 0;
			const foot = aisle( S, first * D + 0.3 );
			if ( i % 3 === 1 ) this._add( ROLE.security, foot[ 0 ], ys[ first ] + 0.01, foot[ 1 ], inward + Math.PI );
			// ---- end W4
			// one or two people on the steps
			for ( let k = 0; k < 2; k ++ ) {

				if ( rnd( i * 13 + k ) < 0.35 ) continue;
				const p = this._add( ROLE.fan, 0, 0, 0, 0 );
				if ( ! p ) return;
				p.walk = 1;
				// ---- W4 (rail): d0, where the steps start (behind a dugout, past its roof)
				const d0 = ( S.skipRows || 0 ) * D;
				p.aisle = { S, d: d0 + rnd( i * 7 + k ) * ( deep - d0 ), d0, dir: rnd( i * 3 + k ) < 0.5 ? - 1 : 1, deep, at: aisle, yAt, pause: 0 };

			}

		} );

	}

	// ---- the gates: a ticket taker at every turnstile, security either side, late arrivals crossing the plaza
	_gates( exterior ) {

		this.arrivals = [];
		for ( const lane of exterior?.lanes || [] ) {

			const yaw = Math.atan2( - lane.face[ 0 ], - lane.face[ 1 ] );
			const p = this._add( ROLE.usher, lane.at[ 0 ], STREET, lane.at[ 2 ], yaw );
			if ( p ) p.reachAt = rnd( this._seed ) * 5;

		}

		for ( const g of exterior?.gateGuards || [] ) this._add( ROLE.security, g.at[ 0 ], STREET, g.at[ 2 ], Math.atan2( - g.face[ 0 ], - g.face[ 1 ] ) );
		for ( const lane of ( exterior?.lanes || [] ).filter( ( l ) => /THIRD/.test( l.gate ) ) ) {

			for ( let k = 0; k < 2; k ++ ) {

				const p = this._add( ROLE.fan, 0, STREET, 0, 0 );
				if ( ! p ) break;
				p.walk = 1;
				p.arrive = { to: lane.entry, face: lane.face, t: rnd( this._seed * 11 + k ) };
				this.arrivals.push( p );

			}

		}

	}

	// ---- at the last out, police line the warning track facing the crowd
	_police( bowl ) {

		this.policeLine = [];
		const fence = bowl?.pit;
		if ( ! fence ) return;
		// round the infield stands' front, 1.5 m out from the wall, every 6 m
		const line = offsetPolyline( bowl.path.slice( 1, 11 ), - 1.8, [ 0, - 40 ] );
		let carry = 0;
		for ( let i = 0; i < line.length - 1; i ++ ) {

			const [ ax, az ] = line[ i ], [ bx, bz ] = line[ i + 1 ];
			const l = Math.hypot( bx - ax, bz - az );
			for ( let s = carry; s < l; s += 6 ) {

				const x = ax + ( bx - ax ) * s / l, z = az + ( bz - az ) * s / l;
				const p = this._add( ROLE.police, x, 0, z, Math.atan2( x - 0, z + 20 ) + Math.PI );
				if ( p ) {

					p.visible = false;
					this.policeLine.push( p );

				}

			}

			carry = ( carry + 6 - ( l % 6 ) ) % 6;

		}

	}

	update( dt, d ) {

		this.time += dt;
		const seg = d ? d.segmentAt( d.t ) : null;
		const snap = seg?.snap || {};
		// the lines: longer while the Rays bat (the home fans go for food) and between innings
		const between = seg && ( seg.kind === 'switch' || seg.kind === 'intro' );
		const busy = seg?.kind === 'celebrate' ? 0.1 : between ? 2.2 : snap.half === 'top' ? 1.7 : 0.6;
		for ( const st of this.stands ) {

			st.next -= dt;
			if ( st.next <= 0 ) {

				st.target = Math.min( st.line.length, Math.round( st.base * busy + ( rnd( this.time + st.base ) - 0.3 ) * 2 ) );
				if ( st.len < st.target ) st.len ++;
				else if ( st.len > st.target ) st.len --;
				st.next = 3 + rnd( this.time * 3 + st.base ) * 9;

			}

			st.line.forEach( ( p, q ) => {

				p.visible = q < st.len;
				p.reach = q === 0 ? 0.6 + 0.4 * Math.sin( this.time * 1.3 + p.seed * 9 ) : 0;

			} );
			st.staff.forEach( ( p, k ) => { if ( p ) p.reach = st.len > k ? 0.5 + 0.5 * Math.max( 0, Math.sin( this.time * 0.9 + p.seed * 20 ) ) : 0.1; } );

		}

		// the concourse: busier while the Rays bat
		const walkers = this.list.filter( ( p ) => p.walker );
		const share = seg?.kind === 'celebrate' ? 0.15 : between ? 1 : snap.half === 'top' ? 0.85 : 0.45;
		for ( const p of walkers ) {

			const w = p.walker;
			p.visible = w.busy < share;
			if ( ! p.visible ) continue;
			w.s += w.dir * w.speed * dt;
			if ( w.s < 0 || w.s > this.walkLine.L ) {

				w.dir *= - 1;
				w.s = Math.max( 0, Math.min( this.walkLine.L, w.s ) );

			}

			const a = this._alongWalk( w.s );
			p.x = a.x - a.uz * w.lane;
			p.z = a.z + a.ux * w.lane;
			p.y = STREET;
			p.yaw = Math.atan2( - a.ux * w.dir, - a.uz * w.dir );
			p.phase += dt * w.speed * 5.2;

		}

		// the aisles
		for ( const p of this.list ) if ( p.aisle ) {

			const A = p.aisle;
			if ( A.pause > 0 ) {

				A.pause -= dt;
				p.walk = 0;

			} else {

				p.walk = 1;
				A.d += A.dir * 0.75 * dt;
				if ( A.d > A.deep || A.d < ( A.d0 || 0 ) ) {

					A.dir *= - 1;
					A.pause = 2 + rnd( p.seed * 7 + this.time ) * 6;
					A.d = Math.max( A.d0 || 0, Math.min( A.deep, A.d ) );

				}

				p.phase += dt * 4.5;

			}

			const [ x, z ] = A.at( A.S, A.d );
			p.x = x; p.z = z; p.y = A.yAt( A.d ) + 0.02;
			p.yaw = Math.atan2( A.S.nx * A.dir, A.S.nz * A.dir ) + Math.PI;

		}

		// late arrivals: from the plaza to a turnstile, then gone through it
		for ( const p of this.arrivals ) {

			const A = p.arrive;
			A.t += dt / 22;
			if ( A.t > 1 ) A.t -= 1;
			const from = [ A.to[ 0 ] + A.face[ 0 ] * 30 + ( rnd( p.seed * 3 ) - 0.5 ) * 20, A.to[ 2 ] + A.face[ 1 ] * 30 ];
			p.x = from[ 0 ] + ( A.to[ 0 ] - from[ 0 ] ) * A.t;
			p.z = from[ 1 ] + ( A.to[ 2 ] - from[ 1 ] ) * A.t;
			p.y = STREET;
			p.yaw = Math.atan2( - ( A.to[ 0 ] - from[ 0 ] ), - ( A.to[ 2 ] - from[ 1 ] ) );
			p.phase += dt * 6;
			p.visible = A.t < 0.97;

		}

		// the ticket takers scan now and then
		for ( const p of this.list ) if ( p.reachAt != null ) p.reach = Math.max( 0, Math.sin( this.time * 0.8 + p.reachAt ) ) * 0.8;
		// the police come out for the last out
		const cel = seg?.kind === 'celebrate';
		for ( const p of this.policeLine ) p.visible = cel;

		// write the instances
		const M = this._m, q = this._q, v = this._v, s = this._s;
		const cy = Math.cos( this.field.group.rotation.y ), sy = Math.sin( this.field.group.rotation.y );
		let n = 0;
		for ( const p of this.list ) {

			// ---- W2 (concourse): not drawn where a place has its own people (see this.hiders)
			const hidden = this.hiders.length > 0 && Math.abs( p.y - STREET ) < 0.6 && this.hiders.some( ( h ) => h( p.x, p.z ) );
			// ---- end W2
			if ( ! p.visible || hidden ) {

				p.px = undefined;
				continue;

			}

			// the move since last frame, turned into the world frame (a fresh appearance has none)
			const dx = p.px === undefined ? 0 : p.x - p.px, dz = p.px === undefined ? 0 : p.z - p.pz, dy = p.px === undefined ? 0 : p.y - p.py;
			this.moved.set( [ dx * cy + dz * sy, dy, - dx * sy + dz * cy, 0 ], n * 4 );
			p.px = p.x; p.py = p.y; p.pz = p.z;
			q.setFromAxisAngle( this._up, p.yaw );
			M.compose( v.set( p.x, p.y, p.z ), q, s.setScalar( p.scale ) );
			this.mesh.setMatrixAt( n, M );
			this.info.set( [ p.phase, Math.min( 1, p.walk ), p.role + p.seed * 0.999, p.reach || 0 ], n * 4 );
			n ++;

		}

		this.mesh.count = Math.max( 1, n );
		this.mesh.instanceMatrix.needsUpdate = true;
		this.infoBuffer.write( this.info );
		this.movedBuffer.write( this.moved );
		this._throngUpdate( dt, d );

	}

}
