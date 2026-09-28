import { Mesh, BufferGeometry, Float32BufferAttribute } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { commonModule } from '../../../engine/render/wgsl/common.js';
import { canvasTexture } from '../../geo.js';
import { drawAtlas, CELLS, ATLAS_W, ATLAS_H } from './Atlas.js';

// The left field corner's things, all in one draw (W2's Concourse3BProps.Kit, for this place): a vertex's
// uv is either a palette entry (uv.x < 100: its colour, gloss and glow) or a place in the corner's atlas
// of printed and lit things (uv offset by 100: Harry the K's signs and menu, the back bar, the photographs,
// the section plates, the ramp's signs; the atlas's top half glows).
//
//   const K = new Kit();
//   const P = K.frame( F )                   F a Frame (Frame.js): P( x, y, z ) local x, field y, local z
//   K.use( 'mahogany' ).box( P, x, y, z, sx, sy, sz, print? )
//   K.cyl( P, x, z, y0, y1, r0, r1, n, { top, bottom } ); K.quad( a, b, c, d, n, uv? ); K.panel( ... )
//   group.add( K.mesh( name ) )

// [ name, linear albedo, roughness, metalness, glow ]
export const PALETTE = [
	[ 'mahogany', [ 0.075, 0.028, 0.014 ], 0.32, 0 ], [ 'oak', [ 0.23, 0.13, 0.065 ], 0.55, 0 ], [ 'brass', [ 0.5, 0.36, 0.12 ], 0.28, 1 ],
	[ 'chrome', [ 0.78, 0.78, 0.8 ], 0.14, 1 ], [ 'black', [ 0.012, 0.012, 0.013 ], 0.5, 0 ], [ 'iron', [ 0.03, 0.03, 0.034 ], 0.4, 0.6 ],
	[ 'laminate', [ 0.018, 0.018, 0.02 ], 0.18, 0 ], [ 'redVinyl', [ 0.28, 0.018, 0.02 ], 0.38, 0 ], [ 'navy', [ 0.012, 0.02, 0.06 ], 0.6, 0 ],
	[ 'tile', [ 0.045, 0.036, 0.03 ], 0.3, 0 ], [ 'ceiling', [ 0.028, 0.026, 0.025 ], 0.85, 0 ], [ 'lamp', [ 0.8, 0.75, 0.62 ], 0.5, 0, [ 1.0, 0.78, 0.5 ] ],
	[ 'flame', [ 0.5, 0.2, 0.05 ], 0.5, 0, [ 1.0, 0.42, 0.1 ] ], [ 'steel', [ 0.5, 0.51, 0.52 ], 0.3, 0.9 ], [ 'white', [ 0.72, 0.71, 0.68 ], 0.7, 0 ],
	[ 'bottleGreen', [ 0.03, 0.12, 0.04 ], 0.08, 0.2 ], [ 'bottleAmber', [ 0.18, 0.07, 0.01 ], 0.08, 0.2 ], [ 'beer', [ 0.55, 0.33, 0.04 ], 0.1, 0 ],
	[ 'foam', [ 0.75, 0.72, 0.62 ], 0.9, 0 ], [ 'screen', [ 0.015, 0.016, 0.02 ], 0.15, 0 ], [ 'red', [ 0.33, 0.018, 0.024 ], 0.42, 0 ],
	[ 'cream', [ 0.7, 0.64, 0.52 ], 0.7, 0 ], [ 'galv', [ 0.42, 0.43, 0.44 ], 0.35, 0.8 ], [ 'maroon', [ 0.12, 0.03, 0.03 ], 0.6, 0.4 ],
	[ 'concrete', [ 0.3, 0.29, 0.27 ], 0.9, 0 ], [ 'rubber', [ 0.015, 0.015, 0.016 ], 0.8, 0 ], [ 'bag', [ 0.01, 0.01, 0.012 ], 0.25, 0 ],
	[ 'cup', [ 0.8, 0.78, 0.74 ], 0.4, 0 ], [ 'napkin', [ 0.8, 0.79, 0.76 ], 0.9, 0 ], [ 'ketchup', [ 0.45, 0.02, 0.012 ], 0.3, 0 ],
	[ 'basket', [ 0.35, 0.02, 0.02 ], 0.5, 0 ], [ 'fries', [ 0.75, 0.52, 0.18 ], 0.8, 0 ], [ 'redLamp', [ 0.4, 0.05, 0.02 ], 0.4, 0, [ 1.0, 0.25, 0.08 ] ],
	[ 'coolLamp', [ 0.7, 0.72, 0.75 ], 0.5, 0, [ 0.8, 0.85, 1.0 ] ], [ 'orange', [ 0.7, 0.22, 0.02 ], 0.4, 0 ], [ 'gulf', [ 0.75, 0.2, 0.02 ], 0.4, 0, [ 0.9, 0.3, 0.05 ] ],
	[ 'green', [ 0.04, 0.2, 0.08 ], 0.5, 0 ], [ 'blueRamp', [ 0.02, 0.05, 0.12 ], 0.6, 0.3 ],
	[ 'blueTop', [ 0.025, 0.05, 0.32 ], 0.12, 0.1 ], [ 'whiteStool', [ 0.74, 0.74, 0.72 ], 0.38, 0 ], [ 'netting', [ 0.01, 0.01, 0.01 ], 0.9, 0 ],
	[ 'crt', [ 0.05, 0.05, 0.055 ], 0.45, 0 ], [ 'dome', [ 0.35, 0.35, 0.33 ], 0.3, 0.6 ],
];
export const PAL = Object.fromEntries( PALETTE.map( ( p, i ) => [ p[ 0 ], i ] ) );
const f3 = ( c ) => `vec3f( ${ c.map( ( v ) => v.toFixed( 3 ) ).join( ', ' ) } )`;

