import { InstancedMesh, Matrix4, Quaternion, Vector3, Color } from '../../../engine/index.js';
import { Builder, paletteMaterial } from './Build.js';

// What the vendors carry up and down the aisles (drawn with the place's palette; one instanced draw, each
// instance one vendor's gear, the others' folded away by the tag):
//   1 beer: a steel tray bin at the waist on a strap over the shoulder, brown bottles standing in the ice,
//     a sleeve of clear plastic cups up its side
//   2 hot dogs: the insulated box, red with a white band, the lid on a hinge, foil-wrapped dogs inside
//   3 hot chocolate (the 27th): a white cooler with the insulated tank and a stack of cups with black lids
//   4 peanuts: a canvas sack at the hip, the bags standing up out of it
//   5 cotton candy: the pole held upright with its bags round the top, pink and blue
//   6 a bag of peanuts in the air (thrown)
//   7 the Diamond Club server's tray (carried at the shoulder)
//   8 the foul ball
// In the vendor's own frame (facing -z, the feet at the origin; scaled with him).
export const GEAR = { none: 0, beer: 1, hotdogs: 2, cocoa: 3, peanuts: 4, cotton: 5, bag: 6, serverTray: 7, ball: 8 };

function gearGeometry() {

	const b = new Builder();
	const P = Builder.frame( [ 0, 0, 0 ], [ 1, 0 ], [ 0, 1 ] );
	const strap = ( x0, y0, z0, x1, y1, z1 ) => {

		// a flat strap: a thin quad strip
		b.use( 'strap' ).quad( [ x0 - 0.02, y0, z0 ], [ x0 + 0.02, y0, z0 ], [ x1 + 0.02, y1, z1 ], [ x1 - 0.02, y1, z1 ], [ 0, 0, 1 ] );
		b.use( 'strap' ).quad( [ x0 + 0.02, y0, z0 ], [ x0 - 0.02, y0, z0 ], [ x1 - 0.02, y1, z1 ], [ x1 + 0.02, y1, z1 ], [ 0, 0, - 1 ] );

	};
	// 1 beer
	b.tagWith( GEAR.beer );
	b.use( 'steel' ).box( P, 0, 0.93, - 0.26, 0.46, 0.14, 0.26 );
	b.use( 'ice' ).box( P, 0, 1.0, - 0.26, 0.42, 0.01, 0.22 );
	for ( let i = 0; i < 8; i ++ ) {

		const x = - 0.16 + ( i % 4 ) * 0.1, z = - 0.32 + Math.floor( i / 4 ) * 0.11;
		b.use( 'bottleBrown' ).cyl( P, x, z, 0.94, 1.12, 0.03, 0.03, 6, false );
		b.use( 'bottleBrown' ).cyl( P, x, z, 1.12, 1.18, 0.03, 0.012, 6, false );
		b.use( 'label' ).cyl( P, x, z, 1.0, 1.06, 0.031, 0.031, 6, false );

	}

	b.use( 'water' ).cyl( P, 0.27, - 0.26, 0.9, 1.28, 0.045, 0.045, 8 );
	strap( - 0.2, 1.0, - 0.14, 0.06, 1.42, 0.06 );
	// 2 hot dogs
	b.tagWith( GEAR.hotdogs );
	b.use( 'red' ).box( P, 0, 0.96, - 0.27, 0.46, 0.24, 0.28 );
	b.use( 'white' ).box( P, 0, 0.99, - 0.27, 0.47, 0.06, 0.29 );
	b.use( 'red' ).box( P, 0, 1.09, - 0.27, 0.47, 0.02, 0.29 );
	b.use( 'foil' ).box( P, 0.26, 1.1, - 0.27, 0.05, 0.03, 0.18 );
	strap( - 0.2, 1.05, - 0.14, 0.06, 1.42, 0.06 );
	// 3 hot chocolate
	b.tagWith( GEAR.cocoa );
	b.use( 'cooler' ).box( P, 0, 0.95, - 0.27, 0.44, 0.2, 0.28 );
	b.use( 'steel' ).cyl( P, - 0.1, - 0.27, 1.05, 1.32, 0.09, 0.09, 10 );
	b.use( 'black' ).cyl( P, - 0.1, - 0.27, 1.32, 1.35, 0.03, 0.03, 6 );
	for ( let i = 0; i < 4; i ++ ) {

		b.use( 'cupWhite' ).cyl( P, 0.1 + ( i % 2 ) * 0.09, - 0.32 + Math.floor( i / 2 ) * 0.1, 1.05, 1.15, 0.03, 0.04, 8, false );
		b.use( 'lid' ).cyl( P, 0.1 + ( i % 2 ) * 0.09, - 0.32 + Math.floor( i / 2 ) * 0.1, 1.15, 1.165, 0.041, 0.036, 8 );

	}

	strap( - 0.2, 1.02, - 0.14, 0.06, 1.42, 0.06 );
	// 4 peanuts: the sack at the right hip
	b.tagWith( GEAR.peanuts );
	b.use( 'white' ).cyl( P, 0.27, 0.0, 0.72, 1.02, 0.12, 0.14, 8, false );
	for ( let i = 0; i < 7; i ++ ) b.use( 'kraft' ).box( P, 0.22 + ( i % 3 ) * 0.05, 1.07, - 0.06 + Math.floor( i / 3 ) * 0.06, 0.06, 0.16, 0.035 );
	strap( 0.2, 1.02, 0.02, - 0.08, 1.43, 0.04 );
	// 5 cotton candy: the pole in the left hand (at the hip), the bags round its top
	b.tagWith( GEAR.cotton );
	b.use( 'steel' ).cyl( P, - 0.24, - 0.12, 0.72, 2.25, 0.012, 0.012, 6 );
	for ( let i = 0; i < 12; i ++ ) {

		const a = i / 6 * Math.PI * 2, y = 1.7 + Math.floor( i / 6 ) * 0.28;
		b.use( i % 3 === 1 ? 'blue' : 'pink' ).blob( P, - 0.24 + Math.cos( a ) * 0.13, y, - 0.12 + Math.sin( a ) * 0.13, 0.08, 0.12, 0.08, 6, 4 );

	}

	// 6 a bag of peanuts in flight (its own origin)
	b.tagWith( GEAR.bag );
	b.use( 'kraft' ).box( P, 0, 0, 0, 0.1, 0.16, 0.05 );
	// 7 the server's tray: round, at the shoulder, two beers and a cheesesteak
	b.tagWith( GEAR.serverTray );
	b.use( 'black' ).cyl( P, 0.32, - 0.08, 1.52, 1.54, 0.2, 0.2, 12 );
	b.use( 'beer' ).cyl( P, 0.25, - 0.04, 1.54, 1.68, 0.034, 0.045, 8 );
	b.use( 'beer' ).cyl( P, 0.36, - 0.16, 1.54, 1.68, 0.034, 0.045, 8 );
	b.use( 'foil' ).box( P, 0.4, 1.57, 0.0, 0.08, 0.06, 0.2 );
	// 8 the ball
	b.tagWith( GEAR.ball );
	b.use( 'ball' ).blob( P, 0, 0, 0, 0.037, 0.037, 0.037, 10, 6 );
	return b.geometry();

}

