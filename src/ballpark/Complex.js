import { Group, Mesh, InstancedMesh, BufferGeometry, Float32BufferAttribute, Matrix4, Quaternion, Vector2, Vector3, Vector4, Color } from '../engine/index.js';
import { ShaderModule } from '../engine/gpu/Shader.js';
import { triangulateShape } from '../engine/math/ShapeUtils.js';
import { commonModule } from '../engine/render/wgsl/common.js';
import { standard } from '../materials/Materials.js';
import { Quads } from './Stands.js';
import { beam, box, canvasTexture } from './geo.js';
import { LEVELS } from './layout.js';
import * as OSM from './data/complex.js';
import { NEIGHBOURS } from './data/surroundings.js';
import { plantTrees } from './places/gate3b/Trees.js'; // ---- FW2 (C2I-1): the near trees grown
import { rng } from './places/gate3b/Mesher.js';
import { W1_LOTS } from './places/gate3b/Cars.js'; // ---- FW2 (C2I-2): where W1 parks its real cars

// The South Philadelphia Sports Complex and the blocks round it as they were in October 2008, from
// OpenStreetMap (tools/build-complex.mjs): every building on its footprint (the rowhouses of South
// Philly, the warehouses, the Navy Yard), the parking lots with their striping, light poles and pools
// of sodium light after dark, the trees in their October colours, I-95 and the Schuylkill up on their
// viaducts, the rail yards, and the other venues modelled by hand: Lincoln Financial Field with its two
// canopies, the Wachovia Center, and the Spectrum, which stood until 2010. Field frame, street level =
// LEVELS.mainConcourse.


// Only the park's own neighbourhood: its streets, lots, trees and lamps, the venues next door and the
// highway ramps round them (within ~700 m); the rest of South Philadelphia is left to the haze (Center
// City stays on the horizon, Surroundings.js)
const CENTRE = [ 0, - 40 ];
const dist = ( x, z ) => Math.hypot( x - CENTRE[ 0 ], z - CENTRE[ 1 ] );
const near = ( P, R ) => P.some( ( [ x, z ] ) => dist( x, z ) < R );
const BUILDINGS = OSM.BUILDINGS.filter( ( B ) => near( B.fp, 700 ) );
const LOTS = OSM.LOTS.filter( ( P ) => near( P, 700 ) );
const GRASS = OSM.GRASS.filter( ( P ) => near( P, 700 ) );
const HIGHWAYS = OSM.HIGHWAYS.filter( ( w ) => near( w.pts, 700 ) );
const RAIL = OSM.RAIL.filter( ( w ) => near( w.pts, 700 ) );
const TREES = OSM.TREES.filter( ( [ x, z ] ) => dist( x, z ) < 600 );
const LAMPS = OSM.LAMPS.filter( ( [ x, z ] ) => dist( x, z ) < 600 );

const STREET = LEVELS.mainConcourse;
const SODIUM = [ 1.0, 0.55, 0.2 ];
// ---- L: the lots' tall poles were metal halide, white (ref/night: roadieshow 3024603196, the lots on
// Oct 27; Getty 83476821): the orange is the streets' cobra heads only
const HALIDE = [ 1.0, 0.94, 0.84 ];
// ---- end L
const LOT_U = 40, LOT_V = 36.6; // the lot light poles' grid (m), along and across the stalls

// geometry with one extra per-vertex attribute
class Builder {

	constructor( attrSize = 0 ) {

		this.p = []; this.n = []; this.u = []; this.a = []; this.k = attrSize;

	}

	tri( A, B, C, N, uA = [ 0, 0 ], uB = [ 0, 0 ], uC = [ 0, 0 ], attr = [] ) {

		const e1 = [ B[ 0 ] - A[ 0 ], B[ 1 ] - A[ 1 ], B[ 2 ] - A[ 2 ] ], e2 = [ C[ 0 ] - A[ 0 ], C[ 1 ] - A[ 1 ], C[ 2 ] - A[ 2 ] ];
		const cx = e1[ 1 ] * e2[ 2 ] - e1[ 2 ] * e2[ 1 ], cy = e1[ 2 ] * e2[ 0 ] - e1[ 0 ] * e2[ 2 ], cz = e1[ 0 ] * e2[ 1 ] - e1[ 1 ] * e2[ 0 ];
		if ( cx * N[ 0 ] + cy * N[ 1 ] + cz * N[ 2 ] < 0 ) {

			[ B, C ] = [ C, B ];
			[ uB, uC ] = [ uC, uB ];

		}

		const l = Math.hypot( N[ 0 ], N[ 1 ], N[ 2 ] ) || 1;
		this.p.push( ...A, ...B, ...C );
		for ( let i = 0; i < 3; i ++ ) {

			this.n.push( N[ 0 ] / l, N[ 1 ] / l, N[ 2 ] / l );
			this.a.push( ...attr );

		}

		this.u.push( ...uA, ...uB, ...uC );

	}

	quad( A, B, C, D, N, uv, attr ) {

		// uv: [ u0, v0, u1, v1 ] for A( u0, v0 ) B( u1, v0 ) C( u1, v1 ) D( u0, v1 )
		const [ u0, v0, u1, v1 ] = uv || [ 0, 0, 1, 1 ];
		this.tri( A, B, C, N, [ u0, v0 ], [ u1, v0 ], [ u1, v1 ], attr );
		this.tri( A, C, D, N, [ u0, v0 ], [ u1, v1 ], [ u0, v1 ], attr );

	}

	// the Quads interface, for beam() and box()
	add( a, b, c, d, n ) {

		this.quad( a, b, c, d, n );

	}

	geometry( name ) {

		const g = new BufferGeometry();
		g.setAttribute( 'position', new Float32BufferAttribute( this.p, 3 ) );
		g.setAttribute( 'normal', new Float32BufferAttribute( this.n, 3 ) );
		g.setAttribute( 'uv', new Float32BufferAttribute( this.u, 2 ) );
		if ( this.k ) g.setAttribute( name, new Float32BufferAttribute( this.a, this.k ) );
		g.computeBoundingBox();
		g.computeBoundingSphere();
		return g;

	}

}

function inside( x, z, P ) {

	let c = false;
	for ( let i = 0, j = P.length - 1; i < P.length; j = i ++ ) {

		const [ xi, zi ] = P[ i ], [ xj, zj ] = P[ j ];
		if ( ( zi > z ) !== ( zj > z ) && x < ( xj - xi ) * ( z - zi ) / ( zj - zi ) + xi ) c = ! c;

	}

	return c;

}

function triangles( P ) {

	return triangulateShape( P.map( ( [ x, z ] ) => new Vector2( x, z ) ), [] );

}

const hash = ( x ) => {

	const s = Math.sin( x * 12.9898 ) * 43758.5453;
	return s - Math.floor( s );

};

