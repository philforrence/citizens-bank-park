import { InstancedMesh, Matrix4, Quaternion, Vector3, Color, Sphere } from '../../../engine/index.js';
import { StorageBuffer } from '../../../engine/gpu/Texture.js';
import { commonModule } from '../../../engine/render/wgsl/common.js';
import { standard } from '../../../materials/Materials.js';
import { LEVELS } from '../../layout.js';
import { G } from '../../../engine/render/Frame.js';
import { LOTS } from '../../data/complex.js';
import { Mesher, rng } from './Mesher.js';
import { pattisonZ, eleventhX } from './Street.js';
import { signal } from './Signals.js';

// The cars of 2008: sedans, SUVs, pickups, minivans in the lots across Pattison and 11th, filled on a
// sold-out night (they were empty in round 1), and on the streets: cars circling for a space and
// dropping off, the odd cab, a police cruiser, the yellow school bus that brought a church group down
// (Flickr roadieshow, 27 Oct 2008: a school bus on Pattison in the rain at the gate), all stopping for the
// signals (Signals.js), their headlights and taillights on, the brake lights flaring at the stop bar, the
// lights streaking on the wet road.
//
// A vehicle is built of parts told apart by uv.x (0 paint, 1 glass, 2 tyre, 3 headlight, 4 taillight,
// 5 black trim, 6 chrome, 7 light bar); each type is one instanced mesh, the paint per instance.

const STREET = LEVELS.mainConcourse;
const TYPES = [ 'sedan', 'suv', 'pickup', 'van', 'bus', 'police' ];

// ---------------------------------------------------------------- the bodies