// a cell's corner ( u, v in 0..1 across it ) as the uv that addresses it (offset by 100; by 200 to light a
// printed cell from behind: the lineup's cards in their light boxes)
export function atlasUV( name, u, v, lit = false ) {

	const [ x, y, w, h ] = CELLS[ name ];
	const o = lit ? 200 : 100;
	return [ o + ( x + u * w ) / ATLAS_W, o + ( y + v * h ) / ATLAS_H ];

}

let _atlas = null;
let _material = null;

function kitMaterial() {

	if ( _material ) return _material;
	_atlas ||= canvasTexture( ATLAS_W, ATLAS_H, drawAtlas, 'leftfieldAtlas' );
	const mat = standard( {
		name: 'leftfield-things', roughness: 0.5, modules: [ commonModule ], textures: { lfAtlas: _atlas },
		surface: /* wgsl */`
	var alb = array<vec3f, ${ PALETTE.length }>( ${ PALETTE.map( ( p ) => f3( p[ 1 ] ) ).join( ', ' ) } );
	var rm = array<vec2f, ${ PALETTE.length }>( ${ PALETTE.map( ( p ) => `vec2f( ${ p[ 2 ].toFixed( 2 ) }, ${ p[ 3 ].toFixed( 2 ) } )` ).join( ', ' ) } );
	var glo = array<vec3f, ${ PALETTE.length }>( ${ PALETTE.map( ( p ) => f3( p[ 4 ] || [ 0, 0, 0 ] ) ).join( ', ' ) } );
	let nk = smoothstep( 0.1, 0.7, frame.night );
	if ( in.uv.x >= 99.0 ) {
		// printed (the atlas's lower half) or lit from behind (its upper half: the signs, the back bar,
		// the menu boards): lit all night, and a little by day
		let boxed = in.uv.x >= 199.0;
		let uv = in.uv - vec2f( select( 100.0, 200.0, boxed ) );
		let t = textureSample( lfAtlas, smpAnisoClamp, uv ).rgb;
		let lit = max( step( uv.y, 0.5 ), select( 0.0, 1.0, boxed ) );
		s.albedo = t * mix( 0.8, 0.25, lit );
		s.roughness = mix( 0.6, 0.3, lit );
		s.emissive = t * lit * mix( 0.55, 1.35, nk );
	} else {
		let k = min( u32( max( in.uv.x, 0.0 ) ), ${ PALETTE.length - 1 }u );
		s.albedo = alb[ k ];
		s.roughness = rm[ k ].x;
		s.metalness = rm[ k ].y;
		s.emissive = glo[ k ] * mix( 0.7, 1.7, nk );
		// wear where hands and feet get at things
		s.albedo *= 1.0 - 0.05 * mx_noise_float3( in.P * 7.0 );
	}
`,
	} );
	mat.underwaterLighting = 'none';
	mat.setDefine( 'DRY', 1 );
	_material = mat;
	return mat;

}

export class Kit {

