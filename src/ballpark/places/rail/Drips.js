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
	s.alpha = clamp( ( streak * across * dripping + lip * across * step( h, mat.rain * 0.8 ) ) * 0.55, 0.0, 1.0 );
	s.albedo = mat.color;
	s.emissive = mat.color * smoothstep( 0.2, 0.8, frame.night ) * 0.25;
` } );
		this.mat.underwaterLighting = 'none';
		this.pond = standard( { name: 'dugout-roof-water', color: new Color( 0.05, 0.055, 0.06 ), roughness: 0.03, transparent: true, depthWrite: false, modules: [ commonModule ],
			uniforms: { rain: [ 'f32', 0 ] },
			surface: /* wgsl */`
	// the roof's low spots: shallow puddles, their edges feathered
	let n = mx_noise_float2( in.uv * 0.8 ) * 0.5 + 0.5 + 0.15 * mx_noise_float2( in.uv * 4.0 );
	let pud = smoothstep( 0.72 - 0.25 * mat.rain, 0.8 - 0.25 * mat.rain, n ) * step( 0.05, mat.rain );
	s.alpha = pud * 0.75;
	s.albedo = mat.color;
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
		// the roofs hold a little water into the 29th (the 28th was wet too)
		this.pond.uniforms.rain.value = S.first ? S.wet : 0.15;
		this.meshes[ 0 ].visible = rain > 0.01;
		this.meshes[ 1 ].visible = true;

	}

}