function body( type ) {

	const m = new Mesher();
	const part = ( k ) => [ k + 0.5, 0.5 ];
	// a box with bevelled top edges, the part's uv on every vertex; faces -z (the front) at the origin
	const slab = ( x0, x1, y0, y1, z0, z1, k, bevel = 0 ) => {

		const b = bevel;
		const P = [
			[ x0, y0, z0 ], [ x1, y0, z0 ], [ x1, y1 - b, z0 ], [ x0, y1 - b, z0 ], [ x0 + b, y1, z0 + b ], [ x1 - b, y1, z0 + b ],
			[ x0, y0, z1 ], [ x1, y0, z1 ], [ x1, y1 - b, z1 ], [ x0, y1 - b, z1 ], [ x0 + b, y1, z1 - b ], [ x1 - b, y1, z1 - b ],
		];
		const f = ( a, bb, c, d, n ) => m.face( P[ a ], P[ bb ], P[ c ], P[ d ], n, [ part( k ), part( k ), part( k ), part( k ) ] );
		f( 1, 0, 3, 2, [ 0, 0, - 1 ] ); f( 6, 7, 8, 9, [ 0, 0, 1 ] ); f( 0, 6, 9, 3, [ - 1, 0, 0 ] ); f( 7, 1, 2, 8, [ 1, 0, 0 ] );
		f( 4, 5, 11, 10, [ 0, 1, 0 ] );
		if ( b > 0 ) { f( 3, 9, 10, 4, [ - 1, 1, 0 ] ); f( 8, 2, 5, 11, [ 1, 1, 0 ] ); f( 2, 3, 4, 5, [ 0, 1, - 1 ] ); f( 9, 8, 11, 10, [ 0, 1, 1 ] ); }

	};

	// the greenhouse: a tapered cabin, the glass on its sides, front and back
	const cabin = ( x, y0, y1, zf0, zf1, zr1, zr0 ) => {

		// zf0: the windshield's foot, zf1 its top; zr1 the rear glass's top, zr0 its foot
		const w0 = x, w1 = x * 0.86;
		const A = [ - w0, y0, zf0 ], B = [ w0, y0, zf0 ], C = [ w1, y1, zf1 ], D = [ - w1, y1, zf1 ];
		const E = [ - w0, y0, zr0 ], F = [ w0, y0, zr0 ], Gg = [ w1, y1, zr1 ], H = [ - w1, y1, zr1 ];
		const g = part( 1 ), p = part( 0 );
		m.face( A, B, C, D, [ 0, 0.6, - 1 ], [ g, g, g, g ] );
		m.face( F, E, H, Gg, [ 0, 0.6, 1 ], [ g, g, g, g ] );
		m.face( E, A, D, H, [ - 1, 0.2, 0 ], [ g, g, g, g ] );
		m.face( B, F, Gg, C, [ 1, 0.2, 0 ], [ g, g, g, g ] );
		m.face( D, C, Gg, H, [ 0, 1, 0 ], [ p, p, p, p ] );
		// the pillars: thin paint strips down the glass's edges
		for ( const s of [ - 1, 1 ] ) {

			const t0 = [ s * w0 * 1.005, y0, zf0 ], t1 = [ s * w1 * 1.005, y1, zf1 ];
			m.face( t0, [ t0[ 0 ], y0, zf0 + 0.08 ], [ t1[ 0 ], y1, zf1 + 0.06 ], t1, [ s, 0.2, 0 ], [ p, p, p, p ] );
			const b0 = [ s * w0 * 1.005, y0, zr0 ], b1 = [ s * w1 * 1.005, y1, zr1 ];
			m.face( [ b0[ 0 ], y0, zr0 - 0.12 ], b0, b1, [ b1[ 0 ], y1, zr1 - 0.1 ], [ s, 0.2, 0 ], [ p, p, p, p ] );

		}

	};

	const wheel = ( x, z, r, w ) => {

		// 7 sides, capped on the outside only (a parked lot's worth of wheels adds up)
		const out = x > 0;
		const n0 = m.count;
		m.tube( [ [ x - w / 2, r, z ], [ x + w / 2, r, z ] ], [ r, r ], 7, { capA: ! out, capB: out, ex: {} } );
		const n = m.count;
		for ( let i = n0; i < n; i ++ ) { m.uv[ i * 2 ] = 2.5; m.uv[ i * 2 + 1 ] = 0.5; }

	};

	const lamps = ( w, y, zf, zr, hw = 0.2, hh = 0.1 ) => {

		for ( const s of [ - 1, 1 ] ) {

			m.face( [ s * ( w - hw ), y - hh, zf - 0.005 ], [ s * w, y - hh, zf - 0.005 ], [ s * w, y + hh, zf - 0.005 ], [ s * ( w - hw ), y + hh, zf - 0.005 ], [ 0, 0, - 1 ], [ part( 3 ), part( 3 ), part( 3 ), part( 3 ) ] );
			m.face( [ s * w, y - hh, zr + 0.005 ], [ s * ( w - hw ), y - hh, zr + 0.005 ], [ s * ( w - hw ), y + hh, zr + 0.005 ], [ s * w, y + hh, zr + 0.005 ], [ 0, 0, 1 ], [ part( 4 ), part( 4 ), part( 4 ), part( 4 ) ] );

		}

	};

	// the dark under the car: a soft-edged patch on the ground (its shadow, without the shadow pass)
	const L = type === 'bus' ? 6.3 : type === 'pickup' ? 2.9 : 2.7, W = type === 'bus' ? 1.3 : 1.05;
	m.face( [ - W, 0.015, - L ], [ W, 0.015, - L ], [ W, 0.015, L ], [ - W, 0.015, L ], [ 0, 1, 0 ], [ part( 8 ), part( 8 ), part( 8 ), part( 8 ) ] );
	if ( type === 'sedan' || type === 'police' ) {

		// a Crown Victoria / Camry: 5.2 m, low hood and trunk
		slab( - 0.93, 0.93, 0.3, 0.95, - 2.6, 2.6, 0, 0.12 );
		cabin( 0.86, 0.95, 1.42, - 0.95, - 0.2, 0.9, 1.45 );
		slab( - 0.95, 0.95, 0.25, 0.45, - 2.66, - 2.5, 6 );
		slab( - 0.95, 0.95, 0.25, 0.45, 2.5, 2.66, 6 );
		lamps( 0.9, 0.75, - 2.6, 2.6 );
		for ( const [ x, z ] of [ [ - 0.78, - 1.6 ], [ 0.78, - 1.6 ], [ - 0.78, 1.55 ], [ 0.78, 1.55 ] ] ) wheel( x, z, 0.34, 0.24 );
		if ( type === 'police' ) {

			// the light bar across the roof
			slab( - 0.62, 0.62, 1.42, 1.54, - 0.12, 0.12, 7 );

		}

	} else if ( type === 'suv' ) {

		slab( - 0.98, 0.98, 0.42, 1.12, - 2.45, 2.45, 0, 0.1 );
		cabin( 0.94, 1.12, 1.82, - 1.1, - 0.55, 2.35, 2.42 );
		lamps( 0.95, 0.95, - 2.45, 2.45, 0.22, 0.12 );
		for ( const [ x, z ] of [ [ - 0.82, - 1.5 ], [ 0.82, - 1.5 ], [ - 0.82, 1.5 ], [ 0.82, 1.5 ] ] ) wheel( x, z, 0.4, 0.28 );

	} else if ( type === 'pickup' ) {

		slab( - 0.98, 0.98, 0.45, 1.12, - 2.8, - 0.35, 0, 0.1 );
		cabin( 0.94, 1.12, 1.85, - 1.25, - 0.7, 0.35, 0.35 );
		// the bed: walls round an open box
		slab( - 0.98, 0.98, 0.45, 0.7, - 0.35, 2.75, 5 );
		for ( const s of [ - 1, 1 ] ) slab( s * 0.98 - ( s > 0 ? 0.08 : 0 ), s * 0.98 + ( s > 0 ? 0 : 0.08 ), 0.7, 1.15, - 0.35, 2.75, 0 );
		slab( - 0.98, 0.98, 0.7, 1.15, 2.67, 2.75, 0 );
		lamps( 0.95, 0.9, - 2.8, 2.75, 0.22, 0.14 );
		for ( const [ x, z ] of [ [ - 0.83, - 1.9 ], [ 0.83, - 1.9 ], [ - 0.83, 1.7 ], [ 0.83, 1.7 ] ] ) wheel( x, z, 0.4, 0.28 );

	} else if ( type === 'van' ) {

		slab( - 0.98, 0.98, 0.35, 1.05, - 2.55, 2.55, 0, 0.1 );
		cabin( 0.95, 1.05, 1.75, - 1.55, - 0.7, 2.4, 2.5 );
		lamps( 0.94, 0.85, - 2.55, 2.55 );
		for ( const [ x, z ] of [ [ - 0.82, - 1.55 ], [ 0.82, - 1.55 ], [ - 0.82, 1.6 ], [ 0.82, 1.6 ] ] ) wheel( x, z, 0.36, 0.25 );

	} else if ( type === 'bus' ) {

		// a school bus: the long box, the hood out front, the windows down its sides, the black rub rails
		slab( - 1.22, 1.22, 0.55, 3.0, - 4.8, 5.4, 0, 0.18 );
		slab( - 1.0, 1.0, 0.55, 1.55, - 6.2, - 4.8, 0, 0.1 );
		for ( const s of [ - 1, 1 ] ) {

			m.face( [ s * 1.225, 1.8, - 4.3 ], [ s * 1.225, 1.8, 5.0 ], [ s * 1.225, 2.55, 5.0 ], [ s * 1.225, 2.55, - 4.3 ], [ s, 0, 0 ], [ part( 1 ), part( 1 ), part( 1 ), part( 1 ) ] );
			for ( const y of [ 1.0, 1.45 ] ) m.face( [ s * 1.23, y, - 4.8 ], [ s * 1.23, y, 5.4 ], [ s * 1.23, y + 0.07, 5.4 ], [ s * 1.23, y + 0.07, - 4.8 ], [ s, 0, 0 ], [ part( 5 ), part( 5 ), part( 5 ), part( 5 ) ] );

		}

		m.face( [ - 1.1, 1.75, - 4.81 ], [ 1.1, 1.75, - 4.81 ], [ 1.1, 2.6, - 4.81 ], [ - 1.1, 2.6, - 4.81 ], [ 0, 0, - 1 ], [ part( 1 ), part( 1 ), part( 1 ), part( 1 ) ] );
		lamps( 0.95, 1.05, - 6.2, 5.4, 0.2, 0.12 );
		for ( const [ x, z ] of [ [ - 1.05, - 4.3 ], [ 1.05, - 4.3 ], [ - 1.05, 3.4 ], [ 1.05, 3.4 ] ] ) wheel( x, z, 0.52, 0.32 );

	}

	return m.geometry();

}

