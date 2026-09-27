import { Mesh, BufferGeometry, Float32BufferAttribute, Color } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { fencePoint } from '../../layout.js';

// The fireworks at the last out (flickr ronniebruce 2988346176, pompomflipflop 2985520865, danielbott
// 2987283345, johnpaulendicott 2987989668): the moment Lidge struck Hinske out, gerbs of white and red
// sparks shot up off the top of the scoreboard in left and a red fountain went up off the Liberty Bell
// in right-center, and shells burst over the outfield (red, white, green, gold), the smoke hanging
// in the lights. All on the GPU from the time since the strikeout: each spark's shell, its direction and
// its colour are baked in; the vertex shader flies it, so it costs nothing on the CPU and scrubs.
//
// (The choreography, the shells' colours and the count are invented to match the photos; where they
// went up from is the photos'.)

const hash = ( n ) => {

	const s = Math.sin( n * 12.9898 ) * 43758.5453;
	return s - Math.floor( s );

};
// the colours (linear, bright): red, white, green, gold, a pale blue
const COLORS = [ [ 1.0, 0.08, 0.05 ], [ 1.0, 0.95, 0.85 ], [ 0.15, 1.0, 0.25 ], [ 1.0, 0.62, 0.12 ], [ 0.55, 0.7, 1.0 ] ];
// kinds: 0 a burst (a peony: out in a sphere, slowing, drooping), 1 a gerb (a fountain of sparks
// streaming up over a stretch), 2 the rising trail of a shell before it bursts
const SPARKS = 110, GERB = 160;

export function fireworksPlan() {

	const shells = [];
	// the scoreboard's top (the Phillies script on its steel, ~52 m) and the bell's (~41 m)
	const [ bx, bz ] = fencePoint( - 36, 452 ), [ lx, lz ] = fencePoint( 21, 488 );
	for ( let k = 0; k < 5; k ++ ) shells.push( { kind: 1, at: [ bx - 12 + k * 6, 54, bz - 2 ], t0: 0.3 + ( k % 2 ) * 0.15, dur: 18, color: k % 2 ? 1 : 0, v: 26 } );
	shells.push( { kind: 1, at: [ lx, 43, lz ], t0: 0.5, dur: 14, color: 0, v: 30 } );
	// the shells over the outfield, from beyond center: a volley at the out, then steady, a finale
	let t = 1.6;
	for ( let k = 0; k < 34; k ++ ) {

		const finale = k >= 26;
		const x = - 55 + hash( k * 3.1 ) * 110, z = - 175 - hash( k * 5.7 ) * 35, y = 85 + hash( k * 7.3 ) * 40;
		shells.push( { kind: 2, at: [ x * 0.8, 8, z - 20 ], to: [ x, y, z ], t0: t - 1.3, dur: 1.3 } );
		shells.push( { kind: 0, at: [ x, y, z ], t0: t, dur: 2.6, color: Math.floor( hash( k * 11.9 ) * COLORS.length ), v: 34 + hash( k * 2.2 ) * 14, r: finale ? 1.2 : 1 } );
		t += finale ? 0.35 + hash( k ) * 0.3 : k < 6 ? 0.7 + hash( k ) * 0.4 : 1.1 + hash( k ) * 1.2;

	}

	return shells;

}

export class Fireworks {

