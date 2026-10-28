import { Mesh, BufferGeometry, Float32BufferAttribute, Color } from '../../../engine/index.js';
import { commonModule } from '../../../engine/render/wgsl/common.js';
import { standard } from '../../../materials/Materials.js';
import { DUGOUT_ROOF, DUGOUT_ZONES } from '../../Field.js';

// The dugouts in the rain on the 27th: water standing in the low places on their flat white roofs, and
// running off the roofs' front edges in a line of drips onto the track in front of the benches (the
// players at the rail are looking out through it). `rain` (0..1) is set per frame by the rail.

export class Drips {

	constructor( { group, field } ) {

		const R = DUGOUT_ROOF;
		this.mat = standard( { name: 'dugout-drips', color: new Color( 0.75, 0.78, 0.8 ), roughness: 0.1, side: 'double', transparent: true, depthWrite: false, modules: [ commonModule ],
			uniforms: { rain: [ 'f32', 0 ] },
			surface: /* wgsl */`
	// a column of drops every 2.5 cm along the edge, the busier ones where the roof sheds most; each
	// drop a short streak falling the height of the roof
	let col = floor( in.uv.x / 0.025 );
	let h = fract( sin( col * 12.9898 ) * 43758.5453 );
	let h2 = fract( h * 71.3 );
	let dripping = step( h, mat.rain * 0.55 );
	let fall = fract( frame.time * ( 0.9 + 0.6 * h2 ) + h );
	let y = in.uv.y / ${ R.toFixed( 3 ) }; // 0 at the ground, 1 at the edge
	let head = 1.0 - fall;
	let streak = smoothstep( 0.0, 0.02, y - head + 0.06 ) * ( 1.0 - smoothstep( 0.0, 0.01, y - head ) );
	let across = 1.0 - smoothstep( 0.1, 0.35, abs( fract( in.uv.x / 0.025 ) - 0.5 ) );
	// along the edge itself, the water gathering before it lets go
	let lip = ( 1.0 - smoothstep( 0.0, 0.03, 1.0 - y ) ) * 0.5;
	// ---- FB2 (C2B-12): through a long lens focused 20 m out on the batter, a drip a metre or two off the
	// low camera's glass is a blur that isn't there, not a beaded rod across him: faded by its distance
	// against where the lens is focused (as game/Rain.js does its near drops); a wide lens sees them
	let tanHalf = 1.0 / frame.proj[ 1 ][ 1 ];
	let focus = clamp( 0.9 / tanHalf - 1.5, 0.0, 40.0 );
	let dcam = length( in.P - frame.cameraPos );
	let inFocus = smoothstep( 0.35 * focus, 0.6 * focus + 0.5, dcam );
	// ---- end FB2
	s.alpha = clamp( ( streak * across * dripping + lip * across * step( h, mat.rain * 0.8 ) ) * 0.55, 0.0, 1.0 ) * inFocus;
	s.albedo = mat.color;
	s.emissive = mat.color * smoothstep( 0.2, 0.8, frame.night ) * 0.25;
` } );
		this.mat.underwaterLighting = 'none';
		// CB-5 (gauntlet r1): in the photos of the 27th both roofs read clean white in the rain, a wet sheen
		// at most and the lettering crisp (Getty 84081873, luidude 2981634108); dark noise puddles over a
		// third of the roof read as grey camouflage from the TV high camera. So the standing water is a
		// reflection, not a stain: the roof's own white, glassy, faint, and only in a few thin pools along
		// the back edge where the roof meets the stands (t, the metres back from its front, past 2.2)
		this.pond = standard( { name: 'dugout-roof-water', color: new Color( 0.72, 0.73, 0.74 ), roughness: 0.03, transparent: true, depthWrite: false, modules: [ commonModule ],
			uniforms: { rain: [ 'f32', 0 ] },
			surface: /* wgsl */`
	// the roof's low spots along the back: thin pools, their edges feathered
	let n = mx_noise_float2( in.uv * vec2f( 0.5, 1.6 ) ) * 0.5 + 0.5 + 0.15 * mx_noise_float2( in.uv * 4.0 );
	let back = smoothstep( 2.2, 2.55, in.uv.y );
	let pud = smoothstep( 0.6 - 0.15 * mat.rain, 0.68 - 0.15 * mat.rain, n ) * back * step( 0.05, mat.rain );
	s.alpha = pud * 0.22;
	s.albedo = mat.color;
	s.roughness = 0.03;
` } );
		this.pond.underwaterLighting = 'none';
		const dq = { pos: [], nrm: [], uv: [], index: [] }, pq = { pos: [], nrm: [], uv: [], index: [] };
		const quad = ( o, a, b, c, d, n, ua, ub, uc, ud ) => {

			const k = o.pos.length / 3;
			o.pos.push( ...a, ...b, ...c, ...d );
			for ( let i = 0; i < 4; i ++ ) o.nrm.push( ...n );
			o.uv.push( ...ua, ...ub, ...uc, ...ud );
			o.index.push( k, k + 1, k + 2, k, k + 2, k + 3 );

		};

		for ( const d of field.dugouts ) {

			const { a, ux, uz, nx, nz, len } = d;
			const P = ( s, t, y ) => [ a[ 0 ] + ux * s + nx * t, y, a[ 1 ] + uz * s + nz * t ];
			const s0 = DUGOUT_ZONES.home - 0.2, s1 = len - DUGOUT_ZONES.far + 0.2;
			// the curtain of drips, just off the roof's front edge
			const t = - 0.49;
			quad( dq, P( s0, t, 0.02 ), P( s1, t, 0.02 ), P( s1, t, R ), P( s0, t, R ), [ - nx, 0, - nz ], [ 0, 0 ], [ s1 - s0, 0 ], [ s1 - s0, R ], [ 0, R ] );
			// the water on the roof
			const y = R + 0.009;
			quad( pq, P( s0, - 0.45, y ), P( s1, - 0.45, y ), P( s1, 2.85, y ), P( s0, 2.85, y ), [ 0, 1, 0 ], [ s0, - 0.45 ], [ s1, - 0.45 ], [ s1, 2.85 ], [ s0, 2.85 ] );

		}

		this.meshes = [];
		for ( const [ o, m, name ] of [ [ dq, this.mat, 'dugout-drips' ], [ pq, this.pond, 'dugout-roof-water' ] ] ) {

			const g = new BufferGeometry();
			g.setAttribute( 'position', new Float32BufferAttribute( o.pos, 3 ) );
			g.setAttribute( 'normal', new Float32BufferAttribute( o.nrm, 3 ) );
			g.setAttribute( 'uv', new Float32BufferAttribute( o.uv, 2 ) );
			g.setIndex( o.index );
			g.computeBoundingSphere();
			const mesh = new Mesh( g, m );
			mesh.name = name;
			mesh.layers.set( 2 ); // the late (transparent) pass
			mesh.visible = false;
			group.add( mesh );
			this.meshes.push( mesh );

		}

	}

	update( S ) {

		const rain = S.first ? S.rain : 0;
		this.mat.uniforms.rain.value = rain;
		// (CB-5: none on the 29th: the roofs were squeegeed for the resumption)
		this.pond.uniforms.rain.value = S.first ? S.wet : 0;
		this.meshes[ 0 ].visible = rain > 0.01;
		this.meshes[ 1 ].visible = this.pond.uniforms.rain.value > 0.05;

	}

}