function carMaterial( info ) {

	const mat = standard( {
		name: 'w1-cars', roughness: 0.3, modules: [ commonModule ],
		storage: { carInfo: info },
		varyings: { vCar: 'vec4f', vPart: 'f32', vLoc: 'vec3f' },
		vertex: /* wgsl */`
	o.vCar = carInfo[ v.instance ];
	o.vPart = v.uv.x;
	o.vLoc = v.position;
`,
		surface: /* wgsl */`
	// info: x headlights on, y braking, z the bar flashing (police), w 1 for a parked car (dry under it)
	let inf = in.vs.vCar;
	let part = i32( floor( in.vs.vPart ) );
	let paint = s.albedo;
	var c = paint;
	var rough = 0.28; var metal = 0.3; var e = vec3f( 0.0 );
	let night = smoothstep( 0.1, 0.7, frame.night );
	switch part {
		case 1: { c = vec3f( 0.02, 0.025, 0.03 ); rough = 0.04; metal = 0.1; }
		case 2: { c = vec3f( 0.015 ); rough = 0.8; metal = 0.0; }
		case 3: { c = vec3f( 0.7, 0.7, 0.65 ); rough = 0.1; e = vec3f( 1.0, 0.95, 0.85 ) * inf.x * mix( 0.8, 12.0, night ); }
		case 4: { c = vec3f( 0.3, 0.01, 0.01 ); rough = 0.2; e = vec3f( 1.0, 0.02, 0.01 ) * ( inf.x * mix( 0.2, 1.5, night ) + inf.y * mix( 2.0, 8.0, night ) ); }
		case 5: { c = vec3f( 0.02 ); rough = 0.6; metal = 0.0; }
		case 6: { c = vec3f( 0.5 ); rough = 0.2; metal = 0.9; }
		case 8: { c = vec3f( 0.004 ); rough = 1.0; metal = 0.0; }
		case 7: {
			// the light bar: red one end, blue the other, turning
			let side = step( 0.0, in.vs.vLoc.x );
			let ph = fract( frame.time * 1.6 + side * 0.5 );
			c = select( vec3f( 0.3, 0.0, 0.0 ), vec3f( 0.0, 0.0, 0.3 ), side > 0.5 );
			e = select( vec3f( 1.0, 0.03, 0.02 ), vec3f( 0.05, 0.15, 1.0 ), side > 0.5 ) * step( ph, 0.35 ) * inf.z * 18.0;
		}
		default: {
			// the paint: clearcoat-bright, a little road grime low down; police white with a blue stripe
			if ( inf.w > 1.5 ) {
				c = vec3f( 0.8, 0.8, 0.78 );
				if ( abs( in.vs.vLoc.y - 0.72 ) < 0.07 ) { c = vec3f( 0.02, 0.06, 0.35 ); }
			}
			if ( inf.w > 2.5 ) { c = vec3f( 0.72, 0.5, 0.02 ); }
			c = c * mix( 0.7, 1.0, smoothstep( 0.3, 0.7, in.vs.vLoc.y ) );
		}
	}
	// the rain beads on the paint and the glass
	rough = mix( rough, rough * 0.4, frame.wet );
	s.albedo = c;
	s.roughness = rough;
	s.metalness = metal;
	s.emissive = e;
`,
	} );
	mat.setDefine( 'DRY', 1 );
	mat.underwaterLighting = 'none';
	return mat;

}

