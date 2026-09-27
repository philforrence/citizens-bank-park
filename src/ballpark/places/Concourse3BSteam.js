import { InstancedMesh, PlaneGeometry, Matrix4, Vector3, Color } from '../../engine/index.js';
import { StorageBuffer } from '../../engine/gpu/Texture.js';
import { standard } from '../../materials/Materials.js';
import { LEVELS } from '../layout.js';
import { armFK } from './Concourse3BKit.js';
import { PROP } from './Cast.js';

// Steam and breath on the third base concourse (Concourse3B.js): what a 47-degree night (and a
// 44-degree one on the 29th) shows on a concourse full of hot food. Steam off the grills' flat-tops
// rolling out under the menu boards (Cobblestone, Hatfield), off the hot chocolate urns on the cart and
// out of the cups in people's hands (15,000 of them sold on the 27th), and people's breath, a puff at
// each breath out, bigger when they shout. Soft puffs that rise, spread and fade: each one's start and
// its drift are written by the CPU when it's let go, the shader ages it (one instanced draw on the
// transparent pass).
const STREET = LEVELS.mainConcourse;
const MAX = 480;

export class Steam {

	constructor( { parent, bounds } ) {

		this.data = new Float32Array( MAX * 8 );
		this.buf = new StorageBuffer( { label: 'concourseSteam', count: MAX * 2, type: 'vec4f' } );
		this.material = standard( {
			name: 'concourse3b-steam', color: new Color( 0.8, 0.8, 0.82 ), transparent: true, depthWrite: false, side: 'double', lit: false,
			storage: { c3Steam: this.buf },
			varyings: { vA: 'f32', vUV: 'vec2f', vK: 'f32' },
			vertex: /* wgsl */`
	// a puff: [ start x, y, z, born ], [ drift x, rise, drift z, life + 1000 * kind ]
	let a = c3Steam[ v.instance * 2u ];
	let b = c3Steam[ v.instance * 2u + 1u ];
	let kind = floor( b.w / 1000.0 );
	let life = b.w - kind * 1000.0;
	let age = frame.time - a.w;
	let k = age / max( life, 0.01 );
	var p = a.xyz + vec3f( b.x, 0.0, b.z ) * age + vec3f( 0.0, b.y * age - 0.12 * b.y * age * age / max( life, 0.1 ), 0.0 );
	// the air's eddies
	p += vec3f( sin( age * 2.1 + a.x * 3.0 ), 0.0, cos( age * 1.7 + a.z * 3.0 ) ) * 0.04 * age;
	// the puff grows as it spreads: steam from 12 cm to a half metre, breath from 6 to 25 cm
	let size = select( select( 0.12 + 0.45 * k, 0.06 + 0.22 * k, kind == 1.0 ), 0.05 + 0.14 * k, kind == 2.0 );
	// turned to face the camera
	let w = ( v.model * vec4f( p, 1.0 ) ).xyz;
	let right = vec3f( frame.view[ 0 ][ 0 ], frame.view[ 1 ][ 0 ], frame.view[ 2 ][ 0 ] );
	let up = vec3f( frame.view[ 0 ][ 1 ], frame.view[ 1 ][ 1 ], frame.view[ 2 ][ 1 ] );
	let alive = step( 0.0, k ) * step( k, 1.0 );
	v.useWorld = true;
	v.worldPos = w + ( right * v.position.x + up * v.position.y ) * size * alive;
	v.worldNormal = normalize( frame.cameraPos - w );
	v.prevWorldPos = v.worldPos;
	// in fast, out slow; the breath quicker
	o.vA = alive * smoothstep( 0.0, 0.12, k ) * pow( 1.0 - k, 1.6 ) * select( select( 0.22, 0.3, kind == 1.0 ), 0.2, kind == 2.0 );
	o.vUV = v.position.xy;
	o.vK = kind;
`,
			surface: /* wgsl */`
	// a soft round puff, lumpy
	let r = length( in.vs.vUV ) * 2.0;
	let lump = 0.92 + 0.08 * sin( atan2( in.vs.vUV.y, in.vs.vUV.x ) * 5.0 + in.vs.vA * 20.0 );
	let a = in.vs.vA * smoothstep( 1.0, 0.15, r / lump );
	// lit by the concourse's lights (the kitchens' steam warm with the heat lamps)
	let lightK = mix( 0.75, 0.55, frame.night );
	s.albedo = select( vec3f( 0.82, 0.82, 0.84 ), vec3f( 0.9, 0.84, 0.76 ), in.vs.vK == 0.0 ) * lightK + frame.skyIrradiance * 0.3;
	s.alpha = a;
`,
		} );
		this.material.underwaterLighting = 'none';
		const g = new PlaneGeometry( 1, 1 );
		this.mesh = new InstancedMesh( g, this.material, MAX );
		this.mesh.name = 'concourse3b-steam';
		this.mesh.frustumCulled = false;
		this.mesh.layers.set( 2 );
		this.mesh.userData.dynamic = true;
		const I = new Matrix4();
		for ( let i = 0; i < MAX; i ++ ) this.mesh.setMatrixAt( i, I );
		if ( bounds ) this.mesh.boundingSphere = bounds;
		parent.add( this.mesh );
		this.next = 0;
		this.time = 0;
		this.emitters = []; // { x, y, z, rate, kind, spread: [ x, z ], drift: [ x, z ], rise, life }
		this._acc = [];

	}

