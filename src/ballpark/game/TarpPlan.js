import { FOUL_TERRITORY, MOUND_CENTER, MOUND_RADIUS, MOUND_HEIGHT } from '../layout.js';

// The infield tarp through the suspension, as a pure function of the time into it (so scrubbing, any
// camera and any frame order agree). The crew (Suspension.js, on the players' rig), the roll's mesh
// (places/rituals/Roll.js) and the sheet (Details2008.setTarp) all read this one plan.
//
// How it went on the 27th (Getty 83458220, 83458149, 83458226, 83458702; puffygreenjacket 2983592600):
// the tarp is wound on a long black corrugated tube, stored under its canvas cover along the third base
// side's wall toward the left field pole (W4's tube). The crew run out, swing the roll out from the wall
// onto the left side of the infield so it lies along the sheet's left field edge (parallel to the first
// base line), and push it, bent over it shoulder to shoulder, across the infield toward the first base
// line; the sheet pays out behind it and the roll thins to the bare core. Then they take the edges by
// their black strap handles and walk the sheet square, and roll the empty core off onto the grass. On
// the 29th the same backwards: the core rolled back, the sheet wound up onto it from the first base
// side, the roll swung back to the wall.
//
// The sheet (Details2008): a 44 m square turned with the diamond round (0, -26): corners behind home
// plate (0, 5.1), past third (-31.1, -26), past second (0, -57.1) and past first (31.1, -26). Its u runs
// from the left field edge (u = 0: past second to past third) to the first base edge (u = 1: behind home to
// past first); v from past second (v = 0) to behind home / past third (v = 1).

export const SHEET = { c: [ 0, - 26 ], S: 44 };
const r2 = Math.SQRT1_2;
// the roll's radius: the whole tarp on it, and the bare core (83458149: about knee high)
export const R_FULL = 0.55, R_CORE = 0.3;
// how far the empty core is rolled on past the first base edge (m)
const CORE_OFF = 4.5;

// a point on the sheet
export function sheetPoint( u, v ) {

	const S = SHEET.S, lx = ( u - 0.5 ) * S, lz = ( v - 0.5 ) * S;
	return [ SHEET.c[ 0 ] + ( lx - lz ) * r2, SHEET.c[ 1 ] + ( lx + lz ) * r2 ];

}

// the direction the roll travels as it pays out (increasing u): toward home and first
export const PULL_DIR = [ r2, r2 ];

export function moundY( x, z ) {

	const r = Math.hypot( x, z + MOUND_CENTER ) / MOUND_RADIUS;
	if ( r >= 1 ) return 0;
	const t = Math.min( 1, Math.max( 0, ( r - 0.3 ) / 0.7 ) );
	return MOUND_HEIGHT * ( 1 - t * t * ( 3 - 2 * t ) );

}

const ease = ( x ) => {

	const t = Math.min( 1, Math.max( 0, x ) );
	return t * t * ( 3 - 2 * t );

};
// eased in and out, but mostly steady (the crew's walking pace across the infield)
const steady = ( x ) => {

	const t = Math.min( 1, Math.max( 0, x ) ), a = 0.12;
	if ( t < a ) return t * t / ( 2 * a * ( 1 - a ) );
	if ( t > 1 - a ) return 1 - ( 1 - t ) * ( 1 - t ) / ( 2 * a * ( 1 - a ) );
	return ( t - a / 2 ) / ( 1 - a );

};

