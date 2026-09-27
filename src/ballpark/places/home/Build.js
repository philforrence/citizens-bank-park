import { Mesh, BufferGeometry, Float32BufferAttribute, Color } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';

// The place's own things (the ledge and what's on it, the club's padded seats, the vendors' gear, the
// signs) are built with smooth normals into one geometry per draw, coloured from one palette: each
// vertex carries its palette entry (uv.x, with uv.y = 2) or, on a printed face, the atlas's uv (the
// entry for the print's ink in the atlas's red channel, see Signs.js).
//
//   const b = new Builder()
//   b.use( 'ledge' ).box( P, x, y, z, sx, sy, sz )      P a frame: P( x, y, z ) -> field point
//   b.use( 'beer' ).cyl( P, x, z, y0, y1, r0, r1, n )
//   const mesh = b.mesh( material )

// the palette: [ colour, roughness, metalness, emissive at night (a lit thing), wet (gets darker and
// glossy in the rain) ]
export const PAL = {
	ledge: [ [ 0.035, 0.04, 0.05 ], 0.55, 0.0, 0, 1 ],
	concrete: [ [ 0.3, 0.29, 0.27 ], 0.85, 0.0, 0, 1 ],
	beer: [ [ 0.55, 0.33, 0.04 ], 0.1, 0.0, 0, 0 ],
	foam: [ [ 0.75, 0.72, 0.62 ], 0.85, 0.0, 0, 0 ],
	cupRed: [ [ 0.42, 0.02, 0.03 ], 0.4, 0.0, 0, 0 ],
	cupWhite: [ [ 0.72, 0.7, 0.66 ], 0.5, 0.0, 0, 0 ],
	lid: [ [ 0.02, 0.02, 0.022 ], 0.4, 0.0, 0, 0 ],
	sleeve: [ [ 0.2, 0.11, 0.05 ], 0.9, 0.0, 0, 0 ],
	water: [ [ 0.45, 0.5, 0.55 ], 0.05, 0.0, 0, 0 ],
	capBlue: [ [ 0.03, 0.08, 0.35 ], 0.4, 0.0, 0, 0 ],
	tray: [ [ 0.7, 0.66, 0.58 ], 0.8, 0.0, 0, 0 ],
	cheese: [ [ 0.8, 0.52, 0.04 ], 0.5, 0.0, 0, 0 ],
	chips: [ [ 0.75, 0.6, 0.3 ], 0.8, 0.0, 0, 0 ],
	navy: [ [ 0.02, 0.04, 0.14 ], 0.3, 0.0, 0, 0 ],
	black: [ [ 0.015, 0.015, 0.017 ], 0.5, 0.0, 0, 0 ],
	glove: [ [ 0.3, 0.14, 0.05 ], 0.6, 0.0, 0, 0 ],
	kraft: [ [ 0.55, 0.45, 0.3 ], 0.9, 0.0, 0, 0 ],
	steel: [ [ 0.55, 0.56, 0.58 ], 0.3, 0.85, 0, 0 ],
	white: [ [ 0.72, 0.71, 0.68 ], 0.7, 0.0, 0, 0 ],
	red: [ [ 0.34, 0.018, 0.024 ], 0.6, 0.0, 0, 0 ],
	yellow: [ [ 0.62, 0.48, 0.03 ], 0.6, 0.0, 0, 0 ],
	foil: [ [ 0.7, 0.7, 0.72 ], 0.3, 0.9, 0, 0 ],
	bun: [ [ 0.62, 0.42, 0.2 ], 0.8, 0.0, 0, 0 ],
	pink: [ [ 0.75, 0.3, 0.45 ], 1.0, 0.0, 0.05, 0 ],
	blue: [ [ 0.25, 0.45, 0.75 ], 1.0, 0.0, 0.05, 0 ],
	lemon: [ [ 0.8, 0.72, 0.2 ], 0.3, 0.0, 0, 0 ],
	pad: [ [ 0.022, 0.05, 0.16 ], 0.45, 0.0, 0, 1 ],
	padSeam: [ [ 0.012, 0.028, 0.09 ], 0.5, 0.0, 0, 1 ],
	blanketRed: [ [ 0.3, 0.02, 0.03 ], 1.0, 0.0, 0, 0 ],
	blanketPlaid: [ [ 0.1, 0.12, 0.08 ], 1.0, 0.0, 0, 0 ],
	blanketGrey: [ [ 0.25, 0.25, 0.26 ], 1.0, 0.0, 0, 0 ],
	blanketNavy: [ [ 0.02, 0.03, 0.09 ], 1.0, 0.0, 0, 0 ],
	towelWet: [ [ 0.6, 0.59, 0.56 ], 1.0, 0.0, 0, 1 ],
	board: [ [ 0.78, 0.77, 0.74 ], 0.8, 0.0, 0, 0 ],
	cocoa: [ [ 0.16, 0.08, 0.04 ], 0.3, 0.0, 0, 0 ],
	strap: [ [ 0.02, 0.02, 0.025 ], 0.8, 0.0, 0, 0 ],
	cooler: [ [ 0.62, 0.61, 0.58 ], 0.45, 0.0, 0, 0 ],
	ice: [ [ 0.6, 0.65, 0.7 ], 0.1, 0.0, 0, 0 ],
	bottleBrown: [ [ 0.12, 0.05, 0.015 ], 0.15, 0.0, 0, 0 ],
	label: [ [ 0.7, 0.66, 0.55 ], 0.6, 0.0, 0, 0 ],
	lamp: [ [ 1.0, 0.92, 0.75 ], 0.5, 0.0, 3.0, 0 ],
	ball: [ [ 0.85, 0.84, 0.8 ], 0.5, 0.0, 0.25, 0 ],
};
export const PAL_KEYS = Object.keys( PAL );
const IDX = Object.fromEntries( PAL_KEYS.map( ( k, i ) => [ k, i ] ) );

