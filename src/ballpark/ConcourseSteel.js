import { Mesh, Color, Vector3, Vector4 } from '../engine/index.js';
import { commonModule } from '../engine/render/wgsl/common.js';
import { standard } from '../materials/Materials.js';
import { Quads, SOFFIT_WGSL } from './Stands.js';
import { offsetPolyline } from './Bowl.js';
import { canvasTexture } from './geo.js';
import { LEVELS, FOOTPRINT } from './layout.js';

// FI1 (gauntlet CI-1, CI-8): the main concourse's sky, as the 2008 photos show it. Over the walkway and
// out to the brick the concourse is open to the steel that carries the club level: galvanized corrugated
// deck on maroon wide-flange girders across the concourse at every column, knee braces down to the
// columns, joists along it, a white sprinkler main or two and a wire cable tray hung under it all, and the
// HID domes hanging in the bays (harpo42, 4 May 2008, 129-130 by day; ZoeR, 19 Apr 2008, the Third Base
// Gate's atrium; docindigo76, NLCS 2009, from the mezzanine there; auds and the Getty Game 3 photo at
// night: the deck dark between the domes, the steel red where they light it). Over the rail the suite
// level hangs low: a dark painted deck with a few small downlights and the one beam along its back
// (auds, 27 Oct 2008, behind 125). The columns themselves: wide-flange steel in a glossy maroon, a base
// plate on the slab (they were plain dark boxes that went black at night).
//
// Everything here is one palette material (uv.x picks the colour, gloss and glow) in a few meshes that
// the static batching merges; nothing casts shadows (it's all under the decks). Field frame.
const STREET = LEVELS.mainConcourse;

// [ name, linear albedo, roughness, metalness, glow ]
const PALETTE = [
	[ 'maroon', [ 0.2, 0.028, 0.032 ], 0.62, 0 ], [ 'galv', [ 0.42, 0.43, 0.44 ], 0.42, 0.55 ], [ 'pipe', [ 0.62, 0.62, 0.6 ], 0.45, 0 ],
	[ 'conduit', [ 0.3, 0.31, 0.32 ], 0.45, 0.6 ], [ 'black', [ 0.02, 0.02, 0.022 ], 0.5, 0 ], [ 'red', [ 0.5, 0.03, 0.03 ], 0.5, 0 ],
	[ 'dome', [ 0.72, 0.72, 0.7 ], 0.3, 0, [ 1.6, 1.52, 1.38 ] ], [ 'hid', [ 0.9, 0.9, 0.86 ], 0.3, 0, [ 9.0, 8.6, 7.6 ] ],
	[ 'can', [ 0.8, 0.78, 0.72 ], 0.3, 0, [ 4.0, 3.5, 2.8 ] ], [ 'trim', [ 0.05, 0.05, 0.055 ], 0.5, 0.3 ], [ 'grate', [ 0.16, 0.165, 0.17 ], 0.6, 0.5 ],
	[ 'concrete', [ 0.36, 0.35, 0.33 ], 0.75, 0 ],
];
const PAL = Object.fromEntries( PALETTE.map( ( p, i ) => [ p[ 0 ], i ] ) );
const f3 = ( c ) => `vec3f( ${ c.map( ( v ) => v.toFixed( 3 ) ).join( ', ' ) } )`;
export const STEEL_WGSL = /* wgsl */`
	var alb = array<vec3f, ${ PALETTE.length }>( ${ PALETTE.map( ( p ) => f3( p[ 1 ] ) ).join( ', ' ) } );
	var rm = array<vec2f, ${ PALETTE.length }>( ${ PALETTE.map( ( p ) => `vec2f( ${ p[ 2 ].toFixed( 2 ) }, ${ p[ 3 ].toFixed( 2 ) } )` ).join( ', ' ) } );
	var glo = array<vec3f, ${ PALETTE.length }>( ${ PALETTE.map( ( p ) => f3( p[ 4 ] || [ 0, 0, 0 ] ) ).join( ', ' ) } );
	let k = min( u32( max( in.uv.x, 0.0 ) ), ${ PALETTE.length - 1 }u );
	s.albedo = alb[ k ];
	s.roughness = rm[ k ].x;
	s.metalness = rm[ k ].y;
	// the lamps burn day and night; by day the sky outshines them
	s.emissive = glo[ k ] * mix( 0.45, 1.3, smoothstep( 0.1, 0.7, frame.night ) );
	// what the floor bounces up onto the steel: daylight by day, the domes' light after dark
	s.emissive += s.albedo * mix( 0.08, 0.04, smoothstep( 0.1, 0.7, frame.night ) );
`;

// Quads whose uv.x is a palette entry
export class Pal extends Quads {

	constructor() {

		super();
		this.k = 0;

	}

	use( name ) {

		this.k = PAL[ name ];
		return this;

	}

	add( a, b, c, d, n ) {

		super.add( a, b, c, d, n, this.k + 0.5, this.k + 0.5 );

	}

	tri( a, b, c, n ) {

		super.tri( a, b, c, n, [ this.k + 0.5, 0 ], [ this.k + 0.5, 0 ], [ this.k + 0.5, 0 ] );

	}

}

// ---------------------------------------------------------------- small vector helpers
const sub = ( a, b ) => [ a[ 0 ] - b[ 0 ], a[ 1 ] - b[ 1 ], a[ 2 ] - b[ 2 ] ];
const add = ( a, b ) => [ a[ 0 ] + b[ 0 ], a[ 1 ] + b[ 1 ], a[ 2 ] + b[ 2 ] ];
const mul = ( a, k ) => [ a[ 0 ] * k, a[ 1 ] * k, a[ 2 ] * k ];
const cross = ( a, b ) => [ a[ 1 ] * b[ 2 ] - a[ 2 ] * b[ 1 ], a[ 2 ] * b[ 0 ] - a[ 0 ] * b[ 2 ], a[ 0 ] * b[ 1 ] - a[ 1 ] * b[ 0 ] ];
const unit = ( a ) => {

	const l = Math.hypot( a[ 0 ], a[ 1 ], a[ 2 ] ) || 1;
	return [ a[ 0 ] / l, a[ 1 ] / l, a[ 2 ] / l ];

};

// a box centred on c, its edges along the unit vectors u, v, w (lengths lu, lv, lw)
export function obox( q, c, u, lu, v, lv, w, lw ) {

	const P = ( i, j, k ) => [ c[ 0 ] + ( u[ 0 ] * i * lu + v[ 0 ] * j * lv + w[ 0 ] * k * lw ) / 2, c[ 1 ] + ( u[ 1 ] * i * lu + v[ 1 ] * j * lv + w[ 1 ] * k * lw ) / 2, c[ 2 ] + ( u[ 2 ] * i * lu + v[ 2 ] * j * lv + w[ 2 ] * k * lw ) / 2 ];
	q.add( P( - 1, - 1, 1 ), P( 1, - 1, 1 ), P( 1, 1, 1 ), P( - 1, 1, 1 ), w );
	q.add( P( 1, - 1, - 1 ), P( - 1, - 1, - 1 ), P( - 1, 1, - 1 ), P( 1, 1, - 1 ), mul( w, - 1 ) );
	q.add( P( 1, - 1, 1 ), P( 1, - 1, - 1 ), P( 1, 1, - 1 ), P( 1, 1, 1 ), u );
	q.add( P( - 1, - 1, - 1 ), P( - 1, - 1, 1 ), P( - 1, 1, 1 ), P( - 1, 1, - 1 ), mul( u, - 1 ) );
	q.add( P( - 1, 1, 1 ), P( 1, 1, 1 ), P( 1, 1, - 1 ), P( - 1, 1, - 1 ), v );
	q.add( P( - 1, - 1, - 1 ), P( 1, - 1, - 1 ), P( 1, - 1, 1 ), P( - 1, - 1, 1 ), mul( v, - 1 ) );

}

