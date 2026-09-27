import { Mesh, Color, Vector3 } from '../../../engine/index.js';
import { ShaderModule } from '../../../engine/gpu/Shader.js';
import { commonModule } from '../../../engine/render/wgsl/common.js';
import { standard } from '../../../materials/Materials.js';
import { canvasTexture } from '../../geo.js';
import { LEVELS } from '../../layout.js';
import { Mesher } from './Mesher.js';
import { SIGNAL_WGSL } from './Signals.js';

// The street's edge at 11th and Pattison, as in the photos of 2007-08 (newballpark.org June 2008,
// Flickr pingnews 2007 and talialeone July 2008, Getty 27 Oct 2008): concrete sidewalks raised on a
// curb, a concrete gutter pan along it (the rain running in it on the 27th), wide white ladder
// crosswalks with the curb ramped down to them and a red panel of truncated domes, stop bars, lane
// lines; yellow signal heads on black backplates hung from mast arms over the lanes at the four corners
// of the intersection with the green street-name signs, the pedestrian heads (the orange hand, the
// white walking man), and the mid-block signal across Pattison in front of the statue; black round
// bins, a galvanized bike-rack barricade or two along the curb, the TEAM STORE sandwich board.
//
// The plaza and the sidewalks stand LIFT above the road (the plaza's paving is raised to meet them).

const STREET = LEVELS.mainConcourse;
export const LIFT = 0.15;

// the streets' centre lines (OpenStreetMap, data/surroundings.js): Pattison's z at x, 11th's x at z
export const pattisonZ = ( x ) => x > - 62 ? 119.2 - ( x + 62 ) * 1.2 / 101 : x > - 146 ? 120.2 - ( x + 146 ) / 84 : 120.2 + ( - 146 - x ) * 0.3 / 21;
export const eleventhX = ( z ) => z < 98 ? - 148 + ( z + 29 ) / 127 * 2 : z < 120 ? - 146 : - 146 + ( z - 120 ) / 23;
const PH = 9, EH = 5; // their half widths
const R = 4.0; // the corners' curb radius

// the crosswalks: [ which street, where along it, width ]
export const CROSSWALKS = [
	{ street: 'pattison', at: - 134.2, w: 4 }, // at the corner, east of 11th
	{ street: 'eleventh', at: 104.6, w: 4 }, // across 11th, north of Pattison
	{ street: 'pattison', at: - 104, w: 4 }, // mid-block, in front of the statue (its own signal)
];

