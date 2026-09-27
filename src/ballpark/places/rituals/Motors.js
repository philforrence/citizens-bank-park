import { InstancedMesh, BufferGeometry, Float32BufferAttribute, Matrix4, Quaternion, Vector3, Euler, Color } from '../../../engine/index.js';
import { standard } from '../../../materials/Materials.js';
import { Cast, TOP, COLOR, HAT, restPose, seat } from '../Cast.js';
import { armIK } from '../Concourse3BKit.js';
import { OUTFIELD, FT } from '../../layout.js';

// The Philadelphia police's motor officers at the last out (Getty 83486531: white helmets, black leather
// jackets, black breeches with the blue stripe, tall boots, a white Harley on the warning track in right;
// pompomflipflop 2986308010: one parked by the FOX panel in left, its red and blue lights going;
// ronniebruce 2987488477 and 2988346978: one leading the players' lap with the flag). Six of them ride
// in along the warning track from the center field gate as the pile forms, park at intervals round the
// outfield, and stand in front of their bikes facing the stands; later the first two lead the lap (Laps).
//
// The bikes: one instanced mesh (a white fairing and tank, the saddlebags, the black seat, chrome, the
// light bar with its red and blue lamps flashing), the officers Cast figures.

const N = 6;
const hash = ( n ) => {

	const s = Math.sin( n * 12.9898 ) * 43758.5453;
	return s - Math.floor( s );

};
const ease = ( x ) => {

	const t = Math.min( 1, Math.max( 0, x ) );
	return t * t * ( 3 - 2 * t );

};

// the fence's distance (m) at an angle from the center field line (layout's OUTFIELD, the front of the wall)
function fenceAt( deg ) {

	const O = OUTFIELD;
	for ( let i = 0; i < O.length - 1; i ++ ) if ( deg >= O[ i ][ 0 ] && deg <= O[ i + 1 ][ 0 ] && O[ i + 1 ][ 0 ] > O[ i ][ 0 ] ) {

		const k = ( deg - O[ i ][ 0 ] ) / ( O[ i + 1 ][ 0 ] - O[ i ][ 0 ] );
		return ( O[ i ][ 1 ] + ( O[ i + 1 ][ 1 ] - O[ i ][ 1 ] ) * k ) * FT;

	}

	return 330 * FT;

}

// a point on the warning track at an angle (deg), `in` metres in from the wall
export function trackPoint( deg, inset = 3.2 ) {

	const d = fenceAt( deg ) - inset, a = deg * Math.PI / 180;
	return [ Math.sin( a ) * d, - Math.cos( a ) * d ];

}

// where each parks (the angle round the outfield) and when he rides in (s after the last out)
export const MOTORS = [ - 38, - 24, - 12, 12, 24, 38 ].map( ( deg, i ) => ( { deg, t0: 4 + Math.abs( 3 - i ) * 1.4 + hash( i ) * 1.2 } ) );
const GATE_DEG = 2;

// along the track from the gate to his angle, at t seconds since he set off: [ x, z, yaw, speed ]
function ride( m, t ) {

	const T = Math.abs( m.deg - GATE_DEG ) * 0.24 + 1.5;
	const k = ease( t / T );
	const deg = GATE_DEG + ( m.deg - GATE_DEG ) * k;
	const [ x, z ] = trackPoint( deg, 2.6 );
	const [ x2, z2 ] = trackPoint( deg + Math.sign( m.deg - GATE_DEG ) * 0.5, 2.6 );
	const moving = k < 1;
	// parked: turned to face the infield
	const yaw = moving ? Math.atan2( - ( x2 - x ), - ( z2 - z ) ) : Math.atan2( x, z );
	return { x, z, yaw, moving, k };

}

export class Motors {

	constructor( group ) {

		this.bikes = new InstancedMesh( bikeGeometry(), bikeMaterial(), N );
		this.bikes.name = 'motor-bikes';
		this.bikes.castShadow = true;
		this.bikes.receiveShadow = true;
		this.bikes.frustumCulled = false;
		this.bikes.visible = false;
		this.bikes.userData.dynamic = true;
		group.add( this.bikes );
		this.cast = new Cast( { parent: group, max: N } );
		this.men = [];
		this.arms = { ride: [ armIK( - 1, [ - 0.3, 1.05, - 0.5 ] ), armIK( 1, [ 0.3, 1.05, - 0.5 ] ) ], stand: [ [ 0.05, 0.25, 0.1, 0.35 ], [ 0.05, 0.25, 0.1, 0.35 ] ], hips: [ [ - 0.2, 0.55, - 0.2, 1.4 ], [ - 0.2, 0.55, - 0.2, 1.4 ] ] };
		for ( let i = 0; i < N; i ++ ) {

			const p = this.cast.add( {
				skin: [ 0, 1, 2, 4, 1, 3 ][ i ], hair: [ 1, 0, 2, 1, 6, 0 ][ i ], hairStyle: 0, facial: [ 0, 1, 0, 4, 0, 1 ][ i ], glasses: i === 4, female: false, age: 0, build: [ 2, 1, 3, 2, 1, 2 ][ i ],
				top: TOP.leather, color: COLOR.black, sleeves: COLOR.black, back: 0, chest: 0, pants: 3, shoes: 1, hat: HAT.motor, poncho: 0, scarf: 0, gloves: true, badge: true, seed: 900 + i * 37,
			} );
			if ( ! p ) break;
			p.visible = false;
			p.pose = restPose();
			this.men.push( p );

		}

		this._m = new Matrix4();
		this._was = false;

	}