// ---------------------------------------------------------------- the traffic

// the lanes: a line along which cars run, the signal they obey and where they stop for it
function lanes() {

	const zc = pattisonZ;
	const L = [];
	// Pattison eastbound (+x) in the south half, westbound (-x) in the north (the curb lane there is taken
	// by the FOX truck by the plaza: the inner lane only); 11th both ways
	for ( const o of [ 2.3, 6.6 ] ) L.push( { dir: [ 1, 0 ], at: ( s ) => [ s, zc( s ) + o ], s0: - 300, s1: 40, stops: [ [ - 157, 0 ], [ - 108.3, 2 ] ] } );
	L.push( { dir: [ - 1, 0 ], at: ( s ) => [ - s, zc( - s ) - 2.3 ], s0: - 40, s1: 300, stops: [ [ 99.7, 2 ], [ 130, 0 ] ] } );
	L.push( { dir: [ 0, - 1 ], at: ( s ) => [ eleventhX( - s ) + 2.0, - s ], s0: - 260, s1: 60, stops: [ [ - 131, 1 ] ] } );
	L.push( { dir: [ 0, 1 ], at: ( s ) => [ eleventhX( s ) - 2.4, s ], s0: - 60, s1: 260, stops: [ [ 100.4, 1 ] ] } );
	return L;

}

