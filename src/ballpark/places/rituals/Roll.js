import { Mesh, BufferGeometry, Float32BufferAttribute, Color } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { commonModule } from '../../../engine/render/wgsl/common.js';
import { rollAxis, rollDistance, tubeAxis, R_FULL, R_CORE } from '../../game/TarpPlan.js';

// The infield tarp's roll while it's off the wall (the rituals' tarp plan, game/TarpPlan.js): the long
// roll of silver-grey vinyl on its black corrugated core, swung out from the wall, pushed across the
// infield by the crew as the sheet pays out behind it (Details2008's sheet), thinning to the bare core
// (Getty 83458220: the skin wrinkled and wet, the black ribbed pipe showing at the ends with a pale
// stripe down it; 83458149: the empty core lying on the grass). Its rings are laid along the plan's axis
// every frame it moves, and it turns as it rolls. While it's out, the canvas cover it was stowed under
// lies pulled off in a slumped heap along the wall.

const NR = 40, NS = 18;

export class Roll {

	constructor( group ) {

		this.axis = [];
		const n = ( NR + 1 ) * ( NS + 1 ) + 2 * ( NS + 2 );
		this.pos = new Float32Array( n * 3 );
		this.nrm = new Float32Array( n * 3 );
		const uv = new Float32Array( n * 2 ), index = [];
		// the side: ring i, side k (k = NS repeats k = 0 for the seam of the uv)
		for ( let i = 0; i <= NR; i ++ ) for ( let k = 0; k <= NS; k ++ ) {

			const v = i * ( NS + 1 ) + k;
			uv[ v * 2 ] = i / NR; // along it (0..1: the plan's v); the shader scales to metres
			uv[ v * 2 + 1 ] = k / NS;

		}

		for ( let i = 0; i < NR; i ++ ) for ( let k = 0; k < NS; k ++ ) {

			const a = i * ( NS + 1 ) + k, b = a + 1, c = a + NS + 1, d = c + 1;
			index.push( a, c, b, b, c, d );

		}

		// the two ends: a centre and a rim (uv.x -1 marks an end, uv.y its radius in metres)
		this.cap0 = ( NR + 1 ) * ( NS + 1 );
		for ( let e = 0; e < 2; e ++ ) {

			const c0 = this.cap0 + e * ( NS + 2 );
			uv[ c0 * 2 ] = - 1; uv[ c0 * 2 + 1 ] = 0;
			for ( let k = 0; k <= NS; k ++ ) {

				uv[ ( c0 + 1 + k ) * 2 ] = - 1;
				uv[ ( c0 + 1 + k ) * 2 + 1 ] = 1;

			}

			for ( let k = 0; k < NS; k ++ ) {

				if ( e === 0 ) index.push( c0, c0 + 1 + k, c0 + 2 + k );
				else index.push( c0, c0 + 2 + k, c0 + 1 + k );

			}

		}

		const g = new BufferGeometry();
		g.setAttribute( 'position', new Float32BufferAttribute( this.pos, 3 ) );
		g.setAttribute( 'normal', new Float32BufferAttribute( this.nrm, 3 ) );
		g.setAttribute( 'uv', new Float32BufferAttribute( uv, 2 ) );
		g.setIndex( index );
		// (the attributes copy the arrays they're given: write into theirs)
		this.pos = g.getAttribute( 'position' ).array;
		this.nrm = g.getAttribute( 'normal' ).array;
		this.geo = g;
		this.mat = standard( { name: 'tarp-roll-out', color: new Color( 0.36, 0.37, 0.38 ), roughness: 0.3, modules: [ commonModule ],
			uniforms: { turn: [ 'f32', 0 ], bare: [ 'f32', 0 ], rOut: [ 'f32', R_FULL ], len: [ 'f32', 44 ] },
			surface: /* wgsl */`
	let wetK = frame.wet;
	var c = vec3f( 0.0 );
	var rough = 0.3;
	if ( in.uv.x < -0.5 ) {

		// an end: the hollow of the core, its black ribbed wall, then the tarp's layers wound round it
		let rr = in.uv.y * mat.rOut;
		if ( rr < ${ ( R_CORE - 0.035 ).toFixed( 3 ) } ) { c = vec3f( 0.004 ); rough = 0.9; }
		else if ( rr < ${ ( R_CORE + 0.004 ).toFixed( 3 ) } ) { c = vec3f( 0.018 ); rough = 0.5; }
		else {
			c = mat.color * ( 0.55 + 0.25 * sin( rr * 700.0 ) * sin( rr * 700.0 ) );
			rough = 0.45;
		}

	} else {

		let sa = in.uv.x * mat.len;
		let a = fract( in.uv.y + mat.turn );
		// the vinyl skin: wrinkled, the sheet's seams where they come round, grimy where it touched the clay
		var skin = mat.color * ( 0.86 + 0.18 * mx_noise_float2( vec2f( sa * 0.9, a * 14.0 ) ) );
		let seam = max( 1.0 - smoothstep( 0.004, 0.009, abs( a - 0.23 ) ), 1.0 - smoothstep( 0.004, 0.009, abs( a - 0.71 ) ) );
		skin = skin * ( 1.0 - 0.3 * seam );
		skin = mix( skin, vec3f( 0.16, 0.08, 0.04 ), 0.25 * smoothstep( 0.55, 0.9, mx_noise_float2( vec2f( sa * 0.4, a * 5.0 ) ) ) );
		// the bare core: black ribbed plastic, a pale stripe down its length
		var core = vec3f( 0.016 ) * ( 0.7 + 0.6 * smoothstep( 0.3, 0.7, sin( sa * 104.7 ) * 0.5 + 0.5 ) );
		core = mix( core, vec3f( 0.32, 0.36, 0.2 ), 1.0 - smoothstep( 0.006, 0.012, abs( a - 0.5 ) ) );
		c = mix( skin, core, mat.bare );
		rough = mix( mix( 0.4, 0.1, wetK ), mix( 0.55, 0.2, wetK ), mat.bare );

	}

	s.albedo = c;
	s.roughness = rough;
	s.emissive = c * smoothstep( 0.2, 0.8, frame.night ) * 0.25;
` } );
		this.mat.underwaterLighting = 'none';
		this.mat.setDefine( 'DRY', 1 );
		const mesh = new Mesh( g, this.mat );
		mesh.name = 'tarp-roll-out';
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		mesh.frustumCulled = false;
		mesh.visible = false;
		mesh.userData.dynamic = true;
		group.add( mesh );
		this.mesh = mesh;
		this.cover = coverHeap( group );
		this._key = '';

	}