	// cel: seconds since the last out (null otherwise); lap: an override for the leaders (Laps)
	update( cel, lap = null ) {

		const on = cel != null && cel > 3;
		if ( ! on && ! this._was ) return;
		this._was = on;
		this.bikes.visible = on;
		const q = new Quaternion(), s = new Vector3( 1, 1, 1 ), v = new Vector3();
		MOTORS.forEach( ( m, i ) => {

			const p = this.men[ i ];
			if ( ! on || cel < m.t0 ) {

				this._m.makeScale( 0, 0, 0 );
				this.bikes.setMatrixAt( i, this._m );
				if ( p ) p.visible = false;
				return;

			}

			let r = ride( m, cel - m.t0 );
			if ( lap && lap[ i ] ) r = lap[ i ];
			q.setFromEuler( new Euler( 0, r.yaw, 0 ) );
			this._m.compose( v.set( r.x, 0, r.z ), q, s );
			this.bikes.setMatrixAt( i, this._m );
			if ( ! p ) return;
			const P = p.pose;
			if ( r.moving ) {

				// astride it, his hands on the grips
				seat( P, 0.72 );
				P.armL = this.arms.ride[ 0 ];
				P.armR = this.arms.ride[ 1 ];
				P.lean = 0.12;
				p.x = r.x; p.z = r.z; p.y = 0; p.yaw = r.yaw;

			} else {

				// off it, standing in front of it facing the stands, hands on his belt
				const f = [ Math.sin( r.yaw ), Math.cos( r.yaw ) ];
				Object.assign( P, restPose() );
				P.armL = this.arms.hips[ 0 ];
				P.armR = this.arms.hips[ 1 ];
				P.headYaw = 0.5 * Math.sin( cel * 0.2 + i * 1.7 );
				P.breath = ( cel * 0.25 + i * 0.3 ) % 1;
				p.x = r.x - f[ 0 ] * 1.6; p.z = r.z - f[ 1 ] * 1.6; p.y = 0; p.yaw = r.yaw + Math.PI;

			}

			if ( ! p.visible ) p.fresh = true;
			p.visible = true;

		} );
		this.bikes.instanceMatrix.needsUpdate = true;
		this.cast.update();
		this.bikes.material.uniforms.flash.value = cel ?? 0;

	}

}

// ---------------------------------------------------------------- the bike

