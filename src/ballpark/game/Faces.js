import { BODY } from './data/body.js';

// ---- FF3 (step 10): every man's own face from MakeHuman's own targets (tools/build-body.mjs: the head's
// blend shapes in data/body.js), as the fans' are (FF1, FanHead.js). A face is the body's head moved by a
// man's weights on MakeHuman's face modifiers (the nose, the mouth and lips, the chin and jaw, the cheeks,
// the eyes and lids, the brows, the forehead, the ears, the neck; each its two ends), its seven head
// shapes, and the macro targets' share of the face (how African or Asian against the body's own mix, his
// age, his weight): Looks.js' `mh` for each look, from the Series' photos for the men in them, from his
// look (FY4's sixteen numbers, his skin, age and build) for the rest.
//
//   HEAD.count                 the head's vertices (the body's above the collar, and the eyeballs)
//   headOf( i )                a body vertex's head vertex, or -1
//   bakeFace( mh )             his face as the slot buffer's records, 4 u32 a head vertex: the move
//                              (x y | z, the normal's change x | y z, as halves), worked out once when he
//                              comes on (Players.js), so every figure (near, middle, far) takes it for one
//                              read a vertex; the normals worked out again from the moved head's own
//                              triangles, so he shades as his own shape
//   exprRecords()              the expressions (the mouth open, the smile, the blink: MakeHuman's units,
//                              FF2's), 2 records of 4 u32 a head vertex, for the near figure's blend

const dec = ( s, T ) => {

	const b = typeof Buffer !== 'undefined' ? Buffer.from( s, 'base64' ) : Uint8Array.from( atob( s ), ( c ) => c.charCodeAt( 0 ) );
	const copy = new Uint8Array( b.byteLength );
	copy.set( b );
	return new T( copy.buffer );

};

const H = BODY.head;
export const HEAD = { count: H.count };
const HV = H.count;
const VERTS = dec( H.vertices, Uint16Array );
const VAL = dec( H.value, Int8Array ), IDX = dec( H.index, Uint16Array );
const SHAPES = new Map( H.shapes.map( ( [ name, v0, count, scale, i0 ] ) => [ name, { v0, count, scale, i0 } ] ) );
export const SHAPE_NAMES = H.shapes.map( ( s ) => s[ 0 ] );

let _of = null;
export function headOf( i ) {

	if ( ! _of ) {

		_of = new Int32Array( BODY.count ).fill( - 1 );
		VERTS.forEach( ( v, h ) => { _of[ v ] = h; } );

	}

	return _of[ i ];

}

// the head's base positions and the triangles round it (the body's: a head vertex's normal takes every
// triangle it's in, the ones reaching down past the collar too, their other corners fixed)
let _geo = null;
function geo() {

	if ( _geo ) return _geo;
	const P = dec( BODY.position, Int16Array ), X = dec( BODY.index, Uint16Array );
	const pos = new Float64Array( HV * 3 );
	for ( let h = 0; h < HV; h ++ ) for ( let c = 0; c < 3; c ++ ) pos[ h * 3 + c ] = P[ VERTS[ h ] * 3 + c ] / BODY.scale;
	// the triangles: corners as head vertices (>= 0) or fixed points (-1 - their number in `fixed`)
	const fixedOf = new Map(), fixed = [], tris = [];
	for ( let t = 0; t < X.length; t += 3 ) {

		const c = [ X[ t ], X[ t + 1 ], X[ t + 2 ] ].map( ( i ) => headOf( i ) );
		if ( c[ 0 ] < 0 && c[ 1 ] < 0 && c[ 2 ] < 0 ) continue;
		tris.push( ...[ 0, 1, 2 ].map( ( k ) => {

			if ( c[ k ] >= 0 ) return c[ k ];
			const i = X[ t + k ];
			if ( ! fixedOf.has( i ) ) {

				fixedOf.set( i, fixed.length / 3 );
				fixed.push( P[ i * 3 ] / BODY.scale, P[ i * 3 + 1 ] / BODY.scale, P[ i * 3 + 2 ] / BODY.scale );

			}

			return - 1 - fixedOf.get( i );

		} ) );

	}

	_geo = { pos, fixed: new Float64Array( fixed ), tris: new Int32Array( tris ) };
	_geo.n0 = normalsOf( new Float64Array( HV * 3 ) );
	return _geo;

}