// ---- FW2 (C2I-2): a parked car in a stall, for the lots' shader. q: the point in the lot's frame (x along
// its rows, y across them, as Complex._lots and Cars.js lay the stalls out); seed: the lot's. The car's
// local point (x across it, y along it, its nose +y to the aisle), its half extents, kind (0 none; 1
// sedan, 2 SUV, 3 pickup, 4 van, in Cars.js's mix), paint, its body's and cabin's heights and the
// cabin's span along it. Nine stalls in ten taken
const lotCarsModule = new ShaderModule( {
	name: 'lotCars',
	deps: [ commonModule ],
	code: /* wgsl */`
struct LotCar { l: vec2f, ext: vec2f, kind: f32, paint: f32, bodyH: f32, cabH: f32, cab: vec2f }

fn lcCar( q: vec2f, seed: f32 ) -> LotCar {
	var o = LotCar( vec2f( 0.0 ), vec2f( 0.0 ), 0.0, 0.0, 0.0, 0.0, vec2f( 0.0 ) );
	let m = fract( q.y / 18.3 ) * 18.3;
	let row = floor( q.y / 18.3 );
	var cy = 2.75; var dirY = 1.0; var sd = 0.0;
	if ( m > 12.8 ) { cy = 15.55; dirY = - 1.0; sd = 1.0; } else if ( m >= 5.5 ) { return o; }
	let col = floor( q.x / 2.7 );
	let h = hash21( vec2f( col + seed * 977.0, row * 2.0 + sd + seed * 131.0 ) );
	if ( h > 0.9 ) { return o; }
	let t = fract( h * 37.13 );
	o.paint = fract( h * 113.71 );
	let jit = ( fract( h * 7.73 ) - 0.5 ) * 0.25;
	o.l = vec2f( q.x - ( col + 0.5 ) * 2.7 - jit, ( m - cy ) * dirY );
	if ( t < 0.4 ) { o.kind = 1.0; o.ext = vec2f( 0.9, 2.45 ); o.bodyH = 0.95; o.cabH = 1.45; o.cab = vec2f( - 1.5, 0.6 ); }
	else if ( t < 0.68 ) { o.kind = 2.0; o.ext = vec2f( 0.95, 2.4 ); o.bodyH = 1.05; o.cabH = 1.8; o.cab = vec2f( - 2.2, 0.9 ); }
	else if ( t < 0.86 ) { o.kind = 3.0; o.ext = vec2f( 0.97, 2.7 ); o.bodyH = 1.0; o.cabH = 1.85; o.cab = vec2f( - 0.2, 1.15 ); }
	else { o.kind = 4.0; o.ext = vec2f( 0.95, 2.5 ); o.bodyH = 1.05; o.cabH = 1.8; o.cab = vec2f( - 2.3, 1.2 ); }
	return o;
}

// 0 outside the car at height h, 1 in its body, 2 in its cabin
fn lcInside( c: LotCar, h: f32 ) -> f32 {
	if ( c.kind < 0.5 ) { return 0.0; }
	let ax = abs( c.l.x );
	if ( ax < c.ext.x && abs( c.l.y ) < c.ext.y && h < c.bodyH ) { return 1.0; }
	if ( ax < c.ext.x * 0.86 && c.l.y > c.cab.x && c.l.y < c.cab.y && h < c.cabH ) { return 2.0; }
	return 0.0;
}

// 2008's paints (Cars.js): silver, black, white, grey, dark red, navy, a green, a gold, light grey
fn lcPaint( u: f32 ) -> vec3f {
	let i = i32( floor( u * 9.0 ) );
	var c = vec3f( 0.4, 0.4, 0.42 );
	switch i {
		case 0: { c = vec3f( 0.5, 0.51, 0.52 ); }
		case 1: { c = vec3f( 0.012, 0.012, 0.014 ); }
		case 2: { c = vec3f( 0.75, 0.75, 0.73 ); }
		case 3: { c = vec3f( 0.2, 0.2, 0.21 ); }
		case 4: { c = vec3f( 0.22, 0.02, 0.025 ); }
		case 5: { c = vec3f( 0.02, 0.03, 0.09 ); }
		case 6: { c = vec3f( 0.03, 0.08, 0.05 ); }
		case 7: { c = vec3f( 0.35, 0.3, 0.2 ); }
		default: {}
	}
	return c;
}
`,
} );
// ---- end FW2

export class Complex {

	constructor( { field } ) {

		this.field = field;
		this.group = new Group();
		this.group.name = 'sports-complex';
		field.group.add( this.group );
		this.poles = [];
		this._grass();
		this._lots();
		this._rail();
		this._highways();
		this._buildings();
		this._trees();
		this._poles();
		this._linc();
		this._wachovia();
		this._spectrum();

	}

	_add( geo, mat, name, { cast = false, cull = true } = {} ) {

		mat.underwaterLighting = 'none';
		const m = new Mesh( geo, mat );
		m.name = name;
		m.castShadow = cast;
		m.receiveShadow = true;
		m.frustumCulled = cull;
		this.group.add( m );
		return m;

	}

	// ---------------------------------------------------------------- ground cover

	_grass() {

		const b = new Builder();
		for ( const P of GRASS ) for ( const [ i, j, k ] of triangles( P ) ) {

			const v = ( q ) => [ P[ q ][ 0 ], STREET + 0.02, P[ q ][ 1 ] ];
			b.tri( v( i ), v( j ), v( k ), [ 0, 1, 0 ] );

		}

		this._add( b.geometry(), standard( { name: 'complex-grass', color: new Color( 0.1, 0.16, 0.05 ), roughness: 0.95, modules: [ commonModule ],
			surface: 's.albedo = mat.color * ( 0.75 + 0.35 * mx_noise_float2( in.P.xz * 0.15 ) + 0.1 * mx_noise_float2( in.P.xz * 2.0 ) ) + vec3f( 0.04, 0.03, 0.0 ) * mx_noise_float2( in.P.xz * 0.05 );' } ), 'grass' );

	}