	constructor() {

		this.pos = []; this.nrm = []; this.uv = [];
		this.k = 0;
		this.material = kitMaterial();

	}

	use( name ) {

		this.k = PAL[ name ];
		return this;

	}

	// a frame: P( x, y, z ) at local x and z (Frame.js), field-frame height y; P.dir( x, y, z ) a direction
	frame( F ) {

		const P = ( x, y, z ) => {

			const [ fx, fz ] = F.field( x, z );
			return [ fx, y, fz ];

		};
		P.dir = ( x, y, z ) => {

			const [ dx, dz ] = F.dir( x, z );
			return [ dx, y, dz ];

		};
		return P;

	}

	tri( a, b, c, na, nb, nc, ua, ub, uc ) {

		// wound to face along the normals
		const e1 = [ b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ], b[ 2 ] - a[ 2 ] ], e2 = [ c[ 0 ] - a[ 0 ], c[ 1 ] - a[ 1 ], c[ 2 ] - a[ 2 ] ];
		const cx = e1[ 1 ] * e2[ 2 ] - e1[ 2 ] * e2[ 1 ], cy = e1[ 2 ] * e2[ 0 ] - e1[ 0 ] * e2[ 2 ], cz = e1[ 0 ] * e2[ 1 ] - e1[ 1 ] * e2[ 0 ];
		const n = [ na[ 0 ] + nb[ 0 ] + nc[ 0 ], na[ 1 ] + nb[ 1 ] + nc[ 1 ], na[ 2 ] + nb[ 2 ] + nc[ 2 ] ];
		if ( cx * n[ 0 ] + cy * n[ 1 ] + cz * n[ 2 ] < 0 ) {

			[ b, c ] = [ c, b ]; [ nb, nc ] = [ nc, nb ]; [ ub, uc ] = [ uc, ub ];

		}

		const pal = [ this.k + 0.5, 0.5 ];
		this.pos.push( ...a, ...b, ...c );
		for ( const nn of [ na, nb, nc ] ) {

			const l = Math.hypot( ...nn ) || 1;
			this.nrm.push( nn[ 0 ] / l, nn[ 1 ] / l, nn[ 2 ] / l );

		}