	// st: the tarp's state (TarpPlan.tarpState)
	update( st ) {

		const out = ! st.stowed;
		this.mesh.visible = out;
		this.cover.visible = out;
		if ( ! out ) return;
		const key = [ st.phase, st.lift.toFixed( 4 ), st.u.toFixed( 4 ), st.r.toFixed( 4 ) ].join( '|' );
		if ( key === this._key ) return;
		this._key = key;
		const A = rollAxis( st, NR, this.axis );
		const P = this.pos, Nn = this.nrm, r = st.r;
		let len = 0;
		for ( let i = 1; i <= NR; i ++ ) len += Math.hypot( A[ i ][ 0 ] - A[ i - 1 ][ 0 ], A[ i ][ 2 ] - A[ i - 1 ][ 2 ] );
		const frames = [];
		for ( let i = 0; i <= NR; i ++ ) {

			const a = A[ Math.max( 0, i - 1 ) ], b = A[ Math.min( NR, i + 1 ) ];
			let tx = b[ 0 ] - a[ 0 ], ty = b[ 1 ] - a[ 1 ], tz = b[ 2 ] - a[ 2 ];
			const tl = Math.hypot( tx, ty, tz ) || 1;
			tx /= tl; ty /= tl; tz /= tl;
			// e1: up, made square to the axis; e2 = t x e1
			let ex = - tx * ty, ey = 1 - ty * ty, ez = - tz * ty;
			const el = Math.hypot( ex, ey, ez ) || 1;
			ex /= el; ey /= el; ez /= el;
			const fx = ty * ez - tz * ey, fy = tz * ex - tx * ez, fz = tx * ey - ty * ex;
			frames.push( [ tx, ty, tz ] );
			// sagging a touch where it's wound slack, and bulging where the men lean on it
			for ( let k = 0; k <= NS; k ++ ) {

				const th = k / NS * Math.PI * 2;
				const cs = Math.cos( th ), sn = Math.sin( th );
				const rr = r * ( 1 + 0.02 * Math.sin( i * 1.7 + k * 0.9 ) * ( 1 - st.bare ) ) - ( sn > 0 ? 0 : 0.03 * r * sn * sn );
				const nx = ex * sn + fx * cs, ny = ey * sn + fy * cs, nz = ez * sn + fz * cs;
				const v = i * ( NS + 1 ) + k;
				P[ v * 3 ] = A[ i ][ 0 ] + nx * rr;
				P[ v * 3 + 1 ] = Math.max( 0.01, A[ i ][ 1 ] + ny * rr );
				P[ v * 3 + 2 ] = A[ i ][ 2 ] + nz * rr;
				Nn[ v * 3 ] = nx; Nn[ v * 3 + 1 ] = ny; Nn[ v * 3 + 2 ] = nz;

			}

		}

		// the ends: the rim copied from the end rings, the centre on the axis, facing out along it
		for ( let e = 0; e < 2; e ++ ) {

			const ring = e === 0 ? 0 : NR, c0 = this.cap0 + e * ( NS + 2 );
			const [ tx, ty, tz ] = frames[ ring ], s = e === 0 ? - 1 : 1;
			P[ c0 * 3 ] = A[ ring ][ 0 ]; P[ c0 * 3 + 1 ] = A[ ring ][ 1 ]; P[ c0 * 3 + 2 ] = A[ ring ][ 2 ];
			Nn[ c0 * 3 ] = tx * s; Nn[ c0 * 3 + 1 ] = ty * s; Nn[ c0 * 3 + 2 ] = tz * s;
			for ( let k = 0; k <= NS; k ++ ) {

				const src = ring * ( NS + 1 ) + k, v = c0 + 1 + k;
				P[ v * 3 ] = P[ src * 3 ]; P[ v * 3 + 1 ] = P[ src * 3 + 1 ]; P[ v * 3 + 2 ] = P[ src * 3 + 2 ];
				Nn[ v * 3 ] = tx * s; Nn[ v * 3 + 1 ] = ty * s; Nn[ v * 3 + 2 ] = tz * s;

			}

		}

		this.geo.getAttribute( 'position' ).needsUpdate = true;
		this.geo.getAttribute( 'normal' ).needsUpdate = true;
		this.geo.computeBoundingSphere();
		const U = this.mat.uniforms;
		U.turn.value = - rollDistance( st ) / ( Math.PI * 2 * r );
		U.bare.value = st.bare ?? ( r <= R_CORE + 0.002 ? 1 : 0 );
		U.rOut.value = r;
		U.len.value = len;

	}

}