	// The lots: dark asphalt striped into stalls (2.7 m wide, 5.5 m deep, back to back, 7.3 m aisles),
	// laid along each lot's longest side, light poles on a grid and their sodium pools after dark.
	_lots() {

		const b = new Builder( 2 );
		for ( const P of LOTS ) {

			// the stalls run along the lot's longest edge
			let best = 0, ang = 0;
			for ( let i = 0; i < P.length; i ++ ) {

				const [ ax, az ] = P[ i ], [ bx, bz ] = P[ ( i + 1 ) % P.length ];
				const l = Math.hypot( bx - ax, bz - az );
				if ( l > best ) {

					best = l; ang = Math.atan2( bz - az, bx - ax );

				}

			}

			for ( const [ i, j, k ] of triangles( P ) ) {

				const v = ( q ) => [ P[ q ][ 0 ], STREET + 0.03, P[ q ][ 1 ] ];
				b.tri( v( i ), v( j ), v( k ), [ 0, 1, 0 ], undefined, undefined, undefined, [ ang, ( LOTS.indexOf( P ) * 0.618034 ) % 1 ] ); // ---- FW2: its seed

			}

			// its light poles on the grid the shader lights
			const cu = Math.cos( ang ), su = Math.sin( ang );
			let u0 = Infinity, u1 = - Infinity, v0 = Infinity, v1 = - Infinity;
			for ( const [ x, z ] of P ) {

				const u = x * cu + z * su, v = - x * su + z * cu;
				u0 = Math.min( u0, u ); u1 = Math.max( u1, u ); v0 = Math.min( v0, v ); v1 = Math.max( v1, v );

			}

			for ( let u = Math.ceil( u0 / LOT_U ) * LOT_U; u <= u1; u += LOT_U ) for ( let v = Math.ceil( v0 / LOT_V ) * LOT_V; v <= v1; v += LOT_V ) {

				const x = u * cu - v * su, z = u * su + v * cu;
				if ( inside( x, z, P ) && Math.hypot( x, z ) > 150 ) this.poles.push( [ x, STREET, z, 13 ] );

			}

		}

		// ---- FW2 (C2I-2): the lots full. The stalls laid out in the field frame (as Cars.js parks its real
		// cars: in the world frame the striping ran ten degrees off the lots' edges), and a car painted in
		// nine stalls in ten wherever there isn't a real one: W1's round the Third Base plaza, LotCars' round
		// you on the ground (lotNear), the tailgates and the tents (lotClear). From above each has a little
		// relief (the view ray stepped down through its body and cabin), so from the decks and the air the
		// lots read packed to the fences, as Getty's photos from the north-east on the 27th have them
		const rot = this.field.group.rotation.y;
		const mat = standard( {
			name: 'parking-lots', color: new Color( 0.075, 0.075, 0.072 ), roughness: 0.9, modules: [ commonModule, lotCarsModule ],
			attributes: { aLot: 'vec2f' }, varyings: { vLot: 'vec2f' }, vertex: 'o.vLot = v.aLot;',
			uniforms: {
				fieldRot: [ 'vec4f', new Vector4( Math.cos( rot ), Math.sin( rot ), 0, 0 ) ],
				near: [ 'vec4f', new Vector4( 0, 0, 0, 0 ) ],
				w1: [ 'vec4f', new Vector4( W1_LOTS.c[ 0 ], W1_LOTS.c[ 1 ], W1_LOTS.r + 2, 0 ) ],
				clear: [ 'vec4f[12]', Array.from( { length: 12 }, () => new Vector4( 0, 0, 0, 0 ) ) ],
			},
			surface: /* wgsl */`
	let a = in.vs.vLot.x;
	let ca = cos( a ); let sa = sin( a );
	// the field frame (the stalls are laid out in it), then the lot's own
	let fp = vec2f( in.P.x * mat.fieldRot.x - in.P.z * mat.fieldRot.y, in.P.x * mat.fieldRot.y + in.P.z * mat.fieldRot.x );
	let q = vec2f( fp.x * ca + fp.y * sa, - fp.x * sa + fp.y * ca );
	// asphalt: patches, grain, oil down the middle of the stalls
	var c = mat.color * ( 0.8 + 0.3 * mx_noise_float2( in.P.xz * 0.08 ) + 0.12 * mx_noise_float2( in.P.xz * 3.0 ) );
	let m = fract( q.y / 18.3 ) * 18.3; // across a module: stalls 0-5.5, aisle 5.5-12.8, stalls 12.8-18.3
	let inStall = m < 5.5 || m > 12.8;
	let fw = fwidth( q.x ) + 0.02;
	let line = 1.0 - smoothstep( 0.06, 0.06 + fw, abs( fract( q.x / 2.7 + 0.5 ) - 0.5 ) * 2.7 );
	let head = 1.0 - smoothstep( 0.06, 0.06 + fw, abs( m - 18.3 * step( 9.0, m ) ) );
	var paint = select( 0.0, max( line, head ), inStall );
	// worn paint that melts away with distance
	paint = paint * ( 0.55 + 0.45 * mx_noise_float2( in.P.xz * 0.7 ) ) * ( 1.0 - clamp( fw * 3.0, 0.0, 0.8 ) );
	let oil = select( 0.0, smoothstep( 0.8, 0.0, abs( fract( q.x / 2.7 ) - 0.5 ) * 2.0 ) * 0.25, inStall && ( ( m > 1.0 && m < 4.0 ) || ( m > 14.0 && m < 17.0 ) ) );
	let asphalt = c * ( 1.0 - oil );
	c = mix( asphalt, vec3f( 0.52, 0.52, 0.5 ), paint );
	// ---- FW2 (C2I-2): the parked cars, where there's no real one
	var painted = true;
	if ( length( fp - mat.near.xy ) < mat.near.z || length( fp - mat.w1.xy ) < mat.w1.z ) { painted = false; }
	for ( var i = 0; i < 12; i ++ ) {
		let k = mat.clear[ i ];
		if ( k.z > 0.0 && length( fp - k.xy ) < k.z ) { painted = false; }
	}
	var carHit = false;
	if ( painted ) {
		// the view ray in the lot's frame: back toward the eye across the ground, and how steeply it falls
		let V = normalize( in.P - frame.cameraPos );
		let vf = vec2f( V.x * mat.fieldRot.x - V.z * mat.fieldRot.y, V.x * mat.fieldRot.y + V.z * mat.fieldRot.x );
		let vq = vec2f( vf.x * ca + vf.y * sa, - vf.x * sa + vf.y * ca );
		let lh = max( length( vq ), 1e-4 );
		let back = - vq / lh;
		let tanT = max( - V.y / lh, 0.04 );
		// from 1.9 m down to the ground: the first height at which the ray is inside a car
		var prevQ = q + back * ( 2.2 / tanT );
		for ( var k = 0; k < 7; k ++ ) {
			let h = 1.9 - f32( k ) * 0.3;
			let p = q + back * ( h / tanT );
			let car = lcCar( p, in.vs.vLot.y );
			let hit = lcInside( car, h );
			if ( hit > 0.0 ) {
				// in through the top (the step between samples short: seen from above) or a side
				let sideOn = length( p - prevQ ) > 0.45 && k > 0;
				let col = lcPaint( car.paint );
				if ( hit > 1.5 ) {
					// the cabin: glass round it, its roof the paint
					c = select( col * 0.9, vec3f( 0.025, 0.03, 0.035 ), sideOn && h < car.cabH - 0.12 );
				} else {
					c = col * select( 0.95, 0.6 + 0.4 * ( h / car.bodyH ), sideOn );
				}
				carHit = true;
				break;
			}
			prevQ = p;
		}
		if ( ! carHit ) {
			// the dark under each car, round its footprint
			let car = lcCar( q, in.vs.vLot.y );
			if ( car.kind > 0.5 ) {
				let d = max( abs( car.l.x ) - car.ext.x, abs( car.l.y ) - car.ext.y );
				c = c * mix( 0.35, 1.0, smoothstep( - 0.1, 0.45, d ) );
			}
		}
	}
	s.albedo = c;
	if ( carHit ) { s.roughness = mix( 0.35, 0.15, frame.wet ); }
	// ---- end FW2
	// pools under the poles
	let g = ( fract( vec2f( q.x / ${ LOT_U.toFixed( 2 ) }, q.y / ${ LOT_V.toFixed( 2 ) } ) + 0.5 ) - 0.5 ) * vec2f( ${ LOT_U.toFixed( 2 ) }, ${ LOT_V.toFixed( 2 ) } );
	let pool = exp( - dot( g, g ) / ( 2.0 * 10.0 * 10.0 ) );
	// ---- L: white, and a pool on the asphalt, not a lit carpet (from the air on the night the lots are
	// dark between the poles: FOX's blimp shots, Getty 83476821)
	// (CB-14: the pool lights the asphalt; the stall lines only a little more than it, so they don't comb
	// the lots with glowing stripes, and the light falls off sooner between the poles: roadieshow
	// 3024603196, Getty 83476764, Oct 27)
	s.emissive = select( mix( asphalt, c, 0.35 ), c * 0.45, carHit ) * vec3f( ${ HALIDE.join( ', ' ) } ) * ( pool * pool * 3.2 + pool * 0.22 ) * smoothstep( 0.2, 0.8, frame.night );
` } );
		this.lotMaterial = mat;
		this._add( b.geometry( 'aLot' ), mat, 'parking-lots' );

	}

	// ---- FW2 (C2I-2): where the real cars are round you (LotCars), so the shader leaves those stalls be
	lotNear( x, z, R ) {

		this.lotMaterial?.uniforms.near.value.set( x, z, R > 0 ? R + 3 : 0, 0 );

	}

	// and where nobody parks: [ [ x, z, r ], ... ] (up to 12)
	lotClear( list ) {

		const U = this.lotMaterial?.uniforms.clear.value;
		if ( U ) list.slice( 0, 12 ).forEach( ( [ x, z, r ], i ) => U[ i ].set( x, z, r, 0 ) );

	}
	// ---- end FW2

	// ---------------------------------------------------------------- highways and rail

	// Elevation along a way: bridges up on their decks (ramping at the ends that don't join another
	// bridge), everything else on the ground.
	_elevations( list, deck ) {

		const key = ( p ) => `${ Math.round( p[ 0 ] ) },${ Math.round( p[ 1 ] ) }`;
		const ends = new Map();
		for ( const w of list ) if ( w.bridge ) for ( const p of [ w.pts[ 0 ], w.pts[ w.pts.length - 1 ] ] ) ends.set( key( p ), ( ends.get( key( p ) ) || 0 ) + 1 );
		return list.map( ( w ) => {

			const P = w.pts, s = [ 0 ];
			for ( let i = 1; i < P.length; i ++ ) s.push( s[ i - 1 ] + Math.hypot( P[ i ][ 0 ] - P[ i - 1 ][ 0 ], P[ i ][ 1 ] - P[ i - 1 ][ 1 ] ) );
			const L = s[ s.length - 1 ];
			if ( ! w.bridge ) return s.map( () => 0 );
			const H = deck( w );
			const r0 = ( ends.get( key( P[ 0 ] ) ) || 0 ) > 1 ? 0 : Math.min( 140, L / 2 ), r1 = ( ends.get( key( P[ P.length - 1 ] ) ) || 0 ) > 1 ? 0 : Math.min( 140, L / 2 );
			const ss = ( e0, e1, x ) => {

				const t = Math.max( 0, Math.min( 1, ( x - e0 ) / ( e1 - e0 ) ) );
				return t * t * ( 3 - 2 * t );

			};
			return s.map( ( d ) => H * ( r0 ? ss( 0, r0, d ) : 1 ) * ( r1 ? ss( 0, r1, L - d ) : 1 ) );

		} );

	}