		this.uv.push( ...( ua || pal ), ...( ub || pal ), ...( uc || pal ) );

	}

	quad( a, b, c, d, n, uv = null ) {

		this.tri( a, b, c, n, n, n, uv?.[ 0 ], uv?.[ 1 ], uv?.[ 2 ] );
		this.tri( a, c, d, n, n, n, uv?.[ 0 ], uv?.[ 2 ], uv?.[ 3 ] );

	}

	// a box in frame P: centre ( x, y, z ), sizes along x, up, z; `print` an atlas cell on its -z face (the
	// face toward home plate, in the board's frame), `printBack` on its +z face
	box( P, x, y, z, sx, sy, sz, print = null, printBack = null ) {

		const c = ( i, j, k ) => P( x + i * sx / 2, y + j * sy / 2, z + k * sz / 2 );
		const F = P.dir( 0, 0, - 1 ), R = P.dir( 1, 0, 0 );
		const cell = ( name ) => name ? [ atlasUV( name, 0, 1 ), atlasUV( name, 1, 1 ), atlasUV( name, 1, 0 ), atlasUV( name, 0, 0 ) ] : null;
		// (seen from home plate the board frame's +x is on the left)
		this.quad( c( 1, - 1, - 1 ), c( - 1, - 1, - 1 ), c( - 1, 1, - 1 ), c( 1, 1, - 1 ), F, cell( print ) );
		this.quad( c( - 1, - 1, 1 ), c( 1, - 1, 1 ), c( 1, 1, 1 ), c( - 1, 1, 1 ), F.map( ( v ) => - v ), cell( printBack ) );
		this.quad( c( 1, - 1, 1 ), c( 1, - 1, - 1 ), c( 1, 1, - 1 ), c( 1, 1, 1 ), R );
		this.quad( c( - 1, - 1, - 1 ), c( - 1, - 1, 1 ), c( - 1, 1, 1 ), c( - 1, 1, - 1 ), R.map( ( v ) => - v ) );
		this.quad( c( - 1, 1, 1 ), c( 1, 1, 1 ), c( 1, 1, - 1 ), c( - 1, 1, - 1 ), [ 0, 1, 0 ] );
		this.quad( c( - 1, - 1, - 1 ), c( 1, - 1, - 1 ), c( 1, - 1, 1 ), c( - 1, - 1, 1 ), [ 0, - 1, 0 ] );

	}

	// a flat printed panel facing local -z (toward home) or +z (back = true): centre ( x, y, z ), w x h
	panel( P, x, y, z, w, h, print, back = false, lit = false ) {

		// the cell's left edge on the viewer's left (facing home, that's the frame's +x)
		const s = back ? 1 : - 1;
		const a = P( x - s * w / 2, y - h / 2, z ), b = P( x + s * w / 2, y - h / 2, z ), c = P( x + s * w / 2, y + h / 2, z ), d = P( x - s * w / 2, y + h / 2, z );
		this.quad( a, b, c, d, P.dir( 0, 0, back ? 1 : - 1 ), [ atlasUV( print, 0, 1, lit ), atlasUV( print, 1, 1, lit ), atlasUV( print, 1, 0, lit ), atlasUV( print, 0, 0, lit ) ] );

	}

	// a panel on a plane given by its lower-left corner, its right ( rx, rz ) and its facing, in the field frame
	panelAt( a, right, up, w, h, n, print, lit = false ) {

		const b = [ a[ 0 ] + right[ 0 ] * w, a[ 1 ] + right[ 1 ] * w, a[ 2 ] + right[ 2 ] * w ];
		const c = [ b[ 0 ] + up[ 0 ] * h, b[ 1 ] + up[ 1 ] * h, b[ 2 ] + up[ 2 ] * h ];
		const d = [ a[ 0 ] + up[ 0 ] * h, a[ 1 ] + up[ 1 ] * h, a[ 2 ] + up[ 2 ] * h ];
		this.quad( a, b, c, d, n, [ atlasUV( print, 0, 1, lit ), atlasUV( print, 1, 1, lit ), atlasUV( print, 1, 0, lit ), atlasUV( print, 0, 0, lit ) ] );

	}

	// an upright cylinder (or a cone's frustum) in frame P: its axis at ( x, z ), from y0 to y1, radius r0
	// at the bottom, r1 at the top, n sides
	cyl( P, x, z, y0, y1, r0, r1, n = 12, { top = true, bottom = false } = {} ) {

		const ring = ( y, r, k ) => {

			const t = k / n * Math.PI * 2;
			return [ P( x + Math.cos( t ) * r, y, z + Math.sin( t ) * r ), P.dir( Math.cos( t ), ( r0 - r1 ) / ( y1 - y0 || 1 ), Math.sin( t ) ) ];

		};

		for ( let k = 0; k < n; k ++ ) {

			const [ a, na ] = ring( y0, r0, k ), [ b, nb ] = ring( y0, r0, k + 1 ), [ c, nc ] = ring( y1, r1, k + 1 ), [ d, nd ] = ring( y1, r1, k );
			this.tri( a, b, c, na, nb, nc );
			this.tri( a, c, d, na, nc, nd );
			if ( top ) this.tri( P( x, y1, z ), d, c, [ 0, 1, 0 ], [ 0, 1, 0 ], [ 0, 1, 0 ] );
			if ( bottom ) this.tri( P( x, y0, z ), b, a, [ 0, - 1, 0 ], [ 0, - 1, 0 ], [ 0, - 1, 0 ] );

		}

	}

	// a straight member between two field points (square section w), like geo.js's beam()
	bar( a, b, w ) {

		const d = [ b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ], b[ 2 ] - a[ 2 ] ];
		const l = Math.hypot( ...d ) || 1;
		d[ 0 ] /= l; d[ 1 ] /= l; d[ 2 ] /= l;
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
			this.quad( c( a, s1, s2 ), c( a, t1, t2 ), c( b, t1, t2 ), c( b, s1, s2 ), n );

		}

	}

	mesh( name = 'leftfield-things', { shadow = false } = {} ) {

		const g = new BufferGeometry();
		g.setAttribute( 'position', new Float32BufferAttribute( this.pos, 3 ) );
		g.setAttribute( 'normal', new Float32BufferAttribute( this.nrm, 3 ) );
		g.setAttribute( 'uv', new Float32BufferAttribute( this.uv, 2 ) );
		g.computeBoundingBox();
		g.computeBoundingSphere();
		const m = new Mesh( g, this.material );
		m.name = name;
		m.castShadow = shadow;
		m.receiveShadow = true;
		return m;

	}

}