const f3 = ( v ) => `vec3f( ${ v.map( ( x ) => x.toFixed( 4 ) ).join( ', ' ) } )`;

// The palette material. `atlas`: a texture whose printed faces are read (r: ink mask, g: second ink,
// b: the board's own tone); the inks' colours are the palette entries given in the face's uv (see
// Builder.print). `extra`: more WGSL after the colour (e.g. the wet), `vertex` for instanced moves.
export function paletteMaterial( name, { atlas = null, vertex = '', storage = {}, varyings = {}, side = 'double', extraSurface = '' } = {} ) {

	const cols = PAL_KEYS.map( ( k ) => f3( PAL[ k ][ 0 ] ) ).join( ', ' );
	const prm = PAL_KEYS.map( ( k ) => `vec4f( ${ PAL[ k ][ 1 ].toFixed( 3 ) }, ${ PAL[ k ][ 2 ].toFixed( 3 ) }, ${ PAL[ k ][ 3 ].toFixed( 3 ) }, ${ PAL[ k ][ 4 ].toFixed( 1 ) } )` ).join( ', ' );
	const mat = standard( {
		name, roughness: 0.6, side, storage, varyings: { vUV: 'vec2f', ...varyings },
		uniforms: { night: [ 'f32', 27 ] },
		textures: atlas ? { hmAtlas: atlas } : {},
		// what's there on one night only (uv.y 3: the 27th, 4: the 29th) folds away on the other
		vertex: `o.vUV = v.uv;
	if ( v.uv.y > 2.5 && abs( v.uv.y - select( 3.0, 4.0, mat.night > 28.0 ) ) > 0.5 ) { v.position = vec3f( 0.0 ); }
${ vertex }`,
		surface: /* wgsl */`
	var COLS = array<vec3f, ${ PAL_KEYS.length }>( ${ cols } );
	var PRM = array<vec4f, ${ PAL_KEYS.length }>( ${ prm } );
	let uv = in.vs.vUV;
	var c = vec3f( 0.5 );
	var q = vec4f( 0.7, 0.0, 0.0, 0.0 );
	if ( uv.y >= 1.5 ) {
		let i = u32( clamp( uv.x, 0.0, ${ PAL_KEYS.length - 1 }.0 ) );
		c = COLS[ i ];
		q = PRM[ i ];
	} else {
${ atlas ? `		// a printed face: the board's white, the inks from the atlas
		let a = textureSample( hmAtlas, smpAnisoClamp, fract( uv ) );
		c = a.rgb;
		q = vec4f( 0.8, 0.0, 0.0, 0.0 );` : '' }
	}
	s.albedo = c;
	s.roughness = q.x;
	s.metalness = q.y;
	let nk = smoothstep( 0.15, 0.7, frame.night );
	s.emissive = c * q.z * mix( 0.2, 1.0, nk ) + c * nk * 0.1;
	// in the rain: the open surfaces darker and glossy
	let wk = frame.wet * q.w * smoothstep( 0.3, 0.9, normalize( in.N ).y );
	s.albedo *= mix( 1.0, 0.72, wk );
	s.roughness = mix( s.roughness, 0.12, wk );
${ extraSurface }
`,
	} );
	mat.underwaterLighting = 'none';
	mat.setDefine( 'DRY', 1 );
	return mat;

}