	// a place that steams: a point (field frame), how many puffs a second, what kind (0 steam, 1 breath,
	// 2 a cup), its spread, drift and rise
	emit( e ) {

		this.emitters.push( { rate: 3, kind: 0, spread: [ 0.3, 0.3 ], drift: [ 0, 0 ], rise: 0.4, life: 3, ...e } );
		this._acc.push( 0 );

	}

	_puff( x, y, z, dx, rise, dz, life, kind ) {

		const i = this.next;
		this.next = ( this.next + 1 ) % MAX;
		this.data.set( [ x, y, z, this.time, dx, rise, dz, life + 1000 * kind ], i * 8 );

	}

	// the fixed ones as if they'd been going a while: puffs let go over the last few seconds
	warm( time ) {

		this.emitters.forEach( ( e ) => {

			const n = Math.ceil( e.rate * e.life );
			for ( let k = 0; k < n; k ++ ) {

				const age = ( k / n ) * e.life, r = Math.random;
				this.time = time - age;
				this._puff( e.x + ( r() - 0.5 ) * e.spread[ 0 ], e.y, e.z + ( r() - 0.5 ) * e.spread[ 1 ], e.drift[ 0 ] + ( r() - 0.5 ) * 0.1, e.rise * ( 0.8 + 0.4 * r() ), e.drift[ 1 ] + ( r() - 0.5 ) * 0.1, e.life * ( 0.8 + 0.4 * r() ), e.kind );

			}

		} );
		this.time = time;

	}

	// time: the shader's clock (frame.time); cast / people: for the cups and the breath (near the camera)
	update( dt, time, { cast, cam, cold, wind } ) {

		this.time = time;
		const r = Math.random;
		// the fixed ones: the grills, the urns
		this.emitters.forEach( ( e, i ) => {

			this._acc[ i ] += dt * e.rate;
			while ( this._acc[ i ] >= 1 ) {

				this._acc[ i ] -= 1;
				this._puff( e.x + ( r() - 0.5 ) * e.spread[ 0 ], e.y, e.z + ( r() - 0.5 ) * e.spread[ 1 ], e.drift[ 0 ] + wind[ 0 ] * 0.3 + ( r() - 0.5 ) * 0.1, e.rise * ( 0.8 + 0.4 * r() ), e.drift[ 1 ] + wind[ 1 ] * 0.3 + ( r() - 0.5 ) * 0.1, e.life * ( 0.8 + 0.4 * r() ), e.kind );

			}

		} );
		// the cups in hand and people's breath: only near the camera (it's only seen close up)
		if ( cast && cam ) {

			for ( const p of cast.list ) {

				if ( ! p.visible ) continue;
				const dx = p.x - cam[ 0 ], dz = p.z - cam[ 2 ];
				if ( dx * dx + dz * dz > 18 * 18 ) continue;
				const a = p.pose, c = Math.cos( p.yaw ), sn = Math.sin( p.yaw );
				const toField = ( q ) => [ p.x + ( c * q[ 0 ] + sn * q[ 2 ] ) * p.scale, p.y + q[ 1 ] * p.scale - a.drop, p.z + ( - sn * q[ 0 ] + c * q[ 2 ] ) * p.scale ];
				// a hot chocolate: a wisp off the lid
				for ( const [ side, prop, arm ] of [ [ 1, a.propR, a.armR ], [ - 1, a.propL, a.armL ] ] ) {

					if ( prop !== PROP.cocoa ) continue;
					p._cup = ( p._cup || 0 ) + dt * 2.2;
					if ( p._cup < 1 ) continue;
					p._cup -= 1;
					const h = armFK( side, arm, { lean: a.lean, twist: a.twist, roll: a.roll } ).hand;
					const [ x, y, z ] = toField( [ h[ 0 ] - 0.035 * side, h[ 1 ] + 0.08, h[ 2 ] - 0.02 ] );
					this._puff( x, y, z, wind[ 0 ] * 0.2, 0.18, wind[ 1 ] * 0.2, 1.6, 2 );

				}

				// breath: a puff at each breath out (every 3 to 4 s), more of it shouting
				if ( cold > 0 ) {

					p._breath = ( p._breath ?? Math.random() * 3 ) - dt * ( 0.28 + 0.6 * ( a.mouth || 0 ) );
					if ( p._breath <= 0 ) {

						p._breath += 1;
						const [ x, y, z ] = toField( [ 0, 1.55, - 0.14 ] );
						const [ fx, , fz ] = toField( [ 0, 0, - 1 ] );
						this._puff( x, y, z, ( fx - p.x ) * 0.25 + wind[ 0 ] * 0.3, 0.05, ( fz - p.z ) * 0.25 + wind[ 1 ] * 0.3, 1.2 * cold, 1 );

					}

				}

			}

		}

		this.buf.write( this.data );

	}

}
