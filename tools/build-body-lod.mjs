// The ballplayer's far body: the MakeHuman body of src/ballpark/game/data/body.js simplified to about a
// sixth of its triangles, for the players drawn small (Players.js: under ~64 px tall). Written to
// src/ballpark/game/data/bodyLod.js as an index list into the body's own vertices, so every vertex it
// keeps has the body's exact position, normal, bones, weights and uniform layout (aField).
//
//   node tools/build-body-lod.mjs [triangles]
//
// How: quadric error (Garland & Heckbert 1997) half-edge collapses, cheapest first: a vertex is merged
// into a neighbour (it never moves, so nothing has to be interpolated). Not collapsed: the open edges
// (the ankles, the neck's rim) and across the eyes' edge; a collapse that would fold a triangle over or
// make the mesh non-manifold is refused.
import { writeFileSync } from 'node:fs';
import { BODY } from '../src/ballpark/game/data/body.js';

const OUT = new URL( '../src/ballpark/game/data/bodyLod.js', import.meta.url ).pathname;
const TARGET = Number( process.argv[ 2 ] ) || 3800;

const decode = ( b64, Type ) => {

	const bin = new Uint8Array( Buffer.from( b64, 'base64' ) );
	return new Type( bin.buffer, bin.byteOffset, bin.byteLength / Type.BYTES_PER_ELEMENT );

};

const n = BODY.count, Q = BODY.scale;
const P16 = decode( BODY.position, Int16Array ), X = decode( BODY.index, Uint16Array ), G = decode( BODY.flag, Uint8Array );
const F16 = decode( BODY.field, Int16Array );
const P = new Float64Array( n * 3 );
for ( let i = 0; i < n * 3; i ++ ) P[ i ] = P16[ i ] / Q;
const m = X.length / 3;
const T = new Int32Array( X ); // triangles' corners (rewritten by the collapses)
const alive = new Uint8Array( m ).fill( 1 );
// the triangles round each vertex
const vt = Array.from( { length: n }, () => new Set() );
for ( let t = 0; t < m; t ++ ) for ( let c = 0; c < 3; c ++ ) vt[ T[ t * 3 + c ] ].add( t );

// ---- quadrics (symmetric 4x4 as 10 numbers), area weighted
const qd = new Float64Array( n * 10 );
const normal = ( a, b, c, out ) => {

	const ax = P[ b * 3 ] - P[ a * 3 ], ay = P[ b * 3 + 1 ] - P[ a * 3 + 1 ], az = P[ b * 3 + 2 ] - P[ a * 3 + 2 ];
	const bx = P[ c * 3 ] - P[ a * 3 ], by = P[ c * 3 + 1 ] - P[ a * 3 + 1 ], bz = P[ c * 3 + 2 ] - P[ a * 3 + 2 ];
	out[ 0 ] = ay * bz - az * by; out[ 1 ] = az * bx - ax * bz; out[ 2 ] = ax * by - ay * bx;
	return Math.hypot( out[ 0 ], out[ 1 ], out[ 2 ] );

};
const nv = [ 0, 0, 0 ], nw = [ 0, 0, 0 ];
for ( let t = 0; t < m; t ++ ) {

	const a = T[ t * 3 ], b = T[ t * 3 + 1 ], c = T[ t * 3 + 2 ];
	const len = normal( a, b, c, nv );
	if ( len < 1e-14 ) continue;
	const x = nv[ 0 ] / len, y = nv[ 1 ] / len, z = nv[ 2 ] / len, d = - ( x * P[ a * 3 ] + y * P[ a * 3 + 1 ] + z * P[ a * 3 + 2 ] );
	const w = len / 2;
	const q = [ x * x, x * y, x * z, x * d, y * y, y * z, y * d, z * z, z * d, d * d ];
	for ( const v of [ a, b, c ] ) for ( let k = 0; k < 10; k ++ ) qd[ v * 10 + k ] += q[ k ] * w;

}