// the tube's canvas cover, pulled off and left in a slumped heap along the wall where the roll lay
function coverHeap( group ) {

	const T = tubeAxis();
	const pos = [], nrm = [], uv = [], index = [];
	const S = 6;
	for ( let i = 0; i < T.length; i += 2 ) {

		const { p, s } = T[ i ];
		const q = T[ Math.min( T.length - 1, i + 2 ) ].p, o = T[ Math.max( 0, i - 2 ) ].p;
		const tx = q[ 0 ] - o[ 0 ], tz = q[ 1 ] - o[ 1 ], tl = Math.hypot( tx, tz ) || 1;
		let nx = - tz / tl, nz = tx / tl;
		if ( nx * ( 0 - p[ 0 ] ) + nz * ( - 38.9 - p[ 1 ] ) < 0 ) { nx = - nx; nz = - nz; }
		for ( let k = 0; k <= S; k ++ ) {

			const w = ( k / S - 0.5 ) * 1.3;
			// heaped along its middle, bunched in lumps
			const lump = 0.5 + 0.5 * Math.sin( s * 1.9 ) * Math.sin( s * 0.7 + 1 );
			const h = 0.03 + ( 0.12 + 0.12 * lump ) * Math.max( 0, 1 - ( w / 0.65 ) ** 2 );
			pos.push( p[ 0 ] + nx * ( w - 0.25 ), h, p[ 1 ] + nz * ( w - 0.25 ) );
			nrm.push( nx * - w * 0.6, 1, nz * - w * 0.6 );
			uv.push( s, k / S );

		}

	}

	const rows = pos.length / 3 / ( S + 1 );
	for ( let i = 0; i < rows - 1; i ++ ) for ( let k = 0; k < S; k ++ ) {

		const a = i * ( S + 1 ) + k, b = a + 1, c = a + S + 1, d = c + 1;
		index.push( a, b, c, b, d, c );

	}

	const g = new BufferGeometry();
	g.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
	g.setAttribute( 'normal', new Float32BufferAttribute( nrm, 3 ) );
	g.setAttribute( 'uv', new Float32BufferAttribute( uv, 2 ) );
	g.setIndex( index );
	g.computeVertexNormals();
	const nr = g.getAttribute( 'normal' );
	if ( nr.array[ 1 ] < 0 ) for ( let i = 0; i < nr.array.length; i ++ ) nr.array[ i ] = - nr.array[ i ];
	const m = standard( { name: 'tarp-cover-heap', color: new Color( 0.14, 0.18, 0.15 ), roughness: 0.75, side: 'double', modules: [ commonModule ],
		surface: /* wgsl */`
	var c = mat.color * ( 0.8 + 0.25 * mx_noise_float2( in.uv * vec2f( 1.3, 5.0 ) ) );
	c = mix( c, vec3f( 0.012 ), 1.0 - smoothstep( 0.03, 0.05, abs( fract( in.uv.x / 3.0 ) - 0.5 ) ) );
	s.albedo = c;
	s.roughness = mix( 0.75, 0.3, frame.wet );
	s.emissive = c * smoothstep( 0.2, 0.8, frame.night ) * 0.3;
` } );
	m.underwaterLighting = 'none';
	const mesh = new Mesh( g, m );
	mesh.name = 'tarp-cover-heap';
	mesh.receiveShadow = true;
	mesh.visible = false;
	mesh.userData.dynamic = true;
	group.add( mesh );
	return mesh;

}
