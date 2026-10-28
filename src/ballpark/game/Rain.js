import { Mesh, BufferGeometry, Float32BufferAttribute, Color, Vector2, Vector4 } from '../../engine/index.js';
import { standard } from '../../materials/Materials.js';
import { StorageBuffer } from '../../engine/gpu/Texture.js';
import { localLightsModule } from '../../materials/LocalLights.js'; // ---- FW2 (C2W-5)

// Rain round the camera: streaks falling through a box that moves with you (each drop wraps inside it),
// leaning with the wind, faint in the distance. `amount` 0..1 thins them out.
// CB-2 (gauntlet r1): in the photos of the 27th the rain is a dense fine speckle of short dashes over
// everything (Getty 83885893, 84081811), not long white lines across the picture. The lines were the
// drops a metre or two from the lens (a 0.26 m streak there crosses a quarter of the frame) and the
// temporal resolve smearing the rest. So: no drops nearer than ~1.5 m, every dash at most a few pixels
// long on screen and never thinner than one, the box pushed out ahead of the lens (half of it used to
// be behind you) with more drops in it, and each drop owns its pixel's motion (VELOCITY_OPAQUE, as
// AirMotes does) so the resolve follows it instead of smearing it.
// C2W-5 (gauntlet r2, FW2): outside on the 27th it read as snow near you and as white dashes over the
// black sky and the brick, because every drop was lit the same wherever it was (a floor of a quarter of
// the night's light). In the photos (roadieshow 3023773899, the Third Base Gate from the street that
// night; Getty 83458502 from the concourse) the rain shows only where light crosses it: round the
// street lamps and the gate's lights, round the banks, and in the beams over the field. So each drop
// is lit by the lamps actually near it (LocalLights' chosen dozen: the banks, the plaza's posts, the
// gate's lights, the domes), mostly forward (a drop seen against a lamp blazes, side on it's faint),
// and a drop nothing lights is all but invisible.
const N = 20000;
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
				// ---- FW2 (C2W-5): the lamps' light on a drop (x), how much light makes a drop show (y), the
				// city's glow off the low cloud (z), the banks' fixtures' light leaking all round (w)
				lightK: [ 'vec4f', new Vector4( 2.5, 0.12, 0.02, 60 ) ],
				// ---- W2 (concourse): the cover map: world to field (cos, sin, the field's y, on), its grid (x0, z0, cell, nx)
				coverXf: [ 'vec4f', new Vector4() ], coverGrid: [ 'vec4f', new Vector4( 0, 0, 1, 1 ) ],
				// ---- end W2
			},
			storage: { rainCover: this.coverBuf }, // ---- W2 (concourse): the cover map
			modules: [ localLightsModule ], // ---- FW2 (C2W-5): the lamps near each drop
			attributes: { aSeed: 'vec4f', aCorner: 'vec2f' },
			defines: { VELOCITY_OPAQUE: 1 }, // CB-2
			varyings: { vA: 'f32', vY: 'f32', vLit: 'f32', vK: 'f32' },
			vertex: /* wgsl */`
	let box = vec3f( ${ BOX[ 0 ] }.0, ${ BOX[ 1 ] }.0, ${ BOX[ 2 ] }.0 );
	let cam = frame.cameraPos;
	// the lens: a long lens looks further out, so the drops go where it's focused (and the near ones,
	// which it would blow up into huge streaks, fade)
	let fwd = - vec3f( frame.view[ 0 ][ 2 ], frame.view[ 1 ][ 2 ], frame.view[ 2 ][ 2 ] );
	let tanHalf = 1.0 / frame.proj[ 1 ][ 1 ];
	let focus = clamp( 0.9 / tanHalf - 1.5, 0.0, 40.0 );
	let centre = cam + fwd * ( focus + 9.0 );
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
	// (CB-2: half that, and at most ~5 pixels on screen; a pixel wide at least, its light spread over it)
	let d = length( p - cam );
	let pxM = 2.0 * d * tanHalf / max( frame.resolution.y, 1.0 );
	let wide = smoothstep( 0.08, 0.3, tanHalf );
	// (C2W-5: up close a dash of 5 px or less read as a flake; 8 px on the wide lens, still a pixel wide)
	let len = min( mix( 0.05, 0.13, wide ), mix( 7.0, 8.0, wide ) * pxM );
	let halfW = max( 0.0025, 0.5 * pxM );
	let wp = p + side * v.aCorner.x * halfW + dir * v.aCorner.y * len;
	v.useWorld = true;
	v.worldPos = wp;
	v.worldNormal = toCam;
	v.prevWorldPos = wp - fall * frame.dt;
	o.vA = step( v.aSeed.w, mat.amount ) * smoothstep( 1.2 + 0.45 * focus, 3.5 + 0.55 * focus, d ) * ( 1.0 - smoothstep( focus + 18.0, focus + 28.0, d ) ) * min( 1.0, 0.0025 / halfW + 0.35 );
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
	// (CB-2: through a long lens the dashes are short and few; each a little denser, so the speckle
	// shows the way it does in the center field frames)
	o.vK = mix( 1.7, 1.0, wide );
	// ---- FW2 (C2W-5): what lights the drop. The lamps near it, as they light a surface (LocalLights:
	// the inverse square, the range window, the spot's cone), weighed by the drops' forward lobe: seen
	// against a lamp a drop blazes, side on it scatters a tenth of that
	let ray = normalize( p - cam );
	var lit = 0.0;
	for ( var i = 0; i < localLights.count; i++ ) {
		let lp = localLights.pos[ i ];
		let dv = lp.xyz - p;
		let d2 = dot( dv, dv );
		if ( d2 < lp.w ) {
			let c = localLights.col[ i ];
			let sd = localLights.dir[ i ];
			let Ld = dv * inverseSqrt( max( d2, 1e-6 ) );
			let x = d2 / lp.w;
			let win = sat( 1.0 - x * x );
			let spot = localLightsSpotProfile( dot( - Ld, sd.xyz ), c.w, sd.w );
			let E = dot( c.xyz, vec3f( 0.3, 0.55, 0.15 ) ) * win * win * spot / ( d2 + 0.15 );
			lit += E * ( 0.12 + 2.4 * pow( max( dot( Ld, ray ), 0.0 ), 12.0 ) );
		}
	}
	// the light banks: their fixtures leak light all round (from the street their backs glow), so the
	// drops within a few metres of a bank make a halo round it, brightest seen against it
	let nk = smoothstep( 0.15, 0.75, frame.night );
	for ( var i = 0; i < 8; i ++ ) {
		var L = mat.l0;
		switch i { case 1: { L = mat.l1; } case 2: { L = mat.l2; } case 3: { L = mat.l3; } case 4: { L = mat.l4; } case 5: { L = mat.l5; } case 6: { L = mat.l6; } case 7: { L = mat.l7; } default: {} }
		if ( L.w > 0.5 ) {
			let dv = L.xyz - p;
			let d2 = dot( dv, dv );
			lit += mat.lightK.w * nk * ( 0.15 + 2.0 * pow( max( 0.0, dot( dv * inverseSqrt( d2 ), ray ) ), 10.0 ) ) / ( d2 + 9.0 );
		}
	}
	// ---- end FW2
	o.vLit = lit;
`,
			surface: /* wgsl */`
	// ---- FW2 (C2W-5): lit by the sky by day; after dark by the lamps near it (vLit) and a little by the
	// city's glow off the cloud. A drop nothing lights doesn't show: its coverage goes with its light
	let E = min( in.vs.vLit * mat.lightK.x, 6.0 ) + mat.lightK.z * frame.night;
	let sky = frame.skyIrradiance * 1.5;
	s.albedo = mat.color * ( sky + vec3f( E ) );
	let seen = smoothstep( 0.0, mat.lightK.y, E + luminance( sky ) );
	s.alpha = in.vs.vA * 0.3 * ( 1.0 - in.vs.vY * 0.5 ) * in.vs.vK * seen;
	// ---- end FW2
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