// parts (the vertex's `aPart`): 0 white paint, 1 black, 2 chrome, 3 tyre, 4 red lamp, 5 blue lamp, 6 the
// windscreen, 7 the headlamp
function bikeGeometry() {

	const pos = [], nrm = [], part = [], index = [];
	const box = ( c, h, pt, rx = 0 ) => {

		const cr = Math.cos( rx ), sr = Math.sin( rx );
		const R = ( p ) => [ p[ 0 ], p[ 1 ] * cr - p[ 2 ] * sr, p[ 1 ] * sr + p[ 2 ] * cr ];
		const faces = [ [ 0, 0, 1 ], [ 0, 0, - 1 ], [ 1, 0, 0 ], [ - 1, 0, 0 ], [ 0, 1, 0 ], [ 0, - 1, 0 ] ];
		for ( const n of faces ) {

			const u = n[ 1 ] !== 0 ? [ 1, 0, 0 ] : [ 0, 1, 0 ], w = [ n[ 1 ] * u[ 2 ] - n[ 2 ] * u[ 1 ], n[ 2 ] * u[ 0 ] - n[ 0 ] * u[ 2 ], n[ 0 ] * u[ 1 ] - n[ 1 ] * u[ 0 ] ];
			const b = pos.length / 3;
			for ( const [ a, bb ] of [ [ - 1, - 1 ], [ 1, - 1 ], [ 1, 1 ], [ - 1, 1 ] ] ) {

				const p = R( [ ( n[ 0 ] + u[ 0 ] * a + w[ 0 ] * bb ) * h[ 0 ], ( n[ 1 ] + u[ 1 ] * a + w[ 1 ] * bb ) * h[ 1 ], ( n[ 2 ] + u[ 2 ] * a + w[ 2 ] * bb ) * h[ 2 ] ] );
				pos.push( c[ 0 ] + p[ 0 ], c[ 1 ] + p[ 1 ], c[ 2 ] + p[ 2 ] );
				const nn = R( n );
				nrm.push( ...nn );
				part.push( pt );

			}

			index.push( b, b + 1, b + 2, b, b + 2, b + 3 );

		}

	};
	const wheel = ( z ) => {

		// a tyre (a ring of boxes round the axle) and its spoked chrome hub
		const R = 0.33, n = 16;
		for ( let k = 0; k < n; k ++ ) {

			const a = k / n * Math.PI * 2;
			box( [ 0, 0.33 + Math.cos( a ) * R, z + Math.sin( a ) * R ], [ 0.065, 0.07, 0.075 ], 3, - a );

		}

		box( [ 0, 0.33, z ], [ 0.05, 0.2, 0.2 ], 2 );

	};
	wheel( - 0.78 );
	wheel( 0.78 );
	// the frame and the engine, the tank, the seat, the saddlebags, the fairing and its windscreen
	box( [ 0, 0.52, 0.05 ], [ 0.16, 0.16, 0.36 ], 2 );
	box( [ 0, 0.8, - 0.2 ], [ 0.17, 0.1, 0.28 ], 0 );
	box( [ 0, 0.8, 0.28 ], [ 0.19, 0.06, 0.3 ], 1 );
	for ( const x of [ - 0.26, 0.26 ] ) box( [ x, 0.6, 0.62 ], [ 0.09, 0.14, 0.26 ], 0 );
	box( [ 0, 0.62, 0.9 ], [ 0.2, 0.06, 0.12 ], 1 );
	box( [ 0, 0.92, - 0.62 ], [ 0.36, 0.2, 0.12 ], 0, 0.35 );
	box( [ 0, 1.2, - 0.58 ], [ 0.3, 0.12, 0.01 ], 6, 0.45 );
	box( [ 0, 0.82, - 0.76 ], [ 0.09, 0.07, 0.02 ], 7 );
	// the handlebars, the forks, the fender
	box( [ 0, 1.02, - 0.45 ], [ 0.36, 0.015, 0.015 ], 2 );
	for ( const x of [ - 0.1, 0.1 ] ) box( [ x, 0.6, - 0.66 ], [ 0.02, 0.3, 0.02 ], 2, - 0.45 );
	box( [ 0, 0.62, - 0.8 ], [ 0.1, 0.03, 0.2 ], 0, 0.3 );
	// the light bar at the back on its pole: red and blue
	box( [ 0, 1.15, 0.9 ], [ 0.012, 0.3, 0.012 ], 2 );
	box( [ - 0.09, 1.46, 0.9 ], [ 0.07, 0.03, 0.03 ], 4 );
	box( [ 0.09, 1.46, 0.9 ], [ 0.07, 0.03, 0.03 ], 5 );
	const g = new BufferGeometry();
	g.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
	g.setAttribute( 'normal', new Float32BufferAttribute( nrm, 3 ) );
	g.setAttribute( 'aPart', new Float32BufferAttribute( part, 1 ) );
	g.setIndex( index );
	g.computeBoundingSphere();
	return g;

}

function bikeMaterial() {

	const m = standard( { name: 'motor-bike', color: new Color( 0.8, 0.8, 0.78 ), roughness: 0.25,
		uniforms: { flash: [ 'f32', 0 ] }, attributes: { aPart: 'f32' }, varyings: { vPart: 'f32' },
		vertex: 'o.vPart = v.aPart;',
		surface: /* wgsl */`
	let pt = u32( in.vs.vPart + 0.5 );
	var c = mat.color;
	var rough = 0.22;
	var metal = 0.0;
	var e = vec3f( 0.0 );
	if ( pt == 1u ) { c = vec3f( 0.012 ); rough = 0.5; }
	if ( pt == 2u ) { c = vec3f( 0.6, 0.6, 0.62 ); metal = 1.0; rough = 0.2; }
	if ( pt == 3u ) { c = vec3f( 0.02 ); rough = 0.85; }
	// the lamps: red and blue in turn, a quick double flash
	let ph = fract( mat.flash * 1.6 );
	let on = step( ph, 0.12 ) + step( 0.24, ph ) * step( ph, 0.36 );
	if ( pt == 4u ) { c = vec3f( 0.3, 0.01, 0.01 ); e = vec3f( 25.0, 0.4, 0.2 ) * on; }
	if ( pt == 5u ) { c = vec3f( 0.01, 0.02, 0.3 ); e = vec3f( 0.3, 1.0, 30.0 ) * ( 1.0 - on ) * step( 0.5, fract( mat.flash * 1.6 + 0.5 ) ); }
	if ( pt == 6u ) { c = vec3f( 0.05, 0.06, 0.07 ); rough = 0.05; metal = 0.2; }
	if ( pt == 7u ) { c = vec3f( 0.9 ); e = vec3f( 6.0, 5.6, 4.8 ); }
	s.albedo = c;
	s.roughness = rough;
	s.metalness = metal;
	s.emissive = e + c * smoothstep( 0.2, 0.8, frame.night ) * 0.25;
` } );
	m.underwaterLighting = 'none';
	return m;

}