// A wide-flange member from a to b (its centre line): d deep along `up` (made square to the member), the
// flanges bf wide
export function wide( q, a, b, up, d, bf, tf = 0.035, tw = 0.022, stiff = 0 ) {

	const ab = sub( b, a ), len = Math.hypot( ab[ 0 ], ab[ 1 ], ab[ 2 ] );
	if ( len < 0.01 ) return;
	const u = mul( ab, 1 / len );
	const w = unit( cross( u, up ) ), v = cross( w, u );
	const c = mul( add( a, b ), 0.5 );
	obox( q, add( c, mul( v, d / 2 - tf / 2 ) ), u, len, v, tf, w, bf );
	obox( q, add( c, mul( v, - d / 2 + tf / 2 ) ), u, len, v, tf, w, bf );
	obox( q, c, u, len, v, d - 2 * tf, w, tw );
	// ---- FW2 (C2W-14): web stiffeners every `stiff` m, a plate each side of the web between the flanges
	// (docindigo76, NLCS 2009, from the mezzanine: the deep girder's stiffeners every bay, its bottom flange
	// catching the light), so a deep girder seen from below reads as steel, not a smooth painted slab
	if ( stiff > 0 ) for ( let t = ( len % stiff ) / 2; t <= len; t += stiff ) {

		const p = add( a, mul( u, t ) );
		obox( q, p, u, 0.014, v, d - 2 * tf, w, bf * 0.92 );

	}
	// ---- end FW2

}

// a round member from a to b, radius r, `sides` faces (a pipe, a rod, a stem)
export function pipe( q, a, b, r, sides = 6 ) {

	const u = unit( sub( b, a ) );
	const ref = Math.abs( u[ 1 ] ) > 0.9 ? [ 1, 0, 0 ] : [ 0, 1, 0 ];
	const e1 = unit( cross( u, ref ) ), e2 = cross( u, e1 );
	for ( let i = 0; i < sides; i ++ ) {

		const a0 = i / sides * Math.PI * 2, a1 = ( i + 1 ) / sides * Math.PI * 2, am = ( a0 + a1 ) / 2;
		const o0 = add( mul( e1, Math.cos( a0 ) * r ), mul( e2, Math.sin( a0 ) * r ) ), o1 = add( mul( e1, Math.cos( a1 ) * r ), mul( e2, Math.sin( a1 ) * r ) );
		q.add( add( a, o0 ), add( a, o1 ), add( b, o1 ), add( b, o0 ), add( mul( e1, Math.cos( am ) ), mul( e2, Math.sin( am ) ) ) );

	}

}

// a vertical solid of revolution at ( x, z ) from y0 (radius r0) to y1 (r1), its ends capped if asked
export function lathe( q, x, z, y0, y1, r0, r1, sides = 12, { top = false, bottom = false } = {} ) {

	const slope = ( r0 - r1 ) / Math.max( 1e-3, y1 - y0 );
	for ( let i = 0; i < sides; i ++ ) {

		const a0 = i / sides * Math.PI * 2, a1 = ( i + 1 ) / sides * Math.PI * 2, am = ( a0 + a1 ) / 2;
		const p = ( a, r, y ) => [ x + Math.cos( a ) * r, y, z + Math.sin( a ) * r ];
		q.add( p( a0, r0, y0 ), p( a1, r0, y0 ), p( a1, r1, y1 ), p( a0, r1, y1 ), [ Math.cos( am ), slope, Math.sin( am ) ] );
		if ( top && r1 > 0.001 ) q.tri( [ x, y1, z ], p( a0, r1, y1 ), p( a1, r1, y1 ), [ 0, 1, 0 ] );
		if ( bottom && r0 > 0.001 ) q.tri( [ x, y0, z ], p( a1, r0, y0 ), p( a0, r0, y0 ), [ 0, - 1, 0 ] );

	}

}

// An HID high-bay hung at ( x, y, z ) (the bottom of its dome) from yTop: a conduit stem, the ballast box,
// a prismatic dome that glows all over, the lamp's lens under it
export function hidDome( q, x, y, z, yTop ) {

	q.use( 'conduit' );
	pipe( q, [ x, y + 0.62, z ], [ x, yTop, z ], 0.022, 5 );
	q.use( 'trim' );
	obox( q, [ x, y + 0.62, z ], [ 1, 0, 0 ], 0.24, [ 0, 1, 0 ], 0.2, [ 0, 0, 1 ], 0.24 );
	q.use( 'dome' );
	lathe( q, x, z, y + 0.05, y + 0.36, 0.3, 0.16, 12 );
	lathe( q, x, z, y + 0.36, y + 0.52, 0.16, 0.06, 10 );
	q.use( 'hid' );
	lathe( q, x, z, y, y + 0.05, 0.27, 0.3, 12, { bottom: true } );

}

// The column stations along P every ~spacing, as Bowl._columns places them: each with the way along (u)
// and the way toward the field (n), averaged at the corners
export function stations( P, spacing ) {

	const segs = [];
	for ( let i = 0; i < P.length - 1; i ++ ) {

		const [ ax, az ] = P[ i ], [ bx, bz ] = P[ i + 1 ];
		const len = Math.hypot( bx - ax, bz - az );
		if ( len < 1e-3 ) continue;
		const ux = ( bx - ax ) / len, uz = ( bz - az ) / len;
		let nx = - uz, nz = ux;
		if ( nx * ( - ax ) + nz * ( - 40 - az ) < 0 ) {

			nx = - nx; nz = - nz;

		}

		segs.push( { ax, az, bx, bz, len, ux, uz, nx, nz, i } );

	}

	const out = [];
	segs.forEach( ( S, i ) => {

		const n = Math.max( 1, Math.round( S.len / spacing ) );
		for ( let k = i === 0 ? 0 : 1; k <= n; k ++ ) {

			let { ux, uz, nx, nz } = S;
			const T = k === n ? segs[ i + 1 ] : null;
			if ( T ) {

				ux += T.ux; uz += T.uz; nx += T.nx; nz += T.nz;
				const lu = Math.hypot( ux, uz ), ln = Math.hypot( nx, nz );
				ux /= lu; uz /= lu; nx /= ln; nz /= ln;

			}

			out.push( { x: S.ax + ( S.bx - S.ax ) * k / n, z: S.az + ( S.bz - S.az ) * k / n, ux, uz, nx, nz, seg: S.i, corner: !! T } );

		}

	} );
	return out;

}

// A polyline measured along: the point s metres along it with its way along (u) and toward the field
// (n), and the nearest point's s for a point off it
export class Along {

	constructor( P ) {

		this.P = P;
		this.cum = [ 0 ];
		for ( let i = 1; i < P.length; i ++ ) this.cum.push( this.cum[ i - 1 ] + Math.hypot( P[ i ][ 0 ] - P[ i - 1 ][ 0 ], P[ i ][ 1 ] - P[ i - 1 ][ 1 ] ) );
		this.length = this.cum[ this.cum.length - 1 ];

	}

	at( s ) {

		const P = this.P, C = this.cum;
		let i = 0;
		while ( i < P.length - 2 && C[ i + 1 ] < s ) i ++;
		const l = C[ i + 1 ] - C[ i ], t = ( s - C[ i ] ) / l;
		const [ ax, az ] = P[ i ], [ bx, bz ] = P[ i + 1 ];
		const ux = ( bx - ax ) / l, uz = ( bz - az ) / l;
		let nx = - uz, nz = ux;
		const x = ax + ( bx - ax ) * t, z = az + ( bz - az ) * t;
		if ( nx * ( - x ) + nz * ( - 40 - z ) < 0 ) {

			nx = - nx; nz = - nz;

		}

		return { x, z, ux, uz, nx, nz };

	}