	// I-95, the Schuylkill (I-76) and their ramps: decks with lane lines, jersey barriers, piers under
	// the viaducts, sodium lights along them
	_highways() {

		const deck = new Builder( 2 ), sides = new Builder();
		const Y = this._elevations( HIGHWAYS, ( w ) => ( w.layer >= 2 ? 15 : 8.5 ) );
		HIGHWAYS.forEach( ( w, wi ) => {

			const P = w.pts, ys = Y[ wi ];
			const link = /link/.test( w.k );
			const hw = ( w.lanes * 3.6 + ( link ? 2.5 : 4.5 ) ) / 2;
			let u = 0, lastPier = - 99, lastLamp = - 99;
			for ( let i = 0; i < P.length - 1; i ++ ) {

				const [ ax, az ] = P[ i ], [ bx, bz ] = P[ i + 1 ];
				const len = Math.hypot( bx - ax, bz - az );
				if ( len < 0.2 ) continue;
				const ux = ( bx - ax ) / len, uz = ( bz - az ) / len, nx = - uz, nz = ux;
				const e = Math.min( hw, 2 );
				const A = [ ax - ux * e, az - uz * e ], B = [ bx + ux * e, bz + uz * e ];
				const ya = STREET + 0.05 + ys[ i ], yb = STREET + 0.05 + ys[ i + 1 ];
				const at = ( p, side, y ) => [ p[ 0 ] + nx * hw * side, y, p[ 1 ] + nz * hw * side ];
				deck.quad( at( A, - 1, ya ), at( B, - 1, yb ), at( B, 1, yb ), at( A, 1, ya ), [ 0, 1, 0 ], [ u, - 1, u + len + 2 * e, 1 ], [ hw, w.lanes ] );
				const up = Math.max( ys[ i ], ys[ i + 1 ] ) > 1;
				if ( up ) {

					// the deck's edges, its underside, and barriers
					for ( const side of [ - 1, 1 ] ) {

						sides.quad( at( A, side, ya - 1.6 ), at( B, side, yb - 1.6 ), at( B, side, yb + 1.0 ), at( A, side, ya + 1.0 ), [ nx * side, 0, nz * side ] );
						sides.quad( at( A, side * 0.97, ya ), at( B, side * 0.97, yb ), at( B, side * 0.97, yb + 1.0 ), at( A, side * 0.97, ya + 1.0 ), [ - nx * side, 0, - nz * side ] );

					}

					sides.quad( at( A, - 1, ya - 1.6 ), at( B, - 1, yb - 1.6 ), at( B, 1, yb - 1.6 ), at( A, 1, ya - 1.6 ), [ 0, - 1, 0 ] );
					// piers every 32 m where it's up high enough
					for ( let d = Math.max( u, lastPier + 32 ); d < u + len; d += 32 ) {

						const t = ( d - u ) / len, y = ya + ( yb - ya ) * t - 1.6;
						if ( y - STREET < 2.5 ) continue;
						const cx = ax + ( bx - ax ) * t, cz = az + ( bz - az ) * t;
						for ( const side of hw > 7 ? [ - 0.55, 0.55 ] : [ 0 ] ) beam( sides, [ cx + nx * hw * side, STREET, cz + nz * hw * side ], [ cx + nx * hw * side, y, cz + nz * hw * side ], 1.8 );
						beam( sides, [ cx - nx * hw * 0.9, y - 0.6, cz - nz * hw * 0.9 ], [ cx + nx * hw * 0.9, y - 0.6, cz + nz * hw * 0.9 ], 1.2 );
						lastPier = d;

					}

				}

				// lights along the right-hand edge every 55 m
				for ( let d = Math.max( u, lastLamp + 55 ); d < u + len; d += 55 ) {

					const t = ( d - u ) / len, y = ya + ( yb - ya ) * t;
					this.poles.push( [ ax + ( bx - ax ) * t + nx * hw * 1.02, y + ( up ? 1.0 : 0 ), az + ( bz - az ) * t + nz * hw * 1.02, 12 ] );
					lastLamp = d;

				}

				u += len;

			}

		} );

		this._add( deck.geometry( 'aHwy' ), standard( {
			name: 'highway-deck', color: new Color( 0.085, 0.085, 0.083 ), roughness: 0.9, modules: [ commonModule ],
			attributes: { aHwy: 'vec2f' }, varyings: { vHwy: 'vec2f' }, vertex: 'o.vHwy = v.aHwy;',
			surface: /* wgsl */`
	let hw = in.vs.vHwy.x; let lanes = max( 1.0, in.vs.vHwy.y );
	let d = ( in.uv.y * 0.5 + 0.5 ) * hw * 2.0; // metres from the left edge
	var c = mat.color * ( 0.82 + 0.3 * mx_noise_float2( in.P.xz * 0.1 ) + 0.1 * mx_noise_float2( in.P.xz * 4.0 ) );
	let fw = fwidth( d ) + 0.01;
	// solid edge lines, dashed lanes (3 m of paint every 12 m)
	let shoulder = ( hw * 2.0 - lanes * 3.6 ) * 0.5;
	let edge = 1.0 - smoothstep( 0.08, 0.08 + fw, min( abs( d - shoulder ), abs( d - ( hw * 2.0 - shoulder ) ) ) );
	let lane = abs( fract( ( d - shoulder ) / 3.6 + 0.5 ) - 0.5 ) * 3.6;
	let inside = step( shoulder + 0.5, d ) * step( d, hw * 2.0 - shoulder - 0.5 );
	let dash = ( 1.0 - smoothstep( 0.07, 0.07 + fw, lane ) ) * step( fract( in.uv.x / 12.0 ), 0.25 ) * inside;
	c = mix( c, vec3f( 0.55, 0.54, 0.5 ), max( edge, dash ) * ( 1.0 - clamp( fwidth( in.uv.x ) * 0.2, 0.0, 0.7 ) ) );
	s.albedo = c;
` } ), 'highway-decks', { cull: false } );
		this._add( sides.geometry(), standard( { name: 'highway-concrete', color: new Color( 0.42, 0.41, 0.38 ), roughness: 0.85, modules: [ commonModule ],
			surface: 's.albedo = mat.color * ( 0.8 + 0.25 * mx_noise_float2( in.P.xz * 0.2 + in.P.y ) );' } ), 'highway-structure', { cast: true, cull: false } );

	}

	// the freight lines and yards: ballast with a pair of rails
	_rail() {

		const b = new Builder();
		const hw = 1.8;
		for ( const w of RAIL ) {

			const P = w.pts;
			let u = 0;
			for ( let i = 0; i < P.length - 1; i ++ ) {

				const [ ax, az ] = P[ i ], [ bx, bz ] = P[ i + 1 ];
				const len = Math.hypot( bx - ax, bz - az );
				if ( len < 0.2 ) continue;
				const nx = - ( bz - az ) / len * hw, nz = ( bx - ax ) / len * hw;
				const y = STREET + 0.04;
				b.quad( [ ax - nx, y, az - nz ], [ bx - nx, y, bz - nz ], [ bx + nx, y, bz + nz ], [ ax + nx, y, az + nz ], [ 0, 1, 0 ], [ u, - 1, u + len, 1 ] );
				u += len;

			}

		}

		this._add( b.geometry(), standard( { name: 'rail-ballast', color: new Color( 0.2, 0.18, 0.16 ), roughness: 0.95, modules: [ commonModule ],
			surface: /* wgsl */`
	let a = abs( in.uv.y ) * 1.8;
	var c = mat.color * ( 0.8 + 0.4 * mx_noise_float2( in.P.xz * 6.0 ) );
	let fw = fwidth( a ) + 0.01;
	let rail = 1.0 - smoothstep( 0.04, 0.04 + fw, abs( a - 0.72 ) );
	let tie = step( 0.6, fract( in.uv.x / 0.6 ) ) * step( a, 1.3 ) * ( 1.0 - clamp( fwidth( in.uv.x ) * 2.0, 0.0, 1.0 ) );
	c = mix( c, vec3f( 0.12, 0.09, 0.07 ), tie * 0.7 );
	c = mix( c, vec3f( 0.45, 0.42, 0.4 ), rail );
	s.albedo = c;
` } ), 'rail' );

	}

	// ---------------------------------------------------------------- buildings

