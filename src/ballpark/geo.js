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

// A texture drawn on a 2D canvas (text, signs, the scoreboard): draw( ctx, w, h ).
export function canvasTexture( w, h, draw, label = 'canvas' ) {

	const canvas = new OffscreenCanvas( w, h );
	const ctx = canvas.getContext( '2d' );
	draw( ctx, w, h );
	const img = ctx.getImageData( 0, 0, w, h );
	const tex = new Texture( { label, width: w, height: h, format: 'rgba8unorm', mips: true, usage: [ 'sample', 'copyDst' ], data: new Uint8Array( img.data.buffer ) } );
	tex.getGPU();
	generateMipmaps( tex );
	tex.canvas = canvas;
	return tex;

}

// segment helpers
export const segLen = ( a, b ) => Math.hypot( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ] );
export const lerp2 = ( a, b, t ) => [ a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * t, a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * t ];