export function buildStreet( group, colliders, field ) {

	const concrete = new Mesher(), gutter = new Mesher(), paint = new Mesher(), domes = new Mesher();
	const y = ( h ) => STREET + h;
	// ---- a raised strip along a curb: the curb line points [ x, z ], the inward normal at each, the
	// sidewalk's width at each; ramps where a crosswalk meets it (the curb down to the road, flared)
	const strip = ( curb, inward, width, street ) => {

		const rampAt = ( p ) => {

			// how far down the curb is here: 1 in a ramp, 0 outside, a flare between
			let k = 0;
			for ( const X of CROSSWALKS ) {

				if ( X.street !== street ) continue;
				const d = street === 'pattison' ? Math.abs( p[ 0 ] - X.at ) : Math.abs( p[ 1 ] - X.at );
				k = Math.max( k, 1 - Math.max( 0, Math.min( 1, ( d - X.w / 2 + 0.15 ) / 0.9 ) ) );

			}

			return k;

		};

		let along = 0;
		const rows = curb.map( ( c, i ) => {

			if ( i > 0 ) along += Math.hypot( c[ 0 ] - curb[ i - 1 ][ 0 ], c[ 1 ] - curb[ i - 1 ][ 1 ] );
			const n = inward[ i ], W = width[ i ], k = rampAt( c );
			// the curb's top at the line, the ramp 1.4 m back up to the sidewalk, the sidewalk to its back
			const hc = LIFT * ( 1 - k ) + 0.012 * k;
			const p0 = c, p1 = [ c[ 0 ] + n[ 0 ] * 1.4, c[ 1 ] + n[ 1 ] * 1.4 ], p2 = [ c[ 0 ] + n[ 0 ] * W, c[ 1 ] + n[ 1 ] * W ];
			return { k, along, verts: [
				concrete.v( [ p0[ 0 ], y( hc ), p0[ 1 ] ], [ 0, 1, 0 ], [ along, 0 ] ),
				concrete.v( [ p1[ 0 ], y( LIFT ), p1[ 1 ] ], [ 0, 1, 0 ], [ along, 1.4 ] ),
				concrete.v( [ p2[ 0 ], y( LIFT ), p2[ 1 ] ], [ 0, 1, 0 ], [ along, W ] ),
			], face: [
				concrete.v( [ p0[ 0 ], y( hc ), p0[ 1 ] ], [ - n[ 0 ], 0, - n[ 1 ] ], [ along, - 0.001 ] ),
				concrete.v( [ p0[ 0 ], y( 0.004 ), p0[ 1 ] ], [ - n[ 0 ], 0, - n[ 1 ] ], [ along, - hc ] ),
			], c, n };

		} );
		for ( let i = 0; i < rows.length - 1; i ++ ) {

			const A = rows[ i ], B = rows[ i + 1 ];
			concrete.quad( A.verts[ 0 ], B.verts[ 0 ], B.verts[ 1 ], A.verts[ 1 ] );
			concrete.quad( A.verts[ 1 ], B.verts[ 1 ], B.verts[ 2 ], A.verts[ 2 ] );
			concrete.quad( A.face[ 1 ], B.face[ 1 ], B.face[ 0 ], A.face[ 0 ] );
			// the gutter pan on the road side, 0.45 m of concrete
			const g = ( r, o ) => [ r.c[ 0 ] - r.n[ 0 ] * o, y( 0.01 ), r.c[ 1 ] - r.n[ 1 ] * o ];
			gutter.face( g( A, 0 ), g( B, 0 ), g( B, 0.45 ), g( A, 0.45 ), [ 0, 1, 0 ], [ [ A.along, 0 ], [ B.along, 0 ], [ B.along, 0.45 ], [ A.along, 0.45 ] ] );
			// the domes at a ramp's foot
			if ( A.k > 0.99 && B.k > 0.99 ) {

				const d = ( r, o ) => [ r.c[ 0 ] + r.n[ 0 ] * o, y( 0.012 + ( LIFT - 0.012 ) * o / 1.4 + 0.004 ), r.c[ 1 ] + r.n[ 1 ] * o ];
				domes.face( d( A, 0.05 ), d( B, 0.05 ), d( B, 0.66 ), d( A, 0.66 ), [ 0, 1, 0 ], [ [ A.along, 0 ], [ B.along, 0 ], [ B.along, 0.61 ], [ A.along, 0.61 ] ] );

			}

		}

	};

	// points along a straight curb from a to b, a vertex every ~1.2 m and at every crosswalk's edges
	const line = ( a, b, street ) => {

		const L = Math.hypot( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ] ), ts = new Set();
		const n = Math.max( 1, Math.round( L / 1.2 ) );
		for ( let i = 0; i <= n; i ++ ) ts.add( i / n );
		for ( const X of CROSSWALKS ) {

			if ( X.street !== street ) continue;
			for ( const e of [ - X.w / 2 - 0.9, - X.w / 2 + 0.15, X.w / 2 - 0.15, X.w / 2 + 0.9 ] ) {

				const v = X.at + e;
				const t = street === 'pattison' ? ( v - a[ 0 ] ) / ( b[ 0 ] - a[ 0 ] ) : ( v - a[ 1 ] ) / ( b[ 1 ] - a[ 1 ] );
				if ( t > 0 && t < 1 ) ts.add( t );

			}

		}

		return [ ...ts ].sort( ( p, q ) => p - q ).map( ( t ) => [ a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * t, a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * t ] );

	};

	const arc = ( c, r, a0, a1, n = 8 ) => Array.from( { length: n + 1 }, ( _, i ) => {

		const q = a0 + ( a1 - a0 ) * i / n;
		return [ c[ 0 ] + Math.cos( q ) * r, c[ 1 ] + Math.sin( q ) * r ];

	} );

	// the four corners of 11th and Pattison
	const zN = ( x ) => pattisonZ( x ) - PH, zS = ( x ) => pattisonZ( x ) + PH;
	const xE = ( z ) => eleventhX( z ) + EH, xW = ( z ) => eleventhX( z ) - EH;
	const NE = [ xE( 111 ), zN( - 141 ) ], SE = [ xE( 129 ), zS( - 141 ) ], NW = [ xW( 111 ), zN( - 151 ) ];
	// the north side of Pattison (the plaza's), from the corner east to beyond the ticket windows
	{

		const a = [ NE[ 0 ] + R, zN( NE[ 0 ] + R ) ], m = [ - 71.6, zN( - 71.6 ) ], b = [ - 17, zN( - 17 ) ];
		const p1 = line( a, m, 'pattison' ), p2 = line( m, b, 'pattison' ).slice( 1 );
		const pts = [ ...p1, ...p2 ];
		strip( pts, pts.map( () => [ 0, - 1 ] ), pts.map( ( p ) => p[ 1 ] - ( p[ 0 ] < - 71.6 ? 97.8 : 91.7 ) ), 'pattison' );
		// the corner: round from 11th to Pattison, filled in to the plaza's corner
		const c = [ NE[ 0 ] + R, NE[ 1 ] - R ];
		const ap = arc( c, R, Math.PI, Math.PI / 2 );
		const pc = [ - 132.8, 97.8 ], toPc = ( p ) => { const l = Math.hypot( pc[ 0 ] - p[ 0 ], pc[ 1 ] - p[ 1 ] ); return [ ( pc[ 0 ] - p[ 0 ] ) / l, ( pc[ 1 ] - p[ 1 ] ) / l ]; };
		strip( ap, ap.map( toPc ), ap.map( ( p ) => Math.hypot( p[ 0 ] - pc[ 0 ], p[ 1 ] - pc[ 1 ] ) ), 'corner' );
		// the east side of 11th, up to the corner (the plaza's west edge; past it, the facade)
		const e0 = [ xE( - 15 ), - 15 ], e1 = [ xE( 11.8 ), 11.8 ], e2 = [ xE( c[ 1 ] ), c[ 1 ] ];
		const q1 = line( e0, e1, 'eleventh' ), q2 = line( e1, e2, 'eleventh' ).slice( 1 );
		const qs = [ ...q1, ...q2 ];
		strip( qs, qs.map( () => [ 1, 0 ] ), qs.map( ( p ) => ( p[ 1 ] < 11.8 ? - 127 : - 132.8 ) - p[ 0 ] ), 'eleventh' );

	}

	// the far sides: the south side of Pattison (5 m, the lot's trees behind), the west side of 11th
	{

		const c = [ SE[ 0 ] + R, SE[ 1 ] + R ];
		const ap = arc( c, R, Math.PI, Math.PI * 1.5 );
		strip( ap, ap.map( ( p ) => [ ( c[ 0 ] - p[ 0 ] ) / R, ( c[ 1 ] - p[ 1 ] ) / R ] ), ap.map( () => R ), 'corner' );
		const pts = line( [ c[ 0 ], zS( c[ 0 ] ) ], [ - 17, zS( - 17 ) ], 'pattison' );
		strip( pts, pts.map( () => [ 0, 1 ] ), pts.map( () => 5.2 ), 'pattison' );
		const c2 = [ NW[ 0 ] - R, NW[ 1 ] - R ];
		const aw = arc( c2, R, 0, Math.PI / 2 );
		strip( aw, aw.map( ( p ) => [ ( c2[ 0 ] - p[ 0 ] ) / R, ( c2[ 1 ] - p[ 1 ] ) / R ] ), aw.map( () => R ), 'corner' );
		const ws = line( [ xW( c2[ 1 ] ), c2[ 1 ] ], [ xW( - 15 ), - 15 ], 'eleventh' );
		strip( ws, ws.map( () => [ - 1, 0 ] ), ws.map( () => 8.6 ), 'eleventh' );
		// the corner of Pattison's west leg, south side
		const c3 = [ xW( 129 ) - R, zS( - 151 ) + R ];
		const as = arc( c3, R, - Math.PI / 2, 0 );
		strip( as, as.map( ( p ) => [ ( c3[ 0 ] - p[ 0 ] ) / R, ( c3[ 1 ] - p[ 1 ] ) / R ] ), as.map( () => R ), 'corner' );

	}

	// ---- the paint: the ladder crosswalks, the stop bars, the lane lines
	const bar = ( a, b, w ) => {

		const dx = b[ 0 ] - a[ 0 ], dz = b[ 1 ] - a[ 1 ], l = Math.hypot( dx, dz ), sx = - dz / l * w / 2, sz = dx / l * w / 2;
		paint.face( [ a[ 0 ] - sx, y( 0.014 ), a[ 1 ] - sz ], [ b[ 0 ] - sx, y( 0.014 ), b[ 1 ] - sz ], [ b[ 0 ] + sx, y( 0.014 ), b[ 1 ] + sz ], [ a[ 0 ] + sx, y( 0.014 ), a[ 1 ] + sz ], [ 0, 1, 0 ], [ [ 0, 0 ], [ l, 0 ], [ l, w ], [ 0, w ] ] );

	};

	for ( const X of CROSSWALKS ) {

		if ( X.street === 'pattison' ) {

			const x = X.at, z0 = zN( x ) + 0.5, z1 = zS( x ) - 0.5;
			bar( [ x - X.w / 2, z0 ], [ x - X.w / 2, z1 ], 0.3 );
			bar( [ x + X.w / 2, z0 ], [ x + X.w / 2, z1 ], 0.3 );
			for ( let z = z0 + 0.5; z < z1 - 0.3; z += 1.2 ) bar( [ x - X.w / 2, z ], [ x + X.w / 2, z ], 0.6 );
			// the stop bars, back from it on each side (westbound on the north half, eastbound on the south)
			bar( [ x + X.w / 2 + 2.2, zN( x ) + 0.3 ], [ x + X.w / 2 + 2.2, pattisonZ( x ) - 0.3 ], 0.6 );
			bar( [ x - X.w / 2 - 2.2, pattisonZ( x ) + 0.3 ], [ x - X.w / 2 - 2.2, zS( x ) - 0.3 ], 0.6 );

		} else {

			const z = X.at, x0 = xW( z ) + 0.5, x1 = xE( z ) - 0.5;
			bar( [ x0, z - X.w / 2 ], [ x1, z - X.w / 2 ], 0.3 );
			bar( [ x0, z + X.w / 2 ], [ x1, z + X.w / 2 ], 0.3 );
			for ( let x = x0 + 0.5; x < x1 - 0.3; x += 1.2 ) bar( [ x, z - X.w / 2 ], [ x, z + X.w / 2 ], 0.6 );
			// southbound traffic stops north of it (the west half)
			bar( [ xW( z ) + 0.3, z - X.w / 2 - 2.2 ], [ eleventhX( z ) - 0.3, z - X.w / 2 - 2.2 ], 0.6 );

		}

	}

	// the lane lines on Pattison (four lanes): dashed white 3 m in 12
	for ( let x = - 17; x > - 136; x -= 12 ) {

		if ( CROSSWALKS.some( ( X ) => X.street === 'pattison' && Math.abs( x - 1.5 - X.at ) < X.w / 2 + 3 ) ) continue;
		for ( const o of [ - 4.5, 4.5 ] ) bar( [ x, pattisonZ( x ) + o ], [ x - 3, pattisonZ( x - 3 ) + o ], 0.12 );

	}

	// ---- materials
	const sidewalk = standard( { name: 'w1-sidewalk', color: new Color( 0.42, 0.41, 0.38 ), roughness: 0.85, modules: [ commonModule ],
		surface: /* wgsl */`
	// uv: x along the curb (m), y in from its line (m; the curb's face below zero). Scored in 1.5 m squares,
	// the curb's top a band of its own with a joint behind it, stains, and the curb's face darker
	let p = in.uv;
	let fw = fwidth( p.x ) + 0.002;
	var c = mat.color * ( 0.9 + 0.12 * mx_noise_float2( in.P.xz * 0.4 ) + 0.05 * mx_noise_float2( in.P.xz * 5.0 ) );
	let jx = abs( fract( p.x / 1.5 ) - 0.5 ) * 1.5;
	let jy = abs( fract( ( p.y - 0.2 ) / 1.5 ) - 0.5 ) * 1.5;
	let joint = 1.0 - ( 1.0 - smoothstep( 0.004, 0.01 + fw, min( jx, jy ) ) ) * 0.35;
	if ( p.y > 0.2 ) { c = c * joint; }
	if ( p.y >= 0.0 && p.y < 0.2 ) { c = c * 1.08 * ( 1.0 - ( 1.0 - smoothstep( 0.004, 0.012 + fw, abs( p.y - 0.2 ) ) ) * 0.4 ); }
	if ( p.y < 0.0 ) { c = c * 0.75 * ( 0.9 + 0.2 * mx_noise_float2( in.P.xz * 3.0 + vec2f( in.P.y * 20.0 ) ) ); }
	// gum and old stains
	c = c * ( 1.0 - 0.14 * smoothstep( 0.4, 0.8, mx_noise_float2( in.P.xz * 0.6 ) ) );
	s.albedo = c;
` } );
	const gutterMat = standard( { name: 'w1-gutter', color: new Color( 0.36, 0.35, 0.33 ), roughness: 0.8, modules: [ commonModule ],
		surface: /* wgsl */`
	// the gutter pan: concrete, grimy along the curb; in the rain the water runs in it toward the inlets
	let p = in.uv;
	var c = mat.color * ( 0.8 + 0.25 * mx_noise_float2( in.P.xz * 2.0 ) ) * mix( 0.6, 1.0, smoothstep( 0.0, 0.2, p.y ) );
	let jx = abs( fract( p.x / 3.0 ) - 0.5 ) * 3.0;
	c = c * ( 1.0 - ( 1.0 - smoothstep( 0.005, 0.015, jx ) ) * 0.4 );
	let wet = frame.wet;
	let stream = smoothstep( 0.35, 0.0, p.y ) * wet;
	let flow = mx_noise_float2( vec2f( p.x * 3.0 - frame.time * 1.6, p.y * 12.0 ) );
	c = c * mix( 1.0, 0.45, stream );
	s.albedo = c;
	s.roughness = mix( mix( 0.8, 0.25, wet ), 0.03 + 0.05 * flow, stream );
` } );
	gutterMat.setDefine( 'DRY', 1 );
	const paintMat = standard( { name: 'w1-road-paint', color: new Color( 0.78, 0.78, 0.74 ), roughness: 0.6, modules: [ commonModule ],
		surface: /* wgsl */`
	// thermoplastic, worn by the tyres: patchy where they run, the asphalt showing through
	let wear = smoothstep( 0.1, 0.6, mx_noise_float2( in.P.xz * 1.3 ) ) * 0.5 + smoothstep( 0.55, 0.75, mx_noise_float2( in.P.xz * 9.0 ) ) * 0.4;
	s.albedo = mix( mat.color, vec3f( 0.1 ), wear * 0.6 );
` } );
	const domeMat = standard( { name: 'w1-domes', color: new Color( 0.32, 0.07, 0.05 ), roughness: 0.6, modules: [ commonModule ],
		surface: /* wgsl */`
	// truncated domes on a 5 cm grid: a little bright on each dome's top
	let g = abs( fract( in.uv / 0.05 ) - 0.5 ) * 0.05;
	let d = length( g );
	s.albedo = mat.color * mix( 1.25, 0.75, smoothstep( 0.008, 0.013, d ) );
` } );
	for ( const [ m, mat, name, cast ] of [ [ concrete, sidewalk, 'w1-sidewalks', true ], [ gutter, gutterMat, 'w1-gutters', false ], [ paint, paintMat, 'w1-road-paint', false ], [ domes, domeMat, 'w1-ramp-domes', false ] ] ) {

		mat.underwaterLighting = 'none';
		const mesh = new Mesh( m.geometry(), mat );
		mesh.name = name;
		mesh.castShadow = cast;
		mesh.receiveShadow = true;
		group.add( mesh );

	}

	// ---- the signals
	const signals = buildSignals( group, colliders, field, { NE, SE, NW, zN, zS, xE, xW } );
	return { heights: { LIFT }, signals, corners: { NE, SE, NW } };

}