export class Cars {

	// clear: [ [ x, z, r ], ... ] where nobody's parked (the tailgaters have the stalls)
	constructor( { group, field, clear = [] } ) {

		this.field = field;
		this.clear = clear;
		this.r = rng( 29 );
		const r = this.r;
		// the paints of 2008's cars: silver, black, white, grey, dark red, navy, a green, a gold
		const paints = [ [ 0.5, 0.51, 0.52 ], [ 0.012, 0.012, 0.014 ], [ 0.75, 0.75, 0.73 ], [ 0.2, 0.2, 0.21 ], [ 0.22, 0.02, 0.025 ], [ 0.02, 0.03, 0.09 ], [ 0.03, 0.08, 0.05 ], [ 0.35, 0.3, 0.2 ], [ 0.4, 0.4, 0.42 ] ];
		this.paint = () => paints[ Math.floor( r() * paints.length ) ];
		// parked: the lots near the plaza, 85 % full; a police cruiser at the 11th Street curb by the
		// corner, its lights going
		const parked = this._stalls();
		parked.push( { x: eleventhX( 92 ) + 4.0, z: 92, yaw: 0.02, type: 'police' } );
		// moving: a pool per lane
		this.lanes = lanes();
		const fleet = [];
		for ( const L of this.lanes ) for ( let k = 0; k < 9; k ++ ) fleet.push( { lane: L, s: 0, v: 0, on: false, type: 'sedan' } );
		// the types for the moving pool: mostly cars, a police cruiser, a school bus
		fleet.forEach( ( c, i ) => {

			const u = r();
			c.type = u < 0.45 ? 'sedan' : u < 0.7 ? 'suv' : u < 0.85 ? 'pickup' : 'van';

		} );
		fleet[ 3 ].type = 'bus';
		fleet[ 14 ].type = 'police';
		this.fleet = fleet;
		// one instanced mesh per type: the parked ones first, the moving after
		this.meshes = {};
		const info = {};
		for ( const t of TYPES ) {

			const nP = parked.filter( ( p ) => p.type === t ).length, nF = fleet.filter( ( c ) => c.type === t ).length;
			const n = Math.max( 1, nP + nF );
			info[ t ] = { buf: new StorageBuffer( { label: 'carInfo-' + t, count: n, type: 'vec4f' } ), data: new Float32Array( n * 4 ) };
			const mesh = new InstancedMesh( body( t ), carMaterial( info[ t ].buf ), n );
			mesh.name = 'w1-cars-' + t;
			mesh.castShadow = false; // (a dark patch under each instead: a lot's worth of cars in every cascade)
			mesh.receiveShadow = true;
			mesh.frustumCulled = false;
			mesh.userData.dynamic = true;
			mesh.boundingSphere = new Sphere( new Vector3( - 110, STREET, 90 ), 260 );
			mesh.count = n;
			group.add( mesh );
			this.meshes[ t ] = { mesh, info: info[ t ], n, used: 0 };

		}

		const m = new Matrix4(), q = new Quaternion(), up = new Vector3( 0, 1, 0 ), col = new Color();
		for ( const p of parked ) {

			const M = this.meshes[ p.type ];
			const i = M.used ++;
			q.setFromAxisAngle( up, p.yaw );
			m.compose( new Vector3( p.x, STREET + 0.03, p.z ), q, new Vector3( 1, 1, 1 ) );
			M.mesh.setMatrixAt( i, m );
			const c = this.paint();
			M.mesh.setColorAt( i, col.setRGB( c[ 0 ], c[ 1 ], c[ 2 ] ) );
			M.info.data.set( [ 0, 0, p.type === 'police' ? 1 : 0, p.type === 'police' ? 2 : 1 ], i * 4 );

		}

		for ( const c of fleet ) {

			const M = this.meshes[ c.type ];
			c.slot = M.used ++;
			c.mesh = M;
			const p = c.type === 'bus' ? [ 0.72, 0.5, 0.02 ] : this.paint();
			M.mesh.setColorAt( c.slot, col.setRGB( p[ 0 ], p[ 1 ], p[ 2 ] ) );

		}

		for ( const t of TYPES ) {

			const M = this.meshes[ t ];
			M.mesh.instanceColor.needsUpdate = true;
			M.info.buf.write( M.info.data );

		}

		// the lights on the wet road: a streak of each moving car's headlights ahead of it, of its
		// taillights behind (in the rain and after dark)
		const gm = new Mesher();
		gm.face( [ - 0.85, 0.02, - 2.6 ], [ 0.85, 0.02, - 2.6 ], [ 0.6, 0.02, - 12 ], [ - 0.6, 0.02, - 12 ], [ 0, 1, 0 ], [ [ 0, 0 ], [ 1, 0 ], [ 1, 1 ], [ 0, 1 ] ] );
		gm.face( [ - 0.85, 0.02, 2.6 ], [ 0.85, 0.02, 2.6 ], [ 0.6, 0.02, 8 ], [ - 0.6, 0.02, 8 ], [ 0, 1, 0 ], [ [ 2, 0 ], [ 3, 0 ], [ 3, 1 ], [ 2, 1 ] ] );
		const glareMat = standard( { name: 'w1-car-glare', transparent: true, depthWrite: false, blending: 'additive', lit: false, side: 'double',
			surface: /* wgsl */`
	let rear = in.uv.x > 1.5;
	let u = fract( in.uv.x );
	let beams = exp( - pow( ( u - 0.2 ) / 0.1, 2.0 ) ) + exp( - pow( ( u - 0.8 ) / 0.1, 2.0 ) );
	let along = pow( 1.0 - in.uv.y, 1.6 );
	let col = select( vec3f( 1.0, 0.9, 0.72 ), vec3f( 1.0, 0.06, 0.03 ), rear );
	s.albedo = vec3f( 0.0 );
	s.emissive = col * select( 2.5, 1.2, rear );
	// a reflection: seen along the road from its level, not from above
	s.alpha = beams * along * smoothstep( 0.2, 0.7, frame.wet ) * smoothstep( 0.1, 0.7, frame.night ) * 0.45 * ( 1.0 - smoothstep( 0.08, 0.3, abs( in.V.y ) ) );
` } );
		glareMat.underwaterLighting = 'none';
		this.glare = new InstancedMesh( gm.geometry(), glareMat, fleet.length );
		this.glare.name = 'w1-car-glare';
		this.glare.frustumCulled = false;
		this.glare.userData.dynamic = true;
		this.glare.layers.set( 2 );
		this.glare.boundingSphere = new Sphere( new Vector3( - 110, STREET, 90 ), 260 );
		group.add( this.glare );
		this.t = 0;
		this.carry = 0;
		this.reset( 0.6 );

	}