	// Every building on its footprint: rowhouses in brick (some painted or sided) with a window every
	// couple of metres on each floor and a cornice, the bigger blocks in concrete and metal panel.
	// Windows light up at random after dark.
	_buildings() {

		const b = new Builder( 3 );
		BUILDINGS.forEach( ( B, bi ) => {

			const P = B.fp, h = B.h, seed = hash( bi + 0.5 );
			const kind = { row: 0, mid: 1, big: 2, shed: 3 }[ B.k ] ?? 1;
			const attr = [ seed, kind, h ];
			let u = 0;
			for ( let i = 0; i < P.length; i ++ ) {

				const [ ax, az ] = P[ i ], [ bx, bz ] = P[ ( i + 1 ) % P.length ];
				const len = Math.hypot( bx - ax, bz - az );
				if ( len < 0.05 ) continue;
				let nx = ( bz - az ) / len, nz = - ( bx - ax ) / len;
				const mx = ( ax + bx ) / 2 + nx * 0.05, mz = ( az + bz ) / 2 + nz * 0.05;
				if ( inside( mx, mz, P ) ) {

					nx = - nx; nz = - nz;

				}

				b.quad( [ ax, STREET, az ], [ bx, STREET, bz ], [ bx, STREET + h, bz ], [ ax, STREET + h, az ], [ nx, 0, nz ], [ u, 0, u + len, h ], attr );
				u += len;

			}

			for ( const [ i, j, k ] of triangles( P ) ) {

				const v = ( q ) => [ P[ q ][ 0 ], STREET + h, P[ q ][ 1 ] ];
				b.tri( v( i ), v( j ), v( k ), [ 0, 1, 0 ], [ - 1, - 1 ], [ - 1, - 1 ], [ - 1, - 1 ], attr );

			}

		} );

		this._add( b.geometry( 'aBld' ), standard( {
			name: 'city-buildings', color: new Color( 0.3, 0.12, 0.08 ), roughness: 0.85, modules: [ commonModule ],
			attributes: { aBld: 'vec3f' }, varyings: { vBld: 'vec3f' }, vertex: 'o.vBld = v.aBld;',
			surface: /* wgsl */`
	let seed = in.vs.vBld.x; let kind = i32( in.vs.vBld.y + 0.5 ); let h = in.vs.vBld.z;
	let roof = in.uv.x < - 0.5;
	let tone = fract( seed * 7.13 );
	// walls: brick reds and browns for the rowhouses, a few painted or sided; greys and tans for the rest
	var wall = mix( vec3f( 0.3, 0.1, 0.06 ), vec3f( 0.22, 0.12, 0.08 ), tone );
	if ( kind == 0 && fract( seed * 3.7 ) > 0.78 ) { wall = mix( vec3f( 0.5, 0.47, 0.42 ), vec3f( 0.36, 0.38, 0.4 ), tone ); }
	if ( kind >= 1 ) { wall = mix( vec3f( 0.42, 0.4, 0.36 ), vec3f( 0.3, 0.3, 0.31 ), tone ); }
	if ( kind == 1 && fract( seed * 5.3 ) > 0.6 ) { wall = mix( vec3f( 0.3, 0.12, 0.08 ), vec3f( 0.4, 0.34, 0.26 ), tone ); }
	let u = in.uv.x; let v = in.uv.y;
	// windows: a floor every 3.2 m, a window every 2.4 m (rowhouses) or 4 m in bands (the rest)
	let floorH = 3.2;
	let fv = fract( v / floorH );
	let spacing = select( 4.0, 2.4, kind == 0 );
	let fu = fract( u / spacing );
	let isWin = fv > 0.35 && fv < 0.8 && fu > 0.25 && fu < 0.75 && v > 1.0 && v < h - 0.9 && kind != 3 && ( kind != 2 || ( fv > 0.45 && fv < 0.7 ) );
	let cornice = v > h - 0.5 && kind == 0;
	let far = clamp( fwidth( u ) * 0.8 - 0.2, 0.0, 1.0 );
	var c = wall * ( 0.85 + 0.25 * mx_noise_float2( in.P.xz * 0.5 + v ) );
	if ( isWin ) { c = mix( vec3f( 0.04, 0.045, 0.05 ), c, far * 0.6 ); }
	if ( cornice ) { c = vec3f( 0.45, 0.43, 0.4 ); }
	// roofs: tar and silver coating for the rowhouses, white membrane on the big ones
	if ( roof ) {
		c = select( mix( vec3f( 0.08 ), vec3f( 0.4, 0.4, 0.42 ), step( 0.55, tone ) ), mix( vec3f( 0.5, 0.5, 0.48 ), vec3f( 0.3 ), tone ), kind >= 1 );
		c = c * ( 0.85 + 0.2 * mx_noise_float2( in.P.xz * 0.3 ) );
	}
	s.albedo = c;
	// after dark: warm windows, a random third of them lit
	let cell = floor( vec2f( u / spacing, v / floorH ) );
	let lit = step( select( 0.8, 0.6, kind == 0 ), fract( sin( dot( cell + seed * 91.0, vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 ) );
	if ( isWin && ! roof ) {
		s.emissive = vec3f( 1.0, 0.72, 0.42 ) * lit * smoothstep( 0.2, 0.8, frame.night ) * mix( 0.9, 0.3, far );
	}
` } ), 'city-buildings', { cast: true, cull: false } );

	}

	// ---------------------------------------------------------------- trees and poles