// ---------------------------------------------------------------- signals, signs

const signalModule = new ShaderModule( { name: 'w1-signals', deps: [ commonModule ], code: SIGNAL_WGSL } );

function buildSignals( group, colliders, field, { NE, SE, NW, zN, zS, xE, xW } ) {

	const steel = new Mesher(), heads = new Mesher(), lenses = new Mesher(), signs = new Mesher();
	const y = ( h ) => STREET + LIFT + h;
	const pole = ( x, z, h, r = 0.13 ) => {

		steel.tube( [ [ x, y( 0 ), z ], [ x, y( h ), z ] ], [ r, r * 0.8 ], 10, { capB: true } );
		// the base: a cast collar
		steel.tube( [ [ x, y( - 0.02 ), z ], [ x, y( 0.45 ), z ] ], [ r * 1.6, r * 1.3 ], 10, { capB: true } );
		const w = field.toWorld( x, z );
		colliders.addCylinder( w.x, w.z, r * 1.3, field.y0 + STREET, field.y0 + STREET + h );

	};

	// a three-light head facing f ([ dx, dz ]), its centre at p ([ x, y, z ]), on controller ctrl
	const head = ( p, f, ctrl, backplate = true ) => {

		const s = [ - f[ 1 ], f[ 0 ] ];
		const P = ( a, b, h ) => [ p[ 0 ] + s[ 0 ] * a + f[ 0 ] * b, p[ 1 ] + h, p[ 2 ] + s[ 1 ] * a + f[ 1 ] * b ];
		// the housing: yellow, 0.33 x 1.05 x 0.25
		const box = ( a0, a1, b0, b1, h0, h1, m ) => {

			m.face( P( a0, b1, h0 ), P( a1, b1, h0 ), P( a1, b1, h1 ), P( a0, b1, h1 ), [ f[ 0 ], 0, f[ 1 ] ] );
			m.face( P( a1, b0, h0 ), P( a0, b0, h0 ), P( a0, b0, h1 ), P( a1, b0, h1 ), [ - f[ 0 ], 0, - f[ 1 ] ] );
			m.face( P( a1, b1, h0 ), P( a1, b0, h0 ), P( a1, b0, h1 ), P( a1, b1, h1 ), [ s[ 0 ], 0, s[ 1 ] ] );
			m.face( P( a0, b0, h0 ), P( a0, b1, h0 ), P( a0, b1, h1 ), P( a0, b0, h1 ), [ - s[ 0 ], 0, - s[ 1 ] ] );
			m.face( P( a0, b1, h1 ), P( a1, b1, h1 ), P( a1, b0, h1 ), P( a0, b0, h1 ), [ 0, 1, 0 ] );
			m.face( P( a0, b0, h0 ), P( a1, b0, h0 ), P( a1, b1, h0 ), P( a0, b1, h0 ), [ 0, - 1, 0 ] );

		};

		box( - 0.165, 0.165, - 0.12, 0.12, - 0.52, 0.52, heads );
		// the black backplate
		if ( backplate ) steel.face( P( - 0.3, - 0.13, - 0.64 ), P( 0.3, - 0.13, - 0.64 ), P( 0.3, - 0.13, 0.64 ), P( - 0.3, - 0.13, 0.64 ), [ f[ 0 ], 0, f[ 1 ] ] );
		for ( let k = 0; k < 3; k ++ ) {

			const h = 0.34 - k * 0.34;
			// the lens (uv: its colour, its controller), a visor over it
			const c = lenses.v( P( 0, 0.125, h ), [ f[ 0 ], 0, f[ 1 ] ], [ k, ctrl ] );
			const ring = [];
			for ( let i = 0; i <= 12; i ++ ) {

				const q = i / 12 * Math.PI * 2;
				ring.push( lenses.v( P( Math.cos( q ) * 0.1, 0.125, h + Math.sin( q ) * 0.1 ), [ f[ 0 ], 0, f[ 1 ] ], [ k, ctrl ] ) );

			}

			for ( let i = 0; i < 12; i ++ ) lenses.tri( c, ring[ i ], ring[ i + 1 ] );
			for ( let i = 0; i < 6; i ++ ) {

				const q0 = i / 6 * Math.PI, q1 = ( i + 1 ) / 6 * Math.PI;
				heads.face( P( Math.cos( q0 ) * 0.12, 0.12, h + Math.sin( q0 ) * 0.12 ), P( Math.cos( q1 ) * 0.12, 0.12, h + Math.sin( q1 ) * 0.12 ), P( Math.cos( q1 ) * 0.12, 0.34, h + Math.sin( q1 ) * 0.12 ), P( Math.cos( q0 ) * 0.12, 0.34, h + Math.sin( q0 ) * 0.12 ), [ 0, 1, 0 ] );

			}

		}

	};

	// a pedestrian head: the hand over the man, facing f, on crossing `which`
	const walkHead = ( p, f, which ) => {

		const s = [ - f[ 1 ], f[ 0 ] ];
		const P = ( a, b, h ) => [ p[ 0 ] + s[ 0 ] * a + f[ 0 ] * b, p[ 1 ] + h, p[ 2 ] + s[ 1 ] * a + f[ 1 ] * b ];
		heads.box( [ p[ 0 ], p[ 1 ], p[ 2 ] ], [ 0.34, 0.62, 0.34 ] );
		for ( let k = 0; k < 2; k ++ ) {

			const h = 0.14 - k * 0.28, w = 0.13;
			lenses.face( P( - w, 0.175, h - w ), P( w, 0.175, h - w ), P( w, 0.175, h + w ), P( - w, 0.175, h + w ), [ f[ 0 ], 0, f[ 1 ] ], [ [ 3 + k + 0.0, which ], [ 3 + k + 0.999, which ], [ 3 + k + 0.999, which + 0.999 ], [ 3 + k + 0.0, which + 0.999 ] ] );

		}

	};

	// a mast arm from a pole at base ([ x, z ]) reaching along dir ([ dx, dz ]) L metres, the heads on it
	// at the given reaches, facing f; the street's name on it
	const mast = ( base, dir, L, reaches, f, ctrl, name ) => {

		pole( base[ 0 ], base[ 1 ], 7.2, 0.16 );
		const tip = [ base[ 0 ] + dir[ 0 ] * L, base[ 1 ] + dir[ 1 ] * L ];
		steel.tube( [ [ base[ 0 ], y( 6.6 ), base[ 1 ] ], [ base[ 0 ] + dir[ 0 ] * L * 0.5, y( 6.75 ), base[ 1 ] + dir[ 1 ] * L * 0.5 ], [ tip[ 0 ], y( 6.85 ), tip[ 1 ] ] ], [ 0.12, 0.09, 0.06 ], 8, { capB: true } );
		// a tie rod up to the pole's top
		steel.tube( [ [ base[ 0 ], y( 7.15 ), base[ 1 ] ], [ base[ 0 ] + dir[ 0 ] * L * 0.55, y( 6.8 ), base[ 1 ] + dir[ 1 ] * L * 0.55 ] ], [ 0.025, 0.025 ], 5 );
		for ( const r of reaches ) {

			const p = [ base[ 0 ] + dir[ 0 ] * r, y( 6.05 ), base[ 1 ] + dir[ 1 ] * r ];
			steel.tube( [ [ p[ 0 ], y( 6.6 ), p[ 2 ] ], [ p[ 0 ], y( 6.8 ), p[ 2 ] ] ], [ 0.03, 0.03 ], 5 );
			head( p, f, ctrl );

		}

		// the green street-name sign on the arm, between the pole and the first head
		const r0 = Math.max( 1.2, reaches[ 0 ] - 1.6 );
		const c = [ base[ 0 ] + dir[ 0 ] * r0, base[ 1 ] + dir[ 1 ] * r0 ];
		const w = 0.9, h0 = y( 6.35 ), h1 = y( 6.7 );
		const i = SIGN_NAMES.indexOf( name );
		for ( const side of [ 1, - 1 ] ) {

			const n = [ f[ 0 ] * side, f[ 1 ] * side ];
			const P0 = [ c[ 0 ] - dir[ 0 ] * w + n[ 0 ] * 0.03, c[ 1 ] - dir[ 1 ] * w + n[ 1 ] * 0.03 ], P1 = [ c[ 0 ] + dir[ 0 ] * w + n[ 0 ] * 0.03, c[ 1 ] + dir[ 1 ] * w + n[ 1 ] * 0.03 ];
			const right = dir[ 0 ] * n[ 1 ] - dir[ 1 ] * n[ 0 ] > 0; // the text runs along dir when it points to your right as you face the sign
			const v0 = i / SIGN_NAMES.length, v1 = ( i + 1 ) / SIGN_NAMES.length;
			const [ ua, ub ] = right ? [ 0, 1 ] : [ 1, 0 ];
			signs.face( [ P0[ 0 ], h0, P0[ 1 ] ], [ P1[ 0 ], h0, P1[ 1 ] ], [ P1[ 0 ], h1, P1[ 1 ] ], [ P0[ 0 ], h1, P0[ 1 ] ], [ n[ 0 ], 0, n[ 1 ] ], [ [ ua, v1 ], [ ub, v1 ], [ ub, v0 ], [ ua, v0 ] ] );

		}

	};

	// the intersection: a mast arm at each corner over the lanes coming toward it (far-side signals);
	// the pedestrian heads on the poles, across each crosswalk
	const ne = [ NE[ 0 ] + 1.1, NE[ 1 ] - 1.1 ], se = [ SE[ 0 ] + 1.1, SE[ 1 ] + 1.1 ], nw = [ NW[ 0 ] - 1.1, NW[ 1 ] - 1.1 ], sw = [ nw[ 0 ], se[ 1 ] ];
	mast( ne, [ - 1, 0 ], 6.2, [ 3.4, 5.6 ], [ 0, 1 ], 1, 'Pattison Av' ); // northbound 11th
	mast( se, [ 0, - 1 ], 8.5, [ 4.2, 7.6 ], [ - 1, 0 ], 0, 'S 11th St' ); // eastbound Pattison
	mast( nw, [ 0, 1 ], 8.5, [ 4.2, 7.6 ], [ 1, 0 ], 0, 'S 11th St' ); // westbound Pattison
	mast( sw, [ 1, 0 ], 6.2, [ 3.4, 5.6 ], [ 0, - 1 ], 1, 'Pattison Av' ); // southbound 11th
	for ( const [ c, fs ] of [ [ ne, [ [ 0, 1, 0 ], [ - 1, 0, 1 ] ] ], [ se, [ [ 0, - 1, 0 ] ] ], [ nw, [ [ 1, 0, 1 ] ] ] ] ) {

		for ( const [ fx, fz, which ] of fs ) walkHead( [ c[ 0 ] + fx * 0.25, y( 2.9 ), c[ 1 ] + fz * 0.25 ], [ fx, fz ], which );

	}

	// the mid-block crossing in front of the statue: a pole each side with a head for each direction's
	// lanes and the walk heads
	const xm = CROSSWALKS[ 2 ].at;
	const pn = [ xm - 3.4, zN( xm ) - 1.0 ], ps = [ xm + 3.4, zS( xm ) + 1.0 ];
	pole( pn[ 0 ], pn[ 1 ], 4.4 );
	pole( ps[ 0 ], ps[ 1 ], 4.4 );
	head( [ pn[ 0 ] + 0.25, y( 3.7 ), pn[ 1 ] ], [ 1, 0 ], 2 );
	head( [ ps[ 0 ] - 0.25, y( 3.7 ), ps[ 1 ] ], [ - 1, 0 ], 2 );
	walkHead( [ pn[ 0 ], y( 2.6 ), pn[ 1 ] + 0.25 ], [ 0, 1 ], 2 );
	walkHead( [ ps[ 0 ], y( 2.6 ), ps[ 1 ] - 0.25 ], [ 0, - 1 ], 2 );

	const signTex = canvasTexture( 256, 32 * SIGN_NAMES.length, ( ctx, w, h ) => {

		SIGN_NAMES.forEach( ( name, i ) => {

			const y0 = i * 32;
			ctx.fillStyle = '#0f6b3c'; ctx.fillRect( 0, y0, w, 32 );
			ctx.strokeStyle = '#f2f2ea'; ctx.lineWidth = 2; ctx.strokeRect( 3, y0 + 3, w - 6, 26 );
			ctx.fillStyle = '#f2f2ea'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
			ctx.font = '700 22px "Highway Gothic", "Arial Narrow", Helvetica, Arial, sans-serif';
			ctx.fillText( name, w / 2, y0 + 17, w - 16 );

		} );

	}, 'streetSigns' );
	const yellow = standard( { name: 'w1-signal-heads', color: new Color( 0.62, 0.45, 0.02 ), roughness: 0.5 } );
	const black = standard( { name: 'w1-signal-steel', color: new Color( 0.02, 0.022, 0.024 ), roughness: 0.45, metalness: 0.4 } );
	const lensMat = standard( { name: 'w1-signal-lenses', color: new Color( 0.03, 0.03, 0.03 ), roughness: 0.15, side: 'double', modules: [ commonModule, signalModule ],
		surface: /* wgsl */`
	// uv.x: 0 red, 1 yellow, 2 green (whole numbers), 3 the hand, 4 the man (and where on the face);
	// uv.y: the controller (or the crossing, and where on the face)
	let kind = floor( in.uv.x + 0.001 );
	let ctrl = floor( in.uv.y + 0.001 );
	let t = frame.time;
	var col = vec3f( 0.0 );
	var on = 0.0;
	if ( kind < 2.5 ) {
		let st = w1Signal( ctrl, t );
		col = select( select( vec3f( 1.0, 0.08, 0.02 ), vec3f( 1.0, 0.55, 0.02 ), kind > 0.5 ), vec3f( 0.1, 1.0, 0.55 ), kind > 1.5 );
		on = select( 0.0, 1.0, abs( ( 2.0 - kind ) - st ) < 0.5 );
	} else {
		let wv = w1Walk( ctrl, t );
		let q = vec2f( fract( in.uv.x ), fract( in.uv.y ) );
		if ( kind < 3.5 ) {
			// the hand: a palm and four fingers
			let palm = step( abs( q.x - 0.5 ), 0.2 ) * step( abs( q.y - 0.38 ), 0.18 );
			let fing = step( abs( fract( ( q.x - 0.3 ) / 0.1 ) - 0.5 ), 0.3 ) * step( q.x, 0.7 ) * step( 0.3, q.x ) * step( abs( q.y - 0.68 ), 0.14 );
			let thumb = step( length( vec2f( q.x - 0.25, q.y - 0.5 ) ), 0.07 );
			let shape = clamp( palm + fing + thumb, 0.0, 1.0 );
			col = vec3f( 1.0, 0.35, 0.03 ) * shape;
			on = select( select( 0.0, 1.0, wv < 0.5 ), step( 0.5, fract( t ) ), wv > 1.5 );
		} else {
			// the walking man
			let head = step( length( vec2f( q.x - 0.5, q.y - 0.82 ) ), 0.08 );
			let body = step( abs( q.x - 0.5 ), 0.07 ) * step( abs( q.y - 0.55 ), 0.17 );
			let legs = step( abs( abs( q.x - 0.5 ) - ( 0.38 - q.y ) * 0.5 ), 0.05 ) * step( q.y, 0.38 ) * step( 0.1, q.y );
			let arms = step( abs( abs( q.x - 0.5 ) - ( q.y - 0.45 ) * 0.9 ), 0.045 ) * step( abs( q.y - 0.6 ), 0.12 );
			col = vec3f( 0.85, 0.95, 1.0 ) * clamp( head + body + legs + arms, 0.0, 1.0 );
			on = select( 0.0, 1.0, wv > 0.5 && wv < 1.5 );
		}
	}
	s.albedo = mix( vec3f( 0.03 ), col * 0.2, 0.3 );
	s.emissive = col * on * 14.0;
	s.roughness = 0.1;
` } );
	lensMat.setDefine( 'DRY', 1 );
	const signMat = standard( { name: 'w1-street-signs', roughness: 0.4, textures: { snTex: signTex },
		surface: 'let t = textureSample( snTex, smpAnisoClamp, in.uv ).rgb; s.albedo = t; s.emissive = t * step( 0.8, t.r ) * smoothstep( 0.1, 0.7, frame.night ) * 0.15;' } );
	for ( const [ m, mat, name, cast ] of [ [ steel, black, 'w1-signal-poles', true ], [ heads, yellow, 'w1-signal-heads', true ], [ lenses, lensMat, 'w1-signal-lenses', false ], [ signs, signMat, 'w1-street-signs', false ] ] ) {

		mat.underwaterLighting = 'none';
		const mesh = new Mesh( m.geometry(), mat );
		mesh.name = name;
		mesh.castShadow = cast;
		mesh.receiveShadow = true;
		group.add( mesh );

	}

	return { mid: { north: pn, south: ps } };

}

const SIGN_NAMES = [ 'Pattison Av', 'S 11th St' ];
