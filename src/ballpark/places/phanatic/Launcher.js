import { Group, Mesh, InstancedMesh, BoxGeometry, CylinderGeometry, SphereGeometry, TorusGeometry, Matrix4, Quaternion, Vector3, Euler } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { Kit } from './Kit.js';

// The hot dog launcher: a pneumatic cannon (a CO2 cylinder feeding a pressure tank, a valve and a long
// barrel on a swivel yoke), and the hot dogs it throws into the stands, each one wrapped in foil, spinning
// end over end on its way up to the 200 level. The launcher's own frame: the barrel's breech at the pivot
// (the origin), the muzzle 1.3 m out along -z; it turns on the yoke (yaw) and tips up (pitch).
//
//   const L = new Launcher( parent );
//   L.set( { visible, x, y, z, yaw, pitch } )           (field frame; on the ATV's rack or in his arms)
//   L.dogs( [ { from, to, t0, T } ], t )                the hot dogs in the air at time t

const PAL = [ 'barrel', 'red', 'steel', 'black', 'chrome', 'white', 'foil', 'brass' ];
const PA = Object.fromEntries( PAL.map( ( k, i ) => [ k, i ] ) );
export const BARREL = 1.3;
const G = 9.81;

function material() {

	const m = standard( {
		name: 'phanatic-launcher', roughness: 0.4,
		surface: /* wgsl */`
	let k = i32( in.uv.x * ${ PAL.length }.0 );
	var c = vec3f( 0.5 ); var r = 0.4; var mt = 0.0;
	switch k {
		case ${ PA.barrel }: { c = vec3f( 0.035, 0.24, 0.05 ); r = 0.3; }
		case ${ PA.red }: { c = vec3f( 0.42, 0.02, 0.03 ); r = 0.3; }
		case ${ PA.steel }: { c = vec3f( 0.3, 0.3, 0.31 ); r = 0.35; mt = 0.8; }
		case ${ PA.black }: { c = vec3f( 0.02 ); r = 0.5; }
		case ${ PA.chrome }: { c = vec3f( 0.7, 0.7, 0.72 ); r = 0.1; mt = 1.0; }
		case ${ PA.white }: { c = vec3f( 0.78, 0.77, 0.74 ); r = 0.35; }
		case ${ PA.foil }: {
			// crumpled foil: bright, smooth metal broken up by the creases
			let n = fract( sin( dot( floor( in.P * 90.0 ), vec3f( 12.9, 78.2, 37.7 ) ) ) * 43758.5 );
			c = vec3f( 0.75, 0.74, 0.72 ) * ( 0.7 + 0.3 * n ); r = 0.18 + 0.2 * n; mt = 1.0;
		}
		case ${ PA.brass }: { c = vec3f( 0.55, 0.4, 0.12 ); r = 0.3; mt = 1.0; }
		default: { c = vec3f( 0.02 ); }
	}
	s.albedo = c; s.roughness = r; s.metalness = mt;
` } );
	return m;

}

export class Launcher {

	constructor( parent ) {

		this.material = material();
		this.group = new Group();
		this.group.name = 'phanatic-launcher';
		this.group.userData.dynamic = true;
		parent.add( this.group );
		const k = new Kit( PAL.length );
		const cyl = ( s = 14 ) => new CylinderGeometry( 1, 1, 1, s, 1, false );
		const X = [ Math.PI / 2, 0, 0 ];
		// the barrel: green, a red band at the muzzle, a flared muzzle ring, white letters' band at the breech
		k.add( cyl( 18 ), PA.barrel, [ 0, 0, - BARREL / 2 ], X, [ 0.075, BARREL, 0.075 ] );
		k.add( cyl( 18 ), PA.red, [ 0, 0, - BARREL + 0.08 ], X, [ 0.082, 0.1, 0.082 ] );
		k.add( new TorusGeometry( 0.08, 0.014, 6, 18 ), PA.chrome, [ 0, 0, - BARREL ], [ 0, 0, 0 ] );
		k.add( cyl( 18 ), PA.white, [ 0, 0, - 0.25 ], X, [ 0.08, 0.14, 0.08 ] );
		// the breech: the pressure tank behind the barrel, the valve, the trigger grip under it
		k.add( cyl( 16 ), PA.steel, [ 0, 0, 0.18 ], X, [ 0.11, 0.36, 0.11 ] );
		k.add( new SphereGeometry( 1, 14, 8 ), PA.steel, [ 0, 0, 0.36 ], [ 0, 0, 0 ], [ 0.11, 0.11, 0.06 ] );
		k.add( cyl( 10 ), PA.brass, [ 0, 0.12, 0.05 ], [ 0, 0, 0 ], [ 0.03, 0.06, 0.03 ] );
		k.add( new SphereGeometry( 1, 10, 6 ), PA.black, [ 0, 0.17, 0.05 ], [ 0, 0, 0 ], [ 0.045, 0.02, 0.045 ] );
		k.add( new BoxGeometry( 1, 1, 1 ), PA.black, [ 0, - 0.14, 0.02 ], [ 0.3, 0, 0 ], [ 0.035, 0.14, 0.05 ] );
		k.add( new BoxGeometry( 1, 1, 1 ), PA.black, [ 0, - 0.08, 0.3 ], [ - 0.4, 0, 0 ], [ 0.04, 0.16, 0.05 ] );
		// the CO2 cylinder strapped under the tank, a hose round to the valve
		k.add( cyl( 12 ), PA.red, [ 0.13, - 0.06, 0.22 ], X, [ 0.045, 0.42, 0.045 ] );
		for ( const z of [ 0.1, 0.34 ] ) k.add( cyl( 12 ), PA.black, [ 0.13, - 0.06, z ], X, [ 0.05, 0.03, 0.05 ] );
		k.tube( cyl, PA.black, [ 0.13, - 0.06, 0.0 ], [ 0.05, 0.12, 0.05 ], 0.01, 6 );
		this.body = new Mesh( k.geometry(), this.material );
		this.body.name = 'phanatic-launcher-body';
		this.body.castShadow = true;
		this.group.add( this.body );
		this.triangles = k.triangles;
		// the yoke it swivels in (only on the rack)
		const y = new Kit( PAL.length );
		y.add( cyl( 12 ), PA.black, [ 0, - 0.33, 0.1 ], [ 0, 0, 0 ], [ 0.03, 0.34, 0.03 ] );
		for ( const sx of [ - 1, 1 ] ) y.add( new BoxGeometry( 1, 1, 1 ), PA.black, [ sx * 0.13, - 0.08, 0.1 ], [ 0, 0, 0 ], [ 0.02, 0.2, 0.06 ] );
		y.add( new BoxGeometry( 1, 1, 1 ), PA.black, [ 0, - 0.17, 0.1 ], [ 0, 0, 0 ], [ 0.28, 0.02, 0.06 ] );
		this.yoke = new Mesh( y.geometry(), this.material );
		this.yoke.name = 'phanatic-launcher-yoke';
		this.group.add( this.yoke );
		// the hot dogs: foil-wrapped, the ends twisted, instanced (a volley is a handful)
		const d = new Kit( PAL.length );
		d.add( new SphereGeometry( 1, 12, 8 ), PA.foil, [ 0, 0, 0 ], [ 0, 0, 0 ], [ 0.03, 0.026, 0.1 ] );
		d.add( cyl( 8 ), PA.foil, [ 0, 0, 0 ], X, [ 0.029, 0.14, 0.025 ] );
		for ( const z of [ - 0.1, 0.1 ] ) d.add( new CylinderGeometry( 0.004, 0.018, 0.04, 6 ), PA.foil, [ 0, 0, z + Math.sign( z ) * 0.01 ], [ Math.sign( z ) * Math.PI / 2, 0, 0 ] );
		this.dogMesh = new InstancedMesh( d.geometry(), this.material, 12 );
		this.dogMesh.name = 'phanatic-hot-dogs';
		this.dogMesh.frustumCulled = false;
		this.dogMesh.userData.dynamic = true;
		this.dogMesh.count = 0;
		parent.add( this.dogMesh );
		this._m = new Matrix4();
		this._q = new Quaternion();
		this._e = new Euler();
		this.group.visible = false;

	}

