import { BufferGeometry, Float32BufferAttribute, Vector2 } from '../engine/index.js';
import { triangulateShape } from '../engine/math/ShapeUtils.js';
import { Texture } from '../engine/gpu/Texture.js';
import { generateMipmaps } from '../engine/gpu/Mipmaps.js';

// Small geometry helpers shared by the ballpark's builders.

// A flat, upward-facing polygon at height y: contour [ [ x, z ], ... ] with optional holes.
// uv = ( x, z ), for world-space patterns.
export function flatPolygon( contour, holes = [], y = 0 ) {

	const c = contour.map( ( [ x, z ] ) => new Vector2( x, z ) );
	const h = holes.map( ( hole ) => hole.map( ( [ x, z ] ) => new Vector2( x, z ) ) );
	const tris = triangulateShape( c, h );
	const all = c.concat( ...h );
	const pos = [], nrm = [], uv = [];
	for ( const p of all ) {

		pos.push( p.x, y, p.y );
		nrm.push( 0, 1, 0 );
		uv.push( p.x, p.y );

	}

	// wind every triangle to face up, whichever way the outline runs
	const index = [];
	for ( const [ a, b, cc ] of tris ) {

		const A = all[ a ], Bv = all[ b ], C = all[ cc ];
		const up = ( Bv.y - A.y ) * ( C.x - A.x ) - ( Bv.x - A.x ) * ( C.y - A.y );
		if ( up > 0 ) index.push( a, b, cc );
		else index.push( a, cc, b );

	}
	const g = new BufferGeometry();
	g.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
	g.setAttribute( 'normal', new Float32BufferAttribute( nrm, 3 ) );
	g.setAttribute( 'uv', new Float32BufferAttribute( uv, 2 ) );
	g.setIndex( index );
	g.computeBoundingBox();
	g.computeBoundingSphere();
	return g;

}

// A polygon offset outward by d (mitred), for a closed loop.
export function offsetLoop( P, d ) {

	const n = P.length;
	// orientation: positive area = counter-clockwise in ( x, z )
	let area = 0;
	for ( let i = 0; i < n; i ++ ) {

		const [ ax, az ] = P[ i ], [ bx, bz ] = P[ ( i + 1 ) % n ];
		area += ax * bz - bx * az;

	}

	const s = area > 0 ? 1 : - 1;
	const out = [];
	for ( let i = 0; i < n; i ++ ) {

		const [ px, pz ] = P[ ( i + n - 1 ) % n ], [ cx, cz ] = P[ i ], [ qx, qz ] = P[ ( i + 1 ) % n ];
		const l1 = Math.hypot( cx - px, cz - pz ) || 1, l2 = Math.hypot( qx - cx, qz - cz ) || 1;
		// outward normals of the two edges
		const n1 = [ s * ( cz - pz ) / l1, - s * ( cx - px ) / l1 ], n2 = [ s * ( qz - cz ) / l2, - s * ( qx - cx ) / l2 ];
		let mx = n1[ 0 ] + n2[ 0 ], mz = n1[ 1 ] + n2[ 1 ];
		const ml = Math.hypot( mx, mz ) || 1;
		mx /= ml; mz /= ml;
		const k = d / Math.max( 0.35, mx * n2[ 0 ] + mz * n2[ 1 ] );
		out.push( [ cx + mx * k, cz + mz * k ] );

	}

	return out;

}

// A texture drawn on a 2D canvas (text, signs, the scoreboard): draw( ctx, w, h ). Canvas colours are
// sRGB: the texture is too, so the shaders get linear values (Phillies red stays red, not pink).
export function canvasTexture( w, h, draw, label = 'canvas' ) {

	const canvas = new OffscreenCanvas( w, h );
	const ctx = canvas.getContext( '2d', { willReadFrequently: true } );
	draw( ctx, w, h );
	const img = ctx.getImageData( 0, 0, w, h );
	const tex = new Texture( { label, width: w, height: h, format: 'rgba8unorm-srgb', mips: true, usage: [ 'sample', 'copyDst' ], data: new Uint8Array( img.data.buffer ) } );
	tex.getGPU();
	generateMipmaps( tex );
	tex.canvas = canvas;
	return tex;

}

// segment helpers
export const segLen = ( a, b ) => Math.hypot( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ] );
export const lerp2 = ( a, b, t ) => [ a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * t, a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * t ];