	nearest( x, z ) {

		const P = this.P;
		let best = Infinity, bs = 0;
		for ( let i = 0; i < P.length - 1; i ++ ) {

			const [ ax, az ] = P[ i ], [ bx, bz ] = P[ i + 1 ];
			const l = this.cum[ i + 1 ] - this.cum[ i ];
			const t = Math.max( 0, Math.min( 1, ( ( x - ax ) * ( bx - ax ) + ( z - az ) * ( bz - az ) ) / ( l * l ) ) );
			const d = Math.hypot( ax + ( bx - ax ) * t - x, az + ( bz - az ) * t - z );
			if ( d < best ) {

				best = d; bs = this.cum[ i ] + t * l;

			}

		}

		return bs;

	}

}

// Red brick laid in running bond, for a wall whose uv is metres along it (x) and the field frame's height
// (y): the bricks' tones, the mortar, a darker base course; `wash`: after dark the spots along its top
// (every 3 m at y = wash) throw scallops of warm light down it (docindigo76, NLCS 2009, the Third Base
// Gate's atrium: the brick over the walkway lit by a row of spots)
export function brickWGSL( { wash = null, base = null } = {} ) {

	return /* wgsl */`
	let u = in.uv.x; let v = in.uv.y;
	let row = floor( v / 0.075 );
	let bu = u / 0.2 + 0.5 * ( row % 2.0 );
	let fr = clamp( fwidth( v ) / 0.075 * 1.5 - 0.25, 0.0, 1.0 );
	let fb = clamp( fwidth( bu ) * 1.5 - 0.25, 0.0, 1.0 );
	let mortar = clamp( mix( step( 0.88, fract( v / 0.075 ) ), 0.12, fr ) + mix( step( 0.93, fract( bu ) ), 0.07, max( fb, fr ) ), 0.0, 1.0 );
	let tone = mix( 0.8 + 0.34 * fract( sin( dot( vec2f( floor( bu ), row ), vec2f( 12.9898, 78.233 ) ) ) * 43758.5453 ), 0.97, max( fr, fb ) );
	var bc = vec3f( 0.25, 0.068, 0.04 );
	${ base !== null ? `if ( v < ${ base.toFixed( 3 ) } ) { bc = vec3f( 0.085, 0.045, 0.035 ); }` : '' }
	s.albedo = mix( bc * tone, vec3f( 0.4, 0.38, 0.34 ), mortar * 0.75 );
	s.roughness = 0.85;
	${ wash !== null ? `
	{
		let dy = ${ wash.toFixed( 3 ) } - v;
		let du = abs( fract( u / 3.0 ) - 0.5 ) * 3.0;
		let wdt = 0.25 + 0.42 * dy;
		let k = ( 1.0 - smoothstep( wdt * 0.55, wdt, du ) ) * smoothstep( 0.05, 0.6, dy ) * exp( - dy / 3.2 );
		s.emissive = s.albedo * vec3f( 1.0, 0.85, 0.62 ) * k * mix( 0.3, 2.2, smoothstep( 0.1, 0.7, frame.night ) );
	}` : '' }
`;

}

// The rail's infill: galvanized pickets every 0.11 m between the posts (the gaps cut out; far off they
// thicken so they don't shimmer). uv: metres along (x), the field frame's height (y)
const PICKETS_WGSL = /* wgsl */`
	let fw = fwidth( in.uv.x );
	let keep = 0.17 + clamp( fw * 5.0 - 0.1, 0.0, 0.55 );
	if ( fract( in.uv.x / 0.11 ) > keep ) { discard; }
	s.albedo = vec3f( 0.42, 0.43, 0.44 );
	s.roughness = 0.4;
	s.metalness = 0.6;
`;

// The mosaic (invented): square glazed tesserae, 2.5 cm, in a scene drawn at low resolution first and then
// set tile by tile with a little variation in each, the grout between
function mosaicTexture() {

	const N = 96, M = 72;
	const scene = new OffscreenCanvas( N, M ), g = scene.getContext( '2d', { willReadFrequently: true } );
	// the sky at dusk over the skyline, the field, the plate, the batter in pinstripes, the frame
	const sky = g.createLinearGradient( 0, 0, 0, M * 0.55 );
	sky.addColorStop( 0, '#1d3f8a' ); sky.addColorStop( 1, '#e98a4a' );
	g.fillStyle = sky; g.fillRect( 0, 0, N, M );
	g.fillStyle = '#20263a';
	for ( const [ x, w, h ] of [ [ 8, 6, 14 ], [ 15, 5, 20 ], [ 21, 7, 11 ], [ 30, 4, 26 ], [ 35, 6, 17 ], [ 60, 5, 22 ], [ 66, 7, 30 ], [ 74, 5, 15 ], [ 80, 6, 19 ] ] ) g.fillRect( x, M * 0.55 - h, w, h );
	g.fillStyle = '#2f7a35'; g.fillRect( 0, M * 0.55, N, M );
	g.fillStyle = '#b5824e'; g.beginPath(); g.ellipse( N / 2, M * 0.86, 30, 7, 0, 0, Math.PI * 2 ); g.fill();
	g.fillStyle = '#f2f0e8'; g.beginPath(); g.moveTo( 44, 62 ); g.lineTo( 52, 62 ); g.lineTo( 52, 64 ); g.lineTo( 48, 66 ); g.lineTo( 44, 64 ); g.fill();
	// the batter: pinstripes, red helmet, the bat back
	g.fillStyle = '#f2f0e8'; g.fillRect( 40, 30, 8, 16 ); g.fillRect( 40, 46, 3, 13 ); g.fillRect( 45, 46, 3, 13 );
	g.fillStyle = '#b3121b'; for ( let x = 41; x < 48; x += 2 ) g.fillRect( x, 31, 1, 26 );
	g.fillStyle = '#c8102e'; g.fillRect( 41, 24, 6, 6 ); g.fillRect( 47, 27, 2, 2 );
	g.fillStyle = '#e0b07a'; g.fillRect( 42, 29, 4, 2 );
	g.strokeStyle = '#8a5a2b'; g.lineWidth = 2; g.beginPath(); g.moveTo( 49, 32 ); g.lineTo( 60, 18 ); g.stroke();
	g.strokeStyle = '#b3121b'; g.lineWidth = 3; g.strokeRect( 1.5, 1.5, N - 3, M - 3 );
	g.strokeStyle = '#0b2a5b'; g.lineWidth = 1; g.strokeRect( 4.5, 4.5, N - 9, M - 9 );
	const px = g.getImageData( 0, 0, N, M ).data;
	return canvasTexture( N * 8, M * 8, ( ctx ) => {

		ctx.fillStyle = '#b8b2a4';
		ctx.fillRect( 0, 0, N * 8, M * 8 );
		for ( let j = 0; j < M; j ++ ) for ( let i = 0; i < N; i ++ ) {

			const k = ( j * N + i ) * 4, v = 0.88 + ( ( i * 7919 + j * 104729 ) % 97 ) / 97 * 0.24;
			ctx.fillStyle = `rgb( ${ Math.min( 255, px[ k ] * v ) | 0 }, ${ Math.min( 255, px[ k + 1 ] * v ) | 0 }, ${ Math.min( 255, px[ k + 2 ] * v ) | 0 } )`;
			ctx.fillRect( i * 8 + 1, j * 8 + 1, 6.5, 6.5 );

		}

	}, 'mosaic' );

}