	// C2I-1 (gauntlet r2, FW2): the street trees were 713 faceted icosahedra on posts, hard octagonal
	// shadows under the lot lights, five of them across the home plate entrance, beside W1's honey locusts
	// grown branch by branch on the 3B plaza: two kinds of tree on one street. In the photos Pattison's
	// trees are young honey locusts in grates, lacy and gone yellow in October (rdowens Jul 2008, bps52769
	// Oct 29 2008), and the home plate entrance has low planters, no trees across its doors
	// (thephillyfly Apr 2008). So: the trees within 250 m of the park are grown as W1's are (gate3b's
	// grower: honey locusts, and some bigger, broader ones), in their October colours, in two draws; the
	// ones further out a crown of crossed leaf cards round the trunk (lacy, the light through it), one
	// instanced draw each for the cards and the trunks; none of them cast shadows (W1's on the plaza do).
	// W1's place (ThirdBaseGate) still takes the instanced trees in its area and grows those itself.
	_trees() {

		const C = [ 0, - 40 ];
		// the home plate entrance's front: planters there, not trees
		const entrance = ( [ x, z ] ) => Math.abs( x ) < 17 && z > 92 && z < 106;
		// W1's area (places/ThirdBaseGate.js AREA): it grows those
		const w1 = ( [ x, z ] ) => x >= - 200 && x <= - 15 && z >= - 20 && z <= 185;
		const all = TREES.filter( ( t ) => ! entrance( t ) );
		const grown = all.filter( ( t ) => ! w1( t ) && Math.hypot( t[ 0 ] - C[ 0 ], t[ 1 ] - C[ 1 ] ) < 250 );
		const carded = all.filter( ( t ) => ! grown.includes( t ) );
		// the near ones: two thirds honey locusts as W1's, the rest bigger and broader (planes, oaks in the
		// lots' islands); in grates along Pattison's sidewalk
		const spots = grown.map( ( [ x, z ], i ) => {

			const r = hash( i * 5.3 + x * 0.1 ), big = hash( i * 2.9 + z * 0.1 ) > 0.65;
			return [ x, z, 1000 + i, big ? { h: 8.2 + r * 2.4, trunk: 2.5 + r * 0.4, r: 0.1 + r * 0.04, thin: 0.25 } : { thin: 0.3 + r * 0.3 } ];

		} );
		const sidewalk = ( [ , z ] ) => z > 92 && z < 112;
		// in blocks of 140 m, each kept out of the static batching (userData.dynamic) so it keeps its own
		// bounds: the blocks out of view or behind the walls (Occlusion.js) aren't drawn
		const blocks = new Map();
		for ( const p of spots ) {

			const k = `${ Math.floor( p[ 0 ] / 140 ) },${ Math.floor( p[ 1 ] / 140 ) }`;
			if ( ! blocks.has( k ) ) blocks.set( k, [] );
			blocks.get( k ).push( p );

		}

		this.treeMeshes = [];
		for ( const list of blocks.values() ) {

			const g = new Group();
			g.userData.dynamic = true;
			this.group.add( g );
			this.treeMeshes.push(
				...plantTrees( g, list.filter( sidewalk ), { grates: true, shadows: false } ),
				...plantTrees( g, list.filter( ( p ) => ! sidewalk( p ) ), { grates: false, shadows: false } ),
			);

		}
		this.treeCount = { grown: grown.length, carded: carded.length };

		// the far ones: four crossed cards and two across the top, the crown's texture lacy with gaps
		const trunks = new Quads(), cards = new Builder();
		beam( trunks, [ 0, 0, 0 ], [ 0, 3.4, 0 ], 0.2 );
		const cy = 5.6, R = 3.1, y0 = 2.4, y1 = 8.8;
		for ( let k = 0; k < 4; k ++ ) {

			const a = k * Math.PI / 4, cx = Math.cos( a ) * R, cz = Math.sin( a ) * R;
			const A = [ - cx, y0, - cz ], B = [ cx, y0, cz ], Cc = [ cx, y1, cz ], D = [ - cx, y1, - cz ];
			const n = [ - cz, 0, cx ];
			cards.tri( A, B, Cc, n, [ 0, 1 ], [ 0.5, 1 ], [ 0.5, 0 ] );
			cards.tri( A, Cc, D, n, [ 0, 1 ], [ 0.5, 0 ], [ 0, 0 ] );

		}

		// two across the top, a little apart, the upper one smaller
		for ( const [ yt, rt ] of [ [ cy - 0.3, R * 0.95 ], [ cy + 1.1, R * 0.72 ] ] ) {

			cards.tri( [ - rt, yt, - rt ], [ rt, yt, - rt ], [ rt, yt, rt ], [ 0, 1, 0 ], [ 0.5, 1 ], [ 1, 1 ], [ 1, 0 ] );
			cards.tri( [ - rt, yt, - rt ], [ rt, yt, rt ], [ - rt, yt, rt ], [ 0, 1, 0 ], [ 0.5, 1 ], [ 1, 0 ], [ 0.5, 0 ] );

		}
		const crownGeo = cards.geometry();
		// each vertex's normal out from the crown's middle (and up), so the cards shade like a crown
		{

			const P = crownGeo.attributes.position.array, N = crownGeo.attributes.normal.array;
			for ( let i = 0; i < P.length; i += 3 ) {

				const n = [ P[ i ], P[ i + 1 ] - cy + 2.0, P[ i + 2 ] ], l = Math.hypot( ...n );
				N[ i ] = n[ 0 ] / l; N[ i + 1 ] = n[ 1 ] / l; N[ i + 2 ] = n[ 2 ] / l;

			}

		}

		const tex = canvasTexture( 1024, 512, ( ctx, W, H ) => {

			ctx.clearRect( 0, 0, W, H );
			const r = rng( 11 );
			// R the cluster's shade, G a random for its colour, B the wood
			const blob = ( x, y, rx, ry, a ) => {

				ctx.fillStyle = `rgb(${ Math.round( 120 + 135 * r() ) },${ Math.round( 255 * r() ) },0)`;
				ctx.beginPath();
				ctx.ellipse( x, y, rx, ry, a, 0, Math.PI * 2 );
				ctx.fill();

			};

			// the side view (left half): limbs fanning up from the trunk's top, leaf clusters over them
			ctx.strokeStyle = 'rgb(60,30,255)';
			ctx.lineCap = 'round';
			for ( let k = 0; k < 7; k ++ ) {

				const a = - Math.PI / 2 + ( k / 6 - 0.5 ) * 1.9 + ( r() - 0.5 ) * 0.2;
				const L = 150 + r() * 70;
				ctx.lineWidth = 7 - k % 3;
				ctx.beginPath(); ctx.moveTo( 256, H ); ctx.lineTo( 256 + Math.cos( a ) * L, 470 + Math.sin( a ) * L ); ctx.stroke();

			}

			for ( let i = 0; i < 1500; i ++ ) {

				// in an ellipse over the trunk, thinner toward the edge, with holes (October)
				const t = Math.sqrt( r() ), a = r() * Math.PI * 2;
				const x = 256 + Math.cos( a ) * t * 235, y = 225 + Math.sin( a ) * t * 200;
				if ( r() < t * t * 0.55 ) continue;
				if ( Math.sin( x * 0.045 + y * 0.03 ) * Math.cos( y * 0.05 - x * 0.02 ) > 0.55 ) continue;
				blob( x, y, 5 + r() * 7, 3 + r() * 4, r() * 3 );

			}

			// the top view (right half): a round crown of clusters
			for ( let i = 0; i < 1300; i ++ ) {

				const t = Math.sqrt( r() ), a = r() * Math.PI * 2;
				const x = 768 + Math.cos( a ) * t * 230, y = 256 + Math.sin( a ) * t * 230;
				if ( r() < t * t * 0.5 ) continue;
				if ( Math.sin( x * 0.05 ) * Math.cos( y * 0.045 ) > 0.6 ) continue;
				blob( x, y, 6 + r() * 8, 4 + r() * 5, r() * 3 );

			}

		}, 'tree-cards' );
		const n = carded.length;
		const bark = standard( { name: 'tree-bark', color: new Color( 0.075, 0.062, 0.052 ), roughness: 0.9 } );
		const leaves = standard( { name: 'tree-leaves', color: new Color( 1, 1, 1 ), roughness: 0.7, alphaTest: 0.5, side: 'double', modules: [ commonModule ],
			textures: { treeCards: tex },
			surface: /* wgsl */`
	let t = textureSample( treeCards, smpLinearClamp, in.uv );
	// (the clusters hold together into the distance: the cut-out's coverage kept as the mips average it)
	s.alpha = t.a * ( 1.0 + clamp( fwidth( in.uv.x ) * 250.0, 0.0, 1.2 ) );
	// the tree's own October tint (its instance colour), each cluster a little greener or more gold
	let gold = vec3f( 0.44, 0.31, 0.045 );
	let green = vec3f( 0.12, 0.16, 0.035 );
	var c = mix( s.albedo, mix( green, gold, t.g ), 0.3 ) * ( 0.55 + 0.6 * t.r );
	c = mix( c, vec3f( 0.05, 0.035, 0.025 ), smoothstep( 0.6, 0.9, t.b ) );
	s.albedo = c * mix( 1.0, 0.8, frame.wet );
	s.translucency = c * 0.2;
	s.specularIntensity = 0.35;
` } );
		leaves.setDefine( 'DRY', 1 );
		const tm = new InstancedMesh( trunks.geometry(), bark, Math.max( 1, n ) ), cm = new InstancedMesh( crownGeo, leaves, Math.max( 1, n ) );
		const m = new Matrix4(), q = new Quaternion(), sc = new Vector3(), col = new Color();
		// October: mostly green going yellow, some orange and rust
		const autumn = [ [ 0.12, 0.2, 0.06 ], [ 0.16, 0.22, 0.06 ], [ 0.3, 0.3, 0.07 ], [ 0.45, 0.35, 0.08 ], [ 0.45, 0.2, 0.06 ], [ 0.3, 0.12, 0.05 ] ];
		carded.forEach( ( [ x, z ], i ) => {

			const r = hash( i * 1.7 + x ), s = 0.8 + 0.5 * r;
			q.setFromAxisAngle( new Vector3( 0, 1, 0 ), r * 6.28 );
			m.compose( new Vector3( x, STREET, z ), q, sc.set( s, s * ( 0.9 + 0.25 * hash( i * 4.1 ) ), s ) );
			tm.setMatrixAt( i, m );
			cm.setMatrixAt( i, m );
			const k = autumn[ Math.floor( hash( i * 3.1 ) * autumn.length ) ];
			cm.setColorAt( i, col.setRGB( k[ 0 ], k[ 1 ], k[ 2 ] ) );

		} );
		for ( const [ mesh, mat, name ] of [ [ tm, bark, 'trees-trunks' ], [ cm, leaves, 'trees-crowns' ] ] ) {

			mat.underwaterLighting = 'none';
			mesh.name = name;
			mesh.castShadow = false;
			mesh.receiveShadow = true;
			mesh.computeBoundingBox?.();
			mesh.computeBoundingSphere?.();
			mesh.frustumCulled = false;
			this.group.add( mesh );

		}

	}