const err = ( q, v ) => {

	const x = P[ v * 3 ], y = P[ v * 3 + 1 ], z = P[ v * 3 + 2 ];
	return q[ 0 ] * x * x + 2 * q[ 1 ] * x * y + 2 * q[ 2 ] * x * z + 2 * q[ 3 ] * x + q[ 4 ] * y * y + 2 * q[ 5 ] * y * z + 2 * q[ 6 ] * y + q[ 7 ] * z * z + 2 * q[ 8 ] * z + q[ 9 ];

};

// ---- locked: the open edges' vertices (an edge with one triangle), and the eyes' rim (a vertex with
// neighbours of the other flag)
const locked = new Uint8Array( n );
{

	const edges = new Map();
	const key = ( a, b ) => a < b ? a * n + b : b * n + a;
	for ( let t = 0; t < m; t ++ ) for ( let c = 0; c < 3; c ++ ) {

		const k = key( T[ t * 3 + c ], T[ t * 3 + ( c + 1 ) % 3 ] );
		edges.set( k, ( edges.get( k ) || 0 ) + 1 );

	}

	for ( const [ k, c ] of edges ) if ( c !== 2 ) {

		locked[ Math.floor( k / n ) ] = 1;
		locked[ k % n ] = 1;

	}

	for ( let t = 0; t < m; t ++ ) {

		const a = T[ t * 3 ], b = T[ t * 3 + 1 ], c = T[ t * 3 + 2 ];
		if ( G[ a ] !== G[ b ] || G[ b ] !== G[ c ] ) locked[ a ] = locked[ b ] = locked[ c ] = 1;

	}

}

// the uniform's layout: a collapse across the arm's or the leg's start (aField -1 on one side, along the
// limb on the other) moves where the sleeve and the pants begin; it costs extra
const fieldOf = ( v ) => [ F16[ v * 2 ] / Q, F16[ v * 2 + 1 ] / Q ];
const fieldJump = ( u, v ) => {

	const a = fieldOf( u ), b = fieldOf( v );
	return ( ( a[ 0 ] > - 0.5 ) !== ( b[ 0 ] > - 0.5 ) ? 1 : 0 ) + ( ( a[ 1 ] > - 0.5 ) !== ( b[ 1 ] > - 0.5 ) ? 1 : 0 );

};

// ---- the heap of candidate collapses u -> v (lazy: stale entries are skipped by the vertices' stamps)
const stamp = new Int32Array( n );
const heap = [];
const push = ( e ) => {

	heap.push( e );
	let i = heap.length - 1;
	while ( i > 0 ) {

		const p = ( i - 1 ) >> 1;
		if ( heap[ p ][ 0 ] <= heap[ i ][ 0 ] ) break;
		[ heap[ p ], heap[ i ] ] = [ heap[ i ], heap[ p ] ];
		i = p;

	}

};
const pop = () => {

	const top = heap[ 0 ], last = heap.pop();
	if ( heap.length ) {

		heap[ 0 ] = last;
		let i = 0;
		for ( ;; ) {

			const l = i * 2 + 1, r = l + 1;
			let s = i;
			if ( l < heap.length && heap[ l ][ 0 ] < heap[ s ][ 0 ] ) s = l;
			if ( r < heap.length && heap[ r ][ 0 ] < heap[ s ][ 0 ] ) s = r;
			if ( s === i ) break;
			[ heap[ s ], heap[ i ] ] = [ heap[ i ], heap[ s ] ];
			i = s;

		}

	}

	return top;

};

const neighbours = ( v ) => {

	const s = new Set();
	for ( const t of vt[ v ] ) for ( let c = 0; c < 3; c ++ ) s.add( T[ t * 3 + c ] );
	s.delete( v );
	return s;

};

// a typical edge's length, for the field penalty's scale
let edgeSum = 0, edgeN = 0;
for ( let t = 0; t < m; t += 7 ) {

	const a = T[ t * 3 ], b = T[ t * 3 + 1 ];
	edgeSum += Math.hypot( P[ a * 3 ] - P[ b * 3 ], P[ a * 3 + 1 ] - P[ b * 3 + 1 ], P[ a * 3 + 2 ] - P[ b * 3 + 2 ] );
	edgeN ++;

}