	// stalls in the lots within reach of the plaza, as Complex lays its striping out (rows 18.3 m apart,
	// stalls 2.7 m wide along the lot's longest side)
	_stalls() {

		const r = this.r, out = [];
		const inside = ( x, z, P ) => {

			let c = false;
			for ( let i = 0, j = P.length - 1; i < P.length; j = i ++ ) {

				const [ xi, zi ] = P[ i ], [ xj, zj ] = P[ j ];
				if ( ( zi > z ) !== ( zj > z ) && x < ( xj - xi ) * ( z - zi ) / ( zj - zi ) + xi ) c = ! c;

			}

			return c;

		};

		for ( const P of LOTS ) {

			if ( ! P.some( ( [ x, z ] ) => Math.hypot( x + 110, z - 90 ) < 260 ) ) continue;
			let best = 0, ang = 0;
			for ( let i = 0; i < P.length; i ++ ) {

				const [ ax, az ] = P[ i ], [ bx, bz ] = P[ ( i + 1 ) % P.length ];
				const l = Math.hypot( bx - ax, bz - az );
				if ( l > best ) { best = l; ang = Math.atan2( bz - az, bx - ax ); }

			}

			const cu = Math.cos( ang ), su = Math.sin( ang );
			let u0 = Infinity, u1 = - Infinity, v0 = Infinity, v1 = - Infinity;
			for ( const [ x, z ] of P ) {

				const u = x * cu + z * su, v = - x * su + z * cu;
				u0 = Math.min( u0, u ); u1 = Math.max( u1, u ); v0 = Math.min( v0, v ); v1 = Math.max( v1, v );

			}

			for ( let v = Math.floor( v0 / 18.3 ) * 18.3; v < v1; v += 18.3 ) for ( const [ dv, face ] of [ [ 2.75, 1 ], [ 15.55, - 1 ] ] ) {

				for ( let u = Math.floor( u0 / 2.7 ) * 2.7 + 1.35; u < u1; u += 2.7 ) {

					const vv = v + dv;
					const x = u * cu - vv * su, z = u * su + vv * cu;
					if ( Math.hypot( x + 110, z - 90 ) > 165 ) continue;
					if ( this.clear.some( ( [ cx, cz, cr ] ) => Math.hypot( x - cx, z - cz ) < cr ) ) continue;
					// inside with a margin (the car's length)
					if ( ! inside( x, z, P ) || ! inside( x + Math.cos( ang + Math.PI / 2 ) * 2.8, z + Math.sin( ang + Math.PI / 2 ) * 2.8, P ) || ! inside( x - Math.cos( ang + Math.PI / 2 ) * 2.8, z - Math.sin( ang + Math.PI / 2 ) * 2.8, P ) ) continue;
					if ( r() > 0.86 ) continue;
					// the nose to the aisle: the stall's across-axis is v (the lot's normal), yaw so -z points along it
					const nx = - su * face, nz = cu * face;
					const u2 = r();
					const type = u2 < 0.4 ? 'sedan' : u2 < 0.68 ? 'suv' : u2 < 0.86 ? 'pickup' : 'van';
					out.push( { x: x + ( r() - 0.5 ) * 0.2, z, yaw: Math.atan2( - nx, - nz ) + ( r() - 0.5 ) * 0.08, type } );

				}

			}

		}

		return out;

	}

