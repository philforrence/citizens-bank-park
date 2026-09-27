import { Mesh, BufferGeometry, Float32BufferAttribute, Color, Vector2, Vector4 } from '../../engine/index.js';
import { standard } from '../../materials/Materials.js';
import { StorageBuffer } from '../../engine/gpu/Texture.js';

// Rain round the camera: streaks falling through a box that moves with you (each drop wraps inside it),
// leaning with the wind, faint in the distance. `amount` 0..1 thins them out.
const N = 14000;
const BOX = [ 44, 26, 44 ]; // m
// ---- W2 (concourse): the cover map's size (cells): the height of the top of whatever's overhead, per
// cell, in the field frame (setCover)
const COVER = 400 * 400;
// ---- end W2

export class Rain {

	constructor( scene ) {

		const pos = [], seed = [], corner = [], index = [];
		for ( let i = 0; i < N; i ++ ) {

			const s = [ Math.random(), Math.random(), Math.random(), Math.random() ];
			for ( const [ cx, cy ] of [ [ - 1, 0 ], [ 1, 0 ], [ 1, 1 ], [ - 1, 1 ] ] ) {

				pos.push( 0, 0, 0 );
				seed.push( ...s );
				corner.push( cx, cy );

			}

			const b = i * 4;
			index.push( b, b + 1, b + 2, b, b + 2, b + 3 );

		}

		const g = new BufferGeometry();
		g.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
		g.setAttribute( 'aSeed', new Float32BufferAttribute( seed, 4 ) );
		g.setAttribute( 'aCorner', new Float32BufferAttribute( corner, 2 ) );
		g.setIndex( index );
		g.boundingSphere = null;
		// ---- W2 (concourse): where it can't rain (under the decks, inside the stands): see setCover
		this.coverBuf = new StorageBuffer( { label: 'rainCover', count: COVER / 4, type: 'vec4f' } );
		// ---- end W2
		this.material = standard( {
			name: 'rain', color: new Color( 0.8, 0.82, 0.86 ), transparent: true, depthWrite: false, side: 'double', lit: false,
			uniforms: {
				amount: [ 'f32', 0 ], wind: [ 'vec2f', new Vector2( 1.5, 0.5 ) ],
				// the light banks (world, w = 1 if used): drops between you and a bank light up
				l0: [ 'vec4f', new Vector4() ], l1: [ 'vec4f', new Vector4() ], l2: [ 'vec4f', new Vector4() ], l3: [ 'vec4f', new Vector4() ],
				l4: [ 'vec4f', new Vector4() ], l5: [ 'vec4f', new Vector4() ], l6: [ 'vec4f', new Vector4() ], l7: [ 'vec4f', new Vector4() ],
				// ---- W2 (concourse): the cover map: world to field (cos, sin, the field's y, on), its grid (x0, z0, cell, nx)
				coverXf: [ 'vec4f', new Vector4() ], coverGrid: [ 'vec4f', new Vector4( 0, 0, 1, 1 ) ],
				// ---- end W2
			},
			storage: { rainCover: this.coverBuf }, // ---- W2 (concourse): the cover map
			attributes: { aSeed: 'vec4f', aCorner: 'vec2f' },
			varyings: { vA: 'f32', vY: 'f32', vLit: 'f32' },
			vertex: /* wgsl */`
	let box = vec3f( ${ BOX[ 0 ] }.0, ${ BOX[ 1 ] }.0, ${ BOX[ 2 ] }.0 );
	let cam = frame.cameraPos;
	// the lens: a long lens looks further out, so the drops go where it's focused (and the near ones,
	// which it would blow up into huge streaks, fade)
	let fwd = - vec3f( frame.view[ 0 ][ 2 ], frame.view[ 1 ][ 2 ], frame.view[ 2 ][ 2 ] );
	let tanHalf = 1.0 / frame.proj[ 1 ][ 1 ];
	let focus = clamp( 0.9 / tanHalf - 1.5, 0.0, 40.0 );
	let centre = cam + fwd * focus;
	let speed = 8.5 + v.aSeed.w * 2.0;
	let fall = vec3f( mat.wind.x, - speed, mat.wind.y );
	var p = v.aSeed.xyz * box + fall * frame.time;
	p = centre + ( fract( ( p - centre ) / box + 0.5 ) - 0.5 ) * box;
	let dir = normalize( fall );
	let toCam = normalize( cam - p );
	let side = normalize( cross( dir, toCam ) );
	// a shutter-length streak (about 1/60 s of fall), thinner far off
	// ---- L: a TV camera's long lens shoots at 1/100 s or faster: shorter streaks, the fine rain of the
	// center field frames on the 27th (ref/night getty_83885893), not long white lines across the picture
	let len = mix( 0.09, 0.26, smoothstep( 0.08, 0.3, tanHalf ) );
	let wp = p + side * v.aCorner.x * 0.005 + dir * v.aCorner.y * len;
	v.useWorld = true;
	v.worldPos = wp;
	v.worldNormal = toCam;
	v.prevWorldPos = wp - fall * frame.dt;
	let d = length( p - cam );
	o.vA = step( v.aSeed.w, mat.amount ) * smoothstep( 0.4 + 0.45 * focus, 2.0 + 0.55 * focus, d ) * ( 1.0 - smoothstep( focus + 14.0, focus + 22.0, d ) );
	// ---- W2 (concourse): no rain under a roof: below the top of what's overhead at its spot
	if ( mat.coverXf.w > 0.5 ) {
		let fx = p.x * mat.coverXf.x - p.z * mat.coverXf.y;
		let fz = p.x * mat.coverXf.y + p.z * mat.coverXf.x;
		let gx = floor( ( fx - mat.coverGrid.x ) / mat.coverGrid.z );
		let gz = floor( ( fz - mat.coverGrid.y ) / mat.coverGrid.z );
		let n = mat.coverGrid.w;
		if ( gx >= 0.0 && gz >= 0.0 && gx < n && gz < f32( ${ COVER } ) / n ) {
			let i = u32( gx + gz * n );
			let top = rainCover[ i / 4u ][ i % 4u ];
			if ( p.y - mat.coverXf.z < top ) { o.vA = 0.0; }
		}
	}
	// ---- end W2
	o.vY = v.aCorner.y;
	// forward scattering: a drop in front of a bank (seen against it) glows
	let ray = normalize( p - cam );
	var lit = 0.0;
	for ( var i = 0; i < 8; i ++ ) {
		var L = mat.l0;
		switch i { case 1: { L = mat.l1; } case 2: { L = mat.l2; } case 3: { L = mat.l3; } case 4: { L = mat.l4; } case 5: { L = mat.l5; } case 6: { L = mat.l6; } case 7: { L = mat.l7; } default: {} }
		if ( L.w > 0.5 ) { lit += pow( max( 0.0, dot( normalize( L.xyz - p ), ray ) ), 10.0 ); }
	}
	o.vLit = lit;
`,
			surface: /* wgsl */`
	// brighter under the lights at night, and glowing where they're backlit by a bank
	let lightK = mix( 0.9, 1.4, frame.night ) + in.vs.vLit * 3.0 * frame.night;
	s.albedo = mat.color * lightK * ( frame.skyIrradiance * 1.5 + vec3f( 0.25 ) * frame.night );
	s.alpha = in.vs.vA * 0.3 * ( 1.0 - in.vs.vY * 0.5 ) * min( 1.0, 0.6 + in.vs.vLit );
`,
		} );
		this.material.underwaterLighting = 'none';
		this.mesh = new Mesh( g, this.material );
		this.mesh.name = 'rain';
		this.mesh.frustumCulled = false;
		this.mesh.layers.set( 2 ); // the transparent pass
		this.mesh.visible = false;
		scene.add( this.mesh );

	}

	// ---- W2 (concourse): the cover map: heights (field frame, above the field) of the top of whatever is
	// overhead, nx by COVER / nx cells of `cell` metres from ( x0, z0 ); the field frame's turn (cos, sin of
	// the field group's yaw) and height (its y in the world). places/Concourse3B.js builds it.
	setCover( heights, { x0, z0, cell, nx, cos, sin, y0 } ) {

		const d = new Float32Array( COVER ).fill( - 1e4 );
		d.set( heights.subarray( 0, COVER ) );
		this.coverBuf.write( d );
		this.material.uniforms.coverXf.value.set( cos, sin, y0, 1 );
		this.material.uniforms.coverGrid.value.set( x0, z0, cell, nx );

	}

	static get coverCells() {

		return COVER;

	}
	// ---- end W2

	// the light banks' world positions (up to 8)
	setLights( list ) {

		list.slice( 0, 8 ).forEach( ( p, i ) => this.material.uniforms[ 'l' + i ].value.set( p.x, p.y, p.z, 1 ) );

	}

	set amount( a ) {

		this.material.uniforms.amount.value = a;
		this.mesh.visible = a > 0.01;

	}

	get amount() {

		return this.material.uniforms.amount.value;

	}

}