// how far from p along the unit direction n to the facade's brick (Infinity if it isn't hit)
export function toFacade( p, n ) {

	const F = FOOTPRINT;
	let best = Infinity;
	for ( let i = 0; i < F.length; i ++ ) {

		const a = F[ i ], b = F[ ( i + 1 ) % F.length ];
		const ex = b[ 0 ] - a[ 0 ], ez = b[ 1 ] - a[ 1 ];
		const den = n[ 0 ] * ez - n[ 1 ] * ex;
		if ( Math.abs( den ) < 1e-6 ) continue;
		const dx = a[ 0 ] - p[ 0 ], dz = a[ 1 ] - p[ 1 ];
		const t = ( dx * ez - dz * ex ) / den, u = ( dx * n[ 1 ] - dz * n[ 0 ] ) / den;
		if ( t > 0.5 && u >= 0 && u <= 1 ) best = Math.min( best, t );

	}

	return best;

}

export class ConcourseSteel {

	constructor( { group, bowl, field = null, colliders = null } ) {

		this.field = field;
		this.colliders = colliders;

		this.group = group;
		this.bowl = bowl;
		// the domes' lamps (field frame, the lens's centre), for the local lights
		this.lamps = [];
		const q = this.q = new Pal();
		this._columns( q );
		this._hallWall();
		this._overhead( q );
		this._lowSoffit( q );
		this._mezzanine( q );
		for ( const name of [ 'pavilion', 'arcade', 'lf-deck' ] ) {

			const t = bowl.upper?.find( ( u ) => u.name === name );
			if ( t ) this._raked( q, t );

		}
		const mat = this.material = standard( { name: 'concourse-steel', roughness: 0.5, surface: STEEL_WGSL } );
		mat.underwaterLighting = 'none';
		mat.setDefine( 'DRY', 1 );
		const mesh = new Mesh( q.geometry(), mat );
		mesh.name = 'concourse-steel';
		mesh.receiveShadow = true;
		group.add( mesh );

	}

	// The columns: the bowl's (plain boxes) hidden, and in their place wide-flange steel on a base plate,
	// turned square to the concourse; the bowl's steel (its frame along the outside, the rear wall's) given
	// the same glossy maroon paint, which the domes light red at night (it was dark metal: black at night)
	_columns( q ) {

		const bowl = this.bowl;
		const cs = bowl._colSteel;
		if ( cs ) {

			cs.color = new Color( 0.2, 0.028, 0.032 );
			cs.roughness = 0.42;
			cs.metalness = 0;

		}

		this.columns = [];
		bowl.group.traverse( ( o ) => {

			if ( ! o.isMesh || o.material?.name !== 'columns' || ! o.geometry?.parameters ) return;
			const h = o.geometry.parameters.height;
			const y0 = o.position.y - h / 2, y1 = o.position.y + h / 2;
			const ry = o.rotation.y, ux = Math.cos( ry ), uz = - Math.sin( ry );
			o.visible = false;
			this.columns.push( { x: o.position.x, z: o.position.z, y0, y1, ux, uz } );

		} );
		const up = [ 0, 1, 0 ];
		for ( const C of this.columns ) {

			// the web across the concourse (u along it): the flanges face along the concourse
			const u = [ C.ux, 0, C.uz ];
			q.use( 'maroon' );
			wide( q, [ C.x, C.y0, C.z ], [ C.x, C.y1, C.z ], u, 0.6, 0.46, 0.04, 0.026 );
			// the base plate and its grout pad
			q.use( 'maroon' );
			obox( q, [ C.x, C.y0 + 0.02, C.z ], u, 0.78, up, 0.04, [ - C.uz, 0, C.ux ], 0.62 );
			q.use( 'concrete' );
			obox( q, [ C.x, C.y0 + 0.005, C.z ], u, 0.9, up, 0.03, [ - C.uz, 0, C.ux ], 0.74 );

		}

	}

	// FI1 (CI-4): behind the stands from the First Base Gate's atrium round behind home plate to the Third
	// Base Gate's, the outer ring closed off in brick along the outer columns (the Phillies' 2005 plan of the
	// main concourse: along the facade a continuous row of rooms, the stands, the restrooms, the stairs and
	// elevators). It was a hall 25 m deep behind home plate, dark and empty, open to the concourse between
	// the stands, the private suite lobby lit at the far end of it. The stands stand in the brick now
	// (Concourse._stands, CI-7), and the steel and the domes stop at it.
	_hallWall() {

		const bowl = this.bowl, D = bowl.D, infield = bowl.path.slice( 2, 10 );
		const line = ( P, d ) => offsetPolyline( P, d, [ 0, - 40 ] );
		const dOut = D.t400Back - 0.4, yU = LEVELS.clubConcourse - 0.6;
		const OUT = this.OUT = new Along( line( infield, dOut ) );
		const s1B = OUT.nearest( 73.5, 25.48 ), s3B = OUT.nearest( - 80.95, 32.03 );
		this.closedS = [ s1B + 15, s3B - 15 ];
		const WL = new Along( line( infield, dOut + 0.4 ) );
		const w0 = WL.nearest( OUT.at( this.closedS[ 0 ] ).x, OUT.at( this.closedS[ 0 ] ).z ), w1 = WL.nearest( OUT.at( this.closedS[ 1 ] ).x, OUT.at( this.closedS[ 1 ] ).z );
		const pts = [ w0, ...WL.cum.filter( ( c ) => c > w0 && c < w1 ), w1 ].map( ( c ) => WL.at( c ) );
		const brick = new Quads();
		let u = 0;
		for ( let i = 0; i < pts.length - 1; i ++ ) {

			const a = pts[ i ], b = pts[ i + 1 ], l = Math.hypot( b.x - a.x, b.z - a.z );
			brick.add( [ a.x, STREET, a.z ], [ b.x, STREET, b.z ], [ b.x, yU, b.z ], [ a.x, yU, a.z ], [ a.nx, 0, a.nz ], u, u + l );
			u += l;
			if ( this.colliders && this.field ) {

				const w = this.field.toWorld( ( a.x + b.x ) / 2, ( a.z + b.z ) / 2 );
				this.colliders.addBox( new Vector3( w.x, this.field.y0 + STREET + 2, w.z ), new Vector3( l / 2, 2, 0.2 ), this.field.group.rotation.y - Math.atan2( b.z - a.z, b.x - a.x ), { tag: 'concourse-wall' } );

			}

		}

		// ---- FI1 (CI-23): a tile mosaic on the brick by the Third Base Gate (the 2008 guide: 'Unique tile
		// mosaics by local artist Jonathan Mandell are on the Main Concourse'; a 6 x 8 ft piece, a 2004 note;
		// where and what they showed isn't on record: this design is invented, a batter in pinstripes at the
		// plate under the city's skyline)
		{

			const sm = WL.nearest( OUT.at( this.closedS[ 1 ] - 2.2 ).x, OUT.at( this.closedS[ 1 ] - 2.2 ).z );
			const c = WL.at( sm ), hw = 1.22, y0 = STREET + 1.35, y1 = y0 + 1.83;
			const mq = new Quads(), o = 0.03;
			const A = [ c.x - c.ux * hw + c.nx * o, c.z - c.uz * hw + c.nz * o ], B = [ c.x + c.ux * hw + c.nx * o, c.z + c.uz * hw + c.nz * o ];
			mq.tri( [ A[ 0 ], y0, A[ 1 ] ], [ B[ 0 ], y0, B[ 1 ] ], [ B[ 0 ], y1, B[ 1 ] ], [ c.nx, 0, c.nz ], [ 1, 1 ], [ 0, 1 ], [ 0, 0 ] );
			mq.tri( [ A[ 0 ], y0, A[ 1 ] ], [ B[ 0 ], y1, B[ 1 ] ], [ A[ 0 ], y1, A[ 1 ] ], [ c.nx, 0, c.nz ], [ 1, 1 ], [ 0, 0 ], [ 1, 0 ] );
			const mm = standard( { name: 'concourse-mosaic', roughness: 0.3, textures: { fiMosaic: mosaicTexture() },
				surface: 'let t = textureSample( fiMosaic, smpAnisoClamp, in.uv ).rgb; s.albedo = t; s.roughness = 0.28;' } );
			mm.underwaterLighting = 'none';
			const mesh = new Mesh( mq.geometry(), mm );
			mesh.name = 'concourse-mosaic';
			this.group.add( mesh );

		}
		// ---- end FI1

		const m = standard( { name: 'concourse-brick', color: new Color( 0.25, 0.068, 0.04 ), roughness: 0.85, surface: brickWGSL( { base: STREET + 0.6 } ) } );
		m.underwaterLighting = 'none';
		m.setDefine( 'DRY', 1 );
		this.brickMaterial = m;
		const mesh = new Mesh( brick.geometry(), m );
		mesh.name = 'concourse-hall-wall';
		mesh.receiveShadow = true;
		this.group.add( mesh );

	}