	// the moving cars placed as they'd be at this moment
	reset( density ) {

		for ( const c of this.fleet ) c.on = false;
		for ( const L of this.lanes ) {

			const cars = this.fleet.filter( ( c ) => c.lane === L );
			let s = L.s0 + this.r() * 30;
			for ( const c of cars ) {

				if ( this.r() > density ) continue;
				c.on = true;
				c.s = s;
				c.v = 9;
				s += 18 + this.r() * 40;
				if ( s > L.s1 ) break;

			}

		}

	}

	update( dt, w ) {

		const T = G.time.value;
		const r = this.r;
		// how busy: the rush at first pitch, a steady trickle after; stopped dead at the end
		const want = w.celebrate ? 0 : Math.min( 1, 0.25 + w.rate * 0.5 );
		for ( const L of this.lanes ) {

			const cars = this.fleet.filter( ( c ) => c.lane === L && c.on ).sort( ( a, b ) => b.s - a.s );
			// a new car at the lane's start now and then
			const first = cars[ cars.length - 1 ];
			if ( ( ! first || first.s > L.s0 + 22 ) && r() < want * dt * 0.35 ) {

				const c = this.fleet.find( ( k ) => k.lane === L && ! k.on );
				if ( c ) { c.on = true; c.s = L.s0; c.v = 9; cars.push( c ); }

			}

			cars.forEach( ( c, i ) => {

				const ahead = i > 0 ? cars[ i - 1 ] : null;
				const len = c.type === 'bus' ? 12 : 5.5;
				// the limit, then the car ahead, then the signal
				let vmax = c.type === 'bus' ? 8 : 11;
				if ( w.celebrate ) vmax = 0;
				let stopAt = Infinity;
				if ( ahead ) stopAt = ahead.s - ( ahead.type === 'bus' ? 13 : 7.5 );
				for ( const [ sl, ctrl ] of L.stops ) {

					if ( c.s > sl - 1.5 ) continue;
					const st = signal( ctrl, T );
					// stop if it's red, or yellow and there's room to
					if ( st === 'r' || ( st === 'y' && sl - c.s > 14 ) ) stopAt = Math.min( stopAt, sl - len / 2 );

				}

				const gap = stopAt - c.s;
				const vWant = Math.max( 0, Math.min( vmax, gap * 0.8 ) );
				const acc = vWant > c.v ? 2.5 : 6;
				c.v += Math.max( - acc * dt, Math.min( acc * dt, vWant - c.v ) );
				c.braking = vWant < c.v - 0.3 || c.v < 0.5;
				c.s += c.v * dt;
				if ( c.s > L.s1 ) c.on = false;

			} );

		}

		this.write( w );

	}