export class Builder {

	constructor() {

		this.pos = []; this.nrm = []; this.uv = [];
		this.k = 0;
		this.code = 2;

	}

	// what's built next is there on one night only (27, 29), or both (0)
	night( n ) {

		this.code = n === 27 ? 3 : n === 29 ? 4 : 2;
		return this;

	}

	use( name ) {

		this.k = IDX[ name ] ?? 0;
		return this;

	}

	// a frame: origin o ([ x, y, z ] field), right a and forward n (unit [ x, z ]); P( x, y, z )
	static frame( o, a, n ) {

		const P = ( x, y, z ) => [ o[ 0 ] + a[ 0 ] * x + n[ 0 ] * z, o[ 1 ] + y, o[ 2 ] + a[ 1 ] * x + n[ 1 ] * z ];
		P.dir = ( x, y, z ) => [ a[ 0 ] * x + n[ 0 ] * z, y, a[ 1 ] * x + n[ 1 ] * z ];
		return P;

	}

	tri( a, b, c, na, nb, nc, ua, ub, uc ) {

		const e1 = [ b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ], b[ 2 ] - a[ 2 ] ], e2 = [ c[ 0 ] - a[ 0 ], c[ 1 ] - a[ 1 ], c[ 2 ] - a[ 2 ] ];
		const cx = e1[ 1 ] * e2[ 2 ] - e1[ 2 ] * e2[ 1 ], cy = e1[ 2 ] * e2[ 0 ] - e1[ 0 ] * e2[ 2 ], cz = e1[ 0 ] * e2[ 1 ] - e1[ 1 ] * e2[ 0 ];
		const n = [ na[ 0 ] + nb[ 0 ] + nc[ 0 ], na[ 1 ] + nb[ 1 ] + nc[ 1 ], na[ 2 ] + nb[ 2 ] + nc[ 2 ] ];
		if ( cx * n[ 0 ] + cy * n[ 1 ] + cz * n[ 2 ] < 0 ) {

			[ b, c ] = [ c, b ]; [ nb, nc ] = [ nc, nb ]; [ ub, uc ] = [ uc, ub ];

		}

		const pal = [ this.k + 0.5, this.code ];
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

	// a box in frame P: centre ( x, y, z ), sizes along right, up, forward; `print`: [ u0, v0, u1, v1 ] of
	// the atlas on its forward face (and its back with `both`)
	box( P, x, y, z, sx, sy, sz, print = null, both = false ) {

		const c = ( i, j, k ) => P( x + i * sx / 2, y + j * sy / 2, z + k * sz / 2 );
		const F = P.dir( 0, 0, 1 ), R = P.dir( 1, 0, 0 );
		const pu = print && [ [ print[ 0 ], print[ 3 ] ], [ print[ 2 ], print[ 3 ] ], [ print[ 2 ], print[ 1 ] ], [ print[ 0 ], print[ 1 ] ] ];
		this.quad( c( - 1, - 1, 1 ), c( 1, - 1, 1 ), c( 1, 1, 1 ), c( - 1, 1, 1 ), F, pu );
		this.quad( c( 1, - 1, - 1 ), c( - 1, - 1, - 1 ), c( - 1, 1, - 1 ), c( 1, 1, - 1 ), F.map( ( v ) => - v ), both ? pu : null );
		this.quad( c( 1, - 1, 1 ), c( 1, - 1, - 1 ), c( 1, 1, - 1 ), c( 1, 1, 1 ), R );
		this.quad( c( - 1, - 1, - 1 ), c( - 1, - 1, 1 ), c( - 1, 1, 1 ), c( - 1, 1, - 1 ), R.map( ( v ) => - v ) );
		this.quad( c( - 1, 1, 1 ), c( 1, 1, 1 ), c( 1, 1, - 1 ), c( - 1, 1, - 1 ), [ 0, 1, 0 ] );
		this.quad( c( - 1, - 1, - 1 ), c( 1, - 1, - 1 ), c( 1, - 1, 1 ), c( - 1, - 1, 1 ), [ 0, - 1, 0 ] );

	}