	// is an outer column's station behind the closed wall?
	_closed( st ) {

		if ( ! this.closedS || st.seg > 6 ) return false;
		const s = this.OUT.nearest( st.x, st.z );
		return s > this.closedS[ 0 ] - 1 && s < this.closedS[ 1 ] + 1;

	}

	// The steel over the walkway and out to the brick, under the club level's slab, round the infield
	_overhead( q ) {

		const bowl = this.bowl, D = bowl.D, path = bowl.path;
		const main = path.slice( 2 ), infield = path.slice( 2, 10 );
		const line = ( P, d ) => offsetPolyline( P, d, [ 0, - 40 ] );
		const dOut = D.t400Back - 0.4, dMid = D.clubBack + 8 - 0.4, dIn = D.suites + 2 * 0.95 + 7, dClub = D.clubBack + 8;
		const yU = LEVELS.clubConcourse - 0.6; // the club level's slabs' underside
		const GD = 0.82, yG = yU - GD / 2; // the girders: their depth, their centre line
		const up = [ 0, 1, 0 ];
		this.dims = { dOut, dMid, dIn, yU };

		// the deck at the club level between the club concourse's back and the outer ring's floors, so the
		// concourse has one ceiling (it looked up 25 m into the 400s' rake there)
		{

			const A = line( infield, dClub - 0.02 ), B = line( infield, dOut + 0.02 );
			const deck = new Quads();
			for ( let i = 0; i < A.length - 1; i ++ ) {

				const yT = LEVELS.clubConcourse;
				deck.add( [ A[ i ][ 0 ], yT, A[ i ][ 1 ] ], [ A[ i + 1 ][ 0 ], yT, A[ i + 1 ][ 1 ] ], [ B[ i + 1 ][ 0 ], yT, B[ i + 1 ][ 1 ] ], [ B[ i ][ 0 ], yT, B[ i ][ 1 ] ], [ 0, 1, 0 ] );
				deck.add( [ A[ i ][ 0 ], yU, A[ i ][ 1 ] ], [ B[ i ][ 0 ], yU, B[ i ][ 1 ] ], [ B[ i + 1 ][ 0 ], yU, B[ i + 1 ][ 1 ] ], [ A[ i + 1 ][ 0 ], yU, A[ i + 1 ][ 1 ] ], [ 0, - 1, 0 ] );

			}

			// ---- FW2 (C2W-13): over the gates' frames this deck too is the ceiling the street sees, lit
			// as the outer ring's floors are (Bowl.js _outerRing): a metal halide every 6 m, its pool
			const F = this.field, gw = F ? [ [ - 80.95, 32.03 ], [ 73.5, 25.48 ] ].map( ( [ x, z ] ) => F.toWorld( x, z ) ) : [ { x: 1e5, z: 1e5 }, { x: 1e5, z: 1e5 } ];
			const m = standard( { name: 'concourse-deck', color: new Color( 0.36, 0.35, 0.33 ), roughness: 0.75, modules: [ commonModule ],
				uniforms: { gates: [ 'vec4f', new Vector4( gw[ 0 ].x, gw[ 0 ].z, gw[ 1 ].x, gw[ 1 ].z ) ] },
				surface: /* wgsl */`
	if ( in.N.y < - 0.6 ) {
${ SOFFIT_WGSL }
		let gd = min( length( in.P.xz - mat.gates.xy ), length( in.P.xz - mat.gates.zw ) );
		let gk = 1.0 - smoothstep( 26.0, 38.0, gd );
		if ( gk > 0.0 ) {
			let cl = fract( in.P.xz / 6.0 ) - 0.5;
			let r = length( cl ) * 6.0;
			let lens = 1.0 - smoothstep( 0.2, 0.28, r );
			s.emissive += vec3f( 0.82, 1.0, 0.86 ) * smoothstep( 0.15, 0.7, frame.night ) * gk * ( vec3f( 0.34, 0.33, 0.31 ) * ( 0.25 + 0.75 * exp( - r * r / 4.0 ) ) * 0.9 + vec3f( 9.0 ) * lens );
		}
	}
` } );
			// ---- end FW2
			m.underwaterLighting = 'none';
			m.setDefine( 'DRY', 1 );
			const mesh = new Mesh( deck.geometry(), m );
			mesh.name = 'concourse-deck';
			mesh.receiveShadow = true;
			mesh.castShadow = true;
			this.group.add( mesh );

		}

		// across the concourse at every outer column: a girder in to the suites' back, and out to the brick
		// where the outer ring's floor is over it; knee braces down to the column both ways
		const outer = stations( line( main, dOut ), 9.5 );
		const inInfield = ( st ) => st.seg <= 6;
		this.bays = [];
		for ( const st of outer ) {

			const n = [ st.nx, 0, st.nz ], c = [ st.x, yG, st.z ];
			if ( inInfield( st ) ) {

				const end = add( c, mul( n, dOut - dIn ) );
				q.use( 'maroon' );
				wide( q, c, end, up, GD, 0.32, 0.035, 0.022, 2.4 );
				// the knee brace in, from the column to the girder's bottom flange
				pipe( q, [ st.x, yG - 2.4, st.z ], add( c, add( mul( n, 2.2 ), [ 0, - GD / 2 + 0.05, 0 ] ) ), 0.09, 4 );

			}

			const fd = toFacade( [ st.x, st.z ], [ - st.nx, - st.nz ] );
			st.facade = fd < 45 && ! this._closed( st ) ? fd - 0.9 : null;
			if ( st.facade ) {

				const end = add( c, mul( n, - st.facade ) );
				q.use( 'maroon' );
				wide( q, c, end, up, GD, 0.32, 0.035, 0.022, 2.4 );
				pipe( q, [ st.x, yG - 2.4, st.z ], add( c, add( mul( n, - 2.2 ), [ 0, - GD / 2 + 0.05, 0 ] ) ), 0.09, 4 );

			}

		}

		// the joists along the concourse between the girders, every 2.4 m across it, under the deck
		const joist = ( A, B ) => {

			q.use( 'maroon' );
			wide( q, [ A[ 0 ], yU - 0.17, A[ 1 ] ], [ B[ 0 ], yU - 0.17, B[ 1 ] ], up, 0.34, 0.13, 0.02, 0.012 );

		};

		for ( let d = dIn + 1.2; d < dOut - 0.6; d += 2.4 ) {

			if ( Math.abs( d - dMid ) < 0.8 ) continue;
			const P = line( infield, d );
			for ( let i = 0; i < P.length - 1; i ++ ) joist( P[ i ], P[ i + 1 ] );

		}

		// out over the outer ring: in pieces a bay long, as far as the brick
		for ( let i = 0; i < outer.length - 1; i ++ ) {

			const a = outer[ i ], b = outer[ i + 1 ];
			if ( ! a.facade || ! b.facade ) continue;
			const reach = Math.min( a.facade, b.facade );
			this.bays.push( { a, b, reach } );
			for ( let o = 2.4; o < reach - 0.6; o += 2.4 ) joist( [ a.x - a.nx * o, a.z - a.nz * o ], [ b.x - b.nx * o, b.z - b.nz * o ] );

		}

		// the mid-concourse columns: a beam along them at the girders' depth, knee braces along it
		const mid = stations( line( infield, dMid ), 9.5 );
		const ML = line( infield, dMid );
		for ( let i = 0; i < ML.length - 1; i ++ ) {

			q.use( 'maroon' );
			wide( q, [ ML[ i ][ 0 ], yG, ML[ i ][ 1 ] ], [ ML[ i + 1 ][ 0 ], yG, ML[ i + 1 ][ 1 ] ], up, GD, 0.32, 0.035, 0.022, 1.6 );

		}

		for ( const st of mid ) for ( const s of [ - 1, 1 ] ) {

			q.use( 'maroon' );
			pipe( q, [ st.x, yG - 2.4, st.z ], [ st.x + st.ux * 2.2 * s, yG - GD / 2 + 0.05, st.z + st.uz * 2.2 * s ], 0.09, 4 );

		}

		// the edge beam along the suites' back, where the deck meets it
		const EL = line( infield, dIn + 0.25 );
		for ( let i = 0; i < EL.length - 1; i ++ ) {

			q.use( 'maroon' );
			wide( q, [ EL[ i ][ 0 ], yG, EL[ i ][ 1 ] ], [ EL[ i + 1 ][ 0 ], yG, EL[ i + 1 ][ 1 ] ], up, GD, 0.32, 0.035, 0.022, 1.6 );

		}

		// the services under it: two white sprinkler mains, a wire cable tray, each on rods from the deck
		for ( const [ d, y, kind ] of [ [ dIn + 2.9, yU - 1.0, 'pipe' ], [ dMid + 4.4, yU - 1.05, 'pipe' ], [ dMid + 1.7, yU - 1.3, 'tray' ] ] ) {

			const P = line( infield, d );
			for ( let i = 0; i < P.length - 1; i ++ ) {

				const a = [ P[ i ][ 0 ], y, P[ i ][ 1 ] ], b = [ P[ i + 1 ][ 0 ], y, P[ i + 1 ][ 1 ] ];
				const len = Math.hypot( b[ 0 ] - a[ 0 ], b[ 2 ] - a[ 2 ] ), u = [ ( b[ 0 ] - a[ 0 ] ) / len, 0, ( b[ 2 ] - a[ 2 ] ) / len ], w = [ - u[ 2 ], 0, u[ 0 ] ];
				if ( kind === 'pipe' ) {

					q.use( 'pipe' );
					pipe( q, a, b, 0.075, 6 );

				} else {

					// the tray: a wire floor and two low sides
					q.use( 'galv' );
					obox( q, mul( add( a, b ), 0.5 ), u, len, up, 0.012, w, 0.46 );
					for ( const s of [ - 1, 1 ] ) obox( q, add( mul( add( a, b ), 0.5 ), add( mul( w, s * 0.23 ), [ 0, 0.05, 0 ] ) ), u, len, up, 0.1, w, 0.012 );

				}

				q.use( 'conduit' );
				for ( let t = 1.5; t < len; t += 3.0 ) {

					const p = add( a, mul( u, t ) );
					pipe( q, add( p, [ 0, kind === 'pipe' ? 0.07 : 0.0, 0 ] ), [ p[ 0 ], yU, p[ 2 ] ], 0.01, 4 );

				}

			}

		}

		// the domes out over the outer ring, in the bays (the walkway's are the places': Concourse3B, 1B)
		for ( const { a, b, reach } of this.bays ) {

			const rows = reach > 16 ? [ reach / 3, reach * 2 / 3 ] : [ reach / 2 ];
			for ( const o of rows ) {

				const x = ( a.x - a.nx * o + b.x - b.nx * o ) / 2, z = ( a.z - a.nz * o + b.z - b.nz * o ) / 2;
				const y = STREET + 7.4;
				hidDome( q, x, y, z, yU );
				this.lamps.push( [ x, y - 0.05, z ] );

			}

		}

	}