export class Gear {

	constructor( parent, max = 12 ) {

		this.max = max;
		const mat = paletteMaterial( 'home-gear', {
			attributes: { aTag: 'f32' },
			vertex: '	if ( abs( v.aTag - v.color.r ) > 0.5 ) { v.position = vec3f( 0.0 ); }',
		} );
		this.material = mat;
		this.mesh = new InstancedMesh( gearGeometry(), mat, max );
		this.mesh.name = 'home-gear';
		this.mesh.frustumCulled = false;
		this.mesh.castShadow = false;
		this.mesh.userData.dynamic = true;
		const c = new Color( 0, 0, 0 );
		for ( let i = 0; i < max; i ++ ) this.mesh.setColorAt( i, c );
		this.mesh.count = 0;
		parent.add( this.mesh );
		this.items = [];
		this._m = new Matrix4(); this._q = new Quaternion(); this._v = new Vector3(); this._s = new Vector3(); this._c = new Color(); this._up = new Vector3( 0, 1, 0 );

	}

	// this frame: gear `type` at ( x, y, z ) turned yaw, scaled
	put( type, x, y, z, yaw = 0, scale = 1, spin = 0 ) {

		if ( this.items.length < this.max ) this.items.push( [ type, x, y, z, yaw, scale, spin ] );

	}

	update() {

		let n = 0;
		for ( const [ type, x, y, z, yaw, scale, spin ] of this.items ) {

			this._q.setFromAxisAngle( this._up, yaw );
			if ( spin ) this._q.multiply( new Quaternion().setFromAxisAngle( this._v.set( 1, 0, 0 ), spin ) );
			this._m.compose( this._v.set( x, y, z ), this._q, this._s.setScalar( scale ) );
			this.mesh.setMatrixAt( n, this._m );
			this.mesh.setColorAt( n, this._c.setRGB( type, 0, 0 ) );
			n ++;

		}

		this.mesh.count = n;
		this.mesh.instanceMatrix.needsUpdate = true;
		if ( this.mesh.instanceColor ) this.mesh.instanceColor.needsUpdate = true;
		this.items.length = 0;

	}

}