function normalsOf( D ) {

	const { pos, fixed, tris } = geo();
	const N = new Float64Array( HV * 3 );
	const p = [ [ 0, 0, 0 ], [ 0, 0, 0 ], [ 0, 0, 0 ] ];
	for ( let t = 0; t < tris.length; t += 3 ) {

		for ( let k = 0; k < 3; k ++ ) {

			const c = tris[ t + k ];
			if ( c >= 0 ) for ( let j = 0; j < 3; j ++ ) p[ k ][ j ] = pos[ c * 3 + j ] + D[ c * 3 + j ];
			else for ( let j = 0; j < 3; j ++ ) p[ k ][ j ] = fixed[ ( - 1 - c ) * 3 + j ];

		}

		const ax = p[ 1 ][ 0 ] - p[ 0 ][ 0 ], ay = p[ 1 ][ 1 ] - p[ 0 ][ 1 ], az = p[ 1 ][ 2 ] - p[ 0 ][ 2 ];
		const bx = p[ 2 ][ 0 ] - p[ 0 ][ 0 ], by = p[ 2 ][ 1 ] - p[ 0 ][ 1 ], bz = p[ 2 ][ 2 ] - p[ 0 ][ 2 ];
		const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
		for ( let k = 0; k < 3; k ++ ) {

			const c = tris[ t + k ];
			if ( c >= 0 ) { N[ c * 3 ] += nx; N[ c * 3 + 1 ] += ny; N[ c * 3 + 2 ] += nz; }

		}

	}

	for ( let h = 0; h < HV; h ++ ) {

		const l = Math.hypot( N[ h * 3 ], N[ h * 3 + 1 ], N[ h * 3 + 2 ] ) || 1;
		N[ h * 3 ] /= l; N[ h * 3 + 1 ] /= l; N[ h * 3 + 2 ] /= l;

	}

	return N;

}

// IEEE halves, two to a u32
const _f = new Float32Array( 1 ), _u = new Uint32Array( _f.buffer );
function f16( x ) {

	_f[ 0 ] = x;
	const b = _u[ 0 ], s = ( b >>> 16 ) & 0x8000;
	let e = ( ( b >>> 23 ) & 0xff ) - 127 + 15, m = b & 0x7fffff;
	if ( e <= 0 ) return s;
	if ( e >= 31 ) return s | 0x7c00;
	m += 0x1000;
	if ( m & 0x800000 ) { m = 0; e ++; }
	return s | ( e << 10 ) | ( m >>> 13 );

}
const pack2 = ( a, b ) => ( f16( a ) | ( f16( b ) << 16 ) ) >>> 0;

// a shape's move added in, times w
function addShape( D, name, w ) {

	const s = SHAPES.get( name );
	if ( ! s || ! w ) return;
	const k = w * s.scale;
	for ( let e = 0; e < s.count; e ++ ) {

		const h = s.i0 < 0 ? e : IDX[ s.i0 + e ];
		const v = ( s.v0 + e ) * 3;
		D[ h * 3 ] += VAL[ v ] * k; D[ h * 3 + 1 ] += VAL[ v + 1 ] * k; D[ h * 3 + 2 ] += VAL[ v + 2 ] * k;

	}

}

// his move: mh is { modifier: -1..1 (the decrease's end below 0, the increase's above), 'shape-round':
// 0..1, ..., african, asian (his shares, 0..1), old (0 young .. 1 old), weight (-1 slight .. 1 heavy),
// female (0..1: the ball girls) }
export function faceMove( mh = {} ) {

	const D = new Float64Array( HV * 3 );
	for ( const [ k, v ] of Object.entries( mh ) ) {

		if ( ! v ) continue;
		if ( k === 'african' ) addShape( D, 'eth-african', v - 0.3 );
		else if ( k === 'asian' ) addShape( D, 'eth-asian', v - 0.2 );
		else if ( k === 'old' || k === 'female' ) addShape( D, k, v );
		else if ( k === 'weight' ) addShape( D, v > 0 ? 'heavy' : 'light', Math.abs( v ) );
		else if ( k.startsWith( 'shape-' ) ) addShape( D, k, v );
		else if ( SHAPES.has( k + '+-' ) ) addShape( D, k + '+-', v );
		else addShape( D, k + ( v > 0 ? '+' : '-' ), Math.abs( v ) );

	}

	return D;

}

export function bakeFace( mh ) {

	const D = faceMove( mh );
	const N = normalsOf( D ), n0 = geo().n0;
	const out = new Uint32Array( HV * 4 );
	for ( let h = 0; h < HV; h ++ ) {

		const o = h * 4, i = h * 3;
		out[ o ] = pack2( D[ i ], D[ i + 1 ] );
		out[ o + 1 ] = pack2( D[ i + 2 ], N[ i ] - n0[ i ] );
		out[ o + 2 ] = pack2( N[ i + 1 ] - n0[ i + 1 ], N[ i + 2 ] - n0[ i + 2 ] );

	}

	return out;

}

// the expressions' records, dense over the head (zero where they move nothing)
export function exprRecords() {

	const idx = dec( H.exprIndex, Uint16Array ), rec = dec( H.exprRec, Uint32Array );
	const out = new Uint32Array( HV * 8 );
	idx.forEach( ( h, e ) => out.set( rec.subarray( e * 8, e * 8 + 8 ), h * 8 ) );
	return out;

}
// ---- end FF3