	// Under the decks that stand on columns over the concourse in the outfield and down the lines (the
	// Pavilion over 101-107, the Arcade over the left field line, the left field deck), the same steel
	// following their rake: a girder at every column back to the top row, joists along, domes in the bays
	_raked( q, t ) {

		const rows = t.rows * t.depth, up = [ 0, 1, 0 ];
		const under = ( d ) => t.y0 - t.soffit + Math.max( 0, d ) * ( ( t.rows - 1 ) * t.rise ) / rows;
		const GD = 0.7;
		const line = ( d ) => offsetPolyline( t.front, d, t.outward );
		const cols = stations( line( 5.0 ), 9 );
		// a point d back from the tier's front (its rows rise away from the field) on a column's line
		const pt = ( st, d ) => [ st.x - st.nx * ( d - 5.0 ), under( d ) - GD / 2, st.z - st.nz * ( d - 5.0 ) ];
		const lamps = [];
		for ( let i = 0; i < cols.length; i ++ ) {

			const st = cols[ i ];
			q.use( 'maroon' );
			wide( q, pt( st, 0.4 ), pt( st, rows - 0.4 ), up, GD, 0.28 );
			// the knee braces off the column, front and back
			for ( const s of [ - 1, 1 ] ) {

				const top = pt( st, 5.0 + s * 2.0 );
				pipe( q, [ st.x, under( 5.0 ) - 2.2, st.z ], [ top[ 0 ], top[ 1 ] - GD / 2 + 0.05, top[ 2 ] ], 0.08, 4 );

			}

			if ( i < cols.length - 1 && Math.hypot( cols[ i + 1 ].x - st.x, cols[ i + 1 ].z - st.z ) < 13 ) {

				const d = rows * 0.62, a = pt( st, d ), b = pt( cols[ i + 1 ], d );
				const x = ( a[ 0 ] + b[ 0 ] ) / 2, z = ( a[ 2 ] + b[ 2 ] ) / 2, y = Math.max( STREET + 4.2, under( d ) - 2.6 );
				hidDome( q, x, y, z, under( d ) );
				lamps.push( [ x, y - 0.05, z ] );

			}

		}

		for ( let d = 1.6; d < rows - 0.5; d += 2.4 ) {

			const P = line( d );
			for ( let i = 0; i < P.length - 1; i ++ ) {

				q.use( 'maroon' );
				wide( q, [ P[ i ][ 0 ], under( d ) - 0.15, P[ i ][ 1 ] ], [ P[ i + 1 ][ 0 ], under( d ) - 0.15, P[ i + 1 ][ 1 ] ], up, 0.3, 0.12, 0.02, 0.012 );

			}

		}

		this.lamps.push( ...lamps );

	}