	// the light poles: the lots' (on their grid), the streets' (OpenStreetMap's street lamps) and the
	// highways', each a steel pole with a pair of cobra heads glowing sodium orange after dark
	_poles() {

		const lotPoles = this.poles.length; // ---- L: the lots' (white) before the streets' (sodium)
		for ( const [ x, z ] of LAMPS ) this.poles.push( [ x, STREET, z, 9 ] );
		const pole = new Quads(), heads = new Quads();
		beam( pole, [ 0, 0, 0 ], [ 0, 1, 0 ], 0.22 );
		box( pole, [ 0, 0.985, 0 ], [ 2.6, 0.008, 0.12 ] );
		// the heads live at y = 1 (the matrices scale y by the pole's height, x and z not)
		box( heads, [ - 1.4, 0.975, 0 ], [ 0.7, 0.012, 0.35 ] );
		box( heads, [ 1.4, 0.975, 0 ], [ 0.7, 0.012, 0.35 ] );
		const n = this.poles.length;
		const steel = standard( { name: 'light-poles', color: new Color( 0.35, 0.36, 0.37 ), roughness: 0.5, metalness: 0.7 } );
		// ---- L: the lots' heads metal halide, the streets' sodium
		const lamp = standard( { name: 'pole-lamps', color: new Color( 0.3, 0.3, 0.28 ), roughness: 0.4,
			varyings: { vHalide: 'f32' }, vertex: `o.vHalide = select( 0.0, 1.0, v.instance < ${ lotPoles }u );`,
			surface: `s.emissive = mix( vec3f( ${ SODIUM.join( ', ' ) } ), vec3f( ${ HALIDE.join( ', ' ) } ) * 1.4, in.vs.vHalide ) * smoothstep( 0.2, 0.8, frame.night ) * 12.0;` } );
		const pm = new InstancedMesh( pole.geometry(), steel, n ), hm = new InstancedMesh( heads.geometry(), lamp, n );
		const m = new Matrix4(), q = new Quaternion(), up = new Vector3( 0, 1, 0 ), sc = new Vector3();
		this.poles.forEach( ( [ x, y, z, h ], i ) => {

			q.setFromAxisAngle( up, hash( x * 0.37 + z ) * 3.14 );
			m.compose( new Vector3( x, y, z ), q, sc.set( 1, h, 1 ) );
			pm.setMatrixAt( i, m );
			hm.setMatrixAt( i, m );

		} );
		for ( const [ mesh, mat, name ] of [ [ pm, steel, 'poles' ], [ hm, lamp, 'pole-heads' ] ] ) {

			mat.underwaterLighting = 'none';
			mesh.name = name;
			mesh.castShadow = mat === steel;
			mesh.frustumCulled = false;
			this.group.add( mesh );

		}

		this.poleCount = n;

	}

	// ---------------------------------------------------------------- the other venues, 2008

	_footprint( name ) {

		return NEIGHBOURS.find( ( n ) => n.name === name )?.fp;

	}

	// Lincoln Financial Field: the bowl in silver panels and glass, the seats, the turf, and its two
	// great canopies over the sidelines
	_linc() {

		const fp = this._footprint( 'Lincoln Financial Field' );
		if ( ! fp ) return;
		// its axes: the long one (the field's length) from the footprint's spread
		const cx = fp.reduce( ( a, p ) => a + p[ 0 ], 0 ) / fp.length, cz = fp.reduce( ( a, p ) => a + p[ 1 ], 0 ) / fp.length;
		let sxx = 0, szz = 0, sxz = 0;
		for ( const [ x, z ] of fp ) {

			sxx += ( x - cx ) ** 2; szz += ( z - cz ) ** 2; sxz += ( x - cx ) * ( z - cz );

		}

		const ang = 0.5 * Math.atan2( 2 * sxz, sxx - szz );
		const ax = [ Math.cos( ang ), Math.sin( ang ) ], bx = [ - ax[ 1 ], ax[ 0 ] ];
		let A = 0, Bm = 0;
		for ( const [ x, z ] of fp ) {

			A = Math.max( A, Math.abs( ( x - cx ) * ax[ 0 ] + ( z - cz ) * ax[ 1 ] ) );
			Bm = Math.max( Bm, Math.abs( ( x - cx ) * bx[ 0 ] + ( z - cz ) * bx[ 1 ] ) );

		}

		const at = ( a, b, y ) => [ cx + ax[ 0 ] * a + bx[ 0 ] * b, y, cz + ax[ 1 ] * a + bx[ 1 ] * b ];
		// a rounded rectangle ring, r(t) from the half axes
		const N = 72;
		const ring = ( ha, hb, y, p = 4 ) => {

			const out = [];
			for ( let i = 0; i < N; i ++ ) {

				const t = i / N * Math.PI * 2, c = Math.cos( t ), s = Math.sin( t );
				out.push( at( ha * Math.sign( c ) * Math.abs( c ) ** ( 2 / p ), hb * Math.sign( s ) * Math.abs( s ) ** ( 2 / p ), y ) );

			}

			return out;

		};

		const shell = new Builder(), seats = new Builder(), turf = new Builder(), roof = new Builder();
		const G = STREET;
		const outerLo = ring( A * 0.97, Bm * 0.97, G ), outerHi = ring( A * 0.97, Bm * 0.97, G + 30 );
		const rim = ring( A * 0.9, Bm * 0.88, G + 32 ), inner = ring( 62, 38, G + 1.5 ), field = ring( 60, 36, G + 0.2, 8 );
		const cxy = [ cx, G + 15, cz ];
		for ( let i = 0; i < N; i ++ ) {

			const j = ( i + 1 ) % N;
			const out = [ outerLo[ i ][ 0 ] - cx, 0, outerLo[ i ][ 2 ] - cz ];
			shell.quad( outerLo[ i ], outerLo[ j ], outerHi[ j ], outerHi[ i ], out, [ i, 0, i + 1, 30 ] );
			shell.quad( outerHi[ i ], outerHi[ j ], rim[ j ], rim[ i ], [ out[ 0 ], 40, out[ 2 ] ], [ i, 30, i + 1, 32 ] );
			// the bowl: seats from the rim down to the field
			seats.quad( rim[ i ], rim[ j ], inner[ j ], inner[ i ], [ cxy[ 0 ] - rim[ i ][ 0 ], 60, cxy[ 2 ] - rim[ i ][ 2 ] ], [ i, 0, i + 1, 1 ] );
			turf.tri( field[ i ], field[ j ], [ cx, G + 0.2, cz ], [ 0, 1, 0 ] );
			seats.quad( inner[ i ], inner[ j ], field[ j ], field[ i ], [ 0, 1, 0 ] );

		}

		// the two canopies: lens-shaped wings over the sidelines, rising toward the field
		for ( const side of [ - 1, 1 ] ) {

			const M = 24;
			for ( let i = 0; i < M; i ++ ) {

				const a0 = - A * 0.75 + A * 1.5 * i / M, a1 = - A * 0.75 + A * 1.5 * ( i + 1 ) / M;
				const w = ( a ) => 1 - ( a / ( A * 0.78 ) ) ** 2;
				const P = ( a, k ) => at( a, side * ( Bm * 0.9 - k * 36 * w( a ) ), G + 34 + k * 10 * w( a ) );
				roof.quad( P( a0, 0 ), P( a1, 0 ), P( a1, 1 ), P( a0, 1 ), [ 0, 1, 0 ] );
				roof.quad( P( a0, 0 ), P( a1, 0 ), P( a1, 1 ), P( a0, 1 ), [ 0, - 1, 0 ] );

			}

			// the masts at each end that hold it up
			for ( const e of [ - 1, 1 ] ) beam( shell, at( e * A * 0.8, side * Bm * 0.95, G ), at( e * A * 0.72, side * Bm * 0.9, G + 58 ), 1.4 );

		}

		this._add( shell.geometry(), standard( { name: 'linc-shell', color: new Color( 0.55, 0.57, 0.6 ), roughness: 0.35, metalness: 0.5, modules: [ commonModule ],
			surface: /* wgsl */`
	// silver panels with bands of glass. (CB-14, gauntlet r1: on the 27th and 29th the Linc hosted nothing
	// and stood dark, a silver shell with a few lit windows, not a stack of glowing rings: Flickr rdowens
	// 3626081771 for the shell. A window in ten or so lit, the rest dark glass)
	let v = in.uv.y;
	let glass = step( 0.5, fract( v / 6.0 ) ) * step( v, 29.0 ) * step( 2.0, v );
	s.albedo = mix( mat.color, vec3f( 0.05, 0.07, 0.08 ), glass );
	s.roughness = mix( 0.4, 0.1, glass );
	let wid = floor( vec3f( in.P.x / 4.5, v / 6.0, in.P.z / 4.5 ) );
	let lit = step( 0.9, fract( sin( dot( wid, vec3f( 12.9898, 78.233, 37.719 ) ) ) * 43758.5453 ) );
	s.emissive = vec3f( 0.9, 0.85, 0.75 ) * glass * ( 0.012 + 0.3 * lit ) * smoothstep( 0.2, 0.8, frame.night );
` } ), 'linc-shell', { cast: true } );
		this._add( seats.geometry(), standard( { name: 'linc-seats', color: new Color( 0.12, 0.14, 0.15 ), roughness: 0.7, modules: [ commonModule ],
			surface: 's.albedo = mat.color * ( 0.8 + 0.4 * step( 0.5, fract( in.P.y / 0.9 ) ) );' } ), 'linc-bowl' );
		this._add( turf.geometry(), standard( { name: 'linc-turf', color: new Color( 0.12, 0.28, 0.07 ), roughness: 0.9 } ), 'linc-turf' );
		this._add( roof.geometry(), standard( { name: 'linc-canopy', color: new Color( 0.7, 0.72, 0.72 ), roughness: 0.5, metalness: 0.3, side: 'double' } ), 'linc-canopies', { cast: true } );

	}