	// an upright cylinder (a frustum) in frame P: axis at ( x, z ), y0 to y1, radii r0 (bottom) r1 (top)
	cyl( P, x, z, y0, y1, r0, r1, n = 10, top = true ) {

		const ring = ( y, r ) => {

			const R = [];
			for ( let i = 0; i <= n; i ++ ) {

				const a = i / n * Math.PI * 2;
				R.push( { p: P( x + Math.cos( a ) * r, y, z + Math.sin( a ) * r ), nr: P.dir( Math.cos( a ), ( r0 - r1 ) / ( y1 - y0 || 1 ), Math.sin( a ) ) } );

			}

			return R;

		};

		const A = ring( y0, r0 ), B = ring( y1, r1 );
		for ( let i = 0; i < n; i ++ ) this.tri( A[ i ].p, A[ i + 1 ].p, B[ i + 1 ].p, A[ i ].nr, A[ i + 1 ].nr, B[ i + 1 ].nr ), this.tri( A[ i ].p, B[ i + 1 ].p, B[ i ].p, A[ i ].nr, B[ i + 1 ].nr, B[ i ].nr );
		if ( top ) {

			const c = P( x, y1, z );
			for ( let i = 0; i < n; i ++ ) this.tri( c, B[ i ].p, B[ i + 1 ].p, [ 0, 1, 0 ], [ 0, 1, 0 ], [ 0, 1, 0 ] );

		}

	}

	// an ellipsoid in frame P, centre ( x, y, z ), radii
	blob( P, x, y, z, rx, ry, rz, w = 8, h = 5 ) {

		const V = [];
		for ( let j = 0; j <= h; j ++ ) {

			const row = [];
			for ( let i = 0; i <= w; i ++ ) {

				const th = j / h * Math.PI, ph = i / w * Math.PI * 2;
				const d = [ Math.sin( th ) * Math.cos( ph ), Math.cos( th ), Math.sin( th ) * Math.sin( ph ) ];
				row.push( { p: P( x + d[ 0 ] * rx, y + d[ 1 ] * ry, z + d[ 2 ] * rz ), nr: P.dir( d[ 0 ] / rx, d[ 1 ] / ry, d[ 2 ] / rz ) } );

			}

			V.push( row );

		}

		for ( let j = 0; j < h; j ++ ) for ( let i = 0; i < w; i ++ ) {

			const a = V[ j ][ i ], b = V[ j ][ i + 1 ], c = V[ j + 1 ][ i + 1 ], d = V[ j + 1 ][ i ];
			this.tri( a.p, b.p, c.p, a.nr, b.nr, c.nr );
			this.tri( a.p, c.p, d.p, a.nr, c.nr, d.nr );

		}

	}

	geometry() {

		const g = new BufferGeometry();
		g.setAttribute( 'position', new Float32BufferAttribute( this.pos, 3 ) );
		g.setAttribute( 'normal', new Float32BufferAttribute( this.nrm, 3 ) );
		g.setAttribute( 'uv', new Float32BufferAttribute( this.uv, 2 ) );
		g.computeBoundingBox();
		g.computeBoundingSphere();
		return g;

	}

	mesh( material, name ) {

		const m = new Mesh( this.geometry(), material );
		m.name = name;
		m.castShadow = false;
		m.receiveShadow = true;
		return m;

	}

	get count() {

		return this.pos.length / 9;

	}

}

export { Color };
