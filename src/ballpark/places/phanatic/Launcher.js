import { InstancedMesh, CylinderGeometry, SphereGeometry, Matrix4, Quaternion, Vector3, Euler } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { Kit } from './Kit.js';

// The hot dogs from the launcher (its barrel rides on the Gator: Gator.js) and the aiming: each shot
// flies a parabola from the muzzle to a seat, tumbling end over end. In 2008 they were "heavily wrapped
// in white packaging and duct tape" (the Inquirer, September 25, 2008), the ends twisted.
//
//   const L = new Launcher( parent );
//   L.dogs( [ { from, to, t0, T } ], t )                the hot dogs in the air at time t
//   Launcher.aimAt( pivot, to, T ) -> { yaw, pitch }     the aim that lands a shot on `to` in T s
//   Launcher.muzzle( { x, y, z, yaw, pitch } )           the muzzle's position for a pivot and aim

// the barrel: from its breech (BARREL_BACK behind the pivot) to the muzzle (BARREL ahead of it)
export const BARREL = 1.15, BARREL_BACK = 0.45;
const G = 9.81;
const PAL = [ 'paper', 'tape' ];

export class Launcher {

	constructor( parent ) {

		const mat = standard( {
			name: 'phanatic-hot-dogs', roughness: 0.6,
			surface: /* wgsl */`
	let k = i32( in.uv.x * 2.0 );
	if ( k == 0 ) { s.albedo = vec3f( 0.8, 0.79, 0.76 ) * ( 0.85 + 0.15 * fract( sin( dot( floor( in.P * 70.0 ), vec3f( 12.9, 78.2, 37.7 ) ) ) * 43758.5 ) ); s.roughness = 0.8; }
	else { s.albedo = vec3f( 0.45, 0.46, 0.47 ); s.roughness = 0.35; s.metalness = 0.6; }
` } );
		const d = new Kit( PAL.length );
		const X = [ Math.PI / 2, 0, 0 ];
		d.add( new SphereGeometry( 1, 12, 8 ), 0, [ 0, 0, 0 ], [ 0, 0, 0 ], [ 0.034, 0.03, 0.11 ] );
		d.add( new CylinderGeometry( 1, 1, 1, 10 ), 0, [ 0, 0, 0 ], X, [ 0.033, 0.15, 0.029 ] );
		for ( const z of [ - 0.045, 0.0, 0.045 ] ) d.add( new CylinderGeometry( 1, 1, 1, 10 ), 1, [ 0, 0, z ], X, [ 0.036, 0.022, 0.032 ] );
		for ( const z of [ - 0.1, 0.1 ] ) d.add( new CylinderGeometry( 0.005, 0.02, 0.045, 6 ), 0, [ 0, 0, z + Math.sign( z ) * 0.012 ], [ Math.sign( z ) * Math.PI / 2, 0, 0 ] );
		this.dogMesh = new InstancedMesh( d.geometry(), mat, 12 );
		this.dogMesh.name = 'phanatic-hot-dogs';
		this.dogMesh.frustumCulled = false;
		this.dogMesh.userData.dynamic = true;
		this.dogMesh.count = 0;
		parent.add( this.dogMesh );
		this._m = new Matrix4();
		this._q = new Quaternion();
		this._e = new Euler();
		this._p = new Vector3();
		this._s = new Vector3( 1, 1, 1 );

	}

	static muzzle( { x, y, z, yaw, pitch } ) {

		const c = Math.cos( pitch ), dir = [ - Math.sin( yaw ) * c, Math.sin( pitch ), - Math.cos( yaw ) * c ];
		return { at: [ x + dir[ 0 ] * BARREL, y + dir[ 1 ] * BARREL, z + dir[ 2 ] * BARREL ], dir };

	}

	static aimAt( pivot, to, T ) {

		// aim from the muzzle, not the pivot: solve once from the pivot, then again from that muzzle
		let aim = null, from = pivot;
		for ( let i = 0; i < 3; i ++ ) {

			const v = [ ( to[ 0 ] - from[ 0 ] ) / T, ( to[ 1 ] - from[ 1 ] + 0.5 * G * T * T ) / T, ( to[ 2 ] - from[ 2 ] ) / T ];
			const h = Math.hypot( v[ 0 ], v[ 2 ] );
			aim = { yaw: Math.atan2( - v[ 0 ], - v[ 2 ] ), pitch: Math.atan2( v[ 1 ], h ), speed: Math.hypot( h, v[ 1 ] ) };
			from = Launcher.muzzle( { x: pivot[ 0 ], y: pivot[ 1 ], z: pivot[ 2 ], ...aim } ).at;

		}

		return aim;

	}

	dogs( list, t ) {

		let n = 0;
		for ( const s of list ) {

			const u = t - s.t0;
			if ( u < 0 || u > s.T || n >= 12 ) continue;
			const k = u / s.T;
			const vy = ( s.to[ 1 ] - s.from[ 1 ] + 0.5 * G * s.T * s.T ) / s.T;
			this._p.set( s.from[ 0 ] + ( s.to[ 0 ] - s.from[ 0 ] ) * k, s.from[ 1 ] + vy * u - 0.5 * G * u * u, s.from[ 2 ] + ( s.to[ 2 ] - s.from[ 2 ] ) * k );
			const yaw = Math.atan2( - ( s.to[ 0 ] - s.from[ 0 ] ), - ( s.to[ 2 ] - s.from[ 2 ] ) );
			this._q.setFromEuler( this._e.set( u * 11 + s.t0, yaw, u * 3, 'YXZ' ) );
			this.dogMesh.setMatrixAt( n ++, this._m.compose( this._p, this._q, this._s ) );

		}

		this.dogMesh.count = n;
		this.dogMesh.visible = n > 0;
		if ( n ) this.dogMesh.instanceMatrix.needsUpdate = true;

	}

}