	write( w ) {

		const m = new Matrix4(), q = new Quaternion(), up = new Vector3( 0, 1, 0 ), one = new Vector3( 1, 1, 1 ), hide = new Matrix4().makeScale( 0, 0, 0 );
		const night = w ? 1 : 1;
		for ( const c of this.fleet ) {

			const M = c.mesh;
			const gi = this.fleet.indexOf( c );
			if ( ! c.on ) {

				M.mesh.setMatrixAt( c.slot, hide );
				this.glare.setMatrixAt( gi, hide );
				continue;

			}

			const [ x, z ] = c.lane.at( c.s );
			const yaw = Math.atan2( - c.lane.dir[ 0 ], - c.lane.dir[ 1 ] );
			q.setFromAxisAngle( up, yaw );
			m.compose( new Vector3( x, STREET + 0.006, z ), q, one );
			M.mesh.setMatrixAt( c.slot, m );
			this.glare.setMatrixAt( gi, m );
			M.info.data.set( [ night, c.braking ? 1 : 0, 0, c.type === 'police' ? 2 : c.type === 'bus' ? 3 : 0 ], c.slot * 4 );

		}

		for ( const t of TYPES ) {

			const M = this.meshes[ t ];
			M.mesh.instanceMatrix.needsUpdate = true;
			M.info.buf.write( M.info.data );

		}

		this.glare.instanceMatrix.needsUpdate = true;

	}

}