// The stowed tube's axis, as W4 laid it (places/rail/Tarp.js tubePath: along the wall from past the
// third base side's 150 ft point round the corners toward the pole, 0.72 m off it, 40 m), sampled.
let _tube = null;
export function tubeAxis() {

	if ( _tube ) return _tube;
	const F = FOUL_TERRITORY, GAP = 0.72, LENGTH = 40;
	const pts = [ F[ 10 ], F[ 11 ], F[ 12 ], F[ 13 ] ];
	const nrm = ( a, b ) => {

		const l = Math.hypot( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ] );
		let n = [ - ( b[ 1 ] - a[ 1 ] ) / l, ( b[ 0 ] - a[ 0 ] ) / l ];
		const mx = ( a[ 0 ] + b[ 0 ] ) / 2, mz = ( a[ 1 ] + b[ 1 ] ) / 2;
		if ( n[ 0 ] * ( 0 - mx ) + n[ 1 ] * ( - 38.9 - mz ) < 0 ) n = [ - n[ 0 ], - n[ 1 ] ];
		return n;

	};
	const off = pts.map( ( p, i ) => {

		const n0 = i > 0 ? nrm( pts[ i - 1 ], p ) : null, n1 = i < pts.length - 1 ? nrm( p, pts[ i + 1 ] ) : null;
		let n = n0 && n1 ? [ n0[ 0 ] + n1[ 0 ], n0[ 1 ] + n1[ 1 ] ] : ( n0 || n1 );
		const l = Math.hypot( ...n );
		n = [ n[ 0 ] / l, n[ 1 ] / l ];
		const k = n0 && n1 ? GAP / Math.max( 0.5, n[ 0 ] * n1[ 0 ] + n[ 1 ] * n1[ 1 ] ) : GAP;
		return [ p[ 0 ] + n[ 0 ] * k, p[ 1 ] + n[ 1 ] * k ];

	} );
	const dense = [];
	for ( let i = 0; i < off.length - 1; i ++ ) {

		const a = off[ i ], b = off[ i + 1 ], l = Math.hypot( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ] );
		for ( let s = 0; s < l; s += 0.2 ) dense.push( [ a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * s / l, a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * s / l ] );

	}

	let P = dense;
	for ( let it = 0; it < 6; it ++ ) P = P.map( ( p, i ) => i === 0 || i === P.length - 1 ? p : [ ( P[ i - 1 ][ 0 ] + 2 * p[ 0 ] + P[ i + 1 ][ 0 ] ) / 4, ( P[ i - 1 ][ 1 ] + 2 * p[ 1 ] + P[ i + 1 ][ 1 ] ) / 4 ] );
	// from 0.8 m past the first point, LENGTH metres of it, with the arc length
	const out = [];
	let acc = 0;
	for ( let i = 0; i < P.length; i ++ ) {

		if ( i ) acc += Math.hypot( P[ i ][ 0 ] - P[ i - 1 ][ 0 ], P[ i ][ 1 ] - P[ i - 1 ][ 1 ] );
		if ( acc < 0.8 ) continue;
		if ( acc > 0.8 + LENGTH ) break;
		out.push( { p: P[ i ], s: acc - 0.8 } );

	}

	return _tube = out;

}

// a point at a fraction f (0..1) along the stowed tube
function tubeAt( f ) {

	const T = tubeAxis(), s = f * T[ T.length - 1 ].s;
	let i = T.findIndex( ( q ) => q.s >= s );
	if ( i < 1 ) i = 1;
	const a = T[ i - 1 ], b = T[ i ], k = ( s - a.s ) / Math.max( 1e-6, b.s - a.s );
	return [ a.p[ 0 ] + ( b.p[ 0 ] - a.p[ 0 ] ) * k, a.p[ 1 ] + ( b.p[ 1 ] - a.p[ 1 ] ) * k ];

}

// The times (s into the suspension's break; the 29th's from its start, the split)
export const T27 = { out: 1.5, lift: [ 7, 20 ], pull: [ 20, 44 ], coreOff: [ 46, 53 ] };
// (the 29th: it came off in the afternoon, before the gates opened at 5:30: the park still empty)
export const T29 = { coreBack: [ 1.5, 5 ], unpull: [ 5, 22 ], stow: [ 22, 27 ] };