	// where it is: its pivot, the way it points (yaw 0: -z; pitch: up), whether the yoke shows
	set( { visible = true, x = 0, y = 0, z = 0, yaw = 0, pitch = 0, yoke = true } ) {

		const g = this.group;
		g.visible = visible;
		if ( ! visible ) return;
		g.position.set( x, y, z );
		g.rotation.set( 0, yaw, 0, 'YXZ' );
		this.body.rotation.set( pitch, 0, 0 );
		this.yoke.visible = yoke;

	}

	// the muzzle's position and the barrel's direction for a pivot and aim
	static muzzle( { x, y, z, yaw, pitch } ) {

		const c = Math.cos( pitch ), dir = [ - Math.sin( yaw ) * c, Math.sin( pitch ), - Math.cos( yaw ) * c ];
		return { at: [ x + dir[ 0 ] * BARREL, y + dir[ 1 ] * BARREL, z + dir[ 2 ] * BARREL ], dir };

	}

	// the aim (yaw, pitch) that puts a hot dog from the pivot on a target, flying T seconds
	static aimAt( pivot, to, T ) {

		const v = [ ( to[ 0 ] - pivot[ 0 ] ) / T, ( to[ 1 ] - pivot[ 1 ] + 0.5 * G * T * T ) / T, ( to[ 2 ] - pivot[ 2 ] ) / T ];
		const h = Math.hypot( v[ 0 ], v[ 2 ] );
		return { yaw: Math.atan2( - v[ 0 ], - v[ 2 ] ), pitch: Math.atan2( v[ 1 ], h ), speed: Math.hypot( h, v[ 1 ] ) };

	}

	// the hot dogs in the air at t: each { from, to, t0, T } flies a parabola, tumbling end over end
	dogs( list, t ) {

		let n = 0;
		for ( const s of list ) {

			const u = t - s.t0;
			if ( u < 0 || u > s.T || n >= 12 ) continue;
			const k = u / s.T;
			const x = s.from[ 0 ] + ( s.to[ 0 ] - s.from[ 0 ] ) * k;
			const z = s.from[ 2 ] + ( s.to[ 2 ] - s.from[ 2 ] ) * k;
			const vy = ( s.to[ 1 ] - s.from[ 1 ] + 0.5 * G * s.T * s.T ) / s.T;
			const y = s.from[ 1 ] + vy * u - 0.5 * G * u * u;
			const yaw = Math.atan2( - ( s.to[ 0 ] - s.from[ 0 ] ), - ( s.to[ 2 ] - s.from[ 2 ] ) );
			this._q.setFromEuler( this._e.set( u * 11 + s.t0, yaw, u * 3, 'YXZ' ) );
			this._m.compose( new Vector3( x, y, z ), this._q, new Vector3( 1, 1, 1 ) );
			this.dogMesh.setMatrixAt( n ++, this._m );

		}

		this.dogMesh.count = n;
		this.dogMesh.visible = n > 0;
		if ( n ) this.dogMesh.instanceMatrix.needsUpdate = true;

	}

}
