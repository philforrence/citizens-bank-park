import { Mesh, BufferGeometry, Float32BufferAttribute, Color, Vector2 } from '../../engine/index.js';
import { standard } from '../../materials/Materials.js';

// Rain round the camera: streaks falling through a box that moves with you (each drop wraps inside it),
// leaning with the wind, faint in the distance. `amount` 0..1 thins them out.
const N = 14000;
const BOX = [ 44, 26, 44 ]; // m

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
		this.material = standard( {
			name: 'rain', color: new Color( 0.8, 0.82, 0.86 ), transparent: true, depthWrite: false, side: 'double', lit: false,
			uniforms: { amount: [ 'f32', 0 ], wind: [ 'vec2f', new Vector2( 1.5, 0.5 ) ] },
			attributes: { aSeed: 'vec4f', aCorner: 'vec2f' },
			varyings: { vA: 'f32', vY: 'f32' },
			vertex: /* wgsl */`
	let box = vec3f( ${ BOX[ 0 ] }.0, ${ BOX[ 1 ] }.0, ${ BOX[ 2 ] }.0 );
	let cam = frame.cameraPos;
	let speed = 8.5 + v.aSeed.w * 2.0;
	let fall = vec3f( mat.wind.x, - speed, mat.wind.y );
	// the drop's place in the box, wrapped round the camera
	var p = v.aSeed.xyz * box + fall * frame.time;
	p = cam + ( fract( ( p - cam ) / box + 0.5 ) - 0.5 ) * box;
	// a streak along its fall, facing the camera
	let dir = normalize( fall );
	let toCam = normalize( cam - p );
	let side = normalize( cross( dir, toCam ) );
	let len = 0.55;
	let wp = p + side * v.aCorner.x * 0.006 + dir * v.aCorner.y * len;
	v.useWorld = true;
	v.worldPos = wp;
	v.worldNormal = toCam;
	v.prevWorldPos = wp - fall * frame.dt;
	// thin them out with the amount; fade the far ones and the ones right at the lens
	let d = length( p - cam );
	o.vA = step( v.aSeed.w, mat.amount ) * smoothstep( 0.4, 2.0, d ) * ( 1.0 - smoothstep( 14.0, 22.0, d ) );
	o.vY = v.aCorner.y;
`,
			surface: /* wgsl */`
	// brighter under the lights at night
	let lightK = mix( 0.9, 1.6, frame.night );
	s.albedo = mat.color * lightK * ( frame.skyIrradiance * 1.5 + vec3f( 0.25 ) * frame.night );
	s.alpha = in.vs.vA * 0.28 * ( 1.0 - in.vs.vY * 0.5 );
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

	set amount( a ) {

		this.material.uniforms.amount.value = a;
		this.mesh.visible = a > 0.01;

	}

	get amount() {

		return this.material.uniforms.amount.value;

	}

}