// The tarp's state: phase ('stowed' | 'lift' | 'pull' | 'on'), pull (0..1 of the sheet laid out, for
// Details2008.setTarp), lift (0..1 from the wall to the sheet's left field edge), u (where the roll's
// axis is across the sheet), r (the roll's radius), speed (m/s the roll moves, for the crew's gait),
// dir (+1 paying out toward first, -1 winding back), stowed (W4's tube on the wall is the tarp).
// `S`: director.night( t ) (its lt, dur and split).
export function tarpState( N ) {

	const st = { phase: 'stowed', pull: 0, lift: 0, u: 0, r: R_FULL, dir: 1, speed: 0, stowed: true, core: false, bare: 0 };
	if ( ! N || ! N.susp ) return st;
	const lt = N.lt, s27 = N.split - N.t0;
	const radius = ( k ) => Math.sqrt( R_CORE * R_CORE + ( 1 - k ) * ( R_FULL * R_FULL - R_CORE * R_CORE ) );
	const coreU = 1 + CORE_OFF / SHEET.S;
	if ( lt < s27 ) {

		const T = T27;
		if ( lt < T.lift[ 0 ] ) return st;
		st.stowed = false;
		if ( lt < T.lift[ 1 ] ) {

			st.phase = 'lift';
			st.lift = ease( ( lt - T.lift[ 0 ] ) / ( T.lift[ 1 ] - T.lift[ 0 ] ) );
			st.speed = 2.5;
			return st;

		}

		st.lift = 1;
		const kp = steady( ( lt - T.pull[ 0 ] ) / ( T.pull[ 1 ] - T.pull[ 0 ] ) );
		st.pull = kp;
		st.u = kp;
		st.r = radius( kp );
		// the black core shows through the last turns
		st.bare = ease( ( kp - 0.93 ) / 0.07 );
		st.phase = kp < 1 ? 'pull' : 'on';
		st.speed = kp > 0 && kp < 1 ? SHEET.S / ( T.pull[ 1 ] - T.pull[ 0 ] ) : 0;
		if ( kp >= 1 ) {

			// the bare core rolled on off the sheet onto the grass
			const kc = ease( ( lt - T.coreOff[ 0 ] ) / ( T.coreOff[ 1 ] - T.coreOff[ 0 ] ) );
			st.u = 1 + ( coreU - 1 ) * kc;
			st.core = true;
			st.speed = kc > 0 && kc < 1 ? 1.2 : 0;

		}

		return st;

	}

	// the 29th
	const T = T29, l2 = lt - s27;
	st.stowed = false;
	st.lift = 1;
	st.dir = - 1;
	if ( l2 < T.unpull[ 0 ] ) {

		const kc = ease( ( l2 - T.coreBack[ 0 ] ) / ( T.coreBack[ 1 ] - T.coreBack[ 0 ] ) );
		st.phase = 'on';
		st.pull = 1;
		st.u = coreU + ( 1 - coreU ) * kc;
		st.r = R_CORE;
		st.core = true;
		st.bare = 1;
		st.speed = kc > 0 && kc < 1 ? 1.0 : 0;
		return st;

	}

	if ( l2 < T.unpull[ 1 ] ) {

		const kp = 1 - steady( ( l2 - T.unpull[ 0 ] ) / ( T.unpull[ 1 ] - T.unpull[ 0 ] ) );
		st.phase = 'pull';
		st.pull = kp;
		st.u = kp;
		st.r = radius( kp );
		st.bare = ease( ( kp - 0.93 ) / 0.07 );
		st.speed = SHEET.S / ( T.unpull[ 1 ] - T.unpull[ 0 ] );
		return st;

	}

	if ( l2 < T.stow[ 1 ] ) {

		st.phase = 'lift';
		st.pull = 0;
		st.lift = 1 - ease( ( l2 - T.stow[ 0 ] ) / ( T.stow[ 1 ] - T.stow[ 0 ] ) );
		st.speed = 2.5;
		return st;

	}

	st.stowed = true;
	st.lift = 0;
	st.phase = 'stowed';
	return st;

}

// The roll's axis as n + 1 points (x, y, z: its centre line, y the radius above the ground or the mound)
// from the sheet's v = 0 end to v = 1: swinging between the wall and the left field edge, or across the
// sheet at u. out: an array to fill (reused)
export function rollAxis( st, n = 40, out = [] ) {

	for ( let i = 0; i <= n; i ++ ) {

		const v = i / n;
		let x, z;
		if ( st.phase === 'lift' || st.phase === 'stowed' ) {

			// the pivot: the end by the infield (v = 1, past third) comes off the wall's near end, the far
			// end (v = 0, past second) swings round from by the pole (the men out there run it)
			const w = tubeAt( 1 - v ), e = sheetPoint( 0, v ), k = st.lift;
			x = w[ 0 ] + ( e[ 0 ] - w[ 0 ] ) * k;
			z = w[ 1 ] + ( e[ 1 ] - w[ 1 ] ) * k;

		} else {

			[ x, z ] = sheetPoint( st.u, v );

		}

		const q = out[ i ] || ( out[ i ] = [ 0, 0, 0 ] );
		q[ 0 ] = x; q[ 1 ] = moundY( x, z ) + st.r; q[ 2 ] = z;

	}

	out.length = n + 1;
	return out;

}

// how far the roll has rolled (its turning is this over its radius): about 30 m swinging out from the
// wall (at its middle), then across the sheet
export function rollDistance( st ) {

	if ( st.phase === 'lift' || st.phase === 'stowed' ) return st.lift * 30;
	return 30 + st.u * SHEET.S;

}

// a point on the stowed tube, for the crew waiting by it (f 0..1 from its infield end)
export { tubeAt };