	// the Wachovia Center (1996): a squared drum in brick and dark glass under a flat roof, its name on top
	_wachovia() {

		const fp = this._footprint( 'Xfinity Mobile Arena' );
		if ( ! fp ) return;
		const b = new Builder(), r = new Builder();
		const H = 32, G = STREET;
		let u = 0;
		for ( let i = 0; i < fp.length; i ++ ) {

			const [ ax, az ] = fp[ i ], [ bx, bz ] = fp[ ( i + 1 ) % fp.length ];
			const len = Math.hypot( bx - ax, bz - az );
			if ( len < 0.1 ) continue;
			let nx = ( bz - az ) / len, nz = - ( bx - ax ) / len;
			if ( inside( ( ax + bx ) / 2 + nx * 0.1, ( az + bz ) / 2 + nz * 0.1, fp ) ) {

				nx = - nx; nz = - nz;

			}

			b.quad( [ ax, G, az ], [ bx, G, bz ], [ bx, G + H, bz ], [ ax, G + H, az ], [ nx, 0, nz ], [ u, 0, u + len, H ] );
			u += len;

		}

		for ( const [ i, j, k ] of triangles( fp ) ) {

			const v = ( q ) => [ fp[ q ][ 0 ], G + H, fp[ q ][ 1 ] ];
			r.tri( v( i ), v( j ), v( k ), [ 0, 1, 0 ] );

		}

		const sign = canvasTexture( 1024, 128, ( ctx, w, h ) => {

			ctx.fillStyle = '#12161c';
			ctx.fillRect( 0, 0, w, h );
			ctx.fillStyle = '#ffffff';
			ctx.font = '800 78px "Helvetica Neue", Arial, sans-serif';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText( 'WACHOVIA CENTER', w / 2, h / 2 + 4 );

		}, 'wachovia' );
		this._add( b.geometry(), standard( { name: 'wachovia-walls', color: new Color( 0.32, 0.14, 0.1 ), roughness: 0.7, textures: { bpWach: sign }, modules: [ commonModule ],
			surface: /* wgsl */`
	let v = in.uv.y;
	// brick base, a band of dark glass, precast above, the name in a band near the top (repeating round)
	var c = mat.color * ( 0.85 + 0.2 * mx_noise_float2( in.P.xz * 0.6 + v ) );
	let glass = step( 6.0, v ) * step( v, 14.0 );
	c = mix( c, vec3f( 0.04, 0.05, 0.06 ), glass );
	if ( v > 14.0 ) { c = vec3f( 0.5, 0.48, 0.44 ); }
	var e = vec3f( 0.0 );
	if ( v > 24.0 && v < 29.0 ) {
		let t = textureSample( bpWach, smpAnisoRepeat, vec2f( in.uv.x / 60.0, 1.0 - ( v - 24.0 ) / 5.0 ) ).rgb;
		c = t * 0.8;
		e = t * step( 0.5, t.r ) * smoothstep( 0.2, 0.8, frame.night ) * 1.5;
	}
	s.albedo = c;
	s.emissive = e + vec3f( 0.9, 0.8, 0.6 ) * glass * smoothstep( 0.2, 0.8, frame.night ) * 0.35;
` } ), 'wachovia-center', { cast: true } );
		this._add( r.geometry(), standard( { name: 'wachovia-roof', color: new Color( 0.45, 0.45, 0.44 ), roughness: 0.8 } ), 'wachovia-roof' );

	}

	// the Spectrum (1967-2010): the round arena at Broad and Pattison, ribbed precast walls under a band
	// and a shallow roof, "WACHOVIA SPECTRUM" round the top
	_spectrum() {

		const c = [ - 349, 223 ], R = 58, H = 22, G = STREET, N = 64;
		const b = new Builder(), r = new Builder();
		for ( let i = 0; i < N; i ++ ) {

			const t0 = i / N * Math.PI * 2, t1 = ( i + 1 ) / N * Math.PI * 2;
			const p = ( t, rr, y ) => [ c[ 0 ] + Math.cos( t ) * rr, y, c[ 1 ] + Math.sin( t ) * rr ];
			const n = [ Math.cos( ( t0 + t1 ) / 2 ), 0, Math.sin( ( t0 + t1 ) / 2 ) ];
			const s0 = t0 * R, s1 = t1 * R;
			b.quad( p( t0, R, G ), p( t1, R, G ), p( t1, R, G + H ), p( t0, R, G + H ), n, [ s0, 0, s1, H ] );
			// the roof rises gently to the middle
			r.tri( p( t0, R, G + H ), p( t1, R, G + H ), [ c[ 0 ], G + H + 6, c[ 1 ] ], [ 0, 1, 0 ] );

		}

		const sign = canvasTexture( 1024, 128, ( ctx, w, h ) => {

			ctx.fillStyle = '#3a2418';
			ctx.fillRect( 0, 0, w, h );
			ctx.fillStyle = '#f2ede1';
			ctx.font = '800 64px "Helvetica Neue", Arial, sans-serif';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText( 'WACHOVIA SPECTRUM', w / 2, h / 2 + 4 );

		}, 'spectrum' );
		this._add( b.geometry(), standard( { name: 'spectrum-walls', color: new Color( 0.6, 0.56, 0.48 ), roughness: 0.75, textures: { bpSpec: sign }, modules: [ commonModule ],
			surface: /* wgsl */`
	let v = in.uv.y;
	// vertical ribs every 3 m
	let rib = 1.0 - smoothstep( 0.0, 0.1, abs( fract( in.uv.x / 3.0 ) - 0.5 ) - 0.38 );
	var c = mat.color * ( 0.8 + 0.2 * rib ) * ( 0.9 + 0.12 * mx_noise_float2( in.P.xz * 0.5 + v ) );
	var e = vec3f( 0.0 );
	if ( v < 4.0 ) { c = vec3f( 0.06, 0.07, 0.08 ); e = vec3f( 0.9, 0.8, 0.6 ) * smoothstep( 0.2, 0.8, frame.night ) * 0.3; }
	if ( v > 17.0 ) {
		// (C2W-9, FW2: u runs anticlockwise round the drum, so from outside the name read backwards)
		let t = textureSample( bpSpec, smpAnisoRepeat, vec2f( - in.uv.x / 90.0, 1.0 - ( v - 17.0 ) / 5.0 ) ).rgb;
		c = t * 0.8;
		e = t * step( 0.6, t.r ) * smoothstep( 0.2, 0.8, frame.night ) * 1.2;
	}
	s.albedo = c;
	s.emissive = e;
` } ), 'spectrum', { cast: true } );
		this._add( r.geometry(), standard( { name: 'spectrum-roof', color: new Color( 0.62, 0.62, 0.6 ), roughness: 0.8 } ), 'spectrum-roof' );

	}

}