	// Over the rail the suite level hangs 3.5 m up: its underside a dark painted deck, a few small
	// downlights in it, a maroon beam along its back edge (auds, 27 Oct 2008, behind 125: black overhead, one
	// beam, a few small lights)
	_lowSoffit( q ) {

		const bowl = this.bowl, D = bowl.D, infield = bowl.path.slice( 2, 10 );
		const line = ( P, d ) => offsetPolyline( P, d, [ 0, - 40 ] );
		// (C2W-17, FW2: 6 cm under the bowl's own soffit there, which it z-fought into a pale blotched band
		// along the overhang's edge over the SRO rail)
		const d0 = D.suites + 2 * 0.95, d1 = d0 + 7, y = LEVELS.suites - 0.56;
		// (C2W-17, FW2: and forward under the suites' outdoor rows to their front: their own underside, lit
		// by the banks, showed as the pale mottled band over the rail)
		const dF = D.suites + 0.05;
		const A = line( infield, dF ), B = line( infield, d1 );
		const panel = new Quads();
		for ( let i = 0; i < A.length - 1; i ++ ) panel.add( [ A[ i ][ 0 ], y, A[ i ][ 1 ] ], [ B[ i ][ 0 ], y, B[ i ][ 1 ] ], [ B[ i + 1 ][ 0 ], y, B[ i + 1 ][ 1 ] ], [ A[ i + 1 ][ 0 ], y, A[ i + 1 ][ 1 ] ], [ 0, - 1, 0 ] );
		const m = standard( { name: 'suite-soffit', color: new Color( 0.05, 0.05, 0.055 ), roughness: 0.6,
			surface: /* wgsl */`
	// dark painted deck: its ribs every 0.3 m, a sheen on the crests
	let fw = fwidth( in.P.x ) + fwidth( in.P.z ) + 0.001;
	let rib = 0.7 + 0.3 * smoothstep( 0.16, 0.3, abs( fract( in.P.z / 0.3 ) - 0.5 ) );
	s.albedo = vec3f( 0.055, 0.055, 0.06 ) * mix( rib, 0.85, clamp( fw * 6.0, 0.0, 1.0 ) );
	s.roughness = 0.55;
` } );
		m.underwaterLighting = 'none';
		m.setDefine( 'DRY', 1 );
		const mesh = new Mesh( panel.geometry(), m );
		mesh.name = 'suite-soffit';
		mesh.receiveShadow = true;
		this.group.add( mesh );
		// the downlights every ~6 m, a little in from the back
		const C = line( infield, d0 + 4.6 );
		for ( let i = 0; i < C.length - 1; i ++ ) {

			const [ ax, az ] = C[ i ], [ bx, bz ] = C[ i + 1 ];
			const len = Math.hypot( bx - ax, bz - az ), n = Math.max( 1, Math.round( len / 6 ) );
			for ( let k = 0; k < n; k ++ ) {

				const t = ( k + 0.5 ) / n, x = ax + ( bx - ax ) * t, z = az + ( bz - az ) * t;
				q.use( 'trim' );
				lathe( q, x, z, y - 0.03, y, 0.13, 0.13, 10 );
				q.use( 'can' );
				lathe( q, x, z, y - 0.032, y - 0.03, 0.1, 0.1, 10, { bottom: true } );

			}

		}

		// ---- FW2 (C2W-17): its front edge one dark band, as in auds's photo from behind 125 (27 Oct 2008)
		{

			const Fr = line( infield, dF - 0.03 );
			for ( let i = 0; i < Fr.length - 1; i ++ ) {

				const [ ax, az ] = Fr[ i ], [ bx, bz ] = Fr[ i + 1 ];
				let nx = - ( bz - az ), nz = bx - ax;
				const l = Math.hypot( nx, nz ) || 1;
				nx /= l; nz /= l;
				if ( nx * ( - ax ) + nz * ( - 40 - az ) < 0 ) {

					nx = - nx; nz = - nz;

				}

				q.use( 'black' );
				q.add( [ ax, y - 0.34, az ], [ bx, y - 0.34, bz ], [ bx, y + 0.04, bz ], [ ax, y + 0.04, az ], [ nx, 0, nz ] );

			}

		}
		// ---- end FW2
		// the beam along its back edge
		const E = line( infield, d1 - 0.2 );
		for ( let i = 0; i < E.length - 1; i ++ ) {

			q.use( 'maroon' );
			wide( q, [ E[ i ][ 0 ], y - 0.32, E[ i ][ 1 ] ], [ E[ i + 1 ][ 0 ], y - 0.32, E[ i + 1 ][ 1 ] ], [ 0, 1, 0 ], 0.62, 0.26 );

		}

	}

	// FI1 (CI-3): the suite level's walkway along the brick. In every 2008 photo of the concourse round
	// the infield a steel mezzanine runs along the suites' back at their level: a grated walkway on a deep
	// maroon girder, a galvanized picket rail with ushers leaning on it, the brick wall behind it washed by
	// a row of spots (harpo42, May 2008, 129-130: two ushers at its rail; ZoeR, Apr 2008, and docindigo76,
	// NLCS 2009, the Third Base Gate's atrium), and at each gate's atrium a bridge straight across the
	// concourse to the far side, its rail hung with a player's banner (hcwoodward, Game 5, 27 Oct 2008:
	// Pedro Feliz on the bridge, ushers at its rail; the Getty Game 3 photo: the First Base Gate's).
	// this.bridges: where they are, for the banners and the people at their rails.
	_mezzanine( q ) {

		const bowl = this.bowl, infield = bowl.path.slice( 2, 10 );
		const line = ( P, d ) => offsetPolyline( P, d, [ 0, - 40 ] );
		const { dIn, dOut, yU } = this.dims;
		const yW = LEVELS.suites, dW0 = dIn + 0.06, dW1 = dIn + 2.3;
		const up = [ 0, 1, 0 ];
		const brick = new Quads(), pick = new Quads();
		const segN = ( ax, az, bx, bz ) => {

			const l = Math.hypot( bx - ax, bz - az ), ux = ( bx - ax ) / l, uz = ( bz - az ) / l;
			let nx = - uz, nz = ux;
			if ( nx * ( - ax ) + nz * ( - 40 - az ) < 0 ) {

				nx = - nx; nz = - nz;

			}

			return { l, ux, uz, nx, nz };

		};

		// a rail from a to b ([ x, z ]) on a deck at yW: posts every ~1.6 m, the top and bottom rails, the
		// pickets between (uv along from u0)
		const rail = ( a, b, u0 = 0 ) => {

			const l = Math.hypot( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ] );
			const n = Math.max( 1, Math.round( l / 1.6 ) );
			q.use( 'galv' );
			for ( let k = 0; k <= n; k ++ ) {

				const x = a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * k / n, z = a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * k / n;
				pipe( q, [ x, yW, z ], [ x, yW + 1.07, z ], 0.026, 5 );

			}

			pipe( q, [ a[ 0 ], yW + 1.07, a[ 1 ] ], [ b[ 0 ], yW + 1.07, b[ 1 ] ], 0.026, 6 );
			pipe( q, [ a[ 0 ], yW + 0.12, a[ 1 ] ], [ b[ 0 ], yW + 0.12, b[ 1 ] ], 0.018, 4 );
			const { nx, nz } = segN( a[ 0 ], a[ 1 ], b[ 0 ], b[ 1 ] );
			pick.add( [ a[ 0 ], yW + 0.12, a[ 1 ] ], [ b[ 0 ], yW + 0.12, b[ 1 ] ], [ b[ 0 ], yW + 1.05, b[ 1 ] ], [ a[ 0 ], yW + 1.05, a[ 1 ] ], [ nx, 0, nz ], u0, u0 + l );

		};

		// where the bridges meet the walkway (its rail stops there)
		const OUT = new Along( line( infield, dOut ) ), RA = new Along( line( infield, dW1 - 0.06 ) );
		const gaps = [];
		for ( const g of [ [ - 80.95, 32.03 ], [ 73.5, 25.48 ] ] ) {

			const sg = OUT.nearest( g[ 0 ], g[ 1 ] );
			for ( const side of [ - 1, 1 ] ) {

				const p = OUT.at( sg + side * 13.5 ), r = RA.nearest( p.x + p.nx * 13, p.z + p.nz * 13 );
				gaps.push( [ r - 1.25, r + 1.25 ] );

			}

		}