const L0 = edgeSum / edgeN;
const q2 = new Float64Array( 10 );
const cost = ( u, v ) => {

	for ( let k = 0; k < 10; k ++ ) q2[ k ] = qd[ u * 10 + k ] + qd[ v * 10 + k ];
	return Math.max( 0, err( q2, v ) ) + fieldJump( u, v ) * L0 * L0 * L0 * 0.5;

};

const consider = ( u ) => {

	if ( locked[ u ] ) return;
	for ( const v of neighbours( u ) ) push( [ cost( u, v ), u, v, stamp[ u ], stamp[ v ] ] );

};

for ( let v = 0; v < n; v ++ ) consider( v );

// would collapsing u into v fold a triangle over, or leave the mesh non-manifold?
const valid = ( u, v ) => {

	// link condition: u and v share exactly the two vertices of the two triangles on their edge
	const nu = neighbours( u ), nvv = neighbours( v );
	let common = 0;
	for ( const w of nu ) if ( nvv.has( w ) ) common ++;
	let shared = 0;
	for ( const t of vt[ u ] ) if ( vt[ v ].has( t ) ) shared ++;
	if ( shared !== 2 || common !== 2 ) return false;
	for ( const t of vt[ u ] ) {

		if ( vt[ v ].has( t ) ) continue;
		const a = T[ t * 3 ], b = T[ t * 3 + 1 ], c = T[ t * 3 + 2 ];
		const l0 = normal( a, b, c, nv );
		const a2 = a === u ? v : a, b2 = b === u ? v : b, c2 = c === u ? v : c;
		const l1 = normal( a2, b2, c2, nw );
		if ( l1 < 1e-12 ) return false;
		if ( ( nv[ 0 ] * nw[ 0 ] + nv[ 1 ] * nw[ 1 ] + nv[ 2 ] * nw[ 2 ] ) / ( l0 * l1 ) < 0.35 ) return false;

	}

	return true;

};

let tris = m;
const removed = new Uint8Array( n );
while ( tris > TARGET && heap.length ) {

	const [ , u, v, su, sv ] = pop();
	if ( removed[ u ] || removed[ v ] || stamp[ u ] !== su || stamp[ v ] !== sv ) continue;
	if ( ! valid( u, v ) ) continue;
	// collapse u into v
	for ( const t of [ ...vt[ u ] ] ) {

		if ( vt[ v ].has( t ) ) {

			alive[ t ] = 0;
			tris --;
			for ( let c = 0; c < 3; c ++ ) vt[ T[ t * 3 + c ] ].delete( t );

		} else {

			for ( let c = 0; c < 3; c ++ ) if ( T[ t * 3 + c ] === u ) T[ t * 3 + c ] = v;
			vt[ v ].add( t );

		}

	}

	vt[ u ].clear();
	removed[ u ] = 1;
	for ( let k = 0; k < 10; k ++ ) qd[ v * 10 + k ] += qd[ u * 10 + k ];
	// everything round v has new costs
	const ring = neighbours( v );
	stamp[ v ] ++;
	for ( const w of ring ) stamp[ w ] ++;
	consider( v );
	for ( const w of ring ) consider( w );

}

const index = [];
for ( let t = 0; t < m; t ++ ) if ( alive[ t ] ) index.push( T[ t * 3 ], T[ t * 3 + 1 ], T[ t * 3 + 2 ] );
const used = new Set( index );
const b64 = ( a ) => Buffer.from( a.buffer, a.byteOffset, a.byteLength ).toString( 'base64' );
const js = `// Generated by tools/build-body-lod.mjs from data/body.js (the far players' body: Players.js). Don't
// edit: re-run the tool.
export const BODY_LOD = {
	triangles: ${ index.length / 3 }, vertices: ${ used.size },
	// into BODY's vertices
	index: '${ b64( new Uint16Array( index ) ) }',
};
`;
writeFileSync( OUT, js );
console.log( `${ m } -> ${ index.length / 3 } triangles, ${ n } -> ${ used.size } vertices: ${ OUT }` );