// A square steel member of width w from a to b ([ x, y, z ]), added to a Quads (Stands.js): four sides
// and the two ends. Merging a structure's members into one geometry keeps it to one draw.
export function beam( q, a, b, w ) {

	const d = [ b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ], b[ 2 ] - a[ 2 ] ];
	const l = Math.hypot( ...d ) || 1;
	d[ 0 ] /= l; d[ 1 ] /= l; d[ 2 ] /= l;
	// two directions across it
	const ref = Math.abs( d[ 1 ] ) > 0.9 ? [ 1, 0, 0 ] : [ 0, 1, 0 ];
	let e1 = [ d[ 1 ] * ref[ 2 ] - d[ 2 ] * ref[ 1 ], d[ 2 ] * ref[ 0 ] - d[ 0 ] * ref[ 2 ], d[ 0 ] * ref[ 1 ] - d[ 1 ] * ref[ 0 ] ];
	const l1 = Math.hypot( ...e1 );
	e1 = e1.map( ( v ) => v / l1 );
	const e2 = [ e1[ 1 ] * d[ 2 ] - e1[ 2 ] * d[ 1 ], e1[ 2 ] * d[ 0 ] - e1[ 0 ] * d[ 2 ], e1[ 0 ] * d[ 1 ] - e1[ 1 ] * d[ 0 ] ];
	const h = w / 2;
	const c = ( p, s1, s2 ) => [ p[ 0 ] + ( e1[ 0 ] * s1 + e2[ 0 ] * s2 ) * h, p[ 1 ] + ( e1[ 1 ] * s1 + e2[ 1 ] * s2 ) * h, p[ 2 ] + ( e1[ 2 ] * s1 + e2[ 2 ] * s2 ) * h ];
	const S = [ [ 1, 1 ], [ - 1, 1 ], [ - 1, - 1 ], [ 1, - 1 ] ];
	for ( let i = 0; i < 4; i ++ ) {

		const [ s1, s2 ] = S[ i ], [ t1, t2 ] = S[ ( i + 1 ) % 4 ];
		const n = [ 0, 1, 2 ].map( ( k ) => e1[ k ] * ( s1 + t1 ) + e2[ k ] * ( s2 + t2 ) );
		q.add( c( a, s1, s2 ), c( a, t1, t2 ), c( b, t1, t2 ), c( b, s1, s2 ), n );

	}

	q.add( c( a, 1, 1 ), c( a, - 1, 1 ), c( a, - 1, - 1 ), c( a, 1, - 1 ), d.map( ( v ) => - v ) );
	q.add( c( b, 1, 1 ), c( b, - 1, 1 ), c( b, - 1, - 1 ), c( b, 1, - 1 ), d );

}

// an axis-aligned box centred on c with sizes s ([ x, y, z ]), added to a Quads
export function box( q, c, s ) {

	const [ x, y, z ] = c, [ hx, hy, hz ] = [ s[ 0 ] / 2, s[ 1 ] / 2, s[ 2 ] / 2 ];
	const P = ( i, j, k ) => [ x + i * hx, y + j * hy, z + k * hz ];
	q.add( P( - 1, - 1, 1 ), P( 1, - 1, 1 ), P( 1, 1, 1 ), P( - 1, 1, 1 ), [ 0, 0, 1 ] );
	q.add( P( 1, - 1, - 1 ), P( - 1, - 1, - 1 ), P( - 1, 1, - 1 ), P( 1, 1, - 1 ), [ 0, 0, - 1 ] );
	q.add( P( 1, - 1, 1 ), P( 1, - 1, - 1 ), P( 1, 1, - 1 ), P( 1, 1, 1 ), [ 1, 0, 0 ] );
	q.add( P( - 1, - 1, - 1 ), P( - 1, - 1, 1 ), P( - 1, 1, 1 ), P( - 1, 1, - 1 ), [ - 1, 0, 0 ] );
	q.add( P( - 1, 1, 1 ), P( 1, 1, 1 ), P( 1, 1, - 1 ), P( - 1, 1, - 1 ), [ 0, 1, 0 ] );
	q.add( P( - 1, - 1, - 1 ), P( 1, - 1, - 1 ), P( 1, - 1, 1 ), P( - 1, - 1, 1 ), [ 0, - 1, 0 ] );

}

// the point at distance s along a polyline, and the unit direction there
export function alongPolyline( P, s ) {

	let acc = 0;
	for ( let i = 0; i < P.length - 1; i ++ ) {

		const l = segLen( P[ i ], P[ i + 1 ] );
		if ( acc + l >= s || i === P.length - 2 ) {

			const t = Math.max( 0, Math.min( 1, ( s - acc ) / ( l || 1 ) ) );
			return { p: lerp2( P[ i ], P[ i + 1 ], t ), dir: [ ( P[ i + 1 ][ 0 ] - P[ i ][ 0 ] ) / l, ( P[ i + 1 ][ 1 ] - P[ i ][ 1 ] ) / l ] };

		}

		acc += l;

	}

	return { p: P[ 0 ], dir: [ 1, 0 ] };

}

// the distance along a polyline to its closest point to p
export function nearestAlong( P, p ) {

	let best = Infinity, bestS = 0, acc = 0;
	for ( let i = 0; i < P.length - 1; i ++ ) {

		const a = P[ i ], b = P[ i + 1 ], l = segLen( a, b );
		if ( l < 1e-6 ) continue;
		const t = Math.max( 0, Math.min( 1, ( ( p[ 0 ] - a[ 0 ] ) * ( b[ 0 ] - a[ 0 ] ) + ( p[ 1 ] - a[ 1 ] ) * ( b[ 1 ] - a[ 1 ] ) ) / ( l * l ) ) );
		const d = segLen( lerp2( a, b, t ), p );
		if ( d < best ) {

			best = d; bestS = acc + t * l;

		}

		acc += l;

	}

	return bestS;

}