		// the walkway along the brick
		const BW = line( infield, dW0 ), WE = line( infield, dW1 ), WG = line( infield, dW1 - 0.16 ), WR = line( infield, dW1 - 0.06 ), WS = line( infield, dW0 + 0.22 );
		let u = 0;
		for ( let i = 0; i < BW.length - 1; i ++ ) {

			const [ ax, az ] = BW[ i ], [ bx, bz ] = BW[ i + 1 ];
			const { l, nx, nz, ux, uz } = segN( ax, az, bx, bz );
			// the brick, facing the concourse, from the walkway up to the deck
			brick.add( [ ax, yW, az ], [ bx, yW, bz ], [ bx, yU, bz ], [ ax, yU, az ], [ - nx, 0, - nz ], u, u + l );
			// the spots along its top (one every 3 m, where the brick's scallops are)
			for ( let s = ( 1.5 - u % 3 + 3 ) % 3; s < l; s += 3 ) {

				const x = ax + ux * s - nx * 0.32, z = az + uz * s - nz * 0.32;
				q.use( 'trim' );
				obox( q, [ x, yU - 0.96, z ], [ ux, 0, uz ], 0.12, up, 0.16, [ nx, 0, nz ], 0.16 );
				q.use( 'can' );
				obox( q, [ x + nx * 0.09, yU - 1.0, z + nz * 0.09 ], [ ux, 0, uz ], 0.09, up, 0.09, [ nx, 0, nz ], 0.01 );

			}

			// the grated deck
			const [ ex, ez ] = WE[ i ], [ fx, fz ] = WE[ i + 1 ];
			q.use( 'grate' );
			q.add( [ ax, yW, az ], [ bx, yW, bz ], [ fx, yW, fz ], [ ex, yW, ez ], up );
			q.add( [ ax, yW - 0.06, az ], [ ex, yW - 0.06, ez ], [ fx, yW - 0.06, fz ], [ bx, yW - 0.06, bz ], [ 0, - 1, 0 ] );
			// the deep girder under its edge, a lighter one along the brick
			q.use( 'maroon' );
			wide( q, [ WG[ i ][ 0 ], yW - 0.4, WG[ i ][ 1 ] ], [ WG[ i + 1 ][ 0 ], yW - 0.4, WG[ i + 1 ][ 1 ] ], up, 0.8, 0.3, 0.035, 0.022, 1.5 );
			wide( q, [ WS[ i ][ 0 ], yW - 0.28, WS[ i ][ 1 ] ], [ WS[ i + 1 ][ 0 ], yW - 0.28, WS[ i + 1 ][ 1 ] ], up, 0.5, 0.2 );
			{

				// the rail, in pieces round the bridges' mouths
				const [ rx, rz ] = WR[ i ], [ sx, sz ] = WR[ i + 1 ];
				const r0 = RA.cum[ i ], rl = RA.cum[ i + 1 ] - r0;
				let t0 = 0;
				const piece = ( t1 ) => {

					if ( t1 - t0 > 0.3 ) rail( [ rx + ( sx - rx ) * t0 / rl, rz + ( sz - rz ) * t0 / rl ], [ rx + ( sx - rx ) * t1 / rl, rz + ( sz - rz ) * t1 / rl ], u + t0 );

				};
				for ( const [ g0, g1 ] of gaps ) if ( g1 > r0 && g0 < r0 + rl ) {

					piece( Math.max( 0, g0 - r0 ) );
					t0 = Math.min( rl, g1 - r0 );

				}

				piece( rl );

			}
			u += l;

		}

		// its ends: a rail across
		for ( const [ a, b ] of [ [ BW[ 0 ], WR[ 0 ] ], [ BW[ BW.length - 1 ], WR[ WR.length - 1 ] ] ] ) rail( a, b );

		this._bridges( OUT, rail, yW, dOut, dW1 );

		const bm = standard( { name: 'mezzanine-brick', color: new Color( 0.25, 0.068, 0.04 ), roughness: 0.85, surface: brickWGSL( { wash: yU - 1.0 } ) } );
		const pm = standard( { name: 'rail-pickets', color: new Color( 0.42, 0.43, 0.44 ), roughness: 0.4, metalness: 0.6, side: 'double', surface: PICKETS_WGSL } );
		for ( const [ geo, m, name ] of [ [ brick, bm, 'mezzanine-brick' ], [ pick, pm, 'rail-pickets' ] ] ) {

			m.underwaterLighting = 'none';
			m.setDefine( 'DRY', 1 );
			const mesh = new Mesh( geo.geometry(), m );
			mesh.name = name;
			mesh.receiveShadow = true;
			this.group.add( mesh );

		}

	}

	// the bridges at the ends of the gates' atria (_mezzanine): grated decks on two girders from the outer
	// columns across to the walkway, a rail each side
	_bridges( OUT, rail, yW, dOut, dW1 ) {

		const q = this.q, up = [ 0, 1, 0 ];
		this.bridges = [];
		for ( const g of [ { name: 'THIRD BASE GATE', at: [ - 80.95, 32.03 ] }, { name: 'FIRST BASE GATE', at: [ 73.5, 25.48 ] } ] ) {

			const sg = OUT.nearest( g.at[ 0 ], g.at[ 1 ] );
			for ( const side of [ - 1, 1 ] ) {

				const p = OUT.at( sg + side * 13.5 );
				const reach = dOut - dW1 + 0.1, W = 2.6;
				const a = [ p.x, p.z ], b = [ p.x + p.nx * reach, p.z + p.nz * reach ];
				const L = ( c, o ) => [ c[ 0 ] + p.ux * o, c[ 1 ] + p.uz * o ];
				const A0 = L( a, - W / 2 ), A1 = L( a, W / 2 ), B0 = L( b, - W / 2 ), B1 = L( b, W / 2 );
				q.use( 'grate' );
				q.add( [ A0[ 0 ], yW, A0[ 1 ] ], [ A1[ 0 ], yW, A1[ 1 ] ], [ B1[ 0 ], yW, B1[ 1 ] ], [ B0[ 0 ], yW, B0[ 1 ] ], up );
				q.add( [ A0[ 0 ], yW - 0.06, A0[ 1 ] ], [ B0[ 0 ], yW - 0.06, B0[ 1 ] ], [ B1[ 0 ], yW - 0.06, B1[ 1 ] ], [ A1[ 0 ], yW - 0.06, A1[ 1 ] ], [ 0, - 1, 0 ] );
				q.use( 'maroon' );
				for ( const o of [ - W / 2 + 0.15, W / 2 - 0.15 ] ) {

					const a2 = L( a, o ), b2 = L( b, o );
					wide( q, [ a2[ 0 ], yW - 0.4, a2[ 1 ] ], [ b2[ 0 ], yW - 0.4, b2[ 1 ] ], up, 0.8, 0.3, 0.035, 0.022, 1.5 );

				}

				for ( const o of [ - W / 2 + 0.06, W / 2 - 0.06 ] ) rail( L( a, o ), L( b, o ) );
				this.bridges.push( { gate: g.name, side, a, b, u: [ p.ux, p.uz ], n: [ p.nx, p.nz ], width: W, y: yW } );

			}

		}

	}

	// the domes as local lights, once the app has made them (after the places are built)
	lightUp( app ) {

		if ( this._lit || ! app?.localLights ) return;
		this._lit = true;
		domeLights( app, this.lamps );

	}

}

// HID domes (field frame [ x, y, z ], the lens) as local lights: the few nearest the camera light the floor
// and the steel round them for real (LocalLights picks them each frame); a wide downward cone, with the
// faint spill all round lighting the deck over them
export function domeLights( app, lamps ) {

	const F = app.field;
	for ( const [ x, y, z ] of lamps ) {

		const w = F.toWorld( x, z );
		app.localLights.add( { position: new Vector3( w.x, F.y0 + y, w.z ), dir: new Vector3( 0, - 1, 0 ), color: new Color( 1.0, 0.92, 0.8 ), intensity: 48, range: 14,
			cosInner: Math.cos( 0.9 ), cosOuter: Math.cos( 1.75 ), kind: 'dome' } );

	}

}