	constructor( group ) {

		this.plan = fireworksPlan();
		const pos = [], shell = [], spark = [], corner = [], index = [];
		let n = 0;
		const quad = ( S, dir, c, k ) => {

			for ( const [ cx, cy ] of [ [ - 1, 0 ], [ 1, 0 ], [ 1, 1 ], [ - 1, 1 ] ] ) {

				pos.push( S.at[ 0 ], S.at[ 1 ], S.at[ 2 ] );
				shell.push( S.at[ 0 ], S.at[ 1 ], S.at[ 2 ], S.t0 );
				spark.push( dir[ 0 ], dir[ 1 ], dir[ 2 ], S.kind + c * 4 + Math.min( 0.99, k ) * 0.99 );
				corner.push( cx, cy, S.dur, S.v || 0 );

			}

			index.push( n, n + 1, n + 2, n, n + 2, n + 3 );
			n += 4;

		};

		this.plan.forEach( ( S, si ) => {

			if ( S.kind === 0 ) {

				// sparks out over a sphere (a golden spiral), each a little different in speed
				for ( let k = 0; k < SPARKS; k ++ ) {

					const y = 1 - 2 * ( k + 0.5 ) / SPARKS, r = Math.sqrt( 1 - y * y ), a = k * 2.39996 + si;
					const sp = ( S.r || 1 ) * ( 0.85 + 0.3 * hash( k + si * 7 ) );
					const c = hash( k * 0.37 + si ) < 0.18 ? 1 : S.color;
					quad( S, [ Math.cos( a ) * r * sp, y * sp, Math.sin( a ) * r * sp ], c, hash( k * 3 + si ) );

				}

			} else if ( S.kind === 1 ) {

				// a fountain: sparks in a narrow cone, each on its own loop through the stretch
				for ( let k = 0; k < GERB; k ++ ) {

					const a = hash( k * 1.7 + si ) * Math.PI * 2, spread = 0.12 * Math.sqrt( hash( k * 2.3 + si ) );
					const c = hash( k * 0.71 + si ) < 0.3 ? 1 : S.color;
					quad( S, [ Math.cos( a ) * spread, 1, Math.sin( a ) * spread ], c, hash( k * 5.1 + si ) );

				}

			} else {

				// the trail: one bright point rising to where it bursts (dir: the burst's point)
				quad( S, S.to, 3, 0 );

			}

		} );

		const g = new BufferGeometry();
		g.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
		g.setAttribute( 'aShell', new Float32BufferAttribute( shell, 4 ) );
		g.setAttribute( 'aSpark', new Float32BufferAttribute( spark, 4 ) );
		g.setAttribute( 'aCorner', new Float32BufferAttribute( corner, 4 ) );
		g.setIndex( index );
		g.boundingSphere = null;
		const cols = COLORS.map( ( c ) => `vec3f( ${ c.map( ( v ) => v.toFixed( 3 ) ).join( ', ' ) } )` );
		this.mat = standard( {
			name: 'fireworks', color: new Color( 1, 1, 1 ), transparent: true, depthWrite: false, side: 'double', lit: false, blending: 'additive',
			uniforms: { t: [ 'f32', - 100 ] },
			attributes: { aShell: 'vec4f', aSpark: 'vec4f', aCorner: 'vec4f' },
			varyings: { vA: 'f32', vC: 'vec3f', vU: 'f32' },
			vertex: /* wgsl */`
	let T = mat.t - v.aShell.w;
	let dur = v.aCorner.z;
	let kind = u32( v.aSpark.w ) % 4u;
	let ci = u32( v.aSpark.w ) / 4u;
	let jit = fract( v.aSpark.w );
	var col = ${ cols[ 0 ] };
	switch ci { case 1u: { col = ${ cols[ 1 ] }; } case 2u: { col = ${ cols[ 2 ] }; } case 3u: { col = ${ cols[ 3 ] }; } case 4u: { col = ${ cols[ 4 ] }; } default: {} }
	let org = v.aShell.xyz;
	var p = org;
	var vel = vec3f( 0.0, 1.0, 0.0 );
	var a = 0.0;
	var len = 0.4;
	var wid = 0.12;
	if ( kind == 0u ) {
		// a burst: out fast, slowing in the air (drag), drooping, fading and twinkling at the end
		let V = v.aCorner.w;
		let k = 1.4;
		let tt = max( T, 0.0 );
		let dragged = ( 1.0 - exp( - k * tt ) ) / k;
		p = org + v.aSpark.xyz * V * dragged + vec3f( 0.0, - 2.2 * tt * tt, 0.0 );
		vel = v.aSpark.xyz * V * exp( - k * tt ) + vec3f( 0.0, - 4.4 * tt, 0.0 );
		let life = dur * ( 0.8 + 0.4 * jit );
		a = step( 0.0, T ) * ( 1.0 - smoothstep( life * 0.55, life, T ) );
		a *= mix( 1.0, step( 0.5, fract( T * 13.0 + jit * 7.0 ) ), smoothstep( life * 0.5, life * 0.7, T ) );
		len = clamp( length( vel ) * 0.06, 0.3, 2.6 );
		wid = 0.3;
		a *= 1.0 + 3.0 * ( 1.0 - smoothstep( 0.0, 0.15, T ) );
	} else if ( kind == 1u ) {
		// a gerb: this spark goes up again and again (1.1 s each) all through the stretch
		let cyc = 1.1;
		let tt = fract( ( T + jit * cyc ) / cyc ) * cyc;
		let V = v.aCorner.w * ( 0.75 + 0.25 * jit );
		p = org + v.aSpark.xyz * V * tt + vec3f( 0.0, - 4.9 * tt * tt, 0.0 );
		vel = v.aSpark.xyz * V + vec3f( 0.0, - 9.8 * tt, 0.0 );
		a = step( 0.0, T ) * step( T, dur ) * ( 1.0 - tt / cyc ) * smoothstep( 0.0, 0.3, T ) * ( 1.0 - smoothstep( dur - 2.0, dur, T ) );
		len = clamp( length( vel ) * 0.06, 0.4, 2.0 );
		wid = 0.2;
		a *= 1.6;
	} else {
		// a shell's trail up
		let k = clamp( T / dur, 0.0, 1.0 );
		p = mix( org, v.aSpark.xyz, 1.0 - ( 1.0 - k ) * ( 1.0 - k ) );
		vel = v.aSpark.xyz - org;
		a = step( 0.0, T ) * step( T, dur ) * 0.6;
		len = 3.0;
		wid = 0.18;
	}
	let wp = ( v.model * vec4f( p, 1.0 ) ).xyz;
	let wv = normalize( ( v.model * vec4f( vel, 0.0 ) ).xyz + vec3f( 0.0, 1e-4, 0.0 ) );
	let toCam = normalize( frame.cameraPos - wp );
	let side = normalize( cross( wv, toCam ) );
	// a streak trailing back along its path; thicker far off so it holds a pixel or two
	let d = length( frame.cameraPos - wp );
	let w = wid * max( 1.0, d * 0.004 );
	let q = wp + side * v.aCorner.x * w - wv * v.aCorner.y * len;
	v.useWorld = true;
	v.worldPos = q;
	v.worldNormal = toCam;
	v.prevWorldPos = q;
	o.vA = a;
	o.vC = col;
	o.vU = v.aCorner.x;
`,
			surface: /* wgsl */`
	let edge = 1.0 - abs( in.vs.vU );
	// (the brightness in the colour: the blend's alpha stays within 0..1)
	s.albedo = in.vs.vC * 9.0 * edge * edge * max( 1.0, in.vs.vA );
	s.alpha = clamp( in.vs.vA, 0.0, 1.0 );
`,
		} );
		this.mat.underwaterLighting = 'none';
		this.mesh = new Mesh( g, this.mat );
		this.mesh.name = 'fireworks';
		this.mesh.frustumCulled = false;
		this.mesh.layers.set( 2 );
		this.mesh.visible = false;
		this.mesh.userData.dynamic = true;
		group.add( this.mesh );
		this.end = Math.max( ...this.plan.map( ( S ) => S.t0 + S.dur ) ) + 1;

	}

	// cel: seconds since the last out (null otherwise)
	update( cel ) {

		const on = cel != null && cel >= 0 && cel < this.end;
		this.mesh.visible = on;
		if ( on ) this.mat.uniforms.t.value = cel;

	}

}
